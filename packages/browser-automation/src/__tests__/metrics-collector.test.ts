import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { MetricsCollector } from '../metrics-collector'
import type { MetricEvent, PoolAcquireEvent, PoolFailureEvent } from '../interfaces'

describe('MetricsCollector', () => {
  let collector: MetricsCollector

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
    collector = new MetricsCollector()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('creates with default configuration', () => {
      const config = collector.getConfig()
      expect(config.windowDurationMs).toBe(60000)
      expect(config.maxHistorySize).toBe(1000)
      expect(config.verbose).toBe(false)
    })

    it('accepts custom configuration', () => {
      const custom = new MetricsCollector({
        windowDurationMs: 120000,
        maxHistorySize: 500,
        verbose: true,
      })
      const config = custom.getConfig()
      expect(config.windowDurationMs).toBe(120000)
      expect(config.maxHistorySize).toBe(500)
      expect(config.verbose).toBe(true)
    })
  })

  describe('record', () => {
    it('records pool:acquire event', () => {
      const event: PoolAcquireEvent = {
        type: 'pool:acquire',
        timestamp: Date.now(),
        sessionName: 'test-session',
        durationMs: 50,
        reused: true,
        poolSize: 2,
      }

      collector.record(event)

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics).toBeDefined()
      expect(metrics?.totalAcquisitions).toBe(1)
      expect(metrics?.acquireTiming.count).toBe(1)
      expect(metrics?.acquireTiming.avgMs).toBe(50)
    })

    it('records pool:release event', () => {
      collector.record({
        type: 'pool:release',
        timestamp: Date.now(),
        sessionName: 'test-session',
        durationMs: 10,
        poolSize: 2,
      })

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics?.totalReleases).toBe(1)
      expect(metrics?.releaseTiming.count).toBe(1)
    })

    it('records pool:failure event', () => {
      const event: PoolFailureEvent = {
        type: 'pool:failure',
        timestamp: Date.now(),
        sessionName: 'test-session',
        error: 'Browser launch failed',
      }

      collector.record(event)

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics?.totalFailures).toBe(1)
    })

    it('records pool:exhausted event', () => {
      collector.record({
        type: 'pool:exhausted',
        timestamp: Date.now(),
        sessionName: 'test-session',
        waitTimeMs: 5000,
        poolSize: 3,
        maxSize: 3,
      })

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics?.poolSize).toBe(3)
    })

    it('records pool:browser-created event', () => {
      collector.record({
        type: 'pool:browser-created',
        timestamp: Date.now(),
        sessionName: 'test-session',
        durationMs: 2000,
        poolSize: 1,
      })

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics?.browsersCreated).toBe(1)
      expect(metrics?.browserCreateTiming.count).toBe(1)
      expect(metrics?.browserCreateTiming.avgMs).toBe(2000)
    })

    it('records pool:browser-destroyed event', () => {
      collector.record({
        type: 'pool:browser-destroyed',
        timestamp: Date.now(),
        sessionName: 'test-session',
        poolSize: 0,
        reason: 'idle',
      })

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics?.browsersDestroyed).toBe(1)
    })

    it('records circuit:trip event', () => {
      collector.record({
        type: 'circuit:trip',
        timestamp: Date.now(),
        sessionName: 'test-session',
        failures: 3,
        threshold: 3,
      })

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics?.circuitTrips).toBe(1)
      expect(metrics?.circuitState).toBe('open')
    })

    it('records circuit:reset event', () => {
      collector.record({
        type: 'circuit:trip',
        timestamp: Date.now(),
        sessionName: 'test-session',
        failures: 3,
        threshold: 3,
      })

      collector.record({
        type: 'circuit:reset',
        timestamp: Date.now(),
        sessionName: 'test-session',
        previousState: 'open',
      })

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics?.circuitState).toBe('closed')
    })

    it('records circuit:half-open event', () => {
      collector.record({
        type: 'circuit:half-open',
        timestamp: Date.now(),
        sessionName: 'test-session',
        timeSinceTrip: 30000,
      })

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics?.circuitState).toBe('half-open')
    })

    it('uses __global__ session for events without sessionName', () => {
      collector.record({
        type: 'pool:failure',
        timestamp: Date.now(),
        error: 'Unknown error',
      })

      const metrics = collector.getSessionMetrics('__global__')
      expect(metrics?.totalFailures).toBe(1)
    })

    it('updates timestamps correctly', () => {
      const firstTime = Date.now()
      collector.record({
        type: 'pool:acquire',
        timestamp: firstTime,
        sessionName: 'test-session',
        durationMs: 50,
        reused: true,
        poolSize: 1,
      })

      vi.advanceTimersByTime(5000)
      const secondTime = Date.now()

      collector.record({
        type: 'pool:release',
        timestamp: secondTime,
        sessionName: 'test-session',
        durationMs: 10,
        poolSize: 1,
      })

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics?.firstEventAt).toBe(firstTime)
      expect(metrics?.lastEventAt).toBe(secondTime)
    })
  })

  describe('timing statistics', () => {
    it('calculates min, max, avg correctly', () => {
      // Record multiple acquire events with different durations
      const durations = [10, 20, 30, 40, 50]
      durations.forEach((durationMs) => {
        collector.record({
          type: 'pool:acquire',
          timestamp: Date.now(),
          sessionName: 'test-session',
          durationMs,
          reused: false,
          poolSize: 1,
        })
      })

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics?.acquireTiming.count).toBe(5)
      expect(metrics?.acquireTiming.minMs).toBe(10)
      expect(metrics?.acquireTiming.maxMs).toBe(50)
      expect(metrics?.acquireTiming.avgMs).toBe(30)
      expect(metrics?.acquireTiming.totalMs).toBe(150)
    })

    it('returns empty timing stats when no events recorded', () => {
      const summary = collector.getSummary()
      expect(summary.sessions).toHaveLength(0)
    })
  })

  describe('rate calculations', () => {
    it('calculates acquisitions per minute', () => {
      // Record 10 acquisitions within a 1-minute window
      for (let i = 0; i < 10; i++) {
        collector.record({
          type: 'pool:acquire',
          timestamp: Date.now(),
          sessionName: 'test-session',
          durationMs: 50,
          reused: true,
          poolSize: 1,
        })
        vi.advanceTimersByTime(5000) // 5 seconds apart
      }

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics?.acquisitionsPerMinute).toBeGreaterThan(0)
    })

    it('calculates failure rate', () => {
      // Record some successes and failures
      for (let i = 0; i < 8; i++) {
        collector.record({
          type: 'pool:acquire',
          timestamp: Date.now(),
          sessionName: 'test-session',
          durationMs: 50,
          reused: true,
          poolSize: 1,
        })
      }

      for (let i = 0; i < 2; i++) {
        collector.record({
          type: 'pool:failure',
          timestamp: Date.now(),
          sessionName: 'test-session',
          error: 'Failed',
        })
      }

      const metrics = collector.getSessionMetrics('test-session')
      expect(metrics?.failureRate).toBe(0.2) // 2 failures / 10 total events
    })
  })

  describe('getSummary', () => {
    it('returns empty summary when no data', () => {
      const summary = collector.getSummary()
      expect(summary.sessions).toHaveLength(0)
      expect(summary.totalSessions).toBe(0)
      expect(summary.totalActiveBrowsers).toBe(0)
      expect(summary.totalIdleBrowsers).toBe(0)
    })

    it('aggregates metrics across multiple sessions', () => {
      // Session 1
      collector.record({
        type: 'pool:acquire',
        timestamp: Date.now(),
        sessionName: 'session-1',
        durationMs: 50,
        reused: false,
        poolSize: 1,
      })

      // Session 2
      collector.record({
        type: 'pool:acquire',
        timestamp: Date.now(),
        sessionName: 'session-2',
        durationMs: 60,
        reused: false,
        poolSize: 1,
      })

      const summary = collector.getSummary()
      expect(summary.totalSessions).toBe(2)
      expect(summary.sessions).toHaveLength(2)
    })

    it('counts open and half-open circuits', () => {
      collector.record({
        type: 'circuit:trip',
        timestamp: Date.now(),
        sessionName: 'session-1',
        failures: 3,
        threshold: 3,
      })

      collector.record({
        type: 'circuit:half-open',
        timestamp: Date.now(),
        sessionName: 'session-2',
        timeSinceTrip: 30000,
      })

      const summary = collector.getSummary()
      expect(summary.circuitsOpen).toBe(1)
      expect(summary.circuitsHalfOpen).toBe(1)
    })

    it('excludes __global__ session from summary', () => {
      collector.record({
        type: 'pool:failure',
        timestamp: Date.now(),
        error: 'Global error',
      })

      collector.record({
        type: 'pool:acquire',
        timestamp: Date.now(),
        sessionName: 'real-session',
        durationMs: 50,
        reused: true,
        poolSize: 1,
      })

      const summary = collector.getSummary()
      expect(summary.totalSessions).toBe(1)
      expect(summary.sessions.map((s) => s.sessionName)).toEqual(['real-session'])
    })
  })

  describe('event subscriptions', () => {
    it('emits events to subscribers', () => {
      const listener = vi.fn()
      collector.on('metric', listener)

      const event: MetricEvent = {
        type: 'pool:acquire',
        timestamp: Date.now(),
        sessionName: 'test',
        durationMs: 50,
        reused: true,
        poolSize: 1,
      }

      collector.record(event)

      expect(listener).toHaveBeenCalledWith(event)
    })

    it('allows unsubscribing', () => {
      const listener = vi.fn()
      collector.on('metric', listener)
      collector.off('metric', listener)

      collector.record({
        type: 'pool:acquire',
        timestamp: Date.now(),
        sessionName: 'test',
        durationMs: 50,
        reused: true,
        poolSize: 1,
      })

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('clears all data', () => {
      collector.record({
        type: 'pool:acquire',
        timestamp: Date.now(),
        sessionName: 'test-session',
        durationMs: 50,
        reused: true,
        poolSize: 1,
      })

      expect(collector.getSessionMetrics('test-session')).toBeDefined()

      collector.reset()

      expect(collector.getSessionMetrics('test-session')).toBeUndefined()
      expect(collector.getSummary().totalSessions).toBe(0)
    })
  })

  describe('history size limits', () => {
    it('trims events when exceeding max history size', () => {
      const smallCollector = new MetricsCollector({ maxHistorySize: 5 })

      // Record more events than max history
      for (let i = 0; i < 10; i++) {
        smallCollector.record({
          type: 'pool:acquire',
          timestamp: Date.now(),
          sessionName: 'test-session',
          durationMs: i * 10,
          reused: false,
          poolSize: 1,
        })
      }

      // The collector should have trimmed to keep only the latest events
      // Total acquisitions should still be 10 (counts aren't trimmed)
      const metrics = smallCollector.getSessionMetrics('test-session')
      expect(metrics?.totalAcquisitions).toBe(10)
    })
  })
})
