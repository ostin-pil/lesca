# Lesca: Stability to v1.0.0 Implementation Plan

## Executive Summary

This document outlines the comprehensive implementation plan for taking Lesca from v0.1.0 (MVP Complete) to v1.0.0 (Stable Production Release). The plan combines immediate stability priorities with medium-term feature development, creating a cohesive roadmap spanning approximately 8-12 weeks.

**Current State:** v0.1.0 - MVP Complete
- 631 passing tests (68.43% coverage)
- Zero TypeScript/ESLint errors
- 9 packages, ~15,000 lines of code
- Core functionality working

**Recent Improvements (Nov 2025):**
- ✅ Import refactoring: removed .js extensions, using @ path aliases
- ✅ CLI refactored to modular command structure
- ✅ New `config` command with list/get/path subcommands
- ✅ Browser fallback functionality in problem scraper
- ✅ Integration tests for core workflows
- ✅ Refactoring automation scripts created

**Target State:** v1.0.0 - Production Stable
- 90%+ test coverage with comprehensive integration tests
- Production-ready CI/CD pipeline
- Plugin system for extensibility
- Advanced features (quality scoring, SQLite, Web UI)
- npm package published
- Complete documentation

---

## Timeline Overview

```
v0.1.0 (Current)  v0.2.0 (Stable)  v0.3.0 (Extended)  v1.0.0 (Production)
                                                             
  Week 0           Week 3-4           Week 6-7            Week 10-12
```

---

## Phase 1: Stability & Testing (v0.1.0  v0.2.0)
**Duration:** 3-4 weeks
**Goal:** Production-ready foundation with comprehensive testing

### 1.1 Browser Automation Completion (Week 1-2)
**Estimated Effort:** 5-7 days
**Priority:** High

#### Current State
- Basic Playwright integration exists
- Cookie management partially implemented
- Needs production hardening

#### Tasks

**1.1.1 Core Browser Features**
- [ ] **Session Management**
  - Persistent browser contexts
  - Session restoration
  - Multiple account support
  - Files: `packages/browser/src/session-manager.ts`

- [ ] **Cookie Management**
  - Auto-save cookies after login
  - Cookie refresh logic
  - Cookie validation before use
  - Files: `packages/browser/src/cookie-manager.ts`

- [ ] **Request Interception**
  - Block unnecessary resources (images, fonts, ads)
  - Capture API responses
  - Inject custom headers
  - Files: `packages/browser/src/interceptor.ts`

- [ ] **Error Handling**
  - Graceful browser crash recovery
  - Timeout handling with retries
  - Network error detection
  - Files: `packages/browser/src/error-handler.ts`

**1.1.2 Authentication Flow**
- [ ] **Login Helper**
  - Interactive login prompt
  - Save credentials securely (keytar?)
  - Auto-login on session expiry
  - Files: `packages/browser/src/auth.ts`

- [ ] **Premium Content Detection**
  - Detect locked content
  - Graceful fallback for non-premium users
  - Clear error messages

**1.1.3 Performance Optimization**
- [ ] **Browser Pooling**
  - Reuse browser instances
  - Lazy initialization
  - Proper cleanup on exit
  - Files: `packages/browser/src/pool.ts`

- [ ] **Headless Mode**
  - Default to headless for performance
  - Optional headed mode for debugging
  - Configuration option: `browser.headless`

**Acceptance Criteria:**
- ✓ Login flow works reliably
- ✓ Cookies persist across sessions
- ✓ Browser cleanup has no memory leaks
- ✓ Works in both headed and headless modes
- ✓ Graceful degradation when browser unavailable

---

### 1.2 Error Handling & Logging Audit (Week 2-3)
**Estimated Effort:** 4-5 days
**Priority:** High

#### Objectives
- Comprehensive error handling across all packages
- Structured logging with appropriate levels
- User-friendly error messages

#### Tasks

**1.2.1 Error Handling Standards**
- [ ] **Error Code System**
  - Audit all LescaError usage
  - Ensure consistent error codes
  - Document all error codes
  - Files: `shared/error/src/codes.ts`

- [ ] **Error Recovery**
  - Identify recoverable vs. fatal errors
  - Implement retry logic where appropriate
  - Add circuit breakers for external calls
  - Files: `shared/error/src/recovery.ts`

- [ ] **Error Context**
  - Ensure all errors include context
  - Add stack trace preservation
  - Include debugging hints
  - Files: Update all `throw new LescaError()` calls

