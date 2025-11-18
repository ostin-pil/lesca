import { BrowserError } from '@lesca/error'

import type {
  ScraperStrategy,
  ScrapeRequest,
  RawData,
  BrowserDriver,
  AuthCredentials,
  EditorialScrapeRequest,
  EditorialContent,
  CodeSnippet,
} from '../../../shared/types/src/index.js'
import { LescaError } from '../../../shared/types/src/index.js'
import { SelectorManager } from '../../browser-automation/src/index.js'

/**
 * Editorial Scraper Strategy
 * Uses browser automation to scrape editorial/solution content
 * Handles both free and premium content
 */
export class EditorialScraperStrategy implements ScraperStrategy {
  readonly name = 'editorial'
  readonly priority = 90 // Slightly lower than problem strategy

  private selectors: SelectorManager

  constructor(
    private browserDriver: BrowserDriver,
    private auth?: AuthCredentials
  ) {
    this.selectors = new SelectorManager()
  }

  /**
   * Check if this strategy can handle the request
   */
  canHandle(request: ScrapeRequest): boolean {
    return request.type === 'editorial'
  }

  /**
   * Execute the scraping
   */
  async execute(request: ScrapeRequest): Promise<RawData> {
    if (!this.canHandle(request)) {
      throw new LescaError(`EditorialScraperStrategy cannot handle request type: ${request.type}`, 'INVALID_REQUEST_TYPE')
    }

    const editorialRequest = request as EditorialScrapeRequest

    try {
      // 1. Launch browser if not already launched
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      if (!this.browserDriver.getBrowser()) {
        await this.browserDriver.launch({
          headless: true,
          timeout: 30000,
          blockResources: ['image', 'font', 'media'], // Block unnecessary resources
        })
      }

      // 2. Navigate to editorial page
      const url = this.getEditorialUrl(editorialRequest.titleSlug)
      await this.browserDriver.navigate(url)

      // 3. Wait for content to load
      await this.waitForContent()

      // 4. Check if content is premium
      const isPremium = await this.checkPremiumContent()

      // 5. If premium and not allowed, throw error
      if (isPremium && !editorialRequest.includePremium) {
        throw new LescaError(
          `Editorial for "${editorialRequest.titleSlug}" is premium content. ` +
            'Use includePremium: true to attempt scraping with authentication.',
          'PREMIUM_CONTENT'
        )
      }

      // 6. If premium and no auth, throw error
      if (isPremium && !this.auth) {
        throw new LescaError(
          `Editorial for "${editorialRequest.titleSlug}" requires authentication. ` +
            'Please provide authentication credentials.',
          'AUTH_REQUIRED'
        )
      }

      // 7. Extract editorial content
      const editorial = await this.extractEditorial(editorialRequest.titleSlug)

      return {
        type: 'editorial',
        data: editorial,
        metadata: {
          scrapedAt: new Date(),
          isPremium,
          url,
          strategy: this.name,
        },
      }
    } catch (error) {
      if (error instanceof LescaError) {
        throw error
      }

      throw new LescaError(
        `Failed to scrape editorial for "${editorialRequest.titleSlug}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        'SCRAPING_FAILED',
        undefined,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get editorial URL for a problem
   */
  private getEditorialUrl(titleSlug: string): string {
    return `https://leetcode.com/problems/${titleSlug}/editorial/`
  }

  /**
   * Wait for editorial content to load
   */
  private async waitForContent(): Promise<void> {
    const editorialSelectors = this.selectors.getEditorialSelectors()

    // Try to wait for editorial container or premium banner
    const containerSelectors = [
      ...this.selectors.getAll(editorialSelectors.container),
      ...this.selectors.getAll(editorialSelectors.premiumBanner),
      ...this.selectors.getAll(this.selectors.getCommonSelectors().notFound),
    ]

    try {
      const firstSelector = containerSelectors[0]
      if (!firstSelector) {
        throw new BrowserError(
          'BROWSER_SELECTOR_NOT_FOUND',
          'No selector found for editorial content',
          { context: { selectors: containerSelectors } }
        )
      }
      await this.browserDriver.waitForSelector(firstSelector, 5000)
    } catch {
      // Try fallback selectors
      for (let i = 1; i < containerSelectors.length; i++) {
        try {
          const selector = containerSelectors[i]
          if (!selector) continue
          await this.browserDriver.waitForSelector(selector, 2000)
          break
        } catch {
          if (i === containerSelectors.length - 1) {
            throw new LescaError('Editorial content failed to load', 'CONTENT_LOAD_FAILED')
          }
        }
      }
    }
  }

  /**
   * Check if content is premium
   */
  private async checkPremiumContent(): Promise<boolean> {
    const editorialSelectors = this.selectors.getEditorialSelectors()
    const premiumSelectors = this.selectors.getAll(editorialSelectors.premiumBanner)

    for (const selector of premiumSelectors) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const exists = await this.browserDriver.elementExists(selector)
      if (exists) {
        return true
      }
    }

    return false
  }

  /**
   * Extract editorial content
   */
  private async extractEditorial(titleSlug: string): Promise<EditorialContent> {
    const editorialSelectors = this.selectors.getEditorialSelectors()

    // Extract main content
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const content = await this.browserDriver.extractWithFallback(
      this.selectors.getAll(editorialSelectors.content)
    )

    // Extract approaches (may have multiple)
    const approaches = await this.extractApproaches()

    // Extract complexity analysis
    const complexity = await this.extractComplexity()

    // Extract code snippets
    const codeSnippets = await this.extractCodeSnippets()

    return {
      titleSlug,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      content,
      approaches,
      complexity,
      codeSnippets,
    }
  }

  /**
   * Extract solution approaches
   */
  private async extractApproaches(): Promise<string[]> {
    const editorialSelectors = this.selectors.getEditorialSelectors()
    const approachSelectors = this.selectors.getAll(editorialSelectors.approach)

    try {
      const firstSelector = approachSelectors[0]
      if (!firstSelector) return []
      return await this.browserDriver.extractAll(firstSelector)
    } catch {
      // Try fallback selectors
      for (let i = 1; i < approachSelectors.length; i++) {
        try {
          const selector = approachSelectors[i]
          if (!selector) continue
          return await this.browserDriver.extractAll(selector)
        } catch {
          continue
        }
      }
      return []
    }
  }

  /**
   * Extract complexity analysis
   */
  private async extractComplexity(): Promise<string | null> {
    const editorialSelectors = this.selectors.getEditorialSelectors()
    const complexitySelectors = this.selectors.getAll(editorialSelectors.complexity)

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return await this.browserDriver.extractWithFallback(complexitySelectors)
    } catch {
      return null
    }
  }

