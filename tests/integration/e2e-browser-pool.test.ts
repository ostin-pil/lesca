import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BrowserPool,
  SessionPoolManager,
  MetricsCollector,
  CircuitBreaker,
} from '@lesca/browser-automation'
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

describe('E2E: Session Pool Manager Integration', () => {
  let manager: SessionPoolManager
  let metricsCollector: MetricsCollector

  beforeEach(() => {
    metricsCollector = new MetricsCollector()
    manager = new SessionPoolManager(
      {
        strategy: 'per-session',
        perSessionMaxSize: 2,
        perSessionIdleTime: 1000,
        acquireTimeout: 5000,
        retryOnFailure: true,
        maxRetries: 2,
      },
      {},
      { metricsCollector }
    )
  })

  afterEach(async () => {
    await manager.drainAll()
    vi.clearAllMocks()
  })

  it('should create separate pools for different sessions', async () => {
    const pool1 = manager.getPool('session-1')
    const pool2 = manager.getPool('session-2')

    expect(pool1).not.toBe(pool2)

    const stats = manager.getStatistics()
    expect(stats).toHaveLength(2)
    expect(stats.map((s) => s.sessionName)).toContain('session-1')
    expect(stats.map((s) => s.sessionName)).toContain('session-2')
  })

  it('should track metrics across sessions', async () => {
    // Acquire browser from session-1
    const browser1 = await manager.acquireBrowser('session-1')
    await manager.releaseBrowser(browser1, 'session-1')

    // Acquire browser from session-2
    const browser2 = await manager.acquireBrowser('session-2')
    await manager.releaseBrowser(browser2, 'session-2')

    const summary = metricsCollector.getSummary()
    expect(summary.totalSessions).toBe(2)

    const session1Metrics = metricsCollector.getSessionMetrics('session-1')
    expect(session1Metrics?.totalAcquisitions).toBe(1)
    expect(session1Metrics?.totalReleases).toBe(1)

    const session2Metrics = metricsCollector.getSessionMetrics('session-2')
    expect(session2Metrics?.totalAcquisitions).toBe(1)
    expect(session2Metrics?.totalReleases).toBe(1)
  })

  it('should handle concurrent operations across sessions', async () => {
    const tasks = [
      manager.acquireBrowser('session-1'),
      manager.acquireBrowser('session-1'),
      manager.acquireBrowser('session-2'),
      manager.acquireBrowser('session-2'),
    ]

    const browsers = await Promise.all(tasks)
    expect(browsers).toHaveLength(4)

    // Release all
    await Promise.all([
      manager.releaseBrowser(browsers[0]!, 'session-1'),
      manager.releaseBrowser(browsers[1]!, 'session-1'),
      manager.releaseBrowser(browsers[2]!, 'session-2'),
      manager.releaseBrowser(browsers[3]!, 'session-2'),
    ])

    const stats = manager.getStatistics()
    const session1Stats = stats.find((s) => s.sessionName === 'session-1')
    const session2Stats = stats.find((s) => s.sessionName === 'session-2')

    expect(session1Stats?.acquisitionCount).toBe(2)
    expect(session2Stats?.acquisitionCount).toBe(2)
  })

  it('should drain individual session pools', async () => {
    await manager.acquireBrowser('session-1')
    await manager.acquireBrowser('session-2')

    // Drain only session-1
    await manager.drainSessionPool('session-1')

    const stats = manager.getStatistics()
    expect(stats).toHaveLength(1)
    expect(stats[0]?.sessionName).toBe('session-2')
  })
})

