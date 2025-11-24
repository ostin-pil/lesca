import { logger } from '@/shared/utils/src/index'
import type { Page } from 'playwright'

export interface PerformanceMetrics {
  /** Page load time (ms) */
  loadTime?: number
  /** Time to interactive (ms) */
  domContentLoaded?: number
  /** Number of network requests */
  requestCount: number
  /** Total bytes transferred */
  bytesTransferred: number
  /** JS Heap size (bytes) */
  jsHeapSize?: number
  /** Script execution time (ms) */
  scriptDuration?: number
}

/**
 * Performance Monitor
 * Tracks and analyzes browser performance metrics
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    bytesTransferred: 0,
  }
  private page?: Page
  private startTime: number = 0

  startMonitoring(page: Page): void {
    this.page = page
    this.resetMetrics()
    this.startTime = Date.now()

    page.on('request', () => {
      this.metrics.requestCount++
    })

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    page.on('response', async (response) => {
      try {
        const length = await response.headerValue('content-length')

        if (length) {
          this.metrics.bytesTransferred += parseInt(length, 10)
        }
      } catch {
        // Ignore errors accessing headers
      }
    })

    logger.debug('Performance monitoring started')
  }

  async stopMonitoring(): Promise<PerformanceMetrics> {
    if (!this.page) {
      return this.metrics
    }

    try {
      const timing = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

        return {
          loadTime: navigation?.loadEventEnd - navigation?.startTime,
          domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.startTime,
        }
      })

      if (timing) {
        this.metrics.loadTime = timing.loadTime
        this.metrics.domContentLoaded = timing.domContentLoaded
      }

      // Get Memory usage if available (Chrome only)
      try {
        interface PerformanceWithMemory extends Performance {
          memory?: {
            usedJSHeapSize: number
          }
        }

        const memory = await this.page.evaluate<number | undefined>(() => {
          const perf = window.performance as PerformanceWithMemory
          return perf.memory?.usedJSHeapSize
        })
        if (memory) {
          this.metrics.jsHeapSize = memory
        }
      } catch {
        // Ignore if memory API not available
      }

    } catch (error) {
      logger.warn('Failed to collect final performance metrics', { error })
    }

    const duration = Date.now() - this.startTime
    logger.debug('Performance monitoring stopped', { duration, metrics: this.metrics })

    return this.metrics
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

   private resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      bytesTransferred: 0,
    }
  }
}
