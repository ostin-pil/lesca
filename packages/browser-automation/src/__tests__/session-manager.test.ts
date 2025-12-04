import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SessionManager } from '../session-manager'
import { mkdir, rm, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { BrowserContext, Cookie } from 'playwright'

vi.mock('@lesca/shared/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const anHour = 3600000

describe('SessionManager', () => {
  let sessionManager: SessionManager
  let testSessionsDir: string
  let mockContext: BrowserContext

  beforeEach(async () => {
    testSessionsDir = join(tmpdir(), `lesca-test-sessions-${Date.now()}`)
    await mkdir(testSessionsDir, { recursive: true })

    sessionManager = new SessionManager(testSessionsDir)

    mockContext = {
      cookies: vi.fn().mockResolvedValue([
        {
          name: 'LEETCODE_SESSION',
          value: 'test-session-value',
          domain: '.leetcode.com',
          path: '/',
          expires: Date.now() / 1000 + 3600,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax' as const,
        },
        {
          name: 'csrftoken',
          value: 'test-csrf-token',
          domain: '.leetcode.com',
          path: '/',
          expires: Date.now() / 1000 + 3600,
          httpOnly: false,
          secure: true,
          sameSite: 'Lax' as const,
        },
      ] as Cookie[]),
      pages: vi.fn().mockReturnValue([
        {
          evaluate: vi
            .fn()
            .mockResolvedValueOnce({ 'user-preference': 'dark-mode' }) // localStorage
            .mockResolvedValueOnce({ 'session-id': 'abc123' }), // sessionStorage
        },
      ]),
      addCookies: vi.fn().mockResolvedValue(undefined),
    } as unknown as BrowserContext
  })

  afterEach(async () => {
    try {
      await rm(testSessionsDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('createSession', () => {
    it('should create a new session with cookies and storage', async () => {
      const sessionData = await sessionManager.createSession('test-session', mockContext)

      expect(sessionData.name).toBe('test-session')
      expect(sessionData.cookies).toHaveLength(2)
      expect(sessionData.cookies[0]?.name).toBe('LEETCODE_SESSION')
      expect(sessionData.metadata.created).toBeDefined()
      expect(sessionData.metadata.lastUsed).toBeDefined()
    })

    it('should create session with custom options', async () => {
      const expires = Date.now() + 86400000 // 24 hours
      const sessionData = await sessionManager.createSession('test-session', mockContext, {
        expires,
        description: 'Test session for unit tests',
        userAgent: 'Mozilla/5.0 Test',
      })

      expect(sessionData.metadata.expires).toBe(expires)
      expect(sessionData.metadata.description).toBe('Test session for unit tests')
      expect(sessionData.metadata.userAgent).toBe('Mozilla/5.0 Test')
    })

    it('should save session to disk', async () => {
      await sessionManager.createSession('test-session', mockContext)

      const sessionPath = join(testSessionsDir, 'test-session.json')
      const data = await readFile(sessionPath, 'utf-8')
      const parsed = JSON.parse(data)

      expect(parsed.name).toBe('test-session')
      expect(parsed.cookies).toBeDefined()
    })

    it('should sanitize session name to prevent directory traversal', async () => {
      await sessionManager.createSession('../../../malicious', mockContext)

      const sessionPath = join(testSessionsDir, '_________malicious.json')
      const exists = await readFile(sessionPath).then(
        () => true,
        () => false
      )

      expect(exists).toBe(true)
    })
  })

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      await sessionManager.createSession('test-session', mockContext)

      const retrieved = await sessionManager.getSession('test-session')

      expect(retrieved).not.toBeNull()
      expect(retrieved?.name).toBe('test-session')
      expect(retrieved?.cookies).toHaveLength(2)
    })

    it('should return null for non-existent session', async () => {
      const retrieved = await sessionManager.getSession('non-existent')

      expect(retrieved).toBeNull()
    })

    it('should update last used timestamp on retrieval', async () => {
      await sessionManager.createSession('test-session', mockContext)

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10))

      const firstRetrieval = await sessionManager.getSession('test-session')
      const firstLastUsed = firstRetrieval!.metadata.lastUsed

      // Wait a bit more
      await new Promise((resolve) => setTimeout(resolve, 10))

      const secondRetrieval = await sessionManager.getSession('test-session')
      const secondLastUsed = secondRetrieval!.metadata.lastUsed

      expect(secondLastUsed).toBeGreaterThan(firstLastUsed)
    })

    it('should delete expired sessions', async () => {
      const pastTime = Date.now() - anHour

      await sessionManager.createSession('expired-session', mockContext, {
        expires: pastTime,
      })

      const retrieved = await sessionManager.getSession('expired-session')

      expect(retrieved).toBeNull()

      // Session file should be deleted
      const sessionPath = join(testSessionsDir, 'expired-session.json')
      const exists = await readFile(sessionPath).then(
        () => true,
        () => false
      )
      expect(exists).toBe(false)
    })
  })

  describe('saveSession', () => {
    it('should save session data to disk', async () => {
      const sessionData = {
        name: 'manual-session',
        cookies: [
          {
            name: 'test-cookie',
            value: 'test-value',
            domain: '.example.com',
            path: '/',
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax' as const,
          },
        ],
        localStorage: {},
        sessionStorage: {},
        metadata: {
          created: Date.now(),
          lastUsed: Date.now(),
        },
      }

      await sessionManager.saveSession('manual-session', sessionData)

      const sessionPath = join(testSessionsDir, 'manual-session.json')
      const data = await readFile(sessionPath, 'utf-8')
      const parsed = JSON.parse(data)

      expect(parsed.name).toBe('manual-session')
      expect(parsed.cookies[0].name).toBe('test-cookie')
    })
  })

  describe('restoreSession', () => {
    it('should restore session to browser context', async () => {
      await sessionManager.createSession('test-session', mockContext)

      const restored = await sessionManager.restoreSession('test-session', mockContext)

      expect(restored).toBe(true)
      expect(mockContext.addCookies).toHaveBeenCalled()
    })

    it('should return false for non-existent session', async () => {
      const restored = await sessionManager.restoreSession('non-existent', mockContext)

      expect(restored).toBe(false)
    })

    it('should restore localStorage and sessionStorage', async () => {
      const mockPage = {
        evaluate: vi
          .fn()
          .mockResolvedValueOnce({ 'user-preference': 'dark-mode' })
          .mockResolvedValueOnce({ 'session-id': 'abc123' })
          .mockResolvedValue(undefined), // For restore operations
      }

      const contextWithPage = {
        ...mockContext,
        pages: vi.fn().mockReturnValue([mockPage]),
      } as unknown as BrowserContext

      await sessionManager.createSession('test-session', contextWithPage)
      await sessionManager.restoreSession('test-session', contextWithPage)

      expect(mockPage.evaluate).toHaveBeenCalled()
    })
  })

  describe('listSessions', () => {
    it('should list all saved sessions', async () => {
      await sessionManager.createSession('session-1', mockContext)
      await sessionManager.createSession('session-2', mockContext)
      await sessionManager.createSession('session-3', mockContext)

      const sessions = await sessionManager.listSessions()

      expect(sessions).toHaveLength(3)
      expect(sessions.map((s) => s.name)).toContain('session-1')
      expect(sessions.map((s) => s.name)).toContain('session-2')
      expect(sessions.map((s) => s.name)).toContain('session-3')
    })

    it('should filter out expired sessions', async () => {
      const pastTime = Date.now() - anHour
      const futureTime = Date.now() + anHour

      await sessionManager.createSession('expired-session', mockContext, {
        expires: pastTime,
      })
      await sessionManager.createSession('valid-session', mockContext, {
        expires: futureTime,
      })

      const sessions = await sessionManager.listSessions()

      expect(sessions).toHaveLength(1)
      expect(sessions[0]?.name).toBe('valid-session')
    })

    it('should return empty array when no sessions exist', async () => {
      const sessions = await sessionManager.listSessions()

      expect(sessions).toEqual([])
    })
  })

  describe('deleteSession', () => {
    it('should delete an existing session', async () => {
      await sessionManager.createSession('test-session', mockContext)

      const deleted = await sessionManager.deleteSession('test-session')

      expect(deleted).toBe(true)

      const retrieved = await sessionManager.getSession('test-session')
      expect(retrieved).toBeNull()
    })

    it('should return false for non-existent session', async () => {
      const deleted = await sessionManager.deleteSession('non-existent')

      expect(deleted).toBe(false)
    })
  })

  describe('sessionExists', () => {
    it('should return true for existing session', async () => {
      await sessionManager.createSession('test-session', mockContext)

      const exists = await sessionManager.sessionExists('test-session')

      expect(exists).toBe(true)
    })

    it('should return false for non-existent session', async () => {
      const exists = await sessionManager.sessionExists('non-existent')

      expect(exists).toBe(false)
    })
  })

  describe('cleanupExpiredSessions', () => {
    it('should remove all expired sessions', async () => {
      const pastTime = Date.now() - anHour
      const futureTime = Date.now() + anHour

      await sessionManager.createSession('expired-1', mockContext, {
        expires: pastTime,
      })
      await sessionManager.createSession('expired-2', mockContext, {
        expires: pastTime,
      })
      await sessionManager.createSession('valid-session', mockContext, {
        expires: futureTime,
      })

      const cleanedCount = await sessionManager.cleanupExpiredSessions()

      expect(cleanedCount).toBe(2)

      const sessions = await sessionManager.listSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0]?.name).toBe('valid-session')
    })

    it('should return 0 when no sessions are expired', async () => {
      const futureTime = Date.now() + anHour

      await sessionManager.createSession('valid-session', mockContext, {
        expires: futureTime,
      })

      const cleanedCount = await sessionManager.cleanupExpiredSessions()

      expect(cleanedCount).toBe(0)
    })
  })

  describe('concurrent access', () => {
    it('should handle multiple sessions being created concurrently', async () => {
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(sessionManager.createSession(`concurrent-${i}`, mockContext))
      }

      await Promise.all(promises)

      const sessions = await sessionManager.listSessions()
      expect(sessions).toHaveLength(10)
    })

    it('should handle concurrent reads and writes', async () => {
      await sessionManager.createSession('test-session', mockContext)

      const operations = [
        sessionManager.getSession('test-session'),
        sessionManager.getSession('test-session'),
        sessionManager.createSession('another-session', mockContext),
        sessionManager.listSessions(),
      ]

      await expect(Promise.all(operations)).resolves.toBeDefined()
    })
  })

  describe('renameSession', () => {
    it('should rename an existing session', async () => {
      await sessionManager.createSession('old-name', mockContext)

      await sessionManager.renameSession('old-name', 'new-name')

      const oldSession = await sessionManager.getSession('old-name')
      const newSession = await sessionManager.getSession('new-name')

      expect(oldSession).toBeNull()
      expect(newSession).toBeDefined()
      expect(newSession?.name).toBe('new-name')
    })

    it('should throw if old session does not exist', async () => {
      try {
        await sessionManager.renameSession('non-existent', 'new-name')
        expect.fail('Should have thrown')
      } catch (error: any) {
        console.log('Actual error:', error)
        expect(error.message).toContain('not found')
      }
    })

    it('should throw if new session name already exists', async () => {
      await sessionManager.createSession('session-1', mockContext)
      await sessionManager.createSession('session-2', mockContext)

      try {
        await sessionManager.renameSession('session-1', 'session-2')
        expect.fail('Should have thrown')
      } catch (error: any) {
        console.log('Actual error:', error)
        expect(error.message).toContain('already exists')
      }
    })
  })

  describe('listActiveSessions', () => {
    it('should list only non-expired sessions', async () => {
      const pastTime = Date.now() - anHour
      const futureTime = Date.now() + anHour

      await sessionManager.createSession('expired', mockContext, { expires: pastTime })
      await sessionManager.createSession('active', mockContext, { expires: futureTime })

      const active = await sessionManager.listActiveSessions()

      expect(active).toHaveLength(1)
      expect(active[0].name).toBe('active')
    })
  })

  describe('corruption handling', () => {
    it('should backup and return null for corrupted session file', async () => {
      // Create a corrupted session file manually
      const sessionPath = join(testSessionsDir, 'corrupted.json')
      // Write invalid JSON
      await import('fs/promises').then((fs) => fs.writeFile(sessionPath, '{ invalid json'))

      const session = await sessionManager.getSession('corrupted')

      expect(session).toBeNull()

      // Check if backup file exists
      const files = await import('fs/promises').then((fs) => fs.readdir(testSessionsDir))
      const backupFile = files.find((f) => f.startsWith('corrupted.json.bak'))
      expect(backupFile).toBeDefined()
    })

    it('should backup and return null for session with invalid schema (missing name)', async () => {
      const sessionPath = join(testSessionsDir, 'invalid-schema.json')
      // Write valid JSON but missing required 'name' field
      await import('fs/promises').then((fs) =>
        fs.writeFile(
          sessionPath,
          JSON.stringify({ cookies: [], localStorage: {}, sessionStorage: {}, metadata: {} })
        )
      )

      const session = await sessionManager.getSession('invalid-schema')

      expect(session).toBeNull()
    })

    it('should backup and return null for session with invalid schema (cookies not array)', async () => {
      const sessionPath = join(testSessionsDir, 'invalid-cookies.json')
      // Write valid JSON but cookies is not an array
      await import('fs/promises').then((fs) =>
        fs.writeFile(
          sessionPath,
          JSON.stringify({
            name: 'invalid-cookies',
            cookies: 'not-an-array',
            localStorage: {},
            sessionStorage: {},
            metadata: { created: Date.now(), lastUsed: Date.now() },
          })
        )
      )

      const session = await sessionManager.getSession('invalid-cookies')

      expect(session).toBeNull()
    })
  })

  describe('validateSession', () => {
    it('should return true for valid session', async () => {
      await sessionManager.createSession('valid-session', mockContext)

      const isValid = await sessionManager.validateSession('valid-session')

      expect(isValid).toBe(true)
    })

    it('should return false for non-existent session', async () => {
      const isValid = await sessionManager.validateSession('non-existent')

      expect(isValid).toBe(false)
    })

    it('should return false for expired session', async () => {
      const pastTime = Date.now() - anHour

      await sessionManager.createSession('expired-session', mockContext, {
        expires: pastTime,
      })

      // Need to bypass the getSession expiry check by writing directly
      const sessionPath = join(testSessionsDir, 'expired-direct.json')
      await import('fs/promises').then((fs) =>
        fs.writeFile(
          sessionPath,
          JSON.stringify({
            name: 'expired-direct',
            cookies: [{ name: 'test', value: 'val', domain: '.test.com', path: '/' }],
            localStorage: {},
            sessionStorage: {},
            metadata: { created: Date.now(), lastUsed: Date.now(), expires: pastTime },
          })
        )
      )

      const isValid = await sessionManager.validateSession('expired-direct')

      expect(isValid).toBe(false)
    })

    it('should return false for session with no cookies', async () => {
      const sessionPath = join(testSessionsDir, 'no-cookies.json')
      await import('fs/promises').then((fs) =>
        fs.writeFile(
          sessionPath,
          JSON.stringify({
            name: 'no-cookies',
            cookies: [],
            localStorage: {},
            sessionStorage: {},
            metadata: { created: Date.now(), lastUsed: Date.now() },
          })
        )
      )

      const isValid = await sessionManager.validateSession('no-cookies')

      expect(isValid).toBe(false)
    })

    it('should return false for session with missing metadata', async () => {
      const sessionPath = join(testSessionsDir, 'no-metadata.json')
      await import('fs/promises').then((fs) =>
        fs.writeFile(
          sessionPath,
          JSON.stringify({
            name: 'no-metadata',
            cookies: [{ name: 'test', value: 'val', domain: '.test.com', path: '/' }],
            localStorage: {},
            sessionStorage: {},
          })
        )
      )

      const isValid = await sessionManager.validateSession('no-metadata')

      expect(isValid).toBe(false)
    })
  })

  describe('mergeSessions', () => {
    const createSessionFile = async (
      name: string,
      cookies: Cookie[],
      localStorage: Record<string, string>,
      sessionStorage: Record<string, string>,
      lastUsed: number
    ) => {
      const sessionPath = join(testSessionsDir, `${name}.json`)
      await import('fs/promises').then((fs) =>
        fs.writeFile(
          sessionPath,
          JSON.stringify({
            name,
            cookies,
            localStorage,
            sessionStorage,
            metadata: { created: Date.now(), lastUsed },
          })
        )
      )
    }

    const baseCookie: Cookie = {
      name: 'base',
      value: 'base-value',
      domain: '.test.com',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    }

    it('should merge sessions with merge-all strategy (default)', async () => {
      await createSessionFile(
        'source-1',
        [{ ...baseCookie, name: 'cookie-a', value: 'a1' }],
        { keyA: 'valueA1' },
        { sessionA: 'sA1' },
        Date.now() - 1000
      )
      await createSessionFile(
        'source-2',
        [{ ...baseCookie, name: 'cookie-b', value: 'b2' }],
        { keyB: 'valueB2' },
        { sessionB: 'sB2' },
        Date.now()
      )

      const merged = await sessionManager.mergeSessions(['source-1', 'source-2'], 'merged-session')

      expect(merged.name).toBe('merged-session')
      expect(merged.cookies).toHaveLength(2)
      expect(merged.localStorage).toHaveProperty('keyA', 'valueA1')
      expect(merged.localStorage).toHaveProperty('keyB', 'valueB2')
    })

    it('should merge sessions with keep-existing strategy', async () => {
      // Create target session first
      await createSessionFile(
        'target',
        [{ ...baseCookie, name: 'shared-cookie', value: 'target-value' }],
        { sharedKey: 'target-value' },
        {},
        Date.now()
      )
      // Create source session
      await createSessionFile(
        'source',
        [
          { ...baseCookie, name: 'shared-cookie', value: 'source-value' },
          { ...baseCookie, name: 'new-cookie', value: 'new-value' },
        ],
        { sharedKey: 'source-value', newKey: 'new-value' },
        {},
        Date.now()
      )

      const merged = await sessionManager.mergeSessions(['source'], 'target', 'keep-existing')

      // Target's values should be kept for existing keys
      const sharedCookie = merged.cookies.find((c) => c.name === 'shared-cookie')
      expect(sharedCookie?.value).toBe('target-value')
      expect(merged.localStorage.sharedKey).toBe('target-value')
      // But new keys from source should be added
      const newCookie = merged.cookies.find((c) => c.name === 'new-cookie')
      expect(newCookie?.value).toBe('new-value')
      expect(merged.localStorage.newKey).toBe('new-value')
    })

    it('should merge sessions with prefer-fresh strategy', async () => {
      const olderTime = Date.now() - 10000
      const newerTime = Date.now()

      await createSessionFile(
        'older-session',
        [{ ...baseCookie, name: 'shared-cookie', value: 'older-value' }],
        { sharedKey: 'older-value' },
        {},
        olderTime
      )
      await createSessionFile(
        'newer-session',
        [{ ...baseCookie, name: 'shared-cookie', value: 'newer-value' }],
        { sharedKey: 'newer-value' },
        {},
        newerTime
      )

      const merged = await sessionManager.mergeSessions(
        ['older-session', 'newer-session'],
        'fresh-merged',
        'prefer-fresh'
      )

      // Newer session's values should win
      const cookie = merged.cookies.find((c) => c.name === 'shared-cookie')
      expect(cookie?.value).toBe('newer-value')
      expect(merged.localStorage.sharedKey).toBe('newer-value')
    })

    it('should throw error when no valid source sessions found', async () => {
      await expect(
        sessionManager.mergeSessions(['non-existent-1', 'non-existent-2'], 'merged')
      ).rejects.toThrow('No valid source sessions found')
    })

    it('should handle merge when target session does not exist', async () => {
      await createSessionFile(
        'source-only',
        [{ ...baseCookie, name: 'source-cookie', value: 'source-value' }],
        { sourceKey: 'sourceValue' },
        {},
        Date.now()
      )

      const merged = await sessionManager.mergeSessions(
        ['source-only'],
        'new-target',
        'keep-existing'
      )

      expect(merged.name).toBe('new-target')
      expect(merged.cookies).toHaveLength(1)
    })

    it('should skip non-existent source sessions with warning', async () => {
      await createSessionFile(
        'existing-source',
        [{ ...baseCookie, name: 'real-cookie', value: 'real-value' }],
        { realKey: 'realValue' },
        {},
        Date.now()
      )

      const merged = await sessionManager.mergeSessions(
        ['existing-source', 'non-existent'],
        'partial-merge'
      )

      expect(merged.cookies).toHaveLength(1)
      expect(merged.cookies[0]?.name).toBe('real-cookie')
    })
  })

  describe('createSession edge cases', () => {
    it('should handle context with no pages', async () => {
      const contextNoPages = {
        cookies: vi
          .fn()
          .mockResolvedValue([
            { ...mockContext, name: 'test', value: 'val', domain: '.test.com', path: '/' },
          ]),
        pages: vi.fn().mockReturnValue([]),
        addCookies: vi.fn(),
      } as unknown as BrowserContext

      const session = await sessionManager.createSession('no-pages-session', contextNoPages)

      expect(session.name).toBe('no-pages-session')
      expect(session.localStorage).toEqual({})
      expect(session.sessionStorage).toEqual({})
    })

    it('should handle localStorage extraction failure', async () => {
      const contextWithFailingEval = {
        cookies: vi.fn().mockResolvedValue([]),
        pages: vi.fn().mockReturnValue([
          {
            evaluate: vi
              .fn()
              .mockRejectedValueOnce(new Error('localStorage access denied'))
              .mockResolvedValueOnce({ sessionKey: 'sessionVal' }),
          },
        ]),
        addCookies: vi.fn(),
      } as unknown as BrowserContext

      const session = await sessionManager.createSession(
        'failing-local-storage',
        contextWithFailingEval
      )

      expect(session.localStorage).toEqual({})
      // sessionStorage should still work
    })

    it('should handle sessionStorage extraction failure', async () => {
      const contextWithFailingEval = {
        cookies: vi.fn().mockResolvedValue([]),
        pages: vi.fn().mockReturnValue([
          {
            evaluate: vi
              .fn()
              .mockResolvedValueOnce({ localKey: 'localVal' })
              .mockRejectedValueOnce(new Error('sessionStorage access denied')),
          },
        ]),
        addCookies: vi.fn(),
      } as unknown as BrowserContext

      const session = await sessionManager.createSession(
        'failing-session-storage',
        contextWithFailingEval
      )

      expect(session.sessionStorage).toEqual({})
      // localStorage should still work
    })
  })

  describe('restoreSession edge cases', () => {
    it('should handle context with no pages during restore', async () => {
      await sessionManager.createSession('session-to-restore', mockContext)

      const contextNoPages = {
        cookies: vi.fn().mockResolvedValue([]),
        pages: vi.fn().mockReturnValue([]),
        addCookies: vi.fn().mockResolvedValue(undefined),
      } as unknown as BrowserContext

      const restored = await sessionManager.restoreSession('session-to-restore', contextNoPages)

      expect(restored).toBe(true)
      expect(contextNoPages.addCookies).toHaveBeenCalled()
    })

    it('should handle localStorage restoration failure', async () => {
      // Create session with localStorage data
      const sessionPath = join(testSessionsDir, 'restore-fail-local.json')
      await import('fs/promises').then((fs) =>
        fs.writeFile(
          sessionPath,
          JSON.stringify({
            name: 'restore-fail-local',
            cookies: [{ name: 'test', value: 'val', domain: '.test.com', path: '/' }],
            localStorage: { key: 'value' },
            sessionStorage: {},
            metadata: { created: Date.now(), lastUsed: Date.now() },
          })
        )
      )

      const contextWithFailingEval = {
        cookies: vi.fn().mockResolvedValue([]),
        pages: vi.fn().mockReturnValue([
          {
            evaluate: vi.fn().mockRejectedValue(new Error('Cannot set localStorage')),
          },
        ]),
        addCookies: vi.fn().mockResolvedValue(undefined),
      } as unknown as BrowserContext

      // Should not throw, just log warning
      const restored = await sessionManager.restoreSession(
        'restore-fail-local',
        contextWithFailingEval
      )

      expect(restored).toBe(true)
    })

    it('should handle sessionStorage restoration failure', async () => {
      // Create session with sessionStorage data
      const sessionPath = join(testSessionsDir, 'restore-fail-session.json')
      await import('fs/promises').then((fs) =>
        fs.writeFile(
          sessionPath,
          JSON.stringify({
            name: 'restore-fail-session',
            cookies: [{ name: 'test', value: 'val', domain: '.test.com', path: '/' }],
            localStorage: {},
            sessionStorage: { key: 'value' },
            metadata: { created: Date.now(), lastUsed: Date.now() },
          })
        )
      )

      const evalMock = vi
        .fn()
        .mockResolvedValueOnce(undefined) // localStorage restore succeeds (empty)
        .mockRejectedValueOnce(new Error('Cannot set sessionStorage'))

      const contextWithFailingEval = {
        cookies: vi.fn().mockResolvedValue([]),
        pages: vi.fn().mockReturnValue([{ evaluate: evalMock }]),
        addCookies: vi.fn().mockResolvedValue(undefined),
      } as unknown as BrowserContext

      // Should not throw, just log warning
      const restored = await sessionManager.restoreSession(
        'restore-fail-session',
        contextWithFailingEval
      )

      expect(restored).toBe(true)
    })
  })

  describe('listActiveSessions edge cases', () => {
    it('should return all active sessions sorted by lastUsed', async () => {
      // Note: listActiveSessions calls loadSession which updates lastUsed on each access.
      // This test verifies that sessions are returned and the sorting logic works.
      // The actual order depends on file iteration order since lastUsed gets updated during listing.

      await sessionManager.createSession('session-a', mockContext)
      await sessionManager.createSession('session-b', mockContext)

      const sessions = await sessionManager.listActiveSessions()

      expect(sessions).toHaveLength(2)
      // Verify both sessions are returned
      const names = sessions.map((s) => s.name)
      expect(names).toContain('session-a')
      expect(names).toContain('session-b')

      // Verify they are sorted (descending by lastUsed)
      // Since loadSession updates lastUsed, order depends on iteration
      // Just verify the sort is applied (first lastUsed >= second lastUsed)
      if (sessions.length === 2 && sessions[0] && sessions[1]) {
        expect(sessions[0].metadata.lastUsed).toBeGreaterThanOrEqual(sessions[1].metadata.lastUsed)
      }
    })
  })
})
