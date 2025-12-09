import { EventEmitter } from 'events'

import type {
  CircuitState,
  IMetricsCollector,
  MetricEvent,
  MetricsCollectorConfig,
  MetricsSummary,
  SessionMetrics,
  TimingStats,
} from './interfaces'

/**
 * Default configuration values
 */
const DEFAULT_WINDOW_DURATION_MS = 60000 // 1 minute
const DEFAULT_MAX_HISTORY_SIZE = 1000

/**
 * Per-session event history and aggregated data
 */
interface SessionEventData {
  events: MetricEvent[]
  /** Timing accumulators */
  acquireTimings: number[]
  releaseTimings: number[]
  browserCreateTimings: number[]
  /** Counts */
  totalAcquisitions: number
  totalReleases: number
  totalFailures: number
  browsersCreated: number
  browsersDestroyed: number
  circuitTrips: number
  /** Current state */
  currentPoolSize: number
  currentActiveBrowsers: number
  currentIdleBrowsers: number
  currentCircuitState: CircuitState
  /** Timestamps */
  firstEventAt: number | undefined
  lastEventAt: number | undefined
}

/**
 * Creates an empty TimingStats object
 */
function emptyTimingStats(): TimingStats {
  return {
    count: 0,
    totalMs: 0,
    minMs: Infinity,
    maxMs: 0,
    avgMs: 0,
  }
}

/**
 * Creates an empty session event data object
 */
function createEmptySessionData(): SessionEventData {
  return {
    events: [],
    acquireTimings: [],
    releaseTimings: [],
    browserCreateTimings: [],
    totalAcquisitions: 0,
    totalReleases: 0,
    totalFailures: 0,
    browsersCreated: 0,
    browsersDestroyed: 0,
    circuitTrips: 0,
    currentPoolSize: 0,
    currentActiveBrowsers: 0,
    currentIdleBrowsers: 0,
    currentCircuitState: 'closed',
    firstEventAt: undefined,
    lastEventAt: undefined,
  }
}

/**
 * Calculates timing statistics from an array of durations
 */
function calculateTimingStats(timings: number[]): TimingStats {
  if (timings.length === 0) {
    return emptyTimingStats()
  }

  const totalMs = timings.reduce((sum, t) => sum + t, 0)
  const minMs = Math.min(...timings)
  const maxMs = Math.max(...timings)

  return {
    count: timings.length,
    totalMs,
    minMs,
    maxMs,
    avgMs: totalMs / timings.length,
  }
}

/**
 * Metrics Collector
 *
 * Collects and aggregates pool metrics events for monitoring and diagnostics.
 * Uses EventEmitter for real-time event subscriptions.
 *
 * Features:
 * - Per-session metrics tracking
 * - Timing statistics (min, max, avg)
 * - Rate calculations over configurable time windows
 * - Event history with configurable size limits
 * - Real-time event subscriptions
 */
export class MetricsCollector extends EventEmitter implements IMetricsCollector {
  private sessionData: Map<string, SessionEventData> = new Map()
  private config: Required<MetricsCollectorConfig>
  private windowStartTime: number

  constructor(config: MetricsCollectorConfig = {}) {
    super()
    this.config = {
      windowDurationMs: config.windowDurationMs ?? DEFAULT_WINDOW_DURATION_MS,
      maxHistorySize: config.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE,
      verbose: config.verbose ?? false,
    }
    this.windowStartTime = Date.now()
  }

  /**
   * Record a metric event
   */
  record(event: MetricEvent): void {
    const sessionName = event.sessionName ?? '__global__'
    const data = this.getOrCreateSessionData(sessionName)

    // Update timestamps
    if (data.firstEventAt === undefined) {
      data.firstEventAt = event.timestamp
    }
    data.lastEventAt = event.timestamp

    // Add to history (with size limit)
    data.events.push(event)
    if (data.events.length > this.config.maxHistorySize) {
      data.events.shift()
    }

    // Process event by type
    this.processEvent(event, data)

    // Emit for subscribers
    this.emit('metric', event)
  }

  /**
   * Process event and update aggregated data
   */
  private processEvent(event: MetricEvent, data: SessionEventData): void {
    switch (event.type) {
      case 'pool:acquire':
        data.totalAcquisitions++
        data.acquireTimings.push(event.durationMs)
        data.currentPoolSize = event.poolSize
        data.currentActiveBrowsers++
        data.currentIdleBrowsers = Math.max(0, data.currentIdleBrowsers - 1)
        this.trimTimings(data.acquireTimings)
        break

      case 'pool:release':
        data.totalReleases++
        data.releaseTimings.push(event.durationMs)
        data.currentPoolSize = event.poolSize
        data.currentActiveBrowsers = Math.max(0, data.currentActiveBrowsers - 1)
        data.currentIdleBrowsers++
        this.trimTimings(data.releaseTimings)
        break

      case 'pool:failure':
        data.totalFailures++
        break

      case 'pool:exhausted':
        data.currentPoolSize = event.poolSize
        break

      case 'pool:browser-created':
        data.browsersCreated++
        data.browserCreateTimings.push(event.durationMs)
        data.currentPoolSize = event.poolSize
        this.trimTimings(data.browserCreateTimings)
        break

      case 'pool:browser-destroyed':
        data.browsersDestroyed++
        data.currentPoolSize = event.poolSize
        data.currentIdleBrowsers = Math.max(0, data.currentIdleBrowsers - 1)
        break

      case 'circuit:trip':
        data.circuitTrips++
        data.currentCircuitState = 'open'
        break

      case 'circuit:reset':
        data.currentCircuitState = 'closed'
        break

      case 'circuit:half-open':
        data.currentCircuitState = 'half-open'
        break
    }
  }

