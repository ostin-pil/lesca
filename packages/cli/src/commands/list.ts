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

import { InteractiveSelector } from '../interactive-select'
import { handleCliError } from '../utils'

interface ListOptions {
  difficulty?: string
  tags: string
  limit: string
  cookies: string
  auth: boolean
  json: boolean
  interactive: boolean
}

export const listCommand = new Command('list')
  .alias('ls')
  .description(chalk.white('List available LeetCode problems'))
  .option('-d, --difficulty <level>', 'Filter by difficulty (Easy, Medium, Hard)')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('-l, --limit <number>', 'Limit number of problems (default: 50)', '50')
  .option('-c, --cookies <file>', 'Cookie file path (default: from config)')
  .option('--no-auth', 'Skip authentication (public problems only)')
  .option('--json', 'Output as JSON')
  .option('-i, --interactive', 'Interactive problem selection')
  .addHelpText(
    'after',
    `
${chalk.bold('Examples:')}
  ${chalk.gray('# List all problems')}
  $ lesca list

  ${chalk.gray('# Filter by difficulty')}
  $ lesca list ${chalk.cyan('--difficulty Easy')}
  $ lesca list ${chalk.cyan('-d Medium')}

  ${chalk.gray('# Filter by tags')}
  $ lesca list ${chalk.cyan('--tags array,dynamic-programming')}
  $ lesca list ${chalk.cyan('-t tree,recursion')}

  ${chalk.gray('# Limit results')}
  $ lesca list ${chalk.cyan('--limit 10 -d Hard')}

  ${chalk.gray('# Output as JSON for scripting')}
  $ lesca list ${chalk.cyan('--json')} > problems.json

${chalk.bold('Tips:')}
  ${chalk.gray('•')} Combine filters: ${chalk.cyan('lesca list -d Easy -t array -l 20')}
  ${chalk.gray('•')} Premium problems show a ${chalk.yellow('Premium')} badge
  ${chalk.gray('•')} Use ${chalk.cyan('--json')} output to pipe into ${chalk.cyan('lesca scrape-list')}

${chalk.bold('See also:')}
  ${chalk.cyan('lesca search')}          Search problems by keyword
  ${chalk.cyan('lesca scrape-list')}     Scrape multiple problems from list
  `
  )
  .action(async (options: ListOptions) => {
    const spinner = ora('Initializing...').start()

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

      // Set up GraphQL client
      const rateLimiter = new RateLimiter(
        config.api.rateLimit.minDelay,
        config.api.rateLimit.maxDelay,
        config.api.rateLimit.jitter
      )
      const graphqlClient = new GraphQLClient(auth?.getCredentials(), rateLimiter, cache)

      // 3. Fetch problem list
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

      const problems = (
        listResult.data as unknown as {
          questions: {
            titleSlug: string
            title: string
            difficulty: string
            questionFrontendId: string
            isPaidOnly: boolean
          }[]
        }
      ).questions

      spinner.stop()

      if (options.json) {
        logger.log(JSON.stringify(problems, null, 2))
        return
      }

      // Interactive mode: allow user to select problems
      if (options.interactive) {
        const selectedSlugs = await InteractiveSelector.selectProblems(problems, {
          message: `Found ${problems.length} problems. Select which to scrape:`,
          multiSelect: true,
        })

        if (selectedSlugs.length === 0) {
          logger.log(chalk.yellow('  No problems selected.'))
          return
        }

        logger.log()
        logger.log(chalk.green(`  ✓ Selected ${selectedSlugs.length} problems:`))
        selectedSlugs.forEach((slug) => {
          logger.log(chalk.gray(`    • ${slug}`))
        })

        const shouldScrape = await InteractiveSelector.confirm(
          'Scrape selected problems now?',
          true
        )

        if (shouldScrape) {
          logger.log()
          logger.log(chalk.cyan('  Run:'), chalk.white(`lesca scrape ${selectedSlugs.join(' ')}`))
          logger.log(
            chalk.gray(`  Or save to file: echo "${selectedSlugs.join('\\n')}" > problems.txt`)
          )
        }
        return
      }

      logger.log()
      logger.log(chalk.bold(`Found ${problems.length} problems:`))
      logger.log()

      // Header
      logger.log(
        chalk.gray('ID'.padEnd(6)) +
          chalk.bold('Title'.padEnd(50)) +
          chalk.gray('Difficulty'.padEnd(12)) +
          chalk.gray('Status')
      )
      logger.log(chalk.gray('─'.repeat(80)))

      for (const p of problems) {
        const id = p.questionFrontendId.padEnd(6)
        const title = p.title.length > 48 ? p.title.substring(0, 45) + '...' : p.title.padEnd(50)

        let difficulty = p.difficulty.padEnd(12)
        if (p.difficulty === 'Easy') difficulty = chalk.green(difficulty)
        else if (p.difficulty === 'Medium') difficulty = chalk.yellow(difficulty)
        else if (p.difficulty === 'Hard') difficulty = chalk.red(difficulty)

        const status = p.isPaidOnly ? chalk.yellow('Premium') : chalk.green('Free')

        logger.log(`${id}${title}${difficulty}${status}`)
      }
      logger.log()
    } catch (error) {
      spinner.fail('Failed to list problems')
      handleCliError('Failed to list problems', error)
      process.exit(1)
    }
  })
