# Lesca Development Roadmap

**Last Updated**: 2025-01-13
**Current Status**: ✅ Core functionality complete, 0 TypeScript errors

---

## Current State Assessment

### ✅ Completed

- **Phase 0**: Project setup and GraphQL validation
  - Monorepo structure established
  - TypeScript configuration (strict mode)
  - GraphQL API coverage documented
  - Build system working

- **Core Implementation**:
  - GraphQL client with rate limiting
  - Authentication (cookie-based)
  - Scraping strategies (Problem, Editorial, Discussion, List)
  - Browser automation (Playwright)
  - Converters (HTML → Markdown, Obsidian format)
  - Storage adapters (Filesystem)
  - CLI interface (working)
  - Batch scraping with progress
  - Caching system with TTL

- **Documentation**:
  - TypeScript best practices guide
  - Quick reference card
  - Contributing guidelines
  - Architecture review
  - GraphQL coverage analysis

### 🚧 Partially Complete

- **Testing**: Only 1 test file (cache.test.ts)
- **Browser Automation**: Strategy exists but incomplete implementation
- **Error Handling**: Basic but could be more robust
- **Configuration**: Hardcoded values need config system

### ❌ Not Started

- **Comprehensive test coverage**
- **Plugin system**
- **CI/CD pipeline**
- **Package distribution**
- **User documentation**
- **Examples and tutorials**

---

## Priority Roadmap

## 🎯 Phase 1: Stability & Testing (PRIORITY)
**Timeline**: 1-2 weeks
**Goal**: Make existing functionality reliable and well-tested

### 1.1 Testing Infrastructure ⚠️ CRITICAL

**Why First**: Can't ship without tests. Need to catch regressions.

**Tasks**:
- [ ] **Unit Tests for Core Packages** (3-5 days)
  - `packages/api-client` - GraphQL queries, rate limiting
  - `packages/auth` - Cookie loading, validation
  - `packages/scrapers` - All 4 strategies
  - `packages/converters` - HTML to Markdown, Obsidian
  - `packages/storage` - Filesystem operations
  - `shared/utils` - Logger, cache (already has 1 test)

- [ ] **Integration Tests** (2-3 days)
  - End-to-end scraping workflow
  - CLI command execution
  - Batch scraping with multiple problems
  - Error scenarios (network failures, auth failures)

- [ ] **Test Coverage Goals**
  - Target: 70%+ coverage
  - Critical paths: 90%+ coverage
  - Set up coverage reporting

**Files to Create**:
```
packages/api-client/src/__tests__/graphql-client.test.ts
packages/api-client/src/__tests__/rate-limiter.test.ts
packages/auth/src/__tests__/cookie-auth.test.ts
packages/scrapers/src/__tests__/problem-strategy.test.ts
packages/scrapers/src/__tests__/editorial-strategy.test.ts
packages/scrapers/src/__tests__/discussion-strategy.test.ts
packages/scrapers/src/__tests__/list-strategy.test.ts
packages/converters/src/__tests__/html-to-markdown.test.ts
packages/converters/src/__tests__/obsidian-converter.test.ts
packages/core/src/__tests__/scraper.test.ts
packages/core/src/__tests__/batch-scraper.test.ts
packages/storage/src/__tests__/filesystem-storage.test.ts
tests/integration/e2e-scraping.test.ts
```

**Acceptance Criteria**:
- [ ] `npm test` runs successfully
- [ ] Coverage report generated
- [ ] All critical paths tested
- [ ] Mock external APIs (LeetCode GraphQL)

### 1.2 Browser Automation Completion (2-3 days)

**Current State**: PlaywrightDriver exists but incomplete

**Tasks**:
- [ ] Implement missing BrowserDriver methods
  - `getBrowser()` - Return browser instance
  - `getHtml(selector)` - Get element HTML
  - `getPageHtml()` - Get full page source
  - `elementExists(selector)` - Check element presence
  - `extractWithFallback(selectors)` - Try multiple selectors
  - `screenshot(path)` - Take screenshot

- [ ] Add browser pool for performance
- [ ] Implement proper cleanup/disposal
- [ ] Add retry logic for flaky selectors
- [ ] Test with actual LeetCode pages

**Files to Modify**:
```
packages/browser-automation/src/playwright-driver.ts
packages/browser-automation/src/__tests__/playwright-driver.test.ts
```

**Acceptance Criteria**:
- [ ] All BrowserDriver interface methods implemented
- [ ] Can scrape premium content (with auth)
- [ ] Screenshot capture working
- [ ] Proper error handling for timeouts

### 1.3 Error Handling & Logging (1-2 days)

**Tasks**:
- [ ] Audit all error throwing for LescaError usage
- [ ] Add error codes to all error scenarios
- [ ] Implement structured logging
- [ ] Add debug mode for verbose output
- [ ] Create error recovery strategies

