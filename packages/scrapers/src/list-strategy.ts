import { ScrapingError, GraphQLError } from '@lesca/error'

import type { GraphQLClient } from '@/api-client/src/graphql-client'
import type {
  ScraperStrategy,
  ScrapeRequest,
  ListScrapeRequest,
  RawData,
} from '@/shared/types/src/index'

/**
 * List scraper strategy
 * Handles scraping of problem lists with filtering
 */
export class ListScraperStrategy implements ScraperStrategy {
  readonly name = 'list'
  readonly priority = 90 // Lower priority than individual problem

  constructor(private graphqlClient: GraphQLClient) {}

  /**
   * Check if this strategy can handle the request
   */
  canHandle(request: ScrapeRequest): boolean {
    return request.type === 'list'
  }

  /**
   * Execute the scraping strategy
   */
  async execute(request: ScrapeRequest): Promise<RawData> {
    if (!this.canHandle(request)) {
      throw new ScrapingError(
        'SCRAPE_NO_STRATEGY',
        `ListScraperStrategy cannot handle request type: ${request.type}`,
        { context: { requestType: request.type, strategyName: this.name } }
      )
    }

    const listRequest = request as ListScrapeRequest

    try {
      // Determine if we should fetch all or paginated
      const limit = listRequest.limit ?? 50
      const offset = listRequest.offset ?? 0

      // Fetch problem list from GraphQL
      const problemList = await this.graphqlClient.getProblemList(
        listRequest.filters,
        limit,
        offset
      )

      // Apply sorting if requested
      if (listRequest.sort) {
        const { field, order } = listRequest.sort
        // Clone array to ensure we don't mutate read-only arrays and sort works as expected
        problemList.questions = [...problemList.questions].sort((a, b) => {
          let comparison = 0
          if (field === 'quality') {
            comparison = (a.quality || 0) - (b.quality || 0)
          } else if (field === 'acRate') {
            comparison = (a.acRate || 0) - (b.acRate || 0)
          } else if (field === 'difficulty') {
            const difficultyMap: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 }
            comparison = (difficultyMap[a.difficulty] || 0) - (difficultyMap[b.difficulty] || 0)
          }

          return order === 'asc' ? comparison : -comparison
        })
      }

      // Return raw data
      return {
        type: 'list',
        data: problemList,
        metadata: {
          scrapedAt: new Date(),
          source: 'graphql',
          url: 'https://leetcode.com/problemset/all/',
        },
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }

      throw new GraphQLError(
        'GQL_QUERY_FAILED',
        `Failed to scrape problem list: ${error instanceof Error ? error.message : String(error)}`,
        { ...(error instanceof Error ? { cause: error } : {}) }
      )
    }
  }

  /**
   * Fetch all problems matching filters (handles pagination)
   */
  async executeAll(listRequest: ListScrapeRequest): Promise<RawData> {
    try {
      const problemList = await this.graphqlClient.getAllProblems(listRequest.filters)

      return {
        type: 'list',
        data: problemList,
        metadata: {
          scrapedAt: new Date(),
          source: 'graphql',
          url: 'https://leetcode.com/problemset/all/',
        },
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }

      throw new GraphQLError(
        'GQL_QUERY_FAILED',
        `Failed to scrape all problems: ${error instanceof Error ? error.message : String(error)}`,
        { ...(error instanceof Error ? { cause: error } : {}) }
      )
    }
  }
}
