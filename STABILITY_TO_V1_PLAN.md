# Lesca: Stability to v1.0.0 Implementation Plan

## Executive Summary

This document outlines the comprehensive implementation plan for taking Lesca from v0.1.0 (MVP Complete) to v1.0.0 (Stable Production Release). The plan combines immediate stability priorities with medium-term feature development, creating a cohesive roadmap spanning approximately 8-12 weeks.

**Current State:** v0.1.0 - MVP Complete
- 539 passing tests (73.66% coverage)
- Zero TypeScript/ESLint errors
- 10 packages: core, cli, scrapers, converters, storage, browser-automation, auth, api-client, + 2 shared
- ~9,500 lines of code
- Core functionality working

**Target State:** v1.0.0 - Production Stable
- 90%+ test coverage with comprehensive integration tests
- Production-ready CI/CD pipeline
- Plugin system for extensibility
- Advanced features (quality scoring, SQLite storage)
- npm package published
- Complete documentation
- **Note:** Web UI deferred to post-v1.0.0

---

## Timeline Overview

```
v0.1.0 (Current) → v0.2.0 (Stable) → v0.3.0 (Extended) → v1.0.0 (Production)
     ↓                  ↓                  ↓                    ↓
  Week 0           Week 3-4           Week 6-7             Week 8-9

Total Duration: 8-9 weeks (Web UI deferred to post-v1.0.0)
```

---

## Phase 1: Stability & Testing (v0.1.0 → v0.2.0)
**Duration:** 3-4 weeks
**Goal:** Production-ready foundation with comprehensive testing

### 1.1 Browser Automation Completion (Week 1-2)
**Estimated Effort:** 10 days (split into 3 issues)
**Priority:** High
**GitHub Issues:** #[TBD] Session Management, #[TBD] Cookie Management, #[TBD] Request Interception

#### Current State
- Basic Playwright integration exists
- Cookie management partially implemented
- Needs production hardening

#### Tasks

**ISSUE #1: Browser Session Management & Pooling** (4 days)
- [ ] **Session Management**
  - Persistent browser contexts
  - Session restoration
  - Multiple account support
  - Files: `packages/browser-automation/src/session-manager.ts`

- [ ] **Browser Pooling**
  - Reuse browser instances
  - Lazy initialization
  - Proper cleanup on exit
  - Files: `packages/browser-automation/src/pool.ts`

- [ ] **Testing**
  - Tests covering reuse and cleanup
  - No memory leaks on repeated runs

**ISSUE #2: Cookie Management & Login Helpers** (3 days)
- [ ] **Cookie Management**
  - Auto-save cookies after login
  - Cookie refresh logic
  - Cookie validation before use
  - Files: `packages/browser-automation/src/cookie-manager.ts`

- [ ] **Authentication Flow**
  - Interactive login prompt
  - Secure credential storage (recommend keytar)
  - Auto-login on session expiry
  - Files: `packages/browser-automation/src/auth.ts`

- [ ] **Premium Content Detection**
  - Detect locked content
  - Graceful fallback for non-premium users
  - Clear error messages

**ISSUE #3: Request Interception & Performance** (3 days)
- [ ] **Request Interception**
  - Block unnecessary resources (images, fonts, ads) by default
  - Capture API responses
  - Inject custom headers
  - Files: `packages/browser-automation/src/interceptor.ts`

- [ ] **Headless Mode**
  - Default to headless for performance
  - Optional headed mode for debugging
  - Configuration option: `browser.headless`
  - Files: `packages/browser-automation/src/playwright-driver.ts`

- [ ] **Error Handling**
  - Graceful browser crash recovery
  - Timeout handling with retries
  - Network error detection

**Acceptance Criteria:**
- ✓ Login flow works reliably
- ✓ Cookies persist across sessions
- ✓ Browser cleanup has no memory leaks
- ✓ Works in both headed and headless modes
- ✓ Graceful degradation when browser unavailable

