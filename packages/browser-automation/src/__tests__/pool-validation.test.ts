import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserPool } from '../pool'
import { SessionPoolManager } from '../session-pool-manager'
import { BrowserError } from '@lesca/error'

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      close: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      contexts: vi.fn().mockReturnValue([]),
    }),
  },
}))

vi.mock('@lesca/shared/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('BrowserPool Validation', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('minSize validation', () => {
    it('should throw on negative minSize', () => {
      expect(() => new BrowserPool({ minSize: -1 })).toThrow(BrowserError)
      expect(() => new BrowserPool({ minSize: -1 })).toThrow('minSize cannot be negative')
    })

    it('should accept zero minSize', () => {
      expect(() => new BrowserPool({ minSize: 0 })).not.toThrow()
    })
  })

  describe('maxSize validation', () => {
    it('should throw on maxSize < 1', () => {
      expect(() => new BrowserPool({ maxSize: 0 })).toThrow(BrowserError)
      expect(() => new BrowserPool({ maxSize: 0 })).toThrow('maxSize must be at least 1')
    })

    it('should throw on negative maxSize', () => {
      expect(() => new BrowserPool({ maxSize: -1 })).toThrow(BrowserError)
      expect(() => new BrowserPool({ maxSize: -1 })).toThrow('maxSize must be at least 1')
    })

    it('should accept maxSize of 1', () => {
      expect(() => new BrowserPool({ maxSize: 1 })).not.toThrow()
    })
  })

  describe('minSize > maxSize validation', () => {
    it('should throw when minSize > maxSize', () => {
      expect(() => new BrowserPool({ minSize: 5, maxSize: 3 })).toThrow(BrowserError)
      expect(() => new BrowserPool({ minSize: 5, maxSize: 3 })).toThrow(
        'minSize cannot be greater than maxSize'
      )
    })

    it('should accept minSize == maxSize', () => {
      expect(() => new BrowserPool({ minSize: 3, maxSize: 3 })).not.toThrow()
    })
  })

  describe('maxIdleTime validation', () => {
    it('should throw on negative maxIdleTime', () => {
      expect(() => new BrowserPool({ maxIdleTime: -1 })).toThrow(BrowserError)
      expect(() => new BrowserPool({ maxIdleTime: -1 })).toThrow('maxIdleTime cannot be negative')
    })

    it('should accept zero maxIdleTime', () => {
      expect(() => new BrowserPool({ maxIdleTime: 0 })).not.toThrow()
    })
  })

  describe('error code verification', () => {
    it('should use BROWSER_POOL_CONFIG_INVALID code', () => {
      try {
        new BrowserPool({ minSize: -1 })
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('BROWSER_POOL_CONFIG_INVALID')
        }
      }
    })

    it('should include context in error', () => {
      try {
        new BrowserPool({ minSize: -1 })
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.context).toMatchObject({ minSize: -1 })
        }
      }
    })
  })
})

describe('SessionPoolManager Validation', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('strategy validation', () => {
    it('should throw on invalid strategy', () => {
      expect(() => new SessionPoolManager({ strategy: 'invalid' as 'per-session' })).toThrow(
        BrowserError
      )
      expect(() => new SessionPoolManager({ strategy: 'invalid' as 'per-session' })).toThrow(
        "Invalid pool strategy: invalid. Must be 'per-session' or 'shared'"
      )
    })

    it('should accept per-session strategy', () => {
      expect(() => new SessionPoolManager({ strategy: 'per-session' })).not.toThrow()
    })

    it('should accept shared strategy', () => {
      expect(() => new SessionPoolManager({ strategy: 'shared' })).not.toThrow()
    })
  })

  describe('perSessionMaxSize validation', () => {
    it('should throw on perSessionMaxSize < 1', () => {
      expect(() => new SessionPoolManager({ perSessionMaxSize: 0 })).toThrow(BrowserError)
      expect(() => new SessionPoolManager({ perSessionMaxSize: 0 })).toThrow(
        'perSessionMaxSize must be at least 1'
      )
    })

    it('should accept perSessionMaxSize of 1', () => {
      expect(() => new SessionPoolManager({ perSessionMaxSize: 1 })).not.toThrow()
    })
  })

  describe('perSessionIdleTime validation', () => {
    it('should throw on negative perSessionIdleTime', () => {
      expect(() => new SessionPoolManager({ perSessionIdleTime: -1 })).toThrow(BrowserError)
      expect(() => new SessionPoolManager({ perSessionIdleTime: -1 })).toThrow(
        'perSessionIdleTime cannot be negative'
      )
    })

    it('should accept zero perSessionIdleTime', () => {
      expect(() => new SessionPoolManager({ perSessionIdleTime: 0 })).not.toThrow()
    })
  })

  describe('acquireTimeout validation', () => {
    it('should throw on acquireTimeout < 1000', () => {
      expect(() => new SessionPoolManager({ acquireTimeout: 999 })).toThrow(BrowserError)
      expect(() => new SessionPoolManager({ acquireTimeout: 999 })).toThrow(
        'acquireTimeout must be at least 1000ms'
      )
    })

    it('should accept acquireTimeout of 1000', () => {
      expect(() => new SessionPoolManager({ acquireTimeout: 1000 })).not.toThrow()
    })
  })

  describe('maxRetries validation', () => {
    it('should throw on negative maxRetries', () => {
      expect(() => new SessionPoolManager({ maxRetries: -1 })).toThrow(BrowserError)
      expect(() => new SessionPoolManager({ maxRetries: -1 })).toThrow(
        'maxRetries cannot be negative'
      )
    })

    it('should accept zero maxRetries', () => {
      expect(() => new SessionPoolManager({ maxRetries: 0 })).not.toThrow()
    })
  })

  describe('error code verification', () => {
    it('should use BROWSER_POOL_CONFIG_INVALID code', () => {
      try {
        new SessionPoolManager({ perSessionMaxSize: 0 })
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.code).toBe('BROWSER_POOL_CONFIG_INVALID')
        }
      }
    })

    it('should include context in error', () => {
      try {
        new SessionPoolManager({ perSessionMaxSize: 0 })
      } catch (error) {
        if (error instanceof BrowserError) {
          expect(error.context).toMatchObject({ perSessionMaxSize: 0 })
        }
      }
    })
  })
})
