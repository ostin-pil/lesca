import { describe, it, expect, beforeEach } from 'vitest'
import { EditorialConverter } from '../editorial-converter.js'
import type { EditorialContent } from '../../../../shared/types/src/index.js'

describe('EditorialConverter', () => {
  let converter: EditorialConverter

  const mockEditorial: EditorialContent = {
    titleSlug: 'two-sum',
    content: '<p>This is the main editorial content with <strong>bold text</strong>.</p>',
    approaches: ['<p>First approach using HashMap</p>', '<p>Second approach using sorting</p>'],
    complexity: '<p>Time: O(n), Space: O(n)</p>',
    codeSnippets: [
      { lang: 'python', langSlug: 'python3', code: 'def solution():\n    pass' },
      { lang: 'javascript', langSlug: 'javascript', code: 'function solution() {}' },
    ],
  }

  beforeEach(() => {
    converter = new EditorialConverter()
  })

  describe('canConvert', () => {
    it('should return true for valid editorial content', () => {
      expect(converter.canConvert(mockEditorial)).toBe(true)
    })

    it('should return false for non-objects', () => {
      expect(converter.canConvert('string')).toBe(false)
      expect(converter.canConvert(123)).toBe(false)
      expect(converter.canConvert(null)).toBe(false)
      expect(converter.canConvert(undefined)).toBe(false)
    })

    it('should return false for objects without required fields', () => {
      expect(converter.canConvert({ someField: 'value' })).toBe(false)
      expect(converter.canConvert({ titleSlug: 'test' })).toBe(false)
      expect(converter.canConvert({ content: 'test' })).toBe(false)
    })

    it('should return true for minimal editorial', () => {
      expect(converter.canConvert({ titleSlug: 'test', content: '' })).toBe(true)
    })
  })

  describe('convert', () => {
    it('should throw error for invalid input', async () => {
      await expect(converter.convert('invalid')).rejects.toThrow(
        'Invalid editorial content: expected EditorialContent object'
      )
      await expect(converter.convert(null)).rejects.toThrow()
      await expect(converter.convert({})).rejects.toThrow()
    })

    it('should generate title from titleSlug', async () => {
      const result = await converter.convert(mockEditorial)
      expect(result).toContain('# Editorial: Two Sum')
    })

    it('should include main content section', async () => {
      const result = await converter.convert(mockEditorial)
      expect(result).toContain('## Solution')
      expect(result).toContain('main editorial content')
      expect(result).toContain('**bold text**')
    })

    it('should handle empty content gracefully', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        content: '',
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('# Editorial: Two Sum')
      expect(result).not.toContain('## Solution')
    })

    it('should convert approaches section', async () => {
      const result = await converter.convert(mockEditorial)
      expect(result).toContain('## Approaches')
      expect(result).toContain('### Approach 1')
      expect(result).toContain('### Approach 2')
      expect(result).toContain('HashMap')
      expect(result).toContain('sorting')
    })

    it('should handle no approaches', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        approaches: [],
      }
      const result = await converter.convert(editorial)
      expect(result).not.toContain('## Approaches')
    })

    it('should include complexity analysis', async () => {
      const result = await converter.convert(mockEditorial)
      expect(result).toContain('## Complexity Analysis')
      expect(result).toContain('Time: O(n)')
      expect(result).toContain('Space: O(n)')
    })

    it('should handle missing complexity', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        complexity: null,
      }
      const result = await converter.convert(editorial)
      expect(result).not.toContain('## Complexity Analysis')
    })

    it('should include code examples', async () => {
      const result = await converter.convert(mockEditorial)
      expect(result).toContain('## Code Examples')
      expect(result).toContain('```python3')
      expect(result).toContain('def solution()')
      expect(result).toContain('```javascript')
      expect(result).toContain('function solution()')
    })

    it('should handle no code snippets', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        codeSnippets: [],
      }
      const result = await converter.convert(editorial)
      expect(result).not.toContain('## Code Examples')
    })
  })

  describe('title formatting', () => {
    it('should capitalize words in title', async () => {
      const result = await converter.convert(mockEditorial)
      expect(result).toContain('Two Sum')
    })

    it('should handle multi-word slugs', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        titleSlug: 'longest-substring-without-repeating-characters',
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('Longest Substring Without Repeating Characters')
    })

    it('should handle single word slugs', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        titleSlug: 'palindrome',
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('Palindrome')
    })

    it('should handle numbers in title', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        titleSlug: '3sum',
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('3sum')
    })
  })

  describe('HTML to Markdown conversion', () => {
    it('should convert HTML in main content', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        content: '<p>Use <code>HashMap</code> for <strong>O(1)</strong> lookup</p>',
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('`HashMap`')
      expect(result).toContain('**O(1)**')
    })

    it('should convert HTML in approaches', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        approaches: ['<p>Approach using <em>dynamic programming</em></p>'],
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('_dynamic programming_')
    })

    it('should convert HTML in complexity', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        complexity: '<p><strong>Time Complexity:</strong> O(n log n)</p>',
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('**Time Complexity:**')
      expect(result).toContain('O(n log n)')
    })

    it('should handle code blocks in content', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        content: '<pre><code class="language-python">for i in range(n):\n    pass</code></pre>',
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('```python')
      expect(result).toContain('for i in range(n):')
    })
  })

  describe('code snippets', () => {
    it('should format code snippets correctly', async () => {
      const result = await converter.convert(mockEditorial)
      const pythonMatch = result.match(/```python3\ndef solution\(\):\n    pass\n```/)
      const jsMatch = result.match(/```javascript\nfunction solution\(\) {}\n```/)
      expect(pythonMatch).toBeTruthy()
      expect(jsMatch).toBeTruthy()
    })

    it('should handle multiple code snippets in same language', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        codeSnippets: [
          { lang: 'python', langSlug: 'python3', code: 'code1 = 1' },
          { lang: 'python', langSlug: 'python3', code: 'code2 = 2' },
        ],
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('code1 = 1')
      expect(result).toContain('code2 = 2')
    })

    it('should preserve code indentation', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        codeSnippets: [
          {
            lang: 'python',
            langSlug: 'python3',
            code: 'def foo():\n    if True:\n        return 1',
          },
        ],
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('    if True:')
      expect(result).toContain('        return 1')
    })

    it('should handle empty code snippets', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        codeSnippets: [{ lang: 'python', langSlug: 'python3', code: '' }],
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('```python3')
      expect(result).toContain('```')
    })
  })

  describe('approach numbering', () => {
    it('should number approaches correctly', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        approaches: ['<p>First</p>', '<p>Second</p>', '<p>Third</p>'],
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('### Approach 1')
      expect(result).toContain('### Approach 2')
      expect(result).toContain('### Approach 3')
    })

    it('should handle single approach', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        approaches: ['<p>Only approach</p>'],
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('### Approach 1')
      expect(result).not.toContain('### Approach 2')
    })
  })

  describe('section ordering', () => {
    it('should order sections correctly', async () => {
      const result = await converter.convert(mockEditorial)

      const solutionIndex = result.indexOf('## Solution')
      const approachesIndex = result.indexOf('## Approaches')
      const complexityIndex = result.indexOf('## Complexity Analysis')
      const codeIndex = result.indexOf('## Code Examples')

      expect(solutionIndex).toBeLessThan(approachesIndex)
      expect(approachesIndex).toBeLessThan(complexityIndex)
      expect(complexityIndex).toBeLessThan(codeIndex)
    })

    it('should handle missing optional sections gracefully', async () => {
      const editorial: EditorialContent = {
        titleSlug: 'test',
        content: '<p>Only content</p>',
        approaches: [],
        complexity: null,
        codeSnippets: [],
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('## Solution')
      expect(result).not.toContain('## Approaches')
      expect(result).not.toContain('## Complexity Analysis')
      expect(result).not.toContain('## Code Examples')
    })
  })

  describe('minimal editorial', () => {
    it('should handle editorial with only title and content', async () => {
      const editorial: EditorialContent = {
        titleSlug: 'minimal',
        content: '<p>Minimal content</p>',
        approaches: [],
        complexity: null,
        codeSnippets: [],
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('# Editorial: Minimal')
      expect(result).toContain('## Solution')
      expect(result).toContain('Minimal content')
    })

    it('should handle editorial with no content but has approaches', async () => {
      const editorial: EditorialContent = {
        titleSlug: 'test',
        content: '',
        approaches: ['<p>Approach 1</p>'],
        complexity: null,
        codeSnippets: [],
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('# Editorial: Test')
      expect(result).toContain('## Approaches')
      expect(result).not.toContain('## Solution')
    })
  })

  describe('complex editorial', () => {
    it('should handle editorial with all sections', async () => {
      const result = await converter.convert(mockEditorial)

      // Should have all sections
      expect(result).toContain('# Editorial:')
      expect(result).toContain('## Solution')
      expect(result).toContain('## Approaches')
      expect(result).toContain('## Complexity Analysis')
      expect(result).toContain('## Code Examples')
    })

    it('should handle long content', async () => {
      const longContent = '<p>Long paragraph. '.repeat(100) + '</p>'
      const editorial: EditorialContent = {
        ...mockEditorial,
        content: longContent,
      }
      const result = await converter.convert(editorial)
      expect(result.length).toBeGreaterThan(1000)
      expect(result).toContain('Long paragraph')
    })

    it('should handle many approaches', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        approaches: Array(10)
          .fill(0)
          .map((_, i) => `<p>Approach ${i + 1}</p>`),
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('### Approach 1')
      expect(result).toContain('### Approach 10')
    })

    it('should handle many code snippets', async () => {
      const editorial: EditorialContent = {
        ...mockEditorial,
        codeSnippets: ['python3', 'javascript', 'java', 'cpp', 'go'].map((langSlug) => ({
          lang: langSlug.replace('3', ''),
          langSlug: langSlug,
          code: `${langSlug} code here`,
        })),
      }
      const result = await converter.convert(editorial)
      expect(result).toContain('```python3')
      expect(result).toContain('```javascript')
      expect(result).toContain('```java')
      expect(result).toContain('```cpp')
      expect(result).toContain('```go')
    })
  })

  describe('Obsidian format', () => {
    it('should convert to Obsidian format with frontmatter', async () => {
      const result = await converter.convertToObsidian(mockEditorial)
      expect(result).toContain('---')
      expect(result).toContain('slug: two-sum')
      expect(result).toContain('type: editorial')
    })

    it('should include created date in Obsidian format', async () => {
      const result = await converter.convertToObsidian(mockEditorial)
      expect(result).toMatch(/created: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should format Obsidian content correctly', async () => {
      const result = await converter.convertToObsidian(mockEditorial)
      expect(result).toContain('title: "Editorial: Two Sum"')
      expect(result).toContain('## Solution')
    })
  })
})
