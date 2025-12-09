import type { BrowserDriver, PoolStatistics } from '@lesca/shared/types'
import type { Browser, BrowserContext, Cookie, LaunchOptions } from 'playwright'

/**
 * Session storage data structure
 */
export interface SessionData {
  name: string
  cookies: Cookie[]
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  metadata: SessionMetadata
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  created: number
  lastUsed: number
  expires?: number
  userAgent?: string
  description?: string
}

/**
 * Session options for creation
 */
export interface SessionOptions {
  expires?: number // Timestamp when session expires
  description?: string
  userAgent?: string
}

/**
 * Interface for Session Manager
 */
export interface ISessionManager {
  createSession(
    name: string,
    context: BrowserContext,
    options?: SessionOptions
  ): Promise<SessionData>
  getSession(name: string): Promise<SessionData | null>
  saveSession(name: string, sessionData: SessionData): Promise<void>
  restoreSession(name: string, context: BrowserContext): Promise<boolean>
  listSessions(): Promise<SessionData[]>
  deleteSession(name: string): Promise<boolean>
  sessionExists(name: string): Promise<boolean>
  renameSession(oldName: string, newName: string): Promise<void>
  listActiveSessions(): Promise<SessionData[]>
  validateSession(name: string): Promise<boolean>
  mergeSessions(
    sourceNames: string[],
    targetName: string,
    strategy?: 'keep-existing' | 'prefer-fresh' | 'merge-all'
  ): Promise<SessionData>
  cleanupExpiredSessions(): Promise<number>
}

/**
 * Browser pool configuration
 */
export interface BrowserPoolConfig {
  /** Enable browser pooling */
  enabled?: boolean
  /** Minimum number of browsers to keep ready */
  minSize?: number
  /** Maximum number of concurrent browsers */
  maxSize?: number
  /** Maximum idle time before eviction (ms) */
  maxIdleTime?: number
  /** Reuse pages within browser */
  reusePages?: boolean
}

/**
 * Browser pool statistics
 */
export interface BrowserPoolStats {
  /** Total browsers in pool */
  total: number
  /** Active (in-use) browsers */
  active: number
  /** Idle (available) browsers */
  idle: number
  /** Browsers created (lifetime) */
  created: number
  /** Browsers destroyed (lifetime) */
  destroyed: number
  /** Browsers reused (lifetime) */
  reused: number
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open'

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState
  failures: number
  successes: number
  lastFailureTime: number | undefined
  lastSuccessTime: number | undefined
  totalCalls: number
  totalFailures: number
  totalSuccesses: number
}

/**
 * Interface for Browser Pool
 */
export interface IBrowserPool {
  acquire(): Promise<Browser>
  release(browser: Browser): Promise<void>
  drain(): Promise<void>
  getStats(): BrowserPoolStats
  getConfig(): Required<BrowserPoolConfig>
  getCircuitBreakerStats(): CircuitBreakerStats
  resetCircuitBreaker(): void
}

/**
 * Interface for Session Pool Manager
 */
export interface ISessionPoolManager {
  getPool(sessionName: string): IBrowserPool
  acquireBrowser(sessionName: string): Promise<Browser>
  releaseBrowser(browser: Browser, sessionName: string): Promise<void>
  getStatistics(sessionName?: string): PoolStatistics[]
  drainSessionPool(sessionName: string): Promise<void>
  drainAll(): Promise<void>
}

/**
 * Browser Service Options
 */
export interface BrowserServiceOptions {
  sessionName?: string // undefined = ephemeral
  persistOnShutdown?: boolean // save session on close
  autoRestore?: boolean // restore session on start
  auth?: {
    username?: string
    password?: string
  }
}

/**
 * Interface for Browser Service
 */
export interface IBrowserService {
  getDriver(): BrowserDriver
  startup(options?: LaunchOptions): Promise<void>
  shutdown(): Promise<void>
  getSessionName(): string | undefined
  isPoolingEnabled(): boolean
}

// ============================================================================
// Metrics & Monitoring Types
// ============================================================================

/**
 * Pool metric event types
 */
export type PoolEventType =
  | 'pool:acquire'
  | 'pool:release'
  | 'pool:failure'
  | 'pool:exhausted'
  | 'pool:browser-created'
  | 'pool:browser-destroyed'
  | 'circuit:trip'
  | 'circuit:reset'
  | 'circuit:half-open'

/**
 * Base metric event
 */
export interface BaseMetricEvent {
  type: PoolEventType
  timestamp: number
  sessionName?: string
}

