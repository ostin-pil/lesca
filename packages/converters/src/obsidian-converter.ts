import type { Problem, ParsedProblem, Difficulty } from '@lesca/shared/types'

/**
 * Type definitions for JSON parsed data
 */
interface ProblemStats {
  acRate?: string
  totalAccepted?: string
  totalSubmission?: string
}

interface SimilarQuestion {
  titleSlug: string
  title?: string
}

/**
 * Obsidian-specific frontmatter and formatting
 */
export interface ObsidianFrontmatter {
  leetcode_id: string
  frontend_id: string
  title: string
  titleSlug: string
  difficulty: Difficulty
  tags: string[]
  companies?: string[]
  acceptance?: string
  total_accepted?: string
  total_submissions?: string
  similar_problems?: string[]
  has_solution: boolean
  scraped_at: string
  [key: string]: unknown
}

/**
 * Obsidian markdown converter
 * Converts problems to Obsidian-compatible markdown with frontmatter
 */
export class ObsidianConverter {
  /**
   * Convert problem to Obsidian format
   */
  convert(
    problem: Problem | ParsedProblem,
    markdown: string,
    options?: {
      includeBacklinks?: boolean
      tagPrefix?: string
      wikiLinks?: boolean
    }
  ): string {
    const frontmatter = this.generateFrontmatter(problem)
    const content = this.formatContent(markdown, problem, options)

    return this.assembleDocument(frontmatter, content)
  }

  /**
   * Generate YAML frontmatter for Obsidian
   */
  private generateFrontmatter(problem: Problem | ParsedProblem): ObsidianFrontmatter {
    let stats: ProblemStats | null = null
    try {
      stats = problem.stats ? (JSON.parse(problem.stats) as ProblemStats) : null
    } catch {
      stats = null
    }

    let companies: string[] = []
    try {
      if (problem.companyTagStats) {
        const companyData = JSON.parse(problem.companyTagStats) as Record<string, unknown>
        companies = Object.keys(companyData)
      }
    } catch {
      // Ignore parsing errors
    }

    let similarProblems: string[] = []
    try {
      if (problem.similarQuestions) {
        const similar = JSON.parse(problem.similarQuestions) as unknown
        similarProblems = Array.isArray(similar)
          ? similar.map((q: SimilarQuestion) => q.titleSlug)
          : []
      }
    } catch {
      // Ignore parsing errors
    }

    const frontmatter: ObsidianFrontmatter = {
      leetcode_id: problem.questionId,
      frontend_id: problem.questionFrontendId,
      title: problem.title,
      titleSlug: problem.titleSlug,
      difficulty: problem.difficulty,
      tags: problem.topicTags.map((t) => t.slug),
      has_solution: problem.solution?.canSeeDetail || false,
      scraped_at: new Date().toISOString(),
    }

    // Conditionally add optional properties only if they have values
    if (stats?.acRate) {
      frontmatter.acceptance = stats.acRate
    }
    if (stats?.totalAccepted) {
      frontmatter.total_accepted = stats.totalAccepted
    }
    if (stats?.totalSubmission) {
      frontmatter.total_submissions = stats.totalSubmission
    }
    if (companies.length > 0) {
      frontmatter.companies = companies
    }
    if (similarProblems.length > 0) {
      frontmatter.similar_problems = similarProblems
    }

    return frontmatter
  }

  /**
   * Format content for Obsidian
   */
  private formatContent(
    markdown: string,
    problem: Problem,
    options?: {
      includeBacklinks?: boolean
      tagPrefix?: string
      wikiLinks?: boolean
    }
  ): string {
    let content = markdown

    content = this.addMetadataSection(problem, content)

    if (options?.tagPrefix) {
      content = this.formatTags(
        content,
        problem.topicTags.map((t) => t.name),
        options.tagPrefix
      )
    }

    if (options?.wikiLinks) {
      content = this.convertToWikiLinks(content)
    }

    if (options?.includeBacklinks) {
      content = this.addBacklinksSection(content, problem)
    }

    return content
  }

  /**
   * Add metadata section after title
   */
  private addMetadataSection(problem: Problem, content: string): string {
    const metadata: string[] = []

    metadata.push(
      `**Difficulty:** ${this.getDifficultyEmoji(problem.difficulty)} ${problem.difficulty}`
    )

    if (problem.topicTags.length > 0) {
      const tags = problem.topicTags.map((t) => `\`${t.name}\``).join(' ')
      metadata.push(`**Tags:** ${tags}`)
    }

    try {
      const stats: ProblemStats | null = problem.stats
        ? (JSON.parse(problem.stats) as ProblemStats)
        : null
      if (stats) {
        metadata.push(`**Acceptance Rate:** ${String(stats.acRate)}`)
      }
    } catch {
      // Ignore
    }

    metadata.push(`**LeetCode:** [Link](https://leetcode.com/problems/${problem.titleSlug}/)`)

    const metadataBlock = metadata.join('  \n') + '\n\n---\n\n'

    // Insert after the first heading (title)
    const lines = content.split('\n')
    const firstHeadingIndex = lines.findIndex((line) => line.startsWith('#'))

    if (firstHeadingIndex !== -1) {
      lines.splice(firstHeadingIndex + 1, 0, '\n' + metadataBlock)
      return lines.join('\n')
    }

    // If no heading found, prepend
    return metadataBlock + content
  }

