import TurndownService from 'turndown'

import type { Converter, ConverterOptions } from '../../../shared/types/src/index.js'
import { logger } from '../../../shared/utils/src/index.js'

/**
 * HTML to Markdown converter
 * Uses Turndown library with LeetCode-specific customizations
 */
export class HtmlToMarkdownConverter implements Converter {
  readonly from = 'html' as const
  readonly to = 'markdown' as const

  private turndown: TurndownService

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx', // Use # for headings
      codeBlockStyle: 'fenced', // Use ``` for code blocks
      fence: '```', // Code fence marker
      emDelimiter: '_', // Use _ for emphasis
      strongDelimiter: '**', // Use ** for strong
      linkStyle: 'inlined', // Use [text](url) for links
      linkReferenceStyle: 'full', // Full references when needed
      br: '  \n', // Line breaks as double space + newline
      preformattedCode: true, // Preserve preformatted code
    })

    this.addCustomRules()
  }

  /**
   * Check if this converter can handle the data
   */
  canConvert(data: unknown): boolean {
    return typeof data === 'string' && data.includes('<')
  }

  /**
   * Convert HTML to Markdown
   */
  convert(input: unknown, _options?: ConverterOptions): Promise<string> {
    if (!this.canConvert(input)) {
      throw new Error('Input must be an HTML string')
    }

    const html = input as string

    // Pre-process HTML
    const cleaned = this.preProcess(html)

    // Convert to markdown
    let markdown = this.turndown.turndown(cleaned)

    // Post-process markdown
    markdown = this.postProcess(markdown)

    return Promise.resolve(markdown)
  }

  /**
   * Pre-process HTML before conversion
   * Handles LeetCode-specific patterns
   */
  private preProcess(html: string): string {
    let processed = html

    // Remove script tags
    processed = processed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

    // Remove style tags
    processed = processed.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

    // Remove comments
    processed = processed.replace(/<!--[\s\S]*?-->/g, '')

    // Normalize whitespace
    processed = processed.replace(/\s+/g, ' ')

    // Fix LeetCode's example blocks (strong tags)
    processed = processed.replace(
      /<strong class="example">Example (\d+):<\/strong>/g,
      '**Example $1:**'
    )

    // Handle code tags with class attributes (language detection)
    processed = processed.replace(
      /<code class="language-(\w+)">(.*?)<\/code>/g,
      '<code data-lang="$1">$2</code>'
    )

    return processed
  }

  /**
   * Post-process markdown after conversion
   */
  private postProcess(markdown: string): string {
    let processed = markdown

    // Fix multiple blank lines
    processed = processed.replace(/\n{3,}/g, '\n\n')

    // Fix code block language hints
    processed = processed.replace(/```(\w+)?\n/g, (_match, lang) => {
      return lang ? `\`\`\`${lang}\n` : '```\n'
    })

    // Fix inline code with backticks
    processed = processed.replace(/`([^`]+)`/g, (_match, code: string) => {
      // If code contains HTML entities, decode them
      const decoded = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")

      return `\`${decoded}\``
    })

    // Fix list indentation
    processed = processed.replace(/^( +)([*-])/gm, (_match, spaces: string, bullet: string) => {
      const indentLevel = Math.floor(spaces.length / 2)
      return '  '.repeat(indentLevel) + bullet
    })

    // Trim trailing whitespace on each line
    processed = processed
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')

    // Ensure single trailing newline
    processed = processed.trim() + '\n'

    return processed
  }

  /**
   * Add custom Turndown rules for LeetCode content
   */
  private addCustomRules() {
    // Turndown library uses 'any' for node parameters in callbacks
    // These are external library constraints we cannot control
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-redundant-type-constituents */

    // Rule for handling <sup> (superscript) tags
    this.turndown.addRule('superscript', {
      filter: ['sup'],
      replacement: (content) => `^${content}^`,
    })

    // Rule for handling <sub> (subscript) tags
    this.turndown.addRule('subscript', {
      filter: ['sub'],
      replacement: (content) => `~${content}~`,
    })

    // Rule for code blocks with language hints
    this.turndown.addRule('codeWithLanguage', {
      filter: (node: Node) => {
        const element = node as Element
        return (
          element.nodeName === 'CODE' &&
          element.hasAttribute('data-lang') &&
          element.parentNode?.nodeName !== 'PRE'
        )
      },
      replacement: (content: string) => {
        // Language hint is not used in inline code, just wrap in backticks
        return `\`${content}\``
      },
    })

    // Rule for pre-formatted code blocks
    this.turndown.addRule('preformattedCode', {
      filter: (node: Node) => {
        const element = node as Element
        return element.nodeName === 'PRE' && element.firstChild?.nodeName === 'CODE'
      },
      replacement: (content: string, node: Node) => {
        const element = node as Element
        const codeNode = element.firstChild as Element | null
        const lang =
          codeNode?.getAttribute('data-lang') || codeNode?.className?.replace('language-', '') || ''

        // Clean up content
        const cleaned = content
          .replace(/^\n+/, '') // Remove leading newlines
          .replace(/\n+$/, '') // Remove trailing newlines

        return `\n\`\`\`${lang}\n${cleaned}\n\`\`\`\n\n`
      },
    })

    // Rule for handling LeetCode's constraint lists
    this.turndown.addRule('constraints', {
      filter: (node: Node) => {
        const element = node as Element
        return (
          element.nodeName === 'UL' &&
          (element.previousSibling?.textContent?.includes('Constraints') ?? false)
        )
      },
      replacement: (content: string) => {
        return `\n${content}\n`
      },
    })

    // Rule for handling images (download if option enabled)
    this.turndown.addRule('images', {
      filter: 'img',
      replacement: (_content: string, node: Node) => {
        const element = node as Element
        const alt = element.getAttribute('alt') || ''
        const src = element.getAttribute('src') || ''
        const title = element.getAttribute('title') || ''

        if (title) {
          return `![${alt}](${src} "${title}")`
        }
        return `![${alt}](${src})`
      },
    })

    // Rule for handling tables
    this.turndown.addRule('tables', {
      filter: 'table',
      replacement: (content: string) => {
        // Keep tables as HTML for now (Turndown handles basic tables)
        return content
      },
    })
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-redundant-type-constituents */
  }

  /**
   * Convert with image downloading
   */
  async convertWithImages(
    html: string,
    imageDownloader?: (url: string) => Promise<string>,
    options?: ConverterOptions
  ): Promise<string> {
    let markdown = await this.convert(html, options)

    // If image downloader provided, download and update paths
    if (imageDownloader) {
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
      const matches = Array.from(markdown.matchAll(imageRegex))

      for (const match of matches) {
        const [fullMatch, alt, url] = match
        if (url && !url.startsWith('file://') && !url.startsWith('./')) {
          try {
            const localPath = await imageDownloader(url)
            markdown = markdown.replace(fullMatch, `![${alt}](${localPath})`)
          } catch (error) {
            logger.warn(`Failed to download image ${url}:`, error)
          }
        }
      }
    }

    return markdown
  }

  /**
   * Extract text content only (strip all formatting)
   */
  extractText(html: string): string {
    // Remove all HTML tags
    const text = html.replace(/<[^>]+>/g, ' ')

    // Decode HTML entities
    const decoded = text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')

    // Normalize whitespace
    return decoded.replace(/\s+/g, ' ').trim()
  }

  /**
   * Extract code blocks from HTML
   */
  extractCodeBlocks(html: string): Array<{ language: string; code: string }> {
    const codeBlocks: Array<{ language: string; code: string }> = []
    const regex = /<pre><code(?:\s+class="language-(\w+)")?>(.*?)<\/code><\/pre>/gs

    let match
    while ((match = regex.exec(html)) !== null) {
      const [, language = '', code] = match
      if (code) {
        codeBlocks.push({
          language,
          code: this.decodeHtmlEntities(code).trim(),
        })
      }
    }

    return codeBlocks
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
  }
}
