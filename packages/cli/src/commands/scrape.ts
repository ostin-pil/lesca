import { CookieFileAuth } from '@lesca/auth'
import { PlaywrightDriver, SessionManager, SessionPoolManager } from '@lesca/browser-automation'
import { ProblemScraperStrategy, ListScraperStrategy } from '@lesca/scrapers'
import { ConfigManager } from '@lesca/shared/config'
import type { ProblemScrapeRequest } from '@lesca/shared/types'
import { logger, createCache } from '@lesca/shared/utils'
import { FileSystemStorage } from '@lesca/storage'
import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'

import { GraphQLClient, RateLimiter } from '@/api-client/src/index'
import { LeetCodeScraper } from '@/core/src/index'

import { handleCliError } from '../utils'

interface ScrapeOptions {
  output: string
  format: 'markdown' | 'obsidian'
  cookies: string
  cacheDir: string
  cache: boolean
  auth: boolean
  session?: string
  sessionPersist: boolean
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
  .option('-s, --session <name>', 'Use a browser session (enables pooling and persistence)')
  .option(
    '--session-persist',
    'Save session state on exit (default: true when --session is used)',
    true
  )
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

  ${chalk.gray('# Use browser session for faster subsequent scrapes')}
  $ lesca scrape two-sum ${chalk.cyan('--session my-session')}

${chalk.bold('Tips:')}
  ${chalk.gray('•')} Use ${chalk.cyan('lesca list --difficulty easy')} to find beginner problems
  ${chalk.gray('•')} Enable caching in config for 10-100x faster repeated scrapes
  ${chalk.gray('•')} Premium problems require valid LeetCode session cookies

${chalk.bold('See also:')}
  ${chalk.cyan('lesca scrape-list')}     Scrape multiple problems at once
  ${chalk.cyan('lesca search')}          Search for problems by keyword
  ${chalk.cyan('lesca session')}         Manage browser sessions
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

      // 4. Set up session management (if requested)
      let sessionManager: SessionManager | undefined
      let poolManager: SessionPoolManager | undefined

      if (options.session) {
        sessionManager = new SessionManager()

        // Initialize pool manager if session is requested
        if (config.browser.pool.enabled) {
          const browserOptions = {
            headless: config.browser.headless,
          }

          poolManager = new SessionPoolManager(
            {
              strategy: config.browser.pool.strategy,
              perSessionMaxSize: config.browser.pool.maxSize,
              perSessionIdleTime: config.browser.pool.maxIdleTime,
              acquireTimeout: config.browser.pool.acquireTimeout || 30000,
              retryOnFailure: config.browser.pool.retryOnFailure || true,
              maxRetries: config.browser.pool.maxRetries || 3,
            },
            browserOptions
          )

          spinner.info(`Using session pool: ${options.session}`)
        }
      }

      // 5. Set up strategies with pool injection
      const browserDriver = new PlaywrightDriver(
        auth?.getCredentials(),
        poolManager,
        options.session
      )

      const strategies = [
        new ProblemScraperStrategy(graphqlClient, browserDriver, auth?.getCredentials()),
        new ListScraperStrategy(graphqlClient),
      ]

      // 6. Set up storage
      const storage = new FileSystemStorage(outputDir)

      // 7. Launch browser (will acquire from pool if poolManager is provided)
      const launchOptions: {
        headless?: boolean
        timeout?: number
        viewport?: { width: number; height: number }
        blockResources?: string[]
        interception?: {
          enabled?: boolean
          blockResources?: string[]
          captureResponses?: boolean
          capturePattern?: string
        }
      } = {
        headless: config.browser.headless,
        timeout: config.browser.timeout,
        viewport: config.browser.viewport,
        blockResources: config.browser.blockedResources,
      }

      if (config.browser.interception.enabled) {
        launchOptions.interception = {
          enabled: config.browser.interception.enabled,
          blockResources: config.browser.interception.blockResources,
          captureResponses: config.browser.interception.captureResponses,
        }
        if (config.browser.interception.capturePattern) {
          launchOptions.interception.capturePattern = config.browser.interception.capturePattern
        }
      }

      await browserDriver.launch(launchOptions)

      // 8. Restore session if exists
      if (sessionManager && options.session) {
        const context = browserDriver.getBrowser()?.contexts()[0]
        if (context) {
          const restored = await sessionManager.restoreSession(options.session, context)
          if (restored) {
            spinner.succeed(`Session "${options.session}" restored`)
          }
        }
      }

      // 9. Create scraper
      const scraper = new LeetCodeScraper(strategies, storage, {
        format: format,
      })

      // 10. Scrape the problem
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

        // Save session if requested
        if (sessionManager && options.session && options.sessionPersist) {
          const context = browserDriver.getBrowser()?.contexts()[0]
          if (context) {
            await sessionManager.createSession(options.session, context)
            logger.info(`Session "${options.session}" saved`)
          }
        }
      } else {
        spinner.fail('Failed to scrape problem')
        logger.error(chalk.red('Error:'), result.error)
        process.exit(1)
      }

      // Clean up: close browser (will release to pool if poolManager is provided)
      await browserDriver.close()
    } catch (error) {
      spinner.fail('Unexpected error')
      handleCliError(chalk.red('Unexpected error during operation'), error)
      process.exit(1)
    }
  })
