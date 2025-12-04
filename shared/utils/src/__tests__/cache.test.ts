import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileCache, MemoryCache, TieredCache } from '../cache'

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  unlink: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn(),
}))

// Mock zlib
vi.mock('zlib', () => ({
  gzip: vi.fn((buffer, callback) => {
    callback(null, Buffer.from('compressed'))
  }),
  gunzip: vi.fn((buffer, callback) => {
    callback(null, Buffer.from('{"decompressed":true}'))
  }),
}))

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('MemoryCache', () => {
  let cache: MemoryCache

  beforeEach(() => {
    vi.clearAllMocks()
    cache = new MemoryCache()
  })

  describe('constructor', () => {
    it('should create cache with default options', () => {
      const c = new MemoryCache()
      expect(c.getStats().entries).toBe(0)
    })

    it('should create cache with custom options', () => {
      const c = new MemoryCache({
        defaultTtl: 60000,
        maxEntries: 500,
      })
      expect(c.getStats().entries).toBe(0)
    })

    it('should accept maxSize as alias for maxEntries', () => {
      const c = new MemoryCache({ maxSize: 200 })
      // Fill to capacity
      for (let i = 0; i < 201; i++) {
        c.set(`key-${i}`, `value-${i}`)
      }
      // Should evict oldest, keeping maxEntries
      expect(c.getStats().entries).toBe(200)
    })
  })

  describe('get/set', () => {
    it('should store and retrieve values', () => {
      cache.set('test-key', { foo: 'bar' })
      const result = cache.get<{ foo: string }>('test-key')

      expect(result).toEqual({ foo: 'bar' })
    })

    it('should return null for non-existent key', () => {
      const result = cache.get('missing')
      expect(result).toBeNull()
    })

    it('should track stats on get', () => {
      cache.set('exists', 'value')
      cache.get('exists') // hit
      cache.get('missing') // miss

      const stats = cache.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
    })

    it('should update existing keys', () => {
      cache.set('key', 'value1')
      cache.set('key', 'value2')

      expect(cache.get('key')).toBe('value2')
      expect(cache.getStats().entries).toBe(1)
    })
  })

  describe('TTL expiration', () => {
    it('should return null for expired entries', () => {
      vi.useFakeTimers()

      cache.set('short-lived', 'value', 1000) // 1 second TTL
      expect(cache.get('short-lived')).toBe('value')

      vi.advanceTimersByTime(1500) // Advance past TTL
      expect(cache.get('short-lived')).toBeNull()

      vi.useRealTimers()
    })

    it('should use default TTL when not specified', () => {
      vi.useFakeTimers()

      const shortTtlCache = new MemoryCache({ defaultTtl: 500 })
      shortTtlCache.set('key', 'value')

      expect(shortTtlCache.get('key')).toBe('value')

      vi.advanceTimersByTime(600)
      expect(shortTtlCache.get('key')).toBeNull()

      vi.useRealTimers()
    })
  })

  describe('has', () => {
    it('should return true for existing non-expired key', () => {
      cache.set('key', 'value')
      expect(cache.has('key')).toBe(true)
    })

    it('should return false for non-existent key', () => {
      expect(cache.has('missing')).toBe(false)
    })

    it('should return false for expired key', () => {
      vi.useFakeTimers()

      cache.set('key', 'value', 100)
      vi.advanceTimersByTime(200)

      expect(cache.has('key')).toBe(false)

      vi.useRealTimers()
    })
  })

  describe('delete', () => {
    it('should remove key from cache', () => {
      cache.set('key', 'value')
      cache.delete('key')

      expect(cache.has('key')).toBe(false)
      expect(cache.get('key')).toBeNull()
    })

    it('should update entries count on delete', () => {
      cache.set('key', 'value')
      expect(cache.getStats().entries).toBe(1)

      cache.delete('key')
      expect(cache.getStats().entries).toBe(0)
    })

    it('should handle deleting non-existent key', () => {
      cache.delete('missing') // Should not throw
      expect(cache.getStats().entries).toBe(0)
    })
  })

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      cache.clear()

      expect(cache.getStats().entries).toBe(0)
      expect(cache.has('key1')).toBe(false)
    })

    it('should reset statistics', () => {
      cache.set('key', 'value')
      cache.get('key') // hit
      cache.get('missing') // miss

      cache.clear()

      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })
  })

  describe('LRU eviction', () => {
    it('should evict least recently used when at capacity', () => {
      const smallCache = new MemoryCache({ maxEntries: 3 })

      smallCache.set('first', 1)
      smallCache.set('second', 2)
      smallCache.set('third', 3)
      smallCache.set('fourth', 4) // Should evict 'first'

      expect(smallCache.get('first')).toBeNull()
      expect(smallCache.get('second')).toBe(2)
      expect(smallCache.get('third')).toBe(3)
      expect(smallCache.get('fourth')).toBe(4)
    })

    it('should move accessed items to end (most recent)', () => {
      const smallCache = new MemoryCache({ maxEntries: 3 })

      smallCache.set('a', 1)
      smallCache.set('b', 2)
      smallCache.set('c', 3)

      // Access 'a' to make it most recent
      smallCache.get('a')

      // Add new entry, should evict 'b' (now oldest)
      smallCache.set('d', 4)

      expect(smallCache.get('a')).toBe(1) // Still exists
      expect(smallCache.get('b')).toBeNull() // Evicted
    })
  })

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      cache.get('a') // hit
      cache.get('c') // miss

      const stats = cache.getStats()
      expect(stats.entries).toBe(2)
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should return 0 hit rate when no accesses', () => {
      const stats = cache.getStats()
      expect(stats.hitRate).toBe(0)
    })
  })

  describe('evictExpired', () => {
    it('should remove all expired entries', () => {
      vi.useFakeTimers()

      cache.set('short1', 'value', 100)
      cache.set('short2', 'value', 100)
      cache.set('long', 'value', 10000)

      vi.advanceTimersByTime(200)

      const evicted = cache.evictExpired()
      expect(evicted).toBe(2)
      expect(cache.has('long')).toBe(true)
      expect(cache.has('short1')).toBe(false)

      vi.useRealTimers()
    })
  })
})

