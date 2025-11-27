import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock dependencies
const mockConfigManagerInstance = {
  getConfig: vi.fn().mockReturnValue({
    auth: { method: 'cookie', cookiePath: 'cookies.json' },
    api: { rateLimit: { minDelay: 100, maxDelay: 200, jitter: 0.1 } },
    cache: { enabled: true },
  }),
}

vi.mock('@/shared/config/src/index', () => ({
  ConfigManager: {
    getInstance: vi.fn(() => mockConfigManagerInstance),
  },
}))

vi.mock('@/shared/utils/src/index', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
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

vi.mock('@/auth/src/index', () => ({
  CookieFileAuth: vi.fn(() => mockAuthInstance),
}))

const mockListScraperInstance = {
  execute: vi.fn().mockResolvedValue({
    type: 'list',
    data: {
      questions: [
        {
          questionFrontendId: '1',
          title: 'Two Sum',
          titleSlug: 'two-sum',
          difficulty: 'Easy',
          isPaidOnly: false,
        },
        {
          questionFrontendId: '2',
          title: 'Add Two Numbers',
          titleSlug: 'add-two-numbers',
          difficulty: 'Medium',
          isPaidOnly: false,
        },
      ],
    },
  }),
}

vi.mock('@/scrapers/src/index', () => ({
  ListScraperStrategy: vi.fn(() => mockListScraperInstance),
}))

vi.mock('../interactive-select', () => ({
  InteractiveSelector: {
    selectProblems: vi.fn().mockResolvedValue(['two-sum']),
    confirm: vi.fn().mockResolvedValue(true),
  },
}))

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
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

vi.mock('../utils', () => ({
  handleCliError: vi.fn(),
}))

describe('List Command', () => {
  let program: Command
  let listCommand: Command
  let mockExit: ReturnType<typeof vi.spyOn>
  let logger: any
  let InteractiveSelector: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Reset mock instance methods
    mockConfigManagerInstance.getConfig.mockClear()
    mockAuthInstance.authenticate.mockClear()
    mockListScraperInstance.execute.mockClear()

    // Create fresh program
    program = new Command()
    program.exitOverride()

    // Mock process.exit
    mockExit = vi.spyOn(process, 'exit').mockImplementation(((code) => {
      throw new Error(`Process.exit(${code})`)
    }) as any)

    // Get mocked modules
    const utils = await import('@/shared/utils/src/index')
    logger = utils.logger
    const interactive = await import('../interactive-select')
    InteractiveSelector = interactive.InteractiveSelector

    // Import and add list command
    const { listCommand: cmd } = await import('../commands/list')
    listCommand = cmd
    program.addCommand(listCommand)
  })

  afterEach(() => {
    mockExit.mockRestore()
  })

  it('should list problems with default options', async () => {
    await program.parseAsync(['node', 'lesca', 'list'])

    expect(mockListScraperInstance.execute).toHaveBeenCalled()
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Two Sum'))
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Add Two Numbers'))
  })

  it('should filter by difficulty and tags', async () => {
    await program.parseAsync([
      'node',
      'lesca',
      'list',
      '--difficulty',
      'Easy',
      '--tags',
      'array,hash-table',
    ])

    expect(mockListScraperInstance.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          difficulty: 'Easy',
          tags: ['array', 'hash-table'],
        },
      })
    )
  })

  it('should output JSON', async () => {
    await program.parseAsync(['node', 'lesca', 'list', '--json'])

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('"title": "Two Sum"'))
  })

  it('should handle interactive selection', async () => {
    await program.parseAsync(['node', 'lesca', 'list', '--interactive'])

    expect(InteractiveSelector.selectProblems).toHaveBeenCalled()
    expect(InteractiveSelector.confirm).toHaveBeenCalled()
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Run:'),
      expect.stringContaining('lesca scrape two-sum')
    )
  })

  it('should handle no problems selected in interactive mode', async () => {
    InteractiveSelector.selectProblems.mockResolvedValueOnce([])

    await program.parseAsync(['node', 'lesca', 'list', '--interactive'])

    expect(InteractiveSelector.selectProblems).toHaveBeenCalled()
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No problems selected'))
    expect(InteractiveSelector.confirm).not.toHaveBeenCalled()
  })

  it('should handle scraping error', async () => {
    mockListScraperInstance.execute.mockRejectedValueOnce(new Error('API Error'))
    const { handleCliError } = await import('../utils')

    await expect(program.parseAsync(['node', 'lesca', 'list'])).rejects.toThrow('Process.exit(1)')

    expect(handleCliError).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('should handle invalid response type', async () => {
    mockListScraperInstance.execute.mockResolvedValueOnce({
      type: 'problem', // Invalid type for list command
      data: {},
    })
    const { handleCliError } = await import('../utils')

    await expect(program.parseAsync(['node', 'lesca', 'list'])).rejects.toThrow('Process.exit(1)')

    expect(handleCliError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: expect.stringContaining('Invalid response type') })
    )
    expect(mockExit).toHaveBeenCalledWith(1)
  })
})
