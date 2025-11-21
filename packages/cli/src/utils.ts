import { logger } from '@/shared/utils/src/index'
import chalk from 'chalk'

/**
 * Handle CLI errors with debug mode support
 */
export function handleCliError(message: string, error?: unknown): void {
  if (error instanceof Error) {
    logger.error(message, error)

    // In debug mode, show stack trace
    // We need to access the global program options, but since we are in a utility function
    // and the program instance is in index.ts, we might need a different approach or pass the debug flag.
    // For now, we'll check process.argv or rely on logger configuration which should be set globally.
    if (process.argv.includes('--debug') && error.stack) {
      logger.log(chalk.gray('\nStack trace:'))
      logger.log(chalk.gray(error.stack))
    }
  } else if (error) {
    logger.error(message, undefined, { error: String(error) })
  } else {
    logger.error(message)
  }
}
