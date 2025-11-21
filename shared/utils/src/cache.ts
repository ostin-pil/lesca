import { createHash } from 'crypto'
import { mkdir, writeFile, readFile, unlink, readdir, stat } from 'fs/promises'
import { join, dirname } from 'path'
import { promisify } from 'util'
import { gzip, gunzip } from 'zlib'

import { logger } from './logger'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/**
 * Cache entry metadata
 */
interface CacheEntry<T> {
  key: string
  data: T
  timestamp: number
  ttl?: number
  compressed: boolean
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number
  misses: number
  size: number
  entries: number
  hitRate?: number // Hit rate as a decimal (0-1)
}

/**
 * Simple file-based cache with TTL and compression
 */
export class FileCache {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    entries: 0,
  }

  constructor(
    private cacheDir: string,
    private options: {
      defaultTtl?: number // Default TTL in milliseconds
      compression?: boolean // Enable gzip compression
      maxSize?: number // Max cache size in bytes
    } = {}
  ) {
    this.options = {
      defaultTtl: 3600000, // 1 hour default
      compression: true,
      maxSize: 500 * 1024 * 1024, // 500MB default
      ...options,
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const filePath = this.getFilePath(key)
      const content = await readFile(filePath, 'utf-8')
      const entry: CacheEntry<T> = JSON.parse(content) as CacheEntry<T>

      // Check if expired
      if (this.isExpired(entry)) {
        await this.delete(key)
        this.stats.misses++
        return null
      }

      // Decompress if needed
      let data = entry.data
      if (entry.compressed && typeof entry.data === 'string') {
        const buffer = Buffer.from(entry.data, 'base64')
        const decompressed = await gunzipAsync(buffer)
        data = JSON.parse(decompressed.toString('utf-8')) as T
      }

      this.stats.hits++
      return data
    } catch (error) {
      // File not found or parsing error
      this.stats.misses++
      return null
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      // Ensure cache directory exists
      await mkdir(this.cacheDir, { recursive: true })

      // Check cache size before adding
      if (this.options.maxSize) {
        const currentSize = await this.getCacheSize()
        if (currentSize >= this.options.maxSize) {
          await this.evictOldest()
        }
      }

      // Compress if enabled and data is large
      let data: T | string = value
      let compressed = false

      if (this.options.compression) {
        const jsonString = JSON.stringify(value)
        if (jsonString.length > 1024) {
          // Only compress if > 1KB
          const buffer = Buffer.from(jsonString, 'utf-8')
          const compressed_buffer = await gzipAsync(buffer)
          data = compressed_buffer.toString('base64')
          compressed = true
        }
      }

      // Create cache entry
      const entry: CacheEntry<T | string> = {
        key,
        data,
        timestamp: Date.now(),
        ttl: ttl ?? this.options.defaultTtl ?? 3600000,
        compressed,
      }

      // Write to file
      const filePath = this.getFilePath(key)
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, JSON.stringify(entry), 'utf-8')

      this.stats.entries++
    } catch (error) {
      logger.error(`Failed to set cache for key ${key}:`, error instanceof Error ? error : undefined)
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key)
      await unlink(filePath)
      this.stats.entries = Math.max(0, this.stats.entries - 1)
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Check if key exists in cache (and not expired)
   */
  async has(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key)
      const content = await readFile(filePath, 'utf-8')
      const entry: CacheEntry<unknown> = JSON.parse(content) as CacheEntry<unknown>
      return !this.isExpired(entry)
    } catch {
      return false
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      const files = await readdir(this.cacheDir, { recursive: true })
      for (const file of files) {
        const filePath = join(this.cacheDir, file)
        try {
          const stats = await stat(filePath)
          if (stats.isFile()) {
            await unlink(filePath)
          }
        } catch {
          // Ignore errors
        }
      }
      this.stats = {
        hits: 0,
        misses: 0,
        size: 0,
        entries: 0,
      }
    } catch (error) {
      logger.error('Failed to clear cache:', error instanceof Error ? error : undefined)
    }
  }

  /**
   * List all cache keys
   */
  async list(): Promise<string[]> {
    const keys: string[] = []
    try {
      const files = await readdir(this.cacheDir, { recursive: true })
      for (const file of files) {
        const filePath = join(this.cacheDir, file)
        try {
          const stats = await stat(filePath)
          if (!stats.isFile()) continue

          const content = await readFile(filePath, 'utf-8')
          const entry: CacheEntry<unknown> = JSON.parse(content) as CacheEntry<unknown>

          if (!this.isExpired(entry)) {
            keys.push(entry.key)
          }
        } catch {
          // Ignore errors for individual files
        }
      }
    } catch {
      // Directory doesn't exist yet
    }
    return keys
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    this.stats.size = await this.getCacheSize()
    const totalAccess = this.stats.hits + this.stats.misses
    const hitRate = totalAccess > 0 ? this.stats.hits / totalAccess : 0
    return { ...this.stats, hitRate }
  }

  /**
   * Evict expired entries
   */
  async evictExpired(): Promise<number> {
    let evicted = 0
    try {
      const files = await readdir(this.cacheDir, { recursive: true })
      for (const file of files) {
        const filePath = join(this.cacheDir, file)
        try {
          const stats = await stat(filePath)
          if (!stats.isFile()) continue

          const content = await readFile(filePath, 'utf-8')
          const entry: CacheEntry<unknown> = JSON.parse(content) as CacheEntry<unknown>

          if (this.isExpired(entry)) {
            await unlink(filePath)
            evicted++
          }
        } catch {
          // Ignore errors for individual files
        }
      }
      this.stats.entries = Math.max(0, this.stats.entries - evicted)
    } catch (error) {
      logger.error('Failed to evict expired entries:', error instanceof Error ? error : undefined)
    }
    return evicted
  }

  /**
   * Get cache file path for a key
   */
  private getFilePath(key: string): string {
    const hash = createHash('sha256').update(key).digest('hex')
    const subdir = hash.substring(0, 2) // First 2 chars for directory sharding
    return join(this.cacheDir, subdir, `${hash}.json`)
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    if (!entry.ttl) return false
    return Date.now() - entry.timestamp > entry.ttl
  }

  /**
   * Get total cache size in bytes
   */
  private async getCacheSize(): Promise<number> {
    let totalSize = 0
    try {
      const files = await readdir(this.cacheDir, { recursive: true })
      for (const file of files) {
        const filePath = join(this.cacheDir, file)
        try {
          const stats = await stat(filePath)
          if (stats.isFile()) {
            totalSize += stats.size
          }
        } catch {
          // Ignore errors
        }
      }
    } catch {
      // Directory doesn't exist yet
    }
    return totalSize
  }

  /**
   * Evict oldest entry to make space
   */
  private async evictOldest(): Promise<void> {
    try {
      const files = await readdir(this.cacheDir, { recursive: true })
      let oldestFile: string | null = null
      let oldestTime = Infinity

      for (const file of files) {
        const filePath = join(this.cacheDir, file)
        try {
          const stats = await stat(filePath)
          if (!stats.isFile()) continue

          const content = await readFile(filePath, 'utf-8')
          const entry: CacheEntry<unknown> = JSON.parse(content) as CacheEntry<unknown>

          if (entry.timestamp < oldestTime) {
            oldestTime = entry.timestamp
            oldestFile = filePath
          }
        } catch {
          // Ignore errors
        }
      }

      if (oldestFile) {
        await unlink(oldestFile)
        this.stats.entries = Math.max(0, this.stats.entries - 1)
      }
    } catch (error) {
      logger.error('Failed to evict oldest entry:', error instanceof Error ? error : undefined)
    }
  }
}

