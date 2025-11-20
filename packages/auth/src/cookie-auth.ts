import { readFile, writeFile } from 'fs/promises'


import type { AuthStrategy, AuthCredentials, Cookie } from '@/shared/types/src/index.js'
import { AuthError } from '@/shared/types/src/index.js'
import { ConfigError } from '@lesca/error'

/**
 * Cookie file format
 */
interface CookieFile {
  cookies: Array<{
    name: string
    value: string
    domain: string
    path?: string
    expires?: number
    httpOnly?: boolean
    secure?: boolean
  }>
  csrfToken?: string
  savedAt?: string
}

/**
 * Cookie-based authentication strategy
 * Loads authentication from a JSON file containing cookies
 *
 * The cookie file should contain:
 * - LEETCODE_SESSION: Main session cookie
 * - csrftoken: CSRF protection token
 * - Other cookies as needed (cf_clearance, etc.)
 */
export class CookieFileAuth implements AuthStrategy {
  readonly name = 'cookie-file'
  private credentials?: AuthCredentials

  constructor(private cookiePath?: string) {}

  /**
   * Authenticate by loading cookies from file
   */
  async authenticate(): Promise<AuthCredentials> {
    if (!this.cookiePath) {
      throw new AuthError('Cookie file path not provided')
    }

    await this.load(this.cookiePath)

    if (!this.credentials) {
      throw new AuthError('Failed to load credentials from cookie file')
    }

    return this.credentials
  }

  /**
   * Refresh credentials (reload from file)
   */
  async refresh(): Promise<void> {
    if (!this.cookiePath) {
      throw new AuthError('Cookie file path not provided')
    }

    await this.load(this.cookiePath)
  }

  /**
   * Check if credentials are valid
   * Basic validation - checks for required cookies
   */
  isValid(): Promise<boolean> {
    if (!this.credentials) {
      return Promise.resolve(false)
    }

    const hasSessionCookie = this.credentials.cookies.some(
      (c) => c.name === 'LEETCODE_SESSION' || c.name === 'leetcode_session'
    )

    if (!hasSessionCookie) {
      return Promise.resolve(false)
    }

    const now = Date.now()
    const allValid = this.credentials.cookies.every((cookie) => {
      if (!cookie.expires) {
        return true
      }
      return cookie.expires > now
    })

    return Promise.resolve(allValid)
  }

