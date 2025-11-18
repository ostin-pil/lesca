/* eslint-disable @typescript-eslint/no-non-null-assertion */
// Non-null assertions in this file are safe because they're always preceded by ensureLaunched()
// which performs runtime checks. TypeScript cannot infer this relationship statically.

import { BrowserError } from '@lesca/error'
import { chromium, type Browser, type Page, type Cookie } from 'playwright'

import type {
  BrowserDriver,
  BrowserLaunchOptions,
  AuthCredentials,
} from '../../../shared/types/src/index.js'

/**
 * Playwright browser driver
 * Provides headless browser automation for JavaScript-rendered content
 */
export class PlaywrightDriver implements BrowserDriver {
  private browser?: Browser
  private page?: Page
  private isLaunched = false

  constructor(private auth?: AuthCredentials) {}

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
    } = options

    // Launch browser
    this.browser = await chromium.launch({
      headless,
      timeout,
    })

    // Create page
    this.page = await this.browser.newPage({
      viewport,
      userAgent:
        userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })

    // Set default timeout
    this.page.setDefaultTimeout(timeout)

    // Block unnecessary resources for performance
    if (blockResources.length > 0) {
      await this.page.route('**/*', async (route) => {
        const resourceType = route.request().resourceType()
        if (blockResources.includes(resourceType)) {
          await route.abort()
        } else {
          await route.continue()
        }
      })
    }

    // Inject authentication cookies if provided
    if (this.auth) {
      await this.injectCookies()
    }

    this.isLaunched = true
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<void> {
    this.ensureLaunched()

    await this.page!.goto(url, {
      waitUntil: 'domcontentloaded', // Wait for DOM to be ready
    })
  }

  /**
   * Wait for a selector to appear
   */
  async waitForSelector(selector: string, timeout?: number): Promise<void> {
    this.ensureLaunched()

    await this.page!.waitForSelector(selector, {
      timeout: timeout || 30000,
      state: 'visible',
    })
  }

  /**
   * Extract content using a selector
   */
  async extractContent(selector: string): Promise<string> {
    this.ensureLaunched()

    const element = await this.page!.waitForSelector(selector)
    if (!element) {
      throw new BrowserError(
        'BROWSER_SELECTOR_NOT_FOUND',
        `Element not found: ${selector}`,
        { context: { selector } }
      )
    }

    const content = await element.textContent()
    return content || ''
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

    const element = await this.page!.waitForSelector(selector)
    if (!element) {
      throw new BrowserError(
        'BROWSER_SELECTOR_NOT_FOUND',
        `Element not found: ${selector}`,
        { context: { selector } }
      )
    }

    const html = await element.innerHTML()
    return html
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
    if (this.page) {
      await this.page.close()
      delete this.page
    }

    if (this.browser) {
      await this.browser.close()
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
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Browser not launched. Call launch() first.'
      )
    }
  }

  /**
   * Inject authentication cookies
   */
  private async injectCookies(): Promise<void> {
    if (!this.auth || !this.page) {
      return
    }

    // Convert our cookie format to Playwright format
    const cookies: Cookie[] = this.auth.cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      expires: cookie.expires ? cookie.expires / 1000 : -1, // Playwright uses seconds
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
        // Try next selector
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
}
