import { existsSync } from 'fs'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'


import type { ScrapeRequest, ScrapeResult } from '@/shared/types/src/index'
import { logger } from '@/shared/utils/src/index'
import { SystemError } from '@lesca/error'

import type { LeetCodeScraper } from './scraper'

/**
 * Batch scraping options
 */
export interface BatchScrapingOptions {
  /** Maximum number of concurrent scrapes */
  concurrency?: number
  /** Continue on errors instead of stopping */
  continueOnError?: boolean
  /** Delay between batches (ms) */
  delayBetweenBatches?: number
  /** Resume from previous progress */
  resume?: boolean
  /** Progress file path for resume capability */
  progressFile?: string
  /** Callback for progress updates */
  onProgress?: (progress: BatchProgress) => void
  /** Callback for individual result */
  onResult?: (result: ScrapeResult, index: number, total: number) => void
}

/**
 * Batch progress information
 */
export interface BatchProgress {
  total: number
  completed: number
  successful: number
  failed: number
  skipped: number
  percentage: number
  currentBatch: number
  totalBatches: number
  eta?: number // Estimated time remaining in ms
  startTime: number
  elapsedTime: number
}

/**
 * Batch scraping result
 */
export interface BatchScrapeResult {
  success: boolean
  results: ScrapeResult[]
  stats: {
    total: number
    successful: number
    failed: number
    skipped: number
    duration: number
    averageTime: number
  }
  errors: Array<{
    request: ScrapeRequest
    error: Error
    index: number
  }>
}

/**
 * Progress state for resume capability
 */
interface ProgressState {
  completedIndices: number[]
  results: ScrapeResult[]
  startTime: number
}

/**
 * Batch Scraper
 * Handles parallel scraping with progress tracking and error recovery
 */
export class BatchScraper {
  constructor(
    private scraper: LeetCodeScraper,
    private options: BatchScrapingOptions = {}
  ) {
    this.options = {
      concurrency: 3, // Default to 3 concurrent scrapes
      continueOnError: true,
      delayBetweenBatches: 1000, // 1 second between batches
      resume: false,
      progressFile: resolve(process.cwd(), '.lesca-progress.json'),
      ...options,
    }
  }

  /**
   * Scrape multiple items with parallelization and progress tracking
   */
  async scrapeAll(requests: ScrapeRequest[]): Promise<BatchScrapeResult> {
    const startTime = Date.now()
    const results: ScrapeResult[] = []
    const errors: BatchScrapeResult['errors'] = []

    let completedIndices: Set<number> = new Set()
    if (this.options.resume) {
      const state = await this.loadProgress()
      if (state) {
        completedIndices = new Set(state.completedIndices)
        results.push(...state.results)
      }
    }

    const pendingRequests = requests.filter((_, index) => !completedIndices.has(index))
    const pendingIndices = requests
      .map((_, index) => index)
      .filter((index) => !completedIndices.has(index))

    if (pendingRequests.length === 0) {
      return {
        success: true,
        results,
        stats: {
          total: requests.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          skipped: 0,
          duration: Date.now() - startTime,
          averageTime: 0,
        },
        errors,
      }
    }

    const concurrency = this.options.concurrency || 3
    const batches = this.createBatches(pendingRequests, concurrency)
    const indexBatches = this.createBatches(pendingIndices, concurrency)

    const progress: BatchProgress = {
      total: requests.length,
      completed: completedIndices.size,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      skipped: completedIndices.size,
      percentage: (completedIndices.size / requests.length) * 100,
      currentBatch: 0,
      totalBatches: batches.length,
      startTime,
      elapsedTime: 0,
    }

    this.options.onProgress?.(progress)

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      const indices = indexBatches[batchIndex]

      if (!batch || !indices) {
        continue
      }

      progress.currentBatch = batchIndex + 1
      progress.elapsedTime = Date.now() - startTime

      if (progress.completed > 0) {
        const avgTimePerItem = progress.elapsedTime / progress.completed
        const remaining = progress.total - progress.completed
        progress.eta = avgTimePerItem * remaining
      }

      this.options.onProgress?.(progress)

      const batchResults = await Promise.allSettled(
        batch.map((request, batchItemIndex) => {
          const index = indices[batchItemIndex]
          if (index === undefined) {
            throw new SystemError(
              'SYS_UNKNOWN_ERROR',
              `Index mapping missing for batch item ${batchItemIndex}`,
              { context: { batchItemIndex, indicesLength: indices.length } }
            )
          }
          return this.scrapeSingle(request, index)
        })
      )

      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i]
        const originalIndex = indices[i]
        const currentRequest = batch[i]

