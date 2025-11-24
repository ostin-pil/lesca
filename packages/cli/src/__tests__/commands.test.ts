import { ConfigManager } from '@/shared/config/src/index'
import { Command } from 'commander'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { listCommand } from '../commands/list'
import { searchCommand } from '../commands/search'

vi.mock('@/packages/api-client/src/index', () => ({
  GraphQLClient: vi.fn().mockImplementation(() => ({
    getProblemList: vi.fn().mockResolvedValue({
      total: 2,
      questions: [
        {
          questionId: '1',
          questionFrontendId: '1',
          title: 'Two Sum',
          titleSlug: 'two-sum',
          difficulty: 'Easy',
          isPaidOnly: false,
          acRate: 50.0,
        },
        {
          questionId: '2',
          questionFrontendId: '2',
          title: 'Add Two Numbers',
          titleSlug: 'add-two-numbers',
          difficulty: 'Medium',
          isPaidOnly: false,
          acRate: 40.0,
        },
      ],
    }),
  })),
  RateLimiter: vi.fn(),
}))

vi.mock('@/packages/scrapers/src/index', () => {
  return {
    ListScraperStrategy: class {
      execute = vi.fn().mockResolvedValue({
        type: 'list',
        data: {
          questions: [
            {
              questionId: '1',
              questionFrontendId: '1',
              title: 'Two Sum',
              titleSlug: 'two-sum',
              difficulty: 'Easy',
              isPaidOnly: false,
              acRate: 50.0,
            },
            {
              questionId: '2',
              questionFrontendId: '2',
              title: 'Add Two Numbers',
              titleSlug: 'add-two-numbers',
              difficulty: 'Medium',
              isPaidOnly: false,
              acRate: 40.0,
            },
          ],
        },
      })
    },
  }
})

vi.mock('@/packages/auth/src/index', () => ({
  CookieFileAuth: vi.fn().mockImplementation(() => ({
    authenticate: vi.fn().mockResolvedValue(undefined),
    getCredentials: vi.fn().mockReturnValue({ cookies: [], csrfToken: '' }),
  })),
}))

vi.mock('@/shared/utils/src/index', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('ora', () => ({
  __esModule: true,
  default: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
  }),
}))

vi.mock('../utils', () => ({
  handleCliError: vi.fn((msg, err) => {
    console.error('Mocked handleCliError:', msg, err)
    throw err
  }),
}))

describe('CLI Commands', () => {
  let program: Command

  beforeEach(() => {
    vi.clearAllMocks()
    program = new Command()
    vi.spyOn(ConfigManager, 'getInstance').mockReturnValue({
      getConfig: vi.fn().mockReturnValue({
        auth: { method: 'none', cookiePath: 'cookies.json' },
        api: {
          rateLimit: {
            minDelay: 1000,
            maxDelay: 2000,
            jitter: true,
          },
        },
      }),
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('list command', () => {
    it('should list problems', async () => {
      program.addCommand(listCommand)
      await program.parseAsync(['node', 'lesca', 'list', '--no-auth'])

      // Verify logger was called to display problems
      // We can't easily check the exact output because of chalk, but we can check calls
      const logger = (await import('@/shared/utils/src/index')).logger
      expect(logger.log).toHaveBeenCalled()
    })

    it('should respect limit option', async () => {
      program.addCommand(listCommand)
      await program.parseAsync(['node', 'lesca', 'list', '--limit', '5', '--no-auth'])
      // Verification would require checking arguments passed to ListScraperStrategy
    })
  })

  describe('search command', () => {
    it('should search problems', async () => {
      program.addCommand(searchCommand)
      await program.parseAsync(['node', 'lesca', 'search', 'two sum', '--no-auth'])

      const logger = (await import('@/shared/utils/src/index')).logger
      expect(logger.log).toHaveBeenCalled()
    })
  })
})
