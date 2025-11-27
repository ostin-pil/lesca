import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock dependencies
const mockConfigManagerInstance = {
  getConfig: vi.fn().mockReturnValue({
    auth: { method: 'cookie', cookiePath: 'old-cookies.json' },
  }),
  update: vi.fn(),
  save: vi.fn(),
  getPaths: vi.fn().mockReturnValue({ config: 'lesca.config.yaml' }),
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
}))

const mockAuthInstance = {
  authenticate: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/auth/src/index', () => ({
  CookieFileAuth: vi.fn(() => mockAuthInstance),
}))

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}))

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}))

vi.mock('path', () => ({
  resolve: vi.fn((p) => `/abs/${p}`),
}))

vi.mock('chalk', () => ({
  default: {
    bold: (str: string) => str,
    gray: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
    green: (str: string) => str,
  },
}))

vi.mock('../utils', () => ({
  handleCliError: vi.fn(),
}))

describe('Auth Command', () => {
  let program: Command
  let authCommand: Command
  let mockExit: ReturnType<typeof vi.spyOn>
  let logger: any
  let inquirer: any
  let fs: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Reset mock instance methods
    mockConfigManagerInstance.getConfig.mockClear()
    mockConfigManagerInstance.update.mockClear()
    mockConfigManagerInstance.save.mockClear()
    mockAuthInstance.authenticate.mockClear()

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
    inquirer = (await import('inquirer')).default
    fs = await import('fs')

    // Import and add auth command
    const { authCommand: cmd } = await import('../commands/auth')
    authCommand = cmd
    program.addCommand(authCommand)
  })

  afterEach(() => {
    mockExit.mockRestore()
  })

  it('should authenticate with provided cookies file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)

    await program.parseAsync(['node', 'lesca', 'auth', '--cookies', 'new-cookies.json'])

    expect(mockAuthInstance.authenticate).toHaveBeenCalled()
    expect(mockConfigManagerInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({ cookiePath: expect.stringContaining('new-cookies.json') }),
      })
    )
    expect(mockConfigManagerInstance.save).toHaveBeenCalled()
  })

  it('should fail if cookie file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    await expect(
      program.parseAsync(['node', 'lesca', 'auth', '--cookies', 'missing.json'])
    ).rejects.toThrow('Process.exit(1)')

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not found'))
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('should use interactive mode if no options provided', async () => {
    vi.mocked(inquirer.prompt).mockResolvedValue({
      method: 'cookie',
      cookiePath: 'interactive.json',
    })
    vi.mocked(fs.existsSync).mockReturnValue(true)

    await program.parseAsync(['node', 'lesca', 'auth'])

    expect(inquirer.prompt).toHaveBeenCalled()
    expect(mockAuthInstance.authenticate).toHaveBeenCalled()
    expect(mockConfigManagerInstance.update).toHaveBeenCalled()
  })

  it('should handle authentication failure', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    mockAuthInstance.authenticate.mockRejectedValueOnce(new Error('Invalid cookies'))
    const { handleCliError } = await import('../utils')

    await expect(
      program.parseAsync(['node', 'lesca', 'auth', '--cookies', 'bad.json'])
    ).rejects.toThrow('Process.exit(1)')

    expect(handleCliError).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('should warn about unimplemented browser login', async () => {
    await program.parseAsync(['node', 'lesca', 'auth', '--browser'])

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('not yet implemented'))
  })
})
