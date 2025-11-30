import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Create mock instance
const mockConfigManagerInstance = {
  init: vi.fn().mockResolvedValue(undefined),
  createDefaultConfigFile: vi.fn().mockReturnValue('/path/to/config.yaml'),
  getEffectiveConfig: vi.fn().mockReturnValue({
    auth: { method: 'cookie', cookiePath: '~/.leetcode/cookies.json' },
    browser: { headless: true, timeout: 30000 },
    cache: { enabled: true, ttl: 86400 },
    scraping: { concurrent: 3, retries: 2, delay: 1000 },
  }),
  get: vi.fn(),
  update: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  export: vi.fn().mockReturnValue('# Lesca Configuration\\nauth:\\n  method: cookie'),
  getPaths: vi.fn().mockReturnValue({
    config: '/home/user/.config/lesca/config.yaml',
    cookieFile: '~/.leetcode/cookies.json',
    cacheDir: '~/.cache/lesca',
  }),
}

// Mock dependencies
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
}))

vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    gray: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    red: (str: string) => str,
    bold: (str: string) => str,
  },
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}))

vi.mock('../utils', () => ({
  handleCliError: vi.fn(),
}))

describe('Config Command', () => {
  let program: Command
  let configCommand: Command
  let mockExit: ReturnType<typeof vi.spyOn>
  let logger: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset mock instance methods
    Object.values(mockConfigManagerInstance).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) {
        fn.mockClear()
      }
    })

    // Create fresh program
    program = new Command()
    program.exitOverride() // Prevent actual exit

    // Mock process.exit
    mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

    // Get mocked modules
    const utils = await import('@lesca/shared/utils')
    logger = utils.logger

    // Import and add config command
    const { configCommand: cmd } = await import('../commands/config')
    configCommand = cmd
    program.addCommand(configCommand)
  })

  afterEach(() => {
    mockExit.mockRestore()
  })

  describe('show subcommand', () => {
    it('should display current configuration', async () => {
      await program.parseAsync(['node', 'lesca', 'config', 'show'])

      expect(mockConfigManagerInstance.getEffectiveConfig).toHaveBeenCalled()
      expect(mockConfigManagerInstance.export).toHaveBeenCalledWith('yaml')
      expect(logger.log).toHaveBeenCalled()
    })

    it('should display configuration as JSON', async () => {
      await program.parseAsync(['node', 'lesca', 'config', 'show', '--json'])

      expect(mockConfigManagerInstance.getEffectiveConfig).toHaveBeenCalled()
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('{'))
    })

    it('should display specific config path value', async () => {
      mockConfigManagerInstance.get.mockReturnValue(true)

      await program.parseAsync(['node', 'lesca', 'config', 'show', '--path', 'browser.headless'])

      expect(mockConfigManagerInstance.get).toHaveBeenCalledWith('browser.headless')
      expect(logger.log).toHaveBeenCalledWith('true')
    })

    it('should handle undefined config path', async () => {
      mockConfigManagerInstance.get.mockReturnValue(undefined)

      await program.parseAsync(['node', 'lesca', 'config', 'show', '--path', 'nonexistent.key'])

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not found'))
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe('init subcommand', () => {
    it('should create default configuration file', async () => {
      await program.parseAsync(['node', 'lesca', 'config', 'init'])

      expect(mockConfigManagerInstance.createDefaultConfigFile).toHaveBeenCalled()
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Created'))
    })

    it('should handle existing config file without force', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValue(true)

      await program.parseAsync(['node', 'lesca', 'config', 'init'])

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('already exists'))
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should overwrite existing config with --force', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValue(true)

      await program.parseAsync(['node', 'lesca', 'config', 'init', '--force'])

      expect(mockConfigManagerInstance.createDefaultConfigFile).toHaveBeenCalled()
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Created'))
    })
  })

  describe('get subcommand', () => {
    it('should get specific config value', async () => {
      mockConfigManagerInstance.get.mockReturnValue('cookie')

      await program.parseAsync(['node', 'lesca', 'config', 'get', 'auth.method'])

      expect(mockConfigManagerInstance.get).toHaveBeenCalledWith('auth.method')
      expect(logger.log).toHaveBeenCalledWith('cookie')
    })

    it('should format object values as JSON', async () => {
      mockConfigManagerInstance.get.mockReturnValue({ method: 'cookie' })

      await program.parseAsync(['node', 'lesca', 'config', 'get', 'auth'])

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('{'))
    })

    it('should handle non-existent keys', async () => {
      mockConfigManagerInstance.get.mockReturnValue(undefined)

      await program.parseAsync(['node', 'lesca', 'config', 'get', 'invalid.key'])

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not found'))
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe('set subcommand', () => {
    it('should set string value', async () => {
      mockConfigManagerInstance.getPaths.mockReturnValue({ config: '/path/config.yaml' })

      await program.parseAsync(['node', 'lesca', 'config', 'set', 'auth.method', 'manual'])

      expect(mockConfigManagerInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ auth: { method: 'manual' } })
      )
      expect(mockConfigManagerInstance.save).toHaveBeenCalled()
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Set'))
    })

    it('should parse boolean values', async () => {
      mockConfigManagerInstance.getPaths.mockReturnValue({ config: '/path/config.yaml' })

      await program.parseAsync(['node', 'lesca', 'config', 'set', 'browser.headless', 'false'])

      expect(mockConfigManagerInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ browser: { headless: false } })
      )
    })

    it('should parse numeric values', async () => {
      mockConfigManagerInstance.getPaths.mockReturnValue({ config: '/path/config.yaml' })

      await program.parseAsync(['node', 'lesca', 'config', 'set', 'browser.timeout', '60000'])

      expect(mockConfigManagerInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ browser: { timeout: 60000 } })
      )
    })

    it('should parse JSON with --json flag', async () => {
      mockConfigManagerInstance.getPaths.mockReturnValue({ config: '/path/config.yaml' })

      await program.parseAsync([
        'node',
        'lesca',
        'config',
        'set',
        'scraping',
        '{"concurrent":5}',
        '--json',
      ])

      expect(mockConfigManagerInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ scraping: { concurrent: 5 } })
      )
    })
  })

  describe('path subcommand', () => {
    it('should display all config paths', async () => {
      await program.parseAsync(['node', 'lesca', 'config', 'path'])

      expect(mockConfigManagerInstance.getPaths).toHaveBeenCalled()
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Configuration paths'))
    })

    it('should show warning when no config file loaded', async () => {
      mockConfigManagerInstance.getPaths.mockReturnValue({
        config: null,
        cookieFile: '~/.leetcode/cookies.json',
        cacheDir: '~/.cache/lesca',
      })

      await program.parseAsync(['node', 'lesca', 'config', 'path'])

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No config file'))
    })
  })
})