  /**
   * Trim timing arrays to prevent unbounded growth
   */
  private trimTimings(timings: number[]): void {
    const maxTimings = this.config.maxHistorySize
    while (timings.length > maxTimings) {
      timings.shift()
    }
  }

  /**
   * Get or create session data
   */
  private getOrCreateSessionData(sessionName: string): SessionEventData {
    let data = this.sessionData.get(sessionName)
    if (!data) {
      data = createEmptySessionData()
      this.sessionData.set(sessionName, data)
    }
    return data
  }

  /**
   * Get metrics for a specific session
   */
  getSessionMetrics(sessionName: string): SessionMetrics | undefined {
    const data = this.sessionData.get(sessionName)
    if (!data) {
      return undefined
    }

    return this.buildSessionMetrics(sessionName, data)
  }

  /**
   * Build SessionMetrics from session data
   */
  private buildSessionMetrics(sessionName: string, data: SessionEventData): SessionMetrics {
    const now = Date.now()
    const windowStart = now - this.config.windowDurationMs

    // Count events in the current window for rate calculations
    const eventsInWindow = data.events.filter((e) => e.timestamp >= windowStart)
    const acquisitionsInWindow = eventsInWindow.filter((e) => e.type === 'pool:acquire').length
    const failuresInWindow = eventsInWindow.filter((e) => e.type === 'pool:failure').length
    const totalInWindow = eventsInWindow.length

    // Calculate rates (per minute)
    const windowMinutes = this.config.windowDurationMs / 60000
    const acquisitionsPerMinute = acquisitionsInWindow / windowMinutes
    const failureRate = totalInWindow > 0 ? failuresInWindow / totalInWindow : 0

    return {
      sessionName,
      poolSize: data.currentPoolSize,
      activeBrowsers: data.currentActiveBrowsers,
      idleBrowsers: data.currentIdleBrowsers,
      acquireTiming: calculateTimingStats(data.acquireTimings),
      releaseTiming: calculateTimingStats(data.releaseTimings),
      browserCreateTiming: calculateTimingStats(data.browserCreateTimings),
      totalAcquisitions: data.totalAcquisitions,
      totalReleases: data.totalReleases,
      totalFailures: data.totalFailures,
      browsersCreated: data.browsersCreated,
      browsersDestroyed: data.browsersDestroyed,
      acquisitionsPerMinute,
      failureRate,
      circuitState: data.currentCircuitState,
      circuitTrips: data.circuitTrips,
      firstEventAt: data.firstEventAt,
      lastEventAt: data.lastEventAt,
    }
  }

  /**
   * Get summary of all metrics
   */
  getSummary(): MetricsSummary {
    const sessions: SessionMetrics[] = []
    let totalActiveBrowsers = 0
    let totalIdleBrowsers = 0
    let circuitsOpen = 0
    let circuitsHalfOpen = 0
    let totalAcquisitionsInWindow = 0
    let totalFailuresInWindow = 0
    let totalEventsInWindow = 0

    const now = Date.now()
    const windowStart = now - this.config.windowDurationMs

    for (const [sessionName, data] of this.sessionData.entries()) {
      // Skip global session in summary
      if (sessionName === '__global__') continue

      const metrics = this.buildSessionMetrics(sessionName, data)
      sessions.push(metrics)

      totalActiveBrowsers += metrics.activeBrowsers
      totalIdleBrowsers += metrics.idleBrowsers

      if (metrics.circuitState === 'open') circuitsOpen++
      if (metrics.circuitState === 'half-open') circuitsHalfOpen++

      // Count events in window for global rates
      const eventsInWindow = data.events.filter((e) => e.timestamp >= windowStart)
      totalEventsInWindow += eventsInWindow.length
      totalAcquisitionsInWindow += eventsInWindow.filter((e) => e.type === 'pool:acquire').length
      totalFailuresInWindow += eventsInWindow.filter((e) => e.type === 'pool:failure').length
    }

    const windowMinutes = this.config.windowDurationMs / 60000
    const globalAcquisitionsPerMinute = totalAcquisitionsInWindow / windowMinutes
    const globalFailureRate =
      totalEventsInWindow > 0 ? totalFailuresInWindow / totalEventsInWindow : 0

    return {
      sessions,
      totalSessions: sessions.length,
      totalActiveBrowsers,
      totalIdleBrowsers,
      globalAcquisitionsPerMinute,
      globalFailureRate,
      circuitsOpen,
      circuitsHalfOpen,
      windowStartTime: this.windowStartTime,
      windowDurationMs: this.config.windowDurationMs,
    }
  }

  /**
   * Subscribe to metric events
   */
  override on(event: 'metric', listener: (event: MetricEvent) => void): this {
    return super.on(event, listener)
  }

  /**
   * Unsubscribe from metric events
   */
  override off(event: 'metric', listener: (event: MetricEvent) => void): this {
    return super.off(event, listener)
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.sessionData.clear()
    this.windowStartTime = Date.now()
  }

  /**
   * Get configuration
   */
  getConfig(): Required<MetricsCollectorConfig> {
    return { ...this.config }
  }
}
