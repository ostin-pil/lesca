# @lesca/error

Error handling package for Lesca with comprehensive error codes, recovery utilities, and type-safe error classes.

## Features

- ✅ **50+ standardized error codes** with detailed metadata
- ✅ **Type-safe error classes** for each category
- ✅ **Error recovery utilities** (retry, circuit breaker, timeout)
- ✅ **User-friendly error messages** with resolution hints
- ✅ **Automatic error classification** (recoverable, fatal, user-action)

## Installation

```bash
npm install @lesca/error
```

## Quick Start

```typescript
import {
  LescaError,
  AuthError,
  NetworkError,
  withRetry,
} from '@lesca/error'

// Throw a specific error
throw new AuthError('AUTH_INVALID_CREDENTIALS', 'Session expired')

// Automatic retry for recoverable errors
const data = await withRetry(async () => {
  return await fetchData()
}, {
  maxAttempts: 3,
  initialDelay: 1000,
})

// Check error type
try {
  // ...
} catch (error) {
  if (error instanceof LescaError) {
    if (error.isRecoverable()) {
      // Retry
    } else {
      // Show user error message
      console.error(error.getUserMessage())
    }
  }
}
```

## Error Codes

All error codes are documented in `codes.ts`. Each error code includes:

- **Code**: Unique identifier (e.g., `AUTH_INVALID_CREDENTIALS`)
- **Category**: Error category (authentication, network, storage, etc.)
- **Recovery**: Whether error is recoverable, fatal, or requires user action
- **Description**: What the error means
- **Common Causes**: Why this error occurs
- **Resolution**: How to fix it

### Categories

- `authentication` - Authentication and authorization errors
- `network` - Network and API errors
- `validation` - Input validation errors
- `storage` - File system and database errors
- `browser` - Browser automation errors
- `scraping` - Web scraping errors
- `parsing` - HTML/JSON/Markdown parsing errors
- `configuration` - Configuration errors
- `system` - System-level errors

### Example Error Codes

| Code | Category | Recovery | Description |
|------|----------|----------|-------------|
| `AUTH_INVALID_CREDENTIALS` | authentication | user-action | Invalid authentication credentials |
| `NET_TIMEOUT` | network | recoverable | Request timed out |
| `BROWSER_SELECTOR_NOT_FOUND` | browser | fatal | CSS selector not found on page |
| `STORAGE_WRITE_FAILED` | storage | recoverable | Failed to write data to storage |
| `CONFIG_VALIDATION_FAILED` | configuration | user-action | Configuration validation failed |

## Error Classes

### LescaError (Base Class)

All errors extend `LescaError`:

```typescript
import { LescaError } from '@lesca/error'

try {
  throw new LescaError('CONFIG_LOAD_FAILED', 'Custom message', {
    context: { configPath: '/path/to/config.json' },
    cause: originalError,
  })
} catch (error) {
  if (error instanceof LescaError) {
    console.log(error.code)              // 'CONFIG_LOAD_FAILED'
    console.log(error.category)          // 'configuration'
    console.log(error.isRecoverable())   // false
    console.log(error.getResolution())   // Array of resolution steps
    console.log(error.getUserMessage())  // User-friendly message with hints
    console.log(error.toJSON())          // JSON representation for logging
  }
}
```

### Specialized Error Classes

```typescript
import {
  AuthError,
  NetworkError,
  StorageError,
  BrowserError,
  ScrapingError,
  ParsingError,
  ConfigError,
  SystemError,
} from '@lesca/error'

// Authentication error
throw new AuthError('AUTH_INVALID_CREDENTIALS', 'Session expired')

// Network error
throw new NetworkError('NET_TIMEOUT', 'Request timed out', {
  context: { url: 'https://leetcode.com/api' },
})

// Storage error
throw new StorageError('STORAGE_WRITE_FAILED', 'Disk full', {
  context: { path: '/data/problems' },
  cause: fsError,
})
```

## Error Recovery

### Retry with Exponential Backoff

```typescript
import { withRetry } from '@lesca/error'

const result = await withRetry(
  async () => {
    return await fetchDataFromAPI()
  },
  {
    maxAttempts: 5,
    initialDelay: 1000,      // 1 second
    backoffMultiplier: 2,    // 1s, 2s, 4s, 8s, 16s
    maxDelay: 30000,         // Cap at 30 seconds
    jitter: true,            // Add randomness to prevent thundering herd

    // Custom retry logic
    isRetryable: (error) => {
      return error instanceof NetworkError
    },

    // On retry callback
    onRetry: (attempt, error, delay) => {
      console.log(`Retry attempt ${attempt} after ${delay}ms`)
    },
  }
)
```

### Circuit Breaker

Prevents cascading failures by opening circuit after repeated failures:

