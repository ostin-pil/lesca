/**
 * Rate Limit Manager
 *
 * Main orchestrator for intelligent rate limit handling.
 * Combines backoff strategies, endpoint tracking, and session rotation.
 *
 * @module browser-automation/rate-limit/rate-limit-manager
 */

import { RateLimitError } from '@lesca/shared/error'
import { logger } from '@lesca/shared/utils'

import type { IMetricsCollector } from '../interfaces'
import { createBackoffStrategy, resolveBackoffConfig } from './backoff-strategy'
import { EndpointStateCollection } from './endpoint-state'
import { parseRetryAfter } from './retry-after-parser'
import { SessionRotator, resolveSessionRotationConfig } from './session-rotator'
import type {
  BackoffCalculator,
  RateLimitConfig,
  RateLimitDecision,
  ResolvedRateLimitConfig,
  EndpointState,
} from './types'

// ============================================================================
// Default Configuration
// ============================================================================

/** Default integration configuration */
const DEFAULT_INTEGRATION_CONFIG = {
  honorRetryAfter: true,
  maxRetryAfterMs: 120000,
}

/**
 * Resolve rate limit configuration with all defaults.
 *
 * @param config - Partial configuration
 * @returns Fully resolved configuration
 */
export function resolveRateLimitConfig(config?: RateLimitConfig): ResolvedRateLimitConfig {
  return {
    enabled: config?.enabled ?? true,
    backoff: resolveBackoffConfig(config?.backoff),
    sessionRotation: resolveSessionRotationConfig(config?.sessionRotation),
    integration: {
      honorRetryAfter:
        config?.integration?.honorRetryAfter ?? DEFAULT_INTEGRATION_CONFIG.honorRetryAfter,
      maxRetryAfterMs:
        config?.integration?.maxRetryAfterMs ?? DEFAULT_INTEGRATION_CONFIG.maxRetryAfterMs,
    },
  }
}

// ============================================================================
// Rate Limit Manager
// ============================================================================

/**
 * Rate Limit Manager for intelligent rate limit handling.
 *
 * Provides:
 * - Configurable backoff strategies (exponential, linear, fibonacci, constant)
 * - Per-endpoint rate limit tracking
 * - Session rotation for distributing requests
 * - Retry-After header support
 *
 * @example
 * ```typescript
 * const manager = new RateLimitManager({
 *   backoff: { strategy: 'exponential', maxRetries: 5 },
 *   sessionRotation: { enabled: true, distributionStrategy: 'least-loaded' }
 * })
 *
 * // Execute with automatic retry
 * const result = await manager.executeWithRetry(
 *   () => fetch('/api/data'),
 *   '/api/data',
 *   'session-1'
 * )
 *
 * // Or get manual decision
 * const decision = manager.getDecision('/api/endpoint', 'session-1')
 * if (decision.shouldProceed) {
 *   if (decision.delayMs > 0) await sleep(decision.delayMs)
 *   // Make request
 * }
 * ```
 */
export class RateLimitManager {
  private config: ResolvedRateLimitConfig
  private endpointStates: EndpointStateCollection
  private sessionRotator: SessionRotator
  private backoffStrategy: BackoffCalculator
  private metricsCollector?: IMetricsCollector

  /**
   * Create a new rate limit manager.
   *
   * @param config - Rate limit configuration
   * @param metricsCollector - Optional metrics collector for event tracking
   */
  constructor(config?: RateLimitConfig, metricsCollector?: IMetricsCollector) {
    this.config = resolveRateLimitConfig(config)
    this.endpointStates = new EndpointStateCollection()
    this.sessionRotator = new SessionRotator(this.config.sessionRotation)
    this.backoffStrategy = createBackoffStrategy(this.config.backoff)
    if (metricsCollector) {
      this.metricsCollector = metricsCollector
    }
  }

  // ============================================================================
  // Core API
  // ============================================================================

  /**
   * Get a decision about whether to proceed with a request.
   *
   * @param endpoint - URL or endpoint pattern
   * @param sessionId - Optional session identifier
   * @returns Decision with delay and session recommendations
   */
  getDecision(endpoint: string, sessionId?: string): RateLimitDecision {
    if (!this.config.enabled) {
      return {
        shouldProceed: true,
        delayMs: 0,
        recommendedSession: sessionId,
        reason: 'ok',
      }
    }

    // Check if session is on cooldown
    if (sessionId && this.sessionRotator.isOnCooldown(sessionId)) {
      // Try to find an alternative session
      const alternative = this.sessionRotator.selectSession()
      if (alternative && alternative !== sessionId) {
        return {
          shouldProceed: true,
          delayMs: 0,
          recommendedSession: alternative,
          reason: 'cooldown',
        }
      }

      // No alternative available, calculate cooldown delay
      const session = this.sessionRotator.getSessionInfo(sessionId)
      if (session?.cooldownUntil !== undefined) {
        const delayMs = Math.max(0, session.cooldownUntil - Date.now())
        return {
          shouldProceed: true,
          delayMs,
          recommendedSession: sessionId,
          reason: 'cooldown',
        }
      }
    }

    // Check if endpoint is rate limited
    const state = this.endpointStates.getState(endpoint)
    if (state.isRateLimited) {
      // Calculate delay based on rate limit expiry
      if (state.rateLimitedUntil !== undefined) {
        const delayMs = Math.max(0, state.rateLimitedUntil - Date.now())
        if (delayMs > 0) {
          return {
            shouldProceed: true,
            delayMs,
            recommendedSession: this.getRecommendedSession(sessionId),
            reason: 'rate-limited',
          }
        }
      }

      // Use backoff based on consecutive failures
      const delayMs = this.backoffStrategy(state.consecutiveFailures)
      return {
        shouldProceed: true,
        delayMs,
        recommendedSession: this.getRecommendedSession(sessionId),
        reason: 'delay-required',
      }
    }

    return {
      shouldProceed: true,
      delayMs: 0,
      recommendedSession: this.getRecommendedSession(sessionId),
      reason: 'ok',
    }
  }

