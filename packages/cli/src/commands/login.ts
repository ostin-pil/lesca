import { Command } from 'commander'
import { PlaywrightDriver, AuthHelper, CookieManager, SessionManager } from '@lesca/browser-automation'
import { logger } from '@/shared/utils/src/index.js'
import { resolve } from 'path'
import { homedir } from 'os'

export const loginCommand = new Command('login')
  .description('Interactive login to LeetCode')
  .option('--save-session <name>', 'Save as named session')
  .option('--headless <boolean>', 'Run in headless mode', 'false')
  .action(async (options) => {
    const headless = options.headless === 'true'
    const sessionName = options.saveSession

    logger.info('Starting interactive login...')

    const driver = new PlaywrightDriver()
    const cookieManager = new CookieManager()
    const sessionManager = new SessionManager()
    const authHelper = new AuthHelper(driver, cookieManager)

    try {
      await driver.launch({
        headless,
        viewport: { width: 1280, height: 800 },
      })

      // If session name provided, try to restore it first
      if (sessionName) {
        const session = await sessionManager.getSession(sessionName)
        if (session) {
          logger.info(`Restoring session: ${sessionName}`)
          const context = driver.getPage()?.context()
          if (context) {
            await sessionManager.restoreSession(sessionName, context)
          }
        }
      }

      // Perform interactive login
      // We don't pass credentials here, so it will wait for manual input
      const result = await authHelper.waitForManualLogin()

      if (result.success) {
        logger.info('Login successful!')

        // Save cookies to default location
        const defaultCookiePath = resolve(homedir(), '.lesca', 'cookies.json')
        await cookieManager.saveCookies(driver, defaultCookiePath)
        logger.info(`Cookies saved to ${defaultCookiePath}`)

        // Save named session if requested
        if (sessionName) {
          const context = driver.getPage()?.context()
          if (context) {
            await sessionManager.createSession(sessionName, context, {
              description: 'Created via CLI login command',
            })
            logger.info(`Session saved: ${sessionName}`)
          }
        }
      } else {
        logger.error('Login failed or timed out.')
      }

    } catch (error) {
      logger.error('An error occurred during login', { error })
    } finally {
      await driver.close()
    }
  })
