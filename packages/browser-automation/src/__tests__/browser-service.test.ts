import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserService } from '../browser-service'
import { PlaywrightDriver } from '../playwright-driver'
import type { ISessionManager, ISessionPoolManager } from '../interfaces'
import { BrowserError } from '@lesca/error'

// Mock PlaywrightDriver only
vi.mock('../playwright-driver')
vi.mock('@lesca/shared/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('BrowserService', () => {
  let browserService: BrowserService
  let mockSessionManager: ISessionManager
  let mockSessionPoolManager: ISessionPoolManager
  let mockDriver: {
    launch: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    getBrowser: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock session manager with all required interface methods
    mockSessionManager = {
      createSession: vi.fn().mockResolvedValue({
        name: 'test-session',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        metadata: { created: Date.now(), lastUsed: Date.now() },
      }),
      getSession: vi.fn().mockResolvedValue(null),
      saveSession: vi.fn().mockResolvedValue(undefined),
      restoreSession: vi.fn().mockResolvedValue(true),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn().mockResolvedValue(true),
      sessionExists: vi.fn().mockResolvedValue(false),
      renameSession: vi.fn().mockResolvedValue(undefined),
      listActiveSessions: vi.fn().mockResolvedValue([]),
      validateSession: vi.fn().mockResolvedValue(true),
      mergeSessions: vi.fn().mockResolvedValue({
        name: 'merged',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        metadata: { created: Date.now(), lastUsed: Date.now() },
      }),
      cleanupExpiredSessions: vi.fn().mockResolvedValue(0),
    }

    // Create mock session pool manager with all required interface methods
    mockSessionPoolManager = {
      acquireForSession: vi.fn().mockResolvedValue({
        launch: vi.fn(),
        close: vi.fn(),
      }),
      releaseForSession: vi.fn().mockResolvedValue(undefined),
      getPoolStats: vi.fn().mockReturnValue({
        created: 0,
        destroyed: 0,
        reused: 0,
        active: 0,
        idle: 0,
      }),
      drainAllPools: vi.fn().mockResolvedValue(undefined),
    }

    mockDriver = {
      launch: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getBrowser: vi.fn().mockReturnValue({
        contexts: vi.fn().mockReturnValue([{ id: 'context-1' }]),
      }),
    }

    // Mock PlaywrightDriver constructor to return our mock
    vi.mocked(PlaywrightDriver).mockImplementation(() => mockDriver as unknown as PlaywrightDriver)

    browserService = new BrowserService(mockSessionManager, mockSessionPoolManager)
  })

  describe('constructor and getters', () => {
    it('should initialize with default options', () => {
      expect(browserService).toBeDefined()
      expect(browserService.getSessionName()).toBeUndefined()
      expect(browserService.isPoolingEnabled()).toBe(false)
    })

    it('should initialize with session name', () => {
      browserService = new BrowserService(mockSessionManager, mockSessionPoolManager, {
        sessionName: 'test-session',
      })
      expect(browserService.getSessionName()).toBe('test-session')
      expect(browserService.isPoolingEnabled()).toBe(true)
    })
  })

  describe('getDriver', () => {
    it('should throw BrowserError when service not started', () => {
      expect(() => browserService.getDriver()).toThrow(BrowserError)
      expect(() => browserService.getDriver()).toThrow('Browser service not started')
    })

    it('should return driver after startup', async () => {
      await browserService.startup()
      const driver = browserService.getDriver()
      expect(driver).toBeDefined()
    })
  })

  describe('startup', () => {
    it('should startup correctly without session', async () => {
      await browserService.startup()
      expect(mockDriver.launch).toHaveBeenCalled()
      expect(PlaywrightDriver).toHaveBeenCalledWith(undefined, undefined, undefined)
    })

    it('should startup with session and pool manager', async () => {
      browserService = new BrowserService(mockSessionManager, mockSessionPoolManager, {
        sessionName: 'my-session',
      })

      await browserService.startup()

      expect(PlaywrightDriver).toHaveBeenCalledWith(undefined, mockSessionPoolManager, 'my-session')
    })

    it('should startup with auth credentials', async () => {
      browserService = new BrowserService(mockSessionManager, mockSessionPoolManager, {
        auth: { username: 'user', password: 'pass' },
      })

      await browserService.startup()

      expect(PlaywrightDriver).toHaveBeenCalledWith(
        { cookies: [], csrfToken: '' },
        undefined,
        undefined
      )
    })

    it('should be idempotent - multiple calls do not re-launch', async () => {
      await browserService.startup()
      await browserService.startup() // Second call should be ignored

      expect(mockDriver.launch).toHaveBeenCalledTimes(1)
    })

    it('should restore session on startup if configured', async () => {
      browserService = new BrowserService(mockSessionManager, mockSessionPoolManager, {
        sessionName: 'test-session',
        autoRestore: true,
      })

      await browserService.startup()

      expect(mockSessionManager.restoreSession).toHaveBeenCalledWith(
        'test-session',
        expect.anything()
      )
    })

    it('should handle restore when session not found', async () => {
      vi.mocked(mockSessionManager.restoreSession).mockResolvedValue(false)

      browserService = new BrowserService(mockSessionManager, mockSessionPoolManager, {
        sessionName: 'missing-session',
        autoRestore: true,
      })

      await browserService.startup()

      expect(mockSessionManager.restoreSession).toHaveBeenCalled()
      // Should not throw, just log debug message
    })

    it('should not restore session when autoRestore is false', async () => {
      browserService = new BrowserService(mockSessionManager, mockSessionPoolManager, {
        sessionName: 'test-session',
        autoRestore: false,
      })

      await browserService.startup()

      expect(mockSessionManager.restoreSession).not.toHaveBeenCalled()
    })

    it('should throw BrowserError when launch fails', async () => {
      mockDriver.launch.mockRejectedValue(new Error('Connection refused'))

      await expect(browserService.startup()).rejects.toThrow(BrowserError)
      await expect(browserService.startup()).rejects.toThrow('Failed to start browser service')
    })

    it('should pass launch options to driver', async () => {
      await browserService.startup({ headless: false, slowMo: 100 })

      expect(mockDriver.launch).toHaveBeenCalledWith({ headless: false, slowMo: 100 })
    })
  })

  describe('shutdown', () => {
    it('should shutdown correctly', async () => {
      await browserService.startup()
      await browserService.shutdown()

      expect(mockDriver.close).toHaveBeenCalled()
    })

    it('should be idempotent - multiple calls do not error', async () => {
      await browserService.startup()
      await browserService.shutdown()
      await browserService.shutdown() // Second call should be ignored

      expect(mockDriver.close).toHaveBeenCalledTimes(1)
    })

    it('should do nothing if never started', async () => {
      await browserService.shutdown() // Should not throw
      expect(mockDriver.close).not.toHaveBeenCalled()
    })

    it('should persist session on shutdown if configured', async () => {
      browserService = new BrowserService(mockSessionManager, mockSessionPoolManager, {
        sessionName: 'test-session',
        persistOnShutdown: true,
      })

      await browserService.startup()
      await browserService.shutdown()

      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        'test-session',
        expect.anything(),
        { description: 'Persisted on shutdown' }
      )
    })

    it('should not persist session if not configured', async () => {
      browserService = new BrowserService(mockSessionManager, mockSessionPoolManager, {
        sessionName: 'test-session',
        persistOnShutdown: false,
      })

      await browserService.startup()
      await browserService.shutdown()

      expect(mockSessionManager.createSession).not.toHaveBeenCalled()
    })

    it('should handle shutdown errors gracefully', async () => {
      mockDriver.close.mockRejectedValue(new Error('Browser crashed'))

      await browserService.startup()
      // Should not throw, just log error
      await expect(browserService.shutdown()).resolves.not.toThrow()
    })

    it('should not persist if no context available', async () => {
      mockDriver.getBrowser.mockReturnValue({
        contexts: vi.fn().mockReturnValue([]),
      })

      browserService = new BrowserService(mockSessionManager, mockSessionPoolManager, {
        sessionName: 'test-session',
        persistOnShutdown: true,
      })

      await browserService.startup()
      await browserService.shutdown()

      expect(mockSessionManager.createSession).not.toHaveBeenCalled()
    })
  })
})
