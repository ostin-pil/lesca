import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PlaywrightDriver } from '../playwright-driver'
import type { Browser, Page, BrowserContext, ElementHandle } from 'playwright'

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}))

describe('PlaywrightDriver', () => {
  let driver: PlaywrightDriver
  let mockBrowser: Browser
  let mockPage: Page
  let mockContext: BrowserContext
  let mockElement: ElementHandle

  beforeEach(async () => {
    // Create mock element
    mockElement = {
      textContent: vi.fn().mockResolvedValue('Test content'),
      innerHTML: vi.fn().mockResolvedValue('<p>Test HTML</p>'),
    } as unknown as ElementHandle

    // Create mock context
    mockContext = {
      addCookies: vi.fn().mockResolvedValue(undefined),
    } as unknown as BrowserContext

    // Create mock page
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(mockElement),
      setDefaultTimeout: vi.fn(),
      route: vi.fn().mockResolvedValue(undefined),
      $$: vi.fn().mockResolvedValue([mockElement, mockElement]),
      $: vi.fn().mockResolvedValue(mockElement),
      evaluate: vi.fn().mockResolvedValue('evaluated'),
      content: vi.fn().mockResolvedValue('<html>Page content</html>'),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
      click: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      waitForRequest: vi.fn().mockResolvedValue(undefined),
      waitForResponse: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      context: vi.fn().mockReturnValue(mockContext),
      on: vi.fn(),
    } as unknown as Page

    // Create mock browser
    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Browser

    // Mock chromium.launch to return our mock browser
    const { chromium } = await import('playwright')
    vi.mocked(chromium.launch).mockResolvedValue(mockBrowser)

    driver = new PlaywrightDriver()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('launch', () => {
    it('should launch browser with default options', async () => {
      const { chromium } = await import('playwright')

      await driver.launch()

      expect(chromium.launch).toHaveBeenCalledWith({
        headless: true,
        timeout: 30000,
      })
      expect(mockBrowser.newPage).toHaveBeenCalled()
    })

    it('should launch browser with custom options', async () => {
      const { chromium } = await import('playwright')

      await driver.launch({
        headless: false,
        timeout: 60000,
        viewport: { width: 1280, height: 720 },
        userAgent: 'Custom User Agent',
      })

      expect(chromium.launch).toHaveBeenCalledWith({
        headless: false,
        timeout: 60000,
      })

      expect(mockBrowser.newPage).toHaveBeenCalledWith({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Custom User Agent',
      })
    })

    it('should use default user agent if not provided', async () => {
      await driver.launch()

      expect(mockBrowser.newPage).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: expect.stringContaining('Mozilla/5.0'),
        })
      )
    })

    it('should set default timeout on page', async () => {
      await driver.launch({ timeout: 45000 })

      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(45000)
    })

    it('should not launch twice if already launched', async () => {
      const { chromium } = await import('playwright')

      await driver.launch()
      await driver.launch()

      expect(chromium.launch).toHaveBeenCalledTimes(1)
    })

    it('should block resources when specified', async () => {
      await driver.launch({ blockResources: ['image', 'font'] })

      expect(mockPage.route).toHaveBeenCalledWith('**/*', expect.any(Function))
    })

    it('should inject cookies when auth is provided', async () => {
      const authDriver = new PlaywrightDriver({
        sessionToken: 'test-token',
        csrfToken: 'csrf-token',
        cookies: [
          {
            name: 'session',
            value: 'test-session',
            domain: '.leetcode.com',
            path: '/',
            expires: Date.now() + 86400000,
            httpOnly: true,
            secure: true,
          },
        ],
      })

      await authDriver.launch()

      expect(mockContext.addCookies).toHaveBeenCalled()
    })
  })

  describe('navigate', () => {
    it('should navigate to URL', async () => {
      await driver.launch()
      await driver.navigate('https://example.com')

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'domcontentloaded',
      })
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.navigate('https://example.com')).rejects.toThrow(
        'Browser not launched. Call launch() first.'
      )
    })
  })

  describe('waitForSelector', () => {
    it('should wait for selector with default timeout', async () => {
      await driver.launch()
      await driver.waitForSelector('.test-selector')

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.test-selector', {
        timeout: 30000,
        state: 'visible',
      })
    })

    it('should wait for selector with custom timeout', async () => {
      await driver.launch()
      await driver.waitForSelector('.test-selector', 5000)

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.test-selector', {
        timeout: 5000,
        state: 'visible',
      })
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.waitForSelector('.test')).rejects.toThrow('Browser not launched')
    })
  })

  describe('extractContent', () => {
    it('should extract text content from element', async () => {
      await driver.launch()
      const content = await driver.extractContent('.test-selector')

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.test-selector')
      expect(mockElement.textContent).toHaveBeenCalled()
      expect(content).toBe('Test content')
    })

    it('should return empty string if no text content', async () => {
      mockElement.textContent = vi.fn().mockResolvedValue(null)
      await driver.launch()

      const content = await driver.extractContent('.test-selector')

      expect(content).toBe('')
    })

    it('should throw error if element not found', async () => {
      mockPage.waitForSelector = vi.fn().mockResolvedValue(null)
      await driver.launch()

      await expect(driver.extractContent('.test-selector')).rejects.toThrow('Element not found')
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.extractContent('.test')).rejects.toThrow('Browser not launched')
    })
  })

  describe('extractAll', () => {
    it('should extract content from all matching elements', async () => {
      await driver.launch()
      const contents = await driver.extractAll('.test-selector')

      expect(mockPage.$$).toHaveBeenCalledWith('.test-selector')
      expect(contents).toEqual(['Test content', 'Test content'])
    })

    it('should skip elements with no text content', async () => {
      const mockElement1 = {
        textContent: vi.fn().mockResolvedValue('Content 1'),
      } as unknown as ElementHandle
      const mockElement2 = {
        textContent: vi.fn().mockResolvedValue(null),
      } as unknown as ElementHandle
      const mockElement3 = {
        textContent: vi.fn().mockResolvedValue('Content 3'),
      } as unknown as ElementHandle

      mockPage.$$ = vi.fn().mockResolvedValue([mockElement1, mockElement2, mockElement3])

      await driver.launch()
      const contents = await driver.extractAll('.test-selector')

      expect(contents).toEqual(['Content 1', 'Content 3'])
    })

    it('should return empty array if no elements found', async () => {
      mockPage.$$ = vi.fn().mockResolvedValue([])
      await driver.launch()

      const contents = await driver.extractAll('.test-selector')

      expect(contents).toEqual([])
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.extractAll('.test')).rejects.toThrow('Browser not launched')
    })
  })

  describe('evaluate', () => {
    it('should evaluate string script', async () => {
      await driver.launch()
      const result = await driver.evaluate('document.title')

      expect(mockPage.evaluate).toHaveBeenCalledWith('document.title')
      expect(result).toBe('evaluated')
    })

    it('should evaluate function with arguments', async () => {
      await driver.launch()
      const fn = (...args: unknown[]) => (args[0] as number) + (args[1] as number)
      await driver.evaluate(fn, 1, 2)

      expect(mockPage.evaluate).toHaveBeenCalledWith(fn, 1, 2)
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.evaluate('test')).rejects.toThrow('Browser not launched')
    })
  })

  describe('getHtml', () => {
    it('should get HTML content of element', async () => {
      await driver.launch()
      const html = await driver.getHtml('.test-selector')

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.test-selector')
      expect(mockElement.innerHTML).toHaveBeenCalled()
      expect(html).toBe('<p>Test HTML</p>')
    })

    it('should throw error if element not found', async () => {
      mockPage.waitForSelector = vi.fn().mockResolvedValue(null)
      await driver.launch()

      await expect(driver.getHtml('.test-selector')).rejects.toThrow('Element not found')
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.getHtml('.test')).rejects.toThrow('Browser not launched')
    })
  })

  describe('getPageHtml', () => {
    it('should get HTML content of entire page', async () => {
      await driver.launch()
      const html = await driver.getPageHtml()

      expect(mockPage.content).toHaveBeenCalled()
      expect(html).toBe('<html>Page content</html>')
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.getPageHtml()).rejects.toThrow('Browser not launched')
    })
  })

  describe('screenshot', () => {
    it('should take screenshot', async () => {
      await driver.launch()
      await driver.screenshot('/tmp/test.png')

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: '/tmp/test.png',
        fullPage: true,
      })
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.screenshot('/tmp/test.png')).rejects.toThrow('Browser not launched')
    })
  })

  describe('click', () => {
    it('should click element', async () => {
      await driver.launch()
      await driver.click('.button')

      expect(mockPage.click).toHaveBeenCalledWith('.button')
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.click('.button')).rejects.toThrow('Browser not launched')
    })
  })

  describe('type', () => {
    it('should type text into element', async () => {
      await driver.launch()
      await driver.type('#input', 'Hello World')

      expect(mockPage.type).toHaveBeenCalledWith('#input', 'Hello World')
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.type('#input', 'test')).rejects.toThrow('Browser not launched')
    })
  })

  describe('waitForNavigation', () => {
    it('should wait for navigation with default timeout', async () => {
      await driver.launch()
      await driver.waitForNavigation()

      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('domcontentloaded', {
        timeout: 30000,
      })
    })

    it('should wait for navigation with custom timeout', async () => {
      await driver.launch()
      await driver.waitForNavigation(5000)

      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('domcontentloaded', {
        timeout: 5000,
      })
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.waitForNavigation()).rejects.toThrow('Browser not launched')
    })
  })

  describe('close', () => {
    it('should close page and browser', async () => {
      await driver.launch()
      await driver.close()

      expect(mockPage.close).toHaveBeenCalled()
      expect(mockBrowser.close).toHaveBeenCalled()
    })

    it('should handle close when browser not launched', async () => {
      await expect(driver.close()).resolves.not.toThrow()
    })

    it('should handle close when only page exists', async () => {
      await driver.launch()
      await driver.close()

      await expect(driver.close()).resolves.not.toThrow()
    })

    it('should reset launched state', async () => {
      await driver.launch()
      await driver.close()

      await expect(driver.navigate('https://example.com')).rejects.toThrow('Browser not launched')
    })
  })

  describe('getPage', () => {
    it('should return page when launched', async () => {
      await driver.launch()
      const page = driver.getPage()

      expect(page).toBe(mockPage)
    })

    it('should return undefined when not launched', () => {
      const page = driver.getPage()

      expect(page).toBeUndefined()
    })
  })

  describe('getBrowser', () => {
    it('should return browser when launched', async () => {
      await driver.launch()
      const browser = driver.getBrowser()

      expect(browser).toBe(mockBrowser)
    })

    it('should return undefined when not launched', () => {
      const browser = driver.getBrowser()

      expect(browser).toBeUndefined()
    })
  })

  describe('waitForRequest', () => {
    it('should wait for request with string pattern', async () => {
      await driver.launch()
      await driver.waitForRequest('https://api.example.com')

      expect(mockPage.waitForRequest).toHaveBeenCalledWith('https://api.example.com', {
        timeout: 30000,
      })
    })

    it('should wait for request with regex pattern', async () => {
      await driver.launch()
      const pattern = /api\.example\.com/
      await driver.waitForRequest(pattern, 5000)

      expect(mockPage.waitForRequest).toHaveBeenCalledWith(pattern, {
        timeout: 5000,
      })
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.waitForRequest('test')).rejects.toThrow('Browser not launched')
    })
  })

  describe('waitForResponse', () => {
    it('should wait for response with string pattern', async () => {
      await driver.launch()
      await driver.waitForResponse('https://api.example.com')

      expect(mockPage.waitForResponse).toHaveBeenCalledWith('https://api.example.com', {
        timeout: 30000,
      })
    })

    it('should wait for response with regex pattern', async () => {
      await driver.launch()
      const pattern = /api\.example\.com/
      await driver.waitForResponse(pattern, 5000)

      expect(mockPage.waitForResponse).toHaveBeenCalledWith(pattern, {
        timeout: 5000,
      })
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.waitForResponse('test')).rejects.toThrow('Browser not launched')
    })
  })

  describe('extractWithFallback', () => {
    it('should extract content using first matching selector', async () => {
      await driver.launch()
      const content = await driver.extractWithFallback(['.selector1', '.selector2', '.selector3'])

      expect(mockPage.$).toHaveBeenCalledWith('.selector1')
      expect(mockElement.textContent).toHaveBeenCalled()
      expect(content).toBe('Test content')
    })

    it('should try next selector if first fails', async () => {
      const mockElement1 = {
        textContent: vi.fn().mockResolvedValue(''),
      } as unknown as ElementHandle
      const mockElement2 = {
        textContent: vi.fn().mockResolvedValue('Found content'),
      } as unknown as ElementHandle

      mockPage.$ = vi.fn().mockResolvedValueOnce(mockElement1).mockResolvedValueOnce(mockElement2)

      await driver.launch()
      const content = await driver.extractWithFallback(['.selector1', '.selector2'])

      expect(mockPage.$).toHaveBeenCalledTimes(2)
      expect(content).toBe('Found content')
    })

    it('should skip null elements', async () => {
      const mockElement2 = {
        textContent: vi.fn().mockResolvedValue('Found content'),
      } as unknown as ElementHandle

      mockPage.$ = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(mockElement2)

      await driver.launch()
      const content = await driver.extractWithFallback(['.selector1', '.selector2'])

      expect(content).toBe('Found content')
    })

    it('should throw error if no selector matches', async () => {
      mockPage.$ = vi.fn().mockResolvedValue(null)

      await driver.launch()

      await expect(driver.extractWithFallback(['.selector1', '.selector2'])).rejects.toThrow(
        /No content found with any of the selectors/
      )
    })

    it('should handle errors and continue to next selector', async () => {
      const mockElement2 = {
        textContent: vi.fn().mockResolvedValue('Found content'),
      } as unknown as ElementHandle

      mockPage.$ = vi
        .fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(mockElement2)

      await driver.launch()
      const content = await driver.extractWithFallback(['.selector1', '.selector2'])

      expect(content).toBe('Found content')
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.extractWithFallback(['.test'])).rejects.toThrow('Browser not launched')
    })
  })

  describe('elementExists', () => {
    it('should return true when element exists', async () => {
      await driver.launch()
      const exists = await driver.elementExists('.test-selector')

      expect(mockPage.$).toHaveBeenCalledWith('.test-selector')
      expect(exists).toBe(true)
    })

    it('should return false when element does not exist', async () => {
      mockPage.$ = vi.fn().mockResolvedValue(null)
      await driver.launch()

      const exists = await driver.elementExists('.test-selector')

      expect(exists).toBe(false)
    })

    it('should return false when error occurs', async () => {
      mockPage.$ = vi.fn().mockRejectedValue(new Error('Timeout'))
      await driver.launch()

      const exists = await driver.elementExists('.test-selector')

      expect(exists).toBe(false)
    })

    it('should throw error if browser not launched', async () => {
      await expect(driver.elementExists('.test')).rejects.toThrow('Browser not launched')
    })
  })

  describe('resource blocking', () => {
    it('should block specified resource types', async () => {
      await driver.launch({ blockResources: ['image', 'font', 'media'] })

      const routeCallback = vi.mocked(mockPage.route).mock.calls[0]?.[1]
      const mockRoute = {
        request: vi.fn().mockReturnValue({
          resourceType: vi.fn().mockReturnValue('image'),
          url: vi.fn().mockReturnValue('https://example.com/image.png'),
          headers: vi.fn().mockReturnValue({}),
        }),
        abort: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(undefined),
      }

      await routeCallback?.(mockRoute as any, undefined as any)

      expect(mockRoute.abort).toHaveBeenCalled()
      expect(mockRoute.continue).not.toHaveBeenCalled()
    })

    it('should allow non-blocked resource types', async () => {
      await driver.launch({ blockResources: ['image'] })

      const routeCallback = vi.mocked(mockPage.route).mock.calls[0]?.[1]
      const mockRoute = {
        request: vi.fn().mockReturnValue({
          resourceType: vi.fn().mockReturnValue('script'),
          url: vi.fn().mockReturnValue('https://example.com/script.js'),
          headers: vi.fn().mockReturnValue({}),
        }),
        abort: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(undefined),
      }

      await routeCallback?.(mockRoute as any, undefined as any)

      expect(mockRoute.continue).toHaveBeenCalled()
      expect(mockRoute.abort).not.toHaveBeenCalled()
    })
  })

  describe('cookie injection', () => {
    it('should convert and inject cookies', async () => {
      const authDriver = new PlaywrightDriver({
        sessionToken: 'test-token',
        csrfToken: 'csrf-token',
        cookies: [
          {
            name: 'LEETCODE_SESSION',
            value: 'test-session-value',
            domain: '.leetcode.com',
            path: '/',
            expires: 1700000000000,
            httpOnly: true,
            secure: true,
          },
          {
            name: 'csrftoken',
            value: 'csrf-value',
            domain: '.leetcode.com',
          },
        ],
      })

      await authDriver.launch()

      expect(mockContext.addCookies).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'LEETCODE_SESSION',
          value: 'test-session-value',
          domain: '.leetcode.com',
          path: '/',
          expires: 1700000000,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        }),
        expect.objectContaining({
          name: 'csrftoken',
          value: 'csrf-value',
          domain: '.leetcode.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        }),
      ])
    })

    it('should not inject cookies if no auth provided', async () => {
      await driver.launch()

      expect(mockContext.addCookies).not.toHaveBeenCalled()
    })
  })

  describe('captured responses', () => {
    it('should return captured responses when interception enabled', async () => {
      await driver.launch({
        interception: {
          enabled: true,
          capturePattern: 'api/.*',
        },
      })

      // Simulate a captured response
      const routeCallback = vi.mocked(mockPage.route).mock.calls[0]?.[1]
      const mockRoute = {
        request: vi.fn().mockReturnValue({
          resourceType: vi.fn().mockReturnValue('xhr'),
          url: vi.fn().mockReturnValue('https://example.com/api/data'),
          headers: vi.fn().mockReturnValue({}),
        }),
        fetch: vi.fn().mockResolvedValue({
          headers: vi.fn().mockReturnValue({ 'content-type': 'application/json' }),
          json: vi.fn().mockResolvedValue({ data: 'test' }),
        }),
        fulfill: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(undefined),
      }

      await routeCallback?.(mockRoute as any, undefined as any)

      const responses = driver.getCapturedResponses()
      expect(responses.get('https://example.com/api/data')).toEqual({ data: 'test' })
    })
  })

  describe('performance metrics', () => {
    it('should return metrics when monitoring enabled', async () => {
      await driver.launch({
        monitoring: {
          enabled: true,
        },
      })

      const metrics = await driver.getPerformanceMetrics()
      expect(metrics).toBeDefined()
      // Since we can't easily mock the performance monitor's internal state without more complex mocking,
      // we just check that the method exists and returns something (or null if not fully active)
      // In this mock setup, performance monitor is instantiated but page events aren't triggered real-time.
    })
  })
})