describe('E2E: Metrics Collection', () => {
  let pool: BrowserPool
  let metricsCollector: MetricsCollector

  beforeEach(() => {
    metricsCollector = new MetricsCollector()
    pool = new BrowserPool(
      {
        enabled: true,
        minSize: 0,
        maxSize: 3,
        maxIdleTime: 1000,
      },
      {},
      { metricsCollector, sessionName: 'test-session' }
    )
  })

  afterEach(async () => {
    await pool.drain()
    vi.clearAllMocks()
  })

  it('should record acquire and release events', async () => {
    const browser = await pool.acquire()
    await pool.release(browser)

    const metrics = metricsCollector.getSessionMetrics('test-session')
    expect(metrics?.totalAcquisitions).toBe(1)
    expect(metrics?.totalReleases).toBe(1)
    expect(metrics?.acquireTiming.count).toBe(1)
    expect(metrics?.releaseTiming.count).toBe(1)
  })

  it('should track browser creation', async () => {
    const browser = await pool.acquire()
    await pool.release(browser)

    const metrics = metricsCollector.getSessionMetrics('test-session')
    expect(metrics?.browsersCreated).toBe(1)
    expect(metrics?.browserCreateTiming.count).toBe(1)
  })

  it('should emit events to subscribers', async () => {
    const events: string[] = []
    metricsCollector.on('metric', (event) => {
      events.push(event.type)
    })

    const browser = await pool.acquire()
    await pool.release(browser)

    expect(events).toContain('pool:browser-created')
    expect(events).toContain('pool:acquire')
    expect(events).toContain('pool:release')
  })

  it('should calculate timing statistics', async () => {
    // Acquire and release multiple times
    for (let i = 0; i < 5; i++) {
      const browser = await pool.acquire()
      await new Promise((resolve) => setTimeout(resolve, 10))
      await pool.release(browser)
    }

    const metrics = metricsCollector.getSessionMetrics('test-session')
    expect(metrics?.acquireTiming.count).toBe(5)
    // With mocked browsers, timing may be 0ms - verify values are valid numbers
    expect(metrics?.acquireTiming.avgMs).toBeGreaterThanOrEqual(0)
    expect(metrics?.acquireTiming.minMs).toBeGreaterThanOrEqual(0)
    expect(metrics?.acquireTiming.maxMs).toBeGreaterThanOrEqual(0)
    expect(metrics?.acquireTiming.minMs).toBeLessThanOrEqual(metrics?.acquireTiming.maxMs ?? 0)
  })
})

describe('E2E: Circuit Breaker Recovery', () => {
  it('should transition through circuit states', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      successThreshold: 2,
    })

    // Initial state should be closed
    expect(circuitBreaker.getStats().state).toBe('closed')

    // Execute failing operations to trip the circuit
    const failingFn = async () => {
      throw new Error('Simulated failure')
    }

    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingFn)
      } catch {
        // Expected
      }
    }

    expect(circuitBreaker.getStats().state).toBe('open')
  })

  it('should block execution when open', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 1000,
      successThreshold: 1,
    })

    // Trip the circuit
    const failingFn = async () => {
      throw new Error('Simulated failure')
    }

    for (let i = 0; i < 2; i++) {
      try {
        await circuitBreaker.execute(failingFn)
      } catch {
        // Expected
      }
    }

    expect(circuitBreaker.getStats().state).toBe('open')

    // Next call should be blocked
    const successFn = async () => 'success'
    await expect(circuitBreaker.execute(successFn)).rejects.toThrow('Circuit breaker is open')
  })

  it('should allow manual trip and reset', () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 1000,
      successThreshold: 2,
    })

    expect(circuitBreaker.getStats().state).toBe('closed')

    // Manual trip
    circuitBreaker.trip()
    expect(circuitBreaker.getStats().state).toBe('open')

    // Manual reset
    circuitBreaker.reset()
    expect(circuitBreaker.getStats().state).toBe('closed')
  })

  it('should track statistics accurately', async () => {
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 10, // High threshold to avoid tripping
      resetTimeout: 1000,
      successThreshold: 2,
    })

    const successFn = async () => 'success'
    const failingFn = async () => {
      throw new Error('fail')
    }

    // Mix of successes and failures
    await circuitBreaker.execute(successFn)
    await circuitBreaker.execute(successFn)
    try {
      await circuitBreaker.execute(failingFn)
    } catch {
      // Expected
    }
    await circuitBreaker.execute(successFn)
    try {
      await circuitBreaker.execute(failingFn)
    } catch {
      // Expected
    }

    const stats = circuitBreaker.getStats()
    expect(stats.totalSuccesses).toBe(3)
    expect(stats.totalFailures).toBe(2)
    expect(stats.totalCalls).toBe(5)
    expect(stats.state).toBe('closed') // Not enough failures to trip
  })
})

