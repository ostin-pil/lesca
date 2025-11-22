# Guidelines for AI Agents Working on Lesca

This document provides specific guidance for AI assistants (like Claude Code) contributing to the Lesca project. These guidelines complement the [Coding Standards](./CODING_STANDARDS.md) and help maintain consistent code quality.

## Quick Reference

**Before writing any code, review:**
1. [Coding Standards](./CODING_STANDARDS.md) - Mandatory coding rules
2. [Architecture Review](../ARCHITECTURE_REVIEW.md) - System design
3. [TypeScript Guide](./TYPESCRIPT_GUIDE.md) - Type safety patterns

## Critical Rules

### ❌ NEVER Do

1. **Use `any` type** - Always use proper types or `unknown`
2. **Use `console.log/warn/error`** - Use `logger` from utils instead
3. **Use non-null assertions (`!`)** - Check for null/undefined explicitly
4. **Make functions `async` without `await`** - Remove async if not needed
5. **Assign `undefined` to optional properties** - Conditionally add properties instead
6. **Create new files without reading** - Always use Read tool before Write
7. **Ignore ESLint/TypeScript errors** - Fix all errors before completing

### ✅ ALWAYS Do

1. **Run linter after changes** - `npx eslint <file>`
2. **Check TypeScript compilation** - `npx tsc --noEmit`
3. **Read files before editing** - Use Read tool first
4. **Use proper types from shared/types** - Import existing types
5. **Follow existing patterns** - Match the style of surrounding code
6. **Add JSDoc for public APIs** - Document functions/classes
7. **Write tests for new features** - Place in `__tests__/` directory

## Common Patterns in Lesca

### Configuration Access

```typescript
// ✅ Correct way
import { ConfigManager } from '../../../shared/config'

const config = ConfigManager.getInstance().getConfig()
const value = config.auth.cookiePath

// ❌ Wrong way
const value = config.auth.cookiePath!  // No non-null assertion
```

### Optional Property Handling

```typescript
// ✅ Correct way
const opts: LoaderOptions = {}
if (configPath) opts.configPath = configPath
if (searchPaths) opts.searchPaths = searchPaths

// ❌ Wrong way
const opts: LoaderOptions = {
  configPath: configPath || undefined,  // Don't assign undefined
  searchPaths
}
```

### Error Handling

```typescript
// ✅ Correct way
import { LescaError } from '../../../shared/types'

try {
  const result = await operation()
  return result
} catch (error) {
  if (error instanceof LescaError) {
    logger.error(`Operation failed: ${error.message}`)
  } else {
    logger.error(`Unexpected error: ${error}`)
  }
  throw error
}

// ❌ Wrong way
try {
  const result = await operation()
  return result
} catch (error) {
  console.error(error)  // Don't use console
  throw error
}
```

### Async Functions

```typescript
// ✅ Correct way - synchronous
function saveConfig(config: Config): void {
  writeFileSync(path, JSON.stringify(config))
}

// ✅ Correct way - truly async
async function fetchData(url: string): Promise<Data> {
  const response = await fetch(url)
  return response.json()
}

// ❌ Wrong way - unnecessary async
async function getName(): Promise<string> {
  return 'John'  // No await, shouldn't be async
}
```

## Workflow for Code Changes

### 1. Understanding Phase

```bash
# Read relevant files
Read tool: packages/*/src/relevant-file.ts
Read tool: shared/types/src/index.ts

# Check existing tests
Read tool: packages/*/src/__tests__/relevant.test.ts

# Review architecture
Read tool: ARCHITECTURE_REVIEW.md
```

### 2. Implementation Phase

**Import Rules:**
- ❌ Never include file extensions (.js, .ts, .tsx)
- ✅ Use `@/` alias for shared packages
- ✅ Use relative imports (without extensions) for same-package imports

```typescript
// Import order
import { resolve } from 'path'               // Node built-ins
import chalk from 'chalk'                     // External packages
import type { Config } from '@/shared/types' // Shared types (@ alias)
import { logger } from '@/shared/utils'       // Shared utils (@ alias)
import { ConfigManager } from './config'      // Local imports (no extension)
```

### 3. Validation Phase

```bash
# 1. Check TypeScript
npx tsc --noEmit

# 2. Run linter
npx eslint path/to/file.ts

# 3. Run tests
npm test path/to/test.ts

# 4. Check coverage
npm test -- --coverage
```

## Type Safety Guidelines

### Commander.js Options

```typescript
// ✅ Define interface for options
interface InitOptions {
  configPath: string
  cookiePath?: string
  force?: boolean
}

program
  .command('init')
  .option('--config-path <path>', 'Config path', './config.yaml')
  .option('--cookie-path <path>', 'Cookie path')
  .option('--force', 'Force overwrite')
  .action((options: InitOptions) => {
    // Type-safe access
    const path = options.configPath
    if (options.cookiePath) {
      // ...
    }
  })
```

### Unknown Type Handling

```typescript
// ✅ Proper type narrowing
function processValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return value.toString()
  }
  if (typeof value === 'object' && value !== null) {
    if ('toString' in value) {
      return String(value)
    }
  }
  return 'unknown'
}

// ❌ Wrong - using any
function processValue(value: any): string {
  return value.toString()
}
```

