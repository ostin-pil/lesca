import { homedir } from 'os'
import { resolve } from 'path'

import type { Config } from './schema'

/**
 * Default configuration values for Lesca
 * These provide sensible defaults for all configuration options
 */

export function getDefaultConfig(): Config {
  const home = homedir()
  const lescaDir = resolve(home, '.lesca')

  return {
    auth: {
      method: 'cookie',
      cookiePath: resolve(lescaDir, 'cookies.json'),
      sessionTimeout: 3600,
      autoRefresh: true,
      autoSave: true,
      validateOnLoad: true,
      secureStorage: 'file',
    },
    api: {
      endpoint: 'https://leetcode.com/graphql',
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      rateLimit: {
        enabled: true,
        requestsPerMinute: 30,
        minDelay: 2000,
        maxDelay: 10000,
        jitter: true,
      },
    },
    storage: {
      type: 'filesystem',
      path: './output',
      options: {},
    },
    output: {
      format: 'markdown',
      pattern: '{slug}.md',
      frontmatter: true,
      images: {
        download: false,
        directory: 'images',
        pattern: '{slug}-{index}.{ext}',
      },
    },
    scraping: {
      strategies: ['problem'],
      concurrency: 3,
      batchSize: 10,
      delay: 1000,
      timeout: 60000,
      discussion: {
        defaultLimit: 10,
        defaultSort: 'hot',
      },
    },
    processing: {
      converters: ['html-to-markdown'],
      options: {},
      enhancements: {
        enabled: true,
        hints: {
          enabled: true,
        },
        codeSnippets: {
          enabled: true,
          languagePriority: ['python3', 'java', 'cpp', 'javascript', 'typescript', 'c'],
        },
        companies: {
          enabled: true,
        },
      },
    },
    browser: {
      enabled: true,
      headless: true,
      args: [],
      timeout: 30000,
      viewport: {
        width: 1920,
        height: 1080,
      },
      blockedResources: ['image', 'font', 'media'],
      interception: {
        enabled: false,
        blockResources: ['image', 'font', 'media'],
        captureResponses: false,
      },
      retry: {
        enabled: true,
        maxAttempts: 3,
        backoff: 'linear',
        initialDelay: 1000,
      },
      monitoring: {
        enabled: false,
        logMetrics: false,
      },
      session: {
        enabled: false,
        name: 'default',
        autoSave: true,
        autoRestore: true,
        saveOnExit: false,
      },
      pool: {
        enabled: true,
        strategy: 'per-session',
        minSize: 0,
        maxSize: 2, // Conservative default for MVP
        maxIdleTime: 180000, // 3 minutes
        reusePages: true,
        acquireTimeout: 30000,
        retryOnFailure: true,
        maxRetries: 3,
      },
    },
    cache: {
      enabled: true,
      directory: resolve(lescaDir, 'cache'),
      memorySize: 50,
      ttl: {
        problem: 7 * 24 * 60 * 60 * 1000, // 7 days
        list: 24 * 60 * 60 * 1000, // 1 day
        editorial: 7 * 24 * 60 * 60 * 1000, // 7 days
        discussion: 60 * 60 * 1000, // 1 hour
        metadata: 60 * 60 * 1000, // 1 hour
      },
      maxSize: 500 * 1024 * 1024, // 500MB
      compression: true,
    },
    logging: {
      level: 'info',
      output: 'console',
      format: 'text',
    },
    plugins: {
      enabled: false,
      directory: './plugins',
      autoLoad: true,
      plugins: [],
    },
  }
}

/**
 * Get default paths for various Lesca directories
 */
export function getDefaultPaths() {
  const home = homedir()
  const lescaDir = resolve(home, '.lesca')

  return {
    lescaDir,
    configFile: resolve(lescaDir, 'config.yaml'),
    cookieFile: resolve(lescaDir, 'cookies.json'),
    cacheDir: resolve(lescaDir, 'cache'),
    pluginDir: resolve(lescaDir, 'plugins'),
    logDir: resolve(lescaDir, 'logs'),
  }
}

/**
 * Environment variable mappings for configuration
 * Maps environment variables to config paths
 */
export const ENV_MAPPINGS = {
  // Auth
  LESCA_AUTH_METHOD: 'auth.method',
  LESCA_COOKIE_PATH: 'auth.cookiePath',
  LESCA_SESSION_TIMEOUT: 'auth.sessionTimeout',

  // API
  LESCA_API_ENDPOINT: 'api.endpoint',
  LESCA_API_TIMEOUT: 'api.timeout',
  LESCA_API_RETRIES: 'api.retries',
  LESCA_RATE_LIMIT: 'api.rateLimit.enabled',
  LESCA_RATE_LIMIT_RPM: 'api.rateLimit.requestsPerMinute',

  // Storage
  LESCA_STORAGE_TYPE: 'storage.type',
  LESCA_OUTPUT_PATH: 'storage.path',
  LESCA_DATABASE: 'storage.database',

  // Output
  LESCA_OUTPUT_FORMAT: 'output.format',
  LESCA_OUTPUT_PATTERN: 'output.pattern',
  LESCA_FRONTMATTER: 'output.frontmatter',
  LESCA_DOWNLOAD_IMAGES: 'output.images.download',

  // Scraping
  LESCA_CONCURRENCY: 'scraping.concurrency',
  LESCA_BATCH_SIZE: 'scraping.batchSize',
  LESCA_DELAY: 'scraping.delay',
  LESCA_TIMEOUT: 'scraping.timeout',

  // Browser
  LESCA_BROWSER_ENABLED: 'browser.enabled',
  LESCA_BROWSER_HEADLESS: 'browser.headless',
  LESCA_BROWSER_EXECUTABLE: 'browser.executable',
  LESCA_BROWSER_ARGS: 'browser.args',

  // Cache
  LESCA_CACHE_ENABLED: 'cache.enabled',
  LESCA_CACHE_DIR: 'cache.directory',
  LESCA_CACHE_COMPRESSION: 'cache.compression',

  // Logging
  LESCA_LOG_LEVEL: 'logging.level',
  LESCA_LOG_OUTPUT: 'logging.output',
  LESCA_LOG_FILE: 'logging.file',

  // Plugins
  LESCA_PLUGINS_ENABLED: 'plugins.enabled',
  LESCA_PLUGINS_DIR: 'plugins.directory',
} as const

/**
 * Configuration file search paths
 * In order of priority (first found wins)
 */
export function getConfigSearchPaths(): string[] {
  const { configFile } = getDefaultPaths()

  return [
    './lesca.config.yaml',
    './lesca.config.yml',
    './lesca.config.json',
    './.lesca.yaml',
    './.lesca.yml',
    './.lesca.json',
    configFile,
    resolve(homedir(), '.config', 'lesca', 'config.yaml'),
  ]
}
