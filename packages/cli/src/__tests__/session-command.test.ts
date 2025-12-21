import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock SessionManager instance
const mockSessionManagerInstance = {
  listActiveSessions: vi.fn(),
  deleteSession: vi.fn(),
  renameSession: vi.fn(),
  getSession: vi.fn(),
}

// Mock MetricsCollector instance
const mockMetricsCollectorInstance = {
  getSessionMetrics: vi.fn(),
  getSummary: vi.fn(),
  reset: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}

vi.mock('@lesca/browser-automation', () => ({
  SessionManager: vi.fn(() => mockSessionManagerInstance),
  MetricsCollector: vi.fn(() => mockMetricsCollectorInstance),
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

    // Reset metrics collector mock
    mockMetricsCollectorInstance.getSessionMetrics.mockReset()
    mockMetricsCollectorInstance.getSummary.mockReset()
    mockMetricsCollectorInstance.reset.mockReset()
    mockMetricsCollectorInstance.on.mockReset()
    mockMetricsCollectorInstance.off.mockReset()

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

  describe('stats subcommand', () => {
    it('should display message when no metrics available', async () => {
      mockMetricsCollectorInstance.getSummary.mockReturnValue({
        totalSessions: 0,
        sessions: [],
        totalActiveBrowsers: 0,
        totalIdleBrowsers: 0,
        globalAcquisitionsPerMinute: 0,
        globalFailureRate: 0,
        circuitsOpen: 0,
        circuitsHalfOpen: 0,
      })

      await program.parseAsync(['node', 'lesca', 'session', 'stats'])

      expect(logger.info).toHaveBeenCalledWith('No pool metrics available.')
    })

    it('should display metrics summary when sessions exist', async () => {
      mockMetricsCollectorInstance.getSummary.mockReturnValue({
        totalSessions: 1,
        sessions: [
          {
            sessionName: 'test-session',
            poolSize: 2,
            activeBrowsers: 1,
            idleBrowsers: 1,
            totalAcquisitions: 10,
            totalReleases: 9,
            totalFailures: 0,
            browsersCreated: 2,
            browsersDestroyed: 0,
            circuitState: 'closed',
            circuitTrips: 0,
            acquisitionsPerMinute: 5,
            failureRate: 0,
            acquireTiming: { count: 10, avgMs: 50, minMs: 20, maxMs: 100 },
            releaseTiming: { count: 9, avgMs: 5, minMs: 2, maxMs: 10 },
            browserCreateTiming: { count: 2, avgMs: 2000, minMs: 1500, maxMs: 2500 },
            firstEventAt: Date.now() - 60000,
            lastEventAt: Date.now(),
          },
        ],
        totalActiveBrowsers: 1,
        totalIdleBrowsers: 1,
        globalAcquisitionsPerMinute: 5,
        globalFailureRate: 0,
        circuitsOpen: 0,
        circuitsHalfOpen: 0,
      })

      await program.parseAsync(['node', 'lesca', 'session', 'stats'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('POOL METRICS SUMMARY'))
    })

    it('should display specific session metrics', async () => {
      mockMetricsCollectorInstance.getSessionMetrics.mockReturnValue({
        sessionName: 'my-session',
        poolSize: 2,
        activeBrowsers: 1,
        idleBrowsers: 1,
        totalAcquisitions: 5,
        totalReleases: 4,
        totalFailures: 0,
        browsersCreated: 2,
        browsersDestroyed: 0,
        circuitState: 'closed',
        circuitTrips: 0,
        acquisitionsPerMinute: 2.5,
        failureRate: 0,
        acquireTiming: { count: 5, avgMs: 50, minMs: 20, maxMs: 100 },
        releaseTiming: { count: 4, avgMs: 5, minMs: 2, maxMs: 10 },
        browserCreateTiming: { count: 2, avgMs: 2000, minMs: 1500, maxMs: 2500 },
        firstEventAt: Date.now() - 60000,
        lastEventAt: Date.now(),
      })

      await program.parseAsync(['node', 'lesca', 'session', 'stats', '-s', 'my-session'])

      expect(mockMetricsCollectorInstance.getSessionMetrics).toHaveBeenCalledWith('my-session')
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('my-session'))
    })

    it('should warn when specific session metrics not found', async () => {
      mockMetricsCollectorInstance.getSessionMetrics.mockReturnValue(undefined)

      await program.parseAsync(['node', 'lesca', 'session', 'stats', '-s', 'unknown-session'])

      expect(mockMetricsCollectorInstance.getSessionMetrics).toHaveBeenCalledWith('unknown-session')
      expect(logger.warn).toHaveBeenCalledWith('No metrics found for session "unknown-session"')
    })

    it('should output JSON format when --json flag is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      mockMetricsCollectorInstance.getSummary.mockReturnValue({
        totalSessions: 1,
        sessions: [],
        totalActiveBrowsers: 0,
        totalIdleBrowsers: 0,
        globalAcquisitionsPerMinute: 0,
        globalFailureRate: 0,
        circuitsOpen: 0,
        circuitsHalfOpen: 0,
      })

      await program.parseAsync(['node', 'lesca', 'session', 'stats', '--json'])

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"totalSessions": 1'))
      consoleSpy.mockRestore()
    })
  })

  describe('stats-reset subcommand', () => {
    it('should reset pool statistics', async () => {
      await program.parseAsync(['node', 'lesca', 'session', 'stats-reset'])

      expect(mockMetricsCollectorInstance.reset).toHaveBeenCalled()
      expect(logger.success).toHaveBeenCalledWith('Pool statistics reset')
    })
  })

  describe('stats export subcommand', () => {
    it('should export metrics to JSON file', async () => {
      const mockWriteFileSync = vi.fn()
      vi.doMock('fs', () => ({
        writeFileSync: mockWriteFileSync,
      }))

      mockMetricsCollectorInstance.exportToJSON = vi.fn().mockReturnValue('{"test": true}')

      await program.parseAsync(['node', 'lesca', 'session', 'stats', '-e', '/tmp/metrics.json'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Exporting metrics to JSON'))
    })

    it('should export metrics to CSV file', async () => {
      const mockWriteFileSync = vi.fn()
      vi.doMock('fs', () => ({
        writeFileSync: mockWriteFileSync,
      }))

      mockMetricsCollectorInstance.exportToCSV = vi.fn().mockReturnValue('session,count\ntest,5')

      await program.parseAsync(['node', 'lesca', 'session', 'stats', '-e', '/tmp/metrics.csv'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Exporting metrics to CSV'))
    })

    it('should handle export with include-history flag', async () => {
      const mockWriteFileSync = vi.fn()
      vi.doMock('fs', () => ({
        writeFileSync: mockWriteFileSync,
      }))

      mockMetricsCollectorInstance.exportToJSON = vi.fn().mockReturnValue('{"history": []}')

      await program.parseAsync([
        'node',
        'lesca',
        'session',
        'stats',
        '-e',
        '/tmp/metrics.json',
        '--include-history',
      ])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Exporting metrics to JSON'))
    })
  })

  describe('stats with timing stats edge cases', () => {
    it('should handle timing stats with zero count', async () => {
      mockMetricsCollectorInstance.getSummary.mockReturnValue({
        totalSessions: 1,
        sessions: [
          {
            sessionName: 'empty-timing',
            poolSize: 1,
            activeBrowsers: 0,
            idleBrowsers: 1,
            totalAcquisitions: 0,
            totalReleases: 0,
            totalFailures: 0,
            browsersCreated: 1,
            browsersDestroyed: 0,
            circuitState: 'closed',
            circuitTrips: 0,
            acquisitionsPerMinute: 0,
            failureRate: 0,
            acquireTiming: { count: 0, avgMs: 0, minMs: 0, maxMs: 0 },
            releaseTiming: { count: 0, avgMs: 0, minMs: 0, maxMs: 0 },
            browserCreateTiming: { count: 0, avgMs: 0, minMs: 0, maxMs: 0 },
            firstEventAt: Date.now(),
            lastEventAt: Date.now(),
          },
        ],
        totalActiveBrowsers: 0,
        totalIdleBrowsers: 1,
        globalAcquisitionsPerMinute: 0,
        globalFailureRate: 0,
        circuitsOpen: 0,
        circuitsHalfOpen: 0,
      })

      await program.parseAsync(['node', 'lesca', 'session', 'stats'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('empty-timing'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No data'))
    })

    it('should display specific session JSON output', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      mockMetricsCollectorInstance.getSessionMetrics.mockReturnValue({
        sessionName: 'json-session',
        poolSize: 1,
        activeBrowsers: 0,
        idleBrowsers: 1,
        totalAcquisitions: 0,
        totalReleases: 0,
        totalFailures: 0,
        browsersCreated: 1,
        browsersDestroyed: 0,
        circuitState: 'closed',
        circuitTrips: 0,
        acquisitionsPerMinute: 0,
        failureRate: 0,
        acquireTiming: { count: 0, avgMs: 0, minMs: 0, maxMs: 0 },
        releaseTiming: { count: 0, avgMs: 0, minMs: 0, maxMs: 0 },
        browserCreateTiming: { count: 0, avgMs: 0, minMs: 0, maxMs: 0 },
        firstEventAt: Date.now(),
        lastEventAt: Date.now(),
      })

      await program.parseAsync([
        'node',
        'lesca',
        'session',
        'stats',
        '-s',
        'json-session',
        '--json',
      ])

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"sessionName": "json-session"')
      )
      consoleSpy.mockRestore()
    })
  })

  describe('cleanup subcommand', () => {
    const mockCleanupSchedulerInstance = {
      cleanup: vi.fn(),
    }

    beforeEach(() => {
      vi.doMock('@lesca/browser-automation', () => ({
        SessionManager: vi.fn(() => mockSessionManagerInstance),
        MetricsCollector: vi.fn(() => mockMetricsCollectorInstance),
        SessionCleanupScheduler: vi.fn(() => mockCleanupSchedulerInstance),
      }))
      mockCleanupSchedulerInstance.cleanup.mockReset()
    })

    it('should run cleanup and report results', async () => {
      mockCleanupSchedulerInstance.cleanup.mockResolvedValue({
        cleaned: ['old-session-1', 'old-session-2'],
        kept: ['active-session'],
        errors: [],
        dryRun: false,
      })

      // Re-import to get fresh command with mocked dependencies
      vi.resetModules()
      const { sessionCommand: freshCmd } = await import('../commands/session')
      const freshProgram = new Command()
      freshProgram.exitOverride()
      freshProgram.addCommand(freshCmd)

      await freshProgram.parseAsync(['node', 'lesca', 'session', 'cleanup'])

      expect(logger.info).toHaveBeenCalled()
    })

    it('should run cleanup in dry-run mode', async () => {
      mockCleanupSchedulerInstance.cleanup.mockResolvedValue({
        cleaned: ['would-clean-session'],
        kept: ['kept-session'],
        errors: [],
        dryRun: true,
      })

      vi.resetModules()
      const { sessionCommand: freshCmd } = await import('../commands/session')
      const freshProgram = new Command()
      freshProgram.exitOverride()
      freshProgram.addCommand(freshCmd)

      await freshProgram.parseAsync(['node', 'lesca', 'session', 'cleanup', '--dry-run'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('dry-run mode'))
    })

    it('should report no sessions to clean when result is empty', async () => {
      mockCleanupSchedulerInstance.cleanup.mockResolvedValue({
        cleaned: [],
        kept: [],
        errors: [],
        dryRun: false,
      })

      vi.resetModules()
      const { sessionCommand: freshCmd } = await import('../commands/session')
      const freshProgram = new Command()
      freshProgram.exitOverride()
      freshProgram.addCommand(freshCmd)

      await freshProgram.parseAsync(['node', 'lesca', 'session', 'cleanup'])

      expect(logger.info).toHaveBeenCalledWith('No sessions to clean up')
    })

    it('should report errors during cleanup', async () => {
      mockCleanupSchedulerInstance.cleanup.mockResolvedValue({
        cleaned: [],
        kept: [],
        errors: [{ session: 'corrupt-session', error: 'File corrupted' }],
        dryRun: false,
      })

      vi.resetModules()
      const { sessionCommand: freshCmd } = await import('../commands/session')
      const freshProgram = new Command()
      freshProgram.exitOverride()
      freshProgram.addCommand(freshCmd)

      await freshProgram.parseAsync(['node', 'lesca', 'session', 'cleanup'])

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Errors: 1'))
    })

    it('should respect max-age and max-sessions options', async () => {
      mockCleanupSchedulerInstance.cleanup.mockResolvedValue({
        cleaned: [],
        kept: [],
        errors: [],
        dryRun: false,
      })

      vi.resetModules()
      const { sessionCommand: freshCmd } = await import('../commands/session')
      const freshProgram = new Command()
      freshProgram.exitOverride()
      freshProgram.addCommand(freshCmd)

      await freshProgram.parseAsync([
        'node',
        'lesca',
        'session',
        'cleanup',
        '--max-age',
        '14',
        '--max-sessions',
        '5',
      ])

      expect(logger.info).toHaveBeenCalledWith('No sessions to clean up')
    })
  })
})