---

### 1.2 Error Handling & Logging Audit (Week 2-3)
**Estimated Effort:** 4 days
**Priority:** High
**GitHub Issue:** #[TBD] Error Handling Audit & Structured Logger

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
**Estimated Effort:** 4 days
**Priority:** Critical
**GitHub Issue:** #[TBD] Test Coverage: fast/slow split + per-package thresholds

#### Objectives
- Increase test coverage from 73.66% to 90%+
- Add integration tests for end-to-end workflows
- Ensure all edge cases are covered

#### Tasks

**1.3.1 Test Split Strategy**

- [ ] **Configure Fast/Slow Test Split**
  - Add `test:unit` script for fast unit tests (runs on every PR)
  - Add `test:integration` script for slow integration tests (runs on release)
  - Update `vitest.config.ts` with separate configurations
  - Files: `vitest.config.ts`, root `package.json`

  ```json
  // package.json
  {
    "scripts": {
      "test": "npm run test:unit",
      "test:unit": "vitest run --config vitest.unit.config.ts",
      "test:integration": "vitest run --config vitest.integration.config.ts",
      "test:all": "npm run test:unit && npm run test:integration",
      "test:coverage": "vitest run --coverage"
    }
  }
  ```

**1.3.2 Per-Package Coverage Thresholds**

- [ ] **Coverage Enforcement Script**
  - Create script that checks per-package coverage thresholds
  - Files: `scripts/check-coverage.ts`

  ```typescript
  // Target thresholds per package
  @lesca/core: 95%
  @lesca/scrapers: 92%
  @lesca/converters: 90%
  @lesca/storage: 95%
  @lesca/browser-automation: 88%
  @lesca/cli: 85%
  @lesca/auth: 90%
  @lesca/api-client: 90%
  ```

- [ ] **Overall coverage target**: ≥ 90%

**1.3.3 Integration Test Suite**

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
  - Scraper → Converter → Storage pipeline
  - CLI → Core → Scrapers flow
  - Browser → Scrapers → Cache flow
  - Config → All packages validation

**1.3.4 Test Infrastructure**

- [ ] **Test Fixtures**
  - Sample LeetCode HTML responses
  - Mock problem data generators
  - Reusable test utilities
  - Files: `tests/fixtures/`, `tests/factories/`

- [ ] **Performance Benchmarks**
  - Scraping speed benchmarks
  - Conversion performance tests
  - Memory usage tests
  - Files: `tests/benchmarks/`

**Acceptance Criteria:**
- ✓ `test:unit` and `test:integration` scripts configured
- ✓ Unit tests run on PRs, integration tests on release only
- ✓ Coverage check script enforces per-package thresholds
- ✓ Overall test coverage ≥ 90%
- ✓ At least 5 integration tests covering key workflows
- ✓ Unit test suite completes in < 30 seconds
- ✓ Zero flaky tests (see flaky test mitigation below)

---

### 1.4 CI/CD Pipeline (Week 3)
**Estimated Effort:** 2 days
**Priority:** High
**GitHub Issue:** #[TBD] CI: PR (fast) and Release (full) workflows

#### Tasks

**1.4.1 GitHub Actions Workflows**
Create `.github/workflows/`:

- [ ] **PR CI Workflow** (`ci.yml`) - Fast checks
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    validate:
      - Lint (ESLint, Prettier)
      - Type check (tsc --noEmit)
      - Unit tests (npm run test:unit) ← FAST ONLY
      - Build all packages
  ```

- [ ] **Release Workflow** (`release.yml`) - Full validation
  ```yaml
  name: Release
  on:
    push:
      tags: ['v*.*.*']
  jobs:
    test:
      - Lint, type check, build
      - Full test suite (npm run test:all) ← Unit + Integration
      - Upload coverage to Codecov
    release:
      - Create GitHub release
      - Publish to npm
      - Create binaries (optional for v0.2.0)
      - Upload release artifacts
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
- ✓ PR CI runs lint, typecheck, unit tests (fast feedback loop)
- ✓ Release workflow runs full test suite
- ✓ Releases build packages and upload coverage
- ✓ Pre-commit hooks prevent bad commits (Husky)
- ✓ Release artifacts created on tag push

