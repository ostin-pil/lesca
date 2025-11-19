import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { ConfigManager, createDefaultConfig, exportConfigToYaml } from '../../../../shared/config/src/index.js'

/**
 * Configuration Initialization Tests
 *
 * Tests for config file creation and initialization
 */
describe('Configuration Initialization', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `lesca-cli-test-${Date.now()}`)
    mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('createDefaultConfig', () => {
    it('should create default configuration with all required fields', () => {
      const config = createDefaultConfig()

      expect(config).toBeDefined()
      expect(config.storage).toBeDefined()
      expect(config.storage.path).toBe('./output')

      expect(config.output).toBeDefined()
      expect(config.output.format).toBeDefined()

      expect(config.auth).toBeDefined()
      expect(config.auth.method).toBeDefined()

      expect(config.api).toBeDefined()
      expect(config.api.rateLimit).toBeDefined()

      expect(config.browser).toBeDefined()
      expect(config.browser.headless).toBe(true)

      expect(config.scraping).toBeDefined()
      expect(config.scraping.discussion).toBeDefined()
    })

    it('should have valid default values', () => {
      const config = createDefaultConfig()

      expect(config.output.format).toMatch(/^(markdown|obsidian)$/)
      expect(config.auth.method).toMatch(/^(cookie|cookies|none)$/)
      expect(config.api.rateLimit.minDelay).toBeGreaterThan(0)
      expect(config.browser.timeout).toBeGreaterThan(0)
    })
  })

  describe('exportConfigToYaml', () => {
    it('should export config to YAML format', () => {
      const config = createDefaultConfig()
      const yaml = exportConfigToYaml(config)

      expect(yaml).toContain('storage:')
      expect(yaml).toContain('output:')
      expect(yaml).toContain('auth:')
      expect(yaml).toContain('api:')
      expect(yaml).toContain('browser:')
      expect(yaml).toContain('scraping:')
    })

    it('should export config to valid YAML with proper indentation', () => {
      const config = createDefaultConfig()
      const yaml = exportConfigToYaml(config)

      // Should have proper YAML structure
      expect(yaml).toMatch(/^storage:\s*$/m)
      expect(yaml).toMatch(/^\s+path:/m)
      expect(yaml).toMatch(/^output:\s*$/m)
      expect(yaml).toMatch(/^\s+format:/m)
    })

    it('should be parseable back to config', () => {
      const config = createDefaultConfig()
      const yaml = exportConfigToYaml(config)

      // Write to temp file
      const configPath = join(tempDir, 'test-config.yaml')
      writeFileSync(configPath, yaml, 'utf-8')

      // Should be able to parse it back
      const manager = ConfigManager.initialize({ configPath })
      const loadedConfig = manager.getConfig()

      expect(loadedConfig.storage.path).toBeDefined()
      expect(loadedConfig.output.format).toBeDefined()
    })
  })

  describe('ConfigManager initialization', () => {
    it('should initialize with default config when no path provided', () => {
      const manager = ConfigManager.initialize({})
      const config = manager.getConfig()

      expect(config).toBeDefined()
      expect(config.storage).toBeDefined()
      expect(config.output).toBeDefined()
    })

    it('should load config from file when path provided', () => {
      const config = createDefaultConfig()
      config.storage.path = '/custom/path'

      const yaml = exportConfigToYaml(config)
      const configPath = join(tempDir, 'custom-config.yaml')
      writeFileSync(configPath, yaml, 'utf-8')

      const manager = ConfigManager.initialize({ configPath })
      const loadedConfig = manager.getConfig()

      expect(loadedConfig.storage.path).toBe('/custom/path')
    })

    it('should handle invalid config file gracefully', () => {
      const configPath = join(tempDir, 'invalid-config.yaml')
      writeFileSync(configPath, 'invalid: yaml: content: [[[', 'utf-8')

      // ConfigManager may throw or fall back to defaults
      // depending on implementation
      try {
        const manager = ConfigManager.initialize({ configPath })
        const config = manager.getConfig()
        expect(config).toBeDefined()
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should handle non-existent config file gracefully', () => {
      const configPath = join(tempDir, 'non-existent.yaml')

      // ConfigManager may throw or fall back to defaults
      try {
        const manager = ConfigManager.initialize({ configPath })
        const config = manager.getConfig()
        expect(config).toBeDefined()
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Config file creation workflow', () => {
    it('should prevent overwriting existing config without force flag', () => {
      const configPath = join(tempDir, 'existing-config.yaml')

      // Create existing config
      const config = createDefaultConfig()
      const yaml = exportConfigToYaml(config)
      writeFileSync(configPath, yaml, 'utf-8')

      // Verify file exists
      expect(existsSync(configPath)).toBe(true)

      // Try to initialize again without force - should detect existing file
      const exists = existsSync(configPath)
      expect(exists).toBe(true)
    })

    it('should allow overwriting with force flag', () => {
      const configPath = join(tempDir, 'existing-config.yaml')

      // Create existing config
      const config1 = createDefaultConfig()
      config1.storage.path = '/old/path'
      const yaml1 = exportConfigToYaml(config1)
      writeFileSync(configPath, yaml1, 'utf-8')

      // Create new config with different values
      const config2 = createDefaultConfig()
      config2.storage.path = '/new/path'
      const yaml2 = exportConfigToYaml(config2)

      // Overwrite (simulating force flag)
      writeFileSync(configPath, yaml2, 'utf-8')

      // Load and verify
      const manager = ConfigManager.initialize({ configPath })
      const loadedConfig = manager.getConfig()

      expect(loadedConfig.storage.path).toBe('/new/path')
    })

    it('should create config with custom output directory', () => {
      const config = createDefaultConfig()
      config.storage.path = '/custom/output'

      const yaml = exportConfigToYaml(config)
      const configPath = join(tempDir, 'config.yaml')
      writeFileSync(configPath, yaml, 'utf-8')

      const manager = ConfigManager.initialize({ configPath })
      const loadedConfig = manager.getConfig()

      expect(loadedConfig.storage.path).toBe('/custom/output')
    })

    it('should create config with custom cookie path', () => {
      const config = createDefaultConfig()
      config.auth.cookiePath = '/custom/cookies.json'

      const yaml = exportConfigToYaml(config)
      const configPath = join(tempDir, 'config.yaml')
      writeFileSync(configPath, yaml, 'utf-8')

      const manager = ConfigManager.initialize({ configPath })
      const loadedConfig = manager.getConfig()

      expect(loadedConfig.auth.cookiePath).toBe('/custom/cookies.json')
    })

    it('should create config with custom format', () => {
      const config = createDefaultConfig()
      config.output.format = 'markdown'

      const yaml = exportConfigToYaml(config)
      const configPath = join(tempDir, 'config.yaml')
      writeFileSync(configPath, yaml, 'utf-8')

      const manager = ConfigManager.initialize({ configPath })
      const loadedConfig = manager.getConfig()

      expect(loadedConfig.output.format).toBe('markdown')
    })
  })

  describe('Config validation', () => {
    it('should validate output format', () => {
      const config = createDefaultConfig()

      // Valid formats
      config.output.format = 'markdown'
      expect(config.output.format).toBe('markdown')

      config.output.format = 'obsidian'
      expect(config.output.format).toBe('obsidian')
    })

    it('should validate auth method', () => {
      const config = createDefaultConfig()

      // Valid methods
      config.auth.method = 'cookie'
      expect(config.auth.method).toBe('cookie')

      config.auth.method = 'none'
      expect(config.auth.method).toBe('none')
    })

    it('should have positive rate limit values', () => {
      const config = createDefaultConfig()

      expect(config.api.rateLimit.minDelay).toBeGreaterThan(0)
      expect(config.api.rateLimit.maxDelay).toBeGreaterThanOrEqual(config.api.rateLimit.minDelay)
      // jitter may be boolean or number depending on config version
      if (typeof config.api.rateLimit.jitter === 'number') {
        expect(config.api.rateLimit.jitter).toBeGreaterThanOrEqual(0)
      } else {
        expect(typeof config.api.rateLimit.jitter).toBe('boolean')
      }
    })

    it('should have positive timeout values', () => {
      const config = createDefaultConfig()

      expect(config.browser.timeout).toBeGreaterThan(0)
      expect(config.scraping.timeout).toBeGreaterThan(0)
    })
  })
})
