import { describe, it, expect } from 'vitest'
import {
  SelectorManager,
  DEFAULT_SELECTORS,
  type SelectorGroup,
  type LeetCodeSelectors,
} from '../selector-manager'

describe('SelectorManager', () => {
  describe('constructor', () => {
    it('should initialize with default selectors', () => {
      const manager = new SelectorManager()
      const selectors = manager.getAllSelectors()

      expect(selectors.problem).toBeDefined()
      expect(selectors.editorial).toBeDefined()
      expect(selectors.discussion).toBeDefined()
      expect(selectors.auth).toBeDefined()
      expect(selectors.common).toBeDefined()
    })

    it('should merge custom selectors with defaults', () => {
      const customSelectors: Partial<LeetCodeSelectors> = {
        problem: {
          ...DEFAULT_SELECTORS.problem,
          title: {
            primary: '.custom-title',
            fallbacks: ['.backup-title'],
            description: 'Custom title selector',
          },
        },
      }

      const manager = new SelectorManager(customSelectors)
      const selectors = manager.getProblemSelectors()

      expect(selectors.title.primary).toBe('.custom-title')
      expect(selectors.title.fallbacks).toContain('.backup-title')
      // Other selectors should still be defaults
      expect(selectors.description.primary).toBe(DEFAULT_SELECTORS.problem.description.primary)
    })

    it('should handle undefined custom selectors', () => {
      const manager = new SelectorManager(undefined)
      const selectors = manager.getAllSelectors()

      expect(selectors).toEqual(DEFAULT_SELECTORS)
    })
  })

  describe('getAll', () => {
    it('should return primary and fallback selectors', () => {
      const manager = new SelectorManager()
      const group: SelectorGroup = {
        primary: '.main',
        fallbacks: ['.backup1', '.backup2'],
      }

      const all = manager.getAll(group)

      expect(all).toHaveLength(3)
      expect(all[0]).toBe('.main')
      expect(all[1]).toBe('.backup1')
      expect(all[2]).toBe('.backup2')
    })

    it('should return only primary when no fallbacks', () => {
      const manager = new SelectorManager()
      const group: SelectorGroup = {
        primary: '.only-primary',
      }

      const all = manager.getAll(group)

      expect(all).toHaveLength(1)
      expect(all[0]).toBe('.only-primary')
    })

    it('should handle empty fallbacks array', () => {
      const manager = new SelectorManager()
      const group: SelectorGroup = {
        primary: '.main',
        fallbacks: [],
      }

      const all = manager.getAll(group)

      expect(all).toHaveLength(1)
      expect(all[0]).toBe('.main')
    })
  })

  describe('getPrimary', () => {
    it('should return primary selector only', () => {
      const manager = new SelectorManager()
      const group: SelectorGroup = {
        primary: '.primary-only',
        fallbacks: ['.fallback1', '.fallback2'],
      }

      const primary = manager.getPrimary(group)

      expect(primary).toBe('.primary-only')
    })
  })

  describe('getProblemSelectors', () => {
    it('should return problem-related selectors', () => {
      const manager = new SelectorManager()
      const selectors = manager.getProblemSelectors()

      expect(selectors.title).toBeDefined()
      expect(selectors.description).toBeDefined()
      expect(selectors.difficulty).toBeDefined()
      expect(selectors.tags).toBeDefined()
      expect(selectors.codeEditor).toBeDefined()
      expect(selectors.testCases).toBeDefined()
      expect(selectors.constraints).toBeDefined()
      expect(selectors.examples).toBeDefined()
    })

    it('should have valid primary selectors for problem elements', () => {
      const manager = new SelectorManager()
      const selectors = manager.getProblemSelectors()

      expect(selectors.title.primary).toBe('[data-cy="question-title"]')
      expect(selectors.difficulty.primary).toBe('[diff]')
      expect(selectors.tags.primary).toBe('[data-cy="topic-tag"]')
    })
  })

  describe('getEditorialSelectors', () => {
    it('should return editorial-related selectors', () => {
      const manager = new SelectorManager()
      const selectors = manager.getEditorialSelectors()

      expect(selectors.container).toBeDefined()
      expect(selectors.content).toBeDefined()
      expect(selectors.approach).toBeDefined()
      expect(selectors.complexity).toBeDefined()
      expect(selectors.code).toBeDefined()
      expect(selectors.premiumBanner).toBeDefined()
    })

    it('should have valid primary selectors for editorial elements', () => {
      const manager = new SelectorManager()
      const selectors = manager.getEditorialSelectors()

      expect(selectors.container.primary).toBe('[data-track-load="solution_article"]')
      expect(selectors.premiumBanner.primary).toBe('[data-cy="premium-banner"]')
    })
  })

  describe('getDiscussionSelectors', () => {
    it('should return discussion-related selectors', () => {
      const manager = new SelectorManager()
      const selectors = manager.getDiscussionSelectors()

      expect(selectors.list).toBeDefined()
      expect(selectors.post).toBeDefined()
      expect(selectors.title).toBeDefined()
      expect(selectors.content).toBeDefined()
      expect(selectors.author).toBeDefined()
      expect(selectors.votes).toBeDefined()
      expect(selectors.timestamp).toBeDefined()
      expect(selectors.comments).toBeDefined()
    })

    it('should have valid primary selectors for discussion elements', () => {
      const manager = new SelectorManager()
      const selectors = manager.getDiscussionSelectors()

      expect(selectors.list.primary).toBe('[data-cy="discussion-list"]')
      expect(selectors.post.primary).toBe('[data-cy="discussion-post"]')
    })
  })

  describe('getAuthSelectors', () => {
    it('should return auth-related selectors', () => {
      const manager = new SelectorManager()
      const selectors = manager.getAuthSelectors()

      expect(selectors.loginButton).toBeDefined()
      expect(selectors.userMenu).toBeDefined()
      expect(selectors.premiumBadge).toBeDefined()
    })

    it('should have valid primary selectors for auth elements', () => {
      const manager = new SelectorManager()
      const selectors = manager.getAuthSelectors()

      expect(selectors.loginButton.primary).toBe('[data-cy="sign-in-btn"]')
      expect(selectors.userMenu.primary).toBe('[data-cy="user-menu"]')
    })
  })

  describe('getCommonSelectors', () => {
    it('should return common UI selectors', () => {
      const manager = new SelectorManager()
      const selectors = manager.getCommonSelectors()

      expect(selectors.loadingSpinner).toBeDefined()
      expect(selectors.errorMessage).toBeDefined()
      expect(selectors.notFound).toBeDefined()
    })

    it('should have valid primary selectors for common elements', () => {
      const manager = new SelectorManager()
      const selectors = manager.getCommonSelectors()

      expect(selectors.loadingSpinner.primary).toBe('[data-cy="loading"]')
      expect(selectors.errorMessage.primary).toBe('[data-cy="error-message"]')
    })
  })

  describe('getAllSelectors', () => {
    it('should return complete selector configuration', () => {
      const manager = new SelectorManager()
      const selectors = manager.getAllSelectors()

      expect(Object.keys(selectors)).toHaveLength(5)
      expect(selectors.problem).toBeDefined()
      expect(selectors.editorial).toBeDefined()
      expect(selectors.discussion).toBeDefined()
      expect(selectors.auth).toBeDefined()
      expect(selectors.common).toBeDefined()
    })
  })

  describe('updateSelectors', () => {
    it('should update selectors at runtime', () => {
      const manager = new SelectorManager()

      manager.updateSelectors({
        problem: {
          ...DEFAULT_SELECTORS.problem,
          title: {
            primary: '.updated-title',
            fallbacks: [],
          },
        },
      })

      const selectors = manager.getProblemSelectors()
      expect(selectors.title.primary).toBe('.updated-title')
    })

    it('should preserve other selectors when updating', () => {
      const manager = new SelectorManager()
      const originalAuth = manager.getAuthSelectors()

      manager.updateSelectors({
        problem: {
          ...DEFAULT_SELECTORS.problem,
          title: { primary: '.new-title' },
        },
      })

      // Auth selectors should be unchanged
      expect(manager.getAuthSelectors().loginButton.primary).toBe(originalAuth.loginButton.primary)
    })

    it('should handle empty update', () => {
      const manager = new SelectorManager()
      const originalSelectors = manager.getAllSelectors()

      manager.updateSelectors({})

      expect(manager.getAllSelectors()).toEqual(originalSelectors)
    })
  })

  describe('toLocatorString', () => {
    it('should create comma-separated selector string', () => {
      const manager = new SelectorManager()
      const group: SelectorGroup = {
        primary: '.main',
        fallbacks: ['.backup1', '.backup2'],
      }

      const locatorString = manager.toLocatorString(group)

      expect(locatorString).toBe('.main, .backup1, .backup2')
    })

    it('should return primary only when no fallbacks', () => {
      const manager = new SelectorManager()
      const group: SelectorGroup = {
        primary: '.only-primary',
      }

      const locatorString = manager.toLocatorString(group)

      expect(locatorString).toBe('.only-primary')
    })

    it('should work with real selector groups', () => {
      const manager = new SelectorManager()
      const titleSelector = manager.getProblemSelectors().title
      const locatorString = manager.toLocatorString(titleSelector)

      expect(locatorString).toContain('[data-cy="question-title"]')
      expect(locatorString.split(', ').length).toBeGreaterThan(1)
    })
  })

  describe('isValid', () => {
    it('should return true for valid selector group', () => {
      const manager = new SelectorManager()
      const group: SelectorGroup = {
        primary: '.valid-selector',
      }

      expect(manager.isValid(group)).toBe(true)
    })

    it('should return false for empty primary selector', () => {
      const manager = new SelectorManager()
      const group: SelectorGroup = {
        primary: '',
      }

      expect(manager.isValid(group)).toBe(false)
    })

    it('should validate all default selectors', () => {
      const manager = new SelectorManager()
      const problemSelectors = manager.getProblemSelectors()

      expect(manager.isValid(problemSelectors.title)).toBe(true)
      expect(manager.isValid(problemSelectors.description)).toBe(true)
      expect(manager.isValid(problemSelectors.difficulty)).toBe(true)
    })
  })
})

