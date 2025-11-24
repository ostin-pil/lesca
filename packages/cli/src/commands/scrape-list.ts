import { GraphQLClient, RateLimiter } from '@/packages/api-client/src/index'
import { CookieFileAuth } from '@/packages/auth/src/index'
import { PlaywrightDriver } from '@/packages/browser-automation/src/index'
import { LeetCodeScraper, BatchScraper, type BatchProgress, type BatchScrapingOptions } from '@/packages/core/src/index'
import { ProblemScraperStrategy, ListScraperStrategy } from '@/packages/scrapers/src/index'
import { FileSystemStorage } from '@/packages/storage/src/index'
import { ConfigManager } from '@/shared/config/src/index'
import type { ProblemScrapeRequest, ListScrapeRequest, ProblemListFilters, Difficulty } from '@/shared/types/src/index'
import { logger } from '@/shared/utils/src/index'
import { ScrapingError } from '@lesca/error'
import chalk from 'chalk'
import { SingleBar, Presets } from 'cli-progress'
import { Command } from 'commander'
import ora from 'ora'

import { handleCliError } from '../utils'

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

export const scrapeListCommand = new Command('scrape-list')
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
      const configManager = ConfigManager.getInstance()
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
      const browserDriver = new PlaywrightDriver(auth?.getCredentials())
      const strategies = [
        new ProblemScraperStrategy(graphqlClient, browserDriver, auth?.getCredentials()),
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
      const progressBar = new SingleBar(
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
        Presets.shades_classic
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
