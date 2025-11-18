# Testing Guide

This guide explains Lesca's testing infrastructure, best practices, and how to write effective tests.

---

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Infrastructure](#test-infrastructure)
- [Coverage Requirements](#coverage-requirements)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Lesca has a comprehensive test suite with **631 passing tests** and **68.43% coverage**. The testing infrastructure is designed for:

- **Speed**: Unit tests run in < 30 seconds for fast feedback
- **Reliability**: Consistent, deterministic test results
- **Maintainability**: Clear, well-organized test structure
- **Completeness**: Unit, integration, and performance tests

### Test Types

| Test Type | Purpose | Speed | Run Frequency |
|-----------|---------|-------|---------------|
| **Unit** | Test individual functions/classes in isolation | Fast (< 30s) | Every commit/PR |
| **Integration** | Test cross-package workflows end-to-end | Slow (30s+) | Release only |
| **Benchmarks** | Track performance of critical paths | Varies | On-demand |

---

## Test Structure

### Directory Layout

```
lesca/
├── packages/*/src/__tests__/     # Unit tests for each package
├── shared/*/src/__tests__/       # Unit tests for shared modules
├── tests/
│   ├── integration/              # Integration tests
│   │   └── end-to-end.test.ts
│   ├── benchmarks/               # Performance benchmarks
│   │   ├── cache-performance.bench.ts
│   │   └── scraping-performance.bench.ts
│   ├── fixtures/                 # Static test data
│   │   ├── problems.ts
│   │   └── README.md
│   └── factories/                # Dynamic test data generators
│       ├── problem-factory.ts
│       └── README.md
```

### Test File Naming

- **Unit tests**: `*.test.ts` (co-located with source)
- **Integration tests**: `*.integration.test.ts` or `*.e2e.test.ts`
- **Benchmarks**: `*.bench.ts`

---

## Running Tests

### Quick Start

```bash
# Run unit tests (fast - recommended for development)
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:ui
```

### All Test Commands

```bash
# Unit tests only (fast - runs on every PR)
npm run test:unit

# Integration tests only (slower - runs on release)
npm run test:integration

# All tests (unit + integration)
npm run test:all

# Coverage report with unit tests
npm run test:coverage

# Coverage report with all tests
npm run test:coverage:all

# Validate coverage meets thresholds
npm run check-coverage

# Run performance benchmarks
npm run benchmark
```

### Configuration Files

- **`vitest.unit.config.ts`**: Fast unit tests
  - Includes: `packages/**/__tests__/**/*.test.ts`, `shared/**/__tests__/**/*.test.ts`
  - Excludes: Integration tests, benchmarks, slow external service tests
  - Timeout: 5 seconds per test
  - Target: < 30 seconds total

- **`vitest.integration.config.ts`**: Slow integration tests
  - Includes: `tests/integration/**/*.test.ts`, `**/*.integration.test.ts`, `**/*.e2e.test.ts`
  - Timeout: 30 seconds per test
  - Runs sequentially to avoid conflicts

---

## Writing Tests

### Basic Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('FeatureName', () => {
  describe('method/function', () => {
    it('should do something when condition', () => {
      // Arrange
      const input = 'test'

      // Act
      const result = doSomething(input)

      // Assert
      expect(result).toBe('expected')
    })
  })
})
```

### Using Factories

Factories generate dynamic test data with sensible defaults:

```typescript
import { createProblem, createScrapeRequest } from '../../../tests/factories/problem-factory'

describe('ProblemScraper', () => {
  it('should scrape a problem', async () => {
    // Create with defaults
    const problem = createProblem()

    // Create with custom properties
    const customProblem = createProblem({
      title: 'Two Sum',
      difficulty: 'Easy',
      titleSlug: 'two-sum',
    })

    // Use in test
    const request = createScrapeRequest({ titleSlug: 'two-sum' })
  })
})
```

### Using Fixtures

Fixtures provide static, pre-defined test data:

```typescript
import { twoSumProblem, hardProblems } from '../../../tests/fixtures/problems'

describe('ProblemFilter', () => {
  it('should filter hard problems', () => {
    const result = filterByDifficulty(hardProblems, 'Hard')
    expect(result).toHaveLength(2)
  })
})
```

### Mocking

#### Mocking Functions

```typescript
import { vi } from 'vitest'

it('should call callback', () => {
  const callback = vi.fn()

  doSomething(callback)

  expect(callback).toHaveBeenCalledWith('expected')
  expect(callback).toHaveBeenCalledTimes(1)
})
```

#### Mocking Modules

```typescript
import { vi } from 'vitest'

vi.mock('@lesca/api-client', () => ({
  GraphQLClient: vi.fn().mockImplementation(() => ({
    request: vi.fn().mockResolvedValue({ data: 'mocked' }),
  })),
}))
```

#### Mocking File System

```typescript
import { vi } from 'vitest'
import fs from 'fs/promises'

