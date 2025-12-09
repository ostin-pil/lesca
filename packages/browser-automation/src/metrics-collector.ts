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
 * ## Features
 * - **Per-session Tracking**: Separate metrics for each browser session
 * - **Timing Statistics**: Min, max, average for acquire/release/create operations
 * - **Rate Calculations**: Acquisitions per minute, failure rates over time windows
 * - **Event History**: Configurable history buffer for analysis
 * - **Real-time Events**: Subscribe to metric events as they occur
 *
 * ## Collected Metrics
 * - Pool operations: acquire, release, exhausted
 * - Browser lifecycle: created, destroyed
 * - Circuit breaker: trip, reset, half-open
 * - Timing: operation durations in milliseconds
 *
 * ## Usage
 * ```typescript
 * const collector = new MetricsCollector({
 *   windowDurationMs: 60000,  // 1 minute window for rates
 *   maxHistorySize: 1000      // Keep last 1000 events
 * });
 *
 * // Record events
 * collector.record({
 *   type: 'pool:acquire',
 *   timestamp: Date.now(),
 *   sessionName: 'my-session',
 *   durationMs: 150,
 *   reused: true,
 *   poolSize: 2
 * });
 *
 * // Get session metrics
 * const metrics = collector.getSessionMetrics('my-session');
 *
 * // Get summary of all sessions
 * const summary = collector.getSummary();
 *
 * // Subscribe to events
 * collector.on('metric', (event) => {
 *   console.log(`Event: ${event.type}`);
 * });
 * ```
 *
 * @see {@link MetricEvent} for event types
 * @see {@link SessionMetrics} for per-session metrics structure
 * @see {@link MetricsSummary} for global summary structure
 */
export class MetricsCollector extends EventEmitter implements IMetricsCollector {
  private sessionData: Map<string, SessionEventData> = new Map()
  private config: Required<MetricsCollectorConfig>
  private windowStartTime: number

  /**
   * Creates a new MetricsCollector instance.
   *
   * @param config - Collector configuration
   * @param config.windowDurationMs - Time window for rate calculations in ms (default: 60000)
   * @param config.maxHistorySize - Maximum events to keep in history (default: 1000)
   * @param config.verbose - Enable verbose logging (default: false)
   *
   * @example
   * ```typescript
   * // Use defaults
   * const collector = new MetricsCollector();
   *
   * // Custom configuration
   * const collector = new MetricsCollector({
   *   windowDurationMs: 300000,  // 5 minute window
   *   maxHistorySize: 5000
   * });
   * ```
   */
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
   * Records a metric event.
   *
   * Events are stored in history (up to `maxHistorySize`) and used to
   * calculate aggregated statistics. The 'metric' event is emitted
   * for real-time subscribers.
   *
   * @param event - The metric event to record
   *
   * @example
   * ```typescript
   * collector.record({
   *   type: 'pool:acquire',
   *   timestamp: Date.now(),
   *   sessionName: 'my-session',
   *   durationMs: 150,
   *   reused: true,
   *   poolSize: 2
   * });
   * ```
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
   * Gets metrics for a specific session.
   *
   * Returns aggregated metrics including timing statistics, counts,
   * rates, and circuit breaker state for the specified session.
   *
   * @param sessionName - The session identifier
   *
   * @returns Session metrics, or undefined if no data for session
   *
   * @example
   * ```typescript
   * const metrics = collector.getSessionMetrics('my-session');
   * if (metrics) {
   *   console.log(`Acquisitions: ${metrics.totalAcquisitions}`);
   *   console.log(`Avg acquire time: ${metrics.acquireTiming.avgMs}ms`);
   *   console.log(`Failure rate: ${(metrics.failureRate * 100).toFixed(1)}%`);
   * }
   * ```
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
   * Gets a summary of all metrics across all sessions.
   *
   * Provides a global view including total browsers, aggregate rates,
   * circuit breaker health, and per-session breakdowns.
   *
   * @returns Global metrics summary
   *
   * @example
   * ```typescript
   * const summary = collector.getSummary();
   * console.log(`Total sessions: ${summary.totalSessions}`);
   * console.log(`Active browsers: ${summary.totalActiveBrowsers}`);
   * console.log(`Global failure rate: ${(summary.globalFailureRate * 100).toFixed(1)}%`);
   *
   * for (const session of summary.sessions) {
   *   console.log(`  ${session.sessionName}: ${session.activeBrowsers} active`);
   * }
   * ```
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
   * Subscribes to metric events.
   *
   * The listener is called whenever a new metric event is recorded.
   *
   * @param event - Must be 'metric'
   * @param listener - Callback function receiving the metric event
   *
   * @returns This instance for chaining
   *
   * @example
   * ```typescript
   * collector.on('metric', (event) => {
   *   if (event.type === 'pool:failure') {
   *     console.error(`Pool failure: ${event.error}`);
   *   }
   * });
   * ```
   */
  override on(event: 'metric', listener: (event: MetricEvent) => void): this {
    return super.on(event, listener)
  }

