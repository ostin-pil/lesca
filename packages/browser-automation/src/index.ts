/**
 * Browser Automation Package
 * Provides headless browser automation for JavaScript-rendered content
 */

export { AuthHelper } from './auth-helper'
export { BrowserPool } from './pool'
export { CircuitBreaker } from './circuit-breaker'
export { CookieManager } from './cookie-manager'
export { MetricsCollector } from './metrics-collector'
export { PerformanceMonitor } from './performance'
export { PlaywrightDriver } from './playwright-driver'
export { RequestInterceptor } from './interceptor'
export { SelectorManager } from './selector-manager'
export { SessionManager } from './session-manager'
export { SessionPoolManager } from './session-pool-manager'
export { SessionCleanupScheduler } from './session-cleanup-scheduler'
export { BrowserService } from './browser-service'
export { BrowserServiceFactory } from './browser-service-factory'

// Stealth module exports
export { StealthManager } from './stealth'
export type { ResolvedStealthConfig } from './stealth'
export {
  // User agent utilities
  USER_AGENTS,
  DEFAULT_USER_AGENT,
  getRandomUserAgent,
  removeHeadlessSignature,
  getUserAgent,
  getPlatformFromUserAgent,
  // Timing utilities
  calculateDelay,
  humanDelay,
  createDelayFunction,
  createTypingDelay,
  // Launch arguments
  STEALTH_LAUNCH_ARGS,
  getStealthLaunchArgs,
  // Evasion scripts
  getEvasionScripts,
  getEnabledEvasionScripts,
} from './stealth'

export type {
  ISessionManager,
  IBrowserPool,
  ISessionPoolManager,
  IBrowserService,
  IMetricsCollector,
  BrowserServiceOptions,
  SessionData,
  SessionMetadata,
  SessionOptions,
  BrowserPoolConfig,
  BrowserPoolStats,
  CircuitState,
  CircuitBreakerStats,
  // Metrics types
  PoolEventType,
  MetricEvent,
  BaseMetricEvent,
  PoolAcquireEvent,
  PoolReleaseEvent,
  PoolFailureEvent,
  PoolExhaustedEvent,
  BrowserCreatedEvent,
  BrowserDestroyedEvent,
  CircuitTripEvent,
  CircuitResetEvent,
  CircuitHalfOpenEvent,
  TimingStats,
  SessionMetrics,
  MetricsSummary,
  MetricsCollectorConfig,
} from './interfaces'
export type { CircuitBreakerConfig } from './circuit-breaker'
export type { CookieValidationResult, MergeStrategy } from './cookie-manager'
export type { LoginCredentials, LoginOptions, LoginResult } from './auth-helper'
export type { LoginState } from './detectors'
export type { CleanupResult } from './session-cleanup-scheduler'

export {
  detectLoginState,
  detectCaptcha,
  detectRateLimit,
  detectProblemPage,
  detectEditorialPage,
  detectDiscussionPage,
  detectErrorPage,
  detectPremiumRequired,
  waitForState,
} from './detectors'
