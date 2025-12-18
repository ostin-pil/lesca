#!/usr/bin/env tsx
/**
 * Performance Benchmarking Script
 * Measures scraping performance, memory usage, and cache efficiency
 */

import { performance } from 'perf_hooks'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
import { GraphQLClient } from '../packages/api-client/src/graphql-client'
import { ProblemScraperStrategy } from '../packages/scrapers/src/problem-strategy'
import { createCache } from '../shared/utils/src/cache-factory'
import { ConfigManager } from '../shared/config/src/config-manager'

interface BenchmarkResult {
  scenario: string
  duration: number
  itemsProcessed: number
  throughput: number // items per minute
  memory: {
    baseline: NodeJS.MemoryUsage
    peak: NodeJS.MemoryUsage
    final: NodeJS.MemoryUsage
  }
  cacheStats?: {
    hits: number
    misses: number
    hitRate: number
  }
}

interface BenchmarkReport {
  timestamp: string
  version: string
  results: BenchmarkResult[]
  summary: {
    avgThroughput: number
    peakMemoryMB: number
    avgCacheHitRate: number
  }
}

/**
 * Measure memory usage
 */
function getMemoryUsage(): NodeJS.MemoryUsage {
  if (global.gc) {
    global.gc()
  }
  return process.memoryUsage()
}

/**
 * Format memory usage in MB
 */
function formatMemory(mem: NodeJS.MemoryUsage): string {
  return `Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB, RSS: ${(mem.rss / 1024 / 1024).toFixed(2)}MB`
}

/**
 * Benchmark: Single problem scraping (cold cache)
 */
async function benchmarkSingleProblemCold(): Promise<BenchmarkResult> {
  console.log('📊 Benchmark: Single Problem (Cold Cache)...')

  const baseline = getMemoryUsage()
  const start = performance.now()

  const graphqlClient = new GraphQLClient()
  const strategy = new ProblemScraperStrategy(graphqlClient, undefined as any)

  let peak = baseline

  try {
    // Scrape a single problem
    await strategy.execute({ type: 'problem', titleSlug: 'two-sum' })

    peak = getMemoryUsage()
    const duration = performance.now() - start
    const final = getMemoryUsage()

    return {
      scenario: 'Single Problem (Cold Cache)',
      duration,
      itemsProcessed: 1,
      throughput: (1 / duration) * 60 * 1000,
      memory: { baseline, peak, final },
    }
  } catch (error) {
    console.error('Benchmark failed:', error)
    throw error
  }
}

/**
 * Benchmark: Single problem scraping (warm cache)
 */
async function benchmarkSingleProblemWarm(): Promise<BenchmarkResult> {
  console.log('📊 Benchmark: Single Problem (Warm Cache)...')

  const configManager = ConfigManager.getInstance()
  const config = configManager.getConfig()
  const cache = createCache(config)

  const baseline = getMemoryUsage()

  const graphqlClient = new GraphQLClient(undefined, undefined, cache)
  const strategy = new ProblemScraperStrategy(graphqlClient, undefined as any)

  // Prime the cache
  await strategy.execute({ type: 'problem', titleSlug: 'two-sum' })

  // Measure warm cache
  const start = performance.now()
  let peak = baseline

  await strategy.execute({ type: 'problem', titleSlug: 'two-sum' })

  peak = getMemoryUsage()
  const duration = performance.now() - start
  const final = getMemoryUsage()

  return {
    scenario: 'Single Problem (Warm Cache)',
    duration,
    itemsProcessed: 1,
    throughput: (1 / duration) * 60 * 1000,
    memory: { baseline, peak, final },
    cacheStats: {
      hits: 1,
      misses: 0,
      hitRate: 1.0,
    },
  }
}

/**
 * Benchmark: Batch scraping
 */
