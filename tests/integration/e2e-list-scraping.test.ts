import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { LeetCodeScraper } from '@lesca/core'
import { FileSystemStorage } from '@lesca/storage'
import { ListScraperStrategy } from '@lesca/scrapers'
import { GraphQLClient } from '@lesca/api-client'
import type { ListScrapeRequest, ProblemList, BrowserDriver } from '@lesca/shared/types'

/**
 * End-to-End Integration Test: List Scraping
 *
 * Tests the complete flow for scraping problem lists:
 * 1. GraphQL API request for problem list
 * 2. List scraping strategy
 * 3. Output generation (JSON/Markdown)
 * 4. Filesystem storage
 */
describe('E2E: List Scraping', () => {
  let tempDir: string
  let scraper: LeetCodeScraper
  let storage: FileSystemStorage

  const mockProblemList: ProblemList = {
    total: 2,
    questions: [
      {
        questionId: '1',
        questionFrontendId: '1',
        title: 'Two Sum',
        titleSlug: 'two-sum',
        difficulty: 'Easy',
        isPaidOnly: false,
        topicTags: [{ name: 'Array' }, { name: 'Hash Table' }],
        acRate: 50.1,
      },
      {
        questionId: '2',
        questionFrontendId: '2',
        title: 'Add Two Numbers',
        titleSlug: 'add-two-numbers',
        difficulty: 'Medium',
        isPaidOnly: false,
        topicTags: [{ name: 'Linked List' }, { name: 'Math' }],
        acRate: 40.5,
      },
    ],
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lesca-list-test-'))
    storage = new FileSystemStorage(tempDir)

    const graphqlClient = {
      getProblemList: async () => mockProblemList,
    } as unknown as GraphQLClient

    const browserDriver = {
      launch: async () => {},
      close: async () => {},
    } as unknown as BrowserDriver

    const listStrategy = new ListScraperStrategy(graphqlClient)

    scraper = new LeetCodeScraper([listStrategy], storage, {
      format: 'markdown', // List strategy usually outputs JSON or summary, but let's test basic flow
    })
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should scrape a problem list and save it', async () => {
    const request: ListScrapeRequest = {
      type: 'list',
      filters: {
        difficulty: 'Easy',
        limit: 50,
      },
    }

    const result = await scraper.scrape(request)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.filePath).toBeDefined()
    const absolutePath = storage.getAbsolutePath(result.filePath!)
    expect(existsSync(absolutePath)).toBe(true)

    const content = readFileSync(absolutePath, 'utf-8')
    const savedList = JSON.parse(content)

    expect(savedList.total).toBe(2)
    expect(savedList.questions).toHaveLength(2)
    expect(savedList.questions[0].title).toBe('Two Sum')
  }, 30000)

  it('should handle empty lists gracefully', async () => {
    const emptyClient = {
      getProblemList: async () => ({ total: 0, questions: [] }),
    } as unknown as GraphQLClient

    const listStrategy = new ListScraperStrategy(emptyClient)
    const emptyScraper = new LeetCodeScraper([listStrategy], storage, {})

    const request: ListScrapeRequest = {
      type: 'list',
      filters: { limit: 10 },
    }

    const result = await emptyScraper.scrape(request)

    expect(result.success).toBe(true)
    const absolutePath = storage.getAbsolutePath(result.filePath!)
    const content = readFileSync(absolutePath, 'utf-8')
    const savedList = JSON.parse(content)

    expect(savedList.total).toBe(0)
    expect(savedList.questions).toHaveLength(0)
  }, 30000)
})
