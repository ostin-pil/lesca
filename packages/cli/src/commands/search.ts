import { GraphQLClient, RateLimiter } from '@/packages/api-client/src/index'
import { CookieFileAuth } from '@/packages/auth/src/index'
import { ListScraperStrategy } from '@/packages/scrapers/src/index'
import { ConfigManager } from '@/shared/config/src/index'
import type { ListScrapeRequest, ProblemListFilters, Difficulty } from '@/shared/types/src/index'
import { logger, createCache } from '@/shared/utils/src/index'
import { ScrapingError } from '@lesca/error'
import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'

import { handleCliError } from '../utils'

interface SearchOptions {
  difficulty?: string
  tags: string
  limit: string
  cookies: string
  auth: boolean
  json: boolean
}

export const searchCommand = new Command('search')
  .alias('s')
  .description('Search LeetCode problems')
  .argument('<query>', 'Search query (title or keywords)')
  .option('-d, --difficulty <level>', 'Filter by difficulty (Easy, Medium, Hard)')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)', '')
  .option('-l, --limit <number>', 'Limit number of results', '10')
  .option('-c, --cookies <file>', 'Cookie file path (overrides config)')
  .option('--no-auth', 'Skip authentication (public problems only)')
  .option('--json', 'Output as JSON')
  .action(async (query: string, options: SearchOptions) => {
    const spinner = ora('Searching...').start()

    try {
      const configManager = ConfigManager.getInstance()
      const config = configManager.getConfig()

      const cookiePath = options.cookies || config.auth.cookiePath
      const limit = parseInt(options.limit)

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

      // Set up cache
      const cache = createCache(config)

      // 2. Set up client
      const rateLimiter = new RateLimiter(
        config.api.rateLimit.minDelay,
        config.api.rateLimit.maxDelay,
        config.api.rateLimit.jitter
      )
      const graphqlClient = new GraphQLClient(auth?.getCredentials(), rateLimiter, cache)

      // 3. Fetch problem list
      spinner.start(`Searching for "${query}"...`)

      const filters: ProblemListFilters = {
        searchKeywords: query,
      }
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

      const problems = (
        listResult.data as unknown as {
          questions: {
            titleSlug: string
            title: string
            difficulty: string
            questionFrontendId: string
            isPaidOnly: boolean
            acRate: number
          }[]
        }
      ).questions

      spinner.stop()

      if (options.json) {
        logger.log(JSON.stringify(problems, null, 2))
        return
      }

      if (problems.length === 0) {
        logger.log(chalk.yellow(`No problems found matching "${query}"`))
        return
      }

      logger.log()
      logger.log(chalk.bold(`Found ${problems.length} results:`))
      logger.log()

      // Header
      logger.log(
        chalk.gray('ID'.padEnd(6)) +
          chalk.bold('Title'.padEnd(50)) +
          chalk.gray('Difficulty'.padEnd(12)) +
          chalk.gray('Status'.padEnd(10)) +
          chalk.gray('Acceptance')
      )
      logger.log(chalk.gray('─'.repeat(90)))

      for (const p of problems) {
        const id = p.questionFrontendId.padEnd(6)
        const title = p.title.length > 48 ? p.title.substring(0, 45) + '...' : p.title.padEnd(50)

        let difficulty = p.difficulty.padEnd(12)
        if (p.difficulty === 'Easy') difficulty = chalk.green(difficulty)
        else if (p.difficulty === 'Medium') difficulty = chalk.yellow(difficulty)
        else if (p.difficulty === 'Hard') difficulty = chalk.red(difficulty)

        const status = (p.isPaidOnly ? chalk.yellow('Premium') : chalk.green('Free')).padEnd(10)
        const acRate = `${p.acRate.toFixed(1)}%`

        logger.log(`${id}${title}${difficulty}${status}${acRate}`)
      }
      logger.log()
    } catch (error) {
      spinner.fail('Failed to search problems')
      handleCliError('Failed to search problems', error)
      process.exit(1)
    }
  })
