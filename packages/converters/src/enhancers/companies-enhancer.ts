import type { Problem, RawData } from '@/shared/types/src/index.js'

import type { ContentEnhancer, EnhancementOptions } from './content-enhancer.js'

/**
 * Enhancer that adds companies section to problem markdown
 */
export class CompaniesEnhancer implements ContentEnhancer {
  canEnhance(data: RawData): boolean {
    if (data.type !== 'problem') {
      return false
    }

    const problem = data.data as Problem
    if (!problem.companyTagStats) {
      return false
    }

    try {
      const companyData = JSON.parse(problem.companyTagStats) as Record<string, unknown>
      return Object.keys(companyData).length > 0
    } catch {
      return false
    }
  }

  enhance(markdown: string, data: RawData, options?: EnhancementOptions): string {
    if (options?.enabled === false) {
      return markdown
    }

    if (data.type !== 'problem') {
      return markdown
    }

    const problem = data.data as Problem
    let companies: string[] = []

    try {
      if (problem.companyTagStats) {
        const companyData = JSON.parse(problem.companyTagStats) as Record<string, unknown>
        companies = Object.keys(companyData)
      }
    } catch {
      // Ignore parsing errors
      return markdown
    }

    if (companies.length === 0) {
      return markdown
    }

    // Format company names (capitalize and format nicely)
    const formattedCompanies = companies
      .map((company) => {
        // Convert slug to readable name
        return company
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      })
      .sort()
      .map((company) => `- ${company}`)
      .join('\n')

    return markdown + '\n\n## Companies\n\n' + formattedCompanies + '\n'
  }

  getDefaultOptions(): EnhancementOptions {
    return { enabled: true }
  }
}

