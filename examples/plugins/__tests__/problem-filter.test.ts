import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { PluginContext, ScrapeResult, ProcessedData, RawData } from '@lesca/shared/types'
import { createProblem, createProblemRequest } from '../../../tests/factories/problem-factory'

import {
  createProblemFilterPlugin,
  getScrapedProblems,
  clearScrapedCache,
  markAsScraped,
} from '../problem-filter'

describe('Problem Filter Plugin', () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }

  const mockContext: PluginContext = {
    config: {},
    logger: mockLogger,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    clearScrapedCache()
  })

  describe('createProblemFilterPlugin', () => {
    it('should create plugin with default options', () => {
      const plugin = createProblemFilterPlugin()
      expect(plugin.name).toBe('problem-filter')
      expect(plugin.version).toBe('1.0.0')
    })

    it('should log options on init', () => {
      const plugin = createProblemFilterPlugin({
        skipPremium: true,
        minQuality: 60,
        difficulties: ['Easy', 'Medium'],
      })

      plugin.onInit?.(mockContext)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Problem Filter plugin initialized',
        expect.objectContaining({
          skipPremium: true,
          minQuality: 60,
          difficulties: ['Easy', 'Medium'],
        })
      )
    })
  })

  describe('onScrape', () => {
    it('should return request unchanged for non-problem types', () => {
      const plugin = createProblemFilterPlugin({ skipScraped: true })
      plugin.onInit?.(mockContext)

      const listRequest = { type: 'list' as const }
      const result = plugin.onScrape?.(listRequest)

      expect(result).toEqual(listRequest)
    })

    it('should log when skipping already scraped problems', () => {
      markAsScraped('two-sum')

      const plugin = createProblemFilterPlugin({ skipScraped: true })
      plugin.onInit?.(mockContext)

      const request = createProblemRequest({ titleSlug: 'two-sum' })
      plugin.onScrape?.(request)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Already scraped: two-sum')
      )
    })
  })

  describe('onScrapeResult', () => {
    function createMockResult(problemOverrides = {}): ScrapeResult {
      const problem = createProblem(problemOverrides)
      const rawData: RawData = {
        type: 'problem',
        data: problem,
        metadata: {
          scrapedAt: new Date(),
          source: 'graphql',
        },
      }

      const processedData: ProcessedData = {
        type: 'problem',
        content: '# Test',
        frontmatter: {},
        metadata: {
          originalData: rawData,
          processors: [],
          processedAt: new Date(),
        },
      }

      return {
        success: true,
        request: createProblemRequest({ titleSlug: problem.titleSlug }),
        data: processedData,
      }
    }

    it('should track scraped problems', () => {
      const plugin = createProblemFilterPlugin()
      plugin.onInit?.(mockContext)

      plugin.onScrapeResult?.(createMockResult({ titleSlug: 'new-problem' }))

      expect(getScrapedProblems()).toContain('new-problem')
    })

    it('should filter premium problems when skipPremium is true', () => {
      const plugin = createProblemFilterPlugin({ skipPremium: true })
      plugin.onInit?.(mockContext)

      const result = plugin.onScrapeResult?.(createMockResult({ isPaidOnly: true }))

      expect(result?.success).toBe(false)
      expect(result?.error?.message).toContain('Premium problem')
    })

    it('should not filter premium problems when skipPremium is false', () => {
      const plugin = createProblemFilterPlugin({ skipPremium: false })
      plugin.onInit?.(mockContext)

      const result = plugin.onScrapeResult?.(createMockResult({ isPaidOnly: true }))

      expect(result?.success).toBe(true)
    })

    it('should filter problems below minQuality', () => {
      const plugin = createProblemFilterPlugin({ minQuality: 70 })
      plugin.onInit?.(mockContext)

      // Low quality: many dislikes
      const result = plugin.onScrapeResult?.(
        createMockResult({ likes: 100, dislikes: 900, quality: 10 })
      )

      expect(result?.success).toBe(false)
      expect(result?.error?.message).toContain('Quality too low')
    })

    it('should pass problems above minQuality', () => {
      const plugin = createProblemFilterPlugin({ minQuality: 50 })
      plugin.onInit?.(mockContext)

      const result = plugin.onScrapeResult?.(
        createMockResult({ likes: 900, dislikes: 100, quality: 90 })
      )

      expect(result?.success).toBe(true)
    })

    it('should filter problems above maxQuality', () => {
      const plugin = createProblemFilterPlugin({ maxQuality: 50 })
      plugin.onInit?.(mockContext)

      const result = plugin.onScrapeResult?.(
        createMockResult({ likes: 900, dislikes: 100, quality: 90 })
      )

      expect(result?.success).toBe(false)
      expect(result?.error?.message).toContain('Quality too high')
    })

    it('should filter by difficulty', () => {
      const plugin = createProblemFilterPlugin({ difficulties: ['Easy', 'Medium'] })
      plugin.onInit?.(mockContext)

      const hardResult = plugin.onScrapeResult?.(createMockResult({ difficulty: 'Hard' }))
      const easyResult = plugin.onScrapeResult?.(createMockResult({ difficulty: 'Easy' }))

      expect(hardResult?.success).toBe(false)
      expect(hardResult?.error?.message).toContain('Difficulty mismatch')
      expect(easyResult?.success).toBe(true)
    })

    it('should filter by required tags', () => {
      const plugin = createProblemFilterPlugin({ requiredTags: ['dynamic-programming'] })
      plugin.onInit?.(mockContext)

      const withTagResult = plugin.onScrapeResult?.(
        createMockResult({
          topicTags: [{ name: 'Dynamic Programming', slug: 'dynamic-programming' }],
        })
      )
      const withoutTagResult = plugin.onScrapeResult?.(
        createMockResult({
          topicTags: [{ name: 'Array', slug: 'array' }],
        })
      )

      expect(withTagResult?.success).toBe(true)
      expect(withoutTagResult?.success).toBe(false)
      expect(withoutTagResult?.error?.message).toContain('Missing required tags')
    })

    it('should filter by excluded tags', () => {
      const plugin = createProblemFilterPlugin({ excludedTags: ['math'] })
      plugin.onInit?.(mockContext)

      const withExcludedResult = plugin.onScrapeResult?.(
        createMockResult({
          topicTags: [{ name: 'Math', slug: 'math' }],
        })
      )
      const withoutExcludedResult = plugin.onScrapeResult?.(
        createMockResult({
          topicTags: [{ name: 'Array', slug: 'array' }],
        })
      )

      expect(withExcludedResult?.success).toBe(false)
      expect(withExcludedResult?.error?.message).toContain('Has excluded tag')
      expect(withoutExcludedResult?.success).toBe(true)
    })

    it('should support custom filter function', () => {
      const plugin = createProblemFilterPlugin({
        customFilter: (request) => {
          if (request.type === 'problem') {
            return request.titleSlug.startsWith('two')
          }
          return true
        },
      })
      plugin.onInit?.(mockContext)

      // Custom filter is checked in onScrape, not onScrapeResult
      // So this test verifies the logging behavior
      plugin.onScrape?.(createProblemRequest({ titleSlug: 'three-sum' }))
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Custom filter rejected')
      )
    })

    it('should pass through failed results', () => {
      const plugin = createProblemFilterPlugin({ skipPremium: true })
      plugin.onInit?.(mockContext)

      const failedResult: ScrapeResult = {
        success: false,
        request: createProblemRequest(),
        error: new Error('Original error'),
      }

      const result = plugin.onScrapeResult?.(failedResult)
      expect(result).toEqual(failedResult)
    })
  })

  describe('cache management', () => {
    it('getScrapedProblems should return scraped slugs', () => {
      markAsScraped('problem-1')
      markAsScraped('problem-2')

      const scraped = getScrapedProblems()
      expect(scraped).toContain('problem-1')
      expect(scraped).toContain('problem-2')
    })

    it('clearScrapedCache should clear all tracked problems', () => {
      markAsScraped('problem-1')
      expect(getScrapedProblems()).toContain('problem-1')

      clearScrapedCache()
      expect(getScrapedProblems()).toHaveLength(0)
    })

    it('markAsScraped should add to cache', () => {
      markAsScraped('manual-problem')
      expect(getScrapedProblems()).toContain('manual-problem')
    })
  })

  describe('onCleanup', () => {
    it('should log cleanup with count', () => {
      markAsScraped('p1')
      markAsScraped('p2')

      const plugin = createProblemFilterPlugin()
      plugin.onInit?.(mockContext)
      plugin.onCleanup?.()

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Tracked 2 problems'))
    })
  })

  describe('combined filters', () => {
    function createCombinedMockResult(problemOverrides = {}): ScrapeResult {
      const problem = createProblem(problemOverrides)
      const rawData: RawData = {
        type: 'problem',
        data: problem,
        metadata: {
          scrapedAt: new Date(),
          source: 'graphql',
        },
      }

      const processedData: ProcessedData = {
        type: 'problem',
        content: '# Test',
        frontmatter: {},
        metadata: {
          originalData: rawData,
          processors: [],
          processedAt: new Date(),
        },
      }

      return {
        success: true,
        request: createProblemRequest({ titleSlug: problem.titleSlug }),
        data: processedData,
      }
    }

    it('should apply multiple filters together', () => {
      const plugin = createProblemFilterPlugin({
        skipPremium: true,
        minQuality: 60,
        difficulties: ['Easy', 'Medium'],
        requiredTags: ['array'],
        excludedTags: ['math'],
      })
      plugin.onInit?.(mockContext)

      // This problem passes all filters
      const goodResult = plugin.onScrapeResult?.(
        createCombinedMockResult({
          isPaidOnly: false,
          likes: 900,
          dislikes: 100,
          quality: 90,
          difficulty: 'Easy',
          topicTags: [{ name: 'Array', slug: 'array' }],
        })
      )

      expect(goodResult?.success).toBe(true)

      // This problem fails the premium filter
      const premiumResult = plugin.onScrapeResult?.(
        createCombinedMockResult({
          isPaidOnly: true,
          likes: 900,
          dislikes: 100,
          quality: 90,
          difficulty: 'Easy',
          topicTags: [{ name: 'Array', slug: 'array' }],
        })
      )

      expect(premiumResult?.success).toBe(false)
    })
  })
})
