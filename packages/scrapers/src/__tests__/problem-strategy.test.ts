import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProblemScraperStrategy } from '../problem-strategy'
import type {
  ProblemScrapeRequest,
  Problem,
  BrowserDriver,
  AuthCredentials,
  ScrapeRequest,
} from '@lesca/shared/types'
import { GraphQLClient } from '@lesca/api-client'
import { ScrapingError } from '@lesca/error'

vi.mock('@/browser-automation/src/index', () => ({
  SelectorManager: vi.fn(),
}))

describe('ProblemScraperStrategy', () => {
  let strategy: ProblemScraperStrategy
  let mockGraphQLClient: GraphQLClient
  let mockBrowserDriver: BrowserDriver
  let mockAuth: AuthCredentials

  const mockProblem: Problem = {
    questionId: '1',
    questionFrontendId: '1',
    title: 'Two Sum',
    titleSlug: 'two-sum',
    difficulty: 'Easy',
    content: '<p>Given an array...</p>',
    topicTags: [{ name: 'Array', slug: 'array' }],
    stats: '{"acRate": "47.3%"}',
  } as Problem

  beforeEach(() => {
    mockGraphQLClient = {
      getProblem: vi.fn().mockResolvedValue(mockProblem),
    } as unknown as GraphQLClient

    mockBrowserDriver = {
      launch: vi.fn(),
      navigate: vi.fn(),
      waitForSelector: vi.fn(),
      extractContent: vi.fn(),
      extractWithFallback: vi.fn(),
      getHtml: vi.fn(),
      extractAll: vi.fn(),
      elementExists: vi.fn(),
      getBrowser: vi.fn(),
      close: vi.fn(),
    } as unknown as BrowserDriver

    mockAuth = {
      cookies: [],
      csrfToken: 'token',
    }

    strategy = new ProblemScraperStrategy(mockGraphQLClient, mockBrowserDriver, mockAuth)
  })

  describe('canHandle', () => {
    it('should return true for problem requests', () => {
      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }
      expect(strategy.canHandle(request)).toBe(true)
    })

    it('should return false for non-problem requests', () => {
      expect(strategy.canHandle({ type: 'list' } as unknown as ScrapeRequest)).toBe(false)
      expect(strategy.canHandle({ type: 'discussion' } as unknown as ScrapeRequest)).toBe(false)
      expect(strategy.canHandle({ type: 'editorial' } as unknown as ScrapeRequest)).toBe(false)
    })
  })

  describe('execute', () => {
    it('should fetch problem successfully via GraphQL', async () => {
      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await strategy.execute(request)

      expect(result.type).toBe('problem')
      expect(result.data).toEqual(mockProblem)
      expect(result.metadata.source).toBe('graphql')
      expect(mockGraphQLClient.getProblem).toHaveBeenCalledWith('two-sum')
      expect(mockBrowserDriver.navigate).not.toHaveBeenCalled()
    })

    it('should fallback to browser if GraphQL fails', async () => {
      mockGraphQLClient.getProblem = vi.fn().mockRejectedValue(new Error('GraphQL Error'))

      // Mock browser success
      vi.mocked(mockBrowserDriver.extractWithFallback).mockImplementation(async (selectors) => {
        if (selectors[0]?.includes('title')) return '1. Two Sum'
        if (selectors[0]?.includes('description')) return '<p>Content</p>'
        if (selectors[0]?.includes('difficulty')) return 'Easy'
        return ''
      })
      vi.mocked(mockBrowserDriver.extractAll).mockResolvedValue(['Array'])
      vi.mocked(mockBrowserDriver.elementExists).mockResolvedValue(false) // Not premium

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await strategy.execute(request)

      expect(result.type).toBe('problem')
      expect(result.metadata.source).toBe('browser')
      expect(mockBrowserDriver.launch).toHaveBeenCalled()
      expect(mockBrowserDriver.navigate).toHaveBeenCalledWith(
        'https://leetcode.com/problems/two-sum/'
      )

      const data = result.data as Problem
      expect(data.title).toBe('Two Sum')
      expect(data.questionFrontendId).toBe('1')
      expect(data.difficulty).toBe('Easy')
    })

    it('should throw ScrapingError if both GraphQL and Browser fail', async () => {
      mockGraphQLClient.getProblem = vi.fn().mockRejectedValue(new Error('GraphQL Error'))
      mockBrowserDriver.navigate = vi.fn().mockRejectedValue(new Error('Browser Error'))

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      await expect(strategy.execute(request)).rejects.toThrow(ScrapingError)
      await expect(strategy.execute(request)).rejects.toThrow('Failed to scrape problem "two-sum"')
    })

    it('should throw if premium content and includePremium is false', async () => {
      mockGraphQLClient.getProblem = vi.fn().mockRejectedValue(new Error('GraphQL Error'))

      // Mock premium detection
      vi.mocked(mockBrowserDriver.elementExists).mockImplementation(async (selector) => {
        return selector === '[data-icon="lock"]'
      })

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'premium-problem',
        includePremium: false,
      }

      await expect(strategy.execute(request)).rejects.toThrow('is premium content')
    })

    it('should throw if premium content and no auth provided', async () => {
      // Re-init strategy without auth
      strategy = new ProblemScraperStrategy(mockGraphQLClient, mockBrowserDriver, undefined)

      mockGraphQLClient.getProblem = vi.fn().mockRejectedValue(new Error('GraphQL Error'))

      // Mock premium detection
      vi.mocked(mockBrowserDriver.elementExists).mockImplementation(async (selector) => {
        return selector === '[data-icon="lock"]'
      })

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'premium-problem',
        includePremium: true,
      }

      await expect(strategy.execute(request)).rejects.toThrow('requires authentication')
    })
  })
})
