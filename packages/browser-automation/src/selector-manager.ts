/**
 * Selector Manager
 * Manages CSS selectors for different LeetCode UI elements
 * Supports fallback selectors for robustness
 */

export interface SelectorGroup {
  /** Primary selector to try first */
  primary: string
  /** Fallback selectors if primary fails */
  fallbacks?: string[]
  /** Description of what this selector targets */
  description?: string
}

export interface LeetCodeSelectors {
  /** Problem page selectors */
  problem: {
    title: SelectorGroup
    description: SelectorGroup
    difficulty: SelectorGroup
    tags: SelectorGroup
    codeEditor: SelectorGroup
    testCases: SelectorGroup
    constraints: SelectorGroup
    examples: SelectorGroup
  }

  /** Editorial/solution selectors */
  editorial: {
    container: SelectorGroup
    content: SelectorGroup
    approach: SelectorGroup
    complexity: SelectorGroup
    code: SelectorGroup
    premiumBanner: SelectorGroup
  }

  /** Discussion selectors */
  discussion: {
    list: SelectorGroup
    post: SelectorGroup
    title: SelectorGroup
    content: SelectorGroup
    author: SelectorGroup
    votes: SelectorGroup
    timestamp: SelectorGroup
    comments: SelectorGroup
  }

  /** Authentication/session selectors */
  auth: {
    loginButton: SelectorGroup
    userMenu: SelectorGroup
    premiumBadge: SelectorGroup
  }

  /** Common UI elements */
  common: {
    loadingSpinner: SelectorGroup
    errorMessage: SelectorGroup
    notFound: SelectorGroup
  }
}

/**
 * Default LeetCode selectors
 * Based on LeetCode's UI as of 2024
 */
export const DEFAULT_SELECTORS: LeetCodeSelectors = {
  problem: {
    title: {
      primary: '[data-cy="question-title"]',
      fallbacks: ['h1.text-title-large', 'div[class*="question-title"]', 'h1'],
      description: 'Problem title',
    },
    description: {
      primary: '[data-track-load="description_content"]',
      fallbacks: [
        'div[class*="question-content"]',
        'div[class*="description"]',
        'div.content__u3I1',
      ],
      description: 'Problem description',
    },
    difficulty: {
      primary: '[diff]',
      fallbacks: ['div[class*="difficulty"]', 'span[class*="difficulty"]', 'div[data-difficulty]'],
      description: 'Difficulty level',
    },
    tags: {
      primary: '[data-cy="topic-tag"]',
      fallbacks: ['a[class*="topic-tag"]', 'div[class*="tag"] a', '.topic-tag'],
      description: 'Topic tags',
    },
    codeEditor: {
      primary: '[data-track-load="qd_code_editor"]',
      fallbacks: ['div.monaco-editor', 'div[class*="code-editor"]', 'div.CodeMirror'],
      description: 'Code editor area',
    },
    testCases: {
      primary: '[data-track-load="testcase"]',
      fallbacks: ['div[class*="testcase"]', 'div[class*="example"]'],
      description: 'Test cases/examples',
    },
    constraints: {
      primary: '[data-track-load="constraints"]',
      fallbacks: ['div[class*="constraint"]', 'div:has(> strong:contains("Constraint"))'],
      description: 'Problem constraints',
    },
    examples: {
      primary: '[data-track-load="example"]',
      fallbacks: ['div[class*="example"]', 'div:has(> strong:contains("Example"))'],
      description: 'Problem examples',
    },
  },

  editorial: {
    container: {
      primary: '[data-track-load="solution_article"]',
      fallbacks: [
        'div[class*="solution-article"]',
        'div[class*="editorial"]',
        'article[class*="solution"]',
      ],
      description: 'Editorial container',
    },
    content: {
      primary: 'div[class*="solution-content"]',
      fallbacks: ['div[class*="article-content"]', 'div.content'],
      description: 'Editorial content',
    },
    approach: {
      primary: 'div[class*="approach"]',
      fallbacks: ['section[class*="approach"]', 'div:has(> h2:contains("Approach"))'],
      description: 'Solution approach',
    },
    complexity: {
      primary: 'div[class*="complexity"]',
      fallbacks: [
        'div:has(> strong:contains("Complexity"))',
        'div:has(> strong:contains("Time Complexity"))',
      ],
      description: 'Time/space complexity',
    },
    code: {
      primary: 'div[class*="solution"] pre code',
      fallbacks: ['pre code', 'div.highlight pre', 'div[class*="code-block"] pre'],
      description: 'Solution code blocks',
    },
    premiumBanner: {
      primary: '[data-cy="premium-banner"]',
      fallbacks: ['div[class*="premium"]', 'div:contains("Premium")', 'div[class*="subscription"]'],
      description: 'Premium content banner',
    },
  },

  discussion: {
    list: {
      primary: '[data-cy="discussion-list"]',
      fallbacks: ['div[class*="discussion-list"]', 'div[class*="topic-list"]'],
      description: 'Discussion list container',
    },
    post: {
      primary: '[data-cy="discussion-post"]',
      fallbacks: [
        'div[class*="discussion-post"]',
        'div[class*="topic-item"]',
        'article[class*="post"]',
      ],
      description: 'Individual discussion post',
    },
    title: {
      primary: '[data-cy="discussion-title"]',
      fallbacks: ['a[class*="discussion-title"]', 'h3 a', 'div[class*="title"] a'],
      description: 'Discussion title',
    },
    content: {
      primary: '[data-cy="discussion-content"]',
      fallbacks: ['div[class*="discussion-content"]', 'div[class*="post-content"]', 'div.content'],
      description: 'Discussion content',
    },
    author: {
      primary: '[data-cy="discussion-author"]',
      fallbacks: ['a[class*="username"]', 'span[class*="author"]', 'div[class*="author"] a'],
      description: 'Discussion author',
    },
    votes: {
      primary: '[data-cy="discussion-votes"]',
      fallbacks: ['span[class*="vote"]', 'div[class*="vote-count"]', 'span[class*="score"]'],
      description: 'Discussion votes/score',
    },
    timestamp: {
      primary: '[data-cy="discussion-time"]',
      fallbacks: ['time', 'span[class*="timestamp"]', 'span[class*="time"]'],
      description: 'Discussion timestamp',
    },
    comments: {
      primary: '[data-cy="discussion-comments"]',
      fallbacks: ['div[class*="comments"]', 'div[class*="replies"]', 'div[class*="comment-list"]'],
      description: 'Discussion comments',
    },
  },

  auth: {
    loginButton: {
      primary: '[data-cy="sign-in-btn"]',
      fallbacks: ['a:contains("Sign In")', 'button:contains("Sign In")'],
      description: 'Login button',
    },
    userMenu: {
      primary: '[data-cy="user-menu"]',
      fallbacks: ['div[class*="user-menu"]', 'div[class*="avatar"]'],
      description: 'User menu dropdown',
    },
    premiumBadge: {
      primary: '[data-cy="premium-badge"]',
      fallbacks: ['span[class*="premium"]', 'div[class*="premium-badge"]'],
      description: 'Premium subscription badge',
    },
  },

  common: {
    loadingSpinner: {
      primary: '[data-cy="loading"]',
      fallbacks: ['div[class*="loading"]', 'div[class*="spinner"]', 'svg[class*="loading"]'],
      description: 'Loading indicator',
    },
    errorMessage: {
      primary: '[data-cy="error-message"]',
      fallbacks: ['div[class*="error"]', 'div[role="alert"]', 'div[class*="message--error"]'],
      description: 'Error message',
    },
    notFound: {
      primary: '[data-cy="not-found"]',
      fallbacks: ['div:contains("404")', 'h1:contains("Not Found")'],
      description: '404 not found page',
    },
  },
}