  /**
   * Get emoji for difficulty level
   */
  private getDifficultyEmoji(difficulty: Difficulty): string {
    const emojiMap: Record<Difficulty, string> = {
      Easy: '🟢',
      Medium: '🟡',
      Hard: '🔴',
    }
    return emojiMap[difficulty] || '⚪'
  }

  private formatTags(content: string, tags: string[], prefix: string): string {
    const tagSection = '\n\n## Tags\n\n' + tags.map((tag) => `#${prefix}/${tag}`).join(' ') + '\n'

    return content + tagSection
  }

  private convertToWikiLinks(content: string): string {
    return content.replace(/\[([^\]]+)\]\(\/problems\/([^)]+)\/?\)/g, '[[$2|$1]]')
  }

  private addBacklinksSection(content: string, problem: Problem): string {
    if (!problem.similarQuestions) {
      return content
    }

    try {
      const similar = JSON.parse(problem.similarQuestions) as unknown
      if (!Array.isArray(similar) || similar.length === 0) {
        return content
      }

      const backlinks = similar
        .map((q: { titleSlug: string; title: string; difficulty: Difficulty }) => {
          const emoji = this.getDifficultyEmoji(q.difficulty)
          return `- ${emoji} [[${q.titleSlug}|${q.title}]]`
        })
        .join('\n')

      return content + '\n\n## Similar Problems\n\n' + backlinks + '\n'
    } catch {
      return content
    }
  }

  /**
   * Assemble the final document
   */
  private assembleDocument(frontmatter: ObsidianFrontmatter, content: string): string {
    const yaml = this.frontmatterToYaml(frontmatter)
    return `---\n${yaml}---\n\n${content}`
  }

  /**
   * Convert frontmatter object to YAML
   */
  private frontmatterToYaml(frontmatter: ObsidianFrontmatter): string {
    const lines: string[] = []

    for (const [key, value] of Object.entries(frontmatter)) {
      if (value === undefined) continue

      if (Array.isArray(value)) {
        if (value.length === 0) continue
        lines.push(`${key}:`)
        value.forEach((item: string) => {
          lines.push(`  - ${this.escapeYamlValue(item)}`)
        })
      } else if (typeof value === 'string') {
        lines.push(`${key}: ${this.escapeYamlValue(value)}`)
      } else if (typeof value === 'boolean') {
        lines.push(`${key}: ${value}`)
      } else if (typeof value === 'number') {
        lines.push(`${key}: ${value}`)
      } else {
        lines.push(`${key}: ${JSON.stringify(value)}`)
      }
    }

    return lines.join('\n') + '\n'
  }

  /**
   * Escape YAML value if needed
   */
  private escapeYamlValue(value: string): string {
    // Quote if contains special characters
    if (/[:#[\]{}&*!|>'"%@`]/.test(value) || value.includes('\n')) {
      return `"${value.replace(/"/g, '\\"')}"`
    }
    return value
  }

  /**
   * Generate filename for Obsidian
   */
  static generateFilename(
    problem: Problem,
    format: 'slug' | 'id-slug' | 'id-title' = 'id-slug'
  ): string {
    switch (format) {
      case 'slug':
        return `${problem.titleSlug}.md`
      case 'id-slug':
        return `${problem.questionFrontendId}-${problem.titleSlug}.md`
      case 'id-title':
        return `${problem.questionFrontendId}. ${problem.title}.md`
      default:
        return `${problem.questionFrontendId}-${problem.titleSlug}.md`
    }
  }

  /**
   * Generate directory structure
   * e.g., "Easy/Array" or "Medium/Dynamic Programming"
   */
  static generateDirectory(
    problem: Problem,
    structure: 'flat' | 'by-difficulty' | 'by-tag' = 'by-difficulty'
  ): string {
    switch (structure) {
      case 'flat':
        return ''
      case 'by-difficulty':
        return problem.difficulty
      case 'by-tag':
        // Use first tag as directory
        return problem.topicTags[0]?.name || 'Uncategorized'
      default:
        return problem.difficulty
    }
  }
}
