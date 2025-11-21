import type {
  Problem,
  ProblemList,
  ProblemListFilters,
  AuthCredentials,
} from '@/shared/types/src/index'
import { GraphQLError, RateLimitError } from '@/shared/types/src/index'

/**
 * GraphQL response wrapper
 */
interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
  }>
}

/**
 * GraphQL Client for LeetCode API
 * Handles all communication with LeetCode's GraphQL endpoint
 */
export class GraphQLClient {
  private readonly endpoint = 'https://leetcode.com/graphql'
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  constructor(
    private auth?: AuthCredentials,
    private rateLimiter?: RateLimiter
  ) {}

  /**
   * Execute a GraphQL query
   */
  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
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

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      })

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        throw new RateLimitError(
          'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter) : undefined
        )
      }

      if (!response.ok) {
        throw new GraphQLError(`HTTP ${response.status}: ${response.statusText}`, response.status)
      }

      const result = await response.json() as GraphQLResponse<T>

      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map((e) => e.message).join(', ')
        throw new GraphQLError(`GraphQL errors: ${errorMessages}`)
      }

      if (!result.data) {
        throw new GraphQLError('No data returned from GraphQL query')
      }

      return result.data
    } catch (error) {
      if (error instanceof GraphQLError || error instanceof RateLimitError) {
        throw error
      }

      throw new GraphQLError(
        `Failed to execute GraphQL query: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined
      )
    }
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
          content
          difficulty
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
      throw new GraphQLError(`Problem not found: ${titleSlug}`, 404)
    }

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
      throw new GraphQLError(`User not found: ${username}`, 404)
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
    this.auth = undefined
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
