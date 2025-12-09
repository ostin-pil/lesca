#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Browser Pool Performance Benchmarks
 *
 * Compares pooled vs non-pooled browser operations:
 * - Single browser launch vs pool acquire
 * - Sequential operations with/without pooling
 * - Concurrent operations with/without pooling
 * - Memory usage comparison
 *
 * Usage:
 *   npm run bench:pool
 *   tsx tests/benchmarks/browser-pool.bench.ts
 *
 * Note: These benchmarks launch real browsers and are slow.
 * Run with --quick flag for a faster subset.
 */

import { performance } from 'perf_hooks'

import { chromium, Browser } from 'playwright'

import { BrowserPool, MetricsCollector, SessionPoolManager } from '@lesca/browser-automation'

interface BenchmarkResult {
  name: string
  iterations: number
  totalTime: number
  avgTime: number
  minTime: number
  maxTime: number
  p95Time: number
  p99Time: number
  browserLaunches: number
  memoryUsedMB: number
}

interface BenchmarkOptions {
  iterations?: number
  warmup?: number
  trackMemory?: boolean
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr: number[], p: number): number {
  const index = Math.ceil((p / 100) * sortedArr.length) - 1
  return sortedArr[Math.max(0, index)] ?? 0
}

/**
 * Get current memory usage in MB
 */
function getMemoryUsage(): number {
  const used = process.memoryUsage()
  return Math.round(used.heapUsed / 1024 / 1024)
}

/**
 * Run a benchmark and collect detailed statistics
 */
async function benchmark(
  name: string,
  fn: () => Promise<{ browserLaunches: number }>,
  options: BenchmarkOptions = {}
): Promise<BenchmarkResult> {
  const { iterations = 10, warmup = 2, trackMemory = true } = options
  const times: number[] = []
  let totalBrowserLaunches = 0
  const startMemory = trackMemory ? getMemoryUsage() : 0

  // Warmup phase
  console.log(`  Warming up (${warmup} iterations)...`)
  for (let i = 0; i < warmup; i++) {
    await fn()
  }

  // Force GC if available
  if (global.gc) {
    global.gc()
  }

  // Benchmark phase
  console.log(`  Running benchmark (${iterations} iterations)...`)
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    const result = await fn()
    const end = performance.now()
    times.push(end - start)
    totalBrowserLaunches += result.browserLaunches
    process.stdout.write(`\r  Progress: ${i + 1}/${iterations}`)
  }
  console.log()

  const endMemory = trackMemory ? getMemoryUsage() : 0
  const sortedTimes = [...times].sort((a, b) => a - b)
  const totalTime = times.reduce((a, b) => a + b, 0)

  return {
    name,
    iterations,
    totalTime,
    avgTime: totalTime / iterations,
    minTime: sortedTimes[0] ?? 0,
    maxTime: sortedTimes[sortedTimes.length - 1] ?? 0,
    p95Time: percentile(sortedTimes, 95),
    p99Time: percentile(sortedTimes, 99),
    browserLaunches: totalBrowserLaunches,
    memoryUsedMB: endMemory - startMemory,
  }
}

/**
 * Format benchmark result for display
 */
function formatResult(result: BenchmarkResult): string {
  return `
${result.name}
  Iterations:      ${result.iterations}
  Total time:      ${result.totalTime.toFixed(0)}ms
  Avg time:        ${result.avgTime.toFixed(2)}ms
  Min time:        ${result.minTime.toFixed(2)}ms
  Max time:        ${result.maxTime.toFixed(2)}ms
  P95 time:        ${result.p95Time.toFixed(2)}ms
  P99 time:        ${result.p99Time.toFixed(2)}ms
  Browser launches: ${result.browserLaunches}
  Memory delta:    ${result.memoryUsedMB}MB
`
}

/**
 * Compare two results and show improvement percentage
 */
function compareResults(baseline: BenchmarkResult, optimized: BenchmarkResult): void {
  const avgImprovement = ((baseline.avgTime - optimized.avgTime) / baseline.avgTime) * 100
  const launchReduction =
    ((baseline.browserLaunches - optimized.browserLaunches) / baseline.browserLaunches) * 100

  console.log('\n📊 Comparison:')
  console.log(`  Avg time improvement:    ${avgImprovement.toFixed(1)}%`)
  console.log(
    `  Browser launch reduction: ${launchReduction.toFixed(1)}% (${baseline.browserLaunches} → ${optimized.browserLaunches})`
  )
}

/**
 * Benchmark: Non-pooled browser operations
 * Each operation launches and closes a new browser
 */
