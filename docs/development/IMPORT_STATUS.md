# Import Status & Recommendations

**Date:** 2025-11-18
**Status:** ✅ Build Working | ✅ Tests Passing | 🔧 Imports Can Be Improved

---

## ✅ What's Fixed

1. **Build is now working** - Excluded `scripts/` from TypeScript compilation
2. **Tests passing** - 631 tests passing, 3 skipped
3. **Vitest configs corrected** - Changed `@lesca/shared/error` → `@lesca/error`

---

## 📊 Current Import Patterns

### What's Currently Working

The codebase uses THREE import patterns that all work correctly:

**Pattern 1: `@lesca/error`** ✅ **GOOD - Keep this**

```typescript
import { ScrapingError, BrowserError } from '@lesca/error'
```

- Used: 12 times
- Clean, semantic package name
- **This is the standard we should follow**

**Pattern 2: `@/` prefix** ⚠️ **Works but verbose**

```typescript
import type { Problem } from '@/shared/types/src/index.js'
import { logger } from '@/shared/utils/src/index.js'
import { GraphQLClient } from '@/packages/api-client/src/graphql-client.js'
```

- Used: ~47 times in source files
- Works via `tsconfig.json` wildcard: `"@/*": ["./*"]`
- **Can be improved** - Too verbose, includes implementation details

**Pattern 3: Deep relative paths** ⚠️ **Works but confusing**

```typescript
import type { Problem } from '../../../../shared/types/src/index.js'
import { ConfigManager } from '../../../../shared/config/src/index.js'
```

- Used: ~22 times (mostly in test files)
- Confusing, hard to refactor
- **Can be improved** - Use aliases instead

---

## 🎯 Recommended Standard (Based on Actual Config)

### Current Path Aliases in tsconfig.json

```json
"paths": {
  "@/*": ["./*"],                                    // Wildcard - allows any path
  "@lesca/core": ["./packages/core/src"],           // Package aliases
  "@lesca/auth": ["./packages/auth/src"],
  "@lesca/api-client": ["./packages/api-client/src"],
  "@lesca/browser-automation": ["./packages/browser-automation/src"],
  "@lesca/scrapers": ["./packages/scrapers/src"],
  "@lesca/converters": ["./packages/converters/src"],
  "@lesca/storage": ["./packages/storage/src"],
  "@lesca/cli": ["./packages/cli/src"],
  "@lesca/shared/*": ["./shared/*/src"]             // Shared wildcard
}
```

### What This Enables

✅ You CAN use: `@lesca/shared/types` (maps to `./shared/types/src`)
✅ You CAN use: `@lesca/shared/utils` (maps to `./shared/utils/src`)
✅ You CAN use: `@lesca/shared/config` (maps to `./shared/config/src`)
✅ You CAN use: `@lesca/error` (maps to `./shared/error/src` - explicit mapping needed)

### Recommended Import Convention

**Rule 1: Use `@lesca/` aliases for ALL cross-package imports**

```typescript
// ✅ RECOMMENDED
import { ScrapingError, BrowserError } from '@lesca/error'
import type { Problem, ScrapeRequest } from '@lesca/shared/types'
import { logger } from '@lesca/shared/utils'
import { ConfigManager } from '@lesca/shared/config'
import { GraphQLClient } from '@lesca/api-client'
import { LeetCodeScraper } from '@lesca/core'
import { CookieFileAuth } from '@lesca/auth'

// ⚠️ WORKS BUT VERBOSE (current state)
import type { Problem } from '@/shared/types/src/index.js'
import { logger } from '@/shared/utils/src/index.js'
import { GraphQLClient } from '@/packages/api-client/src/graphql-client.js'

// ❌ CONFUSING (current state in tests)
import type { Problem } from '../../../../shared/types/src/index.js'
```

**Rule 2: Use relative imports WITHIN same package**

```typescript
// ✅ CORRECT (within same package)
import { HtmlToMarkdownConverter } from './html-to-markdown.js'
import type { ConverterOptions } from './types.js'
import { helper } from '../utils/helper.js'
```

---

## 🔧 What Needs tsconfig.json Update

The `@lesca/error` is currently using the wildcard fallback. We should add it explicitly:

```json
"paths": {
  "@/*": ["./*"],
  "@lesca/core": ["./packages/core/src"],
  "@lesca/auth": ["./packages/auth/src"],
  "@lesca/api-client": ["./packages/api-client/src"],
  "@lesca/browser-automation": ["./packages/browser-automation/src"],
  "@lesca/scrapers": ["./packages/scrapers/src"],
  "@lesca/converters": ["./packages/converters/src"],
  "@lesca/storage": ["./packages/storage/src"],
  "@lesca/cli": ["./packages/cli/src"],
  "@lesca/error": ["./shared/error/src"],              // ✅ ADD THIS
  "@lesca/shared/*": ["./shared/*/src"]
}
```

---

## 📋 Optional Migration Plan

If you want to clean up the imports for better consistency:

### Files to Update (~69 imports)

1. **Source files using `@/shared/*`**: 36 occurrences
   - Change `@/shared/types/src/index.js` → `@lesca/shared/types`
   - Change `@/shared/utils/src/index.js` → `@lesca/shared/utils`
   - Change `@/shared/config/src/index.js` → `@lesca/shared/config`

