import { describe, it, expect } from 'vitest'
import {
  sanitizeString,
  sanitizeObject,
  sanitizeError,
  createSanitizer,
  containsSensitiveData,
  findSensitiveKeys,
} from '../sanitizer'

describe('sanitizeString', () => {
  describe('cookies and session data', () => {
    it('should mask cookie values', () => {
      const input = 'cookie: abc123def456'
      const result = sanitizeString(input)
      expect(result).toBe('cookie: [REDACTED]')
    })

    it('should mask multiple cookie patterns', () => {
      const input = 'cookies=session123; Cookie: user456'
      const result = sanitizeString(input)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('session123')
      expect(result).not.toContain('user456')
    })

    it('should mask csrf tokens', () => {
      const input = 'csrf_token: token123abc'
      const result = sanitizeString(input)
      expect(result).toBe('csrf_token: [REDACTED]')
    })

    it('should mask session IDs', () => {
      const input = 'session-id=sess_abc123'
      const result = sanitizeString(input)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('sess_abc123')
    })
  })

  describe('authorization headers', () => {
    it('should mask authorization header', () => {
      const input = 'Authorization: secrettoken123'
      const result = sanitizeString(input)
      expect(result).toBe('Authorization: [REDACTED]')
    })

    it('should mask bearer tokens', () => {
      const input = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0'
      const result = sanitizeString(input)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('eyJ')
    })
  })

  describe('API keys and secrets', () => {
    it('should mask api keys', () => {
      const input = 'api_key: sk_live_abc123xyz'
      const result = sanitizeString(input)
      expect(result).toBe('api_key: [REDACTED]')
    })

    it('should mask secret keys', () => {
      const input = 'secret-key=mysupersecret'
      const result = sanitizeString(input)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('mysupersecret')
    })

    it('should mask access tokens', () => {
      const input = 'access_token: token_xyz123'
      const result = sanitizeString(input)
      expect(result).toBe('access_token: [REDACTED]')
    })

    it('should mask refresh tokens', () => {
      const input = 'refresh-token: rt_abc456'
      const result = sanitizeString(input)
      expect(result).toContain('[REDACTED]')
    })
  })

  describe('passwords', () => {
    it('should mask password values', () => {
      const input = 'password: mysecretpass123'
      const result = sanitizeString(input)
      expect(result).toBe('password: [REDACTED]')
    })

    it('should mask passwd values', () => {
      const input = 'passwd=secret123'
      const result = sanitizeString(input)
      expect(result).toContain('[REDACTED]')
    })

    it('should mask pwd values', () => {
      const input = 'pwd: pass'
      const result = sanitizeString(input)
      expect(result).toBe('pwd: [REDACTED]')
    })
  })

  describe('personal information', () => {
    it('should mask email addresses', () => {
      const input = 'Contact: user@example.com for support'
      const result = sanitizeString(input)
      expect(result).toBe('Contact: [REDACTED] for support')
    })

    it('should mask phone numbers', () => {
      const input = 'Call +12025551234 for help'
      const result = sanitizeString(input)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('2025551234')
    })

    it('should mask credit card numbers', () => {
      const input = 'Card: 4111-1111-1111-1111'
      const result = sanitizeString(input)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('4111')
    })

    it('should mask credit cards with spaces', () => {
      const input = 'Number: 4111 1111 1111 1111'
      const result = sanitizeString(input)
      expect(result).toContain('[REDACTED]')
    })
  })

  describe('URL credentials', () => {
    it('should mask credentials in URLs', () => {
      const input = 'https://user:mypass123@example.com/path'
      const result = sanitizeString(input)
      // URL pattern masks both user and password
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('mypass123')
    })

    it('should handle http URLs', () => {
      const input = 'http://admin:secretvalue@localhost:8080'
      const result = sanitizeString(input)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('secretvalue')
    })
  })

  describe('options', () => {
    it('should use custom mask', () => {
      const input = 'password: secret123'
      const result = sanitizeString(input, { mask: '***' })
      expect(result).toBe('password: ***')
    })

    it('should preserve characters when preserveLength > 0', () => {
      const input = 'password: mysecretpassword'
      const result = sanitizeString(input, { preserveLength: 2 })
      // Should preserve first 2 and last 2 chars
      expect(result).toContain('my')
      expect(result).toContain('rd')
      expect(result).toContain('[REDACTED]')
    })

    it('should apply custom patterns', () => {
      const input = 'Internal code: ABC-123-XYZ'
      const customPattern = /ABC-\d+-XYZ/g
      const result = sanitizeString(input, { customPatterns: [customPattern] })
      expect(result).toBe('Internal code: [REDACTED]')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = sanitizeString('')
      expect(result).toBe('')
    })

    it('should handle string with no sensitive data', () => {
      const input = 'This is a normal log message'
      const result = sanitizeString(input)
      expect(result).toBe('This is a normal log message')
    })

    it('should handle multiple sensitive values', () => {
      const input = 'cookie: abc123, password: secret, api_key: key456'
      const result = sanitizeString(input)
      expect(result).not.toContain('abc123')
      expect(result).not.toContain('secret')
      expect(result).not.toContain('key456')
    })
  })
})

