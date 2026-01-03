/**
 * Rate Limit Intelligence Module
 *
 * Provides intelligent rate limit handling with configurable backoff strategies,
 * per-endpoint tracking, and session rotation for request distribution.
 *
 * @module browser-automation/rate-limit
 *
 * @example
 * ```typescript
 * import { RateLimitManager } from '@lesca/browser-automation'
 *
 * const manager = new RateLimitManager({
 *   backoff: {
 *     strategy: 'exponential',
 *     initialDelayMs: 1000,
 *     maxRetries: 5
 *   },
 *   sessionRotation: {
 *     enabled: true,
 *     distributionStrategy: 'least-loaded'
 *   }
 * })
 *
 * // Execute with automatic retry
 * const result = await manager.executeWithRetry(
 *   () => fetch('/api/data'),
 *   '/api/data',
 *   'session-1'
 * )
 * ```
 */

// Main orchestrator
export { RateLimitManager, resolveRateLimitConfig } from './rate-limit-manager'

// Backoff strategies
export {
  createBackoffStrategy,
  exponentialBackoff,
  linearBackoff,
  fibonacciBackoff,
  constantBackoff,
  applyJitter,
  capDelay,
  resolveBackoffConfig,
  DEFAULT_BACKOFF_CONFIG,
} from './backoff-strategy'

// Retry-After parsing
export { parseRetryAfter, isHttpDate, DEFAULT_MAX_RETRY_AFTER_MS } from './retry-after-parser'

// Endpoint state tracking
export { EndpointStateCollection, normalizeEndpoint } from './endpoint-state'

// Session rotation
export {
  SessionRotator,
  resolveSessionRotationConfig,
  DEFAULT_SESSION_ROTATION_CONFIG,
} from './session-rotator'

// Types
export type {
  BackoffStrategyType,
  DistributionStrategy,
  DecisionReason,
  BackoffConfig,
  SessionRotationConfig,
  IntegrationConfig,
  RateLimitConfig,
  ResolvedRateLimitConfig,
  EndpointState,
  SessionInfo,
  RateLimitDecision,
  BackoffCalculator,
} from './types'
