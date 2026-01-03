import { createHash } from 'crypto'

import type { IRateLimitManager } from '@lesca/browser-automation'
import { GraphQLError, RateLimitError, NetworkError } from '@lesca/error'
import { getDefaultConfig } from '@lesca/shared/config'
import type { Problem, ProblemList, ProblemListFilters, AuthCredentials } from '@lesca/shared/types'
import { calculateQuality, logger } from '@lesca/shared/utils'
import type { TieredCache } from '@lesca/shared/utils'
import pRetry, { AbortError } from 'p-retry'

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
  }>
}

/**
 * GraphQL Client Options
 */
export interface GraphQLClientOptions {
  auth?: AuthCredentials
  rateLimiter?: RateLimiter
  cache?: TieredCache
  rateLimitManager?: IRateLimitManager
}

/**
 * Helper to check if an object is GraphQLClientOptions
 */
function isGraphQLClientOptions(obj: unknown): obj is GraphQLClientOptions {
  if (!obj || typeof obj !== 'object') return false
  // GraphQLClientOptions has optional 'auth', 'rateLimiter', 'cache', 'rateLimitManager'
  // AuthCredentials has 'cookies' array - use this to distinguish
  return !('cookies' in obj)
}

/**
 * GraphQL Client for LeetCode API
 * Handles all communication with LeetCode's GraphQL endpoint
 */
export class GraphQLClient {
  private readonly endpoint = 'https://leetcode.com/graphql'
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  private auth?: AuthCredentials
  private rateLimiter?: RateLimiter
  private cache?: TieredCache
  private rateLimitManager?: IRateLimitManager

  /**
   * Create a new GraphQL client
   *
   * @param authOrOptions - Either AuthCredentials (legacy) or GraphQLClientOptions
   * @param rateLimiter - Rate limiter (legacy, ignored if options object is used)
   * @param cache - Cache (legacy, ignored if options object is used)
   */
  constructor(
    authOrOptions?: AuthCredentials | GraphQLClientOptions,
    rateLimiter?: RateLimiter,
    cache?: TieredCache
  ) {
    // Support both legacy positional args and new options object
    if (authOrOptions && isGraphQLClientOptions(authOrOptions)) {
      // New options format
      if (authOrOptions.auth) {
        this.auth = authOrOptions.auth
      }
      if (authOrOptions.rateLimiter) {
        this.rateLimiter = authOrOptions.rateLimiter
      }
      if (authOrOptions.cache) {
        this.cache = authOrOptions.cache
      }
      if (authOrOptions.rateLimitManager) {
        this.rateLimitManager = authOrOptions.rateLimitManager
      }
    } else {
      // Legacy positional format
      if (authOrOptions) {
        this.auth = authOrOptions
      }
      if (rateLimiter) {
        this.rateLimiter = rateLimiter
      }
      if (cache) {
        this.cache = cache
      }
    }
  }

