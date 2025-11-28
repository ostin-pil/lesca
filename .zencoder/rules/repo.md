---
description: Repository Information Overview
alwaysApply: true
---

# Lesca - LeetCode Scraper Architecture

## Summary

Lesca is a modular TypeScript-based monorepo for scraping LeetCode content (problems, editorials, discussions, lists) and exporting to Markdown/Obsidian formats. Version 0.1.0 MVP with comprehensive test coverage (631 tests, 68.43%), designed with clean separation of concerns through independent packages and shared utilities.

## Repository Structure

```
lesca/
├── packages/          # Core application packages
│   ├── cli/          # Command-line interface entry point
│   ├── core/         # Facade and orchestration layer
│   ├── auth/         # Cookie-based authentication
│   ├── api-client/   # GraphQL client with rate limiting
│   ├── browser-automation/ # Playwright driver
│   ├── scrapers/     # Strategy pattern scrapers (Problem, List, Editorial, Discussion)
│   ├── converters/   # HTML to Markdown/Obsidian converters
│   └── storage/      # Filesystem and SQLite storage adapters
├── shared/           # Shared utilities
│   ├── types/        # Shared TypeScript interfaces
│   ├── config/       # YAML/JSON configuration system
│   ├── error/        # Centralized error definitions
│   └── utils/        # Caching, logging, utility functions
├── docs/             # User and developer documentation
├── tests/            # Integration tests, benchmarks, fixtures
└── examples/         # Example configuration files
```

## Language & Runtime

**Language**: TypeScript 5.3  
**Runtime**: Node.js >= 18.0.0, npm >= 9.0.0  
**Module System**: ES Modules  
**Build System**: TypeScript compiler + tsc-alias for path aliases  
**Package Manager**: npm workspaces

## Dependencies

**Main Dependencies**:

- **playwright** (^1.56.1) - Browser automation for dynamic content
- **commander** (^11.1.0) - CLI framework
- **yaml** (^2.3.4) - YAML configuration parsing
- **zod** (^3.22.4) - Schema validation
- **turndown** (^7.1.2) - HTML to Markdown conversion
- **lodash-es** (^4.17.21) - Utility library
- **chalk** (^5.3.0) - Terminal colors
- **ora** (^8.0.1) - Progress spinners
- **cli-progress** (^3.12.0) - Progress bars
- **p-throttle** (^6.1.0) - Rate limiting
- **inquirer** (^9.2.12) - Interactive CLI prompts
- **glob** (^13.0.0) - File pattern matching

**Development Dependencies**:

- **vitest** (^1.1.0) - Unit testing framework
- **eslint** (^8.56.0) + @typescript-eslint - Linting
- **prettier** (^3.1.1) - Code formatting
- **tsx** (^4.7.0) - TypeScript executor
- **@vitest/ui** & **@vitest/coverage-v8** - Test UI and coverage

## Build & Installation

```bash
npm install
npm run build           # Build all packages (tsc + tsc-alias)
npm run dev            # Development mode with watch
npm run typecheck      # Type checking without emit
npm run lint           # Lint codebase
npm run lint:fix       # Auto-fix lint issues
npm run format         # Code formatting with Prettier
```

## Docker

**Dockerfile**: `/home/pil/lesca/Dockerfile` (Note: Uses Python 3.11 - appears to be legacy; primary app is TypeScript)

## Main Entry Points

- **CLI**: `packages/cli/src/index.ts` - Main command-line application entry point
- **Core**: `packages/core/src/index.ts` - Facade and orchestration layer
- **API Client**: `packages/api-client/src/index.ts` - GraphQL client
- **Auth**: `packages/auth/src/index.ts` - Authentication layer
- **Scrapers**: `packages/scrapers/src/index.ts` - Scraping strategies
- **Converters**: `packages/converters/src/index.ts` - Format converters
- **Storage**: `packages/storage/src/index.ts` - Storage adapters

## Testing

**Framework**: Vitest 1.1.0 with v8 coverage provider  
**Test Locations**: `packages/*/src/__tests__/`, `shared/*/src/__tests__/`, `tests/integration/`  
**Naming Convention**: `*.test.ts` files  
**Coverage**: 631 tests, 68.43% overall coverage

**Test Suites**:

- **Unit Tests** (`npm run test:unit`) - Fast tests (< 30s), run on every PR
- **Integration Tests** (`npm run test:integration`) - End-to-end tests, run on release
- **Benchmarks** (`npm run benchmark`) - Performance tracking

**Configuration Files**:

- `vitest.config.ts` - Base configuration
- `vitest.unit.config.ts` - Unit test config (excludes integration tests)
- `vitest.integration.config.ts` - Integration test config

**Run Commands**:

```bash
npm test                    # Run unit tests (default)
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:all           # Unit + integration tests
npm run test:coverage      # With coverage report
npm run test:ui            # Watch mode with UI
npm run check-coverage     # Validate coverage thresholds
npm run benchmark          # Run performance benchmarks
```

## Code Quality

**Linting**: ESLint with TypeScript and import plugins, Prettier code formatting  
**Type Checking**: Strict TypeScript mode enabled (noUnusedLocals, noUnusedParameters, exactOptionalPropertyTypes)  
**Pre-commit Hooks**: Husky lint-staged (auto-fix TypeScript and format JSON/Markdown files)  
**Path Aliases**: Configured via tsconfig.json (e.g., `@lesca/core`, `@/packages/*`)

## Configuration

Environment variables and YAML configuration in `lesca.config.yaml`. Example environment file at `.env` with LeetCode session cookies and output directory settings.
