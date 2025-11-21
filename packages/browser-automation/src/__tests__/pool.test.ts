import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BrowserPool } from '../pool'
import type { Browser } from 'playwright'
import { chromium } from 'playwright'

// Mock playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}))

describe('BrowserPool', () => {
  let pool: BrowserPool
  let mockBrowsers: Browser[]

  beforeEach(() => {
    mockBrowsers = []

    // Reset and configure mock
    vi.mocked(chromium.launch).mockClear()
    vi.mocked(chromium.launch).mockImplementation(async () => {
      const mockBrowser = {
        isConnected: vi.fn().mockReturnValue(true),
        close: vi.fn().mockResolvedValue(undefined),
        contexts: vi.fn().mockReturnValue([]),
      } as unknown as Browser

      mockBrowsers.push(mockBrowser)
      return mockBrowser
    })
  })

  afterEach(async () => {
    if (pool) {
      await pool.drain()
    }
    mockBrowsers = []
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default config', () => {
      pool = new BrowserPool()

      const config = pool.getConfig()
      expect(config.enabled).toBe(true)
      expect(config.minSize).toBe(0)
      expect(config.maxSize).toBe(3)
      expect(config.maxIdleTime).toBe(300000)
      expect(config.reusePages).toBe(true)
    })

    it('should initialize with custom config', () => {
      pool = new BrowserPool({
        enabled: true,
        minSize: 2,
        maxSize: 5,
        maxIdleTime: 60000,
        reusePages: false,
      })

      const config = pool.getConfig()
      expect(config.minSize).toBe(2)
      expect(config.maxSize).toBe(5)
      expect(config.maxIdleTime).toBe(60000)
      expect(config.reusePages).toBe(false)
    })

    it('should throw error if minSize > maxSize', () => {
      expect(() => {
        pool = new BrowserPool({
          minSize: 5,
          maxSize: 3,
        })
      }).toThrow('minSize cannot be greater than maxSize')
    })
  })

  describe('acquire', () => {
    it('should create a new browser when pool is empty', async () => {
      pool = new BrowserPool()

      const browser = await pool.acquire()

      expect(browser).toBeDefined()
      expect(mockBrowsers).toHaveLength(1)

      const stats = pool.getStats()
      expect(stats.total).toBe(1)
      expect(stats.active).toBe(1)
      expect(stats.idle).toBe(0)
      expect(stats.created).toBe(1)
    })

    it('should reuse idle browser from pool', async () => {
      pool = new BrowserPool()

      const browser1 = await pool.acquire()
      await pool.release(browser1)

      const browser2 = await pool.acquire()

      expect(browser2).toBe(browser1)
      expect(mockBrowsers).toHaveLength(1)

      const stats = pool.getStats()
      expect(stats.reused).toBe(1)
    })

    it('should create multiple browsers up to maxSize', async () => {
      pool = new BrowserPool({ maxSize: 3 })

      await pool.acquire()
      await pool.acquire()
      await pool.acquire()

      expect(mockBrowsers).toHaveLength(3)

      const stats = pool.getStats()
      expect(stats.total).toBe(3)
      expect(stats.active).toBe(3)
    })

    it('should remove disconnected browsers from pool', async () => {
      pool = new BrowserPool()

      const browser1 = await pool.acquire()
      await pool.release(browser1)

      // Simulate browser disconnection
      ;(browser1.isConnected as ReturnType<typeof vi.fn>).mockReturnValue(false)

      const browser2 = await pool.acquire()

      // Should create a new browser since the old one was disconnected
      expect(browser2).not.toBe(browser1)
      expect(mockBrowsers).toHaveLength(2)
    })

    it('should create new browser each time when pooling is disabled', async () => {
      pool = new BrowserPool({ enabled: false })

      const b1 = await pool.acquire()
      const b2 = await pool.acquire()

      expect(b1).not.toBe(b2)
      expect(mockBrowsers).toHaveLength(2)

      // Browsers should not be in pool
      const stats = pool.getStats()
      expect(stats.total).toBe(0)
    })

    it('should wait for available browser when pool is at max capacity', async () => {
      pool = new BrowserPool({ maxSize: 2 })

      const browser1 = await pool.acquire()
      await pool.acquire() // Fill up the pool

      // Pool is now at capacity, start acquiring third browser
      const acquirePromise = pool.acquire()

      // Release one browser after a delay
      setTimeout(() => {
        void pool.release(browser1)
      }, 50)

      const browser3 = await acquirePromise

      // Should reuse the released browser
      expect(browser3).toBe(browser1)
      expect(mockBrowsers).toHaveLength(2)
    }, 10000)

    it('should throw error when pool is shutting down', async () => {
      pool = new BrowserPool()

      // Start draining
      const drainPromise = pool.drain()

      // Try to acquire while draining
      await expect(pool.acquire()).rejects.toThrow('Browser pool is shutting down')

      await drainPromise
    })
  })

  describe('release', () => {
    it('should mark browser as idle when released', async () => {
      pool = new BrowserPool()

      const browser = await pool.acquire()

      let stats = pool.getStats()
      expect(stats.active).toBe(1)
      expect(stats.idle).toBe(0)

      await pool.release(browser)

      stats = pool.getStats()
      expect(stats.active).toBe(0)
      expect(stats.idle).toBe(1)
    })

    it('should close browser contexts when reusePages is enabled', async () => {
      const mockContext = {
        close: vi.fn().mockResolvedValue(undefined),
      }

      pool = new BrowserPool({ reusePages: true })
      const browser = await pool.acquire()

      ;(browser.contexts as ReturnType<typeof vi.fn>).mockReturnValue([mockContext])

      await pool.release(browser)

      expect(mockContext.close).toHaveBeenCalled()
    })

    it('should close browser when pooling is disabled', async () => {
      pool = new BrowserPool({ enabled: false })

      const browser = await pool.acquire()

      await pool.release(browser)

      expect(browser.close).toHaveBeenCalled()
    })

    it('should handle release of browser not in pool', async () => {
      pool = new BrowserPool()

      const outsideBrowser = {
        isConnected: vi.fn().mockReturnValue(true),
        close: vi.fn().mockResolvedValue(undefined),
        contexts: vi.fn().mockReturnValue([]),
      } as unknown as Browser

      await pool.release(outsideBrowser)

      // Should close the browser since it's not in pool
      expect(outsideBrowser.close).toHaveBeenCalled()
    })
  })

  describe('drain', () => {
    it('should close all browsers in pool', async () => {
      pool = new BrowserPool()

      const browser1 = await pool.acquire()
      const browser2 = await pool.acquire()
      await pool.release(browser1)

      await pool.drain()

      expect(browser1.close).toHaveBeenCalled()
      expect(browser2.close).toHaveBeenCalled()

      const stats = pool.getStats()
      expect(stats.total).toBe(0)
    })

    it('should prevent new acquisitions after drain starts', async () => {
      pool = new BrowserPool()

      const drainPromise = pool.drain()

      await expect(pool.acquire()).rejects.toThrow('Browser pool is shutting down')

      await drainPromise
    })

    it('should handle multiple drain calls gracefully', async () => {
      pool = new BrowserPool()

      await pool.acquire()

      await pool.drain()
      await pool.drain() // Second drain should not throw

      const stats = pool.getStats()
      expect(stats.total).toBe(0)
    })
  })

  describe('getStats', () => {
    it('should track browser creation and destruction', async () => {
      pool = new BrowserPool()

      await pool.acquire()
      await pool.acquire()

      let stats = pool.getStats()
      expect(stats.created).toBe(2)
      expect(stats.destroyed).toBe(0)

      await pool.drain()

      stats = pool.getStats()
      expect(stats.destroyed).toBe(2)
    })

    it('should track reuse count', async () => {
      pool = new BrowserPool()

      const browser = await pool.acquire()
      await pool.release(browser)

      await pool.acquire() // Reuse

      const stats = pool.getStats()
      expect(stats.reused).toBe(1)
    })

    it('should accurately count active and idle browsers', async () => {
      pool = new BrowserPool()

      const browser1 = await pool.acquire()
      const browser2 = await pool.acquire()

      let stats = pool.getStats()
      expect(stats.active).toBe(2)
      expect(stats.idle).toBe(0)

      await pool.release(browser1)

      stats = pool.getStats()
      expect(stats.active).toBe(1)
      expect(stats.idle).toBe(1)

      await pool.release(browser2)

      stats = pool.getStats()
      expect(stats.active).toBe(0)
      expect(stats.idle).toBe(2)
    })
  })

  describe('idle browser cleanup', () => {
    it('should not remove browsers below minimum size', async () => {
      pool = new BrowserPool({
        minSize: 2,
        maxIdleTime: 100, // Very short for testing
      })

      const browser1 = await pool.acquire()
      const browser2 = await pool.acquire()
      await pool.release(browser1)
      await pool.release(browser2)

      // Wait for cleanup interval
      await new Promise((resolve) => setTimeout(resolve, 150))

      const stats = pool.getStats()
      expect(stats.total).toBeGreaterThanOrEqual(2)
    })

    it('should remove disconnected browsers from pool on next acquire', async () => {
      pool = new BrowserPool({ maxIdleTime: 100 })

      const browser = await pool.acquire()
      await pool.release(browser)

      const statsAfterRelease = pool.getStats()
      expect(statsAfterRelease.total).toBe(1)

      // Simulate disconnection
      ;(browser.isConnected as ReturnType<typeof vi.fn>).mockReturnValue(false)

      // Try to acquire again - should detect disconnection and create new browser
      const browser2 = await pool.acquire()

      // Should have created a new browser since the old one was disconnected
      expect(browser2).not.toBe(browser)

      // Pool should still have 1 browser (the new one, old one removed)
      const statsAfterAcquire = pool.getStats()
      expect(statsAfterAcquire.total).toBe(1)
      expect(statsAfterAcquire.active).toBe(1)
    })
  })

  describe('concurrent operations', () => {
    it('should handle concurrent acquisitions', async () => {
      pool = new BrowserPool({ maxSize: 5 })

      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(pool.acquire())
      }

      const browsers = await Promise.all(promises)

      expect(browsers).toHaveLength(5)
      expect(new Set(browsers).size).toBe(5) // All unique

      const stats = pool.getStats()
      expect(stats.total).toBe(5)
      expect(stats.active).toBe(5)
    })

    it('should handle concurrent releases', async () => {
      pool = new BrowserPool({ maxSize: 5 })

      const browsers = await Promise.all([
        pool.acquire(),
        pool.acquire(),
        pool.acquire(),
      ])

      await Promise.all(browsers.map((b) => pool.release(b)))

      const stats = pool.getStats()
      expect(stats.active).toBe(0)
      expect(stats.idle).toBe(3)
    })

    it('should handle mixed concurrent operations', async () => {
      pool = new BrowserPool({ maxSize: 10 })

      const operations = []

      // Acquire 5 browsers
      for (let i = 0; i < 5; i++) {
        operations.push(pool.acquire())
      }

      const browsers = await Promise.all(operations)

      // Mix of releases and new acquisitions
      const mixedOps = [
        browsers[0] ? pool.release(browsers[0]) : Promise.resolve(),
        browsers[1] ? pool.release(browsers[1]) : Promise.resolve(),
        pool.acquire(),
        pool.acquire(),
        pool.acquire(),
      ]

      await Promise.all(mixedOps)

      // Should have 6 browsers total (5 - 2 released + 3 new, but 2 reused)
      const stats = pool.getStats()
      expect(stats.total).toBeLessThanOrEqual(6)
    })
  })

  describe('memory leak prevention', () => {
    it('should not accumulate browsers beyond maxSize', async () => {
      pool = new BrowserPool({ maxSize: 3 })

      // Create and release many browsers
      for (let i = 0; i < 20; i++) {
        const browser = await pool.acquire()
        await pool.release(browser)
      }

      const stats = pool.getStats()
      expect(stats.total).toBeLessThanOrEqual(3)
    })

    it('should clean up all resources on drain', async () => {
      pool = new BrowserPool()

      // Create multiple browsers
      const browsers = await Promise.all([
        pool.acquire(),
        pool.acquire(),
        pool.acquire(),
      ])

      await pool.drain()

      const stats = pool.getStats()
      expect(stats.total).toBe(0)
      expect(stats.active).toBe(0)
      expect(stats.idle).toBe(0)

      // All browsers should be closed
      for (const browser of browsers) {
        expect(browser.close).toHaveBeenCalled()
      }
    })
  })
})
