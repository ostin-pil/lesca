/**
 * Shared TypeScript types for Lesca
 * These types are used across all packages
 */

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * Problem difficulty levels
 */
export type Difficulty = 'Easy' | 'Medium' | 'Hard'

/**
 * Programming language for code snippets
 */
export interface CodeSnippet {
  lang: string
  langSlug: string
  code: string
}

/**
 * Topic tag (e.g., "array", "hash-table")
 */
export interface TopicTag {
  name: string
  slug: string
}

/**
 * Company tag statistics
 */
export interface CompanyTag {
  name: string
  slug: string
  timesEncountered: number
}

/**
 * Problem statistics
 */
export interface ProblemStats {
  totalAccepted: string
  totalSubmission: string
  totalAcceptedRaw: number
  totalSubmissionRaw: number
  acRate: string
}

/**
 * Solution/Editorial content
 */
export interface Solution {
  id: string
  content: string | null
  contentTypeId: string
  canSeeDetail: boolean
}

/**
 * Similar problem reference
 */
export interface SimilarProblem {
  questionId: string
  titleSlug: string
  title: string
  difficulty: Difficulty
}

/**
 * Complete Problem representation
 * Based on GraphQL response structure
 */
export interface Problem {
  // Identifiers
  questionId: string
  questionFrontendId: string
  title: string
  titleSlug: string

  // Quality metrics
  likes: number
  dislikes: number
  quality: number

  // Content
  content: string // HTML formatted
  difficulty: Difficulty
  exampleTestcases: string | null
  hints: string[]

  // Metadata
  topicTags: TopicTag[]
  companyTagStats: string | null // JSON string of company data
  stats: string // JSON string of statistics

  // Code
  codeSnippets: CodeSnippet[]

  // Related
  similarQuestions: string | null // JSON string of similar problems
  solution: Solution | null

  // Database problems only
  mysqlSchemas: string[]
  dataSchemas: string[]

  isPaidOnly: boolean
}

/**
 * Parsed problem with computed fields
 */
export interface ParsedProblem extends Problem {
  // Parsed JSON fields for easier access
  parsedStats: ProblemStats
  parsedCompanyTags: CompanyTag[]
  parsedSimilarQuestions: SimilarProblem[]
}

// ============================================================================
// Problem List Types
// ============================================================================

/**
 * Problem list item (lighter weight than full Problem)
 */
export interface ProblemListItem {
  questionId: string
  questionFrontendId: string
  title: string
  titleSlug: string
  difficulty: Difficulty
  acRate: number
  paidOnly: boolean
  likes: number
  dislikes: number
  quality: number
  topicTags: TopicTag[]
}

/**
 * Problem list response
 */
export interface ProblemList {
  total: number
  questions: ProblemListItem[]
}

/**
 * Problem list filter options
 */
export interface ProblemListFilters {
  difficulty?: Difficulty
  tags?: string[]
  status?: 'todo' | 'solved' | 'attempted'
  listId?: string
  companySlug?: string
  searchKeywords?: string
}

// ============================================================================
// Discussion Types
// ============================================================================

/**
 * Discussion post author
 */
export interface DiscussionAuthor {
  username: string
  isActive: boolean
  profile?: {
    reputation: number
    ranking: number
  }
}

/**
 * Discussion post
 */
export interface DiscussionPost {
  id: string
  content: string
  voteCount: number
  creationDate: number
  author: DiscussionAuthor
}

/**
 * Discussion topic/thread
 */
export interface DiscussionTopic {
  id: string
  title: string
  commentCount: number
  viewCount: number
  post: DiscussionPost
}

// ============================================================================
// User Types
// ============================================================================

/**
 * User profile
 */
export interface UserProfile {
  username: string
  realName?: string
  aboutMe?: string
  reputation: number
  ranking: number
}

/**
 * User submission statistics
 */
export interface SubmissionStats {
  acSubmissionNum: Array<{
    difficulty: Difficulty
    count: number
  }>
}

/**
 * User data
 */
export interface User {
  username: string
  profile: UserProfile
  submitStats: SubmissionStats
  badges: Array<{
    id: string
    name: string
    displayName: string
    icon: string
  }>
}

// ============================================================================
// Scraping Request/Response Types
// ============================================================================

/**
 * Base scrape request
 */
export interface BaseScrapeRequest {
  type: 'problem' | 'list' | 'discussion' | 'user' | 'editorial'
  /** Optional timeout in milliseconds (overrides config/env defaults) */
  timeout?: number
}

/**
 * Request to scrape a single problem
 */
export interface ProblemScrapeRequest extends BaseScrapeRequest {
  type: 'problem'
  titleSlug: string
  includeDiscussions?: boolean
  includeSolution?: boolean
  includePremium?: boolean
}

/**
 * Request to scrape a list of problems
 */
export interface ListScrapeRequest extends BaseScrapeRequest {
  type: 'list'
  filters?: ProblemListFilters
  limit?: number
  offset?: number
  sort?: {
    field: 'quality' | 'acRate' | 'difficulty'
    order: 'asc' | 'desc'
  }
}