/**
 * Selector Manager
 * Provides access to LeetCode selectors with fallback support
 */
export class SelectorManager {
  private selectors: LeetCodeSelectors

  constructor(customSelectors?: Partial<LeetCodeSelectors>) {
    // Merge custom selectors with defaults
    this.selectors = this.mergeSelectors(DEFAULT_SELECTORS, customSelectors)
  }

  /**
   * Get all selectors for a selector group (primary + fallbacks)
   */
  getAll(group: SelectorGroup): string[] {
    const selectors = [group.primary]
    if (group.fallbacks) {
      selectors.push(...group.fallbacks)
    }
    return selectors
  }

  /**
   * Get primary selector only
   */
  getPrimary(group: SelectorGroup): string {
    return group.primary
  }

  /**
   * Get problem selectors
   */
  getProblemSelectors() {
    return this.selectors.problem
  }

  /**
   * Get editorial selectors
   */
  getEditorialSelectors() {
    return this.selectors.editorial
  }

  /**
   * Get discussion selectors
   */
  getDiscussionSelectors() {
    return this.selectors.discussion
  }

  /**
   * Get auth selectors
   */
  getAuthSelectors() {
    return this.selectors.auth
  }

  /**
   * Get common selectors
   */
  getCommonSelectors() {
    return this.selectors.common
  }

  /**
   * Get all selectors
   */
  getAllSelectors(): LeetCodeSelectors {
    return this.selectors
  }

  /**
   * Update selectors at runtime
   */
  updateSelectors(updates: Partial<LeetCodeSelectors>) {
    this.selectors = this.mergeSelectors(this.selectors, updates)
  }

  /**
   * Merge selector configurations
   */
  private mergeSelectors(
    base: LeetCodeSelectors,
    updates?: Partial<LeetCodeSelectors>
  ): LeetCodeSelectors {
    if (!updates) {
      return base
    }

    return {
      problem: { ...base.problem, ...updates.problem },
      editorial: { ...base.editorial, ...updates.editorial },
      discussion: { ...base.discussion, ...updates.discussion },
      auth: { ...base.auth, ...updates.auth },
      common: { ...base.common, ...updates.common },
    }
  }

  /**
   * Create a selector string for Playwright's page.locator()
   * Supports comma-separated fallbacks
   */
  toLocatorString(group: SelectorGroup): string {
    const all = this.getAll(group)
    return all.join(', ')
  }

  /**
   * Validate if a selector group has any selectors defined
   */
  isValid(group: SelectorGroup): boolean {
    return !!group.primary && group.primary.length > 0
  }
}
