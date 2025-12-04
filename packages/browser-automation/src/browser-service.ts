import { BrowserError } from '@lesca/error'
import type { BrowserDriver, BrowserLaunchOptions } from '@lesca/shared/types'
import { logger } from '@lesca/shared/utils'

import type {
  BrowserServiceOptions,
  IBrowserService,
  ISessionManager,
  ISessionPoolManager,
} from './interfaces'
import { PlaywrightDriver } from './playwright-driver'

/**
 * Browser Service
 * Orchestrates browser session, pooling, and driver lifecycle
 */
export class BrowserService implements IBrowserService {
  private driver?: PlaywrightDriver
  private isRunning = false

  constructor(
    private sessionManager: ISessionManager,
    private sessionPoolManager: ISessionPoolManager,
    private options: BrowserServiceOptions = {}
  ) {}

  /**
   * Get the underlying browser driver
   */
  getDriver(): BrowserDriver {
    if (!this.driver) {
      throw new BrowserError('BROWSER_LAUNCH_FAILED', 'Browser service not started')
    }
    return this.driver
  }

  /**
   * Start the browser service
   */
  async startup(launchOptions: BrowserLaunchOptions = {}): Promise<void> {
    if (this.isRunning) {
      return
    }

    try {
      const { sessionName, autoRestore, auth } = this.options

      // Initialize driver with session pool manager if session is provided
      this.driver = new PlaywrightDriver(
        auth ? { cookies: [], csrfToken: '' } : undefined, // Auth cookies handled by session or injected later
        sessionName ? this.sessionPoolManager : undefined,
        sessionName
      )

      // Launch browser
      await this.driver.launch(launchOptions)

      // Restore session if requested
      if (sessionName && autoRestore) {
        const context = this.driver.getBrowser()?.contexts()[0]
        if (context) {
          const restored = await this.sessionManager.restoreSession(sessionName, context)
          if (restored) {
            logger.info(`Restored session: ${sessionName}`)
          } else {
            logger.debug(`No session found to restore: ${sessionName}`)
          }
        }
      }

      // Inject auth if provided (and not already restored)
      // Note: PlaywrightDriver handles auth injection if provided in constructor,
      // but we might want to handle it here for more control or if session restore failed.
      // For now, we rely on PlaywrightDriver's auth handling or session restore.

      this.isRunning = true
      logger.debug('Browser service started', { sessionName, pooling: !!sessionName })
    } catch (error) {
      throw new BrowserError('BROWSER_LAUNCH_FAILED', 'Failed to start browser service', {
        cause: error as Error,
      })
    }
  }

  /**
   * Shutdown the browser service
   */
  async shutdown(): Promise<void> {
    if (!this.isRunning || !this.driver) {
      return
    }

    try {
      const { sessionName, persistOnShutdown } = this.options

      // Persist session if requested
      if (sessionName && persistOnShutdown) {
        const context = this.driver.getBrowser()?.contexts()[0]
        if (context) {
          await this.sessionManager.createSession(sessionName, context, {
            description: 'Persisted on shutdown',
          })
          logger.info(`Persisted session: ${sessionName}`)
        }
      }

      // Close driver
      await this.driver.close()
      this.isRunning = false
      delete this.driver

      logger.debug('Browser service shutdown')
    } catch (error) {
      logger.error('Error during browser service shutdown', error as Error)
    }
  }

  /**
   * Get current session name
   */
  getSessionName(): string | undefined {
    return this.options.sessionName
  }

  /**
   * Check if pooling is enabled
   */
  isPoolingEnabled(): boolean {
    return !!this.options.sessionName
  }
}
