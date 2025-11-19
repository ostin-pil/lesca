import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LeetCodeScraper } from '../scraper.js'
import type {
  ScraperStrategy,
  StorageAdapter,
  ProblemScrapeRequest,
} from '../../../../shared/types/src/index.js'

describe('LeetCodeScraper', () => {
  let mockStrategy: ScraperStrategy
  let mockStorage: StorageAdapter
  let scraper: LeetCodeScraper

  const mockProblem = {
    questionId: '1',
    questionFrontendId: '1',
    title: 'Two Sum',
    titleSlug: 'two-sum',
    difficulty: 'Easy',
    content: '<p>Problem content</p>',
    topicTags: [],
    stats: '{}',
  }

  beforeEach(() => {
    mockStrategy = {
      name: 'problem',
      priority: 1,
      canHandle: vi.fn().mockReturnValue(true),
      execute: vi.fn().mockResolvedValue({
        type: 'problem',
        data: mockProblem,
        metadata: {
          scrapedAt: new Date('2024-01-01'),
          source: 'https://leetcode.com/problems/two-sum',
        },
      }),
    } as unknown as ScraperStrategy

    mockStorage = {
      save: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
    } as unknown as StorageAdapter

    scraper = new LeetCodeScraper([mockStrategy], mockStorage)
  })

  describe('scrape', () => {
    it('should scrape problem successfully', async () => {
      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await scraper.scrape(request)

      expect(result.success).toBe(true)
      expect(result.filePath).toBeDefined()
      expect(mockStrategy.execute).toHaveBeenCalledWith(request)
      expect(mockStorage.save).toHaveBeenCalled()
    })

    it('should select correct strategy for request', async () => {
      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      await scraper.scrape(request)

      expect(mockStrategy.canHandle).toHaveBeenCalledWith(request)
    })

    it('should return error if no strategy can handle request', async () => {
      mockStrategy.canHandle = vi.fn().mockReturnValue(false)

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await scraper.scrape(request)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error!.message).toContain('No strategy can handle request type')
      }
    })

    it('should handle strategy execution errors', async () => {
      mockStrategy.execute = vi.fn().mockRejectedValue(new Error('Strategy failed'))

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await scraper.scrape(request)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle storage errors', async () => {
      mockStorage.save = vi.fn().mockRejectedValue(new Error('Storage failed'))

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await scraper.scrape(request)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should return file path on success', async () => {
      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await scraper.scrape(request)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.filePath).toBe('1-two-sum.md')
      }
    })
  })

  describe('strategy selection', () => {
    it('should try strategies in order', async () => {
      const strategy1 = {
        ...mockStrategy,
        canHandle: vi.fn().mockReturnValue(false),
      }
      const strategy2 = {
        ...mockStrategy,
        canHandle: vi.fn().mockReturnValue(true),
      }

      const multiScraper = new LeetCodeScraper([strategy1, strategy2], mockStorage)

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      await multiScraper.scrape(request)

      expect(strategy1.canHandle).toHaveBeenCalled()
      expect(strategy2.canHandle).toHaveBeenCalled()
      expect(strategy2.execute).toHaveBeenCalled()
    })

    it('should use first matching strategy', async () => {
      const strategy1 = {
        ...mockStrategy,
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue({
          type: 'problem',
          data: mockProblem,
          metadata: {
            scrapedAt: new Date('2024-01-01'),
            source: 'https://leetcode.com/problems/two-sum',
          },
        }),
      }
      const strategy2 = {
        ...mockStrategy,
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue({
          type: 'problem',
          data: mockProblem,
          metadata: {
            scrapedAt: new Date('2024-01-01'),
            source: 'https://leetcode.com/problems/two-sum',
          },
        }),
      }

      const multiScraper = new LeetCodeScraper([strategy1, strategy2], mockStorage)

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      await multiScraper.scrape(request)

      expect(strategy1.execute).toHaveBeenCalled()
      expect(strategy2.execute).not.toHaveBeenCalled()
    })
  })

  describe('options handling', () => {
    it('should respect format option', async () => {
      const scraperWithFormat = new LeetCodeScraper([mockStrategy], mockStorage, {
        format: 'obsidian',
      })

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      await scraperWithFormat.scrape(request)

      // Format should be used during conversion
      expect(mockStorage.save).toHaveBeenCalled()
    })
  })

  describe('error details', () => {
    it('should include error message in result', async () => {
      mockStrategy.execute = vi.fn().mockRejectedValue(new Error('Specific error'))

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await scraper.scrape(request)

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Specific error')
    })

    it('should handle non-Error objects', async () => {
      mockStrategy.execute = vi.fn().mockRejectedValue('String error')

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await scraper.scrape(request)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('empty strategy list', () => {
    it('should handle empty strategy list', async () => {
      const emptyStrategyScraper = new LeetCodeScraper([], mockStorage)

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await emptyStrategyScraper.scrape(request)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error!.message).toContain('No strategy can handle request type')
      }
    })
  })

  describe('data flow', () => {
    it('should pass strategy data to storage', async () => {
      const expectedData = {
        questionId: '1',
        questionFrontendId: '1',
        title: 'Two Sum',
        titleSlug: 'two-sum',
        difficulty: 'Easy',
        content: '<p>Test content</p>',
        topicTags: [],
        stats: '{}',
      }

      mockStrategy.execute = vi.fn().mockResolvedValue({
        type: 'problem',
        data: expectedData,
        metadata: {
          scrapedAt: new Date('2024-01-01'),
          source: 'https://leetcode.com/problems/two-sum',
        },
      })

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      await scraper.scrape(request)

      expect(mockStorage.save).toHaveBeenCalled()
      // Storage should receive converted content
      const saveCall = (mockStorage.save as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(saveCall).toBeDefined()
    })
  })
})
