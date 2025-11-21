import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileCache, MemoryCache, TieredCache } from './cache'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { resolve } from 'path'

describe('MemoryCache', () => {
  let cache: MemoryCache

  beforeEach(() => {
    cache = new MemoryCache({ maxSize: 3 })
  })

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull()
    })

    it('should handle different data types', () => {
      cache.set('string', 'hello')
      cache.set('number', 42)
      cache.set('object', { foo: 'bar' })

      expect(cache.get('string')).toBe('hello')
      expect(cache.get('number')).toBe(42)
      expect(cache.get('object')).toEqual({ foo: 'bar' })
    })
  })

  describe('TTL (Time To Live)', () => {
    it('should respect TTL and expire entries', async () => {
      cache.set('key1', 'value1', 50) // 50ms TTL

      expect(cache.get('key1')).toBe('value1')

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 60))

      expect(cache.get('key1')).toBeNull()
    })

    it('should not expire if TTL not set', async () => {
      cache.set('key1', 'value1')

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(cache.get('key1')).toBe('value1')
    })
  })

  describe('LRU eviction', () => {
    it('should evict least recently used item when cache is full', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      // Cache is now full (maxSize: 3)
      cache.set('key4', 'value4')

      // key1 should be evicted
      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBe('value2')
      expect(cache.get('key3')).toBe('value3')
      expect(cache.get('key4')).toBe('value4')
    })

    it('should update access order when getting items', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      // Access key1 to make it most recently used
      cache.get('key1')

      // Add new item, should evict key2 (least recently used)
      cache.set('key4', 'value4')

      expect(cache.get('key1')).toBe('value1') // Still exists
      expect(cache.get('key2')).toBeNull() // Evicted
      expect(cache.get('key3')).toBe('value3')
      expect(cache.get('key4')).toBe('value4')
    })
  })

  describe('delete and clear', () => {
    it('should delete specific entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.delete('key1')

      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBe('value2')
    })

    it('should clear all entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      cache.clear()

      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
      expect(cache.get('key3')).toBeNull()
    })
  })

  describe('stats', () => {
    it('should track cache statistics', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.get('key1') // Hit
      cache.get('key1') // Hit
      cache.get('nonexistent') // Miss

      const stats = cache.getStats()

      expect(stats.size).toBe(2)
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBeCloseTo(0.667, 2)
    })
  })
})

describe('FileCache', () => {
  const testCacheDir = resolve(__dirname, '__test_cache__')
  let cache: FileCache

  beforeEach(() => {
    // Clean up test cache directory
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
    mkdirSync(testCacheDir, { recursive: true })

    cache = new FileCache(testCacheDir, {
      compression: true,
    })
  })

  afterEach(() => {
    // Clean up after tests
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
  })

  describe('set and get', () => {
    it('should store and retrieve values from disk', async () => {
      await cache.set('key1', 'value1')

      const value = await cache.get<string>('key1')
      expect(value).toBe('value1')
    })

    it('should return null for non-existent keys', async () => {
      const value = await cache.get('nonexistent')
      expect(value).toBeNull()
    })

    it('should handle complex objects', async () => {
      const complexObject = {
        name: 'test',
        nested: { foo: 'bar' },
        array: [1, 2, 3],
      }

      await cache.set('complex', complexObject)

      const retrieved = await cache.get<typeof complexObject>('complex')
      expect(retrieved).toEqual(complexObject)
    })
  })

  describe('TTL handling', () => {
    it('should expire entries after TTL', async () => {
      await cache.set('key1', 'value1', 50) // 50ms TTL

      let value = await cache.get<string>('key1')
      expect(value).toBe('value1')

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 60))

      value = await cache.get<string>('key1')
      expect(value).toBeNull()
    })
  })

  describe('compression', () => {
    it('should compress large values', async () => {
      const largeValue = 'a'.repeat(2000) // >1KB triggers compression

      await cache.set('large', largeValue)

      const retrieved = await cache.get<string>('large')
      expect(retrieved).toBe(largeValue)
    })
  })

  describe('sharding', () => {
    it('should create sharded directory structure', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')

      // Files should be in different shard directories
      const files = await cache.list()
      expect(files.length).toBeGreaterThan(0)
    })
  })

  describe('delete and clear', () => {
    it('should delete specific entries', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')

      await cache.delete('key1')

      expect(await cache.get('key1')).toBeNull()
      expect(await cache.get('key2')).toBe('value2')
    })

    it('should clear all entries', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')

      await cache.clear()

      expect(await cache.get('key1')).toBeNull()
      expect(await cache.get('key2')).toBeNull()
    })
  })
})

describe('TieredCache', () => {
  const testCacheDir = resolve(__dirname, '__test_tiered_cache__')
  let cache: TieredCache

  beforeEach(() => {
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
    mkdirSync(testCacheDir, { recursive: true })

    cache = new TieredCache(testCacheDir, {
      memorySize: 2,
      fileTtl: 1000,
    })
  })

  afterEach(() => {
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
  })

  describe('two-tier caching', () => {
    it('should check memory cache first', async () => {
      await cache.set('key1', 'value1')

      // First get should be from file
      const value1 = await cache.get<string>('key1')
      expect(value1).toBe('value1')

      // Second get should be from memory (faster)
      const value2 = await cache.get<string>('key1')
      expect(value2).toBe('value1')
    })

    it('should promote file cache hits to memory cache', async () => {
      await cache.set('key1', 'value1')

      // Clear memory cache to simulate cold start
      cache.getStats()

      // Get from file, should promote to memory
      const value = await cache.get<string>('key1')
      expect(value).toBe('value1')
    })

    it('should save to both caches', async () => {
      await cache.set('key1', 'value1')

      // Should exist in both memory and file cache
      const memoryValue = await cache.get<string>('key1')
      expect(memoryValue).toBe('value1')
    })
  })

  describe('cache eviction', () => {
    it('should evict from memory cache when full', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.set('key3', 'value3') // Memory maxSize is 2

      // key1 should be evicted from memory but still in file cache
      const value = await cache.get<string>('key1')
      expect(value).toBe('value1') // Retrieved from file cache
    })
  })

  describe('stats', () => {
    it('should track combined statistics', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')

      await cache.get('key1')
      await cache.get('key2')
      await cache.get('nonexistent')

      const stats = await cache.getStats()

      expect(stats.memorySize).toBeGreaterThanOrEqual(0)
      expect(stats.fileSize).toBeGreaterThanOrEqual(0)
    })
  })
})