**Files to Modify**:
```
shared/utils/src/logger.ts
shared/types/src/index.ts (error types)
```

**Acceptance Criteria**:
- [ ] All errors use LescaError with codes
- [ ] Log levels configurable (debug/info/warn/error)
- [ ] Errors include context for debugging
- [ ] User-friendly error messages

---

## 🎯 Phase 2: Configuration & Flexibility (RECOMMENDED)
**Timeline**: 1 week
**Goal**: Make the tool configurable and user-friendly

### 2.1 Configuration System (2-3 days)

**Current State**: Values hardcoded throughout

**Tasks**:
- [ ] Create configuration schema with Zod
- [ ] Support multiple config sources:
  - Config file (`lesca.config.ts` or `.lescarc`)
  - Environment variables
  - CLI flags
  - Programmatic API
- [ ] Default configuration
- [ ] Config validation

**Files to Create**:
```
shared/config/src/config.ts
shared/config/src/schema.ts
shared/config/src/loader.ts
shared/config/src/__tests__/config.test.ts
```

**Configuration Structure**:
```typescript
{
  auth: {
    method: 'cookie-file' | 'browser' | 'session',
    cookiePath: string,
    autoRefresh: boolean
  },
  scraping: {
    concurrent: number,
    delay: { min, max },
    retry: { attempts, backoff }
  },
  output: {
    format: 'markdown' | 'obsidian',
    directory: string,
    naming: 'id-slug' | 'slug-only'
  },
  cache: {
    enabled: boolean,
    ttl: { problems, discussions },
    directory: string
  },
  browser: {
    headless: boolean,
    timeout: number
  }
}
```

**Acceptance Criteria**:
- [ ] Config loads from file
- [ ] CLI flags override config
- [ ] Schema validation works
- [ ] Default config provided

### 2.2 Improved CLI (2-3 days)

**Tasks**:
- [ ] Add more commands:
  - `lesca init` - Create config file
  - `lesca auth` - Authenticate interactively
  - `lesca list` - List available problems
  - `lesca search` - Search problems by criteria
  - `lesca config` - Show current config
- [ ] Improve help text and examples
- [ ] Add command aliases
- [ ] Better error messages
- [ ] Progress indicators for all operations

**Files to Modify**:
```
packages/cli/src/index.ts
packages/cli/src/commands/init.ts (new)
packages/cli/src/commands/auth.ts (new)
packages/cli/src/commands/list.ts (new)
```

**Acceptance Criteria**:
- [ ] `lesca --help` shows clear documentation
- [ ] All commands have examples
- [ ] Interactive prompts for missing data
- [ ] Validates input before execution

### 2.3 User Documentation (2-3 days)

**Tasks**:
- [ ] Create user guide (docs/USER_GUIDE.md)
- [ ] Write installation instructions
- [ ] Add usage examples
- [ ] Create troubleshooting guide
- [ ] Document all CLI commands
- [ ] Add screenshots/GIFs

**Files to Create**:
```
docs/USER_GUIDE.md
docs/INSTALLATION.md
docs/EXAMPLES.md
docs/TROUBLESHOOTING.md
docs/CLI_REFERENCE.md
examples/basic-usage.ts
examples/batch-scraping.ts
examples/custom-converter.ts
```

**Acceptance Criteria**:
- [ ] New users can install and run without help
- [ ] All features documented with examples
- [ ] Common issues have solutions
- [ ] README updated with quick start

---

## 🎯 Phase 3: Advanced Features (OPTIONAL)
**Timeline**: 2-3 weeks
**Goal**: Add nice-to-have features

### 3.1 Plugin System (5-7 days)

**Tasks**:
- [ ] Design plugin API
- [ ] Plugin discovery and loading
- [ ] Plugin hooks:
  - Pre/post scrape
  - Content transformation
  - Custom exporters
  - Custom scrapers
- [ ] Example plugins

**Files to Create**:
```
packages/plugins/src/plugin-manager.ts
packages/plugins/src/types.ts
examples/plugins/custom-exporter.ts
examples/plugins/notion-exporter.ts
docs/PLUGIN_DEVELOPMENT.md
```

### 3.2 Additional Storage Backends (3-4 days)

**Tasks**:
- [ ] SQLite storage adapter
- [ ] S3/Cloud storage adapter
- [ ] Notion API adapter
- [ ] Database schema design

**Files to Create**:
```
packages/storage/src/sqlite-storage.ts
packages/storage/src/s3-storage.ts
packages/storage/src/notion-storage.ts
```

### 3.3 Advanced Scraping Features (4-5 days)

**Tasks**:
- [ ] Resume interrupted batch scrapes
- [ ] Incremental updates (only scrape changed problems)
- [ ] Parallel scraping with worker threads
- [ ] Content deduplication
- [ ] Submission history scraping
- [ ] Contest problem scraping

