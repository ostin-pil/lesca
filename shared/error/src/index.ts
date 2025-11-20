/**
 * Error Handling Package for Lesca
 *
 * Provides:
 * - Comprehensive error codes
 * - Type-safe error classes
 * - Error recovery utilities
 */

// Export error codes
export {
  ERROR_CODES,
  getErrorMetadata,
  isRecoverable,
  requiresUserAction,
  isFatal,
  getErrorCodesByCategory,
  getRecoverableErrorCodes,
} from './codes.js'

export type {
  ErrorCode,
  ErrorCategory,
  ErrorRecovery,
  ErrorCodeMetadata,
} from './codes.js'

// Export error classes
export {
  LescaError,
  AuthError,
  NetworkError,
  GraphQLError,
  RateLimitError,
  StorageError,
  BrowserError,
  BrowserTimeoutError,
  ScrapingError,
  ParsingError,
  ValidationError,
  ConversionError,
  ConfigError,
  SystemError,
  isLescaError,
  wrapError,
} from './errors.js'

export type { ErrorContext } from './errors.js'

// Export recovery utilities
export {
  withRetry,
  CircuitBreaker,
  withCircuitBreaker,
  withRetryAndCircuitBreaker,
  withTimeout,
  createRetryableCheck,
} from './recovery.js'

export type {
  RetryOptions,
  CircuitBreakerState,
  CircuitBreakerOptions,
} from './recovery.js'
