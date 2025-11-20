import type {
  Converter,
  ConverterOptions,
  DiscussionList,
  Discussion,
} from '@/shared/types/src/index.js'
import { ParsingError } from '@lesca/error'


import { HtmlToMarkdownConverter } from './html-to-markdown.js'

/**
 * Discussion to Markdown Converter
 * Converts discussion lists to well-formatted Markdown
 */
export class DiscussionConverter implements Converter {
  readonly from = 'discussion' as const
  readonly to = 'markdown' as const

  private htmlConverter: HtmlToMarkdownConverter

  constructor() {
    this.htmlConverter = new HtmlToMarkdownConverter()
  }

  /**
   * Check if this converter can handle the input
   */
  canConvert(input: unknown): boolean {
    return (
      typeof input === 'object' &&
      input !== null &&
      'discussions' in input &&
      Array.isArray((input as { discussions: unknown }).discussions)
    )
  }

  /**
   * Convert discussion list to Markdown
   */
  async convert(input: unknown, options?: ConverterOptions): Promise<string> {
    const discussionList = input as DiscussionList

    if (
      !discussionList ||
      typeof discussionList !== 'object' ||
      !('discussions' in discussionList)
    ) {
      throw new ParsingError(
        'PARSE_MARKDOWN_FAILED',
        'Invalid discussion list: expected DiscussionList object',
        { context: { inputType: typeof input } }
      )
    }

    const sections: string[] = []

    sections.push(`# Discussions: ${this.formatTitle(discussionList.titleSlug)}`)
    sections.push('')

    sections.push(`**Category**: ${discussionList.category}`)
    sections.push(`**Sort**: ${discussionList.sortBy}`)
    sections.push(`**Total**: ${discussionList.total} discussions`)
    sections.push('')
    sections.push('---')
    sections.push('')

    if (discussionList.discussions.length > 3) {
      sections.push('## Table of Contents')
      sections.push('')
      for (let i = 0; i < discussionList.discussions.length; i++) {
        const discussion = discussionList.discussions[i]
        if (!discussion) continue

        const anchor = this.createAnchor(discussion.title)
        sections.push(
          `${i + 1}. [${discussion.title}](#${anchor}) - by ${discussion.author} (${discussion.votes} votes)`
        )
      }
      sections.push('')
      sections.push('---')
      sections.push('')
    }

    for (let i = 0; i < discussionList.discussions.length; i++) {
      const discussion = discussionList.discussions[i]
      if (!discussion) continue

      const discussionMd = await this.convertSingleDiscussion(discussion, i + 1, options)
      sections.push(discussionMd)
      sections.push('')

      if (i < discussionList.discussions.length - 1) {
        sections.push('---')
        sections.push('')
      }
    }

    return sections.join('\n')
  }

  /**
   * Convert to Obsidian format
   */
  async convertToObsidian(
    discussionList: DiscussionList,
    options?: ConverterOptions
  ): Promise<string> {
    const sections: string[] = []

    sections.push('---')
    sections.push(`title: "Discussions: ${this.formatTitle(discussionList.titleSlug)}"`)
    sections.push(`slug: ${discussionList.titleSlug}`)
    sections.push(`type: discussions`)
    sections.push(`category: ${discussionList.category}`)
    sections.push(`sortBy: ${discussionList.sortBy}`)
    sections.push(`total: ${discussionList.total}`)
    sections.push(`created: ${new Date().toISOString()}`)
    sections.push('tags:')
    sections.push('  - leetcode/discussions')
    sections.push('  - leetcode/solutions')
    sections.push('---')
    sections.push('')

    sections.push(`> [!info] Problem`)
    sections.push(`> [[${discussionList.titleSlug}|${this.formatTitle(discussionList.titleSlug)}]]`)
    sections.push('')

    sections.push(`> [!summary] Summary`)
    sections.push(`> **Category**: ${discussionList.category}`)
    sections.push(`> **Sort**: ${discussionList.sortBy}`)
    sections.push(`> **Discussions**: ${discussionList.total}`)
    sections.push('')

    if (discussionList.discussions.length > 0) {
      sections.push('## Top Discussions')
      sections.push('')

      for (let i = 0; i < discussionList.discussions.length; i++) {
        const discussion = discussionList.discussions[i]
        if (!discussion) continue

        const discussionMd = await this.convertSingleDiscussionObsidian(discussion, i + 1, options)
        sections.push(discussionMd)
        sections.push('')
      }
    }

    return sections.join('\n')
  }