describe('sanitizeObject', () => {
  describe('sensitive keys', () => {
    it('should mask password keys', () => {
      const input = { username: 'john', password: 'secret123' }
      const result = sanitizeObject(input)
      expect(result.username).toBe('john')
      expect(result.password).toBe('[REDACTED]')
    })

    it('should mask token keys', () => {
      const input = { token: 'abc123', accessToken: 'xyz789' }
      const result = sanitizeObject(input)
      expect(result.token).toBe('[REDACTED]')
      expect(result.accessToken).toBe('[REDACTED]')
    })

    it('should mask cookie keys', () => {
      const input = { cookie: 'session=123', data: 'normal' }
      const result = sanitizeObject(input)
      expect(result.cookie).toBe('[REDACTED]')
      expect(result.data).toBe('normal')
    })

    it('should mask keys containing "secret"', () => {
      const input = { mySecretValue: 'hidden', public: 'visible' }
      const result = sanitizeObject(input)
      expect(result.mySecretValue).toBe('[REDACTED]')
      expect(result.public).toBe('visible')
    })

    it('should be case insensitive for keys', () => {
      const input = { PASSWORD: 'test', Token: 'abc' }
      const result = sanitizeObject(input)
      expect(result.PASSWORD).toBe('[REDACTED]')
      expect(result.Token).toBe('[REDACTED]')
    })
  })

  describe('nested objects', () => {
    it('should sanitize nested objects', () => {
      const input = {
        user: {
          name: 'john',
          credentials: {
            password: 'secret',
          },
        },
      }
      const result = sanitizeObject(input)
      expect(result.user.name).toBe('john')
      expect(result.user.credentials.password).toBe('[REDACTED]')
    })

    it('should sanitize deeply nested structures', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              apiKey: 'deep-secret',
            },
          },
        },
      }
      const result = sanitizeObject(input)
      expect(result.level1.level2.level3.apiKey).toBe('[REDACTED]')
    })
  })

  describe('arrays', () => {
    it('should sanitize arrays of objects', () => {
      const input = {
        users: [
          { name: 'john', password: 'pass1' },
          { name: 'jane', password: 'pass2' },
        ],
      }
      const result = sanitizeObject(input)
      expect(result.users[0]?.name).toBe('john')
      expect(result.users[0]?.password).toBe('[REDACTED]')
      expect(result.users[1]?.password).toBe('[REDACTED]')
    })

    it('should sanitize strings in arrays', () => {
      const input = {
        logs: ['password: secret', 'normal log'],
      }
      const result = sanitizeObject(input)
      expect(result.logs[0]).toContain('[REDACTED]')
      expect(result.logs[1]).toBe('normal log')
    })
  })

  describe('string values', () => {
    it('should sanitize sensitive patterns in string values', () => {
      const input = {
        message: 'User logged in with cookie: abc123',
      }
      const result = sanitizeObject(input)
      expect(result.message).toContain('[REDACTED]')
      expect(result.message).not.toContain('abc123')
    })
  })

  describe('special values', () => {
    it('should handle null values', () => {
      const input = { password: null, data: 'test' }
      const result = sanitizeObject(input)
      expect(result.password).toBeNull()
      expect(result.data).toBe('test')
    })

    it('should handle undefined values', () => {
      const input = { token: undefined, value: 'test' }
      const result = sanitizeObject(input)
      expect(result.token).toBeUndefined()
    })

    it('should preserve non-string primitives', () => {
      const input = { count: 42, active: true, ratio: 3.14 }
      const result = sanitizeObject(input)
      expect(result.count).toBe(42)
      expect(result.active).toBe(true)
      expect(result.ratio).toBe(3.14)
    })
  })

  describe('options', () => {
    it('should use custom keys', () => {
      const input = { myCustomSecret: 'hidden', normal: 'visible' }
      const result = sanitizeObject(input, { customKeys: ['myCustomSecret'] })
      expect(result.myCustomSecret).toBe('[REDACTED]')
      expect(result.normal).toBe('visible')
    })

    it('should use custom mask', () => {
      const input = { password: 'secret' }
      const result = sanitizeObject(input, { mask: '***' })
      expect(result.password).toBe('***')
    })
  })
})

