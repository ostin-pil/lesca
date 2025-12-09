import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SessionCleanupScheduler } from '../session-cleanup-scheduler'
import type { ISessionManager, SessionData } from '../interfaces'

vi.mock('@lesca/shared/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const ONE_DAY = 24 * 60 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000

/**
 * Create a mock session with specified age
 */
function createMockSession(
  name: string,
  lastUsedDaysAgo: number,
  options: { expires?: number } = {}
): SessionData {
  const now = Date.now()
  return {
    name,
    cookies: [
      {
        name: 'test',
        value: 'value',
        domain: '.test.com',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    localStorage: {},
    sessionStorage: {},
    metadata: {
      created: now - lastUsedDaysAgo * ONE_DAY - ONE_HOUR,
      lastUsed: now - lastUsedDaysAgo * ONE_DAY,
      expires: options.expires,
    },
  }
}

/**
 * Create a mock session manager
 */
function createMockSessionManager(sessions: SessionData[] = []): ISessionManager {
  const sessionMap = new Map(sessions.map((s) => [s.name, s]))

  return {
    listSessions: vi.fn().mockResolvedValue([...sessionMap.values()]),
    deleteSession: vi.fn().mockImplementation(async (name: string) => {
      const exists = sessionMap.has(name)
      sessionMap.delete(name)
      return exists
    }),
    getSession: vi.fn().mockImplementation(async (name: string) => sessionMap.get(name) ?? null),
    saveSession: vi.fn().mockResolvedValue(undefined),
    sessionExists: vi.fn().mockImplementation(async (name: string) => sessionMap.has(name)),
    createSession: vi.fn().mockRejectedValue(new Error('Not implemented in mock')),
    restoreSession: vi.fn().mockResolvedValue(true),
    listActiveSessions: vi.fn().mockResolvedValue([...sessionMap.values()]),
    cleanupExpiredSessions: vi.fn().mockResolvedValue(0),
    validateSession: vi.fn().mockResolvedValue(true),
    renameSession: vi.fn().mockResolvedValue(undefined),
    mergeSessions: vi.fn().mockRejectedValue(new Error('Not implemented in mock')),
  }
}

describe('SessionCleanupScheduler', () => {
  let mockSessionManager: ISessionManager

  beforeEach(() => {
    vi.useFakeTimers()
    mockSessionManager = createMockSessionManager()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create with default config when none provided', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager)
      const config = scheduler.getConfig()

      expect(config.enabled).toBe(true)
      expect(config.maxSessionAge).toBe(7 * ONE_DAY)
      expect(config.cleanupOnStartup).toBe(true)
      expect(config.cleanupInterval).toBe(0)
      expect(config.maxSessions).toBe(0)
    })

    it('should merge partial config with defaults', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 14 * ONE_DAY,
        maxSessions: 5,
      })
      const config = scheduler.getConfig()

      expect(config.enabled).toBe(true) // default
      expect(config.maxSessionAge).toBe(14 * ONE_DAY) // custom
      expect(config.cleanupOnStartup).toBe(true) // default
      expect(config.maxSessions).toBe(5) // custom
    })
  })

  describe('runStartupCleanup', () => {
    it('should return null when enabled is false', async () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: false,
      })

      const result = await scheduler.runStartupCleanup()

      expect(result).toBeNull()
      expect(mockSessionManager.listSessions).not.toHaveBeenCalled()
    })

    it('should return null when cleanupOnStartup is false', async () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: true,
        cleanupOnStartup: false,
      })

      const result = await scheduler.runStartupCleanup()

      expect(result).toBeNull()
      expect(mockSessionManager.listSessions).not.toHaveBeenCalled()
    })

    it('should run cleanup when both enabled and cleanupOnStartup are true', async () => {
      const sessions = [createMockSession('old-session', 10)]
      mockSessionManager = createMockSessionManager(sessions)

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: true,
        cleanupOnStartup: true,
        maxSessionAge: 7 * ONE_DAY,
      })

      const result = await scheduler.runStartupCleanup()

      expect(result).not.toBeNull()
      expect(result?.cleaned).toContain('old-session')
      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith('old-session')
    })
  })

  describe('start / stop', () => {
    it('should not start when enabled is false', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: false,
        cleanupInterval: 1000,
      })

      scheduler.start()

      expect(scheduler.isSchedulerRunning()).toBe(false)
    })

    it('should not start when cleanupInterval is 0', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: true,
        cleanupInterval: 0,
      })

      scheduler.start()

      expect(scheduler.isSchedulerRunning()).toBe(false)
    })

    it('should not start when cleanupInterval is negative', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: true,
        cleanupInterval: -1000,
      })

      scheduler.start()

      expect(scheduler.isSchedulerRunning()).toBe(false)
    })

    it('should start interval timer when properly configured', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: true,
        cleanupInterval: 1000,
      })

      scheduler.start()

      expect(scheduler.isSchedulerRunning()).toBe(true)

      scheduler.stop()
    })

    it('should warn if already running', async () => {
      const { logger } = await import('@lesca/shared/utils')

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: true,
        cleanupInterval: 1000,
      })

      scheduler.start()
      scheduler.start() // Second call

      expect(logger.warn).toHaveBeenCalledWith('Cleanup scheduler already running')

      scheduler.stop()
    })

    it('should stop and clear interval', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: true,
        cleanupInterval: 1000,
      })

      scheduler.start()
      expect(scheduler.isSchedulerRunning()).toBe(true)

      scheduler.stop()
      expect(scheduler.isSchedulerRunning()).toBe(false)
    })

    it('should run cleanup at configured interval', async () => {
      const sessions = [createMockSession('session-1', 1)]
      mockSessionManager = createMockSessionManager(sessions)

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: true,
        cleanupInterval: 1000,
        maxSessionAge: 7 * ONE_DAY,
      })

      scheduler.start()

      // Advance time by interval
      await vi.advanceTimersByTimeAsync(1000)

      expect(mockSessionManager.listSessions).toHaveBeenCalled()

      scheduler.stop()
    })
  })

  describe('cleanup', () => {
    it('should return early when cleanup is already running', async () => {
      const sessions = [createMockSession('session-1', 10)]
      mockSessionManager = createMockSessionManager(sessions)

      // Make listSessions slow
      vi.mocked(mockSessionManager.listSessions).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(sessions), 100))
      )

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 7 * ONE_DAY,
      })

      // Start first cleanup
      const firstCleanup = scheduler.cleanup()

      // Try second cleanup immediately
      const secondResult = await scheduler.cleanup()

      expect(secondResult.cleaned).toHaveLength(0)
      expect(secondResult.kept).toHaveLength(0)

      // Let first cleanup complete
      await vi.advanceTimersByTimeAsync(100)
      await firstCleanup
    })

    it('should handle empty session list', async () => {
      mockSessionManager = createMockSessionManager([])

      const scheduler = new SessionCleanupScheduler(mockSessionManager)

      const result = await scheduler.cleanup()

      expect(result.cleaned).toHaveLength(0)
      expect(result.kept).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should clean sessions older than maxSessionAge', async () => {
      const sessions = [
        createMockSession('old-session', 10), // 10 days old
        createMockSession('recent-session', 2), // 2 days old
      ]
      mockSessionManager = createMockSessionManager(sessions)

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 7 * ONE_DAY,
      })

      const result = await scheduler.cleanup()

      expect(result.cleaned).toContain('old-session')
      expect(result.kept).toContain('recent-session')
      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith('old-session')
      expect(mockSessionManager.deleteSession).not.toHaveBeenCalledWith('recent-session')
    })

    it('should clean sessions past explicit expiry', async () => {
      const expiredSession = createMockSession('expired', 1, {
        expires: Date.now() - ONE_HOUR, // Expired 1 hour ago
      })
      const validSession = createMockSession('valid', 1, {
        expires: Date.now() + ONE_DAY, // Expires tomorrow
      })
      const sessions = [expiredSession, validSession]
      mockSessionManager = createMockSessionManager(sessions)

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 7 * ONE_DAY,
      })

      const result = await scheduler.cleanup()

      expect(result.cleaned).toContain('expired')
      expect(result.kept).toContain('valid')
    })

    it('should keep only maxSessions most recent sessions', async () => {
      const sessions = [
        createMockSession('session-1', 1), // Most recent
        createMockSession('session-2', 2),
        createMockSession('session-3', 3),
        createMockSession('session-4', 4),
        createMockSession('session-5', 5), // Oldest
      ]
      mockSessionManager = createMockSessionManager(sessions)

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 30 * ONE_DAY, // High enough to not trigger age-based cleanup
        maxSessions: 3,
      })

      const result = await scheduler.cleanup()

      // Should keep 3 most recent
      expect(result.kept).toHaveLength(3)
      expect(result.kept).toContain('session-1')
      expect(result.kept).toContain('session-2')
      expect(result.kept).toContain('session-3')

      // Should clean 2 oldest
      expect(result.cleaned).toHaveLength(2)
      expect(result.cleaned).toContain('session-4')
      expect(result.cleaned).toContain('session-5')
    })

    it('should not delete sessions in dry-run mode', async () => {
      const sessions = [createMockSession('old-session', 10)]
      mockSessionManager = createMockSessionManager(sessions)

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 7 * ONE_DAY,
      })

      const result = await scheduler.cleanup({ dryRun: true })

      expect(result.dryRun).toBe(true)
      expect(result.cleaned).toContain('old-session')
      expect(mockSessionManager.deleteSession).not.toHaveBeenCalled()
    })

    it('should collect errors for failed deletions', async () => {
      const sessions = [createMockSession('session-1', 10), createMockSession('session-2', 10)]
      mockSessionManager = createMockSessionManager(sessions)

      // Make first deletion fail
      vi.mocked(mockSessionManager.deleteSession).mockImplementation(async (name: string) => {
        if (name === 'session-1') {
          throw new Error('Disk full')
        }
        return true
      })

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 7 * ONE_DAY,
      })

      const result = await scheduler.cleanup()

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.session).toBe('session-1')
      expect(result.errors[0]?.error).toBe('Disk full')
      expect(result.cleaned).toContain('session-2')
    })

    it('should include timestamp in result', async () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager)

      const before = Date.now()
      const result = await scheduler.cleanup()
      const after = Date.now()

      expect(result.timestamp).toBeGreaterThanOrEqual(before)
      expect(result.timestamp).toBeLessThanOrEqual(after)
    })

    it('should combine age-based and count-based cleanup', async () => {
      const sessions = [
        createMockSession('recent-1', 1),
        createMockSession('recent-2', 2),
        createMockSession('recent-3', 3),
        createMockSession('old-1', 10), // Will be removed by age
        createMockSession('old-2', 12), // Will be removed by age
      ]
      mockSessionManager = createMockSessionManager(sessions)

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 7 * ONE_DAY,
        maxSessions: 2, // Keep only 2 most recent
      })

      const result = await scheduler.cleanup()

      // old-1 and old-2 removed by age
      // recent-3 removed by count (only 2 allowed)
      expect(result.cleaned).toHaveLength(3)
      expect(result.cleaned).toContain('old-1')
      expect(result.cleaned).toContain('old-2')
      expect(result.cleaned).toContain('recent-3')

      // Only 2 most recent kept
      expect(result.kept).toHaveLength(2)
      expect(result.kept).toContain('recent-1')
      expect(result.kept).toContain('recent-2')
    })
  })

  describe('getConfig', () => {
    it('should return copy of config', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 14 * ONE_DAY,
      })

      const config1 = scheduler.getConfig()
      const config2 = scheduler.getConfig()

      expect(config1).not.toBe(config2) // Different objects
      expect(config1).toEqual(config2) // Same values
    })
  })

  describe('updateConfig', () => {
    it('should update config values', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 7 * ONE_DAY,
      })

      scheduler.updateConfig({ maxSessionAge: 14 * ONE_DAY })

      expect(scheduler.getConfig().maxSessionAge).toBe(14 * ONE_DAY)
    })

    it('should restart scheduler if it was running', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: true,
        cleanupInterval: 1000,
      })

      scheduler.start()
      expect(scheduler.isSchedulerRunning()).toBe(true)

      scheduler.updateConfig({ cleanupInterval: 2000 })

      expect(scheduler.isSchedulerRunning()).toBe(true)
      expect(scheduler.getConfig().cleanupInterval).toBe(2000)

      scheduler.stop()
    })

    it('should not restart scheduler if it was not running', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: true,
        cleanupInterval: 1000,
      })

      expect(scheduler.isSchedulerRunning()).toBe(false)

      scheduler.updateConfig({ cleanupInterval: 2000 })

      expect(scheduler.isSchedulerRunning()).toBe(false)
    })
  })

  describe('isSchedulerRunning', () => {
    it('should return false initially', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager)

      expect(scheduler.isSchedulerRunning()).toBe(false)
    })

    it('should return true when started', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: true,
        cleanupInterval: 1000,
      })

      scheduler.start()

      expect(scheduler.isSchedulerRunning()).toBe(true)

      scheduler.stop()
    })

    it('should return false after stop', () => {
      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        enabled: true,
        cleanupInterval: 1000,
      })

      scheduler.start()
      scheduler.stop()

      expect(scheduler.isSchedulerRunning()).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle sessions with same lastUsed time', async () => {
      const now = Date.now()
      const sessions = [
        {
          ...createMockSession('session-a', 0),
          metadata: { created: now, lastUsed: now },
        },
        {
          ...createMockSession('session-b', 0),
          metadata: { created: now, lastUsed: now },
        },
        {
          ...createMockSession('session-c', 0),
          metadata: { created: now, lastUsed: now },
        },
      ]
      mockSessionManager = createMockSessionManager(sessions)

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 30 * ONE_DAY,
        maxSessions: 2,
      })

      const result = await scheduler.cleanup()

      // Should keep 2 and clean 1
      expect(result.kept).toHaveLength(2)
      expect(result.cleaned).toHaveLength(1)
    })

    it('should handle maxSessions of 0 (unlimited)', async () => {
      const sessions = [
        createMockSession('session-1', 1),
        createMockSession('session-2', 2),
        createMockSession('session-3', 3),
      ]
      mockSessionManager = createMockSessionManager(sessions)

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 30 * ONE_DAY, // No age-based cleanup
        maxSessions: 0, // Unlimited
      })

      const result = await scheduler.cleanup()

      expect(result.kept).toHaveLength(3)
      expect(result.cleaned).toHaveLength(0)
    })

    it('should handle non-Error exceptions during deletion', async () => {
      const sessions = [createMockSession('session-1', 10)]
      mockSessionManager = createMockSessionManager(sessions)

      vi.mocked(mockSessionManager.deleteSession).mockRejectedValue('String error')

      const scheduler = new SessionCleanupScheduler(mockSessionManager, {
        maxSessionAge: 7 * ONE_DAY,
      })

      const result = await scheduler.cleanup()

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.error).toBe('String error')
    })
  })
})
