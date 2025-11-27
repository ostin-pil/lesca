/**
 * CLI Helper Functions
 *
 * Extracted helper functions for better testability
 */


import { ValidationError } from '@lesca/error'
import chalk from 'chalk'

import type { ConfigManager } from '@/shared/config/src/index'
import { logger } from '@/shared/utils/src/index'

/**
 * Initialize configuration with fallback to defaults
 */
export function initializeConfig(
  ConfigManagerClass: typeof ConfigManager,
  configPath?: string
): ConfigManager {
  try {
    const opts = configPath ? { configPath } : {}
    return ConfigManagerClass.initialize(opts)
  } catch (error) {
    logger.warn('Could not load config file, using defaults')
    return ConfigManagerClass.initialize({})
  }
}

/**
 * Handle CLI errors with debug mode support
 */
export function handleCliError(message: string, error?: unknown, debug?: boolean): void {
  if (error instanceof Error) {
    logger.error(message, error)

    if (debug && error.stack) {
      logger.log(chalk.gray('\nStack trace:'))
      logger.log(chalk.gray(error.stack))
    }
  } else if (error) {
    logger.error(message, undefined, { error: String(error) })
  } else {
    logger.error(message)
  }
}

/**
 * Parse tags from comma-separated string
 */
export function parseTags(tagsString: string): string[] {
  if (!tagsString || tagsString.trim() === '') {
    return []
  }
  return tagsString
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

/**
 * Parse and validate difficulty level
 */
export function parseDifficulty(difficulty?: string): 'Easy' | 'Medium' | 'Hard' | undefined {
  if (!difficulty) return undefined

  const normalized = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase()

  if (normalized === 'Easy' || normalized === 'Medium' || normalized === 'Hard') {
    return normalized as 'Easy' | 'Medium' | 'Hard'
  }

  throw new ValidationError('VAL_INVALID_INPUT', `Invalid difficulty: ${difficulty}. Must be Easy, Medium, or Hard.`)
}

/**
 * Parse and validate number option
 */
export function parseNumber(value: string, optionName: string, min?: number, max?: number): number {
  const parsed = parseInt(value, 10)

  if (isNaN(parsed)) {
    throw new ValidationError('VAL_INVALID_INPUT', `${optionName} must be a valid number, got: ${value}`)
  }

  if (min !== undefined && parsed < min) {
    throw new ValidationError('VAL_INVALID_INPUT', `${optionName} must be at least ${min}, got: ${parsed}`)
  }

  if (max !== undefined && parsed > max) {
    throw new ValidationError('VAL_INVALID_INPUT', `${optionName} must be at most ${max}, got: ${parsed}`)
  }

  return parsed
}

/**
 * Validate output format
 */
export function validateFormat(format: string): 'markdown' | 'obsidian' {
  if (format === 'markdown' || format === 'obsidian') {
    return format
  }
  throw new ValidationError('VAL_INVALID_INPUT', `Invalid format: ${format}. Must be 'markdown' or 'obsidian'.`)
}

/**
 * Validate sort order
 */
export function validateSortOrder(sort: string): 'hot' | 'most-votes' | 'recent' {
  if (sort === 'hot' || sort === 'most-votes' || sort === 'recent') {
    return sort
  }
  throw new ValidationError('VAL_INVALID_INPUT', `Invalid sort order: ${sort}. Must be 'hot', 'most-votes', or 'recent'.`)
}

/**
 * Format success message
 */
export function formatSuccessMessage(filePath: string, itemType: string = 'Content'): string {
  return `${itemType} scraped successfully!\n   ${chalk.green('Saved to:')} ${filePath}`
}

/**
 * Format error message
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

/**
 * Validate problem slug format
 */
export function validateProblemSlug(slug: string): string {
  const trimmed = slug.trim()

  if (trimmed.length === 0) {
    throw new ValidationError('VAL_INVALID_INPUT', 'Problem slug cannot be empty')
  }

  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    throw new ValidationError(
      'VAL_INVALID_INPUT',
      `Invalid problem slug format: ${slug}. Should be lowercase with hyphens (e.g., "two-sum")`
    )
  }

  return trimmed
}
