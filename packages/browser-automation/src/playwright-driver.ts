/* eslint-disable @typescript-eslint/no-non-null-assertion */
// Non-null assertions in this file are safe because they're always preceded by ensureLaunched()
// which performs runtime checks. TypeScript cannot infer this relationship statically.

import { BrowserError, BrowserTimeoutError } from '@lesca/error'
import type { BrowserDriver, BrowserLaunchOptions, AuthCredentials } from '@lesca/shared/types'
import { logger } from '@lesca/shared/utils'
import { chromium, type Browser, type Page, type Cookie } from 'playwright'

import type { CookieManager } from './cookie-manager'
import { RequestInterceptor } from './interceptor'
import type { IBrowserPool, ISessionPoolManager } from './interfaces'
import { PerformanceMonitor, type PerformanceMetrics } from './performance'

/**
 * Playwright browser driver
 * Provides headless browser automation for JavaScript-rendered content
 */
export class PlaywrightDriver implements BrowserDriver {
  private browser?: Browser
  private page?: Page
  private isLaunched = false
  private pool?: IBrowserPool | ISessionPoolManager
  private sessionName?: string
  private cookieManager?: CookieManager
  private interceptor?: RequestInterceptor
  private performanceMonitor?: PerformanceMonitor

  constructor(
    private auth?: AuthCredentials,
    pool?: IBrowserPool | ISessionPoolManager,
    sessionName?: string
  ) {
    if (pool !== undefined) {
      this.pool = pool
    }
    if (sessionName !== undefined) {
      this.sessionName = sessionName
    }
  }

  /**
   * Launch the browser
   */
  async launch(options: BrowserLaunchOptions = {}): Promise<void> {
    if (this.isLaunched) {
      return // Already launched
    }

    const {
      headless = true,
      timeout = 30000,
      viewport = { width: 1920, height: 1080 },
      userAgent,
      blockResources = [],
      interception,
    } = options

    try {
      // Acquire browser from pool if available
      if (this.pool !== undefined) {
        if ('acquireBrowser' in this.pool) {
          // SessionPoolManager
          if (this.sessionName !== undefined) {
            this.browser = await this.pool.acquireBrowser(this.sessionName)
            logger.debug('Acquired browser from SessionPoolManager', { session: this.sessionName })
          } else {
            throw new BrowserError(
              'BROWSER_LAUNCH_FAILED',
              'SessionPoolManager requires a session name'
            )
          }
        } else if ('acquire' in this.pool) {
          // BrowserPool
          this.browser = await this.pool.acquire()
          logger.debug('Acquired browser from BrowserPool')
        }
      } else if (!this.browser) {
        // No pool, create new browser
        this.browser = await chromium.launch({
          headless,
          timeout,
        })
      }

      if (!this.browser) {
        throw new BrowserError('BROWSER_LAUNCH_FAILED', 'Failed to acquire or create browser')
      }

      this.page = await this.browser.newPage({
        viewport,
        userAgent:
          userAgent ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      })

      this.page.setDefaultTimeout(timeout)

      // Setup Interceptor
      if (interception?.enabled || blockResources.length > 0) {
        this.interceptor = new RequestInterceptor({
          blockResources: [...blockResources, ...(interception?.blockResources || [])],
          ...(interception?.capturePattern
            ? { capturePattern: new RegExp(interception.capturePattern) }
            : {}),
          ...(interception?.captureResponses !== undefined
            ? { captureResponses: interception.captureResponses }
            : {}),
        })
        await this.interceptor.attach(this.page)
      }

      // Setup Performance Monitor
      if (options.monitoring?.enabled) {
        this.performanceMonitor = new PerformanceMonitor()
        this.performanceMonitor.startMonitoring(this.page)
      }

      // Inject authentication cookies if provided
      if (this.auth) {
        await this.injectCookies()
      }

      this.isLaunched = true
    } catch (error) {
      throw new BrowserError('BROWSER_LAUNCH_FAILED', 'Failed to launch browser', {
        cause: error as Error,
      })
    }
  }

