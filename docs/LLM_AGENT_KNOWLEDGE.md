# LLM Agent Knowledge Base for Lesca

> **Purpose**: Comprehensive reference for AI agents working on the Lesca project. This document consolidates critical information from across the codebase, documentation, and development workflows.

**Last Updated**: 2025-11-27
**Project Version**: v0.1.0
**Tests**: 631 passing • Coverage: 68.43%
**Recent Improvements**: Logger enhancements, Adapter pattern, eslint-disable audit (17 comments removed)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Design Patterns](#architecture--design-patterns)
3. [Codebase Structure](#codebase-structure)
4. [TypeScript Configuration & Standards](#typescript-configuration--standards)
5. [Testing Infrastructure](#testing-infrastructure)
6. [Build & Deployment](#build--deployment)
7. [Development Workflow](#development-workflow)
8. [Common Patterns & Conventions](#common-patterns--conventions)
9. [Quick Reference](#quick-reference)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

### What is Lesca?

**Lesca** (LeetCode Scraper Architecture) is a modular TypeScript-based scraper for creating personal knowledge bases from LeetCode content. It's designed for Obsidian and other markdown-based systems.

### Key Features

- ✅ Comprehensive scraping: Problems, editorials, discussions, problem lists
- ✅ Type-safe TypeScript with strict mode
- ✅ Markdown/Obsidian export with frontmatter
- ✅ GraphQL API client with rate limiting
- ✅ Browser automation via Playwright
- ✅ Intelligent tiered caching system
- ✅ Modular monorepo architecture
- ✅ 631 passing tests, 68.43% coverage

### Tech Stack

- **Language**: TypeScript 5.3 (strict mode, ESNext modules)
- **Runtime**: Node.js ≥ 18.0.0
- **Package Manager**: npm ≥ 9.0.0 (workspaces)
- **Testing**: Vitest (unit + integration + benchmarks)
- **Browser**: Playwright
- **CLI**: Commander.js
- **Config**: YAML/JSON with cosmiconfig pattern
- **CI/CD**: GitHub Actions

---

## Architecture & Design Patterns

### Core Design Patterns

#### 1. **Facade Pattern** - Core Orchestration

```typescript
// packages/core/src/scraper.ts
export class LeetCodeScraper {
  constructor(
    private strategies: ScraperStrategy[],
    private storage: StorageAdapter,
    private converter: Converter
  ) {}

  async scrape(request: ScrapeRequest): Promise<ScrapeResult> {
    const strategy = this.selectStrategy(request)
    const raw = await strategy.execute(request)
    const processed = await this.converter.convert(raw)
    await this.storage.save(processed)
    return { success: true, data: processed }
  }
}
```

**Why**: Delegates to strategies, keeps business logic out of core.

#### 2. **Strategy Pattern** - Scraping Strategies

```typescript
// shared/types/src/index.ts
export interface ScraperStrategy {
  name: string
  priority: number
  canHandle(request: ScrapeRequest): boolean
  execute(request: ScrapeRequest): Promise<RawData>
}

// packages/scrapers/src/problem-strategy.ts
export class ProblemScraperStrategy implements ScraperStrategy {
  readonly name = 'problem'
  readonly priority = 10

  canHandle(request: ScrapeRequest): boolean {
    return request.type === 'problem'
  }

  async execute(request: ProblemScrapeRequest): Promise<RawData> {
    // Implementation
  }
}
```

**Available Strategies**:

- `ProblemScraperStrategy` - Scrapes individual problems
- `ListScraperStrategy` - Scrapes problem lists
- `EditorialScraperStrategy` - Scrapes editorials (requires browser)
- `DiscussionScraperStrategy` - Scrapes discussion threads

#### 3. **Singleton Pattern** - Configuration

```typescript
// shared/config/src/manager.ts
export class ConfigManager {
  private static instance: ConfigManager | null = null

  private constructor(private config: Config) {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(createDefaultConfig())
    }
    return ConfigManager.instance
  }
}
```

### Monorepo Structure

```
lesca/
├── packages/                  # Main application packages
│   ├── core/                 # LeetCodeScraper, BatchScraper (facade)
│   ├── auth/                 # CookieFileAuth (cookie-based auth)
│   ├── api-client/           # GraphQLClient, RateLimiter
│   ├── browser-automation/   # PlaywrightDriver, BrowserPool, SessionManager
│   ├── scrapers/             # Strategy implementations (4 strategies)
│   ├── converters/           # HTML→Markdown, ObsidianConverter
│   ├── storage/              # FileSystemStorage adapter
│   └── cli/                  # CLI commands (Commander.js)
├── shared/                   # Shared modules
│   ├── types/               # All TypeScript interfaces/types (single source of truth)
│   ├── config/              # ConfigManager, config loader
│   ├── utils/               # TieredCache, logger, helpers
│   └── error/               # LescaError, GraphQLError, AuthError
├── tests/                    # Integration tests
│   ├── integration/         # End-to-end tests
│   ├── benchmarks/          # Performance benchmarks
│   ├── factories/           # Test data factories (dynamic)
│   └── fixtures/            # Test data fixtures (static)
├── docs/                     # All documentation
└── examples/                 # Configuration examples
```

### Package Responsibilities

| Package                | Purpose                              | Key Exports                                     |
| ---------------------- | ------------------------------------ | ----------------------------------------------- |
| **core**               | Orchestration, batch processing      | `LeetCodeScraper`, `BatchScraper`               |
| **auth**               | Cookie-based authentication          | `CookieFileAuth`                                |
| **api-client**         | GraphQL requests with rate limiting  | `GraphQLClient`, `RateLimiter`                  |
| **browser-automation** | Playwright driver, pooling, sessions | `PlaywrightDriver`, `BrowserPool`               |
| **scrapers**           | Strategy implementations             | `ProblemScraperStrategy`, `ListScraperStrategy` |
| **converters**         | Format transformation                | `HtmlToMarkdownConverter`, `ObsidianConverter`  |
| **storage**            | Filesystem persistence               | `FileSystemStorage`                             |
| **cli**                | CLI interface                        | Command implementations                         |

---

## Codebase Structure

### File Organization

```
packages/package-name/
├── src/
│   ├── index.ts              # Public API exports
│   ├── feature.ts            # Implementation
│   └── __tests__/            # Co-located unit tests
│       └── feature.test.ts
└── package.json
```

### Import Patterns

**CRITICAL RULES**:

- ❌ **NEVER** include file extensions (`.ts`, `.js`) in imports
- ✅ Use `@/shared/...` alias for shared packages
- ✅ Use `@lesca/...` aliases for cross-package imports
- ✅ Use relative imports (no extension) for same-package imports

**Import Order**:

```typescript
// 1. Node built-ins
import { resolve } from 'path'
import { existsSync } from 'fs'

// 2. External packages
import chalk from 'chalk'
import { Command } from 'commander'

// 3. Shared packages (@ alias)
import type { Config, Problem } from '@/shared/types'
import { logger } from '@/shared/utils'
import { ConfigManager } from '@/shared/config'

// 4. Cross-package imports
import { GraphQLClient } from '@lesca/api-client'

// 5. Local imports (same package, no extension!)
import { helperFunction } from './helpers'
import type { LocalType } from './types'
```

### Key Type Definitions

**All types are defined in** `shared/types/src/index.ts`:

```typescript
// Core domain types
export interface Problem { ... }
export interface ProblemListItem { ... }
export interface Discussion { ... }
export interface EditorialContent { ... }

// Request/Response types
export type ScrapeRequest =
  | ProblemScrapeRequest
  | ListScrapeRequest
  | DiscussionScrapeRequest
  | EditorialScrapeRequest

export interface RawData { ... }
export interface ProcessedData { ... }
export interface ScrapeResult { ... }

// Strategy interfaces
export interface ScraperStrategy { ... }
export interface Converter { ... }
export interface StorageAdapter { ... }

// Config types
export interface Config { ... }
export interface RateLimiterConfig { ... }

// Errors
export class LescaError extends Error { ... }
export class GraphQLError extends LescaError { ... }
export class AuthError extends LescaError { ... }
```

**IMPORTANT**: Always import types from `@/shared/types`, never redefine.

---

## TypeScript Configuration & Standards

### Strict Mode Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

### Critical TypeScript Rules

#### 1. **No `any` Type** (ESLint: `@typescript-eslint/no-explicit-any: error`)

```typescript
// ❌ NEVER
function process(data: any) {
  return data.value
}

// ✅ ALWAYS
function process(data: unknown): string | undefined {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String((data as Record<string, unknown>).value)
  }
  return undefined
}
```

#### 2. **No Non-Null Assertions** (`!`)

```typescript
// ❌ NEVER
const path = config.path!
const item = array[0]!

// ✅ ALWAYS
if (config.path) {
  const path = config.path
}

const item = array[0]
if (!item) throw new Error('Empty array')
```

#### 3. **Array Access Safety** (`noUncheckedIndexedAccess: true`)

```typescript
// ❌ Will fail typecheck
const first = array[0]
console.log(first.name) // Error: first is possibly undefined

// ✅ ALWAYS check
const first = array[0]
if (!first) throw new Error('Empty array')
console.log(first.name) // Safe
```

#### 4. **No Unnecessary Async**

```typescript
// ❌ Don't mark as async if no await
async function getName(): Promise<string> {
  return 'John' // ESLint error: require-await
}

// ✅ Remove async
function getName(): string {
  return 'John'
}
```

#### 5. **Optional Property Handling** (`exactOptionalPropertyTypes: true`)

```typescript
// ❌ NEVER assign undefined
interface Options {
  path?: string
}
const opts: Options = {
  path: configPath || undefined, // ERROR
}

// ✅ Conditionally add properties
const opts: Options = {}
if (configPath) opts.path = configPath

// ✅ Or use spread
const opts: Options = {
  ...(configPath && { path: configPath }),
}
```

### ESLint Configuration

```javascript
// .eslintrc.cjs
{
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',              // ZERO TOLERANCE
    '@typescript-eslint/no-non-null-assertion': 'error',        // ZERO TOLERANCE
    '@typescript-eslint/require-await': 'error',                // No async without await
    '@typescript-eslint/no-floating-promises': 'error',         // Always await promises
    'no-console': 'error',                                      // Use logger instead
    'import/extensions': ['error', 'never'],                    // No file extensions
    'import/order': ['error', { groups: [...] }]                // Enforce import order
  }
}
```

---

## Testing Infrastructure

### Test Organization

```
lesca/
├── packages/*/src/__tests__/     # Unit tests (co-located)
├── shared/*/src/__tests__/       # Unit tests for shared
└── tests/
    ├── integration/              # E2E tests (slow)
    ├── benchmarks/               # Performance tracking
    ├── factories/                # Dynamic test data
    └── fixtures/                 # Static test data
```

### Test Types & Commands

| Type            | Purpose                         | Speed       | Command                    | When to Run     |
| --------------- | ------------------------------- | ----------- | -------------------------- | --------------- |
| **Unit**        | Test isolated functions/classes | Fast (<30s) | `npm run test:unit`        | Every commit/PR |
| **Integration** | End-to-end workflows            | Slow (30s+) | `npm run test:integration` | Release only    |
| **Benchmarks**  | Performance tracking            | Varies      | `npm run benchmark`        | On-demand       |

```bash
# Fast unit tests (default)
npm test
npm run test:unit

# Integration tests (slower)
npm run test:integration

# All tests
npm run test:all

# With coverage
npm run test:coverage
npm run check-coverage  # Validates thresholds

# Watch mode
npm run test:ui

# Specific file
npm test -- path/to/test.ts
```

### Coverage Requirements

| Package                | Statements | Status                            |
| ---------------------- | ---------- | --------------------------------- |
| **api-client**         | 90%+       | ✅ 98.45% (28 tests)              |
| **auth**               | 90%+       | ✅ 95.75% (41 tests)              |
| **browser-automation** | 85%+       | ✅ 96.48% (65 tests)              |
| **scrapers**           | 85%+       | ✅ 90.87% (105 tests)             |
| **converters**         | 80%+       | ✅ 85.97% (154 tests)             |
| **core**               | 80%+       | ✅ 81.72% (29 tests)              |
| **storage**            | 85%+       | ✅ 91.02% (35 tests)              |
| **shared/config**      | 80%+       | ✅ 93.09% (28 tests)              |
| **shared/utils**       | 80%+       | ✅ 80.22% (23 tests)              |
| **shared/error**       | 95%+       | ✅ 100% (34 tests)                |
| **cli**                | -          | 🚧 15.62% (61 tests, in progress) |

**Total**: 631 passing tests • 68.43% coverage

### Test Patterns

#### Using Factories (Dynamic Data)

```typescript
import { createProblem, createProblemList } from '../../../tests/factories/problem-factory'

it('should filter by difficulty', () => {
  const easy = createProblem({ difficulty: 'Easy' })
  const hard = createProblem({ difficulty: 'Hard' })

  const result = filterByDifficulty([easy, hard], 'Easy')
  expect(result).toHaveLength(1)
})

// Generate multiple problems
const problems = createProblemList(100, { difficulty: 'Medium' })
```

#### Using Fixtures (Static Data)

```typescript
import { twoSumProblem, hardProblems } from '../../../tests/fixtures/problems'

it('should recognize Two Sum', () => {
  expect(twoSumProblem.titleSlug).toBe('two-sum')
})
```

#### Test Structure (Arrange-Act-Assert)

```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('FeatureName', () => {
  let instance: FeatureClass

  beforeEach(() => {
    instance = new FeatureClass() // Fresh instance per test
  })

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = 'test'

      // Act
      const result = instance.methodName(input)

      // Assert
      expect(result).toBe('expected')
    })
  })
})
```

---

## Build & Deployment

### Build System

**TypeScript Compiler**: Multi-step build with path aliasing

```bash
# Clean build
npm run clean      # Remove all dist/ directories
npm run build      # tsc -b + tsc-alias

# Development mode
npm run dev        # tsx watch (hot reload)
```

**Build Configuration**:

```json
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "composite": true
  }
}
```

**Path Aliases** (via `tsc-alias`):

```typescript
// After compilation, aliases are resolved:
import { Config } from '@/shared/types' // → ../../shared/types/dist/index.js
```

### CI/CD Pipeline

**GitHub Actions** (`.github/workflows/ci.yml`):

```yaml
jobs:
  lint: # ESLint validation
  typecheck: # TypeScript compilation check
  test-unit: # Fast unit tests
  build: # Production build
```

**Trigger**: Push to `main`/`develop` or PRs to `main`

**Node Version**: 20.x
**Cache**: npm dependencies

### Scripts Reference

```bash
# Development
npm run dev                 # Watch mode with tsx
npm run build               # Production build

# Quality Checks
npm run lint                # ESLint
npm run lint:fix            # Auto-fix issues
npm run typecheck           # TypeScript validation
npm run format              # Prettier
npm run format:check        # Check formatting

# Testing
npm test                    # Unit tests (fast)
npm run test:unit           # Same as above
npm run test:integration    # Slow E2E tests
npm run test:all            # All tests
npm run test:coverage       # Coverage report
npm run check-coverage      # Validate thresholds
npm run benchmark           # Performance benchmarks

# Utilities
npm run clean               # Remove build artifacts
```

---

## Development Workflow

### Before Starting Work

```bash
# 1. Ensure clean state
npm run build
npm test

# 2. Check linting
npm run lint
```

### During Development

```bash
# Run CLI in dev mode
npm run dev -- scrape two-sum
npm run dev -- scrape-list --difficulty Easy

# Watch mode for specific tests
npm test -- path/to/test.ts --watch
```

### Before Committing

**Pre-commit Checklist** (enforced by husky + lint-staged):

```bash
# 1. TypeScript compilation
npm run build                   # Must pass with 0 errors

# 2. Linting
npm run lint                    # Must have 0 errors

# 3. Unit tests
npm test                        # All tests must pass (<30s)

# 4. Type checking
npm run typecheck               # Must pass

# 5. Coverage (optional but recommended)
npm run check-coverage          # Verify thresholds
```

**Husky automatically runs** (`.husky/pre-commit`):

- ESLint on staged `.ts` files
- Prettier on staged files

### Commit Message Format

```
type(scope): brief description

Longer explanation if needed.

Fixes #123
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:

```
feat(scrapers): add support for discussion scraping
fix(cli): handle undefined options in batch mode
docs(typescript): add guide for strict mode compliance
```

---

## Common Patterns & Conventions

### Error Handling

```typescript
import { LescaError, AuthError, GraphQLError } from '@/shared/types'

// Throw custom errors
throw new LescaError('Config failed', 'CONFIG_ERROR', 500)
throw new AuthError('Invalid cookies')
throw new GraphQLError('Query failed', 400)

// Catch and handle
try {
  const result = await operation()
} catch (error) {
  if (error instanceof LescaError) {
    logger.error(`Lesca error: ${error.message}`)
  } else {
    logger.error(`Unexpected: ${error}`)
  }
  throw error
}
```

### Logging (Not Console!)

```typescript
import { logger } from '@/shared/utils'

// ❌ NEVER use console
console.log('message') // ESLint error (no-console)

// ✅ ALWAYS use logger - Standard methods
logger.log('Starting process...')
logger.warn('Deprecated feature')
logger.error(error)
logger.debug('Detailed info')

// ✅ Rich formatting methods (console-inspired API)
logger.box('Important Message', {
  title: 'Success',
  color: 'green',
  padding: 1,
})

logger.steps([
  { text: 'Authenticate', status: 'done' },
  { text: 'Fetch data', status: 'current' },
  { text: 'Process', status: 'pending' },
])

logger.banner('LESCA CLI', { color: 'cyan' })
logger.success('Operation completed!')
```

**Logger Methods**:

| Method      | Purpose         | Example Use Case        |
| ----------- | --------------- | ----------------------- |
| `log()`     | Standard output | General messages        |
| `warn()`    | Warnings        | Deprecation notices     |
| `error()`   | Errors          | Exception handling      |
| `debug()`   | Debug info      | Development only        |
| `box()`     | Boxed message   | Important notifications |
| `steps()`   | Progress steps  | Multi-step workflows    |
| `banner()`  | ASCII banner    | CLI startup             |
| `success()` | Success message | Operation completion    |

**Exception**: Console allowed ONLY in:

- Scripts in `/scripts` directory
- Build scripts
- Inside logger implementation itself

### Configuration Access

```typescript
import { ConfigManager } from '@/shared/config'

const config = ConfigManager.getInstance().getConfig()
const cookiePath = config.auth.cookiePath

// With safety check
if (config.cache?.enabled && config.cache.directory) {
  // Use cache
}
```

**Config Priority**:

1. CLI flags (highest)
2. Environment variables (`LESCA_*`)
3. Config file (YAML/JSON)
4. Default values (lowest)

### Authentication Pattern

```typescript
import { CookieFileAuth } from '@lesca/auth'

const auth = new CookieFileAuth(cookiePath)
await auth.load(cookiePath)

const isValid = await auth.isValid()
if (!isValid) {
  await auth.authenticate()
}

const credentials = await auth.authenticate()
// Use credentials.cookies, credentials.csrfToken
```

### GraphQL Client Pattern

```typescript
import { GraphQLClient } from '@lesca/api-client'

const client = new GraphQLClient(auth, config.api)

const problem = await client.getProblem('two-sum')
const list = await client.getProblemList({ difficulty: 'Easy' })
const discussions = await client.getDiscussions('two-sum')
```

**Rate Limiting**: Built-in, configured via `config.api.rateLimiter`

### Browser Automation Pattern

```typescript
import { PlaywrightDriver } from '@lesca/browser-automation'

const driver = new PlaywrightDriver(auth)

try {
  await driver.launch({ headless: true })
  await driver.navigate(url)
  const content = await driver.extractContent('.content')
  return content
} finally {
  await driver.close() // Always cleanup
}
```

---

## Quick Reference

### File Locations

| Item               | Path                                     |
| ------------------ | ---------------------------------------- |
| **All types**      | `shared/types/src/index.ts`              |
| **Config manager** | `shared/config/src/manager.ts`           |
| **Error classes**  | `shared/error/src/index.ts`              |
| **Logger**         | `shared/utils/src/logger.ts`             |
| **Cache**          | `shared/utils/src/cache/tiered-cache.ts` |
| **Main scraper**   | `packages/core/src/scraper.ts`           |
| **CLI entry**      | `packages/cli/src/index.ts`              |
| **Test factories** | `tests/factories/problem-factory.ts`     |
| **Test fixtures**  | `tests/fixtures/problems.ts`             |

### Common Commands

```bash
# Development
npm run dev -- scrape two-sum
npm run dev -- scrape-list --difficulty Easy --limit 10

# Testing
npm test                              # Fast unit tests
npm run test:integration              # Slow E2E tests
npm test -- packages/core             # Test specific package

# Build & Quality
npm run build                         # Full build
npm run typecheck                     # Check types only
npm run lint                          # Lint check
npm run lint:fix                      # Auto-fix linting

# Tools
npm run dev -- config show            # Show config
npm run dev -- config get auth.method # Get specific value
npm run dev -- auth                   # Authentication flow
```

### Key Interfaces to Remember

```typescript
// Strategy pattern
interface ScraperStrategy {
  canHandle(request: ScrapeRequest): boolean
  execute(request: ScrapeRequest): Promise<RawData>
}

// Storage adapter
interface StorageAdapter {
  save(key: string, content: string, metadata?: Record<string, unknown>): Promise<void>
  load(key: string): Promise<string | null>
  exists(key: string): Promise<boolean>
}

// Converter
interface Converter {
  from: ContentFormat
  to: ContentFormat
  canConvert(data: unknown): boolean
  convert(input: unknown, options?: ConverterOptions): Promise<unknown>
}
```

#### 4. **Adapter Pattern** - HTML-to-Markdown Conversion

**New in 2025-11-27**: The `HtmlToMarkdownConverter` now uses the Adapter pattern to abstract the underlying conversion library (Turndown).

```typescript
// packages/converters/src/html-to-markdown.ts

// Adapter interface - defines the conversion contract
export interface HtmlToMarkdownAdapter {
  convert(html: string): string
}

// Turndown implementation - encapsulates Turndown-specific logic
class TurndownAdapter implements HtmlToMarkdownAdapter {
  private turndown: TurndownService

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      // ... configuration
    })
    this.addCustomRules() // LeetCode-specific rules
  }

  convert(html: string): string {
    return this.turndown.turndown(html)
  }

  private addCustomRules() {
    // All Turndown-specific logic and eslint-disable comments
    // are isolated here
  }
}

// Public converter - uses adapter internally
export class HtmlToMarkdownConverter implements Converter {
  private adapter: HtmlToMarkdownAdapter

  constructor() {
    this.adapter = new TurndownAdapter()
  }

  async convert(input: unknown): Promise<string> {
    // Pre-processing
    const cleaned = this.preProcess(input as string)

    // Conversion via adapter
    let markdown = this.adapter.convert(cleaned)

    // Post-processing
    markdown = this.postProcess(markdown)

    return markdown
  }
}
```

**Benefits**:

- **Type Safety**: Isolated `any` types from Turndown to adapter layer
- **Testability**: Can mock adapter for testing
- **Flexibility**: Easy to swap Turndown for another library
- **Maintainability**: All library-specific code in one place

### Code Quality Standards

#### ESLint Disable Comments - Best Practices

**Zero Tolerance Policy**: Avoid `eslint-disable` comments unless absolutely necessary.

**Justified Cases** (60 total in codebase):

1. **Logger Implementation** (~25 instances)
   - `no-console` - Direct console calls in logger methods
   - `no-unsafe-*` - `require('chalk')` for lazy loading
   - **Location**: `shared/utils/src/logger.ts`
   - **Justification**: Logger is the designated place for console usage

2. **Browser Automation** (~15 instances)
   - `no-unsafe-*` - Playwright APIs return `any`/`unknown`
   - **Location**: `packages/browser-automation`, `packages/scrapers`
   - **Justification**: External API constraints, cast results safely

3. **HTML-to-Markdown Adapter** (1 block)
   - `no-unsafe-*` - Turndown's node types use `any`
   - **Location**: `packages/converters/src/html-to-markdown.ts`
   - **Justification**: TurndownService API limitation, isolated to adapter

4. **Tests & Scripts** (~15 instances)
   - `no-console` - Direct console in test/build scripts
   - `no-unsafe-*` - Mock objects, quick prototypes
   - **Location**: `tests/`, `scripts/`
   - **Justification**: Non-production code

**Process for Adding New Disables**:

1. ❌ **Never** disable without justification comment
2. ✅ **Always** use block disables with specific rules
3. ✅ **Always** add explanatory comment above
4. ✅ **Always** keep scope as narrow as possible

```typescript
// ❌ NEVER - Too broad, no explanation
/* eslint-disable */
function riskyCode() { ... }
/* eslint-enable */

// ✅ ALWAYS - Specific rules, clear justification
// Playwright's page.evaluate() returns 'any' because it executes in browser context
// We safely cast the result based on our known selector
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
const data = await page.evaluate(() => document.querySelector('.data')?.textContent)
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
```

---

## Troubleshooting

### Common TypeScript Errors

#### `Object is possibly 'undefined'`

```typescript
// ❌ Problem
const first = array[0]
console.log(first.name) // Error

// ✅ Solution
const first = array[0]
if (!first) throw new Error('Empty array')
console.log(first.name)
```

#### `Type 'undefined' is not assignable to type 'string'`

```typescript
// ❌ Problem (exactOptionalPropertyTypes: true)
interface Opts {
  path?: string
}
const opts: Opts = { path: undefined }

// ✅ Solution
const opts: Opts = {}
if (path) opts.path = path
```

#### `async function has no await expression`

```typescript
// ❌ Problem
async function getName() {
  return 'John'
}

// ✅ Solution: Remove async
function getName() {
  return 'John'
}
```

### Common Build Issues

#### Import Resolution Errors

```typescript
// ❌ Wrong
import { Config } from '@/shared/types.ts' // No .ts extension
import './helper.ts' // No extension

// ✅ Correct
import { Config } from '@/shared/types'
import './helper'
```

#### Module Not Found

```bash
# Clear everything and rebuild
rm -rf node_modules dist packages/*/dist shared/*/dist
npm install
npm run build
```

### Testing Issues

#### Tests Timing Out

```typescript
// Increase timeout for slow test
it(
  'should handle large dataset',
  async () => {
    // ...
  },
  { timeout: 10000 }
) // 10 seconds
```

#### Mocks Not Working

```typescript
beforeEach(() => {
  vi.clearAllMocks() // Reset mock state
})
```

### GraphQL API Issues

**401 Unauthorized**: Cookies expired

```bash
npm run dev -- auth  # Re-authenticate
```

**429 Rate Limit**: Too many requests

```yaml
# Adjust config
api:
  rateLimiter:
    delay:
      min: 3000 # Increase delay
```

---

## Additional Resources

### Documentation Index

- **User Documentation**:
  - [User Guide](./USER_GUIDE.md) - Complete usage guide
  - [Installation](./INSTALLATION.md) - Setup instructions
  - [CLI Reference](./CLI_REFERENCE.md) - All commands
  - [Configuration](./CONFIGURATION.md) - Config options
  - [Examples](./EXAMPLES.md) - Usage patterns
  - [Troubleshooting](./TROUBLESHOOTING.md) - Common issues

- **Developer Documentation**:
  - [Architecture Review](../ARCHITECTURE_REVIEW.md) - Design decisions
  - [Coding Standards](./CODING_STANDARDS.md) - Code style rules
  - [Testing Guide](./TESTING.md) - Testing best practices
  - [Agent Guidelines](./AGENT_GUIDELINES.md) - AI assistant guide
  - [TypeScript Guide](./TYPESCRIPT_GUIDE.md) - TS patterns
  - [Contributing](../CONTRIBUTING.md) - Contribution guide

### External Links

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Commander.js Guide](https://github.com/tj/commander.js)

---

## Essential Knowledge Checklist

When working on Lesca, an LLM agent should know:

- ✅ **All types come from** `shared/types/src/index.ts` - **NEVER** redefine types
- ✅ **Never use** `any`, non-null assertions (`!`), or `console.*`
- ✅ **Never add file extensions** to imports (`.ts`, `.js`)
- ✅ **Always use** `@/shared/...` aliases for shared packages
- ✅ **Always use** factories from `tests/factories/` for test data
- ✅ **Always check** for `undefined` when accessing arrays (`noUncheckedIndexedAccess`)
- ✅ **Always validate** with `npm run lint`, `npm run typecheck`, `npm test` before committing
- ✅ **Config access** via `ConfigManager.getInstance().getConfig()`
- ✅ **Error handling** via `LescaError` subclasses
- ✅ **Logging** via `logger` from `@/shared/utils`
- ✅ **Test structure**: Arrange-Act-Assert pattern
- ✅ **Import order**: Node → External → Shared → Local
- ✅ **Strategies implement** `ScraperStrategy` interface
- ✅ **Unit tests** in `__tests__/` co-located with source
- ✅ **Coverage thresholds**: 80-95% depending on package

---

**For questions or clarifications**: See [CONTRIBUTING.md](../CONTRIBUTING.md) or [AGENT_GUIDELINES.md](./AGENT_GUIDELINES.md)

**Built with ❤️ for the LeetCode community**
