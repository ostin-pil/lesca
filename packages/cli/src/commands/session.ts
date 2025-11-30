import { Command } from 'commander'

import { SessionManager } from '@/browser-automation/src/index'
import { logger } from '@/shared/utils/src/index'

/**
 * Session management commands
 */
export const sessionCommand = new Command('session').description('Manage browser sessions')

// List all saved sessions
sessionCommand
  .command('list')
  .description('List all saved sessions')
  .action(async () => {
    const sessionManager = new SessionManager()
    const sessions = await sessionManager.listActiveSessions()

    if (sessions.length === 0) {
      logger.info('No sessions found')
      return
    }

    logger.box('Saved Sessions')
    for (const session of sessions) {
      logger.info(
        `
📦 ${session.name}
  Created: ${new Date(session.metadata.created).toLocaleString()}
  Last Used: ${new Date(session.metadata.lastUsed).toLocaleString()}
  Cookies: ${session.cookies.length}
  ${session.metadata.description ? `Description: ${session.metadata.description}` : ''}
      `.trim()
      )
    }
  })

// Delete a session
sessionCommand
  .command('delete <name>')
  .description('Delete a session')
  .action(async (name: string) => {
    const sessionManager = new SessionManager()
    const deleted = await sessionManager.deleteSession(name)

    if (deleted) {
      logger.success(`Session "${name}" deleted`)
    } else {
      logger.warn(`Session "${name}" not found`)
    }
  })

// Rename a session
sessionCommand
  .command('rename <old> <new>')
  .description('Rename a session')
  .action(async (oldName: string, newName: string) => {
    const sessionManager = new SessionManager()

    try {
      await sessionManager.renameSession(oldName, newName)
      logger.success(`Session renamed: "${oldName}" → "${newName}"`)
    } catch (error) {
      logger.error('Failed to rename session', error instanceof Error ? error : undefined)
    }
  })

// Show session details
sessionCommand
  .command('info <name>')
  .description('Show session details')
  .action(async (name: string) => {
    const sessionManager = new SessionManager()
    const session = await sessionManager.getSession(name)

    if (!session) {
      logger.warn(`Session "${name}" not found`)
      return
    }

    logger.box(`Session: ${session.name}`)
    logger.info(
      `
Created: ${new Date(session.metadata.created).toLocaleString()}
Last Used: ${new Date(session.metadata.lastUsed).toLocaleString()}
Expires: ${session.metadata.expires ? new Date(session.metadata.expires).toLocaleString() : 'Never'}

Cookies: ${session.cookies.length}
LocalStorage Keys: ${Object.keys(session.localStorage).length}
SessionStorage Keys: ${Object.keys(session.sessionStorage).length}

${session.metadata.description ? `Description: ${session.metadata.description}` : ''}
    `.trim()
    )
  })
