import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'

import { logger } from '@/shared/utils/src/index'
import { BrowserError } from '@lesca/error'
import type { Cookie } from 'playwright'

import type { PlaywrightDriver } from './playwright-driver'

/**
 * Cookie validation result
 */
export interface CookieValidationResult {
  valid: boolean
  expired: Cookie[]
  missing: string[]
  warnings: string[]
}

/**
 * Cookie merge strategy
 */
export type MergeStrategy = 'keep-existing' | 'prefer-fresh' | 'merge-all'

/**
 * Cookie file format (same as auth package for compatibility)
 */
interface CookieFile {
  cookies: Cookie[]
  csrfToken?: string
  savedAt?: string
}

/**
 * Cookie Manager
 * Enhanced cookie management with validation, merging, and auto-save capabilities
 */
export class CookieManager {
  private autoSaveEnabled = false
  private autoSavePath?: string

  /**
   * Extract and save cookies from browser driver
   */
  async saveCookies(driver: PlaywrightDriver, path: string): Promise<void> {
    logger.debug('Saving cookies from browser', { path })

    const page = driver.getPage()
    if (!page) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Cannot save cookies: browser not initialized'
      )
    }

    try {
      const context = page.context()
      const cookies = await context.cookies()

      const csrfCookie = cookies.find(
        (c) => c.name === 'csrftoken' || c.name === 'csrf_token'
      )

      const data: CookieFile = {
        cookies,
        ...(csrfCookie?.value !== undefined && { csrfToken: csrfCookie.value }),
        savedAt: new Date().toISOString(),
      }

      await mkdir(dirname(path), { recursive: true })

      await writeFile(path, JSON.stringify(data, null, 2), 'utf-8')

      logger.info(`Saved ${cookies.length} cookies to ${path}`)
    } catch (error) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Failed to save cookies',
        { cause: error as Error, context: { path } }
      )
    }
  }

  /**
   * Load cookies from file
   */
  async loadCookies(path: string): Promise<Cookie[]> {
    logger.debug('Loading cookies from file', { path })

    try {
      const content = await readFile(path, 'utf-8')
      const data = JSON.parse(content) as CookieFile

      if (!data.cookies || !Array.isArray(data.cookies)) {
        throw new BrowserError(
          'BROWSER_LAUNCH_FAILED',
          'Invalid cookie file format: missing or invalid cookies array',
          { context: { path } }
        )
      }

      logger.info(`Loaded ${data.cookies.length} cookies from ${path}`)
      return data.cookies
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new BrowserError(
          'BROWSER_LAUNCH_FAILED',
          `Cookie file not found: ${path}`,
          { context: { path } }
        )
      }

      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Failed to load cookies',
        { cause: error as Error, context: { path } }
      )
    }
  }

  /**
   * Validate cookies - check for expiration and required fields
   */
  validateCookies(
    cookies: Cookie[],
    requiredCookies: string[] = ['LEETCODE_SESSION', 'csrftoken']
  ): CookieValidationResult {
    const result: CookieValidationResult = {
      valid: true,
      expired: [],
      missing: [],
      warnings: [],
    }

    const now = Date.now() / 1000 // Playwright uses seconds

    for (const cookie of cookies) {
      if (cookie.expires && cookie.expires !== -1 && cookie.expires < now) {
        result.expired.push(cookie)
        result.warnings.push(`Cookie '${cookie.name}' has expired`)
      }
    }

    const cookieNames = cookies.map((c) => c.name.toLowerCase())
    for (const required of requiredCookies) {
      if (!cookieNames.includes(required.toLowerCase())) {
        result.missing.push(required)
        result.warnings.push(`Required cookie '${required}' is missing`)
      }
    }

    // Cookie is valid only if no cookies expired and all required cookies present
    result.valid = result.expired.length === 0 && result.missing.length === 0

    if (!result.valid) {
      logger.warn('Cookie validation failed', {
        expired: result.expired.length,
        missing: result.missing,
      })
    }

    return result
  }

  /**
   * Refresh cookies from browser - extracts current cookies and validates them
   */
  async refreshCookies(driver: PlaywrightDriver): Promise<Cookie[]> {
    logger.debug('Refreshing cookies from browser')

    const page = driver.getPage()
    if (!page) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Cannot refresh cookies: browser not initialized'
      )
    }

    try {
      const context = page.context()
      const cookies = await context.cookies()

      const validation = this.validateCookies(cookies)
      if (!validation.valid) {
        logger.warn('Refreshed cookies failed validation', {
          warnings: validation.warnings,
        })
      }

      logger.info(`Refreshed ${cookies.length} cookies from browser`)
      return cookies
    } catch (error) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Failed to refresh cookies',
        { cause: error as Error }
      )
    }
  }

  /**
   * Merge cookies using specified strategy
   *
   * Strategies:
   * - keep-existing: Prefer cookies from existing array, only add new ones from fresh
   * - prefer-fresh: Prefer cookies from fresh array, replace existing ones
   * - merge-all: Keep all cookies, with fresh values taking precedence for duplicates
   */
  mergeCookies(
    existing: Cookie[],
    fresh: Cookie[],
    strategy: MergeStrategy = 'prefer-fresh'
  ): Cookie[] {
    logger.debug('Merging cookies', {
      existingCount: existing.length,
      freshCount: fresh.length,
      strategy,
    })

    const merged = new Map<string, Cookie>()

    const getCookieKey = (cookie: Cookie): string =>
      `${cookie.name}|${cookie.domain}|${cookie.path || '/'}`

    // Apply strategy
    if (strategy === 'keep-existing') {
      // Add all existing cookies first
      for (const cookie of existing) {
        merged.set(getCookieKey(cookie), cookie)
      }
      // Add fresh cookies only if they don't exist
      for (const cookie of fresh) {
        const key = getCookieKey(cookie)
        if (!merged.has(key)) {
          merged.set(key, cookie)
        }
      }
    } else if (strategy === 'prefer-fresh') {
      // Add all existing cookies first
      for (const cookie of existing) {
        merged.set(getCookieKey(cookie), cookie)
      }
      // Overwrite with fresh cookies
      for (const cookie of fresh) {
        merged.set(getCookieKey(cookie), cookie)
      }
    } else if (strategy === 'merge-all') {
      // Keep all cookies, but prefer fresh for duplicates
      for (const cookie of existing) {
        merged.set(getCookieKey(cookie), cookie)
      }
      for (const cookie of fresh) {
        const key = getCookieKey(cookie)
        const existingCookie = merged.get(key)

        // Prefer the cookie with later expiration
        if (existingCookie) {
          const existingExpiry = existingCookie.expires || 0
          const freshExpiry = cookie.expires || 0

          if (freshExpiry > existingExpiry) {
            merged.set(key, cookie)
          }
        } else {
          merged.set(key, cookie)
        }
      }
    }

    const result = Array.from(merged.values())
    logger.debug(`Merged cookies result: ${result.length} total cookies`)

    return result
  }

  /**
   * Enable auto-save functionality
   * When enabled, cookies will be automatically saved to the specified path
   */
  enableAutoSave(path: string): void {
    this.autoSaveEnabled = true
    this.autoSavePath = path
    logger.info('Auto-save enabled', { path })
  }

  /**
   * Disable auto-save functionality
   */
  disableAutoSave(): void {
    this.autoSaveEnabled = false
    delete this.autoSavePath
    logger.info('Auto-save disabled')
  }

  /**
   * Check if auto-save is enabled
   */
  isAutoSaveEnabled(): boolean {
    return this.autoSaveEnabled
  }

  /**
   * Get auto-save path
   */
  getAutoSavePath(): string | undefined {
    return this.autoSavePath
  }

  /**
   * Auto-save cookies if enabled
   * This should be called by PlaywrightDriver.close() or other lifecycle hooks
   */
  async autoSave(driver: PlaywrightDriver): Promise<void> {
    if (!this.autoSaveEnabled || !this.autoSavePath) {
      return
    }

    logger.debug('Auto-saving cookies', { path: this.autoSavePath })

    try {
      await this.saveCookies(driver, this.autoSavePath)
    } catch (error) {
      // Don't throw on auto-save failure, just log it
      logger.warn('Auto-save failed', { path: this.autoSavePath })
    }
  }

  /**
   * Load and inject cookies into browser driver
   */
  async loadAndInject(driver: PlaywrightDriver, path: string): Promise<void> {
    logger.debug('Loading and injecting cookies', { path })

    const cookies = await this.loadCookies(path)
    const validation = this.validateCookies(cookies)

    if (!validation.valid) {
      logger.warn('Loaded cookies failed validation', {
        warnings: validation.warnings,
      })

      const validCookies = cookies.filter(
        (c) => !validation.expired.some((expired) => expired.name === c.name)
      )

      if (validCookies.length === 0) {
        throw new BrowserError(
          'BROWSER_LAUNCH_FAILED',
          'All cookies are expired or invalid',
          { context: { path, validation } }
        )
      }

      await this.injectCookies(driver, validCookies)
    } else {
      await this.injectCookies(driver, cookies)
    }
  }

  /**
   * Inject cookies into browser context
   */
  async injectCookies(driver: PlaywrightDriver, cookies: Cookie[]): Promise<void> {
    logger.debug('Injecting cookies into browser', { count: cookies.length })

    const page = driver.getPage()
    if (!page) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Cannot inject cookies: browser not initialized'
      )
    }

    try {
      const context = page.context()
      await context.addCookies(cookies)
      logger.info(`Injected ${cookies.length} cookies into browser`)
    } catch (error) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Failed to inject cookies',
        { cause: error as Error }
      )
    }
  }

  /**
   * Clear all cookies from browser context
   */
  async clearCookies(driver: PlaywrightDriver): Promise<void> {
    logger.debug('Clearing all cookies from browser')

    const page = driver.getPage()
    if (!page) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Cannot clear cookies: browser not initialized'
      )
    }

    try {
      const context = page.context()
      await context.clearCookies()
      logger.info('Cleared all cookies from browser')
    } catch (error) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Failed to clear cookies',
        { cause: error as Error }
      )
    }
  }

  /**
   * Get specific cookie by name
   */
  async getCookie(driver: PlaywrightDriver, name: string): Promise<Cookie | null> {
    const page = driver.getPage()
    if (!page) {
      return null
    }

    const context = page.context()
    const cookies = await context.cookies()
    return cookies.find((c) => c.name === name) || null
  }

  /**
   * Update or add a specific cookie
   */
  async setCookie(driver: PlaywrightDriver, cookie: Cookie): Promise<void> {
    logger.debug('Setting cookie', { name: cookie.name })

    const page = driver.getPage()
    if (!page) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Cannot set cookie: browser not initialized'
      )
    }

    try {
      const context = page.context()
      await context.addCookies([cookie])
      logger.debug(`Set cookie: ${cookie.name}`)
    } catch (error) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Failed to set cookie',
        { cause: error as Error, context: { cookieName: cookie.name } }
      )
    }
  }
}