**1.2.2 Logging Infrastructure**
- [ ] **Structured Logging**
  - Implement logging levels (DEBUG, INFO, WARN, ERROR)
  - Add structured log format (JSON for production)
  - Include correlation IDs for request tracking
  - Files: `shared/utils/src/logger.ts`

- [ ] **Log Outputs**
  - Console logging with colors (development)
  - File logging (production)
  - Log rotation
  - Configuration: `logging.level`, `logging.output`

- [ ] **Sensitive Data**
  - Audit for credential logging
  - Redact sensitive information
  - Add data sanitization utilities
  - Files: `shared/utils/src/sanitizer.ts`

**1.2.3 User Experience**
- [ ] **Error Messages**
  - User-friendly error descriptions
  - Actionable error messages
  - Link to troubleshooting docs
  - Example: "Failed to scrape problem 'two-sum'. Check your network connection or try again later. See: docs/TROUBLESHOOTING.md#network-errors"

- [ ] **Debug Mode**
  - `--debug` flag for verbose output
  - Include timing information
  - Show stack traces in debug mode

**Acceptance Criteria:**
- ✓ All errors use LescaError with codes
- ✓ Logging implemented across all packages
- ✓ No sensitive data in logs
- ✓ Error messages are user-friendly
- ✓ Debug mode provides useful information

---

### 1.3 Test Coverage Expansion (Week 1-2)
**Estimated Effort:** 8-10 days
**Priority:** Critical

#### Objectives
- Increase test coverage from 73.66% to 90%+
- Add integration tests for end-to-end workflows
- Ensure all edge cases are covered

#### Tasks

**1.3.1 Package-Level Unit Tests**
- [ ] **@lesca/core** - Complete scraper orchestration tests
  - Test batch processing with multiple problems
  - Test error recovery scenarios
  - Test rate limiting enforcement
  - Test cache integration
  - Target: 95% coverage
  - Files: `packages/core/src/__tests__/scraper.test.ts`

- [ ] **@lesca/scrapers** - Complete all scraper strategy tests
  - Editorial scraper: error handling, content parsing edge cases
  - Discussion scraper: sorting, filtering, pagination
  - List scraper: bulk operations, partial failures
  - Problem scraper: various difficulty levels, premium content
  - Target: 92% coverage
  - Files: `packages/scrapers/src/__tests__/*.test.ts`

- [ ] **@lesca/converters** - Complete converter tests
  - HTML to Markdown: complex HTML structures, nested elements
  - Obsidian converter: wikilinks, backlinks, tags, frontmatter
  - Enhancement manager: all enhancer types
  - Target: 90% coverage
  - Files: `packages/converters/src/__tests__/*.test.ts`

- [ ] **@lesca/storage** - Complete storage adapter tests
  - Filesystem adapter: permissions, concurrent writes
  - Error scenarios: disk full, invalid paths
  - Target: 95% coverage
  - Files: `packages/storage/src/__tests__/*.test.ts`

- [ ] **@lesca/browser** - Browser automation tests
  - Cookie persistence and loading
  - Network interception
  - Error recovery (timeout, navigation failures)
  - Resource cleanup
  - Target: 88% coverage
  - Files: `packages/browser/src/__tests__/*.test.ts`

- [ ] **@lesca/cli** - CLI command tests
  - All command execution paths
  - Configuration validation
  - Error messaging
  - Target: 85% coverage
  - Files: `packages/cli/src/__tests__/*.test.ts`

**1.3.2 Integration Tests** (Week 2)
Create new test suite: `tests/integration/`

- [ ] **End-to-End Workflows**
  ```
  tests/integration/
  ├── e2e-single-problem.test.ts    # Scrape single problem to Obsidian
  ├── e2e-batch-scraping.test.ts    # Batch scrape multiple problems
  ├── e2e-list-scraping.test.ts     # Scrape problem list
  ├── e2e-with-browser.test.ts      # Browser automation workflow
  └── e2e-cache-persistence.test.ts # Cache across sessions
  ```

- [ ] **Cross-Package Integration**
  - Scraper  Converter  Storage pipeline
  - CLI  Core  Scrapers flow
  - Browser  Scrapers  Cache flow
  - Config  All packages validation

- [ ] **Error Recovery Scenarios**
  - Network failures during scraping
  - Partial batch failures
  - Invalid HTML content
  - Storage write failures
  - Browser crashes

**1.3.3 Test Infrastructure Improvements**
- [ ] Add test fixtures and factories
  - Sample LeetCode HTML responses
  - Mock problem data generators
  - Reusable test utilities
  - Files: `tests/fixtures/`, `tests/factories/`

