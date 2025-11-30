import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock dependencies
const mockConfigManagerInstance = {
  getConfig: vi.fn().mockReturnValue({
    auth: { cookiePath: 'config-cookies.json' },
    browser: { headless: true, timeout: 30000 },
  }),
}

vi.mock('@lesca/shared/config', () => ({
  ConfigManager: {
    getInstance: vi.fn(() => mockConfigManagerInstance),
  },
  getDefaultPaths: vi.fn().mockReturnValue({
    cookieFile: 'default-cookies.json',
  }),
  DEFAULT_LOGIN_TIMEOUT: 60000,
}))

vi.mock('@lesca/shared/utils', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    box: vi.fn(),
  },
}))

const mockDriverInstance = {
  launch: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
}

const mockCookieManagerInstance = {
  saveCookies: vi.fn().mockResolvedValue(undefined),
}

const mockAuthHelperInstance = {
  waitForManualLogin: vi.fn().mockResolvedValue({ success: true }),
  login: vi.fn().mockResolvedValue({ success: true }),
}

vi.mock('@lesca/browser-automation', () => ({
  PlaywrightDriver: vi.fn(() => mockDriverInstance),
  CookieManager: vi.fn(() => mockCookieManagerInstance),
  AuthHelper: vi.fn(() => mockAuthHelperInstance),
}))

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
  })),
}))

vi.mock('chalk', () => ({
  default: {
    yellow: (str: string) => str,
    cyan: (str: string) => str,
    green: (str: string) => str,
    red: (str: string) => str,
    bold: (str: string) => str,
  },
}))

vi.mock('../utils', () => ({
  handleCliError: vi.fn(),
}))

describe('Login Command', () => {
  let program: Command
  let loginCommand: Command
  let mockExit: ReturnType<typeof vi.spyOn>
  let logger: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules() // Reset modules to get fresh loginCommand instance

    // Re-mock dependencies after resetModules
    // Note: In Vitest, top-level vi.mock are hoisted, but resetModules clears the cache.
    // We might need to re-apply mocks or rely on Vitest's behavior.
    // Actually, vi.mock is hoisted, so it applies to re-imports too.

    // Reset mock instance methods
    mockConfigManagerInstance.getConfig.mockClear()
    mockDriverInstance.launch.mockClear()
    mockDriverInstance.close.mockClear()
    mockAuthHelperInstance.waitForManualLogin.mockClear()
    mockAuthHelperInstance.login.mockClear()
    mockCookieManagerInstance.saveCookies.mockClear()

    // Create fresh program
    program = new Command()
    program.exitOverride()

    // Mock process.exit to throw to simulate termination
    mockExit = vi.spyOn(process, 'exit').mockImplementation(((code) => {
      throw new Error(`Process.exit(${code})`)
    }) as any)

    // Get mocked modules
    const utils = await import('@lesca/shared/utils')
    logger = utils.logger

    // Import and add login command
    const { loginCommand: cmd } = await import('../commands/login')
    loginCommand = cmd
    program.addCommand(loginCommand)
  })

  afterEach(() => {
    mockExit.mockRestore()
  })

  describe('Manual Login', () => {
    it('should handle successful manual login', async () => {
      await program.parseAsync(['node', 'lesca', 'login', '--manual'])

      expect(mockDriverInstance.launch).toHaveBeenCalledWith(
        expect.objectContaining({ headless: true })
      )
      expect(mockAuthHelperInstance.waitForManualLogin).toHaveBeenCalled()
      expect(mockCookieManagerInstance.saveCookies).toHaveBeenCalled()
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Cookies saved'))
      expect(mockDriverInstance.close).toHaveBeenCalled()
    })

    it('should handle manual login failure', async () => {
      mockAuthHelperInstance.waitForManualLogin.mockResolvedValueOnce({
        success: false,
        message: 'Timeout',
      })

      await expect(program.parseAsync(['node', 'lesca', 'login', '--manual'])).rejects.toThrow(
        'Process.exit(1)'
      )

      expect(logger.error).toHaveBeenCalledWith('Timeout')
      expect(mockExit).toHaveBeenCalledWith(1)
      expect(mockDriverInstance.close).toHaveBeenCalled()
    })

    it('should respect --no-headless option', async () => {
      await program.parseAsync(['node', 'lesca', 'login', '--manual', '--no-headless'])

      expect(mockDriverInstance.launch).toHaveBeenCalledWith(
        expect.objectContaining({ headless: false })
      )
    })
  })

  describe('Interactive Login', () => {
    it('should handle successful interactive login', async () => {
      await program.parseAsync([
        'node',
        'lesca',
        'login',
        '--username',
        'user',
        '--password',
        'pass',
      ])

      expect(mockAuthHelperInstance.login).toHaveBeenCalledWith(
        { username: 'user', password: 'pass' },
        expect.anything()
      )
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Cookies saved'))
      expect(mockDriverInstance.close).toHaveBeenCalled()
    })

    it('should fail if username is missing', async () => {
      await expect(
        program.parseAsync(['node', 'lesca', 'login', '--password', 'pass'])
      ).rejects.toThrow('Process.exit(1)')

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Username required'))
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should fail if password is missing', async () => {
      await expect(
        program.parseAsync(['node', 'lesca', 'login', '--username', 'user'])
      ).rejects.toThrow('Process.exit(1)')

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Password required'))
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should handle login failure', async () => {
      mockAuthHelperInstance.login.mockResolvedValueOnce({
        success: false,
        message: 'Invalid credentials',
      })

      await expect(
        program.parseAsync(['node', 'lesca', 'login', '--username', 'user', '--password', 'pass'])
      ).rejects.toThrow('Process.exit(1)')

      expect(logger.error).toHaveBeenCalledWith('Invalid credentials')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should handle CAPTCHA state', async () => {
      mockAuthHelperInstance.login.mockResolvedValueOnce({
        success: false,
        state: 'captcha',
      })

      await expect(
        program.parseAsync(['node', 'lesca', 'login', '--username', 'user', '--password', 'pass'])
      ).rejects.toThrow('Process.exit(1)')

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('CAPTCHA detected'))
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should handle rate limit state', async () => {
      mockAuthHelperInstance.login.mockResolvedValueOnce({
        success: false,
        state: 'rate-limited',
      })

      await expect(
        program.parseAsync(['node', 'lesca', 'login', '--username', 'user', '--password', 'pass'])
      ).rejects.toThrow('Process.exit(1)')

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Rate limited'))
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle unexpected errors', async () => {
      mockDriverInstance.launch.mockRejectedValueOnce(new Error('Browser crash'))
      const { handleCliError } = await import('../utils')

      await expect(program.parseAsync(['node', 'lesca', 'login', '--manual'])).rejects.toThrow(
        'Process.exit(1)'
      )

      expect(handleCliError).toHaveBeenCalled()
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })
})
