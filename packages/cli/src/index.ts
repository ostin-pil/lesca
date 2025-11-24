#!/usr/bin/env node

import { ConfigManager } from '@/shared/config/src/index'
import { logger } from '@/shared/utils/src/index'
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

    if (opts.debug) {
      logger.setConfig({
        level: 'debug',
        timestamps: true,
        colors: true,
      })
      logger.debug('Debug mode enabled')
    }

    initializeConfig(opts.config)
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

program.parse()
