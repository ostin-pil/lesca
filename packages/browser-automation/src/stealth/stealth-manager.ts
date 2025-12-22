/**
 * StealthManager - Main orchestrator for browser stealth features
 *
 * Manages the application of stealth techniques to browser instances,
 * including evasion scripts, launch arguments, and user agent handling.
 *
 * @module browser-automation/stealth/stealth-manager
 */

import type { StealthConfig } from '@lesca/shared/types'
import { logger } from '@lesca/shared/utils'
import type { Page } from 'playwright'

import {
  getEnabledEvasionScripts,
  resolveEvasionConfig,
  type ResolvedEvasionConfig,
} from './evasion-scripts'
import {
  getStealthLaunchArgs,
  resolveLaunchArgsConfig,
  type ResolvedLaunchArgsConfig,
} from './launch-args'
import { resolveTimingConfig, type ResolvedTimingConfig } from './timing-utils'
import { getUserAgent, resolveUserAgentConfig, type ResolvedUserAgentConfig } from './user-agents'

/**
 * Fully resolved stealth configuration with all defaults applied
 */
export interface ResolvedStealthConfig {
  /** Whether stealth mode is enabled */
  enabled: boolean
  /** Resolved evasion configuration */
  evasions: ResolvedEvasionConfig
  /** Resolved launch arguments configuration */
  launchArgs: ResolvedLaunchArgsConfig
  /** Resolved timing configuration */
  timing: ResolvedTimingConfig
  /** Resolved user agent configuration */
  userAgent: ResolvedUserAgentConfig
}

/**
 * StealthManager handles applying stealth techniques to browser instances.
 *
 * Following the pattern of RequestInterceptor and PerformanceMonitor,
 * this class is instantiated conditionally in PlaywrightDriver.launch()
 * and attached to pages to apply evasion techniques.
 *
 * @example
 * ```typescript
 * const manager = new StealthManager({
 *   enabled: true,
 *   evasions: { webdriver: true, chromeRuntime: true },
 *   timing: { enabled: true, minDelay: 100 }
 * })
 *
 * // Get launch args for browser
 * const args = manager.getLaunchArgs()
 *
 * // Get processed user agent
 * const ua = manager.getUserAgent()
 *
 * // Apply evasions to page
 * await manager.applyToPage(page)
 * ```
 */
export class StealthManager {
  private config: ResolvedStealthConfig

  /**
   * Create a new StealthManager instance
   *
   * @param config - Stealth configuration options
   */
  constructor(config: StealthConfig = {}) {
    this.config = this.resolveConfig(config)
  }

  /**
   * Resolve user configuration with defaults
   *
   * @param config - User-provided configuration
   * @returns Fully resolved configuration
   */
  private resolveConfig(config: StealthConfig): ResolvedStealthConfig {
    return {
      enabled: config.enabled ?? false,
      evasions: resolveEvasionConfig(config.evasions),
      launchArgs: resolveLaunchArgsConfig(config.launchArgs),
      timing: resolveTimingConfig(config.timing),
      userAgent: resolveUserAgentConfig(config.userAgent),
    }
  }

  /**
   * Apply stealth evasions to a page via addInitScript
   *
   * This method injects JavaScript that runs before any other scripts
   * on the page, modifying browser APIs to avoid detection.
   *
   * @param page - Playwright page instance
   *
   * @example
   * ```typescript
   * const page = await browser.newPage()
   * await stealthManager.applyToPage(page)
   * await page.goto('https://example.com')
   * ```
   */
  async applyToPage(page: Page): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    const scripts = getEnabledEvasionScripts(this.config.evasions)

    if (scripts.length === 0) {
      logger.debug('Stealth mode enabled but no evasions configured')
      return
    }

    // Apply each evasion script
    const applyPromises = scripts.map((script) => page.addInitScript(script))

    await Promise.all(applyPromises)

    // Log which evasions were applied
    const enabledEvasions = Object.entries(this.config.evasions)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)

    logger.debug('Applied stealth evasions to page', {
      evasionCount: scripts.length,
      enabledEvasions,
    })
  }

  /**
   * Get browser launch arguments for stealth mode
   *
   * Returns Chrome command-line arguments that help suppress
   * automation detection at the browser level.
   *
   * @returns Array of Chrome command-line arguments
   *
   * @example
   * ```typescript
   * const args = stealthManager.getLaunchArgs()
   * const browser = await chromium.launch({ args })
   * ```
   */
  getLaunchArgs(): string[] {
    if (!this.config.enabled) {
      return []
    }

    return getStealthLaunchArgs(this.config.launchArgs)
  }

  /**
   * Get processed user agent string
   *
   * Returns a user agent based on configuration, applying rotation
   * or headless signature removal as configured.
   *
   * @param currentUserAgent - Current user agent to use as fallback
   * @returns Processed user agent string
   *
   * @example
   * ```typescript
   * // With rotation enabled
   * const ua = stealthManager.getUserAgent()
   * const page = await browser.newPage({ userAgent: ua })
   * ```
   */
  getUserAgent(currentUserAgent?: string): string {
    if (!this.config.enabled) {
      return currentUserAgent ?? ''
    }

    return getUserAgent(this.config.userAgent, currentUserAgent)
  }

  /**
   * Get the resolved configuration
   *
   * @returns Copy of the resolved configuration object
   */
  getConfig(): ResolvedStealthConfig {
    return { ...this.config }
  }

  /**
   * Check if stealth mode is enabled
   *
   * @returns True if stealth mode is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Get the timing configuration for human-like delays
   *
   * @returns Resolved timing configuration
   */
  getTimingConfig(): ResolvedTimingConfig {
    return { ...this.config.timing }
  }

  /**
   * Get list of enabled evasion names
   *
   * @returns Array of enabled evasion technique names
   */
  getEnabledEvasions(): string[] {
    return Object.entries(this.config.evasions)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
  }
}
