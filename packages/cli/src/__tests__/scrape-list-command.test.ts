import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock dependencies
const mockConfigManagerInstance = {
  getConfig: vi.fn().mockReturnValue({
    storage: { path: './output' },
    output: { format: 'markdown' },
    auth: { method: 'cookie', cookiePath: 'cookies.json' },
    cache: { enabled: true },
    api: { rateLimit: { minDelay: 100, maxDelay: 200, jitter: 0.1 } },
    browser: {
      headless: true,
      timeout: 30000,
      blockedResources: [],
    },
    scraping: {
      concurrency: 2,
      batchSize: 10,
      delay: 100,
    },
  }),
}

vi.mock('@lesca/shared/config', () => ({
  ConfigManager: {
    getInstance: vi.fn(() => mockConfigManagerInstance),
  },
}))

vi.mock('@lesca/shared/utils', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    box: vi.fn(),
  },
  createCache: vi.fn().mockReturnValue({}),
}))

vi.mock('@/api-client/src/index', () => ({
  GraphQLClient: vi.fn(),
  RateLimiter: vi.fn(),
}))

const mockAuthInstance = {
  authenticate: vi.fn().mockResolvedValue(undefined),
  getCredentials: vi.fn().mockReturnValue({ cookie: 'test-cookie' }),
}

vi.mock('@lesca/auth', () => ({
  CookieFileAuth: vi.fn(() => mockAuthInstance),
}))

const mockDriverInstance = {
  launch: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@lesca/browser-automation', () => ({
  PlaywrightDriver: vi.fn(() => mockDriverInstance),
}))

const mockListStrategy = {
  execute: vi.fn().mockResolvedValue({
    type: 'list',
    data: {
      questions: [
        { titleSlug: 'two-sum', title: 'Two Sum' },
        { titleSlug: 'add-two-numbers', title: 'Add Two Numbers' },
      ],
    },
    metadata: {},
  }),
}

vi.mock('@lesca/scrapers', () => ({
  ProblemScraperStrategy: vi.fn(),
  ListScraperStrategy: vi.fn(() => mockListStrategy),
}))

vi.mock('@lesca/storage', () => ({
  FileSystemStorage: vi.fn(),
}))

const mockBatchScraperInstance = {
  scrapeAll: vi.fn().mockResolvedValue({
    results: [
      { success: true, filePath: '/path/to/two-sum.md' },
      { success: true, filePath: '/path/to/add-two-numbers.md' },
    ],
    errors: [],
    completed: 2,
    total: 2,
  }),
}

vi.mock('@/core/src/index', () => ({
  LeetCodeScraper: vi.fn(),
  BatchScraper: vi.fn(() => mockBatchScraperInstance),
}))

const mockProgressManagerInstance = {
  start: vi.fn(),
  stop: vi.fn(),
  update: vi.fn(),
  incrementSuccess: vi.fn(),
  incrementFailure: vi.fn(),
  getSummary: vi.fn(),
}

vi.mock('../progress-manager', () => ({
  ProgressManager: vi.fn(() => mockProgressManagerInstance),
}))

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
  })),
}))

vi.mock('chalk', () => ({
  default: {
    white: (str: string) => str,
    gray: (str: string) => str,
    bold: (str: string) => str,
    cyan: (str: string) => str,
    green: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
  },
}))

const mockBrowserServiceInstance = {
  startup: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
  getDriver: vi.fn(() => mockDriverInstance),
  getSessionName: vi.fn(() => undefined),
  isPoolingEnabled: vi.fn(() => false),
}

vi.mock('../helpers', () => ({
  createBrowserService: vi.fn(() => mockBrowserServiceInstance),
}))

vi.mock('../utils', () => ({
  handleCliError: vi.fn(),
}))

