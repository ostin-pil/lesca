#!/usr/bin/env tsx
/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-non-null-assertion */
/**
 * Coverage Threshold Enforcement Script
 *
 * Validates that each package meets its minimum coverage threshold.
 * Run after `npm run test:coverage` to verify coverage requirements.
 *
 * Usage:
 *   npm run check-coverage
 *   tsx scripts/check-coverage.ts
 */

import { readFileSync, existsSync } from 'fs'
import { resolve , dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Per-package coverage thresholds (from STABILITY_TO_V1_PLAN.md)
const THRESHOLDS = {
  '@lesca/core': 95,
  '@lesca/scrapers': 92,
  '@lesca/converters': 90,
  '@lesca/storage': 95,
  '@lesca/browser-automation': 88,
  '@lesca/cli': 85,
  '@lesca/auth': 90,
  '@lesca/api-client': 90,
  '@lesca/shared/config': 90,
  '@lesca/shared/utils': 90,
  '@lesca/shared/error': 95,
  '@lesca/shared/types': 100, // Types should be fully covered
} as const

const OVERALL_THRESHOLD = 90

interface CoverageSummary {
  total: {
    lines: { pct: number }
    statements: { pct: number }
    functions: { pct: number }
    branches: { pct: number }
  }
  [key: string]: any
}

/**
 * Extract package name from file path
 */
function getPackageName(filePath: string): string | null {
  const match = filePath.match(/packages\/([^/]+)\//)
  if (match) {
    return `@lesca/${match[1]}`
  }

  const sharedMatch = filePath.match(/shared\/([^/]+)\//)
  if (sharedMatch) {
    return `@lesca/shared/${sharedMatch[1]}`
  }

  return null
}

/**
 * Calculate per-package coverage from coverage summary
 */
function calculatePackageCoverage(coverageSummary: CoverageSummary): Map<string, number> {
  const packageCoverage = new Map<string, number>()
  const packageStats = new Map<
    string,
    {
      lines: { covered: number; total: number }
      statements: { covered: number; total: number }
      functions: { covered: number; total: number }
      branches: { covered: number; total: number }
    }
  >()

  // Iterate through all files in coverage report
  for (const [filePath, fileCoverage] of Object.entries(coverageSummary)) {
    if (filePath === 'total') continue

    const packageName = getPackageName(filePath)
    if (!packageName) continue

    if (!packageStats.has(packageName)) {
      packageStats.set(packageName, {
        lines: { covered: 0, total: 0 },
        statements: { covered: 0, total: 0 },
        functions: { covered: 0, total: 0 },
        branches: { covered: 0, total: 0 },
      })
    }

    const stats = packageStats.get(packageName)!
    const fc = fileCoverage

    // Aggregate coverage stats
    stats.lines.covered += fc.lines?.covered || 0
    stats.lines.total += fc.lines?.total || 0
    stats.statements.covered += fc.statements?.covered || 0
    stats.statements.total += fc.statements?.total || 0
    stats.functions.covered += fc.functions?.covered || 0
    stats.functions.total += fc.functions?.total || 0
    stats.branches.covered += fc.branches?.covered || 0
    stats.branches.total += fc.branches?.total || 0
  }

  // Calculate average coverage per package
  for (const [packageName, stats] of packageStats.entries()) {
    const linePct = stats.lines.total > 0 ? (stats.lines.covered / stats.lines.total) * 100 : 100
    const stmtPct = stats.statements.total > 0 ? (stats.statements.covered / stats.statements.total) * 100 : 100
    const funcPct = stats.functions.total > 0 ? (stats.functions.covered / stats.functions.total) * 100 : 100
    const branchPct = stats.branches.total > 0 ? (stats.branches.covered / stats.branches.total) * 100 : 100

    // Use average of all metrics
    const avgPct = (linePct + stmtPct + funcPct + branchPct) / 4
    packageCoverage.set(packageName, avgPct)
  }

  return packageCoverage
}

/**
 * Format percentage with color
 */
function formatPercentage(value: number, threshold: number): string {
  const formatted = value.toFixed(2) + '%'
  if (value >= threshold) {
    return `\x1b[32m${formatted}\x1b[0m` // Green
  } else if (value >= threshold - 5) {
    return `\x1b[33m${formatted}\x1b[0m` // Yellow
  } else {
    return `\x1b[31m${formatted}\x1b[0m` // Red
  }
}

/**
 * Main function
 */
function main() {
  console.log('\n📊 Checking coverage thresholds...\n')

  // Read coverage summary
  const coveragePath = resolve(__dirname, '../coverage/coverage-summary.json')
  if (!existsSync(coveragePath)) {
    console.error('❌ Coverage summary not found. Run `npm run test:coverage` first.')
    process.exit(1)
  }

  const coverageSummary: CoverageSummary = JSON.parse(readFileSync(coveragePath, 'utf-8'))

  // Calculate per-package coverage
  const packageCoverage = calculatePackageCoverage(coverageSummary)

  // Check overall coverage
  const overallCoverage = coverageSummary.total.lines.pct
  console.log(`Overall Coverage: ${formatPercentage(overallCoverage, OVERALL_THRESHOLD)}`)
  console.log(`  Lines:      ${formatPercentage(coverageSummary.total.lines.pct, OVERALL_THRESHOLD)}`)
  console.log(`  Statements: ${formatPercentage(coverageSummary.total.statements.pct, OVERALL_THRESHOLD)}`)
  console.log(`  Functions:  ${formatPercentage(coverageSummary.total.functions.pct, OVERALL_THRESHOLD)}`)
  console.log(`  Branches:   ${formatPercentage(coverageSummary.total.branches.pct, OVERALL_THRESHOLD)}`)
  console.log()

  // Check per-package coverage
  const failures: string[] = []

  console.log('Per-Package Coverage:')
  console.log('─'.repeat(60))

  for (const [packageName, threshold] of Object.entries(THRESHOLDS)) {
    const coverage = packageCoverage.get(packageName)

    if (coverage === undefined) {
      console.log(`  ${packageName.padEnd(35)} - No coverage data`)
      continue
    }

    const status = coverage >= threshold ? '✓' : '✗'
    const statusColor = coverage >= threshold ? '\x1b[32m' : '\x1b[31m'

    console.log(
      `  ${statusColor}${status}\x1b[0m ${packageName.padEnd(35)} ${formatPercentage(coverage, threshold)} (target: ${threshold}%)`
    )

    if (coverage < threshold) {
      failures.push(`${packageName}: ${coverage.toFixed(2)}% < ${threshold}%`)
    }
  }

  console.log('─'.repeat(60))

  // Report results
  if (failures.length === 0 && overallCoverage >= OVERALL_THRESHOLD) {
    console.log('\n✅ All coverage thresholds met!\n')
    process.exit(0)
  } else {
    console.log('\n❌ Coverage thresholds not met:\n')

    if (overallCoverage < OVERALL_THRESHOLD) {
      console.log(`  - Overall coverage: ${overallCoverage.toFixed(2)}% < ${OVERALL_THRESHOLD}%`)
    }

    failures.forEach((failure) => {
      console.log(`  - ${failure}`)
    })

    console.log('\nRun `npm run test:coverage` to see detailed coverage report.\n')
    process.exit(1)
  }
}

main()
