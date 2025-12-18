import { resolve } from 'path'

import { LescaError, PluginError } from '@lesca/error'
import type { Plugin } from '@lesca/shared/types'
import { logger } from '@lesca/shared/utils'

/**
 * Plugin Loader
 * Handles dynamic loading of plugins from node_modules or local paths
 */
export class PluginLoader {
  /**
   * Load a plugin by name or path
   */
  async load(pluginName: string, cwd: string = process.cwd()): Promise<Plugin> {
    try {
      // Security: Prevent path traversal attacks
      if (pluginName.includes('..')) {
        throw new PluginError(
          'PLUGIN_INVALID',
          `Invalid plugin path: "${pluginName}" contains path traversal sequence`,
          { context: { pluginName } }
        )
      }

      let pluginModule: unknown

      // 1. Try resolving as a local path first
      if (pluginName.startsWith('.') || pluginName.startsWith('/')) {
        const absolutePath = resolve(cwd, pluginName)
        logger.debug(`Loading local plugin from: ${absolutePath}`)
        pluginModule = await import(absolutePath)
      } else {
        // 2. Try loading from node_modules
        logger.debug(`Loading plugin from node_modules: ${pluginName}`)
        try {
          pluginModule = await import(pluginName)
        } catch (error) {
          // Fallback: try resolving from cwd/node_modules explicitly if global resolution fails
          const localNodeModulesPath = resolve(cwd, 'node_modules', pluginName)
          logger.debug(`Fallback: Loading from ${localNodeModulesPath}`)
          pluginModule = await import(localNodeModulesPath)
        }
      }

      // 3. Validate and extract plugin
      // Support both default export and named export 'plugin'
      interface PluginModule {
        default?: unknown
        plugin?: unknown
        [key: string]: unknown
      }
      const module = pluginModule as PluginModule
      const plugin: unknown = module.default ?? module.plugin ?? module

      if (!this.isValidPlugin(plugin)) {
        throw new PluginError(
          'PLUGIN_INVALID',
          `Module "${pluginName}" does not export a valid Plugin interface`
        )
      }

      return plugin as Plugin
    } catch (error) {
      if (error instanceof LescaError) {
        throw error
      }
      throw new PluginError(
        'PLUGIN_LOAD_FAILED',
        `Failed to load plugin "${pluginName}": ${error instanceof Error ? error.message : String(error)}`,
        { cause: error instanceof Error ? error : undefined }
      )
    }
  }

  /**
   * Validate if an object implements the Plugin interface
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isValidPlugin(obj: any): boolean {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      typeof obj.name === 'string' &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      typeof obj.version === 'string'
    )
  }
}
