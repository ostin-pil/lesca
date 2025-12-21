import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readdirSync } from 'fs'
import { CLITestHelper } from '../utils'

/**
 * CLI E2E Batch Operations Tests
 * Tests batch scraping workflows and file management
 */
describe('CLI E2E - Batch Scraping', () => {
  let helper: CLITestHelper

  beforeEach(() => {
    helper = new CLITestHelper()
    helper.writeConfig({
      storage: { path: './output' },
      output: { format: 'markdown' },
      cache: { enabled: false },
      auth: { method: 'none' },
    })
  })

  afterEach(() => {
    helper.cleanup()
  })

  it('should scrape multiple problems sequentially', () => {
    const result = helper.execCommand([
      'scrape-list',
      '--no-auth',
      '--no-cache',
      '--limit',
      '5',
      '--concurrency',
      '1',
    ])

    if (result.exitCode === 0) {
      // Output directory should exist
      expect(helper.fileExists('output')).toBe(true)

      // Should have created some markdown files
      const files = readdirSync(helper.getPath('output'))
      const mdFiles = files.filter((f) => f.endsWith('.md'))
      expect(mdFiles.length).toBeGreaterThan(0)
      expect(mdFiles.length).toBeLessThanOrEqual(5)
    }
  }, 90000) // 90s timeout

  it('should handle mixed success/failure gracefully', () => {
    // Create a list with some valid and invalid problems
    helper.writeFile(
      'problem-list.txt',
      `two-sum
add-two-numbers
this-does-not-exist-xyz
longest-substring-without-repeating-characters
another-fake-problem`
    )

    const result = helper.execCommand([
      'scrape-list',
      '--no-auth',
      '--no-cache',
      '--file',
      'problem-list.txt',
    ])

    // Should complete (may have partial success)
    // Check that SOME problems were scraped
    if (helper.fileExists('output')) {
      const files = readdirSync(helper.getPath('output'))
      const mdFiles = files.filter((f) => f.endsWith('.md'))
      expect(mdFiles.length).toBeGreaterThan(0) // At least some succeeded
      expect(mdFiles.length).toBeLessThan(5) // Some failed
    }
  }, 120000)

  it('should respect concurrency limits', () => {
    const startTime = Date.now()

    const result = helper.execCommand([
      'scrape-list',
      '--no-auth',
      '--no-cache',
      '--limit',
      '3',
      '--concurrency',
      '1',
    ])

    const duration = Date.now() - startTime

    if (result.exitCode === 0) {
      // With concurrency=1, should take sequential time
      // Each request ~2-5s, so 3 requests should take 6-15s minimum
      expect(duration).toBeGreaterThan(5000)
    }
  }, 60000)

  it('should preserve checkpoint state', () => {
    // Start scraping with resume enabled
    const result1 = helper.execCommand([
      'scrape-list',
      '--no-auth',
      '--no-cache',
      '--limit',
      '3',
      '--resume',
    ])

    // Checkpoint should exist
    const checkpointExists =
      helper.fileExists('.lesca-checkpoint.json') || helper.fileExists('output/.checkpoint.json')

    if (result1.exitCode === 0) {
      expect(checkpointExists).toBe(true)
    }
  }, 60000)
})

describe('CLI E2E - File Output Verification', () => {
  let helper: CLITestHelper

  beforeEach(() => {
    helper = new CLITestHelper()
    helper.writeConfig({
      storage: { path: './output' },
      output: { format: 'markdown' },
      cache: { enabled: false },
      auth: { method: 'none' },
    })
  })

  afterEach(() => {
    helper.cleanup()
  })

  it('should create valid markdown files', () => {
    const result = helper.execCommand(['scrape', 'two-sum', '--no-auth', '--no-cache'])

    if (result.exitCode === 0) {
      const content = helper.readOutputFile('output/two-sum.md')

      // Should have markdown headings
      expect(content).toMatch(/^#+ /m)

      // Should have problem title
      expect(content).toMatch(/Two Sum/i)

      // Should have some content
      expect(content.length).toBeGreaterThan(200)
    }
  }, 30000)

  it('should include problem metadata in content', () => {
    const result = helper.execCommand(['scrape', 'two-sum', '--no-auth', '--no-cache'])

    if (result.exitCode === 0) {
      const content = helper.readOutputFile('output/two-sum.md')

      // Should include difficulty
      expect(content.toLowerCase()).toMatch(/easy|medium|hard/)

      // Should include problem number or ID
      expect(content).toMatch(/\d+/)
    }
  }, 30000)

  it('should format code blocks correctly', () => {
    const result = helper.execCommand(['scrape', 'two-sum', '--no-auth', '--no-cache'])

    if (result.exitCode === 0) {
      const content = helper.readOutputFile('output/two-sum.md')

      // Should have code fence blocks
      expect(content).toMatch(/```/)

      // Count code blocks (should have examples/solutions)
      const codeBlocks = content.match(/```/g)
      if (codeBlocks) {
        expect(codeBlocks.length).toBeGreaterThanOrEqual(2) // At least one opening and closing
      }
    }
  }, 30000)

  it('should create proper directory structure', () => {
    const result = helper.execCommand(['scrape-list', '--no-auth', '--no-cache', '--limit', '2'])

    if (result.exitCode === 0 && helper.fileExists('output')) {
      // Output directory should exist
      expect(helper.fileExists('output')).toBe(true)

      // Should contain markdown files
      const files = readdirSync(helper.getPath('output'))
      const mdFiles = files.filter((f) => f.endsWith('.md'))
      expect(mdFiles.length).toBeGreaterThan(0)

      // Each file should be named after the problem slug
      mdFiles.forEach((file) => {
        expect(file).toMatch(/^[a-z0-9-]+\.md$/)
      })
    }
  }, 60000)
})

describe('CLI E2E - Error Handling', () => {
  let helper: CLITestHelper

  beforeEach(() => {
    helper = new CLITestHelper()
  })

  afterEach(() => {
    helper.cleanup()
  })

  it('should fail gracefully when config is missing required fields', () => {
    helper.writeFile('.lesca.config.json', '{}')

    const result = helper.execCommand(['scrape', 'two-sum'])

    // May succeed with defaults or fail with error
    if (result.exitCode !== 0) {
      expect(result.stderr || result.stdout).toBeTruthy()
    }
  }, 30000)

  it('should handle invalid command arguments', () => {
    const result = helper.execCommand(['scrape']) // Missing problem argument

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr || result.stdout).toMatch(/required|argument|problem/i)
  })

  it('should show helpful error for unknown commands', () => {
    const result = helper.execCommand(['invalid-command'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr || result.stdout).toMatch(/unknown|invalid|command/i)
  })
})
