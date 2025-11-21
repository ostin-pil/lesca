import { describe, it, expect, beforeEach } from 'vitest'
import { ObsidianConverter } from '../obsidian-converter'
import type { Problem, Difficulty } from '@lesca/shared/types'

describe('ObsidianConverter', () => {
  let converter: ObsidianConverter

  // Mock problem data
  const mockProblem: Problem = {
    questionId: '1',
    questionFrontendId: '1',
    title: 'Two Sum',
    titleSlug: 'two-sum',
    difficulty: 'Easy' as Difficulty,
    topicTags: [
      { name: 'Array', slug: 'array' },
      { name: 'Hash Table', slug: 'hash-table' },
    ],
    stats: JSON.stringify({
      acRate: '47.3%',
      totalAccepted: '5.2M',
      totalSubmission: '11M',
    }),
    companyTagStats: JSON.stringify({
      Google: 100,
      Amazon: 95,
      Facebook: 80,
    }),
    similarQuestions: JSON.stringify([
      { titleSlug: 'three-sum', title: '3Sum', difficulty: 'Medium' },
      { titleSlug: 'four-sum', title: '4Sum', difficulty: 'Medium' },
    ]),
    solution: { canSeeDetail: true },
  } as Problem

  beforeEach(() => {
    converter = new ObsidianConverter()
  })

  describe('convert', () => {
    it('should generate complete Obsidian document with frontmatter', () => {
      const markdown = '# Two Sum\n\nProblem description here.'
      const result = converter.convert(mockProblem, markdown)

      expect(result).toContain('---')
      // YAML outputs numbers unquoted
      expect(result).toContain('leetcode_id: 1')
      expect(result).toContain('title: Two Sum')
      expect(result).toContain('titleSlug: two-sum')
      expect(result).toContain('difficulty: Easy')
      expect(result).toContain('- array')
      expect(result).toContain('- hash-table')
    })

    it('should include metadata section with difficulty and tags', () => {
      const markdown = '# Two Sum\n\nProblem description.'
      const result = converter.convert(mockProblem, markdown)

      expect(result).toContain('**Difficulty:**')
      expect(result).toContain('Easy')
      expect(result).toContain('**Tags:**')
      expect(result).toContain('`Array`')
      expect(result).toContain('`Hash Table`')
    })

    it('should include acceptance rate from stats', () => {
      const markdown = '# Two Sum\n\nProblem.'
      const result = converter.convert(mockProblem, markdown)

      expect(result).toContain('**Acceptance Rate:** 47.3%')
    })

    it('should include LeetCode link', () => {
      const markdown = '# Two Sum\n\nProblem.'
      const result = converter.convert(mockProblem, markdown)

      expect(result).toContain('**LeetCode:**')
      expect(result).toContain('[Link](https://leetcode.com/problems/two-sum/)')
    })

    it('should convert links to wiki-links when option enabled', () => {
      const markdown = '# Two Sum\n\nSee [Three Sum](/problems/three-sum/)'
      const result = converter.convert(mockProblem, markdown, { wikiLinks: true })

      // Implementation converts /problems/slug/ to [[slug/|Text]]
      expect(result).toContain('[[three-sum/|Three Sum]]')
      expect(result).not.toContain('/problems/three-sum')
    })

    it('should not convert wiki-links when option disabled', () => {
      const markdown = '# Two Sum\n\nSee [Three Sum](/problems/three-sum/)'
      const result = converter.convert(mockProblem, markdown, { wikiLinks: false })

      expect(result).toContain('[Three Sum](/problems/three-sum/)')
      expect(result).not.toContain('[[three-sum')
    })

    it('should add tag section when tagPrefix provided', () => {
      const markdown = '# Two Sum\n\nProblem.'
      const result = converter.convert(mockProblem, markdown, { tagPrefix: 'leetcode' })

      expect(result).toContain('## Tags')
      expect(result).toContain('#leetcode/Array')
      expect(result).toContain('#leetcode/Hash Table')
    })

    it('should add backlinks section when option enabled', () => {
      const markdown = '# Two Sum\n\nProblem.'
      const result = converter.convert(mockProblem, markdown, { includeBacklinks: true })

      expect(result).toContain('## Similar Problems')
      expect(result).toContain('[[three-sum|3Sum]]')
      expect(result).toContain('[[four-sum|4Sum]]')
    })

    it('should not add backlinks when option disabled', () => {
      const markdown = '# Two Sum\n\nProblem.'
      const result = converter.convert(mockProblem, markdown, { includeBacklinks: false })

      expect(result).not.toContain('## Similar Problems')
    })
  })

  describe('frontmatter generation', () => {
    it('should include all required fields', () => {
      const markdown = '# Test'
      const result = converter.convert(mockProblem, markdown)

      // YAML outputs numbers unquoted
      expect(result).toContain('leetcode_id: 1')
      expect(result).toContain('frontend_id: 1')
      expect(result).toContain('title: Two Sum')
      expect(result).toContain('titleSlug: two-sum')
      expect(result).toContain('difficulty: Easy')
      expect(result).toContain('has_solution: true')
      expect(result).toContain('scraped_at:')
    })

    it('should include companies when available', () => {
      const markdown = '# Test'
      const result = converter.convert(mockProblem, markdown)

      expect(result).toContain('companies:')
      expect(result).toContain('- Google')
      expect(result).toContain('- Amazon')
      expect(result).toContain('- Facebook')
    })

    it('should include similar problems when available', () => {
      const markdown = '# Test'
      const result = converter.convert(mockProblem, markdown)

      expect(result).toContain('similar_problems:')
      expect(result).toContain('- three-sum')
      expect(result).toContain('- four-sum')
    })

    it('should omit optional fields when not available', () => {
      const minimalProblem: Problem = {
        ...mockProblem,
        stats: '',
        companyTagStats: null,
        similarQuestions: null,
      } as Problem

      const markdown = '# Test'
      const result = converter.convert(minimalProblem, markdown)

      expect(result).not.toContain('acceptance:')
      expect(result).not.toContain('companies:')
      expect(result).not.toContain('similar_problems:')
    })

    it('should handle JSON parsing errors gracefully', () => {
      const brokenProblem: Problem = {
        ...mockProblem,
        stats: 'invalid json{',
        companyTagStats: '{broken',
        similarQuestions: '[invalid]',
      } as Problem

      const markdown = '# Test'
      const result = converter.convert(brokenProblem, markdown)

      // Should still generate valid markdown without throwing
      expect(result).toContain('---')
      expect(result).toContain('title: Two Sum')
    })

    it('should escape special YAML characters', () => {
      const specialProblem: Problem = {
        ...mockProblem,
        title: 'Problem: "Quotes" & Special [Chars]',
      } as Problem

      const markdown = '# Test'
      const result = converter.convert(specialProblem, markdown)

      expect(result).toContain('title: "Problem: \\"Quotes\\" & Special [Chars]"')
    })
  })

  describe('difficulty emoji', () => {
    it('should add green emoji for Easy', () => {
      const markdown = '# Test'
      const result = converter.convert(mockProblem, markdown)
      expect(result).toContain('🟢 Easy')
    })

    it('should add yellow emoji for Medium', () => {
      const mediumProblem = { ...mockProblem, difficulty: 'Medium' as Difficulty }
      const markdown = '# Test'
      const result = converter.convert(mediumProblem, markdown)
      expect(result).toContain('🟡 Medium')
    })

    it('should add red emoji for Hard', () => {
      const hardProblem = { ...mockProblem, difficulty: 'Hard' as Difficulty }
      const markdown = '# Test'
      const result = converter.convert(hardProblem, markdown)
      expect(result).toContain('🔴 Hard')
    })
  })

  describe('static methods', () => {
    describe('generateFilename', () => {
      it('should generate slug filename', () => {
        const filename = ObsidianConverter.generateFilename(mockProblem, 'slug')
        expect(filename).toBe('two-sum.md')
      })

      it('should generate id-slug filename', () => {
        const filename = ObsidianConverter.generateFilename(mockProblem, 'id-slug')
        expect(filename).toBe('1-two-sum.md')
      })

      it('should generate id-title filename', () => {
        const filename = ObsidianConverter.generateFilename(mockProblem, 'id-title')
        expect(filename).toBe('1. Two Sum.md')
      })

      it('should default to id-slug format', () => {
        const filename = ObsidianConverter.generateFilename(mockProblem)
        expect(filename).toBe('1-two-sum.md')
      })
    })

    describe('generateDirectory', () => {
      it('should return empty string for flat structure', () => {
        const dir = ObsidianConverter.generateDirectory(mockProblem, 'flat')
        expect(dir).toBe('')
      })

      it('should return difficulty for by-difficulty structure', () => {
        const dir = ObsidianConverter.generateDirectory(mockProblem, 'by-difficulty')
        expect(dir).toBe('Easy')
      })

      it('should return tag for by-tag structure', () => {
        const dir = ObsidianConverter.generateDirectory(mockProblem, 'by-tag')
        expect(dir).toBe('Array')
      })

      it('should return Uncategorized for problems without tags', () => {
        const noTagsProblem = { ...mockProblem, topicTags: [] }
        const dir = ObsidianConverter.generateDirectory(noTagsProblem, 'by-tag')
        expect(dir).toBe('Uncategorized')
      })

      it('should default to by-difficulty structure', () => {
        const dir = ObsidianConverter.generateDirectory(mockProblem)
        expect(dir).toBe('Easy')
      })
    })
  })

  describe('metadata section', () => {
    it('should insert metadata after first heading', () => {
      const markdown = '# Two Sum\n\nProblem description.\n\n## Examples'
      const result = converter.convert(mockProblem, markdown)

      // Metadata should come after title but before rest of content
      const titleIndex = result.indexOf('# Two Sum')
      const metadataIndex = result.indexOf('**Difficulty:**')
      const examplesIndex = result.indexOf('## Examples')

      expect(metadataIndex).toBeGreaterThan(titleIndex)
      expect(examplesIndex).toBeGreaterThan(metadataIndex)
    })

    it('should prepend metadata if no heading found', () => {
      const markdown = 'Problem description without heading.'
      const result = converter.convert(mockProblem, markdown)

      const metadataIndex = result.indexOf('**Difficulty:**')
      const contentIndex = result.indexOf('Problem description')

      expect(metadataIndex).toBeLessThan(contentIndex)
    })

    it('should include horizontal rule separator', () => {
      const markdown = '# Test'
      const result = converter.convert(mockProblem, markdown)

      expect(result).toContain('---')
    })
  })

  describe('complex scenarios', () => {
    it('should handle problem with all options enabled', () => {
      const markdown = '# Two Sum\n\nProblem with [similar](/problems/three-sum/) link.'
      const result = converter.convert(mockProblem, markdown, {
        includeBacklinks: true,
        tagPrefix: 'leetcode',
        wikiLinks: true,
      })

      // Should have all features
      expect(result).toContain('---') // Frontmatter
      expect(result).toContain('leetcode_id:') // Frontmatter fields
      expect(result).toContain('**Difficulty:**') // Metadata
      expect(result).toContain('[[three-sum/|similar]]') // Wiki links
      expect(result).toContain('## Tags') // Tag section
      expect(result).toContain('#leetcode/Array') // Tags
      expect(result).toContain('## Similar Problems') // Backlinks
    })

    it('should handle empty markdown content', () => {
      const markdown = ''
      const result = converter.convert(mockProblem, markdown)

      // Should still generate valid document with frontmatter and metadata
      expect(result).toContain('---')
      expect(result).toContain('leetcode_id:')
      expect(result).toContain('**Difficulty:**')
    })

    it('should handle markdown with no title', () => {
      const markdown = 'Just some content without a title.'
      const result = converter.convert(mockProblem, markdown)

      expect(result).toContain('---')
      expect(result).toContain('**Difficulty:**')
      expect(result).toContain('Just some content')
    })
  })

  describe('YAML formatting', () => {
    it('should format arrays correctly', () => {
      const markdown = '# Test'
      const result = converter.convert(mockProblem, markdown)

      expect(result).toContain('tags:\n  - array\n  - hash-table')
    })

    it('should format strings correctly', () => {
      const markdown = '# Test'
      const result = converter.convert(mockProblem, markdown)

      expect(result).toContain('title: Two Sum')
      expect(result).toContain('titleSlug: two-sum')
    })

    it('should format booleans correctly', () => {
      const markdown = '# Test'
      const result = converter.convert(mockProblem, markdown)

      expect(result).toContain('has_solution: true')
    })

    it('should format ISO dates correctly', () => {
      const markdown = '# Test'
      const result = converter.convert(mockProblem, markdown)

      // YAML quotes datetime strings
      expect(result).toMatch(/scraped_at: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should not include undefined values', () => {
      const minimalProblem: Problem = {
        ...mockProblem,
        companyTagStats: null,
      } as Problem

      const markdown = '# Test'
      const result = converter.convert(minimalProblem, markdown)

      expect(result).not.toContain('companies:')
    })

    it('should not include empty arrays', () => {
      const noProblem: Problem = {
        ...mockProblem,
        similarQuestions: JSON.stringify([]),
      } as Problem

      const markdown = '# Test'
      const result = converter.convert(noProblem, markdown)

      expect(result).not.toContain('similar_problems:')
    })
  })
})
