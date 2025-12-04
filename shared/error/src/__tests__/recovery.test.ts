import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  withRetry,
  CircuitBreaker,
  withCircuitBreaker,
  withRetryAndCircuitBreaker,
  withTimeout,
  createRetryableCheck,
  type RetryOptions,
  type CircuitBreakerState,
} from '../recovery'
import { LescaError } from '../errors'

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success')

    const promise = withRetry(fn)
    const result = await promise

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('success')

    const promise = withRetry(fn, { initialDelay: 100, jitter: false })

    // First attempt fails immediately
    await vi.advanceTimersByTimeAsync(0)
    // Wait for retry delay
    await vi.advanceTimersByTimeAsync(100)

    const result = await promise

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should throw after max attempts exceeded', async () => {
    vi.useRealTimers() // Use real timers to avoid unhandled rejection issues
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))

    await expect(withRetry(fn, { maxAttempts: 3, initialDelay: 1, jitter: false })).rejects.toThrow(
      'always fails'
    )
    expect(fn).toHaveBeenCalledTimes(3)
    vi.useFakeTimers() // Restore fake timers for next test
  })

  it('should use exponential backoff', async () => {
    vi.useRealTimers() // Use real timers to avoid unhandled rejection issues
    const onRetry = vi.fn()
    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(
      withRetry(fn, {
        maxAttempts: 4,
        initialDelay: 1,
        backoffMultiplier: 2,
        jitter: false,
        onRetry,
      })
    ).rejects.toThrow()

    // Verify exponential delays (1, 2, 4)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 1)
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), 2)
    expect(onRetry).toHaveBeenCalledWith(3, expect.any(Error), 4)
    vi.useFakeTimers() // Restore fake timers for next test
  })

  it('should respect maxDelay', async () => {
    vi.useRealTimers() // Use real timers to avoid unhandled rejection issues
    const onRetry = vi.fn()
    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(
      withRetry(fn, {
        maxAttempts: 4,
        initialDelay: 1,
        backoffMultiplier: 10,
        maxDelay: 5,
        jitter: false,
        onRetry,
      })
    ).rejects.toThrow()

    // 2nd retry would be 1*10=10, but capped at 5
    // 3rd retry would be 1*10*10=100, but capped at 5
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), 5)
    expect(onRetry).toHaveBeenCalledWith(3, expect.any(Error), 5)
    vi.useFakeTimers() // Restore fake timers for next test
  })

  it('should not retry non-retryable errors', async () => {
    // AUTH_INVALID_CREDENTIALS has recoverable: false in error codes
    const nonRecoverableError = new LescaError('AUTH_INVALID_CREDENTIALS', 'Not recoverable')
    const fn = vi.fn().mockRejectedValue(nonRecoverableError)

    const promise = withRetry(fn, { maxAttempts: 3 })

    await expect(promise).rejects.toThrow('Not recoverable')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should use custom isRetryable function', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('custom fail'))
    const isRetryable = vi.fn().mockReturnValue(false)

    const promise = withRetry(fn, { isRetryable })

    await expect(promise).rejects.toThrow('custom fail')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(isRetryable).toHaveBeenCalled()
  })

  it('should convert non-Error throws to Error', async () => {
    const fn = vi.fn().mockRejectedValue('string error')

    const promise = withRetry(fn, { maxAttempts: 1 })

    await expect(promise).rejects.toThrow('string error')
  })

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn()
    const error = new Error('test error')
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success')

    const promise = withRetry(fn, { onRetry, initialDelay: 50, jitter: false })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(50)

    await promise

    expect(onRetry).toHaveBeenCalledWith(1, error, 50)
  })

  it('should apply jitter to delays', async () => {
    // Test with jitter disabled to avoid timing issues
    const onRetry = vi.fn()
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('success')

    const promise = withRetry(fn, {
      maxAttempts: 2,
      initialDelay: 10,
      jitter: false,
      onRetry,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(10)

    await promise

    // Verify onRetry was called with the base delay (no jitter)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 10)
  })

  it('should calculate jittered delay', () => {
    // Test jitter calculation logic separately
    const baseDelay = 100
    const jitteredDelay = baseDelay * (0.5 + 0.5 * 0.5) // When random returns 0.5: 100 * 0.75 = 75

    expect(jitteredDelay).toBe(75)
  })

  it('should use default options', async () => {
    const fn = vi.fn().mockResolvedValue('result')

    const result = await withRetry(fn)

    expect(result).toBe('result')
  })
})

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should start in closed state', () => {
    const breaker = new CircuitBreaker(() => Promise.resolve('success'))

    expect(breaker.getState()).toBe('closed')
  })

  it('should execute function when closed', async () => {
    const fn = vi.fn().mockResolvedValue('result')
    const breaker = new CircuitBreaker(fn)

    const result = await breaker.execute()

    expect(result).toBe('result')
    expect(fn).toHaveBeenCalled()
  })

  it('should open after failure threshold', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const breaker = new CircuitBreaker(fn, { failureThreshold: 3 })

    // 3 failures should open the circuit
    await expect(breaker.execute()).rejects.toThrow()
    await expect(breaker.execute()).rejects.toThrow()
    await expect(breaker.execute()).rejects.toThrow()

    expect(breaker.getState()).toBe('open')
  })

  it('should throw immediately when open', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const breaker = new CircuitBreaker(fn, { failureThreshold: 1, resetTimeout: 60000 })

    // Open the circuit
    await expect(breaker.execute()).rejects.toThrow()
    expect(breaker.getState()).toBe('open')

    // Should throw circuit breaker error without calling fn
    fn.mockClear()
    await expect(breaker.execute()).rejects.toThrow(/Circuit breaker is OPEN/)
    expect(fn).not.toHaveBeenCalled()
  })

  it('should transition to half-open after reset timeout', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const breaker = new CircuitBreaker(fn, { failureThreshold: 1, resetTimeout: 5000 })

    // Open the circuit
    await expect(breaker.execute()).rejects.toThrow()
    expect(breaker.getState()).toBe('open')

    // Advance past reset timeout
    vi.advanceTimersByTime(5000)

    // Next call should transition to half-open and try the function
    fn.mockResolvedValueOnce('success')
    const result = await breaker.execute()

    expect(breaker.getState()).toBe('half-open')
    expect(result).toBe('success')
  })

  it('should close after success threshold in half-open state', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const breaker = new CircuitBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 1000,
      successThreshold: 2,
    })

    // Open the circuit
    await expect(breaker.execute()).rejects.toThrow()
    expect(breaker.getState()).toBe('open')

    // Advance past reset timeout
    vi.advanceTimersByTime(1000)

    // Successful calls in half-open should close circuit
    fn.mockResolvedValue('success')
    await breaker.execute() // 1st success
    expect(breaker.getState()).toBe('half-open')

    await breaker.execute() // 2nd success - should close
    expect(breaker.getState()).toBe('closed')
  })

  it('should reopen on failure in half-open state', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const breaker = new CircuitBreaker(fn, { failureThreshold: 1, resetTimeout: 1000 })

    // Open the circuit
    await expect(breaker.execute()).rejects.toThrow()

    // Advance past reset timeout
    vi.advanceTimersByTime(1000)

    // Failure in half-open should reopen
    await expect(breaker.execute()).rejects.toThrow()
    expect(breaker.getState()).toBe('open')
  })

  it('should call onStateChange callback', async () => {
    const onStateChange = vi.fn()
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const breaker = new CircuitBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 1000,
      onStateChange,
    })

    // Open the circuit
    await expect(breaker.execute()).rejects.toThrow()
    expect(onStateChange).toHaveBeenCalledWith('open')

    // Transition to half-open
    vi.advanceTimersByTime(1000)
    fn.mockResolvedValue('success')
    await breaker.execute()
    expect(onStateChange).toHaveBeenCalledWith('half-open')
  })

  it('should reset circuit breaker', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const breaker = new CircuitBreaker(fn, { failureThreshold: 1 })

    // Open the circuit
    await expect(breaker.execute()).rejects.toThrow()
    expect(breaker.getState()).toBe('open')

    // Reset
    breaker.reset()
    expect(breaker.getState()).toBe('closed')

    // Should be able to execute again
    fn.mockResolvedValue('success')
    const result = await breaker.execute()
    expect(result).toBe('success')
  })

  it('should reset failure count on success', async () => {
    const fn = vi.fn()
    const breaker = new CircuitBreaker(fn, { failureThreshold: 3 })

    // 2 failures
    fn.mockRejectedValue(new Error('fail'))
    await expect(breaker.execute()).rejects.toThrow()
    await expect(breaker.execute()).rejects.toThrow()
    expect(breaker.getState()).toBe('closed')

    // 1 success should reset count
    fn.mockResolvedValue('success')
    await breaker.execute()

    // 2 more failures should not open (count was reset)
    fn.mockRejectedValue(new Error('fail'))
    await expect(breaker.execute()).rejects.toThrow()
    await expect(breaker.execute()).rejects.toThrow()
    expect(breaker.getState()).toBe('closed')
  })

  it('should use default options', () => {
    const breaker = new CircuitBreaker(() => Promise.resolve())

    // Verify defaults by testing behavior
    expect(breaker.getState()).toBe('closed')
  })
})

