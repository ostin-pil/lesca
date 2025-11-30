import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { GraphQLClient, RateLimiter } from '../graphql-client'
import { GraphQLError, RateLimitError } from '@lesca/error'
import type { AuthCredentials, Problem } from '@lesca/shared/types'
import { TieredCache } from '@lesca/shared/utils'
import { resolve } from 'path'
import { existsSync, rmSync, mkdirSync } from 'fs'

vi.mock('@lesca/shared/utils', async () => {
  const actual = await vi.importActual('@lesca/shared/utils')
  return {
    ...actual,
    calculateQuality: vi.fn().mockReturnValue(100),
  }
})

describe('RateLimiter', () => {
  describe('basic rate limiting', () => {
    it('should enforce minimum delay between requests', async () => {
      const limiter = new RateLimiter(100, 100, false)
      const start = Date.now()

      await limiter.acquire()
      await limiter.acquire()

      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(90)
    })

    it('should not delay first request', async () => {
      const limiter = new RateLimiter(100, 100, false)
      const start = Date.now()

      await limiter.acquire()

      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(50)
    })

    it('should handle multiple sequential requests', async () => {
      const limiter = new RateLimiter(50, 50, false)
      const start = Date.now()

      await limiter.acquire() // No delay
      await limiter.acquire() // ~50ms delay
      await limiter.acquire() // ~50ms delay

      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(90)
    })
  })

  describe('jitter', () => {
    it('should add random jitter when enabled', async () => {
      const limiter = new RateLimiter(100, 200, true)
      const delays: number[] = []

      // Test multiple acquisitions to verify randomness
      for (let i = 0; i < 5; i++) {
        const start = Date.now()
        await limiter.acquire()
        if (i > 0) {
          // Skip first (no delay)
          delays.push(Date.now() - start)
        }
      }

      // At least some delays should differ (randomness check)
      const uniqueDelays = new Set(delays.map((d) => Math.floor(d / 10)))
      expect(uniqueDelays.size).toBeGreaterThan(1)
    })

    it('should not add jitter when disabled', async () => {
      const limiter = new RateLimiter(100, 200, false)
      const delays: number[] = []

      for (let i = 0; i < 3; i++) {
        const start = Date.now()
        await limiter.acquire()
        if (i > 0) {
          delays.push(Date.now() - start)
        }
      }

      // All delays should be approximately the same (minDelay)
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(90)
        expect(delay).toBeLessThan(120)
      })
    })
  })

  describe('delay adjustment', () => {
    it('should increase delay with multiplier', async () => {
      const limiter = new RateLimiter(100, 100, false)

      await limiter.acquire() // No delay

      limiter.increaseDelay(2)

      const start = Date.now()
      await limiter.acquire()
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(190) // 200ms (doubled)
    })

    it('should reset delay to specified values', async () => {
      const limiter = new RateLimiter(100, 100, false)

      limiter.increaseDelay(3) // Triple the delay
      limiter.resetDelay(50, 50) // Reset to 50ms

      const start = Date.now()
      await limiter.acquire() // No delay
      await limiter.acquire()
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(40)
      expect(elapsed).toBeLessThan(80)
    })
  })
})

