/**
 * Enhanced Logger Utility
 * Centralized logging with structured output, log levels, and file support
 */

import { appendFileSync, existsSync, statSync, renameSync, unlinkSync, mkdirSync } from 'fs'
import { dirname } from 'path'

import chalk from 'chalk'

import { sanitizeString, sanitizeObject, sanitizeError } from './sanitizer'

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Log level names
 */
export type LogLevelName = 'debug' | 'info' | 'warn' | 'error' | 'silent'

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /**
   * Minimum log level to output
   * @default 'info'
   */
  level?: LogLevelName

  /**
   * Enable console output
   * @default true
   */
  console?: boolean

  /**
   * Enable file output
   * @default false
   */
  file?: boolean

  /**
   * File path for logs
   * @default './lesca.log'
   */
  filePath?: string

  /**
   * Use JSON format for structured logging
   * @default false
   */
  json?: boolean

  /**
   * Enable colors in console output
   * @default true
   */
  colors?: boolean

  /**
   * Include timestamps
   * @default true
   */
  timestamps?: boolean

  /**
   * Maximum file size in bytes before rotation
   * @default 10485760 (10MB)
   */
  maxFileSize?: number

  /**
   * Maximum number of rotated files to keep
   * @default 5
   */
  maxFiles?: number

  /**
   * Automatically sanitize sensitive data from logs
   * @default true
   */
  sanitize?: boolean
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string
  level: LogLevelName
  message: string
  context?: Record<string, unknown>
  correlationId?: string
  error?: {
    name: string
    message: string
    stack: string | undefined
    code: string | undefined
  }
}

/**
 * ANSI color codes
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
}

/**
 * Enhanced Logger class with structured logging
 */
