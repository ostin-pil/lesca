import { existsSync } from 'fs'
import { resolve } from 'path'

import { ConfigManager } from '@/shared/config/src/index'
import { logger } from '@/shared/utils/src/index'
import chalk from 'chalk'
import { Command } from 'commander'

import { handleCliError } from '../utils'

/**
 * Config command - Manage Lesca configuration
 *
 * Subcommands:
 * - show: Display current configuration
 * - init: Create default config file
 * - get <key>: Get specific configuration value
 * - set <key> <value>: Update configuration value
 */
export const configCommand = new Command('config')
  .description('Manage configuration')
  .addCommand(
    new Command('show')
      .description('Display current configuration')
      .option('--json', 'Output as JSON')
      .option('--path <key>', 'Show specific config path')
      .action((options: { json?: boolean; path?: string }) => {
        try {
          const manager = ConfigManager.getInstance()

          if (options.path) {
            const value = manager.get(options.path)
            if (value === undefined) {
              logger.error(chalk.red(`Configuration key not found: ${options.path}`))
              process.exit(1)
            }
            logger.log(options.json ? JSON.stringify(value, null, 2) : value)
          } else {
            const config = manager.getEffectiveConfig()
            logger.log(options.json ? JSON.stringify(config, null, 2) : manager.export('yaml'))
          }
        } catch (error) {
          handleCliError('Failed to show configuration', error)
          process.exit(1)
        }
      })
  )
  .addCommand(
    new Command('init')
      .description('Create default configuration file')
      .option('--path <path>', 'Config file path', './lesca.config.yaml')
      .option('--force', 'Overwrite if exists')
      .action((options: { path?: string; force?: boolean }) => {
        try {
          const configPath = resolve(options.path || './lesca.config.yaml')

          if (existsSync(configPath) && !options.force) {
            logger.error(chalk.red(`Config file already exists: ${configPath}`))
            logger.log(chalk.yellow('Use --force to overwrite'))
            process.exit(1)
          }

          const manager = ConfigManager.getInstance()
          const created = manager.createDefaultConfigFile(configPath)

          logger.log(chalk.green(`✓ Created configuration file: ${created}`))
        } catch (error) {
          handleCliError('Failed to create config file', error)
          process.exit(1)
        }
      })
  )
  .addCommand(
    new Command('get')
      .description('Get a configuration value')
      .argument('<key>', 'Config key (e.g., "browser.headless")')
      .option('--json', 'Output as JSON')
      .action((key: string, options: { json?: boolean }) => {
        try {
          const manager = ConfigManager.getInstance()
          const value = manager.get(key)

          if (value === undefined) {
            logger.error(chalk.red(`Configuration key not found: ${key}`))
            process.exit(1)
          }

          if (options.json) {
            logger.log(JSON.stringify(value, null, 2))
          } else if (typeof value === 'object') {
            logger.log(JSON.stringify(value, null, 2))
          } else {
            logger.log(String(value))
          }
        } catch (error) {
          handleCliError(`Failed to get config value: ${key}`, error)
          process.exit(1)
        }
      })
  )
  .addCommand(
    new Command('set')
      .description('Set a configuration value')
      .argument('<key>', 'Config key (e.g., "browser.headless")')
      .argument('<value>', 'Value to set')
      .option('--json', 'Parse value as JSON')
      .action((key: string, valueStr: string, options: { json?: boolean }) => {
        try {
          const manager = ConfigManager.getInstance()

          let value: unknown = valueStr
          if (options.json) {
            value = JSON.parse(valueStr)
          } else {
            if (valueStr === 'true') value = true
            else if (valueStr === 'false') value = false
            else if (!isNaN(Number(valueStr))) value = Number(valueStr)
          }

          // Build partial config object from key path
          const keys = key.split('.')
          const partialConfig: Record<string, unknown> = {}
          let current = partialConfig

          for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i]
            if (!k) continue
            current[k] = {}
            current = current[k] as Record<string, unknown>
          }
          const lastKey = keys[keys.length - 1]
          if (lastKey) {
            current[lastKey] = value
          }

          manager.update(partialConfig)
          logger.log(chalk.green(`✓ Set ${key} = ${JSON.stringify(value)}`))

          const paths = manager.getPaths()
          if (paths.config) {
            manager.save(paths.config)
            logger.log(chalk.gray(`Saved to ${paths.config}`))
          }
        } catch (error) {
          handleCliError(`Failed to set config value: ${key}`, error)
          process.exit(1)
        }
      })
  )
  .addCommand(
    new Command('path').description('Show configuration file path').action(() => {
      try {
        const manager = ConfigManager.getInstance()
        const paths = manager.getPaths()

        logger.log(chalk.bold('Configuration paths:'))
        if (paths.config) {
          logger.log(chalk.cyan('Config file:'), paths.config)
        } else {
          logger.log(chalk.yellow('No config file loaded (using defaults)'))
        }
        logger.log(chalk.cyan('Cookie file:'), paths.cookieFile)
        logger.log(chalk.cyan('Cache dir:'), paths.cacheDir)
      } catch (error) {
        handleCliError('Failed to show config paths', error)
        process.exit(1)
      }
    })
  )
