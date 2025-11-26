import { existsSync } from 'fs'
import { dirname } from 'path'

import { logger } from '@/shared/utils/src/index'
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
  /* eslint-disable no-console */
  console.log()
  console.log(chalk.red.bold('✗ Cookie file not found'))
  console.log()
  console.log(chalk.gray(`  We couldn't find your LeetCode cookies at:`))
  console.log(chalk.white(`  ${filePath}`))
  console.log()
  console.log(chalk.cyan.bold('  💡 To fix this:'))
  console.log(
    chalk.white('  1. Export cookies from your browser (Chrome/Firefox extension recommended)')
  )
  console.log(chalk.white('  2. Save them to:'), chalk.cyan(filePath))
  console.log(chalk.white('  3. Or run:'), chalk.cyan('lesca auth --setup'))
  console.log()
  console.log(
    chalk.gray('  📚 Need help?'),
    chalk.blue('https://github.com/user/lesca/docs/AUTH.md')
  )
  console.log()
  /* eslint-enable no-console */
  return 'Cookie file not found'
}

/**
 * Format config file not found error
 */
function formatConfigFileNotFoundError(filePath: string): string {
  /* eslint-disable no-console */
  console.log()
  console.log(chalk.red.bold('✗ Configuration file not found'))
  console.log()
  const fileDir = dirname(filePath)
  const dirExists = existsSync(fileDir)

  if (!dirExists) {
    console.log(chalk.gray(`  The directory doesn't exist:`))
    console.log(chalk.white(`  ${fileDir}`))
    console.log()
  }

  console.log(chalk.cyan.bold('  💡 To fix this:'))
  console.log(chalk.white('  1. Run:'), chalk.cyan('lesca init'))
  console.log(chalk.white('  2. Or create config file at:'), chalk.cyan(filePath))
  console.log()
  /* eslint-enable no-console */
  return 'Configuration file not found'
}

/**
 * Format generic file not found error
 */
function formatGenericFileNotFoundError(filePath: string): string {
  /* eslint-disable no-console */
  console.log()
  console.log(chalk.red.bold('✗ File not found'))
  console.log()
  console.log(chalk.gray('  Missing file:'))
  console.log(chalk.white(`  ${filePath}`))
  console.log()
  console.log(chalk.cyan.bold('  💡 Check that:'))
  console.log(chalk.white('  • The path is correct'))
  console.log(chalk.white('  • You have read permissions'))
  console.log(chalk.white('  • The file exists'))
  console.log()
  /* eslint-enable no-console */
  return `File not found: ${filePath}`
}

/**
 * Format network error
 */
function formatNetworkError(message: string): string {
  /* eslint-disable no-console */
  console.log()
  console.log(chalk.red.bold('✗ Network error'))
  console.log()

  if (message.includes('ECONNREFUSED')) {
    console.log(chalk.gray('  Connection refused. LeetCode servers may be down.'))
  } else if (message.includes('ETIMEDOUT')) {
    console.log(chalk.gray('  Connection timed out. Check your internet connection.'))
  } else if (message.includes('getaddrinfo')) {
    console.log(chalk.gray('  DNS resolution failed. Check your internet connection.'))
  } else {
    console.log(chalk.gray('  Failed to connect to LeetCode.'))
  }

  console.log()
  console.log(chalk.cyan.bold('  💡 Try:'))
  console.log(chalk.white('  • Check your internet connection'))
  console.log(chalk.white('  • Verify leetcode.com is accessible'))
  console.log(chalk.white('  • Try again in a few moments'))
  console.log()
  /* eslint-enable no-console */
  return 'Network error'
}

/**
 * Format rate limit error
 */
function formatRateLimitError(): string {
  /* eslint-disable no-console */
  console.log()
  console.log(chalk.red.bold('✗ Rate limit exceeded'))
  console.log()
  console.log(chalk.gray(`  You've made too many requests to LeetCode.`))
  console.log()
  console.log(chalk.cyan.bold('  💡 To fix this:'))
  console.log(chalk.white('  • Wait a few minutes before trying again'))
  console.log(chalk.white('  • Enable caching in config to reduce API calls'))
  console.log(chalk.white('  • Reduce scraping rate/concurrency'))
  console.log()
  console.log(chalk.gray('  Tip: Cached data can speed up scraping by 10-100x!'))
  console.log()
  /* eslint-enable no-console */
  return 'Rate limit exceeded'
}

/**
 * Format authentication error
 */
function formatAuthenticationError(message: string): string {
  /* eslint-disable no-console */
  console.log()
  console.log(chalk.red.bold('✗ Authentication required'))
  console.log()

  if (message.toLowerCase().includes('premium')) {
    console.log(chalk.gray('  This problem requires LeetCode Premium.'))
    console.log()
    console.log(chalk.cyan.bold('  💡 To access premium content:'))
    console.log(chalk.white('  1. Subscribe to LeetCode Premium'))
    console.log(chalk.white('  2. Export your session cookies'))
    console.log(chalk.white('  3. Run:'), chalk.cyan('lesca auth --setup'))
  } else {
    console.log(chalk.gray('  Your session cookies may be invalid or expired.'))
    console.log()
    console.log(chalk.cyan.bold('  💡 To fix this:'))
    console.log(chalk.white('  1. Export fresh cookies from your browser'))
    console.log(chalk.white('  2. Run:'), chalk.cyan('lesca auth --setup'))
    console.log(chalk.white(`  3. Make sure you're logged into LeetCode`))
  }

  console.log()
  /* eslint-enable no-console */
  return 'Authentication required'
}

/**
 * Format config error
 */
function formatConfigError(message: string): string {
  /* eslint-disable no-console */
  console.log()
  console.log(chalk.red.bold('✗ Configuration error'))
  console.log()
  console.log(chalk.gray('  Your configuration file has an error:'))
  console.log(chalk.white(`  ${message}`))
  console.log()
  console.log(chalk.cyan.bold('  💡 To fix this:'))
  console.log(chalk.white('  • Check YAML syntax (proper indentation, no tabs)'))
  console.log(chalk.white('  • Verify paths are valid and accessible'))
  console.log(chalk.white('  • Or regenerate config:'), chalk.cyan('lesca init --force'))
  console.log()
  /* eslint-enable no-console */
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