- [ ] Add performance benchmarks
  - Scraping speed benchmarks
  - Conversion performance tests
  - Memory usage tests
  - Files: `tests/benchmarks/`

- [ ] Improve test reporting
  - Coverage visualization
  - Test execution time tracking
  - Failed test debugging aids

**Acceptance Criteria:**
- ✓ Overall test coverage ≥ 90%
- ✓ All packages have ≥ 85% coverage
- ✓ At least 10 integration tests passing
- ✓ Zero flaky tests
- ✓ Test suite completes in < 60 seconds

---

### 1.4 CI/CD Pipeline (Week 3)
**Estimated Effort:** 3-4 days
**Priority:** High

#### Tasks

**1.4.1 GitHub Actions Workflows**
Create `.github/workflows/`:

- [ ] **CI Workflow** (`ci.yml`)
  ```yaml
  - Lint (ESLint, Prettier)
  - Type check (tsc --noEmit)
  - Unit tests (npm test)
  - Integration tests
  - Coverage report (upload to Codecov)
  - Build all packages
  - Runs on: push, pull_request
  ```

- [ ] **Release Workflow** (`release.yml`)
  ```yaml
  - Version bump
  - Build all packages
  - Run full test suite
  - Create GitHub release
  - Publish to npm
  - Create binaries (Linux, macOS, Windows)
  - Upload release artifacts
  - Runs on: tag push (v*.*.*)
  ```

- [ ] **Dependency Updates** (`dependencies.yml`)
  ```yaml
  - Dependabot configuration
  - Auto-merge patch updates
  - Weekly dependency audits
  ```

**1.4.2 Pre-commit Hooks**
- [ ] **Husky Setup**
  - Pre-commit: lint-staged (lint + format)
  - Pre-push: type check + tests
  - Commit-msg: conventional commit validation

**1.4.3 Release Process**
- [ ] **Versioning Strategy**
  - Semantic versioning (semver)
  - Changelog generation (conventional-changelog)
  - Tag-based releases

- [ ] **Documentation**
  - Document release process in CONTRIBUTING.md
  - Create release checklist

**Acceptance Criteria:**
- ✓ CI runs on all PRs
- ✓ All checks must pass before merge
- ✓ Releases are automated
- ✓ Pre-commit hooks prevent bad commits
- ✓ Coverage reports uploaded to Codecov

---

### 1.5 npm Package Publication (Week 3-4)
**Estimated Effort:** 2-3 days
**Priority:** Medium

#### Tasks

- [ ] **Package Configuration**
  - Set up npm organization (@lesca)
  - Configure package.json for publishing
  - Add .npmignore files
  - Set up public access

- [ ] **Documentation for npm**
  - Improve README.md for npm listing
  - Add usage examples
  - Add badges (version, downloads, coverage, build status)

- [ ] **Publishing Process**
  - Test publish to npm (dry run)
  - Publish v0.2.0 to npm
  - Verify package installation
  - Test global CLI installation

- [ ] **Binary Releases**
  - Use pkg or @vercel/ncc to create binaries
  - Build for Linux, macOS, Windows
  - Upload to GitHub releases
  - Add installation instructions

**Acceptance Criteria:**
- ✓ Package published to npm
- ✓ `npm install -g @lesca/cli` works
- ✓ Binaries available for major platforms
- ✓ Installation docs updated

---

## Phase 2: Extension & Advanced Features (v0.2.0  v0.3.0)
**Duration:** 3-4 weeks
**Goal:** Extensibility and advanced functionality

### 2.1 Plugin System & Hooks (Week 4-6)
**Estimated Effort:** 10-12 days
**Priority:** High

#### Objectives
- Allow users to extend Lesca with custom functionality
- Provide hooks at key points in the scraping pipeline
- Enable third-party scrapers, converters, and enhancers

#### Architecture

**Plugin Types:**
1. **Scraper Plugins** - Custom scraping strategies
2. **Converter Plugins** - Custom output formats
3. **Enhancer Plugins** - Custom content enhancements
4. **Storage Plugins** - Custom storage backends
5. **Middleware Plugins** - Request/response modification

**Hook Points:**
```typescript
// Before/after scraping
hooks.beforeScrape(problem)
hooks.afterScrape(problem, content)

// Before/after conversion
hooks.beforeConvert(content)
hooks.afterConvert(markdown)

// Before/after storage
hooks.beforeStore(markdown, metadata)
hooks.afterStore(result)

// Error handling
hooks.onError(error, context)
```

#### Implementation

