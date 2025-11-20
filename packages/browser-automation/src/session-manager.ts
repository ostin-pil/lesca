import { mkdir, readFile, writeFile, readdir, rm, access } from 'fs/promises'
import { homedir } from 'os'
import { resolve, join } from 'path'

import { logger } from '@/shared/utils/src/index.js'
import { BrowserError } from '@lesca/error'
import type { BrowserContext, Cookie } from 'playwright'

/**
 * Session storage data structure
 */
export interface SessionData {
  name: string
  cookies: Cookie[]
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  metadata: SessionMetadata
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  created: number
  lastUsed: number
  expires?: number
  userAgent?: string
  description?: string
}

/**
 * Session options for creation
 */
export interface SessionOptions {
  expires?: number // Timestamp when session expires
  description?: string
  userAgent?: string
}

/**
 * Session Manager
 * Manages persistent browser sessions across scraping operations
 */
export class SessionManager {
  private sessionsDir: string

  constructor(baseDir?: string) {
    this.sessionsDir = baseDir || resolve(homedir(), '.lesca', 'sessions')
  }

  /**
   * Initialize sessions directory
   */
  private async ensureSessionsDir(): Promise<void> {
    try {
      await access(this.sessionsDir)
    } catch {
      await mkdir(this.sessionsDir, { recursive: true })
      logger.debug(`Created sessions directory: ${this.sessionsDir}`)
    }
  }

