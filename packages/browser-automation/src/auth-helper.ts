import { BrowserError } from '@lesca/error'
import { logger } from '@lesca/shared/utils'
import type { Cookie } from 'playwright'

import type { CookieManager } from './cookie-manager'
import { detectLoginState, detectCaptcha, type LoginState } from './detectors'
import type { IRateLimitManager } from './interfaces'
import type { PlaywrightDriver } from './playwright-driver'

/**
 * Login credentials
 */
export interface LoginCredentials {
  username: string
  password: string
}

/**
 * Login options
 */
export interface LoginOptions {
  /** Maximum time to wait for login (ms) */
  timeout?: number
  /** Save cookies after successful login */
  saveCookies?: boolean
  /** Path to save cookies */
  cookiePath?: string
  /** Wait for specific selector after login */
  waitForSelector?: string
}

/**
 * Login result
 */
export interface LoginResult {
  success: boolean
  state: LoginState
  cookies?: Cookie[]
  message?: string
}

/**
 * Auth Helper Options
 */
export interface AuthHelperOptions {
  /** Cookie manager for persistence */
  cookieManager?: CookieManager
  /** Rate limit manager for intelligent rate limit handling */
  rateLimitManager?: IRateLimitManager
  /** Session name for rate limit tracking */
  sessionName?: string
}

/**
 * Auth Helper
 * Provides interactive login flows and authentication state management
 */
export class AuthHelper {
  private readonly loginUrl = 'https://leetcode.com/accounts/login/'
  private readonly profileUrl = 'https://leetcode.com/profile/'
  private cookieManager?: CookieManager
  private rateLimitManager?: IRateLimitManager
  private sessionName?: string

  constructor(
    private driver: PlaywrightDriver,
    options?: AuthHelperOptions
  ) {
    if (options?.cookieManager) {
      this.cookieManager = options.cookieManager
    }
    if (options?.rateLimitManager) {
      this.rateLimitManager = options.rateLimitManager
    }
    if (options?.sessionName) {
      this.sessionName = options.sessionName
    }
  }

  /**
   * Perform interactive login to LeetCode
   */
  async login(credentials: LoginCredentials, options: LoginOptions = {}): Promise<LoginResult> {
    const { timeout = 60000, saveCookies = true, cookiePath, waitForSelector } = options

    logger.info('Starting interactive login to LeetCode')

    try {
      await this.driver.navigate(this.loginUrl)
      logger.debug('Navigated to login page')

      await this.driver.waitForSelector('input[name="login"]', timeout)

      const hasCaptcha = await detectCaptcha(this.driver)
      if (hasCaptcha) {
        logger.warn('CAPTCHA detected on login page')
        return {
          success: false,
          state: 'captcha',
          message: 'CAPTCHA detected. Please solve it manually or use cookie-based authentication.',
        }
      }

      logger.debug('Filling login credentials')
      await this.driver.type('input[name="login"]', credentials.username)
      await this.driver.type('input[name="password"]', credentials.password)

      logger.debug('Submitting login form')
      await this.driver.click('button[type="submit"]')

      await this.driver.waitForNavigation(timeout)

      const state = await detectLoginState(this.driver)
      logger.debug('Login state detected', { state })

      if (state === 'logged-in') {
        logger.info('Login successful')

        // Record success with rate limit manager
        if (this.rateLimitManager) {
          this.rateLimitManager.recordSuccess(this.loginUrl, this.sessionName)
        }

        if (waitForSelector) {
          await this.driver.waitForSelector(waitForSelector, timeout)
        }

        const page = this.driver.getPage()
        const cookies = page ? await page.context().cookies() : []

        if (saveCookies && cookiePath && this.cookieManager) {
          await this.cookieManager.saveCookies(this.driver, cookiePath)
          logger.info('Cookies saved after successful login', { path: cookiePath })
        }

        return {
          success: true,
          state: 'logged-in',
          cookies,
          message: 'Login successful',
        }
      } else if (state === 'captcha') {
        return {
          success: false,
          state: 'captcha',
          message: 'CAPTCHA required. Please solve it and try again.',
        }
      } else if (state === 'rate-limited') {
        // Record rate limit with manager
        if (this.rateLimitManager) {
          this.rateLimitManager.recordRateLimited(this.loginUrl, undefined, this.sessionName)
        }

        return {
          success: false,
          state: 'rate-limited',
          message: 'Rate limited. Please wait and try again later.',
        }
      } else {
        return {
          success: false,
          state: 'logged-out',
          message: 'Login failed. Please check your credentials.',
        }
      }
    } catch (error) {
      logger.error('Login failed with error')
      throw new BrowserError('BROWSER_NAVIGATION_FAILED', 'Interactive login failed', {
        cause: error as Error,
      })
    }
  }

