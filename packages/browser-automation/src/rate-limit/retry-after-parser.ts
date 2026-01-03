/**
 * Retry-After Header Parser
 *
 * Parses the HTTP Retry-After header according to RFC 7231.
 * Supports both seconds format and HTTP-date format.
 *
 * @module browser-automation/rate-limit/retry-after-parser
 *
 * @see https://tools.ietf.org/html/rfc7231#section-7.1.3
 */

/** Default maximum Retry-After value to honor (2 minutes) */
export const DEFAULT_MAX_RETRY_AFTER_MS = 120000

/**
 * Parse a Retry-After header value to milliseconds.
 *
 * Supports two formats per RFC 7231:
 * - Seconds: "120" -> 120000ms
 * - HTTP-date: "Wed, 21 Oct 2015 07:28:00 GMT" -> (targetTime - now)ms
 *
 * @example
 * ```typescript
 * // Seconds format
 * parseRetryAfter('120') // 120000
 *
 * // HTTP-date format (future date)
 * parseRetryAfter('Wed, 21 Oct 2099 07:28:00 GMT') // milliseconds until that time
 *
 * // With max cap
 * parseRetryAfter('300', 60000) // 60000 (capped)
 *
 * // Invalid values
 * parseRetryAfter(null) // undefined
 * parseRetryAfter('invalid') // undefined
 * ```
 *
 * @param value - Header value (string, number, null, or undefined)
 * @param maxMs - Maximum value to return (caps the result)
 * @returns Delay in milliseconds, or undefined if invalid
 */
export function parseRetryAfter(
  value: string | number | null | undefined,
  maxMs: number = DEFAULT_MAX_RETRY_AFTER_MS
): number | undefined {
  if (value === null || value === undefined) {
    return undefined
  }

  // Handle number input (already in seconds)
  if (typeof value === 'number') {
    if (!isFinite(value) || value < 0) {
      return undefined
    }
    const ms = Math.floor(value * 1000)
    return Math.min(ms, maxMs)
  }

  // Handle string input
  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }

  // Try to parse as seconds (integer)
  const seconds = parseSecondsFormat(trimmed)
  if (seconds !== undefined) {
    const ms = seconds * 1000
    return Math.min(ms, maxMs)
  }

  // Try to parse as HTTP-date
  const dateMs = parseHttpDateFormat(trimmed)
  if (dateMs !== undefined) {
    return Math.min(dateMs, maxMs)
  }

  return undefined
}

/**
 * Parse seconds format (non-negative integer).
 *
 * @param value - String value
 * @returns Seconds as number, or undefined if invalid
 */
function parseSecondsFormat(value: string): number | undefined {
  // Must be a non-negative integer
  if (!/^\d+$/.test(value)) {
    return undefined
  }

  const seconds = parseInt(value, 10)
  if (!isFinite(seconds) || seconds < 0) {
    return undefined
  }

  return seconds
}

/**
 * Parse HTTP-date format.
 *
 * HTTP-date follows RFC 7231, which is a subset of RFC 1123 date format:
 * "Wed, 21 Oct 2015 07:28:00 GMT"
 *
 * @param value - Date string
 * @returns Milliseconds until that time, or undefined if invalid/past
 */
function parseHttpDateFormat(value: string): number | undefined {
  // Date.parse can handle HTTP-date format
  const timestamp = Date.parse(value)

  if (isNaN(timestamp)) {
    return undefined
  }

  const now = Date.now()
  const delayMs = timestamp - now

  // If date is in the past, return undefined
  if (delayMs <= 0) {
    return undefined
  }

  return Math.floor(delayMs)
}

/**
 * Check if a value looks like an HTTP-date.
 *
 * @param value - String to check
 * @returns True if it appears to be an HTTP-date
 */
export function isHttpDate(value: string): boolean {
  // HTTP-date starts with a day name
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const trimmed = value.trim()

  return dayNames.some((day) => trimmed.startsWith(day))
}