2. **Source files using `@/packages/*`**: 11 occurrences
   - Change `@/packages/api-client/src/` → `@lesca/api-client`
   - Change `@/packages/auth/src/` → `@lesca/auth`
   - Change `@/packages/storage/src/` → `@lesca/storage`
   - etc.

3. **Test files using deep relative paths**: 22 occurrences
   - Change `../../../../shared/types/src/index.js` → `@lesca/shared/types`
   - Change `../../../../shared/utils/src/index.js` → `@lesca/shared/utils`
   - Change `../../../../shared/config/src/index.js` → `@lesca/shared/config`

### Migration Commands (Simple Find/Replace)

```bash
# Migrate @/ shared imports to @lesca/shared/*
find packages shared -name "*.ts" -type f -exec sed -i \
  "s|@/shared/types/src/index.js|@lesca/shared/types|g" {} \;

find packages shared -name "*.ts" -type f -exec sed -i \
  "s|@/shared/utils/src/index.js|@lesca/shared/utils|g" {} \;

find packages shared -name "*.ts" -type f -exec sed -i \
  "s|@/shared/config/src/index.js|@lesca/shared/config|g" {} \;

# Migrate deep relative imports to @lesca/shared/*
find packages shared -name "*.ts" -type f -exec sed -i \
  "s|../../../../shared/types/src/index.js|@lesca/shared/types|g" {} \;

find packages shared -name "*.ts" -type f -exec sed -i \
  "s|../../../../shared/utils/src/index.js|@lesca/shared/utils|g" {} \;

find packages shared -name "*.ts" -type f -exec sed -i \
  "s|../../../../shared/config/src/index.js|@lesca/shared/config|g" {} \;

# Migrate @/ package imports to @lesca/*
find packages shared -name "*.ts" -type f -exec sed -i \
  "s|@/packages/api-client/src/graphql-client.js|@lesca/api-client/graphql-client|g" {} \;

find packages shared -name "*.ts" -type f -exec sed -i \
  "s|@/packages/api-client/src/index.js|@lesca/api-client|g" {} \;

find packages shared -name "*.ts" -type f -exec sed -i \
  "s|@/packages/auth/src/index.js|@lesca/auth|g" {} \;

find packages shared -name "*.ts" -type f -exec sed -i \
  "s|@/packages/browser-automation/src/index.js|@lesca/browser-automation|g" {} \;

find packages shared -name "*.ts" -type f -exec sed -i \
  "s|@/packages/storage/src/index.js|@lesca/storage|g" {} \;

find packages shared -name "*.ts" -type f -exec sed -i \
  "s|@/packages/converters/src/index.js|@lesca/converters|g" {} \;

# Verify changes
npm run build
npm test
npm run typecheck
```

---

## 🎯 Benefits of Migration

If you choose to migrate:

✅ **Consistency** - All cross-package imports use `@lesca/*` pattern
✅ **Clarity** - Package names are semantic (`@lesca/shared/types` vs `@/shared/types/src/index.js`)
✅ **Maintainability** - Implementation details hidden (`/src/index.js` not in import)
✅ **Refactoring** - Easier to move files without breaking imports
✅ **IDE Support** - Better autocomplete and go-to-definition

---

## ⚠️ Current State Summary

**✅ What's Working:**

- Build compiles successfully
- All 631 tests passing
- TypeScript strict mode working
- All imports resolve correctly

**🔧 What Can Be Improved:**

- 36 source files use verbose `@/shared/*` imports
- 11 source files use verbose `@/packages/*` imports
- 22 files (tests) use confusing deep relative paths
- All could use cleaner `@lesca/*` aliases instead

**⏸️ Migration Status:**

- Migration is **OPTIONAL** - everything works as-is
- Benefit is **consistency and clarity**, not functionality
- Estimated time: **15-30 minutes** using find/replace
- Risk: **Low** - can verify with build/tests immediately

---

## 🤔 Decision Points

### Option A: Keep As-Is (No Migration)

- ✅ Everything works
- ✅ No risk of breaking changes
- ⚠️ Less consistent import patterns
- ⚠️ More verbose imports

### Option B: Migrate to Standard Pattern

- ✅ Consistent `@lesca/*` pattern everywhere
- ✅ Cleaner, more semantic imports
- ✅ Better long-term maintainability
- ⚠️ Requires ~30 minutes of work
- ⚠️ Small risk of sed errors (verify with tests)

### Option C: Migrate Gradually

- ✅ New code uses `@lesca/*` pattern
- ✅ Old code stays as-is until refactored
- ✅ No dedicated migration effort
- ⚠️ Inconsistency persists longer

---

## 📝 Recommended Action

**My recommendation: Option B - Do the migration now**

Why:

1. It's quick (~30 minutes)
2. Low risk (immediately verifiable)
3. Better foundation for future development
4. Eliminates confusion about which pattern to use

You can run the sed commands above, then verify:

```bash
npm run build    # Should succeed
npm test         # Should pass 631 tests
npm run lint     # Should have no errors
```

---

**Note:** This document supersedes `IMPORT_MIGRATION_STATUS.md` which had incorrect assumptions about package names. The wildcard pattern `@lesca/shared/*` is correct and working.
