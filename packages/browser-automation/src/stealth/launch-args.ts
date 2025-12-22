/**
 * Stealth-mode browser launch arguments
 *
 * Chrome arguments that help suppress automation detection by disabling
 * features that reveal the browser is being controlled programmatically.
 *
 * @module browser-automation/stealth/launch-args
 */

import type { StealthLaunchArgsConfig } from '@lesca/shared/types'

/**
 * Chrome arguments to suppress automation detection.
 *
 * These flags disable various browser features that are commonly used
 * to detect automated browsing.
 */
export const STEALTH_LAUNCH_ARGS = [
  // Disable automation-controlled feature flag (removes "Chrome is being controlled" banner)
  '--disable-blink-features=AutomationControlled',

  // Disable site isolation features that can leak automation status
  '--disable-features=IsolateOrigins,site-per-process',

  // Disable infobar showing "Chrome is being controlled by automated software"
  '--disable-infobars',

  // Skip first run experience dialogs
  '--no-first-run',
  '--no-default-browser-check',

  // Use basic password store to avoid keyring prompts
  '--password-store=basic',
  '--use-mock-keychain',

  // Disable extensions (often detected as automation signature)
  '--disable-extensions',

  // Disable background timer throttling for consistent timing
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',

  // Disable hang monitor (prevents timeout dialogs)
  '--disable-hang-monitor',

  // Disable popup blocking for smoother navigation
  '--disable-popup-blocking',

  // Disable prompt on repost
  '--disable-prompt-on-repost',

  // Disable sync to avoid account prompts
  '--disable-sync',

  // Disable translate popup
  '--disable-translate',

  // Metrics and crash reporting
  '--metrics-recording-only',
  '--no-report-upload',
] as const

/**
 * Resolved launch args configuration with defaults applied
 */
export interface ResolvedLaunchArgsConfig {
  suppressAutomationFlags: boolean
  additionalArgs: string[]
}

/**
 * Resolve launch args configuration with defaults
 *
 * @param config - User-provided configuration
 * @returns Resolved configuration with all defaults applied
 */
export function resolveLaunchArgsConfig(
  config?: StealthLaunchArgsConfig
): ResolvedLaunchArgsConfig {
  return {
    suppressAutomationFlags: config?.suppressAutomationFlags ?? true,
    additionalArgs: config?.additionalArgs ?? [],
  }
}

/**
 * Get stealth launch arguments based on configuration
 *
 * @param config - Launch args configuration
 * @returns Array of Chrome command-line arguments
 *
 * @example
 * ```typescript
 * const args = getStealthLaunchArgs({
 *   suppressAutomationFlags: true,
 *   additionalArgs: ['--proxy-server=http://localhost:8080']
 * })
 * // Returns [...STEALTH_LAUNCH_ARGS, '--proxy-server=http://localhost:8080']
 * ```
 */
export function getStealthLaunchArgs(config: ResolvedLaunchArgsConfig): string[] {
  const args: string[] = []

  if (config.suppressAutomationFlags) {
    args.push(...STEALTH_LAUNCH_ARGS)
  }

  args.push(...config.additionalArgs)

  return args
}
