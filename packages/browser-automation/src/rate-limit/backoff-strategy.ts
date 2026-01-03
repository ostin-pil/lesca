/**
 * Backoff Strategy Implementation
 *
 * Provides configurable backoff strategies for rate limit retry logic.
 * Supports exponential, linear, fibonacci, and constant backoff algorithms.
 *
 * @module browser-automation/rate-limit/backoff-strategy
 */

import type { BackoffCalculator, BackoffConfig, BackoffStrategyType } from './types'

// ============================================================================
// Default Configuration
// ============================================================================

/** Default backoff configuration values */
export const DEFAULT_BACKOFF_CONFIG: Required<BackoffConfig> = {
  strategy: 'exponential',
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  multiplier: 2,
  jitter: true,
  maxRetries: 5,
}

/**
 * Resolve backoff configuration with defaults.
 *
 * @param config - Partial configuration
 * @returns Fully resolved configuration
 */
export function resolveBackoffConfig(config?: BackoffConfig): Required<BackoffConfig> {
  return {
    strategy: config?.strategy ?? DEFAULT_BACKOFF_CONFIG.strategy,
    initialDelayMs: config?.initialDelayMs ?? DEFAULT_BACKOFF_CONFIG.initialDelayMs,
    maxDelayMs: config?.maxDelayMs ?? DEFAULT_BACKOFF_CONFIG.maxDelayMs,
    multiplier: config?.multiplier ?? DEFAULT_BACKOFF_CONFIG.multiplier,
    jitter: config?.jitter ?? DEFAULT_BACKOFF_CONFIG.jitter,
    maxRetries: config?.maxRetries ?? DEFAULT_BACKOFF_CONFIG.maxRetries,
  }
}

// ============================================================================
// Backoff Algorithms
// ============================================================================

/**
 * Calculate exponential backoff delay.
 *
 * Formula: initialDelay * multiplier^(attempt - 1)
 *
 * @example
 * // With initialDelay=1000, multiplier=2:
 * // attempt 1: 1000ms
 * // attempt 2: 2000ms
 * // attempt 3: 4000ms
 * // attempt 4: 8000ms
 *
 * @param attempt - Attempt number (1-based)
 * @param config - Backoff configuration
 * @returns Delay in milliseconds
 */
export function exponentialBackoff(attempt: number, config: Required<BackoffConfig>): number {
  if (attempt <= 0) return config.initialDelayMs
  return config.initialDelayMs * Math.pow(config.multiplier, attempt - 1)
}

/**
 * Calculate linear backoff delay.
 *
 * Formula: initialDelay * attempt
 *
 * @example
 * // With initialDelay=1000:
 * // attempt 1: 1000ms
 * // attempt 2: 2000ms
 * // attempt 3: 3000ms
 * // attempt 4: 4000ms
 *
 * @param attempt - Attempt number (1-based)
 * @param config - Backoff configuration
 * @returns Delay in milliseconds
 */
export function linearBackoff(attempt: number, config: Required<BackoffConfig>): number {
  if (attempt <= 0) return config.initialDelayMs
  return config.initialDelayMs * attempt
}

/**
 * Generate fibonacci number at position n.
 * Uses iterative approach to avoid stack overflow.
 *
 * @param n - Position in fibonacci sequence (0-indexed)
 * @returns Fibonacci number
 */
function fibonacci(n: number): number {
  if (n <= 0) return 0
  if (n === 1) return 1

  let prev = 0
  let curr = 1
  for (let i = 2; i <= n; i++) {
    const next = prev + curr
    prev = curr
    curr = next
  }
  return curr
}

/**
 * Calculate fibonacci backoff delay.
 *
 * Formula: initialDelay * fib(attempt)
 *
 * @example
 * // With initialDelay=1000:
 * // attempt 1: 1000ms (fib=1)
 * // attempt 2: 1000ms (fib=1)
 * // attempt 3: 2000ms (fib=2)
 * // attempt 4: 3000ms (fib=3)
 * // attempt 5: 5000ms (fib=5)
 *
 * @param attempt - Attempt number (1-based)
 * @param config - Backoff configuration
 * @returns Delay in milliseconds
 */
export function fibonacciBackoff(attempt: number, config: Required<BackoffConfig>): number {
  if (attempt <= 0) return config.initialDelayMs
  return config.initialDelayMs * fibonacci(attempt)
}

/**
 * Calculate constant backoff delay.
 *
 * Always returns the initial delay regardless of attempt number.
 *
 * @param _attempt - Attempt number (ignored)
 * @param config - Backoff configuration
 * @returns Delay in milliseconds
 */
export function constantBackoff(_attempt: number, config: Required<BackoffConfig>): number {
  return config.initialDelayMs
}

// ============================================================================
// Jitter & Capping
// ============================================================================

/**
 * Apply jitter to a delay value.
 *
 * Randomizes the delay between 50% and 100% of the original value
 * to prevent "thundering herd" when multiple clients retry simultaneously.
 *
 * @param delay - Original delay in milliseconds
 * @returns Jittered delay
 */
export function applyJitter(delay: number): number {
  return delay * (0.5 + Math.random() * 0.5)
}

/**
 * Cap delay at maximum value.
 *
 * @param delay - Delay to cap
 * @param maxDelay - Maximum allowed delay
 * @returns Capped delay
 */
export function capDelay(delay: number, maxDelay: number): number {
  return Math.min(delay, maxDelay)
}

// ============================================================================
// Strategy Factory
// ============================================================================

/**
 * Get the raw backoff function for a strategy type.
 *
 * @param strategy - Strategy type
 * @returns Backoff function
 */
function getBackoffFunction(
  strategy: BackoffStrategyType
): (attempt: number, config: Required<BackoffConfig>) => number {
  switch (strategy) {
    case 'exponential':
      return exponentialBackoff
    case 'linear':
      return linearBackoff
    case 'fibonacci':
      return fibonacciBackoff
    case 'constant':
      return constantBackoff
  }
}

/**
 * Create a backoff calculator function with the given configuration.
 *
 * Returns a function that takes an attempt number and returns the delay
 * in milliseconds, with jitter and max delay applied as configured.
 *
 * @example
 * ```typescript
 * const backoff = createBackoffStrategy({
 *   strategy: 'exponential',
 *   initialDelayMs: 1000,
 *   maxDelayMs: 30000,
 *   jitter: true
 * })
 *
 * console.log(backoff(1)) // ~500-1000ms
 * console.log(backoff(2)) // ~1000-2000ms
 * console.log(backoff(3)) // ~2000-4000ms
 * ```
 *
 * @param config - Backoff configuration
 * @returns Backoff calculator function
 */
export function createBackoffStrategy(config?: BackoffConfig): BackoffCalculator {
  const resolvedConfig = resolveBackoffConfig(config)
  const backoffFn = getBackoffFunction(resolvedConfig.strategy)

  return (attempt: number): number => {
    // Calculate base delay
    let delay = backoffFn(attempt, resolvedConfig)

    // Cap at max delay
    delay = capDelay(delay, resolvedConfig.maxDelayMs)

    // Apply jitter if enabled
    if (resolvedConfig.jitter) {
      delay = applyJitter(delay)
    }

    return Math.floor(delay)
  }
}