describe('E2E: Pool Behavior Under Load', () => {
  let pool: BrowserPool

  beforeEach(() => {
    pool = new BrowserPool({
      enabled: true,
      minSize: 0,
      maxSize: 3,
      maxIdleTime: 5000,
    })
  })

  afterEach(async () => {
    await pool.drain()
    vi.clearAllMocks()
  })

  it('should handle burst of requests', async () => {
    const burstSize = 10
    const results: { id: number; acquireTime: number }[] = []

    const task = async (id: number) => {
      const start = Date.now()
      const browser = await pool.acquire()
      const acquireTime = Date.now() - start

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, 20))

      await pool.release(browser)
      results.push({ id, acquireTime })
    }

    // Fire burst of requests
    await Promise.all(Array.from({ length: burstSize }, (_, i) => task(i)))

    expect(results).toHaveLength(burstSize)

    // First 3 should be fast (immediate acquire)
    // Rest should be slower (waiting for release)
    const stats = pool.getStats()
    expect(stats.created).toBeLessThanOrEqual(3)
    expect(stats.reused).toBeGreaterThan(0)
  })

  it('should maintain pool size under sustained load', async () => {
    const iterations = 20
    const concurrency = 2

    for (let i = 0; i < iterations; i++) {
      const browsers = await Promise.all([pool.acquire(), pool.acquire()])

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, 10))

      await Promise.all(browsers.map((b) => pool.release(b)))
    }

    const stats = pool.getStats()
    // Should reuse heavily, not create many browsers
    expect(stats.created).toBeLessThanOrEqual(concurrency)
    expect(stats.reused).toBeGreaterThan(iterations) // Many reuses
  })

  it('should track reuse ratio', async () => {
    // Acquire and release same browsers repeatedly
    for (let i = 0; i < 10; i++) {
      const browser = await pool.acquire()
      await pool.release(browser)
    }

    const stats = pool.getStats()
    // Only 1 browser created, reused 9 times
    expect(stats.created).toBe(1)
    expect(stats.reused).toBe(9)

    const reuseRatio = stats.reused / (stats.created + stats.reused)
    expect(reuseRatio).toBeGreaterThan(0.8)
  })
})

