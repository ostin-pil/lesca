/**
 * Browser Automation Package
 * Provides headless browser automation for JavaScript-rendered content
 */

export { AuthHelper } from './auth-helper'
export { BrowserPool } from './pool'
export { CircuitBreaker } from './circuit-breaker'
export { CookieManager } from './cookie-manager'
export { PerformanceMonitor } from './performance'
export { PlaywrightDriver } from './playwright-driver'
export { RequestInterceptor } from './interceptor'
export { SelectorManager } from './selector-manager'
export { SessionManager } from './session-manager'
export { SessionPoolManager } from './session-pool-manager'
export { BrowserService } from './browser-service'
export { BrowserServiceFactory } from './browser-service-factory'

export type {
  ISessionManager,
  IBrowserPool,
  ISessionPoolManager,
  IBrowserService,
  BrowserServiceOptions,
  SessionData,
  SessionMetadata,
  SessionOptions,
  BrowserPoolConfig,
  BrowserPoolStats,
  CircuitState,
  CircuitBreakerStats,
} from './interfaces'
export type { CircuitBreakerConfig } from './circuit-breaker'
export type { CookieValidationResult, MergeStrategy } from './cookie-manager'
export type { LoginCredentials, LoginOptions, LoginResult } from './auth-helper'
export type { LoginState } from './detectors'

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
