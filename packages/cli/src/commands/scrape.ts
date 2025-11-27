import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'

import { GraphQLClient, RateLimiter } from '@/api-client/src/index'
import { CookieFileAuth } from '@/auth/src/index'
import { PlaywrightDriver } from '@/browser-automation/src/index'
import { LeetCodeScraper } from '@/core/src/index'
import { ProblemScraperStrategy, ListScraperStrategy } from '@/scrapers/src/index'
import { FileSystemStorage } from '@/storage/src/index'
import { ConfigManager } from '@/shared/config/src/index'
import type { ProblemScrapeRequest } from '@/shared/types/src/index'
import { logger, createCache } from '@/shared/utils/src/index'

import { handleCliError } from '../utils'

interface ScrapeOptions {
  output: string
  format: 'markdown' | 'obsidian'
  cookies: string
  cacheDir: string
  cache: boolean
  auth: boolean
}

export const scrapeCommand = new Command('scrape')
  .description(chalk.white('Scrape a single LeetCode problem to markdown'))
  .argument('<problem>', chalk.gray('Problem identifier (e.g., "two-sum", "climbing-stairs")'))
  .option('-o, --output <dir>', 'Output directory (default: from config)')
  .option('-f, --format <format>', 'Output format: markdown|obsidian (default: from config)')
  .option('-c, --cookies <file>', 'Cookie file path (default: from config)')
  .option('--cache-dir <dir>', 'Cache directory (default: from config)')
  .option('--no-cache', 'Bypass cache and fetch fresh data')
  .option('--no-auth', 'Skip authentication (public problems only)')
  .addHelpText(
    'after',
    `
${chalk.bold('Examples:')}
  ${chalk.gray('# Basic usage')}
  $ lesca scrape two-sum

  ${chalk.gray('# Custom output and format')}
  $ lesca scrape two-sum ${chalk.cyan('-o ~/notes -f obsidian')}

  ${chalk.gray('# Force fresh data (bypass cache)')}
  $ lesca scrape climbing-stairs ${chalk.cyan('--no-cache')}

  ${chalk.gray('# Scrape premium problem (requires authentication)')}
  $ lesca scrape design-twitter

${chalk.bold('Tips:')}
  ${chalk.gray('•')} Use ${chalk.cyan('lesca list --difficulty easy')} to find beginner problems
  ${chalk.gray('•')} Enable caching in config for 10-100x faster repeated scrapes
  ${chalk.gray('•')} Premium problems require valid LeetCode session cookies

${chalk.bold('See also:')}
  ${chalk.cyan('lesca scrape-list')}     Scrape multiple problems at once
  ${chalk.cyan('lesca search')}          Search for problems by keyword
  ${chalk.cyan('lesca auth')}            Manage authentication
  `
  )
  .action(async (problem: string, options: ScrapeOptions) => {
    const spinner = ora('Initializing...').start()

    try {
      const configManager = ConfigManager.getInstance()
      const config = configManager.getConfig()

      // Merge CLI options with config (CLI options take precedence)
      const outputDir = options.output || config.storage.path
      const format = (options.format || config.output.format) as 'markdown' | 'obsidian'
      const cookiePath = options.cookies || config.auth.cookiePath
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
      const cache = cacheEnabled ? createCache(config) : undefined
      if (cache) {
        spinner.info('Cache enabled')
      }

      // 3. Set up GraphQL client with config values
      const rateLimiter = new RateLimiter(
        config.api.rateLimit.minDelay,
        config.api.rateLimit.maxDelay,
        config.api.rateLimit.jitter
      )
      const graphqlClient = new GraphQLClient(auth?.getCredentials(), rateLimiter, cache)

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
