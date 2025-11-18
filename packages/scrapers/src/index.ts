/**
 * Scrapers Package
 * Scraping strategies for different content types
 */

export { ProblemScraperStrategy } from './problem-strategy.js'
export { ListScraperStrategy } from './list-strategy.js'
export { EditorialScraperStrategy } from './editorial-strategy.js'
export { DiscussionScraperStrategy } from './discussion-strategy.js'

// Re-export types from shared/types
export type {
  EditorialScrapeRequest,
  EditorialContent,
  DiscussionScrapeRequest,
  Discussion,
  DiscussionList,
  CodeSnippet,
} from '@/shared/types/src/index.js'