describe('DEFAULT_SELECTORS', () => {
  it('should have problem selectors with fallbacks', () => {
    expect(DEFAULT_SELECTORS.problem.title.fallbacks).toBeDefined()
    expect(DEFAULT_SELECTORS.problem.title.fallbacks?.length).toBeGreaterThan(0)
  })

  it('should have editorial selectors with fallbacks', () => {
    expect(DEFAULT_SELECTORS.editorial.container.fallbacks).toBeDefined()
    expect(DEFAULT_SELECTORS.editorial.container.fallbacks?.length).toBeGreaterThan(0)
  })

  it('should have discussion selectors with fallbacks', () => {
    expect(DEFAULT_SELECTORS.discussion.list.fallbacks).toBeDefined()
    expect(DEFAULT_SELECTORS.discussion.list.fallbacks?.length).toBeGreaterThan(0)
  })

  it('should have descriptions for all problem selectors', () => {
    const problem = DEFAULT_SELECTORS.problem
    expect(problem.title.description).toBe('Problem title')
    expect(problem.description.description).toBe('Problem description')
    expect(problem.difficulty.description).toBe('Difficulty level')
  })

  it('should have descriptions for auth selectors', () => {
    const auth = DEFAULT_SELECTORS.auth
    expect(auth.loginButton.description).toBe('Login button')
    expect(auth.userMenu.description).toBe('User menu dropdown')
  })
})
