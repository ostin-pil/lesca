import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock SessionManager instance
const mockSessionManagerInstance = {
  listActiveSessions: vi.fn(),
  deleteSession: vi.fn(),
  renameSession: vi.fn(),
  getSession: vi.fn(),
}

vi.mock('@lesca/browser-automation', () => ({
  SessionManager: vi.fn(() => mockSessionManagerInstance),
}))

vi.mock('@lesca/shared/utils', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    box: vi.fn(),
  },
}))

describe('Session Command', () => {
  let program: Command
  let logger: typeof import('@lesca/shared/utils').logger

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Reset mock instance methods
    mockSessionManagerInstance.listActiveSessions.mockReset()
    mockSessionManagerInstance.deleteSession.mockReset()
    mockSessionManagerInstance.renameSession.mockReset()
    mockSessionManagerInstance.getSession.mockReset()

    // Create fresh program
    program = new Command()
    program.exitOverride()

    // Get mocked logger
    const utils = await import('@lesca/shared/utils')
    logger = utils.logger

    // Import and add session command
    const { sessionCommand } = await import('../commands/session')
    program.addCommand(sessionCommand)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('list subcommand', () => {
    it('should display message when no sessions exist', async () => {
      mockSessionManagerInstance.listActiveSessions.mockResolvedValue([])

      await program.parseAsync(['node', 'lesca', 'session', 'list'])

      expect(mockSessionManagerInstance.listActiveSessions).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith('No sessions found')
    })

    it('should display sessions when they exist', async () => {
      const mockSessions = [
        {
          name: 'test-session',
          metadata: {
            created: Date.now(),
            lastUsed: Date.now(),
            description: 'Test description',
          },
          cookies: [{ name: 'cookie1' }, { name: 'cookie2' }],
        },
      ]
      mockSessionManagerInstance.listActiveSessions.mockResolvedValue(mockSessions)

      await program.parseAsync(['node', 'lesca', 'session', 'list'])

      expect(mockSessionManagerInstance.listActiveSessions).toHaveBeenCalled()
      expect(logger.box).toHaveBeenCalledWith('Saved Sessions')
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('test-session'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Cookies: 2'))
    })

    it('should display multiple sessions', async () => {
      const mockSessions = [
        {
          name: 'session-1',
          metadata: { created: Date.now(), lastUsed: Date.now() },
          cookies: [],
        },
        {
          name: 'session-2',
          metadata: { created: Date.now(), lastUsed: Date.now() },
          cookies: [{ name: 'c1' }],
        },
      ]
      mockSessionManagerInstance.listActiveSessions.mockResolvedValue(mockSessions)

      await program.parseAsync(['node', 'lesca', 'session', 'list'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('session-1'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('session-2'))
    })
  })

  describe('delete subcommand', () => {
    it('should delete existing session successfully', async () => {
      mockSessionManagerInstance.deleteSession.mockResolvedValue(true)

      await program.parseAsync(['node', 'lesca', 'session', 'delete', 'my-session'])

      expect(mockSessionManagerInstance.deleteSession).toHaveBeenCalledWith('my-session')
      expect(logger.success).toHaveBeenCalledWith('Session "my-session" deleted')
    })

    it('should warn when session not found', async () => {
      mockSessionManagerInstance.deleteSession.mockResolvedValue(false)

      await program.parseAsync(['node', 'lesca', 'session', 'delete', 'nonexistent'])

      expect(mockSessionManagerInstance.deleteSession).toHaveBeenCalledWith('nonexistent')
      expect(logger.warn).toHaveBeenCalledWith('Session "nonexistent" not found')
    })
  })

  describe('rename subcommand', () => {
    it('should rename session successfully', async () => {
      mockSessionManagerInstance.renameSession.mockResolvedValue(undefined)

      await program.parseAsync(['node', 'lesca', 'session', 'rename', 'old-name', 'new-name'])

      expect(mockSessionManagerInstance.renameSession).toHaveBeenCalledWith('old-name', 'new-name')
      expect(logger.success).toHaveBeenCalledWith('Session renamed: "old-name" → "new-name"')
    })

    it('should handle rename failure', async () => {
      mockSessionManagerInstance.renameSession.mockRejectedValue(new Error('Session not found'))

      await program.parseAsync(['node', 'lesca', 'session', 'rename', 'missing', 'new-name'])

      expect(mockSessionManagerInstance.renameSession).toHaveBeenCalledWith('missing', 'new-name')
      expect(logger.error).toHaveBeenCalledWith('Failed to rename session', expect.any(Error))
    })

    it('should handle non-Error exceptions', async () => {
      mockSessionManagerInstance.renameSession.mockRejectedValue('string error')

      await program.parseAsync(['node', 'lesca', 'session', 'rename', 'old', 'new'])

      expect(logger.error).toHaveBeenCalledWith('Failed to rename session', undefined)
    })
  })

  describe('info subcommand', () => {
    it('should display session details', async () => {
      const mockSession = {
        name: 'detailed-session',
        metadata: {
          created: Date.now(),
          lastUsed: Date.now(),
          expires: Date.now() + 86400000,
          description: 'My session description',
        },
        cookies: [{ name: 'c1' }, { name: 'c2' }, { name: 'c3' }],
        localStorage: { key1: 'val1', key2: 'val2' },
        sessionStorage: { skey: 'sval' },
      }
      mockSessionManagerInstance.getSession.mockResolvedValue(mockSession)

      await program.parseAsync(['node', 'lesca', 'session', 'info', 'detailed-session'])

      expect(mockSessionManagerInstance.getSession).toHaveBeenCalledWith('detailed-session')
      expect(logger.box).toHaveBeenCalledWith('Session: detailed-session')
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Cookies: 3'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('LocalStorage Keys: 2'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('SessionStorage Keys: 1'))
    })

    it('should warn when session not found', async () => {
      mockSessionManagerInstance.getSession.mockResolvedValue(null)

      await program.parseAsync(['node', 'lesca', 'session', 'info', 'unknown'])

      expect(mockSessionManagerInstance.getSession).toHaveBeenCalledWith('unknown')
      expect(logger.warn).toHaveBeenCalledWith('Session "unknown" not found')
    })

    it('should handle session without expiry', async () => {
      const mockSession = {
        name: 'no-expiry',
        metadata: {
          created: Date.now(),
          lastUsed: Date.now(),
          expires: null,
        },
        cookies: [],
        localStorage: {},
        sessionStorage: {},
      }
      mockSessionManagerInstance.getSession.mockResolvedValue(mockSession)

      await program.parseAsync(['node', 'lesca', 'session', 'info', 'no-expiry'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Expires: Never'))
    })

    it('should handle session without description', async () => {
      const mockSession = {
        name: 'no-desc',
        metadata: {
          created: Date.now(),
          lastUsed: Date.now(),
        },
        cookies: [],
        localStorage: {},
        sessionStorage: {},
      }
      mockSessionManagerInstance.getSession.mockResolvedValue(mockSession)

      await program.parseAsync(['node', 'lesca', 'session', 'info', 'no-desc'])

      expect(logger.box).toHaveBeenCalledWith('Session: no-desc')
      // Description should not appear in output
      expect(logger.info).toHaveBeenCalled()
    })
  })
})
