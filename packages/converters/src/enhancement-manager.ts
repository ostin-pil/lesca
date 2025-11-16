import type { RawData } from '../../../shared/types/src/index.js'

import type { CodeSnippetsOptions } from './enhancers/code-snippets-enhancer.js';
import { CodeSnippetsEnhancer } from './enhancers/code-snippets-enhancer.js'
import { CompaniesEnhancer } from './enhancers/companies-enhancer.js'
import type { ContentEnhancer, EnhancementOptions } from './enhancers/content-enhancer.js'
import { HintsEnhancer } from './enhancers/hints-enhancer.js'

/**
 * Configuration for enhancements
 */
export interface EnhancementConfig {
  enabled?: boolean
  hints?: {
    enabled?: boolean
  }
  codeSnippets?: {
    enabled?: boolean
    languagePriority?: string[]
  }
  companies?: {
    enabled?: boolean
  }
}

/**
 * Manages content enhancers and applies them based on configuration
 */
export class EnhancementManager {
  private enhancers: ContentEnhancer[]

  constructor(config?: EnhancementConfig) {
    this.enhancers = [
      new HintsEnhancer(),
      new CodeSnippetsEnhancer(),
      new CompaniesEnhancer(),
    ]

    // If enhancements are globally disabled, remove all enhancers
    if (config?.enabled === false) {
      this.enhancers = []
    }
  }

  /**
   * Apply all applicable enhancers to the markdown content
   */
  enhance(markdown: string, data: RawData, config?: EnhancementConfig): string {
    // If enhancements are globally disabled, return as-is
    if (config?.enabled === false) {
      return markdown
    }

    let enhanced = markdown

    for (const enhancer of this.enhancers) {
      if (!enhancer.canEnhance(data)) {
        continue
      }

      // Get options for this specific enhancer
      const options = this.getEnhancerOptions(enhancer, config)
      enhanced = enhancer.enhance(enhanced, data, options)
    }

    return enhanced
  }

  /**
   * Get options for a specific enhancer based on config
   */
  private getEnhancerOptions(
    enhancer: ContentEnhancer,
    config?: EnhancementConfig
  ): EnhancementOptions {
    if (enhancer instanceof HintsEnhancer) {
      return {
        enabled: config?.hints?.enabled ?? true,
      }
    }

    if (enhancer instanceof CodeSnippetsEnhancer) {
      const codeSnippetsConfig: CodeSnippetsOptions = {
        enabled: config?.codeSnippets?.enabled ?? true,
      }
      if (config?.codeSnippets?.languagePriority) {
        codeSnippetsConfig.languagePriority = config.codeSnippets.languagePriority
      }
      return codeSnippetsConfig
    }

    if (enhancer instanceof CompaniesEnhancer) {
      return {
        enabled: config?.companies?.enabled ?? true,
      }
    }

    return { enabled: true }
  }
}

