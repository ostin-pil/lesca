import { describe, it, expect, beforeEach } from 'vitest'
import { resolve } from 'path'
import { PluginLoader } from '../../packages/core/src/plugin-loader'
import { PluginError } from '@lesca/error'

describe('PluginLoader', () => {
  let loader: PluginLoader
  const fixturesDir = resolve(__dirname, '../fixtures')

  beforeEach(() => {
    loader = new PluginLoader()
  })

  it('should load a valid local plugin', async () => {
    const pluginPath = resolve(fixturesDir, 'test-plugin.ts')
    const plugin = await loader.load(pluginPath)

    expect(plugin).toBeDefined()
    expect(plugin.name).toBe('test-plugin')
    expect(plugin.version).toBe('1.0.0')
    expect(plugin.onInit).toBeDefined()
  })

  it('should throw PLUGIN_INVALID for invalid plugin', async () => {
    const pluginPath = resolve(fixturesDir, 'invalid-plugin.ts')

    await expect(loader.load(pluginPath)).rejects.toThrow(PluginError)
    await expect(loader.load(pluginPath)).rejects.toThrow(
      'does not export a valid Plugin interface'
    )
  })

  it('should throw PLUGIN_LOAD_FAILED for non-existent plugin', async () => {
    const pluginPath = resolve(fixturesDir, 'non-existent.ts')

    await expect(loader.load(pluginPath)).rejects.toThrow(PluginError)
    await expect(loader.load(pluginPath)).rejects.toThrow('Failed to load plugin')
  })
})
