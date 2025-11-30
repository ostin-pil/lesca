# Lesca - Claude Code Project Rules

> **IMPORTANT**: These rules are automatically loaded by Claude Code. Follow them strictly.

## Project Overview

**Lesca** (LeetCode Scraper Architecture) is a modular TypeScript monorepo for scraping LeetCode content and converting it to Markdown/Obsidian format.

- **Version**: v0.1.0 (MVP Complete)
- **Tests**: 631 passing, 68.43% coverage
- **Runtime**: Node.js >= 18.0.0, npm >= 9.0.0

## Critical Rules

### NEVER Do

1. **Use `any` type** - Use `unknown` with type guards instead
2. **Use `console.log/warn/error`** - Use `logger` from `@/shared/utils`
3. **Use non-null assertions (`!`)** - Check for null/undefined explicitly
4. **Make functions `async` without `await`** - Remove async if not needed
5. **Assign `undefined` to optional properties** - Conditionally add properties
6. **Include file extensions in imports** - No `.ts`, `.js` extensions
7. **Ignore ESLint/TypeScript errors** - Fix all errors before completing
8. **Redefine types** - Always import from `@/shared/types`
9. **Add `eslint-disable` without justification** - Document why it's needed

### ALWAYS Do

1. **Run validation before completing**:
   - `npm run lint` - ESLint
   - `npm run typecheck` - TypeScript
   - `npm test` - Unit tests
2. **Read files before editing** - Understand existing code
3. **Use existing types from `shared/types/src/index.ts`**
4. **Follow import order**: Node built-ins → External → Shared (`@/`) → Local
5. **Use factories** from `tests/factories/` for test data
6. **Check array access** - `noUncheckedIndexedAccess` is enabled
7. **Add JSDoc** for public APIs

## Import Patterns

```typescript
// 1. Node built-ins
import { resolve } from 'path'

// 2. External packages
import chalk from 'chalk'

// 3. Shared packages (@ alias)
import type { Config, Problem } from '@/shared/types'
import { logger } from '@/shared/utils'

// 4. Cross-package imports
import { GraphQLClient } from '@lesca/api-client'

// 5. Local imports (NO extension!)
import { helperFunction } from './helpers'
```

## Key File Locations

| Item           | Path                           |
| -------------- | ------------------------------ |
| All types      | `shared/types/src/index.ts`    |
| Config manager | `shared/config/src/manager.ts` |
| Logger         | `shared/utils/src/logger.ts`   |
| Error classes  | `shared/error/src/index.ts`    |
| Main scraper   | `packages/core/src/scraper.ts` |
| CLI entry      | `packages/cli/src/index.ts`    |
| Test factories | `tests/factories/`             |

## TypeScript Requirements

- **Strict mode enabled** with `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`
- **No `any`** - ESLint error `@typescript-eslint/no-explicit-any`
- **No non-null assertions** - ESLint error `@typescript-eslint/no-non-null-assertion`

### Common Patterns

```typescript
// Optional properties - CORRECT
const opts: Options = {}
if (configPath) opts.configPath = configPath

// Optional properties - WRONG (exactOptionalPropertyTypes)
const opts: Options = { configPath: configPath || undefined }

// Array access - CORRECT
const first = array[0]
if (!first) throw new Error('Empty array')

// Array access - WRONG
const first = array[0]!
```

## Testing

```bash
npm test               # Fast unit tests (<30s)
npm run test:unit      # Same as above
npm run test:coverage  # With coverage report
npm run check-coverage # Validate thresholds
```

- **Unit tests**: `packages/*/src/__tests__/`
- **Integration tests**: `tests/integration/` (slow, run sparingly)
- **Test data**: Use factories from `tests/factories/`

## Design Patterns in Use

1. **Facade Pattern** - `LeetCodeScraper` in `packages/core`
2. **Strategy Pattern** - Scraper strategies in `packages/scrapers`
3. **Singleton Pattern** - `ConfigManager` in `shared/config`
4. **Adapter Pattern** - `HtmlToMarkdownConverter` with Turndown

## Commands Quick Reference

```bash
# Development
npm run dev -- scrape two-sum
npm run dev -- scrape-list --difficulty Easy

# Quality checks
npm run lint           # ESLint
npm run lint:fix       # Auto-fix
npm run typecheck      # TypeScript
npm run format         # Prettier

# Build
npm run build          # Production build
npm run clean          # Remove dist/
```

## Pre-commit Checklist

Before completing any task, verify:

1. `npm run typecheck` - passes
2. `npm run lint` - 0 errors
3. `npm test` - all pass
4. Coverage maintained (80%+ for most packages)

## Documentation References

- [Agent Guidelines](docs/AGENT_GUIDELINES.md) - Detailed rules
- [LLM Knowledge Base](docs/LLM_AGENT_KNOWLEDGE.md) - Comprehensive reference
- [Coding Standards](docs/CODING_STANDARDS.md) - Style guide
- [TypeScript Guide](docs/TYPESCRIPT_GUIDE.md) - TS patterns

## Error Handling

```typescript
import { LescaError, AuthError, GraphQLError } from '@/shared/error'

throw new LescaError('Config failed', 'CONFIG_ERROR', 500)
throw new AuthError('Invalid cookies')
throw new GraphQLError('Query failed', 400)
```

## Logging

```typescript
import { logger } from '@/shared/utils'

logger.log('Starting...')
logger.warn('Deprecated')
logger.error(error)
logger.debug('Detail')
logger.success('Done!')
logger.box('Message', { title: 'Info', color: 'blue' })
```
