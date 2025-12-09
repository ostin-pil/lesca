import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, readdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { SessionManager, SessionCleanupScheduler } from '@lesca/browser-automation'

const ONE_DAY = 24 * 60 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000

/**
 * Create a test session file directly on disk
 */
async function createTestSession(
  sessionsDir: string,
  name: string,
  options: { daysOld?: number; expires?: number } = {}
): Promise<void> {
  const { daysOld = 0, expires } = options
  const now = Date.now()
  const lastUsed = now - daysOld * ONE_DAY

  const sessionData = {
    name,
    cookies: [
      {
        name: 'test-cookie',
        value: `value-${name}`,
        domain: '.test.com',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    localStorage: { testKey: `value-${name}` },
    sessionStorage: {},
    metadata: {
      created: lastUsed - ONE_HOUR,
      lastUsed,
      expires,
    },
  }

  await writeFile(join(sessionsDir, `${name}.json`), JSON.stringify(sessionData, null, 2))
}

/**
 * List session files in directory
 */
async function listSessionFiles(sessionsDir: string): Promise<string[]> {
  try {
    const files = await readdir(sessionsDir)
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))
  } catch {
    return []
  }
}

describe('E2E: Session Cleanup Integration', () => {
  let testSessionsDir: string
  let sessionManager: SessionManager

  beforeEach(async () => {
    testSessionsDir = join(
      tmpdir(),
      `lesca-test-cleanup-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    await mkdir(testSessionsDir, { recursive: true })
    sessionManager = new SessionManager(testSessionsDir)
  })

  afterEach(async () => {
    try {
      await rm(testSessionsDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('basic cleanup', () => {
    it('should remove sessions older than default max age (7 days)', async () => {
      // Create sessions with various ages
      await createTestSession(testSessionsDir, 'recent-session', { daysOld: 2 })
      await createTestSession(testSessionsDir, 'old-session', { daysOld: 10 })
      await createTestSession(testSessionsDir, 'very-old-session', { daysOld: 30 })

      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 7 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 0,
      })

      const result = await scheduler.cleanup()

      expect(result.cleaned).toContain('old-session')
      expect(result.cleaned).toContain('very-old-session')
      expect(result.kept).toContain('recent-session')

      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).toContain('recent-session')
      expect(remainingSessions).not.toContain('old-session')
      expect(remainingSessions).not.toContain('very-old-session')
    })

    it('should report "no sessions to clean" when all sessions are recent', async () => {
      await createTestSession(testSessionsDir, 'session-1', { daysOld: 1 })
      await createTestSession(testSessionsDir, 'session-2', { daysOld: 2 })

      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 7 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 0,
      })

      const result = await scheduler.cleanup()

      expect(result.cleaned).toHaveLength(0)
      expect(result.kept).toHaveLength(2)

      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).toHaveLength(2)
    })
  })

  describe('dry-run mode', () => {
    it('should preview cleanup without deleting sessions', async () => {
      await createTestSession(testSessionsDir, 'old-session', { daysOld: 10 })
      await createTestSession(testSessionsDir, 'recent-session', { daysOld: 1 })

      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 7 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 0,
      })

      const result = await scheduler.cleanup({ dryRun: true })

      expect(result.dryRun).toBe(true)
      expect(result.cleaned).toContain('old-session')
      expect(result.kept).toContain('recent-session')

      // Session should still exist
      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).toContain('old-session')
      expect(remainingSessions).toContain('recent-session')
    })
  })

  describe('custom max age', () => {
    it('should apply custom max age threshold', async () => {
      await createTestSession(testSessionsDir, 'session-1-day', { daysOld: 1 })
      await createTestSession(testSessionsDir, 'session-3-days', { daysOld: 3 })
      await createTestSession(testSessionsDir, 'session-5-days', { daysOld: 5 })

      // Set max age to 2 days
      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 2 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 0,
      })

      const result = await scheduler.cleanup()

      expect(result.cleaned).toContain('session-3-days')
      expect(result.cleaned).toContain('session-5-days')
      expect(result.kept).toContain('session-1-day')

      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).toContain('session-1-day')
      expect(remainingSessions).not.toContain('session-3-days')
      expect(remainingSessions).not.toContain('session-5-days')
    })

    it('should keep all sessions when max age is very high', async () => {
      await createTestSession(testSessionsDir, 'session-1', { daysOld: 10 })
      await createTestSession(testSessionsDir, 'session-2', { daysOld: 20 })

      // Set max age to 365 days
      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 365 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 0,
      })

      const result = await scheduler.cleanup()

      expect(result.cleaned).toHaveLength(0)
      expect(result.kept).toHaveLength(2)

      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).toHaveLength(2)
    })
  })

  describe('max sessions limit', () => {
    it('should keep only specified number of most recent sessions', async () => {
      // Create 5 sessions with different ages
      await createTestSession(testSessionsDir, 'newest', { daysOld: 1 })
      await createTestSession(testSessionsDir, 'second', { daysOld: 2 })
      await createTestSession(testSessionsDir, 'third', { daysOld: 3 })
      await createTestSession(testSessionsDir, 'fourth', { daysOld: 4 })
      await createTestSession(testSessionsDir, 'oldest', { daysOld: 5 })

      // Keep only 2 most recent, with high max age to avoid age-based cleanup
      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 30 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 2,
      })

      const result = await scheduler.cleanup()

      expect(result.kept).toHaveLength(2)
      expect(result.kept).toContain('newest')
      expect(result.kept).toContain('second')
      expect(result.cleaned).toContain('third')
      expect(result.cleaned).toContain('fourth')
      expect(result.cleaned).toContain('oldest')

      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).toHaveLength(2)
      expect(remainingSessions).toContain('newest')
      expect(remainingSessions).toContain('second')
    })

    it('should not remove sessions when count is below limit', async () => {
      await createTestSession(testSessionsDir, 'session-1', { daysOld: 1 })
      await createTestSession(testSessionsDir, 'session-2', { daysOld: 2 })

      // Set limit to 5, but only have 2 sessions
      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 30 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 5,
      })

      const result = await scheduler.cleanup()

      expect(result.cleaned).toHaveLength(0)
      expect(result.kept).toHaveLength(2)

      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).toHaveLength(2)
    })
  })

  describe('combined options', () => {
    it('should apply both max age and max sessions', async () => {
      // Create mix of old and recent sessions
      await createTestSession(testSessionsDir, 'recent-1', { daysOld: 1 })
      await createTestSession(testSessionsDir, 'recent-2', { daysOld: 2 })
      await createTestSession(testSessionsDir, 'recent-3', { daysOld: 3 })
      await createTestSession(testSessionsDir, 'old-1', { daysOld: 10 }) // Exceeds age
      await createTestSession(testSessionsDir, 'old-2', { daysOld: 15 }) // Exceeds age

      // Max age 7 days, max sessions 2
      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 7 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 2,
      })

      const result = await scheduler.cleanup()

      // old-1 and old-2 removed by age
      // recent-3 removed by count
      // Only recent-1 and recent-2 remain
      expect(result.kept).toHaveLength(2)
      expect(result.kept).toContain('recent-1')
      expect(result.kept).toContain('recent-2')

      expect(result.cleaned).toContain('old-1')
      expect(result.cleaned).toContain('old-2')
      expect(result.cleaned).toContain('recent-3')

      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).toHaveLength(2)
    })

    it('should work with dry-run and custom options', async () => {
      await createTestSession(testSessionsDir, 'session-1', { daysOld: 1 })
      await createTestSession(testSessionsDir, 'session-2', { daysOld: 5 })
      await createTestSession(testSessionsDir, 'session-3', { daysOld: 10 })

      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 3 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 1,
      })

      const result = await scheduler.cleanup({ dryRun: true })

      expect(result.dryRun).toBe(true)
      // session-2 and session-3 exceed age, session-1 kept by count limit

      // All sessions should still exist
      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).toHaveLength(3)
    })
  })

  describe('edge cases', () => {
    it('should handle empty sessions directory', async () => {
      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 7 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 0,
      })

      const result = await scheduler.cleanup()

      expect(result.cleaned).toHaveLength(0)
      expect(result.kept).toHaveLength(0)
    })

    it('should handle sessions at exactly max age boundary', async () => {
      // Session exactly at 7 day boundary (should be kept due to >= comparison)
      await createTestSession(testSessionsDir, 'boundary-session', { daysOld: 7 })
      // Session just over 7 days (should be cleaned)
      await createTestSession(testSessionsDir, 'over-boundary', { daysOld: 8 })

      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 7 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 0,
      })

      const result = await scheduler.cleanup()

      // The over-boundary session should definitely be cleaned
      expect(result.cleaned).toContain('over-boundary')

      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).not.toContain('over-boundary')
    })

    it('should handle sessions with explicit expiry', async () => {
      // Note: SessionManager.listSessions() already filters out expired sessions
      // before they reach the cleanup scheduler. This test verifies that sessions
      // with explicit future expiry are properly handled.

      // Session with future expiry (not yet expired)
      await createTestSession(testSessionsDir, 'valid-explicit', {
        daysOld: 1,
        expires: Date.now() + ONE_DAY,
      })
      // Session without explicit expiry (subject to age-based cleanup)
      await createTestSession(testSessionsDir, 'old-no-expiry', {
        daysOld: 10,
      })

      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 7 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 0,
      })

      const result = await scheduler.cleanup()

      // old-no-expiry should be cleaned by age
      expect(result.cleaned).toContain('old-no-expiry')
      // valid-explicit should be kept (has future expiry and is recent)
      expect(result.kept).toContain('valid-explicit')

      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).toContain('valid-explicit')
      expect(remainingSessions).not.toContain('old-no-expiry')
    })

    it('should handle single session', async () => {
      await createTestSession(testSessionsDir, 'only-session', { daysOld: 1 })

      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 7 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 1,
      })

      const result = await scheduler.cleanup()

      expect(result.cleaned).toHaveLength(0)
      expect(result.kept).toHaveLength(1)

      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).toHaveLength(1)
    })
  })

  describe('startup cleanup', () => {
    it('should run cleanup on startup when enabled', async () => {
      await createTestSession(testSessionsDir, 'old-session', { daysOld: 10 })
      await createTestSession(testSessionsDir, 'recent-session', { daysOld: 1 })

      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 7 * ONE_DAY,
        cleanupOnStartup: true,
        cleanupInterval: 0,
        maxSessions: 0,
      })

      const result = await scheduler.runStartupCleanup()

      expect(result).not.toBeNull()
      expect(result?.cleaned).toContain('old-session')
      expect(result?.kept).toContain('recent-session')
    })

    it('should skip startup cleanup when disabled', async () => {
      await createTestSession(testSessionsDir, 'old-session', { daysOld: 10 })

      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 7 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 0,
      })

      const result = await scheduler.runStartupCleanup()

      expect(result).toBeNull()

      // Session should still exist
      const remainingSessions = await listSessionFiles(testSessionsDir)
      expect(remainingSessions).toContain('old-session')
    })
  })

  describe('cleanup result structure', () => {
    it('should include all expected fields in result', async () => {
      await createTestSession(testSessionsDir, 'to-clean', { daysOld: 10 })
      await createTestSession(testSessionsDir, 'to-keep', { daysOld: 1 })

      const scheduler = new SessionCleanupScheduler(sessionManager, {
        enabled: true,
        maxSessionAge: 7 * ONE_DAY,
        cleanupOnStartup: false,
        cleanupInterval: 0,
        maxSessions: 0,
      })

      const result = await scheduler.cleanup()

      expect(result).toHaveProperty('cleaned')
      expect(result).toHaveProperty('kept')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('dryRun')
      expect(result).toHaveProperty('timestamp')

      expect(Array.isArray(result.cleaned)).toBe(true)
      expect(Array.isArray(result.kept)).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
      expect(typeof result.dryRun).toBe('boolean')
      expect(typeof result.timestamp).toBe('number')
    })
  })
})
