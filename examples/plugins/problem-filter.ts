/**
 * Problem Filter Plugin
 *
 * This plugin filters scrape requests based on configurable criteria:
 * - Skip premium-only problems
 * - Filter by minimum quality score
 * - Filter by difficulty
 * - Filter by topic tags
 * - Skip already-scraped problems
 *
 * @example
 * ```typescript
 * import { createProblemFilterPlugin } from './problem-filter'
 *
 * const filterPlugin = createProblemFilterPlugin({
 *   skipPremium: true,
 *   minQuality: 60,
 *   difficulties: ['Easy', 'Medium'],
 *   requiredTags: ['array', 'dynamic-programming'],
 * })
 *
 * pluginManager.register(filterPlugin)
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
 * Filter configuration options
 */
export interface FilterOptions {
  /** Skip premium-only problems (default: false) */
  skipPremium?: boolean
  /** Minimum quality score (0-100, based on likes/dislikes ratio) */
  minQuality?: number
  /** Maximum quality score (0-100) */
  maxQuality?: number
  /** Allowed difficulties (if set, only these are processed) */
  difficulties?: Array<'Easy' | 'Medium' | 'Hard'>
  /** Required topic tags (problem must have at least one) */
  requiredTags?: string[]
  /** Excluded topic tags (problem must not have any) */
  excludedTags?: string[]
  /** Skip problems that have already been scraped */
  skipScraped?: boolean
  /** Custom filter function for advanced filtering */
  customFilter?: (request: ScrapeRequest) => boolean
}

/**
 * Internal state for tracking scraped problems
 */
const scrapedProblems = new Set<string>()

let logger: PluginContext['logger']
let filterOptions: FilterOptions = {}

/**
 * Check if a problem should be skipped based on filter options
 */
function shouldSkipRequest(request: ScrapeRequest): { skip: boolean; reason?: string } {
  // Only filter problem-type requests
  if (request.type !== 'problem') {
    return { skip: false }
  }

  const slug = request.titleSlug

  // Check if already scraped
  if (filterOptions.skipScraped && scrapedProblems.has(slug)) {
    return { skip: true, reason: `Already scraped: ${slug}` }
  }

  // Check premium filter
  if (filterOptions.skipPremium && request.includePremium === true) {
    return { skip: true, reason: `Skipping premium request: ${slug}` }
  }

  // Check custom filter
  if (filterOptions.customFilter && !filterOptions.customFilter(request)) {
    return { skip: true, reason: `Custom filter rejected: ${slug}` }
  }

  return { skip: false }
}

/**
 * Check if a scrape result should be filtered out
 */
function shouldFilterResult(result: ScrapeResult): { filter: boolean; reason?: string } {
  if (!result.success || !result.data) {
    return { filter: false }
  }

  if (result.data.type !== 'problem') {
    return { filter: false }
  }

  const originalData = result.data.metadata.originalData
  if (originalData.type !== 'problem') {
    return { filter: false }
  }

  // Type assertion after type guard
  const problem = originalData.data as Problem

  // Check premium filter
  if (filterOptions.skipPremium && problem.isPaidOnly) {
    return { filter: true, reason: `Premium problem: ${problem.titleSlug}` }
  }

  // Check quality filter
  const quality = problem.quality ?? calculateQuality(problem.likes, problem.dislikes)
  if (filterOptions.minQuality !== undefined && quality < filterOptions.minQuality) {
    return { filter: true, reason: `Quality too low (${quality}): ${problem.titleSlug}` }
  }
  if (filterOptions.maxQuality !== undefined && quality > filterOptions.maxQuality) {
    return { filter: true, reason: `Quality too high (${quality}): ${problem.titleSlug}` }
  }

  // Check difficulty filter
  if (filterOptions.difficulties && filterOptions.difficulties.length > 0) {
    if (!filterOptions.difficulties.includes(problem.difficulty as 'Easy' | 'Medium' | 'Hard')) {
      return {
        filter: true,
        reason: `Difficulty mismatch (${problem.difficulty}): ${problem.titleSlug}`,
      }
    }
  }

  // Check required tags
  if (filterOptions.requiredTags && filterOptions.requiredTags.length > 0) {
    const problemTags = new Set(problem.topicTags.map((t) => t.slug))
    const hasRequiredTag = filterOptions.requiredTags.some((tag) => problemTags.has(tag))
    if (!hasRequiredTag) {
      return { filter: true, reason: `Missing required tags: ${problem.titleSlug}` }
    }
  }

  // Check excluded tags
  if (filterOptions.excludedTags && filterOptions.excludedTags.length > 0) {
    const problemTags = new Set(problem.topicTags.map((t) => t.slug))
    const hasExcludedTag = filterOptions.excludedTags.some((tag) => problemTags.has(tag))
    if (hasExcludedTag) {
      return { filter: true, reason: `Has excluded tag: ${problem.titleSlug}` }
    }
  }

  return { filter: false }
}

/**
 * Calculate quality score from likes/dislikes
 */
function calculateQuality(likes: number, dislikes: number): number {
  const total = likes + dislikes
  if (total === 0) return 50
  return Math.round((likes / total) * 100)
}

/**
 * Get list of scraped problems
 */
export function getScrapedProblems(): string[] {
  return Array.from(scrapedProblems)
}

/**
 * Clear the scraped problems cache
 */
export function clearScrapedCache(): void {
  scrapedProblems.clear()
}

/**
 * Mark a problem as scraped
 */
export function markAsScraped(slug: string): void {
  scrapedProblems.add(slug)
}

/**
 * Create a configured Problem Filter Plugin
 */
export function createProblemFilterPlugin(options: FilterOptions = {}): Plugin {
  filterOptions = { ...options }

  return {
    name: 'problem-filter',
    version: '1.0.0',
    description: 'Filters problems based on configurable criteria',

    onInit(context: PluginContext): void {
      logger = context.logger
      logger.info('Problem Filter plugin initialized', {
        skipPremium: filterOptions.skipPremium,
        minQuality: filterOptions.minQuality,
        difficulties: filterOptions.difficulties,
        requiredTags: filterOptions.requiredTags,
      })
    },

    onScrape(request: ScrapeRequest): ScrapeRequest | undefined {
      const { skip, reason } = shouldSkipRequest(request)

      if (skip) {
        logger.info(`Skipping request: ${reason}`)
        // Returning undefined doesn't cancel the request in current implementation
        // This is informational - actual filtering happens in onScrapeResult
      }

      return request
    },

    onScrapeResult(result: ScrapeResult): ScrapeResult {
      // Track successful scrapes
      if (result.success && result.request.type === 'problem') {
        scrapedProblems.add(result.request.titleSlug)
      }

      const { filter, reason } = shouldFilterResult(result)

      if (filter) {
        logger.info(`Filtered out: ${reason}`)
        // Mark as unsuccessful so it won't be saved
        return {
          ...result,
          success: false,
          error: new Error(`Filtered: ${reason}`),
        }
      }

      return result
    },

    onCleanup(): void {
      logger.info(`Problem Filter cleaned up. Tracked ${scrapedProblems.size} problems.`)
    },
  }
}

/**
 * Default plugin instance with common settings
 */
export const problemFilterPlugin = createProblemFilterPlugin({
  skipPremium: true,
  skipScraped: true,
})

// Default export for dynamic loading
export default problemFilterPlugin