  /**
   * Navigate to a URL with retry logic
   */
  async navigate(url: string, retries = 3): Promise<void> {
    this.ensureLaunched()

    let lastError: Error | undefined
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.page!.goto(url, {
          waitUntil: 'domcontentloaded',
        })
        return
      } catch (error) {
        lastError = error as Error
        logger.warn(`Navigation failed (attempt ${attempt}/${retries}): ${url}`, { error })
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    throw new BrowserError(
      'BROWSER_NAVIGATION_FAILED',
      `Failed to navigate to ${url} after ${retries} attempts`,
      { ...(lastError instanceof Error ? { cause: lastError } : {}), context: { url } }
    )
  }

  /**
   * Wait for a selector to appear
   */
  async waitForSelector(selector: string, timeout?: number): Promise<void> {
    this.ensureLaunched()

    try {
      await this.page!.waitForSelector(selector, {
        timeout: timeout || 30000,
        state: 'visible',
      })
    } catch (error) {
      throw new BrowserTimeoutError(`Timeout waiting for selector: ${selector}`, {
        ...(error instanceof Error ? { cause: error } : {}),
        context: { selector, timeout },
      })
    }
  }

  /**
   * Extract content using a selector
   */
  async extractContent(selector: string): Promise<string> {
    this.ensureLaunched()

    try {
      const element = await this.page!.waitForSelector(selector)
      if (!element) {
        throw new BrowserError('BROWSER_SELECTOR_NOT_FOUND', 'Element not found', {
          context: { selector },
        })
      }
      const content = await element.textContent()
      return content || ''
    } catch (error) {
      throw new BrowserError('BROWSER_SELECTOR_NOT_FOUND', `Element not found: ${selector}`, {
        cause: error as Error,
        context: { selector },
      })
    }
  }

  /**
   * Extract all matching elements
   */
  async extractAll(selector: string): Promise<string[]> {
    this.ensureLaunched()

    const elements = await this.page!.$$(selector)
    const contents: string[] = []

    for (const element of elements) {
      const text = await element.textContent()
      if (text) {
        contents.push(text)
      }
    }

    return contents
  }

