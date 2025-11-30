# Create New Test File

Scaffold a new test file following Lesca testing patterns.

## Arguments

- `$ARGUMENTS` - Required: path to the source file to test (e.g., `packages/core/src/scraper.ts`)

## Steps

1. Read the source file to understand what needs testing
2. Read an existing test in the same package for style reference
3. Create test file at the appropriate `__tests__/` location

## Test File Requirements

Use this structure:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
// Import the module under test
// Import factories from tests/factories/ for test data

describe('ClassName', () => {
  let instance: ClassName

  beforeEach(() => {
    vi.clearAllMocks()
    instance = new ClassName()
  })

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = createTestData()

      // Act
      const result = instance.methodName(input)

      // Assert
      expect(result).toBe(expected)
    })

    it('should throw on invalid input', () => {
      expect(() => instance.methodName(null)).toThrow()
    })
  })
})
```

## Requirements

- Use factories from `tests/factories/` for test data
- Follow Arrange-Act-Assert pattern
- Test happy path, error cases, and edge cases
- Mock external dependencies with `vi.fn()`
- No `any` types in tests
