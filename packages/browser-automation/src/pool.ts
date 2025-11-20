import { logger } from '@/shared/utils/src/index.js'
import { BrowserError } from '@lesca/error'
import { chromium, type Browser, type LaunchOptions } from 'playwright'

/**
 * Browser pool configuration
 */
export interface BrowserPoolConfig {
  /** Enable browser pooling */
  enabled?: boolean
  /** Minimum number of browsers to keep ready */
  minSize?: number
  /** Maximum number of concurrent browsers */
  maxSize?: number
  /** Maximum idle time before eviction (ms) */
  maxIdleTime?: number
  /** Reuse pages within browser */
  reusePages?: boolean
}

/**
 * Browser pool statistics
 */
export interface BrowserPoolStats {
  /** Total browsers in pool */
  total: number
  /** Active (in-use) browsers */
  active: number
  /** Idle (available) browsers */
  idle: number
  /** Browsers created (lifetime) */
  created: number
  /** Browsers destroyed (lifetime) */
  destroyed: number
  /** Browsers reused (lifetime) */
  reused: number
}

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
export class BrowserPool {
  private pool: PooledBrowser[] = []
  private config: Required<BrowserPoolConfig>
  private launchOptions: LaunchOptions
  private stats: BrowserPoolStats
  private cleanupInterval?: NodeJS.Timeout
  private isShuttingDown = false
  private cleanupHandler?: (() => void) | undefined

  constructor(
    config: BrowserPoolConfig = {},
    launchOptions: LaunchOptions = {}
  ) {
    this.config = {
      enabled: config.enabled ?? true,
      minSize: config.minSize ?? 0,
      maxSize: config.maxSize ?? 3,
      maxIdleTime: config.maxIdleTime ?? 300000, // 5 minutes
      reusePages: config.reusePages ?? true,
    }

    this.launchOptions = launchOptions

    this.stats = {
      total: 0,
      active: 0,
      idle: 0,
      created: 0,
      destroyed: 0,
      reused: 0,
    }

    if (this.config.minSize > this.config.maxSize) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'minSize cannot be greater than maxSize',
        { context: { minSize: this.config.minSize, maxSize: this.config.maxSize } }
      )
    }

    this.startCleanupInterval()

    this.setupCleanupHandlers()

    logger.debug('BrowserPool initialized', {
      config: this.config,
      launchOptions: this.launchOptions,
    })
  }

  /**
   * Acquire a browser from the pool
   */
  async acquire(): Promise<Browser> {
    if (!this.config.enabled) {
      // If pooling is disabled, create a new browser each time
      return await this.createBrowser()
    }

    if (this.isShuttingDown) {
      throw new BrowserError(
        'BROWSER_CRASH',
        'Browser pool is shutting down'
      )
    }

    const idleBrowser = this.pool.find((pb) => !pb.inUse)

    if (idleBrowser) {
      if (!idleBrowser.browser.isConnected()) {
        logger.warn('Found disconnected browser in pool, removing it')
        await this.removeBrowser(idleBrowser)
        return await this.acquire() // Try again
      }

      idleBrowser.inUse = true
      idleBrowser.lastUsedAt = Date.now()
      idleBrowser.usageCount++

      this.updateStats()
      this.stats.reused++

      logger.debug('Reused browser from pool', {
        usageCount: idleBrowser.usageCount,
        age: Date.now() - idleBrowser.createdAt,
      })

      return idleBrowser.browser
    }

    if (this.pool.length < this.config.maxSize) {
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

      logger.debug('Created new browser for pool', {
        poolSize: this.pool.length,
        maxSize: this.config.maxSize,
      })

      return browser
    }

    logger.warn('Browser pool at max capacity, waiting for available browser')
    return await this.waitForAvailableBrowser()
  }

  /**
   * Release a browser back to the pool
   */
  async release(browser: Browser): Promise<void> {
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
   * Create a new browser instance
   */
  private async createBrowser(): Promise<Browser> {
    try {
      const browser = await chromium.launch(this.launchOptions)
      this.stats.created++

      logger.debug('Created new browser instance')

      return browser
    } catch (error) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Failed to create browser instance',
        { cause: error as Error }
      )
    }
  }

  /**
   * Close a browser and remove from pool
   */
  private async closeBrowser(pooledBrowser: PooledBrowser): Promise<void> {
    try {
      if (pooledBrowser.browser.isConnected()) {
        await pooledBrowser.browser.close()
      }
      this.stats.destroyed++

      logger.debug('Closed browser', {
        usageCount: pooledBrowser.usageCount,
        age: Date.now() - pooledBrowser.createdAt,
      })
    } catch (error) {
      logger.warn('Error closing browser', { error })
    }
  }

  /**
   * Remove browser from pool
   */
  private async removeBrowser(pooledBrowser: PooledBrowser): Promise<void> {
    await this.closeBrowser(pooledBrowser)
    const index = this.pool.indexOf(pooledBrowser)
    if (index !== -1) {
      this.pool.splice(index, 1)
      this.updateStats()
    }
  }

  /**
   * Wait for an available browser
   */
  private async waitForAvailableBrowser(timeout = 60000): Promise<Browser> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const idleBrowser = this.pool.find((pb) => !pb.inUse)
      if (idleBrowser) {
        return await this.acquire()
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    throw new BrowserError(
      'BROWSER_NAVIGATION_FAILED',
      'Timeout waiting for available browser in pool',
      { context: { timeout, poolSize: this.pool.length } }
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
      await this.removeBrowser(pooledBrowser)
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
}
