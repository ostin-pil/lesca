import { z } from 'zod'

/**
 * Zod schema for Lesca configuration validation
 * Ensures type safety and provides runtime validation
 */

// Authentication configuration
const AuthConfigSchema = z.object({
  method: z.enum(['cookie', 'none']).default('cookie'),
  cookiePath: z.string().optional(),
  sessionTimeout: z.number().min(0).default(3600),
  autoRefresh: z.boolean().default(true),
  autoSave: z.boolean().default(true),
  validateOnLoad: z.boolean().default(true),
  secureStorage: z.enum(['keytar', 'file']).default('file'),
})

// API configuration
const ApiConfigSchema = z.object({
  endpoint: z.string().url().default('https://leetcode.com/graphql'),
  timeout: z.number().min(1000).default(30000),
  retries: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(100).default(1000),
  rateLimit: z
    .object({
      enabled: z.boolean().default(true),
      requestsPerMinute: z.number().min(1).default(30),
      minDelay: z.number().min(0).default(2000),
      maxDelay: z.number().min(0).default(10000),
      jitter: z.boolean().default(true),
    })
    .default({}),
})

// Storage configuration
const StorageConfigSchema = z.object({
  type: z.enum(['filesystem', 'sqlite']).default('filesystem'),
  path: z.string().default('./output'),
  database: z.string().optional(),
  options: z.record(z.unknown()).default({}),
})

// Output configuration
const OutputConfigSchema = z.object({
  format: z.enum(['markdown', 'obsidian', 'json']).default('markdown'),
  pattern: z.string().default('{slug}.md'),
  frontmatter: z.boolean().default(true),
  images: z
    .object({
      download: z.boolean().default(false),
      directory: z.string().default('images'),
      pattern: z.string().default('{slug}-{index}.{ext}'),
    })
    .default({}),
})

// Scraping configuration
const ScrapingConfigSchema = z.object({
  strategies: z.array(z.enum(['problem', 'list', 'editorial', 'discussion'])).default(['problem']),
  concurrency: z.number().min(1).max(10).default(3),
  batchSize: z.number().min(1).max(100).default(10),
  delay: z.number().min(0).default(1000),
  timeout: z.number().min(5000).default(60000),
  discussion: z
    .object({
      defaultLimit: z.number().min(1).max(100).default(10),
      defaultSort: z.enum(['hot', 'most-votes', 'recent']).default('hot'),
    })
    .default({}),
})

// Processing configuration
const ProcessingConfigSchema = z.object({
  converters: z.array(z.string()).default(['html-to-markdown']),
  pipeline: z.array(z.string()).optional(),
  options: z.record(z.unknown()).default({}),
  enhancements: z
    .object({
      enabled: z.boolean().default(true),
      hints: z
        .object({
          enabled: z.boolean().default(true),
        })
        .default({}),
      codeSnippets: z
        .object({
          enabled: z.boolean().default(true),
          languagePriority: z
            .array(z.string())
            .default(['python3', 'java', 'cpp', 'javascript', 'typescript', 'c']),
        })
        .default({}),
      companies: z
        .object({
          enabled: z.boolean().default(true),
        })
        .default({}),
    })
    .default({}),
})

