import type { Problem, RawData, CodeSnippet } from '@/shared/types/src/index.js'

import type { ContentEnhancer, EnhancementOptions } from './content-enhancer.js'

/**
 * Options for code snippets enhancement
 */
export interface CodeSnippetsOptions extends EnhancementOptions {
  languagePriority?: string[]
}

/**
 * Enhancer that adds code snippets section to problem markdown
 */
export class CodeSnippetsEnhancer implements ContentEnhancer {
  canEnhance(data: RawData): boolean {
    return data.type === 'problem' && !!(data.data as Problem).codeSnippets?.length
  }

  enhance(markdown: string, data: RawData, options?: CodeSnippetsOptions): string {
    if (options?.enabled === false) {
      return markdown
    }

    if (data.type !== 'problem') {
      return markdown
    }

    const problem = data.data as Problem
    if (!problem.codeSnippets || problem.codeSnippets.length === 0) {
      return markdown
    }

        const languagePriority =
      options?.languagePriority || ['python3', 'java', 'cpp', 'javascript', 'typescript', 'c']
    const languageOrder = new Map<string, number>()
    languagePriority.forEach((lang, index) => {
      languageOrder.set(lang, index)
    })

        const sortedSnippets = [...problem.codeSnippets].sort((a: CodeSnippet, b: CodeSnippet) => {
      const aOrder = languageOrder.get(a.langSlug) ?? 999
      const bOrder = languageOrder.get(b.langSlug) ?? 999
      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }
      return a.lang.localeCompare(b.lang)
    })

    const codeBlocks = sortedSnippets
      .map((snippet) => {
        return `### ${snippet.lang}\n\n\`\`\`${snippet.langSlug}\n${snippet.code}\n\`\`\``
      })
      .join('\n\n')

    return markdown + '\n\n## Code Templates\n\n' + codeBlocks + '\n'
  }

  getDefaultOptions(): CodeSnippetsOptions {
    return {
      enabled: true,
      languagePriority: ['python3', 'java', 'cpp', 'javascript', 'typescript', 'c'],
    }
  }
}

