import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { set, merge } from 'lodash-es'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

import { getDefaultConfig, ENV_MAPPINGS, getConfigSearchPaths } from './defaults.js'
import type { Config, PartialConfig } from './schema.js'
import { validatePartialConfig, ConfigSchema } from './schema.js'

/**
 * Configuration loader that supports multiple sources:
 * 1. Default configuration
 * 2. Configuration files (YAML/JSON)
 * 3. Environment variables
 * 4. CLI arguments
 */

export interface LoaderOptions {
  configPath?: string
  envPrefix?: string
  allowPartial?: boolean
  searchPaths?: string[]
}

/**
 * Load configuration from a YAML or JSON file
 */
export function loadConfigFile(path: string): PartialConfig {
  if (!existsSync(path)) {
    throw new Error(`Configuration file not found: ${path}`)
  }

  const content = readFileSync(path, 'utf-8')
  const ext = path.split('.').pop()?.toLowerCase()

  let config: unknown
  if (ext === 'json') {
    config = JSON.parse(content)
  } else if (ext === 'yaml' || ext === 'yml') {
    config = parseYaml(content)
  } else {
    throw new Error(`Unsupported configuration file format: ${ext}`)
  }

  return validatePartialConfig(config)
}

/**
 * Find the first existing configuration file from search paths
 */
export function findConfigFile(searchPaths?: string[]): string | null {
  const paths = searchPaths || getConfigSearchPaths()

  for (const path of paths) {
    const resolvedPath = resolve(path)
    if (existsSync(resolvedPath)) {
      return resolvedPath
    }
  }

  return null
}

/**
 * Load configuration from environment variables
 */
export function loadEnvConfig(): PartialConfig {
  const config: Record<string, unknown> = {}

  for (const [envKey, configPath] of Object.entries(ENV_MAPPINGS)) {
    const value = process.env[envKey]
    if (value !== undefined) {
      // Parse boolean and numeric values
      let parsedValue: string | boolean | number = value
      if (value === 'true') parsedValue = true
      else if (value === 'false') parsedValue = false
      else if (!isNaN(Number(value))) parsedValue = Number(value)

      // Set the value in the config object using the path
      set(config, configPath, parsedValue)
    }
  }

  return validatePartialConfig(config)
}

/**
 * Merge multiple configuration objects
 * Priority: CLI > ENV > File > Defaults
 */
export function mergeConfigs(...configs: PartialConfig[]): Config {
  const defaultConfig = getDefaultConfig()
  const merged = configs.reduce(
    (acc, config) => merge(acc, config),
    defaultConfig
  )

  // Validate the final merged configuration
  return ConfigSchema.parse(merged)
}

/**
 * Load configuration from all sources
 */
export function loadConfig(options: LoaderOptions = {}): Config {
  const configs: PartialConfig[] = []

  // 1. Load from configuration file
  let configPath = options.configPath
  if (!configPath) {
    configPath = findConfigFile(options.searchPaths) || undefined
  }

  if (configPath) {
    try {
      const fileConfig = loadConfigFile(configPath)
      configs.push(fileConfig)
      // Configuration loaded successfully (silent)
    } catch (error) {
      // Failed to load configuration file (silent, will use defaults)
    }
  }

  // 2. Load from environment variables
  const envConfig = loadEnvConfig()
  if (Object.keys(envConfig).length > 0) {
    configs.push(envConfig)
    // Environment variables loaded successfully (silent)
  }

  // 3. Merge all configurations
  return mergeConfigs(...configs)
}

/**
 * Load configuration with CLI overrides
 */
export function loadConfigWithCLI(
  cliOptions: PartialConfig,
  loaderOptions: LoaderOptions = {}
): Config {
  const baseConfig = loadConfig(loaderOptions)

  // Apply CLI overrides
  if (Object.keys(cliOptions).length > 0) {
    return mergeConfigs(cliOptions)
  }

  return baseConfig
}

/**
 * Create a configuration from scratch
 */
export function createConfig(overrides: PartialConfig = {}): Config {
  return mergeConfigs(overrides)
}

/**
 * Validate a configuration object
 */
export function validateConfig(config: unknown): Config {
  return ConfigSchema.parse(config)
}

/**
 * Export configuration to YAML format
 */
export function exportConfigToYaml(config: Config): string {
  return stringifyYaml(config, { indent: 2 })
}

/**
 * Export configuration to JSON format
 */
export function exportConfigToJson(config: Config, pretty = true): string {
  return JSON.stringify(config, null, pretty ? 2 : 0)
}