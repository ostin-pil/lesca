/**
 * Browser Automation Package
 * Provides headless browser automation for JavaScript-rendered content
 */

export { PlaywrightDriver } from './playwright-driver'
export { SelectorManager } from './selector-manager'
export { SessionManager } from './session-manager'
export { BrowserPool } from './pool'
export { CookieManager } from './cookie-manager'
export { AuthHelper } from './auth-helper'

export type {
  SessionData,
  SessionMetadata,
  SessionOptions,
} from './session-manager'
export type {
  BrowserPoolConfig,
  BrowserPoolStats,
} from './pool'
export type {
  CookieValidationResult,
  MergeStrategy,
} from './cookie-manager'
export type {
  LoginCredentials,
  LoginOptions,
  LoginResult,
} from './auth-helper'
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