---

### 1.5 npm Package Publication (Week 3-4)
**Estimated Effort:** 2 days
**Priority:** Medium
**GitHub Issue:** #[TBD] npm Publication Pre-flight

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

**Acceptance Criteria:**
- ✓ Dry-run publish succeeds
- ✓ Publishing process documented
- ✓ `npm install -g @lesca/cli` validated locally
- ✓ Installation docs updated
- Note: Binary releases deferred to post-v0.2.0

---

### 1.6 Risk Mitigation & Monitoring (Parallel to Week 1-3)
**Estimated Effort:** 2 days (can be done in parallel)
**Priority:** Medium
**GitHub Issues:** #[TBD] Selector Monitoring, #[TBD] Flaky Test Mitigation

#### Tasks

**ISSUE: Selector Monitoring Job** (1 day)
- [ ] **Scheduled Selector Validation**
  - Create GitHub Actions workflow that runs daily
  - Scrapes sample problems to detect selector breakage
  - Opens PR/issue or sends alert on failures
  - Files: `.github/workflows/selector-monitor.yml`, `scripts/selector-monitor.ts`

  ```yaml
  # .github/workflows/selector-monitor.yml
  name: Selector Monitor
  on:
    schedule:
      - cron: '0 0 * * *'  # Daily at midnight
  jobs:
    monitor:
      - Run sample scrapes for each scraper type
      - Check for selector failures
      - Create issue if failures detected
  ```

**ISSUE: Flaky Test Mitigation Policy** (1 day)
- [ ] **Test Retry Logic**
  - Re-run failing tests automatically once
  - Label flaky tests for triage
  - Files: CI workflow changes, `vitest.config.ts`

  ```typescript
  // vitest.config.ts
  export default {
    test: {
      retry: 1,  // Retry failed tests once
      reporters: ['verbose', 'flaky-reporter']
    }
  }
  ```

- [ ] **Flaky Test Tracking**
  - Add GitHub Action to detect patterns
  - Create issues for consistently flaky tests
  - Document flaky test debugging process

**Acceptance Criteria:**
- ✓ Selector monitoring job runs daily
- ✓ Alerts triggered on selector failures
- ✓ Flaky tests auto-retry once
- ✓ Flaky tests labeled and tracked

---

## Phase 2: Extension & Advanced Features (v0.2.0 → v0.3.0)
**Duration:** 3-4 weeks
**Goal:** Extensibility and advanced functionality

### 2.1 Plugin System & Hooks (Week 4-5)
**Estimated Effort:** 6 days
**Priority:** High
**GitHub Issue:** #[TBD] Core: Plugin Manager & Hook Registry

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

**2.1.1 Plugin Infrastructure** (3 days)
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

**2.1.2 Hook System** (2 days)
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

**Acceptance Criteria:**
- ✓ Plugin discovery works (local `plugins/` + npm `@lesca/plugin-*`)
- ✓ Registration/unregistration working
- ✓ Hook execution with priority ordering
- ✓ Safe isolation - plugin errors don't crash host
- ✓ Basic API documentation created

---

### 2.2 Plugin Examples & Developer Guide (Week 5-6)
**Estimated Effort:** 3 days
**Priority:** Medium
**GitHub Issue:** #[TBD] Plugin Examples & Developer Guide

#### Tasks

- [ ] **Example Plugins**
  - Create at least 2 example plugins with tests
  - Suggested: Notion converter, Anki flashcards
  - Files: `plugins/notion/`, `plugins/anki/`

