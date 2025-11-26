import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { LeetCodeScraper } from '@lesca/core'
import { FileSystemStorage } from '@lesca/storage'
import { ProblemScraperStrategy } from '@lesca/scrapers'
import { GraphQLClient } from '@lesca/api-client'
import type { ProblemScrapeRequest, BrowserDriver } from '@lesca/shared/types'

const FIXTURES_DIR = join(__dirname, '../fixtures/graphql-responses')

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf-8'))
}

describe('E2E: Error Handling', () => {
  let tempDir: string
  let storage: FileSystemStorage
  let browserDriver: BrowserDriver

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lesca-error-test-'))
    storage = new FileSystemStorage(tempDir)

    browserDriver = {
      launch: async () => {},
      close: async () => {},
      navigate: async () => {},
      waitForSelector: async () => {},
      extractContent: async () => '',
      extractWithFallback: async () => '',
      extractAll: async () => [],
      elementExists: async () => false,
      getBrowser: () => undefined,
    } as unknown as BrowserDriver
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should handle network errors gracefully', async () => {
    const graphqlClient = {
      getProblem: async () => {
        throw new Error('Network Error')
      },
    } as unknown as GraphQLClient

    // Also make browser fail to ensure we get the full failure
    const failBrowserDriver = {
      ...browserDriver,
      launch: async () => {
        throw new Error('Browser Launch Failed')
      },
    } as unknown as BrowserDriver

    const problemStrategy = new ProblemScraperStrategy(graphqlClient, failBrowserDriver)
    const scraper = new LeetCodeScraper([problemStrategy], storage)

    const request: ProblemScrapeRequest = {
      type: 'problem',
      titleSlug: 'two-sum',
    }

    const result = await scraper.scrape(request)
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    // The error message should indicate overall failure
    expect(result.error?.message).toContain('Failed to scrape problem')
  })

  it('should handle rate limit errors (429)', async () => {
    const graphqlClient = {
      getProblem: async () => {
        const err = new Error('Too Many Requests') as any
        err.response = { status: 429 }
        throw err
      },
    } as unknown as GraphQLClient

    const problemStrategy = new ProblemScraperStrategy(graphqlClient, browserDriver)
    const scraper = new LeetCodeScraper([problemStrategy], storage)

    const request: ProblemScrapeRequest = {
      type: 'problem',
      titleSlug: 'two-sum',
    }

    const result = await scraper.scrape(request)
    expect(result.success).toBe(false)
    // In a real scenario, we might want to check if it retries, but for single scrape it just fails
    expect(result.error).toBeDefined()
  })

  it('should handle authentication failures', async () => {
    // Simulate auth failure (e.g. premium problem without premium account)
    const mockProblem = loadFixture('problem-two-sum.json').question
    mockProblem.isPaidOnly = true
    mockProblem.content = null // Simulate no content access

    const graphqlClient = {
      getProblem: async () => {
        return mockProblem
      },
    } as unknown as GraphQLClient

    // Mock browser driver to fail extraction for paid content if not logged in
    const authBrowserDriver = {
      ...browserDriver,
      extractContent: async () => {
        throw new Error('Content not accessible')
      },
    } as unknown as BrowserDriver

    const problemStrategy = new ProblemScraperStrategy(graphqlClient, authBrowserDriver)
    const scraper = new LeetCodeScraper([problemStrategy], storage)

    const request: ProblemScrapeRequest = {
      type: 'problem',
      titleSlug: 'two-sum',
    }

    // This depends on how the strategy handles paid problems.
    // If it tries to scrape and fails, it should return success=false or a specific error.
    const result = await scraper.scrape(request)

    // If logic is: try GraphQL -> get isPaidOnly=true -> try Browser -> fail
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