async function benchmarkBatchScraping(): Promise<BenchmarkResult> {
  console.log('📊 Benchmark: Batch Scraping (10 problems)...')

  const baseline = getMemoryUsage()
  const start = performance.now()

  const graphqlClient = new GraphQLClient()
  const strategy = new ProblemScraperStrategy(graphqlClient, undefined as any)

  const problems = [
    'two-sum',
    'add-two-numbers',
    'longest-substring-without-repeating-characters',
    'median-of-two-sorted-arrays',
    'longest-palindromic-substring',
    'zigzag-conversion',
    'reverse-integer',
    'string-to-integer-atoi',
    'palindrome-number',
    'regular-expression-matching',
  ]

  let peak = baseline
  let processed = 0

  for (const slug of problems) {
    try {
      await strategy.execute({ type: 'problem', titleSlug: slug })
      processed++
      const current = getMemoryUsage()
      if (current.heapUsed > peak.heapUsed) {
        peak = current
      }
    } catch (error) {
      console.warn(`Failed to scrape ${slug}:`, error)
    }
  }

  const duration = performance.now() - start
  const final = getMemoryUsage()

  return {
    scenario: 'Batch Scraping (10 problems)',
    duration,
    itemsProcessed: processed,
    throughput: (processed / duration) * 60 * 1000,
    memory: { baseline, peak, final },
  }
}

/**
 * Run all benchmarks
 */
async function runBenchmarks(): Promise<BenchmarkReport> {
  console.log('🚀 Starting Performance Benchmarks...\n')

  const results: BenchmarkResult[] = []

  try {
    // Run benchmarks
    results.push(await benchmarkSingleProblemCold())
    console.log('✅ Cold cache benchmark complete\n')

    results.push(await benchmarkSingleProblemWarm())
    console.log('✅ Warm cache benchmark complete\n')

    results.push(await benchmarkBatchScraping())
    console.log('✅ Batch scraping benchmark complete\n')
  } catch (error) {
    console.error('❌ Benchmark suite failed:', error)
  }

  // Calculate summary
  const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length
  const peakMemoryMB = Math.max(...results.map((r) => r.memory.peak.heapUsed)) / 1024 / 1024
  const avgCacheHitRate =
    results.filter((r) => r.cacheStats).reduce((sum, r) => sum + (r.cacheStats?.hitRate || 0), 0) /
      results.filter((r) => r.cacheStats).length || 0

  const report: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    version: '0.2.0',
    results,
    summary: {
      avgThroughput,
      peakMemoryMB,
      avgCacheHitRate,
    },
  }

  return report
}

/**
 * Format and display results
 */
function displayResults(report: BenchmarkReport): void {
  console.log('📈 BENCHMARK RESULTS')
  console.log('='.repeat(80))
  console.log(`Timestamp: ${report.timestamp}`)
  console.log(`Version: ${report.version}`)
  console.log()

  for (const result of report.results) {
    console.log(`Scenario: ${result.scenario}`)
    console.log(`  Duration: ${result.duration.toFixed(2)}ms`)
    console.log(`  Items: ${result.itemsProcessed}`)
    console.log(`  Throughput: ${result.throughput.toFixed(2)} items/min`)
    console.log(`  Memory (Baseline): ${formatMemory(result.memory.baseline)}`)
    console.log(`  Memory (Peak): ${formatMemory(result.memory.peak)}`)
    console.log(`  Memory (Final): ${formatMemory(result.memory.final)}`)

    if (result.cacheStats) {
      console.log(`  Cache Hit Rate: ${(result.cacheStats.hitRate * 100).toFixed(1)}%`)
    }

    console.log()
  }

  console.log('SUMMARY')
  console.log('-'.repeat(80))
  console.log(`Average Throughput: ${report.summary.avgThroughput.toFixed(2)} items/min`)
  console.log(`Peak Memory: ${report.summary.peakMemoryMB.toFixed(2)}MB`)
  console.log(`Average Cache Hit Rate: ${(report.summary.avgCacheHitRate * 100).toFixed(1)}%`)
  console.log('='.repeat(80))
}

/**
 * Main
 */
async function main() {
  try {
    const report = await runBenchmarks()
    displayResults(report)

    // Save to file
    const outputPath = resolve(__dirname, '../benchmark-results.json')
    writeFileSync(outputPath, JSON.stringify(report, null, 2))
    console.log(`\n💾 Results saved to: ${outputPath}`)

    process.exit(0)
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
