/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BrowserError } from '@lesca/error'
import type { PoolStatistics, SessionPoolConfig } from '@lesca/shared/types'
import { logger } from '@lesca/shared/utils'
import type { Browser, LaunchOptions } from 'playwright'

import type { IBrowserPool, IMetricsCollector, ISessionPoolManager } from './interfaces'
import { MetricsCollector } from './metrics-collector'
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
 *
 * Coordinates per-session browser pools with resource limits and monitoring.
 * Provides a higher-level abstraction over {@link BrowserPool} for managing
 * multiple named sessions with their own browser pools.
 *
 * ## Features
 * - **Per-session Pools**: Each session gets its own isolated browser pool
 * - **Timeout & Retry**: Configurable acquire timeout with automatic retries
 * - **Statistics**: Per-session and global statistics tracking
 * - **Metrics Integration**: Built-in metrics collection for monitoring
 *
 * ## Architecture
 * ```
 * SessionPoolManager
 * ├── Session "auth-1" → BrowserPool (max: 2)
 * │   ├── Browser 1 (active)
 * │   └── Browser 2 (idle)
 * ├── Session "auth-2" → BrowserPool (max: 2)
 * │   └── Browser 1 (active)
 * └── MetricsCollector (shared)
 * ```
 *
 * ## Usage
 * ```typescript
 * const manager = new SessionPoolManager({
 *   perSessionMaxSize: 2,
 *   acquireTimeout: 30000,
 *   retryOnFailure: true,
 *   maxRetries: 3
 * });
 *
 * // Acquire browser for a session
 * const browser = await manager.acquireBrowser('my-session');
 *
 * // Use browser...
 *
 * // Release back to session pool
 * await manager.releaseBrowser(browser, 'my-session');
 *
 * // Cleanup
 * await manager.drainAll();
 * ```
 *
 * @see {@link SessionPoolConfig} for configuration options
 * @see {@link BrowserPool} for underlying pool implementation
 * @see {@link MetricsCollector} for monitoring integration
 */
export class SessionPoolManager implements ISessionPoolManager {
  private sessionPools: Map<string, IBrowserPool> = new Map()
  private stats: Map<string, PoolStatistics> = new Map()
  private config: Required<SessionPoolConfig>
  private launchOptions: LaunchOptions
  private metricsCollector: IMetricsCollector

  /**
   * Creates a new SessionPoolManager instance.
   *
   * @param config - Session pool configuration
   * @param config.strategy - Pool strategy ('per-session' or 'shared')
   * @param config.perSessionMaxSize - Max browsers per session (default: 2)
   * @param config.perSessionIdleTime - Idle timeout in ms (default: 180000)
   * @param config.acquireTimeout - Acquire timeout in ms (default: 30000)
   * @param config.retryOnFailure - Enable retry on acquire failure (default: true)
   * @param config.maxRetries - Max retry attempts (default: 3)
   * @param launchOptions - Playwright browser launch options
   * @param options - Additional options
   * @param options.metricsCollector - Custom metrics collector (creates new if not provided)
   *
   * @throws {BrowserError} If configuration is invalid
   *
   * @example
   * ```typescript
   * const manager = new SessionPoolManager(
   *   { perSessionMaxSize: 3, acquireTimeout: 60000 },
   *   { headless: true }
   * );
   * ```
   */
  constructor(
    config: SessionPoolConfig,
    launchOptions: LaunchOptions = {},
    options?: { metricsCollector?: IMetricsCollector }
  ) {
    this.config = {
      strategy: config.strategy ?? 'per-session',
      perSessionMaxSize: config.perSessionMaxSize ?? 2,
      perSessionIdleTime: config.perSessionIdleTime ?? 180000,
      acquireTimeout: config.acquireTimeout ?? 30000,
      retryOnFailure: config.retryOnFailure ?? true,
      maxRetries: config.maxRetries ?? 3,
    }
    this.launchOptions = launchOptions
    this.metricsCollector = options?.metricsCollector ?? new MetricsCollector()

    // Validate configuration
    this.validateConfig()

    logger.debug('SessionPoolManager initialized', { config: this.config })
  }

