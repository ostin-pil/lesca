/**
 * Error Codes for Lesca
 *
 * All error codes are documented here with:
 * - Code: Unique identifier
 * - Category: Error category
 * - Recoverable: Whether the error can be recovered from
 * - Description: What the error means
 * - Common Causes: Why this error occurs
 * - Resolution: How to fix it
 */

/**
 * Error recovery classification
 */
export type ErrorRecovery = 'recoverable' | 'fatal' | 'user-action'

/**
 * Error category
 */
export type ErrorCategory =
  | 'authentication'
  | 'network'
  | 'validation'
  | 'storage'
  | 'browser'
  | 'scraping'
  | 'parsing'
  | 'configuration'
  | 'conversion'
  | 'system'

/**
 * Error code metadata
 */
export interface ErrorCodeMetadata {
  code: string
  category: ErrorCategory
  recovery: ErrorRecovery
  description: string
  commonCauses: readonly string[]
  resolution: readonly string[]
  statusCode?: number
}

/**
 * All error codes used in Lesca
 */
export const ERROR_CODES = {
  // ============================================================================
  // Authentication Errors (AUTH_*)
  // ============================================================================
  AUTH_INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    category: 'authentication' as ErrorCategory,
    recovery: 'user-action' as ErrorRecovery,
    description: 'Invalid authentication credentials provided',
    commonCauses: [
      'Expired or invalid cookies',
      'Missing CSRF token',
      'Session expired',
      'Incorrect cookie file format',
    ],
    resolution: [
      'Re-authenticate using browser login',
      'Update cookie file with fresh credentials',
      'Check cookie file format and permissions',
    ],
    statusCode: 401,
  },

  AUTH_COOKIES_NOT_FOUND: {
    code: 'AUTH_COOKIES_NOT_FOUND',
    category: 'authentication' as ErrorCategory,
    recovery: 'user-action' as ErrorRecovery,
    description: 'Cookie file not found or empty',
    commonCauses: [
      'Cookie file path does not exist',
      'Cookie file is empty',
      'Incorrect path configuration',
    ],
    resolution: [
      'Create cookie file by logging in via browser',
      'Check auth.cookiePath in configuration',
      'Verify file permissions',
    ],
    statusCode: 401,
  },

  AUTH_SESSION_EXPIRED: {
    code: 'AUTH_SESSION_EXPIRED',
    category: 'authentication' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Authentication session has expired',
    commonCauses: ['Session timeout', 'Server-side session invalidation'],
    resolution: [
      'Enable auto-refresh in configuration',
      'Re-authenticate manually',
      'Check sessionTimeout setting',
    ],
    statusCode: 401,
  },

  AUTH_PREMIUM_REQUIRED: {
    code: 'AUTH_PREMIUM_REQUIRED',
    category: 'authentication' as ErrorCategory,
    recovery: 'user-action' as ErrorRecovery,
    description: 'Premium/paid subscription required for this content',
    commonCauses: [
      'Attempting to access premium problem',
      'Attempting to access premium editorial',
      'Free account limitations',
    ],
    resolution: [
      'Upgrade to premium account',
      'Skip premium content',
      'Filter out premium problems',
    ],
    statusCode: 403,
  },

  // ============================================================================
  // Network Errors (NET_*)
  // ============================================================================
  NET_CONNECTION_FAILED: {
    code: 'NET_CONNECTION_FAILED',
    category: 'network' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Failed to connect to LeetCode servers',
    commonCauses: [
      'No internet connection',
      'DNS resolution failure',
      'Firewall blocking connection',
      'LeetCode servers down',
    ],
    resolution: [
      'Check internet connection',
      'Verify DNS settings',
      'Check firewall rules',
      'Try again later if servers are down',
    ],
    statusCode: 503,
  },

  NET_TIMEOUT: {
    code: 'NET_TIMEOUT',
    category: 'network' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Request timed out',
    commonCauses: [
      'Slow internet connection',
      'Server taking too long to respond',
      'Timeout configuration too low',
    ],
    resolution: ['Increase timeout in configuration', 'Check network speed', 'Try again later'],
    statusCode: 504,
  },

  NET_RATE_LIMITED: {
    code: 'NET_RATE_LIMITED',
    category: 'network' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Rate limit exceeded',
    commonCauses: [
      'Too many requests in short time',
      'Rate limiter not configured properly',
      'Server-side rate limiting',
    ],
    resolution: [
      'Wait before retrying',
      'Increase delay between requests',
      'Enable rate limiter backoff',
    ],
    statusCode: 429,
  },

  // ============================================================================
  // GraphQL/API Errors (GQL_*)
  // ============================================================================
  GQL_QUERY_FAILED: {
    code: 'GQL_QUERY_FAILED',
    category: 'network' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'GraphQL query execution failed',
    commonCauses: [
      'Invalid GraphQL query',
      'Server-side error',
      'Missing required variables',
      'Authentication required',
    ],
    resolution: [
      'Check GraphQL query syntax',
      'Verify authentication',
      'Check query variables',
      'Report if persistent',
    ],
    statusCode: 500,
  },

  GQL_INVALID_RESPONSE: {
    code: 'GQL_INVALID_RESPONSE',
    category: 'parsing' as ErrorCategory,
    recovery: 'fatal' as ErrorRecovery,
    description: 'Invalid or unexpected GraphQL response format',
    commonCauses: ['API schema changed', 'Response format changed', 'Malformed JSON'],
    resolution: [
      'Check for LeetCode API updates',
      'Update Lesca to latest version',
      'Report issue with response data',
    ],
  },

  // ============================================================================
  // Storage Errors (STORAGE_*)
  // ============================================================================
  STORAGE_WRITE_FAILED: {
    code: 'STORAGE_WRITE_FAILED',
    category: 'storage' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Failed to write data to storage',
    commonCauses: [
      'Insufficient disk space',
      'Permission denied',
      'Directory does not exist',
      'Disk read-only',
    ],
    resolution: [
      'Free up disk space',
      'Check file/directory permissions',
      'Verify storage path exists',
      'Check disk is writable',
    ],
  },

  STORAGE_READ_FAILED: {
    code: 'STORAGE_READ_FAILED',
    category: 'storage' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Failed to read data from storage',
    commonCauses: [
      'File does not exist',
      'Permission denied',
      'Corrupted file',
      'Invalid file format',
    ],
    resolution: ['Verify file exists', 'Check file permissions', 'Re-scrape if file corrupted'],
  },

  STORAGE_INVALID_PATH: {
    code: 'STORAGE_INVALID_PATH',
    category: 'storage' as ErrorCategory,
    recovery: 'user-action' as ErrorRecovery,
    description: 'Invalid storage path specified',
    commonCauses: [
      'Path contains invalid characters',
      'Path is outside allowed directories',
      'Relative path used where absolute required',
    ],
    resolution: ['Use valid path format', 'Check path configuration', 'Use absolute paths'],
  },

  // ============================================================================
  // Browser Automation Errors (BROWSER_*)
  // ============================================================================
  BROWSER_LAUNCH_FAILED: {
    code: 'BROWSER_LAUNCH_FAILED',
    category: 'browser' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Failed to launch browser',
    commonCauses: [
      'Playwright not installed',
      'Browser binaries missing',
      'Insufficient system resources',
      'Incompatible browser version',
    ],
    resolution: [
      'Run: npx playwright install',
      'Install required dependencies',
      'Check system resources',
      'Update Playwright version',
    ],
  },

  BROWSER_NAVIGATION_FAILED: {
    code: 'BROWSER_NAVIGATION_FAILED',
    category: 'browser' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Failed to navigate to URL',
    commonCauses: [
      'Invalid URL',
      'Page not found (404)',
      'Network error during navigation',
      'Page load timeout',
    ],
    resolution: [
      'Verify URL is correct',
      'Check network connection',
      'Increase navigation timeout',
      'Try again later',
    ],
  },

  BROWSER_TIMEOUT: {
    code: 'BROWSER_TIMEOUT',
    category: 'browser' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Browser operation timed out',
    commonCauses: [
      'Page took too long to load',
      'Selector not found within timeout',
      'Script execution timed out',
    ],
    resolution: ['Increase timeout duration', 'Check network speed', 'Verify page structure'],
  },

  BROWSER_SELECTOR_NOT_FOUND: {
    code: 'BROWSER_SELECTOR_NOT_FOUND',
    category: 'browser' as ErrorCategory,
    recovery: 'fatal' as ErrorRecovery,
    description: 'CSS selector not found on page',
    commonCauses: [
      'Page structure changed',
      'Selector outdated',
      'Page not fully loaded',
      'Content behind login/paywall',
    ],
    resolution: [
      'Update Lesca to latest version',
      'Report selector issue',
      'Check if login required',
      'Verify page loaded completely',
    ],
  },

  BROWSER_CRASH: {
    code: 'BROWSER_CRASH',
    category: 'browser' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Browser process crashed',
    commonCauses: ['Out of memory', 'Browser bug', 'System resources exhausted'],
    resolution: [
      'Restart scraping',
      'Reduce concurrent operations',
      'Increase system resources',
      'Update browser binaries',
    ],
  },

  BROWSER_POOL_EXHAUSTED: {
    code: 'BROWSER_POOL_EXHAUSTED',
    category: 'browser' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Browser pool exhausted - no browsers available',
    commonCauses: [
      'Too many concurrent operations',
      'Pool size too small',
      'Browsers not being released',
      'Long-running operations blocking pool',
    ],
    resolution: [
      'Wait and retry',
      'Increase pool maxSize',
      'Reduce concurrent operations',
      'Check for browser leaks',
    ],
  },

  BROWSER_POOL_CONFIG_INVALID: {
    code: 'BROWSER_POOL_CONFIG_INVALID',
    category: 'browser' as ErrorCategory,
    recovery: 'fatal' as ErrorRecovery,
    description: 'Invalid browser pool configuration',
    commonCauses: ['minSize greater than maxSize', 'Negative timeout values', 'Invalid pool size'],
    resolution: [
      'Check pool configuration values',
      'Ensure minSize <= maxSize',
      'Use positive timeout values',
    ],
  },

  BROWSER_CIRCUIT_OPEN: {
    code: 'BROWSER_CIRCUIT_OPEN',
    category: 'browser' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Circuit breaker open - browser launches temporarily disabled',
    commonCauses: [
      'Too many consecutive browser launch failures',
      'System resources exhausted',
      'Browser installation issues',
    ],
    resolution: [
      'Wait for circuit to reset',
      'Check system resources',
      'Verify browser installation',
      'Run: npx playwright install',
    ],
  },

  BROWSER_SESSION_CORRUPTED: {
    code: 'BROWSER_SESSION_CORRUPTED',
    category: 'browser' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Browser session data is corrupted',
    commonCauses: ['Incomplete session save', 'File system error', 'Manual file modification'],
    resolution: [
      'Delete corrupted session file',
      'Re-authenticate to create new session',
      'Check backup files (.bak)',
    ],
  },

  BROWSER_SESSION_NOT_FOUND: {
    code: 'BROWSER_SESSION_NOT_FOUND',
    category: 'browser' as ErrorCategory,
    recovery: 'user-action' as ErrorRecovery,
    description: 'Browser session not found',
    commonCauses: ['Session was deleted', 'Session never created', 'Wrong session name'],
    resolution: [
      'Create a new session with lesca session create',
      'List available sessions with lesca session list',
      'Check session name spelling',
    ],
    statusCode: 404,
  },

  BROWSER_SESSION_EXPIRED: {
    code: 'BROWSER_SESSION_EXPIRED',
    category: 'browser' as ErrorCategory,
    recovery: 'user-action' as ErrorRecovery,
    description: 'Browser session has expired',
    commonCauses: ['Session age exceeded TTL', 'Authentication token expired'],
    resolution: ['Re-authenticate to create new session', 'Delete expired session and recreate'],
  },

  // ============================================================================
  // Scraping Errors (SCRAPE_*)
  // ============================================================================
  SCRAPE_PROBLEM_NOT_FOUND: {
    code: 'SCRAPE_PROBLEM_NOT_FOUND',
    category: 'scraping' as ErrorCategory,
    recovery: 'user-action' as ErrorRecovery,
    description: 'Problem not found on LeetCode',
    commonCauses: ['Invalid problem slug', 'Problem deleted or moved', 'Typo in problem name'],
    resolution: [
      'Verify problem slug is correct',
      'Check LeetCode website',
      'Search for problem by number instead',
    ],
    statusCode: 404,
  },

  SCRAPE_CONTENT_EXTRACTION_FAILED: {
    code: 'SCRAPE_CONTENT_EXTRACTION_FAILED',
    category: 'scraping' as ErrorCategory,
    recovery: 'fatal' as ErrorRecovery,
    description: 'Failed to extract content from page',
    commonCauses: [
      'Page structure changed',
      'Unexpected HTML format',
      'JavaScript-rendered content not loaded',
    ],
    resolution: [
      'Update Lesca to latest version',
      'Report extraction failure',
      'Try browser mode if using API',
    ],
  },

  SCRAPE_NO_STRATEGY: {
    code: 'SCRAPE_NO_STRATEGY',
    category: 'scraping' as ErrorCategory,
    recovery: 'fatal' as ErrorRecovery,
    description: 'No scraper strategy available for request',
    commonCauses: ['Unsupported scrape type', 'Strategy not registered', 'Configuration error'],
    resolution: [
      'Check scrape request type',
      'Verify strategies are registered',
      'Check configuration',
    ],
  },

  SCRAPE_SELECTOR_NOT_FOUND: {
    code: 'SCRAPE_SELECTOR_NOT_FOUND',
    category: 'scraping' as ErrorCategory,
    recovery: 'fatal' as ErrorRecovery,
    description: 'CSS selector not found during scraping',
    commonCauses: [
      'Page structure changed',
      'Selector outdated',
      'Page not fully loaded',
      'Content behind login/paywall',
    ],
    resolution: [
      'Update Lesca to latest version',
      'Report selector issue',
      'Check if login required',
      'Verify page loaded completely',
    ],
  },

  // ============================================================================
  // Parsing Errors (PARSE_*)
  // ============================================================================
  PARSE_HTML_FAILED: {
    code: 'PARSE_HTML_FAILED',
    category: 'parsing' as ErrorCategory,
    recovery: 'fatal' as ErrorRecovery,
    description: 'Failed to parse HTML content',
    commonCauses: ['Malformed HTML', 'Empty response', 'Unexpected content type'],
    resolution: ['Verify HTML source', 'Check for empty responses', 'Report parsing error'],
  },

  PARSE_JSON_FAILED: {
    code: 'PARSE_JSON_FAILED',
    category: 'parsing' as ErrorCategory,
    recovery: 'fatal' as ErrorRecovery,
    description: 'Failed to parse JSON data',
    commonCauses: ['Invalid JSON format', 'Truncated response', 'Wrong content type'],
    resolution: ['Check JSON syntax', 'Verify complete response', 'Check content-type header'],
  },

  PARSE_MARKDOWN_FAILED: {
    code: 'PARSE_MARKDOWN_FAILED',
    category: 'parsing' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Failed to convert HTML to Markdown',
    commonCauses: ['Complex HTML structure', 'Unsupported HTML elements', 'Invalid input'],
    resolution: [
      'Simplify HTML if possible',
      'Report unsupported elements',
      'Use fallback converter',
    ],
  },

  // ============================================================================
  // Validation Errors (VAL_*)
  // ============================================================================
  VAL_INVALID_INPUT: {
    code: 'VAL_INVALID_INPUT',
    category: 'validation' as ErrorCategory,
    recovery: 'user-action' as ErrorRecovery,
    description: 'Invalid input provided',
    commonCauses: [
      'Input does not match expected format',
      'Required field missing',
      'Input out of valid range',
    ],
    resolution: [
      'Check input format',
      'Verify all required fields are provided',
      'Ensure input is within valid range',
    ],
  },

  VAL_SCHEMA_MISMATCH: {
    code: 'VAL_SCHEMA_MISMATCH',
    category: 'validation' as ErrorCategory,
    recovery: 'user-action' as ErrorRecovery,
    description: 'Data does not match expected schema',
    commonCauses: ['Missing required fields', 'Type mismatch', 'Invalid data structure'],
    resolution: [
      'Check data schema',
      'Verify field types',
      'Ensure all required fields are present',
    ],
  },

  // ============================================================================
  // Conversion Errors (CONV_*)
  // ============================================================================
  CONV_INVALID_HTML: {
    code: 'CONV_INVALID_HTML',
    category: 'conversion' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Failed to convert invalid HTML',
    commonCauses: ['Malformed HTML structure', 'Unsupported HTML elements', 'Empty or null input'],
    resolution: [
      'Verify HTML is well-formed',
      'Check for unsupported elements',
      'Ensure input is not empty',
    ],
  },

  CONV_MARKDOWN_FAILED: {
    code: 'CONV_MARKDOWN_FAILED',
    category: 'conversion' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Failed to convert to Markdown',
    commonCauses: [
      'Complex nested structures',
      'Invalid character encoding',
      'Conversion library error',
    ],
    resolution: [
      'Simplify HTML structure',
      'Check character encoding',
      'Try alternative converter',
    ],
  },

  // ============================================================================
  // Configuration Errors (CONFIG_*)
  // ============================================================================
  CONFIG_LOAD_FAILED: {
    code: 'CONFIG_LOAD_FAILED',
    category: 'configuration' as ErrorCategory,
    recovery: 'fatal' as ErrorRecovery,
    description: 'Failed to load configuration',
    commonCauses: ['Config file not found', 'Invalid config format', 'Parse error in config file'],
    resolution: [
      'Create config file',
      'Verify config syntax',
      'Use default config',
      'Check file path',
    ],
  },

  CONFIG_VALIDATION_FAILED: {
    code: 'CONFIG_VALIDATION_FAILED',
    category: 'configuration' as ErrorCategory,
    recovery: 'user-action' as ErrorRecovery,
    description: 'Configuration validation failed',
    commonCauses: ['Invalid configuration value', 'Missing required field', 'Type mismatch'],
    resolution: ['Fix configuration errors', 'Check config schema', 'Use example config'],
  },

  CONFIG_INVALID_VALUE: {
    code: 'CONFIG_INVALID_VALUE',
    category: 'configuration' as ErrorCategory,
    recovery: 'user-action' as ErrorRecovery,
    description: 'Invalid configuration value',
    commonCauses: ['Value out of range', 'Invalid enum value', 'Wrong data type'],
    resolution: ['Use valid value', 'Check documentation', 'See example configs'],
  },

  CONFIG_INVALID: {
    code: 'CONFIG_INVALID',
    category: 'configuration' as ErrorCategory,
    recovery: 'fatal' as ErrorRecovery,
    description: 'Configuration is invalid',
    commonCauses: [
      'Invalid configuration structure',
      'Multiple validation errors',
      'Corrupted configuration file',
    ],
    resolution: [
      'Validate configuration structure',
      'Reset to default configuration',
      'Check configuration file integrity',
    ],
  },

  // ============================================================================
  // System Errors (SYS_*)
  // ============================================================================
  SYS_INITIALIZATION_FAILED: {
    code: 'SYS_INITIALIZATION_FAILED',
    category: 'system' as ErrorCategory,
    recovery: 'fatal' as ErrorRecovery,
    description: 'System initialization failed',
    commonCauses: ['Missing dependencies', 'Corrupted installation', 'Incompatible Node version'],
    resolution: [
      'Reinstall dependencies: npm install',
      'Check Node version >= 18',
      'Verify installation integrity',
    ],
  },

  SYS_OUT_OF_MEMORY: {
    code: 'SYS_OUT_OF_MEMORY',
    category: 'system' as ErrorCategory,
    recovery: 'recoverable' as ErrorRecovery,
    description: 'Insufficient memory',
    commonCauses: ['Too many concurrent operations', 'Large dataset processing', 'Memory leak'],
    resolution: [
      'Reduce batch size',
      'Process fewer items concurrently',
      'Increase Node memory limit',
      'Restart application',
    ],
  },

  SYS_UNKNOWN_ERROR: {
    code: 'SYS_UNKNOWN_ERROR',
    category: 'system' as ErrorCategory,
    recovery: 'fatal' as ErrorRecovery,
    description: 'An unknown error occurred',
    commonCauses: ['Unexpected exception', 'Uncaught error', 'Programming bug'],
    resolution: ['Check error details', 'Report issue with stack trace', 'Try again'],
  },
} as const

