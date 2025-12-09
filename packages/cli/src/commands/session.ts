import { SessionManager, MetricsCollector } from '@lesca/browser-automation'
import type { MetricsSummary, SessionMetrics } from '@lesca/browser-automation'
import { logger } from '@lesca/shared/utils'
import { Command } from 'commander'

/**
 * Global metrics collector instance (shared across commands)
 * This allows stats to persist during a CLI session
 */
let globalMetricsCollector: MetricsCollector | undefined

/**
 * Get or create the global metrics collector
 */
export function getMetricsCollector(): MetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new MetricsCollector()
  }
  return globalMetricsCollector
}

/**
 * Format timing stats for display
 */
function formatTimingStats(stats: {
  count: number
  avgMs: number
  minMs: number
  maxMs: number
}): string {
  if (stats.count === 0) return 'No data'
  return `avg: ${stats.avgMs.toFixed(1)}ms, min: ${stats.minMs.toFixed(1)}ms, max: ${stats.maxMs.toFixed(1)}ms (${stats.count} samples)`
}

/**
 * Format session metrics for display
 */
function formatSessionMetrics(metrics: SessionMetrics): string {
  const lines = [
    `📦 Session: ${metrics.sessionName}`,
    `   Pool: ${metrics.activeBrowsers} active, ${metrics.idleBrowsers} idle (${metrics.poolSize} total)`,
    `   Acquisitions: ${metrics.totalAcquisitions} (${metrics.acquisitionsPerMinute.toFixed(1)}/min)`,
    `   Releases: ${metrics.totalReleases}`,
    `   Failures: ${metrics.totalFailures} (${(metrics.failureRate * 100).toFixed(1)}% rate)`,
    `   Browsers: ${metrics.browsersCreated} created, ${metrics.browsersDestroyed} destroyed`,
    `   Circuit: ${metrics.circuitState} (${metrics.circuitTrips} trips)`,
    `   Acquire timing: ${formatTimingStats(metrics.acquireTiming)}`,
    `   Release timing: ${formatTimingStats(metrics.releaseTiming)}`,
    `   Browser create: ${formatTimingStats(metrics.browserCreateTiming)}`,
  ]
  return lines.join('\n')
}

/**
 * Format metrics summary for display
 */