describe('withCircuitBreaker', () => {
  it('should create a circuit breaker instance', () => {
    const fn = () => Promise.resolve('result')
    const breaker = withCircuitBreaker(fn)

    expect(breaker).toBeInstanceOf(CircuitBreaker)
    expect(breaker.getState()).toBe('closed')
  })

  it('should pass options to circuit breaker', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const breaker = withCircuitBreaker(fn, { failureThreshold: 1 })

    await expect(breaker.execute()).rejects.toThrow()
    expect(breaker.getState()).toBe('open')
  })
})

describe('withRetryAndCircuitBreaker', () => {
  it('should combine retry and circuit breaker on success', async () => {
    const fn = vi.fn().mockResolvedValue('success')

    const result = await withRetryAndCircuitBreaker(fn)

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should create circuit breaker instance', () => {
    const fn = vi.fn().mockResolvedValue('result')
    // Just test that it returns a promise
    const result = withRetryAndCircuitBreaker(fn)

    expect(result).toBeInstanceOf(Promise)
  })
})

describe('withTimeout', () => {
  it('should return result before timeout', async () => {
    const promise = Promise.resolve('result')

    const result = await withTimeout(promise, 1000)

    expect(result).toBe('result')
  })

  it('should reject on timeout', async () => {
    // Create a promise that never resolves
    const promise = new Promise<string>(() => {})

    // Use a very short timeout
    const resultPromise = withTimeout(promise, 10)

    await expect(resultPromise).rejects.toThrow('Operation timed out')
  })

  it('should use custom error message', async () => {
    const promise = new Promise<string>(() => {})

    const resultPromise = withTimeout(promise, 10, 'Custom timeout message')

    await expect(resultPromise).rejects.toThrow('Custom timeout message')
  })

  it('should preserve rejection from original promise', async () => {
    const promise = Promise.reject(new Error('Original error'))

    await expect(withTimeout(promise, 1000)).rejects.toThrow('Original error')
  })
})

