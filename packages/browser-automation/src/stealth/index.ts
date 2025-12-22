/**
 * Stealth module for browser automation
 *
 * Provides anti-detection capabilities for browser automation,
 * helping to avoid bot detection when scraping websites.
 *
 * @module browser-automation/stealth
 *
 * @example
 * ```typescript
 * import { StealthManager } from '@lesca/browser-automation'
 *
 * const manager = new StealthManager({
 *   enabled: true,
 *   evasions: { webdriver: true, chromeRuntime: true },
 *   timing: { enabled: true, minDelay: 100, maxDelay: 300 },
 *   userAgent: { rotate: true }
 * })
 *
 * // Get launch args for browser
 * const args = manager.getLaunchArgs()
 *
 * // Apply evasions to page
 * await manager.applyToPage(page)
 * ```
 */

// Main class
export { StealthManager, type ResolvedStealthConfig } from './stealth-manager'

// Evasion scripts
export {
  getEvasionScripts,
  getEnabledEvasionScripts,
  getWebdriverEvasion,
  getChromeRuntimeEvasion,
  getChromePermissionsEvasion,
  getPluginsEvasion,
  getLanguagesEvasion,
  getIframeContentWindowEvasion,
  getWebglVendorEvasion,
  getCanvasEvasion,
  getMediaCodecsEvasion,
  resolveEvasionConfig,
  type EvasionScript,
  type EvasionScripts,
  type ResolvedEvasionConfig,
} from './evasion-scripts'

// Launch arguments
export {
  STEALTH_LAUNCH_ARGS,
  getStealthLaunchArgs,
  resolveLaunchArgsConfig,
  type ResolvedLaunchArgsConfig,
} from './launch-args'

// Timing utilities
export {
  calculateDelay,
  humanDelay,
  createDelayFunction,
  createTypingDelay,
  resolveTimingConfig,
  type ResolvedTimingConfig,
} from './timing-utils'

// User agent utilities
export {
  USER_AGENTS,
  DEFAULT_USER_AGENT,
  getRandomUserAgent,
  removeHeadlessSignature,
  getUserAgent,
  getPlatformFromUserAgent,
  resolveUserAgentConfig,
  type ResolvedUserAgentConfig,
} from './user-agents'
