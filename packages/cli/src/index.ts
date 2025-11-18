#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve , dirname } from 'path'


import { GraphQLClient, RateLimiter } from '@/packages/api-client/src/index.js'
import { CookieFileAuth } from '@/packages/auth/src/index.js'
import { PlaywrightDriver } from '@/packages/browser-automation/src/index.js'
import {
  LeetCodeScraper,
  BatchScraper,
  type BatchProgress,
  type BatchScrapingOptions,
} from '@/packages/core/src/index.js'
import {
  ProblemScraperStrategy,
  ListScraperStrategy,
  EditorialScraperStrategy,
  DiscussionScraperStrategy,
} from '@/packages/scrapers/src/index.js'
import { FileSystemStorage } from '@/packages/storage/src/index.js'
import {
  ConfigManager,
  getDefaultPaths,
  createDefaultConfig,
  exportConfigToYaml,
} from '@/shared/config/src/index.js'
import type {
  ProblemScrapeRequest,
  ListScrapeRequest,
  AuthCredentials,
  DiscussionScrapeRequest,
  EditorialScrapeRequest,
  ProblemListFilters,
  Difficulty,
} from '@/shared/types/src/index.js'
import { logger } from '@/shared/utils/src/index.js'
import { ScrapingError } from '@lesca/error'
import chalk from 'chalk'
import cliProgress from 'cli-progress'
import { Command } from 'commander'
import ora from 'ora'

/**
 * CLI Application for Lesca
 */

/**
 * Command option types
 */
interface ScrapeOptions {
  output: string
  format: 'markdown' | 'obsidian'
  cookies: string
  cacheDir: string
  cache: boolean
  auth: boolean
}

interface ScrapeListOptions {
  output: string
  format: 'markdown' | 'obsidian'
  cookies: string
  cacheDir: string
  cache: boolean
  auth: boolean
  difficulty?: string
  tags: string
  limit: string
  concurrency: string
  resume?: boolean
}

interface ScrapeEditorialOptions {
  output: string
  format: 'markdown' | 'obsidian'
  cookies: string
  headless: boolean
  premium?: boolean
  auth: boolean
}

interface ScrapeDiscussionsOptions {
  output: string
  format: 'markdown' | 'obsidian'
  cookies: string
  category?: string
  sort: string
  limit: string
  comments: boolean
  headless: boolean
  auth: boolean
}

interface InitOptions {
  configPath: string
  cookiePath?: string
  outputDir?: string
  format?: string
  force?: boolean
}

/**
 * Global configuration instance
 * Will be initialized before each command runs
 */
let configManager: ConfigManager

/**
 * Initialize configuration from file, env, and CLI options
 */
function initializeConfig(configPath?: string): void {
  try {
    const opts = configPath ? { configPath } : {}
    configManager = ConfigManager.initialize(opts)
  } catch (error) {
    // If config loading fails, use defaults
    logger.warn('Could not load config file, using defaults')
    configManager = ConfigManager.initialize({})
  }
}

/**
 * Handle CLI errors with debug mode support
 */
function handleCliError(message: string, error?: unknown): void {
  if (error instanceof Error) {
    logger.error(message, error)

    // In debug mode, show stack trace
    const opts = program.optsWithGlobals<{ debug?: boolean }>()
    if (opts.debug && error.stack) {
      logger.log(chalk.gray('\nStack trace:'))
      logger.log(chalk.gray(error.stack))
    }
  } else if (error) {
    logger.error(message, undefined, { error: String(error) })
  } else {
    logger.error(message)
  }
}

const program = new Command()

program
  .name('lesca')
  .description('Modular LeetCode Scraper - Scrape LeetCode problems to Markdown')
  .version('0.1.0')
  .option('--config <path>', 'Path to configuration file')
  .option('--debug', 'Enable debug mode with verbose logging')
  .hook('preAction', (thisCommand) => {
    // Initialize config before any command runs
    const opts = thisCommand.optsWithGlobals<{ config?: string; debug?: boolean }>()

    // Enable debug logging if requested
    if (opts.debug) {
      logger.setConfig({
        level: 'debug',
        timestamps: true,
        colors: true,
      })
      logger.debug('Debug mode enabled')
    }

    initializeConfig(opts.config)
  })

/**
 * Initialize configuration
 */
