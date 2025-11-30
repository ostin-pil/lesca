import { ParsingError } from '@lesca/error'
import type { Converter, ConverterOptions, EditorialContent } from '@lesca/shared/types'

import { HtmlToMarkdownConverter } from './html-to-markdown'

/**
 * Editorial to Markdown Converter
 * Converts editorial/solution content to well-formatted Markdown
 */
export class EditorialConverter implements Converter {
  readonly from = 'editorial' as const
  readonly to = 'markdown' as const

  private htmlConverter: HtmlToMarkdownConverter

  constructor() {
    this.htmlConverter = new HtmlToMarkdownConverter()
  }

  /**
   * Check if this converter can handle the input
   */
  canConvert(input: unknown): boolean {
    return typeof input === 'object' && input !== null && 'titleSlug' in input && 'content' in input
  }

  /**
   * Convert editorial content to Markdown
   */
  async convert(input: unknown, options?: ConverterOptions): Promise<string> {
    const editorial = input as EditorialContent

    if (!editorial || typeof editorial !== 'object' || !('titleSlug' in editorial)) {
      throw new ParsingError(
        'PARSE_MARKDOWN_FAILED',
        'Invalid editorial content: expected EditorialContent object',
        { context: { inputType: typeof input } }
      )
    }

    const sections: string[] = []

    // Title
    sections.push(`# Editorial: ${this.formatTitle(editorial.titleSlug)}`)
    sections.push('')

    // Main content
    if (editorial.content) {
      const markdown = await this.htmlConverter.convert(editorial.content, options)
      sections.push('## Solution')
      sections.push('')
      sections.push(markdown)
      sections.push('')
    }

    // Approaches
    if (editorial.approaches && editorial.approaches.length > 0) {
      sections.push('## Approaches')
      sections.push('')

      for (let i = 0; i < editorial.approaches.length; i++) {
        sections.push(`### Approach ${i + 1}`)
        sections.push('')
        const markdown = await this.htmlConverter.convert(editorial.approaches[i], options)
        sections.push(markdown)
        sections.push('')
      }
    }

    // Complexity analysis
    if (editorial.complexity) {
      sections.push('## Complexity Analysis')
      sections.push('')
      const markdown = await this.htmlConverter.convert(editorial.complexity, options)
      sections.push(markdown)
      sections.push('')
    }

    // Code snippets
    if (editorial.codeSnippets && editorial.codeSnippets.length > 0) {
      sections.push('## Code Examples')
      sections.push('')

      for (const snippet of editorial.codeSnippets) {
        sections.push('```' + snippet.langSlug)
        sections.push(snippet.code)
        sections.push('```')
        sections.push('')
      }
    }

    return sections.join('\n')
  }

  /**
   * Convert editorial to Obsidian format
   */
  async convertToObsidian(
    editorial: EditorialContent,
    options?: ConverterOptions
  ): Promise<string> {
    const sections: string[] = []

    // YAML frontmatter
    sections.push('---')
    sections.push(`title: "Editorial: ${this.formatTitle(editorial.titleSlug)}"`)
    sections.push(`slug: ${editorial.titleSlug}`)
    sections.push(`type: editorial`)
    sections.push(`created: ${new Date().toISOString()}`)
    sections.push('tags:')
    sections.push('  - leetcode/editorial')
    sections.push('  - leetcode/solution')
    sections.push('---')
    sections.push('')

    // Link back to problem
    sections.push(`> [!info] Problem`)
    sections.push(`> [[${editorial.titleSlug}|${this.formatTitle(editorial.titleSlug)}]]`)
    sections.push('')

    // Main content
    if (editorial.content) {
      const markdown = await this.htmlConverter.convert(editorial.content, options)
      sections.push('## Solution Overview')
      sections.push('')
      sections.push(markdown)
      sections.push('')
    }

    // Approaches
    if (editorial.approaches && editorial.approaches.length > 0) {
      sections.push('## Approaches')
      sections.push('')

      for (let i = 0; i < editorial.approaches.length; i++) {
        sections.push(`### Approach ${i + 1}`)
        sections.push('')
        const markdown = await this.htmlConverter.convert(editorial.approaches[i], options)
        sections.push(markdown)
        sections.push('')
      }
    }

    // Complexity analysis in callout
    if (editorial.complexity) {
      sections.push('> [!note] Complexity Analysis')
      const markdown = await this.htmlConverter.convert(editorial.complexity, options)
      const lines = markdown.split('\n')
      for (const line of lines) {
        sections.push(`> ${line}`)
      }
      sections.push('')
    }

    // Code snippets
    if (editorial.codeSnippets && editorial.codeSnippets.length > 0) {
      sections.push('## Implementation')
      sections.push('')

      for (const snippet of editorial.codeSnippets) {
        sections.push('```' + snippet.langSlug)
        sections.push(snippet.code)
        sections.push('```')
        sections.push('')
      }
    }

    return sections.join('\n')
  }

  /**
   * Format title slug to readable title
   */
  private formatTitle(titleSlug: string): string {
    return titleSlug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  /**
   * Extract plain text from editorial
   */
  extractText(editorial: EditorialContent): string {
    const parts: string[] = []

    if (editorial.content) {
      parts.push(editorial.content)
    }

    if (editorial.approaches) {
      parts.push(...editorial.approaches)
    }

    if (editorial.complexity) {
      parts.push(editorial.complexity)
    }

    return parts.join('\n\n')
  }
}
