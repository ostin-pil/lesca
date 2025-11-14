import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EditorialScraperStrategy } from '../editorial-strategy.js'
import type { EditorialScrapeRequest, EditorialContent } from '../../../../shared/types/src/index.js'
import type { BrowserDriver } from '../../../../shared/types/src/index.js'
import { LescaError } from '../../../../shared/types/src/index.js'

describe('EditorialScraperStrategy', () => {
  let strategy: EditorialScraperStrategy
  let mockBrowserDriver: BrowserDriver

  const mockEditorial: EditorialContent = {
    titleSlug: 'two-sum',
    content: '<p>This is the editorial content</p>',
    approaches: ['<p>Approach 1</p>'],
    complexity: '<p>O(n)</p>',
    codeSnippets: [{ langSlug: 'python3', code: 'def solution(): pass', lang: 'python3' }],
  }

  beforeEach(() => {
    mockBrowserDriver = {
      navigate: vi.fn().mockResolvedValue(undefined),
      extractContent: vi.fn().mockResolvedValue('<p>Content</p>'),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      launch: vi.fn().mockResolvedValue(undefined),
      getBrowser: vi.fn().mockReturnValue(null),
      elementExists: vi.fn().mockResolvedValue(false),
      extractWithFallback: vi.fn().mockResolvedValue('<p>Editorial content</p>'),
      extractAll: vi.fn().mockResolvedValue(['Approach 1']),
      getPageHtml: vi.fn().mockResolvedValue('<html></html>'),
      screenshot: vi.fn().mockResolvedValue(undefined),
      getHtml: vi.fn().mockResolvedValue('<p>Content</p>'),
    } as unknown as BrowserDriver

    strategy = new EditorialScraperStrategy(mockBrowserDriver)
  })

  describe('canHandle', () => {
    it('should return true for editorial requests', () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }
      expect(strategy.canHandle(request)).toBe(true)
    })

    it('should return false for non-editorial requests', () => {
      expect(strategy.canHandle({ type: 'problem' } as any)).toBe(false)
      expect(strategy.canHandle({ type: 'list' } as any)).toBe(false)
      expect(strategy.canHandle({ type: 'discussion' } as any)).toBe(false)
    })
  })

  describe('name property', () => {
    it('should have correct name identifier', () => {
      expect(strategy.name).toBe('editorial')
    })
  })

  describe('priority property', () => {
    it('should have correct priority', () => {
      expect(strategy.priority).toBe(90)
    })
  })

  describe('execute', () => {
    it('should throw error for invalid request type', async () => {
      const request = { type: 'problem' } as any
      await expect(strategy.execute(request)).rejects.toThrow(LescaError)
      await expect(strategy.execute(request)).rejects.toThrow(
        'EditorialScraperStrategy cannot handle request type: problem'
      )
    })

    it('should successfully scrape editorial content', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      // Mock browser as already launched
      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.elementExists = vi.fn().mockResolvedValue(false) // Not premium

      const result = await strategy.execute(request)

      expect(result.type).toBe('editorial')
      expect(result.data).toBeDefined()
      expect(result.metadata).toBeDefined()
      expect(result.metadata.strategy).toBe('editorial')
      expect(result.metadata.url).toBe('https://leetcode.com/problems/two-sum/editorial/')
      expect(mockBrowserDriver.navigate).toHaveBeenCalledWith(
        'https://leetcode.com/problems/two-sum/editorial/'
      )
    })

    it('should launch browser if not already launched', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue(null)

      await strategy.execute(request)

      expect(mockBrowserDriver.launch).toHaveBeenCalledWith({
        headless: true,
        timeout: 30000,
        blockResources: ['image', 'font', 'media'],
      })
    })

    it('should detect premium content and throw error when not allowed', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
        includePremium: false,
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.elementExists = vi.fn().mockResolvedValue(true) // Is premium

      await expect(strategy.execute(request)).rejects.toThrow(LescaError)
      await expect(strategy.execute(request)).rejects.toThrow(/premium content/)
    })

    it('should throw error for premium content without authentication', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
        includePremium: true,
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.elementExists = vi.fn().mockResolvedValue(true) // Is premium

      await expect(strategy.execute(request)).rejects.toThrow(LescaError)
      await expect(strategy.execute(request)).rejects.toThrow(/requires authentication/)
    })

    it('should handle premium content with authentication', async () => {
      const strategyWithAuth = new EditorialScraperStrategy(mockBrowserDriver, {
        sessionToken: 'test-token',
        csrfToken: 'csrf-token',
      })

      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
        includePremium: true,
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.elementExists = vi.fn().mockResolvedValue(true) // Is premium

      const result = await strategyWithAuth.execute(request)

      expect(result.type).toBe('editorial')
      expect(result.metadata.isPremium).toBe(true)
    })

    it('should wrap non-LescaError errors', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.navigate = vi.fn().mockRejectedValue(new Error('Network error'))

      await expect(strategy.execute(request)).rejects.toThrow(LescaError)
      await expect(strategy.execute(request)).rejects.toThrow(/Failed to scrape editorial/)
    })

    it('should propagate LescaError without wrapping', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      const originalError = new LescaError('Original error', 'TEST_ERROR')
      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.navigate = vi.fn().mockRejectedValue(originalError)

      await expect(strategy.execute(request)).rejects.toThrow(originalError)
    })
  })

  describe('waitForContent', () => {
    it('should wait for content to load using first selector', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.waitForSelector = vi.fn().mockResolvedValue(undefined)

      await strategy.execute(request)

      expect(mockBrowserDriver.waitForSelector).toHaveBeenCalled()
    })

    it('should try fallback selectors on timeout', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.waitForSelector = vi
        .fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(undefined)

      await strategy.execute(request)

      expect(mockBrowserDriver.waitForSelector).toHaveBeenCalledTimes(2)
    })

    it('should throw error when all selectors fail', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.waitForSelector = vi.fn().mockRejectedValue(new Error('Timeout'))

      await expect(strategy.execute(request)).rejects.toThrow(LescaError)
    })
  })

  describe('checkPremiumContent', () => {
    it('should return false when no premium banner exists', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.elementExists = vi.fn().mockResolvedValue(false)

      const result = await strategy.execute(request)

      expect(result.metadata.isPremium).toBe(false)
    })

    it('should return true when premium banner exists', async () => {
      const strategyWithAuth = new EditorialScraperStrategy(mockBrowserDriver, {
        sessionToken: 'test-token',
        csrfToken: 'csrf-token',
      })

      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
        includePremium: true,
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.elementExists = vi.fn().mockResolvedValue(true)

      const result = await strategyWithAuth.execute(request)

      expect(result.metadata.isPremium).toBe(true)
    })
  })

  describe('extractEditorial', () => {
    it('should extract all editorial components', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractWithFallback = vi.fn().mockResolvedValue('Editorial content')
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce(['Approach 1', 'Approach 2'])
        .mockResolvedValueOnce(['def solution(): pass'])

      const result = await strategy.execute(request)

      expect(result.data).toHaveProperty('content')
      expect(result.data).toHaveProperty('approaches')
      expect(result.data).toHaveProperty('complexity')
      expect(result.data).toHaveProperty('codeSnippets')
    })
  })

  describe('extractApproaches', () => {
    it('should return empty array when no approaches found', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockRejectedValue(new Error('Not found'))

      const result = await strategy.execute(request)

      expect(result.data.approaches).toEqual([])
    })

    it('should extract multiple approaches', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce(['Approach 1', 'Approach 2', 'Approach 3'])

      const result = await strategy.execute(request)

      expect(result.data.approaches.length).toBeGreaterThan(0)
    })
  })

  describe('extractComplexity', () => {
    it('should return null when complexity not found', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractWithFallback = vi
        .fn()
        .mockResolvedValueOnce('Editorial content')
        .mockRejectedValueOnce(new Error('Not found'))

      const result = await strategy.execute(request)

      expect(result.data.complexity).toBeNull()
    })

    it('should extract complexity when available', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractWithFallback = vi
        .fn()
        .mockResolvedValueOnce('Editorial content')
        .mockResolvedValueOnce('O(n) time, O(1) space')

      const result = await strategy.execute(request)

      expect(result.data.complexity).toBeDefined()
    })
  })

  describe('extractCodeSnippets', () => {
    it('should return empty array when no code found', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockRejectedValue(new Error('Not found'))

      const result = await strategy.execute(request)

      expect(result.data.codeSnippets).toEqual([])
    })

    it('should extract code snippets with detected language', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['def solution():\n    pass'])

      const result = await strategy.execute(request)

      if (result.data.codeSnippets.length > 0) {
        expect(result.data.codeSnippets[0]).toHaveProperty('code')
        expect(result.data.codeSnippets[0]).toHaveProperty('lang')
        expect(result.data.codeSnippets[0]).toHaveProperty('langSlug')
      }
    })
  })

  describe('detectLanguage', () => {
    it('should detect Python', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['def solution(): pass'])

      const result = await strategy.execute(request)

      if (result.data.codeSnippets.length > 0) {
        expect(result.data.codeSnippets[0].lang).toBe('python')
      }
    })

    it('should detect JavaScript', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['function solution() { return 0; }'])

      const result = await strategy.execute(request)

      if (result.data.codeSnippets.length > 0) {
        expect(result.data.codeSnippets[0].lang).toBe('javascript')
      }
    })

    it('should detect Java', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['public class Solution {}'])

      const result = await strategy.execute(request)

      if (result.data.codeSnippets.length > 0) {
        expect(result.data.codeSnippets[0].lang).toBe('java')
      }
    })

    it('should detect C++', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['#include <vector>'])

      const result = await strategy.execute(request)

      if (result.data.codeSnippets.length > 0) {
        expect(result.data.codeSnippets[0].lang).toBe('cpp')
      }
    })

    it('should detect Go', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['func main() { for i := range []int{} {} }'])

      const result = await strategy.execute(request)

      if (result.data.codeSnippets.length > 0) {
        expect(result.data.codeSnippets[0].lang).toBe('go')
      }
    })

    it('should detect Rust', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['fn main() { impl Solution {} }'])

      const result = await strategy.execute(request)

      if (result.data.codeSnippets.length > 0) {
        expect(result.data.codeSnippets[0].lang).toBe('rust')
      }
    })

    it('should default to text for unknown language', async () => {
      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['some unknown code'])

      const result = await strategy.execute(request)

      if (result.data.codeSnippets.length > 0) {
        expect(result.data.codeSnippets[0].lang).toBe('text')
      }
    })
  })

  describe('getFullHtml', () => {
    it('should navigate and return page HTML', async () => {
      const html = '<html><body>Editorial content</body></html>'
      mockBrowserDriver.getPageHtml = vi.fn().mockResolvedValue(html)

      const result = await strategy.getFullHtml('two-sum')

      expect(mockBrowserDriver.navigate).toHaveBeenCalledWith(
        'https://leetcode.com/problems/two-sum/editorial/'
      )
      expect(result).toBe(html)
    })
  })

  describe('screenshot', () => {
    it('should navigate and take screenshot', async () => {
      const path = '/tmp/screenshot.png'

      await strategy.screenshot('two-sum', path)

      expect(mockBrowserDriver.navigate).toHaveBeenCalledWith(
        'https://leetcode.com/problems/two-sum/editorial/'
      )
      expect(mockBrowserDriver.screenshot).toHaveBeenCalledWith(path)
    })
  })
})
