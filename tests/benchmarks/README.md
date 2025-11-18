# Performance Benchmarks

This directory contains performance benchmarks for critical paths in the codebase.

## Purpose

Benchmarks help us:
- Track performance over time
- Identify regressions
- Validate optimizations
- Set performance budgets

## Running Benchmarks

```bash
# Run all benchmarks
npm run benchmark

# Run specific benchmark
npx tsx tests/benchmarks/scraping-performance.bench.ts

# With profiling
node --prof tests/benchmarks/scraping-performance.bench.ts
```

## Benchmarks

- `scraping-performance.bench.ts` - Scraping speed benchmarks
- `conversion-performance.bench.ts` - Markdown conversion performance
- `cache-performance.bench.ts` - Cache operations performance
- `batch-performance.bench.ts` - Batch processing performance

## Guidelines

- Benchmarks should measure realistic workloads
- Use consistent test data across runs
- Run benchmarks on a quiet system
- Document baseline expectations
- Track results over time
