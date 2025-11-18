#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Scraping Performance Benchmarks
 *
 * Measures the performance of key scraping operations:
 * - Single problem scraping
 * - Batch scraping
 * - HTML to Markdown conversion
 * - Storage operations
 *
 * Usage:
 *   npm run benchmark
 *   tsx tests/benchmarks/scraping-performance.bench.ts
 */

import { performance } from 'perf_hooks'

import { HtmlToMarkdownConverter } from '@lesca/converters'

import { createProblem, createProblems } from '../factories/problem-factory.js'

interface BenchmarkResult {
  name: string
  iterations: number
  totalTime: number
  avgTime: number
  minTime: number
  maxTime: number
  opsPerSecond: number
}

/**
 * Run a benchmark function multiple times and collect statistics
 */
async function benchmark(
  name: string,
  fn: () => Promise<void> | void,
  iterations: number = 100
): Promise<BenchmarkResult> {
  const times: number[] = []

  // Warm-up
  for (let i = 0; i < 5; i++) {
    await fn()
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    const end = performance.now()
    times.push(end - start)
  }

  const totalTime = times.reduce((a, b) => a + b, 0)
  const avgTime = totalTime / iterations
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const opsPerSecond = 1000 / avgTime

  return {
    name,
    iterations,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    opsPerSecond,
  }
}

/**
 * Format benchmark result for display
 */
function formatResult(result: BenchmarkResult): string {
  return `
${result.name}
  Iterations:  ${result.iterations}
  Total time:  ${result.totalTime.toFixed(2)}ms
  Avg time:    ${result.avgTime.toFixed(2)}ms
  Min time:    ${result.minTime.toFixed(2)}ms
  Max time:    ${result.maxTime.toFixed(2)}ms
  Ops/sec:     ${result.opsPerSecond.toFixed(2)}
`
}

/**
 * Main benchmark suite
 */
async function main() {
  console.log('\n🚀 Scraping Performance Benchmarks\n')
  console.log('─'.repeat(60))

  const results: BenchmarkResult[] = []

  // Benchmark 1: HTML to Markdown conversion (small)
  const converter = new HtmlToMarkdownConverter()
  const smallProblem = createProblem({
    content: '<p>Simple paragraph</p><code>console.log("test")</code>',
  })

  const result1 = await benchmark(
    'HTML to Markdown (small)',
    () => {
      void converter.convert(smallProblem.content)
    },
    1000
  )
  results.push(result1)

  // Benchmark 2: HTML to Markdown conversion (large)
  const largeProblem = createProblem({
    content: `<p>${'Lorem ipsum dolor sit amet. '.repeat(100)}</p>`.repeat(10),
  })

  const result2 = await benchmark(
    'HTML to Markdown (large)',
    () => {
      void converter.convert(largeProblem.content)
    },
    100
  )
  results.push(result2)

  // Benchmark 3: Batch problem creation
  const result3 = await benchmark(
    'Create 100 problems (factory)',
    () => {
      createProblems(100)
    },
    100
  )
  results.push(result3)

  // Print results
  results.forEach((result) => {
    console.log(formatResult(result))
  })

  // Summary
  console.log('─'.repeat(60))
  console.log('\n✅ Benchmarks complete!\n')

  // Performance budgets (warn if exceeded)
  const budgets = {
    'HTML to Markdown (small)': 1.0, // < 1ms average
    'HTML to Markdown (large)': 10.0, // < 10ms average
    'Create 100 problems (factory)': 5.0, // < 5ms average
  }

  let exceededBudgets = false
  for (const result of results) {
    const budget = budgets[result.name as keyof typeof budgets]
    if (budget && result.avgTime > budget) {
      console.log(`⚠️  ${result.name} exceeded budget: ${result.avgTime.toFixed(2)}ms > ${budget}ms`)
      exceededBudgets = true
    }
  }

  if (exceededBudgets) {
    console.log('\n⚠️  Some operations exceeded performance budgets\n')
    process.exit(1)
  }

  console.log('✅ All operations within performance budgets\n')
}

// Run benchmarks
main().catch((error) => {
  console.error('Benchmark failed:', error)
  process.exit(1)
})
