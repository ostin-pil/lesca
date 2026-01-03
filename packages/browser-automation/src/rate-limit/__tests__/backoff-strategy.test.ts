/**
 * Backoff Strategy Tests
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  createBackoffStrategy,
  exponentialBackoff,
  linearBackoff,
  fibonacciBackoff,
  constantBackoff,
  applyJitter,
  capDelay,
  resolveBackoffConfig,
  DEFAULT_BACKOFF_CONFIG,
} from '../backoff-strategy'

describe('backoff-strategy', () => {
  describe('resolveBackoffConfig', () => {
    it('should return defaults when no config provided', () => {
      const config = resolveBackoffConfig()

      expect(config).toEqual(DEFAULT_BACKOFF_CONFIG)
    })

    it('should merge partial config with defaults', () => {
      const config = resolveBackoffConfig({
        strategy: 'linear',
        initialDelayMs: 500,
      })

      expect(config.strategy).toBe('linear')
      expect(config.initialDelayMs).toBe(500)
      expect(config.maxDelayMs).toBe(DEFAULT_BACKOFF_CONFIG.maxDelayMs)
      expect(config.multiplier).toBe(DEFAULT_BACKOFF_CONFIG.multiplier)
    })
  })

  describe('exponentialBackoff', () => {
    const config = resolveBackoffConfig({
      initialDelayMs: 1000,
      multiplier: 2,
    })

    it('should return initialDelay for attempt 1', () => {
      expect(exponentialBackoff(1, config)).toBe(1000)
    })

    it('should double delay for each attempt', () => {
      expect(exponentialBackoff(2, config)).toBe(2000)
      expect(exponentialBackoff(3, config)).toBe(4000)
      expect(exponentialBackoff(4, config)).toBe(8000)
    })

    it('should handle attempt 0 or negative', () => {
      expect(exponentialBackoff(0, config)).toBe(1000)
      expect(exponentialBackoff(-1, config)).toBe(1000)
    })

    it('should use custom multiplier', () => {
      const config3x = resolveBackoffConfig({
        initialDelayMs: 1000,
        multiplier: 3,
      })

      expect(exponentialBackoff(2, config3x)).toBe(3000)
      expect(exponentialBackoff(3, config3x)).toBe(9000)
    })
  })

  describe('linearBackoff', () => {
    const config = resolveBackoffConfig({ initialDelayMs: 1000 })

    it('should return initialDelay for attempt 1', () => {
      expect(linearBackoff(1, config)).toBe(1000)
    })

    it('should increase linearly', () => {
      expect(linearBackoff(2, config)).toBe(2000)
      expect(linearBackoff(3, config)).toBe(3000)
      expect(linearBackoff(4, config)).toBe(4000)
      expect(linearBackoff(5, config)).toBe(5000)
    })

    it('should handle attempt 0 or negative', () => {
      expect(linearBackoff(0, config)).toBe(1000)
      expect(linearBackoff(-1, config)).toBe(1000)
    })
  })

  describe('fibonacciBackoff', () => {
    const config = resolveBackoffConfig({ initialDelayMs: 1000 })

    it('should return initialDelay for attempt 1', () => {
      expect(fibonacciBackoff(1, config)).toBe(1000)
    })

    it('should follow fibonacci sequence', () => {
      // fib sequence: 1, 1, 2, 3, 5, 8, 13...
      expect(fibonacciBackoff(1, config)).toBe(1000) // fib(1) = 1
      expect(fibonacciBackoff(2, config)).toBe(1000) // fib(2) = 1
      expect(fibonacciBackoff(3, config)).toBe(2000) // fib(3) = 2
      expect(fibonacciBackoff(4, config)).toBe(3000) // fib(4) = 3
      expect(fibonacciBackoff(5, config)).toBe(5000) // fib(5) = 5
      expect(fibonacciBackoff(6, config)).toBe(8000) // fib(6) = 8
    })

    it('should handle attempt 0 or negative', () => {
      expect(fibonacciBackoff(0, config)).toBe(1000)
      expect(fibonacciBackoff(-1, config)).toBe(1000)
    })
  })

  describe('constantBackoff', () => {
    const config = resolveBackoffConfig({ initialDelayMs: 5000 })

    it('should always return initialDelay', () => {
      expect(constantBackoff(1, config)).toBe(5000)
      expect(constantBackoff(2, config)).toBe(5000)
      expect(constantBackoff(10, config)).toBe(5000)
      expect(constantBackoff(100, config)).toBe(5000)
    })
  })

  describe('applyJitter', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random')
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return 50% of delay when random is 0', () => {
      vi.mocked(Math.random).mockReturnValue(0)

      expect(applyJitter(1000)).toBe(500)
    })

    it('should return 100% of delay when random is 1', () => {
      vi.mocked(Math.random).mockReturnValue(1)

      expect(applyJitter(1000)).toBe(1000)
    })

    it('should return value in range [50%, 100%] of delay', () => {
      vi.mocked(Math.random).mockReturnValue(0.5)

      expect(applyJitter(1000)).toBe(750)
    })
  })

  describe('capDelay', () => {
    it('should return delay when under max', () => {
      expect(capDelay(1000, 5000)).toBe(1000)
    })

    it('should return max when delay exceeds max', () => {
      expect(capDelay(10000, 5000)).toBe(5000)
    })

    it('should return delay when equal to max', () => {
      expect(capDelay(5000, 5000)).toBe(5000)
    })
  })

  describe('createBackoffStrategy', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random')
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should create exponential strategy by default', () => {
      vi.mocked(Math.random).mockReturnValue(1) // No jitter reduction

      const backoff = createBackoffStrategy({ jitter: false })

      expect(backoff(1)).toBe(1000)
      expect(backoff(2)).toBe(2000)
      expect(backoff(3)).toBe(4000)
    })

    it('should create linear strategy', () => {
      vi.mocked(Math.random).mockReturnValue(1)

      const backoff = createBackoffStrategy({
        strategy: 'linear',
        initialDelayMs: 1000,
        jitter: false,
      })

      expect(backoff(1)).toBe(1000)
      expect(backoff(2)).toBe(2000)
      expect(backoff(3)).toBe(3000)
    })

    it('should create fibonacci strategy', () => {
      vi.mocked(Math.random).mockReturnValue(1)

      const backoff = createBackoffStrategy({
        strategy: 'fibonacci',
        initialDelayMs: 1000,
        jitter: false,
      })

      expect(backoff(1)).toBe(1000)
      expect(backoff(2)).toBe(1000)
      expect(backoff(3)).toBe(2000)
      expect(backoff(4)).toBe(3000)
      expect(backoff(5)).toBe(5000)
    })

    it('should create constant strategy', () => {
      vi.mocked(Math.random).mockReturnValue(1)

      const backoff = createBackoffStrategy({
        strategy: 'constant',
        initialDelayMs: 2000,
        jitter: false,
      })

      expect(backoff(1)).toBe(2000)
      expect(backoff(5)).toBe(2000)
      expect(backoff(10)).toBe(2000)
    })

    it('should apply jitter when enabled', () => {
      vi.mocked(Math.random).mockReturnValue(0) // Minimum jitter

      const backoff = createBackoffStrategy({
        strategy: 'exponential',
        initialDelayMs: 1000,
        jitter: true,
      })

      // With jitter at 0, should be 50% of calculated delay
      expect(backoff(1)).toBe(500)
    })

    it('should cap delay at maxDelayMs', () => {
      vi.mocked(Math.random).mockReturnValue(1)

      const backoff = createBackoffStrategy({
        strategy: 'exponential',
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        jitter: false,
      })

      // attempt 4: 1000 * 2^3 = 8000, but capped at 5000
      expect(backoff(4)).toBe(5000)
      expect(backoff(10)).toBe(5000)
    })

    it('should return integer values', () => {
      vi.mocked(Math.random).mockReturnValue(0.3)

      const backoff = createBackoffStrategy({
        initialDelayMs: 1000,
        jitter: true,
      })

      const delay = backoff(1)
      expect(Number.isInteger(delay)).toBe(true)
    })
  })
})
