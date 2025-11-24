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
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore

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
    const spinner = ora('Initializing Lesca configuration...').start()

    try {
      const prompts: DistinctQuestion[] = [
        {
          type: 'input' as const,
          name: 'configPath',
          message: 'Configuration file path:',
          default: options.configPath,
          validate: (input: string) => (input.trim() ? true : 'Path cannot be empty'),
        },
        {
          type: 'input' as const,
          name: 'outputDir',
          message: 'Output directory:',
          default: options.outputDir,
          validate: (input: string) => (input.trim() ? true : 'Path cannot be empty'),
        },
        {
          type: 'list' as const,
          name: 'format',
          message: 'Default output format:',
          choices: ['markdown', 'obsidian'],
          default: options.format,
        },
        {
          type: 'input' as const,
          name: 'cookiePath',
          message: 'Cookie file path:',
          default: options.cookiePath,
          validate: (input: string) => (input.trim() ? true : 'Path cannot be empty'),
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
        spinner.fail(chalk.red(`Configuration already exists at ${configPath}`))
        logger.warn(chalk.yellow('Use --force flag or confirm overwrite in prompts'))
        process.exit(1)
      }

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

      spinner.succeed(chalk.green(`Configuration created at ${configPath}`))

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

      logger.log('\n' + chalk.bold('Next steps:'))
      logger.log(chalk.cyan('1. Copy your LeetCode cookies to:'), finalConfig.auth.cookiePath)
      logger.log(chalk.cyan('2. Start scraping:'), 'lesca scrape two-sum')
      logger.log(chalk.cyan('3. Customize config:'), configPath)
    } catch (error) {
      spinner.fail(chalk.red('Failed to initialize configuration'))
      handleCliError('Failed to initialize configuration', error)
      process.exit(1)
    }
  })