export class Logger {
  private config: Required<LoggerConfig>
  private correlationId: string | undefined

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level ?? 'info',
      console: config.console ?? true,
      file: config.file ?? false,
      filePath: config.filePath ?? './lesca.log',
      json: config.json ?? false,
      colors: config.colors ?? true,
      timestamps: config.timestamps ?? true,
      maxFileSize: config.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles ?? 5,
      sanitize: config.sanitize ?? true,
    }

    // Create log directory if file logging is enabled
    if (this.config.file) {
      this.ensureLogDirectory()
    }
  }

  /**
   * Set logger configuration
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
    if (this.config.file) {
      this.ensureLogDirectory()
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<LoggerConfig> {
    return { ...this.config }
  }

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(id: string): void {
    this.correlationId = id
  }

  /**
   * Clear correlation ID
   */
  clearCorrelationId(): void {
    this.correlationId = undefined
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined {
    return this.correlationId
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.writeLog('debug', message, context)
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.writeLog('info', message, context)
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.writeLog('warn', message, context)
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.writeLog('error', message, context, error)
  }

  /**
   * Simple log (for backwards compatibility)
   */
  log(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log(...args)
  }

  /**
   * Display formatted box (error, warning, info, success)
   * Console-inspired format method for rich CLI output
   */
  box(
    title: string,
    options?: {
      variant?: 'error' | 'warning' | 'info' | 'success'
      message?: string
      filePath?: string
      steps?: string[]
      tip?: string
      docLink?: string
    }
  ): void {
    if (!this.config.console) return

    const variant = options?.variant ?? 'info'
    const icons = { error: '✗', warning: '⚠', info: 'ℹ', success: '✓' }
    const colors = { error: 'red', warning: 'yellow', info: 'blue', success: 'green' }

    /* eslint-disable no-console, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    console.log()
    console.log(chalk[colors[variant]].bold(`${icons[variant]} ${title}`))
    // eslint-disable-next-line no-console
    console.log()

    if (options?.message) {
      // eslint-disable-next-line no-console
      console.log(chalk.gray(`  ${options.message}`))
      // eslint-disable-next-line no-console
      console.log()
    }

    if (options?.filePath) {
      // eslint-disable-next-line no-console
      console.log(chalk.white(`  ${options.filePath}`))
      // eslint-disable-next-line no-console
      console.log()
    }

    if (options?.steps) {
      // eslint-disable-next-line no-console
      console.log(chalk.cyan.bold('  💡 To fix this:'))
      options.steps.forEach((step) => {
        // eslint-disable-next-line no-console
        console.log(chalk.white(`  ${step}`))
      })
      // eslint-disable-next-line no-console
      console.log()
    }

    if (options?.tip) {
      // eslint-disable-next-line no-console
      console.log(chalk.gray(`  ${options.tip}`))
      // eslint-disable-next-line no-console
      console.log()
    }

    if (options?.docLink) {
      console.log(chalk.gray('  📚 Need help?'), chalk.blue(options.docLink))
      console.log()
    }
    /* eslint-enable no-console, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  }

  /**
   * Display numbered steps
   * Console-inspired format method for step-by-step instructions
   */
  steps(title: string, items: string[]): void {
    if (!this.config.console) return

    /* eslint-disable no-console, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    console.log()
    console.log(chalk.cyan.bold(title))
    items.forEach((item, i) => {
      console.log(chalk.white(`  ${i + 1}. ${item}`))
    })
    console.log()
    /* eslint-enable no-console, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  }

  /**
   * Display banner
   * Console-inspired format method for headers/welcome messages
   */
  banner(text: string, style?: 'box' | 'simple'): void {
    if (!this.config.console) return

    /* eslint-disable no-console, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    if (style === 'box') {
      const width = text.length + 4
      console.log()
      console.log(chalk.cyan('┌' + '─'.repeat(width) + '┐'))
      console.log(chalk.cyan('│') + chalk.bold.white(`  ${text}  `) + chalk.cyan('│'))
      console.log(chalk.cyan('└' + '─'.repeat(width) + '┘'))
      console.log()
    } else {
      console.log()
      console.log(chalk.bold.cyan(text))
      console.log()
    }
    /* eslint-enable no-console, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  }

  /**
   * Display success message
   * Console-inspired format method for success feedback
   */
  success(message: string, details?: string): void {
    if (!this.config.console) return

    /* eslint-disable no-console, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    console.log(chalk.green(`✓ ${message}`))
    if (details) {
      console.log(chalk.cyan(`  ${details}`))
    }
    /* eslint-enable no-console, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  }

  /**
   * Core logging method
   */
  private writeLog(
    level: LogLevelName,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    // Check if we should log this level
    if (!this.shouldLog(level)) {
      return
    }

    // Sanitize data if enabled
    const sanitizedMessage = this.config.sanitize ? sanitizeString(message) : message
    const sanitizedContext = this.config.sanitize && context ? sanitizeObject(context) : context
    const sanitizedError = this.config.sanitize && error ? sanitizeError(error) : error

    // Create log entry
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: sanitizedMessage,
      ...(sanitizedContext && { context: sanitizedContext }),
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(sanitizedError && {
        error: {
          name: sanitizedError.name,
          message: sanitizedError.message,
          stack: sanitizedError.stack,
          code: 'code' in sanitizedError ? String(sanitizedError.code) : undefined,
        },
      }),
    }

    // Output to console
    if (this.config.console) {
      this.writeToConsole(entry)
    }

    // Output to file
    if (this.config.file) {
      this.writeToFile(entry)
    }
  }

  /**
   * Check if we should log this level
   */
  private shouldLog(level: LogLevelName): boolean {
    const currentLevel = LogLevel[this.config.level.toUpperCase() as keyof typeof LogLevel]
    const messageLevel = LogLevel[level.toUpperCase() as keyof typeof LogLevel]
    return messageLevel >= currentLevel
  }

  /**
   * Write to console with formatting
   */
  private writeToConsole(entry: LogEntry): void {
    if (this.config.json) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry))
      return
    }

    // Format for human-readable console output
    const parts: string[] = []

    // Timestamp
    if (this.config.timestamps) {
      const timestamp = this.colorize(new Date(entry.timestamp).toLocaleTimeString(), 'gray')
      parts.push(timestamp)
    }

    // Level with color
    const levelStr = `[${entry.level.toUpperCase()}]`.padEnd(7)
    const coloredLevel = this.colorizeLevel(levelStr, entry.level)
    parts.push(coloredLevel)

    // Correlation ID
    if (entry.correlationId) {
      parts.push(this.colorize(`[${entry.correlationId}]`, 'cyan'))
    }

    // Message
    parts.push(entry.message)

    // Output base message
    // eslint-disable-next-line no-console
    console.log(parts.join(' '))

    // Context (if any)
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = this.colorize('  Context:', 'gray')
      // eslint-disable-next-line no-console
      console.log(contextStr, entry.context)
    }

    // Error (if any)
    if (entry.error) {
      const errorHeader = this.colorize('  Error:', 'red')
      // eslint-disable-next-line no-console
      console.log(errorHeader, entry.error.message)
      if (entry.error.stack) {
        const stack = entry.error.stack
          .split('\n')
          .slice(1) // Skip first line (error message)
          .map((line) => this.colorize(`    ${line.trim()}`, 'gray'))
          .join('\n')
        // eslint-disable-next-line no-console
        console.log(stack)
      }
    }
  }

  /**
   * Write to file
   */
  private writeToFile(entry: LogEntry): void {
    // Check if rotation is needed
    this.rotateIfNeeded()

    // Format entry
    const line = this.config.json ? JSON.stringify(entry) + '\n' : this.formatTextLine(entry)

    // Append to file
    try {
      appendFileSync(this.config.filePath, line, 'utf-8')
    } catch (error) {
      // Fallback to console if file write fails
      // eslint-disable-next-line no-console
      console.error('Failed to write to log file:', error)
    }
  }

  /**
   * Format log entry as text line
   */
  private formatTextLine(entry: LogEntry): string {
    const parts: string[] = []

    // Timestamp
    parts.push(entry.timestamp)

    // Level
    parts.push(`[${entry.level.toUpperCase()}]`)

    // Correlation ID
    if (entry.correlationId) {
      parts.push(`[${entry.correlationId}]`)
    }

    // Message
    parts.push(entry.message)

    // Context
    if (entry.context) {
      parts.push(JSON.stringify(entry.context))
    }

    // Error
    if (entry.error) {
      parts.push(`Error: ${entry.error.message}`)
      if (entry.error.stack) {
        parts.push(`\n${entry.error.stack}`)
      }
    }

    return parts.join(' ') + '\n'
  }

  /**
   * Rotate log file if needed
   */
  private rotateIfNeeded(): void {
    if (!existsSync(this.config.filePath)) {
      return
    }

    const stats = statSync(this.config.filePath)
    if (stats.size < this.config.maxFileSize) {
      return
    }

    // Rotate existing files
    for (let i = this.config.maxFiles - 1; i >= 1; i--) {
      const oldPath = `${this.config.filePath}.${i}`
      const newPath = `${this.config.filePath}.${i + 1}`

      if (existsSync(oldPath)) {
        if (i === this.config.maxFiles - 1) {
          // Delete oldest file
          try {
            unlinkSync(oldPath)
          } catch {
            // Ignore errors
          }
        } else {
          // Rename file
          try {
            renameSync(oldPath, newPath)
          } catch {
            // Ignore errors
          }
        }
      }
    }

    // Rotate current file
    try {
      renameSync(this.config.filePath, `${this.config.filePath}.1`)
    } catch {
      // Ignore errors
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    const dir = dirname(this.config.filePath)
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true })
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to create log directory:', error)
      }
    }
  }

  /**
   * Colorize text
   */
  private colorize(text: string, color: keyof typeof colors): string {
    if (!this.config.colors) {
      return text
    }
    return `${colors[color]}${text}${colors.reset}`
  }

  /**
   * Colorize level based on severity
   */
  private colorizeLevel(text: string, level: LogLevelName): string {
    if (!this.config.colors) {
      return text
    }

    const colorMap: Record<LogLevelName, keyof typeof colors> = {
      debug: 'gray',
      info: 'blue',
      warn: 'yellow',
      error: 'red',
      silent: 'gray',
    }

    return this.colorize(text, colorMap[level])
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context)
  }
}

/**
 * Child logger with persistent context
 */
export class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, unknown>
  ) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, { ...this.context, ...context })
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, { ...this.context, ...context })
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(message, { ...this.context, ...context })
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.parent.error(message, error, { ...this.context, ...context })
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger()

/**
 * Create a logger instance with custom config
 */
export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config)
}