vi.mock('fs/promises')

it('should read file', async () => {
  vi.mocked(fs.readFile).mockResolvedValue('file contents')

  const result = await readConfigFile('config.yaml')

  expect(result).toBe('file contents')
})
```

---

## Test Infrastructure

### Factories (`tests/factories/`)

Factories provide flexible, type-safe test data generation:

**Available Factories:**

- `createProblem(overrides?)` - Generate a complete problem object
- `createScrapeRequest(overrides?)` - Generate a scrape request
- `createDiscussionRequest(overrides?)` - Generate a discussion request
- `createProblemList(count, overrides?)` - Generate multiple problems

**Example:**

```typescript
import { createProblem, createProblemList } from '../../../tests/factories/problem-factory'

// Single problem with defaults
const problem = createProblem()

// Custom problem
const hardProblem = createProblem({
  difficulty: 'Hard',
  acRate: 15.5,
})

// Multiple problems
const problems = createProblemList(10, { difficulty: 'Medium' })
```

See [`tests/factories/README.md`](../tests/factories/README.md) for details.

### Fixtures (`tests/fixtures/`)

Fixtures provide static, consistent test data:

**Available Fixtures:**

- `twoSumProblem` - The classic "Two Sum" problem
- `easyProblems` - Array of easy difficulty problems
- `mediumProblems` - Array of medium difficulty problems
- `hardProblems` - Array of hard difficulty problems

**Example:**

```typescript
import { twoSumProblem, hardProblems } from '../../../tests/fixtures/problems'

it('should format problem title', () => {
  expect(formatTitle(twoSumProblem.title)).toBe('Two Sum')
})

it('should filter hard problems', () => {
  const result = filterByDifficulty(hardProblems, 'Hard')
  expect(result.every(p => p.difficulty === 'Hard')).toBe(true)
})
```

See [`tests/fixtures/README.md`](../tests/fixtures/README.md) for details.

### Integration Tests (`tests/integration/`)

Integration tests verify end-to-end workflows:

```typescript
describe('End-to-End Scraping', () => {
  it('should scrape and convert problem', async () => {
    // Setup
    const scraper = new LeetCodeScraper(config)

    // Execute full workflow
    const result = await scraper.scrapeProblem('two-sum')

    // Verify end result
    expect(result.title).toBe('Two Sum')
    expect(result.content).toContain('# Two Sum')
  })
})
```

### Benchmarks (`tests/benchmarks/`)

Performance benchmarks track critical path performance:

**Available Benchmarks:**

- `cache-performance.bench.ts` - Cache operations (get, set, delete)
- `scraping-performance.bench.ts` - Scraping speed and throughput

**Running Benchmarks:**

```bash
# Run all benchmarks
npm run benchmark

# Run specific benchmark
npx tsx tests/benchmarks/cache-performance.bench.ts
```

See [`tests/benchmarks/README.md`](../tests/benchmarks/README.md) for details.

---

## Coverage Requirements

### Per-Package Thresholds

The `check-coverage` script enforces minimum coverage per package:

```bash
npm run check-coverage
```

**Minimum Thresholds:**

| Package | Statements | Branches | Functions | Lines |
|---------|-----------|----------|-----------|-------|
| **api-client** | 90% | 80% | 90% | 90% |
| **auth** | 90% | 80% | 90% | 90% |
| **browser-automation** | 85% | 75% | 85% | 85% |
| **converters** | 80% | 70% | 80% | 80% |
| **core** | 80% | 70% | 80% | 80% |
| **scrapers** | 85% | 75% | 85% | 85% |
| **storage** | 85% | 75% | 85% | 85% |
| **shared/utils** | 80% | 70% | 80% | 80% |
| **shared/config** | 80% | 70% | 80% | 80% |
| **shared/error** | 95% | 90% | 95% | 95% |

### Current Coverage

```
Total: 68.43% coverage
Tests: 631 passing, 3 skipped
```

**By Package:**

| Package | Coverage | Tests | Status |
|---------|----------|-------|--------|
| api-client | 98.45% | 28 | ✅ |
| auth | 95.75% | 41 | ✅ |
| browser-automation | 96.48% | 65 | ✅ |
| cli | 15.62% | 61 | 🚧 |
| converters | 85.97% | 154 | ✅ |
| core | 81.72% | 29 | ✅ |
| scrapers | 90.87% | 105 | ✅ |
| storage | 91.02% | 35 | ✅ |
| shared/utils | 80.22% | 23 | ✅ |
| shared/config | 93.09% | 28 | ✅ |
| shared/error | 100% | 34 | ✅ |

---

## Best Practices

### 1. Test Organization

```typescript
// Good: Clear hierarchy
describe('CacheManager', () => {
  describe('get()', () => {
    it('should return cached value when key exists', () => {})
    it('should return undefined when key does not exist', () => {})
    it('should return undefined when value is expired', () => {})
  })

  describe('set()', () => {
    it('should store value with default TTL', () => {})
    it('should store value with custom TTL', () => {})
    it('should overwrite existing value', () => {})
  })
})