program
  .command('init')
  .description('Initialize Lesca configuration')
  .option('--config-path <path>', 'Path to create config file', './lesca.config.yaml')
  .option('--cookie-path <path>', 'Path for cookie storage')
  .option('--output-dir <path>', 'Default output directory', './output')
  .option('--format <format>', 'Default output format', 'markdown')
  .option('--force', 'Overwrite existing configuration')
  .action((options: InitOptions) => {
    const spinner = ora('Initializing Lesca configuration...').start()

    try {
      const configPath = resolve(options.configPath)
      const paths = getDefaultPaths()

      // Check if config already exists
      if (existsSync(configPath) && options.force !== true) {
        spinner.fail(chalk.red(`Configuration already exists at ${configPath}`))
        logger.warn(chalk.yellow('Use --force to overwrite'))
        process.exit(1)
      }

      // Create default configuration
      const config = createDefaultConfig()

      // Apply user preferences
      if (options.cookiePath) {
        config.auth.cookiePath = resolve(options.cookiePath)
      }
      if (options.outputDir) {
        config.storage.path = resolve(options.outputDir)
      }
      if (options.format) {
        config.output.format = options.format as 'markdown' | 'obsidian'
      }

      // Create necessary directories
      const lescaDir = paths.lescaDir
      if (!existsSync(lescaDir)) {
        mkdirSync(lescaDir, { recursive: true })
        spinner.text = `Created directory: ${lescaDir}`
      }

      // Create cache directory
      const cacheDir = paths.cacheDir
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true })
        spinner.text = `Created cache directory: ${cacheDir}`
      }

      // Ensure config directory exists
      const configDir = dirname(configPath)
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true })
      }

      // Write configuration file
      const yamlContent = exportConfigToYaml(config)
      writeFileSync(configPath, yamlContent, 'utf-8')

      spinner.succeed(chalk.green(`Configuration created at ${configPath}`))

      // Create example cookie file if it doesn't exist
      const cookieExamplePath = resolve(lescaDir, 'cookies.example.json')
      if (!existsSync(cookieExamplePath)) {
        const exampleCookies = JSON.stringify([
          {
            name: 'csrftoken',
            value: 'your-csrf-token-here',
            domain: '.leetcode.com',
            path: '/',
            expires: -1,
            httpOnly: false,
            secure: true,
            sameSite: 'Lax'
          },
          {
            name: 'LEETCODE_SESSION',
            value: 'your-session-token-here',
            domain: '.leetcode.com',
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: true,
            sameSite: 'Lax'
          }
        ], null, 2)
        writeFileSync(cookieExamplePath, exampleCookies, 'utf-8')
        logger.log(chalk.gray(`Example cookie file created at ${cookieExamplePath}`))
      }

      // Print next steps
      logger.log('\n' + chalk.bold('Next steps:'))
      logger.log(chalk.cyan('1. Copy your LeetCode cookies to:'), paths.cookieFile)
      logger.log(chalk.cyan('2. Start scraping:'), 'lesca scrape two-sum')
      logger.log(chalk.cyan('3. Customize config:'), configPath)

    } catch (error) {
      spinner.fail(chalk.red('Failed to initialize configuration'))
      handleCliError('Failed to initialize configuration', error)
      process.exit(1)
    }
  })

/**
 * Scrape a single problem
 */
