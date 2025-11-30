import { CookieFileAuth } from '@lesca/auth'
import { PlaywrightDriver } from '@lesca/browser-automation'
import {
  ProblemScraperStrategy,
  ListScraperStrategy,
  EditorialScraperStrategy,
  DiscussionScraperStrategy,
} from '@lesca/scrapers'
import { ConfigManager } from '@lesca/shared/config'
import type { DiscussionScrapeRequest, AuthCredentials } from '@lesca/shared/types'
import { logger, createCache } from '@lesca/shared/utils'
import { FileSystemStorage } from '@lesca/storage'
import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'

import { GraphQLClient, RateLimiter } from '@/api-client/src/index'
import { LeetCodeScraper } from '@/core/src/index'

import { handleCliError } from '../utils'

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
  cache: boolean
}

export const scrapeDiscussionsCommand = new Command('scrape-discussions')
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
  .option('--no-cache', 'Do not use GraphQL caching')
  .action(async (problem: string, options: ScrapeDiscussionsOptions) => {
    const spinner = ora('Initializing browser automation...').start()

    try {
      const configManager = ConfigManager.getInstance()
      const config = configManager.getConfig()

      // Merge CLI options with config (CLI options take precedence)
      const outputDir = options.output || config.storage.path
      const format = (options.format || config.output.format) as 'markdown' | 'obsidian'
      const cookiePath = options.cookies || config.auth.cookiePath
      const headless = options.headless !== undefined ? options.headless : config.browser.headless
      const sortOrder = (options.sort || config.scraping.discussion.defaultSort) as
        | 'hot'
        | 'most-votes'
        | 'recent'
      const limit = options.limit
        ? parseInt(options.limit)
        : config.scraping.discussion.defaultLimit

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

      // 3. Set up strategies
      // Set up cache
      const cache = options.cache !== false ? createCache(config) : undefined

      // Set up GraphQL client
      const rateLimiter = new RateLimiter(
        config.api.rateLimit.minDelay,
        config.api.rateLimit.maxDelay,
        config.api.rateLimit.jitter
      )
      const graphqlClient = new GraphQLClient(auth, rateLimiter, cache)

      const strategies = [
        new ProblemScraperStrategy(graphqlClient, browserDriver, auth),
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
        ...(options.category && {
          category: options.category as 'solution' | 'general' | 'interview-question',
        }),
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
