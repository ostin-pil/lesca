import { GraphQLError, LescaError, ScrapingError, BrowserError } from '@lesca/error'

import type { GraphQLClient } from '@/api-client/src/graphql-client'
import { SelectorManager } from '@/browser-automation/src/index'
import { DEFAULT_BROWSER_TIMEOUT } from '@/shared/config/src/constants'
import type {
  ScraperStrategy,
  ScrapeRequest,
  ProblemScrapeRequest,
  RawData,
  Problem,
  BrowserDriver,
  AuthCredentials,
} from '@/shared/types/src/index'
import { logger } from '@/shared/utils/src/index'

/**
 * Problem scraper strategy
 * Handles scraping of individual problems
 */
export class ProblemScraperStrategy implements ScraperStrategy {
  readonly name = 'problem'
  readonly priority = 100 // High priority

  private selectors: SelectorManager

  constructor(
    private graphqlClient: GraphQLClient,
    private browserDriver: BrowserDriver,
    private auth?: AuthCredentials
  ) {
    this.selectors = new SelectorManager()
  }

  /**
   * Check if this strategy can handle the request
   */
  canHandle(request: ScrapeRequest): boolean {
    return request.type === 'problem'
  }

  /**
   * Execute the scraping strategy
   */
  async execute(request: ScrapeRequest): Promise<RawData> {
    if (!this.canHandle(request)) {
      throw new ScrapingError(
        'SCRAPE_NO_STRATEGY',
        `ProblemScraperStrategy cannot handle request type: ${request.type}`,
        { context: { requestType: request.type, strategyName: this.name } }
      )
    }

    const problemRequest = request as ProblemScrapeRequest

    try {
      // 1. Try GraphQL first (faster, structured data)
      const problem = await this.graphqlClient.getProblem(problemRequest.titleSlug)

      this.validateProblem(problem)

      return {
        type: 'problem',
        data: problem,
        metadata: {
          scrapedAt: new Date(),
          source: 'graphql',
          url: `https://leetcode.com/problems/${problemRequest.titleSlug}/`,
        },
      }
    } catch (error) {
      // 2. Fallback to browser automation if GraphQL fails
      // GraphQL might fail for premium problems or network issues
      logger.warn(
        `GraphQL scraping failed for "${problemRequest.titleSlug}", falling back to browser`,
        { error: error instanceof Error ? error.message : String(error) }
      )

      try {
        const problem = await this.scrapeWithBrowser(problemRequest)
        return {
          type: 'problem',
          data: problem,
          metadata: {
            scrapedAt: new Date(),
            source: 'browser',
            url: `https://leetcode.com/problems/${problemRequest.titleSlug}/`,
          },
        }
      } catch (browserError) {
        // If it's a specific actionable error (e.g. premium content, auth required), rethrow it
        if (
          browserError instanceof LescaError &&
          (browserError.code === 'AUTH_PREMIUM_REQUIRED' ||
            browserError.code === 'AUTH_INVALID_CREDENTIALS')
        ) {
          throw browserError
        }

        // If both fail, throw the original GraphQL error if it was a permission issue,
        // otherwise throw the browser error as it's the last attempt
        throw new ScrapingError(
          'SCRAPE_CONTENT_EXTRACTION_FAILED',
          `Failed to scrape problem "${problemRequest.titleSlug}" (GraphQL and Browser both failed)`,
          {
            ...(browserError instanceof Error ? { cause: browserError } : {}),
            context: {
              graphqlError: error instanceof Error ? error.message : String(error),
              browserError:
                browserError instanceof Error ? browserError.message : String(browserError),
            },
          }
        )
      }
    }
  }

  /**
   * Scrape problem using browser automation
   */
  private async scrapeWithBrowser(request: ProblemScrapeRequest): Promise<Problem> {
    // 1. Launch browser if not already launched
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    if (!this.browserDriver.getBrowser()) {
      await this.browserDriver.launch({
        headless: true,
        timeout: request.timeout || DEFAULT_BROWSER_TIMEOUT,
        blockResources: ['image', 'font', 'media'],
      })
    }

    // 2. Navigate to problem page
    const url = `https://leetcode.com/problems/${request.titleSlug}/description/`
    await this.browserDriver.navigate(url)

    // 3. Wait for content to load
    await this.waitForContent()

    // 4. Check for premium content
    const isPremium = await this.checkPremiumContent()
    if (isPremium && !request.includePremium) {
      throw new LescaError(
        'AUTH_PREMIUM_REQUIRED',
        `Problem "${request.titleSlug}" is premium content. Use includePremium: true to attempt scraping.`
      )
    }

    if (isPremium && !this.auth) {
      throw new LescaError(
        'AUTH_INVALID_CREDENTIALS',
        `Problem "${request.titleSlug}" requires authentication. Please provide credentials.`
      )
    }

    // 5. Extract content
    return this.extractProblem(request.titleSlug, isPremium)
  }