program
  .command('scrape')
  .description('Scrape a LeetCode problem')
  .argument('<problem>', 'Problem title slug (e.g., "two-sum")')
  .option('-o, --output <dir>', 'Output directory (overrides config)')
  .option('-f, --format <format>', 'Output format: markdown, obsidian (overrides config)')
  .option('-c, --cookies <file>', 'Cookie file path (overrides config)')
  .option('--cache-dir <dir>', 'Cache directory (overrides config)')
  .option('--no-cache', 'Disable caching')
  .option('--no-auth', 'Skip authentication (public problems only)')
  .action(async (problem: string, options: ScrapeOptions) => {
    const spinner = ora('Initializing...').start()

    try {
      // Get configuration
      const config = configManager.getConfig()

      // Merge CLI options with config (CLI options take precedence)
      const outputDir = options.output || config.storage.path
      const format = (options.format || config.output.format) as 'markdown' | 'obsidian'
      const cookiePath = options.cookies || config.auth.cookiePath
      const cacheDir = options.cacheDir || config.cache.directory
      const cacheEnabled = options.cache !== false && config.cache.enabled

      // 1. Set up authentication
      let auth
      if (options.auth !== false && config.auth.method !== 'none') {
        try {
          auth = new CookieFileAuth(cookiePath)
          await auth.authenticate()
          spinner.succeed('Authentication loaded')
        } catch (error) {
          spinner.warn(
            `Authentication failed, continuing without auth: ${error instanceof Error ? error.message : String(error)}`
          )
          auth = undefined
        }
      } else {
        spinner.info('Running without authentication')
      }

      // 2. Set up cache (if enabled)
      if (cacheEnabled && cacheDir) {
        // Cache setup here if needed by other components
        spinner.info('Cache enabled')
      }

      // 3. Set up GraphQL client with config values
      const rateLimiter = new RateLimiter(
        config.api.rateLimit.minDelay,
        config.api.rateLimit.maxDelay,
        config.api.rateLimit.jitter
      )
      const graphqlClient = new GraphQLClient(auth?.getCredentials(), rateLimiter)

      // 4. Set up strategies
      const strategies = [
        new ProblemScraperStrategy(graphqlClient),
        new ListScraperStrategy(graphqlClient),
      ]

      // 5. Set up storage
      const storage = new FileSystemStorage(outputDir)

      // 6. Create scraper
      const scraper = new LeetCodeScraper(strategies, storage, {
        format: format,
      })

      // 7. Scrape the problem
      spinner.start(`Scraping problem: ${chalk.cyan(problem)}`)

      const request: ProblemScrapeRequest = {
        type: 'problem',
        titleSlug: problem,
      }

      const result = await scraper.scrape(request)

      if (result.success) {
        spinner.succeed(
          `Problem scraped successfully!\n   ${chalk.green('Saved to:')} ${result.filePath}`
        )
        logger.log()
        logger.log(chalk.gray('  Preview:'))
        if (result.data?.content) {
          const preview = result.data.content.split('\n').slice(0, 5).join('\n')
          logger.log(chalk.gray('  ' + preview.replace(/\n/g, '\n  ')))
        }
      } else {
        spinner.fail('Failed to scrape problem')
        logger.error(chalk.red('Error:'), result.error)
        process.exit(1)
      }
    } catch (error) {
      spinner.fail('Unexpected error')
      handleCliError(chalk.red('Unexpected error during operation'), error)
      process.exit(1)
    }
  })

/**
 * Scrape multiple problems
 */