  /**
   * Extract code snippets
   */
  private async extractCodeSnippets(): Promise<CodeSnippet[]> {
    const editorialSelectors = this.selectors.getEditorialSelectors()
    const codeSelectors = this.selectors.getAll(editorialSelectors.code)

    const snippets: CodeSnippet[] = []

    for (const selector of codeSelectors) {
      try {
        const codeBlocks = await this.browserDriver.extractAll(selector)

        for (const code of codeBlocks) {
          // Try to detect language from the code block
          const language = this.detectLanguage(code)
          const lang = language || 'text'
          snippets.push({
            code: code.trim(),
            lang: lang,
            langSlug: lang,
          })
        }

        if (snippets.length > 0) {
          break
        }
      } catch {
        continue
      }
    }

    return snippets
  }

  /**
   * Detect programming language from code content
   */
  private detectLanguage(code: string): string | null {
    // Simple heuristics
    if (code.includes('def ') || code.includes('import ')) return 'python'
    if (code.includes('function ') || code.includes('const ') || code.includes('let '))
      return 'javascript'
    if (code.includes('public class ') || code.includes('public static')) return 'java'
    if (code.includes('std::') || code.includes('#include')) return 'cpp'
    if (code.includes('func ') && code.includes('range')) return 'go'
    if (code.includes('fn ') && code.includes('impl')) return 'rust'

    return null
  }

  /**
   * Get the full HTML of the editorial page (for debugging)
   */
  async getFullHtml(titleSlug: string): Promise<string> {
    const url = this.getEditorialUrl(titleSlug)
    await this.browserDriver.navigate(url)
    await this.waitForContent()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return await this.browserDriver.getPageHtml()
  }

  /**
   * Take a screenshot of the editorial page (for debugging)
   */
  async screenshot(titleSlug: string, path: string): Promise<void> {
    const url = this.getEditorialUrl(titleSlug)
    await this.browserDriver.navigate(url)
    await this.waitForContent()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.browserDriver.screenshot(path)
  }
}

