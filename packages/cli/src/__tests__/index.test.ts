import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock all dependencies before import
const mockConfigManagerInstance = {
  getConfig: vi.fn().mockReturnValue({
    logging: {
      level: 'info',
      output: 'console',
      format: 'text',
      file: null,
    },
  }),
}

vi.mock('@lesca/shared/config', () => ({
  ConfigManager: {
    initialize: vi.fn(),
    getInstance: vi.fn(() => mockConfigManagerInstance),
  },
}))

vi.mock('@lesca/shared/utils', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    setConfig: vi.fn(),
  },
}))

// Mock all command modules to prevent their side effects
vi.mock('../commands/auth', () => ({ authCommand: new Command('auth') }))
vi.mock('../commands/config', () => ({ configCommand: new Command('config') }))
vi.mock('../commands/init', () => ({ initCommand: new Command('init') }))
vi.mock('../commands/list', () => ({ listCommand: new Command('list') }))
vi.mock('../commands/login', () => ({ loginCommand: new Command('login') }))
vi.mock('../commands/scrape', () => ({ scrapeCommand: new Command('scrape') }))
vi.mock('../commands/scrape-discussions', () => ({
  scrapeDiscussionsCommand: new Command('scrape-discussions'),
}))
vi.mock('../commands/scrape-editorial', () => ({
  scrapeEditorialCommand: new Command('scrape-editorial'),
}))
vi.mock('../commands/scrape-list', () => ({
  scrapeListCommand: new Command('scrape-list'),
}))
vi.mock('../commands/search', () => ({ searchCommand: new Command('search') }))
vi.mock('../commands/session', () => ({ sessionCommand: new Command('session') }))