  /**
   * Record a successful request.
   *
   * @param endpoint - URL or endpoint pattern
   * @param sessionId - Optional session identifier
   */
  recordSuccess(endpoint: string, sessionId?: string): void {
    this.endpointStates.recordSuccess(endpoint)

    if (sessionId) {
      this.sessionRotator.recordSuccess(sessionId)
    }

    logger.debug(`Rate limit: success for ${endpoint}`, { sessionId })
  }

  /**
   * Record a rate limit response.
   *
   * @param endpoint - URL or endpoint pattern
   * @param retryAfter - Optional Retry-After header value (string or seconds)
   * @param sessionId - Optional session identifier
   */
  recordRateLimited(
    endpoint: string,
    retryAfter?: string | number | null,
    sessionId?: string
  ): void {
    // Parse Retry-After header if provided
    let retryAfterMs: number | undefined
    if (this.config.integration.honorRetryAfter && retryAfter != null) {
      retryAfterMs = parseRetryAfter(retryAfter, this.config.integration.maxRetryAfterMs)
    }

    this.endpointStates.recordRateLimited(endpoint, retryAfterMs)

    if (sessionId) {
      this.sessionRotator.recordRateLimit(sessionId)

      // Put session on cooldown
      if (this.config.sessionRotation.enabled) {
        this.sessionRotator.setCooldown(sessionId, retryAfterMs)
      }
    }

    logger.debug(`Rate limit: rate limited for ${endpoint}`, { sessionId, retryAfterMs })
  }

  /**
   * Execute a function with automatic retry on rate limit.
   *
   * @param fn - Function to execute
   * @param endpoint - URL or endpoint pattern
   * @param sessionId - Optional session identifier
   * @returns Function result
   * @throws RateLimitError if max retries exceeded
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    endpoint: string,
    sessionId?: string
  ): Promise<T> {
    const maxRetries = this.config.backoff.maxRetries

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const decision = this.getDecision(endpoint, sessionId)

      if (decision.delayMs > 0) {
        logger.debug(
          `Rate limit: waiting ${decision.delayMs}ms before attempt ${attempt}/${maxRetries}`,
          { endpoint }
        )
        await this.sleep(decision.delayMs)
      }

      try {
        const result = await fn()
        this.recordSuccess(endpoint, sessionId)
        return result
      } catch (error) {
        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          const retryAfter = this.extractRetryAfter(error)
          this.recordRateLimited(endpoint, retryAfter, sessionId)

          if (attempt === maxRetries) {
            logger.warn(`Rate limit: max retries (${maxRetries}) exceeded for ${endpoint}`)
            throw error
          }

          logger.debug(`Rate limit: attempt ${attempt}/${maxRetries} failed, will retry`, {
            endpoint,
          })
          continue
        }

        // Non-rate-limit error, don't retry
        throw error
      }
    }

    // Should not reach here, but TypeScript needs this
    throw new RateLimitError(`Rate limit: max retries exceeded for ${endpoint}`)
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Register a session for rotation.
   *
   * @param sessionId - Session identifier
   */
  registerSession(sessionId: string): void {
    this.sessionRotator.registerSession(sessionId)
    logger.debug(`Rate limit: registered session ${sessionId}`)
  }

  /**
   * Unregister a session from rotation.
   *
   * @param sessionId - Session identifier
   */
  unregisterSession(sessionId: string): void {
    this.sessionRotator.unregisterSession(sessionId)
    logger.debug(`Rate limit: unregistered session ${sessionId}`)
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Check if rate limit handling is enabled.
   *
   * @returns True if enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Get the resolved configuration.
   *
   * @returns Resolved configuration
   */
  getConfig(): ResolvedRateLimitConfig {
    return this.config
  }

  /**
   * Get all endpoint states.
   *
   * @returns Array of endpoint states
   */
  getEndpointStates(): EndpointState[] {
    return this.endpointStates.getAll()
  }

  /**
   * Get the metrics collector (if configured).
   *
   * @returns Metrics collector or undefined
   */
  getMetricsCollector(): IMetricsCollector | undefined {
    return this.metricsCollector
  }

  /**
   * Clear all state.
   */
  clear(): void {
    this.endpointStates.clear()
    this.sessionRotator.clear()
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Get recommended session for a request.
   */
  private getRecommendedSession(currentSessionId?: string): string | undefined {
    if (!this.config.sessionRotation.enabled) {
      return currentSessionId
    }

    // If current session is on cooldown, try to find alternative
    if (currentSessionId && this.sessionRotator.isOnCooldown(currentSessionId)) {
      const alternative = this.sessionRotator.selectSession()
      if (alternative) {
        return alternative
      }
    }

    return currentSessionId ?? this.sessionRotator.selectSession()
  }

  /**
   * Check if an error is a rate limit error.
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof RateLimitError) {
      return true
    }

    // Check for error with rate limit indicators
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return (
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('429')
      )
    }

    return false
  }

  /**
   * Extract Retry-After value from an error.
   */
  private extractRetryAfter(error: unknown): number | undefined {
    if (error instanceof RateLimitError) {
      return error.retryAfter
    }
    return undefined
  }

  /**
   * Sleep for a given duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