**2.1.1 Plugin Infrastructure** (Week 4)
- [ ] **Plugin Manager**
  ```typescript
  // packages/core/src/plugin-manager.ts
  interface Plugin {
    name: string;
    version: string;
    type: PluginType;
    init(context: PluginContext): Promise<void>;
    destroy(): Promise<void>;
  }

  class PluginManager {
    register(plugin: Plugin): void;
    unregister(name: string): void;
    execute(hook: HookName, data: any): Promise<any>;
  }
  ```

- [ ] **Plugin Discovery**
  - Load from `plugins/` directory
  - Load from npm packages (`@lesca/plugin-*`)
  - Configuration: `plugins: ['./plugins/my-plugin', '@lesca/plugin-example']`

- [ ] **Plugin Context**
  - Provide access to config
  - Provide logger instance
  - Provide cache instance
  - Type-safe context per plugin type

**2.1.2 Hook System** (Week 5)
- [ ] **Hook Registry**
  ```typescript
  // packages/core/src/hooks.ts
  interface Hook {
    name: string;
    priority: number;
    handler: (data: any) => Promise<any>;
  }

  class HookRegistry {
    register(hookName: string, handler: Hook): void;
    execute(hookName: string, data: any): Promise<any>;
    clear(hookName: string): void;
  }
  ```

- [ ] **Standard Hooks**
  - Define all hook points in scraping pipeline
  - Document hook signatures
  - Add hook execution to scraper flow

**2.1.3 Plugin Examples** (Week 6)
Create example plugins to demonstrate usage:

- [ ] **@lesca/plugin-notion**
  - Converter plugin for Notion format
  - Files: `plugins/notion/`

- [ ] **@lesca/plugin-anki**
  - Converter plugin for Anki flashcards
  - Files: `plugins/anki/`

- [ ] **@lesca/plugin-analytics**
  - Middleware plugin for usage tracking
  - Files: `plugins/analytics/`

**2.1.4 Plugin Documentation** (Week 6)
- [ ] **Plugin Development Guide**
  - Create docs/PLUGIN_DEVELOPMENT.md
  - Tutorial: building a simple plugin
  - API reference for plugin types
  - Best practices

- [ ] **Plugin Registry**
  - Create list of official plugins
  - Community plugin guidelines
  - Plugin submission process

**Acceptance Criteria:**
- ✓ Plugin system supports all 5 plugin types
- ✓ At least 3 example plugins working
- ✓ Hooks execute at correct points
- ✓ Plugin errors don't crash main app
- ✓ Documentation complete

---

### 2.2 Quality Scoring for Discussions (Week 5-6)
**Estimated Effort:** 6-8 days
**Priority:** Medium

#### Objectives
- Automatically score discussion quality
- Filter low-quality discussions
- Sort discussions by quality + votes

#### Scoring Algorithm

**Quality Factors:**
1. **Content Quality** (40%)
   - Has code examples (+15)
   - Has explanation (+10)
   - Length > 200 words (+10)
   - Proper formatting (+5)

2. **Engagement** (30%)
   - Upvotes (scaled 0-30)
   - Comments count (bonus +5 if > 10)
   - Author reputation (if available)

3. **Recency** (20%)
   - Newer discussions boosted
   - Time decay function

4. **Relevance** (10%)
   - Matches problem tags
   - Language preference match

**Score Range:** 0-100

#### Implementation

**2.2.1 Scoring Engine** (Week 5)
- [ ] **Quality Analyzer**
  ```typescript
  // packages/scrapers/src/quality-scorer.ts
  interface QualityScore {
    overall: number;        // 0-100
    content: number;        // 0-40
    engagement: number;     // 0-30
    recency: number;        // 0-20
    relevance: number;      // 0-10
    breakdown: ScoreBreakdown;
  }

  class QualityScorer {
    score(discussion: Discussion): QualityScore;
    filter(discussions: Discussion[], minScore: number): Discussion[];
    sort(discussions: Discussion[]): Discussion[];
  }
  ```

- [ ] **Content Analyzer**
  - Detect code blocks
  - Analyze explanation quality
  - Check formatting
  - Calculate complexity score

- [ ] **Engagement Metrics**
  - Parse vote counts
  - Parse comment counts
  - Calculate engagement score

**2.2.2 Integration** (Week 6)
- [ ] **Discussion Scraper Update**
  - Add quality scoring to discussion scraper
  - Store scores in metadata
  - Apply filtering based on config
  - Configuration: `discussion.minQualityScore`

