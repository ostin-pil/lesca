import { logger } from '@/shared/utils/src/index.js'
import type { Page, Request, Route } from 'playwright'

export interface InterceptorOptions {
  /** Resource types to block (e.g., 'image', 'font') */
  blockResources?: string[]
  /** Regex pattern to capture API responses */
  capturePattern?: RegExp
  /** Custom headers to inject */
  injectHeaders?: Record<string, string>
  /** Custom request modification callback */
  modifyRequest?: (request: Request) => Promise<void> | void
}

/**
 * Request Interceptor
 * Centralized request/response interception logic
 */
export class RequestInterceptor {
  private responses: Map<string, unknown> = new Map()
  private options: InterceptorOptions = {}

  constructor(options: InterceptorOptions = {}) {
    this.options = options
  }

  async attach(page: Page): Promise<void> {
    await page.route('**/*', async (route: Route) => {
      const request = route.request()
      const resourceType = request.resourceType()
      const url = request.url()

      if (this.options.blockResources?.includes(resourceType)) {
        logger.debug(`Blocking resource: ${resourceType} - ${url}`)
        await route.abort()
        return
      }

      const headers = {
        ...request.headers(),
        ...this.options.injectHeaders,
      }

      if (this.options.capturePattern?.test(url)) {
        try {
          const response = await route.fetch({ headers })
          const contentType = response.headers()['content-type']

          if (contentType && contentType.includes('application/json')) {
            try {
              const json = await response.json()
              this.responses.set(url, json)
              logger.debug(`Captured response from: ${url}`)
            } catch (e) {
              logger.warn(`Failed to parse JSON from captured response: ${url}`)
            }
          }

          await route.fulfill({ response })
          return
        } catch (error) {
          logger.warn(`Failed to capture response: ${url}`, { error })
        }
      }

      await route.continue({ headers })
    })

    logger.debug('Request interceptor attached to page')
  }

  getCapturedResponses(): Map<string, unknown> {
    return this.responses
  }

  clearCapturedResponses(): void {
    this.responses.clear()
  }

  updateOptions(options: Partial<InterceptorOptions>): void {
    this.options = { ...this.options, ...options }
  }
}