  /**
   * Get session file path
   */
  private getSessionPath(name: string): string {
    // Sanitize session name to prevent directory traversal
    const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '_')
    return join(this.sessionsDir, `${sanitizedName}.json`)
  }

  /**
   * Create a new session from browser context
   */
  async createSession(
    name: string,
    context: BrowserContext,
    options?: SessionOptions
  ): Promise<SessionData> {
    await this.ensureSessionsDir()

    // Extract session data from browser context
    const cookies = await context.cookies()

    // Get localStorage and sessionStorage from all pages
    const pages = context.pages()
    const localStorage: Record<string, string> = {}
    const sessionStorage: Record<string, string> = {}

    if (pages.length > 0) {
      const page = pages[0]
      if (!page) {
        logger.warn('No page available for storage extraction')
      } else {
        // Extract localStorage
        try {
          const localStorageData = await page.evaluate(() => {
          const data: Record<string, string> = {}
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i)
            if (key) {
              data[key] = window.localStorage.getItem(key) || ''
            }
          }
          return data
        })
          Object.assign(localStorage, localStorageData)
        } catch (error) {
          logger.warn('Failed to extract localStorage', { error })
        }

        // Extract sessionStorage
        try {
          const sessionStorageData = await page.evaluate(() => {
          const data: Record<string, string> = {}
          for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i)
            if (key) {
              data[key] = window.sessionStorage.getItem(key) || ''
            }
          }
          return data
        })
          Object.assign(sessionStorage, sessionStorageData)
        } catch (error) {
          logger.warn('Failed to extract sessionStorage', { error })
        }
      }
    }

    const now = Date.now()
    const sessionData: SessionData = {
      name,
      cookies,
      localStorage,
      sessionStorage,
      metadata: {
        created: now,
        lastUsed: now,
        ...(options?.expires !== undefined && { expires: options.expires }),
        ...(options?.userAgent !== undefined && { userAgent: options.userAgent }),
        ...(options?.description !== undefined && { description: options.description }),
      },
    }

    await this.saveSession(name, sessionData)
    logger.info(`Created session: ${name}`)

    return sessionData
  }

  /**
   * Get an existing session
   */
  async getSession(name: string): Promise<SessionData | null> {
    try {
      const sessionPath = this.getSessionPath(name)
      const data = await readFile(sessionPath, 'utf-8')
      const sessionData = JSON.parse(data) as SessionData

      // Check if session has expired
      if (sessionData.metadata.expires && Date.now() > sessionData.metadata.expires) {
        logger.warn(`Session expired: ${name}`)
        await this.deleteSession(name)
        return null
      }

      // Update last used timestamp
      sessionData.metadata.lastUsed = Date.now()
      await this.saveSession(name, sessionData)

      logger.debug(`Retrieved session: ${name}`)
      return sessionData
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug(`Session not found: ${name}`)
        return null
      }
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        `Failed to get session: ${name}`,
        { cause: error as Error, context: { name } }
      )
    }
  }

  /**
   * Save session data to disk
   */
  async saveSession(name: string, sessionData: SessionData): Promise<void> {
    await this.ensureSessionsDir()

    const sessionPath = this.getSessionPath(name)
    const data = JSON.stringify(sessionData, null, 2)

    try {
      await writeFile(sessionPath, data, 'utf-8')
      logger.debug(`Saved session: ${name} to ${sessionPath}`)
    } catch (error) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        `Failed to save session: ${name}`,
        { cause: error as Error, context: { name, path: sessionPath } }
      )
    }
  }

  /**
   * Restore session to browser context
   */
  async restoreSession(name: string, context: BrowserContext): Promise<boolean> {
    const sessionData = await this.getSession(name)
    if (!sessionData) {
      return false
    }

    // Restore cookies
    await context.addCookies(sessionData.cookies)

    // Restore localStorage and sessionStorage
    const pages = context.pages()
    if (pages.length > 0) {
      const page = pages[0]
      if (!page) {
        logger.warn('No page available for storage restoration')
      } else {
        // Restore localStorage
        if (Object.keys(sessionData.localStorage).length > 0) {
          try {
            await page.evaluate((data) => {
            for (const [key, value] of Object.entries(data)) {
              window.localStorage.setItem(key, value)
            }
            }, sessionData.localStorage)
          } catch (error) {
            logger.warn('Failed to restore localStorage', { error })
          }
        }

        // Restore sessionStorage
        if (Object.keys(sessionData.sessionStorage).length > 0) {
          try {
            await page.evaluate((data) => {
            for (const [key, value] of Object.entries(data)) {
              window.sessionStorage.setItem(key, value)
            }
            }, sessionData.sessionStorage)
          } catch (error) {
            logger.warn('Failed to restore sessionStorage', { error })
          }
        }
      }
    }

    logger.info(`Restored session: ${name}`)
    return true
  }

  /**
   * List all saved sessions
   */
  async listSessions(): Promise<SessionData[]> {
    await this.ensureSessionsDir()

    try {
      const files = await readdir(this.sessionsDir)
      const sessionFiles = files.filter((file) => file.endsWith('.json'))

      const sessions: SessionData[] = []
      for (const file of sessionFiles) {
        try {
          const sessionPath = join(this.sessionsDir, file)
          const data = await readFile(sessionPath, 'utf-8')
          const sessionData = JSON.parse(data) as SessionData

          // Filter out expired sessions
          if (!sessionData.metadata.expires || Date.now() <= sessionData.metadata.expires) {
            sessions.push(sessionData)
          } else {
            // Clean up expired session
            await rm(sessionPath)
          }
        } catch (error) {
          logger.warn(`Failed to read session file: ${file}`, { error })
        }
      }

      return sessions
    } catch (error) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Failed to list sessions',
        { cause: error as Error }
      )
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(name: string): Promise<boolean> {
    const sessionPath = this.getSessionPath(name)

    try {
      await rm(sessionPath)
      logger.info(`Deleted session: ${name}`)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug(`Session not found for deletion: ${name}`)
        return false
      }
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        `Failed to delete session: ${name}`,
        { cause: error as Error, context: { name } }
      )
    }
  }

  /**
   * Check if session exists
   */
  async sessionExists(name: string): Promise<boolean> {
    const sessionPath = this.getSessionPath(name)
    try {
      await access(sessionPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    await this.ensureSessionsDir()
    let cleanedCount = 0

    try {
      const files = await readdir(this.sessionsDir)
      const sessionFiles = files.filter((file) => file.endsWith('.json'))

      for (const file of sessionFiles) {
        try {
          const sessionPath = join(this.sessionsDir, file)
          const data = await readFile(sessionPath, 'utf-8')
          const sessionData = JSON.parse(data) as SessionData

          // Check if session is expired
          if (sessionData.metadata.expires && Date.now() > sessionData.metadata.expires) {
            await this.deleteSession(sessionData.name)
            cleanedCount++
          }
        } catch (error) {
          logger.warn(`Failed to process session file during cleanup: ${file}`, { error })
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired sessions`)
      }

      return cleanedCount
    } catch (error) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Failed to cleanup expired sessions',
        { cause: error as Error }
      )
    }
  }
}