/**
 * In-memory cache with TTL
 * Faster but not persistent
 */
export class MemoryCache {
  private cache = new Map<string, { value: unknown; expires: number }>()
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    entries: 0,
  }

  constructor(
    private options: {
      defaultTtl?: number
      maxEntries?: number
      maxSize?: number // Alias for maxEntries (for compatibility)
    } = {}
  ) {
    this.options = {
      defaultTtl: 3600000, // 1 hour
      maxEntries: options.maxEntries || options.maxSize || 1000,
      ...options,
    }
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      this.stats.misses++
      return null
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      this.stats.entries--
      this.stats.misses++
      return null
    }

    // Move to end (most recently used) for LRU
    this.cache.delete(key)
    this.cache.set(key, entry)

    this.stats.hits++
    return entry.value as T
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const exists = this.cache.has(key)

    // If updating existing key, delete it first to move to end (LRU)
    if (exists) {
      this.cache.delete(key)
      this.stats.entries--
    }

    // Evict least recently used if at max capacity
    if (this.options.maxEntries && this.cache.size >= this.options.maxEntries) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
        this.stats.entries--
      }
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + (ttl || this.options.defaultTtl || 3600000),
    })
    this.stats.entries++
  }

  /**
   * Delete from cache
   */
  delete(key: string): void {
    if (this.cache.delete(key)) {
      this.stats.entries--
    }
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      this.stats.entries--
      return false
    }
    return true
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      entries: 0,
    }
  }

  /**
   * Get statistics
   */
  getStats(): CacheStats {
    const totalAccess = this.stats.hits + this.stats.misses
    const hitRate = totalAccess > 0 ? this.stats.hits / totalAccess : 0
    return { ...this.stats, size: this.cache.size, hitRate }
  }

  /**
   * Evict expired entries
   */
  evictExpired(): number {
    const now = Date.now()
    let evicted = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key)
        evicted++
      }
    }

    this.stats.entries = Math.max(0, this.stats.entries - evicted)
    return evicted
  }
}

/**
 * Two-tier cache: Memory (L1) + File (L2)
 * Fast access with persistent storage
 */
export class TieredCache {
  private memoryCache: MemoryCache
  private fileCache: FileCache

  constructor(cacheDir: string, options?: { memorySize?: number; fileTtl?: number }) {
    this.memoryCache = new MemoryCache({
      maxEntries: options?.memorySize || 100,
      defaultTtl: 300000, // 5 minutes in memory
    })

    this.fileCache = new FileCache(cacheDir, {
      defaultTtl: options?.fileTtl || 3600000, // 1 hour on disk
      compression: true,
    })
  }

  /**
   * Get from cache (checks memory first, then file)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try memory cache first
    const memoryResult = this.memoryCache.get<T>(key)
    if (memoryResult !== null) {
      return memoryResult
    }

    // Try file cache
    const fileResult = await this.fileCache.get<T>(key)
    if (fileResult !== null) {
      // Populate memory cache
      this.memoryCache.set(key, fileResult)
      return fileResult
    }

    return null
  }

  /**
   * Set in both caches
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.memoryCache.set(key, value, ttl)
    await this.fileCache.set(key, value, ttl)
  }

  /**
   * Delete from both caches
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key)
    await this.fileCache.delete(key)
  }

  /**
   * Clear both caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()
    await this.fileCache.clear()
  }

  /**
   * Get combined statistics
   */
  async getStats() {
    const memStats = this.memoryCache.getStats()
    const fileStats = await this.fileCache.getStats()

    return {
      memory: memStats,
      file: fileStats,
      memorySize: memStats.size,
      fileSize: fileStats.size,
      total: {
        hits: memStats.hits + fileStats.hits,
        misses: memStats.misses + fileStats.misses,
        entries: memStats.entries + fileStats.entries,
      },
    }
  }
}
