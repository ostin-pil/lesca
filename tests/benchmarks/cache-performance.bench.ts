#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Cache Performance Benchmarks
 *
 * Measures cache operation performance:
 * - Set operations
 * - Get operations (hit/miss)
 * - Eviction performance
 * - Persistence operations
 */

import { mkdtempSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { performance } from 'perf_hooks'

import { FileCache } from '@lesca/shared/utils'

interface BenchmarkResult {
  name: string
  iterations: number
  avgTime: number
  opsPerSecond: number
}

async function benchmark(
  name: string,
  fn: () => Promise<void> | void,
  iterations: number = 1000
): Promise<BenchmarkResult> {
  const times: number[] = []

  // Warm-up
  for (let i = 0; i < 10; i++) {
    await fn()
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    const end = performance.now()
    times.push(end - start)
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / iterations
  const opsPerSecond = 1000 / avgTime

  return { name, iterations, avgTime, opsPerSecond }
}

async function main() {
  console.log('\n🚀 Cache Performance Benchmarks\n')
  console.log('─'.repeat(60))

  const tempDir = mkdtempSync(join(tmpdir(), 'lesca-bench-'))
  const cachePath = join(tempDir, 'cache.json')

  try {
    const cache = new FileCache(cachePath, {
      defaultTtl: 3600000,
      maxSize: 1000,
    })

    // Benchmark: Cache set operations
    let counter = 0
    const result1 = await benchmark(
      'Cache SET operation',
      async () => {
        await cache.set(`key-${counter++}`, { data: 'test value', timestamp: Date.now() })
      },
      1000
    )

    // Benchmark: Cache get operations (hits)
    await cache.set('test-key', { data: 'test value' })
    const result2 = await benchmark(
      'Cache GET operation (hit)',
      async () => {
        await cache.get('test-key')
      },
      1000
    )

    // Benchmark: Cache get operations (misses)
    const result3 = await benchmark(
      'Cache GET operation (miss)',
      async () => {
        await cache.get('non-existent-key')
      },
      1000
    )

    // Print results
    const results = [result1, result2, result3]
    results.forEach((r) => {
      console.log(`\n${r.name}`)
      console.log(`  Iterations:  ${r.iterations}`)
      console.log(`  Avg time:    ${r.avgTime.toFixed(3)}ms`)
      console.log(`  Ops/sec:     ${r.opsPerSecond.toFixed(0)}`)
    })

    console.log('\n' + '─'.repeat(60))
    console.log('\n✅ Cache benchmarks complete!\n')

    // Performance budgets
    if (result1.avgTime > 1.0) {
      console.log(`⚠️  Cache SET is slow: ${result1.avgTime.toFixed(2)}ms`)
    }
    if (result2.avgTime > 0.5) {
      console.log(`⚠️  Cache GET (hit) is slow: ${result2.avgTime.toFixed(2)}ms`)
    }
  } finally {
    // Cleanup
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  }
}

main().catch(console.error)
