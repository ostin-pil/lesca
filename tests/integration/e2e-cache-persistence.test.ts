import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { FileCache } from '@lesca/shared/utils'

/**
 * End-to-End Integration Test: Cache Persistence
 *
 * Tests cache functionality across sessions:
 * 1. Cache save and load
 * 2. Cache expiration
 * 3. Cache invalidation
 * 4. Cache statistics
 */
describe('E2E: Cache Persistence', () => {
  let tempDir: string
  let cacheDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lesca-cache-test-'))
    cacheDir = join(tempDir, 'cache')
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should persist cache across sessions', async () => {
    // Session 1: Create cache and save data
    const cache1 = new FileCache(cacheDir, {
      defaultTtl: 3600000, // 1 hour
      maxSize: 100 * 1024 * 1024, // 100MB
    })

    await cache1.set('problem:two-sum', { title: 'Two Sum', difficulty: 'Easy' })
    await cache1.set('problem:add-two-numbers', { title: 'Add Two Numbers', difficulty: 'Medium' })

    // Session 2: Load cache from disk (same directory)
    const cache2 = new FileCache(cacheDir, {
      defaultTtl: 3600000,
      maxSize: 100 * 1024 * 1024,
    })

    const twoSum = await cache2.get<{ title: string; difficulty: string }>('problem:two-sum')
    const addTwoNumbers = await cache2.get<{ title: string; difficulty: string }>('problem:add-two-numbers')

    expect(twoSum).toEqual({ title: 'Two Sum', difficulty: 'Easy' })
    expect(addTwoNumbers).toEqual({ title: 'Add Two Numbers', difficulty: 'Medium' })
  })

  it('should expire old cache entries', async () => {
    const cache = new FileCache(cacheDir, {
      defaultTtl: 100, // 100ms default
      maxSize: 100 * 1024 * 1024,
    })

    await cache.set('test-key', 'test-value')

    // Immediately should be available
    let value = await cache.get<string>('test-key')
    expect(value).toBe('test-value')

    // After TTL should be expired
    await new Promise((resolve) => setTimeout(resolve, 150))
    value = await cache.get<string>('test-key')
    expect(value).toBeNull()
  })

  it('should enforce max cache size', async () => {
    // Create a small cache that will trigger eviction
    const cache = new FileCache(cacheDir, {
      defaultTtl: 3600000,
      maxSize: 1024, // Very small: 1KB
    })

    // Add entries that together exceed the limit
    await cache.set('key1', 'x'.repeat(500)) // ~500 bytes
    await cache.set('key2', 'y'.repeat(500)) // ~500 bytes
    await cache.set('key3', 'z'.repeat(500)) // ~500 bytes (should trigger eviction)

    const value1 = await cache.get<string>('key1')
    const value2 = await cache.get<string>('key2')
    const value3 = await cache.get<string>('key3')

    // At least one should be evicted due to size limit
    const nonNullValues = [value1, value2, value3].filter((v) => v !== null)
    expect(nonNullValues.length).toBeLessThan(3)
  })

  it('should provide cache statistics', async () => {
    const cache = new FileCache(cacheDir, {
      defaultTtl: 3600000,
      maxSize: 100 * 1024 * 1024,
    })

    await cache.set('key1', 'value1')
    await cache.set('key2', 'value2')

    // Hit
    await cache.get('key1')
    await cache.get('key1')

    // Miss
    await cache.get('non-existent')

    const stats = await cache.getStats()

    expect(stats.entries).toBeGreaterThan(0)
    expect(stats.hits).toBeGreaterThan(0)
    expect(stats.misses).toBeGreaterThan(0)
  })

  it('should handle cache invalidation', async () => {
    const cache = new FileCache(cacheDir, {
      defaultTtl: 3600000,
      maxSize: 100 * 1024 * 1024,
    })

    await cache.set('key1', 'value1')
    await cache.set('key2', 'value2')

    // Invalidate specific key
    await cache.delete('key1')
    expect(await cache.get('key1')).toBeNull()
    expect(await cache.get('key2')).toBe('value2')

    // Clear all
    await cache.clear()
    expect(await cache.get('key2')).toBeNull()
  })
})
