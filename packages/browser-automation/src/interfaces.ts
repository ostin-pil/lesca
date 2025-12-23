/**
 * Browser Automation Interfaces
 *
 * This module defines the core interfaces and types for the browser-automation package.
 * These interfaces provide contracts for browser pooling, session management, and metrics.
 *
 * @module browser-automation/interfaces
 */

import type { BrowserDriver, PoolStatistics } from '@lesca/shared/types'
import type { Browser, BrowserContext, Cookie, LaunchOptions } from 'playwright'

// ============================================================================
// Encryption Types
// ============================================================================

/**
 * Interface for Encryption Service.
 *
 * Defines the contract for encrypting/decrypting session and cookie data.
 * Used to protect sensitive authentication tokens stored on disk.
 *
 * @see {@link EncryptionService} for the default implementation
 */
export interface IEncryptionService {
  /** Check if encryption is enabled */
  isEnabled(): boolean
  /** Encrypt plaintext data */
  encrypt(plaintext: string): string
  /** Decrypt ciphertext data */
  decrypt(ciphertext: string): string
  /** Check if data is in encrypted format */
  isEncrypted(data: string): boolean
}

// ============================================================================
// Session Management Types
// ============================================================================

/**
 * Session storage data structure.
 *
 * Contains all browser session state that can be persisted and restored,
 * including cookies, localStorage, sessionStorage, and metadata.
 *
 * @example
 * ```typescript
 * const session: SessionData = {
 *   name: 'leetcode-auth',
 *   cookies: await context.cookies(),
 *   localStorage: { 'user.token': 'abc123' },
 *   sessionStorage: {},
 *   metadata: {
 *     created: Date.now(),
 *     lastUsed: Date.now(),
 *     description: 'LeetCode authentication session'
 *   }
 * };
 * ```
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
 * Interface for Session Manager.
 *
 * Defines the contract for managing persistent browser sessions.
 * Implementations handle saving, loading, and restoring browser state.
 *
 * @see {@link SessionManager} for the default implementation
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

// ============================================================================
// Browser Pool Types
// ============================================================================

/**
 * Browser pool configuration.
 *
 * Controls how the browser pool manages browser instances, including
 * pool size limits, idle timeout, and page reuse behavior.
 *
 * @example
 * ```typescript
 * const config: BrowserPoolConfig = {
 *   enabled: true,
 *   minSize: 1,
 *   maxSize: 5,
 *   maxIdleTime: 300000,  // 5 minutes
 *   reusePages: true
 * };
 * ```
 */
export interface BrowserPoolConfig {
  /** Enable browser pooling. When false, creates new browser for each acquire. */
  enabled?: boolean
  /** Minimum number of browsers to keep ready (warm pool). Default: 0 */
  minSize?: number
  /** Maximum number of concurrent browsers. Default: 3 */
  maxSize?: number
  /** Maximum idle time before eviction in milliseconds. Default: 300000 (5 min) */
  maxIdleTime?: number
  /** Close all browser contexts on release for clean state. Default: true */
  reusePages?: boolean
}

/**
 * Browser pool statistics.
 *
 * Provides real-time and lifetime statistics about pool usage.
 * Use for monitoring pool health and optimization.
 *
 * @example
 * ```typescript
 * const stats = pool.getStats();
 * console.log(`Pool utilization: ${stats.active}/${stats.total}`);
 * console.log(`Reuse ratio: ${stats.reused / stats.created}`);
 * ```
 */
export interface BrowserPoolStats {
  /** Current total browsers in pool */
  total: number
  /** Browsers currently in use (acquired but not released) */
  active: number
  /** Browsers available for immediate acquisition */
  idle: number
  /** Total browsers created since pool initialization (lifetime) */
  created: number
  /** Total browsers destroyed since pool initialization (lifetime) */
  destroyed: number
  /** Total times a browser was reused instead of created (lifetime) */
  reused: number
}

// ============================================================================
// Circuit Breaker Types
// ============================================================================

/**
 * Circuit breaker state.
 *
 * - `'closed'`: Normal operation, all calls pass through
 * - `'open'`: Failures exceeded threshold, calls are blocked
 * - `'half-open'`: Testing recovery, limited calls allowed
 */
export type CircuitState = 'closed' | 'open' | 'half-open'

/**
 * Circuit breaker statistics.
 *
 * Provides insight into circuit breaker health and failure patterns.
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
 * Interface for Browser Pool.
 *
 * Defines the contract for managing a pool of reusable browser instances.
 * Implementations handle browser lifecycle, health monitoring, and cleanup.
 *
 * @see {@link BrowserPool} for the default implementation
 */
export interface IBrowserPool {
  /** Acquire a browser instance from the pool */
  acquire(): Promise<Browser>
  /** Release a browser back to the pool */
  release(browser: Browser): Promise<void>
  /** Close all browsers and shutdown the pool */
  drain(): Promise<void>
  /** Get current pool statistics */
  getStats(): BrowserPoolStats
  /** Get pool configuration */
  getConfig(): Required<BrowserPoolConfig>
  /** Get circuit breaker statistics */
  getCircuitBreakerStats(): CircuitBreakerStats
  /** Reset circuit breaker to closed state */
  resetCircuitBreaker(): void
}

/**
 * Interface for Session Pool Manager.
 *
 * Defines the contract for managing per-session browser pools.
 * Implementations coordinate multiple pools with shared resource limits.
 *
 * @see {@link SessionPoolManager} for the default implementation
 */
export interface ISessionPoolManager {
  /** Get or create a browser pool for a session */
  getPool(sessionName: string): IBrowserPool
  /** Acquire a browser for a session with timeout and retry */
  acquireBrowser(sessionName: string): Promise<Browser>
  /** Release a browser back to its session pool */
  releaseBrowser(browser: Browser, sessionName: string): Promise<void>
  /** Get statistics for one or all sessions */
  getStatistics(sessionName?: string): PoolStatistics[]
  /** Drain a specific session's pool */
  drainSessionPool(sessionName: string): Promise<void>
  /** Drain all session pools */
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
 * Pool metric event types.
 *
 * Categorizes events by operation type for filtering and analysis.
 *
 * Pool events:
 * - `'pool:acquire'`: Browser acquired from pool
 * - `'pool:release'`: Browser released to pool
 * - `'pool:failure'`: Pool operation failed
 * - `'pool:exhausted'`: Pool at max capacity, waiting for browser
 * - `'pool:browser-created'`: New browser instance created
 * - `'pool:browser-destroyed'`: Browser instance closed
 *
 * Circuit breaker events:
 * - `'circuit:trip'`: Circuit opened due to failures
 * - `'circuit:reset'`: Circuit closed after recovery
 * - `'circuit:half-open'`: Circuit entering half-open state
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
 * Interface for Metrics Collector.
 *
 * Defines the contract for collecting and aggregating pool metrics.
 * Implementations handle event recording, aggregation, and subscription.
 *
 * @see {@link MetricsCollector} for the default implementation
 */
export interface IMetricsCollector {
  /** Record a metric event to the collector */
  record(event: MetricEvent): void
  /** Get aggregated metrics for a specific session */
  getSessionMetrics(sessionName: string): SessionMetrics | undefined
  /** Get summary of all metrics across all sessions */
  getSummary(): MetricsSummary
  /** Subscribe to real-time metric events */
  on(event: 'metric', listener: (event: MetricEvent) => void): void
  /** Unsubscribe from metric events */
  off(event: 'metric', listener: (event: MetricEvent) => void): void
  /** Reset all collected metrics */
  reset(): void
}
