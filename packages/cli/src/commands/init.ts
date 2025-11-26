import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'

import { getDefaultPaths, ConfigManager } from '@/shared/config/src/index'
import { logger } from '@/shared/utils/src/index'
import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import type { DistinctQuestion } from 'inquirer'
import ora from 'ora'

import { handleCliError } from '../utils'

/**
 * Display welcome banner
 */
/* eslint-disable no-console */
function showWelcomeBanner() {
  console.log()
  console.log(chalk.cyan('┌─────────────────────────────────────┐'))
  console.log(
    chalk.cyan('│') + chalk.bold.white('  🚀 Welcome to Lesca Setup Wizard  ') + chalk.cyan('│')
  )
  console.log(chalk.cyan('└─────────────────────────────────────┘'))
  console.log()
  console.log(chalk.gray("Let's configure your LeetCode scraper..."))
  console.log()
}
/* eslint-enable no-console */

/**
 * Display configuration summary
 */
/* eslint-disable no-console */
function showConfigSummary(config: Required<InitOptions>) {
  console.log()
  console.log(chalk.bold('📋 Configuration Summary:'))
  console.log(chalk.gray('─'.repeat(50)))
  console.log(chalk.cyan('  Config file:    '), chalk.white(config.configPath))
  console.log(chalk.cyan('  Output dir:     '), chalk.white(config.outputDir))
  console.log(chalk.cyan('  Output format:  '), chalk.white(config.format))
  console.log(chalk.cyan('  Cookie file:    '), chalk.white(config.cookiePath))
  console.log(chalk.gray('─'.repeat(50)))
  console.log()
}

interface InitOptions {
  configPath?: string
  cookiePath?: string
  outputDir?: string
  format?: string
  force?: boolean
}

interface InitAnswers {
  configPath?: string
  outputDir?: string
  format?: string
  cookiePath?: string
  force?: boolean
}

