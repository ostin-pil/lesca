import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'

import { GraphQLClient, RateLimiter } from '@/api-client/src/index'
import { CookieFileAuth } from '@/auth/src/index'
import { PlaywrightDriver } from '@/browser-automation/src/index'
import { LeetCodeScraper } from '@/core/src/index'
import {
  ProblemScraperStrategy,
  ListScraperStrategy,
  EditorialScraperStrategy,
} from '@/scrapers/src/index'
import { FileSystemStorage } from '@/storage/src/index'
import { ConfigManager } from '@/shared/config/src/index'
import type { EditorialScrapeRequest, AuthCredentials } from '@/shared/types/src/index'
import { logger, createCache } from '@/shared/utils/src/index'

import { handleCliError } from '../utils'

interface ScrapeEditorialOptions {
  output: string
  format: 'markdown' | 'obsidian'
  cookies: string
  headless: boolean
  premium?: boolean
  auth: boolean
  cache?: boolean // Added for the new cache option
}

export const scrapeEditorialCommand = new Command('scrape-editorial')
  .description('Scrape a problem editorial/solution (requires browser automation)')
  .argument('<problem>', 'Problem title slug (e.g., "two-sum")')
  .option('-o, --output <dir>', 'Output directory (overrides config)')
  .option('-f, --format <format>', 'Output format: markdown, obsidian (overrides config)')
  .option('-c, --cookies <file>', 'Cookie file path (overrides config)')
  .option('--headless', 'Run browser in headless mode (overrides config)')
  .option('--no-headless', 'Run browser in visible mode')
  .option('--premium', 'Attempt to scrape premium content (requires auth)')
  .option('--no-auth', 'Skip authentication (will fail on premium content)')
  .option('--no-cache', 'Disable GraphQL caching') // Added new option
  .action(async (problem: string, options: ScrapeEditorialOptions) => {
    const spinner = ora('Initializing browser automation...').start()

    try {
      const configManager = ConfigManager.getInstance()
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
