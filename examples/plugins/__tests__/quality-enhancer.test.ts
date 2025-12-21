import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { PluginContext, ScrapeResult, ProcessedData, RawData } from '@lesca/shared/types'
import { createProblem, createProblemRequest } from '../../../tests/factories/problem-factory'

import { qualityEnhancerPlugin } from '../quality-enhancer'

describe('Quality Enhancer Plugin', () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }

  const mockContext: PluginContext = {
    config: {},
    logger: mockLogger,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    qualityEnhancerPlugin.onInit?.(mockContext)
  })

  describe('onInit', () => {
    it('should initialize and log message', () => {
      expect(mockLogger.info).toHaveBeenCalledWith('Quality Enhancer plugin initialized')
    })
  })

  describe('onScrapeResult', () => {
    function createMockResult(problemOverrides = {}): ScrapeResult {
      const problem = createProblem(problemOverrides)
      const rawData: RawData = {
        type: 'problem',
        data: problem,
        metadata: {
          scrapedAt: new Date(),
          source: 'graphql',
        },
      }

      const processedData: ProcessedData = {
        type: 'problem',
        content: '# Test Problem\n\nContent here',
        frontmatter: {
          title: problem.title,
          difficulty: problem.difficulty,
        },
        metadata: {
          originalData: rawData,
          processors: ['html-to-markdown'],
          processedAt: new Date(),
        },
      }

      return {
        success: true,
        request: createProblemRequest({ titleSlug: problem.titleSlug }),
        data: processedData,
      }
    }

    it('should pass through failed results unchanged', () => {
      const failedResult: ScrapeResult = {
        success: false,
        request: createProblemRequest(),
        error: new Error('Test error'),
      }

      const result = qualityEnhancerPlugin.onScrapeResult?.(failedResult)
      expect(result).toEqual(failedResult)
    })

    it('should pass through non-problem results unchanged', () => {
      const listResult: ScrapeResult = {
        success: true,
        request: { type: 'list' },
        data: {
          type: 'list',
          content: 'list content',
          frontmatter: {},
          metadata: {
            originalData: {
              type: 'list',
              data: { questions: [] },
              metadata: { scrapedAt: new Date() },
            },
            processors: [],
            processedAt: new Date(),
          },
        },
      }

      const result = qualityEnhancerPlugin.onScrapeResult?.(listResult)
      expect(result).toEqual(listResult)
    })

    it('should calculate quality score from likes/dislikes', () => {
      const mockResult = createMockResult({ likes: 1000, dislikes: 100 })
      const result = qualityEnhancerPlugin.onScrapeResult?.(mockResult)

      expect(result?.data?.frontmatter.quality_metrics).toBeDefined()
      const metrics = result?.data?.frontmatter.quality_metrics as { qualityScore: number }
      // 1000/(1000+100) = 90.9%, plus engagement bonus
      expect(metrics.qualityScore).toBeGreaterThan(80)
      expect(metrics.qualityScore).toBeLessThanOrEqual(100)
    })

    it('should return 50 for problems with no votes', () => {
      const mockResult = createMockResult({ likes: 0, dislikes: 0 })
      const result = qualityEnhancerPlugin.onScrapeResult?.(mockResult)

      const metrics = result?.data?.frontmatter.quality_metrics as { qualityScore: number }
      expect(metrics.qualityScore).toBe(50)
    })

    it('should calculate difficulty rating based on difficulty and acceptance rate', () => {
      const mockResult = createMockResult({
        difficulty: 'Hard',
        stats: JSON.stringify({ acRate: '20.0%' }),
      })
      const result = qualityEnhancerPlugin.onScrapeResult?.(mockResult)

      const metrics = result?.data?.frontmatter.quality_metrics as { difficultyRating: number }
      // Hard base is 8, low acceptance rate adds more
      expect(metrics.difficultyRating).toBeGreaterThanOrEqual(8)
      expect(metrics.difficultyRating).toBeLessThanOrEqual(10)
    })

    it('should set estimated time based on difficulty', () => {
      const easyResult = createMockResult({ difficulty: 'Easy' })
      const mediumResult = createMockResult({ difficulty: 'Medium' })
      const hardResult = createMockResult({ difficulty: 'Hard' })

      const easyMetrics = qualityEnhancerPlugin.onScrapeResult?.(easyResult)?.data?.frontmatter
        .quality_metrics as { estimatedTime: number }
      const mediumMetrics = qualityEnhancerPlugin.onScrapeResult?.(mediumResult)?.data?.frontmatter
        .quality_metrics as { estimatedTime: number }
      const hardMetrics = qualityEnhancerPlugin.onScrapeResult?.(hardResult)?.data?.frontmatter
        .quality_metrics as { estimatedTime: number }

      expect(easyMetrics.estimatedTime).toBe(15)
      expect(mediumMetrics.estimatedTime).toBe(30)
      expect(hardMetrics.estimatedTime).toBe(60)
    })

    it('should extract categories from topic tags', () => {
      const mockResult = createMockResult({
        topicTags: [
          { name: 'Array', slug: 'array' },
          { name: 'Dynamic Programming', slug: 'dynamic-programming' },
          { name: 'Hash Table', slug: 'hash-table' },
        ],
      })
      const result = qualityEnhancerPlugin.onScrapeResult?.(mockResult)

      const metrics = result?.data?.frontmatter.quality_metrics as { categories: string[] }
      expect(metrics.categories).toContain('Arrays & Strings')
      expect(metrics.categories).toContain('Dynamic Programming')
      expect(metrics.categories).toContain('Hash Tables')
    })

    it('should mark high-quality, reasonable-difficulty problems as recommended', () => {
      const goodProblem = createMockResult({
        likes: 1000,
        dislikes: 50,
        difficulty: 'Medium',
        stats: JSON.stringify({ acRate: '45.0%' }),
      })
      const result = qualityEnhancerPlugin.onScrapeResult?.(goodProblem)

      const metrics = result?.data?.frontmatter.quality_metrics as { recommended: boolean }
      expect(metrics.recommended).toBe(true)
    })

    it('should not recommend low-quality problems', () => {
      const badProblem = createMockResult({
        likes: 100,
        dislikes: 900,
        difficulty: 'Easy',
      })
      const result = qualityEnhancerPlugin.onScrapeResult?.(badProblem)

      const metrics = result?.data?.frontmatter.quality_metrics as { recommended: boolean }
      expect(metrics.recommended).toBe(false)
    })

    it('should add quality metrics section to content', () => {
      const mockResult = createMockResult()
      const result = qualityEnhancerPlugin.onScrapeResult?.(mockResult)

      expect(result?.data?.content).toContain('## Quality Metrics')
      expect(result?.data?.content).toContain('Quality Score')
      expect(result?.data?.content).toContain('Difficulty Rating')
      expect(result?.data?.content).toContain('Estimated Time')
    })

    it('should add processor name to metadata', () => {
      const mockResult = createMockResult()
      const result = qualityEnhancerPlugin.onScrapeResult?.(mockResult)

      expect(result?.data?.metadata.processors).toContain('quality-enhancer')
    })
  })

  describe('onCleanup', () => {
    it('should log cleanup message', () => {
      qualityEnhancerPlugin.onCleanup?.()
      expect(mockLogger.info).toHaveBeenCalledWith('Quality Enhancer plugin cleaned up')
    })
  })
})
