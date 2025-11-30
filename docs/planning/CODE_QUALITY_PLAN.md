# Zero Tolerance Code Quality Execution Plan

**Status**: 497 total issues → Target: 0 issues
**Updated**: 2025-11-13
**Approach**: Systematic file-by-file cleanup

---

## Quick Reference Commands

```bash
# Check total issues
npm run lint 2>&1 | grep "✖" | tail -1

# Auto-fix everything possible
npm run lint:fix && npm run format

# Check specific file
npm run lint -- path/to/file.ts

# Fix specific file
npm run lint:fix -- path/to/file.ts

# Verify all checks pass
npm run typecheck && npm run lint && npm test
```

---

## Phase 1: Infrastructure & Auto-Fix (30 minutes)

### Step 1.1: Fix Import Resolver (10 min)

**Problem**: ~150 "typescript with invalid interface loaded as resolver" errors

**Solution**: Update `.eslintrc.cjs`

```javascript
// Add to settings section:
settings: {
  'import/resolver': {
    node: {
      extensions: ['.ts', '.tsx', '.js', '.json']
    },
    typescript: {
      alwaysTryTypes: true,
      project: './tsconfig.json',
    },
  },
}
```

**Verify**:

```bash
npm run lint -- packages/api-client/src/graphql-client.ts
# Should no longer show "Resolve error"
```

### Step 1.2: Auto-Fix (5 min)

```bash
npm run lint:fix
npm run format
```

**Expected reduction**: 32 issues auto-fixed

### Step 1.3: Install Missing Dependencies (5 min)

```bash
npm install --save-dev eslint-import-resolver-typescript
npm install --save-dev @types/cli-progress
npm install --save-dev @types/turndown
```

### Step 1.4: Check Progress (5 min)

```bash
npm run lint 2>&1 | grep "✖" | tail -1
# Target: ~315 remaining issues
```

---

## Phase 2: File-by-File Systematic Cleanup

### Priority Order (by issue count):

1. **packages/cli/src/index.ts** - 47 errors
2. **packages/browser-automation/src/playwright-driver.ts** - 18 errors
3. **packages/scrapers/src/discussion-strategy.ts** - 17 errors
4. **packages/auth/src/cookie-auth.ts** - 8 errors
5. **packages/converters/src/obsidian-converter.ts** - 15 errors
6. **packages/api-client/src/graphql-client.ts** - 5 errors
7. All remaining files

---

## File 1: packages/cli/src/index.ts (47 errors) - 2 hours

### Issues:

- 15× Import order violations
- 20× Unsafe `any` type usage
- 3× Console statements
- 9× Other type safety issues

### Fix Pattern:

#### 1. Fix Imports (15 errors)

```typescript
// Group 1: Node built-ins
import { resolve } from 'path'
import { homedir } from 'os'

// Group 2: External packages
import chalk from 'chalk'
import cliProgress from 'cli-progress'
import { Command } from 'commander'
import ora from 'ora'

// Group 3: Type imports from external
import type { ScrapeRequest } from '../../../shared/types/src/index.js'

// Group 4: Internal packages (alphabetical)
import { GraphQLClient } from '../../api-client/src/index.js'
import { CookieAuth } from '../../auth/src/index.js'
import { PlaywrightDriver } from '../../browser-automation/src/index.js'
import { LeetCodeScraper, BatchScraper } from '../../core/src/index.js'

// Group 5: Type imports from internal
import type { EditorialScraperOptions } from '../../scrapers/src/editorial-strategy.js'

// Group 6: Utilities
import { TieredCache } from '../../../shared/utils/src/index.js'
```

#### 2. Add Type Definitions (20 errors)

```typescript
// Define option interfaces for each command
interface GlobalOptions {
  auth?: boolean
  cookies?: string
  cache?: boolean
  cacheDir?: string
}

interface ScrapeOptions extends GlobalOptions {
  output?: string
  format?: 'markdown' | 'obsidian'
}

interface ScrapeListOptions extends GlobalOptions {
  output?: string
  format?: 'markdown' | 'obsidian'
  difficulty?: string
  tags?: string
  limit?: string
  concurrency?: string
  resume?: boolean
}

interface ScrapeEditorialOptions extends GlobalOptions {
  output?: string
  format?: 'markdown' | 'obsidian'
}

interface ScrapeDiscussionsOptions extends GlobalOptions {
  output?: string
  format?: 'markdown' | 'obsidian'
  category?: 'solution' | 'general' | 'interview'
  sort?: 'hot' | 'most-votes' | 'recent'
  limit?: string
  comments?: boolean
}
```

#### 3. Type the Action Handlers

```typescript
// Before:
.action(async (problem, options) => {
  const authEnabled = options.auth
  // ...
})

// After:
.action(async (problem: string, options: ScrapeOptions) => {
  const authEnabled = options.auth ?? true
  const cookies = options.cookies
  const cacheEnabled = options.cache ?? true
  const cacheDir = options.cacheDir ?? resolve(homedir(), '.lesca', 'cache')
  const outputDir = options.output ?? './output'
  const format = options.format ?? 'markdown'
  // ...
})
```

