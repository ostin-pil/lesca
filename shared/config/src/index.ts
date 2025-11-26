/**
 * Lesca Configuration System
 *
 * Provides centralized configuration management with:
 * - Multi-source loading (files, env vars, CLI)
 * - Runtime validation with Zod
 * - Type-safe access
 * - Hot reloading
 * - Event notifications
 */

// Main exports
export {
  ConfigManager,
  configManager,
  getConfig,
  getConfigValue,
  isEnabled,
} from './config-manager'

// Schema and types
export {
  ConfigSchema,
  PartialConfigSchema,
  validateConfig,
  validatePartialConfig,
  createDefaultConfig,
  type Config,
  type PartialConfig,
  type AuthConfig,
  type ApiConfig,
  type StorageConfig,
  type OutputConfig,
  type ScrapingConfig,
  type ProcessingConfig,
  type BrowserConfig,
  type CacheConfig,
  type LoggingConfig,
  type PluginConfig,
} from './schema'

// Loader functions
export {
  loadConfig,
  loadConfigWithCLI,
  loadConfigFile,
  loadEnvConfig,
  findConfigFile,
  mergeConfigs,
  createConfig,
  exportConfigToYaml,
  exportConfigToJson,
  type LoaderOptions,
} from './loader'

// Default values and paths
export { getDefaultConfig, getDefaultPaths, getConfigSearchPaths, ENV_MAPPINGS } from './defaults'

// Constants
// eslint-disable-next-line import/extensions
export * from './constants'
