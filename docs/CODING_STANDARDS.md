# Lesca Coding Standards

This document outlines the coding standards and best practices for the Lesca project. All contributors and AI assistants should follow these guidelines to maintain code quality and consistency.

## Table of Contents

1. [TypeScript Standards](#typescript-standards)
2. [ESLint Rules](#eslint-rules)
3. [Code Organization](#code-organization)
4. [Naming Conventions](#naming-conventions)
5. [Error Handling](#error-handling)
6. [Testing Standards](#testing-standards)
7. [Documentation Standards](#documentation-standards)

---

## TypeScript Standards

### Strict Mode

- **Always use TypeScript strict mode** (`strict: true` in `tsconfig.json`)
- Enable `exactOptionalPropertyTypes` for stricter optional property checking

### Type Safety

#### ❌ Avoid

```typescript
// DON'T use 'any'
function process(data: any) {
  return data.value
}

// DON'T use non-null assertions
const value = config.path!

// DON'T use unnecessary type assertions
const opts = command.opts() as Options
```

#### ✅ Prefer

```typescript
// DO use proper types or 'unknown'
function process(data: unknown): string | undefined {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as Record<string, unknown>).value as string
  }
  return undefined
}

// DO check for null/undefined before use
if (config.path) {
  const value = config.path
}

// DO avoid type assertions when possible
interface CommandOptions {
  config?: string
}
const opts = command.opts() as CommandOptions
```

### Async/Await

#### ❌ Avoid

```typescript
// DON'T mark functions as async if they don't await anything
async function getName(): Promise<string> {
  return 'John'
}

// DON'T use async/await for synchronous file operations
async function saveConfig(config: Config): Promise<void> {
  writeFileSync(path, JSON.stringify(config))
}
```

#### ✅ Prefer

```typescript
// DO remove async if no await is used
function getName(): string {
  return 'John'
}

// DO use synchronous functions for sync operations
function saveConfig(config: Config): void {
  writeFileSync(path, JSON.stringify(config))
}
```

### Optional Properties

#### ❌ Avoid

```typescript
// DON'T assign undefined to optional properties
interface Options {
  path?: string
}

const opts: Options = {
  path: configPath || undefined  // ❌
}
```

#### ✅ Prefer

```typescript
// DO conditionally add properties
const opts: Options = {}
if (configPath) {
  opts.path = configPath
}

// OR use object spread with conditionals
const opts: Options = {
  ...(configPath && { path: configPath })
}
```

---

## ESLint Rules

### Console Statements

#### ❌ Avoid

```typescript
// DON'T use console.log/warn/error
console.log('Starting process...')
console.warn('Warning: deprecated')
console.error(error)
```

#### ✅ Prefer

```typescript
// DO use logger utility
import { logger } from './utils/logger'

logger.log('Starting process...')
logger.warn('Warning: deprecated')
logger.error(error)
```

**Exception**: Console statements are acceptable in:
- Build scripts
- Development-only code
- Scripts in `/scripts` directory

### Explicit Any

#### ❌ Avoid

```typescript
// DON'T use explicit 'any' type
function process(data: any): any {
  return data
}

const config: any = {}
let value: any
```

#### ✅ Prefer

```typescript
// DO use 'unknown' or proper types
function process(data: unknown): unknown {
  return data
}

const config: Record<string, unknown> = {}
let value: string | number | boolean
```

### Non-Null Assertions

#### ❌ Avoid

```typescript
// DON'T use non-null assertions (!)
const path = config.path!
auth = new CookieFileAuth(cookiePath!)
```

#### ✅ Prefer

```typescript
// DO check for null/undefined explicitly
if (config.path) {
  const path = config.path
}

// DO use conditional checks
if (cookiePath) {
  auth = new CookieFileAuth(cookiePath)
}
```

---

## Code Organization

### File Structure

```
package/
├── src/
│   ├── index.ts           # Main exports
│   ├── feature.ts         # Feature implementation
│   └── __tests__/
│       └── feature.test.ts # Tests
├── package.json
└── README.md
```

### Import Order

1. Node built-ins
2. External packages
3. Internal packages (from workspace)
4. Local imports (types, utilities, etc.)

```typescript
// Node built-ins
import { resolve } from 'path'
import { existsSync } from 'fs'

// External packages
import chalk from 'chalk'
import ora from 'ora'

// Internal packages
import type { Config } from '../../../shared/types'
import { logger } from '../../../shared/utils'

// Local imports
import { ConfigManager } from './config-manager'
import type { LoaderOptions } from './types'
```

### Exports

```typescript
// Export types and interfaces first
export type { Config, PartialConfig }

// Then export classes, functions, constants
export { ConfigManager }
export { loadConfig, mergeConfigs }
export const DEFAULT_TIMEOUT = 30000
```

---

## Naming Conventions

### Files

- **Kebab-case** for files: `config-manager.ts`, `graphql-client.ts`
- **Test files**: `*.test.ts` or `*.spec.ts`
- **Type definition files**: `*.d.ts`

### Variables and Functions

```typescript
// camelCase for variables and functions
const userName = 'John'
function getUserName(): string { }

// UPPER_SNAKE_CASE for constants
const MAX_RETRIES = 3
const API_ENDPOINT = 'https://api.example.com'

// PascalCase for classes, interfaces, types
class ConfigManager { }
interface UserOptions { }
type RequestType = 'problem' | 'list'
```

### Booleans

```typescript
// Prefix with 'is', 'has', 'should', 'can'
const isEnabled = true
const hasPermission = false
const shouldRetry = true
const canAccess = false
```

---

## Error Handling

### Custom Errors

```typescript
// DO use custom error classes
export class LescaError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'LescaError'
  }
}

throw new LescaError('Failed to load config', 'CONFIG_LOAD_ERROR')
```

### Try-Catch

```typescript
// DO handle errors appropriately
try {
  const config = loadConfigFile(path)
  return config
} catch (error) {
  if (error instanceof LescaError) {
    logger.error(`Configuration error: ${error.message}`)
  } else {
    logger.error(`Unexpected error: ${error}`)
  }
  throw error
}
```

### Error Messages

```typescript
// DO provide context in error messages
throw new Error(`Failed to load config from ${path}: ${error.message}`)

// DON'T use generic messages
throw new Error('Error occurred')
```

---

## Testing Standards

### Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('ConfigManager', () => {
  let manager: ConfigManager

  beforeEach(() => {
    manager = ConfigManager.getInstance()
  })

  describe('getConfig', () => {
    it('should return the current configuration', () => {
      const config = manager.getConfig()
      expect(config).toBeDefined()
      expect(config.auth).toBeDefined()
    })

    it('should not return a reference to internal config', () => {
      const config1 = manager.getConfig()
      const config2 = manager.getConfig()
      expect(config1).not.toBe(config2)
    })
  })
})
```

### Test Naming

```typescript
// DO use descriptive test names
it('should load configuration from YAML file')
it('should merge CLI options with config file values')
it('should throw error when config file is invalid')

// DON'T use vague names
it('works')
it('test config')
```

### Mocking

```typescript
// DO mock external dependencies
const mockGraphQLClient = {
  query: vi.fn().mockResolvedValue({ data: {} })
}

// DO use type assertions for mocks
const strategy = new ProblemScraperStrategy(
  mockGraphQLClient as unknown as GraphQLClient
)
```

---

## Documentation Standards

### JSDoc Comments

```typescript
/**
 * Load configuration from multiple sources
 *
 * Priority order:
 * 1. CLI options
 * 2. Environment variables
 * 3. Configuration file
 * 4. Default values
 *
 * @param options - Configuration loader options
 * @returns The merged configuration object
 * @throws {LescaError} When configuration is invalid
 *
 * @example
 * ```typescript
 * const config = loadConfig({ configPath: './lesca.yaml' })
 * console.log(config.auth.method)
 * ```
 */
export function loadConfig(options: LoaderOptions = {}): Config {
  // Implementation
}
```

### Inline Comments

```typescript
// DO explain WHY, not WHAT
// Use hash-based sharding to distribute cache files across directories
// This prevents file system performance issues with large caches
const shardDir = hashString(key).slice(0, 2)

// DON'T just describe the code
// Get the first 2 characters
const shardDir = hashString(key).slice(0, 2)
```

### README Files

Every package should have a README with:

1. **Purpose**: What the package does
2. **Installation**: How to install/use
3. **API**: Main exports and their usage
4. **Examples**: Common use cases
5. **Configuration**: Available options

---

## Common Patterns

### Configuration Merging

```typescript
// DO merge with proper precedence
const value = cliOption || envVariable || configFile || defaultValue

// DO use conditional spreading
const options = {
  ...defaults,
  ...(configFile && configFile.options),
  ...(cliOptions && cliOptions)
}
```

### Resource Cleanup

```typescript
// DO clean up resources
try {
  await driver.launch()
  const result = await driver.scrape(url)
  return result
} finally {
  await driver.close()
}
```

### Singleton Pattern

```typescript
// DO use proper singleton pattern
export class ConfigManager {
  private static instance: ConfigManager | null = null

  private constructor() { }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }
}
```

---

## Tools and Commands

### Linting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### Type Checking

```bash
# Run TypeScript compiler (no emit)
npx tsc --noEmit
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

### Formatting

```bash
# Format code (if configured)
npm run format
```

---

## Pre-commit Checklist

Before committing code, ensure:

- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] Code is properly documented
- [ ] No `console.log` statements (use `logger`)
- [ ] No `any` types (use proper types or `unknown`)
- [ ] No non-null assertions (`!`)
- [ ] No unnecessary async/await

---

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [ESLint Rules](https://eslint.org/docs/latest/rules/)
- [Vitest Documentation](https://vitest.dev/)
- [Project Architecture](./ARCHITECTURE_REVIEW.md)
- [Contributing Guide](../CONTRIBUTING.md)

---

## Questions?

If you have questions about these standards, please:

1. Check existing code for examples
2. Review the project's architecture documentation
3. Ask in pull request reviews
4. Update this document if clarification is needed