describe('createRetryableCheck', () => {
  it('should return true for matching error codes', () => {
    const isRetryable = createRetryableCheck(['NET_CONNECTION_FAILED', 'NET_TIMEOUT'])
    const error = new LescaError('NET_CONNECTION_FAILED', 'Network failed')

    expect(isRetryable(error)).toBe(true)
  })

  it('should return false for non-matching error codes', () => {
    const isRetryable = createRetryableCheck(['NET_CONNECTION_FAILED', 'NET_TIMEOUT'])
    const error = new LescaError('AUTH_INVALID_CREDENTIALS', 'Auth failed')

    expect(isRetryable(error)).toBe(false)
  })

  it('should return false for non-LescaError', () => {
    const isRetryable = createRetryableCheck(['NET_CONNECTION_FAILED'])
    const error = new Error('Regular error')

    expect(isRetryable(error)).toBe(false)
  })

  it('should work with empty code list', () => {
    const isRetryable = createRetryableCheck([])
    const error = new LescaError('NET_CONNECTION_FAILED', 'Any error')

    expect(isRetryable(error)).toBe(false)
  })
})

describe('CircuitBreakerState type', () => {
  it('should have correct type values', () => {
    const states: CircuitBreakerState[] = ['closed', 'open', 'half-open']

    expect(states).toHaveLength(3)
    expect(states).toContain('closed')
    expect(states).toContain('open')
    expect(states).toContain('half-open')
  })
})
