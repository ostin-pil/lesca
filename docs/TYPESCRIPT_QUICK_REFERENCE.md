# TypeScript Quick Reference - Lesca

Fast reference for common TypeScript patterns in this codebase.

## Array Access (noUncheckedIndexedAccess)

```typescript
// Access array elements safely
const items = ['a', 'b', 'c']

// ❌ items[0]  // Type: string | undefined
// ✅
const first = items[0]
if (!first) throw new Error('Array is empty')
use(first)  // Type: string
```

## Optional Properties (exactOptionalPropertyTypes)

```typescript
// Assign optional properties conditionally
interface Config {
  name: string
  port?: number
  host?: string
}

// ❌ config.port = maybePort  // If maybePort is number | undefined
// ✅
const config: Config = {
  name: 'app',
  ...(maybePort !== undefined && { port: maybePort }),
  host: maybeHost || 'localhost'
}
```

## Union Type Access

```typescript
// Access discriminated union properties
type Request = ProblemRequest | ListRequest

// ❌ request.titleSlug  // Not all types have this
// ✅
if (request.type === 'problem') {
  use(request.titleSlug)  // TypeScript knows it exists
}
```

## Error Construction

```typescript
// LescaError signature: (message, code, statusCode?, cause?)
// ✅
throw new LescaError('Failed to load', 'LOAD_ERROR')
throw new LescaError('Failed', 'ERROR', 500, originalError)
```

## Optional Chaining in Booleans

```typescript
// Ensure boolean return type
// ❌ return node.parent?.textContent?.includes('x')  // boolean | undefined
// ✅
return node.parent?.textContent?.includes('x') ?? false
```

## Async Interfaces

```typescript
// Match interface signatures exactly
interface Auth {
  isValid(): Promise<boolean>  // Note: Promise
}

// ✅
class MyAuth implements Auth {
  async isValid(): Promise<boolean> {  // Must return Promise
    return true
  }
}
```

## Metadata Types

```typescript
// Match expected types exactly
// ❌
metadata: {
  scrapedAt: new Date().toISOString()  // Wrong: string
}

// ✅
metadata: {
  scrapedAt: new Date()  // Correct: Date
}
```

## Build Before Commit

```bash
# Always run before committing
npm run build
npm run lint

# Should see:
# ✓ No TypeScript errors
# ✓ No lint errors
```
