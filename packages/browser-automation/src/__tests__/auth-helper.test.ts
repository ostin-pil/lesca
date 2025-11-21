import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthHelper } from '../auth-helper'
import { CookieManager } from '../cookie-manager'
import { PlaywrightDriver } from '../playwright-driver'
import * as detectors from '../detectors'
import type { Cookie } from 'playwright'

vi.mock('../detectors.js', () => ({
  detectLoginState: vi.fn(),
  detectCaptcha: vi.fn(),
  detectRateLimit: vi.fn(),
}))

describe('AuthHelper', () => {
  let authHelper: AuthHelper
  let mockDriver: PlaywrightDriver
  let mockCookieManager: CookieManager

  const mockCookies: Cookie[] = [
    {
      name: 'LEETCODE_SESSION',
      value: 'test-session',
      domain: '.leetcode.com',
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]

  beforeEach(() => {
    // Create mock driver
    mockDriver = {
      navigate: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      waitForNavigation: vi.fn().mockResolvedValue(undefined),
      getPage: vi.fn(() => ({
        context: vi.fn(() => ({
          cookies: vi.fn().mockResolvedValue(mockCookies),
        })),
      })),
    } as unknown as PlaywrightDriver

    // Create mock cookie manager
    mockCookieManager = {
      saveCookies: vi.fn().mockResolvedValue(undefined),
      clearCookies: vi.fn().mockResolvedValue(undefined),
    } as unknown as CookieManager

    authHelper = new AuthHelper(mockDriver, mockCookieManager)

    // Reset mocks
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(false)
      vi.mocked(detectors.detectLoginState).mockResolvedValue('logged-in')

      const result = await authHelper.login({
        username: 'test@example.com',
        password: 'test-password',
      })

      expect(result.success).toBe(true)
      expect(result.state).toBe('logged-in')
      expect(mockDriver.navigate).toHaveBeenCalled()
      expect(mockDriver.type).toHaveBeenCalledTimes(2)
      expect(mockDriver.click).toHaveBeenCalled()
    })

    it('should detect CAPTCHA on login page', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(true)

      const result = await authHelper.login({
        username: 'test@example.com',
        password: 'test-password',
      })

      expect(result.success).toBe(false)
      expect(result.state).toBe('captcha')
      expect(result.message).toContain('CAPTCHA')
    })

    it('should detect CAPTCHA after login attempt', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(false)
      vi.mocked(detectors.detectLoginState).mockResolvedValue('captcha')

      const result = await authHelper.login({
        username: 'test@example.com',
        password: 'test-password',
      })

      expect(result.success).toBe(false)
      expect(result.state).toBe('captcha')
    })

    it('should detect rate limiting', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(false)
      vi.mocked(detectors.detectLoginState).mockResolvedValue('rate-limited')

      const result = await authHelper.login({
        username: 'test@example.com',
        password: 'test-password',
      })

      expect(result.success).toBe(false)
      expect(result.state).toBe('rate-limited')
    })

    it('should save cookies after successful login', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(false)
      vi.mocked(detectors.detectLoginState).mockResolvedValue('logged-in')

      const result = await authHelper.login(
        {
          username: 'test@example.com',
          password: 'test-password',
        },
        {
          saveCookies: true,
          cookiePath: '/path/to/cookies.json',
        }
      )

      expect(result.success).toBe(true)
      expect(mockCookieManager.saveCookies).toHaveBeenCalledWith(
        mockDriver,
        '/path/to/cookies.json'
      )
    })

    it('should not save cookies when saveCookies is false', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(false)
      vi.mocked(detectors.detectLoginState).mockResolvedValue('logged-in')

      await authHelper.login(
        {
          username: 'test@example.com',
          password: 'test-password',
        },
        {
          saveCookies: false,
        }
      )

      expect(mockCookieManager.saveCookies).not.toHaveBeenCalled()
    })

    it('should wait for custom selector after login', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(false)
      vi.mocked(detectors.detectLoginState).mockResolvedValue('logged-in')

      await authHelper.login(
        {
          username: 'test@example.com',
          password: 'test-password',
        },
        {
          waitForSelector: '.profile-avatar',
        }
      )

      expect(mockDriver.waitForSelector).toHaveBeenCalledWith('.profile-avatar', expect.any(Number))
    })

    it('should return cookies in result', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(false)
      vi.mocked(detectors.detectLoginState).mockResolvedValue('logged-in')

      const result = await authHelper.login({
        username: 'test@example.com',
        password: 'test-password',
      })

      expect(result.cookies).toBeDefined()
      expect(result.cookies).toHaveLength(1)
      expect(result.cookies?.[0]?.name).toBe('LEETCODE_SESSION')
    })
  })

  describe('isLoggedIn', () => {
    it('should return true when logged in', async () => {
      vi.mocked(detectors.detectLoginState).mockResolvedValue('logged-in')

      const result = await authHelper.isLoggedIn()

      expect(result).toBe(true)
    })

    it('should return false when logged out', async () => {
      vi.mocked(detectors.detectLoginState).mockResolvedValue('logged-out')

      const result = await authHelper.isLoggedIn()

      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      vi.mocked(detectors.detectLoginState).mockRejectedValue(new Error('Detection failed'))

      const result = await authHelper.isLoggedIn()

      expect(result).toBe(false)
    })
  })

  describe('verifyAuthentication', () => {
    it('should verify authentication successfully', async () => {
      vi.mocked(detectors.detectLoginState).mockResolvedValue('logged-in')

      const result = await authHelper.verifyAuthentication()

      expect(result).toBe(true)
      expect(mockDriver.navigate).toHaveBeenCalled()
    })

    it('should fail verification when not logged in', async () => {
      vi.mocked(detectors.detectLoginState).mockResolvedValue('logged-out')

      const result = await authHelper.verifyAuthentication()

      expect(result).toBe(false)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(detectors.detectLoginState).mockRejectedValue(new Error('Navigation failed'))

      const result = await authHelper.verifyAuthentication()

      expect(result).toBe(false)
    })
  })

  describe('waitForManualLogin', () => {
    it('should succeed when user completes login manually', async () => {
      vi.mocked(detectors.detectLoginState)
        .mockResolvedValueOnce('logged-out')
        .mockResolvedValueOnce('logged-in')

      const result = await authHelper.waitForManualLogin(10000)

      expect(result.success).toBe(true)
      expect(result.state).toBe('logged-in')
      expect(result.cookies).toBeDefined()
    })

    it('should timeout if login not completed', async () => {
      vi.mocked(detectors.detectLoginState).mockResolvedValue('logged-out')

      const result = await authHelper.waitForManualLogin(100) // Very short timeout

      expect(result.success).toBe(false)
      expect(result.state).toBe('logged-out')
      expect(result.message).toContain('timeout')
    })
  })

  describe('logout', () => {
    it('should clear cookies on logout', async () => {
      await authHelper.logout()

      expect(mockCookieManager.clearCookies).toHaveBeenCalledWith(mockDriver)
    })

    it('should handle logout without cookie manager', async () => {
      const helperWithoutCookieManager = new AuthHelper(mockDriver)

      await expect(helperWithoutCookieManager.logout()).resolves.not.toThrow()
    })
  })

  describe('loginWithRetry', () => {
    it('should succeed on first attempt', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(false)
      vi.mocked(detectors.detectLoginState).mockResolvedValue('logged-in')

      const result = await authHelper.loginWithRetry({
        username: 'test@example.com',
        password: 'test-password',
      })

      expect(result.success).toBe(true)
      expect(mockDriver.navigate).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(false)
      vi.mocked(detectors.detectLoginState)
        .mockResolvedValueOnce('logged-out')
        .mockResolvedValueOnce('logged-in')

      const result = await authHelper.loginWithRetry(
        {
          username: 'test@example.com',
          password: 'test-password',
        },
        {},
        2
      )

      expect(result.success).toBe(true)
      expect(mockDriver.navigate).toHaveBeenCalledTimes(2)
    })

    it('should not retry on CAPTCHA', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(true)

      const result = await authHelper.loginWithRetry(
        {
          username: 'test@example.com',
          password: 'test-password',
        },
        {},
        3
      )

      expect(result.success).toBe(false)
      expect(result.state).toBe('captcha')
      expect(mockDriver.navigate).toHaveBeenCalledTimes(1) // No retry
    })

    it('should not retry on rate limit', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(false)
      vi.mocked(detectors.detectLoginState).mockResolvedValue('rate-limited')

      const result = await authHelper.loginWithRetry(
        {
          username: 'test@example.com',
          password: 'test-password',
        },
        {},
        3
      )

      expect(result.success).toBe(false)
      expect(result.state).toBe('rate-limited')
      expect(mockDriver.navigate).toHaveBeenCalledTimes(1) // No retry
    })

    it('should fail after max retries', async () => {
      vi.mocked(detectors.detectCaptcha).mockResolvedValue(false)
      vi.mocked(detectors.detectLoginState).mockResolvedValue('logged-out')

      const result = await authHelper.loginWithRetry(
        {
          username: 'test@example.com',
          password: 'test-password',
        },
        {},
        3
      )

      expect(result.success).toBe(false)
      expect(mockDriver.navigate).toHaveBeenCalledTimes(3)
    }, 15000) // Increase timeout to account for retries with delays
  })
})
