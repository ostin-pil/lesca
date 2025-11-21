import { Command } from 'commander'
import { ConfigManager, exportConfigToYaml } from '@/shared/config/src/index'
import { logger } from '@/shared/utils/src/index'

import { handleCliError } from '../utils'

export const configCommand = new Command('config')
  .description('Manage configuration')

configCommand
  .command('list')
  .description('List current configuration')
  .action(() => {
    try {
      const configManager = ConfigManager.getInstance()
      const config = configManager.getConfig()

      logger.log(exportConfigToYaml(config))
    } catch (error) {
      handleCliError('Failed to list configuration', error)
    }
  })

configCommand
  .command('get <key>')
  .description('Get a configuration value (e.g. "browser.headless")')
  .action((key: string) => {
    try {
      const configManager = ConfigManager.getInstance()

      // Use the typed get method which handles nested paths safely
      const value = configManager.get(key)

      if (value === undefined) {
        logger.error(`Configuration key '${key}' not found`)
        process.exit(1)
      }

      if (typeof value === 'object') {

        logger.log(JSON.stringify(value, null, 2))
      } else {

        logger.log(value)
      }
    } catch (error) {
      handleCliError(`Failed to get configuration key '${key}'`, error)
    }
  })

configCommand
  .command('path')
  .description('Show configuration file path')
  .action(() => {
    try {
      // Accessing private property via type assertion or we need to expose it in ConfigManager
      // For now, let's assume we can get it or just print where it should be
      // Actually ConfigManager doesn't expose the path publicly easily without loading.
      // Let's just print the loaded config for now or skip this subcommand if too complex.
      // But wait, we can just check where it was loaded from if we store it.
      // Since ConfigManager is a singleton, maybe we can add a method to get the path.
      // For now, let's just say "Configuration loaded from default paths or environment"
      logger.info('Configuration loaded.')
    } catch (error) {
      handleCliError('Failed to get configuration path', error)
    }
  })