program
  .command('scrape-list')
  .description('Scrape multiple problems')
  .option('-o, --output <dir>', 'Output directory (overrides config)')
  .option('-f, --format <format>', 'Output format: markdown, obsidian (overrides config)')
  .option('-c, --cookies <file>', 'Cookie file path (overrides config)')
  .option('--cache-dir <dir>', 'Cache directory (overrides config)')
  .option('--no-cache', 'Disable caching')
  .option('-d, --difficulty <level>', 'Filter by difficulty (Easy, Medium, Hard)')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)', '')
  .option('-l, --limit <number>', 'Limit number of problems')
  .option('--concurrency <number>', 'Number of parallel scrapes (overrides config)')
  .option('--resume', 'Resume from previous progress')
  .option('--no-auth', 'Skip authentication (public problems only)')
  .action(async (options: ScrapeListOptions) => {
    const spinner = ora('Initializing...').start()

    try {
      // Get configuration
      const config = configManager.getConfig()

      // Merge CLI options with config (CLI options take precedence)
      const outputDir = options.output || config.storage.path
      const format = (options.format || config.output.format) as 'markdown' | 'obsidian'
      const cookiePath = options.cookies || config.auth.cookiePath
      const cacheDir = options.cacheDir || config.cache.directory
      const cacheEnabled = options.cache !== false && config.cache.enabled
      const concurrency = options.concurrency ? parseInt(options.concurrency) : config.scraping.concurrency
      const limit = options.limit ? parseInt(options.limit) : config.scraping.batchSize

      // 1. Set up authentication
      let auth
      if (options.auth !== false && config.auth.method !== 'none') {
        try {
          auth = new CookieFileAuth(cookiePath)
          await auth.authenticate()
          spinner.succeed('Authentication loaded')
        } catch (error) {
          spinner.warn(`Authentication failed, continuing without auth`)
          auth = undefined
        }
      }

      // 2. Set up cache (if enabled)
      if (cacheEnabled && cacheDir) {
        // Cache setup here if needed by other components
        spinner.info('Cache enabled')
      }

      // 3. Set up clients with config values
      const rateLimiter = new RateLimiter(
        config.api.rateLimit.minDelay,
        config.api.rateLimit.maxDelay,
        config.api.rateLimit.jitter
      )
      const graphqlClient = new GraphQLClient(auth?.getCredentials(), rateLimiter)

      // 4. Set up strategies
      const strategies = [
        new ProblemScraperStrategy(graphqlClient),
        new ListScraperStrategy(graphqlClient),
      ]

      // 5. Set up storage
      const storage = new FileSystemStorage(outputDir)

      // 6. Create scraper
      const scraper = new LeetCodeScraper(strategies, storage, {
        format: format,
      })

      // 7. Fetch problem list
      spinner.start('Fetching problem list...')

      const filters: ProblemListFilters = {}
      if (options.difficulty) {
        filters.difficulty = options.difficulty as Difficulty
      }
      if (options.tags) {
        filters.tags = options.tags.split(',').map((t: string) => t.trim())
      }

      const listRequest: ListScrapeRequest = {
        type: 'list',
        filters,
        limit: limit,
      }

      const listResult = await new ListScraperStrategy(graphqlClient).execute(listRequest)

      if (listResult.type !== 'list') {
        throw new ScrapingError(
          'SCRAPE_CONTENT_EXTRACTION_FAILED',
          'Invalid response type from list scraper',
          { context: { expectedType: 'list', actualType: listResult.type } }
        )
      }

      const problems = (listResult.data as { questions: { titleSlug: string; title: string }[] })
        .questions

      spinner.succeed(`Found ${problems.length} problems`)
      logger.log()

      // 8. Create progress bar
      const progressBar = new cliProgress.SingleBar(
        {
          format:
            chalk.cyan('{bar}') +
            ' | {percentage}% | {value}/{total} | ' +
            chalk.green('✓ {successful}') +
            ' ' +
            chalk.red('✗ {failed}') +
            ' | ETA: {eta_formatted}',
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          hideCursor: true,
        },
        cliProgress.Presets.shades_classic
      )

      // 9. Create problem requests
      const requests: ProblemScrapeRequest[] = problems.map((p) => ({
        type: 'problem',
        titleSlug: p.titleSlug,
      }))

      // 10. Start progress bar
      progressBar.start(problems.length, 0, {
        successful: 0,
        failed: 0,
        eta_formatted: 'calculating...',
      })

      // 11. Create batch scraper with callbacks
      const batchScraperOptions: BatchScrapingOptions = {
        concurrency: concurrency,
        continueOnError: true,
        delayBetweenBatches: config.scraping.delay,
        onProgress: (progress: BatchProgress) => {
          progressBar.update(progress.completed, {
            successful: progress.successful,
            failed: progress.failed,
            eta_formatted: progress.eta ? BatchScraper.formatETA(progress.eta) : 'calculating...',
          })
        },
      }
      if (options.resume !== undefined) {
        batchScraperOptions.resume = options.resume
      }
      const batchScraper = new BatchScraper(scraper, batchScraperOptions)

      // 12. Batch scrape
      const result = await batchScraper.scrapeAll(requests)

      // 13. Stop progress bar
      progressBar.stop()

      // 14. Summary
      logger.log()
      logger.log(chalk.bold('Summary:'))
      logger.log(`  ${chalk.green('✓')} Successful: ${result.stats.successful}`)
      logger.log(`  ${chalk.red('✗')} Failed: ${result.stats.failed}`)
      if (result.stats.skipped > 0) {
        logger.log(`  ${chalk.yellow('⊙')} Skipped (resumed): ${result.stats.skipped}`)
      }
      logger.log(
        `  ${chalk.blue('⏱')}  Duration: ${BatchScraper.formatDuration(result.stats.duration)}`
      )
      logger.log(
        `  ${chalk.blue('⌀')}  Average: ${BatchScraper.formatDuration(result.stats.averageTime)}`
      )
      logger.log(`  ${chalk.blue('→')} Output: ${options.output}`)

      if (result.errors.length > 0 && result.errors.length <= 5) {
        logger.log()
        logger.log(chalk.red('Errors:'))
        for (const error of result.errors) {
          const identifier =
            error.request.type === 'problem' ||
            error.request.type === 'editorial' ||
            error.request.type === 'discussion'
              ? error.request.titleSlug
              : error.request.type === 'user'
                ? error.request.username
                : 'list'
          logger.log(`  ${chalk.red('✗')} ${identifier}: ${error.error.message}`)
        }
      } else if (result.errors.length > 5) {
        logger.log()
        logger.log(chalk.red(`${result.errors.length} errors occurred. Check logs for details.`))
      }
    } catch (error) {
      spinner.fail('Unexpected error')
      handleCliError(chalk.red('Unexpected error during operation'), error)
      process.exit(1)
    }
  })

