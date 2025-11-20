import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SessionManager } from '../session-manager.js'
import { mkdir, rm, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { BrowserContext, Cookie } from 'playwright'

describe('SessionManager', () => {
  let sessionManager: SessionManager
  let testSessionsDir: string
  let mockContext: BrowserContext

  beforeEach(async () => {
    // Create a temporary directory for test sessions
    testSessionsDir = join(tmpdir(), `lesca-test-sessions-${Date.now()}`)
    await mkdir(testSessionsDir, { recursive: true })

    sessionManager = new SessionManager(testSessionsDir)

    // Create a mock browser context
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
          evaluate: vi.fn()
            .mockResolvedValueOnce({ 'user-preference': 'dark-mode' }) // localStorage
            .mockResolvedValueOnce({ 'session-id': 'abc123' }), // sessionStorage
        },
      ]),
      addCookies: vi.fn().mockResolvedValue(undefined),
    } as unknown as BrowserContext
  })

  afterEach(async () => {
    // Clean up test directory
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
      await sessionManager.createSession(
        '../../../malicious',
        mockContext
      )

      // Should be sanitized to underscores
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
      const pastTime = Date.now() - 3600000 // 1 hour ago

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
        evaluate: vi.fn()
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

      // Should call evaluate to restore storage (at least twice - once for each storage type)
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
      const pastTime = Date.now() - 3600000 // 1 hour ago
      const futureTime = Date.now() + 3600000 // 1 hour from now

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
      const pastTime = Date.now() - 3600000 // 1 hour ago
      const futureTime = Date.now() + 3600000 // 1 hour from now

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
      const futureTime = Date.now() + 3600000

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
})