  /**
   * Wait for problem content to load
   */
  private async waitForContent(): Promise<void> {
    const problemSelectors = this.selectors.getProblemSelectors()

    // Wait for title or description
    try {
      // Use primary selector for waiting
      await this.browserDriver.waitForSelector(
        this.selectors.getPrimary(problemSelectors.title),
        10000
      )
    } catch (error) {
      throw new BrowserError('BROWSER_TIMEOUT', 'Timeout waiting for problem content to load', {
        ...(error instanceof Error ? { cause: error } : {}),
      })
    }
  }

  /**
   * Check if content is premium
   */
  private async checkPremiumContent(): Promise<boolean> {
    // Check for premium lock icon or subscription prompt
    // This is a heuristic, might need adjustment based on actual UI
    const premiumSelectors = ['[data-icon="lock"]', 'text="Subscribe to unlock"', '.premium-locked']

    for (const selector of premiumSelectors) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      if (await this.browserDriver.elementExists(selector)) {
        return true
      }
    }
    return false
  }

  /**
   * Extract problem data from page
   */
  private async extractProblem(titleSlug: string, isPaidOnly: boolean): Promise<Problem> {
    const problemSelectors = this.selectors.getProblemSelectors()

    // Extract title
    const title =
      (await this.browserDriver.extractWithFallback(
        this.selectors.getAll(problemSelectors.title)
      )) || ''

    // Extract ID (often in the title like "1. Two Sum")
    const titleMatch = title.match(/^(\d+)\.\s*(.+)$/)
    const questionFrontendId = titleMatch ? titleMatch[1] || '0' : '0'
    const cleanTitle = titleMatch ? titleMatch[2] || title : title

    // Extract content/description
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const content =
      (await this.browserDriver.extractWithFallback(
        this.selectors.getAll(problemSelectors.description)
      )) || ''

    // Extract difficulty
    const difficultyStr = await this.browserDriver.extractWithFallback(
      this.selectors.getAll(problemSelectors.difficulty)
    )
    // Cast to Difficulty type (simple validation could be added)
    const difficulty = (difficultyStr || 'Easy') as 'Easy' | 'Medium' | 'Hard'

    // Extract tags
    const tags = await this.extractTags()

    // Extract code snippets (if available and not locked)
    const codeSnippets = await this.extractCodeSnippets()

    return {
      questionId: questionFrontendId, // Using frontend ID as questionId for consistency
      questionFrontendId,
      title: cleanTitle,
      titleSlug,
      content,
      difficulty,
      likes: 0,
      dislikes: 0,
      quality: 0,
      topicTags: tags,
      codeSnippets,
      stats: '{}', // Placeholder JSON
      exampleTestcases: null,
      hints: [],
      companyTagStats: null,
      similarQuestions: null,
      solution: null,
      mysqlSchemas: [],
      dataSchemas: [],
      isPaidOnly,
    }
  }

  /**
   * Extract tags
   */
  private async extractTags(): Promise<Array<{ name: string; slug: string }>> {
    const problemSelectors = this.selectors.getProblemSelectors()
    try {
      const tagElements = await this.browserDriver.extractAll(
        this.selectors.getPrimary(problemSelectors.tags)
      )
      return tagElements.map((tag) => ({
        name: tag,
        slug: tag.toLowerCase().replace(/\s+/g, '-'),
      }))
    } catch {
      return []
    }
  }

  /**
   * Extract code snippets
   */
  private extractCodeSnippets(): Promise<Array<{ lang: string; langSlug: string; code: string }>> {
    // This is complex because it involves interacting with the language dropdown/tabs
    // For now, we might skip this or implement a basic version if the editor is visible
    // The editor content might be in a CodeMirror or Monaco instance which is hard to scrape directly

    // Placeholder: return empty for now as extracting code from Monaco/CodeMirror via DOM is non-trivial
    // and usually requires executing JS in the page context.
    return Promise.resolve([])
  }

  /**
   * Validate problem data
   */
  private validateProblem(problem: Problem): void {
    if (!problem.questionId) {
      throw new GraphQLError('GQL_INVALID_RESPONSE', 'Invalid problem: missing questionId')
    }

    if (!problem.title) {
      throw new GraphQLError('GQL_INVALID_RESPONSE', 'Invalid problem: missing title')
    }

    if (!problem.content) {
      throw new GraphQLError('GQL_INVALID_RESPONSE', 'Invalid problem: missing content')
    }
  }
}
