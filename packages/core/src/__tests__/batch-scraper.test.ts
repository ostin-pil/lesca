import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { BatchScraper } from '../batch-scraper.js'
import { LeetCodeScraper } from '../scraper.js'
import type { ProblemScrapeRequest, ScrapeResult } from '../../../../shared/types/src/index.js'

describe('BatchScraper', () => {
  let mockScraper: LeetCodeScraper
  let batchScraper: BatchScraper

  const mockRequest: ProblemScrapeRequest = {
    type: 'problem',
    titleSlug: 'two-sum',
  }

  const mockSuccessResult: ScrapeResult = {
    success: true,
    filePath: '/path/to/file.md',
    request: mockRequest,
    data: { title: 'Two Sum' } as any,
  }

  const mockFailureResult: ScrapeResult = {
    success: false,
    error: new Error('Scrape failed'),
    request: mockRequest,
  }

  beforeEach(() => {
    mockScraper = {
      scrape: vi.fn().mockResolvedValue(mockSuccessResult),
    } as unknown as LeetCodeScraper
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('scrapeAll', () => {
    it('should scrape all requests successfully', async () => {
      batchScraper = new BatchScraper(mockScraper, { concurrency: 1 })

      const requests = [mockRequest, mockRequest, mockRequest]
      const result = await batchScraper.scrapeAll(requests)

      expect(result.stats.total).toBe(3)
      expect(result.stats.successful).toBe(3)
      expect(result.stats.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle failures gracefully', async () => {
      mockScraper.scrape = vi
        .fn()
        .mockResolvedValueOnce(mockSuccessResult)
        .mockResolvedValueOnce(mockFailureResult)
        .mockResolvedValueOnce(mockSuccessResult)

      batchScraper = new BatchScraper(mockScraper, { concurrency: 1 })

      const requests = [mockRequest, mockRequest, mockRequest]
      const result = await batchScraper.scrapeAll(requests)

      expect(result.stats.total).toBe(3)
      expect(result.stats.successful).toBe(2)
      expect(result.stats.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
    })

    it('should handle empty request list', async () => {
      batchScraper = new BatchScraper(mockScraper, { concurrency: 1 })

      const result = await batchScraper.scrapeAll([])

      expect(result.stats.total).toBe(0)
      expect(result.stats.successful).toBe(0)
      expect(result.stats.failed).toBe(0)
    })

    it('should respect concurrency limit', async () => {
      let activeCount = 0
      let maxActiveCount = 0

      mockScraper.scrape = vi.fn().mockImplementation(async () => {
        activeCount++
        maxActiveCount = Math.max(maxActiveCount, activeCount)
        await new Promise((resolve) => setTimeout(resolve, 10))
        activeCount--
        return mockSuccessResult
      })

      batchScraper = new BatchScraper(mockScraper, { concurrency: 2 })

      const requests = Array(10).fill(mockRequest)
      await batchScraper.scrapeAll(requests)

      expect(maxActiveCount).toBeLessThanOrEqual(2)
    })
  })

  describe('progress tracking', () => {
    it('should call onProgress callback', async () => {
      const onProgress = vi.fn()
      batchScraper = new BatchScraper(mockScraper, { concurrency: 1, onProgress })

      const requests = [mockRequest, mockRequest]
      await batchScraper.scrapeAll(requests)

      expect(onProgress).toHaveBeenCalled()
      expect(onProgress.mock.calls.length).toBeGreaterThan(0)
    })

    it('should provide accurate progress data', async () => {
      const progressUpdates: any[] = []
      const onProgress = vi.fn((progress) => progressUpdates.push(progress))

      batchScraper = new BatchScraper(mockScraper, { concurrency: 1, onProgress })

      const requests = [mockRequest, mockRequest, mockRequest]
      await batchScraper.scrapeAll(requests)

      const lastProgress = progressUpdates[progressUpdates.length - 1]
      expect(lastProgress.completed).toBe(3)
      expect(lastProgress.total).toBe(3)
    })
  })

  describe('statistics', () => {
    it('should calculate duration', async () => {
      batchScraper = new BatchScraper(mockScraper, { concurrency: 1 })

      const requests = [mockRequest]
      const result = await batchScraper.scrapeAll(requests)

      expect(result.stats.duration).toBeGreaterThanOrEqual(0)
    })

    it('should calculate average time', async () => {
      batchScraper = new BatchScraper(mockScraper, { concurrency: 1 })

      const requests = [mockRequest, mockRequest, mockRequest]
      const result = await batchScraper.scrapeAll(requests)

      expect(result.stats.averageTime).toBeGreaterThan(0)
      expect(result.stats.averageTime).toBe(result.stats.duration / 3)
    })

    it('should track total requests', async () => {
      batchScraper = new BatchScraper(mockScraper, { concurrency: 1 })

      const requests = [mockRequest, { ...mockRequest, titleSlug: 'three-sum' }]
      const result = await batchScraper.scrapeAll(requests)

      expect(result.stats.total).toBe(2)
      expect(result.stats.successful).toBe(2)
    })
  })

  describe('error handling', () => {
    it('should continue on error when continueOnError is true', async () => {
      mockScraper.scrape = vi
        .fn()
        .mockResolvedValueOnce(mockFailureResult)
        .mockResolvedValueOnce(mockSuccessResult)

      batchScraper = new BatchScraper(mockScraper, {
        concurrency: 1,
        continueOnError: true,
      })

      const requests = [mockRequest, mockRequest]
      const result = await batchScraper.scrapeAll(requests)

      expect(result.stats.successful).toBe(1)
      expect(result.stats.failed).toBe(1)
    })

    it('should set success flag based on continueOnError', async () => {
      mockScraper.scrape = vi
        .fn()
        .mockResolvedValueOnce(mockFailureResult)
        .mockResolvedValueOnce(mockSuccessResult)

      batchScraper = new BatchScraper(mockScraper, {
        concurrency: 1,
        continueOnError: false,
      })

      const requests = [mockRequest, mockRequest]
      const result = await batchScraper.scrapeAll(requests)

      expect(result.stats.failed).toBe(1)
      // continueOnError affects success flag, not processing
      expect(result.success).toBe(false)
    })

    it('should collect error details', async () => {
      const error = new Error('Specific scrape error')
      mockScraper.scrape = vi.fn().mockResolvedValue({
        success: false,
        error,
      })

      batchScraper = new BatchScraper(mockScraper, { concurrency: 1 })

      const requests = [mockRequest]
      const result = await batchScraper.scrapeAll(requests)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error.message).toBe('Specific scrape error')
      expect(result.errors[0]!.request).toEqual(mockRequest)
    })
  })

  describe('delay between batches', () => {
    it('should delay between batches', async () => {
      vi.useFakeTimers()

      const requests = Array(4).fill(mockRequest)
      batchScraper = new BatchScraper(mockScraper, {
        concurrency: 2,
        delayBetweenBatches: 100,
      })

      const promise = batchScraper.scrapeAll(requests)

      // Fast-forward timers
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.stats.successful).toBe(4)
      vi.useRealTimers()
    })
  })

  describe('static utility methods', () => {
    describe('formatDuration', () => {
      it('should format milliseconds correctly', () => {
        expect(BatchScraper.formatDuration(500)).toBe('0s')
        expect(BatchScraper.formatDuration(1500)).toBe('1s')
        expect(BatchScraper.formatDuration(65000)).toBe('1m 5s')
        expect(BatchScraper.formatDuration(3665000)).toBe('1h 1m')
      })
    })

    describe('formatETA', () => {
      it('should format ETA correctly', () => {
        expect(BatchScraper.formatETA(500)).toBe('0s')
        expect(BatchScraper.formatETA(5000)).toBe('5s')
        expect(BatchScraper.formatETA(65000)).toBe('1m 5s')
      })
    })
  })

  describe('resume functionality', () => {
    it('should enable resume mode with progressFile option', async () => {
      batchScraper = new BatchScraper(mockScraper, {
        concurrency: 1,
        resume: true,
        progressFile: '.test-progress.json',
      })

      const requests = [mockRequest]
      const result = await batchScraper.scrapeAll(requests)

      expect(result.stats.total).toBe(1)
      expect(result.stats.successful).toBe(1)
    })
  })
})
