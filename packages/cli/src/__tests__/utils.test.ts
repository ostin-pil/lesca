import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatErrorMessage, handleCliError } from '../utils'

// Mock logger
vi.mock('@lesca/shared/utils', () => ({
  logger: {
    box: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}))

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    gray: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
    green: (str: string) => str,
    cyan: (str: string) => str,
  },
}))

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}))

describe('CLI Utils', () => {
  let logger: any

  beforeEach(async () => {
    vi.clearAllMocks()
    // Get the mocked logger
    const utils = await import('@lesca/shared/utils')
    logger = utils.logger
    // Reset process.argv
    process.argv = ['node', 'lesca']
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('formatErrorMessage', () => {
    describe('file not found errors', () => {
      it('should format cookie file not found error', () => {
        const error = new Error("ENOENT: no such file or directory, open 'cookies.json'")

        const result = formatErrorMessage(error)

        expect(result).toBe('Cookie file not found')
        expect(logger.box).toHaveBeenCalledWith(
          'Cookie file not found',
          expect.objectContaining({
            variant: 'error',
          })
        )
      })

      it('should format config file not found error', () => {
        const error = new Error("ENOENT: no such file or directory, open 'lesca.config.yaml'")

        const result = formatErrorMessage(error)

        expect(result).toBe('Configuration file not found')
        expect(logger.box).toHaveBeenCalledWith(
          'Configuration file not found',
          expect.objectContaining({
            variant: 'error',
          })
        )
      })

      it('should format generic file not found error', () => {
        const error = new Error("ENOENT: no such file or directory, open 'somefile.txt'")

        const result = formatErrorMessage(error)

        expect(result).toBe('File not found: somefile.txt')
        expect(logger.box).toHaveBeenCalledWith(
          'File not found',
          expect.objectContaining({
            variant: 'error',
          })
        )
      })

      it('should handle file error without quotes', () => {
        const error = new Error('no such file or directory')
        const result = formatErrorMessage(error)

        expect(result).toContain('File not found')
      })
    })

    describe('network errors', () => {
      it('should format connection refused error', () => {
        const error = new Error('ECONNREFUSED: connection refused')

        const result = formatErrorMessage(error)

        expect(result).toBe('Network error')
        expect(logger.box).toHaveBeenCalledWith(
          'Network error',
          expect.objectContaining({
            message: expect.stringContaining('Connection refused'),
          })
        )
      })

      it('should format connection timeout error', () => {
        const error = new Error('ETIMEDOUT: connection timed out')

        const result = formatErrorMessage(error)

        expect(result).toBe('Network error')
        expect(logger.box).toHaveBeenCalledWith(
          'Network error',
          expect.objectContaining({
            message: expect.stringContaining('timed out'),
          })
        )
      })

      it('should format DNS resolution error', () => {
        const error = new Error('getaddrinfo ENOTFOUND leetcode.com')

        const result = formatErrorMessage(error)

        expect(result).toBe('Network error')
        expect(logger.box).toHaveBeenCalledWith(
          'Network error',
          expect.objectContaining({
            message: expect.stringContaining('DNS resolution'),
          })
        )
      })
    })

    describe('rate limit errors', () => {
      it('should format HTTP 429 error', () => {
        const error = new Error('HTTP 429: Too Many Requests')

        const result = formatErrorMessage(error)

        expect(result).toBe('Rate limit exceeded')
        expect(logger.box).toHaveBeenCalledWith(
          'Rate limit exceeded',
          expect.objectContaining({
            variant: 'error',
          })
        )
      })

      it('should format rate limit text error', () => {
        const error = new Error('Rate limit exceeded, please try again later')
        const result = formatErrorMessage(error)

        expect(result).toBe('Rate limit exceeded')
      })
    })

    describe('authentication errors', () => {
      it('should format 401 Unauthorized error', () => {
        const error = new Error('HTTP 401: Unauthorized')

        const result = formatErrorMessage(error)

        expect(result).toBe('Authentication required')
        expect(logger.box).toHaveBeenCalledWith(
          'Authentication required',
          expect.objectContaining({
            variant: 'error',
          })
        )
      })

      it('should format 403 Forbidden error', () => {
        const error = new Error('HTTP 403: Forbidden')
        const result = formatErrorMessage(error)

        expect(result).toBe('Authentication required')
      })

      it('should format premium content error', () => {
        const error = new Error('This is premium content')

        const result = formatErrorMessage(error)

        expect(result).toBe('Authentication required')
        expect(logger.box).toHaveBeenCalledWith(
          'Authentication required',
          expect.objectContaining({
            message: expect.stringContaining('Premium'),
          })
        )
      })

      it('should format unauthorized text error', () => {
        const error = new Error('unauthorized access')
        const result = formatErrorMessage(error)

        expect(result).toBe('Authentication required')
      })
    })

    describe('config errors', () => {
      it('should format YAML error', () => {
        const error = new Error('YAML parsing error at line 5')

        const result = formatErrorMessage(error)

        expect(result).toBe('Configuration error')
        expect(logger.box).toHaveBeenCalledWith(
          'Configuration error',
          expect.objectContaining({
            variant: 'error',
          })
        )
      })

      it('should format invalid config error', () => {
        const error = new Error('Invalid configuration provided')
        const result = formatErrorMessage(error)

        expect(result).toBe('Configuration error')
      })
    })

    describe('default case', () => {
      it('should return original message for unknown error types', () => {
        const error = new Error('Something unexpected happened')
        const result = formatErrorMessage(error)

        expect(result).toBe('Something unexpected happened')
      })
    })
  })

  describe('handleCliError', () => {
    it('should handle Error instance with formatted message', () => {
      const error = new Error('ENOENT: no such file or directory, open "cookies.json"')

      handleCliError('Operation failed', error)

      expect(logger.box).toHaveBeenCalled()
      expect(logger.error).toHaveBeenCalled()
    })

    it('should handle Error instance with unformatted message', () => {
      const error = new Error('Some generic error')

      handleCliError('Operation failed', error)

      expect(logger.error).toHaveBeenCalledWith('Operation failed', error)
    })

    it('should show stack trace in debug mode', () => {
      const error = new Error('Test error')
      error.stack = 'Error: Test error\\n  at Object.<anonymous>'
      process.argv = ['node', 'lesca', '--debug']

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      handleCliError('Debug error', error)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Stack trace'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test error'))

      consoleSpy.mockRestore()
    })

    it('should handle non-Error objects', () => {
      handleCliError('Operation failed', 'string error')

      expect(logger.error).toHaveBeenCalledWith(
        'Operation failed',
        undefined,
        expect.objectContaining({
          error: 'string error',
        })
      )
    })

    it('should handle undefined error', () => {
      handleCliError('Operation failed')

      expect(logger.error).toHaveBeenCalledWith('Operation failed')
    })

    it('should handle null error', () => {
      handleCliError('Operation failed', null)

      // null is treated as undefined (simple message)
      expect(logger.error).toHaveBeenCalledWith('Operation failed')
    })
  })
})
