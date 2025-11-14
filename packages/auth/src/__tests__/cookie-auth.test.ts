import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CookieFileAuth, parseCookieString, exportCookies } from '../cookie-auth.js'
import { AuthError } from '../../../../shared/types/src/index.js'
import type { Cookie, AuthCredentials } from '../../../../shared/types/src/index.js'
import { writeFile, readFile, rm, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve } from 'path'

describe('CookieFileAuth', () => {
  const testDir = resolve(__dirname, '__test_auth__')
  const testCookiePath = resolve(testDir, 'cookies.json')

  beforeEach(async () => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true })
    }
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true })
    }

    // Clear environment variables
    delete process.env.LEETCODE_SESSION
    delete process.env.CSRFTOKEN
    delete process.env.CF_CLEARANCE
    delete process.env.INGRESSCOOKIE
    delete process.env.__CFLB

    // Restore mocks
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create instance with cookie path', () => {
      const auth = new CookieFileAuth('/path/to/cookies.json')
      expect(auth.name).toBe('cookie-file')
    })

    it('should create instance without cookie path', () => {
      const auth = new CookieFileAuth()
      expect(auth.name).toBe('cookie-file')
    })
  })

  describe('authenticate', () => {
    it('should load credentials from file', async () => {
      const cookieData = {
        cookies: [
          {
            name: 'LEETCODE_SESSION',
            value: 'test-session-value',
            domain: 'leetcode.com',
            path: '/',
          },
          {
            name: 'csrftoken',
            value: 'test-csrf-value',
            domain: 'leetcode.com',
            path: '/',
          },
        ],
        csrfToken: 'test-csrf-value',
      }

      await writeFile(testCookiePath, JSON.stringify(cookieData), 'utf-8')

      const auth = new CookieFileAuth(testCookiePath)
      const credentials = await auth.authenticate()

      expect(credentials.cookies).toHaveLength(2)
      expect(credentials.csrfToken).toBe('test-csrf-value')
    })

    it('should throw error when no cookie path provided', async () => {
      const auth = new CookieFileAuth()

      await expect(auth.authenticate()).rejects.toThrow(AuthError)
      await expect(auth.authenticate()).rejects.toThrow('Cookie file path not provided')
    })

    it('should throw error when file does not exist', async () => {
      const auth = new CookieFileAuth('/nonexistent/cookies.json')

      await expect(auth.authenticate()).rejects.toThrow(AuthError)
    })
  })

  describe('load and save', () => {
    it('should save and load cookies correctly', async () => {
      const auth = new CookieFileAuth()

      // Create credentials via static method
      const cookies: Cookie[] = [
        {
          name: 'LEETCODE_SESSION',
          value: 'session123',
          domain: 'leetcode.com',
          path: '/',
        },
        {
          name: 'csrftoken',
          value: 'csrf456',
          domain: 'leetcode.com',
          path: '/',
        },
      ]

      const authWithCreds = CookieFileAuth.fromCookies(cookies)
      await authWithCreds.save(testCookiePath)

      // Load from saved file
      await auth.load(testCookiePath)

      const credentials = auth.getCredentials()
      expect(credentials).toBeDefined()
      expect(credentials?.cookies).toHaveLength(2)
      expect(credentials?.csrfToken).toBe('csrf456')
    })

    it('should auto-detect CSRF token from cookies', async () => {
      const cookieData = {
        cookies: [
          {
            name: 'LEETCODE_SESSION',
            value: 'session123',
            domain: 'leetcode.com',
          },
          {
            name: 'csrftoken',
            value: 'auto-detected-csrf',
            domain: 'leetcode.com',
          },
        ],
      }

      await writeFile(testCookiePath, JSON.stringify(cookieData), 'utf-8')

      const auth = new CookieFileAuth(testCookiePath)
      await auth.authenticate()

      expect(auth.getCsrfToken()).toBe('auto-detected-csrf')
    })

    it('should throw error for invalid file format', async () => {
      await writeFile(testCookiePath, 'invalid json', 'utf-8')

      const auth = new CookieFileAuth(testCookiePath)

      await expect(auth.authenticate()).rejects.toThrow(AuthError)
    })

    it('should throw error for missing cookies array', async () => {
      await writeFile(testCookiePath, JSON.stringify({ csrfToken: 'test' }), 'utf-8')

      const auth = new CookieFileAuth(testCookiePath)

      await expect(auth.authenticate()).rejects.toThrow(AuthError)
      await expect(auth.authenticate()).rejects.toThrow('missing or invalid cookies array')
    })

    it('should throw error when no credentials to save', async () => {
      const auth = new CookieFileAuth()

      await expect(auth.save(testCookiePath)).rejects.toThrow(AuthError)
      await expect(auth.save(testCookiePath)).rejects.toThrow('No credentials to save')
    })

    it('should include savedAt timestamp when saving', async () => {
      const cookies: Cookie[] = [
        {
          name: 'LEETCODE_SESSION',
          value: 'test',
          domain: 'leetcode.com',
          path: '/',
        },
      ]

      const auth = CookieFileAuth.fromCookies(cookies)
      await auth.save(testCookiePath)

      const content = await readFile(testCookiePath, 'utf-8')
      const data = JSON.parse(content)

      expect(data.savedAt).toBeDefined()
      expect(typeof data.savedAt).toBe('string')
    })
  })

  describe('isValid', () => {
    it('should return false when no credentials', async () => {
      const auth = new CookieFileAuth()

      const isValid = await auth.isValid()

      expect(isValid).toBe(false)
    })

    it('should return false when missing session cookie', async () => {
      const cookies: Cookie[] = [
        {
          name: 'other-cookie',
          value: 'test',
          domain: 'leetcode.com',
          path: '/',
        },
      ]

      const auth = CookieFileAuth.fromCookies(cookies)
      const isValid = await auth.isValid()

      expect(isValid).toBe(false)
    })

    it('should return true with valid session cookie', async () => {
      const cookies: Cookie[] = [
        {
          name: 'LEETCODE_SESSION',
          value: 'valid-session',
          domain: 'leetcode.com',
          path: '/',
        },
      ]

      const auth = CookieFileAuth.fromCookies(cookies)
      const isValid = await auth.isValid()

      expect(isValid).toBe(true)
    })

    it('should accept lowercase leetcode_session', async () => {
      const cookies: Cookie[] = [
        {
          name: 'leetcode_session',
          value: 'valid-session',
          domain: 'leetcode.com',
          path: '/',
        },
      ]

      const auth = CookieFileAuth.fromCookies(cookies)
      const isValid = await auth.isValid()

      expect(isValid).toBe(true)
    })

    it('should return false when cookies are expired', async () => {
      const cookies: Cookie[] = [
        {
          name: 'LEETCODE_SESSION',
          value: 'expired-session',
          domain: 'leetcode.com',
          path: '/',
          expires: Date.now() - 1000, // Expired 1 second ago
        },
      ]

      const auth = CookieFileAuth.fromCookies(cookies)
      const isValid = await auth.isValid()

      expect(isValid).toBe(false)
    })

    it('should return true when cookies have no expiry', async () => {
      const cookies: Cookie[] = [
        {
          name: 'LEETCODE_SESSION',
          value: 'session-no-expiry',
          domain: 'leetcode.com',
          path: '/',
        },
      ]

      const auth = CookieFileAuth.fromCookies(cookies)
      const isValid = await auth.isValid()

      expect(isValid).toBe(true)
    })

    it('should return true when all cookies are not expired', async () => {
      const cookies: Cookie[] = [
        {
          name: 'LEETCODE_SESSION',
          value: 'session',
          domain: 'leetcode.com',
          path: '/',
          expires: Date.now() + 10000, // Expires in 10 seconds
        },
        {
          name: 'csrftoken',
          value: 'csrf',
          domain: 'leetcode.com',
          path: '/',
          expires: Date.now() + 10000,
        },
      ]

      const auth = CookieFileAuth.fromCookies(cookies)
      const isValid = await auth.isValid()

      expect(isValid).toBe(true)
    })
  })

  describe('refresh', () => {
    it('should reload credentials from file', async () => {
      const initialData = {
        cookies: [
          {
            name: 'LEETCODE_SESSION',
            value: 'initial-session',
            domain: 'leetcode.com',
          },
        ],
        csrfToken: 'initial-csrf',
      }

      await writeFile(testCookiePath, JSON.stringify(initialData), 'utf-8')

      const auth = new CookieFileAuth(testCookiePath)
      await auth.authenticate()

      expect(auth.getCsrfToken()).toBe('initial-csrf')

      // Update the file
      const updatedData = {
        cookies: [
          {
            name: 'LEETCODE_SESSION',
            value: 'updated-session',
            domain: 'leetcode.com',
          },
        ],
        csrfToken: 'updated-csrf',
      }

      await writeFile(testCookiePath, JSON.stringify(updatedData), 'utf-8')

      // Refresh should load new data
      await auth.refresh()

      expect(auth.getCsrfToken()).toBe('updated-csrf')
    })

    it('should throw error when no cookie path provided', async () => {
      const auth = new CookieFileAuth()

      await expect(auth.refresh()).rejects.toThrow(AuthError)
      await expect(auth.refresh()).rejects.toThrow('Cookie file path not provided')
    })
  })

  describe('getCookieString', () => {
    it('should format cookies for HTTP header', () => {
      const cookies: Cookie[] = [
        {
          name: 'LEETCODE_SESSION',
          value: 'session123',
          domain: 'leetcode.com',
          path: '/',
        },
        {
          name: 'csrftoken',
          value: 'csrf456',
          domain: 'leetcode.com',
          path: '/',
        },
      ]

      const auth = CookieFileAuth.fromCookies(cookies)
      const cookieString = auth.getCookieString()

      expect(cookieString).toBe('LEETCODE_SESSION=session123; csrftoken=csrf456')
    })

    it('should return empty string when no credentials', () => {
      const auth = new CookieFileAuth()
      const cookieString = auth.getCookieString()

      expect(cookieString).toBe('')
    })
  })

  describe('fromEnvironment', () => {
    it('should create auth from environment variables', () => {
      process.env.LEETCODE_SESSION = 'env-session'
      process.env.CSRFTOKEN = 'env-csrf'

      const auth = CookieFileAuth.fromEnvironment()

      expect(auth.getCookieString()).toContain('leetcode_session=env-session')
      expect(auth.getCsrfToken()).toBe('env-csrf')
    })

    it('should handle multiple cookie types from environment', () => {
      process.env.LEETCODE_SESSION = 'session'
      process.env.CSRFTOKEN = 'csrf'
      process.env.CF_CLEARANCE = 'clearance'

      const auth = CookieFileAuth.fromEnvironment()
      const cookieString = auth.getCookieString()

      expect(cookieString).toContain('leetcode_session=session')
      expect(cookieString).toContain('csrftoken=csrf')
      expect(cookieString).toContain('cf_clearance=clearance')
    })

    it('should throw error when no environment variables found', () => {
      // Ensure no relevant env vars are set
      delete process.env.LEETCODE_SESSION
      delete process.env.CSRFTOKEN
      delete process.env.CF_CLEARANCE
      delete process.env.INGRESSCOOKIE
      delete process.env.__CFLB

      expect(() => CookieFileAuth.fromEnvironment()).toThrow(AuthError)
      expect(() => CookieFileAuth.fromEnvironment()).toThrow(
        'No authentication cookies found in environment variables'
      )
    })
  })

  describe('fromCookies', () => {
    it('should create auth from cookie array', () => {
      const cookies: Cookie[] = [
        {
          name: 'LEETCODE_SESSION',
          value: 'test-session',
          domain: 'leetcode.com',
          path: '/',
        },
      ]

      const auth = CookieFileAuth.fromCookies(cookies)

      expect(auth.getCookieString()).toBe('LEETCODE_SESSION=test-session')
    })

    it('should auto-detect CSRF token from cookies', () => {
      const cookies: Cookie[] = [
        {
          name: 'LEETCODE_SESSION',
          value: 'session',
          domain: 'leetcode.com',
          path: '/',
        },
        {
          name: 'csrftoken',
          value: 'auto-csrf',
          domain: 'leetcode.com',
          path: '/',
        },
      ]

      const auth = CookieFileAuth.fromCookies(cookies)

      expect(auth.getCsrfToken()).toBe('auto-csrf')
    })

    it('should use provided CSRF token over auto-detected', () => {
      const cookies: Cookie[] = [
        {
          name: 'LEETCODE_SESSION',
          value: 'session',
          domain: 'leetcode.com',
          path: '/',
        },
        {
          name: 'csrftoken',
          value: 'cookie-csrf',
          domain: 'leetcode.com',
          path: '/',
        },
      ]

      const auth = CookieFileAuth.fromCookies(cookies, 'provided-csrf')

      expect(auth.getCsrfToken()).toBe('provided-csrf')
    })
  })

  describe('normalizeCookie', () => {
    it('should normalize cookie with all fields', async () => {
      const cookieData = {
        cookies: [
          {
            name: 'test',
            value: 'value',
            domain: 'leetcode.com',
            path: '/custom',
            expires: Date.now() + 10000,
            httpOnly: true,
            secure: true,
          },
          {
            name: 'LEETCODE_SESSION',
            value: 'session',
            domain: 'leetcode.com',
          },
        ],
      }

      await writeFile(testCookiePath, JSON.stringify(cookieData), 'utf-8')

      const auth = new CookieFileAuth(testCookiePath)
      await auth.authenticate()

      const credentials = auth.getCredentials()
      const firstCookie = credentials?.cookies[0]

      expect(firstCookie?.path).toBe('/custom')
      expect(firstCookie?.httpOnly).toBe(true)
      expect(firstCookie?.secure).toBe(true)
    })

    it('should set default path when not provided', async () => {
      const cookieData = {
        cookies: [
          {
            name: 'LEETCODE_SESSION',
            value: 'session',
            domain: 'leetcode.com',
          },
        ],
      }

      await writeFile(testCookiePath, JSON.stringify(cookieData), 'utf-8')

      const auth = new CookieFileAuth(testCookiePath)
      await auth.authenticate()

      const credentials = auth.getCredentials()
      const cookie = credentials?.cookies[0]

      expect(cookie?.path).toBe('/')
    })
  })
})

