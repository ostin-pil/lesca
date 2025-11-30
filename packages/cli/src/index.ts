#!/usr/bin/env node

import { ConfigManager } from '@lesca/shared/config'
import { logger } from '@lesca/shared/utils'
import { Command } from 'commander'

import { authCommand } from './commands/auth'
import { configCommand } from './commands/config'
import { initCommand } from './commands/init'
import { listCommand } from './commands/list'
import { loginCommand } from './commands/login'
import { scrapeCommand } from './commands/scrape'
import { scrapeDiscussionsCommand } from './commands/scrape-discussions'
import { scrapeEditorialCommand } from './commands/scrape-editorial'
import { scrapeListCommand } from './commands/scrape-list'
import { searchCommand } from './commands/search'
import { sessionCommand } from './commands/session'

/**
 * CLI Application for Lesca
 */

/**
 * Initialize configuration from file, env, and CLI options
 */
function initializeConfig(configPath?: string): void {
  try {
    const opts = configPath ? { configPath } : {}
    ConfigManager.initialize(opts)
  } catch (error) {
    logger.warn('Could not load config file, using defaults')
    ConfigManager.initialize({})
  }
}

const program = new Command()

program
  .name('lesca')
  .description('Modular LeetCode Scraper - Scrape LeetCode problems to Markdown')
  .version('0.1.0')
  .option('--config <path>', 'Path to configuration file')
  .option('--debug', 'Enable debug mode with verbose logging')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.optsWithGlobals<{ config?: string; debug?: boolean }>()

    initializeConfig(opts.config)
    const config = ConfigManager.getInstance().getConfig()

    logger.setConfig({
      level: config.logging.level,
      console: config.logging.output === 'console' || config.logging.output === 'both',
      file: config.logging.output === 'file' || config.logging.output === 'both',
      ...(config.logging.file ? { filePath: config.logging.file } : {}),
      json: config.logging.format === 'json',
    })

    if (opts.debug) {
      logger.setConfig({
        level: 'debug',
        timestamps: true,
        colors: true,
      })
      logger.debug('Debug mode enabled')
    }
  })

program.addCommand(initCommand)
program.addCommand(authCommand)
program.addCommand(loginCommand)
program.addCommand(listCommand)
program.addCommand(searchCommand)
program.addCommand(scrapeCommand)
program.addCommand(scrapeListCommand)
program.addCommand(scrapeEditorialCommand)
program.addCommand(scrapeDiscussionsCommand)
program.addCommand(configCommand)
program.addCommand(sessionCommand)

program.parse()