---

## 🎯 Phase 4: Production Ready (RECOMMENDED)
**Timeline**: 1-2 weeks
**Goal**: Ship it!

### 4.1 CI/CD Setup (2-3 days)

**Tasks**:
- [ ] GitHub Actions workflow
  - Run tests on PR
  - Type checking
  - Linting
  - Coverage reporting
- [ ] Automated releases
- [ ] Changelog generation
- [ ] Version bumping

**Files to Create**:
```
.github/workflows/test.yml
.github/workflows/release.yml
.github/workflows/lint.yml
CHANGELOG.md
```

### 4.2 Package Distribution (2-3 days)

**Tasks**:
- [ ] Configure for npm publishing
- [ ] Create standalone binary (pkg/nexe)
- [ ] Docker image
- [ ] Homebrew formula
- [ ] Update package.json metadata

**Files to Create**:
```
Dockerfile
.dockerignore
scripts/build-binary.sh
homebrew/lesca.rb
```

### 4.3 Performance Optimization (2-3 days)

**Tasks**:
- [ ] Profile hot paths
- [ ] Optimize regex in HTML converter
- [ ] Cache selector results
- [ ] Batch GraphQL queries
- [ ] Lazy load browser only when needed
- [ ] Memory leak detection

### 4.4 Security Audit (1-2 days)

**Tasks**:
- [ ] Input validation everywhere
- [ ] SQL injection prevention (if SQLite added)
- [ ] XSS prevention in HTML processing
- [ ] Cookie storage security
- [ ] Dependency audit (`npm audit`)
- [ ] OWASP top 10 review

---

## 📊 Quick Wins (Do Anytime)

These can be done in parallel with other work:

### Quick Win 1: Better Selector Management (1 day)
- [ ] Extract selectors to JSON config
- [ ] Version selectors for LeetCode UI changes
- [ ] Add selector fallbacks

### Quick Win 2: Better Caching (1 day)
- [ ] Add cache invalidation
- [ ] Cache size limits
- [ ] Cache statistics

### Quick Win 3: Metrics/Analytics (1 day)
- [ ] Track scraping stats
- [ ] Export metrics
- [ ] Performance monitoring

### Quick Win 4: Rate Limit Improvements (1 day)
- [ ] Adaptive rate limiting
- [ ] Respect Retry-After headers
- [ ] Exponential backoff

---

## 🎯 Recommended Next Steps (Priority Order)

### Immediate (This Week)

1. **Testing Infrastructure** ⚠️ CRITICAL
   - Start with unit tests for core packages
   - Get to 50% coverage minimum
   - Add integration test for basic scraping

2. **Browser Automation Completion**
   - Implement missing methods
   - Test with real LeetCode pages

3. **Error Handling Audit**
   - Ensure all errors use LescaError
   - Add error codes everywhere

### Short Term (Next 2 Weeks)

4. **Configuration System**
   - Make the tool configurable
   - Stop hardcoding values

5. **User Documentation**
   - Write user guide
   - Add examples

6. **CI/CD Setup**
   - Automated testing on PRs
   - Release automation

### Medium Term (Next Month)

7. **Advanced CLI Commands**
   - `init`, `auth`, `search`, etc.

8. **Plugin System** (if needed)
   - Only if you want extensibility

9. **Performance Optimization**
   - Profile and optimize

### Long Term (Future)

10. **Additional Storage Backends**
11. **Package Distribution** (npm, binary, Docker)
12. **Advanced Features** (resume, incremental, etc.)

---

## 🎓 Success Criteria

**Minimum Viable Product (MVP)**:
- [ ] 70%+ test coverage
- [ ] All BrowserDriver methods implemented
- [ ] Configuration system working
- [ ] User documentation complete
- [ ] CI/CD pipeline running
- [ ] Can scrape all problem types reliably

**Production Ready**:
- [ ] All of MVP +
- [ ] Published to npm
- [ ] Docker image available
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] 5+ example use cases documented

**Feature Complete**:
- [ ] All of Production Ready +
- [ ] Plugin system functional
- [ ] Multiple storage backends
- [ ] Advanced scraping features
- [ ] Community contributions

---

## 📝 Notes

- Focus on **stability before features**
- **Testing is not optional** - it's critical
- **Documentation** is as important as code
- **Configuration** beats hardcoding
- Keep the **architecture clean** - don't rush

## 🤔 Open Questions

1. Do we need the plugin system? (Depends on use case)
2. Which storage backends are actually needed? (Filesystem may be enough)
3. Should we support Python export for backwards compatibility?
4. Do we want a web UI for configuration?
5. Should we build a database of problem metadata?

---

**Status**: Ready to proceed with Phase 1 (Testing)
