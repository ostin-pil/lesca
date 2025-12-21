/**
 * Quality Enhancer Plugin
 *
 * This plugin enhances scraped problem data with additional quality metrics:
 * - Calculates a quality score based on likes/dislikes ratio
 * - Adds difficulty rating (1-10 scale)
 * - Estimates time to solve based on difficulty
 * - Adds category tags based on topic analysis
 *
 * @example
 * ```typescript
 * import { qualityEnhancerPlugin } from './quality-enhancer'
 *
 * const pluginManager = new PluginManager()
 * pluginManager.register(qualityEnhancerPlugin)
 * ```
 */

import type { Plugin, PluginContext, ScrapeResult, Problem, Difficulty } from '@lesca/shared/types'

/**
 * Quality metrics added to problem data
 */
interface QualityMetrics {
  /** Quality score from 0-100 based on community feedback */
  qualityScore: number
  /** Difficulty rating from 1-10 */
  difficultyRating: number
  /** Estimated time to solve in minutes */
  estimatedTime: number
  /** Problem categories based on topic analysis */
  categories: string[]
  /** Whether this is a good practice problem */
  recommended: boolean
}

/**
 * Map of topic tags to categories
 */
const TOPIC_CATEGORIES: Record<string, string> = {
  array: 'Arrays & Strings',
  string: 'Arrays & Strings',
  'hash-table': 'Hash Tables',
  'linked-list': 'Linked Lists',
  tree: 'Trees',
  'binary-tree': 'Trees',
  'binary-search-tree': 'Trees',
  graph: 'Graphs',
  'depth-first-search': 'Graphs',
  'breadth-first-search': 'Graphs',
  'dynamic-programming': 'Dynamic Programming',
  greedy: 'Greedy',
  'two-pointers': 'Two Pointers',
  'sliding-window': 'Sliding Window',
  backtracking: 'Backtracking',
  recursion: 'Recursion',
  'binary-search': 'Binary Search',
  sorting: 'Sorting',
  heap: 'Heaps',
  'priority-queue': 'Heaps',
  stack: 'Stacks & Queues',
  queue: 'Stacks & Queues',
  'bit-manipulation': 'Bit Manipulation',
  math: 'Math',
  geometry: 'Math',
}

/**
 * Difficulty to time mapping (in minutes)
 */
const DIFFICULTY_TIME: Record<string, number> = {
  Easy: 15,
  Medium: 30,
  Hard: 60,
}

/**
 * Difficulty to rating mapping (base values)
 */
const DIFFICULTY_RATING: Record<string, number> = {
  Easy: 3,
  Medium: 5,
  Hard: 8,
}

let logger: PluginContext['logger']

/**
 * Calculate quality score from likes and dislikes
 */
function calculateQualityScore(likes: number, dislikes: number): number {
  const total = likes + dislikes
  if (total === 0) return 50 // Neutral if no votes

  const ratio = likes / total
  // Scale to 0-100, with bonus for high engagement
  const engagementBonus = Math.min(Math.log10(total + 1) * 5, 15)
  return Math.round(ratio * 85 + engagementBonus)
}

/**
 * Calculate difficulty rating (1-10) based on acceptance rate and difficulty
 */
function calculateDifficultyRating(difficulty: string, stats: string): number {
  const baseRating = DIFFICULTY_RATING[difficulty] ?? 5

  try {
    const parsedStats = JSON.parse(stats) as { acRate?: string }
    const acRate = parseFloat(parsedStats.acRate ?? '50')

    // Lower acceptance rate = harder problem
    // Adjust base rating by up to ±2 based on acceptance rate
    const acAdjustment = ((50 - acRate) / 50) * 2
    return Math.max(1, Math.min(10, Math.round(baseRating + acAdjustment)))
  } catch {
    return baseRating
  }
}

/**
 * Extract categories from topic tags
 */
function extractCategories(topicTags: Array<{ slug: string }>): string[] {
  const categories = new Set<string>()

  for (const tag of topicTags) {
    const category = TOPIC_CATEGORIES[tag.slug]
    if (category) {
      categories.add(category)
    }
  }

  return Array.from(categories)
}

/**
 * Quality Enhancer Plugin
 */
export const qualityEnhancerPlugin: Plugin = {
  name: 'quality-enhancer',
  version: '1.0.0',
  description: 'Enhances problem data with quality metrics and recommendations',

  onInit(context: PluginContext): void {
    logger = context.logger
    logger.info('Quality Enhancer plugin initialized')
  },

  onScrapeResult(result: ScrapeResult): ScrapeResult {
    if (!result.success || !result.data) {
      return result
    }

    // Only process problem type results
    if (result.data.type !== 'problem') {
      return result
    }

    const originalData = result.data.metadata.originalData
    if (originalData.type !== 'problem') {
      return result
    }

    // Type assertion after type guard - we've verified type is 'problem'
    const problem = originalData.data as Problem

    // Calculate quality metrics
    const difficulty = problem.difficulty as Difficulty
    const metrics: QualityMetrics = {
      qualityScore: calculateQualityScore(problem.likes, problem.dislikes),
      difficultyRating: calculateDifficultyRating(difficulty, problem.stats),
      estimatedTime: DIFFICULTY_TIME[difficulty] ?? 30,
      categories: extractCategories(problem.topicTags),
      recommended: false,
    }

    // Mark as recommended if high quality and reasonable difficulty
    metrics.recommended = metrics.qualityScore >= 70 && metrics.difficultyRating <= 7

    logger.debug(`Enhanced problem "${problem.titleSlug}" with quality metrics`, {
      qualityScore: metrics.qualityScore,
      difficultyRating: metrics.difficultyRating,
    })

    // Add metrics to frontmatter
    const enhancedFrontmatter = {
      ...result.data.frontmatter,
      quality_metrics: metrics,
    }

    // Add quality summary to content
    const qualitySummary = `
## Quality Metrics

| Metric | Value |
|--------|-------|
| Quality Score | ${metrics.qualityScore}/100 |
| Difficulty Rating | ${metrics.difficultyRating}/10 |
| Estimated Time | ${metrics.estimatedTime} min |
| Categories | ${metrics.categories.join(', ') || 'General'} |
| Recommended | ${metrics.recommended ? 'Yes' : 'No'} |

`

    return {
      ...result,
      data: {
        ...result.data,
        frontmatter: enhancedFrontmatter,
        content: result.data.content + qualitySummary,
        metadata: {
          ...result.data.metadata,
          processors: [...result.data.metadata.processors, 'quality-enhancer'],
        },
      },
    }
  },

  onCleanup(): void {
    logger.info('Quality Enhancer plugin cleaned up')
  },
}

// Default export for dynamic loading
export default qualityEnhancerPlugin