- [ ] **Plugin Development Guide**
  - Step-by-step guide: docs/PLUGIN_DEVELOPMENT.md
  - Tutorial: building a simple plugin
  - API reference for plugin types
  - Best practices and patterns

**Acceptance Criteria:**
- ✓ At least 2 example plugins working with tests
- ✓ Plugin development guide complete
- ✓ Examples demonstrate different plugin types

---

### 2.3 Quality Scoring for Discussions (Week 6)
**Estimated Effort:** 4 days
**Priority:** Medium
**GitHub Issue:** #[TBD] Scrapers: Quality Scoring Engine for Discussions

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

**2.3.1 Scoring Engine**
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

**2.3.2 Integration & Configuration**
- [ ] **Discussion Scraper Update**
  - Integrate with discussion scraper to store `quality_score` in metadata
  - Apply config-driven weights
  - Configuration: `discussion.minQualityScore`, `discussion.qualityWeights`

**2.3.3 Testing**
- [ ] **Validation**
  - Tests using sample discussion fixtures
  - Validate scoring factors work correctly

**Acceptance Criteria:**
- ✓ Scoring factors implemented (content, engagement, recency, relevance)
- ✓ Config-driven weights working
- ✓ Integration with discussion scraper complete
- ✓ Tests using sample fixtures passing

---

### 2.4 SQLite Storage Adapter (Week 7)
**Estimated Effort:** 6 days
**Priority:** Medium
**GitHub Issue:** #[TBD] Storage: SQLite Adapter + Migrations

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

**2.4.1 SQLite Adapter**
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

**2.4.2 Migrations**
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

**2.4.3 CLI Integration**
- [ ] **CLI Commands**
  - `lesca db init` - Initialize database
  - `lesca db migrate` - Run migrations
  - Configuration support for SQLite backend

**2.4.4 Testing**
- [ ] **Tests**
  - Tests for migrations and queries
  - CRUD operation validation

**Acceptance Criteria:**
- ✓ Adapter CRUD + query/search working
- ✓ Migration runner and example migrations functional
- ✓ CLI commands `lesca db init` and `lesca db migrate` working
- ✓ Tests for migrations and queries passing

---

## Phase 3: Polish & Release (v0.3.0 → v1.0.0)
**Duration:** 2-3 weeks
**Goal:** Production-ready v1.0.0 release

**Note:** Web UI deferred to post-v1.0.0 (minimal placeholders kept)

### 3.1 Documentation Sweep & Release Notes (Week 8)
**Estimated Effort:** 3 days
**Priority:** High
**GitHub Issue:** #[TBD] Documentation Sweep & Release Notes

#### Tasks

- [ ] **User Documentation**
  - Update docs/ with all new features
  - Update USER_GUIDE.md, CONFIGURATION.md, CLI_REFERENCE.md
  - Document all new CLI commands
  - Plugin development guide (from Phase 2)

- [ ] **Configuration Reference**
  - Complete config reference with all options
  - Document all new settings from v0.2.0 and v0.3.0
  - Add examples for common use cases

- [ ] **Changelog & Migration Notes**
  - Generate comprehensive changelog
  - Document breaking changes
  - Create migration guide from v0.1.0 to v1.0.0

**Acceptance Criteria:**
- ✓ All new features documented
- ✓ Config reference updated
- ✓ Changelog and migration notes prepared

---

### 3.2 Performance Profiling & Optimizations (Week 8-9)
**Estimated Effort:** 4 days
**Priority:** High
**GitHub Issue:** #[TBD] Performance Profiling & Hotpath Optimizations

#### Tasks
- [ ] **Identify Bottlenecks**
  - Profile scraping flows
  - Identify top 3 bottlenecks
  - Reduce latency/memory for scraping flows

- [ ] **Add Benchmarks**
  - Create benchmark suite in `tests/benchmarks/`
  - Measure baseline performance
  - Track performance over time

- [ ] **Optimize Hot Paths**
  - Apply optimizations based on profiling
  - Validate improvements with benchmarks