/**
 * Pool acquire event
 */
export interface PoolAcquireEvent extends BaseMetricEvent {
  type: 'pool:acquire'
  durationMs: number
  reused: boolean
  poolSize: number
}

/**
 * Pool release event
 */
export interface PoolReleaseEvent extends BaseMetricEvent {
  type: 'pool:release'
  durationMs: number
  poolSize: number
}

/**
 * Pool failure event
 */
export interface PoolFailureEvent extends BaseMetricEvent {
  type: 'pool:failure'
  error: string
  errorCode?: string
}

/**
 * Pool exhausted event
 */
export interface PoolExhaustedEvent extends BaseMetricEvent {
  type: 'pool:exhausted'
  waitTimeMs: number
  poolSize: number
  maxSize: number
}

/**
 * Browser created event
 */
export interface BrowserCreatedEvent extends BaseMetricEvent {
  type: 'pool:browser-created'
  durationMs: number
  poolSize: number
}

/**
 * Browser destroyed event
 */
export interface BrowserDestroyedEvent extends BaseMetricEvent {
  type: 'pool:browser-destroyed'
  poolSize: number
  reason: 'idle' | 'drain' | 'error' | 'disconnected'
}

/**
 * Circuit breaker trip event
 */
export interface CircuitTripEvent extends BaseMetricEvent {
  type: 'circuit:trip'
  failures: number
  threshold: number
}

/**
 * Circuit breaker reset event
 */
export interface CircuitResetEvent extends BaseMetricEvent {
  type: 'circuit:reset'
  previousState: CircuitState
}

/**
 * Circuit breaker half-open event
 */
export interface CircuitHalfOpenEvent extends BaseMetricEvent {
  type: 'circuit:half-open'
  timeSinceTrip: number
}

/**
 * Union type for all metric events
 */
export type MetricEvent =
  | PoolAcquireEvent
  | PoolReleaseEvent
  | PoolFailureEvent
  | PoolExhaustedEvent
  | BrowserCreatedEvent
  | BrowserDestroyedEvent
  | CircuitTripEvent
  | CircuitResetEvent
  | CircuitHalfOpenEvent

/**
 * Timing statistics
 */
export interface TimingStats {
  count: number
  totalMs: number
  minMs: number
  maxMs: number
  avgMs: number
}

/**
 * Aggregated metrics for a session pool
 */
export interface SessionMetrics {
  sessionName: string
  /** Current pool state */
  poolSize: number
  activeBrowsers: number
  idleBrowsers: number
  /** Timing stats */
  acquireTiming: TimingStats
  releaseTiming: TimingStats
  browserCreateTiming: TimingStats
  /** Counts */
  totalAcquisitions: number
  totalReleases: number
  totalFailures: number
  browsersCreated: number
  browsersDestroyed: number
  /** Rates (per minute, calculated over window) */
  acquisitionsPerMinute: number
  failureRate: number // 0-1
  /** Circuit breaker */
  circuitState: CircuitState
  circuitTrips: number
  /** Timestamps */
  firstEventAt: number | undefined
  lastEventAt: number | undefined
}

/**
 * Global metrics summary
 */
export interface MetricsSummary {
  /** Per-session metrics */
  sessions: SessionMetrics[]
  /** Global stats */
  totalSessions: number
  totalActiveBrowsers: number
  totalIdleBrowsers: number
  globalAcquisitionsPerMinute: number
  globalFailureRate: number
  /** System health */
  circuitsOpen: number
  circuitsHalfOpen: number
  /** Time window */
  windowStartTime: number
  windowDurationMs: number
}

/**
 * Metrics collector configuration
 */
export interface MetricsCollectorConfig {
  /** Time window for rate calculations (ms) */
  windowDurationMs?: number
  /** Maximum events to keep in history */
  maxHistorySize?: number
  /** Enable detailed event logging */
  verbose?: boolean
}

/**
 * Interface for Metrics Collector
 */
export interface IMetricsCollector {
  /** Record a metric event */
  record(event: MetricEvent): void
  /** Get metrics for a specific session */
  getSessionMetrics(sessionName: string): SessionMetrics | undefined
  /** Get summary of all metrics */
  getSummary(): MetricsSummary
  /** Subscribe to metric events */
  on(event: 'metric', listener: (event: MetricEvent) => void): void
  /** Unsubscribe from metric events */
  off(event: 'metric', listener: (event: MetricEvent) => void): void
  /** Reset all metrics */
  reset(): void
}