/**
 * Request to scrape discussions
 */
export interface DiscussionScrapeRequest extends BaseScrapeRequest {
  type: 'discussion'
  titleSlug: string
  category?: 'solution' | 'general' | 'interview-question'
  sortBy?: 'hot' | 'most-votes' | 'recent'
  limit?: number
  includeComments?: boolean
}

/**
 * Request to scrape user data
 */
export interface UserScrapeRequest extends BaseScrapeRequest {
  type: 'user'
  username: string
}

/**
 * Request to scrape editorial/solution content
 */
export interface EditorialScrapeRequest extends BaseScrapeRequest {
  type: 'editorial'
  titleSlug: string
  includePremium?: boolean
}

/**
 * Union type for all scrape requests
 */
export type ScrapeRequest =
  | ProblemScrapeRequest
  | ListScrapeRequest
  | DiscussionScrapeRequest
  | UserScrapeRequest
  | EditorialScrapeRequest

/**
 * Editorial content structure
 */
export interface EditorialContent {
  titleSlug: string
  content: string
  approaches: string[]
  complexity: string | null
  codeSnippets: CodeSnippet[]
}

/**
 * Discussion item
 */
export interface Discussion {
  title: string
  author: string
  votes: number
  timestamp: string | null
  content: string
  comments: Array<{
    author: string
    content: string
    timestamp: string | null
  }>
  commentCount: number
}

/**
 * Discussion list response
 */
export interface DiscussionList {
  titleSlug: string
  category: string
  sortBy: string
  discussions: Discussion[]
  total: number
}

/**
 * Raw data from scraping (before processing)
 */
export interface RawData {
  type: 'problem' | 'list' | 'discussion' | 'user' | 'editorial'
  data: Problem | ProblemList | DiscussionTopic[] | User | EditorialContent | DiscussionList
  metadata: {
    scrapedAt: Date
    source?: 'graphql' | 'browser'
    url?: string
    strategy?: string
    isPremium?: boolean
  }
}

/**
 * Processed data (after conversion and enhancement)
 */
export interface ProcessedData {
  type: 'problem' | 'list' | 'discussion' | 'user' | 'editorial'
  content: string // Converted markdown
  frontmatter: Record<string, unknown> // YAML frontmatter
  metadata: {
    originalData: RawData
    processors: string[] // Names of processors applied
    processedAt: Date
  }
}

/**
 * Final scrape result
 */
export interface ScrapeResult {
  success: boolean
  request: ScrapeRequest
  data?: ProcessedData
  error?: Error
  filePath?: string
}

// ============================================================================
// Strategy Pattern Interfaces
// ============================================================================

/**
 * Scraper strategy interface
 * Each strategy handles a specific type of scraping
 */
export interface ScraperStrategy {
  name: string
  priority: number

  /**
   * Check if this strategy can handle the request
   */
  canHandle(request: ScrapeRequest): boolean

  /**
   * Execute the scraping strategy
   */
  execute(request: ScrapeRequest): Promise<RawData>
}

/**
 * Processor interface
 * Processors transform data through the pipeline
 */
export interface Processor {
  name: string

  /**
   * Check if this processor should run on the data
   */
  shouldProcess(data: RawData | ProcessedData): boolean

  /**
   * Process the data
   */
  process(data: RawData | ProcessedData): Promise<RawData | ProcessedData>
}

/**
 * Converter interface
 * Converters transform content between formats
 */
export interface Converter {
  from: ContentFormat
  to: ContentFormat

  /**
   * Check if this converter can handle the data
   */
  canConvert(data: unknown): boolean

  /**
   * Convert the content
   */
  convert(input: unknown, options?: ConverterOptions): Promise<unknown>
}

/**
 * Content formats
 */
export type ContentFormat =
  | 'html'
  | 'markdown'
  | 'obsidian'
  | 'json'
  | 'csv'
  | 'editorial'
  | 'discussion'

/**
 * Converter options
 */
export interface ConverterOptions {
  includeMetadata?: boolean
  downloadImages?: boolean
  imageDirectory?: string
  [key: string]: unknown
}

// ============================================================================
// Storage Interfaces
// ============================================================================

/**
 * Storage adapter interface
 */
export interface StorageAdapter {
  /**
   * Save content with a key
   */
  save(key: string, content: string, metadata?: Record<string, unknown>): Promise<void>

  /**
   * Load content by key
   */
  load(key: string): Promise<string | null>

  /**
   * Check if key exists
   */
  exists(key: string): Promise<boolean>

  /**
   * Delete content by key
   */
  delete(key: string): Promise<void>

  /**
   * List all keys matching a pattern
   */
  list(pattern?: string): Promise<string[]>
}

// ============================================================================
// Authentication Interfaces
// ============================================================================

/**
 * Authentication credentials
 */
export interface AuthCredentials {
  cookies: Cookie[]
  csrfToken: string
  sessionToken?: string
}

/**
 * Cookie format
 */
export interface Cookie {
  name: string
  value: string
  domain: string
  path?: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
}

/**
 * Authentication strategy interface
 */
