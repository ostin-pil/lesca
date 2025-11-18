/**
 * Sensitive Data Sanitizer
 * Removes or masks sensitive information from logs, errors, and other output
 */

/**
 * Patterns for detecting sensitive data
 */
const SENSITIVE_PATTERNS = {
  // Authentication & Credentials
  cookie: /cookie[s]?[:=]\s*([^\s;,}]+)/gi,
  csrfToken: /csrf[-_]?token[:=]\s*([^\s;,}]+)/gi,
  sessionId: /session[-_]?id[:=]\s*([^\s;,}]+)/gi,
  authorization: /authorization[:=]\s*([^\s;,}]+)/gi,
  bearer: /bearer\s+([^\s;,}]+)/gi,

  // API Keys & Secrets
  apiKey: /api[-_]?key[:=]\s*([^\s;,}]+)/gi,
  secretKey: /secret[-_]?key[:=]\s*([^\s;,}]+)/gi,
  accessToken: /access[-_]?token[:=]\s*([^\s;,}]+)/gi,
  refreshToken: /refresh[-_]?token[:=]\s*([^\s;,}]+)/gi,

  // Passwords
  password: /password[:=]\s*([^\s;,}]+)/gi,
  passwd: /passwd[:=]\s*([^\s;,}]+)/gi,
  pwd: /pwd[:=]\s*([^\s;,}]+)/gi,

  // Personal Information
  email: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-Z.-]+\.[a-zA-Z]{2,})/g,
  phone: /(\+?1?\d{9,15})/g,

  // Credit Cards
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,

  // URLs with credentials
  urlCredentials: /(https?:\/\/)([^:]+):([^@]+)@/gi,
}

/**
 * Keys in objects that should be masked
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'cookie',
  'cookies',
  'authorization',
  'auth',
  'csrftoken',
  'csrf_token',
  'sessionid',
  'session_id',
  'creditcard',
  'credit_card',
  'ssn',
  'social_security',
])

/**
 * Sanitization options
 */
export interface SanitizerOptions {
  /**
   * Replacement text for masked values
   * @default '[REDACTED]'
   */
  mask?: string

  /**
   * Preserve first N and last N characters of masked values
   * @default 0
   */
  preserveLength?: number

  /**
   * Additional patterns to detect and mask
   */
  customPatterns?: RegExp[]

  /**
   * Additional object keys to mask
   */
  customKeys?: string[]
}

/**
 * Default sanitizer options
 */
const DEFAULT_OPTIONS: Required<SanitizerOptions> = {
  mask: '[REDACTED]',
  preserveLength: 0,
  customPatterns: [],
  customKeys: [],
}

/**
 * Sanitize a string by masking sensitive data
 */
export function sanitizeString(input: string, options: SanitizerOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let sanitized = input

  // Apply built-in patterns
  for (const [name, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    if (name === 'urlCredentials') {
      // Special handling for URL credentials
      sanitized = sanitized.replace(pattern, '$1[REDACTED]:[REDACTED]@')
    } else if (name === 'email' || name === 'phone' || name === 'creditCard') {
      // Mask entire value for PII
      sanitized = sanitized.replace(pattern, opts.mask)
    } else {
      // Mask the captured group (value after key)
      sanitized = sanitized.replace(pattern, (match: string, value: string) => {
        const masked = maskValue(value, opts)
        return match.replace(value, masked)
      })
    }
  }

  // Apply custom patterns
  for (const pattern of opts.customPatterns) {
    sanitized = sanitized.replace(pattern, opts.mask)
  }

  return sanitized
}

/**
 * Sanitize an object by masking sensitive keys
 */
export function sanitizeObject<T>(input: T, options: SanitizerOptions = {}): T {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const sensitiveKeys = new Set([...SENSITIVE_KEYS, ...opts.customKeys.map(k => k.toLowerCase())])

  function sanitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value
    }

    if (typeof value === 'string') {
      return sanitizeString(value, opts)
    }

    if (Array.isArray(value)) {
      return value.map(item => sanitizeValue(item))
    }

    if (typeof value === 'object') {
      const sanitized: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(value)) {
        const lowerKey = key.toLowerCase()
        const isSensitive = sensitiveKeys.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('token')

        if (isSensitive && typeof val === 'string') {
          sanitized[key] = maskValue(val, opts)
        } else {
          sanitized[key] = sanitizeValue(val)
        }
      }
      return sanitized
    }

    return value
  }

  return sanitizeValue(input) as T
}

/**
 * Mask a value while optionally preserving some characters
 */
function maskValue(value: string, options: Required<SanitizerOptions>): string {
  if (options.preserveLength === 0) {
    return options.mask
  }

  const len = value.length
  const preserve = Math.min(options.preserveLength, Math.floor(len / 4))

  if (len <= preserve * 2) {
    return options.mask
  }

  const start = value.substring(0, preserve)
  const end = value.substring(len - preserve)
  const middle = options.mask

  return `${start}${middle}${end}`
}

/**
 * Sanitize Error objects
 */
export function sanitizeError(error: Error, options: SanitizerOptions = {}): Error {
  const sanitized = new Error(sanitizeString(error.message, options))
  sanitized.name = error.name

  if (error.stack !== undefined) {
    sanitized.stack = sanitizeString(error.stack, options)
  }

  // Sanitize additional properties
  for (const [key, value] of Object.entries(error)) {
    if (key !== 'message' && key !== 'stack' && key !== 'name') {
      ;(sanitized as unknown as Record<string, unknown>)[key] = sanitizeObject(value, options)
    }
  }

  return sanitized
}

/**
 * Create a sanitizer function with specific options
 */
export function createSanitizer(options: SanitizerOptions = {}) {
  return {
    string: (input: string) => sanitizeString(input, options),
    object: <T>(input: T) => sanitizeObject(input, options),
    error: (error: Error) => sanitizeError(error, options),
  }
}

/**
 * Quick check if a string contains sensitive data
 */
export function containsSensitiveData(input: string): boolean {
  for (const pattern of Object.values(SENSITIVE_PATTERNS)) {
    if (pattern.test(input)) {
      return true
    }
  }
  return false
}

/**
 * Extract sensitive keys from an object (for auditing)
 */
export function findSensitiveKeys(obj: Record<string, unknown>): string[] {
  const found: string[] = []

  function traverse(current: unknown, path: string[] = []): void {
    if (current === null || current === undefined) {
      return
    }

    if (typeof current === 'object' && !Array.isArray(current)) {
      for (const [key, value] of Object.entries(current)) {
        const lowerKey = key.toLowerCase()
        const currentPath = [...path, key]

        if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('token')) {
          found.push(currentPath.join('.'))
        }

        traverse(value, currentPath)
      }
    } else if (Array.isArray(current)) {
      current.forEach((item, index) => {
        traverse(item, [...path, `[${index}]`])
      })
    }
  }

  traverse(obj)
  return found
}
