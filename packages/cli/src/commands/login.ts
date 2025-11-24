import { PlaywrightDriver, AuthHelper, CookieManager } from '@/packages/browser-automation/src/index'
import { ConfigManager , getDefaultPaths } from '@/shared/config/src/index'
import { logger } from '@/shared/utils/src/index'
import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'

import { handleCliError } from '../utils'

interface LoginOptions {
  username?: string
  password?: string
  cookiePath?: string
  headless?: boolean
  manual?: boolean
}

export const loginCommand = new Command('login')
  .alias('auth')
  .description('Interactive login to LeetCode and save authentication cookies')
  .option('-u, --username <username>', 'LeetCode username or email')
  .option('-p, --password <password>', 'LeetCode password (not recommended, use prompt instead)')
  .option('-c, --cookie-path <path>', 'Path to save cookies (overrides config)')
  .option('--no-headless', 'Run browser in visible mode (useful for CAPTCHA)')
  .option('--manual', 'Wait for manual login (for CAPTCHA/2FA scenarios)')
  .action(async (options: LoginOptions) => {
    const spinner = ora('Initializing login...').start()

    let driver: PlaywrightDriver | undefined

    try {
      // Get configuration
      const configManager = ConfigManager.getInstance()
      const config = configManager.getConfig()
      const paths = getDefaultPaths()

      // Determine cookie save path
      const cookiePath = options.cookiePath || config.auth.cookiePath || paths.cookieFile

      // Determine if headless
      const headless = options.headless !== false && config.browser.headless

      // Initialize browser driver
      driver = new PlaywrightDriver()
      const cookieManager = new CookieManager()
      const authHelper = new AuthHelper(driver, cookieManager)

      spinner.text = 'Launching browser...'
      await driver.launch({
        headless,
        timeout: config.browser.timeout,
      })

      spinner.succeed('Browser launched')

      if (options.manual) {
        logger.log(chalk.yellow('\nManual login mode:'))
        logger.log(chalk.cyan('1. A browser window will open'))
        logger.log(chalk.cyan('2. Complete the login process manually (including CAPTCHA/2FA)'))
        logger.log(chalk.cyan('3. Wait for automatic cookie detection'))
        logger.log()

        spinner.start('Waiting for manual login...')

        const result = await authHelper.waitForManualLogin()

        if (result.success) {
          spinner.succeed(chalk.green('Login successful!'))

          await cookieManager.saveCookies(driver, cookiePath)
          logger.log(chalk.green(`✓ Cookies saved to: ${cookiePath}`))
          logger.log()
          logger.log(chalk.bold('Next steps:'))
          logger.log(chalk.cyan('You can now run scraping commands with authentication'))
        } else {
          spinner.fail(chalk.red('Manual login failed or timed out'))
          logger.error(result.message || 'Login failed')
          process.exit(1)
        }
      } else {
        // Interactive login with credentials
        const username = options.username
        const password = options.password

        // Prompt for credentials if not provided
        if (!username || !password) {
          spinner.stop()

          if (!username) {
            logger.error(chalk.red('Username required. Use --username option or --manual for manual login'))
            process.exit(1)
          }
          if (!password) {
            logger.error(chalk.red('Password required. Use --password option or --manual for manual login'))
            logger.warn(chalk.yellow('Note: For security, consider using --manual mode instead of passing password as argument'))
            process.exit(1)
          }
        }

        spinner.start('Logging in to LeetCode...')

        const result = await authHelper.login(
          {
            username: username,
            password: password,
          },
          {
            saveCookies: true,
            cookiePath: cookiePath,
            timeout: 60000,
          }
        )

        if (result.success) {
          spinner.succeed(chalk.green('Login successful!'))
          logger.log(chalk.green(`✓ Cookies saved to: ${cookiePath}`))
          logger.log()
          logger.log(chalk.bold('Next steps:'))
          logger.log(chalk.cyan('You can now run scraping commands with authentication'))
        } else {
          spinner.fail(chalk.red('Login failed'))

          if (result.state === 'captcha') {
            logger.error(chalk.red('CAPTCHA detected'))
            logger.log()
            logger.log(chalk.yellow('Try again with manual mode:'))
            logger.log(chalk.cyan('  lesca login --manual --no-headless'))
          } else if (result.state === 'rate-limited') {
            logger.error(chalk.red('Rate limited by LeetCode'))
            logger.log(chalk.yellow('Please wait a few minutes and try again'))
          } else {
            logger.error(result.message || 'Login failed. Please check your credentials.')
          }

          process.exit(1)
        }
      }

      if (driver) {
        await driver.close()
      }
    } catch (error) {
      spinner.fail(chalk.red('Login failed'))
      handleCliError('Login failed with error', error)

      // Clean up
      if (driver) {
        try {
          await driver.close()
        } catch {
          // Ignore cleanup errors
        }
      }

      process.exit(1)
    }
  })
