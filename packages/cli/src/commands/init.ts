import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'

import { getDefaultPaths, createDefaultConfig, exportConfigToYaml } from '@/shared/config/src/index'
import { logger } from '@/shared/utils/src/index'
import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'

import { handleCliError } from '../utils'

interface InitOptions {
  configPath: string
  cookiePath?: string
  outputDir?: string
  format?: string
  force?: boolean
}

export const initCommand = new Command('init')
  .description('Initialize Lesca configuration')
  .option('--config-path <path>', 'Path to create config file', './lesca.config.yaml')
  .option('--cookie-path <path>', 'Path for cookie storage')
  .option('--output-dir <path>', 'Default output directory', './output')
  .option('--format <format>', 'Default output format', 'markdown')
  .option('--force', 'Overwrite existing configuration')
  .action((options: InitOptions) => {
    const spinner = ora('Initializing Lesca configuration...').start()

    try {
      const configPath = resolve(options.configPath)
      const paths = getDefaultPaths()

      if (existsSync(configPath) && options.force !== true) {
        spinner.fail(chalk.red(`Configuration already exists at ${configPath}`))
        logger.warn(chalk.yellow('Use --force to overwrite'))
        process.exit(1)
      }

      const config = createDefaultConfig()

      if (options.cookiePath) {
        config.auth.cookiePath = resolve(options.cookiePath)
      }
      if (options.outputDir) {
        config.storage.path = resolve(options.outputDir)
      }
      if (options.format) {
        config.output.format = options.format as 'markdown' | 'obsidian'
      }

      const lescaDir = paths.lescaDir
      if (!existsSync(lescaDir)) {
        mkdirSync(lescaDir, { recursive: true })
        spinner.text = `Created directory: ${lescaDir}`
      }

      const cacheDir = paths.cacheDir
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true })
        spinner.text = `Created cache directory: ${cacheDir}`
      }

      const configDir = dirname(configPath)
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true })
      }

      const yamlContent = exportConfigToYaml(config)
      writeFileSync(configPath, yamlContent, 'utf-8')

      spinner.succeed(chalk.green(`Configuration created at ${configPath}`))

      const cookieExamplePath = resolve(lescaDir, 'cookies.example.json')
      if (!existsSync(cookieExamplePath)) {
        const exampleCookies = JSON.stringify([
          {
            name: 'csrftoken',
            value: 'your-csrf-token-here',
            domain: '.leetcode.com',
            path: '/',
            expires: -1,
            httpOnly: false,
            secure: true,
            sameSite: 'Lax'
          },
          {
            name: 'LEETCODE_SESSION',
            value: 'your-session-token-here',
            domain: '.leetcode.com',
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: true,
            sameSite: 'Lax'
          }
        ], null, 2)
        writeFileSync(cookieExamplePath, exampleCookies, 'utf-8')
        logger.log(chalk.gray(`Example cookie file created at ${cookieExamplePath}`))
      }

      logger.log('\n' + chalk.bold('Next steps:'))
      logger.log(chalk.cyan('1. Copy your LeetCode cookies to:'), paths.cookieFile)
      logger.log(chalk.cyan('2. Start scraping:'), 'lesca scrape two-sum')
      logger.log(chalk.cyan('3. Customize config:'), configPath)

    } catch (error) {
      spinner.fail(chalk.red('Failed to initialize configuration'))
      handleCliError('Failed to initialize configuration', error)
      process.exit(1)
    }
  })