async function benchmarkNonPooled(iterations: number): Promise<BenchmarkResult> {
  console.log('\n🔄 Non-Pooled Browser Operations')

  return await benchmark(
    'Non-Pooled (new browser each time)',
    async () => {
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage()
        await page.goto('about:blank')
        await page.close()
      } finally {
        await browser.close()
      }
      return { browserLaunches: 1 }
    },
    { iterations }
  )
}

/**
 * Benchmark: Pooled browser operations using BrowserPool
 */
async function benchmarkPooled(iterations: number): Promise<BenchmarkResult> {
  console.log('\n🏊 Pooled Browser Operations (BrowserPool)')

  const collector = new MetricsCollector()
  const pool = new BrowserPool({ maxSize: 3 }, { headless: true }, { metricsCollector: collector })

  let browserLaunches = 0
  collector.on('metric', (event) => {
    if (event.type === 'pool:browser-created') {
      browserLaunches++
    }
  })

  try {
    const result = await benchmark(
      'Pooled (BrowserPool)',
      async () => {
        const browser = await pool.acquire()
        try {
          const page = await browser.newPage()
          await page.goto('about:blank')
          await page.close()
        } finally {
          await pool.release(browser)
        }
        return { browserLaunches: 0 } // Counted via metrics
      },
      { iterations }
    )

    // Include browser launches from metrics
    result.browserLaunches = browserLaunches

    return result
  } finally {
    await pool.drain()
  }
}

/**
 * Benchmark: SessionPoolManager operations
 */
async function benchmarkSessionPool(iterations: number): Promise<BenchmarkResult> {
  console.log('\n🎯 Session Pool Manager Operations')

  const collector = new MetricsCollector()
  const manager = new SessionPoolManager(
    { perSessionMaxSize: 3, acquireTimeout: 60000 },
    { headless: true },
    { metricsCollector: collector }
  )

  let browserLaunches = 0
  collector.on('metric', (event) => {
    if (event.type === 'pool:browser-created') {
      browserLaunches++
    }
  })

  try {
    const result = await benchmark(
      'Session Pool Manager',
      async () => {
        const browser = await manager.acquireBrowser('bench-session')
        try {
          const page = await browser.newPage()
          await page.goto('about:blank')
          await page.close()
        } finally {
          await manager.releaseBrowser(browser, 'bench-session')
        }
        return { browserLaunches: 0 }
      },
      { iterations }
    )

    result.browserLaunches = browserLaunches
    return result
  } finally {
    await manager.drainAll()
  }
}

/**
 * Benchmark: Concurrent operations without pooling
 */
async function benchmarkConcurrentNonPooled(
  concurrency: number,
  batches: number
): Promise<BenchmarkResult> {
  console.log(`\n⚡ Concurrent Non-Pooled (${concurrency} concurrent, ${batches} batches)`)

  return await benchmark(
    `Concurrent Non-Pooled (${concurrency}x${batches})`,
    async () => {
      const operations = Array.from({ length: concurrency }, async () => {
        const browser = await chromium.launch({ headless: true })
        try {
          const page = await browser.newPage()
          await page.goto('about:blank')
          await page.close()
        } finally {
          await browser.close()
        }
      })
      await Promise.all(operations)
      return { browserLaunches: concurrency }
    },
    { iterations: batches }
  )
}

/**
 * Benchmark: Concurrent operations with pooling
 */
async function benchmarkConcurrentPooled(
  concurrency: number,
  batches: number
): Promise<BenchmarkResult> {
  console.log(`\n⚡ Concurrent Pooled (${concurrency} concurrent, ${batches} batches)`)

  const collector = new MetricsCollector()
  const pool = new BrowserPool(
    { maxSize: concurrency },
    { headless: true },
    { metricsCollector: collector }
  )

  let browserLaunches = 0
  collector.on('metric', (event) => {
    if (event.type === 'pool:browser-created') {
      browserLaunches++
    }
  })

  try {
    const result = await benchmark(
      `Concurrent Pooled (${concurrency}x${batches})`,
      async () => {
        const operations = Array.from({ length: concurrency }, async () => {
          const browser = await pool.acquire()
          try {
            const page = await browser.newPage()
            await page.goto('about:blank')
            await page.close()
          } finally {
            await pool.release(browser)
          }
        })
        await Promise.all(operations)
        return { browserLaunches: 0 }
      },
      { iterations: batches }
    )

    result.browserLaunches = browserLaunches
    return result
  } finally {
    await pool.drain()
  }
}

/**
 * Print metrics summary from collector
 */
