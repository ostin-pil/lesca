/**
 * Stats Tracker Plugin
 *
 * This plugin tracks scraping statistics and generates reports:
 * - Counts problems scraped by difficulty
 * - Tracks success/failure rates
 * - Records timing information
 * - Generates summary reports
 *
 * @example
 * ```typescript
 * import { statsTrackerPlugin, getStats, resetStats } from './stats-tracker'
 *
 * const pluginManager = new PluginManager()
 * pluginManager.register(statsTrackerPlugin)
 *
 * // After scraping...
 * const stats = getStats()
 * console.log(`Scraped ${stats.total} problems`)
 * ```
 */

import type {
  Plugin,
  PluginContext,
  ScrapeRequest,
  ScrapeResult,
  Problem,
} from '@lesca/shared/types'

/**
 * Statistics structure
 */
export interface ScrapingStats {
  /** Total scrape attempts */
  total: number
  /** Successful scrapes */
  successful: number
  /** Failed scrapes */
  failed: number
  /** Count by type */
  byType: Record<string, number>
  /** Count by difficulty (for problems) */
  byDifficulty: Record<string, number>
  /** Timing statistics */
  timing: {
    /** Total time spent scraping (ms) */
    totalTime: number
    /** Average time per scrape (ms) */
    averageTime: number
    /** Fastest scrape (ms) */
    minTime: number
    /** Slowest scrape (ms) */
    maxTime: number
  }
  /** Timestamps */
  startedAt: Date | null
  lastScrapeAt: Date | null
  /** Recent scrapes (last 10) */
  recentScrapes: Array<{
    slug: string
    type: string
    success: boolean
    duration: number
    timestamp: Date
  }>
}

/**
 * Internal state
 */
let stats: ScrapingStats = createEmptyStats()
let currentScrapeStart: number | null = null
let logger: PluginContext['logger']

/**
 * Create empty stats object
 */
function createEmptyStats(): ScrapingStats {
  return {
    total: 0,
    successful: 0,
    failed: 0,
    byType: {},
    byDifficulty: {},
    timing: {
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
    },
    startedAt: null,
    lastScrapeAt: null,
    recentScrapes: [],
  }
}

/**
 * Get current statistics
 */
export function getStats(): Readonly<ScrapingStats> {
  return { ...stats }
}

/**
 * Reset all statistics
 */
export function resetStats(): void {
  stats = createEmptyStats()
}

/**
 * Generate a formatted report
 */
export function generateReport(): string {
  const s = stats

  if (s.total === 0) {
    return 'No scraping statistics available.'
  }

  const successRate = s.total > 0 ? ((s.successful / s.total) * 100).toFixed(1) : '0'
  const avgTime = s.timing.averageTime.toFixed(0)
  const minTime = s.timing.minTime === Infinity ? 'N/A' : `${s.timing.minTime.toFixed(0)}ms`
  const maxTime = s.timing.maxTime === 0 ? 'N/A' : `${s.timing.maxTime.toFixed(0)}ms`

  let report = `
# Scraping Statistics Report

Generated: ${new Date().toISOString()}
Session Started: ${s.startedAt?.toISOString() ?? 'N/A'}

## Summary

| Metric | Value |
|--------|-------|
| Total Scrapes | ${s.total} |
| Successful | ${s.successful} |
| Failed | ${s.failed} |
| Success Rate | ${successRate}% |

## Timing

| Metric | Value |
|--------|-------|
| Total Time | ${(s.timing.totalTime / 1000).toFixed(1)}s |
| Average Time | ${avgTime}ms |
| Fastest | ${minTime} |
| Slowest | ${maxTime} |

## By Type

| Type | Count |
|------|-------|
`

  for (const [type, count] of Object.entries(s.byType)) {
    report += `| ${type} | ${count} |\n`
  }

  if (Object.keys(s.byDifficulty).length > 0) {
    report += `
## By Difficulty

| Difficulty | Count |
|------------|-------|
`
    for (const [difficulty, count] of Object.entries(s.byDifficulty)) {
      report += `| ${difficulty} | ${count} |\n`
    }
  }

  if (s.recentScrapes.length > 0) {
    report += `
## Recent Scrapes (Last 10)

| Slug | Type | Status | Duration |
|------|------|--------|----------|
`
    for (const scrape of s.recentScrapes) {
      const status = scrape.success ? 'Success' : 'Failed'
      report += `| ${scrape.slug} | ${scrape.type} | ${status} | ${scrape.duration}ms |\n`
    }
  }

  return report
}

/**
 * Extract slug from request
 */
function getSlugFromRequest(request: ScrapeRequest): string {
  switch (request.type) {
    case 'problem':
    case 'editorial':
    case 'discussion':
      return request.titleSlug
    case 'user':
      return request.username
    case 'list':
      return 'problem-list'
    default:
      return 'unknown'
  }
}

/**
 * Stats Tracker Plugin
 */
export const statsTrackerPlugin: Plugin = {
  name: 'stats-tracker',
  version: '1.0.0',
  description: 'Tracks scraping statistics and generates reports',

  onInit(context: PluginContext): void {
    logger = context.logger
    stats.startedAt = new Date()
    logger.info('Stats Tracker plugin initialized')
  },

  onScrape(request: ScrapeRequest): ScrapeRequest {
    // Record start time for this scrape
    currentScrapeStart = Date.now()

    // Increment counters
    stats.total++
    stats.byType[request.type] = (stats.byType[request.type] ?? 0) + 1

    logger.debug(`Starting scrape #${stats.total}`, { type: request.type })

    return request
  },

  onScrapeResult(result: ScrapeResult): ScrapeResult {
    const duration = currentScrapeStart ? Date.now() - currentScrapeStart : 0
    currentScrapeStart = null

    // Update timing stats
    stats.timing.totalTime += duration
    stats.timing.averageTime = stats.timing.totalTime / stats.total
    if (duration < stats.timing.minTime) stats.timing.minTime = duration
    if (duration > stats.timing.maxTime) stats.timing.maxTime = duration

    // Track success/failure
    if (result.success) {
      stats.successful++

      // Track difficulty for problems
      if (result.data?.type === 'problem') {
        const originalData = result.data.metadata.originalData
        if (originalData.type === 'problem') {
          // Type assertion after type guard
          const problem = originalData.data as Problem
          const difficulty = problem.difficulty
          stats.byDifficulty[difficulty] = (stats.byDifficulty[difficulty] ?? 0) + 1
        }
      }
    } else {
      stats.failed++
    }

    stats.lastScrapeAt = new Date()

    // Add to recent scrapes (keep last 10)
    const recentEntry = {
      slug: getSlugFromRequest(result.request),
      type: result.request.type,
      success: result.success,
      duration,
      timestamp: new Date(),
    }
    stats.recentScrapes.unshift(recentEntry)
    if (stats.recentScrapes.length > 10) {
      stats.recentScrapes.pop()
    }

    logger.debug(`Completed scrape`, {
      success: result.success,
      duration: `${duration}ms`,
      total: stats.total,
    })

    return result
  },

  onCleanup(): void {
    const report = generateReport()
    logger.info('Stats Tracker final report:')
    logger.info(report)
  },
}

// Default export for dynamic loading
export default statsTrackerPlugin