- [ ] **Converter Integration**
  - Include quality score in Obsidian frontmatter
  - Add quality badge to markdown
  - Sort by quality in output

**2.2.3 Configuration** (Week 6)
- [ ] **Quality Settings**
  ```typescript
  discussion: {
    minQualityScore: 50,        // Filter threshold
    sortBy: 'quality',          // 'quality' | 'votes' | 'date'
    qualityWeights: {           // Custom weights
      content: 0.4,
      engagement: 0.3,
      recency: 0.2,
      relevance: 0.1
    }
  }
  ```

- [ ] **Scoring Customization**
  - Allow users to adjust weights
  - Custom scoring plugins
  - Disable scoring if needed

**2.2.4 Testing & Validation** (Week 6)
- [ ] **Test with Real Data**
  - Scrape sample discussions
  - Validate scoring algorithm
  - Tune thresholds

- [ ] **Performance Testing**
  - Ensure scoring doesn't slow scraping
  - Optimize analyzer performance

**Acceptance Criteria:**
- ✓ Quality scoring implemented
- ✓ Scoring accuracy validated
- ✓ Configuration options working
- ✓ Performance impact < 10%
- ✓ Documentation updated

---

### 2.3 SQLite Storage Adapter (Week 6-7)
**Estimated Effort:** 6-8 days
**Priority:** Medium

#### Objectives
- Provide database storage option
- Enable advanced querying
- Support metadata indexing
- Better performance for large collections

#### Schema Design

```sql
-- Problems table
CREATE TABLE problems (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  difficulty TEXT,
  content TEXT,
  metadata JSON,
  scraped_at DATETIME,
  updated_at DATETIME
);

-- Editorials table
CREATE TABLE editorials (
  id INTEGER PRIMARY KEY,
  problem_id INTEGER,
  content TEXT,
  metadata JSON,
  scraped_at DATETIME,
  FOREIGN KEY (problem_id) REFERENCES problems(id)
);

-- Discussions table
CREATE TABLE discussions (
  id INTEGER PRIMARY KEY,
  problem_id INTEGER,
  discussion_id TEXT UNIQUE,
  title TEXT,
  content TEXT,
  votes INTEGER,
  quality_score REAL,
  metadata JSON,
  scraped_at DATETIME,
  FOREIGN KEY (problem_id) REFERENCES problems(id)
);

-- Tags table (many-to-many)
CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE problem_tags (
  problem_id INTEGER,
  tag_id INTEGER,
  PRIMARY KEY (problem_id, tag_id),
  FOREIGN KEY (problem_id) REFERENCES problems(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

-- Indexes
CREATE INDEX idx_problems_slug ON problems(slug);
CREATE INDEX idx_problems_difficulty ON problems(difficulty);
CREATE INDEX idx_discussions_problem ON discussions(problem_id);
CREATE INDEX idx_discussions_quality ON discussions(quality_score);
```

#### Implementation

**2.3.1 SQLite Adapter** (Week 6)
- [ ] **Storage Adapter Implementation**
  ```typescript
  // packages/storage/src/adapters/sqlite-adapter.ts
  class SQLiteStorageAdapter implements StorageAdapter {
    constructor(dbPath: string);

    async save(data: ScrapedData): Promise<void>;
    async get(slug: string): Promise<ScrapedData | null>;
    async list(filter?: Filter): Promise<ScrapedData[]>;
    async delete(slug: string): Promise<void>;
    async search(query: SearchQuery): Promise<ScrapedData[]>;

    // Database-specific methods
    async query(sql: string, params?: any[]): Promise<any[]>;
    async migrate(): Promise<void>;
  }
  ```

- [ ] **Database Setup**
  - Use better-sqlite3 or sqlite3 npm package
  - Connection pooling
  - Transaction support
  - Files: `packages/storage/src/adapters/sqlite-adapter.ts`

**2.3.2 Migrations** (Week 6)
- [ ] **Migration System**
  ```typescript
  // packages/storage/src/migrations/
  ├── 001_initial_schema.sql
  ├── 002_add_quality_scores.sql
  └── migration-runner.ts
  ```

- [ ] **Version Tracking**
  - Track applied migrations
  - Rollback support
  - Migration validation

**2.3.3 Query Builder** (Week 7)
- [ ] **Type-Safe Queries**
  ```typescript
  // packages/storage/src/query-builder.ts
  const query = new QueryBuilder()
    .from('problems')
    .where('difficulty', '=', 'Hard')
    .where('quality_score', '>', 70)
    .orderBy('scraped_at', 'DESC')
    .limit(10);
  ```

