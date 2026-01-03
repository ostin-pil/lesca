/**
 * Rate Limit Manager Tests
 */

import { RateLimitError } from '@lesca/shared/error'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { RateLimitManager, resolveRateLimitConfig } from '../rate-limit-manager'

// Mock logger
vi.mock('@lesca/shared/utils', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    success: vi.fn(),
    box: vi.fn(),
  },
}))

describe('rate-limit-manager', () => {
  describe('resolveRateLimitConfig', () => {
    it('should return defaults when no config provided', () => {
      const config = resolveRateLimitConfig()

      expect(config.enabled).toBe(true)
      expect(config.backoff.strategy).toBe('exponential')
      expect(config.backoff.initialDelayMs).toBe(1000)
      expect(config.backoff.maxRetries).toBe(5)
      expect(config.sessionRotation.enabled).toBe(false)
      expect(config.integration.honorRetryAfter).toBe(true)
    })

    it('should merge partial config with defaults', () => {
      const config = resolveRateLimitConfig({
        enabled: true,
        backoff: { strategy: 'linear', maxRetries: 3 },
        sessionRotation: { enabled: true },
      })

      expect(config.backoff.strategy).toBe('linear')
      expect(config.backoff.maxRetries).toBe(3)
      expect(config.backoff.initialDelayMs).toBe(1000) // Default
      expect(config.sessionRotation.enabled).toBe(true)
    })
  })

  describe('RateLimitManager', () => {
    let manager: RateLimitManager

    beforeEach(() => {
      manager = new RateLimitManager({
        backoff: { jitter: false }, // Disable jitter for predictable tests
      })
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('isEnabled', () => {
      it('should return true by default', () => {
        expect(manager.isEnabled()).toBe(true)
      })

      it('should return false when disabled', () => {
        const disabled = new RateLimitManager({ enabled: false })
        expect(disabled.isEnabled()).toBe(false)
      })
    })

    describe('getDecision', () => {
      it('should allow immediate proceed when not rate limited', () => {
        const decision = manager.getDecision('/problems/two-sum')

        expect(decision.shouldProceed).toBe(true)
        expect(decision.delayMs).toBe(0)
        expect(decision.reason).toBe('ok')
      })

      it('should return delay when rate limited', () => {
        manager.recordRateLimited('/problems/two-sum', 5)

        const decision = manager.getDecision('/problems/two-sum')

        expect(decision.shouldProceed).toBe(true)
        expect(decision.delayMs).toBe(5000) // 5 seconds from Retry-After
        expect(decision.reason).toBe('rate-limited')
      })

      it('should use backoff when no retry-after', () => {
        // Record rate limit without retry-after
        manager.recordRateLimited('/problems/two-sum', null)

        const decision = manager.getDecision('/problems/two-sum')

        expect(decision.shouldProceed).toBe(true)
        expect(decision.delayMs).toBeGreaterThan(0) // Uses backoff
        expect(decision.reason).toBe('delay-required')
      })

      it('should bypass when disabled', () => {
        const disabled = new RateLimitManager({ enabled: false })
        disabled.recordRateLimited('/problems/two-sum', 60)

        const decision = disabled.getDecision('/problems/two-sum')

        expect(decision.shouldProceed).toBe(true)
        expect(decision.delayMs).toBe(0)
        expect(decision.reason).toBe('ok')
      })
    })

    describe('recordSuccess', () => {
      it('should track successful request', () => {
        manager.recordSuccess('/problems/two-sum')

        const states = manager.getEndpointStates()
        const state = states.find((s) => s.endpoint === '/problems/*')

        expect(state?.hitCount).toBe(1)
        expect(state?.consecutiveFailures).toBe(0)
      })

      it('should reset failures after success', () => {
        manager.recordRateLimited('/problems/two-sum')
        manager.recordRateLimited('/problems/two-sum')
        manager.recordSuccess('/problems/two-sum')

        const states = manager.getEndpointStates()
        const state = states.find((s) => s.endpoint === '/problems/*')

        expect(state?.consecutiveFailures).toBe(0)
      })
    })

    describe('recordRateLimited', () => {
      it('should track rate limit', () => {
        manager.recordRateLimited('/problems/two-sum')

        const states = manager.getEndpointStates()
        const state = states.find((s) => s.endpoint === '/problems/*')

        expect(state?.isRateLimited).toBe(true)
        expect(state?.consecutiveFailures).toBe(1)
      })

      it('should parse string retry-after', () => {
        manager.recordRateLimited('/problems/two-sum', '60')

        const states = manager.getEndpointStates()
        const state = states.find((s) => s.endpoint === '/problems/*')

        expect(state?.retryAfterMs).toBe(60000)
      })

      it('should parse number retry-after', () => {
        manager.recordRateLimited('/problems/two-sum', 30)

        const states = manager.getEndpointStates()
        const state = states.find((s) => s.endpoint === '/problems/*')

        expect(state?.retryAfterMs).toBe(30000)
      })

      it('should cap retry-after at max', () => {
        manager.recordRateLimited('/problems/two-sum', 300) // 5 minutes

        const states = manager.getEndpointStates()
        const state = states.find((s) => s.endpoint === '/problems/*')

        // Default max is 120000ms (2 minutes)
        expect(state?.retryAfterMs).toBe(120000)
      })
    })

    describe('executeWithRetry', () => {
      it('should return result on success', async () => {
        const fn = vi.fn().mockResolvedValue('success')

        const result = await manager.executeWithRetry(fn, '/api/data')

        expect(result).toBe('success')
        expect(fn).toHaveBeenCalledTimes(1)
      })

      it('should retry on rate limit error', async () => {
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new RateLimitError('Rate limited'))
          .mockResolvedValue('success')

        const promise = manager.executeWithRetry(fn, '/api/data')

        // First call throws, then waits for backoff delay
        // Advance timers to let the retry happen
        await vi.advanceTimersByTimeAsync(2000)

        const result = await promise

        expect(result).toBe('success')
        expect(fn).toHaveBeenCalledTimes(2)
      })

      it('should respect max retries', async () => {
        // Use real timers for this test to avoid unhandled rejection issues
        vi.useRealTimers()

        const testManager = new RateLimitManager({
          backoff: { maxRetries: 2, initialDelayMs: 10, jitter: false },
        })

        const fn = vi.fn().mockRejectedValue(new RateLimitError('Rate limited'))

        let error: Error | undefined
        try {
          await testManager.executeWithRetry(fn, '/api/data')
        } catch (e) {
          error = e as Error
        }

        expect(error).toBeInstanceOf(RateLimitError)
        expect(fn).toHaveBeenCalledTimes(2)

        // Restore fake timers for other tests
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
      })

      it('should not retry non-rate-limit errors', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('Other error'))

        await expect(manager.executeWithRetry(fn, '/api/data')).rejects.toThrow('Other error')

        expect(fn).toHaveBeenCalledTimes(1)
      })

      it('should detect rate limit from error message', async () => {
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error('Too many requests'))
          .mockResolvedValue('success')

        const promise = manager.executeWithRetry(fn, '/api/data')

        // Advance timers for backoff delay
        await vi.advanceTimersByTimeAsync(2000)

        const result = await promise

        expect(result).toBe('success')
        expect(fn).toHaveBeenCalledTimes(2)
      })

      it('should wait for delay before retry', async () => {
        const testManager = new RateLimitManager({
          backoff: { initialDelayMs: 1000, jitter: false },
        })

        const fn = vi
          .fn()
          .mockRejectedValueOnce(new RateLimitError('Rate limited'))
          .mockResolvedValue('success')

        const promise = testManager.executeWithRetry(fn, '/api/data')

        // First call happens immediately
        expect(fn).toHaveBeenCalledTimes(1)

        // Advance time for backoff delay
        await vi.advanceTimersByTimeAsync(1500)

        await promise

        expect(fn).toHaveBeenCalledTimes(2)
      })
    })

    describe('session management', () => {
      it('should register and unregister sessions', () => {
        manager.registerSession('session-1')
        manager.registerSession('session-2')

        // Should not throw
        manager.unregisterSession('session-1')
      })

      it('should recommend session rotation when enabled', () => {
        const rotationManager = new RateLimitManager({
          sessionRotation: { enabled: true },
        })

        rotationManager.registerSession('session-1')
        rotationManager.registerSession('session-2')

        // Put session-1 on cooldown
        rotationManager.recordRateLimited('/api/data', 60, 'session-1')

        const decision = rotationManager.getDecision('/api/other', 'session-1')

        // Should recommend different session
        expect(decision.recommendedSession).toBe('session-2')
      })
    })

    describe('clear', () => {
      it('should clear all state', () => {
        manager.recordSuccess('/problems/two-sum')
        manager.recordRateLimited('/graphql')
        manager.registerSession('session-1')

        manager.clear()

        expect(manager.getEndpointStates()).toHaveLength(0)
      })
    })

    describe('getConfig', () => {
      it('should return resolved configuration', () => {
        const config = manager.getConfig()

        expect(config.enabled).toBe(true)
        expect(config.backoff.strategy).toBe('exponential')
        expect(config.sessionRotation.enabled).toBe(false)
      })
    })
  })
})
