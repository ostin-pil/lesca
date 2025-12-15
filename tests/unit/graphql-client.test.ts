import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GraphQLClient } from '@lesca/api-client'
import { GraphQLError, RateLimitError, NetworkError } from '@lesca/error'

// Mock logger to avoid console noise
vi.mock('@lesca/shared-utils', async () => {
  const actual = await vi.importActual('@lesca/shared-utils')
  return {
    ...actual,
    logger: {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  }
})

describe('GraphQLClient', () => {
  let client: GraphQLClient

  beforeEach(() => {
    client = new GraphQLClient()
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: { get: () => null },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should retry on 429 Rate Limit', async () => {
    const mockFetch = global.fetch as any

    // Fail twice with 429, then succeed
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => '1' },
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => '1' },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { success: true } }),
      })

    const result = await client.query('query { success }')

    expect(result).toEqual({ success: true })
    expect(mockFetch).toHaveBeenCalledTimes(3)
  }, 10000) // Increase timeout

  it('should retry on Network Error (fetch throws)', async () => {
    const mockFetch = global.fetch as any

    // Fail twice with network error, then succeed
    mockFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { success: true } }),
      })

    const result = await client.query('query { success }')

    expect(result).toEqual({ success: true })
    expect(mockFetch).toHaveBeenCalledTimes(3)
  }, 10000)

  it('should retry on 5xx Server Error', async () => {
    const mockFetch = global.fetch as any

    // Fail once with 500, then succeed
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { success: true } }),
      })

    const result = await client.query('query { success }')

    expect(result).toEqual({ success: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should NOT retry on 404 Not Found', async () => {
    const mockFetch = global.fetch as any

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    await expect(client.query('query { success }')).rejects.toThrow(GraphQLError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should NOT retry on 400 Bad Request', async () => {
    const mockFetch = global.fetch as any

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    })

    await expect(client.query('query { success }')).rejects.toThrow(GraphQLError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should NOT retry on GraphQL Errors', async () => {
    const mockFetch = global.fetch as any

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        errors: [{ message: 'Syntax Error' }],
      }),
    })

    await expect(client.query('query { success }')).rejects.toThrow(GraphQLError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
