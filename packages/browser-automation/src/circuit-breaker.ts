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
 * Prevents cascading failures by temporarily blocking operations after repeated failures
 *
 * States:
 * - closed: Normal operation, calls pass through
 * - open: Failures exceeded threshold, calls are blocked
 * - half-open: Testing if service recovered, limited calls allowed
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
   * Execute a function through the circuit breaker
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
   * Check if circuit allows execution
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
   * Get current state
   */
  getState(): CircuitState {
    // Check for automatic transition to half-open
    if (this.state === 'open' && this.shouldTransitionToHalfOpen()) {
      this.transitionTo('half-open')
    }
    return this.state
  }

  /**
   * Get statistics
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
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = 'closed'
    this.failures = 0
    this.successes = 0
    logger.debug('Circuit breaker manually reset')
  }

  /**
   * Manually trip the circuit breaker (force open)
   */
  trip(): void {
    this.lastFailureTime = Date.now()
    this.transitionTo('open')
    logger.warn('Circuit breaker manually tripped')
  }
}
