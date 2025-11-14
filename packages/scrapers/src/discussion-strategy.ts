import type {
  ScraperStrategy,
  ScrapeRequest,
  RawData,
  BrowserDriver,
  DiscussionScrapeRequest,
  Discussion,
} from '../../../shared/types/src/index.js'
import { LescaError } from '../../../shared/types/src/index.js'
import { logger } from '../../../shared/utils/src/index.js'
import { SelectorManager } from '../../browser-automation/src/index.js'

/**
 * Discussion Scraper Strategy
 * Uses browser automation to scrape problem discussions
 */
export class DiscussionScraperStrategy implements ScraperStrategy {
  readonly name = 'discussion'
  readonly priority = 80 // Lower than editorial

  private selectors: SelectorManager

  constructor(private browserDriver: BrowserDriver) {
    this.selectors = new SelectorManager()
  }

  /**
   * Check if this strategy can handle the request
   */
  canHandle(request: ScrapeRequest): boolean {
    return request.type === 'discussion'
  }

  /**
   * Execute the scraping
   */
  async execute(request: ScrapeRequest): Promise<RawData> {
    if (!this.canHandle(request)) {
      throw new LescaError(`DiscussionScraperStrategy cannot handle request type: ${request.type}`, 'INVALID_REQUEST_TYPE')
    }

    const discussionRequest = request as DiscussionScrapeRequest

    try {
      // 1. Launch browser if not already launched
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      if (!this.browserDriver.getBrowser()) {
        await this.browserDriver.launch({
          headless: true,
          timeout: 30000,
          blockResources: ['image', 'font', 'media'],
        })
      }

      // 2. Navigate to discussion page
      const url = this.getDiscussionUrl(
        discussionRequest.titleSlug,
        discussionRequest.category,
        discussionRequest.sortBy
      )
      await this.browserDriver.navigate(url)

      // 3. Wait for content to load
      await this.waitForDiscussions()

      // 4. Extract discussion list
      const discussions = await this.extractDiscussions(
        discussionRequest.limit || 10,
        discussionRequest.includeComments || false
      )

      return {
        type: 'discussion',
        data: {
          titleSlug: discussionRequest.titleSlug,
          category: discussionRequest.category || 'all',
          sortBy: discussionRequest.sortBy || 'hot',
          discussions,
          total: discussions.length,
        },
        metadata: {
          scrapedAt: new Date(),
          url,
          strategy: this.name,
        },
      }
    } catch (error) {
      if (error instanceof LescaError) {
        throw error
      }

      throw new LescaError(
        `Failed to scrape discussions for "${discussionRequest.titleSlug}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        'SCRAPING_FAILED',
        undefined,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get discussion URL for a problem
   */
  private getDiscussionUrl(titleSlug: string, category?: string, sortBy?: string): string {
    let url = `https://leetcode.com/problems/${titleSlug}/solutions/`

    const params: string[] = []
    if (category) {
      params.push(`category=${category}`)
    }
    if (sortBy) {
      params.push(`orderBy=${sortBy}`)
    }

    if (params.length > 0) {
      url += '?' + params.join('&')
    }

    return url
  }

  /**
   * Wait for discussions to load
   */
  private async waitForDiscussions(): Promise<void> {
    const discussionSelectors = this.selectors.getDiscussionSelectors()

    // Try to wait for discussion list or error message
    const selectors = [
      ...this.selectors.getAll(discussionSelectors.list),
      ...this.selectors.getAll(discussionSelectors.post),
      ...this.selectors.getAll(this.selectors.getCommonSelectors().notFound),
    ]

    try {
      const firstSelector = selectors[0]
      if (!firstSelector) throw new Error('No selector found')
      await this.browserDriver.waitForSelector(firstSelector, 5000)
    } catch {
      // Try fallback selectors
      for (let i = 1; i < Math.min(selectors.length, 5); i++) {
        try {
          const selector = selectors[i]
          if (!selector) continue
          await this.browserDriver.waitForSelector(selector, 2000)
          break
        } catch {
          if (i === Math.min(selectors.length, 5) - 1) {
            throw new LescaError('Discussion content failed to load', 'CONTENT_LOAD_FAILED')
          }
        }
      }
    }
  }

  /**
   * Extract discussions from the page
   */
  private async extractDiscussions(limit: number, includeComments: boolean): Promise<Discussion[]> {
    const discussions: Discussion[] = []
    const discussionSelectors = this.selectors.getDiscussionSelectors()

    // Get all discussion post elements
    const postSelectors = this.selectors.getAll(discussionSelectors.post)

    // Try to extract discussions using different selectors
    for (const postSelector of postSelectors) {
      try {
        const postCount = await this.countElements(postSelector)

        if (postCount === 0) {
          continue
        }

        // Extract each discussion post
        for (let i = 0; i < Math.min(postCount, limit); i++) {
          try {
            const discussion = await this.extractSingleDiscussion(postSelector, i, includeComments)
            if (discussion) {
              discussions.push(discussion)
            }
          } catch (error) {
            logger.error(`Failed to extract discussion ${i}:`, error)
            continue
          }
        }

        // If we got discussions, break
        if (discussions.length > 0) {
          break
        }
      } catch {
        continue
      }
    }

    return discussions.slice(0, limit)
  }

  /**
   * Count elements matching a selector
   */
  private async countElements(selector: string): Promise<number> {
    try {
      const elements = await this.browserDriver.extractAll(selector)
      return elements.length
    } catch {
      return 0
    }
  }

  /**
   * Extract a single discussion post
   */
  private async extractSingleDiscussion(
    postSelector: string,
    index: number,
    includeComments: boolean
  ): Promise<Discussion | null> {
    const discussionSelectors = this.selectors.getDiscussionSelectors()

    try {
      // Build selector for nth post
      const nthPostSelector = `${postSelector}:nth-of-type(${index + 1})`

      // Extract title
      const titleSelectors = this.selectors.getAll(discussionSelectors.title)
      let title = ''
      for (const titleSelector of titleSelectors) {
        try {
          const fullSelector = `${nthPostSelector} ${titleSelector}`
          title = await this.browserDriver.extractContent(fullSelector)
          if (title && title.trim().length > 0) {
            break
          }
        } catch {
          continue
        }
      }

      if (!title || title.trim().length === 0) {
        return null
      }

      // Extract author
      let author = 'Anonymous'
      const authorSelectors = this.selectors.getAll(discussionSelectors.author)
      for (const authorSelector of authorSelectors) {
        try {
          const fullSelector = `${nthPostSelector} ${authorSelector}`
          author = await this.browserDriver.extractContent(fullSelector)
          if (author && author.trim().length > 0) {
            break
          }
        } catch {
          continue
        }
      }

      // Extract votes
      let votes = 0
      const voteSelectors = this.selectors.getAll(discussionSelectors.votes)
      for (const voteSelector of voteSelectors) {
        try {
          const fullSelector = `${nthPostSelector} ${voteSelector}`
          const voteText = await this.browserDriver.extractContent(fullSelector)
          votes = parseInt(voteText.replace(/[^0-9]/g, '')) || 0
          break
        } catch {
          continue
        }
      }

      // Extract timestamp
      let timestamp = null
      const timestampSelectors = this.selectors.getAll(discussionSelectors.timestamp)
      for (const timestampSelector of timestampSelectors) {
        try {
          const fullSelector = `${nthPostSelector} ${timestampSelector}`
          timestamp = await this.browserDriver.extractContent(fullSelector)
          if (timestamp && timestamp.trim().length > 0) {
            break
          }
        } catch {
          continue
        }
      }

      // Extract content (may require clicking to expand)
      let content = ''
      const contentSelectors = this.selectors.getAll(discussionSelectors.content)
      for (const contentSelector of contentSelectors) {
        try {
          const fullSelector = `${nthPostSelector} ${contentSelector}`
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
          content = await this.browserDriver.getHtml(fullSelector)
          if (content && content.trim().length > 0) {
            break
          }
        } catch {
          continue
        }
      }

      // Extract comments if requested
      let comments: Array<{ author: string; content: string; timestamp: string | null }> = []
      if (includeComments) {
        comments = await this.extractComments(nthPostSelector)
      }

      return {
        title: title.trim(),
        author: author.trim(),
        votes,
        timestamp,
        content,
        comments,
        commentCount: comments.length,
      }
    } catch (error) {
      logger.error(`Error extracting discussion at index ${index}:`, error)
      return null
    }
  }

  /**
   * Extract comments for a discussion
   */
  private async extractComments(
    postSelector: string
  ): Promise<Array<{ author: string; content: string; timestamp: string | null }>> {
    const comments: Array<{ author: string; content: string; timestamp: string | null }> = []
    const discussionSelectors = this.selectors.getDiscussionSelectors()

    const commentSelectors = this.selectors.getAll(discussionSelectors.comments)

    for (const commentSelector of commentSelectors) {
      try {
        const fullSelector = `${postSelector} ${commentSelector}`
        const commentElements = await this.browserDriver.extractAll(fullSelector)

        for (let i = 0; i < Math.min(commentElements.length, 50); i++) {
          try {
            const commentText = commentElements[i]
            if (commentText && commentText.trim().length > 0) {
              comments.push({
                author: 'Anonymous', // Could be extracted with more specific selectors
                content: commentText.trim(),
                timestamp: null,
              })
            }
          } catch {
            continue
          }
        }

        if (comments.length > 0) {
          break
        }
      } catch {
        continue
      }
    }

    return comments
  }

  /**
   * Get discussion page HTML (for debugging)
   */
  async getFullHtml(titleSlug: string): Promise<string> {
    const url = this.getDiscussionUrl(titleSlug)
    await this.browserDriver.navigate(url)
    await this.waitForDiscussions()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return await this.browserDriver.getPageHtml()
  }

  /**
   * Take screenshot (for debugging)
   */
  async screenshot(titleSlug: string, path: string): Promise<void> {
    const url = this.getDiscussionUrl(titleSlug)
    await this.browserDriver.navigate(url)
    await this.waitForDiscussions()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.browserDriver.screenshot(path)
  }
}