## Testing Guidelines

### Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('FeatureName', () => {
  let instance: FeatureClass

  beforeEach(() => {
    instance = new FeatureClass()
    // Reset state
  })

  describe('methodName', () => {
    it('should handle normal case', () => {
      const result = instance.methodName('input')
      expect(result).toBe('expected')
    })

    it('should handle error case', () => {
      expect(() => instance.methodName('')).toThrow()
    })

    it('should handle edge case', () => {
      const result = instance.methodName(null)
      expect(result).toBeUndefined()
    })
  })
})
```

### Mocking

```typescript
// ✅ Proper mocking
const mockClient = {
  query: vi.fn().mockResolvedValue({ data: { success: true } })
}

const strategy = new Strategy(mockClient as unknown as GraphQLClient)

// Verify mock calls
expect(mockClient.query).toHaveBeenCalledWith(expectedQuery)
```

## Common Pitfalls

### 1. Commander.js Type Safety

```typescript
// ❌ Unsafe - opts is 'any'
.hook('preAction', async (cmd) => {
  const opts = cmd.optsWithGlobals()
  await init(opts.config)  // Unsafe access
})

// ✅ Safe - with type assertion
.hook('preAction', (cmd) => {
  const opts = cmd.optsWithGlobals() as { config?: string }
  if (opts.config) {
    init(opts.config)
  }
})
```

### 2. Configuration Defaults

```typescript
// ❌ Wrong - using non-null assertion
const cacheDir = config.cache.directory!
cache = new TieredCache(cacheDir, options)

// ✅ Correct - checking before use
if (config.cache.enabled && config.cache.directory) {
  cache = new TieredCache(config.cache.directory, options)
}
```

### 3. Async Without Await

```typescript
// ❌ Wrong - async without await
public static async initialize(opts): Promise<Manager> {
  const config = loadConfig(opts)  // Synchronous
  return new Manager(config)
}

// ✅ Correct - remove async
public static initialize(opts): Manager {
  const config = loadConfig(opts)
  return new Manager(config)
}
```

## Project-Specific Patterns

### Facade Pattern (Core)

```typescript
// The scraper delegates to strategies
export class LeetCodeScraper {
  constructor(
    private strategies: ScraperStrategy[],
    private storage: StorageAdapter,
    private options: ScraperOptions
  ) {}

  async scrape(request: ScrapeRequest): Promise<ScrapeResult> {
    const strategy = this.selectStrategy(request)
    const rawData = await strategy.execute(request)
    const processed = await this.convert(rawData)
    await this.storage.save(processed)
    return { success: true, data: processed }
  }
}
```

### Strategy Pattern (Scrapers)

```typescript
// Each strategy implements the interface
export class ProblemScraperStrategy implements ScraperStrategy {
  readonly priority = 10
  readonly type = 'problem'

  canHandle(request: ScrapeRequest): boolean {
    return request.type === 'problem'
  }

  async execute(request: ProblemScrapeRequest): Promise<RawData> {
    // Implementation
  }
}
```

### Singleton Pattern (ConfigManager)

```typescript
export class ConfigManager {
  private static instance: ConfigManager | null = null

  private constructor(config: Config) {
    this.config = config
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(createDefaultConfig())
    }
    return ConfigManager.instance
  }
}
```

## Integration Checklist

When adding a new feature:

- [ ] Define types in `shared/types/src/index.ts`
- [ ] Follow existing architectural patterns (Facade, Strategy, etc.)
- [ ] Add comprehensive JSDoc comments
- [ ] Write unit tests with >80% coverage
- [ ] Add integration tests if needed
- [ ] Update relevant documentation
- [ ] Run `npx tsc --noEmit` - must pass
- [ ] Run `npx eslint` - must have 0 errors
- [ ] Run `npm test` - all tests must pass
- [ ] Update CHANGELOG.md if significant change

## Resources

### Code Examples

```bash
# Find similar implementations
Grep: "class.*Strategy" glob:"packages/scrapers/src/*.ts"
Grep: "interface.*Options" glob:"shared/types/src/*.ts"
```

### Documentation

- Main: [CODING_STANDARDS.md](./CODING_STANDARDS.md)
- Architecture: [ARCHITECTURE_REVIEW.md](../ARCHITECTURE_REVIEW.md)
- TypeScript: [TYPESCRIPT_GUIDE.md](./TYPESCRIPT_GUIDE.md)
- Contributing: [CONTRIBUTING.md](../CONTRIBUTING.md)

### Getting Help

1. Search existing code for patterns
2. Check type definitions in `shared/types`
3. Review test examples in `__tests__/` directories
4. Consult architecture documentation
5. Ask specific questions with context

## Remember

- **Quality over speed** - Take time to get it right
- **Match existing style** - Consistency is key
- **Type safety first** - No shortcuts with `any`
- **Test thoroughly** - Don't rely on "it should work"
- **Document clearly** - Future maintainers will thank you

---

*Last updated: 2025-01-14*
*For questions or clarifications, see [CONTRIBUTING.md](../CONTRIBUTING.md)*
