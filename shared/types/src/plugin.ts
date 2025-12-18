import type { ScrapeRequest, ScrapeResult } from '.'

/**
 * Plugin context passed to onInit
 */
export interface PluginContext {
  /**
   * Plugin configuration options
   */
  config: Record<string, unknown>
  /**
   * Logger instance (namespaced for the plugin)
   */
  logger: {
    debug(message: string, ...args: unknown[]): void
    info(message: string, ...args: unknown[]): void
    warn(message: string, ...args: unknown[]): void
    error(message: string, ...args: unknown[]): void
  }
}

/**
 * Plugin interface
 */
export interface Plugin {
  /**
   * Unique name of the plugin
   */
  name: string

  /**
   * Version of the plugin
   */
  version: string

  /**
   * Description of the plugin
   */
  description?: string

  /**
   * Called when the plugin is initialized
   */
  onInit?(context: PluginContext): Promise<void> | void

  /**
   * Called before a scrape request is executed
   * Can modify the request or throw to cancel
   * Return the modified request, or nothing to use the original
   */
  onScrape?(request: ScrapeRequest): Promise<ScrapeRequest | undefined> | ScrapeRequest | undefined

  /**
   * Called after a scrape request is completed (success or failure)
   * Can modify the result
   * Return the modified result, or nothing to use the original
   */
  onScrapeResult?(
    result: ScrapeResult
  ): Promise<ScrapeResult | undefined> | ScrapeResult | undefined

  /**
   * Called before data is saved to storage
   * Can modify the data
   */
  onSave?(data: unknown): Promise<unknown>

  /**
   * Called when the application is shutting down
   */
  onCleanup?(): Promise<void> | void
}
