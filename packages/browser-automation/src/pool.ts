import { BrowserError } from '@lesca/error'
import { logger } from '@lesca/shared/utils'
import { chromium, type Browser, type LaunchOptions } from 'playwright'

import { CircuitBreaker } from './circuit-breaker'
import type {
  IBrowserPool,
  IMetricsCollector,
  BrowserPoolConfig,
  BrowserPoolStats,
} from './interfaces'

/**
 * Pooled browser wrapper
 */
interface PooledBrowser {
  browser: Browser
  inUse: boolean
  createdAt: number
  lastUsedAt: number
  usageCount: number
}

/**
 * Browser Pool
 * Manages browser instance reuse across multiple scraping operations
 */
export class BrowserPool implements IBrowserPool {
  private pool: PooledBrowser[] = []
  private config: Required<BrowserPoolConfig>
  private launchOptions: LaunchOptions
  private stats: BrowserPoolStats
  private cleanupInterval?: NodeJS.Timeout
  private isShuttingDown = false
  private cleanupHandler?: (() => void) | undefined
  private circuitBreaker: CircuitBreaker
  private metricsCollector?: IMetricsCollector
  private sessionName?: string

  constructor(
    config: BrowserPoolConfig = {},
    launchOptions: LaunchOptions = {},
    options?: { metricsCollector?: IMetricsCollector; sessionName?: string }
  ) {
    this.config = {
      enabled: config.enabled ?? true,
      minSize: config.minSize ?? 0,
      maxSize: config.maxSize ?? 3,
      maxIdleTime: config.maxIdleTime ?? 300000, // 5 minutes
      reusePages: config.reusePages ?? true,
    }

    this.launchOptions = launchOptions
    if (options?.metricsCollector) {
      this.metricsCollector = options.metricsCollector
    }
    if (options?.sessionName) {
      this.sessionName = options.sessionName
    }

    this.stats = {
      total: 0,
      active: 0,
      idle: 0,
      created: 0,
      destroyed: 0,
      reused: 0,
    }

    // Validate configuration
    this.validateConfig()

    // Initialize circuit breaker for browser launches
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3, // Open after 3 consecutive failures
      resetTimeout: 30000, // Try again after 30 seconds
      successThreshold: 2, // Need 2 successes to close
    })

    this.startCleanupInterval()

    this.setupCleanupHandlers()

    logger.debug('BrowserPool initialized', {
      config: this.config,
      launchOptions: this.launchOptions,
    })
  }

  /**
   * Validate pool configuration
   */
  private validateConfig(): void {
    const { minSize, maxSize, maxIdleTime } = this.config

    if (minSize < 0) {
      throw new BrowserError('BROWSER_POOL_CONFIG_INVALID', 'minSize cannot be negative', {
        context: { minSize },
      })
    }

    if (maxSize < 1) {
      throw new BrowserError('BROWSER_POOL_CONFIG_INVALID', 'maxSize must be at least 1', {
        context: { maxSize },
      })
    }

    if (minSize > maxSize) {
      throw new BrowserError(
        'BROWSER_POOL_CONFIG_INVALID',
        'minSize cannot be greater than maxSize',
        { context: { minSize, maxSize } }
      )
    }

    if (maxIdleTime < 0) {
      throw new BrowserError('BROWSER_POOL_CONFIG_INVALID', 'maxIdleTime cannot be negative', {
        context: { maxIdleTime },
      })
    }

    if (maxSize > 10) {
      logger.warn('Large maxSize may consume significant resources', { maxSize })
    }
  }

  private pendingCreates = 0

  /**
   * Acquire a browser from the pool
   */
  async acquire(): Promise<Browser> {
    const startTime = Date.now()

    if (!this.config.enabled) {
      // If pooling is disabled, create a new browser each time
      return await this.createBrowser()
    }

    if (this.isShuttingDown) {
      throw new BrowserError('BROWSER_CRASH', 'Browser pool is shutting down')
    }

    const idleBrowser = this.pool.find((pb) => !pb.inUse)

    if (idleBrowser) {
      if (!idleBrowser.browser.isConnected()) {
        logger.warn('Found disconnected browser in pool, removing it')
        await this.removeBrowser(idleBrowser, 'disconnected')
        return await this.acquire() // Try again
      }

      idleBrowser.inUse = true
      idleBrowser.lastUsedAt = Date.now()
      idleBrowser.usageCount++

      this.updateStats()
      this.stats.reused++

      this.recordAcquire(startTime, true)

      logger.debug('Reused browser from pool', {
        usageCount: idleBrowser.usageCount,
        age: Date.now() - idleBrowser.createdAt,
      })

      return idleBrowser.browser
    }

    if (this.pool.length + this.pendingCreates < this.config.maxSize) {
      this.pendingCreates++
      try {
        const browser = await this.createBrowser()
        const pooledBrowser: PooledBrowser = {
          browser,
          inUse: true,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          usageCount: 1,
        }

        this.pool.push(pooledBrowser)
        this.updateStats()

        this.recordAcquire(startTime, false)

        logger.debug('Created new browser for pool', {
          poolSize: this.pool.length,
          maxSize: this.config.maxSize,
        })

        return browser
      } finally {
        this.pendingCreates--
      }
    }

    logger.warn('Browser pool at max capacity, waiting for available browser')
    return await this.waitForAvailableBrowser(60000, startTime)
  }

  /**
   * Release a browser back to the pool
   */
  async release(browser: Browser): Promise<void> {
    const startTime = Date.now()

    if (!this.config.enabled) {
      // If pooling is disabled, close the browser
      await browser.close()
      return
    }

    const pooledBrowser = this.pool.find((pb) => pb.browser === browser)

    if (!pooledBrowser) {
      logger.warn('Attempted to release browser not in pool')
      // Close it since it's not managed by the pool
      await browser.close()
      return
    }

    pooledBrowser.inUse = false
    pooledBrowser.lastUsedAt = Date.now()

    if (this.config.reusePages) {
      const contexts = browser.contexts()
      for (const context of contexts) {
        await context.close()
      }
    }

    this.updateStats()
    this.recordRelease(startTime)

    logger.debug('Released browser to pool', {
      poolSize: this.pool.length,
      idle: this.stats.idle,
    })
  }

  /**
   * Drain the pool (close all browsers)
   */
  async drain(): Promise<void> {
    logger.info('Draining browser pool', { poolSize: this.pool.length })

    this.isShuttingDown = true

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.removeCleanupHandlers()

    const closePromises = this.pool.map((pb) => this.closeBrowser(pb))
    await Promise.all(closePromises)

    this.pool = []
    this.updateStats()

    logger.info('Browser pool drained')
  }

  /**
   * Get pool statistics
   */
  getStats(): BrowserPoolStats {
    return { ...this.stats }
  }

  /**
   * Get pool configuration
   */
  getConfig(): Required<BrowserPoolConfig> {
    return { ...this.config }
  }

  /**
   * Create a new browser instance (protected by circuit breaker)
   */
  private async createBrowser(): Promise<Browser> {
    const startTime = Date.now()

    return this.circuitBreaker.execute(async () => {
      try {
        const browser = await chromium.launch(this.launchOptions)
        this.stats.created++

        this.recordBrowserCreated(startTime)

        logger.debug('Created new browser instance')

        return browser
      } catch (error) {
        this.recordFailure((error as Error).message)
        throw new BrowserError('BROWSER_LAUNCH_FAILED', 'Failed to create browser instance', {
          cause: error as Error,
        })
      }
    })
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats(): ReturnType<CircuitBreaker['getStats']> {
    return this.circuitBreaker.getStats()
  }

  /**
   * Reset circuit breaker (for recovery scenarios)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset()
  }

  /**
   * Close a browser and remove from pool
   */
  private async closeBrowser(
    pooledBrowser: PooledBrowser,
    reason: 'idle' | 'drain' | 'error' | 'disconnected' = 'drain'
  ): Promise<void> {
    try {
      if (pooledBrowser.browser.isConnected()) {
        await pooledBrowser.browser.close()
      }
      this.stats.destroyed++

      this.recordBrowserDestroyed(reason)

      logger.debug('Closed browser', {
        usageCount: pooledBrowser.usageCount,
        age: Date.now() - pooledBrowser.createdAt,
        reason,
      })
    } catch (error) {
      logger.warn('Error closing browser', { error })
    }
  }

  /**
   * Remove browser from pool
   */
  private async removeBrowser(
    pooledBrowser: PooledBrowser,
    reason: 'idle' | 'drain' | 'error' | 'disconnected' = 'drain'
  ): Promise<void> {
    await this.closeBrowser(pooledBrowser, reason)
    const index = this.pool.indexOf(pooledBrowser)
    if (index !== -1) {
      this.pool.splice(index, 1)
      this.updateStats()
    }
  }

  /**
   * Wait for an available browser
   */
  private async waitForAvailableBrowser(
    timeout = 60000,
    acquireStartTime?: number
  ): Promise<Browser> {
    const waitStartTime = Date.now()

    // Record pool exhausted event
    this.recordPoolExhausted(waitStartTime)

    while (Date.now() - waitStartTime < timeout) {
      const idleBrowser = this.pool.find((pb) => !pb.inUse)
      if (idleBrowser) {
        // Pass the original acquire start time if we have it
        if (acquireStartTime !== undefined) {
          idleBrowser.inUse = true
          idleBrowser.lastUsedAt = Date.now()
          idleBrowser.usageCount++
          this.updateStats()
          this.stats.reused++
          this.recordAcquire(acquireStartTime, true)
          return idleBrowser.browser
        }
        return await this.acquire()
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    this.recordFailure('Pool exhausted after timeout')

    throw new BrowserError(
      'BROWSER_POOL_EXHAUSTED',
      `Pool exhausted: all ${this.pool.length} browsers in use. Waited ${timeout}ms for availability.`,
      {
        context: {
          timeout,
          poolSize: this.pool.length,
          maxSize: this.config.maxSize,
          suggestion: 'Increase maxSize or reduce concurrent operations',
        },
      }
    )
  }

  /**
   * Update pool statistics
   */
  private updateStats(): void {
    this.stats.total = this.pool.length
    this.stats.active = this.pool.filter((pb) => pb.inUse).length
    this.stats.idle = this.pool.filter((pb) => !pb.inUse).length
  }

  /**
   * Start cleanup interval for idle browsers
   */
  private startCleanupInterval(): void {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      void this.cleanupIdleBrowsers()
    }, 60000)

    // Don't prevent process exit
    this.cleanupInterval.unref()
  }

  /**
   * Clean up idle browsers that exceed max idle time
   */
  private async cleanupIdleBrowsers(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    const now = Date.now()
    const browsersToRemove: PooledBrowser[] = []

    for (const pooledBrowser of this.pool) {
      if (pooledBrowser.inUse) {
        continue
      }

      const idleCount = this.pool.filter((pb) => !pb.inUse).length
      if (idleCount <= this.config.minSize) {
        break
      }

      const idleTime = now - pooledBrowser.lastUsedAt
      if (idleTime > this.config.maxIdleTime) {
        browsersToRemove.push(pooledBrowser)
      }
    }

    for (const pooledBrowser of browsersToRemove) {
      logger.debug('Removing idle browser from pool', {
        idleTime: now - pooledBrowser.lastUsedAt,
        usageCount: pooledBrowser.usageCount,
      })
      await this.removeBrowser(pooledBrowser, 'idle')
    }

    // Ensure we maintain minimum pool size
    await this.ensureMinimumPoolSize()
  }

  /**
   * Ensure minimum pool size is maintained
   */
  private async ensureMinimumPoolSize(): Promise<void> {
    if (this.isShuttingDown || !this.config.enabled) {
      return
    }

    while (this.pool.length < this.config.minSize) {
      const browser = await this.createBrowser()
      const pooledBrowser: PooledBrowser = {
        browser,
        inUse: false,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        usageCount: 0,
      }

      this.pool.push(pooledBrowser)
      this.updateStats()

      logger.debug('Added browser to maintain minimum pool size', {
        poolSize: this.pool.length,
        minSize: this.config.minSize,
      })
    }
  }

  /**
   * Setup cleanup handlers for process exit
   */
  private setupCleanupHandlers(): void {
    this.cleanupHandler = () => {
      if (!this.isShuttingDown) {
        void this.drain()
      }
    }

    process.on('SIGINT', this.cleanupHandler)
    process.on('SIGTERM', this.cleanupHandler)
  }

  private removeCleanupHandlers(): void {
    if (this.cleanupHandler) {
      process.off('SIGINT', this.cleanupHandler)
      process.off('SIGTERM', this.cleanupHandler)
      this.cleanupHandler = undefined
    }
  }

  // ============================================================================
  // Metrics Recording Methods
  // ============================================================================

  /**
   * Build base event properties with optional sessionName
   */
  private buildBaseEvent(): { timestamp: number; sessionName?: string } {
    const base: { timestamp: number; sessionName?: string } = {
      timestamp: Date.now(),
    }
    if (this.sessionName) {
      base.sessionName = this.sessionName
    }
    return base
  }

  /**
   * Record acquire event
   */
  private recordAcquire(startTime: number, reused: boolean): void {
    if (!this.metricsCollector) return

    this.metricsCollector.record({
      type: 'pool:acquire',
      ...this.buildBaseEvent(),
      durationMs: Date.now() - startTime,
      reused,
      poolSize: this.pool.length,
    })
  }

  /**
   * Record release event
   */
  private recordRelease(startTime: number): void {
    if (!this.metricsCollector) return

    this.metricsCollector.record({
      type: 'pool:release',
      ...this.buildBaseEvent(),
      durationMs: Date.now() - startTime,
      poolSize: this.pool.length,
    })
  }

  /**
   * Record failure event
   */
  private recordFailure(error: string): void {
    if (!this.metricsCollector) return

    this.metricsCollector.record({
      type: 'pool:failure',
      ...this.buildBaseEvent(),
      error,
    })
  }

  /**
   * Record pool exhausted event
   */
  private recordPoolExhausted(startTime: number): void {
    if (!this.metricsCollector) return

    this.metricsCollector.record({
      type: 'pool:exhausted',
      ...this.buildBaseEvent(),
      waitTimeMs: Date.now() - startTime,
      poolSize: this.pool.length,
      maxSize: this.config.maxSize,
    })
  }

  /**
   * Record browser created event
   */
  private recordBrowserCreated(startTime: number): void {
    if (!this.metricsCollector) return

    this.metricsCollector.record({
      type: 'pool:browser-created',
      ...this.buildBaseEvent(),
      durationMs: Date.now() - startTime,
      poolSize: this.pool.length,
    })
  }

  /**
   * Record browser destroyed event
   */
  private recordBrowserDestroyed(reason: 'idle' | 'drain' | 'error' | 'disconnected'): void {
    if (!this.metricsCollector) return

    this.metricsCollector.record({
      type: 'pool:browser-destroyed',
      ...this.buildBaseEvent(),
      poolSize: this.pool.length,
      reason,
    })
  }

  /**
   * Set metrics collector (for dependency injection)
   */
  setMetricsCollector(collector: IMetricsCollector): void {
    this.metricsCollector = collector
  }

  /**
   * Set session name (for metrics identification)
   */
  setSessionName(name: string): void {
    this.sessionName = name
  }
}
