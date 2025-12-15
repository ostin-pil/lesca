import {
  HtmlToMarkdownConverter,
  ObsidianConverter,
  EditorialConverter,
  DiscussionConverter,
  EnhancementManager,
  type EnhancementConfig,
} from '@lesca/converters'
import { LescaError } from '@lesca/error'
import type {
  ScrapeRequest,
  ScrapeResult,
  ScraperStrategy,
  RawData,
  Problem,
  StorageAdapter,
  DiscussionList,
  EditorialContent,
} from '@lesca/shared/types'

import type { PluginManager } from './plugin-manager'

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
      pluginManager?: PluginManager
    } = {}
  ) {
    // Sort strategies by priority (highest first)
    this.strategies.sort((a, b) => b.priority - a.priority)
    this.enhancementManager = new EnhancementManager(this.options.enhancements)
  }

  /**
   * Main scraping method
   * Pure delegation - no branching logic
   */
  async scrape(request: ScrapeRequest): Promise<ScrapeResult> {
    let currentRequest = request

    try {
      // 0. Plugin hook: onScrape
      if (this.options.pluginManager) {
        currentRequest = await this.options.pluginManager.onScrape(request)
      }

      // 1. Select strategy
      const strategy = this.selectStrategy(currentRequest)

      // 2. Execute scraping
      const rawData = await strategy.execute(currentRequest)

      // 3. Process and convert
      const { markdown, filename } = await this.processData(rawData)

      // 4. Plugin hook: onSave
      let contentToSave = markdown
      if (this.options.pluginManager) {
        const saved = await this.options.pluginManager.onSave(contentToSave)
        if (typeof saved === 'string') {
          contentToSave = saved
        }
      }

      // 5. Save to storage
      await this.storage.save(filename, contentToSave, {
        scrapedAt: rawData.metadata.scrapedAt.toISOString(),
        source: rawData.metadata.source,
      })

      // 6. Return result
      const result: ScrapeResult = {
        success: true,
        request: currentRequest,
        data: {
          type: rawData.type,
          content: contentToSave,
          frontmatter: {},
          metadata: {
            originalData: rawData,
            processors: ['html-to-markdown', this.options.format || 'markdown'],
            processedAt: new Date(),
          },
        },
        filePath: filename,
      }

      // 7. Plugin hook: onScrapeResult
      if (this.options.pluginManager) {
        return await this.options.pluginManager.onScrapeResult(result)
      }

      return result
    } catch (error) {
      const errorResult: ScrapeResult = {
        success: false,
        request: currentRequest,
        error: error instanceof Error ? error : new Error(String(error)),
      }

      // Plugin hook: onScrapeResult (even for errors)
      if (this.options.pluginManager) {
        return await this.options.pluginManager.onScrapeResult(errorResult)
      }

      return errorResult
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

    throw new LescaError(
      'SCRAPE_NO_STRATEGY',
      `No strategy can handle request type: ${request.type}`,
      { statusCode: 400 }
    )
  }

  /**
   * Process raw data and convert to markdown
   */
  private async processData(rawData: RawData): Promise<{ markdown: string; filename: string }> {
    if (rawData.type === 'problem') {
      const problem = rawData.data as Problem

      const htmlConverter = new HtmlToMarkdownConverter()
      let markdown = await htmlConverter.convert(problem.content)

      // Apply content enhancements (format-agnostic)
      markdown = this.enhancementManager.enhance(markdown, rawData, this.options.enhancements)

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

      if (!finalMarkdown.startsWith('#')) {
        finalMarkdown = `# ${problem.title}\n\n${finalMarkdown}`
      }

      return { markdown: finalMarkdown, filename }
    }

    if (rawData.type === 'editorial') {
      const editorial = rawData.data as EditorialContent
      const editorialConverter = new EditorialConverter()

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

      let finalMarkdown: string
      const filename = `${discussionList.titleSlug}-discussions.md`

      if (this.options.format === 'obsidian') {
        finalMarkdown = await discussionConverter.convertToObsidian(discussionList)
      } else {
        finalMarkdown = await discussionConverter.convert(discussionList)
      }

      return { markdown: finalMarkdown, filename }
    }

    if (rawData.type === 'list') {
      const list = rawData.data as unknown
      const filename = `problem-list-${new Date().toISOString().split('T')[0]}.json`
      return { markdown: JSON.stringify(list, null, 2), filename }
    }

    throw new LescaError('SCRAPE_NO_STRATEGY', `Cannot process data type: ${rawData.type}`, {
      statusCode: 400,
    })
  }
}
