import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserServiceFactory } from '../browser-service-factory'
import { BrowserService } from '../browser-service'
import { SessionManager } from '../session-manager'
import { SessionPoolManager } from '../session-pool-manager'

// Mock the dependencies but let the factory code run
vi.mock('../browser-service')
vi.mock('../session-manager')
vi.mock('../session-pool-manager')
vi.mock('@lesca/shared/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('BrowserServiceFactory', () => {
  let factory: BrowserServiceFactory

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset the singleton before each test by clearing the static instance
    // This is a workaround since the instance is private
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(BrowserServiceFactory as any).instance = undefined
  })

  afterEach(() => {
    // Cleanup: reset singleton after each test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(BrowserServiceFactory as any).instance = undefined
  })

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = BrowserServiceFactory.getInstance()
      const instance2 = BrowserServiceFactory.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should create instance on first call', () => {
      factory = BrowserServiceFactory.getInstance()
      expect(factory).toBeDefined()
      expect(factory).toBeInstanceOf(BrowserServiceFactory)
    })

    it('should initialize SessionManager on construction', () => {
      factory = BrowserServiceFactory.getInstance()
      expect(SessionManager).toHaveBeenCalledTimes(1)
    })

    it('should initialize SessionPoolManager with correct config', () => {
      factory = BrowserServiceFactory.getInstance()
      expect(SessionPoolManager).toHaveBeenCalledWith({
        strategy: 'per-session',
        perSessionMaxSize: 2,
        perSessionIdleTime: 180000,
        acquireTimeout: 30000,
        retryOnFailure: true,
        maxRetries: 3,
      })
    })
  })

  describe('getSessionManager', () => {
    it('should return the session manager instance', () => {
      factory = BrowserServiceFactory.getInstance()
      const sessionManager = factory.getSessionManager()
      expect(sessionManager).toBeInstanceOf(SessionManager)
    })

    it('should return the same session manager on multiple calls', () => {
      factory = BrowserServiceFactory.getInstance()
      const manager1 = factory.getSessionManager()
      const manager2 = factory.getSessionManager()
      expect(manager1).toBe(manager2)
    })
  })

  describe('getSessionPoolManager', () => {
    it('should return the session pool manager instance', () => {
      factory = BrowserServiceFactory.getInstance()
      const poolManager = factory.getSessionPoolManager()
      expect(poolManager).toBeInstanceOf(SessionPoolManager)
    })

    it('should return the same pool manager on multiple calls', () => {
      factory = BrowserServiceFactory.getInstance()
      const manager1 = factory.getSessionPoolManager()
      const manager2 = factory.getSessionPoolManager()
      expect(manager1).toBe(manager2)
    })
  })

  describe('createService', () => {
    it('should create BrowserService instance with default options', () => {
      factory = BrowserServiceFactory.getInstance()
      const service = factory.createService()

      expect(service).toBeInstanceOf(BrowserService)
      expect(BrowserService).toHaveBeenCalledWith(
        factory.getSessionManager(),
        factory.getSessionPoolManager(),
        {}
      )
    })

    it('should create BrowserService with session name option', () => {
      factory = BrowserServiceFactory.getInstance()
      const options = { sessionName: 'test-session' }

      factory.createService(options)

      expect(BrowserService).toHaveBeenCalledWith(
        factory.getSessionManager(),
        factory.getSessionPoolManager(),
        options
      )
    })

    it('should create BrowserService with all options', () => {
      factory = BrowserServiceFactory.getInstance()
      const options = {
        sessionName: 'my-session',
        persistOnShutdown: true,
        autoRestore: true,
        auth: { username: 'user', password: 'pass' },
      }

      factory.createService(options)

      expect(BrowserService).toHaveBeenCalledWith(
        factory.getSessionManager(),
        factory.getSessionPoolManager(),
        options
      )
    })

    it('should create multiple independent service instances', () => {
      factory = BrowserServiceFactory.getInstance()
      const service1 = factory.createService({ sessionName: 'session-1' })
      const service2 = factory.createService({ sessionName: 'session-2' })

      // BrowserService is mocked, so we can only check that it was called twice
      expect(BrowserService).toHaveBeenCalledTimes(2)
      expect(service1).toBeDefined()
      expect(service2).toBeDefined()
    })
  })

  describe('shared managers', () => {
    it('should share managers across multiple service instances', () => {
      factory = BrowserServiceFactory.getInstance()
      const sessionManager = factory.getSessionManager()
      const poolManager = factory.getSessionPoolManager()

      factory.createService({ sessionName: 'session-1' })
      factory.createService({ sessionName: 'session-2' })

      // Both should receive the same manager instances
      expect(BrowserService).toHaveBeenNthCalledWith(1, sessionManager, poolManager, {
        sessionName: 'session-1',
      })
      expect(BrowserService).toHaveBeenNthCalledWith(2, sessionManager, poolManager, {
        sessionName: 'session-2',
      })
    })
  })
})