- [ ] **Advanced Queries**
  - Full-text search
  - Tag filtering
  - Date range queries
  - Aggregations

**2.3.4 CLI Integration** (Week 7)
- [ ] **New CLI Commands**
  - `lesca db init` - Initialize database
  - `lesca db migrate` - Run migrations
  - `lesca db query` - Run custom queries
  - `lesca db export` - Export to filesystem

- [ ] **Configuration**
  ```typescript
  storage: {
    type: 'sqlite',  // 'filesystem' | 'sqlite'
    sqlite: {
      path: './lesca.db',
      enableWAL: true
    }
  }
  ```

**2.3.5 Testing** (Week 7)
- [ ] **Unit Tests**
  - CRUD operations
  - Query builder
  - Migrations

- [ ] **Integration Tests**
  - End-to-end with SQLite
  - Performance comparisons
  - Data integrity

**Acceptance Criteria:**
- ✓ SQLite adapter working
- ✓ Migrations system implemented
- ✓ Query builder functional
- ✓ CLI commands added
- ✓ Tests passing
- ✓ Documentation updated

---

## Phase 3: Web UI & Polish (v0.3.0  v1.0.0)
**Duration:** 3-4 weeks
**Goal:** Production release with optional web UI

### 3.1 Web UI (Optional) (Week 8-10)
**Estimated Effort:** 12-15 days
**Priority:** Low-Medium

#### Objectives
- Provide graphical interface for non-CLI users
- Browse scraped content
- Manage scraping jobs
- View statistics

#### Technology Stack
- **Frontend:** React + TypeScript
- **Styling:** Tailwind CSS
- **State:** Zustand or React Context
- **API:** Express.js REST API
- **Build:** Vite

#### Features

**3.1.1 Core UI** (Week 8-9)
- [ ] **Problem Browser**
  - List all scraped problems
  - Filter by difficulty, tags, status
  - Search functionality
  - Preview content

- [ ] **Scraping Management**
  - Start scraping jobs
  - View scraping progress
  - Job history
  - Error logs

- [ ] **Configuration**
  - Edit config via UI
  - Save/load config profiles
  - Validation with helpful errors

- [ ] **Statistics Dashboard**
  - Total problems scraped
  - Coverage by difficulty/tag
  - Storage usage
  - Charts and graphs

**3.1.2 Backend API** (Week 9)
- [ ] **REST API**
  ```typescript
  // packages/api/src/server.ts
  GET    /api/problems              - List problems
  GET    /api/problems/:slug        - Get problem details
  POST   /api/scrape                - Start scraping job
  GET    /api/jobs                  - List jobs
  GET    /api/jobs/:id              - Get job status
  DELETE /api/jobs/:id              - Cancel job
  GET    /api/config                - Get config
  PUT    /api/config                - Update config
  GET    /api/stats                 - Get statistics
  ```

- [ ] **WebSocket Support**
  - Real-time scraping progress
  - Job completion notifications
  - Error notifications

**3.1.3 Implementation** (Week 8-10)
- [ ] **Project Setup**
  ```
  packages/web/
  ├── client/              # React frontend
  │   ├── src/
  │   │   ├── components/
  │   │   ├── pages/
  │   │   ├── hooks/
  │   │   ├── api/
  │   │   └── App.tsx
  │   └── package.json
  └── server/              # Express backend
      ├── src/
      │   ├── routes/
      │   ├── controllers/
      │   ├── middleware/
      │   └── server.ts
      └── package.json
  ```

- [ ] **Development Setup**
  - Vite dev server for frontend
  - Nodemon for backend
  - Proxy API calls in development
  - Hot module replacement

- [ ] **Production Build**
  - Bundle frontend assets
  - Serve static files from Express
  - Optimize bundle size
  - Add service worker (PWA)

**3.1.4 CLI Integration** (Week 10)
- [ ] **Web Server Command**
  - `lesca serve` - Start web UI
  - `lesca serve --port 3000` - Custom port
  - `lesca serve --open` - Auto-open browser

- [ ] **Configuration**
  ```typescript
  web: {
    enabled: true,
    port: 3000,
    host: 'localhost',
    auth: {
      enabled: false,
      username: '',
      password: ''
    }
  }
  ```

**Acceptance Criteria:**
- ✓ Web UI accessible and functional
- ✓ All core features working
- ✓ API documented
- ✓ Responsive design
- ✓ Basic authentication optional

---

### 3.2 Documentation & Polish (Week 11-12)
**Estimated Effort:** 6-8 days
**Priority:** High

