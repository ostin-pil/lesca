# TypeScript Best Practices for Lesca

This guide documents patterns and practices to prevent common TypeScript errors in the Lesca codebase.

## Table of Contents

1. [Interface Design](#interface-design)
2. [Strict Mode Compliance](#strict-mode-compliance)
3. [Type Safety Patterns](#type-safety-patterns)
4. [Error Handling](#error-handling)
5. [Code Organization](#code-organization)

---

## Interface Design

### Keep Interfaces Complete

**Problem**: Calling methods that don't exist in the interface definition.

**Rule**: When implementing a class, ensure the interface includes ALL methods that will be called.

```typescript
// ❌ BAD: Interface missing methods
export interface BrowserDriver {
  launch(options?: BrowserLaunchOptions): Promise<void>
  navigate(url: string): Promise<void>
  // Missing: getBrowser(), screenshot(), etc.
}

// ✅ GOOD: Complete interface
export interface BrowserDriver {
  launch(options?: BrowserLaunchOptions): Promise<void>
  navigate(url: string): Promise<void>
  getBrowser(): unknown
  screenshot(path: string): Promise<void>
  getHtml(selector: string): Promise<string>
  getPageHtml(): Promise<string>
  elementExists(selector: string): Promise<boolean>
  extractWithFallback(selectors: string[]): Promise<string>
}
```

**Prevention**:
- Review implementations to ensure all public methods are in the interface
- Use `implements` keyword to catch missing methods early
- Run `npm run build` regularly during development

---

## Strict Mode Compliance

### Array Access with `noUncheckedIndexedAccess`

**Problem**: Accessing array elements returns `T | undefined` but code expects `T`.

**Rule**: Always check array access for undefined before use.

```typescript
// ❌ BAD: Assumes array element exists
const selectors = ['selector1', 'selector2']
await driver.waitForSelector(selectors[0], 5000)  // Type error: string | undefined

// ✅ GOOD: Check for undefined
const selectors = ['selector1', 'selector2']
const firstSelector = selectors[0]
if (!firstSelector) throw new Error('No selector found')
await driver.waitForSelector(firstSelector, 5000)

// ✅ ALSO GOOD: Use nullish coalescing
const selector = selectors[0] ?? 'default-selector'
await driver.waitForSelector(selector, 5000)
```

**Prevention**:
- Enable `noUncheckedIndexedAccess: true` in tsconfig
- Always destructure or check array access results
- Use `.at()` method with null checks for negative indices

### Optional Properties with `exactOptionalPropertyTypes`

**Problem**: Cannot assign `T | undefined` to optional `T?` properties.

**Rule**: Use conditional property assignment or exclude undefined explicitly.

```typescript
// ❌ BAD: Assigns potentially undefined value
interface Request {
  category?: 'solution' | 'general'
  sortBy?: 'hot' | 'recent'
}

const request: Request = {
  category: options.category,  // Type error: string | undefined
  sortBy: options.sort          // Type error: string | undefined
}

// ✅ GOOD: Conditional assignment
const request: Request = {
  ...(options.category && { category: options.category as 'solution' | 'general' }),
  sortBy: (options.sort as 'hot' | 'recent') || 'hot'
}

// ✅ ALSO GOOD: Build object conditionally
const request: Request = {}
if (options.category) {
  request.category = options.category as 'solution' | 'general'
}
```

**Prevention**:
- Enable `exactOptionalPropertyTypes: true` in tsconfig
- Use spread operator with conditional for optional fields
- Provide defaults for required-but-optional fields

---

## Type Safety Patterns

### Union Type Narrowing

**Problem**: Accessing properties that don't exist on all union members.

**Rule**: Use type guards or type narrowing before accessing discriminated union properties.

```typescript
// ❌ BAD: Not all ScrapeRequest types have titleSlug
type ScrapeRequest = ProblemRequest | ListRequest | DiscussionRequest
const titleSlug = request.titleSlug  // Type error

// ✅ GOOD: Use type guards
const identifier =
  request.type === 'problem' || request.type === 'discussion'
    ? request.titleSlug
    : request.type === 'user'
      ? request.username
      : 'list'

// ✅ ALSO GOOD: Type narrowing with if
if (request.type === 'problem') {
  console.log(request.titleSlug)  // TypeScript knows it exists
}
```

**Prevention**:
- Use discriminated unions with a `type` field
- Always narrow unions before accessing unique properties
- Consider using type guards or switch statements

### Async/Sync Interface Matching

**Problem**: Implementation doesn't match interface async signature.

**Rule**: Ensure return types match exactly, including Promise wrappers.

```typescript
// ❌ BAD: Interface expects Promise<boolean> but returns boolean
interface AuthStrategy {
  isValid(): Promise<boolean>
}

class CookieAuth implements AuthStrategy {
  isValid(): boolean {  // Type error
    return this.credentials !== null
  }
}

// ✅ GOOD: Match the interface signature
class CookieAuth implements AuthStrategy {
  async isValid(): Promise<boolean> {
    return this.credentials !== null
  }
}
```

**Prevention**:
- Use `implements` keyword to catch signature mismatches
- Be consistent: if interface is async, implementation should be async
- Don't mix sync/async in the same abstraction

### Type Narrowing with Optional Chaining

**Problem**: Optional chaining can return undefined, breaking boolean expectations.

**Rule**: Use nullish coalescing (`??`) to provide boolean fallback.

```typescript
// ❌ BAD: Returns boolean | undefined
filter: (node: Node) => {
  return element.previousSibling?.textContent?.includes('Constraints')
}

// ✅ GOOD: Ensures boolean return
filter: (node: Node) => {
  return element.previousSibling?.textContent?.includes('Constraints') ?? false
}
```

**Prevention**:
- Always add `?? false` or `?? true` when optional chaining in boolean context
- Check function return types - avoid `boolean | undefined`

---

## Error Handling

### LescaError Constructor Usage

**Problem**: Using incorrect constructor signature.

**Rule**: Always provide `code` parameter, use proper parameter order.

```typescript
// ❌ BAD: Missing required 'code' parameter
throw new LescaError('Something failed')
throw new LescaError('Something failed', error)

// ✅ GOOD: Correct signature
throw new LescaError('Something failed', 'OPERATION_FAILED')
throw new LescaError(
  'Something failed',
  'OPERATION_FAILED',
  500,
  error instanceof Error ? error : undefined
)
```

**Signature**:
```typescript
constructor(
  message: string,
  code: string,
  statusCode?: number,
  cause?: Error
)
```

**Prevention**:
- Always include error code (second parameter)
- Use descriptive, UPPER_SNAKE_CASE codes
- Pass original error as `cause` parameter (4th), not 2nd

---

## Code Organization

### Import Management

**Problem**: Unused imports cause TS6196 errors.

**Rule**: Remove unused imports immediately.

```typescript
// ❌ BAD: Importing but not using
import type { AuthCredentials } from './types'

class MyClass {
  // AuthCredentials never used
}

// ✅ GOOD: Only import what you use
import type { BrowserDriver } from './types'

class MyClass {
  constructor(private driver: BrowserDriver) {}
}
```

**Prevention**:
- Run ESLint with `@typescript-eslint/no-unused-vars` enabled
- Use IDE auto-import and let it manage imports
- Review imports when refactoring

### Parameter Naming

**Problem**: Declaring parameters that are never used.

**Rule**: Prefix unused parameters with `_` or remove them.

```typescript
// ❌ BAD: Parameter declared but never used
constructor(
  private browserDriver: BrowserDriver,
  private auth?: AuthCredentials  // Never referenced
) {}

// ✅ GOOD: Prefix with underscore to indicate intentionally unused
constructor(
  private browserDriver: BrowserDriver,
  private _auth?: AuthCredentials
) {}

// ✅ BEST: Remove if truly unused
constructor(private browserDriver: BrowserDriver) {}
```

**Prevention**:
- Enable `noUnusedParameters: true` in tsconfig
- Remove parameters that aren't needed
- Use `_` prefix for parameters needed for interface compliance

---

## Metadata and Type Consistency

### Metadata Field Types

**Problem**: Metadata fields don't match expected types.

**Rule**: Match metadata types exactly to interface definitions.

```typescript
// ❌ BAD: Using string where Date expected
const data: RawData = {
  type: 'discussion',
  data: discussions,
  metadata: {
    scrapedAt: new Date().toISOString(),  // Type error: string vs Date
    url,
    strategy: this.name
  }
}

// ✅ GOOD: Use correct type
const data: RawData = {
  type: 'discussion',
  data: discussions,
  metadata: {
    scrapedAt: new Date(),  // Correct: Date type
    url,
    strategy: this.name
  }
}
```

**Prevention**:
- Check interface definitions before creating objects
- Don't convert types unnecessarily (e.g., `.toISOString()`)
- Let TypeScript infer types when possible

---

## Pre-commit Checklist

Before committing code, ensure:

- [ ] `npm run build` succeeds with 0 errors
- [ ] `npm run lint` passes
- [ ] No unused imports or parameters
- [ ] All interface methods implemented
- [ ] Array access checked for undefined
- [ ] Optional properties assigned conditionally
- [ ] Error constructors use correct signature
- [ ] Async/sync signatures match interfaces

---

## Common Error Messages

### Quick Reference

| Error | Cause | Fix |
|-------|-------|-----|
| `TS2339: Property 'X' does not exist` | Missing interface method or union type access | Add to interface or use type guard |
| `TS2345: Argument of type 'X \| undefined'` | Array access with `noUncheckedIndexedAccess` | Check for undefined before use |
| `TS2412: Type 'X \| undefined' is not assignable` | `exactOptionalPropertyTypes` violation | Use conditional assignment |
| `TS2416: Property 'X' is not assignable` | Signature mismatch | Match return type exactly |
| `TS6138: 'X' is declared but never read` | Unused parameter/import | Remove or prefix with `_` |
| `TS2322: Type 'X' is not assignable to 'Y'` | Type mismatch | Convert type or fix definition |

---

## Configuration

This project uses strict TypeScript configuration:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

These settings catch bugs early but require disciplined type handling. Follow the patterns in this guide to work with these settings effectively.

---

## Additional Resources

- [TypeScript Handbook - Strict Mode](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#strictness)
- [TypeScript 4.4 - exactOptionalPropertyTypes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html#exact-optional-property-types)
- [TypeScript 4.1 - noUncheckedIndexedAccess](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html#checked-indexed-accesses---nouncheckedindexedaccess)
