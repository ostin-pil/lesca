/**
 * Enhanced Error Classes for Lesca
 *
 * All errors extend LescaError and include:
 * - Error code
 * - Category
 * - Recovery classification
 * - Context data
 * - Original cause
 */

import type { ErrorCode, ErrorCategory, ErrorRecovery } from './codes'
import { getErrorMetadata } from './codes'

export interface ErrorContext {
  [key: string]: unknown
}

export class LescaError extends Error {
  public readonly code: ErrorCode
  public readonly category: ErrorCategory
  public readonly recovery: ErrorRecovery
  public readonly context: ErrorContext
  public readonly statusCode: number | undefined
  public readonly timestamp: Date

  constructor(
    code: ErrorCode,
    message?: string,
    options?: {
      cause?: Error
      context?: ErrorContext
      statusCode?: number
    }
  ) {
    const metadata = getErrorMetadata(code)
    const errorMessage = message || metadata.description

    super(errorMessage, { cause: options?.cause })

    this.name = 'LescaError'
    this.code = code
    this.category = metadata.category
    this.recovery = metadata.recovery
    this.statusCode = options?.statusCode !== undefined ? options.statusCode : metadata.statusCode
    this.context = options?.context ?? {}
    this.timestamp = new Date()

    Error.captureStackTrace(this, this.constructor)
  }

  isRecoverable(): boolean {
    return this.recovery === 'recoverable'
  }

  requiresUserAction(): boolean {
    return this.recovery === 'user-action'
  }

  isFatal(): boolean {
    return this.recovery === 'fatal'
  }

  getResolution(): readonly string[] {
    const metadata = getErrorMetadata(this.code)
    return metadata.resolution
  }

  getCommonCauses(): readonly string[] {
    const metadata = getErrorMetadata(this.code)
    return metadata.commonCauses
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      recovery: this.recovery,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    }
  }

  getUserMessage(): string {
    const resolutions = this.getResolution()
    const resolutionText =
      resolutions.length > 0
        ? `\n\nHow to fix:\n${resolutions.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}`
        : ''

    return `${this.message}${resolutionText}`
  }
}

export class AuthError extends LescaError {
  constructor(
    code: Extract<
      ErrorCode,
      | 'AUTH_INVALID_CREDENTIALS'
      | 'AUTH_COOKIES_NOT_FOUND'
      | 'AUTH_SESSION_EXPIRED'
      | 'AUTH_PREMIUM_REQUIRED'
    >,
    message?: string,
    options?: { cause?: Error; context?: ErrorContext }
  ) {
    super(code, message, { ...options, statusCode: 401 })
    this.name = 'AuthError'
  }
}

export class NetworkError extends LescaError {
  constructor(
    code: Extract<
      ErrorCode,
      'NET_CONNECTION_FAILED' | 'NET_TIMEOUT' | 'NET_RATE_LIMITED'
    >,
    message?: string,
    options?: { cause?: Error; context?: ErrorContext; statusCode?: number }
  ) {
    super(code, message, options)
    this.name = 'NetworkError'
  }
}

export class GraphQLError extends LescaError {
  constructor(
    code: Extract<ErrorCode, 'GQL_QUERY_FAILED' | 'GQL_INVALID_RESPONSE'>,
    message?: string,
    options?: { cause?: Error; context?: ErrorContext; statusCode?: number }
  ) {
    super(code, message, options)
    this.name = 'GraphQLError'
  }
}

export class RateLimitError extends NetworkError {
  public readonly retryAfter: number | undefined

  constructor(
    message?: string,
    options?: { cause?: Error; context?: ErrorContext; retryAfter?: number }
  ) {
    const superOptions: { cause?: Error; context?: ErrorContext; statusCode: number } = {
      statusCode: 429,
    }
    if (options?.cause) superOptions.cause = options.cause
    if (options?.context) superOptions.context = options.context

    super('NET_RATE_LIMITED', message, superOptions)
    this.name = 'RateLimitError'
    this.retryAfter = options?.retryAfter
  }
}

export class StorageError extends LescaError {
  constructor(
    code: Extract<
      ErrorCode,
      'STORAGE_WRITE_FAILED' | 'STORAGE_READ_FAILED' | 'STORAGE_INVALID_PATH'
    >,
    message?: string,
    options?: { cause?: Error; context?: ErrorContext }
  ) {
    super(code, message, options)
    this.name = 'StorageError'
  }
}