describe('parseCookieString', () => {
  it('should parse simple cookie string', () => {
    const cookieString = 'session=abc123; csrf=xyz789'
    const cookies = parseCookieString(cookieString)

    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toEqual({
      name: 'session',
      value: 'abc123',
      domain: 'leetcode.com',
      path: '/',
    })
    expect(cookies[1]).toEqual({
      name: 'csrf',
      value: 'xyz789',
      domain: 'leetcode.com',
      path: '/',
    })
  })

  it('should handle cookie values with = signs', () => {
    const cookieString = 'token=base64==value; other=test'
    const cookies = parseCookieString(cookieString)

    expect(cookies[0]?.value).toBe('base64==value')
  })

  it('should filter empty cookies', () => {
    const cookieString = 'valid=value; ; =empty; '
    const cookies = parseCookieString(cookieString)

    expect(cookies).toHaveLength(1)
    expect(cookies[0]?.name).toBe('valid')
  })

  it('should trim whitespace', () => {
    const cookieString = '  session  =  value  ;  csrf  =  token  '
    const cookies = parseCookieString(cookieString)

    expect(cookies).toHaveLength(2)
    expect(cookies[0]?.name).toBe('session')
    expect(cookies[0]?.value).toBe('value')
  })

  it('should accept custom domain', () => {
    const cookieString = 'session=value'
    const cookies = parseCookieString(cookieString, 'custom.com')

    expect(cookies[0]?.domain).toBe('custom.com')
  })
})

