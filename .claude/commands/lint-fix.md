# Lint and Fix

Run ESLint with auto-fix on the project or specific files.

## Arguments

- `$ARGUMENTS` - Optional: specific file or glob pattern (e.g., `packages/core/src/*.ts`)

## Steps

1. If arguments provided, run: `npm run lint:fix -- $ARGUMENTS`
2. Otherwise, run on entire project: `npm run lint:fix`
3. Report any remaining issues that couldn't be auto-fixed
4. For remaining issues, provide specific guidance on how to fix them manually

## Common Issues That Can't Be Auto-Fixed

- `@typescript-eslint/no-explicit-any` - Must replace with proper type
- `@typescript-eslint/no-non-null-assertion` - Must add null check
- `@typescript-eslint/require-await` - Must remove async or add await
- `no-console` - Must use logger from @/shared/utils