export class BrowserError extends LescaError {
  constructor(
    code: Extract<
      ErrorCode,
      | 'BROWSER_LAUNCH_FAILED'
      | 'BROWSER_NAVIGATION_FAILED'
      | 'BROWSER_SELECTOR_NOT_FOUND'
      | 'BROWSER_CRASH'
      | 'BROWSER_TIMEOUT'
    >,
    message?: string,
    options?: { cause?: Error; context?: ErrorContext }
  ) {
    super(code, message, options)
    this.name = 'BrowserError'
  }
}

export class BrowserTimeoutError extends BrowserError {
  constructor(
    message?: string,
    options?: { cause?: Error; context?: ErrorContext }
  ) {
    super('BROWSER_TIMEOUT', message, options)
    this.name = 'BrowserTimeoutError'
  }
}

/**
 * Scraping error
 */
export class ScrapingError extends LescaError {
  constructor(
    code: Extract<
      ErrorCode,
      | 'SCRAPE_PROBLEM_NOT_FOUND'
      | 'SCRAPE_CONTENT_EXTRACTION_FAILED'
      | 'SCRAPE_NO_STRATEGY'
      | 'SCRAPE_SELECTOR_NOT_FOUND'
    >,
    message?: string,
    options?: { cause?: Error; context?: ErrorContext; statusCode?: number }
  ) {
    super(code, message, options)
    this.name = 'ScrapingError'
  }
}

/**
 * Parsing error
 */
export class ParsingError extends LescaError {
  constructor(
    code: Extract<
      ErrorCode,
      'PARSE_HTML_FAILED' | 'PARSE_JSON_FAILED' | 'PARSE_MARKDOWN_FAILED'
    >,
    message?: string,
    options?: { cause?: Error; context?: ErrorContext }
  ) {
    super(code, message, options)
    this.name = 'ParsingError'
  }
}

/**
 * Validation error
 */
export class ValidationError extends LescaError {
  constructor(
    code: Extract<ErrorCode, 'VAL_INVALID_INPUT' | 'VAL_SCHEMA_MISMATCH'>,
    message?: string,
    options?: { cause?: Error; context?: ErrorContext }
  ) {
    super(code, message, options)
    this.name = 'ValidationError'
  }
}

/**
 * Conversion error
 */
export class ConversionError extends LescaError {
  constructor(
    code: Extract<ErrorCode, 'CONV_INVALID_HTML' | 'CONV_MARKDOWN_FAILED'>,
    message?: string,
    options?: { cause?: Error; context?: ErrorContext }
  ) {
    super(code, message, options)
    this.name = 'ConversionError'
  }
}

/**
 * Configuration error
 */
export class ConfigError extends LescaError {
  constructor(
    code: Extract<
      ErrorCode,
      'CONFIG_LOAD_FAILED' | 'CONFIG_VALIDATION_FAILED' | 'CONFIG_INVALID_VALUE' | 'CONFIG_INVALID'
    >,
    message?: string,
    options?: { cause?: Error; context?: ErrorContext }
  ) {
    super(code, message, options)
    this.name = 'ConfigError'
  }
}

/**
 * System error
 */
export class SystemError extends LescaError {
  constructor(
    code: Extract<
      ErrorCode,
      'SYS_INITIALIZATION_FAILED' | 'SYS_OUT_OF_MEMORY' | 'SYS_UNKNOWN_ERROR'
    >,
    message?: string,
    options?: { cause?: Error; context?: ErrorContext }
  ) {
    super(code, message, options)
    this.name = 'SystemError'
  }
}

/**
 * Check if an error is a LescaError
 */
export function isLescaError(error: unknown): error is LescaError {
  return error instanceof LescaError
}

/**
 * Wrap a generic error in a LescaError
 */
export function wrapError(
  error: unknown,
  code: ErrorCode = 'SYS_UNKNOWN_ERROR',
  context?: ErrorContext
): LescaError {
  if (isLescaError(error)) {
    return error
  }

  const cause = error instanceof Error ? error : undefined
  const message = error instanceof Error ? error.message : String(error)

  return new LescaError(code, message, {
    ...(cause && { cause }),
    ...(context && { context }),
  })
}
