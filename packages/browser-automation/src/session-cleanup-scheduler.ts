import type { SessionCleanupConfig } from '@lesca/shared/types'
import { logger } from '@lesca/shared/utils'

import type { ISessionManager, SessionData } from './interfaces'

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Sessions that were cleaned up */
  cleaned: string[]
  /** Sessions that were kept */
  kept: string[]
  /** Sessions that failed during cleanup */
  errors: Array<{ session: string; error: string }>
  /** Whether this was a dry run */
  dryRun: boolean
  /** Timestamp when cleanup ran */
  timestamp: number
}

/**
 * Default cleanup configuration
 */
const DEFAULT_CONFIG: Required<SessionCleanupConfig> = {
  enabled: true,
  maxSessionAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  cleanupOnStartup: true,
  cleanupInterval: 0, // Disabled by default
  maxSessions: 0, // Unlimited
}

/**
 * Session Cleanup Scheduler
 *
 * Automatically cleans up expired or excess browser sessions to prevent
 * disk space exhaustion and improve performance.
 *
 * ## Features
 * - **Age-based cleanup**: Remove sessions older than `maxSessionAge`
 * - **Count-based cleanup**: Keep only `maxSessions` most recent sessions
 * - **Startup cleanup**: Optionally run cleanup when application starts
 * - **Background scheduler**: Periodic cleanup with configurable interval
 * - **Dry run support**: Preview what would be cleaned without deleting
 *
 * ## Usage
 * ```typescript
 * const scheduler = new SessionCleanupScheduler(sessionManager, {
 *   maxSessionAge: 7 * 24 * 60 * 60 * 1000, // 7 days
 *   maxSessions: 10,
 *   cleanupOnStartup: true,
 *   cleanupInterval: 24 * 60 * 60 * 1000 // Daily
 * });
 *
 * // Run cleanup on startup
 * await scheduler.runStartupCleanup();
 *
 * // Start background scheduler
 * scheduler.start();
 *
 * // Preview what would be cleaned
 * const preview = await scheduler.cleanup({ dryRun: true });
 *
 * // Stop scheduler on shutdown
 * scheduler.stop();
 * ```
 *
 * @see {@link SessionCleanupConfig} for configuration options
 * @see {@link CleanupResult} for cleanup result structure
 */
export class SessionCleanupScheduler {
  private config: Required<SessionCleanupConfig>
  private sessionManager: ISessionManager
  private intervalId: ReturnType<typeof setInterval> | null = null
  private isRunning = false

  /**
   * Creates a new SessionCleanupScheduler instance.
   *
   * @param sessionManager - Session manager for accessing sessions
   * @param config - Cleanup configuration
   *
   * @example
   * ```typescript
   * const scheduler = new SessionCleanupScheduler(sessionManager, {
   *   maxSessionAge: 7 * 24 * 60 * 60 * 1000, // 7 days
   *   cleanupOnStartup: true
   * });
   * ```
   */
  constructor(sessionManager: ISessionManager, config: Partial<SessionCleanupConfig> = {}) {
    this.sessionManager = sessionManager
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    }