  /**
   * Check if currently logged in
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      const state = await detectLoginState(this.driver)
      return state === 'logged-in'
    } catch (error) {
      logger.warn('Failed to check login state')
      return false
    }
  }

  /**
   * Verify authentication by checking if user can access profile
   */
  async verifyAuthentication(): Promise<boolean> {
    logger.debug('Verifying authentication')

    try {
      await this.driver.navigate(this.profileUrl)

      const isLoggedIn = await this.isLoggedIn()

      if (isLoggedIn) {
        logger.info('Authentication verified successfully')
      } else {
        logger.warn('Authentication verification failed')
      }

      return isLoggedIn
    } catch (error) {
      logger.error('Authentication verification error')
      return false
    }
  }

  /**
   * Wait for manual login completion
   * Useful for CAPTCHA or 2FA scenarios
   */
  async waitForManualLogin(timeout = 300000): Promise<LoginResult> {
    logger.info('Waiting for manual login completion', { timeout })

    const startTime = Date.now()

    try {
      await this.driver.navigate(this.loginUrl)

      while (Date.now() - startTime < timeout) {
        const state = await detectLoginState(this.driver)

        if (state === 'logged-in') {
          logger.info('Manual login completed successfully')

          const page = this.driver.getPage()
          const cookies = page ? await page.context().cookies() : []

          return {
            success: true,
            state: 'logged-in',
            cookies,
            message: 'Manual login completed',
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      // Timeout
      logger.warn('Manual login timeout')
      return {
        success: false,
        state: 'logged-out',
        message: 'Manual login timeout. Please try again.',
      }
    } catch (error) {
      logger.error('Manual login wait failed')
      throw new BrowserError('BROWSER_NAVIGATION_FAILED', 'Failed while waiting for manual login', {
        cause: error as Error,
      })
    }
  }

  /**
   * Logout from LeetCode
   */
  async logout(): Promise<void> {
    logger.info('Logging out from LeetCode')

    try {
      if (this.cookieManager) {
        await this.cookieManager.clearCookies(this.driver)
      }

      logger.info('Logout successful')
    } catch (error) {
      logger.error('Logout failed')
      throw new BrowserError('BROWSER_NAVIGATION_FAILED', 'Logout failed', {
        cause: error as Error,
      })
    }
  }

  /**
   * Handle login with retry logic
   */
  async loginWithRetry(
    credentials: LoginCredentials,
    options: LoginOptions = {},
    maxRetries = 3
  ): Promise<LoginResult> {
    let lastResult: LoginResult | undefined

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`Login attempt ${attempt}/${maxRetries}`)

      // Check rate limit decision before attempting
      if (this.rateLimitManager) {
        const decision = this.rateLimitManager.getDecision(this.loginUrl, this.sessionName)
        if (decision.delayMs > 0) {
          logger.debug(`Rate limit: waiting ${decision.delayMs}ms before login attempt`, {
            reason: decision.reason,
          })
          await new Promise((resolve) => setTimeout(resolve, decision.delayMs))
        }
      }

      try {
        const result = await this.login(credentials, options)

        if (result.success) {
          return result
        }

        lastResult = result

        if (result.state === 'captcha' || result.state === 'rate-limited') {
          logger.warn(`Login failed with ${result.state}, not retrying`)
          return result
        }

        if (attempt < maxRetries) {
          const delay = attempt * 2000 // Exponential backoff
          logger.debug(`Waiting ${delay}ms before retry`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      } catch (error) {
        logger.error(`Login attempt ${attempt} failed with error`)

        if (attempt === maxRetries) {
          throw error
        }
      }
    }

    return (
      lastResult || {
        success: false,
        state: 'logged-out',
        message: 'All login attempts failed',
      }
    )
  }

  /**
   * Get the rate limit manager (if configured)
   */
  getRateLimitManager(): IRateLimitManager | undefined {
    return this.rateLimitManager
  }

  /**
   * Set rate limit manager for intelligent rate limit handling
   */
  setRateLimitManager(manager: IRateLimitManager): void {
    this.rateLimitManager = manager
  }
}
