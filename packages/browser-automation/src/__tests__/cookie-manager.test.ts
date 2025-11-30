import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CookieManager } from '../cookie-manager'
import { PlaywrightDriver } from '../playwright-driver'
import { mkdir, rm, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { Cookie } from 'playwright'

vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rm: vi.fn(),
}))

describe('CookieManager', () => {
  let cookieManager: CookieManager
  let mockDriver: PlaywrightDriver
  let testCookiesDir: string

  const mockCookies: Cookie[] = [
    {
      name: 'LEETCODE_SESSION',
      value: 'test-session-value',
      domain: '.leetcode.com',
      path: '/',
      expires: Date.now() / 1000 + 3600,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
    {
      name: 'csrftoken',
      value: 'test-csrf-token',
      domain: '.leetcode.com',
      path: '/',
      expires: Date.now() / 1000 + 3600,
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    },
  ]

  beforeEach(() => {
    cookieManager = new CookieManager()
    testCookiesDir = join(tmpdir(), `lesca-test-cookies-${Date.now()}`)

    // Create mock driver
    mockDriver = {
      getPage: vi.fn(() => ({
        context: vi.fn(() => ({
          cookies: vi.fn().mockResolvedValue(mockCookies),
          addCookies: vi.fn().mockResolvedValue(undefined),
          clearCookies: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    } as unknown as PlaywrightDriver

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(async () => {
    try {
      await rm(testCookiesDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('saveCookies', () => {
    it('should save cookies from browser driver', async () => {
      const cookiePath = join(testCookiesDir, 'cookies.json')

      await cookieManager.saveCookies(mockDriver, cookiePath)

      expect(mkdir).toHaveBeenCalled()
      expect(mockDriver.getPage).toHaveBeenCalled()
    })

    it('should throw error if driver has no page', async () => {
      const nopageDriver = {
        getPage: vi.fn(() => null),
      } as unknown as PlaywrightDriver

      await expect(cookieManager.saveCookies(nopageDriver, 'test.json')).rejects.toThrow(
        'Cannot save cookies: browser not initialized'
      )
    })
  })

  describe('loadCookies', () => {
    it('should load cookies from file', async () => {
      const cookieData = {
        cookies: mockCookies,
        csrfToken: 'test-csrf-token',
        savedAt: new Date().toISOString(),
      }

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(cookieData))

      const cookies = await cookieManager.loadCookies('test.json')

      expect(cookies).toHaveLength(2)
      expect(cookies[0]?.name).toBe('LEETCODE_SESSION')
    })

    it('should throw error if cookie file not found', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      vi.mocked(readFile).mockRejectedValue(error)

      await expect(cookieManager.loadCookies('nonexistent.json')).rejects.toThrow(
        'Cookie file not found'
      )
    })

    it('should throw error if cookie file format is invalid', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({ invalid: 'format' }))

      await expect(cookieManager.loadCookies('invalid.json')).rejects.toThrow(
        /Invalid cookie file format|Failed to load cookies/
      )
    })
  })

  describe('validateCookies', () => {
    it('should validate cookies successfully', () => {
      const result = cookieManager.validateCookies(mockCookies)

      expect(result.valid).toBe(true)
      expect(result.expired).toHaveLength(0)
      expect(result.missing).toHaveLength(0)
    })

    it('should detect expired cookies', () => {
      const expiredCookies: Cookie[] = [
        {
          name: 'LEETCODE_SESSION',
          value: 'test-value',
          domain: '.leetcode.com',
          path: '/',
          expires: Date.now() / 1000 - 3600, // Expired 1 hour ago
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
      ]

      const result = cookieManager.validateCookies(expiredCookies)

      expect(result.valid).toBe(false)
      expect(result.expired).toHaveLength(1)
      expect(result.warnings).toContain("Cookie 'LEETCODE_SESSION' has expired")
    })

    it('should detect missing required cookies', () => {
      const incompleteCookies: Cookie[] = [
        {
          name: 'other-cookie',
          value: 'test-value',
          domain: '.leetcode.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ]

      const result = cookieManager.validateCookies(incompleteCookies)

      expect(result.valid).toBe(false)
      expect(result.missing).toContain('LEETCODE_SESSION')
      expect(result.missing).toContain('csrftoken')
    })
  })

  describe('refreshCookies', () => {
    it('should refresh cookies from browser', async () => {
      const cookies = await cookieManager.refreshCookies(mockDriver)

      expect(cookies).toHaveLength(2)
      expect(mockDriver.getPage).toHaveBeenCalled()
    })

    it('should throw error if driver has no page', async () => {
      const nopageDriver = {
        getPage: vi.fn(() => null),
      } as unknown as PlaywrightDriver

      await expect(cookieManager.refreshCookies(nopageDriver)).rejects.toThrow(
        'Cannot refresh cookies: browser not initialized'
      )
    })
  })

  describe('mergeCookies', () => {
    const existingCookies: Cookie[] = [
      {
        name: 'cookie1',
        value: 'old-value',
        domain: '.example.com',
        path: '/',
        expires: 1000,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]

    const freshCookies: Cookie[] = [
      {
        name: 'cookie1',
        value: 'new-value',
        domain: '.example.com',
        path: '/',
        expires: 2000,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'cookie2',
        value: 'fresh-value',
        domain: '.example.com',
        path: '/',
        expires: 3000,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]

    it('should merge with keep-existing strategy', () => {
      const merged = cookieManager.mergeCookies(existingCookies, freshCookies, 'keep-existing')

      expect(merged).toHaveLength(2)
      const cookie1 = merged.find((c) => c.name === 'cookie1')
      expect(cookie1?.value).toBe('old-value') // Kept existing
    })

    it('should merge with prefer-fresh strategy', () => {
      const merged = cookieManager.mergeCookies(existingCookies, freshCookies, 'prefer-fresh')

      expect(merged).toHaveLength(2)
      const cookie1 = merged.find((c) => c.name === 'cookie1')
      expect(cookie1?.value).toBe('new-value') // Preferred fresh
    })

    it('should merge with merge-all strategy', () => {
      const merged = cookieManager.mergeCookies(existingCookies, freshCookies, 'merge-all')

      expect(merged).toHaveLength(2)
      const cookie1 = merged.find((c) => c.name === 'cookie1')
      expect(cookie1?.value).toBe('new-value') // Preferred fresh (newer expiry)
    })
  })

  describe('auto-save', () => {
    it('should enable auto-save', () => {
      cookieManager.enableAutoSave('/path/to/cookies.json')

      expect(cookieManager.isAutoSaveEnabled()).toBe(true)
      expect(cookieManager.getAutoSavePath()).toBe('/path/to/cookies.json')
    })

    it('should disable auto-save', () => {
      cookieManager.enableAutoSave('/path/to/cookies.json')
      cookieManager.disableAutoSave()

      expect(cookieManager.isAutoSaveEnabled()).toBe(false)
      expect(cookieManager.getAutoSavePath()).toBeUndefined()
    })

    it('should auto-save when enabled', async () => {
      const saveSpy = vi.spyOn(cookieManager, 'saveCookies')
      cookieManager.enableAutoSave('/path/to/cookies.json')

      await cookieManager.autoSave(mockDriver)

      expect(saveSpy).toHaveBeenCalledWith(mockDriver, '/path/to/cookies.json')
    })

    it('should not auto-save when disabled', async () => {
      const saveSpy = vi.spyOn(cookieManager, 'saveCookies')
      cookieManager.disableAutoSave()

      await cookieManager.autoSave(mockDriver)

      expect(saveSpy).not.toHaveBeenCalled()
    })
  })

  describe('injectCookies', () => {
    it('should inject cookies into browser', async () => {
      await cookieManager.injectCookies(mockDriver, mockCookies)

      expect(mockDriver.getPage).toHaveBeenCalled()
    })

    it('should throw error if driver has no page', async () => {
      const nopageDriver = {
        getPage: vi.fn(() => null),
      } as unknown as PlaywrightDriver

      await expect(cookieManager.injectCookies(nopageDriver, mockCookies)).rejects.toThrow(
        'Cannot inject cookies: browser not initialized'
      )
    })
  })

  describe('clearCookies', () => {
    it('should clear all cookies from browser', async () => {
      await cookieManager.clearCookies(mockDriver)

      expect(mockDriver.getPage).toHaveBeenCalled()
    })

    it('should throw error if driver has no page', async () => {
      const nopageDriver = {
        getPage: vi.fn(() => null),
      } as unknown as PlaywrightDriver

      await expect(cookieManager.clearCookies(nopageDriver)).rejects.toThrow(
        'Cannot clear cookies: browser not initialized'
      )
    })
  })

  describe('getCookie', () => {
    it('should get specific cookie by name', async () => {
      const cookie = await cookieManager.getCookie(mockDriver, 'csrftoken')

      expect(cookie).not.toBeNull()
      expect(cookie?.name).toBe('csrftoken')
    })

    it('should return null if cookie not found', async () => {
      const cookie = await cookieManager.getCookie(mockDriver, 'nonexistent')

      expect(cookie).toBeNull()
    })

    it('should return null if driver has no page', async () => {
      const nopageDriver = {
        getPage: vi.fn(() => null),
      } as unknown as PlaywrightDriver

      const cookie = await cookieManager.getCookie(nopageDriver, 'test')

      expect(cookie).toBeNull()
    })
  })

  describe('setCookie', () => {
    it('should set a specific cookie', async () => {
      const newCookie: Cookie = {
        name: 'test-cookie',
        value: 'test-value',
        domain: '.example.com',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      }

      await cookieManager.setCookie(mockDriver, newCookie)

      expect(mockDriver.getPage).toHaveBeenCalled()
    })

    it('should throw error if driver has no page', async () => {
      const nopageDriver = {
        getPage: vi.fn(() => null),
      } as unknown as PlaywrightDriver

      const cookie: Cookie = {
        name: 'test',
        value: 'value',
        domain: '.example.com',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      }

      await expect(cookieManager.setCookie(nopageDriver, cookie)).rejects.toThrow(
        'Cannot set cookie: browser not initialized'
      )
    })
  })

  describe('loadAndInject', () => {
    it('should load and inject valid cookies', async () => {
      const cookieData = {
        cookies: mockCookies,
        csrfToken: 'test-csrf-token',
        savedAt: new Date().toISOString(),
      }

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(cookieData))

      await cookieManager.loadAndInject(mockDriver, 'test.json')

      expect(readFile).toHaveBeenCalledWith('test.json', 'utf-8')
      expect(mockDriver.getPage).toHaveBeenCalled()
    })

    it('should filter out expired cookies before injection', async () => {
      const expiredCookieData = {
        cookies: [
          {
            name: 'expired-cookie',
            value: 'test-value',
            domain: '.example.com',
            path: '/',
            expires: Date.now() / 1000 - 3600, // Expired
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
          },
          ...mockCookies, // Valid cookies
        ],
        savedAt: new Date().toISOString(),
      }

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(expiredCookieData))

      await cookieManager.loadAndInject(mockDriver, 'test.json')

      expect(mockDriver.getPage).toHaveBeenCalled()
    })

    it('should throw error if all cookies are expired', async () => {
      const allExpiredData = {
        cookies: [
          {
            name: 'expired-cookie',
            value: 'test-value',
            domain: '.example.com',
            path: '/',
            expires: Date.now() / 1000 - 3600,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        savedAt: new Date().toISOString(),
      }

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(allExpiredData))

      await expect(cookieManager.loadAndInject(mockDriver, 'test.json')).rejects.toThrow(
        'All cookies are expired or invalid'
      )
    })
  })
})
