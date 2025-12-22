/**
 * Human-like timing utilities for stealth mode
 *
 * Provides functions to add realistic delays between browser actions,
 * making automated browsing appear more human-like.
 *
 * @module browser-automation/stealth/timing-utils
 */

import type { StealthTimingConfig } from '@lesca/shared/types'

/**
 * Resolved timing configuration with all defaults applied
 */
export interface ResolvedTimingConfig {
  enabled: boolean
  minDelay: number
  maxDelay: number
  jitter: boolean
}

/**
 * Resolve timing configuration with defaults
 *
 * @param config - User-provided timing configuration
 * @returns Resolved configuration with all defaults applied
 */
export function resolveTimingConfig(config?: StealthTimingConfig): ResolvedTimingConfig {
  return {
    enabled: config?.enabled ?? false,
    minDelay: config?.minDelay ?? 50,
    maxDelay: config?.maxDelay ?? 200,
    jitter: config?.jitter ?? true,
  }
}

/**
 * Calculate a human-like delay between actions
 *
 * Uses a combination of base delay and optional jitter to create
 * timing patterns that appear more natural.
 *
 * @param config - Resolved timing configuration
 * @returns Delay in milliseconds (0 if disabled)
 *
 * @example
 * ```typescript
 * const delay = calculateDelay({
 *   enabled: true,
 *   minDelay: 100,
 *   maxDelay: 300,
 *   jitter: true
 * })
 * // Returns a value between ~85 and ~345 (with jitter)
 * ```
 */
export function calculateDelay(config: ResolvedTimingConfig): number {
  if (!config.enabled) {
    return 0
  }

  // Calculate base delay using uniform distribution
  const baseDelay = config.minDelay + Math.random() * (config.maxDelay - config.minDelay)

  if (config.jitter) {
    // Add gaussian-like jitter (roughly +/- 15% of base delay)
    // Using Box-Muller transform approximation for more natural distribution
    const u1 = Math.random()
    const u2 = Math.random()
    const gaussianRandom = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)

    // Scale jitter to be roughly +/- 15% of base delay
    const jitterAmount = gaussianRandom * 0.15 * baseDelay

    return Math.max(0, Math.round(baseDelay + jitterAmount))
  }

  return Math.round(baseDelay)
}

/**
 * Sleep for a human-like duration
 *
 * @param config - Resolved timing configuration
 * @returns Promise that resolves after the calculated delay
 *
 * @example
 * ```typescript
 * const config = resolveTimingConfig({ enabled: true, minDelay: 100 })
 * await humanDelay(config)
 * // Waits for a random human-like duration
 * ```
 */
export async function humanDelay(config: ResolvedTimingConfig): Promise<void> {
  const delay = calculateDelay(config)
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

/**
 * Creates a delay function bound to a specific configuration
 *
 * Useful for creating a reusable delay function that maintains
 * consistent timing behavior throughout a session.
 *
 * @param config - User-provided timing configuration
 * @returns A function that returns a Promise resolving after a human-like delay
 *
 * @example
 * ```typescript
 * const delay = createDelayFunction({ enabled: true, minDelay: 50, maxDelay: 150 })
 *
 * await driver.click('#button')
 * await delay()  // Wait for human-like duration
 * await driver.type('#input', 'text')
 * await delay()
 * ```
 */
export function createDelayFunction(config?: StealthTimingConfig): () => Promise<void> {
  const resolvedConfig = resolveTimingConfig(config)

  return () => humanDelay(resolvedConfig)
}

/**
 * Create a typing delay simulator for realistic text input
 *
 * Returns a function that calculates delays between keystrokes,
 * simulating natural typing patterns with variable speed.
 *
 * @param baseWpm - Base words per minute (default: 80)
 * @param variance - Speed variance factor 0-1 (default: 0.3)
 * @returns Function that returns delay in ms for next keystroke
 *
 * @example
 * ```typescript
 * const typingDelay = createTypingDelay(60, 0.4)
 * for (const char of text) {
 *   await page.keyboard.type(char)
 *   await new Promise(r => setTimeout(r, typingDelay()))
 * }
 * ```
 */
export function createTypingDelay(baseWpm = 80, variance = 0.3): () => number {
  // Average characters per word is ~5, so chars per minute = wpm * 5
  const baseCharsPerMinute = baseWpm * 5
  const baseDelayMs = 60000 / baseCharsPerMinute

  return () => {
    // Add variance to simulate natural typing speed fluctuation
    const varianceFactor = 1 + (Math.random() - 0.5) * 2 * variance
    return Math.round(baseDelayMs * varianceFactor)
  }
}
