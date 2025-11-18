import type { RawData } from '@/shared/types/src/index.js'

/**
 * Options for content enhancement
 */
export interface EnhancementOptions {
  enabled?: boolean
  [key: string]: unknown
}

/**
 * Base interface for content enhancers
 * Enhancers add additional sections to markdown content
 * independently of the output format
 */
export interface ContentEnhancer {
  /**
   * Check if this enhancer can enhance the given data
   */
  canEnhance(data: RawData): boolean

  /**
   * Enhance the markdown content with additional sections
   * @param markdown - The markdown content to enhance
   * @param data - The raw data containing information to add
   * @param options - Enhancement-specific options
   * @returns Enhanced markdown content
   */
  enhance(markdown: string, data: RawData, options?: EnhancementOptions): string

  /**
   * Get default options for this enhancer
   */
  getDefaultOptions?(): EnhancementOptions
}

