# Contributing to Lesca

Thank you for contributing to Lesca! This document provides guidelines to help maintain code quality and consistency.

## Important Documents

- **[Coding Standards](./docs/CODING_STANDARDS.md)** - Required reading for all contributors
- **[Testing Guide](./docs/TESTING.md)** - Testing infrastructure and best practices
- **[Architecture Review](./ARCHITECTURE_REVIEW.md)** - System design and patterns
- **[TypeScript Guide](./docs/TYPESCRIPT_GUIDE.md)** - TypeScript best practices

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/lesca.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development Workflow

### Before Making Changes

```bash
# Ensure everything builds
npm run build

# Run unit tests (fast)
npm test

# Run linter
npm run lint

# Check coverage (optional)
npm run test:coverage
```

### During Development

```bash
# Run in development mode
npm run dev

# Watch mode for TypeScript
npm run build -- --watch

# Run specific tests
npm test -- path/to/test.ts
```

### Before Committing

**Required checks** - All must pass:

```bash
# 1. TypeScript compilation
npm run build
# ✓ Should complete with 0 errors

# 2. Linting
npm run lint
# ✓ Should pass with no errors

# 3. Unit tests
npm test
# ✓ All unit tests should pass (< 30s)

# 4. Coverage check (optional but recommended)
npm run check-coverage
# ✓ Coverage should meet minimum thresholds
```

## TypeScript Guidelines

This project uses **strict TypeScript** configuration. Please review:

- **[TypeScript Best Practices Guide](docs/TYPESCRIPT_GUIDE.md)** - Comprehensive guide
- **[Quick Reference](docs/TYPESCRIPT_QUICK_REFERENCE.md)** - Fast lookup for common patterns

### Key Rules

1. **Array Access** - Always check for `undefined`:
   ```typescript
   const item = array[0]
   if (!item) throw new Error('Empty array')
   use(item)
   ```

2. **Optional Properties** - Use conditional assignment:
   ```typescript
   const config = {
     name: 'app',
     ...(port && { port }),
   }
   ```

3. **Union Types** - Use type guards:
   ```typescript
   if (request.type === 'problem') {
     console.log(request.titleSlug)  // Safe access
   }
   ```

4. **Error Handling** - Use LescaError correctly:
   ```typescript
   throw new LescaError('Message', 'ERROR_CODE', statusCode?, cause?)
   ```

## Code Style

### Formatting

We use Prettier for code formatting:

```bash
npm run format
```

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `problem-strategy.ts`)
- **Classes**: `PascalCase` (e.g., `ProblemScraperStrategy`)
- **Interfaces**: `PascalCase` (e.g., `ScraperStrategy`)
- **Functions/Variables**: `camelCase` (e.g., `executeStrategy`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- **Error Codes**: `UPPER_SNAKE_CASE` (e.g., `SCRAPING_FAILED`)

### File Structure

```
packages/
├── package-name/
│   └── src/
│       ├── index.ts          # Public API
│       ├── types.ts          # Type definitions (if needed)
│       └── feature.ts        # Implementation
shared/
├── types/                    # Shared types
└── utils/                    # Shared utilities
```

## Testing

### Test Types

Lesca uses a multi-tiered testing approach for speed and reliability:

| Type | Purpose | Speed | When to Run |
|------|---------|-------|-------------|
| **Unit** | Test individual functions/classes | Fast (< 30s) | Every commit/PR |
| **Integration** | Test cross-package workflows | Slow (30s+) | Before release |
| **Benchmarks** | Track performance | Varies | On-demand |

See [Testing Guide](./docs/TESTING.md) for comprehensive documentation.

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest'
import { createProblem } from '../../../tests/factories/problem-factory'

describe('FeatureName', () => {
  it('should do something specific', () => {
    // Arrange
    const input = createProblem({ difficulty: 'Easy' })

    // Act
    const result = doSomething(input)

    // Assert
    expect(result).toBe('expected')
  })
})
```

**Guidelines:**
- Use **factories** (`tests/factories/`) for dynamic test data
- Use **fixtures** (`tests/fixtures/`) for static reference data
- Follow Arrange-Act-Assert pattern
- Write descriptive test names
- Ensure tests are independent

### Running Tests

```bash
# Unit tests only (fast - run on every PR)
npm test
# or
npm run test:unit

# Integration tests only (slower - run on release)
npm run test:integration

# All tests (unit + integration)
npm run test:all

# Specific file
npm test -- path/to/test.ts

# Watch mode
npm run test:ui

# Coverage report
npm run test:coverage

# Validate coverage thresholds
npm run check-coverage

# Performance benchmarks
npm run benchmark
```

### Coverage Requirements

New code should maintain or improve coverage:

- **Critical packages** (api-client, auth, scrapers): 90%+
- **Core packages** (core, converters, storage): 80%+
- **Shared modules**: 80%+

Check coverage:
```bash
npm run test:coverage
npm run check-coverage
```

## Pull Request Process

1. **Update Documentation** - If you add/change features, update relevant docs
2. **Add Tests** - New features should include tests
3. **Pass All Checks** - Ensure build, lint, and tests pass
4. **Write Clear Commits** - Use descriptive commit messages
5. **Update CHANGELOG** - Add entry to CHANGELOG.md (if applicable)

### Commit Message Format

```
type(scope): brief description

Longer description if needed.

Fixes #123
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:
```
feat(scrapers): add support for discussion scraping
fix(cli): handle undefined options in batch mode
docs(typescript): add guide for strict mode compliance
```

## Common Issues

### TypeScript Errors

If you encounter TypeScript errors:

1. Check the [TypeScript Guide](docs/TYPESCRIPT_GUIDE.md)
2. Look up the error code in the Quick Reference
3. Run `npm run build` to see all errors
4. Fix errors systematically from top to bottom

### Build Errors

```bash
# Clean build artifacts
rm -rf dist

# Reinstall dependencies
rm -rf node_modules
npm install

# Try build again
npm run build
```

## Project Structure

```
lesca/
├── packages/              # Main packages
│   ├── api-client/       # GraphQL client
│   ├── auth/             # Authentication
│   ├── browser-automation/ # Playwright driver
│   ├── cli/              # CLI interface
│   ├── converters/       # HTML to Markdown
│   ├── core/             # Core scraping logic
│   ├── scrapers/         # Scraping strategies
│   └── storage/          # Storage adapters
├── shared/               # Shared code
│   ├── types/           # TypeScript types
│   └── utils/           # Utilities
├── docs/                # Documentation
├── tests/               # Integration tests
└── examples/            # Usage examples
```

## Architecture Principles

### Strategy Pattern

Each scraper implements the `ScraperStrategy` interface:

```typescript
interface ScraperStrategy {
  name: string
  priority: number
  canHandle(request: ScrapeRequest): boolean
  execute(request: ScrapeRequest): Promise<RawData>
}
```

### Converter Pattern

Converters transform data between formats:

```typescript
interface Converter {
  from: ContentFormat
  to: ContentFormat
  canConvert(data: unknown): boolean
  convert(input: unknown, options?: ConverterOptions): Promise<unknown>
}
```

### Error Handling

Use `LescaError` for domain errors:

```typescript
throw new LescaError(
  'User-friendly message',
  'ERROR_CODE',
  statusCode,      // optional
  originalError    // optional
)
```

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Review existing documentation in `/docs`

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
