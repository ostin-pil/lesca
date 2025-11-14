import { EventEmitter } from 'events'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'

import { getDefaultPaths } from './defaults.js'
import {
  loadConfig,
  loadConfigWithCLI,
  mergeConfigs,
  findConfigFile,
  exportConfigToYaml,
  exportConfigToJson
} from './loader.js'
import type { Config, PartialConfig } from './schema.js'
import { createDefaultConfig } from './schema.js'

/**
 * ConfigManager - Central configuration management for Lesca
 *
 * Features:
 * - Singleton pattern for global config access
 * - Multi-source configuration loading
 * - Runtime configuration updates
 * - Configuration validation
 * - Event-based change notifications
 */

export class ConfigManager extends EventEmitter {
  private static instance: ConfigManager | null = null
  private config: Config
  private configPath?: string
  private cliOverrides: PartialConfig = {}

  private constructor(config: Config, configPath?: string) {
    super()
    this.config = config
    if (configPath) {
      this.configPath = configPath
    }
  }

  /**
   * Get the singleton instance of ConfigManager
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(createDefaultConfig())
    }
    return ConfigManager.instance
  }

  /**
   * Initialize the ConfigManager with configuration
   */
  public static initialize(options: {
    configPath?: string
    cliOptions?: PartialConfig
    searchPaths?: string[]
  } = {}): ConfigManager {
    const { configPath, cliOptions = {}, searchPaths } = options

    // Load configuration from all sources
    let config: Config
    const loaderOpts: { configPath?: string; searchPaths?: string[] } = {}
    if (configPath) loaderOpts.configPath = configPath
    if (searchPaths) loaderOpts.searchPaths = searchPaths

    if (Object.keys(cliOptions).length > 0) {
      config = loadConfigWithCLI(cliOptions, loaderOpts)
    } else {
      config = loadConfig(loaderOpts)
    }

    // Find the actual config file path used
    const actualConfigPath = configPath || findConfigFile(searchPaths) || undefined

    // Create or update the singleton instance
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(config, actualConfigPath)
    } else {
      ConfigManager.instance.config = config
      if (actualConfigPath) {
        ConfigManager.instance.configPath = actualConfigPath
      }
      ConfigManager.instance.emit('config-changed', config)
    }

    ConfigManager.instance.cliOverrides = cliOptions || {}

    return ConfigManager.instance
  }

  /**
   * Get the current configuration
   */
  public getConfig(): Config {
    return { ...this.config }
  }

  /**
   * Get a specific configuration value by path
   */
  public get<T = unknown>(path: string): T | undefined {
    const keys = path.split('.')
    let value: unknown = this.config

    for (const key of keys) {
      if (value === null || value === undefined) {
        return undefined
      }
      if (typeof value === 'object' && value !== null && key in value) {
        value = (value as Record<string, unknown>)[key]
      } else {
        return undefined
      }
    }

    return value as T
  }

  /**
   * Update configuration with partial values
   */
  public update(updates: PartialConfig): void {
    this.config = mergeConfigs(updates)
    this.emit('config-changed', this.config)
  }

  /**
   * Reset configuration to defaults
   */
  public reset(): void {
    this.config = createDefaultConfig()
    this.emit('config-reset', this.config)
  }

  /**
   * Reload configuration from disk
   */
  public reload(): void {
    const loaderOpts = this.configPath ? { configPath: this.configPath } : {}
    const config = loadConfigWithCLI(this.cliOverrides, loaderOpts)
    this.config = config
    this.emit('config-reloaded', config)
  }

  /**
   * Save configuration to file
   */
  public save(path?: string, format: 'yaml' | 'json' = 'yaml'): void {
    const savePath = path || this.configPath || getDefaultPaths().configFile

    // Ensure directory exists
    const dir = dirname(savePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // Export configuration
    let content: string
    if (format === 'json') {
      content = exportConfigToJson(this.config)
    } else {
      content = exportConfigToYaml(this.config)
    }

    // Write to file
    writeFileSync(savePath, content, 'utf-8')
    this.configPath = savePath

    this.emit('config-saved', savePath)
  }

  /**
   * Create default configuration file
   */
  public createDefaultConfigFile(path?: string): string {
    const configPath = path || getDefaultPaths().configFile
    const defaultConfig = createDefaultConfig()

    // Ensure directory exists
    const dir = dirname(configPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // Write default config
    const content = exportConfigToYaml(defaultConfig)
    writeFileSync(configPath, content, 'utf-8')

    return configPath
  }

  /**
   * Get configuration for a specific module
   */
  public getModuleConfig<K extends keyof Config>(module: K): Config[K] {
    return this.config[module]
  }

  /**
   * Check if a feature is enabled
   */
  public isFeatureEnabled(feature: string): boolean {
    const value = this.get<boolean>(feature)
    return value === true
  }

  /**
   * Get all configuration paths
   */
  public getPaths() {
    return {
      config: this.configPath,
      ...getDefaultPaths(),
    }
  }

  /**
   * Validate a partial configuration
   */
  public validate(config: unknown): boolean {
    try {
      mergeConfigs(config as PartialConfig)
      return true
    } catch {
      return false
    }
  }

  /**
   * Export current configuration
   */
  public export(format: 'yaml' | 'json' = 'yaml'): string {
    if (format === 'json') {
      return exportConfigToJson(this.config)
    }
    return exportConfigToYaml(this.config)
  }

  /**
   * Get configuration with CLI overrides applied
   */
  public getEffectiveConfig(): Config {
    if (Object.keys(this.cliOverrides).length > 0) {
      return mergeConfigs(this.cliOverrides)
    }
    return this.getConfig()
  }

  /**
   * Set CLI overrides
   */
  public setCLIOverrides(overrides: PartialConfig): void {
    this.cliOverrides = overrides
    this.emit('cli-overrides-changed', overrides)
  }
}

// Export convenience functions
export const configManager = ConfigManager.getInstance()

/**
 * Quick access to get configuration
 */
export function getConfig(): Config {
  return configManager.getConfig()
}

/**
 * Quick access to get a configuration value
 */
export function getConfigValue<T = unknown>(path: string): T | undefined {
  return configManager.get<T>(path)
}

/**
 * Quick access to check if a feature is enabled
 */
export function isEnabled(feature: string): boolean {
  return configManager.isFeatureEnabled(feature)
}