import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { LeetCodeScraper } from '@lesca/core'
import { FileSystemStorage } from '@lesca/storage'
import { ProblemScraperStrategy } from '@lesca/scrapers'
import { GraphQLClient } from '@lesca/api-client'
import type { ProblemScrapeRequest, Problem, BrowserDriver } from '@lesca/shared/types'

/**
 * End-to-End Integration Test: Single Problem Scraping
 *
 * Tests the complete flow:
 * 1. GraphQL API request
 * 2. Problem scraping strategy
 * 3. HTML to Markdown conversion
 * 4. Obsidian format conversion
 * 5. Filesystem storage
 *
 * NOTE: This test uses mocked data to avoid hitting LeetCode API
 */
describe('E2E: Single Problem Scraping', () => {
  let tempDir: string
  let scraper: LeetCodeScraper
  let storage: FileSystemStorage

  const mockProblem = {
    questionId: '1',
    title: 'Two Sum',
    titleSlug: 'two-sum',
    content: '<p>Example problem content</p>',
    difficulty: 'Easy',
    exampleTestcases: '[]',
    topicTags: [{ name: 'array', slug: 'array' }],
    codeSnippets: [],
    hints: [],
    mysqlSchemas: [],
    dataSchemas: [],
    similarQuestions: '[]',
    companyTagStats: '{}',
    stats: '{}',
    solution: null,
    isPaidOnly: false,
  } as unknown as Problem

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lesca-test-'))
    storage = new FileSystemStorage(tempDir)

    const graphqlClient = {
      getProblem: async (titleSlug: string) => {
        if (titleSlug === 'two-sum') return mockProblem
        const err = new Error(`Problem not found: ${titleSlug}`) as Error & { status: number }
        err.status = 404
        throw err
      },
    } as unknown as GraphQLClient

    const browserDriver = {
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

    const problemStrategy = new ProblemScraperStrategy(graphqlClient, browserDriver)

    scraper = new LeetCodeScraper([problemStrategy], storage, {
      format: 'obsidian',
      enhancements: {
        enabled: true,
      },
    })
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should scrape a single problem and save to Obsidian format', async () => {
    const request: ProblemScrapeRequest = {
      type: 'problem',
      titleSlug: 'two-sum',
    }

    const result = await scraper.scrape(request)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.filePath).toBeDefined()
    const absolutePath = storage.getAbsolutePath(result.filePath!)
    expect(existsSync(absolutePath)).toBe(true)

    const content = readFileSync(absolutePath, 'utf-8')

    // Should have frontmatter (frontmatter may come after title in current converter)
    expect(content).toMatch(/---\n/)

    expect(content).toContain('# Two Sum')
    expect(content).toMatch(/difficulty:/i)
    expect(content).toMatch(/tags:/i)
    expect(content).toContain('Example problem content')
  }, 30000)

  it('should handle non-existent problem gracefully', async () => {
    // TODO: Implement with mocked API response

    const request: ProblemScrapeRequest = {
      type: 'problem',
      titleSlug: 'non-existent-problem-xyz',
    }

    const result = await scraper.scrape(request)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  }, 30000)

  it('should respect output format configuration', async () => {
    // Markdown format should not include Obsidian frontmatter block
    const graphqlClient = {
      getProblem: async (titleSlug: string) => {
        if (titleSlug === 'two-sum') return mockProblem
        const err = new Error(`Problem not found: ${titleSlug}`) as Error & { status: number }
        err.status = 404
        throw err
      },
    } as unknown as GraphQLClient

    const browserDriver = {
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

    const problemStrategy = new ProblemScraperStrategy(graphqlClient, browserDriver)
    const mdStorage = new FileSystemStorage(tempDir)
    const mdScraper = new LeetCodeScraper([problemStrategy], mdStorage, { format: 'markdown' })

    const request = { type: 'problem', titleSlug: 'two-sum' } as ProblemScrapeRequest
    const mdResult = await mdScraper.scrape(request)
    expect(mdResult.success).toBe(true)
    if (!mdResult.success) return

    const mdPath = mdStorage.getAbsolutePath(mdResult.filePath!)
    const mdContent = await import('fs/promises').then((fs) => fs.readFile(mdPath, 'utf-8'))

    // Markdown format should not include YAML frontmatter
    expect(mdContent).not.toMatch(/---\n/)
  }, 30000)

  it('should apply content enhancements correctly', async () => {
    // Provide hints, codeSnippets, and companyTagStats so enhancers apply
    const enhancedProblem = {
      ...mockProblem,
      hints: ['Try using a hash map'],
      codeSnippets: [{ lang: 'Python', langSlug: 'python3', code: 'def solve(): pass' }],
      companyTagStats: JSON.stringify({ google: 1 }),
    } as unknown as Problem

    const graphqlClient = {
      getProblem: async (titleSlug: string) => {
        if (titleSlug === 'two-sum') return enhancedProblem
        const err = new Error(`Problem not found: ${titleSlug}`) as Error & { status: number }
        err.status = 404
        throw err
      },
    } as unknown as GraphQLClient

    const browserDriver = {
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

    const problemStrategy = new ProblemScraperStrategy(graphqlClient, browserDriver)
    const enhStorage = new FileSystemStorage(tempDir)
    const enhScraper = new LeetCodeScraper([problemStrategy], enhStorage, {
      format: 'obsidian',
      enhancements: { enabled: true },
    })

    const request = { type: 'problem', titleSlug: 'two-sum' } as ProblemScrapeRequest
    const result = await enhScraper.scrape(request)
    expect(result.success).toBe(true)
    if (!result.success) return

    const content = await import('fs/promises').then((fs) =>
      fs.readFile(enhStorage.getAbsolutePath(result.filePath!), 'utf-8')
    )

    // Enhancers should add their sections
    expect(content).toContain('## Hints')
    expect(content).toContain('## Code Templates')
    expect(content).toContain('## Companies')
  }, 30000)
})
