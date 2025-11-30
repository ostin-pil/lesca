import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserPool } from '@lesca/browser-automation'
import type { Browser } from 'playwright'

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockImplementation(() => ({
      close: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      contexts: vi.fn().mockReturnValue([]),
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    })),
  },
}))

describe('E2E: Browser Pool Integration', () => {
  let pool: BrowserPool

  beforeEach(() => {
    pool = new BrowserPool({
      enabled: true,
      minSize: 0,
      maxSize: 2, // Small pool to force reuse/waiting
      maxIdleTime: 1000,
    })
  })

  afterEach(async () => {
    await pool.drain()
    vi.clearAllMocks()
  })

  it('should handle parallel scraping requests efficiently', async () => {
    const scrapeTask = async (id: number) => {
      const browser = await pool.acquire()
      try {
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 50))
        return { id, browser }
      } finally {
        await pool.release(browser)
      }
    }

    // Launch 5 concurrent tasks with pool size 2
    const tasks = [1, 2, 3, 4, 5].map((id) => scrapeTask(id))
    const results = await Promise.all(tasks)

    expect(results).toHaveLength(5)

    const stats = pool.getStats()
    expect(stats.created).toBeLessThanOrEqual(2)
    expect(stats.reused).toBeGreaterThan(0)
  })

  it('should respect pool limits under load', async () => {
    const browsers: Browser[] = []

    // Acquire up to max size
    browsers.push(await pool.acquire())
    browsers.push(await pool.acquire())

    const stats = pool.getStats()
    expect(stats.active).toBe(2)
    expect(stats.total).toBe(2)

    // Try to acquire one more (should wait)
    const start = Date.now()
    const acquirePromise = pool.acquire()

    // Release one after a delay
    setTimeout(async () => {
      await pool.release(browsers[0]!)
    }, 100)

    const browser3 = await acquirePromise
    const duration = Date.now() - start

    expect(duration).toBeGreaterThanOrEqual(100)
    expect(browser3).toBeDefined()

    await pool.release(browsers[1]!)
    await pool.release(browser3)
  })
})