describe('E2E: Session Persistence', () => {
  const testSessionsDir = '/tmp/lesca-test-sessions-' + Date.now()

  afterEach(async () => {
    // Clean up test sessions directory
    const { rm } = await import('fs/promises')
    try {
      await rm(testSessionsDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should persist session data across manager instances', async () => {
    const { SessionManager } = await import('@lesca/browser-automation')

    // Create first manager instance and save a session
    const manager1 = new SessionManager(testSessionsDir)

    const testSessionData = {
      name: 'test-session',
      cookies: [
        {
          name: 'session_id',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax' as const,
        },
      ],
      localStorage: { theme: 'dark', language: 'en' },
      sessionStorage: { currentPage: '1' },
      metadata: {
        created: Date.now(),
        lastUsed: Date.now(),
        description: 'Test session for persistence',
      },
    }

    await manager1.saveSession('test-session', testSessionData)

    // Create a NEW manager instance (simulating restart)
    const manager2 = new SessionManager(testSessionsDir)

    // Verify session persisted
    const restored = await manager2.getSession('test-session')

    expect(restored).not.toBeNull()
    expect(restored?.name).toBe('test-session')
    expect(restored?.cookies).toHaveLength(1)
    expect(restored?.cookies[0]?.name).toBe('session_id')
    expect(restored?.cookies[0]?.value).toBe('abc123')
    expect(restored?.localStorage).toEqual({ theme: 'dark', language: 'en' })
    expect(restored?.sessionStorage).toEqual({ currentPage: '1' })
    expect(restored?.metadata.description).toBe('Test session for persistence')
  })

  it('should list all active sessions after restart', async () => {
    const { SessionManager } = await import('@lesca/browser-automation')

    const manager1 = new SessionManager(testSessionsDir)

    // Save multiple sessions
    const sessions = ['session-a', 'session-b', 'session-c']
    for (const name of sessions) {
      await manager1.saveSession(name, {
        name,
        cookies: [
          {
            name: 'id',
            value: name,
            domain: 'test.com',
            path: '/',
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax' as const,
          },
        ],
        localStorage: {},
        sessionStorage: {},
        metadata: { created: Date.now(), lastUsed: Date.now() },
      })
    }

    // Create new manager instance
    const manager2 = new SessionManager(testSessionsDir)
    const activeSessions = await manager2.listActiveSessions()

    expect(activeSessions).toHaveLength(3)
    const names = activeSessions.map((s) => s.name)
    expect(names).toContain('session-a')
    expect(names).toContain('session-b')
    expect(names).toContain('session-c')
  })

  it('should handle expired sessions correctly', async () => {
    const { SessionManager } = await import('@lesca/browser-automation')

    const manager1 = new SessionManager(testSessionsDir)

    // Save an expired session
    const expiredTime = Date.now() - 1000 // 1 second ago
    await manager1.saveSession('expired-session', {
      name: 'expired-session',
      cookies: [
        {
          name: 'id',
          value: 'expired',
          domain: 'test.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      localStorage: {},
      sessionStorage: {},
      metadata: { created: Date.now() - 10000, lastUsed: Date.now() - 10000, expires: expiredTime },
    })

    // Save a valid session
    await manager1.saveSession('valid-session', {
      name: 'valid-session',
      cookies: [
        {
          name: 'id',
          value: 'valid',
          domain: 'test.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      localStorage: {},
      sessionStorage: {},
      metadata: { created: Date.now(), lastUsed: Date.now() },
    })

    // Create new manager and try to retrieve sessions
    const manager2 = new SessionManager(testSessionsDir)

    // Expired session should return null
    const expiredResult = await manager2.getSession('expired-session')
    expect(expiredResult).toBeNull()

    // Valid session should be returned
    const validResult = await manager2.getSession('valid-session')
    expect(validResult).not.toBeNull()
    expect(validResult?.name).toBe('valid-session')
  })

  it('should validate session integrity', async () => {
    const { SessionManager } = await import('@lesca/browser-automation')

    const manager = new SessionManager(testSessionsDir)

    // Save valid session with cookies
    await manager.saveSession('valid-with-cookies', {
      name: 'valid-with-cookies',
      cookies: [
        {
          name: 'auth',
          value: 'token123',
          domain: 'test.com',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: 'Strict' as const,
        },
      ],
      localStorage: {},
      sessionStorage: {},
      metadata: { created: Date.now(), lastUsed: Date.now() },
    })

    // Save session without cookies
    await manager.saveSession('no-cookies', {
      name: 'no-cookies',
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      metadata: { created: Date.now(), lastUsed: Date.now() },
    })

    // Validate sessions
    const validWithCookies = await manager.validateSession('valid-with-cookies')
    expect(validWithCookies).toBe(true)

    const noCookies = await manager.validateSession('no-cookies')
    expect(noCookies).toBe(false)

    const nonExistent = await manager.validateSession('non-existent')
    expect(nonExistent).toBe(false)
  })

  it('should handle session rename across restart', async () => {
    const { SessionManager } = await import('@lesca/browser-automation')

    const manager1 = new SessionManager(testSessionsDir)

    // Save session with original name
    await manager1.saveSession('original-name', {
      name: 'original-name',
      cookies: [
        {
          name: 'id',
          value: 'test',
          domain: 'test.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      localStorage: { key: 'value' },
      sessionStorage: {},
      metadata: { created: Date.now(), lastUsed: Date.now() },
    })

    // Rename session
    await manager1.renameSession('original-name', 'new-name')

    // Create new manager and verify
    const manager2 = new SessionManager(testSessionsDir)

    const oldSession = await manager2.getSession('original-name')
    expect(oldSession).toBeNull()

    const newSession = await manager2.getSession('new-name')
    expect(newSession).not.toBeNull()
    expect(newSession?.name).toBe('new-name')
    expect(newSession?.localStorage).toEqual({ key: 'value' })
  })

  it('should cleanup expired sessions', async () => {
    const { SessionManager } = await import('@lesca/browser-automation')

    const manager = new SessionManager(testSessionsDir)

    // Save mix of expired and valid sessions
    const expiredTime = Date.now() - 1000

    await manager.saveSession('expired-1', {
      name: 'expired-1',
      cookies: [
        {
          name: 'id',
          value: 'e1',
          domain: 'test.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      localStorage: {},
      sessionStorage: {},
      metadata: { created: Date.now(), lastUsed: Date.now(), expires: expiredTime },
    })

    await manager.saveSession('expired-2', {
      name: 'expired-2',
      cookies: [
        {
          name: 'id',
          value: 'e2',
          domain: 'test.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      localStorage: {},
      sessionStorage: {},
      metadata: { created: Date.now(), lastUsed: Date.now(), expires: expiredTime },
    })

    await manager.saveSession('valid-session', {
      name: 'valid-session',
      cookies: [
        {
          name: 'id',
          value: 'v1',
          domain: 'test.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      localStorage: {},
      sessionStorage: {},
      metadata: { created: Date.now(), lastUsed: Date.now() },
    })

    // Run cleanup
    const cleanedCount = await manager.cleanupExpiredSessions()
    expect(cleanedCount).toBe(2)

    // Verify only valid session remains
    const sessions = await manager.listActiveSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.name).toBe('valid-session')
  })

  it('should merge sessions correctly', async () => {
    const { SessionManager } = await import('@lesca/browser-automation')

    const manager = new SessionManager(testSessionsDir)

    // Create source sessions
    await manager.saveSession('source-1', {
      name: 'source-1',
      cookies: [
        {
          name: 'cookie-a',
          value: 'value-a',
          domain: 'test.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      localStorage: { key1: 'from-source-1' },
      sessionStorage: {},
      metadata: { created: Date.now() - 2000, lastUsed: Date.now() - 2000 },
    })

    await manager.saveSession('source-2', {
      name: 'source-2',
      cookies: [
        {
          name: 'cookie-b',
          value: 'value-b',
          domain: 'test.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      localStorage: { key2: 'from-source-2' },
      sessionStorage: { sessionKey: 'sessionValue' },
      metadata: { created: Date.now() - 1000, lastUsed: Date.now() - 1000 },
    })

    // Merge sessions
    const merged = await manager.mergeSessions(
      ['source-1', 'source-2'],
      'merged-session',
      'merge-all'
    )

    expect(merged.name).toBe('merged-session')
    expect(merged.cookies).toHaveLength(2)
    expect(merged.localStorage).toEqual({ key1: 'from-source-1', key2: 'from-source-2' })
    expect(merged.sessionStorage).toEqual({ sessionKey: 'sessionValue' })

    // Verify persistence
    const manager2 = new SessionManager(testSessionsDir)
    const restoredMerged = await manager2.getSession('merged-session')
    expect(restoredMerged?.cookies).toHaveLength(2)
  })

  it('should handle corrupted session files gracefully', async () => {
    const { SessionManager } = await import('@lesca/browser-automation')
    const { writeFile, mkdir } = await import('fs/promises')

    // Create sessions directory
    await mkdir(testSessionsDir, { recursive: true })

    // Write a corrupted session file
    await writeFile(`${testSessionsDir}/corrupted.json`, '{ invalid json content', 'utf-8')

    // Write a valid session file
    const manager1 = new SessionManager(testSessionsDir)
    await manager1.saveSession('valid', {
      name: 'valid',
      cookies: [
        {
          name: 'id',
          value: 'valid',
          domain: 'test.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      localStorage: {},
      sessionStorage: {},
      metadata: { created: Date.now(), lastUsed: Date.now() },
    })

    // Create new manager and verify it handles corruption gracefully
    const manager2 = new SessionManager(testSessionsDir)

    // Corrupted session should return null without throwing
    const corrupted = await manager2.getSession('corrupted')
    expect(corrupted).toBeNull()

    // Valid session should still work
    const valid = await manager2.getSession('valid')
    expect(valid).not.toBeNull()
  })
})
