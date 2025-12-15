import { LescaError } from '@lesca/error'
import type { Plugin, PluginContext, ScrapeRequest, ScrapeResult } from '@lesca/shared/types'
import { logger } from '@lesca/shared/utils'

import { PluginLoader } from './plugin-loader'

/**
 * Plugin Manager
 * Handles loading, initialization, and execution of plugins
 */
export class PluginManager {
  private plugins: Plugin[] = []
  private initialized = false
  private context: PluginContext
  private loader: PluginLoader
  private pluginNames: string[] = []

  constructor(config: Record<string, unknown> = {}, pluginNames: string[] = []) {
    this.context = {
      config,
      logger: {
        debug: (msg, ...args) => logger.debug(`[Plugin] ${msg}`, ...args),
        info: (msg, ...args) => logger.info(`[Plugin] ${msg}`, ...args),
        warn: (msg, ...args) => logger.warn(`[Plugin] ${msg}`, ...args),
        error: (msg, ...args) => logger.error(`[Plugin] ${msg}`, ...args),
      },
    }
    this.loader = new PluginLoader()
    this.pluginNames = pluginNames
  }

  /**
   * Register a plugin
   */
  register(plugin: Plugin): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      logger.warn(`Plugin "${plugin.name}" is already registered. Skipping.`)
      return
    }
    this.plugins.push(plugin)
    logger.debug(`Registered plugin: ${plugin.name} v${plugin.version}`)
  }

  /**
   * Initialize all registered plugins
   */
  async init(): Promise<void> {
    if (this.initialized) return

    // Load dynamic plugins first
    if (this.pluginNames.length > 0) {
      logger.debug(`Loading ${this.pluginNames.length} plugins from config...`)
      for (const name of this.pluginNames) {
        try {
          const plugin = await this.loader.load(name)
          this.register(plugin)
        } catch (error) {
          logger.error(
            `Failed to load plugin "${name}":`,
            error instanceof Error ? error : new Error(String(error))
          )
        }
      }
    }

    logger.debug(`Initializing ${this.plugins.length} plugins...`)

    for (const plugin of this.plugins) {
      try {
        if (plugin.onInit) {
          await plugin.onInit(this.context)
        }
      } catch (error) {
        logger.error(
          `Failed to initialize plugin "${plugin.name}":`,
          error instanceof Error ? error : new Error(String(error))
        )
        // We continue initializing other plugins even if one fails
      }
    }

    this.initialized = true
  }

  /**
   * Execute onScrape hooks
   */
  async onScrape(request: ScrapeRequest): Promise<ScrapeRequest> {
    let currentRequest = request

    for (const plugin of this.plugins) {
      try {
        if (plugin.onScrape) {
          const result = await plugin.onScrape(currentRequest)
          if (result) {
            currentRequest = result
          }
        }
      } catch (error) {
        logger.error(
          `Plugin "${plugin.name}" failed in onScrape:`,
          error instanceof Error ? error : new Error(String(error))
        )
        // If a plugin fails, we continue with the current request state
      }
    }

    return currentRequest
  }

  /**
   * Execute onScrapeResult hooks
   */
  async onScrapeResult(result: ScrapeResult): Promise<ScrapeResult> {
    let currentResult = result

    for (const plugin of this.plugins) {
      try {
        if (plugin.onScrapeResult) {
          const modified = await plugin.onScrapeResult(currentResult)
          if (modified) {
            currentResult = modified
          }
        }
      } catch (error) {
        logger.error(
          `Plugin "${plugin.name}" failed in onScrapeResult:`,
          error instanceof Error ? error : new Error(String(error))
        )
      }
    }

    return currentResult
  }

  /**
   * Execute onSave hooks
   */
  async onSave(data: unknown): Promise<unknown> {
    let currentData = data

    for (const plugin of this.plugins) {
      try {
        if (plugin.onSave) {
          const modified = await plugin.onSave(currentData)
          if (modified !== undefined) {
            currentData = modified
          }
        }
      } catch (error) {
        logger.error(
          `Plugin "${plugin.name}" failed in onSave:`,
          error instanceof Error ? error : new Error(String(error))
        )
      }
    }

    return currentData
  }

  /**
   * Cleanup all plugins
   */
  async cleanup(): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        if (plugin.onCleanup) {
          await plugin.onCleanup()
        }
      } catch (error) {
        logger.error(
          `Plugin "${plugin.name}" failed in onCleanup:`,
          error instanceof Error ? error : new Error(String(error))
        )
      }
    }
    this.initialized = false
  }

  /**
   * Get registered plugins
   */
  getPlugins(): Plugin[] {
    return [...this.plugins]
  }
}
