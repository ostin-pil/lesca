/**
 * User agent rotation utilities for stealth mode
 *
 * Provides realistic user agent strings and rotation capabilities
 * to help avoid detection based on user agent fingerprinting.
 *
 * @module browser-automation/stealth/user-agents
 */

import type { StealthUserAgentConfig } from '@lesca/shared/types'

/**
 * Collection of modern Chrome user agents across different platforms.
 * Updated to reflect recent Chrome versions (120-122).
 *
 * These represent real user agents from actual Chrome browsers,
 * helping automated browsing appear as legitimate traffic.
 */
export const USER_AGENTS = [
  // Windows - Chrome 120-122
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',

  // macOS - Chrome 120-122
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',

  // Linux - Chrome 120-122
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  // Windows 11 specific
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
] as const

/**
 * Default user agent (most common configuration)
 */
export const DEFAULT_USER_AGENT = USER_AGENTS[0]

/**
 * Resolved user agent configuration with defaults applied
 */
export interface ResolvedUserAgentConfig {
  rotate: boolean
  custom: string
  removeHeadless: boolean
}

/**
 * Resolve user agent configuration with defaults
 *
 * @param config - User-provided configuration
 * @returns Resolved configuration with all defaults applied
 */
export function resolveUserAgentConfig(config?: StealthUserAgentConfig): ResolvedUserAgentConfig {
  return {
    rotate: config?.rotate ?? false,
    custom: config?.custom ?? '',
    removeHeadless: config?.removeHeadless ?? true,
  }
}

/**
 * Get a random user agent from the predefined pool
 *
 * @returns A randomly selected user agent string
 *
 * @example
 * ```typescript
 * const ua = getRandomUserAgent()
 * // 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...'
 * ```
 */
export function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * USER_AGENTS.length)
  return USER_AGENTS[index] ?? DEFAULT_USER_AGENT
}

/**
 * Remove "HeadlessChrome" signature from a user agent string
 *
 * Headless Chrome includes "HeadlessChrome" in the user agent which
 * is a dead giveaway for automated browsing.
 *
 * @param userAgent - Original user agent string
 * @returns Cleaned user agent with headless signatures removed
 *
 * @example
 * ```typescript
 * const ua = removeHeadlessSignature(
 *   'Mozilla/5.0 ... HeadlessChrome/120.0.0.0 ...'
 * )
 * // 'Mozilla/5.0 ... Chrome/120.0.0.0 ...'
 * ```
 */
export function removeHeadlessSignature(userAgent: string): string {
  return userAgent
    .replace(/HeadlessChrome/gi, 'Chrome')
    .replace(/\s*headless\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Get a user agent based on configuration
 *
 * Priority order:
 * 1. Custom user agent (if provided)
 * 2. Random user agent (if rotation enabled)
 * 3. Current/default user agent
 *
 * @param config - Resolved user agent configuration
 * @param currentUserAgent - Current user agent to use as fallback
 * @returns Processed user agent string
 *
 * @example
 * ```typescript
 * // With custom UA
 * getUserAgent({ rotate: false, custom: 'My UA', removeHeadless: true })
 * // 'My UA'
 *
 * // With rotation
 * getUserAgent({ rotate: true, custom: '', removeHeadless: true })
 * // Random UA from pool
 *
 * // With current UA
 * getUserAgent(
 *   { rotate: false, custom: '', removeHeadless: true },
 *   'HeadlessChrome/120.0.0.0'
 * )
 * // 'Chrome/120.0.0.0'
 * ```
 */
export function getUserAgent(config: ResolvedUserAgentConfig, currentUserAgent?: string): string {
  let userAgent: string

  // Priority: custom > rotate > current > default
  if (config.custom) {
    userAgent = config.custom
  } else if (config.rotate) {
    userAgent = getRandomUserAgent()
  } else if (currentUserAgent) {
    userAgent = currentUserAgent
  } else {
    userAgent = DEFAULT_USER_AGENT
  }

  // Apply headless removal if configured
  if (config.removeHeadless) {
    userAgent = removeHeadlessSignature(userAgent)
  }

  return userAgent
}

/**
 * Get platform information from a user agent string
 *
 * Useful for ensuring consistency between user agent and other
 * browser properties like navigator.platform.
 *
 * @param userAgent - User agent string to parse
 * @returns Platform identifier ('Win32', 'MacIntel', 'Linux x86_64')
 */
export function getPlatformFromUserAgent(userAgent: string): string {
  if (userAgent.includes('Windows')) {
    return 'Win32'
  }
  if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) {
    return 'MacIntel'
  }
  if (userAgent.includes('Linux')) {
    return 'Linux x86_64'
  }
  return 'Win32' // Default to Windows
}
