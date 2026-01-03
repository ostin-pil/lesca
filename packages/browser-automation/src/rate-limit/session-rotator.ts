/**
 * Session Rotator
 *
 * Distributes requests across multiple sessions to avoid rate limiting.
 * Supports round-robin, least-loaded, and least-errors distribution strategies.
 *
 * @module browser-automation/rate-limit/session-rotator
 */

import type { SessionInfo, SessionRotationConfig } from './types'

// ============================================================================
// Default Configuration
// ============================================================================

/** Default session rotation configuration */
export const DEFAULT_SESSION_ROTATION_CONFIG: Required<SessionRotationConfig> = {
  enabled: false,
  cooldownMs: 30000,
  distributionStrategy: 'round-robin',
}

/**
 * Resolve session rotation configuration with defaults.
 *
 * @param config - Partial configuration
 * @returns Fully resolved configuration
 */
export function resolveSessionRotationConfig(
  config?: SessionRotationConfig
): Required<SessionRotationConfig> {
  return {
    enabled: config?.enabled ?? DEFAULT_SESSION_ROTATION_CONFIG.enabled,
    cooldownMs: config?.cooldownMs ?? DEFAULT_SESSION_ROTATION_CONFIG.cooldownMs,
    distributionStrategy:
      config?.distributionStrategy ?? DEFAULT_SESSION_ROTATION_CONFIG.distributionStrategy,
  }
}

// ============================================================================
// Session Rotator
// ============================================================================

/**
 * Create a new session info object.
 *
 * @param id - Session identifier
 * @returns New session info
 */
function createSessionInfo(id: string): SessionInfo {
  return {
    id,
    requestCount: 0,
    errorCount: 0,
    cooldownUntil: undefined,
    lastRequestTime: undefined,
  }
}

/**
 * Session rotator for distributing requests across multiple sessions.
 *
 * @example
 * ```typescript
 * const rotator = new SessionRotator({
 *   enabled: true,
 *   distributionStrategy: 'least-loaded'
 * })
 *
 * rotator.registerSession('session-1')
 * rotator.registerSession('session-2')
 *
 * const nextSession = rotator.selectSession()
 * if (nextSession) {
 *   // Use this session for the next request
 * }
 * ```
 */
export class SessionRotator {
  private sessions: Map<string, SessionInfo> = new Map()
  private roundRobinIndex: number = 0
  private config: Required<SessionRotationConfig>

  /**
   * Create a new session rotator.
   *
   * @param config - Rotation configuration
   */
  constructor(config?: SessionRotationConfig) {
    this.config = resolveSessionRotationConfig(config)
  }

  /**
   * Register a session for rotation.
   *
   * @param sessionId - Session identifier
   */
  registerSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, createSessionInfo(sessionId))
    }
  }

  /**
   * Unregister a session from rotation.
   *
   * @param sessionId - Session identifier
   */
  unregisterSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  /**
   * Record a successful request for a session.
   *
   * @param sessionId - Session identifier
   */
  recordSuccess(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.requestCount++
      session.lastRequestTime = Date.now()
    }
  }

  /**
   * Record a rate limit for a session.
   *
   * Increments error count but does not automatically set cooldown.
   * Use setCooldown() to put the session on cooldown.
   *
   * @param sessionId - Session identifier
   */
  recordRateLimit(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.errorCount++
      session.requestCount++
      session.lastRequestTime = Date.now()
    }
  }

  /**
   * Set cooldown for a session.
   *
   * A session on cooldown will not be selected until the cooldown expires.
   *
   * @param sessionId - Session identifier
   * @param durationMs - Cooldown duration in milliseconds
   */
  setCooldown(sessionId: string, durationMs?: number): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      const duration = durationMs ?? this.config.cooldownMs
      session.cooldownUntil = Date.now() + duration
    }
  }

  /**
   * Check if a session is currently on cooldown.
   *
   * @param sessionId - Session identifier
   * @returns True if on cooldown
   */
  isOnCooldown(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || session.cooldownUntil === undefined) {
      return false
    }

    if (Date.now() >= session.cooldownUntil) {
      session.cooldownUntil = undefined
      return false
    }

    return true
  }

  /**
   * Get all sessions that are not on cooldown.
   *
   * @returns Array of available session IDs
   */
  getAvailableSessions(): string[] {
    const available: string[] = []
    const now = Date.now()

    for (const session of this.sessions.values()) {
      if (session.cooldownUntil === undefined || now >= session.cooldownUntil) {
        if (session.cooldownUntil !== undefined && now >= session.cooldownUntil) {
          session.cooldownUntil = undefined
        }
        available.push(session.id)
      }
    }

    return available
  }

  /**
   * Select the next session based on the distribution strategy.
   *
   * @returns Session ID, or undefined if no sessions available
   */
  selectSession(): string | undefined {
    const available = this.getAvailableSessions()

    if (available.length === 0) {
      return undefined
    }

    switch (this.config.distributionStrategy) {
      case 'round-robin':
        return this.selectRoundRobin(available)
      case 'least-loaded':
        return this.selectLeastLoaded(available)
      case 'least-errors':
        return this.selectLeastErrors(available)
    }
  }

  /**
   * Get session info by ID.
   *
   * @param sessionId - Session identifier
   * @returns Session info or undefined
   */
  getSessionInfo(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get all session info.
   *
   * @returns Array of session info
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Get the number of registered sessions.
   */
  get size(): number {
    return this.sessions.size
  }

  /**
   * Clear all sessions.
   */
  clear(): void {
    this.sessions.clear()
    this.roundRobinIndex = 0
  }

  // ============================================================================
  // Selection Strategies
  // ============================================================================

  /**
   * Round-robin selection.
   *
   * Cycles through sessions in registration order.
   */
  private selectRoundRobin(available: string[]): string {
    // Reset index if it exceeds available sessions
    if (this.roundRobinIndex >= available.length) {
      this.roundRobinIndex = 0
    }

    const selected = available[this.roundRobinIndex]
    this.roundRobinIndex = (this.roundRobinIndex + 1) % available.length

    // Type guard for noUncheckedIndexedAccess
    if (!selected) {
      return available[0] ?? ''
    }

    return selected
  }

  /**
   * Least-loaded selection.
   *
   * Picks the session with the fewest total requests.
   */
  private selectLeastLoaded(available: string[]): string | undefined {
    let minRequests = Infinity
    let selected: string | undefined

    for (const sessionId of available) {
      const session = this.sessions.get(sessionId)
      if (session && session.requestCount < minRequests) {
        minRequests = session.requestCount
        selected = sessionId
      }
    }

    return selected
  }

  /**
   * Least-errors selection.
   *
   * Picks the session with the lowest error rate.
   * Falls back to least-loaded if all sessions have 0 errors.
   */
  private selectLeastErrors(available: string[]): string | undefined {
    let minErrorRate = Infinity
    let selected: string | undefined
    let allZeroErrors = true

    for (const sessionId of available) {
      const session = this.sessions.get(sessionId)
      if (session) {
        if (session.errorCount > 0) {
          allZeroErrors = false
        }

        // Calculate error rate (errors / requests), defaulting to 0 for new sessions
        const errorRate = session.requestCount > 0 ? session.errorCount / session.requestCount : 0

        if (errorRate < minErrorRate) {
          minErrorRate = errorRate
          selected = sessionId
        }
      }
    }

    // If all sessions have 0 errors, fall back to least-loaded
    if (allZeroErrors) {
      return this.selectLeastLoaded(available)
    }

    return selected
  }
}