  async query<T>(
    query: string,
    variables?: Record<string, unknown>,
    options: { noCache?: boolean; ttl?: number } = {}
  ): Promise<T> {
    const queryHash = createHash('sha256').update(query).digest('hex')
    const varsStr = JSON.stringify(variables || {})
    const cacheKey = `graphql:${queryHash}:${varsStr}`

    if (this.cache && !options.noCache) {
      const cached = await this.cache.get<T>(cacheKey)
      if (cached) {
        return cached
      }
    }

    // Check rate limit decision before proceeding
    if (this.rateLimitManager) {
      const decision = this.rateLimitManager.getDecision(this.endpoint)
      if (decision.delayMs > 0) {
        logger.debug(`Rate limit: waiting ${decision.delayMs}ms before GraphQL query`, {
          reason: decision.reason,
        })
        await new Promise((resolve) => setTimeout(resolve, decision.delayMs))
      }
    }

    if (this.rateLimiter) {
      await this.rateLimiter.acquire()
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
    }

    if (this.auth) {
      headers['Cookie'] = this.formatCookies(this.auth.cookies)
      if (this.auth.csrfToken) {
        headers['x-csrftoken'] = this.auth.csrfToken
      }
    }

    const runQuery = async () => {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query, variables }),
        })

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')

          // Record rate limit with manager
          if (this.rateLimitManager) {
            this.rateLimitManager.recordRateLimited(
              this.endpoint,
              retryAfter ? parseInt(retryAfter) : undefined
            )
          }

          throw new RateLimitError('Rate limit exceeded', {
            ...(retryAfter ? { retryAfter: parseInt(retryAfter) } : {}),
          })
        }

        if (!response.ok) {
          const error = new GraphQLError(
            'GQL_QUERY_FAILED',
            `HTTP ${response.status}: ${response.statusText}`,
            { statusCode: response.status }
          )

          // Don't retry 4xx errors (except 429 which is handled above)
          if (response.status >= 400 && response.status < 500) {
            throw new AbortError(error)
          }

          throw error
        }

        const result = (await response.json()) as GraphQLResponse<T>

        if (result.errors && result.errors.length > 0) {
          const errorMessages = result.errors.map((e) => e.message).join(', ')
          // GraphQL errors might be recoverable or not, but usually they are application errors
          // We'll abort retry for these unless we know specific ones are transient
          throw new AbortError(
            new GraphQLError('GQL_QUERY_FAILED', `GraphQL errors: ${errorMessages}`)
          )
        }

        if (!result.data) {
          throw new AbortError(
            new GraphQLError('GQL_INVALID_RESPONSE', 'No data returned from GraphQL query')
          )
        }

        // Record success with rate limit manager
        if (this.rateLimitManager) {
          this.rateLimitManager.recordSuccess(this.endpoint)
        }

        return result.data
      } catch (error) {
        if (error instanceof AbortError) {
          throw error
        }

        if (
          error instanceof NetworkError ||
          error instanceof RateLimitError ||
          error instanceof GraphQLError
        ) {
          throw error
        }

        // Wrap unknown errors in GraphQLError but allow retry if it's likely network related
        // If it's a fetch error (TypeError), it will be caught here
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw error // Retry fetch errors
        }

        // For other errors, wrap and abort
        throw new AbortError(
          new GraphQLError(
            'GQL_QUERY_FAILED',
            `Failed to execute GraphQL query: ${error instanceof Error ? error.message : String(error)}`,
            { ...(error instanceof Error ? { cause: error } : {}) }
          )
        )
      }
    }

    const data = await pRetry(runQuery, {
      retries: 3,
      minTimeout: 1000,
      maxTimeout: 10000,
      randomize: true,
      onFailedAttempt: (error) => {
        logger.warn(
          `GraphQL query attempt ${error.attemptNumber} failed. Retrying in ${error.retriesLeft} attempts...`,
          { error: error.message }
        )
      },
    })

    if (this.cache && !options.noCache) {
      const config = getDefaultConfig()
      let ttl = options.ttl

      if (!ttl) {
        if (query.includes('question(')) {
          ttl = config.cache.ttl.problem
        } else if (query.includes('questionList')) {
          ttl = config.cache.ttl.list
        } else {
          ttl = config.cache.ttl.problem // Default to problem TTL
        }
      }
      await this.cache.set(cacheKey, data, ttl)
    }

    return data
  }

  /**
   * Get a single problem by title slug
   */
  async getProblem(titleSlug: string): Promise<Problem> {
    const query = `
      query getProblem($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          questionFrontendId
          title
          titleSlug
          likes
          dislikes
          content
          difficulty
          isPaidOnly
          exampleTestcases
          hints
          mysqlSchemas
          dataSchemas

          topicTags {
            name
            slug
          }

          companyTagStats
          stats

          codeSnippets {
            lang
            langSlug
            code
          }

          similarQuestions

          solution {
            id
            content
            contentTypeId
            canSeeDetail
          }
        }
      }
    `

    const data = await this.query<{ question: Problem }>(query, { titleSlug })

    if (!data.question) {
      throw new GraphQLError('GQL_QUERY_FAILED', `Problem not found: ${titleSlug}`, {
        statusCode: 404,
      })
    }

    // Calculate quality score
    data.question.quality = calculateQuality(data.question.likes, data.question.dislikes)

    return data.question
  }

  /**
   * Get a list of problems with optional filtering
   */
  async getProblemList(filters?: ProblemListFilters, limit = 50, offset = 0): Promise<ProblemList> {
    const query = `
      query problemsetQuestionList(
        $categorySlug: String
        $filters: QuestionListFilterInput
        $limit: Int
        $skip: Int
      ) {
        problemsetQuestionList: questionList(
          categorySlug: $categorySlug
          filters: $filters
          limit: $limit
          skip: $skip
        ) {
          total: totalNum
          questions: data {
            questionId
            questionFrontendId
            title
            titleSlug
            likes
            dislikes
            difficulty
            acRate
            paidOnly: isPaidOnly
            topicTags {
              name
              slug
            }
          }
        }
      }
    `

    const variables: Record<string, unknown> = {
      categorySlug: 'algorithms',
      limit,
      skip: offset,
    }

    if (filters) {
      const graphqlFilters: Record<string, unknown> = {}

      if (filters.difficulty) {
        graphqlFilters.difficulty = filters.difficulty.toUpperCase()
      }

      if (filters.tags && filters.tags.length > 0) {
        graphqlFilters.tags = filters.tags
      }

      if (filters.status) {
        graphqlFilters.status = filters.status.toUpperCase()
      }

      if (filters.listId) {
        graphqlFilters.listId = filters.listId
      }

      if (filters.searchKeywords) {
        graphqlFilters.searchKeywords = filters.searchKeywords
      }

      variables.filters = graphqlFilters
    }

    const data = await this.query<{ problemsetQuestionList: ProblemList }>(query, variables)

    // Calculate quality score for each problem
    data.problemsetQuestionList.questions.forEach((q) => {
      q.quality = calculateQuality(q.likes, q.dislikes)
    })

    return data.problemsetQuestionList
  }

  /**
   * Get all problems matching filters (handles pagination automatically)
   */
  async getAllProblems(filters?: ProblemListFilters): Promise<ProblemList> {
    const pageSize = 100
    let offset = 0
    const allQuestions: ProblemList['questions'] = []
    let total = 0

    const firstPage = await this.getProblemList(filters, pageSize, offset)
    total = firstPage.total
    allQuestions.push(...firstPage.questions)
    offset += pageSize

    while (offset < total) {
      const page = await this.getProblemList(filters, pageSize, offset)
      allQuestions.push(...page.questions)
      offset += pageSize
    }

    return {
      total,
      questions: allQuestions,
    }
  }

  /**
   * Get user profile by username
   */
  async getUserProfile(username: string) {
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            realName
            aboutMe
            reputation
            ranking
          }
          submitStats {
            acSubmissionNum {
              difficulty
              count
            }
          }
          badges {
            id
            name
            displayName
            icon
          }
        }
      }
    `

    const data = await this.query<{ matchedUser: unknown }>(query, { username })

    if (!data.matchedUser) {
      throw new GraphQLError('GQL_QUERY_FAILED', `User not found: ${username}`, { statusCode: 404 })
    }

    return data.matchedUser
  }

  /**
   * Format cookies for HTTP header
   */
  private formatCookies(cookies: AuthCredentials['cookies']): string {
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
  }

  /**
   * Update authentication credentials
   */
  setAuth(auth: AuthCredentials) {
    this.auth = auth
  }

  /**
   * Clear authentication credentials
   */
  clearAuth() {
    delete this.auth
  }

  /**
   * Set rate limit manager for intelligent rate limit handling
   */
  setRateLimitManager(manager: IRateLimitManager) {
    this.rateLimitManager = manager
  }

  /**
   * Get rate limit manager (if configured)
   */
  getRateLimitManager(): IRateLimitManager | undefined {
    return this.rateLimitManager
  }
}

/**
 * Simple rate limiter
 * Ensures minimum delay between requests
 */
export class RateLimiter {
  private lastRequest = 0

  constructor(
    private minDelay: number, // Minimum milliseconds between requests
    private maxDelay: number, // Maximum delay with jitter
    private jitter = true
  ) {}

  /**
   * Acquire permission to make a request
   * Waits if necessary to respect rate limits
   */
  async acquire(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequest

    let delay = this.minDelay
    if (this.jitter && this.maxDelay > this.minDelay) {
      const jitterRange = this.maxDelay - this.minDelay
      delay = this.minDelay + Math.random() * jitterRange
    }

    if (elapsed < delay) {
      await this.sleep(delay - elapsed)
    }

    this.lastRequest = Date.now()
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Adjust delay after rate limit detection
   */
  increaseDelay(multiplier = 2) {
    this.minDelay *= multiplier
    this.maxDelay *= multiplier
  }

  /**
   * Reset delay to original values
   */
  resetDelay(minDelay: number, maxDelay: number) {
    this.minDelay = minDelay
    this.maxDelay = maxDelay
  }
}
