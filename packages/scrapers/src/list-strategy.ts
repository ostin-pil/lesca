import type {
  ScraperStrategy,
  ScrapeRequest,
  ListScrapeRequest,
  RawData,
} from '@lesca/shared-types'
import { GraphQLError } from '@lesca/shared-types'
import type { GraphQLClient } from '@lesca/api-client'

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
      throw new Error(`ListScraperStrategy cannot handle request type: ${request.type}`)
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
        `Failed to scrape problem list: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined
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
        `Failed to scrape all problems: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined
      )
    }
  }
}
