import TurndownService from 'turndown'
import type { Converter, ConverterOptions } from '@lesca/shared-types'

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
  async convert(input: unknown, options?: ConverterOptions): Promise<string> {
    if (!this.canConvert(input)) {
      throw new Error('Input must be an HTML string')
    }

    const html = input as string

    // Pre-process HTML
    const cleaned = this.preProcess(html)

    // Convert to markdown
    let markdown = this.turndown.turndown(cleaned)

    // Post-process markdown
    markdown = this.postProcess(markdown, options)

    return markdown
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
  private postProcess(markdown: string, options?: ConverterOptions): string {
    let processed = markdown

    // Fix multiple blank lines
    processed = processed.replace(/\n{3,}/g, '\n\n')

    // Fix code block language hints
    processed = processed.replace(/```(\w+)?\n/g, (match, lang) => {
      return lang ? `\`\`\`${lang}\n` : '```\n'
    })

    // Fix inline code with backticks
    processed = processed.replace(/`([^`]+)`/g, (match, code) => {
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
    processed = processed.replace(/^( +)([*-])/gm, (match, spaces, bullet) => {
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
      filter: (node) => {
        return (
          node.nodeName === 'CODE' &&
          node.hasAttribute('data-lang') &&
          node.parentNode?.nodeName !== 'PRE'
        )
      },
      replacement: (content, node) => {
        const lang = (node as Element).getAttribute('data-lang')
        return `\`${content}\``
      },
    })

    // Rule for pre-formatted code blocks
    this.turndown.addRule('preformattedCode', {
      filter: (node) => {
        return node.nodeName === 'PRE' && node.firstChild?.nodeName === 'CODE'
      },
      replacement: (content, node) => {
        const codeNode = node.firstChild as Element
        const lang = codeNode?.getAttribute('data-lang') || codeNode?.className?.replace('language-', '') || ''

        // Clean up content
        const cleaned = content
          .replace(/^\n+/, '') // Remove leading newlines
          .replace(/\n+$/, '') // Remove trailing newlines

        return `\n\`\`\`${lang}\n${cleaned}\n\`\`\`\n\n`
      },
    })

    // Rule for handling LeetCode's constraint lists
    this.turndown.addRule('constraints', {
      filter: (node) => {
        return (
          node.nodeName === 'UL' &&
          node.previousSibling?.textContent?.includes('Constraints')
        )
      },
      replacement: (content) => {
        return `\n${content}\n`
      },
    })

    // Rule for handling images (download if option enabled)
    this.turndown.addRule('images', {
      filter: 'img',
      replacement: (content, node) => {
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
      replacement: (content, node) => {
        // Keep tables as HTML for now (Turndown handles basic tables)
        return content
      },
    })
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
            console.warn(`Failed to download image ${url}:`, error)
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
      codeBlocks.push({
        language,
        code: this.decodeHtmlEntities(code).trim(),
      })
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
