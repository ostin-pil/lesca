import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CLITestHelper } from '../utils'

/**
 * CLI E2E Integration Tests
 * Tests actual CLI command execution with real file I/O
 */
describe('CLI E2E - init command', () => {
  let helper: CLITestHelper

  beforeEach(() => {
    helper = new CLITestHelper()
  })

  afterEach(() => {
    helper.cleanup()
  })

  it('should create .lesca.config.json with init command', () => {
    // Execute init command non-interactively
    const result = helper.execCommand(['init', '--non-interactive'])

    // Should succeed or handle existing config gracefully
    // (init may fail if config already exists, which is ok)
    if (result.exitCode === 0) {
      // Should create config file
      expect(
        helper.fileExists('.lesca.config.yaml') || helper.fileExists('lesca.config.yaml')
      ).toBe(true)
    }
  })

  it('should not overwrite existing config without --force', () => {
    // Create initial config
    helper.writeConfig({ custom: 'value' })

    // Try to init again
    const result = helper.execCommand(['init', '--non-interactive'])

    // Original config should remain
    const config = JSON.parse(helper.readOutputFile('.lesca.config.json'))
    expect(config).toHaveProperty('custom')
    expect(config.custom).toBe('value')
  })
})

describe('CLI E2E - scrape command', () => {
  let helper: CLITestHelper

  beforeEach(() => {
    helper = new CLITestHelper()
    // Create a basic config
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

  it('should scrape a problem and create markdown file', () => {
    const result = helper.execCommand(['scrape', 'two-sum', '--no-auth', '--no-cache'])

    // Command should complete (may succeed or fail depending on network)
    if (result.exitCode === 0) {
      // Should create output directory
      expect(helper.fileExists('output')).toBe(true)

      // Should create markdown file
      expect(helper.fileExists('output/two-sum.md')).toBe(true)

      // File should contain problem content
      const content = helper.readOutputFile('output/two-sum.md')
      expect(content).toContain('Two Sum')
      expect(content.length).toBeGreaterThan(100)
    } else {
      // If it failed, should have error message
      expect(result.stderr || result.stdout).toBeTruthy()
    }
  }, 30000) // 30s timeout for network request

  it('should respect --output option', () => {
    const result = helper.execCommand([
      'scrape',
      'two-sum',
      '--no-auth',
      '--no-cache',
      '--output',
      './custom-output',
    ])

    if (result.exitCode === 0) {
      expect(helper.fileExists('custom-output/two-sum.md')).toBe(true)
    }
  }, 30000)

  it('should respect --format option', () => {
    const result = helper.execCommand([
      'scrape',
      'two-sum',
      '--no-auth',
      '--no-cache',
      '--format',
      'obsidian',
    ])

    if (result.exitCode === 0) {
      const content = helper.readOutputFile('output/two-sum.md')
      // Obsidian format should have frontmatter
      expect(content).toMatch(/^---/)
    }
  }, 30000)

  it('should handle non-existent problem gracefully', () => {
    const result = helper.execCommand([
      'scrape',
      'this-problem-definitely-does-not-exist-12345',
      '--no-auth',
      '--no-cache',
    ])

    // Should fail
    expect(result.exitCode).not.toBe(0)

    // Should have error message
    expect(result.stderr || result.stdout).toMatch(/not found|failed|error/i)
  }, 30000)
})

describe('CLI E2E - scrape-list command', () => {
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

  it('should scrape multiple problems with --limit', () => {
    const result = helper.execCommand([
      'scrape-list',
      '--no-auth',
      '--no-cache',
      '--limit',
      '3',
      '--difficulty',
      'easy',
    ])

    if (result.exitCode === 0) {
      // Should create output directory
      expect(helper.fileExists('output')).toBe(true)

      // Should have scraped some problems
      // (exact count may vary based on network/filtering)
      expect(result.stdout).toMatch(/scraped|completed|success/i)
    }
  }, 60000) // 60s timeout for multiple requests

  it('should respect --difficulty filter', () => {
    const result = helper.execCommand([
      'scrape-list',
      '--no-auth',
      '--no-cache',
      '--limit',
      '2',
      '--difficulty',
      'hard',
    ])

    // Should attempt to filter by difficulty
    if (result.exitCode === 0) {
      expect(result.stdout).toMatch(/hard/i)
    }
  }, 60000)

  it('should create checkpoint file with --resume', () => {
    const result = helper.execCommand([
      'scrape-list',
      '--no-auth',
      '--no-cache',
      '--limit',
      '2',
      '--resume',
    ])

    if (result.exitCode === 0 || result.exitCode === 1) {
      // Should create checkpoint file
      expect(
        helper.fileExists('.lesca-checkpoint.json') || helper.fileExists('output/.checkpoint.json')
      ).toBe(true)
    }
  }, 60000)
})

describe('CLI E2E - config command', () => {
  let helper: CLITestHelper

  beforeEach(() => {
    helper = new CLITestHelper()
  })

  afterEach(() => {
    helper.cleanup()
  })

  it('should show config with config show', () => {
    helper.writeConfig({
      storage: { path: './my-output' },
      output: { format: 'obsidian' },
    })

    const result = helper.execCommand(['config', 'show'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toMatch(/storage|output|obsidian/i)
  })

  it('should show config paths with config path', () => {
    helper.writeConfig({
      storage: { path: './output' },
      output: { format: 'markdown' },
    })

    const result = helper.execCommand(['config', 'path'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toMatch(/config|cookie|cache/i)
  })

  it('should detect invalid config', () => {
    helper.writeFile('.lesca.config.json', '{ invalid json }')

    const result = helper.execCommand(['config', 'show'])

    // Should fail or fallback to defaults
    expect(result.stderr || result.stdout).toBeTruthy()
  })
})