#### Tasks

**3.2.1 Documentation Updates**
- [ ] **User Documentation**
  - Update USER_GUIDE.md with all new features
  - Update CONFIGURATION.md with all options
  - Update CLI_REFERENCE.md with new commands
  - Add plugin development guide
  - Add web UI guide

- [ ] **Developer Documentation**
  - Update ARCHITECTURE.md
  - Document plugin system
  - Document SQLite adapter
  - Add API documentation

- [ ] **Examples**
  - Update example configs
  - Add plugin examples
  - Add API usage examples

**3.2.2 Performance Optimization**
- [ ] **Profiling**
  - Identify performance bottlenecks
  - Optimize hot paths
  - Reduce memory usage

- [ ] **Caching Improvements**
  - Better cache invalidation
  - Cache warming
  - Cache statistics

**3.2.3 Security Audit**
- [ ] **Dependency Audit**
  - Run npm audit
  - Update vulnerable dependencies
  - Pin critical dependencies

- [ ] **Code Security**
  - Input validation
  - SQL injection prevention
  - XSS prevention in web UI
  - Secure credential storage

**3.2.4 Final Testing**
- [ ] **Full Integration Tests**
  - Test all features end-to-end
  - Test on multiple platforms (Linux, macOS, Windows)
  - Test different Node versions

- [ ] **User Acceptance Testing**
  - Beta testing with users
  - Collect feedback
  - Fix critical issues

**3.2.5 Release Preparation**
- [ ] **Changelog**
  - Generate comprehensive changelog
  - Document breaking changes
  - Migration guides

- [ ] **Release Notes**
  - Write v1.0.0 release notes
  - Highlight key features
  - Known limitations

- [ ] **Marketing**
  - Update README with features
  - Create demo video/GIF
  - Prepare social media posts

**Acceptance Criteria:**
- ✓ All documentation updated
- ✓ Performance optimized
- ✓ Security audit passed
- ✓ No critical bugs
- ✓ Ready for v1.0.0 release

---

## Quick Wins (Parallel Development)

These can be implemented alongside main phases:

### Better Selector Management (1-2 days)
- [ ] Centralize all CSS selectors
- [ ] Add selector validation
- [ ] Fallback selectors for breaking changes
- Files: `packages/scrapers/src/selectors/`

### Enhanced Caching Features (1-2 days)
- [ ] Cache statistics
- [ ] Cache warming
- [ ] Selective cache invalidation
- [ ] Cache size limits

### Metrics & Analytics (1-2 days)
- [ ] Scraping metrics (time, success rate)
- [ ] Resource usage metrics
- [ ] Export metrics to file
- Files: `shared/utils/src/metrics.ts`

### Rate Limit Improvements (1-2 days)
- [ ] Adaptive rate limiting
- [ ] Per-endpoint rate limits
- [ ] Burst allowance
- [ ] Rate limit status display

---

## Success Metrics

### Code Quality
- [ ] Test coverage ≥ 90%
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors
- [ ] Code duplication < 5%

### Performance
- [ ] Scrape single problem < 5s
- [ ] Batch scrape 100 problems < 5 min
- [ ] Memory usage < 500 MB
- [ ] Package size < 10 MB

### Reliability
- [ ] Uptime 99.9% (for web UI)
- [ ] Error rate < 0.1%
- [ ] All edge cases handled
- [ ] Graceful degradation

### Documentation
- [ ] All features documented
- [ ] Examples for all use cases
- [ ] Troubleshooting guide complete
- [ ] API reference complete

---

## Dependencies & Risks

### Dependencies
- **External:** LeetCode HTML structure (risk: breaking changes)
- **Internal:** Playwright browser automation
- **Infrastructure:** npm registry, GitHub Actions

### Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LeetCode HTML changes | High | High | Selector fallbacks, monitoring, quick updates |
| Browser automation issues | Medium | Medium | Graceful fallback to non-browser mode |
| npm publishing issues | Low | Medium | Test with dry-run, manual backup |
| Performance degradation | Medium | Medium | Regular benchmarking, optimization |
| Plugin system bugs | Medium | High | Thorough testing, sandboxing |
| Security vulnerabilities | Low | High | Regular audits, dependency updates |

---

## Resource Requirements

### Development Time
- **Total Effort:** 50-65 days (10-13 weeks with parallel work)
- **Team Size:** 1-2 developers
- **Availability:** Full-time or part-time

### Infrastructure
- **CI/CD:** GitHub Actions (free for public repos)
- **npm:** Free account
- **Testing:** Local + CI
- **Hosting:** Optional (for web UI demo)