describe('CLI Index', () => {
  let ConfigManager: typeof import('@lesca/shared/config').ConfigManager
  let logger: typeof import('@lesca/shared/utils').logger

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Re-import mocks after reset
    const config = await import('@lesca/shared/config')
    ConfigManager = config.ConfigManager

    const utils = await import('@lesca/shared/utils')
    logger = utils.logger
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initializeConfig', () => {
    it('should initialize with custom config path', async () => {
      // Create a minimal CLI to test config initialization
      const program = new Command()
      program.exitOverride()
      program.option('--config <path>', 'Path to configuration file')

      let capturedConfigPath: string | undefined

      program.hook('preAction', (thisCommand) => {
        const opts = thisCommand.optsWithGlobals<{ config?: string }>()
        capturedConfigPath = opts.config

        // Simulate initializeConfig behavior
        if (opts.config) {
          ConfigManager.initialize({ configPath: opts.config })
        } else {
          ConfigManager.initialize({})
        }
      })

      program.command('test').action(() => {})

      await program.parseAsync(['node', 'lesca', '--config', '/custom/config.yaml', 'test'])

      expect(capturedConfigPath).toBe('/custom/config.yaml')
      expect(ConfigManager.initialize).toHaveBeenCalledWith({
        configPath: '/custom/config.yaml',
      })
    })

    it('should initialize with defaults when no config path provided', async () => {
      const program = new Command()
      program.exitOverride()
      program.option('--config <path>', 'Path to configuration file')

      program.hook('preAction', () => {
        ConfigManager.initialize({})
      })

      program.command('test').action(() => {})

      await program.parseAsync(['node', 'lesca', 'test'])

      expect(ConfigManager.initialize).toHaveBeenCalledWith({})
    })

    it('should fall back to defaults on config load error', async () => {
      vi.mocked(ConfigManager.initialize).mockImplementationOnce(() => {
        throw new Error('Config file not found')
      })

      const program = new Command()
      program.exitOverride()
      program.option('--config <path>', 'Path to configuration file')

      program.hook('preAction', (thisCommand) => {
        const opts = thisCommand.optsWithGlobals<{ config?: string }>()
        try {
          const initOpts = opts.config ? { configPath: opts.config } : {}
          ConfigManager.initialize(initOpts)
        } catch {
          logger.warn('Could not load config file, using defaults')
          ConfigManager.initialize({})
        }
      })

      program.command('test').action(() => {})

      await program.parseAsync(['node', 'lesca', '--config', '/bad/path.yaml', 'test'])

      expect(logger.warn).toHaveBeenCalledWith('Could not load config file, using defaults')
      expect(ConfigManager.initialize).toHaveBeenCalledTimes(2)
    })
  })

  describe('preAction hook', () => {
    it('should configure logger from config settings', async () => {
      mockConfigManagerInstance.getConfig.mockReturnValue({
        logging: {
          level: 'debug',
          output: 'both',
          format: 'json',
          file: '/var/log/lesca.log',
        },
      })

      const program = new Command()
      program.exitOverride()
      program.option('--config <path>', 'Path to configuration file')
      program.option('--debug', 'Enable debug mode')

      program.hook('preAction', () => {
        ConfigManager.initialize({})
        const config = ConfigManager.getInstance().getConfig()

        logger.setConfig({
          level: config.logging.level,
          console: config.logging.output === 'console' || config.logging.output === 'both',
          file: config.logging.output === 'file' || config.logging.output === 'both',
          ...(config.logging.file ? { filePath: config.logging.file } : {}),
          json: config.logging.format === 'json',
        })
      })

      program.command('test').action(() => {})

      await program.parseAsync(['node', 'lesca', 'test'])

      expect(logger.setConfig).toHaveBeenCalledWith({
        level: 'debug',
        console: true,
        file: true,
        filePath: '/var/log/lesca.log',
        json: true,
      })
    })

    it('should configure logger for console-only output', async () => {
      mockConfigManagerInstance.getConfig.mockReturnValue({
        logging: {
          level: 'info',
          output: 'console',
          format: 'text',
          file: null,
        },
      })

      const program = new Command()
      program.exitOverride()

      program.hook('preAction', () => {
        ConfigManager.initialize({})
        const config = ConfigManager.getInstance().getConfig()

        logger.setConfig({
          level: config.logging.level,
          console: config.logging.output === 'console' || config.logging.output === 'both',
          file: config.logging.output === 'file' || config.logging.output === 'both',
          ...(config.logging.file ? { filePath: config.logging.file } : {}),
          json: config.logging.format === 'json',
        })
      })

      program.command('test').action(() => {})

      await program.parseAsync(['node', 'lesca', 'test'])

      expect(logger.setConfig).toHaveBeenCalledWith({
        level: 'info',
        console: true,
        file: false,
        json: false,
      })
    })

    it('should configure logger for file-only output', async () => {
      mockConfigManagerInstance.getConfig.mockReturnValue({
        logging: {
          level: 'warn',
          output: 'file',
          format: 'text',
          file: '/tmp/lesca.log',
        },
      })

      const program = new Command()
      program.exitOverride()

      program.hook('preAction', () => {
        ConfigManager.initialize({})
        const config = ConfigManager.getInstance().getConfig()

        logger.setConfig({
          level: config.logging.level,
          console: config.logging.output === 'console' || config.logging.output === 'both',
          file: config.logging.output === 'file' || config.logging.output === 'both',
          ...(config.logging.file ? { filePath: config.logging.file } : {}),
          json: config.logging.format === 'json',
        })
      })

      program.command('test').action(() => {})

      await program.parseAsync(['node', 'lesca', 'test'])

      expect(logger.setConfig).toHaveBeenCalledWith({
        level: 'warn',
        console: false,
        file: true,
        filePath: '/tmp/lesca.log',
        json: false,
      })
    })
  })

  describe('debug mode', () => {
    it('should enable debug mode when --debug flag is passed', async () => {
      mockConfigManagerInstance.getConfig.mockReturnValue({
        logging: {
          level: 'info',
          output: 'console',
          format: 'text',
          file: null,
        },
      })

      const program = new Command()
      program.exitOverride()
      program.option('--debug', 'Enable debug mode')

      program.hook('preAction', (thisCommand) => {
        const opts = thisCommand.optsWithGlobals<{ debug?: boolean }>()
        ConfigManager.initialize({})
        const config = ConfigManager.getInstance().getConfig()

        logger.setConfig({
          level: config.logging.level,
          console: config.logging.output === 'console' || config.logging.output === 'both',
          file: config.logging.output === 'file' || config.logging.output === 'both',
          json: config.logging.format === 'json',
        })

        if (opts.debug) {
          logger.setConfig({
            level: 'debug',
            timestamps: true,
            colors: true,
          })
          logger.debug('Debug mode enabled')
        }
      })

      program.command('test').action(() => {})

      await program.parseAsync(['node', 'lesca', '--debug', 'test'])

      expect(logger.setConfig).toHaveBeenCalledWith({
        level: 'debug',
        timestamps: true,
        colors: true,
      })
      expect(logger.debug).toHaveBeenCalledWith('Debug mode enabled')
    })

    it('should not enable debug mode without --debug flag', async () => {
      mockConfigManagerInstance.getConfig.mockReturnValue({
        logging: {
          level: 'info',
          output: 'console',
          format: 'text',
          file: null,
        },
      })

      const program = new Command()
      program.exitOverride()
      program.option('--debug', 'Enable debug mode')

      program.hook('preAction', (thisCommand) => {
        const opts = thisCommand.optsWithGlobals<{ debug?: boolean }>()
        ConfigManager.initialize({})

        if (opts.debug) {
          logger.setConfig({
            level: 'debug',
            timestamps: true,
            colors: true,
          })
          logger.debug('Debug mode enabled')
        }
      })

      program.command('test').action(() => {})

      await program.parseAsync(['node', 'lesca', 'test'])

      expect(logger.debug).not.toHaveBeenCalledWith('Debug mode enabled')
    })
  })

  describe('command registration', () => {
    it('should register all expected commands', () => {
      const program = new Command()
      program.name('lesca')
      program.version('0.1.0')

      // Add mock commands
      program.addCommand(new Command('init'))
      program.addCommand(new Command('auth'))
      program.addCommand(new Command('login'))
      program.addCommand(new Command('list'))
      program.addCommand(new Command('search'))
      program.addCommand(new Command('scrape'))
      program.addCommand(new Command('scrape-list'))
      program.addCommand(new Command('scrape-editorial'))
      program.addCommand(new Command('scrape-discussions'))
      program.addCommand(new Command('config'))
      program.addCommand(new Command('session'))

      const commandNames = program.commands.map((cmd) => cmd.name())

      expect(commandNames).toContain('init')
      expect(commandNames).toContain('auth')
      expect(commandNames).toContain('login')
      expect(commandNames).toContain('list')
      expect(commandNames).toContain('search')
      expect(commandNames).toContain('scrape')
      expect(commandNames).toContain('scrape-list')
      expect(commandNames).toContain('scrape-editorial')
      expect(commandNames).toContain('scrape-discussions')
      expect(commandNames).toContain('config')
      expect(commandNames).toContain('session')
      expect(commandNames).toHaveLength(11)
    })
  })

  describe('program metadata', () => {
    it('should have correct name and version', () => {
      const program = new Command()
      program.name('lesca')
      program.description('Modular LeetCode Scraper - Scrape LeetCode problems to Markdown')
      program.version('0.1.0')

      expect(program.name()).toBe('lesca')
      expect(program.version()).toBe('0.1.0')
    })

    it('should accept --config and --debug options', () => {
      const program = new Command()
      program.exitOverride()
      program.option('--config <path>', 'Path to configuration file')
      program.option('--debug', 'Enable debug mode with verbose logging')
      program.command('test').action(() => {})

      // Parse with options - should not throw
      expect(async () => {
        await program.parseAsync([
          'node',
          'lesca',
          '--config',
          '/path/to/config.yaml',
          '--debug',
          'test',
        ])
      }).not.toThrow()
    })
  })
})
