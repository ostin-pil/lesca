/**
 * Lesca Example Plugins
 *
 * This module exports all example plugins for easy importing.
 *
 * @example
 * ```typescript
 * import {
 *   qualityEnhancerPlugin,
 *   statsTrackerPlugin,
 *   createProblemFilterPlugin,
 * } from '@lesca/examples/plugins'
 *
 * const pluginManager = new PluginManager()
 * pluginManager.register(qualityEnhancerPlugin)
 * pluginManager.register(statsTrackerPlugin)
 * pluginManager.register(createProblemFilterPlugin({ skipPremium: true }))
 * ```
 */

// Quality Enhancer Plugin
export { qualityEnhancerPlugin, default as qualityEnhancer } from './quality-enhancer'

// Stats Tracker Plugin
export {
  statsTrackerPlugin,
  getStats,
  resetStats,
  generateReport,
  default as statsTracker,
  type ScrapingStats,
} from './stats-tracker'

// Problem Filter Plugin
export {
  problemFilterPlugin,
  createProblemFilterPlugin,
  getScrapedProblems,
  clearScrapedCache,
  markAsScraped,
  default as problemFilter,
  type FilterOptions,
} from './problem-filter'