/**
 * Scrape editorial/solution
 */
program
  .command('scrape-editorial')
  .description('Scrape a problem editorial/solution (requires browser automation)')
  .argument('<problem>', 'Problem title slug (e.g., "two-sum")')
  .option('-o, --output <dir>', 'Output directory (overrides config)')
  .option('-f, --format <format>', 'Output format: markdown, obsidian (overrides config)')
  .option('-c, --cookies <file>', 'Cookie file path (overrides config)')
  .option('--headless', 'Run browser in headless mode (overrides config)')
  .option('--no-headless', 'Run browser in visible mode')
  .option('--premium', 'Attempt to scrape premium content (requires auth)')
  .option('--no-auth', 'Skip authentication (will fail on premium content)')
  .action(async (problem: string, options: ScrapeEditorialOptions) => {
    const spinner = ora('Initializing browser automation...').start()

    try {
      // Get configuration
      const config = configManager.getConfig()

      // Merge CLI options with config (CLI options take precedence)
      const outputDir = options.output || config.storage.path
      const format = (options.format || config.output.format) as 'markdown' | 'obsidian'
      const cookiePath = options.cookies || config.auth.cookiePath
      const headless = options.headless !== undefined ? options.headless : config.browser.headless

      // 1. Set up authentication
      let auth: AuthCredentials | undefined
      if (options.auth !== false && config.auth.method !== 'none') {
        try {
          const authProvider = new CookieFileAuth(cookiePath)
          await authProvider.authenticate()
          auth = authProvider.getCredentials()
          spinner.succeed('Authentication loaded')
        } catch (error) {
          if (options.premium) {
            spinner.fail('Authentication required for premium content')
            handleCliError(chalk.red('Authentication failed for premium content'), error)
            process.exit(1)
          }
          spinner.warn('Authentication failed, continuing without auth')
          auth = undefined
        }
      }

      // 2. Set up browser driver
      const browserDriver = new PlaywrightDriver(auth)
      spinner.start('Launching browser...')

      await browserDriver.launch({
        headless: headless,
        timeout: config.browser.timeout,
        blockResources: config.browser.blockedResources,
      })

      spinner.succeed('Browser launched')

      // 3. Set up strategies with config values
      const rateLimiter = new RateLimiter(
        config.api.rateLimit.minDelay,
        config.api.rateLimit.maxDelay,
        config.api.rateLimit.jitter
      )
      const graphqlClient = new GraphQLClient(auth, rateLimiter)

      const strategies = [
        new ProblemScraperStrategy(graphqlClient),
        new ListScraperStrategy(graphqlClient),
        new EditorialScraperStrategy(browserDriver, auth),
      ]

      // 4. Set up storage
      const storage = new FileSystemStorage(outputDir)

      // 5. Create scraper
      const scraper = new LeetCodeScraper(strategies, storage, {
        format: format,
      })

      // 6. Scrape the editorial
      spinner.start(`Scraping editorial: ${chalk.cyan(problem)}`)

      const request: EditorialScrapeRequest = {
        type: 'editorial',
        titleSlug: problem,
        includePremium: options.premium || false,
      }

      const result = await scraper.scrape(request)

      if (result.success) {
        spinner.succeed(
          `Editorial scraped successfully!\n   ${chalk.green('Saved to:')} ${result.filePath}`
        )
        logger.log()
        logger.log(chalk.gray('  Preview:'))
        if (result.data?.content) {
          const preview = result.data.content.split('\n').slice(0, 5).join('\n')
          logger.log(chalk.gray('  ' + preview.replace(/\n/g, '\n  ')))
        }
      } else {
        spinner.fail('Failed to scrape editorial')
        logger.error(chalk.red('Error:'), result.error)
        process.exit(1)
      }

      // 7. Clean up browser
      await browserDriver.close()
    } catch (error) {
      spinner.fail('Unexpected error')
      handleCliError(chalk.red('Unexpected error during operation'), error)
      process.exit(1)
    }
  })

/**
 * Scrape discussions/solutions
 */
