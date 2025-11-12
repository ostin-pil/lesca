#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { LeetCodeScraper } from '../../core/src/index.js'
import { GraphQLClient, RateLimiter } from '../../api-client/src/index.js'
import { CookieFileAuth } from '../../auth/src/index.js'
import { ProblemScraperStrategy, ListScraperStrategy } from '../../scrapers/src/index.js'
import { FileSystemStorage } from '../../storage/src/index.js'
import type { ProblemScrapeRequest, ListScrapeRequest } from '../../../shared/types/src/index.js'
import { resolve } from 'path'
import { homedir } from 'os'

/**
 * CLI Application for Lesca
 */

const program = new Command()

program
  .name('lesca')
  .description('Modular LeetCode Scraper - Scrape LeetCode problems to Markdown')
  .version('0.1.0')

/**
 * Scrape a single problem
 */
program
  .command('scrape')
  .description('Scrape a LeetCode problem')
  .argument('<problem>', 'Problem title slug (e.g., "two-sum")')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-f, --format <format>', 'Output format (markdown, obsidian)', 'obsidian')
  .option('-c, --cookies <file>', 'Cookie file path', resolve(homedir(), '.lesca/cookies.json'))
  .option('--no-auth', 'Skip authentication (public problems only)')
  .action(async (problem: string, options) => {
    const spinner = ora('Initializing...').start()

    try {
      // 1. Set up authentication
      let auth
      if (options.auth !== false) {
        try {
          auth = new CookieFileAuth(options.cookies)
          await auth.authenticate()
          spinner.succeed('Authentication loaded')
        } catch (error) {
          spinner.warn(`Authentication failed, continuing without auth: ${error instanceof Error ? error.message : String(error)}`)
          auth = undefined
        }
      } else {
        spinner.info('Running without authentication')
      }

      // 2. Set up GraphQL client
      const rateLimiter = new RateLimiter(2000, 3000, true) // 2-3 seconds between requests
      const graphqlClient = new GraphQLClient(auth?.getCredentials(), rateLimiter)

      // 3. Set up strategies
      const strategies = [
        new ProblemScraperStrategy(graphqlClient),
        new ListScraperStrategy(graphqlClient),
      ]

      // 4. Set up storage
      const storage = new FileSystemStorage(options.output)

      // 5. Create scraper
      const scraper = new LeetCodeScraper(strategies, storage, {
        format: options.format,
      })

      // 6. Scrape the problem
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
        console.log()
        console.log(chalk.gray('  Preview:'))
        if (result.data?.content) {
          const preview = result.data.content.split('\n').slice(0, 5).join('\n')
          console.log(chalk.gray('  ' + preview.replace(/\n/g, '\n  ')))
        }
      } else {
        spinner.fail('Failed to scrape problem')
        console.error(chalk.red('Error:'), result.error?.message)
        process.exit(1)
      }
    } catch (error) {
      spinner.fail('Unexpected error')
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

/**
 * Scrape multiple problems
 */
program
  .command('scrape-list')
  .description('Scrape multiple problems')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-f, --format <format>', 'Output format (markdown, obsidian)', 'obsidian')
  .option('-c, --cookies <file>', 'Cookie file path', resolve(homedir(), '.lesca/cookies.json'))
  .option('-d, --difficulty <level>', 'Filter by difficulty (Easy, Medium, Hard)')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)', '')
  .option('-l, --limit <number>', 'Limit number of problems', '10')
  .option('--no-auth', 'Skip authentication (public problems only)')
  .action(async (options) => {
    const spinner = ora('Initializing...').start()

    try {
      // 1. Set up authentication
      let auth
      if (options.auth !== false) {
        try {
          auth = new CookieFileAuth(options.cookies)
          await auth.authenticate()
          spinner.succeed('Authentication loaded')
        } catch (error) {
          spinner.warn(`Authentication failed, continuing without auth`)
          auth = undefined
        }
      }

      // 2. Set up clients
      const rateLimiter = new RateLimiter(2000, 3000, true)
      const graphqlClient = new GraphQLClient(auth?.getCredentials(), rateLimiter)

      // 3. Set up strategies
      const strategies = [
        new ProblemScraperStrategy(graphqlClient),
        new ListScraperStrategy(graphqlClient),
      ]

      // 4. Set up storage
      const storage = new FileSystemStorage(options.output)

      // 5. Create scraper
      const scraper = new LeetCodeScraper(strategies, storage, {
        format: options.format,
      })

      // 6. Fetch problem list
      spinner.start('Fetching problem list...')

      const listRequest: ListScrapeRequest = {
        type: 'list',
        filters: {
          difficulty: options.difficulty,
          tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined,
        },
        limit: parseInt(options.limit),
      }

      const listResult = await new ListScraperStrategy(graphqlClient).execute(listRequest)

      if (listResult.type !== 'list') {
        throw new Error('Invalid response type')
      }

      const problems = (listResult.data as { questions: { titleSlug: string; title: string }[] })
        .questions

      spinner.succeed(`Found ${problems.length} problems`)

      // 7. Scrape each problem
      let completed = 0
      let failed = 0

      for (const problem of problems) {
        spinner.start(
          `[${completed + failed + 1}/${problems.length}] Scraping: ${problem.title}`
        )

        const request: ProblemScrapeRequest = {
          type: 'problem',
          titleSlug: problem.titleSlug,
        }

        const result = await scraper.scrape(request)

        if (result.success) {
          completed++
          spinner.succeed(`[${completed + failed}/${problems.length}] ${problem.title}`)
        } else {
          failed++
          spinner.fail(`[${completed + failed}/${problems.length}] ${problem.title}`)
          console.error(chalk.red('  Error:'), result.error?.message)
        }
      }

      // Summary
      console.log()
      console.log(chalk.bold('Summary:'))
      console.log(`  ${chalk.green('✓')} Completed: ${completed}`)
      console.log(`  ${chalk.red('✗')} Failed: ${failed}`)
      console.log(`  ${chalk.blue('→')} Output: ${options.output}`)
    } catch (error) {
      spinner.fail('Unexpected error')
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

/**
 * Initialize configuration
 */
program
  .command('init')
  .description('Initialize Lesca configuration')
  .action(async () => {
    console.log(chalk.bold('Lesca Initialization'))
    console.log()
    console.log('To use Lesca, you need to provide LeetCode authentication cookies.')
    console.log()
    console.log(chalk.cyan('Steps:'))
    console.log('1. Log into LeetCode in your browser')
    console.log('2. Export cookies using a browser extension (e.g., "EditThisCookie")')
    console.log('3. Save cookies to: ' + chalk.yellow('~/.lesca/cookies.json'))
    console.log()
    console.log(chalk.bold('Cookie file format:'))
    console.log(
      chalk.gray(`{
  "cookies": [
    {
      "name": "LEETCODE_SESSION",
      "value": "your_session_value",
      "domain": ".leetcode.com"
    },
    {
      "name": "csrftoken",
      "value": "your_csrf_token",
      "domain": "leetcode.com"
    }
  ]
}`)
    )
    console.log()
    console.log(chalk.green('Once you have cookies set up, try:'))
    console.log(chalk.cyan('  lesca scrape two-sum'))
  })

// Parse arguments
program.parse()