describe('Scrape List Command', () => {
  let program: Command
  let mockExit: ReturnType<typeof vi.spyOn>
  let logger: typeof import('@lesca/shared/utils').logger
  let CookieFileAuth: typeof import('@lesca/auth').CookieFileAuth

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset mock instance methods
    mockConfigManagerInstance.getConfig.mockClear()
    mockAuthInstance.authenticate.mockClear()
    mockAuthInstance.getCredentials.mockClear()
    mockBatchScraperInstance.scrapeAll.mockClear()
    mockListStrategy.execute.mockClear()
    mockProgressManagerInstance.start.mockClear()
    mockProgressManagerInstance.stop.mockClear()
    mockProgressManagerInstance.update.mockClear()
    mockProgressManagerInstance.incrementSuccess.mockClear()
    mockProgressManagerInstance.incrementFailure.mockClear()

    // Create fresh program
    program = new Command()
    program.exitOverride()

    // Mock process.exit to throw (simulates termination)
    mockExit = vi.spyOn(process, 'exit').mockImplementation(((code) => {
      throw new Error(`Process.exit(${code})`)
    }) as never)

    // Get mocked modules
    const utils = await import('@lesca/shared/utils')
    logger = utils.logger

    const auth = await import('@lesca/auth')
    CookieFileAuth = auth.CookieFileAuth

    // Import and add scrape-list command
    const { scrapeListCommand } = await import('../commands/scrape-list')
    program.addCommand(scrapeListCommand)
  })

  afterEach(() => {
    mockExit.mockRestore()
  })

  it('should scrape problem list successfully with defaults', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-list'])

    expect(mockConfigManagerInstance.getConfig).toHaveBeenCalled()
    expect(CookieFileAuth).toHaveBeenCalled()
    expect(mockAuthInstance.authenticate).toHaveBeenCalled()
    expect(mockListStrategy.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'list',
        limit: 10, // default from config
      })
    )
    expect(mockBatchScraperInstance.scrapeAll).toHaveBeenCalled()
    expect(mockProgressManagerInstance.start).toHaveBeenCalled()
    expect(mockProgressManagerInstance.stop).toHaveBeenCalled()
  })

  it('should handle authentication failure but continue', async () => {
    mockAuthInstance.authenticate.mockRejectedValueOnce(new Error('Auth failed'))

    await program.parseAsync(['node', 'lesca', 'scrape-list'])

    expect(mockAuthInstance.authenticate).toHaveBeenCalled()
    expect(mockBatchScraperInstance.scrapeAll).toHaveBeenCalled()
  })

  it('should skip authentication with --no-auth', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-list', '--no-auth'])

    expect(CookieFileAuth).not.toHaveBeenCalled()
    expect(mockBatchScraperInstance.scrapeAll).toHaveBeenCalled()
  })

  it('should handle unexpected errors', async () => {
    mockListStrategy.execute.mockRejectedValueOnce(new Error('Network error'))
    const { handleCliError } = await import('../utils')

    await expect(program.parseAsync(['node', 'lesca', 'scrape-list'])).rejects.toThrow(
      'Process.exit(1)'
    )

    expect(handleCliError).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('should respect --difficulty option', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-list', '--difficulty', 'Easy'])

    expect(mockListStrategy.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          difficulty: 'Easy',
        }),
      })
    )
  })

  it('should respect --tags option', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-list', '--tags', 'array,string'])

    expect(mockListStrategy.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          tags: ['array', 'string'],
        }),
      })
    )
  })

  it('should respect --limit option', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-list', '--limit', '20'])

    expect(mockListStrategy.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
      })
    )
  })

  it('should respect --concurrency option', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-list', '--concurrency', '5'])

    const { BatchScraper } = await import('@/core/src/index')
    expect(BatchScraper).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        concurrency: 5,
      })
    )
  })

  it('should respect --resume option', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-list', '--resume'])

    const { BatchScraper } = await import('@/core/src/index')
    expect(BatchScraper).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        resume: true,
      })
    )
  })

  it('should respect custom output directory', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-list', '--output', './custom-problems'])

    const { FileSystemStorage } = await import('@lesca/storage')
    expect(FileSystemStorage).toHaveBeenCalledWith('./custom-problems')
  })

  it('should respect custom format', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-list', '--format', 'obsidian'])

    const { LeetCodeScraper } = await import('@/core/src/index')
    expect(LeetCodeScraper).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ format: 'obsidian' })
    )
  })

  it('should disable cache with --no-cache', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-list', '--no-cache'])

    const { createCache } = await import('@lesca/shared/utils')
    expect(createCache).not.toHaveBeenCalled()
  })

  it('should track progress for successful scrapes', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-list'])

    expect(mockProgressManagerInstance.incrementSuccess).toHaveBeenCalledTimes(2)
    expect(mockProgressManagerInstance.getSummary).toHaveBeenCalled()
  })

  it('should track progress for failed scrapes', async () => {
    mockBatchScraperInstance.scrapeAll.mockResolvedValueOnce({
      results: [
        { success: true, filePath: '/path/to/two-sum.md' },
        { success: false, error: 'Failed to scrape' },
      ],
      errors: [
        {
          request: { type: 'problem', titleSlug: 'add-two-numbers' },
          error: new Error('Network error'),
        },
      ],
      completed: 2,
      total: 2,
    })

    await program.parseAsync(['node', 'lesca', 'scrape-list'])

    expect(mockProgressManagerInstance.incrementSuccess).toHaveBeenCalledTimes(1)
    expect(mockProgressManagerInstance.incrementFailure).toHaveBeenCalledTimes(1)
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Errors:'))
  })

  it('should show summary for many errors', async () => {
    const manyErrors = Array.from({ length: 10 }, (_, i) => ({
      request: { type: 'problem', titleSlug: `problem-${i}` },
      error: new Error(`Error ${i}`),
    }))

    mockBatchScraperInstance.scrapeAll.mockResolvedValueOnce({
      results: Array.from({ length: 10 }, () => ({ success: false })),
      errors: manyErrors,
      completed: 10,
      total: 10,
    })

    await program.parseAsync(['node', 'lesca', 'scrape-list'])

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('10 errors occurred. Check logs for details.')
    )
  })

  it('should combine multiple options', async () => {
    await program.parseAsync([
      'node',
      'lesca',
      'scrape-list',
      '--difficulty',
      'Medium',
      '--tags',
      'dp,graph',
      '--limit',
      '50',
      '--concurrency',
      '3',
    ])

    expect(mockListStrategy.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'list',
        filters: expect.objectContaining({
          difficulty: 'Medium',
          tags: ['dp', 'graph'],
        }),
        limit: 50,
      })
    )

    const { BatchScraper } = await import('@/core/src/index')
    expect(BatchScraper).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        concurrency: 3,
      })
    )
  })
})
