/**
 * Scrapers Package
 * Scraping strategies for different content types
 */

export { ProblemScraperStrategy } from './problem-strategy'
export { ListScraperStrategy } from './list-strategy'
export { EditorialScraperStrategy } from './editorial-strategy'
export { DiscussionScraperStrategy } from './discussion-strategy'

// Re-export types from shared/types
export type {
  EditorialScrapeRequest,
  EditorialContent,
  DiscussionScrapeRequest,
  Discussion,
  DiscussionList,
  CodeSnippet,
} from '@lesca/shared/types'
