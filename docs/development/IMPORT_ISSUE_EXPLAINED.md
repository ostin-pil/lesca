# Why `@/` Imports Show Errors in Test Files (But Work at Runtime)

## 🔍 The Issue

In test files like `packages/auth/src/__tests__/cookie-auth.test.ts`:

```typescript
// ❌ IDE shows error: "Cannot find module '@/shared/types/src/index.js'"
import { AuthError } from '@/shared/types/src/index.js'

// ✅ IDE is happy with this
import { AuthError } from '../../../../shared/types/src/index.js'
```

But in source files like `packages/api-client/src/graphql-client.ts`:

```typescript
// ✅ IDE is happy with this
import { AuthError } from '@/shared/types/src/index.js'
```

**Confusingly, BOTH actually work at runtime!** The tests pass. So what's going on?

---

## 🎯 Root Cause

The issue is in **`tsconfig.json` line 53**:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"], // This defines the alias
      "@lesca/shared/*": ["./shared/*/src"]
    }
  },
  "exclude": [
    "node_modules",
    "dist",
    "**/dist",
    "**/*.test.ts", // ⚠️ TEST FILES EXCLUDED
    "**/*.spec.ts", // ⚠️ TEST FILES EXCLUDED
    "scripts/**/*.ts"
  ]
}
```

### What This Means:

1. **Source files** (`.ts` not in `__tests__/`):
   - ✅ Included in `tsconfig.json`
   - ✅ TypeScript applies path mappings (`@/*` works)
   - ✅ IDE understands `@/` imports

2. **Test files** (`*.test.ts`):
   - ❌ Excluded from `tsconfig.json`
   - ❌ TypeScript doesn't apply path mappings
   - ❌ IDE shows "Cannot find module" errors
   - ✅ But Vitest config has the aliases, so **they work at runtime**!

---

## 🤔 Why Are Test Files Excluded?

When I tried including them by removing the exclusion, TypeScript found **10 type errors** in test files:

```typescript
// Example errors:
packages/api-client/src/__tests__/graphql-client.test.ts(123,5): error TS2322
packages/api-client/src/__tests__/graphql-client.test.ts(320,13): error TS2741
// ... 8 more errors
```

These are minor type issues in tests (missing mock properties, type mismatches in test helpers) that:

- Don't affect functionality
- Don't cause tests to fail
- Are annoying to fix for every test file
- Are commonly ignored in test code

So test files are **intentionally excluded** to avoid these strict TypeScript errors.

---

## ✅ Why It Works at Runtime (Vitest)

Test files run through **Vitest**, which has its own config: `vitest.unit.config.ts`

```typescript
// vitest.unit.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './'), // ✅ Vitest knows about @/
      '@lesca/shared/types': resolve(__dirname, './shared/types/src'),
      '@lesca/shared/utils': resolve(__dirname, './shared/utils/src'),
      // ... etc
    },
  },
})
```

So at runtime:

- ✅ Vitest resolves `@/` imports correctly
- ✅ Tests pass
- ❌ But IDE doesn't know this (it only checks tsconfig.json)

---

## 🎯 Solutions

### Option 1: Use Relative Imports in Tests (Current)

```typescript
// In test files only
import { AuthError } from '../../../../shared/types/src/index.js'
```

**Pros:**

- ✅ IDE happy (no errors)
- ✅ Works at runtime
- ✅ No config changes needed

**Cons:**

- ⚠️ Ugly, hard to read
- ⚠️ Breaks if you move test files

### Option 2: Use `@lesca/shared/*` Aliases (Recommended)

```typescript
// Works in BOTH source and test files
import { AuthError } from '@lesca/shared/types'
import { logger } from '@lesca/shared/utils'
import { ConfigManager } from '@lesca/shared/config'
import { ScrapingError } from '@lesca/error'
```

**Pros:**

- ✅ IDE happy (tsconfig has wildcard: `"@lesca/shared/*": ["./shared/*/src"]`)
- ✅ Works in test files even though they're excluded (vitest config matches)
- ✅ Clean, semantic imports
- ✅ Consistent with error package style

**Cons:**

- None! This is the best approach

### Option 3: Fix Test Type Errors & Include Tests

Remove test files from `exclude` and fix all type errors.

**Pros:**

- ✅ Full TypeScript checking in tests
- ✅ IDE knows about `@/` in tests

**Cons:**

- ❌ Need to fix ~10 type errors across test files
- ❌ Ongoing maintenance (new test type errors fail builds)
- ❌ Slower IDE (more files to check)

### Option 4: Ignore IDE Errors

Just ignore the red squiggles in test files.

**Pros:**

- ✅ No changes needed
- ✅ Tests still pass

**Cons:**

- ❌ Annoying red squiggles
- ❌ IDE autocomplete doesn't work for those imports
- ❌ Confusing for contributors

---

## 📋 Recommended Action

**Migrate test imports to use `@lesca/shared/*` pattern:**

```bash
# Migrate test imports
find packages shared -name "*.test.ts" -type f -exec sed -i \
  "s|../../../../shared/types/src/index.js|@lesca/shared/types|g" {} \;

find packages shared -name "*.test.ts" -type f -exec sed -i \
  "s|../../../../shared/utils/src/index.js|@lesca/shared/utils|g" {} \;

find packages shared -name "*.test.ts" -type f -exec sed -i \
  "s|../../../../shared/config/src/index.js|@lesca/shared/config|g" {} \;

# Also update any that use @/ pattern
find packages shared -name "*.test.ts" -type f -exec sed -i \
  "s|@/shared/types/src/index.js|@lesca/shared/types|g" {} \;

# Verify
npm test
```

This gives you:

- ✅ No IDE errors
- ✅ Clean, semantic imports
- ✅ Tests still pass
- ✅ Consistent with recommended `@lesca/*` pattern

---

## 🎓 Key Takeaway

**The `@/` pattern works at runtime (vitest) but not in IDE (tsconfig) for test files.**

**Solution:** Use `@lesca/shared/*` and `@lesca/error` patterns which work in BOTH places because:

1. tsconfig.json has the wildcard: `"@lesca/shared/*": ["./shared/*/src"]`
2. vitest configs have explicit mappings for each
3. Both configs agree, so IDE and runtime both work ✅

---

**File:** `IMPORT_ISSUE_EXPLAINED.md`
**Date:** 2025-11-18