  /**
   * Validate session pool manager configuration
   */
  private validateConfig(): void {
    const { strategy, perSessionMaxSize, perSessionIdleTime, acquireTimeout, maxRetries } =
      this.config

    if (strategy !== 'per-session' && strategy !== 'shared') {
      throw new BrowserError(
        'BROWSER_POOL_CONFIG_INVALID',
        `Invalid pool strategy: ${String(strategy)}. Must be 'per-session' or 'shared'`,
        { context: { strategy } }
      )
    }

    if (perSessionMaxSize < 1) {
      throw new BrowserError(
        'BROWSER_POOL_CONFIG_INVALID',
        'perSessionMaxSize must be at least 1',
        { context: { perSessionMaxSize } }
      )
    }

    if (perSessionIdleTime < 0) {
      throw new BrowserError(
        'BROWSER_POOL_CONFIG_INVALID',
        'perSessionIdleTime cannot be negative',
        { context: { perSessionIdleTime } }
      )
    }

    if (acquireTimeout < 1000) {
      throw new BrowserError(
        'BROWSER_POOL_CONFIG_INVALID',
        'acquireTimeout must be at least 1000ms',
        { context: { acquireTimeout } }
      )
    }

    if (maxRetries < 0) {
      throw new BrowserError('BROWSER_POOL_CONFIG_INVALID', 'maxRetries cannot be negative', {
        context: { maxRetries },
      })
    }
  }

  /**
   * Gets or creates a browser pool for a session.
   *
   * If a pool doesn't exist for the session, a new one is created with
   * the manager's configuration. Pools are lazily created on first access.
   *
   * @param sessionName - The session identifier
   *
   * @returns The browser pool for the session
   *
   * @example
   * ```typescript
   * const pool = manager.getPool('my-session');
   * const stats = pool.getStats();
   * ```
   */
  getPool(sessionName: string): IBrowserPool {
    if (!this.sessionPools.has(sessionName)) {
      const pool = new BrowserPoolImpl(
        {
          maxSize: this.config.perSessionMaxSize,
          maxIdleTime: this.config.perSessionIdleTime,
        },
        this.launchOptions,
        {
          metricsCollector: this.metricsCollector,
          sessionName,
        }
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
   * Acquires a browser for a session with timeout and retry logic.
   *
   * This is the primary method for obtaining a browser. It handles:
   * - Pool creation for new sessions
   * - Timeout enforcement
   * - Automatic retry with exponential backoff
   * - Statistics tracking
   *
   * @param sessionName - The session identifier
   *
   * @returns A browser instance ready for use
   *
   * @throws {BrowserError} BROWSER_LAUNCH_FAILED - After all retry attempts exhausted
   *
   * @example
   * ```typescript
   * const browser = await manager.acquireBrowser('my-session');
   * try {
   *   const page = await browser.newPage();
   *   // Use browser...
   * } finally {
   *   await manager.releaseBrowser(browser, 'my-session');
   * }
   * ```
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
   * Releases a browser back to its session pool.
   *
   * The browser becomes available for future {@link acquireBrowser} calls.
   * If the session pool doesn't exist, the browser is closed directly.
   *
   * @param browser - The browser instance to release
   * @param sessionName - The session the browser belongs to
   *
   * @example
   * ```typescript
   * await manager.releaseBrowser(browser, 'my-session');
   * ```
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
   * Gets pool statistics for one or all sessions.
   *
   * @param sessionName - Optional session to get statistics for. If omitted, returns all sessions.
   *
   * @returns Array of pool statistics
   *
   * @example
   * ```typescript
   * // Get stats for specific session
   * const [stats] = manager.getStatistics('my-session');
   *
   * // Get stats for all sessions
   * const allStats = manager.getStatistics();
   * for (const stats of allStats) {
   *   console.log(`${stats.sessionName}: ${stats.activeBrowsers} active`);
   * }
   * ```
   */
  getStatistics(sessionName?: string): PoolStatistics[] {
    if (sessionName) {
      const stats = this.stats.get(sessionName)
      return stats ? [stats] : []
    }
    return Array.from(this.stats.values())
  }

  /**
   * Drains and removes a specific session's pool.
   *
   * Closes all browsers in the session's pool and removes the pool
   * from management. Use this to clean up resources for a session
   * that is no longer needed.
   *
   * @param sessionName - The session to drain
   *
   * @example
   * ```typescript
   * // Clean up a specific session
   * await manager.drainSessionPool('old-session');
   * ```
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
   * Drains all session pools.
   *
   * Closes all browsers across all sessions and clears all pool state.
   * Call this during application shutdown to ensure proper cleanup.
   *
   * @example
   * ```typescript
   * // During application shutdown
   * await manager.drainAll();
   * ```
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

  /**
   * Gets the metrics collector for monitoring.
   *
   * Use this to access aggregated metrics, subscribe to events,
   * or export metrics data.
   *
   * @returns The metrics collector instance
   *
   * @example
   * ```typescript
   * const collector = manager.getMetricsCollector();
   *
   * // Subscribe to events
   * collector.on('metric', (event) => {
   *   console.log(`${event.type}: ${event.sessionName}`);
   * });
   *
   * // Get summary
   * const summary = collector.getSummary();
   * ```
   */
  getMetricsCollector(): IMetricsCollector {
    return this.metricsCollector
  }
}
