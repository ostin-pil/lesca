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
│   ├── browser-automation/ # Playwright driver + session/pool management
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

## Main Entry Points

- **CLI**: `packages/cli/src/index.ts` - Main command-line application entry point
- **Core**: `packages/core/src/index.ts` - Facade and orchestration layer
- **API Client**: `packages/api-client/src/index.ts` - GraphQL client
- **Auth**: `packages/auth/src/index.ts` - Authentication layer
- **Scrapers**: `packages/scrapers/src/index.ts` - Scraping strategies
- **Converters**: `packages/converters/src/index.ts` - Format converters
- **Storage**: `packages/storage/src/index.ts` - Storage adapters
- **Browser Automation**: `packages/browser-automation/src/index.ts` - Playwright driver, session & pool management

## Session Management

**Location**: `~/.lesca/sessions/` (configurable via `LESCA_SESSIONS_DIR` env var)

**Features**:

- Named, switchable sessions (e.g., `--session premium`, `--session free`)
- Persistent cookies, localStorage, sessionStorage
- Session metadata (created, lastUsed, expires, userAgent, description)
- Automatic expiration checking & cleanup
- Per-command session persistence via `--session-persist` flag

**Key Classes**:

- `SessionManager` - Create, retrieve, save, restore sessions
- `SessionPoolManager` - Hybrid per-session/global browser pool management

## Browser Pooling

**Configuration** (`browser.pool`):

- `enabled`: true (enable pooling)
- `strategy`: 'hybrid' (per-session by default, global fallback)
- `minSize`: 0 (minimum browsers to maintain)
- `maxSize`: 3 (max concurrent browsers per session)
- `maxIdleTime`: 300000 (5 minutes)
- `reusePages`: true (reuse contexts within browser)

**Pool Classes**:

- `BrowserPool` - Core pool management with acquire/release
- `SessionPoolManager` - Manages multiple pools + global fallback

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

**Linting**: ESLint with TypeScript and import plugins  
**Formatting**: Prettier code formatting  
**Type Checking**: Strict TypeScript mode (noUnusedLocals, noUnusedParameters, exactOptionalPropertyTypes)  
**Pre-commit Hooks**: Husky lint-staged (auto-fix TypeScript and format JSON/Markdown)  
**Path Aliases**: Configured via tsconfig.json (e.g., `@lesca/core`, `@/packages/*`)

## Configuration

**Primary Config File**: `lesca.config.yaml` (or `~/.lesca/config.yaml`)

**Configuration Sections**:

- `auth` - Cookie-based authentication, session timeout, auto-refresh
- `api` - GraphQL endpoint, timeouts, rate limiting
- `storage` - Filesystem/SQLite storage, output paths
- `output` - Format (markdown/obsidian/json), file patterns, image handling
- `scraping` - Strategies, concurrency, batch size, timeouts
- `processing` - Converters, enhancements (hints, code snippets, companies)
- `browser` - Headless/headed, viewport, session/pool configuration, retry logic
- `cache` - TTL per content type, memory size, compression
- `logging` - Level (debug/info/warn/error), console/file output
- `plugins` - Plugin system configuration

**Environment Variables** (all prefixed with `LESCA_`):

- `LESCA_AUTH_METHOD`, `LESCA_COOKIE_PATH`, `LESCA_SESSION_TIMEOUT`
- `LESCA_API_ENDPOINT`, `LESCA_API_TIMEOUT`, `LESCA_RATE_LIMIT_RPM`
- `LESCA_STORAGE_TYPE`, `LESCA_OUTPUT_PATH`, `LESCA_OUTPUT_FORMAT`
- `LESCA_BROWSER_HEADLESS`, `LESCA_SESSIONS_DIR`, etc.

**Default Paths**:

- Config: `./lesca.config.yaml`, `~/.lesca/config.yaml`
- Cookies: `~/.lesca/cookies.json` (legacy)
- Sessions: `~/.lesca/sessions/` (new)
- Cache: `~/.lesca/cache/`
- Logs: `~/.lesca/logs/`

## Architecture Patterns

**Facade Pattern** (Core): `LeetCodeScraper` orchestrates strategies, converters, and storage  
**Strategy Pattern** (Scrapers): Each strategy (Problem, List, Editorial, Discussion) implements `ScraperStrategy`  
**Singleton Pattern** (Config): `ConfigManager` provides single source of truth  
**Dependency Injection**: Strategies receive `GraphQLClient`, `BrowserDriver`, auth credentials  
**Pool Pattern** (Browser): `BrowserPool` manages reusable browser instances; `SessionPoolManager` manages per-session pools

## CLI Commands

**Main Commands**:

- `lesca scrape <problem>` - Scrape a single problem
- `lesca scrape-list <file>` - Scrape multiple problems from file
- `lesca scrape-editorial` - Scrape editorial content
- `lesca scrape-discussions` - Scrape discussions
- `lesca login [--session <name>]` - Authenticate with LeetCode
- `lesca search <keyword>` - Search for problems
- `lesca list [--difficulty]` - List problems with filters
- `lesca config` - Manage configuration
- `lesca auth` - Manage authentication
- `lesca session` - Manage browser sessions (list, delete, rename, info)

**Global Options**:

- `--config <path>` - Config file path
- `--verbose` - Verbose logging

---

## Project Documentation

- **AGENT_GUIDELINES.md** - Guidelines for AI agents contributing to the project
- **ARCHITECTURE_REVIEW.md** - System design and architecture decisions
- **CODING_STANDARDS.md** - Code style and conventions
- **TYPESCRIPT_GUIDE.md** - Type safety patterns

## Session & Browser Implementation

**Planning Document**: `.zencoder/rules/session_browser_implementation.md`

Covers:

- Named, switchable sessions with persistence
- Hybrid browser pooling strategy (per-session + global fallback)
- Dependency injection pattern for pool management
- Configuration integration
- CLI command updates
- Strategy-specific page lifecycle preferences
- Implementation checklist
