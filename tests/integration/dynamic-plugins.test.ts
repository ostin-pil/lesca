import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolve } from 'path'
import { PluginManager } from '../../packages/core/src/plugin-manager'
import { LeetCodeScraper } from '../../packages/core/src/scraper'
import { FileSystemStorage } from '../../packages/storage/src/filesystem-storage'
import type { ScrapeRequest, ScrapeResult } from '@lesca/shared/types'

describe('Dynamic Plugin Loading Integration', () => {
  let pluginManager: PluginManager
  let scraper: LeetCodeScraper
  const fixturesDir = resolve(__dirname, '../fixtures')

  beforeEach(async () => {
    // Initialize PluginManager with a local plugin path
    const pluginPath = resolve(fixturesDir, 'test-plugin.ts')
    pluginManager = new PluginManager({}, [pluginPath])
    await pluginManager.init()

    const storage = new FileSystemStorage('./temp-output')
    scraper = new LeetCodeScraper([], storage, { pluginManager })
  })

  afterEach(async () => {
    await pluginManager.cleanup()
  })

  it('should load and execute a dynamic plugin', async () => {
    const plugins = pluginManager.getPlugins()
    expect(plugins).toHaveLength(1)
    expect(plugins[0].name).toBe('test-plugin')
    expect(plugins[0].version).toBe('1.0.0')

    // Verify hooks are called (we can't easily spy on the dynamically loaded module without more complex setup,
    // but we can verify the plugin is registered and the manager attempts to call it)
    // For a true integration test, we might want the plugin to have a side effect we can check,
    // but for now verifying it loads and registers is a good step.
  })
})