/**
 * Type-safe error code keys
 */
export type ErrorCode = keyof typeof ERROR_CODES

/**
 * Get error metadata by code
 */
export function getErrorMetadata(code: ErrorCode): ErrorCodeMetadata {
  return ERROR_CODES[code]
}

/**
 * Check if error is recoverable
 */
export function isRecoverable(code: ErrorCode): boolean {
  return ERROR_CODES[code].recovery === 'recoverable'
}

/**
 * Check if error requires user action
 */
export function requiresUserAction(code: ErrorCode): boolean {
  return ERROR_CODES[code].recovery === 'user-action'
}

/**
 * Check if error is fatal
 */
export function isFatal(code: ErrorCode): boolean {
  return ERROR_CODES[code].recovery === 'fatal'
}

/**
 * Get all error codes by category
 */
export function getErrorCodesByCategory(category: ErrorCategory): ErrorCode[] {
  return Object.keys(ERROR_CODES).filter(
    (code) => ERROR_CODES[code as ErrorCode].category === category
  ) as ErrorCode[]
}

/**
 * Get all recoverable error codes
 */
export function getRecoverableErrorCodes(): ErrorCode[] {
  return Object.keys(ERROR_CODES).filter(
    (code) => ERROR_CODES[code as ErrorCode].recovery === 'recoverable'
  ) as ErrorCode[]
}
