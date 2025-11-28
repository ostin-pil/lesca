import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ListScraperStrategy } from '../list-strategy'
import type { ListScrapeRequest, ProblemList, ScrapeRequest } from '@lesca/shared/types'
import { GraphQLClient } from '@lesca/api-client'

describe('ListScraperStrategy', () => {
  let strategy: ListScraperStrategy
  let mockGraphQLClient: GraphQLClient

  const mockProblemList: ProblemList = {
    total: 100,
    questions: [
      {
        questionId: '1',
        questionFrontendId: '1',
        title: 'Two Sum',
        titleSlug: 'two-sum',
        difficulty: 'Easy',
        acRate: 45.5,
        paidOnly: false,
        likes: 1000,
        dislikes: 50,
        quality: 75.5,
        topicTags: [{ name: 'Array', slug: 'array' }],
      },
      {
        questionId: '2',
        questionFrontendId: '2',
        title: 'Add Two Numbers',
        titleSlug: 'add-two-numbers',
        difficulty: 'Medium',
        acRate: 38.2,
        paidOnly: false,
        likes: 900,
        dislikes: 40,
        quality: 72.0,
        topicTags: [{ name: 'Linked List', slug: 'linked-list' }],
      },
    ],
  }

  beforeEach(() => {
    mockGraphQLClient = {
      getProblemList: vi.fn().mockResolvedValue(mockProblemList),
    } as unknown as GraphQLClient

    strategy = new ListScraperStrategy(mockGraphQLClient)
  })

  describe('canHandle', () => {
    it('should return true for list requests', () => {
      const request: ListScrapeRequest = {
        type: 'list',
      }
      expect(strategy.canHandle(request)).toBe(true)
    })

    it('should return false for non-list requests', () => {
      expect(strategy.canHandle({ type: 'problem' } as unknown as ScrapeRequest)).toBe(false)
      expect(strategy.canHandle({ type: 'discussion' } as unknown as ScrapeRequest)).toBe(false)
      expect(strategy.canHandle({ type: 'editorial' } as unknown as ScrapeRequest)).toBe(false)
    })
  })

  describe('execute', () => {
    it('should fetch problem list successfully', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
      }

      const result = await strategy.execute(request)

      expect(result.type).toBe('list')
      expect(result.data).toEqual(mockProblemList)
      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(undefined, 50, 0)
    })

    it('should pass filters to GraphQL client', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
        filters: {
          difficulty: 'Easy',
          tags: ['array', 'hash-table'],
        },
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(
        expect.objectContaining({
          difficulty: 'Easy',
          tags: ['array', 'hash-table'],
        }),
        50,
        0
      )
    })

    it('should pass limit to GraphQL client', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
        limit: 50,
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(undefined, 50, 0)
    })

    it('should handle both filters and limit', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
        filters: { difficulty: 'Medium' },
        limit: 20,
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(
        expect.objectContaining({ difficulty: 'Medium' }),
        20,
        0
      )
    })

    it('should handle request without filters or limit', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(undefined, 50, 0)
    })

    it('should return correct data structure', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
      }

      const result = await strategy.execute(request)

      const data = result.data as ProblemList
      expect(data).toHaveProperty('total')
      expect(data).toHaveProperty('questions')
      expect(Array.isArray(data.questions)).toBe(true)
    })

    it('should handle GraphQL client errors', async () => {
      const error = new Error('Network error')
      mockGraphQLClient.getProblemList = vi.fn().mockRejectedValue(error)

      const request: ListScrapeRequest = {
        type: 'list',
      }

      await expect(strategy.execute(request)).rejects.toThrow('Network error')
    })

    it('should handle empty problem list', async () => {
      const emptyList: ProblemList = {
        total: 0,
        questions: [],
      }
      mockGraphQLClient.getProblemList = vi.fn().mockResolvedValue(emptyList)

      const request: ListScrapeRequest = {
        type: 'list',
      }

      const result = await strategy.execute(request)

      const data = result.data as ProblemList
      expect(data.total).toBe(0)
      expect(data.questions).toHaveLength(0)
    })
  })

  describe('filtering', () => {
    it('should filter by difficulty Easy', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
        filters: { difficulty: 'Easy' },
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(
        expect.objectContaining({ difficulty: 'Easy' }),
        50,
        0
      )
    })

    it('should filter by difficulty Medium', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
        filters: { difficulty: 'Medium' },
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(
        expect.objectContaining({ difficulty: 'Medium' }),
        50,
        0
      )
    })

    it('should filter by difficulty Hard', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
        filters: { difficulty: 'Hard' },
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(
        expect.objectContaining({ difficulty: 'Hard' }),
        50,
        0
      )
    })

    it('should filter by single tag', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
        filters: { tags: ['array'] },
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['array'] }),
        50,
        0
      )
    })

    it('should filter by multiple tags', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
        filters: { tags: ['array', 'hash-table', 'dynamic-programming'] },
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['array', 'hash-table', 'dynamic-programming'] }),
        50,
        0
      )
    })

    it('should combine difficulty and tag filters', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
        filters: {
          difficulty: 'Medium',
          tags: ['array', 'hash-table'],
        },
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(
        expect.objectContaining({
          difficulty: 'Medium',
          tags: ['array', 'hash-table'],
        }),
        50,
        0
      )
    })
  })

  describe('limit handling', () => {
    it('should handle limit of 1', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
        limit: 1,
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(undefined, 1, 0)
    })

    it('should handle large limits', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
        limit: 1000,
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(undefined, 1000, 0)
    })

    it('should handle limit of 0', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
        limit: 0,
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblemList).toHaveBeenCalledWith(undefined, 0, 0)
    })
  })

  describe('name property', () => {
    it('should have correct name identifier', () => {
      expect(strategy.name).toBe('list')
    })
  })

  describe('data validation', () => {
    it('should preserve problem details in list', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
      }

      const result = await strategy.execute(request)

      const data = result.data as ProblemList
      expect(data.questions[0]).toHaveProperty('questionId')
      expect(data.questions[0]).toHaveProperty('title')
      expect(data.questions[0]).toHaveProperty('titleSlug')
      expect(data.questions[0]).toHaveProperty('difficulty')
    })

    it('should return correct total count', async () => {
      const request: ListScrapeRequest = {
        type: 'list',
      }

      const result = await strategy.execute(request)

      const data = result.data as ProblemList
      expect(data.total).toBe(100)
    })

    it('should handle lists with many problems', async () => {
      const largeList: ProblemList = {
        total: 500,
        questions: Array(100)
          .fill(0)
          .map((_, i) => ({
            questionId: String(i + 1),
            questionFrontendId: String(i + 1),
            title: `Problem ${i + 1}`,
            titleSlug: `problem-${i + 1}`,
            difficulty: 'Easy' as const,
            acRate: 50.0,
            paidOnly: false,
            likes: 1000 - i * 10,
            dislikes: 50 - i,
            quality: 75.5 - i * 0.1,
            topicTags: [],
          })),
      }
      mockGraphQLClient.getProblemList = vi.fn().mockResolvedValue(largeList)

      const request: ListScrapeRequest = {
        type: 'list',
      }

      const result = await strategy.execute(request)

      const data = result.data as ProblemList
      expect(data.questions).toHaveLength(100)
      expect(data.total).toBe(500)
    })
  })
})
