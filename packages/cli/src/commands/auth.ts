import { existsSync } from 'fs'
import { resolve } from 'path'

import { CookieFileAuth } from '@/packages/auth/src/index'
import { ConfigManager } from '@/shared/config/src/index'
import { logger } from '@/shared/utils/src/index'
import chalk from 'chalk'
import { Command } from 'commander'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import inquirer from 'inquirer'
import ora from 'ora'

import { handleCliError } from '../utils'

interface AuthAnswers {
  method: 'cookie' | 'browser'
  cookiePath?: string
}

interface InquirerModule {
  prompt<T = unknown>(questions: unknown[]): Promise<T>
}

export const authCommand = new Command('auth')
  .description('Authenticate with LeetCode')
  .option('-c, --cookies <file>', 'Cookie file path')
  .option('--browser', 'Use browser-based login (not implemented yet)')
  .action(async (options: { cookies?: string; browser?: boolean }) => {
    try {
      const configManager = ConfigManager.getInstance()
      const config = configManager.getConfig()

      logger.log(chalk.bold('LeetCode Authentication'))
      logger.log(chalk.gray('-----------------------'))

      let method = options.browser ? 'browser' : 'cookie'
      let cookiePath = options.cookies || config.auth.cookiePath

      // Interactive mode if no options provided
      if (!options.cookies && !options.browser) {
        const inquirerModule = inquirer as unknown as InquirerModule
        const answers = await inquirerModule.prompt<AuthAnswers>([
          {
            type: 'list',
            name: 'method',
            message: 'How would you like to authenticate?',
            choices: [
              { name: 'Use existing cookies.json file', value: 'cookie' },
              {
                name: 'Login via Browser (Coming Soon)',
                value: 'browser',
                disabled: 'Not implemented yet',
              },
            ],
            default: 'cookie',
          },
          {
            type: 'input',
            name: 'cookiePath',
            message: 'Path to cookies.json:',
            default: config.auth.cookiePath,
            when: (answers: AuthAnswers) => answers.method === 'cookie',
            validate: (input: unknown) => {
              if (typeof input === 'string' && input.trim() === '') return 'Path cannot be empty'
              return true
            },
          },
        ])

        method = answers.method
        if (answers.cookiePath) {
          cookiePath = resolve(answers.cookiePath)
        }
      }

      if (method === 'cookie') {
        if (!cookiePath) {
          logger.error(chalk.red('Cookie path is required'))
          process.exit(1)
        }

        if (!existsSync(cookiePath)) {
          logger.error(chalk.red(`Cookie file not found: ${cookiePath}`))
          logger.log(chalk.yellow('Please export your LeetCode cookies to a JSON file first.'))
          logger.log('You can use the "EditThisCookie" extension to export cookies as JSON.')
          process.exit(1)
        }

        const spinner = ora('Verifying credentials...').start()

        try {
          const auth = new CookieFileAuth(cookiePath)
          await auth.authenticate()

          spinner.succeed(chalk.green(`Successfully authenticated`))

          // Update config if path changed
          if (cookiePath !== config.auth.cookiePath) {
            configManager.update({
              auth: {
                ...config.auth,
                cookiePath: cookiePath,
              },
            })
            const paths = configManager.getPaths()
            if (paths.config) {
              configManager.save(paths.config)
              logger.log(chalk.gray(`Updated configuration with new cookie path.`))
            }
          }
        } catch (error) {
          spinner.fail('Authentication failed')
          throw error
        }
      } else {
        logger.warn('Browser login is not yet implemented.')
      }
    } catch (error) {
      handleCliError('Authentication failed', error)
      process.exit(1)
    }
  })
