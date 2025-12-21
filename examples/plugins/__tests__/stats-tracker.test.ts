import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { PluginContext, ScrapeResult, ProcessedData, RawData } from '@lesca/shared/types'
import { createProblem, createProblemRequest } from '../../../tests/factories/problem-factory'

import { statsTrackerPlugin, getStats, resetStats, generateReport } from '../stats-tracker'

describe('Stats Tracker Plugin', () => {
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
    resetStats()
    statsTrackerPlugin.onInit?.(mockContext)
  })

  describe('onInit', () => {
    it('should initialize and set start time', () => {
      const stats = getStats()
      expect(stats.startedAt).toBeInstanceOf(Date)
      expect(mockLogger.info).toHaveBeenCalledWith('Stats Tracker plugin initialized')
    })
  })

  describe('getStats', () => {
    it('should return empty stats initially', () => {
      resetStats()
      statsTrackerPlugin.onInit?.(mockContext)

      const stats = getStats()
      expect(stats.total).toBe(0)
      expect(stats.successful).toBe(0)
      expect(stats.failed).toBe(0)
    })
  })

  describe('resetStats', () => {
    it('should reset all statistics', () => {
      // Generate some stats
      statsTrackerPlugin.onScrape?.(createProblemRequest())
      statsTrackerPlugin.onScrapeResult?.({
        success: true,
        request: createProblemRequest(),
        data: createMockProcessedData(),
      })

      resetStats()
      const stats = getStats()

      expect(stats.total).toBe(0)
      expect(stats.successful).toBe(0)
      expect(stats.byType).toEqual({})
    })
  })

  describe('onScrape', () => {
    it('should increment total count', () => {
      statsTrackerPlugin.onScrape?.(createProblemRequest())
      expect(getStats().total).toBe(1)

      statsTrackerPlugin.onScrape?.(createProblemRequest())
      expect(getStats().total).toBe(2)
    })

    it('should track by type', () => {
      statsTrackerPlugin.onScrape?.(createProblemRequest())
      statsTrackerPlugin.onScrape?.({ type: 'list' })
      statsTrackerPlugin.onScrape?.({ type: 'editorial', titleSlug: 'test' })

      const stats = getStats()
      expect(stats.byType['problem']).toBe(1)
      expect(stats.byType['list']).toBe(1)
      expect(stats.byType['editorial']).toBe(1)
    })

    it('should return request unchanged', () => {
      const request = createProblemRequest({ titleSlug: 'my-problem' })
      const result = statsTrackerPlugin.onScrape?.(request)
      expect(result).toEqual(request)
    })
  })

  describe('onScrapeResult', () => {
    function createSuccessResult(): ScrapeResult {
      return {
        success: true,
        request: createProblemRequest(),
        data: createMockProcessedData(),
      }
    }

    function createFailedResult(): ScrapeResult {
      return {
        success: false,
        request: createProblemRequest(),
        error: new Error('Test error'),
      }
    }

    it('should track successful scrapes', () => {
      statsTrackerPlugin.onScrape?.(createProblemRequest())
      statsTrackerPlugin.onScrapeResult?.(createSuccessResult())

      const stats = getStats()
      expect(stats.successful).toBe(1)
      expect(stats.failed).toBe(0)
    })

    it('should track failed scrapes', () => {
      statsTrackerPlugin.onScrape?.(createProblemRequest())
      statsTrackerPlugin.onScrapeResult?.(createFailedResult())

      const stats = getStats()
      expect(stats.successful).toBe(0)
      expect(stats.failed).toBe(1)
    })

    it('should track difficulty for problem results', () => {
      statsTrackerPlugin.onScrape?.(createProblemRequest())
      statsTrackerPlugin.onScrapeResult?.(createSuccessResult())

      const stats = getStats()
      expect(stats.byDifficulty['Easy']).toBe(1)
    })

    it('should update timing statistics', () => {
      statsTrackerPlugin.onScrape?.(createProblemRequest())
      statsTrackerPlugin.onScrapeResult?.(createSuccessResult())

      const stats = getStats()
      expect(stats.timing.totalTime).toBeGreaterThanOrEqual(0)
      expect(stats.timing.averageTime).toBeGreaterThanOrEqual(0)
    })

    it('should track recent scrapes', () => {
      statsTrackerPlugin.onScrape?.(createProblemRequest({ titleSlug: 'problem-1' }))
      statsTrackerPlugin.onScrapeResult?.({
        success: true,
        request: createProblemRequest({ titleSlug: 'problem-1' }),
        data: createMockProcessedData(),
      })

      const stats = getStats()
      expect(stats.recentScrapes.length).toBe(1)
      expect(stats.recentScrapes[0]?.slug).toBe('problem-1')
      expect(stats.recentScrapes[0]?.success).toBe(true)
    })

    it('should limit recent scrapes to 10', () => {
      for (let i = 0; i < 15; i++) {
        statsTrackerPlugin.onScrape?.(createProblemRequest({ titleSlug: `problem-${i}` }))
        statsTrackerPlugin.onScrapeResult?.({
          success: true,
          request: createProblemRequest({ titleSlug: `problem-${i}` }),
          data: createMockProcessedData(),
        })
      }

      const stats = getStats()
      expect(stats.recentScrapes.length).toBe(10)
      // Most recent should be first
      expect(stats.recentScrapes[0]?.slug).toBe('problem-14')
    })

    it('should update lastScrapeAt', () => {
      statsTrackerPlugin.onScrape?.(createProblemRequest())
      statsTrackerPlugin.onScrapeResult?.(createSuccessResult())

      const stats = getStats()
      expect(stats.lastScrapeAt).toBeInstanceOf(Date)
    })
  })

  describe('generateReport', () => {
    it('should return message when no stats', () => {
      resetStats()
      const report = generateReport()
      expect(report).toBe('No scraping statistics available.')
    })

    it('should generate formatted report with stats', () => {
      statsTrackerPlugin.onInit?.(mockContext)
      statsTrackerPlugin.onScrape?.(createProblemRequest())
      statsTrackerPlugin.onScrapeResult?.({
        success: true,
        request: createProblemRequest(),
        data: createMockProcessedData(),
      })

      const report = generateReport()

      expect(report).toContain('# Scraping Statistics Report')
      expect(report).toContain('## Summary')
      expect(report).toContain('Total Scrapes | 1')
      expect(report).toContain('Successful | 1')
      expect(report).toContain('## Timing')
      expect(report).toContain('## By Type')
      expect(report).toContain('problem | 1')
    })

    it('should include difficulty breakdown for problems', () => {
      statsTrackerPlugin.onInit?.(mockContext)
      statsTrackerPlugin.onScrape?.(createProblemRequest())
      statsTrackerPlugin.onScrapeResult?.({
        success: true,
        request: createProblemRequest(),
        data: createMockProcessedData(),
      })

      const report = generateReport()
      expect(report).toContain('## By Difficulty')
      expect(report).toContain('Easy | 1')
    })

    it('should include recent scrapes', () => {
      statsTrackerPlugin.onInit?.(mockContext)
      statsTrackerPlugin.onScrape?.(createProblemRequest({ titleSlug: 'two-sum' }))
      statsTrackerPlugin.onScrapeResult?.({
        success: true,
        request: createProblemRequest({ titleSlug: 'two-sum' }),
        data: createMockProcessedData(),
      })

      const report = generateReport()
      expect(report).toContain('## Recent Scrapes')
      expect(report).toContain('two-sum')
    })
  })

  describe('onCleanup', () => {
    it('should log final report', () => {
      statsTrackerPlugin.onScrape?.(createProblemRequest())
      statsTrackerPlugin.onScrapeResult?.({
        success: true,
        request: createProblemRequest(),
        data: createMockProcessedData(),
      })

      statsTrackerPlugin.onCleanup?.()

      expect(mockLogger.info).toHaveBeenCalledWith('Stats Tracker final report:')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Scraping Statistics Report')
      )
    })
  })
})

/**
 * Helper to create mock ProcessedData
 */
function createMockProcessedData(): ProcessedData {
  const problem = createProblem({ difficulty: 'Easy' })
  const rawData: RawData = {
    type: 'problem',
    data: problem,
    metadata: {
      scrapedAt: new Date(),
      source: 'graphql',
    },
  }

  return {
    type: 'problem',
    content: '# Test Problem',
    frontmatter: { title: problem.title },
    metadata: {
      originalData: rawData,
      processors: [],
      processedAt: new Date(),
    },
  }
}
