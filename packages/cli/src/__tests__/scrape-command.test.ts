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
      viewport: { width: 1280, height: 720 },
      blockedResources: [],
      pool: {
        enabled: false,
        strategy: 'lazy',
        maxSize: 3,
        maxIdleTime: 300000,
        acquireTimeout: 30000,
        retryOnFailure: true,
        maxRetries: 3,
      },
      interception: {
        enabled: false,
        blockResources: [],
        captureResponses: false,
      },
    },
    plugins: {
      enabled: false,
      plugins: [],
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
  getBrowser: vi.fn().mockReturnValue(undefined),
}

vi.mock('@lesca/browser-automation', () => ({
  PlaywrightDriver: vi.fn(() => mockDriverInstance),
  SessionManager: vi.fn(),
  SessionPoolManager: vi.fn(),
}))

const mockScraperInstance = {
  scrape: vi.fn().mockResolvedValue({
    success: true,
    filePath: '/path/to/problem.md',
    data: { content: 'Problem content' },
  }),
}

vi.mock('@/core/src/index', () => ({
  LeetCodeScraper: vi.fn(() => mockScraperInstance),
  PluginManager: vi.fn(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('@lesca/scrapers', () => ({
  ProblemScraperStrategy: vi.fn(),
  ListScraperStrategy: vi.fn(),
}))

vi.mock('@lesca/storage', () => ({
  FileSystemStorage: vi.fn(),
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

describe('Scrape Command', () => {
  let program: Command
  let scrapeCommand: Command
  let mockExit: ReturnType<typeof vi.spyOn>
  let logger: any
  let CookieFileAuth: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset mock instance methods
    mockConfigManagerInstance.getConfig.mockClear()
    mockAuthInstance.authenticate.mockClear()
    mockAuthInstance.getCredentials.mockClear()
    mockScraperInstance.scrape.mockClear()
    mockDriverInstance.launch.mockClear()
    mockDriverInstance.close.mockClear()
    mockDriverInstance.getBrowser.mockClear()

    // Create fresh program
    program = new Command()
    program.exitOverride()

    // Mock process.exit
    mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    // Get mocked modules
    const utils = await import('@lesca/shared/utils')
    logger = utils.logger

    const auth = await import('@lesca/auth')
    CookieFileAuth = auth.CookieFileAuth

    // Import and add scrape command
    const { scrapeCommand: cmd } = await import('../commands/scrape')
    scrapeCommand = cmd
    program.addCommand(scrapeCommand)
  })

  afterEach(() => {
    mockExit.mockRestore()
  })

  it('should scrape a problem successfully', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape', 'two-sum'])

    expect(mockConfigManagerInstance.getConfig).toHaveBeenCalled()
    expect(CookieFileAuth).toHaveBeenCalled()
    expect(mockAuthInstance.authenticate).toHaveBeenCalled()
    expect(mockScraperInstance.scrape).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'problem',
        titleSlug: 'two-sum',
      })
    )
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Preview'))
  })

  it('should handle authentication failure but continue', async () => {
    mockAuthInstance.authenticate.mockRejectedValueOnce(new Error('Auth failed'))

    await program.parseAsync(['node', 'lesca', 'scrape', 'two-sum'])

    expect(mockAuthInstance.authenticate).toHaveBeenCalled()
    expect(mockScraperInstance.scrape).toHaveBeenCalled()
  })

  it('should skip authentication with --no-auth', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape', 'two-sum', '--no-auth'])

    expect(CookieFileAuth).not.toHaveBeenCalled()
    expect(mockScraperInstance.scrape).toHaveBeenCalled()
  })

  it('should handle scrape failure', async () => {
    mockScraperInstance.scrape.mockResolvedValueOnce({
      success: false,
      error: 'Failed to fetch problem',
    })

    await program.parseAsync(['node', 'lesca', 'scrape', 'two-sum'])

    expect(logger.error).toHaveBeenCalledWith(expect.anything(), 'Failed to fetch problem')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('should handle unexpected errors', async () => {
    mockScraperInstance.scrape.mockRejectedValueOnce(new Error('Unexpected crash'))
    const { handleCliError } = await import('../utils')

    await program.parseAsync(['node', 'lesca', 'scrape', 'two-sum'])

    expect(handleCliError).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('should respect custom options', async () => {
    await program.parseAsync([
      'node',
      'lesca',
      'scrape',
      'two-sum',
      '--output',
      './custom',
      '--format',
      'obsidian',
      '--no-cache',
    ])

    const { FileSystemStorage } = await import('@lesca/storage')
    const { LeetCodeScraper } = await import('@/core/src/index')
    const { createCache } = await import('@lesca/shared/utils')

    expect(FileSystemStorage).toHaveBeenCalledWith('./custom')
    expect(LeetCodeScraper).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ format: 'obsidian' })
    )
    // cache is disabled via --no-cache, but createCache might still be called if config enables it
    // Wait, logic is: options.cache !== false && config.cache.enabled
    // --no-cache sets options.cache to false.
    // So createCache should NOT be called if we assume implementation logic is correct?
    // Let's check implementation: const cacheEnabled = options.cache !== false && config.cache.enabled
    // So if --no-cache is passed, cacheEnabled is false.
    // const cache = cacheEnabled ? createCache(config) : undefined
    // So createCache should NOT be called.

    // However, createCache mock is global. Let's check if it was called.
    // Wait, beforeEach clears mocks.
    expect(createCache).not.toHaveBeenCalled()
  })
})
