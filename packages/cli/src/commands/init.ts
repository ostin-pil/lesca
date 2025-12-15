import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'

import { getDefaultPaths, ConfigManager } from '@lesca/shared/config'
import { logger } from '@lesca/shared/utils'
import chalk from 'chalk'
import { Command } from 'commander'
import type { DistinctQuestion } from 'inquirer'
import ora from 'ora'

import { handleCliError } from '../utils'

/**
 * Display welcome banner
 */
function showWelcomeBanner() {
  logger.banner('🚀 Welcome to Lesca Setup Wizard', 'box')
  logger.log(chalk.gray("Let's configure your LeetCode scraper..."))
  logger.log()
}

/**
 * Display configuration summary
 */
function showConfigSummary(config: Required<InitOptions>) {
  logger.log()
  logger.log(chalk.bold('📋 Configuration Summary:'))
  logger.log(chalk.gray('─'.repeat(50)))
  logger.log(chalk.cyan('  Config file:    '), chalk.white(config.configPath))
  logger.log(chalk.cyan('  Output dir:     '), chalk.white(config.outputDir))
  logger.log(chalk.cyan('  Output format:  '), chalk.white(config.format))
  logger.log(chalk.cyan('  Cookie file:    '), chalk.white(config.cookiePath))
  logger.log(chalk.gray('─'.repeat(50)))
  logger.log()
}

interface InitOptions {
  configPath?: string
  cookiePath?: string
  outputDir?: string
  format?: string
  force?: boolean
  nonInteractive?: boolean
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
  .option('--non-interactive', 'Skip prompts and use defaults/flags')
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

      let answers: InitAnswers = {}

      if (!options.nonInteractive) {
        const { default: inquirer } = await import('inquirer')
        answers = (await inquirer.prompt(prompts)) as InitAnswers
      }

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
        logger.log()
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

      logger.success('Setup complete!')
      logger.steps('📝 Next steps:', [
        'Export cookies: lesca auth --setup',
        'Test scraping: lesca scrape two-sum',
        'View docs: lesca help',
      ])
      logger.log(chalk.gray('  Config saved to:'), chalk.white(configPath))
      logger.log(chalk.gray('  Cookie path:'), chalk.white(finalConfig.auth.cookiePath))
      logger.log()
    } catch (error) {
      logger.log()
      logger.error(chalk.red('✗ Failed to initialize configuration'))
      handleCliError('Failed to initialize configuration', error)
      process.exit(1)
    }
  })
