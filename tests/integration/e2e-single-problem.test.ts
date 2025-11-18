import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { LeetCodeScraper } from '@lesca/core'
import { FileSystemStorage } from '@lesca/storage'
import { ProblemScraperStrategy } from '@lesca/scrapers'
import { GraphQLClient } from '@lesca/api-client'
import type { ProblemScrapeRequest } from '@lesca/shared/types'

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
    similarQuestions: [],
    companyTagStats: {},
    stats: {},
    solution: null,
  } as any

  beforeEach(() => {
    // Create temporary directory for test output
    tempDir = mkdtempSync(join(tmpdir(), 'lesca-test-'))

    // Initialize components
    storage = new FileSystemStorage(tempDir)

    // Mock GraphQL client to avoid hitting real API
    const graphqlClient = {
      getProblem: async (titleSlug: string) => {
        if (titleSlug === 'two-sum') return mockProblem
        const err: any = new Error(`Problem not found: ${titleSlug}`)
        err.status = 404
        throw err
      },
    } as unknown as GraphQLClient

    const problemStrategy = new ProblemScraperStrategy(graphqlClient)

    scraper = new LeetCodeScraper([problemStrategy], storage, {
      format: 'obsidian',
      enhancements: {
        enabled: true,
        enhancers: {
          codeblock: { enabled: true },
          frontmatter: { enabled: true },
        },
      },
    })
  })

  afterEach(() => {
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should scrape a single problem and save to Obsidian format', async () => {
    // TODO: Implement with mocked API response
    // This test is skipped until we have proper fixtures

    const request: ProblemScrapeRequest = {
      type: 'problem',
      titleSlug: 'two-sum',
    }

    const result = await scraper.scrape(request)

    expect(result.success).toBe(true)
    if (!result.success) return

    // Verify file was created (resolve against storage base path)
    expect(result.filePath).toBeDefined()
    const absolutePath = storage.getAbsolutePath(result.filePath!)
    expect(existsSync(absolutePath)).toBe(true)

    // Verify content structure
    const content = readFileSync(absolutePath, 'utf-8')

    // Should have frontmatter (frontmatter may come after title in current converter)
    expect(content).toMatch(/---\n/)

    // Should have title
    expect(content).toContain('# Two Sum')

    // Should have difficulty
    expect(content).toMatch(/difficulty:/i)

    // Should have tags
    expect(content).toMatch(/tags:/i)

    // Should have problem content
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
        const err: any = new Error(`Problem not found: ${titleSlug}`)
        err.status = 404
        throw err
      },
    } as unknown as GraphQLClient

    const problemStrategy = new ProblemScraperStrategy(graphqlClient)
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
      codeSnippets: [
        { lang: 'Python', langSlug: 'python3', code: 'def solve(): pass' },
      ],
      companyTagStats: JSON.stringify({ 'google': 1 }),
    } as any

    const graphqlClient = {
      getProblem: async (titleSlug: string) => {
        if (titleSlug === 'two-sum') return enhancedProblem
        const err: any = new Error(`Problem not found: ${titleSlug}`)
        err.status = 404
        throw err
      },
    } as unknown as GraphQLClient

    const problemStrategy = new ProblemScraperStrategy(graphqlClient)
    const enhStorage = new FileSystemStorage(tempDir)
    const enhScraper = new LeetCodeScraper([problemStrategy], enhStorage, {
      format: 'obsidian',
      enhancements: { enabled: true },
    })

    const request = { type: 'problem', titleSlug: 'two-sum' } as ProblemScrapeRequest
    const result = await enhScraper.scrape(request)
    expect(result.success).toBe(true)
    if (!result.success) return

    const content = await import('fs/promises').then((fs) => fs.readFile(enhStorage.getAbsolutePath(result.filePath!), 'utf-8'))

    // Enhancers should add their sections
    expect(content).toContain('## Hints')
    expect(content).toContain('## Code Templates')
    expect(content).toContain('## Companies')
  }, 30000)
})