export interface AuthStrategy {
  name: string

  /**
   * Authenticate and get credentials
   */
  authenticate(): Promise<AuthCredentials>

  /**
   * Refresh credentials if needed
   */
  refresh(): Promise<void>

  /**
   * Check if credentials are valid
   */
  isValid(): Promise<boolean>

  /**
   * Save credentials to storage
   */
  save(path: string): Promise<void>

  /**
   * Load credentials from storage
   */
  load(path: string): Promise<void>
}

// ============================================================================
// Browser Automation Interfaces
// ============================================================================

/**
 * Browser driver interface
 */
export interface BrowserDriver {
  /**
   * Launch the browser
   */
  launch(options?: BrowserLaunchOptions): Promise<void>

  /**
   * Navigate to a URL
   */
  navigate(url: string): Promise<void>

  /**
   * Wait for a selector to appear
   */
  waitForSelector(selector: string, timeout?: number): Promise<void>

  /**
   * Extract content using a selector
   */
  extractContent(selector: string): Promise<string>

  /**
   * Extract all matching elements
   */
  extractAll(selector: string): Promise<string[]>

  /**
   * Extract content with fallback selectors
   */
  extractWithFallback(selectors: string[]): Promise<string>

  /**
   * Get HTML content of an element
   */
  getHtml(selector: string): Promise<string>

  /**
   * Get full page HTML
   */
  getPageHtml(): Promise<string>

  /**
   * Check if an element exists
   */
  elementExists(selector: string): Promise<boolean>

  /**
   * Get the browser instance
   */
  getBrowser(): unknown

  /**
   * Take a screenshot
   */
  screenshot(path: string): Promise<void>

  /**
   * Execute JavaScript in the browser
   */
  evaluate<T>(script: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>

  /**
   * Close the browser
   */
  close(): Promise<void>
}

/**
 * Browser launch options
 */
export interface BrowserLaunchOptions {
  headless?: boolean
  timeout?: number
  viewport?: {
    width: number
    height: number
  }
  userAgent?: string
  blockResources?: string[] // e.g., ['image', 'font', 'media']
  interception?: {
    enabled?: boolean
    blockResources?: string[]
    captureResponses?: boolean
    capturePattern?: string
  }
  monitoring?: {
    enabled?: boolean
    logMetrics?: boolean
  }
}

/**
 * Browser driver options (constructor params)
 */
export interface BrowserDriverOptions {
  browser?: unknown // Pre-initialized browser from pool
  auth?: AuthCredentials
  sessionName?: string
}

/**
 * Session pool configuration
 */
export interface SessionPoolConfig {
  strategy: 'per-session' // Phase 2: add 'global' | 'hybrid'
  perSessionMaxSize: number
  perSessionIdleTime: number
  acquireTimeout: number
  retryOnFailure: boolean
  maxRetries: number
}

/**
 * Pool statistics for monitoring
 */
export interface PoolStatistics {
  sessionName: string
  totalBrowsers: number
  activeBrowsers: number
  idleBrowsers: number
  acquisitionCount: number
  releaseCount: number
  failureCount: number
  lastAcquireTime?: number
  lastReleaseTime?: number
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  enabled: boolean
  delay: {
    min: number
    max: number
    jitter: boolean
  }
  backoff: {
    enabled: boolean
    multiplier: number
    maxDelay: number
  }
}

/**
 * API client configuration
 */
export interface ApiClientConfig {
  endpoint: string
  timeout: number
  retries: number
  rateLimiter: RateLimiterConfig
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  type: 'filesystem' | 'sqlite'
  basePath: string
  structure: {
    problems: string
    discussions: string
    images: string
  }
}

/**
 * Output format configuration
 */
export interface OutputConfig {
  default: ContentFormat
  formats: {
    markdown?: {
      style: 'obsidian' | 'github' | 'generic'
      frontmatter: boolean
      wikiLinks: boolean
      downloadImages: boolean
    }
    json?: {
      pretty: boolean
      includeMetadata: boolean
    }
  }
}

/**
 * Main application configuration
 */
export interface Config {
  auth: {
    method: 'cookie-file' | 'browser' | 'session'
    cookiePath?: string
    autoRefresh: boolean
    sessionTimeout: number
  }
  api: ApiClientConfig
  storage: StorageConfig
  output: OutputConfig
  scraping: {
    strategies: string[]
    resumeOnError: boolean
    checkpointPath?: string
  }
  processing: {
    processors: string[]
  }
  browser?: {
    enabled: boolean
    driver: 'playwright' | 'puppeteer' | 'selenium'
    headless: boolean
    timeout: number
    resourceBlocking: string[]
  }
  cache?: {
    enabled: boolean
    directory: string
    ttl: {
      problems: number
      discussions: number
      metadata: number
    }
    maxSize: string
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    file?: string
    console: boolean
  }
}

// ============================================================================
// Error Types
// ============================================================================

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Make all properties required recursively
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P]
}

/**
 * Extract promise type
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T

/**
 * Function that returns a promise
 */
export type AsyncFunction<T = void> = (...args: unknown[]) => Promise<T>
