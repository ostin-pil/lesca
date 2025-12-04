import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Browser } from 'playwright'
import { SessionPoolManager } from '../session-pool-manager'
import { BrowserPool } from '../pool'

vi.mock('../pool', () => {
  return {
    BrowserPool: vi.fn().mockImplementation(() => ({
      acquire: vi.fn(),
      release: vi.fn(),
      drain: vi.fn(),
      getStats: vi.fn().mockReturnValue({
        total: 0,
        active: 0,
        idle: 0,
        peak: 0,
        pending: 0,
      }),
      getConfig: vi.fn().mockReturnValue({}),
      getCircuitBreakerStats: vi.fn().mockReturnValue({
        state: 'closed',
        failures: 0,
        successes: 0,
        totalCalls: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      }),
      resetCircuitBreaker: vi.fn(),
    })),
  }
})

vi.mock('@lesca/shared/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('SessionPoolManager', () => {
  let manager: SessionPoolManager
  const mockBrowser = {
    close: vi.fn(),
    contexts: vi.fn().mockReturnValue([]),
    isConnected: vi.fn().mockReturnValue(true),
  } as unknown as Browser

  const defaultConfig = {
    strategy: 'per-session' as const,
    perSessionMaxSize: 2,
    perSessionIdleTime: 1000,
    acquireTimeout: 1000,
    retryOnFailure: true,
    maxRetries: 2,
  }

  beforeEach(() => {
    vi.resetAllMocks()

    vi.mocked(BrowserPool).mockImplementation(
      () =>
        ({
          acquire: vi.fn().mockResolvedValue(mockBrowser),
          release: vi.fn().mockResolvedValue(undefined),
          drain: vi.fn().mockResolvedValue(undefined),
          getStats: vi.fn().mockReturnValue({
            total: 0,
            active: 0,
            idle: 0,
            peak: 0,
            pending: 0,
          }),
          getConfig: vi.fn().mockReturnValue({}),
          getCircuitBreakerStats: vi.fn().mockReturnValue({
            state: 'closed',
            failures: 0,
            successes: 0,
            totalCalls: 0,
            totalFailures: 0,
            totalSuccesses: 0,
          }),
          resetCircuitBreaker: vi.fn(),
        }) as unknown as BrowserPool
    )

    manager = new SessionPoolManager(defaultConfig)
  })

  afterEach(async () => {
    await manager.drainAll()
  })

  describe('Pool Management', () => {
    it('should create a new pool for a session if one does not exist', () => {
      const sessionName = 'test-session'
      const pool = manager.getPool(sessionName)

      expect(pool).toBeDefined()
      expect(BrowserPool).toHaveBeenCalledWith(
        expect.objectContaining({
          maxSize: defaultConfig.perSessionMaxSize,
          maxIdleTime: defaultConfig.perSessionIdleTime,
        }),
        expect.anything()
      )
    })

    it('should reuse existing pool for the same session', () => {
      const sessionName = 'test-session'
      const pool1 = manager.getPool(sessionName)
      const pool2 = manager.getPool(sessionName)

      expect(pool1).toBe(pool2)
      expect(BrowserPool).toHaveBeenCalledTimes(1)
    })

    it('should create different pools for different sessions', () => {
      const pool1 = manager.getPool('session-1')
      const pool2 = manager.getPool('session-2')

      expect(pool1).not.toBe(pool2)
      expect(BrowserPool).toHaveBeenCalledTimes(2)
    })
  })

  describe('Browser Acquisition', () => {
    it('should acquire browser from the session pool', async () => {
      const sessionName = 'test-session'
      const mockPool = {
        acquire: vi.fn().mockResolvedValue(mockBrowser),
        release: vi.fn().mockResolvedValue(undefined),
        drain: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({}),
      }
      vi.mocked(BrowserPool).mockImplementationOnce(() => mockPool as any)

      const browser = await manager.acquireBrowser(sessionName)

      expect(browser).toBe(mockBrowser)
      expect(mockPool.acquire).toHaveBeenCalled()
    })

    it('should retry acquisition on failure', async () => {
      const sessionName = 'test-session'
      const error = new Error('Connection failed')
      const mockPool = {
        acquire: vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(mockBrowser),
        release: vi.fn().mockResolvedValue(undefined),
        drain: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({}),
      }
      vi.mocked(BrowserPool).mockImplementationOnce(() => mockPool as any)

      const browser = await manager.acquireBrowser(sessionName)

      expect(browser).toBe(mockBrowser)
      expect(mockPool.acquire).toHaveBeenCalledTimes(2)
    })

    it('should throw after max retries', async () => {
      const sessionName = 'test-session'
      const error = new Error('Connection failed')
      const mockPool = {
        acquire: vi.fn().mockRejectedValue(error),
        release: vi.fn().mockResolvedValue(undefined),
        drain: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({}),
      }
      vi.mocked(BrowserPool).mockImplementationOnce(() => mockPool as any)

      await expect(manager.acquireBrowser(sessionName)).rejects.toThrow('Failed to acquire browser')
      expect(mockPool.acquire).toHaveBeenCalledTimes(defaultConfig.maxRetries + 1)
    })

    it('should timeout if acquisition takes too long', async () => {
      const sessionName = 'test-session'
      const mockPool = {
        acquire: vi
          .fn()
          .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000))),
        release: vi.fn().mockResolvedValue(undefined),
        drain: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({}),
        getConfig: vi.fn().mockReturnValue({}),
        getCircuitBreakerStats: vi.fn().mockReturnValue({}),
        resetCircuitBreaker: vi.fn(),
      }
      vi.mocked(BrowserPool).mockImplementationOnce(() => mockPool as unknown as BrowserPool)

      const shortTimeoutManager = new SessionPoolManager({
        ...defaultConfig,
        acquireTimeout: 1000, // Minimum valid timeout
        retryOnFailure: false,
      })

      await expect(shortTimeoutManager.acquireBrowser(sessionName)).rejects.toThrow(
        'Failed to acquire browser'
      )
    })
  })

  describe('Browser Release', () => {
    it('should release browser back to the correct session pool', async () => {
      const sessionName = 'test-session'
      const mockPool = {
        acquire: vi.fn().mockResolvedValue(mockBrowser),
        release: vi.fn().mockResolvedValue(undefined),
        drain: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({}),
      }
      vi.mocked(BrowserPool).mockImplementationOnce(() => mockPool as any)

      await manager.acquireBrowser(sessionName)
      await manager.releaseBrowser(mockBrowser, sessionName)

      expect(mockPool.release).toHaveBeenCalledWith(mockBrowser)
    })

    it('should warn if releasing to non-existent pool', async () => {
      await expect(manager.releaseBrowser(mockBrowser, 'non-existent')).resolves.not.toThrow()
    })
  })

  describe('Statistics', () => {
    it('should track statistics per session', async () => {
      const sessionName = 'test-session'
      const mockPool = {
        acquire: vi.fn().mockResolvedValue(mockBrowser),
        release: vi.fn().mockResolvedValue(undefined),
        drain: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({
          total: 1,
          active: 1,
          idle: 0,
        }),
      }
      vi.mocked(BrowserPool).mockImplementationOnce(() => mockPool as any)

      await manager.acquireBrowser(sessionName)

      const stats = manager.getStatistics(sessionName)
      expect(stats).toHaveLength(1)
      expect(stats[0]).toMatchObject({
        sessionName,
        activeBrowsers: 1,
        acquisitionCount: 1,
      })
    })

    it('should track failures', async () => {
      const sessionName = 'test-session'
      const mockPool = {
        acquire: vi.fn().mockRejectedValue(new Error('Fail')),
        release: vi.fn().mockResolvedValue(undefined),
        drain: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({}),
      }
      vi.mocked(BrowserPool).mockImplementationOnce(() => mockPool as any)

      try {
        await manager.acquireBrowser(sessionName)
      } catch {
        // Ignore
      }

      const stats = manager.getStatistics(sessionName)
      expect(stats[0].failureCount).toBeGreaterThan(0)
    })
  })

  describe('Cleanup', () => {
    it('should drain specific session pool', async () => {
      const sessionName = 'test-session'
      const mockPool = {
        acquire: vi.fn(),
        release: vi.fn().mockResolvedValue(undefined),
        drain: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({}),
      }
      vi.mocked(BrowserPool).mockImplementationOnce(() => mockPool as any)

      await manager.getPool(sessionName)
      await manager.drainSessionPool(sessionName)
      expect(mockPool.drain).toHaveBeenCalled()

      await manager.getPool(sessionName)
      expect(BrowserPool).toHaveBeenCalledTimes(2)
    })

    it('should drain all pools', async () => {
      const mockPool1 = {
        acquire: vi.fn(),
        release: vi.fn().mockResolvedValue(undefined),
        drain: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({}),
      }
      const mockPool2 = {
        acquire: vi.fn(),
        release: vi.fn().mockResolvedValue(undefined),
        drain: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({}),
      }

      vi.mocked(BrowserPool)
        .mockImplementationOnce(() => mockPool1 as any)
        .mockImplementationOnce(() => mockPool2 as any)

      manager.getPool('session-1')
      manager.getPool('session-2')

      await manager.drainAll()

      expect(mockPool1.drain).toHaveBeenCalled()
      expect(mockPool2.drain).toHaveBeenCalled()
    })
  })
})