---

## Version Milestones

### v0.2.0 - Stable Foundation
**Target:** Week 3-4
- Complete test coverage
- Browser automation complete
- Error handling audit complete
- CI/CD pipeline running
- npm package published

### v0.3.0 - Extended Features
**Target:** Week 7-8
- Plugin system working
- Quality scoring implemented
- SQLite adapter complete
- Example plugins available

### v1.0.0 - Production Release
**Target:** Week 11-12
- Web UI complete (optional)
- All documentation updated
- Performance optimized
- Security audited
- Ready for production use

---

## Post-v1.0.0 Roadmap

### v1.1.0 - Enhancements
- More plugin examples
- Performance improvements
- Community feedback integration

### v1.2.0 - Advanced Features
- GraphQL API
- Advanced caching strategies
- Multi-user support (for web UI)

### v2.0.0 - Major Update
- Support for other platforms (Codeforces, HackerRank)
- AI-powered features (solution explanations, hints)
- Cloud sync

---

## Appendix

### A. Key Configuration Options (New)

```typescript
{
  // Testing
  testing: {
    coverage: {
      threshold: 90,
      perPackage: true
    }
  },

  // Plugin system
  plugins: {
    enabled: true,
    paths: ['./plugins', 'node_modules/@lesca/plugin-*'],
    hooks: {
      beforeScrape: true,
      afterScrape: true,
      // ... more hooks
    }
  },

  // Quality scoring
  discussion: {
    minQualityScore: 50,
    sortBy: 'quality',
    qualityWeights: {
      content: 0.4,
      engagement: 0.3,
      recency: 0.2,
      relevance: 0.1
    }
  },

  // SQLite storage
  storage: {
    type: 'sqlite',  // 'filesystem' | 'sqlite'
    sqlite: {
      path: './lesca.db',
      enableWAL: true,
      busyTimeout: 5000
    }
  },

  // Web UI
  web: {
    enabled: true,
    port: 3000,
    host: 'localhost',
    auth: {
      enabled: false,
      username: '',
      password: ''
    }
  },

  // Logging
  logging: {
    level: 'info',  // 'debug' | 'info' | 'warn' | 'error'
    output: 'console',  // 'console' | 'file' | 'both'
    file: './lesca.log',
    rotation: {
      maxSize: '10m',
      maxFiles: 5
    }
  }
}
```

### B. New CLI Commands

```bash
# Plugin management
lesca plugin list
lesca plugin install <name>
lesca plugin uninstall <name>

# Database management
lesca db init
lesca db migrate
lesca db query <sql>
lesca db export [--format=filesystem]

# Web UI
lesca serve [--port=3000] [--open]

# Utilities
lesca validate [--fix]
lesca benchmark
lesca doctor  # System health check
```

### C. Package Structure (Updated)

```
lesca/
├── packages/
│   ├── core/           # Orchestration + Plugin Manager
│   ├── cli/            # CLI + New commands
│   ├── scrapers/       # Scrapers + Quality scoring
│   ├── converters/     # Converters
│   ├── storage/        # Storage + SQLite adapter
│   ├── browser/        # Browser automation (enhanced)
│   ├── api/            # REST API (new)
│   └── web/            # Web UI (new)
├── shared/
│   ├── config/         # Configuration (extended)
│   ├── error/          # Error handling (enhanced)
│   ├── types/          # Type definitions (extended)
│   └── utils/          # Utilities + Metrics + Logger
├── plugins/            # Example plugins (new)
│   ├── notion/
│   ├── anki/
│   └── analytics/
└── tests/
    ├── integration/    # Integration tests (new)
    ├── benchmarks/     # Performance tests (new)
    └── fixtures/       # Test fixtures (new)
```

---

## Summary

This comprehensive plan takes Lesca from v0.1.0 (MVP) to v1.0.0 (Production Stable) over 10-12 weeks:

**Phase 1 (Weeks 1-3):** Stability
- Complete testing (90%+ coverage)
- Finish browser automation
- Audit error handling
- Set up CI/CD
- Publish to npm

**Phase 2 (Weeks 4-7):** Extension
- Plugin system & hooks
- Quality scoring for discussions
- SQLite storage adapter

**Phase 3 (Weeks 8-12):** Polish
- Optional web UI
- Documentation updates
- Performance optimization
- Security audit
- v1.0.0 release

**Outcome:** A production-ready, extensible, well-tested LeetCode scraper with advanced features and multiple interface options (CLI, Web UI, programmatic API).