#### 4. Create Logger Utility

**File**: `shared/utils/src/logger.ts`

```typescript
export class Logger {
  info(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log('[INFO]', ...args)
  }

  error(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error('[ERROR]', ...args)
  }

  warn(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.warn('[WARN]', ...args)
  }
}

export const logger = new Logger()
```

Then export from `shared/utils/src/index.ts`:

```typescript
export { Logger, logger } from './logger.js'
```

#### 5. Replace Console Statements

```typescript
// Before:
console.log('✓ Problem saved to', outputPath)

// After:
import { logger } from '../../../shared/utils/src/index.js'
logger.info('✓ Problem saved to', outputPath)
```

**Checklist**:

- [ ] Fix all import order violations
- [ ] Add type definitions for all option interfaces
- [ ] Type all action handlers with proper interfaces
- [ ] Create logger utility
- [ ] Replace all console statements with logger
- [ ] Verify: `npm run lint -- packages/cli/src/index.ts` shows 0 errors

---

## File 2: packages/browser-automation/src/playwright-driver.ts (18 errors) - 1.5 hours

### Issues:

- 16× Non-null assertions (`this.page!`)
- 2× Floating promises

### Fix Pattern:

#### 1. Add Type Guard Method

```typescript
private ensureLaunched(): asserts this is { page: Page; browser: Browser } {
  if (!this.page || !this.browser) {
    throw new Error('Browser not launched. Call launch() first.')
  }
}
```

#### 2. Replace All Non-null Assertions

```typescript
// Before:
async navigate(url: string): Promise<void> {
  await this.page!.goto(url, { timeout: 30000 })
}

// After:
async navigate(url: string): Promise<void> {
  this.ensureLaunched()
  await this.page.goto(url, { timeout: 30000 })
}
```

#### 3. Fix Floating Promises

```typescript
// Before:
this.page.route('**/*', (route) => {
  const resourceType = route.request().resourceType()
  if (['image', 'font'].includes(resourceType)) {
    route.abort()
  } else {
    route.continue()
  }
})

// After:
await this.page.route('**/*', async (route) => {
  const resourceType = route.request().resourceType()
  if (['image', 'font'].includes(resourceType)) {
    await route.abort()
  } else {
    await route.continue()
  }
})
```

**Checklist**:

- [ ] Add `ensureLaunched()` type guard
- [ ] Replace all `this.page!` with proper check
- [ ] Replace all `this.browser!` with proper check
- [ ] Fix floating promises in `launch()`
- [ ] Verify: `npm run lint -- packages/browser-automation/src/playwright-driver.ts` shows 0 errors

---

## File 3: packages/scrapers/src/discussion-strategy.ts (17 errors) - 1 hour

### Issues:

- Import order violations
- Non-null assertions
- Console statements

### Fix Pattern:

```typescript
// 1. Fix imports (same pattern as File 1)

// 2. Replace console with logger
import { logger } from '../../../shared/utils/src/index.js'

// Before:
console.log(`✓ Extracted ${discussions.length} discussions`)

// After:
logger.info(`✓ Extracted ${discussions.length} discussions`)

// 3. Fix non-null assertions
this.ensureBrowserReady() // Add type guard
await this.browserDriver.extractContent(...) // No more !
```

**Checklist**:

- [ ] Fix import order
- [ ] Import and use logger
- [ ] Replace all console statements
- [ ] Add type guards for browser driver
- [ ] Verify: `npm run lint -- packages/scrapers/src/discussion-strategy.ts` shows 0 errors

---

## File 4: packages/auth/src/cookie-auth.ts (8 errors) - 45 minutes

### Issues:

- 1× Async without await
- 1× Unsafe any assignment
- 1× Unbound method
- 1× Template literal type issue
- 4× Import order

### Fixes:

```typescript
// 1. Remove async if no await
isValid(): boolean { // Remove 'async'
  return this.cookies.length > 0
}

// 2. Type cookie parsing
const cookieObj = JSON.parse(cookieStr) as Record<string, unknown>

// 3. Bind method or use arrow function
.on('request', (req) => this.handleRequest(req))

// 4. Fix template literal
`Error: ${String(error)}`
```

**Checklist**:

- [ ] Fix import order
- [ ] Remove unnecessary async
- [ ] Add proper types for JSON parsing
- [ ] Fix unbound method
- [ ] Fix template literal types
- [ ] Verify: `npm run lint -- packages/auth/src/cookie-auth.ts` shows 0 errors

---

## File 5: packages/converters/src/obsidian-converter.ts (15 errors) - 1 hour

### Issues:

- Console statements
- Import order

### Fix Pattern:

```typescript
// Import logger
import { logger } from '../../../shared/utils/src/index.js'

// Replace all console.log
logger.info('Converting to Obsidian format...')
```

**Checklist**:

- [ ] Fix import order
- [ ] Import logger
- [ ] Replace all console statements
- [ ] Verify: `npm run lint -- packages/converters/src/obsidian-converter.ts` shows 0 errors

---

## File 6: packages/api-client/src/graphql-client.ts (5 errors) - 30 minutes

### Issues:

- 1× Unused type definition
- 1× `let` should be `const`
- 3× Import order

### Fixes:

```typescript
// 1. Remove unused type
// Delete: type GraphQLErrorType = ...

// 2. Change let to const
const allQuestions: QuestionListItem[] = []

// 3. Fix import order (same pattern)
```

**Checklist**:

- [ ] Fix import order
- [ ] Remove unused type
- [ ] Change `let` to `const`
- [ ] Verify: `npm run lint -- packages/api-client/src/graphql-client.ts` shows 0 errors

---

## File 7: vitest.config.ts (4 errors) - 15 minutes

### Issues:

- Import order

### Fix:

```typescript
import path from 'path'
import { defineConfig } from 'vitest/config'

// Empty line between imports and config
export default defineConfig({
  // ...
})
```

**Checklist**:

- [ ] Fix import order
- [ ] Add empty line between import groups
- [ ] Verify: `npm run lint -- vitest.config.ts` shows 0 errors

---

## Remaining Files - Process Systematically

For each remaining file with errors:

1. **Check errors**: `npm run lint -- path/to/file.ts`
2. **Auto-fix**: `npm run lint:fix -- path/to/file.ts`
3. **Manual fixes**:
   - Fix import order
   - Replace console with logger
   - Add type guards for non-null assertions
   - Type all `any` usage
   - Fix floating promises
4. **Verify**: `npm run lint -- path/to/file.ts` shows 0 errors
5. **Move to next file**

---

## Progress Tracking

### Completion Checklist

- [ ] Phase 1: Infrastructure (32 auto-fixable)
- [ ] File 1: cli/index.ts (47 errors)
- [ ] File 2: playwright-driver.ts (18 errors)
- [ ] File 3: discussion-strategy.ts (17 errors)
- [ ] File 4: cookie-auth.ts (8 errors)
- [ ] File 5: obsidian-converter.ts (15 errors)
- [ ] File 6: graphql-client.ts (5 errors)
- [ ] File 7: vitest.config.ts (4 errors)
- [ ] Remaining files (~351 errors)
- [ ] Final verification: `npm run lint` shows 0 errors

### Track Progress

```bash
# Add to your shell profile for quick checks
alias lint-status='npm run lint 2>&1 | grep "✖" | tail -1'

# After each file:
lint-status
git add .
git commit -m "fix: resolve lint errors in <filename>"
```

---

## Final Verification

Before considering the task complete:

```bash
# 1. All linting passes
npm run lint
# Expected: ✨ No problems found!

# 2. TypeScript compiles
npm run typecheck
# Expected: No errors

# 3. Code is formatted
npm run format:check
# Expected: All files formatted

# 4. All tests pass
npm test
# Expected: All tests passing

# 5. Build succeeds
npm run build
# Expected: Build completes successfully
```

---

## Time Estimates

Based on complexity and issue count:

- **Phase 1** (Infrastructure): 30 minutes
- **File 1** (cli/index.ts): 2 hours
- **File 2** (playwright-driver.ts): 1.5 hours
- **File 3** (discussion-strategy.ts): 1 hour
- **File 4** (cookie-auth.ts): 45 minutes
- **File 5** (obsidian-converter.ts): 1 hour
- **File 6** (graphql-client.ts): 30 minutes
- **File 7** (vitest.config.ts): 15 minutes
- **Remaining Files**: 8-10 hours

**Total Estimated Time**: 15-17 hours of focused work

---

## Post-Cleanup: Prevention

### 1. Update package.json Scripts

```json
{
  "scripts": {
    "quality": "npm run typecheck && npm run lint && npm run format:check && npm test",
    "quality:fix": "npm run lint:fix && npm run format && npm run quality"
  }
}
```

### 2. Set Up Pre-commit Hook

Verify `.husky/pre-commit` exists:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
```

### 3. Add Quality Gate to CI/CD

Create `.github/workflows/quality.yml` (if not exists):

```yaml
name: Quality Gate

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format:check
      - run: npm test
```

---

## Success Criteria

✅ **Zero Tolerance Achieved When**:

- `npm run lint` shows: ✨ No problems found!
- `npm run typecheck` shows: No TypeScript errors
- `npm run format:check` shows: All files formatted
- `npm test` shows: All tests passing
- All warnings converted to errors in ESLint config
- No `// eslint-disable` comments (except in logger)
- No `any` types without explicit justification
- No non-null assertions without safety checks

---

## Quick Win Strategy

If you want to see progress quickly, do these first:

1. **Infrastructure fixes** (30 min) → ~150 errors gone
2. **Auto-fix** (5 min) → ~32 errors gone
3. **Create logger** (15 min) → Ready for all console fixes
4. **Fix one small file** (30 min) → Validate approach

This gets you from 497 → ~280 errors in just 80 minutes!
