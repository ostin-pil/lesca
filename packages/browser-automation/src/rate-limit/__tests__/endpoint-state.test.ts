/**
 * Endpoint State Tests
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { EndpointStateCollection, normalizeEndpoint } from '../endpoint-state'

describe('endpoint-state', () => {
  describe('normalizeEndpoint', () => {
    it('should normalize problem URLs', () => {
      expect(normalizeEndpoint('/problems/two-sum')).toBe('/problems/*')
      expect(normalizeEndpoint('/problems/valid-anagram')).toBe('/problems/*')
      expect(normalizeEndpoint('/problems/longest-substring-without-repeating-characters')).toBe(
        '/problems/*'
      )
    })

    it('should normalize full URLs', () => {
      expect(normalizeEndpoint('https://leetcode.com/problems/two-sum/')).toBe('/problems/*')
      expect(normalizeEndpoint('https://leetcode.com/problems/valid-anagram')).toBe('/problems/*')
    })

    it('should normalize problem subpaths', () => {
      expect(normalizeEndpoint('/problems/two-sum/description')).toBe('/problems/*/description')
      expect(normalizeEndpoint('/problems/two-sum/editorial')).toBe('/problems/*/editorial')
      expect(normalizeEndpoint('/problems/two-sum/solutions')).toBe('/problems/*/solutions')
      expect(normalizeEndpoint('/problems/two-sum/discuss')).toBe('/problems/*/discuss')
    })

    it('should normalize discussion URLs', () => {
      expect(normalizeEndpoint('/discuss/topic/12345')).toBe('/discuss/topic/*')
      expect(normalizeEndpoint('/discuss/topic/999999')).toBe('/discuss/topic/*')
    })

    it('should preserve non-matching paths', () => {
      expect(normalizeEndpoint('/graphql')).toBe('/graphql')
      expect(normalizeEndpoint('/api/problems')).toBe('/api/problems')
      expect(normalizeEndpoint('/accounts/login')).toBe('/accounts/login')
    })

    it('should handle trailing slashes', () => {
      expect(normalizeEndpoint('/problems/two-sum/')).toBe('/problems/*')
      expect(normalizeEndpoint('/graphql/')).toBe('/graphql')
    })

    it('should handle empty path', () => {
      expect(normalizeEndpoint('')).toBe('/')
      expect(normalizeEndpoint('/')).toBe('/')
    })
  })

  describe('EndpointStateCollection', () => {
    let collection: EndpointStateCollection

    beforeEach(() => {
      collection = new EndpointStateCollection()
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('getState', () => {
      it('should create new state for unknown endpoint', () => {
        const state = collection.getState('/problems/two-sum')

        expect(state.endpoint).toBe('/problems/*')
        expect(state.hitCount).toBe(0)
        expect(state.isRateLimited).toBe(false)
        expect(state.consecutiveFailures).toBe(0)
      })

      it('should return same state for normalized endpoints', () => {
        const state1 = collection.getState('/problems/two-sum')
        const state2 = collection.getState('/problems/valid-anagram')

        expect(state1).toBe(state2)
        expect(collection.size).toBe(1)
      })

      it('should track different endpoints separately', () => {
        const problemState = collection.getState('/problems/two-sum')
        const graphqlState = collection.getState('/graphql')

        expect(problemState.endpoint).toBe('/problems/*')
        expect(graphqlState.endpoint).toBe('/graphql')
        expect(collection.size).toBe(2)
      })
    })

    describe('recordSuccess', () => {
      it('should increment hit count', () => {
        collection.recordSuccess('/problems/two-sum')
        collection.recordSuccess('/problems/valid-anagram')

        const state = collection.getState('/problems/two-sum')
        expect(state.hitCount).toBe(2)
      })

      it('should update last hit time', () => {
        collection.recordSuccess('/problems/two-sum')

        const state = collection.getState('/problems/two-sum')
        expect(state.lastHitTime).toBe(Date.now())
      })

      it('should reset consecutive failures', () => {
        collection.recordRateLimited('/problems/two-sum')
        collection.recordRateLimited('/problems/two-sum')

        let state = collection.getState('/problems/two-sum')
        expect(state.consecutiveFailures).toBe(2)

        collection.recordSuccess('/problems/two-sum')

        state = collection.getState('/problems/two-sum')
        expect(state.consecutiveFailures).toBe(0)
      })

      it('should clear expired rate limit on success', () => {
        collection.recordRateLimited('/problems/two-sum', 1000)

        // Advance time past rate limit
        vi.advanceTimersByTime(2000)

        collection.recordSuccess('/problems/two-sum')

        expect(collection.isRateLimited('/problems/two-sum')).toBe(false)
      })
    })

    describe('recordRateLimited', () => {
      it('should mark endpoint as rate limited', () => {
        collection.recordRateLimited('/problems/two-sum')

        expect(collection.isRateLimited('/problems/two-sum')).toBe(true)
      })

      it('should set rate limit expiry', () => {
        const now = Date.now()
        collection.recordRateLimited('/problems/two-sum', 60000)

        const until = collection.getRateLimitedUntil('/problems/two-sum')
        expect(until).toBe(now + 60000)
      })

      it('should increment consecutive failures', () => {
        collection.recordRateLimited('/problems/two-sum')
        collection.recordRateLimited('/problems/two-sum')
        collection.recordRateLimited('/problems/two-sum')

        const state = collection.getState('/problems/two-sum')
        expect(state.consecutiveFailures).toBe(3)
      })

      it('should store retry after value', () => {
        collection.recordRateLimited('/problems/two-sum', 30000)

        const state = collection.getState('/problems/two-sum')
        expect(state.retryAfterMs).toBe(30000)
      })
    })

    describe('isRateLimited', () => {
      it('should return false for unknown endpoint', () => {
        expect(collection.isRateLimited('/unknown')).toBe(false)
      })

      it('should return true when rate limited', () => {
        collection.recordRateLimited('/problems/two-sum', 60000)

        expect(collection.isRateLimited('/problems/two-sum')).toBe(true)
      })

      it('should return false after rate limit expires', () => {
        collection.recordRateLimited('/problems/two-sum', 1000)

        expect(collection.isRateLimited('/problems/two-sum')).toBe(true)

        vi.advanceTimersByTime(2000)

        expect(collection.isRateLimited('/problems/two-sum')).toBe(false)
      })

      it('should clear expired state when checked', () => {
        collection.recordRateLimited('/problems/two-sum', 1000)

        vi.advanceTimersByTime(2000)

        collection.isRateLimited('/problems/two-sum')

        const state = collection.getState('/problems/two-sum')
        expect(state.isRateLimited).toBe(false)
        expect(state.rateLimitedUntil).toBeUndefined()
      })
    })

    describe('getRateLimitedUntil', () => {
      it('should return undefined for non-rate-limited endpoint', () => {
        collection.recordSuccess('/problems/two-sum')

        expect(collection.getRateLimitedUntil('/problems/two-sum')).toBeUndefined()
      })

      it('should return expiry timestamp when rate limited', () => {
        const now = Date.now()
        collection.recordRateLimited('/problems/two-sum', 60000)

        expect(collection.getRateLimitedUntil('/problems/two-sum')).toBe(now + 60000)
      })
    })

    describe('clearExpiredStates', () => {
      it('should clear expired rate limits', () => {
        collection.recordRateLimited('/problems/two-sum', 1000)
        collection.recordRateLimited('/graphql', 5000)

        vi.advanceTimersByTime(2000)

        collection.clearExpiredStates()

        const problemState = collection.getState('/problems/two-sum')
        const graphqlState = collection.getState('/graphql')

        expect(problemState.isRateLimited).toBe(false)
        expect(graphqlState.isRateLimited).toBe(true)
      })
    })

    describe('getAll', () => {
      it('should return all states', () => {
        collection.recordSuccess('/problems/two-sum')
        collection.recordSuccess('/graphql')
        collection.recordSuccess('/accounts/login')

        const all = collection.getAll()
        expect(all).toHaveLength(3)
        expect(all.map((s) => s.endpoint)).toContain('/problems/*')
        expect(all.map((s) => s.endpoint)).toContain('/graphql')
        expect(all.map((s) => s.endpoint)).toContain('/accounts/login')
      })
    })

    describe('clear', () => {
      it('should remove all states', () => {
        collection.recordSuccess('/problems/two-sum')
        collection.recordSuccess('/graphql')

        expect(collection.size).toBe(2)

        collection.clear()

        expect(collection.size).toBe(0)
        expect(collection.getAll()).toHaveLength(0)
      })
    })
  })
})
