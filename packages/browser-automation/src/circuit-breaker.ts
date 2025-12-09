import { BrowserError } from '@lesca/error'
import { logger } from '@lesca/shared/utils'

import type { CircuitState, CircuitBreakerStats } from './interfaces'

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number
  /** Time in ms to wait before trying again (half-open state) */
  resetTimeout: number
  /** Number of successful calls in half-open to close circuit */
  successThreshold: number
}

/**
 * Circuit Breaker
 *
 * Prevents cascading failures by temporarily blocking operations after repeated failures.
 * Implements the circuit breaker pattern to protect browser launch operations.
 *
 * ## States
 * - **Closed**: Normal operation, all calls pass through. Failures are counted.
 * - **Open**: Failures exceeded threshold, all calls are blocked immediately.
 * - **Half-Open**: Testing recovery. After reset timeout, limited calls are allowed.
 *
 * ## State Transitions
 * ```
 * ┌─────────┐  failures >= threshold  ┌────────┐
 * │ CLOSED  │ ─────────────────────►  │  OPEN  │
 * └─────────┘                         └────────┘
 *      ▲                                   │
 *      │                                   │ reset timeout
 *      │                                   ▼
 *      │   successes >= threshold    ┌───────────┐
 *      └──────────────────────────── │ HALF-OPEN │
 *                                    └───────────┘
 *                 any failure │
 *                             ▼
 *                         ┌────────┐
 *                         │  OPEN  │
 *                         └────────┘
 * ```
 *
 * ## Usage
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 3,   // Open after 3 failures
 *   resetTimeout: 30000,   // Try again after 30s
 *   successThreshold: 2    // Need 2 successes to close
 * });
 *
 * // Execute operations through the breaker
 * try {
 *   const result = await breaker.execute(async () => {
 *     return await launchBrowser();
 *   });
 * } catch (error) {
 *   if (error.code === 'BROWSER_CIRCUIT_OPEN') {
 *     // Circuit is open, operation was blocked
 *   }
 * }
 * ```
 *
 * @see {@link CircuitBreakerConfig} for configuration options
 * @see {@link CircuitState} for state types
 * @see {@link CircuitBreakerStats} for statistics structure
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failures = 0
  private successes = 0
  private lastFailureTime?: number
  private lastSuccessTime?: number
  private totalCalls = 0
  private totalFailures = 0
  private totalSuccesses = 0
  private config: Required<CircuitBreakerConfig>

  /**
   * Creates a new CircuitBreaker instance.
   *
   * @param config - Circuit breaker configuration
   * @param config.failureThreshold - Number of failures before opening (default: 5)
   * @param config.resetTimeout - Time in ms before trying again (default: 30000)
   * @param config.successThreshold - Successes needed in half-open to close (default: 2)
   *
   * @throws {BrowserError} If configuration values are invalid
   *
   * @example
   * ```typescript
   * const breaker = new CircuitBreaker({
   *   failureThreshold: 3,
   *   resetTimeout: 60000,
   *   successThreshold: 2
   * });
   * ```
   */
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 30000, // 30 seconds
      successThreshold: config.successThreshold ?? 2,
    }

    this.validateConfig()

    logger.debug('CircuitBreaker initialized', { config: this.config })
  }

  /**
   * Validate circuit breaker configuration
   */
  private validateConfig(): void {
    const { failureThreshold, resetTimeout, successThreshold } = this.config

    if (failureThreshold < 1) {
      throw new BrowserError(
        'BROWSER_POOL_CONFIG_INVALID',
        'Circuit breaker failureThreshold must be at least 1',
        { context: { failureThreshold } }
      )
    }

    if (resetTimeout < 1000) {
      throw new BrowserError(
        'BROWSER_POOL_CONFIG_INVALID',
        'Circuit breaker resetTimeout must be at least 1000ms',
        { context: { resetTimeout } }
      )
    }

    if (successThreshold < 1) {
      throw new BrowserError(
        'BROWSER_POOL_CONFIG_INVALID',
        'Circuit breaker successThreshold must be at least 1',
        { context: { successThreshold } }
      )
    }
  }

  /**
   * Executes a function through the circuit breaker.
   *
   * If the circuit is closed or half-open, the function is executed.
   * If the circuit is open, a BrowserError is thrown immediately.
   *
   * @typeParam T - Return type of the function
   * @param fn - The async function to execute
   *
   * @returns The result of the function
   *
   * @throws {BrowserError} BROWSER_CIRCUIT_OPEN - If circuit is open
   * @throws Any error thrown by the function (circuit records as failure)
   *
   * @example
   * ```typescript
   * const browser = await breaker.execute(async () => {
   *   return await chromium.launch();
   * });
   * ```
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++

    if (!this.canExecute()) {
      throw new BrowserError(
        'BROWSER_CIRCUIT_OPEN',
        `Circuit breaker is open. Too many failures (${this.failures}/${this.config.failureThreshold}). ` +
          `Will retry after ${this.getRemainingResetTime()}ms.`,
        {
          context: {
            state: this.state,
            failures: this.failures,
            failureThreshold: this.config.failureThreshold,
            resetTimeout: this.config.resetTimeout,
            remainingTime: this.getRemainingResetTime(),
          },
        }
      )
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  /**
   * Checks if the circuit currently allows execution.
   *
   * @returns True if operations can proceed, false if blocked
   *
   * @example
   * ```typescript
   * if (breaker.canExecute()) {
   *   // Safe to attempt operation
   * } else {
   *   // Circuit is open, operation would be blocked
   * }
   * ```
   */
  canExecute(): boolean {
    if (this.state === 'closed') {
      return true
    }

    if (this.state === 'open') {
      // Check if reset timeout has elapsed
      if (this.shouldTransitionToHalfOpen()) {
        this.transitionTo('half-open')
        return true
      }
      return false
    }

    // half-open state allows execution
    return true
  }

  /**
   * Record a successful call
   */
  private onSuccess(): void {
    this.totalSuccesses++
    this.lastSuccessTime = Date.now()

    if (this.state === 'half-open') {
      this.successes++
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('closed')
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success in closed state
      this.failures = 0
    }
  }

  /**
   * Record a failed call
   */
  private onFailure(): void {
    this.totalFailures++
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.state === 'half-open') {
      // Any failure in half-open immediately opens the circuit
      this.transitionTo('open')
    } else if (this.state === 'closed') {
      if (this.failures >= this.config.failureThreshold) {
        this.transitionTo('open')
      }
    }
  }

  /**
   * Check if circuit should transition from open to half-open
   */
  private shouldTransitionToHalfOpen(): boolean {
    if (!this.lastFailureTime) {
      return true
    }
    return Date.now() - this.lastFailureTime >= this.config.resetTimeout
  }

  /**
   * Get remaining time before circuit can transition to half-open
   */
  private getRemainingResetTime(): number {
    if (!this.lastFailureTime) {
      return 0
    }
    const elapsed = Date.now() - this.lastFailureTime
    return Math.max(0, this.config.resetTimeout - elapsed)
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const previousState = this.state
    this.state = newState

    if (newState === 'closed') {
      this.failures = 0
      this.successes = 0
    } else if (newState === 'half-open') {
      this.successes = 0
    }

    logger.info(`Circuit breaker state: ${previousState} -> ${newState}`, {
      failures: this.failures,
      totalCalls: this.totalCalls,
    })
  }

  /**
   * Gets the current circuit state.
   *
   * Note: This may trigger a state transition from open to half-open
   * if the reset timeout has elapsed.
   *
   * @returns The current circuit state ('closed', 'open', or 'half-open')
   *
   * @example
   * ```typescript
   * const state = breaker.getState();
   * if (state === 'open') {
   *   console.log('Circuit is open, operations are blocked');
   * }
   * ```
   */
  getState(): CircuitState {
    // Check for automatic transition to half-open
    if (this.state === 'open' && this.shouldTransitionToHalfOpen()) {
      this.transitionTo('half-open')
    }
    return this.state
  }

  /**
   * Gets circuit breaker statistics.
   *
   * @returns Statistics including state, failure counts, and timing information
   *
   * @example
   * ```typescript
   * const stats = breaker.getStats();
   * console.log(`State: ${stats.state}`);
   * console.log(`Failures: ${stats.totalFailures}/${stats.totalCalls}`);
   * ```
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    }
  }

  /**
   * Manually resets the circuit breaker to closed state.
   *
   * Use this for recovery scenarios where you know the underlying
   * issue has been resolved and want to restore normal operation.
   *
   * @example
   * ```typescript
   * // After fixing browser installation issues
   * breaker.reset();
   * ```
   */
  reset(): void {
    this.state = 'closed'
    this.failures = 0
    this.successes = 0
    logger.debug('Circuit breaker manually reset')
  }

  /**
   * Manually trips (opens) the circuit breaker.
   *
   * Use this to proactively block operations when you detect
   * issues that would cause failures.
   *
   * @example
   * ```typescript
   * // Detected system resource exhaustion
   * breaker.trip();
   * ```
   */
  trip(): void {
    this.lastFailureTime = Date.now()
    this.transitionTo('open')
    logger.warn('Circuit breaker manually tripped')
  }
}