function printMetricsSummary(collector: MetricsCollector): void {
  const summary = collector.getSummary()
  console.log('\n📈 Metrics Summary:')
  console.log(`  Total sessions:     ${summary.totalSessions}`)
  console.log(`  Active browsers:    ${summary.totalActiveBrowsers}`)
  console.log(`  Idle browsers:      ${summary.totalIdleBrowsers}`)
  console.log(`  Failure rate:       ${(summary.globalFailureRate * 100).toFixed(1)}%`)
  console.log(`  Circuits open:      ${summary.circuitsOpen}`)

  for (const session of summary.sessions) {
    console.log(`\n  Session "${session.sessionName}":`)
    console.log(`    Acquisitions:     ${session.totalAcquisitions}`)
    console.log(`    Avg acquire time: ${session.acquireTiming.avgMs.toFixed(2)}ms`)
    console.log(`    Circuit state:    ${session.circuitState}`)
  }
}

/**
 * Quick benchmark mode (fewer iterations)
 */
async function runQuickBenchmarks(): Promise<void> {
  console.log('\n⏱️  Running QUICK benchmarks (reduced iterations)\n')

  const nonPooled = await benchmarkNonPooled(5)
  console.log(formatResult(nonPooled))

  const pooled = await benchmarkPooled(5)
  console.log(formatResult(pooled))

  compareResults(nonPooled, pooled)
}

/**
 * Full benchmark suite
 */
async function runFullBenchmarks(): Promise<void> {
  console.log('\n🚀 Running FULL Browser Pool Benchmarks\n')
  console.log('─'.repeat(60))

  const results: BenchmarkResult[] = []

  // Sequential benchmarks
  const nonPooled = await benchmarkNonPooled(10)
  results.push(nonPooled)
  console.log(formatResult(nonPooled))

  const pooled = await benchmarkPooled(10)
  results.push(pooled)
  console.log(formatResult(pooled))

  console.log('\n' + '─'.repeat(60))
  console.log('Sequential Operations:')
  compareResults(nonPooled, pooled)

  const sessionPooled = await benchmarkSessionPool(10)
  results.push(sessionPooled)
  console.log(formatResult(sessionPooled))

  // Concurrent benchmarks
  console.log('\n' + '─'.repeat(60))

  const concurrentNonPooled = await benchmarkConcurrentNonPooled(3, 5)
  results.push(concurrentNonPooled)
  console.log(formatResult(concurrentNonPooled))

  const concurrentPooled = await benchmarkConcurrentPooled(3, 5)
  results.push(concurrentPooled)
  console.log(formatResult(concurrentPooled))

  console.log('\n' + '─'.repeat(60))
  console.log('Concurrent Operations:')
  compareResults(concurrentNonPooled, concurrentPooled)

  // Summary
  console.log('\n' + '─'.repeat(60))
  console.log('\n✅ All benchmarks complete!\n')

  // Performance expectations
  console.log('📋 Performance Expectations:')
  const pooledImprovement = ((nonPooled.avgTime - pooled.avgTime) / nonPooled.avgTime) * 100
  const concurrentImprovement =
    ((concurrentNonPooled.avgTime - concurrentPooled.avgTime) / concurrentNonPooled.avgTime) * 100

  if (pooledImprovement > 50) {
    console.log(
      `  ✅ Sequential pooling is ${pooledImprovement.toFixed(0)}% faster (expected >50%)`
    )
  } else {
    console.log(
      `  ⚠️  Sequential pooling is only ${pooledImprovement.toFixed(0)}% faster (expected >50%)`
    )
  }

  if (concurrentImprovement > 30) {
    console.log(
      `  ✅ Concurrent pooling is ${concurrentImprovement.toFixed(0)}% faster (expected >30%)`
    )
  } else {
    console.log(
      `  ⚠️  Concurrent pooling is only ${concurrentImprovement.toFixed(0)}% faster (expected >30%)`
    )
  }

  const launchReduction =
    ((nonPooled.browserLaunches - pooled.browserLaunches) / nonPooled.browserLaunches) * 100
  if (launchReduction > 80) {
    console.log(`  ✅ Browser launch reduction: ${launchReduction.toFixed(0)}% (expected >80%)`)
  } else {
    console.log(`  ⚠️  Browser launch reduction: ${launchReduction.toFixed(0)}% (expected >80%)`)
  }

  console.log()
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const isQuick = process.argv.includes('--quick')

  console.log('\n🏊 Browser Pool Performance Benchmarks')
  console.log('═'.repeat(60))

  try {
    if (isQuick) {
      await runQuickBenchmarks()
    } else {
      await runFullBenchmarks()
    }
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error)
    process.exit(1)
  }
}

// Run benchmarks
main().catch((error) => {
  console.error('Benchmark failed:', error)
  process.exit(1)
})
