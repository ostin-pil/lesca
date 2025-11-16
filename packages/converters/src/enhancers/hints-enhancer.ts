import type { Problem, RawData } from '../../../../shared/types/src/index.js'

import type { ContentEnhancer, EnhancementOptions } from './content-enhancer.js'

/**
 * Enhancer that adds hints section to problem markdown
 */
export class HintsEnhancer implements ContentEnhancer {
  canEnhance(data: RawData): boolean {
    return data.type === 'problem' && !!(data.data as Problem).hints?.length
  }

  enhance(markdown: string, data: RawData, options?: EnhancementOptions): string {
    if (options?.enabled === false) {
      return markdown
    }

    if (data.type !== 'problem') {
      return markdown
    }

    const problem = data.data as Problem
    if (!problem.hints || problem.hints.length === 0) {
      return markdown
    }

    const hints = problem.hints
      .map((hint, index) => `${index + 1}. ${hint}`)
      .join('\n')

    return markdown + '\n\n## Hints\n\n' + hints + '\n'
  }

  getDefaultOptions(): EnhancementOptions {
    return { enabled: true }
  }
}