// Browser configuration
const BrowserConfigSchema = z.object({
  enabled: z.boolean().default(true),
  headless: z.boolean().default(true),
  executable: z.string().optional(),
  args: z.array(z.string()).default([]),
  timeout: z.number().min(5000).default(30000),
  viewport: z
    .object({
      width: z.number().min(320).default(1920),
      height: z.number().min(240).default(1080),
    })
    .default({}),
  blockedResources: z.array(z.string()).default(['image', 'font', 'media']),
  session: z
    .object({
      enabled: z.boolean().default(false),
      name: z.string().default('default'),
      autoSave: z.boolean().default(true),
      autoRestore: z.boolean().default(true),
      saveOnExit: z.boolean().default(false), // Persist final state on command completion
    })
    .default({}),
  pool: z
    .object({
      enabled: z.boolean().default(true),
      strategy: z.enum(['per-session']).default('per-session'), // Start simple, add 'global' | 'hybrid' in Phase 2
      minSize: z.number().min(0).default(0),
      maxSize: z.number().min(1).default(2), // Conservative default
      maxIdleTime: z.number().default(180000), // 3 minutes
      reusePages: z.boolean().default(true),
      acquireTimeout: z.number().default(30000), // 30s timeout for pool.acquire()
      retryOnFailure: z.boolean().default(true), // Retry if pool exhausted
      maxRetries: z.number().default(3),
    })
    .default({}),
  interception: z
    .object({
      enabled: z.boolean().default(true),
      blockResources: z.array(z.string()).default(['image', 'font', 'media']),
      captureResponses: z.boolean().default(false),
      capturePattern: z.string().optional(),
    })
    .default({}),
  retry: z
    .object({
      enabled: z.boolean().default(true),
      maxAttempts: z.number().min(1).default(3),
      backoff: z.enum(['linear', 'exponential']).default('exponential'),
      initialDelay: z.number().default(1000),
    })
    .default({}),
  monitoring: z
    .object({
      enabled: z.boolean().default(false),
      logMetrics: z.boolean().default(false),
    })
    .default({}),
})

// Cache configuration
const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  directory: z.string().optional(),
  memorySize: z.number().min(1).max(1000).default(50), // Number of items in memory cache
  ttl: z
    .object({
      problem: z.number().default(7 * 24 * 60 * 60 * 1000), // 7 days
      list: z.number().default(24 * 60 * 60 * 1000), // 1 day
      editorial: z.number().default(7 * 24 * 60 * 60 * 1000), // 7 days
      discussion: z.number().default(60 * 60 * 1000), // 1 hour
      metadata: z.number().default(60 * 60 * 1000), // 1 hour
    })
    .default({}),
  maxSize: z
    .number()
    .min(0)
    .default(500 * 1024 * 1024), // 500MB
  compression: z.boolean().default(true),
})

// Logging configuration
const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  output: z.enum(['console', 'file', 'both']).default('console'),
  file: z.string().optional(),
  format: z.enum(['text', 'json']).default('text'),
})

// Plugin configuration
const PluginConfigSchema = z.object({
  enabled: z.boolean().default(false),
  directory: z.string().default('./plugins'),
  autoLoad: z.boolean().default(true),
  plugins: z
    .array(
      z.object({
        name: z.string(),
        enabled: z.boolean().default(true),
        options: z.record(z.unknown()).default({}),
      })
    )
    .default([]),
})

// Main configuration schema
export const ConfigSchema = z.object({
  auth: AuthConfigSchema.default({}),
  api: ApiConfigSchema.default({}),
  storage: StorageConfigSchema.default({}),
  output: OutputConfigSchema.default({}),
  scraping: ScrapingConfigSchema.default({}),
  processing: ProcessingConfigSchema.default({}),
  browser: BrowserConfigSchema.default({}),
  cache: CacheConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
  plugins: PluginConfigSchema.default({}),
})

// Export types
export type Config = z.infer<typeof ConfigSchema>
export type AuthConfig = z.infer<typeof AuthConfigSchema>
export type ApiConfig = z.infer<typeof ApiConfigSchema>
export type StorageConfig = z.infer<typeof StorageConfigSchema>
export type OutputConfig = z.infer<typeof OutputConfigSchema>
export type ScrapingConfig = z.infer<typeof ScrapingConfigSchema>
export type ProcessingConfig = z.infer<typeof ProcessingConfigSchema>
export type BrowserConfig = z.infer<typeof BrowserConfigSchema>
export type CacheConfig = z.infer<typeof CacheConfigSchema>
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>
export type PluginConfig = z.infer<typeof PluginConfigSchema>

// Partial config for merging
export const PartialConfigSchema = ConfigSchema.partial().deepPartial()
export type PartialConfig = z.infer<typeof PartialConfigSchema>

/**
 * Validate a configuration object
 */
export function validateConfig(config: unknown): Config {
  return ConfigSchema.parse(config)
}

/**
 * Validate a partial configuration object
 */
export function validatePartialConfig(config: unknown): PartialConfig {
  return PartialConfigSchema.parse(config)
}

/**
 * Create a default configuration
 */
export function createDefaultConfig(): Config {
  return ConfigSchema.parse({})
}
