import { describe, it, expect } from 'vitest'

import {
  LescaError,
  AuthError,
  NetworkError,
  GraphQLError,
  RateLimitError,
  BrowserError,
  StorageError,
  ConfigError,
  ValidationError,
  ScrapingError,
  ConversionError,
} from '../errors.js'

describe('Error Classes', () => {
  describe('LescaError', () => {
    it('should create error with code and default message', () => {
      const error = new LescaError('AUTH_INVALID_CREDENTIALS')

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(LescaError)
      expect(error.code).toBe('AUTH_INVALID_CREDENTIALS')
      expect(error.message).toBeDefined()
      expect(error.name).toBe('LescaError')
      expect(error.category).toBeDefined()
      expect(error.recovery).toBeDefined()
      expect(error.timestamp).toBeInstanceOf(Date)
    })

    it('should create error with custom message', () => {
      const error = new LescaError('AUTH_INVALID_CREDENTIALS', 'Custom message')

      expect(error.message).toBe('Custom message')
      expect(error.code).toBe('AUTH_INVALID_CREDENTIALS')
    })

    it('should include error cause', () => {
      const cause = new Error('Original error')
      const error = new LescaError('NET_CONNECTION_FAILED', undefined, { cause })

      expect(error.cause).toBe(cause)
    })

    it('should include context data', () => {
      const context = { userId: '123', endpoint: '/api/problems' }
      const error = new LescaError('GQL_QUERY_FAILED', undefined, { context })

      expect(error.context).toEqual(context)
    })

    it('should include status code', () => {
      const error = new LescaError('NET_TIMEOUT', undefined, { statusCode: 408 })

      expect(error.statusCode).toBe(408)
    })

    it('should check if error is recoverable', () => {
      const recoverableError = new LescaError('NET_TIMEOUT')
      const fatalError = new LescaError('CONFIG_INVALID')

      // Assuming NET_TIMEOUT is recoverable based on typical classification
      expect(typeof recoverableError.isRecoverable()).toBe('boolean')
      expect(typeof fatalError.isFatal()).toBe('boolean')
    })

    it('should check if error requires user action', () => {
      const error = new LescaError('AUTH_COOKIES_NOT_FOUND')

      expect(typeof error.requiresUserAction()).toBe('boolean')
    })

    it('should get resolution steps', () => {
      const error = new LescaError('AUTH_INVALID_CREDENTIALS')
      const resolution = error.getResolution()

      expect(Array.isArray(resolution)).toBe(true)
    })

    it('should get common causes', () => {
      const error = new LescaError('NET_CONNECTION_FAILED')
      const causes = error.getCommonCauses()

      expect(Array.isArray(causes)).toBe(true)
    })

    it('should convert to JSON', () => {
      const context = { test: 'data' }
      const error = new LescaError('AUTH_SESSION_EXPIRED', 'Session expired', { context })
      const json = error.toJSON()

      expect(json.name).toBe('LescaError')
      expect(json.message).toBe('Session expired')
      expect(json.code).toBe('AUTH_SESSION_EXPIRED')
      expect(json.category).toBeDefined()
      expect(json.recovery).toBeDefined()
      expect(json.context).toEqual(context)
      expect(json.timestamp).toBeDefined()
      expect(json.stack).toBeDefined()
    })

    it('should get user-friendly message with resolutions', () => {
      const error = new LescaError('AUTH_COOKIES_NOT_FOUND')
      const userMessage = error.getUserMessage()

      expect(userMessage).toBeDefined()
      expect(typeof userMessage).toBe('string')
    })

    it('should handle cause in toJSON', () => {
      const cause = new Error('Original error')
      const error = new LescaError('SCRAPE_SELECTOR_NOT_FOUND', undefined, { cause })
      const json = error.toJSON()

      expect(json.cause).toBe('Original error')
    })
  })

  describe('AuthError', () => {
    it('should create auth error with invalid credentials code', () => {
      const error = new AuthError('AUTH_INVALID_CREDENTIALS')

      expect(error).toBeInstanceOf(LescaError)
      expect(error).toBeInstanceOf(AuthError)
      expect(error.name).toBe('AuthError')
      expect(error.code).toBe('AUTH_INVALID_CREDENTIALS')
      expect(error.statusCode).toBe(401)
    })

    it('should create auth error with cookies not found code', () => {
      const error = new AuthError('AUTH_COOKIES_NOT_FOUND', 'Cookies missing')

      expect(error.code).toBe('AUTH_COOKIES_NOT_FOUND')
      expect(error.message).toBe('Cookies missing')
    })

    it('should create auth error with session expired code', () => {
      const error = new AuthError('AUTH_SESSION_EXPIRED')

      expect(error.code).toBe('AUTH_SESSION_EXPIRED')
    })

    it('should create auth error with premium required code', () => {
      const error = new AuthError('AUTH_PREMIUM_REQUIRED')

      expect(error.code).toBe('AUTH_PREMIUM_REQUIRED')
    })

    it('should include cause and context', () => {
      const cause = new Error('Auth failed')
      const context = { cookiePath: '/path/to/cookies.json' }
      const error = new AuthError('AUTH_COOKIES_NOT_FOUND', undefined, { cause, context })

      expect(error.cause).toBe(cause)
      expect(error.context).toEqual(context)
    })
  })

  describe('NetworkError', () => {
    it('should create network error with connection failed code', () => {
      const error = new NetworkError('NET_CONNECTION_FAILED')

      expect(error).toBeInstanceOf(LescaError)
      expect(error).toBeInstanceOf(NetworkError)
      expect(error.name).toBe('NetworkError')
      expect(error.code).toBe('NET_CONNECTION_FAILED')
    })

    it('should create network error with timeout code', () => {
      const error = new NetworkError('NET_TIMEOUT', 'Request timed out')

      expect(error.code).toBe('NET_TIMEOUT')
      expect(error.message).toBe('Request timed out')
    })

    it('should create network error with rate limited code', () => {
      const error = new NetworkError('NET_RATE_LIMITED')

      expect(error.code).toBe('NET_RATE_LIMITED')
    })

    it('should allow custom status code', () => {
      const error = new NetworkError('NET_CONNECTION_FAILED', undefined, { statusCode: 503 })

      expect(error.statusCode).toBe(503)
    })
  })

  describe('GraphQLError', () => {
    it('should create GraphQL error with query failed code', () => {
      const error = new GraphQLError('GQL_QUERY_FAILED')

      expect(error).toBeInstanceOf(LescaError)
      expect(error).toBeInstanceOf(GraphQLError)
      expect(error.name).toBe('GraphQLError')
      expect(error.code).toBe('GQL_QUERY_FAILED')
    })

    it('should create GraphQL error with invalid response code', () => {
      const error = new GraphQLError('GQL_INVALID_RESPONSE', 'Invalid data structure')

      expect(error.code).toBe('GQL_INVALID_RESPONSE')
      expect(error.message).toBe('Invalid data structure')
    })

    it('should include context', () => {
      const context = { query: 'getProblem', variables: { slug: 'two-sum' } }
      const error = new GraphQLError('GQL_QUERY_FAILED', undefined, { context })

      expect(error.context).toEqual(context)
    })
  })

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError()

      expect(error).toBeInstanceOf(NetworkError)
      expect(error).toBeInstanceOf(RateLimitError)
      expect(error.name).toBe('RateLimitError')
      expect(error.code).toBe('NET_RATE_LIMITED')
      expect(error.statusCode).toBe(429)
    })

    it('should include retryAfter value', () => {
      const error = new RateLimitError(undefined, { retryAfter: 60 })

      expect(error.retryAfter).toBe(60)
    })

    it('should work without retryAfter', () => {
      const error = new RateLimitError('Rate limit exceeded')

      expect(error.retryAfter).toBeUndefined()
      expect(error.message).toBe('Rate limit exceeded')
    })

    it('should include cause and context', () => {
      const cause = new Error('Too many requests')
      const context = { endpoint: '/api/problems', requestCount: 100 }
      const error = new RateLimitError(undefined, { cause, context, retryAfter: 30 })

      expect(error.cause).toBe(cause)
      expect(error.context).toEqual(context)
      expect(error.retryAfter).toBe(30)
    })
  })

  describe('BrowserError', () => {
    it('should create browser error', () => {
      const error = new BrowserError('BROWSER_LAUNCH_FAILED')

      expect(error).toBeInstanceOf(LescaError)
      expect(error.name).toBe('BrowserError')
      expect(error.code).toBe('BROWSER_LAUNCH_FAILED')
    })
  })

  describe('StorageError', () => {
    it('should create storage error', () => {
      const error = new StorageError('STORAGE_WRITE_FAILED')

      expect(error).toBeInstanceOf(LescaError)
      expect(error.name).toBe('StorageError')
      expect(error.code).toBe('STORAGE_WRITE_FAILED')
    })
  })

  describe('ConfigError', () => {
    it('should create config error', () => {
      const error = new ConfigError('CONFIG_INVALID')

      expect(error).toBeInstanceOf(LescaError)
      expect(error.name).toBe('ConfigError')
      expect(error.code).toBe('CONFIG_INVALID')
    })
  })

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('VAL_INVALID_INPUT')

      expect(error).toBeInstanceOf(LescaError)
      expect(error.name).toBe('ValidationError')
      expect(error.code).toBe('VAL_INVALID_INPUT')
    })
  })

  describe('ScrapingError', () => {
    it('should create scraping error', () => {
      const error = new ScrapingError('SCRAPE_SELECTOR_NOT_FOUND')

      expect(error).toBeInstanceOf(LescaError)
      expect(error.name).toBe('ScrapingError')
      expect(error.code).toBe('SCRAPE_SELECTOR_NOT_FOUND')
    })
  })

  describe('ConversionError', () => {
    it('should create conversion error', () => {
      const error = new ConversionError('CONV_INVALID_HTML')

      expect(error).toBeInstanceOf(LescaError)
      expect(error.name).toBe('ConversionError')
      expect(error.code).toBe('CONV_INVALID_HTML')
    })
  })
})
