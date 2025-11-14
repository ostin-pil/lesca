import { describe, it, expect, beforeEach } from 'vitest'
import { HtmlToMarkdownConverter } from '../html-to-markdown.js'

describe('HtmlToMarkdownConverter', () => {
  let converter: HtmlToMarkdownConverter

  beforeEach(() => {
    converter = new HtmlToMarkdownConverter()
  })

  describe('canConvert', () => {
    it('should return true for HTML strings', () => {
      expect(converter.canConvert('<div>Test</div>')).toBe(true)
      expect(converter.canConvert('<p>Hello</p>')).toBe(true)
      expect(converter.canConvert('Text with <span>HTML</span>')).toBe(true)
    })

    it('should return false for non-HTML strings', () => {
      expect(converter.canConvert('Plain text')).toBe(false)
      expect(converter.canConvert('No HTML here')).toBe(false)
      expect(converter.canConvert('')).toBe(false)
    })

    it('should return false for non-strings', () => {
      expect(converter.canConvert(123)).toBe(false)
      expect(converter.canConvert(null)).toBe(false)
      expect(converter.canConvert(undefined)).toBe(false)
      expect(converter.canConvert({})).toBe(false)
    })
  })

  describe('convert - basic HTML elements', () => {
    it('should convert paragraphs', async () => {
      const html = '<p>This is a paragraph</p>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('This is a paragraph')
    })

    it('should convert headings', async () => {
      const html = '<h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('# Heading 1')
      expect(markdown).toContain('## Heading 2')
      expect(markdown).toContain('### Heading 3')
    })

    it('should convert bold and italic text', async () => {
      const html = '<p>This is <strong>bold</strong> and <em>italic</em></p>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('**bold**')
      expect(markdown).toContain('_italic_')
    })

    it('should convert links', async () => {
      const html = '<a href="https://example.com">Link text</a>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('[Link text](https://example.com)')
    })

    it('should convert images', async () => {
      const html = '<img src="image.png" alt="Test image" />'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('![Test image](image.png)')
    })

    it('should convert images with title', async () => {
      const html = '<img src="image.png" alt="Test" title="Image Title" />'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('![Test](image.png "Image Title")')
    })
  })

  describe('convert - lists', () => {
    it('should convert unordered lists', async () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('Item 1')
      expect(markdown).toContain('Item 2')
      expect(markdown).toContain('Item 3')
      expect(markdown).toMatch(/^\*/m) // Should start with asterisk
    })

    it('should convert ordered lists', async () => {
      const html = '<ol><li>First</li><li>Second</li><li>Third</li></ol>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('First')
      expect(markdown).toContain('Second')
      expect(markdown).toContain('Third')
      expect(markdown).toMatch(/^1\./m) // Should start with "1."
    })

    it('should handle nested lists', async () => {
      const html = '<ul><li>Item 1<ul><li>Nested 1</li><li>Nested 2</li></ul></li><li>Item 2</li></ul>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('Item 1')
      expect(markdown).toContain('Item 2')
      expect(markdown).toContain('Nested 1')
      expect(markdown).toContain('Nested 2')
    })
  })

  describe('convert - code', () => {
    it('should convert inline code', async () => {
      const html = '<p>Use the <code>console.log()</code> function</p>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('`console.log()`')
    })

    it('should convert code blocks without language', async () => {
      const html = '<pre><code>function test() {\n  return true;\n}</code></pre>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('```')
      expect(markdown).toContain('function test()')
      expect(markdown).toContain('return true;')
    })

    it('should convert code blocks with language', async () => {
      const html = '<pre><code class="language-javascript">const x = 42;</code></pre>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('```javascript')
      expect(markdown).toContain('const x = 42;')
    })

    it('should decode HTML entities in code', async () => {
      const html = '<code>&lt;div&gt;</code>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('`<div>`')
    })
  })

  describe('convert - custom rules', () => {
    it('should convert superscript', async () => {
      const html = '<p>x<sup>2</sup></p>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('x^2^')
    })

    it('should convert subscript', async () => {
      const html = '<p>H<sub>2</sub>O</p>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('H~2~O')
    })

    it('should handle LeetCode example blocks', async () => {
      const html = '<strong class="example">Example 1:</strong><p>Input: x = 5</p>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('Example 1:')
      expect(markdown).toContain('Input: x = 5')
    })
  })

  describe('preProcess', () => {
    it('should remove script tags', async () => {
      const html = '<div>Content</div><script>alert("test")</script><p>More content</p>'
      const markdown = await converter.convert(html)
      expect(markdown).not.toContain('alert')
      expect(markdown).not.toContain('script')
      expect(markdown).toContain('Content')
      expect(markdown).toContain('More content')
    })

    it('should remove style tags', async () => {
      const html = '<div>Content</div><style>.test { color: red; }</style><p>More</p>'
      const markdown = await converter.convert(html)
      expect(markdown).not.toContain('color: red')
      expect(markdown).not.toContain('style')
      expect(markdown).toContain('Content')
    })

    it('should remove HTML comments', async () => {
      const html = '<div>Content</div><!-- This is a comment --><p>More</p>'
      const markdown = await converter.convert(html)
      expect(markdown).not.toContain('This is a comment')
      expect(markdown).toContain('Content')
      expect(markdown).toContain('More')
    })

    it('should normalize whitespace', async () => {
      const html = '<p>Text   with    multiple     spaces</p>'
      const markdown = await converter.convert(html)
      expect(markdown).toMatch(/Text\s+with\s+multiple\s+spaces/)
      expect(markdown).not.toMatch(/\s{3,}/)
    })
  })

  describe('postProcess', () => {
    it('should fix multiple blank lines', async () => {
      const html = '<p>Para 1</p>\n\n\n\n<p>Para 2</p>'
      const markdown = await converter.convert(html)
      expect(markdown).not.toMatch(/\n{3,}/)
    })

    it('should trim trailing whitespace', async () => {
      const html = '<p>Line 1   </p><p>Line 2   </p>'
      const markdown = await converter.convert(html)
      const lines = markdown.split('\n')
      lines.forEach((line) => {
        expect(line).toBe(line.trimEnd())
      })
    })

    it('should ensure single trailing newline', async () => {
      const html = '<p>Content</p>'
      const markdown = await converter.convert(html)
      expect(markdown).toMatch(/\n$/)
      expect(markdown).not.toMatch(/\n\n$/)
    })
  })

  describe('convertWithImages', () => {
    it('should convert without image downloader', async () => {
      const html = '<img src="https://example.com/image.png" alt="Test" />'
      const markdown = await converter.convertWithImages(html)
      expect(markdown).toContain('![Test](https://example.com/image.png)')
    })

    it('should download and replace image paths', async () => {
      const html = '<img src="https://example.com/image.png" alt="Test" />'
      const mockDownloader = async (url: string) => {
        expect(url).toBe('https://example.com/image.png')
        return './local/image.png'
      }

      const markdown = await converter.convertWithImages(html, mockDownloader)
      expect(markdown).toContain('![Test](./local/image.png)')
      expect(markdown).not.toContain('https://example.com/image.png')
    })

    it('should skip already local images', async () => {
      const html = '<img src="./local/image.png" alt="Test" />'
      let downloaderCalled = false
      const mockDownloader = async () => {
        downloaderCalled = true
        return './new/path.png'
      }

      const markdown = await converter.convertWithImages(html, mockDownloader)
      expect(downloaderCalled).toBe(false)
      expect(markdown).toContain('![Test](./local/image.png)')
    })

    it('should skip file:// URLs', async () => {
      const html = '<img src="file:///local/image.png" alt="Test" />'
      let downloaderCalled = false
      const mockDownloader = async () => {
        downloaderCalled = true
        return './new/path.png'
      }

      const markdown = await converter.convertWithImages(html, mockDownloader)
      expect(downloaderCalled).toBe(false)
      expect(markdown).toContain('file:///local/image.png')
    })

    it('should handle downloader errors gracefully', async () => {
      const html = '<img src="https://example.com/image.png" alt="Test" />'
      const mockDownloader = async () => {
        throw new Error('Download failed')
      }

      const markdown = await converter.convertWithImages(html, mockDownloader)
      // Should keep original URL on failure
      expect(markdown).toContain('https://example.com/image.png')
    })

    it('should handle multiple images', async () => {
      const html = '<img src="https://example.com/1.png" alt="First" /><img src="https://example.com/2.png" alt="Second" />'
      let callCount = 0
      const mockDownloader = async (url: string) => {
        callCount++
        return `./local/${callCount}.png`
      }

      const markdown = await converter.convertWithImages(html, mockDownloader)
      expect(callCount).toBe(2)
      expect(markdown).toContain('![First](./local/1.png)')
      expect(markdown).toContain('![Second](./local/2.png)')
    })
  })

  describe('extractText', () => {
    it('should extract plain text from HTML', () => {
      const html = '<div><h1>Title</h1><p>This is <strong>bold</strong> text</p></div>'
      const text = converter.extractText(html)
      expect(text).toContain('Title')
      expect(text).toContain('This is')
      expect(text).toContain('bold')
      expect(text).toContain('text')
      expect(text).not.toContain('<')
      expect(text).not.toContain('>')
    })

    it('should decode HTML entities', () => {
      const html = '<p>&lt;div&gt; &amp; &quot;test&quot; &#39;quote&#39;</p>'
      const text = converter.extractText(html)
      expect(text).toContain('<div>')
      expect(text).toContain('&')
      expect(text).toContain('"test"')
      expect(text).toContain("'quote'")
    })

    it('should normalize whitespace', () => {
      const html = '<p>Text   with    lots     of      spaces</p>'
      const text = converter.extractText(html)
      expect(text).not.toMatch(/\s{2,}/)
      expect(text).toBe('Text with lots of spaces')
    })

    it('should handle empty HTML', () => {
      const html = '<div></div>'
      const text = converter.extractText(html)
      expect(text).toBe('')
    })

    it('should handle nested elements', () => {
      const html = '<div><span><strong><em>Nested</em></strong></span></div>'
      const text = converter.extractText(html)
      expect(text).toBe('Nested')
    })
  })

  describe('extractCodeBlocks', () => {
    it('should extract code block without language', () => {
      const html = '<pre><code>function test() { return true; }</code></pre>'
      const blocks = converter.extractCodeBlocks(html)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].language).toBe('')
      expect(blocks[0].code).toContain('function test()')
    })

    it('should extract code block with language', () => {
      const html = '<pre><code class="language-javascript">const x = 42;</code></pre>'
      const blocks = converter.extractCodeBlocks(html)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].language).toBe('javascript')
      expect(blocks[0].code).toBe('const x = 42;')
    })

    it('should extract multiple code blocks', () => {
      const html = `
        <pre><code class="language-python">def foo(): pass</code></pre>
        <pre><code class="language-java">public class Test {}</code></pre>
      `
      const blocks = converter.extractCodeBlocks(html)
      expect(blocks).toHaveLength(2)
      expect(blocks[0].language).toBe('python')
      expect(blocks[0].code).toContain('def foo()')
      expect(blocks[1].language).toBe('java')
      expect(blocks[1].code).toContain('public class Test')
    })

    it('should decode HTML entities in code', () => {
      const html = '<pre><code class="language-cpp">vector&lt;int&gt; nums;</code></pre>'
      const blocks = converter.extractCodeBlocks(html)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].code).toBe('vector<int> nums;')
    })

    it('should return empty array for HTML without code blocks', () => {
      const html = '<p>No code here</p><div>Just text</div>'
      const blocks = converter.extractCodeBlocks(html)
      expect(blocks).toHaveLength(0)
    })

    it('should skip inline code (not in pre tags)', () => {
      const html = '<p>Use <code>console.log()</code> function</p>'
      const blocks = converter.extractCodeBlocks(html)
      expect(blocks).toHaveLength(0)
    })

    it('should trim whitespace in code blocks', () => {
      const html = '<pre><code>  \n  function test() {}\n  </code></pre>'
      const blocks = converter.extractCodeBlocks(html)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].code).toBe('function test() {}')
      expect(blocks[0].code).not.toMatch(/^\s/)
      expect(blocks[0].code).not.toMatch(/\s$/)
    })
  })

  describe('error handling', () => {
    it('should throw error for non-HTML input', () => {
      expect(() => converter.convert('plain text')).toThrow('Input must be an HTML string')
    })

    it('should throw error for non-string input', () => {
      expect(() => converter.convert(123)).toThrow('Input must be an HTML string')
      expect(() => converter.convert(null)).toThrow('Input must be an HTML string')
      expect(() => converter.convert(undefined)).toThrow('Input must be an HTML string')
    })
  })

  describe('complex HTML scenarios', () => {
    it('should handle LeetCode problem HTML', async () => {
      const html = `
        <div>
          <p>Given an array of integers <code>nums</code> and an integer <code>target</code>.</p>
          <strong class="example">Example 1:</strong>
          <pre><code class="language-javascript">
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
          </code></pre>
          <p><strong>Constraints:</strong></p>
          <ul>
            <li><code>2 &lt;= nums.length &lt;= 10<sup>4</sup></code></li>
            <li><code>-10<sup>9</sup> &lt;= nums[i] &lt;= 10<sup>9</sup></code></li>
          </ul>
        </div>
      `
      const markdown = await converter.convert(html)

      expect(markdown).toContain('Given an array')
      expect(markdown).toContain('`nums`')
      expect(markdown).toContain('`target`')
      expect(markdown).toContain('Example 1:')
      expect(markdown).toContain('```javascript')
      expect(markdown).toContain('Input: nums = [2,7,11,15]')
      expect(markdown).toContain('Constraints:')
      expect(markdown).toContain('2 <= nums.length')
      expect(markdown).toContain('10^4^')
      expect(markdown).toContain('10^9^')
    })

    it('should handle empty or whitespace-only HTML', async () => {
      const html = '   <div>   </div>   '
      const markdown = await converter.convert(html)
      expect(markdown.trim()).toBe('')
    })

    it('should handle malformed HTML gracefully', async () => {
      const html = '<div><p>Unclosed paragraph<div>Another div</div>'
      const markdown = await converter.convert(html)
      expect(markdown).toContain('Unclosed paragraph')
      expect(markdown).toContain('Another div')
    })
  })
})