// Bad: Flat structure
describe('CacheManager', () => {
  it('should get cached value', () => {})
  it('should set value', () => {})
  it('should delete value', () => {})
})
```

### 2. Test Names

Use descriptive, behavior-focused names:

```typescript
// Good
it('should throw error when config file is missing', () => {})
it('should use default value when environment variable is undefined', () => {})

// Bad
it('works', () => {})
it('test config', () => {})
```

### 3. Arrange-Act-Assert

Structure tests clearly:

```typescript
it('should format problem title', () => {
  // Arrange
  const problem = createProblem({ title: 'two-sum' })
  const formatter = new TitleFormatter()

  // Act
  const result = formatter.format(problem.title)

  // Assert
  expect(result).toBe('Two Sum')
})
```

### 4. Test Independence

Each test should be independent and not rely on other tests:

```typescript
// Good
describe('Counter', () => {
  let counter: Counter

  beforeEach(() => {
    counter = new Counter() // Fresh instance per test
  })

  it('should start at 0', () => {
    expect(counter.value).toBe(0)
  })

  it('should increment', () => {
    counter.increment()
    expect(counter.value).toBe(1)
  })
})

// Bad: Tests depend on execution order
describe('Counter', () => {
  const counter = new Counter() // Shared instance

  it('should start at 0', () => {
    expect(counter.value).toBe(0)
  })

  it('should increment', () => { // Relies on previous test
    counter.increment()
    expect(counter.value).toBe(1)
  })
})
```

### 5. Use Factories Over Fixtures

Prefer factories for flexibility, fixtures for consistency:

```typescript
// Good: Use factory for dynamic data
it('should filter by difficulty', () => {
  const easy = createProblem({ difficulty: 'Easy' })
  const hard = createProblem({ difficulty: 'Hard' })
  // ...
})

// Good: Use fixture for consistent reference data
it('should recognize "Two Sum" problem', () => {
  expect(isProblem(twoSumProblem)).toBe(true)
})
```

### 6. Async Testing

Always use async/await for async tests:

```typescript
// Good
it('should scrape problem', async () => {
  const result = await scraper.scrapeProblem('two-sum')
  expect(result.title).toBe('Two Sum')
})

// Bad: Missing await
it('should scrape problem', () => {
  const result = scraper.scrapeProblem('two-sum')
  expect(result.title).toBe('Two Sum') // Fails - result is a Promise
})
```

### 7. Error Testing

Test error cases explicitly:

```typescript
it('should throw error when file not found', async () => {
  await expect(readConfig('missing.yaml')).rejects.toThrow('File not found')
})

it('should throw specific error type', async () => {
  await expect(readConfig('invalid.yaml')).rejects.toThrow(ConfigError)
})
```

---

## Troubleshooting

### Tests Timing Out

If tests are timing out, increase the timeout or optimize the test:

```typescript
// Increase timeout for specific test
it('should handle large dataset', async () => {
  // ...
}, { timeout: 10000 }) // 10 seconds

// Or disable timeout for debugging
it('should debug issue', async () => {
  // ...
}, { timeout: 0 })
```

### Flaky Tests

If tests are flaky:

1. **Check for race conditions**: Use proper async/await
2. **Check for shared state**: Ensure tests are independent
3. **Check for timing dependencies**: Avoid relying on exact timing
4. **Enable retry**: Tests automatically retry once on failure

```typescript
// Disable retry for specific test
it('should not retry', () => {
  // ...
}, { retry: 0 })
```

### Coverage Not Updating

If coverage isn't reflecting changes:

```bash
# Clear coverage cache
rm -rf coverage/

# Re-run tests with coverage
npm run test:coverage
```

### Mock Issues

If mocks aren't working:

```typescript
// Ensure mocks are cleared between tests
beforeEach(() => {
  vi.clearAllMocks()
})

// Or reset mocks
beforeEach(() => {
  vi.resetAllMocks()
})

// Or restore original implementation
afterEach(() => {
  vi.restoreAllMocks()
})
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run test:unit
      - run: npm run check-coverage

  integration-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'release'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run test:integration
```

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev)
- [Coding Standards](./CODING_STANDARDS.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Test Factories README](../tests/factories/README.md)
- [Test Fixtures README](../tests/fixtures/README.md)
- [Benchmarks README](../tests/benchmarks/README.md)

---

**Happy Testing! 🧪**
