import { mkdir, readFile, writeFile, readdir, rm, access, rename, copyFile } from 'fs/promises'
import { homedir } from 'os'
import { resolve, join } from 'path'

import { BrowserError } from '@lesca/error'
import { logger } from '@lesca/shared/utils'
import type { BrowserContext, Cookie } from 'playwright'

import type { ISessionManager, SessionData, SessionOptions } from './interfaces'

/**
 * Session Manager
 * Manages persistent browser sessions across scraping operations
 */
export class SessionManager implements ISessionManager {
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
    return await this.loadSession(name)
  }

  /**
   * Load session with corruption handling
   */
  private async loadSession(name: string): Promise<SessionData | null> {
    const sessionPath = this.getSessionPath(name)

    try {
      const data = await readFile(sessionPath, 'utf-8')
      const sessionData = JSON.parse(data) as SessionData

      // Validate schema
      if (!sessionData.name || !Array.isArray(sessionData.cookies)) {
        logger.warn(`Session "${name}" has invalid format, backing up and ignoring`)
        await this.backupCorruptedSession(name)
        return null
      }

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

      // Corrupted file (JSON parse error)
      logger.error(`Session "${name}" is corrupted`, error as Error)
      await this.backupCorruptedSession(name)
      return null
    }
  }

  /**
   * Backup corrupted session file
   */
  private async backupCorruptedSession(name: string): Promise<void> {
    const sessionPath = this.getSessionPath(name)
    const backupPath = `${sessionPath}.bak.${Date.now()}`

    try {
      await copyFile(sessionPath, backupPath)
      logger.info(`Backed up corrupted session to ${backupPath}`)
    } catch (error) {
      logger.error('Failed to backup corrupted session', error as Error)
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
      throw new BrowserError('BROWSER_LAUNCH_FAILED', `Failed to save session: ${name}`, {
        cause: error as Error,
        context: { name, path: sessionPath },
      })
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
      throw new BrowserError('BROWSER_LAUNCH_FAILED', 'Failed to list sessions', {
        cause: error as Error,
      })
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
      throw new BrowserError('BROWSER_LAUNCH_FAILED', `Failed to delete session: ${name}`, {
        cause: error as Error,
        context: { name },
      })
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
   * Rename session file
   */
  async renameSession(oldName: string, newName: string): Promise<void> {
    const oldPath = this.getSessionPath(oldName)
    const newPath = this.getSessionPath(newName)

    // Check if old session exists
    if (!(await this.sessionExists(oldName))) {
      throw new BrowserError('BROWSER_SESSION_NOT_FOUND', `Session "${oldName}" not found`, {
        context: { sessionName: oldName },
      })
    }

    // Check if new name already exists
    if (await this.sessionExists(newName)) {
      throw new BrowserError('BROWSER_LAUNCH_FAILED', `Session "${newName}" already exists`, {
        context: { sessionName: newName },
      })
    }

    try {
      // Load the session data
      const sessionData = await this.loadSession(oldName)
      if (!sessionData) {
        throw new Error('Session data not found')
      }

      // Update the name field
      sessionData.name = newName

      // Rename the file
      await rename(oldPath, newPath)

      // Save with updated name
      await this.saveSession(newName, sessionData)

      logger.info(`Session renamed: "${oldName}" -> "${newName}"`)
    } catch (error) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        `Failed to rename session: ${oldName} to ${newName}`,
        { cause: error as Error, context: { oldName, newName } }
      )
    }
  }

  /**
   * List all active (non-expired) sessions
   */
  async listActiveSessions(): Promise<SessionData[]> {
    const sessions: SessionData[] = []

    await this.ensureSessionsDir()

    try {
      const files = await readdir(this.sessionsDir)

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const name = file.replace('.json', '')
        const session = await this.loadSession(name)

        if (session && !this.isExpired(session)) {
          sessions.push(session)
        }
      }

      return sessions.sort((a, b) => b.metadata.lastUsed - a.metadata.lastUsed)
    } catch (error) {
      throw new BrowserError('BROWSER_LAUNCH_FAILED', 'Failed to list active sessions', {
        cause: error as Error,
      })
    }
  }

  /**
   * Check if session is expired
   */
  private isExpired(session: SessionData): boolean {
    return !!(session.metadata.expires && Date.now() > session.metadata.expires)
  }

  /**
   * Validate session before use
   */
  async validateSession(name: string): Promise<boolean> {
    const session = await this.getSession(name)
    if (!session) {
      return false
    }

    // Check if expired
    if (this.isExpired(session)) {
      await this.deleteSession(name)
      return false
    }

    // Check if cookies are valid
    if (!Array.isArray(session.cookies) || session.cookies.length === 0) {
      logger.warn(`Session "${name}" has no cookies`)
      return false
    }

    // Check if session data is complete
    if (!session.metadata) {
      logger.warn(`Session "${name}" is missing metadata`)
      return false
    }

    logger.debug(`Session "${name}" is valid`)
    return true
  }

  /**
   * Merge multiple sessions into a target session
   */
  async mergeSessions(
    sourceNames: string[],
    targetName: string,
    strategy: 'keep-existing' | 'prefer-fresh' | 'merge-all' = 'merge-all'
  ): Promise<SessionData> {
    await this.ensureSessionsDir()

    // Load all source sessions
    const sourceSessions: SessionData[] = []
    for (const sourceName of sourceNames) {
      const session = await this.getSession(sourceName)
      if (session) {
        sourceSessions.push(session)
      } else {
        logger.warn(`Source session not found: ${sourceName}`)
      }
    }

    if (sourceSessions.length === 0) {
      throw new BrowserError(
        'BROWSER_SESSION_NOT_FOUND',
        'No valid source sessions found to merge',
        { context: { sourceNames } }
      )
    }

    // Load or create target session
    const targetSession = await this.getSession(targetName)
    const cookieMap = new Map<string, Cookie>()
    const localStorageMap = new Map<string, string>()
    const sessionStorageMap = new Map<string, string>()

    // Apply merge strategy
    if (targetSession && strategy === 'keep-existing') {
      // Keep existing target data, only add new keys from sources
      targetSession.cookies.forEach((cookie) => cookieMap.set(cookie.name, cookie))
      Object.entries(targetSession.localStorage).forEach(([k, v]) => localStorageMap.set(k, v))
      Object.entries(targetSession.sessionStorage).forEach(([k, v]) => sessionStorageMap.set(k, v))

      sourceSessions.forEach((session) => {
        session.cookies.forEach((cookie) => {
          if (!cookieMap.has(cookie.name)) {
            cookieMap.set(cookie.name, cookie)
          }
        })
        Object.entries(session.localStorage).forEach(([k, v]) => {
          if (!localStorageMap.has(k)) {
            localStorageMap.set(k, v)
          }
        })
        Object.entries(session.sessionStorage).forEach(([k, v]) => {
          if (!sessionStorageMap.has(k)) {
            sessionStorageMap.set(k, v)
          }
        })
      })
    } else if (strategy === 'prefer-fresh') {
      // Sort by lastUsed, prefer newer data
      const allSessions = targetSession ? [targetSession, ...sourceSessions] : sourceSessions
      const sortedSessions = allSessions.sort((a, b) => b.metadata.lastUsed - a.metadata.lastUsed)

      sortedSessions.reverse().forEach((session) => {
        session.cookies.forEach((cookie) => cookieMap.set(cookie.name, cookie))
        Object.entries(session.localStorage).forEach(([k, v]) => localStorageMap.set(k, v))
        Object.entries(session.sessionStorage).forEach(([k, v]) => sessionStorageMap.set(k, v))
      })
    } else {
      // merge-all: combine all data, last one wins on conflicts
      const allSessions = targetSession ? [targetSession, ...sourceSessions] : sourceSessions

      allSessions.forEach((session) => {
        session.cookies.forEach((cookie) => cookieMap.set(cookie.name, cookie))
        Object.entries(session.localStorage).forEach(([k, v]) => localStorageMap.set(k, v))
        Object.entries(session.sessionStorage).forEach(([k, v]) => sessionStorageMap.set(k, v))
      })
    }

    // Create merged session
    const mergedSession: SessionData = {
      name: targetName,
      cookies: Array.from(cookieMap.values()),
      localStorage: Object.fromEntries(localStorageMap),
      sessionStorage: Object.fromEntries(sessionStorageMap),
      metadata: {
        created: targetSession?.metadata.created ?? Date.now(),
        lastUsed: Date.now(),
        description: `Merged from: ${sourceNames.join(', ')}`,
      },
    }

    await this.saveSession(targetName, mergedSession)
    logger.info(`Merged ${sourceSessions.length} sessions into "${targetName}" using ${strategy}`)

    return mergedSession
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
      throw new BrowserError('BROWSER_LAUNCH_FAILED', 'Failed to cleanup expired sessions', {
        cause: error as Error,
      })
    }
  }
}