  /**
   * Execute JavaScript in the browser
   */
  async evaluate<T>(script: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T> {
    this.ensureLaunched()

    if (typeof script === 'string') {
      return (await this.page!.evaluate(script)) as T
    }

    return await this.page!.evaluate(script, ...args)
  }

  /**
   * Get HTML content of an element
   */
  async getHtml(selector: string): Promise<string> {
    this.ensureLaunched()

    try {
      const element = await this.page!.waitForSelector(selector)
      if (!element) {
        throw new BrowserError('BROWSER_SELECTOR_NOT_FOUND', 'Element not found', {
          context: { selector },
        })
      }
      return await element.innerHTML()
    } catch (error) {
      throw new BrowserError('BROWSER_SELECTOR_NOT_FOUND', `Element not found: ${selector}`, {
        cause: error as Error,
        context: { selector },
      })
    }
  }

  /**
   * Get HTML content of entire page
   */
  async getPageHtml(): Promise<string> {
    this.ensureLaunched()

    return await this.page!.content()
  }

  /**
   * Take a screenshot (useful for debugging)
   */
  async screenshot(path: string): Promise<void> {
    this.ensureLaunched()

    await this.page!.screenshot({ path, fullPage: true })
  }

  /**
   * Click an element
   */
  async click(selector: string): Promise<void> {
    this.ensureLaunched()

    await this.page!.click(selector)
  }

  /**
   * Type text into an input
   */
  async type(selector: string, text: string): Promise<void> {
    this.ensureLaunched()

    await this.page!.type(selector, text)
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(timeout?: number): Promise<void> {
    this.ensureLaunched()

    await this.page!.waitForLoadState('domcontentloaded', {
      timeout: timeout || 30000,
    })
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.performanceMonitor) {
      await this.performanceMonitor.stopMonitoring()
    }

    if (this.cookieManager && this.isLaunched) {
      await this.cookieManager.autoSave(this)
    }

    if (this.page) {
      await this.page.close()
      delete this.page
    }

    // Release browser back to pool or close it
    if (this.browser) {
      if (this.pool) {
        // Release to pool
        if ('releaseBrowser' in this.pool && this.sessionName) {
          // SessionPoolManager
          await this.pool.releaseBrowser(this.browser, this.sessionName)
          logger.debug('Released browser to SessionPoolManager', { session: this.sessionName })
        } else if ('release' in this.pool) {
          // BrowserPool
          await this.pool.release(this.browser)
          logger.debug('Released browser to BrowserPool')
        }
      } else {
        // No pool, close browser directly
        await this.browser.close()
      }
      delete this.browser
    }

    this.isLaunched = false
  }

  /**
   * Check if browser is launched
   * After calling this method, this.page and this.browser are guaranteed to be defined
   */
  private ensureLaunched(): void {
    if (!this.isLaunched || !this.page || !this.browser) {
      throw new BrowserError('BROWSER_LAUNCH_FAILED', 'Browser not launched. Call launch() first.')
    }
  }

  /**
   * Inject authentication cookies
   */
  private async injectCookies(): Promise<void> {
    if (!this.auth || !this.page) {
      return
    }

    const cookies: Cookie[] = this.auth.cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      expires: cookie.expires ? cookie.expires / 1000 : -1,
      httpOnly: cookie.httpOnly || false,
      secure: cookie.secure || false,
      sameSite: 'Lax' as const,
    }))

    await this.page.context().addCookies(cookies)
  }

  /**
   * Get current page (for advanced usage)
   */
  getPage(): Page | undefined {
    return this.page
  }

  /**
   * Get browser instance (for advanced usage)
   */
  getBrowser(): Browser | undefined {
    return this.browser
  }

  /**
   * Wait for specific network request
   */
  async waitForRequest(urlPattern: string | RegExp, timeout?: number): Promise<void> {
    this.ensureLaunched()

    await this.page!.waitForRequest(urlPattern, {
      timeout: timeout || 30000,
    })
  }

  /**
   * Wait for specific network response
   */
  async waitForResponse(urlPattern: string | RegExp, timeout?: number): Promise<void> {
    this.ensureLaunched()

    await this.page!.waitForResponse(urlPattern, {
      timeout: timeout || 30000,
    })
  }

  /**
   * Execute multiple selectors with fallback
   */
  async extractWithFallback(selectors: string[]): Promise<string> {
    this.ensureLaunched()

    for (const selector of selectors) {
      try {
        const element = await this.page!.$(selector)
        if (element) {
          const text = await element.textContent()
          if (text && text.trim().length > 0) {
            return text.trim()
          }
        }
      } catch {
        continue
      }
    }

    throw new BrowserError(
      'BROWSER_SELECTOR_NOT_FOUND',
      `No content found with any of the selectors: ${selectors.join(', ')}`,
      { context: { selectors } }
    )
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    this.ensureLaunched()

    try {
      const element = await this.page!.$(selector)
      return element !== null
    } catch {
      return false
    }
  }

  /**
   * Set cookie manager for auto-save functionality
   */
  setCookieManager(manager: CookieManager): void {
    this.cookieManager = manager
  }

  /**
   * Get cookie manager
   */
  getCookieManager(): CookieManager | undefined {
    return this.cookieManager
  }

  /**
   * Get captured responses from interceptor
   */
  getCapturedResponses(): Map<string, unknown> {
    return this.interceptor ? this.interceptor.getCapturedResponses() : new Map<string, unknown>()
  }

  /**
   * Clear captured responses
   */
  clearCapturedResponses(): void {
    if (this.interceptor) {
      this.interceptor.clearCapturedResponses()
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics | undefined {
    return this.performanceMonitor ? this.performanceMonitor.getMetrics() : undefined
  }
}
