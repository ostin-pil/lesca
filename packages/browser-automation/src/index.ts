/**
 * Browser Automation Package
 * Provides headless browser automation for JavaScript-rendered content
 */

export { PlaywrightDriver } from './playwright-driver.js'
export { SelectorManager } from './selector-manager.js'
export { SessionManager } from './session-manager.js'
export { BrowserPool } from './pool.js'
export { CookieManager } from './cookie-manager.js'
export { AuthHelper } from './auth-helper.js'

export type {
  SessionData,
  SessionMetadata,
  SessionOptions,
} from './session-manager.js'
export type {
  BrowserPoolConfig,
  BrowserPoolStats,
} from './pool.js'
export type {
  CookieValidationResult,
  MergeStrategy,
} from './cookie-manager.js'
export type {
  LoginCredentials,
  LoginOptions,
  LoginResult,
} from './auth-helper.js'
export type { LoginState } from './detectors.js'

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
} from './detectors.js'
