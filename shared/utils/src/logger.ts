/**
 * Logger Utility
 * Centralized logging to replace direct console statements
 */

export class Logger {
  info(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log('[INFO]', ...args)
  }

  error(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error('[ERROR]', ...args)
  }

  warn(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.warn('[WARN]', ...args)
  }

  debug(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log('[DEBUG]', ...args)
  }

  log(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

export const logger = new Logger()
