import { LeetCodeScraper } from '@lesca/core'
import { PluginManager } from '@lesca/core'
import type { Plugin, ScrapeRequest, ScrapeResult } from '@lesca/shared/types'
import { FileSystemStorage } from '@lesca/storage'
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Plugin System Integration', () => {
  let pluginManager: PluginManager
  let scraper: LeetCodeScraper
  let storage: FileSystemStorage
  let mockPlugin: Plugin

  beforeEach(() => {
    pluginManager = new PluginManager()
    storage = new FileSystemStorage('/tmp/lesca-test')

    // Mock storage save to avoid writing files
    vi.spyOn(storage, 'save').mockResolvedValue(undefined)

    mockPlugin = {
      name: 'test-plugin',
      version: '1.0.0',
      onInit: vi.fn(),
      onScrape: vi.fn((req) => req),
      onScrapeResult: vi.fn((res) => res),
      onSave: vi.fn((data) => data),
      onCleanup: vi.fn(),
    }

    pluginManager.register(mockPlugin)
  })

  it('should execute plugin hooks in correct order', async () => {
    // 1. Initialize
    await pluginManager.init()
    expect(mockPlugin.onInit).toHaveBeenCalled()

    // 2. Setup Scraper
    const mockStrategy = {
      name: 'mock',
      priority: 100,
      canHandle: () => true,
      execute: vi.fn().mockResolvedValue({
        type: 'problem',
        data: {
          questionId: '1',
          questionFrontendId: '1',
          title: 'Two Sum',
          titleSlug: 'two-sum',
          content: '<p>Test content</p>',
          difficulty: 'Easy',
          isPaidOnly: false,
          topicTags: [],
          codeSnippets: [],
          stats: '{}',
          companyTagStats: null,
          similarQuestions: null,
          solution: null,
          likes: 0,
          dislikes: 0,
          quality: 0,
          exampleTestcases: null,
          hints: [],
          mysqlSchemas: [],
          dataSchemas: [],
        },
        metadata: {
          scrapedAt: new Date(),
          source: 'graphql',
        },
      }),
    }

    scraper = new LeetCodeScraper([mockStrategy], storage, {
      pluginManager,
    })

    // 3. Execute Scrape
    const request: ScrapeRequest = { type: 'problem', titleSlug: 'two-sum' }
    await scraper.scrape(request)

    // 4. Verify Hooks
    expect(mockPlugin.onScrape).toHaveBeenCalledWith(request)
    expect(mockPlugin.onSave).toHaveBeenCalled()
    expect(mockPlugin.onScrapeResult).toHaveBeenCalled()

    // 5. Cleanup
    await pluginManager.cleanup()
    expect(mockPlugin.onCleanup).toHaveBeenCalled()
  })

  it('should allow plugins to modify request', async () => {
    const modifiedRequest = { type: 'problem', titleSlug: 'modified-slug' } as ScrapeRequest
    mockPlugin.onScrape = vi.fn().mockReturnValue(modifiedRequest)

    const mockStrategy = {
      name: 'mock',
      priority: 100,
      canHandle: () => true,
      execute: vi.fn().mockResolvedValue({
        type: 'problem',
        data: { titleSlug: 'modified-slug', content: '' }, // Minimal mock
        metadata: { scrapedAt: new Date() },
      }),
    }

    scraper = new LeetCodeScraper([mockStrategy], storage, { pluginManager })
    await scraper.scrape({ type: 'problem', titleSlug: 'original' })

    expect(mockStrategy.execute).toHaveBeenCalledWith(modifiedRequest)
  })
})
