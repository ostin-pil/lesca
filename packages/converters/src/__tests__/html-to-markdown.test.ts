import { describe, it, expect } from 'vitest'
import { HtmlToMarkdownConverter } from '../html-to-markdown'

describe('HtmlToMarkdownConverter', () => {
  const converter = new HtmlToMarkdownConverter()

  it('should convert basic HTML to Markdown', async () => {
    const html = '<p>Hello <strong>World</strong></p>'
    const markdown = await converter.convert(html)
    expect(markdown.trim()).toBe('Hello **World**')
  })

  it('should handle superscripts and subscripts', async () => {
    const html = '<p>x<sup>2</sup> + y<sub>i</sub></p>'
    const markdown = await converter.convert(html)
    expect(markdown).toContain('x^2^')
    expect(markdown).toContain('y~i~')
  })

  it('should handle lists', async () => {
    const html = `
      <ul>
        <li><strong>Constraints:</strong></li>
        <li><code>1 <= nums.length <= 10^4</code></li>
      </ul>
    `
    const markdown = await converter.convert(html)
    expect(markdown).toContain('**Constraints:**')
    expect(markdown).toContain('`1 <= nums.length <= 10^4`')
  })

  it('should handle strong tags', async () => {
    const html = '<strong>Example 1:</strong>'
    const markdown = await converter.convert(html)
    expect(markdown.trim()).toBe('**Example 1:**')
  })

  // NOTE: Complex PRE/CODE blocks with custom language detection
  // are handled by the existing codebase but may not work perfectly
  // in all edge cases due to Turndown's default behavior.
  // This is an area for future improvement.
})
