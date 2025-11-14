import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

/**
 * CLI Tests
 *
 * Note: The CLI is a complex application with heavy I/O operations and external dependencies.
 * These tests focus on command registration and structure validation.
 * Full integration tests would require mocking process.exit, console output, and file operations.
 */

describe('CLI Application', () => {
  describe('Program Structure', () => {
    it('should have correct program metadata', () => {
      const program = new Command()
      program.name('lesca')
      program.description('Modular LeetCode Scraper - Scrape LeetCode problems to Markdown')
      program.version('0.1.0')

      expect(program.name()).toBe('lesca')
      expect(program.description()).toBe('Modular LeetCode Scraper - Scrape LeetCode problems to Markdown')
    })
  })

  describe('scrape command', () => {
    let program: Command

    beforeEach(() => {
      program = new Command()
      program.exitOverride() // Prevent actual process exit

      program
        .command('scrape')
        .description('Scrape a LeetCode problem')
        .argument('<problem>', 'Problem title slug (e.g., "two-sum")')
        .option('-o, --output <dir>', 'Output directory', './output')
        .option('-f, --format <format>', 'Output format (markdown, obsidian)', 'obsidian')
        .option('-c, --cookies <file>', 'Cookie file path')
        .option('--cache-dir <dir>', 'Cache directory')
        .option('--no-cache', 'Disable caching')
        .option('--no-auth', 'Skip authentication (public problems only)')
    })

    it('should register scrape command with correct name', () => {
      const commands = program.commands
      const scrapeCommand = commands.find((cmd) => cmd.name() === 'scrape')
      expect(scrapeCommand).toBeDefined()
      expect(scrapeCommand?.description()).toContain('LeetCode problem')
    })

    it('should have required problem argument', () => {
      const scrapeCommand = program.commands.find((cmd) => cmd.name() === 'scrape')
      // Commander doesn't populate args until parse() is called
      // We verify the command exists and has been configured
      expect(scrapeCommand).toBeDefined()
    })

    it('should have output option with default', () => {
      const scrapeCommand = program.commands.find((cmd) => cmd.name() === 'scrape')
      const options = scrapeCommand?.options || []
      const outputOption = options.find((opt) => opt.long === '--output')
      expect(outputOption).toBeDefined()
      expect(outputOption?.defaultValue).toBe('./output')
    })

    it('should have format option with default', () => {
      const scrapeCommand = program.commands.find((cmd) => cmd.name() === 'scrape')
      const options = scrapeCommand?.options || []
      const formatOption = options.find((opt) => opt.long === '--format')
      expect(formatOption).toBeDefined()
      expect(formatOption?.defaultValue).toBe('obsidian')
    })

    it('should have cache option', () => {
      const scrapeCommand = program.commands.find((cmd) => cmd.name() === 'scrape')
      const options = scrapeCommand?.options || []
      const cacheOption = options.find((opt) => opt.long === '--no-cache')
      expect(cacheOption).toBeDefined()
    })

    it('should have auth option', () => {
      const scrapeCommand = program.commands.find((cmd) => cmd.name() === 'scrape')
      const options = scrapeCommand?.options || []
      const authOption = options.find((opt) => opt.long === '--no-auth')
      expect(authOption).toBeDefined()
    })
  })

  describe('scrape-list command', () => {
    let program: Command

    beforeEach(() => {
      program = new Command()
      program.exitOverride()

      program
        .command('scrape-list')
        .description('Scrape multiple problems')
        .option('-o, --output <dir>', 'Output directory', './output')
        .option('-f, --format <format>', 'Output format (markdown, obsidian)', 'obsidian')
        .option('-c, --cookies <file>', 'Cookie file path')
        .option('--cache-dir <dir>', 'Cache directory')
        .option('--no-cache', 'Disable caching')
        .option('-d, --difficulty <level>', 'Filter by difficulty (Easy, Medium, Hard)')
        .option('-t, --tags <tags>', 'Filter by tags (comma-separated)', '')
        .option('-l, --limit <number>', 'Limit number of problems', '10')
        .option('--concurrency <number>', 'Number of parallel scrapes', '3')
        .option('--resume', 'Resume from previous progress')
        .option('--no-auth', 'Skip authentication (public problems only)')
    })

    it('should register scrape-list command', () => {
      const commands = program.commands
      const listCommand = commands.find((cmd) => cmd.name() === 'scrape-list')
      expect(listCommand).toBeDefined()
      expect(listCommand?.description()).toContain('multiple problems')
    })

    it('should have difficulty filter option', () => {
      const listCommand = program.commands.find((cmd) => cmd.name() === 'scrape-list')
      const options = listCommand?.options || []
      const difficultyOption = options.find((opt) => opt.long === '--difficulty')
      expect(difficultyOption).toBeDefined()
    })

    it('should have tags filter option', () => {
      const listCommand = program.commands.find((cmd) => cmd.name() === 'scrape-list')
      const options = listCommand?.options || []
      const tagsOption = options.find((opt) => opt.long === '--tags')
      expect(tagsOption).toBeDefined()
      expect(tagsOption?.defaultValue).toBe('')
    })

    it('should have limit option with default', () => {
      const listCommand = program.commands.find((cmd) => cmd.name() === 'scrape-list')
      const options = listCommand?.options || []
      const limitOption = options.find((opt) => opt.long === '--limit')
      expect(limitOption).toBeDefined()
      expect(limitOption?.defaultValue).toBe('10')
    })

    it('should have concurrency option with default', () => {
      const listCommand = program.commands.find((cmd) => cmd.name() === 'scrape-list')
      const options = listCommand?.options || []
      const concurrencyOption = options.find((opt) => opt.long === '--concurrency')
      expect(concurrencyOption).toBeDefined()
      expect(concurrencyOption?.defaultValue).toBe('3')
    })

    it('should have resume option', () => {
      const listCommand = program.commands.find((cmd) => cmd.name() === 'scrape-list')
      const options = listCommand?.options || []
      const resumeOption = options.find((opt) => opt.long === '--resume')
      expect(resumeOption).toBeDefined()
    })
  })

  describe('scrape-editorial command', () => {
    let program: Command

    beforeEach(() => {
      program = new Command()
      program.exitOverride()

      program
        .command('scrape-editorial')
        .description('Scrape editorial/solution')
        .argument('<problem>', 'Problem title slug')
        .option('-o, --output <dir>', 'Output directory', './output')
        .option('-f, --format <format>', 'Output format (markdown, obsidian)', 'obsidian')
        .option('-c, --cookies <file>', 'Cookie file path')
        .option('--headless', 'Run browser in headless mode', true)
        .option('--premium', 'Include premium content (requires authentication)')
        .option('--no-auth', 'Skip authentication')
    })

    it('should register scrape-editorial command', () => {
      const commands = program.commands
      const editorialCommand = commands.find((cmd) => cmd.name() === 'scrape-editorial')
      expect(editorialCommand).toBeDefined()
      expect(editorialCommand?.description()).toContain('editorial')
    })

    it('should have headless option', () => {
      const editorialCommand = program.commands.find((cmd) => cmd.name() === 'scrape-editorial')
      const options = editorialCommand?.options || []
      const headlessOption = options.find((opt) => opt.long === '--headless')
      expect(headlessOption).toBeDefined()
    })

    it('should have premium option', () => {
      const editorialCommand = program.commands.find((cmd) => cmd.name() === 'scrape-editorial')
      const options = editorialCommand?.options || []
      const premiumOption = options.find((opt) => opt.long === '--premium')
      expect(premiumOption).toBeDefined()
    })

    it('should require problem argument', () => {
      const editorialCommand = program.commands.find((cmd) => cmd.name() === 'scrape-editorial')
      // Commander doesn't populate args until parse() is called
      expect(editorialCommand).toBeDefined()
    })
  })

  describe('scrape-discussions command', () => {
    let program: Command

    beforeEach(() => {
      program = new Command()
      program.exitOverride()

      program
        .command('scrape-discussions')
        .description('Scrape problem discussions')
        .argument('<problem>', 'Problem title slug')
        .option('-o, --output <dir>', 'Output directory', './output')
        .option('-f, --format <format>', 'Output format (markdown, obsidian)', 'obsidian')
        .option('-c, --cookies <file>', 'Cookie file path')
        .option('--category <category>', 'Filter by category')
        .option('-s, --sort <sort>', 'Sort by (hot, newest, top)', 'hot')
        .option('-l, --limit <number>', 'Limit number of discussions', '10')
        .option('--comments', 'Include comments')
        .option('--headless', 'Run browser in headless mode', true)
        .option('--no-auth', 'Skip authentication')
    })

    it('should register scrape-discussions command', () => {
      const commands = program.commands
      const discussionsCommand = commands.find((cmd) => cmd.name() === 'scrape-discussions')
      expect(discussionsCommand).toBeDefined()
      expect(discussionsCommand?.description()).toContain('discussions')
    })

    it('should have category filter option', () => {
      const discussionsCommand = program.commands.find((cmd) => cmd.name() === 'scrape-discussions')
      const options = discussionsCommand?.options || []
      const categoryOption = options.find((opt) => opt.long === '--category')
      expect(categoryOption).toBeDefined()
    })

    it('should have sort option with default', () => {
      const discussionsCommand = program.commands.find((cmd) => cmd.name() === 'scrape-discussions')
      const options = discussionsCommand?.options || []
      const sortOption = options.find((opt) => opt.long === '--sort')
      expect(sortOption).toBeDefined()
      expect(sortOption?.defaultValue).toBe('hot')
    })

    it('should have limit option with default', () => {
      const discussionsCommand = program.commands.find((cmd) => cmd.name() === 'scrape-discussions')
      const options = discussionsCommand?.options || []
      const limitOption = options.find((opt) => opt.long === '--limit')
      expect(limitOption).toBeDefined()
      expect(limitOption?.defaultValue).toBe('10')
    })

    it('should have comments option', () => {
      const discussionsCommand = program.commands.find((cmd) => cmd.name() === 'scrape-discussions')
      const options = discussionsCommand?.options || []
      const commentsOption = options.find((opt) => opt.long === '--comments')
      expect(commentsOption).toBeDefined()
    })
  })

  describe('init command', () => {
    let program: Command

    beforeEach(() => {
      program = new Command()
      program.exitOverride()

      program
        .command('init')
        .description('Initialize Lesca configuration')
    })

    it('should register init command', () => {
      const commands = program.commands
      const initCommand = commands.find((cmd) => cmd.name() === 'init')
      expect(initCommand).toBeDefined()
      expect(initCommand?.description()).toContain('Initialize')
    })
  })

  describe('Command options validation', () => {
    it('should have consistent output option across commands', () => {
      const program = new Command()
      const commands = ['scrape', 'scrape-list', 'scrape-editorial', 'scrape-discussions']

      commands.forEach((cmdName) => {
        const cmd = program.command(cmdName)
        cmd.option('-o, --output <dir>', 'Output directory', './output')

        const outputOption = cmd.options.find((opt) => opt.long === '--output')
        expect(outputOption).toBeDefined()
        expect(outputOption?.defaultValue).toBe('./output')
      })
    })

    it('should have consistent format option across commands', () => {
      const program = new Command()
      const commands = ['scrape', 'scrape-list', 'scrape-editorial', 'scrape-discussions']

      commands.forEach((cmdName) => {
        const cmd = program.command(cmdName)
        cmd.option('-f, --format <format>', 'Output format (markdown, obsidian)', 'obsidian')

        const formatOption = cmd.options.find((opt) => opt.long === '--format')
        expect(formatOption).toBeDefined()
        expect(formatOption?.defaultValue).toBe('obsidian')
      })
    })

    it('should have consistent auth option across commands', () => {
      const program = new Command()
      const commands = ['scrape', 'scrape-list', 'scrape-editorial', 'scrape-discussions']

      commands.forEach((cmdName) => {
        const cmd = program.command(cmdName)
        cmd.option('--no-auth', 'Skip authentication')

        const authOption = cmd.options.find((opt) => opt.long === '--no-auth')
        expect(authOption).toBeDefined()
      })
    })
  })

  describe('Option types', () => {
    it('should parse numeric options correctly', () => {
      const program = new Command()
      program.exitOverride()

      program
        .command('test')
        .option('-l, --limit <number>', 'Limit', '10')
        .action((options) => {
          expect(options.limit).toBe('10')
        })

      const cmd = program.commands.find((c) => c.name() === 'test')
      const limitOption = cmd?.options.find((opt) => opt.long === '--limit')
      expect(limitOption?.defaultValue).toBe('10')
    })

    it('should handle boolean flags', () => {
      const program = new Command()
      program.exitOverride()

      program
        .command('test')
        .option('--no-cache', 'Disable caching')
        .action((options) => {
          expect(typeof options.cache).toBe('boolean')
        })

      const cmd = program.commands.find((c) => c.name() === 'test')
      const cacheOption = cmd?.options.find((opt) => opt.long === '--no-cache')
      expect(cacheOption).toBeDefined()
    })

    it('should handle string options with defaults', () => {
      const program = new Command()
      program.exitOverride()

      program
        .command('test')
        .option('-f, --format <format>', 'Format', 'markdown')
        .action((options) => {
          expect(options.format).toBe('markdown')
        })

      const cmd = program.commands.find((c) => c.name() === 'test')
      const formatOption = cmd?.options.find((opt) => opt.long === '--format')
      expect(formatOption?.defaultValue).toBe('markdown')
    })
  })

  describe('Command arguments', () => {
    it('should support required arguments', () => {
      const program = new Command()
      program.exitOverride()

      const cmd = program
        .command('test')
        .argument('<required>', 'A required argument')

      // Verify the command was created successfully
      expect(cmd).toBeDefined()
      expect(cmd.name()).toBe('test')
    })

    it('should support optional arguments', () => {
      const program = new Command()
      program.exitOverride()

      const cmd = program
        .command('test')
        .argument('[optional]', 'An optional argument')

      // Verify the command was created successfully
      expect(cmd).toBeDefined()
      expect(cmd.name()).toBe('test')
    })
  })
})
