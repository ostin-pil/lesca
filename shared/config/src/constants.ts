/**
 * Environment-based configuration constants
 * These can be overridden via environment variables
 */

/**
 * Default timeout for browser page loads (30 seconds)
 * Can be overridden with LESCA_BROWSER_TIMEOUT env var
 */
export const DEFAULT_BROWSER_TIMEOUT = parseInt(process.env.LESCA_BROWSER_TIMEOUT || '30000', 10)

/**
 * Default timeout for login flow (60 seconds)
 * Can be overridden with LESCA_LOGIN_TIMEOUT env var
 */
export const DEFAULT_LOGIN_TIMEOUT = parseInt(process.env.LESCA_LOGIN_TIMEOUT || '60000', 10)

/**
 * Default user agent for GraphQL requests
 * Can be overridden with LESCA_USER_AGENT env var
 */
export const DEFAULT_USER_AGENT =
  process.env.LESCA_USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Default rate limit minimum delay (100ms)
 * Can be overridden with LESCA_RATE_LIMIT_MIN_DELAY env var
 */
export const DEFAULT_RATE_LIMIT_MIN_DELAY = parseInt(
  process.env.LESCA_RATE_LIMIT_MIN_DELAY || '100',
  10
)

/**
 * Default rate limit maximum delay (500ms)
 * Can be overridden with LESCA_RATE_LIMIT_MAX_DELAY env var
 */
export const DEFAULT_RATE_LIMIT_MAX_DELAY = parseInt(
  process.env.LESCA_RATE_LIMIT_MAX_DELAY || '500',
  10
)

/**
 * Default rate limit jitter (0.3 = 30%)
 * Can be overridden with LESCA_RATE_LIMIT_JITTER env var
 */
export const DEFAULT_RATE_LIMIT_JITTER = parseFloat(process.env.LESCA_RATE_LIMIT_JITTER || '0.3')

/**
 * Validate timeout value
 */
export function validateTimeout(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Invalid ${name}: must be a positive number (got ${value}). ` +
        `Check your environment variables or ScrapeRequest timeout field.`
    )
  }
  if (value > 300000) {
    // 5 minutes
    // eslint-disable-next-line no-console
    console.warn(
      `Warning: ${name} is very high (${value}ms). ` + `This may cause timeouts or hangs.`
    )
  }
}

// Validate constants on module load
if (process.env.LESCA_BROWSER_TIMEOUT) {
  validateTimeout(DEFAULT_BROWSER_TIMEOUT, 'LESCA_BROWSER_TIMEOUT')
}
if (process.env.LESCA_LOGIN_TIMEOUT) {
  validateTimeout(DEFAULT_LOGIN_TIMEOUT, 'LESCA_LOGIN_TIMEOUT')
}