        if (!result || originalIndex === undefined || !currentRequest) {
          continue
        }

        if (result.status === 'fulfilled') {
          const scrapeResult = result.value
          results.push(scrapeResult)
          completedIndices.add(originalIndex)

          if (scrapeResult.success) {
            progress.successful++
          } else {
            progress.failed++
            if (scrapeResult.error) {
              errors.push({
                request: currentRequest,
                error: scrapeResult.error,
                index: originalIndex,
              })
            }
          }

          this.options.onResult?.(scrapeResult, originalIndex, requests.length)
        } else {
          const reason = result.reason as unknown
          const error = reason instanceof Error ? reason : new Error(String(reason))
          const failedResult: ScrapeResult = {
            success: false,
            request: currentRequest,
            error,
          }
          results.push(failedResult)
          completedIndices.add(originalIndex)
          progress.failed++

          errors.push({
            request: currentRequest,
            error,
            index: originalIndex,
          })

          this.options.onResult?.(failedResult, originalIndex, requests.length)
        }

        progress.completed++
        progress.percentage = (progress.completed / progress.total) * 100
        progress.elapsedTime = Date.now() - startTime

        if (this.options.resume) {
          await this.saveProgress({
            completedIndices: Array.from(completedIndices),
            results,
            startTime,
          })
        }
      }

      this.options.onProgress?.(progress)

      // Delay between batches (except for last batch)
      if (batchIndex < batches.length - 1 && this.options.delayBetweenBatches) {
        await this.sleep(this.options.delayBetweenBatches)
      }
    }

    if (this.options.resume && progress.completed === progress.total) {
      await this.cleanupProgress()
    }

    const duration = Date.now() - startTime

    return {
      success: errors.length === 0 || this.options.continueOnError === true,
      results,
      stats: {
        total: requests.length,
        successful: progress.successful,
        failed: progress.failed,
        skipped: progress.skipped,
        duration,
        averageTime: duration / requests.length,
      },
      errors,
    }
  }

  /**
   * Scrape a single request
   */
  private async scrapeSingle(request: ScrapeRequest, _index: number): Promise<ScrapeResult> {
    try {
      return await this.scraper.scrape(request)
    } catch (error) {
      return {
        success: false,
        request,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Save progress to file
   */
  private async saveProgress(state: ProgressState): Promise<void> {
    const progressFile = this.options.progressFile
    if (!progressFile) return

    try {
      const dir = dirname(progressFile)

      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }

      await writeFile(progressFile, JSON.stringify(state, null, 2), 'utf-8')
    } catch (error) {
      logger.error('Failed to save progress:', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Load progress from file
   */
  private async loadProgress(): Promise<ProgressState | null> {
    const progressFile = this.options.progressFile
    if (!progressFile) return null

    try {
      if (!existsSync(progressFile)) {
        return null
      }

      const content = await readFile(progressFile, 'utf-8')
      return JSON.parse(content) as ProgressState
    } catch (error) {
      return null
    }
  }

  /**
   * Clean up progress file
   */
  private async cleanupProgress(): Promise<void> {
    const progressFile = this.options.progressFile
    if (!progressFile) return

    try {
      if (existsSync(progressFile)) {
        const { unlink } = await import('fs/promises')
        await unlink(progressFile)
      }
    } catch (error) {
      // Silently fail - cleanup is not critical
    }
  }

  /**
   * Get estimated time remaining
   */
  static formatETA(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  /**
   * Format duration
   */
  static formatDuration(ms: number): string {
    return this.formatETA(ms)
  }
}
