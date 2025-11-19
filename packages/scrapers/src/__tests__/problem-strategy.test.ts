import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProblemScraperStrategy } from '../problem-strategy.js'
import type { ProblemScrapeRequest, Problem } from '../../../../shared/types/src/index.js'
import { GraphQLClient } from '../../../api-client/src/index.js'

describe('ProblemScraperStrategy', () => {
  let strategy: ProblemScraperStrategy
  let mockGraphQLClient: GraphQLClient

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

    strategy = new ProblemScraperStrategy(mockGraphQLClient)
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
      expect(strategy.canHandle({ type: 'list' } as any)).toBe(false)
      expect(strategy.canHandle({ type: 'discussion' } as any)).toBe(false)
      expect(strategy.canHandle({ type: 'editorial' } as any)).toBe(false)
    })
  })

  describe('execute', () => {
    it('should fetch problem successfully', async () => {
      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await strategy.execute(request)

      expect(result.type).toBe('problem')
      expect(result.data).toEqual(mockProblem)
      expect(mockGraphQLClient.getProblem).toHaveBeenCalledWith('two-sum')
    })

    it('should return problem data with correct structure', async () => {
      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await strategy.execute(request)

      expect(result.data).toHaveProperty('questionId')
      expect(result.data).toHaveProperty('title')
      expect(result.data).toHaveProperty('titleSlug')
      expect(result.data).toHaveProperty('difficulty')
      expect(result.data).toHaveProperty('content')
    })

    it('should handle GraphQL client errors', async () => {
      const error = new Error('Network error')
      mockGraphQLClient.getProblem = vi.fn().mockRejectedValue(error)

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      await expect(strategy.execute(request)).rejects.toThrow('Network error')
    })

    it('should handle missing problem', async () => {
      mockGraphQLClient.getProblem = vi.fn().mockResolvedValue(null)

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'nonexistent',
      }

      await expect(strategy.execute(request)).rejects.toThrow()
    })

    it('should pass titleSlug correctly', async () => {
      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'longest-substring',
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblem).toHaveBeenCalledWith('longest-substring')
    })
  })

  describe('name property', () => {
    it('should have correct name identifier', () => {
      expect(strategy.name).toBe('problem')
    })
  })

  describe('edge cases', () => {
    it('should handle problems with special characters in titleSlug', async () => {
      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: '3sum-closest',
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblem).toHaveBeenCalledWith('3sum-closest')
    })

    it('should handle problems with long titleSlugs', async () => {
      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'longest-substring-without-repeating-characters',
      }

      await strategy.execute(request)

      expect(mockGraphQLClient.getProblem).toHaveBeenCalledWith(
        'longest-substring-without-repeating-characters'
      )
    })

    it('should handle problems with all difficulty levels', async () => {
      const difficulties = ['Easy', 'Medium', 'Hard']

      for (const difficulty of difficulties) {
        const problemWithDifficulty = { ...mockProblem, difficulty }
        mockGraphQLClient.getProblem = vi.fn().mockResolvedValue(problemWithDifficulty)

        const request: ProblemScrapeRequest = {
          type: 'problem',
          titleSlug: 'test',
        }

        const result = await strategy.execute(request)
        const data = result.data as Problem
        expect(data.difficulty).toBe(difficulty)
      }
    })

    it('should handle problems with no topic tags', async () => {
      const problemNoTags = { ...mockProblem, topicTags: [] }
      mockGraphQLClient.getProblem = vi.fn().mockResolvedValue(problemNoTags)

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'test',
      }

      const result = await strategy.execute(request)
      const data = result.data as Problem
      expect(data.topicTags).toEqual([])
    })

    it('should throw error for problems with empty content', async () => {
      const problemNoContent = { ...mockProblem, content: '' }
      mockGraphQLClient.getProblem = vi.fn().mockResolvedValue(problemNoContent)

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'test',
      }

      await expect(strategy.execute(request)).rejects.toThrow('Invalid problem: missing content')
    })
  })

  describe('data validation', () => {
    it('should return complete problem object', async () => {
      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await strategy.execute(request)

      expect(result.type).toBe('problem')
      expect(result.data).toBeDefined()
      const data = result.data as Problem
      expect(data.questionId).toBe('1')
      expect(data.title).toBe('Two Sum')
      expect(data.titleSlug).toBe('two-sum')
    })

    it('should preserve all problem fields', async () => {
      const fullProblem: Problem = {
        ...mockProblem,
        exampleTestcases: 'test1\ntest2',
        hints: ['Hint 1', 'Hint 2'],
        solution: { canSeeDetail: true },
        similarQuestions: '[]',
        companyTagStats: '{}',
      } as Problem

      mockGraphQLClient.getProblem = vi.fn().mockResolvedValue(fullProblem)

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: 'two-sum',
      }

      const result = await strategy.execute(request)

      const data = result.data as Problem
      expect(data.exampleTestcases).toBeDefined()
      expect(data.hints).toBeDefined()
      expect(data.solution).toBeDefined()
    })
  })
})