function formatMetricsSummary(summary: MetricsSummary): string {
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '                    POOL METRICS SUMMARY',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Sessions: ${summary.totalSessions}`,
    `Browsers: ${summary.totalActiveBrowsers} active, ${summary.totalIdleBrowsers} idle`,
    `Global acquisition rate: ${summary.globalAcquisitionsPerMinute.toFixed(1)}/min`,
    `Global failure rate: ${(summary.globalFailureRate * 100).toFixed(1)}%`,
    `Circuit breakers: ${summary.circuitsOpen} open, ${summary.circuitsHalfOpen} half-open`,
    '',
  ]

  if (summary.sessions.length > 0) {
    lines.push('─────────────────────────────────────────────────────────────────')
    lines.push('                    PER-SESSION DETAILS')
    lines.push('─────────────────────────────────────────────────────────────────')
    lines.push('')
    for (const session of summary.sessions) {
      lines.push(formatSessionMetrics(session))
      lines.push('')
    }
  }

  lines.push('═══════════════════════════════════════════════════════════════')

  return lines.join('\n')
}

/**
 * Session management commands
 */
export const sessionCommand = new Command('session').description('Manage browser sessions')

// List all saved sessions
sessionCommand
  .command('list')
  .description('List all saved sessions')
  .action(async () => {
    const sessionManager = new SessionManager()
    const sessions = await sessionManager.listActiveSessions()

    if (sessions.length === 0) {
      logger.info('No sessions found')
      return
    }

    logger.box('Saved Sessions')
    for (const session of sessions) {
      logger.info(
        `
📦 ${session.name}
  Created: ${new Date(session.metadata.created).toLocaleString()}
  Last Used: ${new Date(session.metadata.lastUsed).toLocaleString()}
  Cookies: ${session.cookies.length}
  ${session.metadata.description ? `Description: ${session.metadata.description}` : ''}
      `.trim()
      )
    }
  })

// Delete a session
sessionCommand
  .command('delete <name>')
  .description('Delete a session')
  .action(async (name: string) => {
    const sessionManager = new SessionManager()
    const deleted = await sessionManager.deleteSession(name)

    if (deleted) {
      logger.success(`Session "${name}" deleted`)
    } else {
      logger.warn(`Session "${name}" not found`)
    }
  })

// Rename a session
sessionCommand
  .command('rename <old> <new>')
  .description('Rename a session')
  .action(async (oldName: string, newName: string) => {
    const sessionManager = new SessionManager()

    try {
      await sessionManager.renameSession(oldName, newName)
      logger.success(`Session renamed: "${oldName}" → "${newName}"`)
    } catch (error) {
      logger.error('Failed to rename session', error instanceof Error ? error : undefined)
    }
  })

// Show session details
sessionCommand
  .command('info <name>')
  .description('Show session details')
  .action(async (name: string) => {
    const sessionManager = new SessionManager()
    const session = await sessionManager.getSession(name)

    if (!session) {
      logger.warn(`Session "${name}" not found`)
      return
    }

    logger.box(`Session: ${session.name}`)
    logger.info(
      `
Created: ${new Date(session.metadata.created).toLocaleString()}
Last Used: ${new Date(session.metadata.lastUsed).toLocaleString()}
Expires: ${session.metadata.expires ? new Date(session.metadata.expires).toLocaleString() : 'Never'}

Cookies: ${session.cookies.length}
LocalStorage Keys: ${Object.keys(session.localStorage).length}
SessionStorage Keys: ${Object.keys(session.sessionStorage).length}

${session.metadata.description ? `Description: ${session.metadata.description}` : ''}
    `.trim()
    )
  })

/**
 * Clear terminal screen
 */
function clearScreen(): void {
  process.stdout.write('\x1B[2J\x1B[0f')
}

/**
 * Display metrics with timestamp
 */
function displayMetricsWithTimestamp(collector: MetricsCollector, sessionName?: string): void {
  const timestamp = new Date().toLocaleTimeString()

  if (sessionName) {
    const metrics = collector.getSessionMetrics(sessionName)
    if (metrics) {
      // eslint-disable-next-line no-console -- Terminal output for watch mode
      console.log(`[${timestamp}] Watching session: ${sessionName}\n`)
      // eslint-disable-next-line no-console -- Terminal output for watch mode
      console.log(formatSessionMetrics(metrics))
    } else {
      // eslint-disable-next-line no-console -- Terminal output for watch mode
      console.log(`[${timestamp}] Waiting for metrics from session: ${sessionName}...`)
    }
  } else {
    const summary = collector.getSummary()
    // eslint-disable-next-line no-console -- Terminal output for watch mode
    console.log(`[${timestamp}] Pool Metrics (Press Ctrl+C to exit)\n`)
    if (summary.totalSessions > 0) {
      // eslint-disable-next-line no-console -- Terminal output for watch mode
      console.log(formatMetricsSummary(summary))
    } else {
      // eslint-disable-next-line no-console -- Terminal output for watch mode
      console.log('Waiting for pool activity...')
    }
  }
}

// Show pool statistics
sessionCommand
  .command('stats')
  .description('Show browser pool statistics and metrics')
  .option('-s, --session <name>', 'Show stats for specific session')
  .option('--json', 'Output in JSON format')
  .option('-w, --watch', 'Watch mode: continuously update metrics')
  .option('-i, --interval <ms>', 'Update interval in milliseconds (default: 2000)', '2000')
  .action((options: { session?: string; json?: boolean; watch?: boolean; interval?: string }) => {
    const collector = getMetricsCollector()

    if (options.watch) {
      // Watch mode: clear screen and display metrics at intervals
      const intervalMs = parseInt(options.interval ?? '2000', 10)
      let isRunning = true

      // Handle Ctrl+C gracefully
      const cleanup = (): void => {
        isRunning = false
        // eslint-disable-next-line no-console -- Terminal output for exit message
        console.log('\nExiting watch mode...')
        process.exit(0)
      }
      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)

      // Initial display
      clearScreen()
      displayMetricsWithTimestamp(collector, options.session)

      // Subscribe to metric events for real-time updates
      collector.on('metric', () => {
        if (isRunning) {
          clearScreen()
          displayMetricsWithTimestamp(collector, options.session)
        }
      })

      // Periodic refresh (in case no events arrive)
      const refreshInterval = setInterval(() => {
        if (isRunning) {
          clearScreen()
          displayMetricsWithTimestamp(collector, options.session)
        }
      }, intervalMs)

      // Keep process alive
      process.stdin.resume()

      // Cleanup on process exit
      process.on('exit', () => {
        clearInterval(refreshInterval)
      })

      return
    }

    // Non-watch mode: display once
    if (options.session) {
      const metrics = collector.getSessionMetrics(options.session)
      if (!metrics) {
        logger.warn(`No metrics found for session "${options.session}"`)
        logger.info('Note: Pool metrics are only available during active scraping operations.')
        return
      }

      if (options.json) {
        // eslint-disable-next-line no-console -- JSON output for machine consumption
        console.log(JSON.stringify(metrics, null, 2))
      } else {
        logger.info(formatSessionMetrics(metrics))
      }
    } else {
      const summary = collector.getSummary()

      if (summary.totalSessions === 0) {
        logger.info('No pool metrics available.')
        logger.info('Note: Pool metrics are collected during active scraping operations.')
        logger.info('Use --session <name> to view metrics for a specific session.')
        return
      }

      if (options.json) {
        // eslint-disable-next-line no-console -- JSON output for machine consumption
        console.log(JSON.stringify(summary, null, 2))
      } else {
        logger.info(formatMetricsSummary(summary))
      }
    }
  })

// Reset pool statistics
sessionCommand
  .command('stats-reset')
  .description('Reset pool statistics')
  .action(() => {
    const collector = getMetricsCollector()
    collector.reset()
    logger.success('Pool statistics reset')
  })
