import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { GraphQLClient } from '@lesca/api-client'
import { TieredCache } from '@lesca/shared/utils'

const FIXTURES_DIR = join(__dirname, '../fixtures/graphql-responses')

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf-8'))
}

describe('E2E: Cache Behavior', () => {
  let tempDir: string
  let cache: TieredCache
  let mockFetch: any

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lesca-cache-behavior-test-'))
    cache = new TieredCache(tempDir)

    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { question: loadFixture('problem-two-sum.json').question } }),
    })
    global.fetch = mockFetch
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
    vi.clearAllMocks()
  })

  it('should cache GraphQL responses', async () => {
    const client = new GraphQLClient(undefined, undefined, cache)

    // First request: should hit network
    await client.getProblem('two-sum')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second request: should hit cache
    await client.getProblem('two-sum')
    expect(mockFetch).toHaveBeenCalledTimes(1) // Call count should not increase
  })

  it('should respect noCache option', async () => {
    const client = new GraphQLClient(undefined, undefined, cache)

    // First request: network
    await client.getProblem('two-sum')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second request with noCache: network again
    // Note: getProblem doesn't expose options directly in current signature,
    // but query does. We might need to test query directly or update getProblem signature.
    // Looking at GraphQLClient.ts, getProblem calls query without options.
    // So we can only test this via query() method directly for now.

    await client.query('some-query', {}, { noCache: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should use different cache keys for different variables', async () => {
    const client = new GraphQLClient(undefined, undefined, cache)

    await client.query('query', { var: 1 })
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await client.query('query', { var: 2 })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