    logger.debug('SessionCleanupScheduler initialized', { config: this.config })
  }

  /**
   * Runs cleanup if enabled on startup.
   *
   * Call this method during application initialization to clean up
   * expired sessions before starting normal operations.
   *
   * @returns Cleanup result if cleanup ran, null if disabled
   *
   * @example
   * ```typescript
   * // In application startup
   * const result = await scheduler.runStartupCleanup();
   * if (result) {
   *   console.log(`Cleaned ${result.cleaned.length} sessions`);
   * }
   * ```
   */
  async runStartupCleanup(): Promise<CleanupResult | null> {
    if (!this.config.enabled || !this.config.cleanupOnStartup) {
      logger.debug('Startup cleanup skipped (disabled in config)')
      return null
    }

    logger.debug('Running startup session cleanup')
    return await this.cleanup()
  }

  /**
   * Starts the background cleanup scheduler.
   *
   * The scheduler runs cleanup at the configured `cleanupInterval`.
   * If interval is 0 or cleanup is disabled, this method does nothing.
   *
   * @example
   * ```typescript
   * scheduler.start();
   * // Cleanup will run at configured interval
   * ```
   */
  start(): void {
    if (!this.config.enabled || this.config.cleanupInterval <= 0) {
      logger.debug('Background cleanup scheduler disabled')
      return
    }

    if (this.intervalId) {
      logger.warn('Cleanup scheduler already running')
      return
    }

    this.intervalId = setInterval(() => {
      void this.cleanup().catch((error: unknown) => {
        logger.error(
          `Background cleanup failed: ${error instanceof Error ? error.message : String(error)}`
        )
      })
    }, this.config.cleanupInterval)

    logger.debug('Started cleanup scheduler', {
      intervalMs: this.config.cleanupInterval,
    })
  }

  /**
   * Stops the background cleanup scheduler.
   *
   * @example
   * ```typescript
   * // On application shutdown
   * scheduler.stop();
   * ```
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      logger.debug('Stopped cleanup scheduler')
    }
  }

  /**
   * Runs cleanup of expired and excess sessions.
   *
   * Cleanup proceeds in two phases:
   * 1. Remove sessions older than `maxSessionAge`
   * 2. If `maxSessions` is set, keep only the most recent N sessions
   *
   * @param options - Cleanup options
   * @param options.dryRun - If true, don't actually delete sessions
   *
   * @returns Result of the cleanup operation
   *
   * @example
   * ```typescript
   * // Preview what would be cleaned
   * const preview = await scheduler.cleanup({ dryRun: true });
   * console.log(`Would clean: ${preview.cleaned.join(', ')}`);
   *
   * // Actually perform cleanup
   * const result = await scheduler.cleanup();
   * console.log(`Cleaned: ${result.cleaned.length} sessions`);
   * ```
   */
  async cleanup(options: { dryRun?: boolean } = {}): Promise<CleanupResult> {
    const { dryRun = false } = options

    if (this.isRunning) {
      logger.warn('Cleanup already in progress, skipping')
      return {
        cleaned: [],
        kept: [],
        errors: [],
        dryRun,
        timestamp: Date.now(),
      }
    }

    this.isRunning = true
    const result: CleanupResult = {
      cleaned: [],
      kept: [],
      errors: [],
      dryRun,
      timestamp: Date.now(),
    }

    try {
      // Get all sessions
      const sessions = await this.sessionManager.listSessions()

      if (sessions.length === 0) {
        logger.debug('No sessions to clean up')
        return result
      }

      // Determine which sessions to clean
      const { toClean, toKeep } = this.categorizeSessionsForCleanup(sessions)

      result.kept = toKeep.map((s) => s.name)

      // Perform cleanup
      for (const session of toClean) {
        try {
          if (!dryRun) {
            await this.sessionManager.deleteSession(session.name)
          }
          result.cleaned.push(session.name)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          result.errors.push({ session: session.name, error: message })
          logger.warn(`Failed to delete session "${session.name}"`, { error: message })
        }
      }

      const action = dryRun ? 'Would clean' : 'Cleaned'
      logger.debug(`${action} ${result.cleaned.length} sessions`, {
        cleaned: result.cleaned,
        kept: result.kept.length,
        errors: result.errors.length,
      })

      return result
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Categorizes sessions into those to clean and those to keep
   */
  private categorizeSessionsForCleanup(sessions: SessionData[]): {
    toClean: SessionData[]
    toKeep: SessionData[]
  } {
    const now = Date.now()
    const toClean: SessionData[] = []
    const keptSessions: SessionData[] = []

    // Phase 1: Age-based cleanup
    for (const session of sessions) {
      const sessionAge = now - session.metadata.lastUsed
      const isExpired = sessionAge > this.config.maxSessionAge

      // Also check explicit expiration if set
      const isPastExpiry = session.metadata.expires !== undefined && now > session.metadata.expires

      if (isExpired || isPastExpiry) {
        toClean.push(session)
      } else {
        keptSessions.push(session)
      }
    }

    // Phase 2: Count-based cleanup (if maxSessions is set)
    if (this.config.maxSessions > 0 && keptSessions.length > this.config.maxSessions) {
      // Sort by lastUsed (most recent first)
      keptSessions.sort((a, b) => b.metadata.lastUsed - a.metadata.lastUsed)

      // Move excess sessions to toClean
      const excess = keptSessions.splice(this.config.maxSessions)
      toClean.push(...excess)
    }

    return { toClean, toKeep: keptSessions }
  }

  /**
   * Gets the current cleanup configuration.
   *
   * @returns The resolved configuration with defaults applied
   */
  getConfig(): Required<SessionCleanupConfig> {
    return { ...this.config }
  }

  /**
   * Updates the cleanup configuration.
   *
   * If the scheduler is running, it will be restarted with the new interval.
   *
   * @param config - Partial configuration to merge
   *
   * @example
   * ```typescript
   * scheduler.updateConfig({ maxSessionAge: 14 * 24 * 60 * 60 * 1000 });
   * ```
   */
  updateConfig(config: Partial<SessionCleanupConfig>): void {
    const wasRunning = this.intervalId !== null

    // Stop if running
    this.stop()

    // Update config
    this.config = {
      ...this.config,
      ...config,
    }

    // Restart if was running
    if (wasRunning) {
      this.start()
    }

    logger.debug('Updated cleanup config', { config: this.config })
  }

  /**
   * Checks if the background scheduler is currently running.
   *
   * @returns True if scheduler is active
   */
  isSchedulerRunning(): boolean {
    return this.intervalId !== null
  }
}