```typescript
import { CircuitBreaker } from '@lesca/error'

const breaker = new CircuitBreaker(
  async () => {
    return await unstableOperation()
  },
  {
    failureThreshold: 5,     // Open after 5 failures
    resetTimeout: 60000,     // Try again after 1 minute
    successThreshold: 2,     // Close after 2 successes

    onStateChange: (state) => {
      console.log(`Circuit breaker is now: ${state}`)
      // States: 'closed', 'open', 'half-open'
    },
  }
)

try {
  const result = await breaker.execute()
} catch (error) {
  console.log(`Circuit state: ${breaker.getState()}`)
}
```

### Combined Retry + Circuit Breaker

```typescript
import { withRetryAndCircuitBreaker } from '@lesca/error'

const result = await withRetryAndCircuitBreaker(
  async () => {
    return await fetchData()
  },
  // Retry options
  {
    maxAttempts: 3,
    initialDelay: 1000,
  },
  // Circuit breaker options
  {
    failureThreshold: 5,
    resetTimeout: 60000,
  }
)
```

### Timeout

```typescript
import { withTimeout } from '@lesca/error'

try {
  const result = await withTimeout(
    longRunningOperation(),
    5000, // 5 second timeout
    'Operation took too long'
  )
} catch (error) {
  // Timeout error
}
```

## Usage Patterns

### Error Handling in Scrapers

```typescript
import { ScrapingError, withRetry } from '@lesca/error'

async function scrapeProblem(slug: string) {
  try {
    const html = await withRetry(() => fetchProblem(slug), {
      maxAttempts: 3,
    })

    const content = extractContent(html)

    if (!content) {
      throw new ScrapingError(
        'SCRAPE_CONTENT_EXTRACTION_FAILED',
        `Failed to extract content from problem: ${slug}`,
        { context: { slug, htmlLength: html.length } }
      )
    }

    return content
  } catch (error) {
    // Wrap unknown errors
    throw wrapError(error, 'SCRAPE_PROBLEM_NOT_FOUND', { slug })
  }
}
```

### Error Handling in Storage

```typescript
import { StorageError } from '@lesca/error'

async function saveProblem(slug: string, content: string) {
  try {
    await fs.writeFile(path, content)
  } catch (error) {
    throw new StorageError(
      'STORAGE_WRITE_FAILED',
      `Failed to save problem: ${slug}`,
      {
        cause: error as Error,
        context: { path, contentLength: content.length },
      }
    )
  }
}
```

### Error Handling in CLI

```typescript
import { LescaError, isLescaError } from '@lesca/error'

async function main() {
  try {
    await runScraper()
  } catch (error) {
    if (isLescaError(error)) {
      // Show user-friendly message
      console.error(error.getUserMessage())

      // Log full details in debug mode
      if (debugMode) {
        console.error(error.toJSON())
      }

      // Exit with appropriate code
      process.exit(error.isFatal() ? 1 : 0)
    } else {
      // Unknown error
      console.error('An unexpected error occurred:', error)
      process.exit(1)
    }
  }
}
```

## Best Practices

### 1. Always Use Specific Error Codes

❌ **Bad:**
```typescript
throw new Error('Authentication failed')
```

✅ **Good:**
```typescript
throw new AuthError('AUTH_INVALID_CREDENTIALS', 'Session expired')
```

### 2. Include Context

❌ **Bad:**
```typescript
throw new StorageError('STORAGE_WRITE_FAILED')
```

✅ **Good:**
```typescript
throw new StorageError('STORAGE_WRITE_FAILED', undefined, {
  context: {
    path: '/data/problems/two-sum.md',
    diskSpace: '100MB',
  },
})
```

### 3. Preserve Original Error

❌ **Bad:**
```typescript
try {
  await fs.writeFile(path, content)
} catch (error) {
  throw new StorageError('STORAGE_WRITE_FAILED')
}
```

✅ **Good:**
```typescript
try {
  await fs.writeFile(path, content)
} catch (error) {
  throw new StorageError('STORAGE_WRITE_FAILED', undefined, {
    cause: error as Error,
  })
}
```

### 4. Use Recovery Utilities

❌ **Bad:**
```typescript
async function fetchWithRetry() {
  for (let i = 0; i < 3; i++) {
    try {
      return await fetch()
    } catch (error) {
      if (i === 2) throw error
      await sleep(1000 * Math.pow(2, i))
    }
  }
}
```

✅ **Good:**
```typescript
const data = await withRetry(() => fetch(), {
  maxAttempts: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
})
```

## API Reference

See the TypeScript types for full API documentation. All exports are fully typed.

## Contributing

When adding new error codes:

1. Add the code to `codes.ts` with full metadata
2. Update error class type constraints in `errors.ts`
3. Add usage examples to this README
4. Update error code reference documentation

## License

MIT
