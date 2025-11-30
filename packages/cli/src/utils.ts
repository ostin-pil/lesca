import { existsSync } from 'fs'
import { dirname } from 'path'

import { logger } from '@lesca/shared/utils'
import chalk from 'chalk'

/**
 * Format error message with actionable guidance
 */
export function formatErrorMessage(error: Error): string {
  const message = error.message

  // File not found errors
  if (message.includes('ENOENT') || message.includes('no such file')) {
    const match = message.match(/['"`]([^'"`]+)['"`]/)
    const filePath = match ? match[1] : 'file'

    if (filePath && filePath.includes('cookies')) {
      return formatCookieFileNotFoundError(filePath)
    }
    if (filePath && filePath.includes('config')) {
      return formatConfigFileNotFoundError(filePath)
    }
    return formatGenericFileNotFoundError(filePath || 'file')
  }

  // Network errors
  if (
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('getaddrinfo')
  ) {
    return formatNetworkError(message)
  }

  // Rate limit errors
  if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
    return formatRateLimitError()
  }

  // Authentication errors
  if (
    message.includes('401') ||
    message.includes('403') ||
    message.toLowerCase().includes('unauthorized') ||
    message.toLowerCase().includes('premium')
  ) {
    return formatAuthenticationError(message)
  }

  // Invalid config errors
  if (
    message.includes('YAML') ||
    message.toLowerCase().includes('config') ||
    message.toLowerCase().includes('invalid')
  ) {
    return formatConfigError(message)
  }

  // Default case
  return message
}

/**
 * Format cookie file not found error
 */
function formatCookieFileNotFoundError(filePath: string): string {
  logger.box('Cookie file not found', {
    variant: 'error',
    message: `We couldn't find your LeetCode cookies at:`,
    filePath,
    steps: [
      '1. Export cookies from your browser (Chrome/Firefox extension recommended)',
      '2. Save them to: ' + filePath,
      '3. Or run: lesca auth --setup',
    ],
    docLink: 'https://github.com/user/lesca/docs/AUTH.md',
  })
  return 'Cookie file not found'
}

/**
 * Format config file not found error
 */
function formatConfigFileNotFoundError(filePath: string): string {
  const fileDir = dirname(filePath)
  const dirExists = existsSync(fileDir)

  logger.box('Configuration file not found', {
    variant: 'error',
    ...(!dirExists && {
      message: `The directory doesn't exist:\\n  ${fileDir}`,
    }),
    steps: ['1. Run: lesca init', `2. Or create config file at: ${filePath}`],
  })
  return 'Configuration file not found'
}

/**
 * Format generic file not found error
 */
function formatGenericFileNotFoundError(filePath: string): string {
  logger.box('File not found', {
    variant: 'error',
    message: 'Missing file:',
    filePath,
    tip: 'Check that: • The path is correct • You have read permissions • The file exists',
  })
  return `File not found: ${filePath}`
}

/**
 * Format network error
 */
function formatNetworkError(message: string): string {
  let errorMessage = 'Failed to connect to LeetCode.'
  if (message.includes('ECONNREFUSED')) {
    errorMessage = 'Connection refused. LeetCode servers may be down.'
  } else if (message.includes('ETIMEDOUT')) {
    errorMessage = 'Connection timed out. Check your internet connection.'
  } else if (message.includes('getaddrinfo')) {
    errorMessage = 'DNS resolution failed. Check your internet connection.'
  }

  logger.box('Network error', {
    variant: 'error',
    message: errorMessage,
    tip: 'Try: • Check your internet connection • Verify leetcode.com is accessible • Try again in a few moments',
  })
  return 'Network error'
}

/**
 * Format rate limit error
 */
function formatRateLimitError(): string {
  logger.box('Rate limit exceeded', {
    variant: 'error',
    message: `You've made too many requests to LeetCode.`,
    tip: 'To fix: • Wait a few minutes • Enable caching in config • Reduce scraping rate\n  Tip: Cached data can speed up scraping by 10-100x!',
  })
  return 'Rate limit exceeded'
}

/**
 * Format authentication error
 */
function formatAuthenticationError(message: string): string {
  const isPremium = message.toLowerCase().includes('premium')

  logger.box('Authentication required', {
    variant: 'error',
    message: isPremium
      ? 'This problem requires LeetCode Premium.'
      : 'Your session cookies may be invalid or expired.',
    steps: isPremium
      ? [
          '1. Subscribe to LeetCode Premium',
          '2. Export your session cookies',
          '3. Run: lesca auth --setup',
        ]
      : [
          '1. Export fresh cookies from your browser',
          '2. Run: lesca auth ----setup',
          `3. Make sure you're logged into LeetCode`,
        ],
  })
  return 'Authentication required'
}

/**
 * Format config error
 */
function formatConfigError(message: string): string {
  logger.box('Configuration error', {
    variant: 'error',
    message: `Your configuration file has an error:\n  ${message}`,
    tip: 'To fix: • Check YAML syntax (proper indentation, no tabs) • Verify paths are valid • Or regenerate: lesca init --force',
  })
  return 'Configuration error'
}

/**
 * Handle CLI errors with enhanced formatting
 */
export function handleCliError(message: string, error?: unknown): void {
  if (error instanceof Error) {
    // Format the error message
    const formattedMessage = formatErrorMessage(error)

    // If formatted message is different from original, we already displayed the enhanced version
    if (formattedMessage !== error.message) {
      // Log basic error for debugging
      logger.error(formattedMessage, undefined, { originalMessage: error.message })
    } else {
      // Fallback to basic error display
      logger.error(message, error)
    }

    // In debug mode, show stack trace
    if (process.argv.includes('--debug') && error.stack) {
      /* eslint-disable no-console */
      console.log(chalk.gray('\\nStack trace:'))
      console.log(chalk.gray(error.stack))
      /* eslint-enable no-console */
    }
  } else if (error) {
    logger.error(message, undefined, { error: String(error) })
  } else {
    logger.error(message)
  }
}
