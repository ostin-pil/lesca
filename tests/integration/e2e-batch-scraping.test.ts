import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { BatchScraper } from '@lesca/core'
import { LeetCodeScraper } from '@lesca/core'
import { FileSystemStorage } from '@lesca/storage'
import { ProblemScraperStrategy } from '@lesca/scrapers'
import { GraphQLClient } from '@lesca/api-client'
import type { ProblemScrapeRequest } from '@lesca/shared/types'

/**
 * End-to-End Integration Test: Batch Scraping
 *
 * Tests batch scraping functionality:
 * 1. Concurrent scraping with configurable concurrency
 * 2. Error handling and retry logic
 * 3. Progress tracking
 * 4. Batch statistics
 *
 * NOTE: This test uses mocked data to avoid hitting LeetCode API
 */
describe('E2E: Batch Scraping', () => {
  let tempDir: string
  let scraper: LeetCodeScraper
  let batchScraper: BatchScraper
  let storage: FileSystemStorage

  const mockProblemMap: Record<string, any> = {
    'two-sum': {
      questionId: '1',
      questionFrontendId: '1',
      title: 'Two Sum',
      titleSlug: 'two-sum',
      content: '<p>Example problem content</p>',
      difficulty: 'Easy',
      exampleTestcases: '[]',
      topicTags: [],
      codeSnippets: [],
      hints: [],
      mysqlSchemas: [],
      dataSchemas: [],
      similarQuestions: [],
      companyTagStats: {},
      stats: {},
      solution: null,
    },
    'add-two-numbers': {
      questionId: '2',
      questionFrontendId: '2',
      title: 'Add Two Numbers',
      titleSlug: 'add-two-numbers',
      content: '<p>Add two numbers content</p>',
      difficulty: 'Medium',
      exampleTestcases: '[]',
      topicTags: [],
      codeSnippets: [],
      hints: [],
      mysqlSchemas: [],
      dataSchemas: [],
      similarQuestions: [],
      companyTagStats: {},
      stats: {},
      solution: null,
    },
    'longest-substring-without-repeating-characters': {
      questionId: '3',
      questionFrontendId: '3',
      title: 'Longest Substring Without Repeating Characters',
      titleSlug: 'longest-substring-without-repeating-characters',
      content: '<p>Longest substring content</p>',
      difficulty: 'Medium',
      exampleTestcases: '[]',
      topicTags: [],
      codeSnippets: [],
      hints: [],
      mysqlSchemas: [],
      dataSchemas: [],
      similarQuestions: [],
      companyTagStats: {},
      stats: {},
      solution: null,
    },
  }

  beforeEach(() => {
    // Create temporary directory for test output
    tempDir = mkdtempSync(join(tmpdir(), 'lesca-batch-test-'))

    // Initialize components
    storage = new FileSystemStorage(tempDir)

    // Mock GraphQL client to avoid hitting real API
    const graphqlClient = {
      getProblem: async (titleSlug: string) => {
        const item = mockProblemMap[titleSlug]
        if (item) return item
        const err: any = new Error(`Problem not found: ${titleSlug}`)
        err.status = 404
        throw err
      },
    } as unknown as GraphQLClient

    const problemStrategy = new ProblemScraperStrategy(graphqlClient)
    scraper = new LeetCodeScraper([problemStrategy], storage, { format: 'obsidian' })
    batchScraper = new BatchScraper(scraper, { concurrency: 2 })
  })

  afterEach(() => {
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should scrape multiple problems concurrently', async () => {
    // TODO: Implement with mocked API responses

    const requests: ProblemScrapeRequest[] = [
      { type: 'problem', titleSlug: 'two-sum' },
      { type: 'problem', titleSlug: 'add-two-numbers' },
      { type: 'problem', titleSlug: 'longest-substring-without-repeating-characters' },
    ]

    const result = await batchScraper.scrapeAll(requests)
    // Debugging removed

    expect(result.stats.total).toBe(3)
    expect(result.stats.successful).toBe(3)
    expect(result.stats.failed).toBe(0)

    // Verify all files were created
    expect(result.results).toHaveLength(3)
    result.results.forEach((r) => {
      expect(r.success).toBe(true)
      if (r.success && r.filePath) {
        const absolutePath = storage.getAbsolutePath(r.filePath)
        expect(existsSync(absolutePath)).toBe(true)
      }
    })
  }, 60000)

  it('should handle partial failures in batch', async () => {
    // TODO: Mix of successful and failing requests

    const requests: ProblemScrapeRequest[] = [
      { type: 'problem', titleSlug: 'two-sum' },
      { type: 'problem', titleSlug: 'non-existent-problem' },
      { type: 'problem', titleSlug: 'add-two-numbers' },
    ]

    const result = await batchScraper.scrapeAll(requests)

    expect(result.stats.total).toBe(3)
    expect(result.stats.successful).toBe(2)
    expect(result.stats.failed).toBe(1)
    expect(result.errors).toHaveLength(1)
  }, 60000)

  it('should respect concurrency limits', async () => {
    // Verify that no more than N requests run simultaneously by simulating delays

    let concurrent = 0
    let maxConcurrent = 0

    const graphqlClient = {
      getProblem: async (titleSlug: string) => {
        concurrent++
        if (concurrent > maxConcurrent) maxConcurrent = concurrent
        // Simulate variable delay
        await new Promise((resolve) => setTimeout(resolve, 50))
        concurrent--

        const item = mockProblemMap[titleSlug]
        if (item) return item
        const err: any = new Error(`Problem not found: ${titleSlug}`)
        err.status = 404
        throw err
      },
    } as unknown as GraphQLClient

    const problemStrategy = new ProblemScraperStrategy(graphqlClient)
    scraper = new LeetCodeScraper([problemStrategy], storage, { format: 'obsidian' })
    batchScraper = new BatchScraper(scraper, { concurrency: 2 })

    const requests: ProblemScrapeRequest[] = [
      { type: 'problem', titleSlug: 'two-sum' },
      { type: 'problem', titleSlug: 'add-two-numbers' },
      { type: 'problem', titleSlug: 'longest-substring-without-repeating-characters' },
    ]

    const result = await batchScraper.scrapeAll(requests)

    expect(result.stats.total).toBe(3)
    expect(maxConcurrent).toBeLessThanOrEqual(2)
  }, 60000)

  it('should provide progress updates', async () => {
    const progressEvents: any[] = []

    const graphqlClient = {
      getProblem: async (titleSlug: string) => {
        // Small delay to allow progress events to be emitted
        await new Promise((resolve) => setTimeout(resolve, 10))
        const item = mockProblemMap[titleSlug]
        if (item) return item
        const err: any = new Error(`Problem not found: ${titleSlug}`)
        err.status = 404
        throw err
      },
    } as unknown as GraphQLClient

    const problemStrategy = new ProblemScraperStrategy(graphqlClient)
    scraper = new LeetCodeScraper([problemStrategy], storage, { format: 'obsidian' })
    batchScraper = new BatchScraper(scraper, {
      concurrency: 2,
      onProgress: (p) => progressEvents.push(p),
    })

    const requests: ProblemScrapeRequest[] = [
      { type: 'problem', titleSlug: 'two-sum' },
      { type: 'problem', titleSlug: 'add-two-numbers' },
    ]

    const result = await batchScraper.scrapeAll(requests)

    expect(result.stats.total).toBe(2)
    // Expect at least one progress event and final completed equals total
    expect(progressEvents.length).toBeGreaterThan(0)
    const final = progressEvents[progressEvents.length - 1]
    expect(final.completed).toBeGreaterThanOrEqual(result.results.length)
  }, 60000)
})
