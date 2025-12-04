import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConfigManager } from '../config-manager'
import {
  ConfigSchema,
  createDefaultConfig,
  validateConfig,
  validatePartialConfig,
  type Config,
  type PartialConfig,
} from '../schema'
import {
  loadConfigFile,
  loadEnvConfig,
  mergeConfigs,
  findConfigFile,
  createConfig,
  loadConfigWithCLI,
  exportConfigToYaml,
  exportConfigToJson,
} from '../loader'
import { getDefaultConfig, getDefaultPaths, getConfigSearchPaths } from '../defaults'
import { mkdtempSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('Configuration System', () => {
  let tempDir: string

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = mkdtempSync(join(tmpdir(), 'lesca-config-test-'))
    // Reset environment variables
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('LESCA_')) {
        delete process.env[key]
      }
    })
    // Reset singleton
    ;(ConfigManager as unknown as { instance: unknown }).instance = null
  })

  describe('Schema Validation', () => {
    it('should create valid default configuration', () => {
      const config = createDefaultConfig()
      expect(() => validateConfig(config)).not.toThrow()
      expect(config.auth.method).toBe('cookie')
      expect(config.api.endpoint).toBe('https://leetcode.com/graphql')
      expect(config.output.format).toBe('markdown')
    })

    it('should validate partial configurations', () => {
      const partial = {
        auth: { method: 'none' as const },
        output: { format: 'obsidian' as const },
      }
      const validated = validatePartialConfig(partial)
      // Zod adds defaults to nested objects, so check specific values
      expect(validated.auth?.method).toBe('none')
      expect(validated.output?.format).toBe('obsidian')
    })

    it('should reject invalid configurations', () => {
      const invalid = {
        auth: { method: 'invalid' },
      }
      expect(() => validateConfig(invalid as any)).toThrow()
    })

    it('should apply defaults for missing values', () => {
      const partial = { output: { format: 'obsidian' as const } }
      const schema = ConfigSchema.parse(partial)
      expect(schema.auth.method).toBe('cookie')
      expect(schema.api.timeout).toBe(30000)
      expect(schema.cache.enabled).toBe(true)
    })
  })

  describe('Default Configuration', () => {
    it('should provide sensible defaults', () => {
      const config = getDefaultConfig()
      expect(config.auth.sessionTimeout).toBe(3600)
      expect(config.api.rateLimit.enabled).toBe(true)
      expect(config.api.rateLimit.requestsPerMinute).toBe(30)
      expect(config.scraping.concurrency).toBe(3)
      expect(config.browser.headless).toBe(true)
      expect(config.cache.compression).toBe(true)
    })

    it('should provide default paths', () => {
      const paths = getDefaultPaths()
      expect(paths.lescaDir).toContain('.lesca')
      expect(paths.configFile).toContain('config.yaml')
      expect(paths.cookieFile).toContain('cookies.json')
      expect(paths.cacheDir).toContain('cache')
    })
  })

  describe('Configuration Loading', () => {
    it('should load configuration from JSON file', () => {
      const configPath = join(tempDir, 'config.json')
      const testConfig = {
        output: { format: 'obsidian' },
        scraping: { concurrency: 5 },
      }
      writeFileSync(configPath, JSON.stringify(testConfig))

      const loaded = loadConfigFile(configPath)
      expect(loaded.output?.format).toBe('obsidian')
      expect(loaded.scraping?.concurrency).toBe(5)
    })

    it('should load configuration from YAML file', () => {
      const configPath = join(tempDir, 'config.yaml')
      const yamlContent = `
output:
  format: obsidian
  frontmatter: false
scraping:
  concurrency: 8
  batchSize: 20
`
      writeFileSync(configPath, yamlContent)

      const loaded = loadConfigFile(configPath)
      expect(loaded.output?.format).toBe('obsidian')
      expect(loaded.output?.frontmatter).toBe(false)
      expect(loaded.scraping?.concurrency).toBe(8)
      expect(loaded.scraping?.batchSize).toBe(20)
    })

    it('should throw error for non-existent file', () => {
      const configPath = join(tempDir, 'non-existent.json')
      expect(() => loadConfigFile(configPath)).toThrow(/not found/)
    })

    it('should load configuration from environment variables', () => {
      process.env.LESCA_OUTPUT_FORMAT = 'obsidian'
      process.env.LESCA_CONCURRENCY = '10'
      process.env.LESCA_CACHE_ENABLED = 'false'
      process.env.LESCA_LOG_LEVEL = 'debug'

      const config = loadEnvConfig()
      expect(config.output?.format).toBe('obsidian')
      expect(config.scraping?.concurrency).toBe(10)
      expect(config.cache?.enabled).toBe(false)
      expect(config.logging?.level).toBe('debug')
    })

    it('should find configuration file from search paths', () => {
      const configPath = join(tempDir, 'lesca.config.json')
      writeFileSync(configPath, JSON.stringify({ output: { format: 'json' } }))

      const found = findConfigFile([configPath])
      expect(found).toBe(configPath)
    })

    it('should return null when no config file found', () => {
      const found = findConfigFile([join(tempDir, 'non-existent.json')])
      expect(found).toBeNull()
    })
  })

  describe('Configuration Merging', () => {
    it('should merge configurations with correct priority', () => {
      const defaultConfig = getDefaultConfig()
      const fileConfig = { output: { format: 'obsidian' as const } } as unknown as Config
      const envConfig = { output: { format: 'json' as const } } as unknown as Config

      const merged = mergeConfigs(defaultConfig, fileConfig, envConfig)
      expect(merged.output.format).toBe('json') // Last one wins
    })

    it('should deep merge nested configurations', () => {
      const config1 = getDefaultConfig()
      config1.api.timeout = 20000
      config1.api.rateLimit.enabled = true
      config1.api.rateLimit.requestsPerMinute = 20

      const config2 = {
        api: {
          timeout: 30000,
          rateLimit: { requestsPerMinute: 40 },
        },
      } as unknown as Config

      const merged = mergeConfigs(config1, config2)
      expect(merged.api.timeout).toBe(30000)
      expect(merged.api.rateLimit.enabled).toBe(true) // Preserved from config1
      expect(merged.api.rateLimit.requestsPerMinute).toBe(40) // Updated from config2
    })
  })

  describe('ConfigManager', () => {
    it('should create singleton instance', () => {
      const instance1 = ConfigManager.getInstance()
      const instance2 = ConfigManager.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should initialize with configuration', async () => {
      const configPath = join(tempDir, 'test.json')
      writeFileSync(configPath, JSON.stringify({ output: { format: 'obsidian' } }))

      const manager = await ConfigManager.initialize({ configPath })
      const config = manager.getConfig()
      expect(config.output.format).toBe('obsidian')
    })

    it('should get configuration values by path', async () => {
      const manager = await ConfigManager.initialize()
      expect(manager.get('api.endpoint')).toBe('https://leetcode.com/graphql')
      expect(manager.get('api.rateLimit.enabled')).toBe(true)
      expect(manager.get('nonexistent.path')).toBeUndefined()
    })

    it('should update configuration', async () => {
      const manager = await ConfigManager.initialize()
      manager.update({ output: { format: 'obsidian' as const } } as any)

      const config = manager.getConfig()
      expect(config.output.format).toBe('obsidian')
    })

    it('should reset configuration to defaults', async () => {
      const manager = await ConfigManager.initialize()
      manager.update({ output: { format: 'obsidian' as const } } as any)
      expect(manager.getConfig().output.format).toBe('obsidian')

      manager.reset()
      expect(manager.getConfig().output.format).toBe('markdown')
    })

    it('should emit events on configuration changes', async () => {
      const manager = await ConfigManager.initialize()
      const listener = vi.fn()
      manager.on('config-changed', listener)

      manager.update({ output: { format: 'obsidian' as const } } as any)
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({ format: 'obsidian' }),
        })
      )
    })

    it('should save configuration to file', async () => {
      const manager = await ConfigManager.initialize()
      const savePath = join(tempDir, 'saved-config.yaml')

      await manager.save(savePath, 'yaml')
      const loaded = loadConfigFile(savePath)
      expect(loaded).toBeDefined()
    })

    it('should export configuration in different formats', async () => {
      const manager = await ConfigManager.initialize()

      const yamlExport = manager.export('yaml')
      expect(yamlExport).toContain('auth:')
      expect(yamlExport).toContain('method: cookie')

      const jsonExport = manager.export('json')
      const parsed = JSON.parse(jsonExport)
      expect(parsed.auth.method).toBe('cookie')
    })

    it('should get module configuration', async () => {
      const manager = await ConfigManager.initialize()
      const authConfig = manager.getModuleConfig('auth')
      expect(authConfig.method).toBe('cookie')
      expect(authConfig.sessionTimeout).toBe(3600)

      const cacheConfig = manager.getModuleConfig('cache')
      expect(cacheConfig.enabled).toBe(true)
      expect(cacheConfig.compression).toBe(true)
    })

    it('should check if features are enabled', async () => {
      const manager = await ConfigManager.initialize()
      expect(manager.isFeatureEnabled('cache.enabled')).toBe(true)
      expect(manager.isFeatureEnabled('plugins.enabled')).toBe(false)
      expect(manager.isFeatureEnabled('browser.headless')).toBe(true)
    })

    it('should handle CLI overrides', async () => {
      const manager = await ConfigManager.initialize({
        cliOptions: { output: { format: 'json' as const } } as unknown as PartialConfig,
      })

      const config = manager.getEffectiveConfig()
      expect(config.output.format).toBe('json')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid YAML gracefully', () => {
      const configPath = join(tempDir, 'invalid.yaml')
      writeFileSync(configPath, 'invalid: yaml: content:')

      expect(() => loadConfigFile(configPath)).toThrow()
    })

    it('should handle invalid JSON gracefully', () => {
      const configPath = join(tempDir, 'invalid.json')
      writeFileSync(configPath, '{ invalid json }')

      expect(() => loadConfigFile(configPath)).toThrow()
    })

    it('should validate configuration structure', () => {
      const invalid = {
        auth: { method: 'oauth' }, // Invalid method
        api: { timeout: 'not-a-number' }, // Invalid type
      }

      expect(() => validateConfig(invalid as any)).toThrow()
    })

    it('should throw error for unsupported file format', () => {
      const configPath = join(tempDir, 'config.txt')
      writeFileSync(configPath, 'some content')

      expect(() => loadConfigFile(configPath)).toThrow(/Unsupported/)
    })
  })

  describe('ConfigManager Additional Methods', () => {
    it('should reload configuration from disk', async () => {
      const configPath = join(tempDir, 'reload-test.json')
      writeFileSync(configPath, JSON.stringify({ output: { format: 'markdown' } }))

      const manager = await ConfigManager.initialize({ configPath })
      expect(manager.getConfig().output.format).toBe('markdown')

      // Modify file
      writeFileSync(configPath, JSON.stringify({ output: { format: 'obsidian' } }))

      manager.reload()
      expect(manager.getConfig().output.format).toBe('obsidian')
    })

    it('should emit config-reloaded event', async () => {
      const configPath = join(tempDir, 'reload-event.json')
      writeFileSync(configPath, JSON.stringify({ output: { format: 'markdown' } }))

      const manager = await ConfigManager.initialize({ configPath })
      const listener = vi.fn()
      manager.on('config-reloaded', listener)

      manager.reload()
      expect(listener).toHaveBeenCalled()
    })

    it('should create default configuration file', async () => {
      const manager = await ConfigManager.initialize()
      const savePath = join(tempDir, 'default-config.yaml')

      const result = manager.createDefaultConfigFile(savePath)
      expect(result).toBe(savePath)

      const loaded = loadConfigFile(savePath)
      expect(loaded.auth?.method).toBe('cookie')
    })

    it('should get all paths', async () => {
      const manager = await ConfigManager.initialize()
      const paths = manager.getPaths()

      expect(paths.lescaDir).toContain('.lesca')
      expect(paths.configFile).toContain('config.yaml')
      expect(paths.cookieFile).toContain('cookies.json')
      expect(paths.cacheDir).toContain('cache')
    })

    it('should validate partial configuration', async () => {
      const manager = await ConfigManager.initialize()

      expect(manager.validate({ output: { format: 'obsidian' } })).toBe(true)
      expect(manager.validate({ auth: { method: 'invalid' } })).toBe(false)
    })

    it('should set CLI overrides and emit event', async () => {
      const manager = await ConfigManager.initialize()
      const listener = vi.fn()
      manager.on('cli-overrides-changed', listener)

      manager.setCLIOverrides({ output: { format: 'json' as const } } as any)
      expect(listener).toHaveBeenCalled()
    })

    it('should save configuration in JSON format', async () => {
      const manager = await ConfigManager.initialize()
      const savePath = join(tempDir, 'saved-config.json')

      manager.save(savePath, 'json')
      const content = readFileSync(savePath, 'utf-8')
      const parsed = JSON.parse(content)
      expect(parsed.auth.method).toBe('cookie')
    })

    it('should emit config-saved event', async () => {
      const manager = await ConfigManager.initialize()
      const listener = vi.fn()
      manager.on('config-saved', listener)

      const savePath = join(tempDir, 'emit-save.yaml')
      manager.save(savePath)
      expect(listener).toHaveBeenCalledWith(savePath)
    })

    it('should emit config-reset event', async () => {
      const manager = await ConfigManager.initialize()
      const listener = vi.fn()
      manager.on('config-reset', listener)

      manager.reset()
      expect(listener).toHaveBeenCalled()
    })

    it('should handle deep path access', async () => {
      const manager = await ConfigManager.initialize()

      expect(manager.get('api.rateLimit.requestsPerMinute')).toBe(30)
      expect(manager.get('browser.viewport.width')).toBe(1920)
      expect(manager.get('cache.ttl.problem')).toBeDefined()
    })

    it('should return undefined for null/undefined in path', async () => {
      const manager = await ConfigManager.initialize()

      expect(manager.get('nonexistent.deep.path')).toBeUndefined()
    })
  })

  describe('Loader Additional Functions', () => {
    it('should create config with overrides', () => {
      const config = createConfig({ output: { format: 'obsidian' as const } })

      expect(config.output.format).toBe('obsidian')
      expect(config.auth.method).toBe('cookie') // Default preserved
    })

    it('should load config with CLI options', () => {
      const config = loadConfigWithCLI({ output: { format: 'json' as const } }, {})

      expect(config.output.format).toBe('json')
    })

    it('should handle empty CLI options in loadConfigWithCLI', () => {
      const config = loadConfigWithCLI({}, {})

      expect(config.output.format).toBe('markdown') // Default
    })

    it('should export to YAML format', () => {
      const config = getDefaultConfig()
      const yaml = exportConfigToYaml(config)

      expect(yaml).toContain('auth:')
      expect(yaml).toContain('method: cookie')
    })

    it('should export to JSON format with pretty print', () => {
      const config = getDefaultConfig()
      const json = exportConfigToJson(config, true)

      expect(json).toContain('\n') // Pretty printed
      const parsed = JSON.parse(json)
      expect(parsed.auth.method).toBe('cookie')
    })

    it('should export to JSON format without pretty print', () => {
      const config = getDefaultConfig()
      const json = exportConfigToJson(config, false)

      expect(json).not.toContain('\n  ') // Not pretty printed
    })
  })

  describe('Defaults', () => {
    it('should provide all expected default paths', () => {
      const paths = getDefaultPaths()

      expect(paths).toHaveProperty('lescaDir')
      expect(paths).toHaveProperty('configFile')
      expect(paths).toHaveProperty('cookieFile')
      expect(paths).toHaveProperty('cacheDir')
      expect(paths).toHaveProperty('pluginDir')
      expect(paths).toHaveProperty('logDir')
    })

    it('should provide config search paths', () => {
      const paths = getConfigSearchPaths()

      expect(paths.length).toBeGreaterThan(0)
      expect(paths.some((p: string) => p.includes('lesca.config'))).toBe(true)
    })

    it('should include browser pool configuration', () => {
      const config = getDefaultConfig()

      expect(config.browser.pool).toBeDefined()
      expect(config.browser.pool.enabled).toBe(true)
      expect(config.browser.pool.maxSize).toBe(2)
      expect(config.browser.pool.strategy).toBe('per-session')
    })

    it('should include discussion defaults', () => {
      const config = getDefaultConfig()

      expect(config.scraping.discussion).toBeDefined()
      expect(config.scraping.discussion.defaultLimit).toBe(10)
      expect(config.scraping.discussion.defaultSort).toBe('hot')
    })
  })
})