describe('GraphQLClient', () => {
  let fetchSpy: MockInstance
  const testCacheDir = resolve(__dirname, '__test_graphql_cache__')

  beforeEach(() => {
    // Setup fetch mock
    fetchSpy = vi.spyOn(global, 'fetch')

    // Clean cache directory
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
    mkdirSync(testCacheDir, { recursive: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()

    // Cleanup cache directory
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
  })

  describe('basic query execution', () => {
    it('should execute a successful query', async () => {
      const mockResponse = {
        data: { test: 'value' },
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response)

      const client = new GraphQLClient()
      const result = await client.query<{ test: string }>('{ test }')

      expect(result).toEqual({ test: 'value' })
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://leetcode.com/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }),
        })
      )
    })

    it('should send variables with query', async () => {
      const mockResponse = {
        data: { question: { title: 'Two Sum' } },
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response)

      const client = new GraphQLClient()
      await client.query('query($slug: String!) { question(titleSlug: $slug) }', {
        slug: 'two-sum',
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://leetcode.com/graphql',
        expect.objectContaining({
          body: JSON.stringify({
            query: 'query($slug: String!) { question(titleSlug: $slug) }',
            variables: { slug: 'two-sum' },
          }),
        })
      )
    })
  })

  describe('error handling', () => {
    it('should throw GraphQLError on HTTP errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
      } as Response)

      const client = new GraphQLClient()

      await expect(client.query('{ test }')).rejects.toThrow(GraphQLError)
      await expect(client.query('{ test }')).rejects.toThrow('HTTP 500')
    })

    it('should throw RateLimitError on 429 status', async () => {
      const headers = new Headers()
      headers.set('Retry-After', '60')

      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        headers,
      } as Response)

      const client = new GraphQLClient()

      await expect(client.query('{ test }')).rejects.toThrow(RateLimitError)
      await expect(client.query('{ test }')).rejects.toThrow('Rate limit exceeded')
    })

    it('should throw GraphQLError on GraphQL errors in response', async () => {
      const mockResponse = {
        errors: [{ message: 'Field not found' }, { message: 'Invalid query' }],
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response)

      const client = new GraphQLClient()

      await expect(client.query('{ test }')).rejects.toThrow(GraphQLError)
      await expect(client.query('{ test }')).rejects.toThrow('Field not found, Invalid query')
    })

    it('should throw GraphQLError when no data returned', async () => {
      const mockResponse = {}

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response)

      const client = new GraphQLClient()

      await expect(client.query('{ test }')).rejects.toThrow(GraphQLError)
      await expect(client.query('{ test }')).rejects.toThrow('No data returned')
    })

    it('should wrap network errors in GraphQLError', async () => {
      fetchSpy.mockRejectedValue(new Error('Network failure'))

      const client = new GraphQLClient()

      await expect(client.query('{ test }')).rejects.toThrow(GraphQLError)
      await expect(client.query('{ test }')).rejects.toThrow('Failed to execute GraphQL query')
    })
  })

  describe('authentication', () => {
    it('should include auth credentials in request', async () => {
      const mockResponse = { data: { test: 'value' } }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response)

      const auth: AuthCredentials = {
        cookies: [
          { name: 'LEETCODE_SESSION', value: 'abc123', domain: 'leetcode.com' },
          { name: 'csrftoken', value: 'xyz789', domain: 'leetcode.com' },
        ],
        csrfToken: 'xyz789',
      }

      const client = new GraphQLClient(auth)
      await client.query('{ test }')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://leetcode.com/graphql',
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: 'LEETCODE_SESSION=abc123; csrftoken=xyz789',
            'x-csrftoken': 'xyz789',
          }),
        })
      )
    })

    it('should support setting auth after initialization', async () => {
      const mockResponse = { data: { test: 'value' } }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response)

      const client = new GraphQLClient()

      const auth: AuthCredentials = {
        cookies: [{ name: 'session', value: 'token', domain: 'leetcode.com' }],
        csrfToken: 'test-csrf-token',
      }

      client.setAuth(auth)
      await client.query('{ test }')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://leetcode.com/graphql',
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: 'session=token',
          }),
        })
      )
    })

    it('should support clearing auth', async () => {
      const mockResponse = { data: { test: 'value' } }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response)

      const auth: AuthCredentials = {
        cookies: [{ name: 'session', value: 'token', domain: 'leetcode.com' }],
        csrfToken: 'test-csrf-token',
      }

      const client = new GraphQLClient(auth)
      client.clearAuth()
      await client.query('{ test }')

      const call = fetchSpy.mock.calls[0]
      const headers = (call?.[1] as RequestInit | undefined)?.headers as
        | Record<string, string>
        | undefined

      expect(headers?.['Cookie']).toBeUndefined()
    })
  })

  describe('rate limiting integration', () => {
    it('should respect rate limiter delays', async () => {
      const mockResponse = { data: { test: 'value' } }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response)

      const rateLimiter = new RateLimiter(100, 100, false)
      const client = new GraphQLClient(undefined, rateLimiter)

      const start = Date.now()
      await client.query('{ test1 }')
      await client.query('{ test2 }')
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(90)
    })
  })

  describe('cache integration', () => {
    it('should use cached results when available', async () => {
      const mockResponse = { data: { test: 'value' } }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response)

      const cache = new TieredCache(testCacheDir, {
        memorySize: 10,
        fileTtl: 10000,
      })
      const client = new GraphQLClient(undefined, undefined, cache)

      // First call - should hit network
      const result1 = await client.query('{ test }')
      expect(result1).toEqual({ test: 'value' })
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      const result2 = await client.query('{ test }')
      expect(result2).toEqual({ test: 'value' })
      expect(fetchSpy).toHaveBeenCalledTimes(1) // Still 1, not called again
    })

    it('should cache with different TTLs based on query type', async () => {
      const mockResponse = { data: { question: { title: 'Test' } } }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response)

      const cache = new TieredCache(testCacheDir)
      const client = new GraphQLClient(undefined, undefined, cache)

      // Problem queries should have 7-day TTL
      await client.query('query { question(titleSlug: "test") { title } }')

      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('should generate unique cache keys for different queries', async () => {
      const cache = new TieredCache(testCacheDir)
      const client = new GraphQLClient(undefined, undefined, cache)

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { result: 'query1' } }),
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { result: 'query2' } }),
          headers: new Headers(),
        } as Response)

      const result1 = await client.query('{ test1 }')
      const result2 = await client.query('{ test2 }')

      expect(result1).toEqual({ result: 'query1' })
      expect(result2).toEqual({ result: 'query2' })
      expect(fetchSpy).toHaveBeenCalledTimes(2) // Different queries = different cache keys
    })

    it('should bypass cache when noCache option is true', async () => {
      const mockResponse1 = { data: { test: 'value1' } }
      const mockResponse2 = { data: { test: 'value2' } }

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse1,
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse2,
          headers: new Headers(),
        } as Response)

      const cache = new TieredCache(testCacheDir)
      const client = new GraphQLClient(undefined, undefined, cache)

      // First call with cache
      const result1 = await client.query('{ test }')
      expect(result1).toEqual({ test: 'value1' })
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Second call with noCache: true - should fetch again
      const result2 = await client.query('{ test }', undefined, { noCache: true })
      expect(result2).toEqual({ test: 'value2' })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('should respect TTL expiration', async () => {
      const mockResponse = { data: { test: 'value' } }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response)

      const cache = new TieredCache(testCacheDir, {
        memorySize: 10,
        fileTtl: 50, // Short TTL for test
      })
      const client = new GraphQLClient(undefined, undefined, cache)

      // First call - cache miss, network hit
      const result1 = await client.query<{ test: string }>('{ test }', undefined, { ttl: 50 })
      expect(result1).toEqual({ test: 'value' })
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Second call - cache expired, network hit again
      const result2 = await client.query<{ test: string }>('{ test }')
      expect(result2).toEqual({ test: 'value' })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('should invalidate cache entries', async () => {
      const mockResponse = { data: { test: 'value' } }
      const queryStr = '{ test }'
      const queryHash = require('crypto').createHash('sha256').update(queryStr).digest('hex')
      const varsStr = JSON.stringify({})
      const cacheKey = `graphql:${queryHash}:${varsStr}`

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response)

      const cache = new TieredCache(testCacheDir)
      const client = new GraphQLClient(undefined, undefined, cache)

      // First call - cache miss
      const result1 = await client.query('{ test }')
      expect(result1).toEqual({ test: 'value' })
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Invalidate cache
      await cache.delete(cacheKey)

      // Second call - cache miss after invalidation
      const result2 = await client.query('{ test }')
      expect(result2).toEqual({ test: 'value' })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('getProblem method', () => {
    it('should fetch a problem by titleSlug', async () => {
      const mockProblem: Problem = {
        questionId: '1',
        questionFrontendId: '1',
        title: 'Two Sum',
        titleSlug: 'two-sum',
        likes: 1000,
        dislikes: 50,
        quality: 75.5,
        content: '<p>Test content</p>',
        difficulty: 'Easy',
        exampleTestcases: 'test1\ntest2',
        hints: [],
        topicTags: [{ name: 'Array', slug: 'array' }],
        companyTagStats: null,
        stats: '{"totalAccepted": "1000", "totalSubmission": "2000"}',
        codeSnippets: [],
        similarQuestions: '[]',
        solution: null,
        mysqlSchemas: [],
        dataSchemas: [],
        isPaidOnly: false,
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { question: mockProblem } }),
        headers: new Headers(),
      } as Response)

      const client = new GraphQLClient()
      const problem = await client.getProblem('two-sum')

      expect(problem).toEqual(mockProblem)
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://leetcode.com/graphql',
        expect.objectContaining({
          body: expect.stringContaining('titleSlug: $titleSlug'),
        })
      )
    })

    it('should throw error when problem not found', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { question: null } }),
        headers: new Headers(),
      } as Response)

      const client = new GraphQLClient()

      await expect(client.getProblem('nonexistent')).rejects.toThrow(GraphQLError)
      await expect(client.getProblem('nonexistent')).rejects.toThrow('Problem not found')
    })
  })

  describe('getProblemList method', () => {
    it('should fetch problem list with default parameters', async () => {
      const mockList = {
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
            topicTags: [],
          },
        ],
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { problemsetQuestionList: mockList } }),
        headers: new Headers(),
      } as Response)

      const client = new GraphQLClient()
      const result = await client.getProblemList()

      expect(result).toEqual(mockList)
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://leetcode.com/graphql',
        expect.objectContaining({
          body: expect.stringContaining('questionList'),
        })
      )
    })

    it('should apply filters correctly', async () => {
      const mockList = {
        total: 10,
        questions: [],
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { problemsetQuestionList: mockList } }),
        headers: new Headers(),
      } as Response)

      const client = new GraphQLClient()
      await client.getProblemList({ difficulty: 'Easy', tags: ['array', 'hash-table'] })

      const call = fetchSpy.mock.calls[0]
      expect(call).toBeDefined()
      const body = (call?.[1] as RequestInit | undefined)?.body
      expect(body).toBeDefined()
      const callBody = JSON.parse(body as string)
      expect(callBody.variables.filters).toEqual({
        difficulty: 'EASY',
        tags: ['array', 'hash-table'],
      })
    })
  })

  describe('getAllProblems method', () => {
    it('should fetch all problems with pagination', async () => {
      const page1 = {
        total: 250,
        questions: new Array(100).fill(null).map((_, i) => ({
          questionId: String(i + 1),
          questionFrontendId: String(i + 1),
          title: `Problem ${i + 1}`,
          titleSlug: `problem-${i + 1}`,
          difficulty: 'Easy',
          acRate: 50,
          paidOnly: false,
          topicTags: [],
        })),
      }

      const page2 = {
        total: 250,
        questions: new Array(100).fill(null).map((_, i) => ({
          questionId: String(i + 101),
          questionFrontendId: String(i + 101),
          title: `Problem ${i + 101}`,
          titleSlug: `problem-${i + 101}`,
          difficulty: 'Medium',
          acRate: 50,
          paidOnly: false,
          topicTags: [],
        })),
      }

      const page3 = {
        total: 250,
        questions: new Array(50).fill(null).map((_, i) => ({
          questionId: String(i + 201),
          questionFrontendId: String(i + 201),
          title: `Problem ${i + 201}`,
          titleSlug: `problem-${i + 201}`,
          difficulty: 'Hard',
          acRate: 50,
          paidOnly: false,
          topicTags: [],
        })),
      }

      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { problemsetQuestionList: page1 } }),
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { problemsetQuestionList: page2 } }),
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { problemsetQuestionList: page3 } }),
          headers: new Headers(),
        } as Response)

      const client = new GraphQLClient()
      const result = await client.getAllProblems()

      expect(result.total).toBe(250)
      expect(result.questions).toHaveLength(250)
      expect(fetchSpy).toHaveBeenCalledTimes(3) // 3 pages
    })
  })

  describe('getUserProfile method', () => {
    it('should fetch user profile by username', async () => {
      const mockUser = {
        username: 'testuser',
        profile: {
          realName: 'Test User',
          ranking: 12345,
        },
      }

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { matchedUser: mockUser } }),
        headers: new Headers(),
      } as Response)

      const client = new GraphQLClient()
      const user = await client.getUserProfile('testuser')

      expect(user).toEqual(mockUser)
    })

    it('should throw error when user not found', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { matchedUser: null } }),
        headers: new Headers(),
      } as Response)

      const client = new GraphQLClient()

      await expect(client.getUserProfile('nonexistent')).rejects.toThrow(GraphQLError)
      await expect(client.getUserProfile('nonexistent')).rejects.toThrow('User not found')
    })
  })
})
