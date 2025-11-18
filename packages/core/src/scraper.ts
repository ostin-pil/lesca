import {
  HtmlToMarkdownConverter,
  ObsidianConverter,
  EditorialConverter,
  DiscussionConverter,
  EnhancementManager,
  type EnhancementConfig,
} from '@/packages/converters/src/index.js'
import type {
  ScrapeRequest,
  ScrapeResult,
  ScraperStrategy,
  RawData,
  Problem,
  StorageAdapter,
  DiscussionList,
  EditorialContent,
} from '@/shared/types/src/index.js'
import { LescaError } from '@/shared/types/src/index.js'

/**
 * Main LeetCode scraper facade
 * Pure orchestration - no business logic
 * Delegates all work to strategies, converters, and storage
 */
export class LeetCodeScraper {
  private enhancementManager: EnhancementManager

  constructor(
    private strategies: ScraperStrategy[],
    private storage: StorageAdapter,
    private options: {
      format?: 'markdown' | 'obsidian'
      outputPattern?: string // e.g., "{id}-{slug}.md"
      enhancements?: EnhancementConfig
    } = {}
  ) {
    // Sort strategies by priority (highest first)
    this.strategies.sort((a, b) => b.priority - a.priority)
    // Initialize enhancement manager with config
    this.enhancementManager = new EnhancementManager(this.options.enhancements)
  }

  /**
   * Main scraping method
   * Pure delegation - no branching logic
   */
  async scrape(request: ScrapeRequest): Promise<ScrapeResult> {
    try {
      // 1. Select strategy
      const strategy = this.selectStrategy(request)

      // 2. Execute scraping
      const rawData = await strategy.execute(request)

      // 3. Process and convert
      const { markdown, filename } = await this.processData(rawData)

      // 4. Save to storage
      await this.storage.save(filename, markdown, {
        scrapedAt: rawData.metadata.scrapedAt.toISOString(),
        source: rawData.metadata.source,
      })

      // 5. Return result
      return {
        success: true,
        request,
        data: {
          type: rawData.type,
          content: markdown,
          frontmatter: {},
          metadata: {
            originalData: rawData,
            processors: ['html-to-markdown', this.options.format || 'markdown'],
            processedAt: new Date(),
          },
        },
        filePath: filename,
      }
    } catch (error) {
      return {
        success: false,
        request,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  /**
   * Scrape multiple problems
   */
  async scrapeMultiple(requests: ScrapeRequest[]): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = []

    for (const request of requests) {
      const result = await this.scrape(request)
      results.push(result)

      // Stop on first error if configured
      if (!result.success && !this.options) {
        break
      }
    }

    return results
  }

  /**
   * Select appropriate strategy for request
   * First strategy that can handle wins
   */
  private selectStrategy(request: ScrapeRequest): ScraperStrategy {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(request)) {
        return strategy
      }
    }

    throw new LescaError(`No strategy can handle request type: ${request.type}`, 'NO_STRATEGY', 400)
  }

  /**
   * Process raw data and convert to markdown
   */
  private async processData(rawData: RawData): Promise<{ markdown: string; filename: string }> {
    if (rawData.type === 'problem') {
      const problem = rawData.data as Problem

      // Convert HTML to Markdown
      const htmlConverter = new HtmlToMarkdownConverter()
      let markdown = await htmlConverter.convert(problem.content)

      // Apply content enhancements (format-agnostic)
      markdown = this.enhancementManager.enhance(markdown, rawData, this.options.enhancements)

      // Apply format-specific conversion
      let finalMarkdown = markdown
      let filename = `${problem.questionFrontendId}-${problem.titleSlug}.md`

      if (this.options.format === 'obsidian') {
        const obsidianConverter = new ObsidianConverter()
        finalMarkdown = obsidianConverter.convert(problem, markdown, {
          wikiLinks: true,
          includeBacklinks: true,
        })

        filename = ObsidianConverter.generateFilename(problem, 'id-slug')
      }

      // Add title if not present
      if (!finalMarkdown.startsWith('#')) {
        finalMarkdown = `# ${problem.title}\n\n${finalMarkdown}`
      }

      return { markdown: finalMarkdown, filename }
    }

    if (rawData.type === 'editorial') {
      const editorial = rawData.data as EditorialContent
      const editorialConverter = new EditorialConverter()

      // Apply format-specific conversion
      let finalMarkdown: string
      const filename = `${editorial.titleSlug}-editorial.md`

      if (this.options.format === 'obsidian') {
        finalMarkdown = await editorialConverter.convertToObsidian(editorial)
      } else {
        finalMarkdown = await editorialConverter.convert(editorial)
      }

      return { markdown: finalMarkdown, filename }
    }

    if (rawData.type === 'discussion') {
      const discussionList = rawData.data as DiscussionList
      const discussionConverter = new DiscussionConverter()

      // Apply format-specific conversion
      let finalMarkdown: string
      const filename = `${discussionList.titleSlug}-discussions.md`

      if (this.options.format === 'obsidian') {
        finalMarkdown = await discussionConverter.convertToObsidian(discussionList)
      } else {
        finalMarkdown = await discussionConverter.convert(discussionList)
      }

      return { markdown: finalMarkdown, filename }
    }

    throw new LescaError(`Cannot process data type: ${rawData.type}`, 'UNSUPPORTED_TYPE', 400)
  }
}