describe('FileCache', () => {
  let cache: FileCache

  beforeEach(async () => {
    vi.clearAllMocks()
    cache = new FileCache('/tmp/test-cache')

    // Reset mocks
    const fs = await import('fs/promises')
    vi.mocked(fs.readdir).mockResolvedValue([])
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))
  })

  describe('constructor', () => {
    it('should create cache with default options', () => {
      const c = new FileCache('/tmp/cache')
      expect(c).toBeInstanceOf(FileCache)
    })

    it('should create cache with custom options', () => {
      const c = new FileCache('/tmp/cache', {
        defaultTtl: 7200000,
        compression: false,
        maxSize: 100 * 1024 * 1024,
      })
      expect(c).toBeInstanceOf(FileCache)
    })
  })

  describe('get', () => {
    it('should return null for cache miss', async () => {
      const result = await cache.get('missing-key')
      expect(result).toBeNull()
    })

    it('should return cached value for cache hit', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify({
          key: 'test-key',
          data: { foo: 'bar' },
          timestamp: Date.now(),
          ttl: 3600000,
          compressed: false,
        })
      )

      const result = await cache.get<{ foo: string }>('test-key')
      expect(result).toEqual({ foo: 'bar' })
    })

    it('should return null and delete for expired entry', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify({
          key: 'expired-key',
          data: 'old-value',
          timestamp: Date.now() - 5000000, // Old timestamp
          ttl: 1000, // Short TTL
          compressed: false,
        })
      )

      const result = await cache.get('expired-key')
      expect(result).toBeNull()
      expect(fs.unlink).toHaveBeenCalled()
    })

    it('should decompress compressed data', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify({
          key: 'compressed-key',
          data: 'Y29tcHJlc3NlZA==', // base64 of 'compressed'
          timestamp: Date.now(),
          ttl: 3600000,
          compressed: true,
        })
      )

      const result = await cache.get('compressed-key')
      expect(result).toEqual({ decompressed: true })
    })

    it('should track stats', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(
          JSON.stringify({
            key: 'key',
            data: 'value',
            timestamp: Date.now(),
            ttl: 3600000,
            compressed: false,
          })
        )
        .mockRejectedValueOnce(new Error('ENOENT'))

      await cache.get('key') // hit
      await cache.get('missing') // miss

      const stats = await cache.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
    })
  })

  describe('set', () => {
    it('should write entry to file', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readdir).mockResolvedValue([])

      await cache.set('new-key', { test: 'data' })

      expect(fs.mkdir).toHaveBeenCalled()
      expect(fs.writeFile).toHaveBeenCalled()
    })

    it('should use custom TTL', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readdir).mockResolvedValue([])

      await cache.set('key', 'value', 60000)

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"ttl":60000'),
        'utf-8'
      )
    })

    it('should compress large data', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readdir).mockResolvedValue([])

      // Large data that should be compressed
      const largeData = 'x'.repeat(2000)
      await cache.set('large-key', largeData)

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"compressed":true'),
        'utf-8'
      )
    })

    it('should evict oldest when at max size', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readdir).mockResolvedValue(['file1.json', 'file2.json'])
      vi.mocked(fs.stat).mockResolvedValue({
        size: 600 * 1024 * 1024,
        isFile: () => true,
      } as Awaited<ReturnType<typeof fs.stat>>)
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          key: 'old',
          timestamp: Date.now() - 10000,
          data: 'old-data',
        })
      )

      await cache.set('new-key', 'new-data')

      expect(fs.unlink).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should remove file', async () => {
      const fs = await import('fs/promises')

      await cache.delete('some-key')

      expect(fs.unlink).toHaveBeenCalled()
    })

    it('should handle missing file gracefully', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('ENOENT'))

      await expect(cache.delete('missing')).resolves.toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true for existing non-expired entry', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify({
          key: 'key',
          data: 'value',
          timestamp: Date.now(),
          ttl: 3600000,
          compressed: false,
        })
      )

      const result = await cache.has('key')
      expect(result).toBe(true)
    })

    it('should return false for missing entry', async () => {
      const result = await cache.has('missing')
      expect(result).toBe(false)
    })

    it('should return false for expired entry', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify({
          key: 'expired',
          data: 'value',
          timestamp: Date.now() - 10000,
          ttl: 100,
          compressed: false,
        })
      )

      const result = await cache.has('expired')
      expect(result).toBe(false)
    })
  })

  describe('clear', () => {
    it('should delete all cache files', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readdir).mockResolvedValueOnce(['file1.json', 'file2.json'] as string[])
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
      } as Awaited<ReturnType<typeof fs.stat>>)

      await cache.clear()

      expect(fs.unlink).toHaveBeenCalledTimes(2)
    })

    it('should reset stats', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readdir).mockResolvedValue([])

      // Generate some stats
      await cache.get('missing') // miss

      await cache.clear()

      const stats = await cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })
  })

  describe('list', () => {
    it('should return list of non-expired keys', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readdir).mockResolvedValueOnce(['ab/hash1.json', 'cd/hash2.json'] as string[])
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
      } as Awaited<ReturnType<typeof fs.stat>>)
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(
          JSON.stringify({
            key: 'key1',
            timestamp: Date.now(),
            ttl: 3600000,
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            key: 'key2',
            timestamp: Date.now(),
            ttl: 3600000,
          })
        )

      const keys = await cache.list()
      expect(keys).toEqual(['key1', 'key2'])
    })

    it('should exclude expired keys', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readdir).mockResolvedValueOnce(['hash1.json', 'hash2.json'] as string[])
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
      } as Awaited<ReturnType<typeof fs.stat>>)
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(
          JSON.stringify({
            key: 'valid',
            timestamp: Date.now(),
            ttl: 3600000,
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            key: 'expired',
            timestamp: Date.now() - 10000,
            ttl: 100,
          })
        )

      const keys = await cache.list()
      expect(keys).toEqual(['valid'])
    })
  })

  describe('evictExpired', () => {
    it('should remove expired entries and return count', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readdir).mockResolvedValueOnce(['h1.json', 'h2.json', 'h3.json'] as string[])
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
      } as Awaited<ReturnType<typeof fs.stat>>)
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(
          JSON.stringify({ key: 'valid', timestamp: Date.now(), ttl: 3600000 })
        )
        .mockResolvedValueOnce(
          JSON.stringify({ key: 'expired1', timestamp: Date.now() - 10000, ttl: 100 })
        )
        .mockResolvedValueOnce(
          JSON.stringify({ key: 'expired2', timestamp: Date.now() - 10000, ttl: 100 })
        )

      const evicted = await cache.evictExpired()
      expect(evicted).toBe(2)
    })
  })
})

