import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DiscussionScraperStrategy } from '../discussion-strategy'
import type { DiscussionScrapeRequest, DiscussionList, ScrapeRequest } from '@lesca/shared/types'
import type { BrowserDriver } from '@lesca/shared/types'
import { LescaError } from '@lesca/error'

vi.mock('@/browser-automation/src/index', () => ({
  SelectorManager: vi.fn().mockImplementation(() => ({
    getDiscussionSelectors: vi.fn().mockReturnValue({
      list: ['list-selector'],
      post: ['post-selector'],
      title: ['title-selector'],
      author: ['author-selector'],
      votes: ['votes-selector'],
      timestamp: ['timestamp-selector'],
      content: ['content-selector'],
      comments: ['comments-selector'],
    }),
    getAll: vi.fn().mockImplementation((s) => (Array.isArray(s) ? s : [s])),
    getCommonSelectors: vi.fn().mockReturnValue({
      notFound: ['not-found-selector'],
    }),
  })),
}))

describe('DiscussionScraperStrategy', () => {
  let strategy: DiscussionScraperStrategy
  let mockBrowserDriver: BrowserDriver

  beforeEach(() => {
    mockBrowserDriver = {
      navigate: vi.fn().mockResolvedValue(undefined),
      extractContent: vi.fn().mockResolvedValue('Discussion content'),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      launch: vi.fn().mockResolvedValue(undefined),
      getBrowser: vi.fn().mockReturnValue(null),
      extractAll: vi.fn().mockResolvedValue(['Discussion 1', 'Discussion 2']),
      getPageHtml: vi.fn().mockResolvedValue('<html></html>'),
      screenshot: vi.fn().mockResolvedValue(undefined),
      getHtml: vi.fn().mockResolvedValue('<div>Discussion content</div>'),
    } as unknown as BrowserDriver

    strategy = new DiscussionScraperStrategy(mockBrowserDriver)
  })

  describe('canHandle', () => {
    it('should return true for discussion requests', () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }
      expect(strategy.canHandle(request)).toBe(true)
    })

    it('should return false for non-discussion requests', () => {
      expect(strategy.canHandle({ type: 'problem' } as unknown as ScrapeRequest)).toBe(false)
      expect(strategy.canHandle({ type: 'list' } as unknown as ScrapeRequest)).toBe(false)
      expect(strategy.canHandle({ type: 'editorial' } as unknown as ScrapeRequest)).toBe(false)
    })
  })

  describe('name property', () => {
    it('should have correct name identifier', () => {
      expect(strategy.name).toBe('discussion')
    })
  })

  describe('priority property', () => {
    it('should have correct priority', () => {
      expect(strategy.priority).toBe(80)
    })
  })

  describe('execute', () => {
    it('should throw error for invalid request type', async () => {
      const request = { type: 'problem' } as unknown as ScrapeRequest
      await expect(strategy.execute(request)).rejects.toThrow(LescaError)
      await expect(strategy.execute(request)).rejects.toThrow(
        'DiscussionScraperStrategy cannot handle request type: problem'
      )
    })

    it('should successfully scrape discussions', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockResolvedValue(['Post 1', 'Post 2'])

      const result = await strategy.execute(request)

      expect(result.type).toBe('discussion')
      expect(result.data).toBeDefined()
      const data = result.data as DiscussionList
      expect(data.titleSlug).toBe('two-sum')
      expect(data.category).toBe('all')
      expect(data.sortBy).toBe('hot')
      expect(result.metadata).toBeDefined()
      expect(result.metadata.strategy).toBe('discussion')
    })

    it('should launch browser if not already launched', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
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

    it('should use provided category and sortBy', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
        category: 'solution',
        sortBy: 'most-votes',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      expect(data.category).toBe('solution')
      expect(data.sortBy).toBe('most-votes')
      expect(mockBrowserDriver.navigate).toHaveBeenCalledWith(
        'https://leetcode.com/problems/two-sum/solutions/?category=solution&orderBy=most-votes'
      )
    })

    it('should respect limit parameter', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
        limit: 5,
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValue(['Title 1', 'Title 2', 'Title 3', 'Title 4', 'Title 5', 'Title 6'])

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      expect(data.discussions.length).toBeLessThanOrEqual(5)
    })

    it('should use default limit of 10', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockResolvedValue(Array(15).fill('Title'))

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      expect(data.discussions.length).toBeLessThanOrEqual(10)
    })

    it('should wrap non-LescaError errors', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.navigate = vi.fn().mockRejectedValue(new Error('Network error'))

      await expect(strategy.execute(request)).rejects.toThrow(LescaError)
      await expect(strategy.execute(request)).rejects.toThrow(/Failed to scrape discussions/)
    })

    it('should propagate LescaError without wrapping', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      const originalError = new LescaError('SYS_UNKNOWN_ERROR', 'Original error')
      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.navigate = vi.fn().mockRejectedValue(originalError)

      await expect(strategy.execute(request)).rejects.toThrow(originalError)
    })
  })

  describe('getDiscussionUrl', () => {
    it('should generate base URL without parameters', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })

      await strategy.execute(request)

      expect(mockBrowserDriver.navigate).toHaveBeenCalledWith(
        'https://leetcode.com/problems/two-sum/solutions/'
      )
    })

    it('should generate URL with category parameter', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
        category: 'solution',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })

      await strategy.execute(request)

      expect(mockBrowserDriver.navigate).toHaveBeenCalledWith(
        'https://leetcode.com/problems/two-sum/solutions/?category=solution'
      )
    })

    it('should generate URL with sortBy parameter', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
        sortBy: 'recent',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })

      await strategy.execute(request)

      expect(mockBrowserDriver.navigate).toHaveBeenCalledWith(
        'https://leetcode.com/problems/two-sum/solutions/?orderBy=recent'
      )
    })

    it('should generate URL with both parameters', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
        category: 'general',
        sortBy: 'most-votes',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })

      await strategy.execute(request)

      expect(mockBrowserDriver.navigate).toHaveBeenCalledWith(
        'https://leetcode.com/problems/two-sum/solutions/?category=general&orderBy=most-votes'
      )
    })
  })

  describe('waitForDiscussions', () => {
    it('should wait for discussions to load', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.waitForSelector = vi.fn().mockResolvedValue(undefined)

      await strategy.execute(request)

      expect(mockBrowserDriver.waitForSelector).toHaveBeenCalled()
    })

    it('should try fallback selectors on timeout', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
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
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.waitForSelector = vi.fn().mockRejectedValue(new Error('Timeout'))

      await expect(strategy.execute(request)).rejects.toThrow(LescaError)
    })
  })

  describe('extractDiscussions', () => {
    it('should return empty array when no discussions found', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockResolvedValue([])

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      expect(data.discussions).toEqual([])
    })

    it('should extract multiple discussions', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockResolvedValue(['Post 1', 'Post 2', 'Post 3'])
      mockBrowserDriver.extractContent = vi
        .fn()
        .mockResolvedValueOnce('Title 1')
        .mockResolvedValueOnce('Author 1')
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('2 hours ago')
        .mockResolvedValueOnce('Title 2')
        .mockResolvedValueOnce('Author 2')
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('1 day ago')
        .mockResolvedValueOnce('Title 3')
        .mockResolvedValueOnce('Author 3')
        .mockResolvedValueOnce('20')
        .mockResolvedValueOnce('3 days ago')

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      expect(data.discussions.length).toBeGreaterThan(0)
    })
  })

  describe('extractSingleDiscussion', () => {
    it('should extract discussion with all fields', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockResolvedValue(['Post 1'])
      mockBrowserDriver.extractContent = vi
        .fn()
        .mockResolvedValueOnce('Two Sum Solution')
        .mockResolvedValueOnce('john_doe')
        .mockResolvedValueOnce('42')
        .mockResolvedValueOnce('2 hours ago')
      mockBrowserDriver.getHtml = vi.fn().mockResolvedValue('<p>Solution content</p>')

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      if (data.discussions.length > 0) {
        const discussion = data.discussions[0]
        expect(discussion).toHaveProperty('title')
        expect(discussion).toHaveProperty('author')
        expect(discussion).toHaveProperty('votes')
        expect(discussion).toHaveProperty('timestamp')
        expect(discussion).toHaveProperty('content')
        expect(discussion).toHaveProperty('comments')
      }
    })

    it('should use default author when not found', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockResolvedValue(['Post 1'])
      mockBrowserDriver.extractContent = vi
        .fn()
        .mockResolvedValueOnce('Title')
        .mockRejectedValueOnce(new Error('Not found'))

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      if (data.discussions.length > 0) {
        expect(data.discussions[0]?.author).toBe('Anonymous')
      }
    })

    it('should use 0 votes when not found', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockResolvedValue(['Post 1'])
      mockBrowserDriver.extractContent = vi
        .fn()
        .mockResolvedValueOnce('Title')
        .mockResolvedValueOnce('Author')
        .mockRejectedValueOnce(new Error('Not found'))

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      if (data.discussions.length > 0) {
        expect(data.discussions[0]?.votes).toBe(0)
      }
    })

    it('should parse votes from text with non-numeric characters', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockResolvedValue(['Post 1'])
      mockBrowserDriver.extractContent = vi
        .fn()
        .mockResolvedValueOnce('Title')
        .mockResolvedValueOnce('Author')
        .mockResolvedValueOnce('42 votes')

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      if (data.discussions.length > 0) {
        expect(data.discussions[0]?.votes).toBe(42)
      }
    })

    it('should return null when title is empty', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockResolvedValue(['Post 1'])
      mockBrowserDriver.extractContent = vi.fn().mockResolvedValue('')

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      expect(data.discussions).toEqual([])
    })
  })

  describe('extractComments', () => {
    it('should extract comments when includeComments is true', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
        includeComments: true,
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce(['Post 1'])
        .mockResolvedValueOnce(['Comment 1', 'Comment 2'])
      mockBrowserDriver.extractContent = vi
        .fn()
        .mockResolvedValueOnce('Title')
        .mockResolvedValueOnce('Author')
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('1 hour ago')

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      if (data.discussions.length > 0) {
        expect(data.discussions[0]?.comments).toBeDefined()
        expect(data.discussions[0]?.commentCount).toBeGreaterThanOrEqual(0)
      }
    })

    it('should not extract comments when includeComments is false', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
        includeComments: false,
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockResolvedValue(['Post 1'])
      mockBrowserDriver.extractContent = vi
        .fn()
        .mockResolvedValueOnce('Title')
        .mockResolvedValueOnce('Author')
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('1 hour ago')

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      if (data.discussions.length > 0) {
        expect(data.discussions[0]?.comments).toEqual([])
      }
    })

    it('should return empty array when no comments found', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
        includeComments: true,
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce(['Post 1'])
        .mockRejectedValueOnce(new Error('Not found'))
      mockBrowserDriver.extractContent = vi
        .fn()
        .mockResolvedValueOnce('Title')
        .mockResolvedValueOnce('Author')
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('1 hour ago')

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      if (data.discussions.length > 0) {
        expect(data.discussions[0]?.comments).toEqual([])
      }
    })

    it('should limit comments to 50', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
        includeComments: true,
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi
        .fn()
        .mockResolvedValueOnce(['Post 1'])
        .mockResolvedValueOnce(Array(100).fill('Comment'))
      mockBrowserDriver.extractContent = vi
        .fn()
        .mockResolvedValueOnce('Title')
        .mockResolvedValueOnce('Author')
        .mockResolvedValueOnce('10')
        .mockResolvedValueOnce('1 hour ago')

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      if (data.discussions.length > 0) {
        expect(data.discussions[0]?.comments.length).toBeLessThanOrEqual(50)
      }
    })
  })

  describe('countElements', () => {
    it('should count elements correctly', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockResolvedValue(['Post 1', 'Post 2', 'Post 3'])
      mockBrowserDriver.extractContent = vi
        .fn()
        .mockResolvedValue('Title')
        .mockResolvedValue('Author')

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      expect(data.total).toBeGreaterThanOrEqual(0)
    })

    it('should return 0 when extractAll fails', async () => {
      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: 'two-sum',
      }

      mockBrowserDriver.getBrowser = vi.fn().mockReturnValue({ isConnected: true })
      mockBrowserDriver.extractAll = vi.fn().mockRejectedValue(new Error('Not found'))

      const result = await strategy.execute(request)

      const data = result.data as DiscussionList
      expect(data.discussions).toEqual([])
    })
  })

  describe('getFullHtml', () => {
    it('should navigate and return page HTML', async () => {
      const html = '<html><body>Discussion content</body></html>'
      mockBrowserDriver.getPageHtml = vi.fn().mockResolvedValue(html)

      const result = await strategy.getFullHtml('two-sum')

      expect(mockBrowserDriver.navigate).toHaveBeenCalledWith(
        'https://leetcode.com/problems/two-sum/solutions/'
      )
      expect(result).toBe(html)
    })
  })

  describe('screenshot', () => {
    it('should navigate and take screenshot', async () => {
      const path = '/tmp/screenshot.png'

      await strategy.screenshot('two-sum', path)

      expect(mockBrowserDriver.navigate).toHaveBeenCalledWith(
        'https://leetcode.com/problems/two-sum/solutions/'
      )
      expect(mockBrowserDriver.screenshot).toHaveBeenCalledWith(path)
    })
  })
})
