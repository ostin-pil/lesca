/**
 * Rate Limit Intelligence Types
 *
 * Type definitions for the rate limit handling system.
 * Includes backoff strategies, endpoint state tracking, and session rotation.
 *
 * @module browser-automation/rate-limit/types
 */

// ============================================================================
// Strategy Types
// ============================================================================

/**
 * Backoff strategy algorithm type.
 *
 * - `exponential`: Delay doubles each attempt (1s, 2s, 4s, 8s...)
 * - `linear`: Delay increases linearly (1s, 2s, 3s, 4s...)
 * - `fibonacci`: Delay follows fibonacci sequence (1s, 1s, 2s, 3s, 5s...)
 * - `constant`: Same delay every attempt
 */
export type BackoffStrategyType = 'exponential' | 'linear' | 'fibonacci' | 'constant'

/**
 * Session distribution strategy for load balancing.
 *
 * - `round-robin`: Cycle through sessions in order
 * - `least-loaded`: Pick session with fewest requests
 * - `least-errors`: Pick session with lowest error rate
 */
export type DistributionStrategy = 'round-robin' | 'least-loaded' | 'least-errors'

/**
 * Reason for a rate limit decision.
 *
 * - `ok`: No rate limiting, proceed immediately
 * - `delay-required`: Proceed after waiting
 * - `rate-limited`: Endpoint is currently rate limited
 * - `cooldown`: Session is on cooldown
 */
export type DecisionReason = 'ok' | 'delay-required' | 'rate-limited' | 'cooldown'

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Backoff configuration options.
 */
export interface BackoffConfig {
  /** Backoff algorithm to use. Default: 'exponential' */
  strategy?: BackoffStrategyType
  /** Initial delay in milliseconds. Default: 1000 */
  initialDelayMs?: number
  /** Maximum delay cap in milliseconds. Default: 60000 */
  maxDelayMs?: number
  /** Multiplier for exponential backoff. Default: 2 */
  multiplier?: number
  /** Add random jitter to prevent thundering herd. Default: true */
  jitter?: boolean
  /** Maximum retry attempts before giving up. Default: 5 */
  maxRetries?: number
}

/**
 * Session rotation configuration options.
 */
export interface SessionRotationConfig {
  /** Enable session rotation. Default: false */
  enabled?: boolean
  /** Cooldown duration for rate-limited sessions in ms. Default: 30000 */
  cooldownMs?: number
  /** Strategy for selecting next session. Default: 'round-robin' */
  distributionStrategy?: DistributionStrategy
}

/**
 * Integration configuration options.
 */
export interface IntegrationConfig {
  /** Honor Retry-After headers from server. Default: true */
  honorRetryAfter?: boolean
  /** Maximum Retry-After delay to honor in ms. Default: 120000 */
  maxRetryAfterMs?: number
}

/**
 * Main rate limit configuration.
 *
 * @example
 * ```typescript
 * const config: RateLimitConfig = {
 *   enabled: true,
 *   backoff: {
 *     strategy: 'exponential',
 *     initialDelayMs: 1000,
 *     maxRetries: 5
 *   },
 *   sessionRotation: {
 *     enabled: true,
 *     distributionStrategy: 'least-loaded'
 *   }
 * }
 * ```
 */
export interface RateLimitConfig {
  /** Enable rate limit handling. Default: true */
  enabled?: boolean
  /** Backoff configuration */
  backoff?: BackoffConfig
  /** Session rotation configuration */
  sessionRotation?: SessionRotationConfig
  /** Integration configuration */
  integration?: IntegrationConfig
}

/**
 * Resolved rate limit configuration with all defaults applied.
 */
export interface ResolvedRateLimitConfig {
  enabled: boolean
  backoff: Required<BackoffConfig>
  sessionRotation: Required<SessionRotationConfig>
  integration: Required<IntegrationConfig>
}

// ============================================================================
// State Types
// ============================================================================

/**
 * Per-endpoint rate limit state.
 *
 * Tracks the rate limit status and history for a specific endpoint pattern.
 */
export interface EndpointState {
  /** Normalized endpoint pattern (e.g., '/problems/*') */
  endpoint: string
  /** Total request count to this endpoint */
  hitCount: number
  /** Timestamp of last request */
  lastHitTime: number
  /** Whether endpoint is currently rate limited */
  isRateLimited: boolean
  /** Timestamp when rate limit expires (if rate limited) */
  rateLimitedUntil: number | undefined
  /** Server-specified retry delay in ms (from Retry-After header) */
  retryAfterMs: number | undefined
  /** Consecutive failure count for backoff calculation */
  consecutiveFailures: number
}

/**
 * Per-session information for rotation.
 */
export interface SessionInfo {
  /** Session identifier */
  id: string
  /** Total requests made with this session */
  requestCount: number
  /** Total errors/rate limits encountered */
  errorCount: number
  /** Timestamp when cooldown expires (if on cooldown) */
  cooldownUntil: number | undefined
  /** Timestamp of last request */
  lastRequestTime: number | undefined
}

// ============================================================================
// Decision Types
// ============================================================================

/**
 * Rate limit decision result.
 *
 * Returned by the manager to indicate whether a request should proceed,
 * any required delay, and which session to use.
 *
 * @example
 * ```typescript
 * const decision = manager.getDecision('/api/data', 'session-1')
 * if (decision.shouldProceed) {
 *   if (decision.delayMs > 0) {
 *     await sleep(decision.delayMs)
 *   }
 *   // Make request
 * }
 * ```
 */
export interface RateLimitDecision {
  /** Whether the request should proceed */
  shouldProceed: boolean
  /** Delay in milliseconds before proceeding (0 if none) */
  delayMs: number
  /** Recommended session to use (if rotation enabled) */
  recommendedSession: string | undefined
  /** Reason for the decision */
  reason: DecisionReason
}

// ============================================================================
// Function Types
// ============================================================================

/**
 * Backoff delay calculator function.
 *
 * Takes an attempt number (1-based) and returns the delay in milliseconds.
 */
export type BackoffCalculator = (attempt: number) => number
