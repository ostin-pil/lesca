import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LeetCodeScraper } from '../scraper'
import type {
  ScraperStrategy,
  StorageAdapter,
  ScrapeRequest,
  RawData,
  Problem,
} from '@lesca/shared/types'

describe('LeetCodeScraper Integration', () => {
  let scraper: LeetCodeScraper
  let mockStrategy: ScraperStrategy
  let mockStorage: StorageAdapter

  const mockProblemData: Problem = {
    questionId: '1',
    questionFrontendId: '1',
    title: 'Two Sum',
    titleSlug: 'two-sum',
    likes: 1000,
    dislikes: 50,
    quality: 75.5,
    content: '<p>Problem content</p>',
    difficulty: 'Easy',
    topicTags: [],
    codeSnippets: [],
    stats: '{}',
    hints: [],
    solution: null,
    companyTagStats: null,
    exampleTestcases: null,
    similarQuestions: null,
    mysqlSchemas: [],
    dataSchemas: [],
    isPaidOnly: false,
  }

  beforeEach(() => {
    mockStrategy = {
      name: 'mock',
      priority: 100,
      canHandle: vi.fn().mockReturnValue(true),
      execute: vi.fn().mockResolvedValue({
        type: 'problem',
        data: mockProblemData,
        metadata: {
          scrapedAt: new Date(),
          source: 'graphql',
          url: 'https://leetcode.com/problems/two-sum/',
        },
      } as RawData),
    }

    mockStorage = {
      save: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      load: vi.fn().mockResolvedValue(''),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    }

    scraper = new LeetCodeScraper([mockStrategy], mockStorage)
  })

  it('should orchestrate scrape -> convert -> save flow', async () => {
    const request: ScrapeRequest = { type: 'problem', titleSlug: 'two-sum' }

    const result = await scraper.scrape(request)

    expect(result.success).toBe(true)
    expect(mockStrategy.execute).toHaveBeenCalledWith(request)
    expect(mockStorage.save).toHaveBeenCalled()

    // Check if content was converted to markdown
    const saveCall = vi.mocked(mockStorage.save).mock.calls[0]
    const savedContent = saveCall?.[1]
    expect(savedContent).toContain('# Two Sum')
    expect(savedContent).toContain('Problem content')
  })

  it('should handle strategy errors', async () => {
    mockStrategy.execute = vi.fn().mockRejectedValue(new Error('Scrape failed'))

    const request: ScrapeRequest = { type: 'problem', titleSlug: 'two-sum' }
    const result = await scraper.scrape(request)

    expect(result.success).toBe(false)
    expect(result.error?.message).toBe('Scrape failed')
    expect(mockStorage.save).not.toHaveBeenCalled()
  })

  it('should handle storage errors', async () => {
    mockStorage.save = vi.fn().mockRejectedValue(new Error('Save failed'))

    const request: ScrapeRequest = { type: 'problem', titleSlug: 'two-sum' }
    const result = await scraper.scrape(request)

    expect(result.success).toBe(false)
    expect(result.error?.message).toBe('Save failed')
  })

  it('should select correct strategy based on priority', async () => {
    const lowPriorityStrategy = {
      ...mockStrategy,
      name: 'low',
      priority: 10,
      execute: vi.fn(),
    }
    const highPriorityStrategy = {
      ...mockStrategy,
      name: 'high',
      priority: 100,
      execute: vi.fn().mockResolvedValue({
        type: 'problem',
        data: mockProblemData,
        metadata: { scrapedAt: new Date(), source: 'high', url: '' },
      }),
    }

    scraper = new LeetCodeScraper([lowPriorityStrategy, highPriorityStrategy], mockStorage)

    const request: ScrapeRequest = { type: 'problem', titleSlug: 'two-sum' }
    await scraper.scrape(request)

    expect(highPriorityStrategy.execute).toHaveBeenCalled()
    expect(lowPriorityStrategy.execute).not.toHaveBeenCalled()
  })
})
