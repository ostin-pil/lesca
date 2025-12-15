import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ConfigManager } from '@lesca/shared/config'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('Integration: Configuration Loading', () => {
  let tempDir: string
  let configPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lesca-config-test-'))
    configPath = join(tempDir, 'lesca.config.yaml')
    // Reset singleton
    // @ts-ignore - Accessing private static for testing
    ConfigManager.instance = null
  })

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
    }
    // Clean up env vars
    delete process.env.LESCA_BROWSER_HEADLESS
    delete process.env.LESCA_API_TIMEOUT
    delete process.env.LESCA_BROWSER_ARGS
  })

  it('should load configuration from file', () => {
    writeFileSync(configPath, 'api:\n  timeout: 5000\n', 'utf-8')

    const manager = ConfigManager.initialize({ configPath })
    const config = manager.getConfig()

    expect(config.api.timeout).toBe(5000)
  })

  it('should override file config with environment variables', () => {
    writeFileSync(configPath, 'api:\n  timeout: 5000\n', 'utf-8')
    process.env.LESCA_API_TIMEOUT = '10000'

    const manager = ConfigManager.initialize({ configPath })
    const config = manager.getConfig()

    expect(config.api.timeout).toBe(10000)
  })

  it('should override env vars with CLI options', () => {
    process.env.LESCA_API_TIMEOUT = '10000'
    const cliOptions = {
      api: {
        timeout: 15000,
      },
    }

    const manager = ConfigManager.initialize({ configPath, cliOptions })
    const config = manager.getConfig()

    expect(config.api.timeout).toBe(15000)
  })

  it('should load browser args from environment variable', () => {
    process.env.LESCA_BROWSER_ARGS = '["--no-sandbox", "--disable-gpu"]'

    const manager = ConfigManager.initialize({ configPath })
    const config = manager.getConfig()

    expect(config.browser.args).toEqual(['--no-sandbox', '--disable-gpu'])
  })
})
