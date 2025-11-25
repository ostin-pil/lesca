import type { Config } from '@/shared/config/src/schema'

import { TieredCache } from './cache'

/**
 * Create a TieredCache instance based on configuration
 * Returns undefined if caching is disabled
 */
export function createCache(config: Config): TieredCache | undefined {
  if (!config.cache?.enabled) {
    return undefined
  }

  return new TieredCache(config.cache.directory || '', {
    memorySize: config.cache.memorySize,
    fileTtl: config.cache.ttl?.problem, // Use problem TTL as file cache default
  })
}
