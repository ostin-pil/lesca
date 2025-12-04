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