describe('sanitizeError', () => {
  it('should sanitize error message', () => {
    const error = new Error('Failed with password: secret123')
    const result = sanitizeError(error)
    expect(result.message).toContain('[REDACTED]')
    expect(result.message).not.toContain('secret123')
  })

  it('should preserve error name', () => {
    const error = new TypeError('Invalid token: abc123')
    const result = sanitizeError(error)
    expect(result.name).toBe('TypeError')
  })

  it('should sanitize error stack', () => {
    const error = new Error('Error with api_key: key123')
    error.stack = 'Error: Error with api_key: key123\n    at test.ts:1:1'
    const result = sanitizeError(error)
    expect(result.stack).toContain('[REDACTED]')
    expect(result.stack).not.toContain('key123')
  })

  it('should sanitize additional error properties', () => {
    const error = new Error('Request failed')
    ;(error as unknown as Record<string, unknown>).requestData = {
      password: 'secret',
    }
    const result = sanitizeError(error)
    expect((result as unknown as Record<string, { password: string }>).requestData.password).toBe(
      '[REDACTED]'
    )
  })

  it('should handle error message without sensitive data', () => {
    const error = new Error('Simple error without secrets')
    const result = sanitizeError(error)
    expect(result.message).toBe('Simple error without secrets')
  })
})

describe('createSanitizer', () => {
  it('should create sanitizer with preset options', () => {
    const sanitizer = createSanitizer({ mask: '***' })

    expect(sanitizer.string('password: secret')).toBe('password: ***')
    expect(sanitizer.object({ token: 'abc' }).token).toBe('***')
  })

  it('should create sanitizer with string method', () => {
    const sanitizer = createSanitizer()
    const result = sanitizer.string('cookie: test123')
    expect(result).toContain('[REDACTED]')
  })

  it('should create sanitizer with object method', () => {
    const sanitizer = createSanitizer()
    const result = sanitizer.object({ password: 'secret' })
    expect(result.password).toBe('[REDACTED]')
  })

  it('should create sanitizer with error method', () => {
    const sanitizer = createSanitizer()
    const error = new Error('password: secret')
    const result = sanitizer.error(error)
    expect(result.message).toContain('[REDACTED]')
  })
})

describe('containsSensitiveData', () => {
  it('should return true for strings with cookies', () => {
    expect(containsSensitiveData('cookie: abc123')).toBe(true)
  })

  it('should return true for strings with passwords', () => {
    expect(containsSensitiveData('password=secret')).toBe(true)
  })

  it('should return true for strings with email', () => {
    expect(containsSensitiveData('Contact user@example.com')).toBe(true)
  })

  it('should return true for strings with credit cards', () => {
    expect(containsSensitiveData('Card: 4111-1111-1111-1111')).toBe(true)
  })

  it('should return true for strings with URL credentials', () => {
    expect(containsSensitiveData('https://user:pass@example.com')).toBe(true)
  })

  it('should return false for normal strings', () => {
    expect(containsSensitiveData('This is a normal log message')).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(containsSensitiveData('')).toBe(false)
  })
})

describe('findSensitiveKeys', () => {
  it('should find top-level sensitive keys', () => {
    const obj = { password: 'secret', name: 'john' }
    const keys = findSensitiveKeys(obj)
    expect(keys).toContain('password')
    expect(keys).not.toContain('name')
  })

  it('should find nested sensitive keys', () => {
    const obj = {
      user: {
        credentials: {
          apiKey: 'key123',
        },
      },
    }
    const keys = findSensitiveKeys(obj)
    expect(keys).toContain('user.credentials.apiKey')
  })

  it('should find keys containing "secret"', () => {
    const obj = { mySecretValue: 'hidden' }
    const keys = findSensitiveKeys(obj)
    expect(keys).toContain('mySecretValue')
  })

  it('should find keys containing "token"', () => {
    const obj = { authToken: 'abc', refreshToken: 'xyz' }
    const keys = findSensitiveKeys(obj)
    expect(keys).toContain('authToken')
    expect(keys).toContain('refreshToken')
  })

  it('should handle arrays in path', () => {
    const obj = {
      users: [{ password: 'pass1' }, { password: 'pass2' }],
    }
    const keys = findSensitiveKeys(obj)
    expect(keys).toContain('users.[0].password')
    expect(keys).toContain('users.[1].password')
  })

  it('should return empty array for object with no sensitive keys', () => {
    const obj = { name: 'john', age: 30 }
    const keys = findSensitiveKeys(obj)
    expect(keys).toEqual([])
  })

  it('should handle null and undefined values', () => {
    const obj = { password: null, token: undefined, data: 'test' }
    const keys = findSensitiveKeys(obj)
    expect(keys).toContain('password')
    expect(keys).toContain('token')
  })
})
