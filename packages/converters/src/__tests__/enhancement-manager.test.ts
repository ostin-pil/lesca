import { describe, it, expect, beforeEach } from 'vitest'
import { EnhancementManager } from '../enhancement-manager'
import type { RawData, Problem } from '@lesca/shared/types'

describe('EnhancementManager', () => {
  let manager: EnhancementManager
  let mockProblemData: RawData

  beforeEach(() => {
    manager = new EnhancementManager()
    mockProblemData = {
      type: 'problem',
      data: {
        questionId: '1',
        titleSlug: 'two-sum',
        title: 'Two Sum',
        content: 'Problem content',
        difficulty: 'Easy',
        hints: ['Hint 1', 'Hint 2'],
        codeSnippets: [
          { lang: 'Python', langSlug: 'python', code: 'def twoSum(): pass' },
          { lang: 'Java', langSlug: 'java', code: 'class Solution {}' }
        ],
        companyTagStats: JSON.stringify({
          '1': [{ name: 'Google', slug: 'google', timesEncountered: 5 }]
        })
      } as Problem,
      metadata: {
        scrapedAt: new Date(),
        source: 'graphql',
        url: 'https://leetcode.com/problems/two-sum/'
      }
    }
  })

  it('should apply enhancements by default', () => {
    const markdown = 'Original content'
    const enhanced = manager.enhance(markdown, mockProblemData)

    expect(enhanced).toContain('Original content')
    expect(enhanced).toContain('## Hints')
    expect(enhanced).toContain('1. Hint 1')
    expect(enhanced).toContain('## Code Templates')
    expect(enhanced).toContain('```python')
  })

  it('should respect global disable config', () => {
    const config = { enabled: false }
    manager = new EnhancementManager(config)
    const markdown = 'Original content'
    const enhanced = manager.enhance(markdown, mockProblemData, config)

    expect(enhanced).toBe('Original content')
    expect(enhanced).not.toContain('## Hints')
  })

  it('should respect specific enhancer disable config', () => {
    const config = {
      hints: { enabled: false },
      codeSnippets: { enabled: true }
    }
    manager = new EnhancementManager(config)
    const markdown = 'Original content'
    const enhanced = manager.enhance(markdown, mockProblemData, config)

    expect(enhanced).toContain('## Code Templates')
    expect(enhanced).not.toContain('## Hints')
  })

  it('should handle missing data gracefully', () => {
    const emptyData: RawData = {
      type: 'problem',
      data: {
        ...mockProblemData.data,
        hints: [],
        codeSnippets: [],
        companyTagStats: null
      } as unknown as Problem,
      metadata: mockProblemData.metadata
    }

    const markdown = 'Original content'
    const enhanced = manager.enhance(markdown, emptyData)

    expect(enhanced).toBe('Original content')
  })

  it('should respect language priority for code snippets', () => {
    const config = {
      codeSnippets: {
        enabled: true,
        languagePriority: ['java']
      }
    }
    manager = new EnhancementManager(config)

    const markdown = 'Original content'
    const enhanced = manager.enhance(markdown, mockProblemData, config)

    expect(enhanced).toContain('```java')
    expect(enhanced).toContain('```python')

    const javaIndex = enhanced.indexOf('```java')
    const pythonIndex = enhanced.indexOf('```python')
    expect(javaIndex).toBeLessThan(pythonIndex)
  })
})
