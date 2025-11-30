/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BrowserError } from '@lesca/error'
import type { Browser, LaunchOptions } from 'playwright'

import type { PoolStatistics, SessionPoolConfig } from '@/shared/types/src/index'
import { logger } from '@/shared/utils/src/index'

import type { BrowserPool } from './pool'
import { BrowserPool as BrowserPoolImpl } from './pool'

/**
 * Non-null assertions in this file are safe because they're used only for:
 * 1. getPool(): Map.get() after just creating/setting the entry
 * 2. stats access: Map.get() after getPool() which always creates stats entry
 * TypeScript cannot infer this relationship statically.
 */

/**
 * Helper function to add a timeout to a promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ])
}

/**
 * Session Pool Manager
 * Coordinates per-session browser pools with resource limits
 *
 * Responsibilities:
 * - Create and manage per-session browser pools
 * - Track pool statistics for monitoring
 * - Handle pool exhaustion with retries
 * - Clean up idle pools
 */
export class SessionPoolManager {
  private sessionPools: Map<string, BrowserPool> = new Map()
  private stats: Map<string, PoolStatistics> = new Map()
  private config: Required<SessionPoolConfig>
  private launchOptions: LaunchOptions

  constructor(config: SessionPoolConfig, launchOptions: LaunchOptions = {}) {
    this.config = {
      strategy: config.strategy ?? 'per-session',
      perSessionMaxSize: config.perSessionMaxSize ?? 2,
      perSessionIdleTime: config.perSessionIdleTime ?? 180000,
      acquireTimeout: config.acquireTimeout ?? 30000,
      retryOnFailure: config.retryOnFailure ?? true,
      maxRetries: config.maxRetries ?? 3,
    }
    this.launchOptions = launchOptions

    logger.debug('SessionPoolManager initialized', { config: this.config })
  }

  /**
   * Get or create pool for session
   */
  getPool(sessionName: string): BrowserPool {
    if (!this.sessionPools.has(sessionName)) {
      const pool = new BrowserPoolImpl(
        {
          maxSize: this.config.perSessionMaxSize,
          maxIdleTime: this.config.perSessionIdleTime,
        },
        this.launchOptions
      )
      this.sessionPools.set(sessionName, pool)
      this.stats.set(sessionName, {
        sessionName,
        totalBrowsers: 0,
        activeBrowsers: 0,
        idleBrowsers: 0,
        acquisitionCount: 0,
        releaseCount: 0,
        failureCount: 0,
      })

      logger.debug(`Created new browser pool for session "${sessionName}"`)
    }
    return this.sessionPools.get(sessionName)!
  }

  /**
   * Acquire browser with timeout and retry logic
   */
  async acquireBrowser(sessionName: string): Promise<Browser> {
    const pool = this.getPool(sessionName)
    const stats = this.stats.get(sessionName)!

    let lastError: Error | undefined
    const maxAttempts = this.config.retryOnFailure ? this.config.maxRetries + 1 : 1

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const browser = await withTimeout(pool.acquire(), this.config.acquireTimeout)
        stats.acquisitionCount++
        stats.activeBrowsers++
        stats.lastAcquireTime = Date.now()

        logger.debug(`Acquired browser for session "${sessionName}"`, {
          attempt,
          acquisitionCount: stats.acquisitionCount,
        })

        return browser
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < maxAttempts) {
          logger.warn(`Pool acquisition failed (attempt ${attempt}/${maxAttempts}), retrying...`, {
            sessionName,
            error: lastError.message,
          })
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    stats.failureCount++
    throw new BrowserError(
      'BROWSER_LAUNCH_FAILED',
      `Failed to acquire browser after ${maxAttempts} attempts`,
      lastError
        ? { cause: lastError, context: { sessionName, stats } }
        : { context: { sessionName, stats } }
    )
  }

  /**
   * Release browser back to session pool
   */
  async releaseBrowser(browser: Browser, sessionName: string): Promise<void> {
    const pool = this.sessionPools.get(sessionName)
    if (!pool) {
      logger.warn(`No pool found for session "${sessionName}", closing browser`)
      await browser.close()
      return
    }

    const stats = this.stats.get(sessionName)!
    await pool.release(browser)
    stats.releaseCount++
    stats.activeBrowsers = Math.max(0, stats.activeBrowsers - 1)
    stats.idleBrowsers++
    stats.lastReleaseTime = Date.now()

    logger.debug(`Released browser for session "${sessionName}"`, {
      releaseCount: stats.releaseCount,
      activeBrowsers: stats.activeBrowsers,
    })
  }

  /**
   * Get statistics for session or all sessions
   */
  getStatistics(sessionName?: string): PoolStatistics[] {
    if (sessionName) {
      const stats = this.stats.get(sessionName)
      return stats ? [stats] : []
    }
    return Array.from(this.stats.values())
  }

  /**
   * Cleanup session pool
   */
  async drainSessionPool(sessionName: string): Promise<void> {
    const pool = this.sessionPools.get(sessionName)
    if (pool) {
      await pool.drain()
      this.sessionPools.delete(sessionName)
      this.stats.delete(sessionName)
      logger.debug(`Drained pool for session "${sessionName}"`)
    }
  }

  /**
   * Drain all pools
   */
  async drainAll(): Promise<void> {
    const promises: Promise<void>[] = []
    for (const [name, pool] of this.sessionPools.entries()) {
      promises.push(pool.drain())
      logger.debug(`Draining pool for session "${name}"`)
    }
    await Promise.all(promises)
    this.sessionPools.clear()
    this.stats.clear()

    logger.info('All session pools drained')
  }
}
