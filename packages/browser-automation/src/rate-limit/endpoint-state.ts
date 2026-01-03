/**
 * Endpoint State Tracking
 *
 * Tracks per-endpoint rate limit state for intelligent request management.
 * Normalizes URLs to endpoint patterns for grouped tracking.
 *
 * @module browser-automation/rate-limit/endpoint-state
 */

import type { EndpointState } from './types'

// ============================================================================
// URL Normalization
// ============================================================================

/**
 * Normalize a URL to an endpoint pattern.
 *
 * Converts specific paths to patterns for grouped tracking:
 * - `/problems/two-sum` -> `/problems/*`
 * - `/graphql` -> `/graphql`
 * - `https://leetcode.com/problems/two-sum/` -> `/problems/*`
 *
 * @param url - URL or path to normalize
 * @returns Normalized endpoint pattern
 */
export function normalizeEndpoint(url: string): string {
  // Extract pathname from URL
  let pathname: string
  try {
    const parsed = new URL(url, 'https://leetcode.com')
    pathname = parsed.pathname
  } catch {
    pathname = url
  }

  // Remove trailing slash
  pathname = pathname.replace(/\/$/, '')

  // Normalize common LeetCode patterns
  // More specific patterns must come first
  const patterns: Array<{ regex: RegExp; replacement: string }> = [
    // /problems/{slug}/description -> /problems/*/description (most specific first)
    { regex: /^\/problems\/[^/]+\/description$/, replacement: '/problems/*/description' },
    // /problems/{slug}/editorial -> /problems/*/editorial
    { regex: /^\/problems\/[^/]+\/editorial$/, replacement: '/problems/*/editorial' },
    // /problems/{slug}/solutions -> /problems/*/solutions
    { regex: /^\/problems\/[^/]+\/solutions$/, replacement: '/problems/*/solutions' },
    // /problems/{slug}/discuss -> /problems/*/discuss
    { regex: /^\/problems\/[^/]+\/discuss$/, replacement: '/problems/*/discuss' },
    // /problems/{slug} -> /problems/* (less specific, must come last)
    { regex: /^\/problems\/[^/]+$/, replacement: '/problems/*' },
    // /discuss/topic/{id} -> /discuss/topic/*
    { regex: /^\/discuss\/topic\/\d+/, replacement: '/discuss/topic/*' },
  ]

  for (const pattern of patterns) {
    if (pattern.regex.test(pathname)) {
      return pattern.replacement
    }
  }

  // Return pathname as-is for non-matching patterns
  return pathname || '/'
}

// ============================================================================
// Endpoint State Collection
// ============================================================================

/**
 * Create a new empty endpoint state.
 *
 * @param endpoint - Endpoint pattern
 * @returns New endpoint state
 */
function createEmptyState(endpoint: string): EndpointState {
  return {
    endpoint,
    hitCount: 0,
    lastHitTime: 0,
    isRateLimited: false,
    rateLimitedUntil: undefined,
    retryAfterMs: undefined,
    consecutiveFailures: 0,
  }
}

/**
 * Collection for tracking per-endpoint rate limit state.
 *
 * @example
 * ```typescript
 * const states = new EndpointStateCollection()
 *
 * // Track a request
 * states.recordSuccess('/problems/two-sum')
 *
 * // Check if rate limited
 * if (states.isRateLimited('/problems/another')) {
 *   const until = states.getRateLimitedUntil('/problems/another')
 *   await sleep(until - Date.now())
 * }
 *
 * // Record rate limit
 * states.recordRateLimited('/problems/two-sum', 60000)
 * ```
 */
export class EndpointStateCollection {
  private states: Map<string, EndpointState> = new Map()

  /**
   * Get the state for an endpoint.
   *
   * Creates a new state if one doesn't exist.
   *
   * @param url - URL or endpoint pattern
   * @returns Endpoint state
   */
  getState(url: string): EndpointState {
    const endpoint = normalizeEndpoint(url)
    let state = this.states.get(endpoint)

    if (!state) {
      state = createEmptyState(endpoint)
      this.states.set(endpoint, state)
    }

    return state
  }

  /**
   * Record a successful request to an endpoint.
   *
   * Resets consecutive failures and clears rate limit state.
   *
   * @param url - URL or endpoint pattern
   */
  recordSuccess(url: string): void {
    const endpoint = normalizeEndpoint(url)
    let state = this.states.get(endpoint)

    if (!state) {
      state = createEmptyState(endpoint)
      this.states.set(endpoint, state)
    }

    state.hitCount++
    state.lastHitTime = Date.now()
    state.consecutiveFailures = 0

    // Clear rate limit if expired
    if (state.rateLimitedUntil !== undefined && Date.now() >= state.rateLimitedUntil) {
      state.isRateLimited = false
      state.rateLimitedUntil = undefined
      state.retryAfterMs = undefined
    }
  }

  /**
   * Record that an endpoint returned a rate limit response.
   *
   * @param url - URL or endpoint pattern
   * @param retryAfterMs - Optional retry delay from server
   */
  recordRateLimited(url: string, retryAfterMs?: number): void {
    const endpoint = normalizeEndpoint(url)
    let state = this.states.get(endpoint)

    if (!state) {
      state = createEmptyState(endpoint)
      this.states.set(endpoint, state)
    }

    state.hitCount++
    state.lastHitTime = Date.now()
    state.isRateLimited = true
    state.consecutiveFailures++

    if (retryAfterMs !== undefined) {
      state.retryAfterMs = retryAfterMs
      state.rateLimitedUntil = Date.now() + retryAfterMs
    }
  }

  /**
   * Check if an endpoint is currently rate limited.
   *
   * @param url - URL or endpoint pattern
   * @returns True if rate limited
   */
  isRateLimited(url: string): boolean {
    const endpoint = normalizeEndpoint(url)
    const state = this.states.get(endpoint)

    if (!state || !state.isRateLimited) {
      return false
    }

    // Check if rate limit has expired
    if (state.rateLimitedUntil !== undefined && Date.now() >= state.rateLimitedUntil) {
      state.isRateLimited = false
      state.rateLimitedUntil = undefined
      state.retryAfterMs = undefined
      return false
    }

    return true
  }

  /**
   * Get the timestamp when rate limit expires.
   *
   * @param url - URL or endpoint pattern
   * @returns Expiration timestamp, or undefined if not rate limited
   */
  getRateLimitedUntil(url: string): number | undefined {
    const endpoint = normalizeEndpoint(url)
    const state = this.states.get(endpoint)

    if (!state || !state.isRateLimited) {
      return undefined
    }

    return state.rateLimitedUntil
  }

  /**
   * Clear expired rate limit states.
   *
   * Call periodically to clean up old state entries.
   */
  clearExpiredStates(): void {
    const now = Date.now()

    for (const state of this.states.values()) {
      if (state.rateLimitedUntil !== undefined && now >= state.rateLimitedUntil) {
        state.isRateLimited = false
        state.rateLimitedUntil = undefined
        state.retryAfterMs = undefined
      }
    }
  }

  /**
   * Get all endpoint states.
   *
   * @returns Array of all endpoint states
   */
  getAll(): EndpointState[] {
    return Array.from(this.states.values())
  }

  /**
   * Clear all state.
   */
  clear(): void {
    this.states.clear()
  }

  /**
   * Get the number of tracked endpoints.
   */
  get size(): number {
    return this.states.size
  }
}