  /**
   * Convert a single discussion to Markdown
   */
  private async convertSingleDiscussion(
    discussion: Discussion,
    index: number,
    options?: ConverterOptions
  ): Promise<string> {
    const sections: string[] = []

    sections.push(`## ${index}. ${discussion.title}`)
    sections.push('')
    sections.push(`**Author**: ${discussion.author}`)
    sections.push(`**Votes**: ${this.formatVotes(discussion.votes)}`)
    if (discussion.timestamp) {
      sections.push(`**Posted**: ${discussion.timestamp}`)
    }
    if (discussion.commentCount > 0) {
      sections.push(`**Comments**: ${discussion.commentCount}`)
    }
    sections.push('')

    // Content
    if (discussion.content) {
      const markdown = await this.htmlConverter.convert(discussion.content, options)
      sections.push(markdown)
      sections.push('')
    }

    if (discussion.comments && discussion.comments.length > 0) {
      sections.push('### Comments')
      sections.push('')

      for (const comment of discussion.comments) {
        sections.push(`> **${comment.author}**: ${comment.content}`)
        if (comment.timestamp) {
          sections.push(`> *${comment.timestamp}*`)
        }
        sections.push('>')
      }
      sections.push('')
    }

    return sections.join('\n')
  }

  /**
   * Convert a single discussion to Obsidian format
   */
  private async convertSingleDiscussionObsidian(
    discussion: Discussion,
    index: number,
    options?: ConverterOptions
  ): Promise<string> {
    const sections: string[] = []

    const voteIcon = discussion.votes > 100 ? '🔥' : discussion.votes > 50 ? '⭐' : '👍'
    sections.push(`> [!tip]+ ${index}. ${discussion.title} ${voteIcon}`)
    sections.push(`> **Author**: ${discussion.author}`)
    sections.push(`> **Votes**: ${this.formatVotes(discussion.votes)}`)
    if (discussion.timestamp) {
      sections.push(`> **Posted**: ${discussion.timestamp}`)
    }
    if (discussion.commentCount > 0) {
      sections.push(`> **Comments**: ${discussion.commentCount}`)
    }
    sections.push('>')

    if (discussion.content) {
      const markdown = await this.htmlConverter.convert(discussion.content, options)
      const lines = markdown.split('\n')
      for (const line of lines) {
        sections.push(`> ${line}`)
      }
      sections.push('>')
    }

    if (discussion.comments && discussion.comments.length > 0) {
      sections.push('>')
      sections.push(`> **Comments (${discussion.comments.length})**:`)
      sections.push('>')

      for (const comment of discussion.comments.slice(0, 5)) {
        sections.push(`> - **${comment.author}**: ${comment.content}`)
      }

      if (discussion.comments.length > 5) {
        sections.push(`> - *...and ${discussion.comments.length - 5} more comments*`)
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
   * Format votes with visual indicators
   */
  private formatVotes(votes: number): string {
    if (votes > 1000) {
      return `${votes} 🔥🔥🔥`
    } else if (votes > 500) {
      return `${votes} 🔥🔥`
    } else if (votes > 100) {
      return `${votes} 🔥`
    } else if (votes > 50) {
      return `${votes} ⭐`
    } else {
      return `${votes}`
    }
  }

  /**
   * Create URL anchor from title
   */
  private createAnchor(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  /**
   * Extract plain text from discussion list
   */
  extractText(discussionList: DiscussionList): string {
    const parts: string[] = []

    for (const discussion of discussionList.discussions) {
      parts.push(`${discussion.title} by ${discussion.author}`)
      if (discussion.content) {
        parts.push(discussion.content)
      }
    }

    return parts.join('\n\n')
  }
}
