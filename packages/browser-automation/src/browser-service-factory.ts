import { BrowserService } from './browser-service'
import type { BrowserServiceOptions, ISessionManager, ISessionPoolManager } from './interfaces'
import { SessionManager } from './session-manager'
import { SessionPoolManager } from './session-pool-manager'

/**
 * Browser Service Factory
 * Creates BrowserService instances with proper dependency injection
 */
export class BrowserServiceFactory {
  private static instance: BrowserServiceFactory
  private sessionManager: ISessionManager
  private sessionPoolManager: ISessionPoolManager

  private constructor() {
    this.sessionManager = new SessionManager()
    this.sessionPoolManager = new SessionPoolManager({
      strategy: 'per-session',
      perSessionMaxSize: 2,
      perSessionIdleTime: 180000, // 3 minutes
      acquireTimeout: 30000,
      retryOnFailure: true,
      maxRetries: 3,
    })
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BrowserServiceFactory {
    if (!BrowserServiceFactory.instance) {
      BrowserServiceFactory.instance = new BrowserServiceFactory()
    }
    return BrowserServiceFactory.instance
  }

  /**
   * Create a new BrowserService instance
   */
  createService(options: BrowserServiceOptions = {}): BrowserService {
    return new BrowserService(this.sessionManager, this.sessionPoolManager, options)
  }

  /**
   * Get the session manager instance
   */
  getSessionManager(): ISessionManager {
    return this.sessionManager
  }

  /**
   * Get the session pool manager instance
   */
  getSessionPoolManager(): ISessionPoolManager {
    return this.sessionPoolManager
  }
}
