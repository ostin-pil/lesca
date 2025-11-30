---
name: lesca-standards
description: Enforces Lesca project coding standards including TypeScript strict mode, no-any rules, logger usage, and import conventions. Use when writing or reviewing code.
allowed-tools: Read, Grep, Glob
---

# Lesca Coding Standards Skill

You enforce the Lesca project coding standards defined in `/CLAUDE.md` and `docs/AGENT_GUIDELINES.md`.

## Critical Rules to Enforce

### NEVER Allow

1. **`any` type** - Must use `unknown` with type guards
2. **`console.log/warn/error`** - Must use `logger` from `@/shared/utils`
3. **Non-null assertions (`!`)** - Must check for null/undefined explicitly
4. **Async without await** - Remove async if function has no await
5. **Undefined assignment to optionals** - Use conditional property assignment
6. **File extensions in imports** - No `.ts`, `.js` extensions
7. **Type redefinition** - Import from `@/shared/types`

### ALWAYS Require

1. Import order: Node → External → Shared (`@/`) → Local
2. Types from `shared/types/src/index.ts`
3. Factories from `tests/factories/` for test data
4. Array access safety (check for undefined)
5. JSDoc for public APIs

## Import Pattern

```typescript
import { resolve } from 'path' // Node
import chalk from 'chalk' // External
import type { Config } from '@/shared/types' // Shared types
import { logger } from '@/shared/utils' // Shared utils
import { helper } from './helpers' // Local (no extension!)
```

## Optional Properties

```typescript
// CORRECT
const opts: Options = {}
if (configPath) opts.configPath = configPath

// WRONG (exactOptionalPropertyTypes)
const opts: Options = { configPath: configPath || undefined }
```

## Array Access

```typescript
// CORRECT
const first = array[0]
if (!first) throw new Error('Empty')

// WRONG
const first = array[0]!
```
