/**
 * Error Recovery Utilities
 *
 * Provides:
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - Error recovery helpers
 */

import { LescaError } from './errors.js'

/**
 * Retry options
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxAttempts?: number

  /**
   * Initial delay in milliseconds
   * @default 1000
   */
  initialDelay?: number

  /**
   * Backoff multiplier
   * @default 2
   */
  backoffMultiplier?: number

  /**
   * Maximum delay in milliseconds
   * @default 30000 (30 seconds)
   */
  maxDelay?: number

  /**
   * Add random jitter to delays
   * @default true
   */
  jitter?: boolean

  /**
   * Custom function to determine if error is retryable
   */
  isRetryable?: (error: Error) => boolean

  /**
   * Callback on each retry
   */
  onRetry?: (attempt: number, error: Error, delay: number) => void
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
    maxDelay = 30000,
    jitter = true,
    isRetryable = defaultIsRetryable,
    onRetry,
  } = options

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry if not retryable or if this was the last attempt
      if (!isRetryable(lastError) || attempt === maxAttempts) {
        throw lastError
      }

      // Calculate delay with exponential backoff
      let delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1)
      delay = Math.min(delay, maxDelay)

      // Add jitter to prevent thundering herd
      if (jitter) {
        delay = delay * (0.5 + Math.random() * 0.5)
      }

      // Call retry callback
      if (onRetry) {
        onRetry(attempt, lastError, delay)
      }

      // Wait before retrying
      await sleep(delay)
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Retry failed with unknown error')
}

/**
 * Default retry check - only retry recoverable LescaErrors
 */
function defaultIsRetryable(error: Error): boolean {
  if (error instanceof LescaError) {
    return error.isRecoverable()
  }
  // Default to retryable for non-LescaErrors
  return true
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /**
   * Number of failures before opening circuit
   * @default 5
   */
  failureThreshold?: number

  /**
   * Time in ms before attempting to close circuit
   * @default 60000 (1 minute)
   */
  resetTimeout?: number

  /**
   * Number of successful calls in half-open state to close circuit
   * @default 2
   */
  successThreshold?: number

  /**
   * Callback when circuit state changes
   */
  onStateChange?: (state: CircuitBreakerState) => void
}

/**
 * Circuit breaker to prevent cascading failures
 */
export class CircuitBreaker<T> {
  private state: CircuitBreakerState = 'closed'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime: number | undefined
  private readonly options: Required<CircuitBreakerOptions>

  constructor(
    private readonly fn: () => Promise<T>,
    options: CircuitBreakerOptions = {}
  ) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeout: options.resetTimeout ?? 60000,
      successThreshold: options.successThreshold ?? 2,
      onStateChange: options.onStateChange ?? (() => {}),
    }
  }

  /**
   * Execute the function with circuit breaker protection
   */
  async execute(): Promise<T> {
    // Check if circuit should move from open to half-open
    if (this.state === 'open') {
      const now = Date.now()
      if (
        this.lastFailureTime &&
        now - this.lastFailureTime >= this.options.resetTimeout
      ) {
        this.changeState('half-open')
      } else {
        throw new Error(
          `Circuit breaker is OPEN. Will retry in ${Math.ceil(
            (this.options.resetTimeout - (now - (this.lastFailureTime || 0))) /
              1000
          )} seconds.`
        )
      }
    }

    try {
      const result = await this.fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0

    if (this.state === 'half-open') {
      this.successCount++
      if (this.successCount >= this.options.successThreshold) {
        this.changeState('closed')
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === 'half-open') {
      this.changeState('open')
    } else if (
      this.state === 'closed' &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.changeState('open')
    }
  }

  /**
   * Change circuit state
   */
  private changeState(newState: CircuitBreakerState): void {
    if (newState !== this.state) {
      this.state = newState
      this.successCount = 0

      if (newState === 'closed') {
        this.failureCount = 0
      }

      this.options.onStateChange(newState)
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.changeState('closed')
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = undefined
  }
}

/**
 * Helper to create a circuit breaker for a function
 */
export function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  options?: CircuitBreakerOptions
): CircuitBreaker<T> {
  return new CircuitBreaker(fn, options)
}

/**
 * Combined retry with circuit breaker
 */
export async function withRetryAndCircuitBreaker<T>(
  fn: () => Promise<T>,
  retryOptions?: RetryOptions,
  circuitBreakerOptions?: CircuitBreakerOptions
): Promise<T> {
  const breaker = withCircuitBreaker(fn, circuitBreakerOptions)

  return withRetry(() => breaker.execute(), retryOptions)
}

/**
 * Timeout a promise
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

/**
 * Retry specific error codes
 */
export function createRetryableCheck(
  retryableCodes: string[]
): (error: Error) => boolean {
  return (error: Error) => {
    if (error instanceof LescaError) {
      return retryableCodes.includes(error.code)
    }
    return false
  }
}
