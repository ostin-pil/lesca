import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { ConfigManager } from '@lesca/shared/config'
import { logger } from '@lesca/shared/utils'
import {
  initializeConfig,
  handleCliError,
  parseTags,
  parseDifficulty,
  parseNumber,
  validateFormat,
  validateSortOrder,
  formatSuccessMessage,
  formatErrorMessage,
  validateProblemSlug,
} from '../helpers'

describe('CLI Helpers', () => {
  describe('initializeConfig', () => {
    it('should initialize config with provided path', () => {
      const mockConfigManager = {
        initialize: vi.fn().mockReturnValue({ config: 'mock' }),
      } as unknown as typeof ConfigManager

      const result = initializeConfig(mockConfigManager, '/path/to/config.yaml')

      expect(mockConfigManager.initialize).toHaveBeenCalledWith({ configPath: '/path/to/config.yaml' })
      expect(result).toEqual({ config: 'mock' })
    })

    it('should initialize config without path when not provided', () => {
      const mockConfigManager = {
        initialize: vi.fn().mockReturnValue({ config: 'mock' }),
      } as unknown as typeof ConfigManager

      const result = initializeConfig(mockConfigManager)

      expect(mockConfigManager.initialize).toHaveBeenCalledWith({})
      expect(result).toEqual({ config: 'mock' })
    })

    it('should fall back to defaults when config loading fails', () => {
      const mockConfigManager = {
        initialize: vi
          .fn()
          .mockImplementationOnce(() => {
            throw new Error('Config not found')
          })
          .mockReturnValueOnce({ config: 'defaults' }),
      } as unknown as typeof ConfigManager

      vi.spyOn(logger, 'warn').mockImplementation(() => {})

      const result = initializeConfig(mockConfigManager, '/invalid/path.yaml')

      expect(logger.warn).toHaveBeenCalledWith('Could not load config file, using defaults')
      expect(mockConfigManager.initialize).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ config: 'defaults' })

      vi.restoreAllMocks()
    })
  })

  describe('handleCliError', () => {
    beforeEach(() => {
      vi.spyOn(logger, 'error').mockImplementation(() => {})
      vi.spyOn(logger, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should handle Error instance without debug mode', () => {
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n  at test.ts:1:1'

      handleCliError('Operation failed', error, false)

      expect(logger.error).toHaveBeenCalledWith('Operation failed', error)
      expect(logger.log).not.toHaveBeenCalled()
    })

    it('should handle Error instance with debug mode and show stack trace', () => {
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n  at test.ts:1:1'

      handleCliError('Operation failed', error, true)

      expect(logger.error).toHaveBeenCalledWith('Operation failed', error)
      expect(logger.log).toHaveBeenCalledTimes(2)
    })

    it('should handle Error instance without stack trace in debug mode', () => {
      const error = new Error('Test error')
      delete error.stack

      handleCliError('Operation failed', error, true)

      expect(logger.error).toHaveBeenCalledWith('Operation failed', error)
      expect(logger.log).not.toHaveBeenCalled()
    })

    it('should handle non-Error values', () => {
      handleCliError('Operation failed', 'string error')

      expect(logger.error).toHaveBeenCalledWith('Operation failed', undefined, { error: 'string error' })
    })

    it('should handle no error parameter', () => {
      handleCliError('Operation failed')

      expect(logger.error).toHaveBeenCalledWith('Operation failed')
    })
  })

  describe('parseTags', () => {
    it('should parse comma-separated tags', () => {
      expect(parseTags('array,hash-table,two-pointers')).toEqual(['array', 'hash-table', 'two-pointers'])
    })

    it('should trim whitespace from tags', () => {
      expect(parseTags('array, hash-table , two-pointers')).toEqual([
        'array',
        'hash-table',
        'two-pointers',
      ])
    })

    it('should filter out empty tags', () => {
      expect(parseTags('array,,hash-table,,')).toEqual(['array', 'hash-table'])
    })

    it('should return empty array for empty string', () => {
      expect(parseTags('')).toEqual([])
    })

    it('should return empty array for whitespace-only string', () => {
      expect(parseTags('   ')).toEqual([])
    })

    it('should handle single tag', () => {
      expect(parseTags('array')).toEqual(['array'])
    })
  })

  describe('parseDifficulty', () => {
    it('should parse "Easy" correctly', () => {
      expect(parseDifficulty('Easy')).toBe('Easy')
      expect(parseDifficulty('easy')).toBe('Easy')
      expect(parseDifficulty('EASY')).toBe('Easy')
    })

    it('should parse "Medium" correctly', () => {
      expect(parseDifficulty('Medium')).toBe('Medium')
      expect(parseDifficulty('medium')).toBe('Medium')
      expect(parseDifficulty('MEDIUM')).toBe('Medium')
    })

    it('should parse "Hard" correctly', () => {
      expect(parseDifficulty('Hard')).toBe('Hard')
      expect(parseDifficulty('hard')).toBe('Hard')
      expect(parseDifficulty('HARD')).toBe('Hard')
    })

    it('should return undefined for undefined input', () => {
      expect(parseDifficulty(undefined)).toBeUndefined()
    })

    it('should throw error for invalid difficulty', () => {
      expect(() => parseDifficulty('invalid')).toThrow('Invalid difficulty: invalid')
      expect(() => parseDifficulty('impossible')).toThrow('Invalid difficulty: impossible')
    })
  })

  describe('parseNumber', () => {
    it('should parse valid number', () => {
      expect(parseNumber('42', 'count')).toBe(42)
      expect(parseNumber('0', 'count')).toBe(0)
      expect(parseNumber('-5', 'count')).toBe(-5)
    })

    it('should enforce minimum value', () => {
      expect(parseNumber('10', 'count', 5)).toBe(10)
      expect(() => parseNumber('3', 'count', 5)).toThrow('count must be at least 5')
    })

    it('should enforce maximum value', () => {
      expect(parseNumber('50', 'count', undefined, 100)).toBe(50)
      expect(() => parseNumber('150', 'count', undefined, 100)).toThrow('count must be at most 100')
    })

    it('should enforce both min and max', () => {
      expect(parseNumber('50', 'count', 10, 100)).toBe(50)
      expect(() => parseNumber('5', 'count', 10, 100)).toThrow('count must be at least 10')
      expect(() => parseNumber('150', 'count', 10, 100)).toThrow('count must be at most 100')
    })

    it('should throw error for invalid number', () => {
      expect(() => parseNumber('abc', 'count')).toThrow('count must be a valid number, got: abc')
      expect(parseNumber('12.5', 'count')).toBe(12)
      expect(() => parseNumber('', 'count')).toThrow('count must be a valid number')
    })
  })

  describe('validateFormat', () => {
    it('should accept "markdown"', () => {
      expect(validateFormat('markdown')).toBe('markdown')
    })

    it('should accept "obsidian"', () => {
      expect(validateFormat('obsidian')).toBe('obsidian')
    })

    it('should reject invalid formats', () => {
      expect(() => validateFormat('html')).toThrow("Invalid format: html. Must be 'markdown' or 'obsidian'")
      expect(() => validateFormat('json')).toThrow("Invalid format: json. Must be 'markdown' or 'obsidian'")
      expect(() => validateFormat('')).toThrow("Invalid format: . Must be 'markdown' or 'obsidian'")
    })
  })

  describe('validateSortOrder', () => {
    it('should accept "hot"', () => {
      expect(validateSortOrder('hot')).toBe('hot')
    })

    it('should accept "most-votes"', () => {
      expect(validateSortOrder('most-votes')).toBe('most-votes')
    })

    it('should accept "recent"', () => {
      expect(validateSortOrder('recent')).toBe('recent')
    })

    it('should reject invalid sort orders', () => {
      expect(() => validateSortOrder('popular')).toThrow(
        "Invalid sort order: popular. Must be 'hot', 'most-votes', or 'recent'"
      )
      expect(() => validateSortOrder('newest')).toThrow(
        "Invalid sort order: newest. Must be 'hot', 'most-votes', or 'recent'"
      )
    })
  })

  describe('formatSuccessMessage', () => {
    it('should format success message with default item type', () => {
      const message = formatSuccessMessage('/path/to/file.md')
      expect(message).toContain('Content scraped successfully!')
      expect(message).toContain('Saved to:')
      expect(message).toContain('/path/to/file.md')
    })

    it('should format success message with custom item type', () => {
      const message = formatSuccessMessage('/path/to/file.md', 'Problem')
      expect(message).toContain('Problem scraped successfully!')
      expect(message).toContain('/path/to/file.md')
    })
  })

  describe('formatErrorMessage', () => {
    it('should format Error instance', () => {
      const error = new Error('Test error')
      expect(formatErrorMessage(error)).toBe('Test error')
    })

    it('should format string error', () => {
      expect(formatErrorMessage('String error')).toBe('String error')
    })

    it('should format number error', () => {
      expect(formatErrorMessage(404)).toBe('404')
    })

    it('should format object error', () => {
      expect(formatErrorMessage({ code: 'ERR_TEST' })).toBe('[object Object]')
    })

    it('should format null/undefined', () => {
      expect(formatErrorMessage(null)).toBe('null')
      expect(formatErrorMessage(undefined)).toBe('undefined')
    })
  })

  describe('validateProblemSlug', () => {
    it('should accept valid problem slugs', () => {
      expect(validateProblemSlug('two-sum')).toBe('two-sum')
      expect(validateProblemSlug('add-two-numbers')).toBe('add-two-numbers')
      expect(validateProblemSlug('3sum')).toBe('3sum')
      expect(validateProblemSlug('longest-substring-without-repeating-characters')).toBe(
        'longest-substring-without-repeating-characters'
      )
    })

    it('should trim whitespace', () => {
      expect(validateProblemSlug('  two-sum  ')).toBe('two-sum')
      expect(validateProblemSlug('\ttwo-sum\n')).toBe('two-sum')
    })

    it('should reject empty string', () => {
      expect(() => validateProblemSlug('')).toThrow('Problem slug cannot be empty')
      expect(() => validateProblemSlug('   ')).toThrow('Problem slug cannot be empty')
    })

    it('should reject invalid characters', () => {
      expect(() => validateProblemSlug('Two-Sum')).toThrow('Invalid problem slug format')
      expect(() => validateProblemSlug('two_sum')).toThrow('Invalid problem slug format')
      expect(() => validateProblemSlug('two sum')).toThrow('Invalid problem slug format')
      expect(() => validateProblemSlug('two.sum')).toThrow('Invalid problem slug format')
    })

    it('should provide helpful error message', () => {
      expect(() => validateProblemSlug('Two-Sum')).toThrow(
        'Should be lowercase with hyphens (e.g., "two-sum")'
      )
    })
  })
})
