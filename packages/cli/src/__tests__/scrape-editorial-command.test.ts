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

const mockScraperInstance = {
  scrape: vi.fn().mockResolvedValue({
    success: true,
    filePath: '/path/to/editorial.md',
    data: { content: 'Editorial content\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6' },
  }),
}

vi.mock('@/core/src/index', () => ({
  LeetCodeScraper: vi.fn(() => mockScraperInstance),
}))

vi.mock('@lesca/scrapers', () => ({
  ProblemScraperStrategy: vi.fn(),
  ListScraperStrategy: vi.fn(),
  EditorialScraperStrategy: vi.fn(),
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

describe('Scrape Editorial Command', () => {
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
    mockScraperInstance.scrape.mockClear()
    mockDriverInstance.launch.mockClear()
    mockDriverInstance.close.mockClear()
    mockBrowserServiceInstance.startup.mockClear()
    mockBrowserServiceInstance.shutdown.mockClear()
    mockBrowserServiceInstance.getDriver.mockClear()

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

    // Import and add scrape-editorial command
    const { scrapeEditorialCommand } = await import('../commands/scrape-editorial')
    program.addCommand(scrapeEditorialCommand)
  })

  afterEach(() => {
    mockExit.mockRestore()
  })

  it('should scrape an editorial successfully', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-editorial', 'two-sum'])

    expect(mockConfigManagerInstance.getConfig).toHaveBeenCalled()
    expect(CookieFileAuth).toHaveBeenCalled()
    expect(mockAuthInstance.authenticate).toHaveBeenCalled()
    expect(mockBrowserServiceInstance.startup).toHaveBeenCalled()
    expect(mockScraperInstance.scrape).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'editorial',
        titleSlug: 'two-sum',
        includePremium: false,
      })
    )
    expect(mockBrowserServiceInstance.shutdown).toHaveBeenCalled()
  })

  it('should handle authentication failure but continue without premium', async () => {
    mockAuthInstance.authenticate.mockRejectedValueOnce(new Error('Auth failed'))

    await program.parseAsync(['node', 'lesca', 'scrape-editorial', 'two-sum'])

    expect(mockAuthInstance.authenticate).toHaveBeenCalled()
    expect(mockScraperInstance.scrape).toHaveBeenCalled()
  })

  it('should fail if auth fails and premium is requested', async () => {
    mockAuthInstance.authenticate.mockRejectedValueOnce(new Error('Auth failed'))
    const { handleCliError } = await import('../utils')

    await expect(
      program.parseAsync(['node', 'lesca', 'scrape-editorial', 'two-sum', '--premium'])
    ).rejects.toThrow('Process.exit(1)')

    expect(handleCliError).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(1)
    expect(mockScraperInstance.scrape).not.toHaveBeenCalled()
  })

  it('should skip authentication with --no-auth', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-editorial', 'two-sum', '--no-auth'])

    expect(CookieFileAuth).not.toHaveBeenCalled()
    expect(mockScraperInstance.scrape).toHaveBeenCalled()
  })

  it('should include premium flag when requested', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-editorial', 'two-sum', '--premium'])

    expect(mockScraperInstance.scrape).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'editorial',
        includePremium: true,
      })
    )
  })

  it('should handle scrape failure', async () => {
    mockScraperInstance.scrape.mockResolvedValueOnce({
      success: false,
      error: 'Editorial not found',
    })

    await expect(
      program.parseAsync(['node', 'lesca', 'scrape-editorial', 'two-sum'])
    ).rejects.toThrow('Process.exit(1)')

    expect(logger.error).toHaveBeenCalledWith(expect.anything(), 'Editorial not found')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('should handle unexpected errors', async () => {
    mockScraperInstance.scrape.mockRejectedValueOnce(new Error('Unexpected crash'))
    const { handleCliError } = await import('../utils')

    await expect(
      program.parseAsync(['node', 'lesca', 'scrape-editorial', 'two-sum'])
    ).rejects.toThrow('Process.exit(1)')

    expect(handleCliError).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('should respect custom output directory', async () => {
    await program.parseAsync([
      'node',
      'lesca',
      'scrape-editorial',
      'two-sum',
      '--output',
      './custom-editorials',
    ])

    const { FileSystemStorage } = await import('@lesca/storage')
    expect(FileSystemStorage).toHaveBeenCalledWith('./custom-editorials')
  })

  it('should respect custom format', async () => {
    await program.parseAsync([
      'node',
      'lesca',
      'scrape-editorial',
      'two-sum',
      '--format',
      'obsidian',
    ])

    const { LeetCodeScraper } = await import('@/core/src/index')
    expect(LeetCodeScraper).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ format: 'obsidian' })
    )
  })

  it('should disable cache with --no-cache', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-editorial', 'two-sum', '--no-cache'])

    const { createCache } = await import('@lesca/shared/utils')
    expect(createCache).not.toHaveBeenCalled()
  })

  it('should respect headless option', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-editorial', 'two-sum', '--no-headless'])

    expect(mockBrowserServiceInstance.startup).toHaveBeenCalledWith(
      expect.objectContaining({ headless: false })
    )
  })

  it('should display content preview on success', async () => {
    await program.parseAsync(['node', 'lesca', 'scrape-editorial', 'two-sum'])

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Preview'))
  })

  it('should handle result with no content', async () => {
    mockScraperInstance.scrape.mockResolvedValueOnce({
      success: true,
      filePath: '/path/to/editorial.md',
      data: {},
    })

    await program.parseAsync(['node', 'lesca', 'scrape-editorial', 'two-sum'])

    // Should still succeed, just not show preview
    expect(mockExit).not.toHaveBeenCalled()
  })
})