describe('TieredCache', () => {
  let cache: TieredCache

  beforeEach(async () => {
    vi.clearAllMocks()
    cache = new TieredCache('/tmp/tiered-cache')

    const fs = await import('fs/promises')
    vi.mocked(fs.readdir).mockResolvedValue([])
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))
  })

  describe('constructor', () => {
    it('should create tiered cache with default options', () => {
      const c = new TieredCache('/tmp/cache')
      expect(c).toBeInstanceOf(TieredCache)
    })

    it('should create tiered cache with custom options', () => {
      const c = new TieredCache('/tmp/cache', {
        memorySize: 50,
        fileTtl: 7200000,
      })
      expect(c).toBeInstanceOf(TieredCache)
    })
  })

  describe('get', () => {
    it('should return from memory cache first', async () => {
      await cache.set('key', 'value')
      const result = await cache.get('key')
      expect(result).toBe('value')
    })

    it('should fall back to file cache', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify({
          key: 'file-key',
          data: 'file-value',
          timestamp: Date.now(),
          ttl: 3600000,
          compressed: false,
        })
      )

      const result = await cache.get('file-key')
      expect(result).toBe('file-value')
    })

    it('should populate memory cache from file cache hit', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify({
          key: 'key',
          data: 'value',
          timestamp: Date.now(),
          ttl: 3600000,
          compressed: false,
        })
      )

      // First get from file
      await cache.get('key')

      // Reset file mock to miss
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

      // Should still get from memory
      const result = await cache.get('key')
      expect(result).toBe('value')
    })

    it('should return null when not in either cache', async () => {
      const result = await cache.get('missing')
      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('should set in both caches', async () => {
      const fs = await import('fs/promises')
      await cache.set('key', 'value')

      // Check memory (immediate)
      const memResult = await cache.get('key')
      expect(memResult).toBe('value')

      // Check file was written
      expect(fs.writeFile).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should delete from both caches', async () => {
      const fs = await import('fs/promises')
      await cache.set('key', 'value')
      await cache.delete('key')

      expect(fs.unlink).toHaveBeenCalled()
      const result = await cache.get('key')
      expect(result).toBeNull()
    })
  })

  describe('clear', () => {
    it('should clear both caches', async () => {
      const fs = await import('fs/promises')
      vi.mocked(fs.readdir).mockResolvedValue(['file.json'] as string[])
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
      } as Awaited<ReturnType<typeof fs.stat>>)

      await cache.set('key', 'value')
      await cache.clear()

      const result = await cache.get('key')
      expect(result).toBeNull()
    })
  })

  describe('getStats', () => {
    it('should return combined statistics', async () => {
      await cache.set('key', 'value')
      await cache.get('key')
      await cache.get('missing')

      const stats = await cache.getStats()
      expect(stats).toHaveProperty('memory')
      expect(stats).toHaveProperty('file')
      expect(stats).toHaveProperty('total')
      expect(stats.total.hits).toBeGreaterThanOrEqual(1)
    })
  })
})
