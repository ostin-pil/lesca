# Check TypeScript Types

Run the TypeScript compiler in check mode to find type errors.

## Arguments

- `$ARGUMENTS` - Optional: specific package to check (e.g., `packages/core`)

## Steps

1. Run type check: `npm run typecheck`
2. Report any type errors with:
   - File path and line number
   - The error message
   - The problematic code
   - A suggested fix

## Common Type Errors in Lesca

1. **Object is possibly undefined** - Need null check before access
2. **Type 'any' is not assignable** - Need proper type narrowing
3. **Property does not exist** - May need type assertion or interface update
4. **Cannot assign undefined to optional** - Use conditional property assignment
