import { describe, it, expect, beforeEach } from 'vitest'
import { DiscussionConverter } from '../discussion-converter.js'
import type { DiscussionList, Discussion } from '../../../../shared/types/src/index.js'

describe('DiscussionConverter', () => {
  let converter: DiscussionConverter

  const mockDiscussion: Discussion = {
    id: '1',
    title: 'Clean Python Solution',
    content: '<p>Here is my solution using <code>HashMap</code></p>',
    author: 'johndoe',
    votes: 150,
    views: 1200,
    createdAt: '2024-01-15',
    isPinned: false,
  }

  const mockDiscussionList: DiscussionList = {
    titleSlug: 'two-sum',
    category: 'solution',
    sortBy: 'hot',
    total: 500,
    discussions: [mockDiscussion],
  }

  beforeEach(() => {
    converter = new DiscussionConverter()
  })

  describe('canConvert', () => {
    it('should return true for valid discussion list', () => {
      expect(converter.canConvert(mockDiscussionList)).toBe(true)
    })

    it('should return false for non-objects', () => {
      expect(converter.canConvert('string')).toBe(false)
      expect(converter.canConvert(123)).toBe(false)
      expect(converter.canConvert(null)).toBe(false)
      expect(converter.canConvert(undefined)).toBe(false)
    })

    it('should return false for objects without discussions', () => {
      expect(converter.canConvert({ someField: 'value' })).toBe(false)
      expect(converter.canConvert({ discussions: 'not-array' })).toBe(false)
    })

    it('should return true for empty discussions array', () => {
      expect(converter.canConvert({ discussions: [] })).toBe(true)
    })
  })

  describe('convert', () => {
    it('should throw error for invalid input', async () => {
      await expect(converter.convert('invalid')).rejects.toThrow(
        'Invalid discussion list: expected DiscussionList object'
      )
      await expect(converter.convert(null)).rejects.toThrow()
      await expect(converter.convert({})).rejects.toThrow()
    })

    it('should generate title from titleSlug', async () => {
      const result = await converter.convert(mockDiscussionList)
      expect(result).toContain('# Discussions: Two Sum')
    })

    it('should include metadata section', async () => {
      const result = await converter.convert(mockDiscussionList)
      expect(result).toContain('**Category**: solution')
      expect(result).toContain('**Sort**: hot')
      expect(result).toContain('**Total**: 500 discussions')
    })

    it('should not include table of contents for 3 or fewer discussions', async () => {
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [mockDiscussion, mockDiscussion, mockDiscussion],
      }
      const result = await converter.convert(list)
      expect(result).not.toContain('## Table of Contents')
    })

    it('should include table of contents for more than 3 discussions', async () => {
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [mockDiscussion, mockDiscussion, mockDiscussion, mockDiscussion],
      }
      const result = await converter.convert(list)
      expect(result).toContain('## Table of Contents')
      expect(result).toContain('1. [Clean Python Solution]')
      expect(result).toContain('by johndoe (150 votes)')
    })

    it('should convert discussions to markdown', async () => {
      const result = await converter.convert(mockDiscussionList)
      expect(result).toContain('## 1. Clean Python Solution')
      expect(result).toContain('**Author**: johndoe')
      expect(result).toContain('**Votes**: 150')
    })

    it('should separate discussions with horizontal rules', async () => {
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [mockDiscussion, mockDiscussion],
      }
      const result = await converter.convert(list)
      const hrCount = (result.match(/\n---\n/g) || []).length
      expect(hrCount).toBeGreaterThanOrEqual(2) // At least 2 (metadata + separator)
    })

    it('should handle empty discussions array', async () => {
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [],
      }
      const result = await converter.convert(list)
      expect(result).toContain('# Discussions: Two Sum')
      expect(result).toContain('**Total**: 500 discussions')
      expect(result).not.toContain('## Table of Contents')
    })

    it('should handle discussions without certain fields', async () => {
      const minimalDiscussion: Discussion = {
        id: '2',
        title: 'Minimal Discussion',
        content: '<p>Content</p>',
        author: 'user',
        votes: 0,
        views: 0,
        createdAt: '2024-01-01',
        isPinned: false,
      }
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [minimalDiscussion],
      }
      const result = await converter.convert(list)
      expect(result).toContain('## 1. Minimal Discussion')
      expect(result).toContain('**Author**: user')
    })
  })

  describe('title formatting', () => {
    it('should capitalize words in title', async () => {
      const result = await converter.convert(mockDiscussionList)
      expect(result).toContain('Two Sum')
    })

    it('should handle multi-word slugs', async () => {
      const list: DiscussionList = {
        ...mockDiscussionList,
        titleSlug: 'longest-substring-without-repeating-characters',
      }
      const result = await converter.convert(list)
      expect(result).toContain('Longest Substring Without Repeating Characters')
    })

    it('should handle single word slugs', async () => {
      const list: DiscussionList = {
        ...mockDiscussionList,
        titleSlug: 'palindrome',
      }
      const result = await converter.convert(list)
      expect(result).toContain('Palindrome')
    })
  })

  describe('anchor generation', () => {
    it('should create valid anchors from titles', async () => {
      const discussion: Discussion = {
        ...mockDiscussion,
        title: 'Best Python Solution Using HashMap!',
      }
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [discussion, discussion, discussion, discussion],
      }
      const result = await converter.convert(list)
      expect(result).toContain('#best-python-solution-using-hashmap')
    })

    it('should handle special characters in anchors', async () => {
      const discussion: Discussion = {
        ...mockDiscussion,
        title: 'C++ O(n) Solution [Fast & Easy]',
      }
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [discussion, discussion, discussion, discussion],
      }
      const result = await converter.convert(list)
      // Anchor should remove special chars: C++ -> c, O(n) -> o-n, [Fast & Easy] -> fast-easy
      expect(result).toContain('#c-o-n-solution-fast-easy')
    })
  })

  describe('HTML to Markdown conversion', () => {
    it('should convert HTML content to markdown', async () => {
      const discussion: Discussion = {
        ...mockDiscussion,
        content: '<p>Use <strong>HashMap</strong> for O(1) lookup</p>',
      }
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [discussion],
      }
      const result = await converter.convert(list)
      expect(result).toContain('**HashMap**')
      expect(result).toContain('O(1) lookup')
    })

    it('should convert code blocks', async () => {
      const discussion: Discussion = {
        ...mockDiscussion,
        content: '<pre><code class="language-python">def solution():\n    pass</code></pre>',
      }
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [discussion],
      }
      const result = await converter.convert(list)
      expect(result).toContain('```python')
      expect(result).toContain('def solution()')
    })

    it('should handle inline code', async () => {
      const discussion: Discussion = {
        ...mockDiscussion,
        content: '<p>Use <code>dict.get()</code> method</p>',
      }
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [discussion],
      }
      const result = await converter.convert(list)
      expect(result).toContain('`dict.get()`')
    })
  })

  describe('pinned discussions', () => {
    it('should not mark unpinned discussions', async () => {
      const result = await converter.convert(mockDiscussionList)
      expect(result).not.toContain('📌')
    })
  })

  describe('discussion metadata', () => {
    it('should include all metadata fields', async () => {
      const result = await converter.convert(mockDiscussionList)
      expect(result).toContain('**Author**: johndoe')
      expect(result).toContain('**Votes**: 150')
      // Posted field requires 'timestamp' property in Discussion, not 'createdAt'
      // Views field is not shown in converter output
    })

    it('should handle missing metadata gracefully', async () => {
      const discussion: Discussion = {
        ...mockDiscussion,
        votes: 0,
        timestamp: undefined,
      }
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [discussion],
      }
      const result = await converter.convert(list)
      expect(result).toContain('**Author**: johndoe')
      expect(result).toContain('**Votes**: 0')
      // timestamp is optional, so it shouldn't appear if undefined
      expect(result).not.toContain('**Posted**:')
    })
  })

  describe('comments section', () => {
    it('should include comments when available', async () => {
      const discussion: Discussion = {
        ...mockDiscussion,
        comments: [
          {
            id: 'c1',
            content: '<p>Great solution!</p>',
            author: 'commenter1',
            votes: 5,
            createdAt: '2024-01-16',
          },
        ],
      }
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [discussion],
      }
      const result = await converter.convert(list)
      expect(result).toContain('### Comments')
      expect(result).toContain('**commenter1**')
      expect(result).toContain('Great solution!')
    })

    it('should not include comments section when no comments', async () => {
      const result = await converter.convert(mockDiscussionList)
      expect(result).not.toContain('### Comments')
    })

    it('should handle multiple comments', async () => {
      const discussion: Discussion = {
        ...mockDiscussion,
        comments: [
          {
            id: 'c1',
            content: '<p>Comment 1</p>',
            author: 'user1',
            votes: 5,
            createdAt: '2024-01-16',
          },
          {
            id: 'c2',
            content: '<p>Comment 2</p>',
            author: 'user2',
            votes: 3,
            createdAt: '2024-01-17',
          },
        ],
      }
      const list: DiscussionList = {
        ...mockDiscussionList,
        discussions: [discussion],
      }
      const result = await converter.convert(list)
      expect(result).toContain('Comment 1')
      expect(result).toContain('Comment 2')
      expect(result).toContain('user1')
      expect(result).toContain('user2')
    })
  })
})