describe('exportCookies', () => {
  const testCredentials: AuthCredentials = {
    cookies: [
      {
        name: 'LEETCODE_SESSION',
        value: 'session123',
        domain: 'leetcode.com',
        path: '/',
        secure: true,
        expires: 1234567890000,
      },
      {
        name: 'csrftoken',
        value: 'csrf456',
        domain: 'leetcode.com',
        path: '/',
      },
    ],
    csrfToken: 'csrf456',
  }

  describe('JSON format', () => {
    it('should export to JSON format', () => {
      const exported = exportCookies(testCredentials, 'json')
      const parsed = JSON.parse(exported)

      expect(parsed.cookies).toHaveLength(2)
      expect(parsed.csrfToken).toBe('csrf456')
      expect(parsed.savedAt).toBeDefined()
    })

    it('should use JSON as default format', () => {
      const exported = exportCookies(testCredentials)
      const parsed = JSON.parse(exported)

      expect(parsed.cookies).toBeDefined()
    })
  })

  describe('Netscape format', () => {
    it('should export to Netscape format', () => {
      const exported = exportCookies(testCredentials, 'netscape')

      expect(exported).toContain('# Netscape HTTP Cookie File')
      expect(exported).toContain('leetcode.com')
      expect(exported).toContain('LEETCODE_SESSION')
      expect(exported).toContain('session123')
    })

    it('should handle domain prefixes correctly', () => {
      const credentials: AuthCredentials = {
        cookies: [
          {
            name: 'cookie1',
            value: 'value1',
            domain: '.leetcode.com', // With dot prefix
            path: '/',
          },
          {
            name: 'cookie2',
            value: 'value2',
            domain: 'leetcode.com', // Without dot prefix
            path: '/',
          },
        ],
        csrfToken: '',
      }

      const exported = exportCookies(credentials, 'netscape')
      const lines = exported.split('\n')

      // Find cookie lines (skip comments)
      const cookieLines = lines.filter((line) => !line.startsWith('#') && line.trim())

      expect(cookieLines[0]).toContain('TRUE') // .leetcode.com → TRUE
      expect(cookieLines[1]).toContain('FALSE') // leetcode.com → FALSE
    })

    it('should handle secure flag', () => {
      const credentials: AuthCredentials = {
        cookies: [
          {
            name: 'secure-cookie',
            value: 'value',
            domain: 'leetcode.com',
            path: '/',
            secure: true,
          },
          {
            name: 'insecure-cookie',
            value: 'value',
            domain: 'leetcode.com',
            path: '/',
            secure: false,
          },
        ],
        csrfToken: '',
      }

      const exported = exportCookies(credentials, 'netscape')

      expect(exported).toContain('TRUE') // secure: true
      expect(exported).toContain('FALSE') // secure: false
    })
  })

  describe('error handling', () => {
    it('should throw error for unsupported format', () => {
      // @ts-expect-error - testing invalid format
      expect(() => exportCookies(testCredentials, 'invalid')).toThrow('Unsupported export format')
    })
  })
})