**Acceptance Criteria:**
- ✓ Top 3 bottlenecks identified and reduced
- ✓ Benchmarks added to `tests/benchmarks/`
- ✓ Performance improvements measurable

---

### 3.3 Security Audit & Dependency Pinning (Week 9)
**Estimated Effort:** 3 days
**Priority:** High
**GitHub Issue:** #[TBD] Security Audit & Dependency Pinning

#### Tasks
- [ ] **Dependency Audit**
  - Run `npm audit` and resolve critical items
  - Update vulnerable dependencies
  - Document secure credential storage

- [ ] **Code Security**
  - Input validation review
  - SQL injection prevention (SQLite adapter)
  - Basic mitigation strategies documented

**Acceptance Criteria:**
- ✓ Critical `npm audit` items resolved
- ✓ Secure credential storage documented
- ✓ Input validation and SQL injection prevention reviewed

---

### 3.4 Final Integration Tests & Release Execution (Week 9)
**Estimated Effort:** 3 days
**Priority:** Critical
**GitHub Issue:** #[TBD] Final Integration Tests & Release Execution

#### Tasks

- [ ] **Full Integration Testing**
  - Test all features end-to-end
  - Run full test matrix in CI
  - Manual smoke-checks on key workflows

- [ ] **Release Execution**
  - Create release artifacts
  - Publish to npm
  - Verify installation works
  - Create GitHub release with notes

- [ ] **Post-Release**
  - Monitor for issues
  - Update documentation if needed
  - Communicate release to users

**Acceptance Criteria:**
- ✓ Release CI passes full test matrix
- ✓ Release artifacts published
- ✓ Smoke-checks executed
- ✓ v1.0.0 released successfully

---

## Quick Wins (Parallel Development)

These can be implemented alongside main phases (1 day each):

### ISSUE: Centralize Selectors & Fallback Logic (1 day)
**GitHub Issue:** #[TBD] Centralize selectors & fallback logic
- [ ] Centralize all CSS selectors
- [ ] Add selector validation
- [ ] Fallback selectors for breaking changes
- Files: `packages/scrapers/src/selectors/index.ts`

### ISSUE: Cache Statistics & Limits (1 day)
**GitHub Issue:** #[TBD] Cache statistics & limits
- [ ] Cache statistics
- [ ] Cache size limits
- [ ] Cache warming utilities
- Files: `shared/utils/src/metrics.ts`, `shared/utils/src/cache.ts`

### ISSUE: Adaptive Rate Limiter Improvements (1 day)
**GitHub Issue:** #[TBD] Adaptive rate limiter improvements
- [ ] Adaptive rate limiting
- [ ] Per-endpoint rate limits
- [ ] Burst allowance
- [ ] Rate limit status display
- Files: `packages/api-client/src/rate-limiter.ts`

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
**Estimated Effort:** ~22 days total
- ✓ Browser automation complete (10 days)
  - Session management & pooling (4 days)
  - Cookie management & login (3 days)
  - Request interception & performance (3 days)
- ✓ Error handling & logging audit (4 days)
- ✓ Test coverage expansion (4 days)
- ✓ CI/CD pipeline (2 days)
- ✓ npm publication (2 days)
- ✓ Risk mitigation (2 days, parallel)

### v0.3.0 - Extended Features
**Target:** Week 7
**Estimated Effort:** ~19 days total
- ✓ Plugin system & hooks (6 days)
- ✓ Plugin examples & guide (3 days)
- ✓ Quality scoring (4 days)
- ✓ SQLite adapter & migrations (6 days)

### v1.0.0 - Production Release
**Target:** Week 9
**Estimated Effort:** ~13 days total
- ✓ Documentation sweep (3 days)
- ✓ Performance profiling & optimization (4 days)
- ✓ Security audit (3 days)
- ✓ Final integration tests & release (3 days)
- **Note:** Web UI deferred to post-v1.0.0