  /**
   * Unsubscribes from metric events.
   *
   * @param event - Must be 'metric'
   * @param listener - The previously registered callback to remove
   *
   * @returns This instance for chaining
   */
  override off(event: 'metric', listener: (event: MetricEvent) => void): this {
    return super.off(event, listener)
  }

  /**
   * Resets all collected metrics.
   *
   * Clears all session data and event history. The time window is
   * also reset to start from the current time.
   *
   * @example
   * ```typescript
   * // Clear all metrics and start fresh
   * collector.reset();
   * ```
   */
  reset(): void {
    this.sessionData.clear()
    this.windowStartTime = Date.now()
  }

  /**
   * Gets the collector configuration.
   *
   * @returns The resolved configuration with defaults applied
   */
  getConfig(): Required<MetricsCollectorConfig> {
    return { ...this.config }
  }

  /**
   * Gets the raw event history for all sessions.
   *
   * Returns events grouped by session name, useful for analysis
   * or custom export formats.
   *
   * @param sessionName - Optional: filter to specific session
   *
   * @returns Event history by session, or events for specified session
   *
   * @example
   * ```typescript
   * // Get all history
   * const history = collector.getHistory();
   *
   * // Get history for specific session
   * const sessionHistory = collector.getHistory('my-session');
   * ```
   */
  getHistory(sessionName?: string): Record<string, MetricEvent[]> | MetricEvent[] {
    if (sessionName) {
      const data = this.sessionData.get(sessionName)
      return data ? [...data.events] : []
    }

    const result: Record<string, MetricEvent[]> = {}
    for (const [name, data] of this.sessionData.entries()) {
      if (name !== '__global__') {
        result[name] = [...data.events]
      }
    }
    return result
  }

  /**
   * Exports metrics to JSON format.
   *
   * Includes summary, per-session metrics, and optionally the raw
   * event history.
   *
   * @param options - Export options
   * @param options.includeHistory - Include raw event history (default: false)
   * @param options.pretty - Pretty-print JSON (default: true)
   *
   * @returns JSON string of exported metrics
   *
   * @example
   * ```typescript
   * // Export summary only
   * const json = collector.exportToJSON();
   * fs.writeFileSync('metrics.json', json);
   *
   * // Export with full history
   * const fullJson = collector.exportToJSON({ includeHistory: true });
   * ```
   */
  exportToJSON(options: { includeHistory?: boolean; pretty?: boolean } = {}): string {
    const { includeHistory = false, pretty = true } = options

    const exportData: {
      exportedAt: string
      summary: MetricsSummary
      history?: Record<string, MetricEvent[]>
    } = {
      exportedAt: new Date().toISOString(),
      summary: this.getSummary(),
    }

    if (includeHistory) {
      const history = this.getHistory()
      if (typeof history === 'object' && !Array.isArray(history)) {
        exportData.history = history
      }
    }

    return pretty ? JSON.stringify(exportData, null, 2) : JSON.stringify(exportData)
  }

  /**
   * Exports metrics to CSV format.
   *
   * Generates a CSV with one row per session, including timing
   * statistics and counts.
   *
   * @returns CSV string of session metrics
   *
   * @example
   * ```typescript
   * const csv = collector.exportToCSV();
   * fs.writeFileSync('metrics.csv', csv);
   * ```
   */
  exportToCSV(): string {
    const summary = this.getSummary()

    // CSV header
    const headers = [
      'session_name',
      'pool_size',
      'active_browsers',
      'idle_browsers',
      'total_acquisitions',
      'total_releases',
      'total_failures',
      'browsers_created',
      'browsers_destroyed',
      'acquisitions_per_minute',
      'failure_rate',
      'circuit_state',
      'circuit_trips',
      'acquire_avg_ms',
      'acquire_min_ms',
      'acquire_max_ms',
      'release_avg_ms',
      'browser_create_avg_ms',
    ]

    const rows: string[] = [headers.join(',')]

    for (const session of summary.sessions) {
      const row = [
        this.escapeCSV(session.sessionName),
        session.poolSize,
        session.activeBrowsers,
        session.idleBrowsers,
        session.totalAcquisitions,
        session.totalReleases,
        session.totalFailures,
        session.browsersCreated,
        session.browsersDestroyed,
        session.acquisitionsPerMinute.toFixed(2),
        session.failureRate.toFixed(4),
        session.circuitState,
        session.circuitTrips,
        session.acquireTiming.avgMs.toFixed(2),
        session.acquireTiming.minMs === Infinity ? '' : session.acquireTiming.minMs.toFixed(2),
        session.acquireTiming.maxMs.toFixed(2),
        session.releaseTiming.avgMs.toFixed(2),
        session.browserCreateTiming.avgMs.toFixed(2),
      ]
      rows.push(row.join(','))
    }

    return rows.join('\n')
  }

  /**
   * Escape a value for CSV format
   */
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }
}