program
  .command('scrape-discussions')
  .description('Scrape problem discussions/solutions (requires browser automation)')
  .argument('<problem>', 'Problem title slug (e.g., "two-sum")')
  .option('-o, --output <dir>', 'Output directory (overrides config)')
  .option('-f, --format <format>', 'Output format: markdown, obsidian (overrides config)')
  .option('-c, --cookies <file>', 'Cookie file path (overrides config)')
  .option('--category <category>', 'Filter by category (solution, general, interview-question)')
  .option('--sort <sort>', 'Sort order (hot, most-votes, recent)')
  .option('--limit <number>', 'Number of discussions to scrape')
  .option('--comments', 'Include comments', false)
  .option('--headless', 'Run browser in headless mode (overrides config)')
  .option('--no-headless', 'Run browser in visible mode')
  .option('--no-auth', 'Skip authentication')
  .action(async (problem: string, options: ScrapeDiscussionsOptions) => {
    const spinner = ora('Initializing browser automation...').start()

    try {
      // Get configuration
      const config = configManager.getConfig()

      // Merge CLI options with config (CLI options take precedence)
      const outputDir = options.output || config.storage.path
      const format = (options.format || config.output.format) as 'markdown' | 'obsidian'
      const cookiePath = options.cookies || config.auth.cookiePath
      const headless = options.headless !== undefined ? options.headless : config.browser.headless
      const sortOrder = (options.sort || config.scraping.discussion.defaultSort) as 'hot' | 'most-votes' | 'recent'
      const limit = options.limit ? parseInt(options.limit) : config.scraping.discussion.defaultLimit

      // 1. Set up authentication
      let auth: AuthCredentials | undefined
      if (options.auth !== false && config.auth.method !== 'none') {
        try {
          const authProvider = new CookieFileAuth(cookiePath)
          await authProvider.authenticate()
          auth = authProvider.getCredentials()
          spinner.succeed('Authentication loaded')
        } catch (error) {
          spinner.warn('Authentication failed, continuing without auth')
          auth = undefined
        }
      }

      // 2. Set up browser driver
      const browserDriver = new PlaywrightDriver(auth)
      spinner.start('Launching browser...')

      await browserDriver.launch({
        headless: headless,
        timeout: config.browser.timeout,
        blockResources: config.browser.blockedResources,
      })

      spinner.succeed('Browser launched')

      // 3. Set up strategies with config values
      const rateLimiter = new RateLimiter(
        config.api.rateLimit.minDelay,
        config.api.rateLimit.maxDelay,
        config.api.rateLimit.jitter
      )
      const graphqlClient = new GraphQLClient(auth, rateLimiter)

      const strategies = [
        new ProblemScraperStrategy(graphqlClient),
        new ListScraperStrategy(graphqlClient),
        new EditorialScraperStrategy(browserDriver, auth),
        new DiscussionScraperStrategy(browserDriver),
      ]

      // 4. Set up storage
      const storage = new FileSystemStorage(outputDir)

      // 5. Create scraper
      const scraper = new LeetCodeScraper(strategies, storage, {
        format: format,
      })

      // 6. Scrape the discussions
      spinner.start(
        `Scraping discussions: ${chalk.cyan(problem)} (limit: ${limit}, sort: ${sortOrder})`
      )

      const request: DiscussionScrapeRequest = {
        type: 'discussion',
        titleSlug: problem,
        ...(options.category && { category: options.category as 'solution' | 'general' | 'interview-question' }),
        sortBy: sortOrder,
        limit: limit,
        includeComments: options.comments,
      }

      const result = await scraper.scrape(request)

      if (result.success) {
        spinner.succeed(
          `Discussions scraped successfully!\n   ${chalk.green('Saved to:')} ${result.filePath}`
        )
        logger.log()
        logger.log(chalk.gray('  Preview:'))
        if (result.data?.content) {
          const preview = result.data.content.split('\n').slice(0, 5).join('\n')
          logger.log(chalk.gray('  ' + preview.replace(/\n/g, '\n  ')))
        }
      } else {
        spinner.fail('Failed to scrape discussions')
        logger.error(chalk.red('Error:'), result.error)
        process.exit(1)
      }

      // 7. Clean up browser
      await browserDriver.close()
    } catch (error) {
      spinner.fail('Unexpected error')
      handleCliError(chalk.red('Unexpected error during operation'), error)
      process.exit(1)
    }
  })

// Parse arguments
program.parse()
