import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CircuitBreaker } from '../circuit-breaker'
import { BrowserError } from '@lesca/error'

vi.mock('@lesca/shared/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker

  beforeEach(() => {
    vi.useFakeTimers()
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000,
      successThreshold: 2,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('configuration validation', () => {
    it('should throw on failureThreshold < 1', () => {
      expect(() => new CircuitBreaker({ failureThreshold: 0 })).toThrow(BrowserError)
      expect(() => new CircuitBreaker({ failureThreshold: 0 })).toThrow(
        'failureThreshold must be at least 1'
      )
    })

    it('should throw on resetTimeout < 1000', () => {
      expect(() => new CircuitBreaker({ resetTimeout: 500 })).toThrow(BrowserError)
      expect(() => new CircuitBreaker({ resetTimeout: 500 })).toThrow(
        'resetTimeout must be at least 1000ms'
      )
    })

    it('should throw on successThreshold < 1', () => {
      expect(() => new CircuitBreaker({ successThreshold: 0 })).toThrow(BrowserError)
      expect(() => new CircuitBreaker({ successThreshold: 0 })).toThrow(
        'successThreshold must be at least 1'
      )
    })

    it('should accept valid configuration', () => {
      expect(
        () =>
          new CircuitBreaker({
            failureThreshold: 5,
            resetTimeout: 60000,
            successThreshold: 3,
          })
      ).not.toThrow()
    })

    it('should use defaults for missing config', () => {
      const cb = new CircuitBreaker({})
      const stats = cb.getStats()
      expect(stats.state).toBe('closed')
    })
  })

  describe('closed state', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.getState()).toBe('closed')
    })

    it('should allow execution in closed state', async () => {
      const result = await circuitBreaker.execute(async () => 'success')
      expect(result).toBe('success')
    })

    it('should remain closed on success', async () => {
      await circuitBreaker.execute(async () => 'success')
      expect(circuitBreaker.getState()).toBe('closed')
    })

    it('should count failures', async () => {
      const error = new Error('fail')
      try {
        await circuitBreaker.execute(async () => {
          throw error
        })
      } catch {
        // expected
      }

      const stats = circuitBreaker.getStats()
      expect(stats.failures).toBe(1)
    })

    it('should open after failureThreshold failures', async () => {
      const error = new Error('fail')

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw error
          })
        } catch {
          // expected
        }
      }

      expect(circuitBreaker.getState()).toBe('open')
    })

    it('should reset failures on success', async () => {
      const error = new Error('fail')

      // 2 failures
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw error
          })
        } catch {
          // expected
        }
      }

      // 1 success
      await circuitBreaker.execute(async () => 'success')

      const stats = circuitBreaker.getStats()
      expect(stats.failures).toBe(0)
      expect(circuitBreaker.getState()).toBe('closed')
    })
  })

  describe('open state', () => {
    beforeEach(async () => {
      // Get to open state
      const error = new Error('fail')
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw error
          })
        } catch {
          // expected
        }
      }
    })

    it('should reject execution in open state', async () => {
      await expect(circuitBreaker.execute(async () => 'success')).rejects.toThrow(BrowserError)
      await expect(circuitBreaker.execute(async () => 'success')).rejects.toThrow(
        'Circuit breaker is open'
      )
    })

    it('should include failure count in error', async () => {
      try {
        await circuitBreaker.execute(async () => 'success')
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('BROWSER_CIRCUIT_OPEN')
          expect(error.context).toMatchObject({
            state: 'open',
            failures: 3,
          })
        }
      }
    })

    it('should transition to half-open after resetTimeout', async () => {
      vi.advanceTimersByTime(30000)
      expect(circuitBreaker.getState()).toBe('half-open')
    })

    it('should allow execution after resetTimeout', async () => {
      vi.advanceTimersByTime(30000)
      const result = await circuitBreaker.execute(async () => 'success')
      expect(result).toBe('success')
    })
  })

  describe('half-open state', () => {
    beforeEach(async () => {
      // Get to open state then half-open
      const error = new Error('fail')
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw error
          })
        } catch {
          // expected
        }
      }
      vi.advanceTimersByTime(30000)
    })

    it('should be in half-open state', () => {
      expect(circuitBreaker.getState()).toBe('half-open')
    })

    it('should return to open on failure', async () => {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('fail')
        })
      } catch {
        // expected
      }

      expect(circuitBreaker.getState()).toBe('open')
    })

    it('should close after successThreshold successes', async () => {
      await circuitBreaker.execute(async () => 'success')
      expect(circuitBreaker.getState()).toBe('half-open')

      await circuitBreaker.execute(async () => 'success')
      expect(circuitBreaker.getState()).toBe('closed')
    })

    it('should reset success count on transition to open', async () => {
      await circuitBreaker.execute(async () => 'success')

      try {
        await circuitBreaker.execute(async () => {
          throw new Error('fail')
        })
      } catch {
        // expected
      }

      expect(circuitBreaker.getState()).toBe('open')

      vi.advanceTimersByTime(30000)
      expect(circuitBreaker.getState()).toBe('half-open')

      // Need 2 successes again
      const stats = circuitBreaker.getStats()
      expect(stats.successes).toBe(0)
    })
  })

  describe('manual controls', () => {
    it('should reset to closed state', async () => {
      // Get to open state
      const error = new Error('fail')
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw error
          })
        } catch {
          // expected
        }
      }

      circuitBreaker.reset()

      expect(circuitBreaker.getState()).toBe('closed')
      const stats = circuitBreaker.getStats()
      expect(stats.failures).toBe(0)
      expect(stats.successes).toBe(0)
    })

    it('should manually trip circuit', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      circuitBreaker.trip()
      // State is open immediately after tripping (before resetTimeout passes)
      expect(circuitBreaker.getState()).toBe('open')
    })
  })

  describe('statistics', () => {
    it('should track total calls', async () => {
      await circuitBreaker.execute(async () => 'success')
      await circuitBreaker.execute(async () => 'success')

      const stats = circuitBreaker.getStats()
      expect(stats.totalCalls).toBe(2)
    })

    it('should track total successes', async () => {
      await circuitBreaker.execute(async () => 'success')
      await circuitBreaker.execute(async () => 'success')

      const stats = circuitBreaker.getStats()
      expect(stats.totalSuccesses).toBe(2)
    })

    it('should track total failures', async () => {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('fail')
        })
      } catch {
        // expected
      }

      const stats = circuitBreaker.getStats()
      expect(stats.totalFailures).toBe(1)
    })

    it('should track last failure time', async () => {
      const now = Date.now()
      vi.setSystemTime(now)

      try {
        await circuitBreaker.execute(async () => {
          throw new Error('fail')
        })
      } catch {
        // expected
      }

      const stats = circuitBreaker.getStats()
      expect(stats.lastFailureTime).toBe(now)
    })

    it('should track last success time', async () => {
      const now = Date.now()
      vi.setSystemTime(now)

      await circuitBreaker.execute(async () => 'success')

      const stats = circuitBreaker.getStats()
      expect(stats.lastSuccessTime).toBe(now)
    })
  })

  describe('canExecute', () => {
    it('should return true in closed state', () => {
      expect(circuitBreaker.canExecute()).toBe(true)
    })

    it('should return false in open state', async () => {
      const error = new Error('fail')
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw error
          })
        } catch {
          // expected
        }
      }

      expect(circuitBreaker.canExecute()).toBe(false)
    })

    it('should return true in half-open state', async () => {
      const error = new Error('fail')
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw error
          })
        } catch {
          // expected
        }
      }

      vi.advanceTimersByTime(30000)
      expect(circuitBreaker.canExecute()).toBe(true)
    })
  })
})