  /**
   * Save credentials to file
   */
  async save(path: string): Promise<void> {
    if (!this.credentials) {
      throw new AuthError('No credentials to save')
    }

    const data: CookieFile = {
      cookies: this.credentials.cookies,
      csrfToken: this.credentials.csrfToken,
      savedAt: new Date().toISOString(),
    }

    try {
      await writeFile(path, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
      throw new AuthError(
        `Failed to save cookies to ${path}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Load credentials from file
   */
  async load(path: string): Promise<void> {
    try {
      const content = await readFile(path, 'utf-8')
      const data = JSON.parse(content) as CookieFile

      if (!data.cookies || !Array.isArray(data.cookies)) {
        throw new AuthError('Invalid cookie file format: missing or invalid cookies array')
      }

      let csrfToken = data.csrfToken
      if (!csrfToken) {
        const csrfCookie = data.cookies.find(
          (c) => c.name === 'csrftoken' || c.name === 'csrf_token'
        )
        if (csrfCookie) {
          csrfToken = csrfCookie.value
        }
      }

      this.credentials = {
        cookies: data.cookies.map((cookie) => this.normalizeCookie(cookie)),
        csrfToken: csrfToken || '',
      }

      const isValid = await this.isValid()
      if (!isValid) {
        throw new AuthError('Loaded credentials are invalid or expired')
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }

      throw new AuthError(
        `Failed to load cookies from ${path}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get current credentials
   */
  getCredentials(): AuthCredentials | undefined {
    return this.credentials
  }

  /**
   * Get cookie string for HTTP headers
   */
  getCookieString(): string {
    if (!this.credentials) {
      return ''
    }

    return this.credentials.cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  }

  /**
   * Get CSRF token
   */
  getCsrfToken(): string {
    return this.credentials?.csrfToken || ''
  }

  /**
   * Normalize cookie format
   */
  private normalizeCookie(cookie: CookieFile['cookies'][0]): Cookie {
    const normalized: Cookie = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
    }

    if (cookie.expires !== undefined) {
      normalized.expires = cookie.expires
    }
    if (cookie.httpOnly !== undefined) {
      normalized.httpOnly = cookie.httpOnly
    }
    if (cookie.secure !== undefined) {
      normalized.secure = cookie.secure
    }

    return normalized
  }

  /**
   * Create from environment variables
   * Useful for CI/CD or Docker deployments
   */
  static fromEnvironment(): CookieFileAuth {
    const cookies: Cookie[] = []

    const cookieNames = ['LEETCODE_SESSION', 'csrftoken', 'cf_clearance', 'INGRESSCOOKIE', '__cflb']

    for (const name of cookieNames) {
      const value = process.env[name.toUpperCase()]
      if (value) {
        cookies.push({
          name: name.toLowerCase(),
          value,
          domain: name.includes('cf_') ? '.leetcode.com' : 'leetcode.com',
          path: '/',
        })
      }
    }

    if (cookies.length === 0) {
      throw new AuthError('No authentication cookies found in environment variables')
    }

    const auth = new CookieFileAuth()

        const csrfCookie = cookies.find((c) => c.name === 'csrftoken')
    auth.credentials = {
      cookies,
      csrfToken: csrfCookie?.value || '',
    }

    return auth
  }

  /**
   * Create from raw cookie object
   */
  static fromCookies(cookies: Cookie[], csrfToken?: string): CookieFileAuth {
    const auth = new CookieFileAuth()

    if (!csrfToken) {
      const csrfCookie = cookies.find((c) => c.name === 'csrftoken' || c.name === 'csrf_token')
      csrfToken = csrfCookie?.value
    }

    auth.credentials = {
      cookies,
      csrfToken: csrfToken || '',
    }

    return auth
  }
}

/**
 * Helper function to parse cookies from a cookie string
 * Useful for importing from browser extensions
 */
export function parseCookieString(cookieString: string, domain = 'leetcode.com'): Cookie[] {
  return cookieString
    .split(';')
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const [name, ...valueParts] = pair.split('=')
      const value = valueParts.join('=')

      return {
        name: name?.trim() || '',
        value: value?.trim() || '',
        domain,
        path: '/',
      }
    })
    .filter((cookie) => cookie.name.length > 0)
}

/**
 * Helper function to export cookies to various formats
 */
export function exportCookies(
  credentials: AuthCredentials,
  format: 'json' | 'netscape' = 'json'
): string {
  if (format === 'json') {
    const data: CookieFile = {
      cookies: credentials.cookies,
      csrfToken: credentials.csrfToken,
      savedAt: new Date().toISOString(),
    }
    return JSON.stringify(data, null, 2)
  }

  if (format === 'netscape') {
        const lines = [
      '# Netscape HTTP Cookie File',
      '# This file was generated by Lesca',
      '# Edit at your own risk.',
      '',
    ]

    for (const cookie of credentials.cookies) {
      const line = [
        cookie.domain,
        cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE',
        cookie.path || '/',
        cookie.secure ? 'TRUE' : 'FALSE',
        cookie.expires || '0',
        cookie.name,
        cookie.value,
      ].join('\t')

      lines.push(line)
    }

    return lines.join('\n')
  }

  throw new ConfigError(
    'CONFIG_INVALID_VALUE',
    `Unsupported export format: ${String(format)}`,
    { context: { format: String(format), supportedFormats: ['json', 'netscape'] } }
  )
}
