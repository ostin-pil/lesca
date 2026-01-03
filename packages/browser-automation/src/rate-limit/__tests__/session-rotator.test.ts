/**
 * Session Rotator Tests
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  SessionRotator,
  resolveSessionRotationConfig,
  DEFAULT_SESSION_ROTATION_CONFIG,
} from '../session-rotator'

describe('session-rotator', () => {
  describe('resolveSessionRotationConfig', () => {
    it('should return defaults when no config provided', () => {
      const config = resolveSessionRotationConfig()

      expect(config).toEqual(DEFAULT_SESSION_ROTATION_CONFIG)
    })

    it('should merge partial config with defaults', () => {
      const config = resolveSessionRotationConfig({
        enabled: true,
        distributionStrategy: 'least-loaded',
      })

      expect(config.enabled).toBe(true)
      expect(config.distributionStrategy).toBe('least-loaded')
      expect(config.cooldownMs).toBe(DEFAULT_SESSION_ROTATION_CONFIG.cooldownMs)
    })
  })

  describe('SessionRotator', () => {
    let rotator: SessionRotator

    beforeEach(() => {
      rotator = new SessionRotator({ enabled: true })
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('registerSession', () => {
      it('should register a new session', () => {
        rotator.registerSession('session-1')

        expect(rotator.size).toBe(1)
        expect(rotator.getSessionInfo('session-1')).toBeDefined()
      })

      it('should not duplicate existing sessions', () => {
        rotator.registerSession('session-1')
        rotator.registerSession('session-1')

        expect(rotator.size).toBe(1)
      })

      it('should initialize session with default values', () => {
        rotator.registerSession('session-1')

        const info = rotator.getSessionInfo('session-1')
        expect(info?.requestCount).toBe(0)
        expect(info?.errorCount).toBe(0)
        expect(info?.cooldownUntil).toBeUndefined()
        expect(info?.lastRequestTime).toBeUndefined()
      })
    })

    describe('unregisterSession', () => {
      it('should remove registered session', () => {
        rotator.registerSession('session-1')
        rotator.unregisterSession('session-1')

        expect(rotator.size).toBe(0)
        expect(rotator.getSessionInfo('session-1')).toBeUndefined()
      })

      it('should handle unregistering non-existent session', () => {
        expect(() => rotator.unregisterSession('non-existent')).not.toThrow()
      })
    })

    describe('recordSuccess', () => {
      it('should increment request count', () => {
        rotator.registerSession('session-1')
        rotator.recordSuccess('session-1')
        rotator.recordSuccess('session-1')

        const info = rotator.getSessionInfo('session-1')
        expect(info?.requestCount).toBe(2)
      })

      it('should update last request time', () => {
        rotator.registerSession('session-1')
        rotator.recordSuccess('session-1')

        const info = rotator.getSessionInfo('session-1')
        expect(info?.lastRequestTime).toBe(Date.now())
      })

      it('should not increment error count', () => {
        rotator.registerSession('session-1')
        rotator.recordSuccess('session-1')

        const info = rotator.getSessionInfo('session-1')
        expect(info?.errorCount).toBe(0)
      })
    })

    describe('recordRateLimit', () => {
      it('should increment error count', () => {
        rotator.registerSession('session-1')
        rotator.recordRateLimit('session-1')
        rotator.recordRateLimit('session-1')

        const info = rotator.getSessionInfo('session-1')
        expect(info?.errorCount).toBe(2)
      })

      it('should increment request count', () => {
        rotator.registerSession('session-1')
        rotator.recordRateLimit('session-1')

        const info = rotator.getSessionInfo('session-1')
        expect(info?.requestCount).toBe(1)
      })
    })

    describe('setCooldown', () => {
      it('should set cooldown with default duration', () => {
        rotator.registerSession('session-1')
        rotator.setCooldown('session-1')

        const info = rotator.getSessionInfo('session-1')
        expect(info?.cooldownUntil).toBe(Date.now() + DEFAULT_SESSION_ROTATION_CONFIG.cooldownMs)
      })

      it('should set cooldown with custom duration', () => {
        rotator.registerSession('session-1')
        rotator.setCooldown('session-1', 60000)

        const info = rotator.getSessionInfo('session-1')
        expect(info?.cooldownUntil).toBe(Date.now() + 60000)
      })
    })

    describe('isOnCooldown', () => {
      it('should return false for session not on cooldown', () => {
        rotator.registerSession('session-1')

        expect(rotator.isOnCooldown('session-1')).toBe(false)
      })

      it('should return true for session on cooldown', () => {
        rotator.registerSession('session-1')
        rotator.setCooldown('session-1', 60000)

        expect(rotator.isOnCooldown('session-1')).toBe(true)
      })

      it('should return false after cooldown expires', () => {
        rotator.registerSession('session-1')
        rotator.setCooldown('session-1', 1000)

        expect(rotator.isOnCooldown('session-1')).toBe(true)

        vi.advanceTimersByTime(2000)

        expect(rotator.isOnCooldown('session-1')).toBe(false)
      })

      it('should return false for unknown session', () => {
        expect(rotator.isOnCooldown('unknown')).toBe(false)
      })
    })

    describe('getAvailableSessions', () => {
      it('should return all sessions when none on cooldown', () => {
        rotator.registerSession('session-1')
        rotator.registerSession('session-2')

        const available = rotator.getAvailableSessions()
        expect(available).toHaveLength(2)
        expect(available).toContain('session-1')
        expect(available).toContain('session-2')
      })

      it('should exclude sessions on cooldown', () => {
        rotator.registerSession('session-1')
        rotator.registerSession('session-2')
        rotator.setCooldown('session-1', 60000)

        const available = rotator.getAvailableSessions()
        expect(available).toHaveLength(1)
        expect(available).toContain('session-2')
      })

      it('should include sessions after cooldown expires', () => {
        rotator.registerSession('session-1')
        rotator.setCooldown('session-1', 1000)

        expect(rotator.getAvailableSessions()).toHaveLength(0)

        vi.advanceTimersByTime(2000)

        expect(rotator.getAvailableSessions()).toHaveLength(1)
      })
    })

    describe('selectSession', () => {
      describe('round-robin strategy', () => {
        it('should cycle through sessions', () => {
          rotator.registerSession('session-1')
          rotator.registerSession('session-2')
          rotator.registerSession('session-3')

          const first = rotator.selectSession()
          const second = rotator.selectSession()
          const third = rotator.selectSession()
          const fourth = rotator.selectSession()

          expect(first).toBe('session-1')
          expect(second).toBe('session-2')
          expect(third).toBe('session-3')
          expect(fourth).toBe('session-1') // Wraps around
        })

        it('should skip sessions on cooldown', () => {
          rotator.registerSession('session-1')
          rotator.registerSession('session-2')
          rotator.setCooldown('session-1', 60000)

          expect(rotator.selectSession()).toBe('session-2')
          expect(rotator.selectSession()).toBe('session-2')
        })
      })

      describe('least-loaded strategy', () => {
        beforeEach(() => {
          rotator = new SessionRotator({
            enabled: true,
            distributionStrategy: 'least-loaded',
          })
        })

        it('should select session with fewest requests', () => {
          rotator.registerSession('session-1')
          rotator.registerSession('session-2')

          rotator.recordSuccess('session-1')
          rotator.recordSuccess('session-1')
          rotator.recordSuccess('session-2')

          expect(rotator.selectSession()).toBe('session-2')
        })

        it('should pick from equal sessions', () => {
          rotator.registerSession('session-1')
          rotator.registerSession('session-2')

          // Both have 0 requests, should pick first one encountered
          expect(rotator.selectSession()).toBeDefined()
        })
      })

      describe('least-errors strategy', () => {
        beforeEach(() => {
          rotator = new SessionRotator({
            enabled: true,
            distributionStrategy: 'least-errors',
          })
        })

        it('should select session with lowest error rate', () => {
          rotator.registerSession('session-1')
          rotator.registerSession('session-2')

          // session-1: 2 errors / 4 requests = 50% error rate
          rotator.recordRateLimit('session-1')
          rotator.recordRateLimit('session-1')
          rotator.recordSuccess('session-1')
          rotator.recordSuccess('session-1')

          // session-2: 1 error / 4 requests = 25% error rate
          rotator.recordRateLimit('session-2')
          rotator.recordSuccess('session-2')
          rotator.recordSuccess('session-2')
          rotator.recordSuccess('session-2')

          expect(rotator.selectSession()).toBe('session-2')
        })

        it('should fall back to least-loaded when all have zero errors', () => {
          rotator.registerSession('session-1')
          rotator.registerSession('session-2')

          rotator.recordSuccess('session-1')
          rotator.recordSuccess('session-1')
          rotator.recordSuccess('session-2')

          // All zero errors, so should pick least-loaded (session-2)
          expect(rotator.selectSession()).toBe('session-2')
        })
      })

      it('should return undefined when no sessions available', () => {
        expect(rotator.selectSession()).toBeUndefined()
      })

      it('should return undefined when all sessions on cooldown', () => {
        rotator.registerSession('session-1')
        rotator.registerSession('session-2')
        rotator.setCooldown('session-1', 60000)
        rotator.setCooldown('session-2', 60000)

        expect(rotator.selectSession()).toBeUndefined()
      })
    })

    describe('getAllSessions', () => {
      it('should return all session info', () => {
        rotator.registerSession('session-1')
        rotator.registerSession('session-2')
        rotator.recordSuccess('session-1')

        const all = rotator.getAllSessions()
        expect(all).toHaveLength(2)
        expect(all.find((s) => s.id === 'session-1')?.requestCount).toBe(1)
        expect(all.find((s) => s.id === 'session-2')?.requestCount).toBe(0)
      })
    })

    describe('clear', () => {
      it('should remove all sessions', () => {
        rotator.registerSession('session-1')
        rotator.registerSession('session-2')

        rotator.clear()

        expect(rotator.size).toBe(0)
        expect(rotator.getAllSessions()).toHaveLength(0)
      })

      it('should reset round-robin index', () => {
        rotator.registerSession('session-1')
        rotator.registerSession('session-2')

        rotator.selectSession() // Advances index

        rotator.clear()
        rotator.registerSession('session-new')

        expect(rotator.selectSession()).toBe('session-new')
      })
    })
  })
})
