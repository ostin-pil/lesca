import type { GraphQLClient } from '@/packages/api-client/src/graphql-client.js'
import type {
  ScraperStrategy,
  ScrapeRequest,
  ProblemScrapeRequest,
  RawData,
  Problem,
} from '@/shared/types/src/index.js'
import { GraphQLError } from '@/shared/types/src/index.js'
import { ScrapingError } from '@lesca/error'


/**
 * Problem scraper strategy
 * Handles scraping of individual problems
 */
export class ProblemScraperStrategy implements ScraperStrategy {
  readonly name = 'problem'
  readonly priority = 100 // High priority

  constructor(private graphqlClient: GraphQLClient) {}

  /**
   * Check if this strategy can handle the request
   */
  canHandle(request: ScrapeRequest): boolean {
    return request.type === 'problem'
  }

  /**
   * Execute the scraping strategy
   */
  async execute(request: ScrapeRequest): Promise<RawData> {
    if (!this.canHandle(request)) {
      throw new ScrapingError(
        'SCRAPE_NO_STRATEGY',
        `ProblemScraperStrategy cannot handle request type: ${request.type}`,
        { context: { requestType: request.type, strategyName: this.name } }
      )
    }

    const problemRequest = request as ProblemScrapeRequest

    try {
      // Fetch problem from GraphQL
      const problem = await this.graphqlClient.getProblem(problemRequest.titleSlug)

      // Validate problem data
      this.validateProblem(problem)

      // Return raw data
      return {
        type: 'problem',
        data: problem,
        metadata: {
          scrapedAt: new Date(),
          source: 'graphql',
          url: `https://leetcode.com/problems/${problemRequest.titleSlug}/`,
        },
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }

      throw new GraphQLError(
        `Failed to scrape problem ${problemRequest.titleSlug}: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Validate problem data
   */
  private validateProblem(problem: Problem): void {
    if (!problem.questionId) {
      throw new GraphQLError('Invalid problem: missing questionId')
    }

    if (!problem.title) {
      throw new GraphQLError('Invalid problem: missing title')
    }

    if (!problem.content) {
      throw new GraphQLError('Invalid problem: missing content')
    }
  }
}