**Total Estimated Effort:** ~54 developer-days (8-9 weeks with parallel work)

---

## Post-v1.0.0 Roadmap

### v1.1.0 - Web UI (Optional)
**Estimated Effort:** 12-15 days
- React + TypeScript frontend
- Express.js REST API backend
- Problem browser, scraping management
- Configuration UI
- Statistics dashboard

### v1.2.0 - Community & Enhancements
- More plugin examples
- Performance improvements
- Community feedback integration
- Binary releases (pkg or @vercel/ncc)

### v2.0.0 - Major Update
- Support for other platforms (Codeforces, HackerRank)
- AI-powered features (solution explanations, hints)
- Cloud sync (optional)
- Advanced analytics

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

  // Browser automation
  browser: {
    headless: true,
    timeout: 30000
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

# Utilities
lesca validate [--fix]
lesca benchmark
lesca doctor  # System health check
```

### C. Package Structure (Updated)

```
lesca/
├── packages/
│   ├── core/                  # Orchestration + Plugin Manager
│   ├── cli/                   # CLI + Database commands
│   ├── scrapers/              # Scrapers + Quality scoring
│   ├── converters/            # Converters
│   ├── storage/               # Storage + SQLite adapter
│   ├── browser-automation/    # Browser automation (enhanced)
│   ├── auth/                  # Authentication helpers
│   └── api-client/            # API client + Rate limiting
├── shared/
│   ├── config/                # Configuration (extended)
│   ├── error/                 # Error handling (enhanced)
│   ├── types/                 # Type definitions (extended)
│   └── utils/                 # Utilities + Metrics + Logger
├── plugins/                   # Example plugins (new)
│   ├── notion/                # Notion converter example
│   └── anki/                  # Anki flashcards example
├── tests/                     # Test infrastructure (new)
│   ├── integration/           # Integration tests
│   ├── benchmarks/            # Performance benchmarks
│   └── fixtures/              # Test fixtures
└── scripts/                   # Build & utility scripts (new)
    ├── check-coverage.ts      # Coverage enforcement
    └── selector-monitor.ts    # Selector validation
```

---

## Summary

This comprehensive plan takes Lesca from v0.1.0 (MVP) to v1.0.0 (Production Stable) over **8-9 weeks**:

**Phase 1 (Weeks 1-3):** Stability & Foundation
- Browser automation production hardening (10 days)
- Error handling & structured logging (4 days)
- Test coverage expansion to 90%+ (4 days)
- CI/CD pipeline setup (2 days)
- npm package publication (2 days)
- Risk mitigation (selector monitoring, flaky tests) (2 days)

**Phase 2 (Weeks 4-7):** Extension & Advanced Features
- Plugin system with hooks (6 days)
- Plugin examples & developer guide (3 days)
- Quality scoring for discussions (4 days)
- SQLite storage adapter with migrations (6 days)

**Phase 3 (Weeks 8-9):** Polish & Release
- Documentation sweep & release notes (3 days)
- Performance profiling & optimization (4 days)
- Security audit & dependency review (3 days)
- Final integration tests & release execution (3 days)

**Quick Wins (Parallel):**
- Centralize selectors (1 day)
- Cache statistics & limits (1 day)
- Adaptive rate limiting (1 day)

**Key Changes from Original Plan:**
- ✓ Web UI deferred to post-v1.0.0 (saves ~3 weeks)
- ✓ Package names corrected (browser-automation vs browser)
- ✓ Test strategy refined (fast/slow split)
- ✓ Estimates aligned with issue backlog
- ✓ Risk mitigation added (selector monitoring, flaky tests)

**Outcome:** A production-ready, extensible, well-tested LeetCode scraper with:
- 90%+ test coverage
- Plugin system for extensibility
- Advanced features (quality scoring, SQLite storage)
- Production-grade error handling and logging
- CI/CD automation
- Comprehensive documentation
- npm published package