export const initCommand = new Command('init')
  .description('Initialize Lesca configuration')
  .option('--config-path <path>', 'Path to create config file', './lesca.config.yaml')
  .option('--cookie-path <path>', 'Path for cookie storage')
  .option('--output-dir <path>', 'Default output directory', './output')
  .option('--format <format>', 'Default output format (markdown|obsidian)', 'markdown')
  .option('--force', 'Overwrite existing configuration')
  .action(async (options: InitOptions) => {
    // Show welcome banner
    showWelcomeBanner()

    try {
      const prompts: DistinctQuestion[] = [
        {
          type: 'input' as const,
          name: 'configPath',
          message: 'Configuration file path:',
          default: options.configPath,
          validate: (input: string) => (input.trim() ? true : 'Path cannot be empty'),
          prefix: chalk.cyan('?'),
          suffix: chalk.gray(' (Where to save your config)'),
        },
        {
          type: 'input' as const,
          name: 'outputDir',
          message: 'Output directory:',
          default: options.outputDir,
          validate: (input: string) => (input.trim() ? true : 'Path cannot be empty'),
          prefix: chalk.cyan('?'),
          suffix: chalk.gray(' (Where scraped problems will be saved)'),
        },
        {
          type: 'list' as const,
          name: 'format',
          message: 'Default output format:',
          choices: [
            { name: 'Markdown (Standard markdown files)', value: 'markdown' },
            { name: 'Obsidian (Optimized for Obsidian vault)', value: 'obsidian' },
          ],
          default: options.format,
          prefix: chalk.cyan('?'),
        },
        {
          type: 'input' as const,
          name: 'cookiePath',
          message: 'Cookie file path:',
          default: options.cookiePath,
          validate: (input: string) => (input.trim() ? true : 'Path cannot be empty'),
          prefix: chalk.cyan('?'),
          suffix: chalk.gray(' (For authentication)'),
        },
        {
          type: 'confirm' as const,
          name: 'force',
          message: 'Configuration file exists. Overwrite?',
          default: !!options.force,
          when: (answers: Partial<InitAnswers>) => {
            const pathToCheck = resolve(
              answers.configPath || options.configPath || './lesca.config.yaml'
            )
            return existsSync(pathToCheck)
          },
        },
      ]

      const answers = (await inquirer.prompt(prompts)) as InitAnswers

      // Merge CLI options with prompted answers (prompts override CLI)
      const effectiveOptions: Required<InitOptions> = {
        configPath: answers.configPath || options.configPath || './lesca.config.yaml',
        cookiePath: answers.cookiePath || options.cookiePath || getDefaultPaths().cookieFile,
        outputDir: answers.outputDir || options.outputDir || './output',
        format: (answers.format || options.format || 'markdown') as 'markdown' | 'obsidian',
        force: answers.force ?? options.force ?? false,
      }

      const configPath = resolve(effectiveOptions.configPath)

      // Final safety check
      if (existsSync(configPath) && !effectiveOptions.force) {
        // eslint-disable-next-line no-console
        console.log()
        logger.warn(chalk.red(`✗ Configuration already exists at ${configPath}`))
        logger.warn(chalk.yellow('  Use --force flag or confirm overwrite in prompts'))
        process.exit(1)
      }

      // Show configuration summary
      showConfigSummary(effectiveOptions)

      const spinner = ora('Creating configuration...').start()

      // Initialize ConfigManager with defaults
      ConfigManager.initialize()
      const configManager = ConfigManager.getInstance()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = {
        auth: {
          cookiePath: resolve(effectiveOptions.cookiePath),
        },
        storage: {
          path: resolve(effectiveOptions.outputDir),
        },
        output: {
          format: effectiveOptions.format,
        },
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      configManager.update(updates)

      const finalConfig = configManager.getConfig()

      // Create standard directories
      const paths = getDefaultPaths()
      if (!existsSync(paths.lescaDir)) {
        mkdirSync(paths.lescaDir, { recursive: true })
        spinner.text = `Created ${paths.lescaDir}`
      }

      if (!existsSync(paths.cacheDir)) {
        mkdirSync(paths.cacheDir, { recursive: true })
        spinner.text = `Created ${paths.cacheDir}`
      }

      // Ensure config directory exists
      const configDir = dirname(configPath)
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true })
      }

      // Save validated configuration
      configManager.save(configPath)

      spinner.succeed(chalk.green('✓ Configuration created'))

      // Create example cookies file
      const cookieExamplePath = resolve(paths.lescaDir, 'cookies.example.json')
      if (!existsSync(cookieExamplePath)) {
        const exampleCookies = JSON.stringify(
          [
            {
              name: 'csrftoken',
              value: 'your-csrf-token-here',
              domain: '.leetcode.com',
              path: '/',
              expires: -1,
              httpOnly: false,
              secure: true,
              sameSite: 'Lax',
            },
            {
              name: 'LEETCODE_SESSION',
              value: 'your-session-token-here',
              domain: '.leetcode.com',
              path: '/',
              expires: -1,
              httpOnly: true,
              secure: true,
              sameSite: 'Lax',
            },
          ],
          null,
          2
        )
        writeFileSync(cookieExamplePath, exampleCookies, 'utf-8')
        logger.log(chalk.gray(`Example cookie file created: ${cookieExamplePath}`))
      }

      /* eslint-disable no-console */
      console.log()
      console.log(chalk.bold.green('✓ Setup complete!'))
      console.log()
      console.log(chalk.bold('📝 Next steps:'))
      console.log(chalk.cyan('  1.'), 'Export cookies:', chalk.white('lesca auth --setup'))
      console.log(chalk.cyan('  2.'), 'Test scraping:', chalk.white('lesca scrape two-sum'))
      console.log(chalk.cyan('  3.'), 'View docs:', chalk.white('lesca help'))
      console.log()
      console.log(chalk.gray('  Config saved to:'), chalk.white(configPath))
      console.log(chalk.gray('  Cookie path:'), chalk.white(finalConfig.auth.cookiePath))
      console.log()
      /* eslint-enable no-console */
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log()
      logger.error(chalk.red('✗ Failed to initialize configuration'))
      handleCliError('Failed to initialize configuration', error)
      process.exit(1)
    }
  })
