# Browser Session Management & Pooling Architecture

**Date**: November 28, 2025  
**Status**: Design Discussion & Strategy Alignment  
**Scope**: Session persistence, browser pooling, and integration patterns

---

## Current State Analysis

### ✅ What's Already Built

#### 1. **Session Manager** (Fully Implemented)

📁 `packages/browser-automation/src/session-manager.ts`

**Capabilities**:

- ✅ Persistent session storage (cookies + localStorage + sessionStorage)
- ✅ Session metadata (created, lastUsed, expires, userAgent, description)
- ✅ Named sessions (switchable between profiles)
- ✅ Directory-based persistence (~/.lesca/sessions/)
- ✅ Sanitization against directory traversal attacks

**Currently**: Disabled in config (`browser.session.enabled: false`)

#### 2. **Cookie Manager** (Fully Implemented)

📁 `packages/browser-automation/src/cookie-manager.ts`

**Capabilities**:

- ✅ Load/save cookies from file
- ✅ Cookie validation (check expiry)
- ✅ Cookie merging strategies (keep-existing, prefer-fresh, merge-all)
- ✅ CSRF token extraction
- ✅ Auto-save capability

**Currently**: Partially integrated (CookieFileAuth handles static cookies)

#### 3. **Browser Pool** (Fully Implemented)

📁 `packages/browser-automation/src/pool.ts`

**Capabilities**:

- ✅ Browser instance pooling with min/max size
- ✅ Page reuse within browser context
- ✅ Idle timeout eviction
- ✅ Usage statistics tracking
- ✅ Graceful cleanup on shutdown
- ✅ Thread-safe queue management

**Currently**: Enabled in config (`browser.pool.enabled: true` with `maxSize: 3`)

#### 4. **Playwright Driver** (Partially Integrated)

📁 `packages/browser-automation/src/playwright-driver.ts`

**Capabilities**:

- ✅ Basic Playwright integration
- ✅ Request interception for resource blocking
- ✅ Performance monitoring
- ✅ Cookie injection
- ✅ Retry logic for navigation

**Gap**: Not using SessionManager or BrowserPool yet

---

## Current Integration Problem

### The Issue: Browser Lifecycle is Per-Command

```typescript
// packages/cli/src/commands/scrape.ts (Line 107)
const browserDriver = new PlaywrightDriver(auth?.getCredentials())
// ❌ Fresh browser created for EVERY command execution
// ❌ Browser not reused across multiple CLI invocations
// ❌ Session data not persisted between runs
```

**Current Flow**:

```
CLI: scrape problem A
  → Create PlaywrightDriver
  → Launch browser
  → Scrape
  → Browser closes (implicit on exit)
  → Session lost ❌

CLI: scrape problem B (new process)
  → Create NEW PlaywrightDriver
  → Launch browser again
  → Scrape (must re-authenticate)
  → Browser closes
  → Session lost ❌
```

**Impact**:

- No authentication state reuse
- No localStorage/sessionStorage persistence
- Every scraping operation re-authenticates
- Browser pool only works within a single CLI command
- Editorial/Discussion scraping (which needs JavaScript) slower

---

## Strategic Design Decisions

### 1️⃣ Session Persistence Goals

#### Option A: **Stateful Sessions** (Recommended)

Sessions persist authentication state across CLI runs

**Pros**:

- ✅ Re-authenticate only once, reuse across multiple scrapes
- ✅ Browser history, cache available across sessions
- ✅ Premium content access persists
- ✅ Fast editorial/discussion scraping

**Cons**:

- ⚠️ Need explicit logout to clear auth
- ⚠️ Session expiry handling required
- ⚠️ Named sessions need management

**Best For**: Power users, batch scraping, production CLI

#### Option B: **Stateless Sessions** (Current)

Fresh login for every operation

**Pros**:

- ✅ Simple, no cleanup needed
- ✅ No expired session issues
- ✅ Parallel-safe

**Cons**:

- ❌ Slow for repeated operations
- ❌ More LeetCode API calls
- ❌ Hits rate limiting faster

**Best For**: One-off scrapes, CI/CD environments

#### **Recommendation**: Hybrid Approach

```yaml
# .lesca/config.yaml
browser:
  session:
    enabled: true # Enable persistence
    name: 'default' # Default session
    autoSave: true # Auto-save state
    autoRestore: true # Auto-restore on launch
    expires: 604800000 # 7 days (in ms)

# Users can:
# - Use named sessions: lesca scrape --session premium
# - List sessions: lesca session list
# - Clear session: lesca session clear <name>
```

---

### 2️⃣ Browser Pooling Strategy

#### Option A: **Global Pool** (Recommended)

Single pool shared across all operations in a CLI session

**Architecture**:

```
CLI Process
├─ BrowserPool (singleton)
│  ├─ Browser 1 (in pool)
│  ├─ Browser 2 (in pool)
│  └─ Browser 3 (in pool)
│
└─ ScraperStrategy.execute()
   └─ Request browser from pool
   └─ Use browser
   └─ Return to pool
```

**Pros**:

- ✅ Efficient resource usage
- ✅ Shared browser instances
- ✅ Simple management
- ✅ Works with batch scraping

**Cons**:

- ⚠️ Page isolation issues (shared context)
- ⚠️ State leakage between scrapes

#### Option B: **Per-Session Pool**

Each session has its own pool

**Architecture**:

```
Session: "premium"
├─ BrowserPool
│  ├─ Browser 1
│  ├─ Browser 2
│  └─ Browser 3

Session: "free"
├─ BrowserPool
│  ├─ Browser 1
│  └─ Browser 2
```

**Pros**:

- ✅ Better isolation
- ✅ Per-session resource limits
- ✅ No state leakage

**Cons**:

- ❌ Higher memory usage (multiple pools)
- ❌ More complex management

#### **Recommendation**: Global Pool with Page Isolation

```typescript
// Browser pool is managed at CLI level
// Each strategy gets fresh page from pool's browser
const browserPool = new BrowserPool(config.browser.pool)
const browser = await browserPool.acquire()
const page = await browser.newPage() // Fresh page
// Use page
await browserPool.release(browser)
```

---

### 3️⃣ Page Reuse vs. Fresh Contexts

#### Key Decision: Should pages be reused?

```yaml
browser:
  pool:
    reusePages: true # Reuse pages or create fresh?
```

**Page Reuse (`true`)**:

```typescript
// Use same page multiple times
const browser = await pool.acquire()
const page = browser.pages()[0] // Existing page
await page.goto(url1)
// Scrape problem 1

await page.goto(url2)
// Scrape problem 2
await pool.release(browser)
```

✅ Faster, fewer resources | ❌ State accumulation

**Fresh Contexts (`false`)**:

```typescript
const browser = await pool.acquire()
const page = await browser.newPage() // Create fresh
await page.goto(url1)
// Scrape problem 1
await page.close()

const page = await browser.newPage() // New page
await page.goto(url2)
// Scrape problem 2
await pool.release(browser)
```

✅ Clean state | ❌ Slower, more memory

#### **Recommendation**: Context-based page creation

```typescript
// Create fresh page for each scrape operation
// Reuse browser for connection efficiency
const page = await browser.newPage()
try {
  // Scrape operation
} finally {
  await page.close() // Clean up
}
// Browser stays in pool for next operation
```

---

### 4️⃣ Where Should Pool Be Managed?

#### Option A: **In CLI (Singleton)**

```typescript
// packages/cli/src/index.ts
const browserPool = new BrowserPool(config.browser.pool)

scrapeCommand.action(async () => {
  const browser = await browserPool.acquire()
  // Use browser
  await browserPool.release(browser)
})
```

**Pros**:

- ✅ Single pool per CLI session
- ✅ Simple lifecycle management
- ✅ Works with batch commands

**Cons**:

- ⚠️ Couples CLI to browser logic
- ⚠️ Hard to test in isolation

#### Option B: **In Core (Injected)**

```typescript
// packages/core/src/scraper.ts
export class LeetCodeScraper {
  constructor(
    strategies: ScraperStrategy[],
    storage: StorageAdapter,
    browserPool: BrowserPool // Injected
  ) {}
}
```

**Pros**:

- ✅ Decoupled from CLI
- ✅ Reusable from other contexts
- ✅ Testable

**Cons**:

- ⚠️ Core becomes browser-aware
- ⚠️ Requires complex initialization

#### Option C: **In BrowserDriver Factory**

```typescript
// packages/browser-automation/src/browser-factory.ts
export class BrowserFactory {
  private static pool: BrowserPool

  static async getDriver(): Promise<BrowserDriver> {
    const browser = await this.pool.acquire()
    return new PlaywrightDriver(browser)
  }
}
```

**Pros**:

- ✅ Centralized browser lifecycle
- ✅ Strategies don't know about pooling
- ✅ Easy to swap implementations

**Cons**:

- ⚠️ Factory pattern complexity
- ⚠️ Global state management

#### **Recommendation**: Option C (Factory Pattern)

```typescript
// Single factory manages all browser allocation
// Strategies use factory, not pool directly
const driver = await BrowserDriverFactory.acquire()
try {
  await strategy.execute(request)
} finally {
  await driver.release()
}
```

---

## Proposed Architecture

### Simplified Integration Plan

```
CLI Layer (packages/cli/*)
  └─ Initialize config
  └─ Create SessionManager (if enabled)
  └─ Create BrowserFactory (manages pool)
  └─ Pass factory to strategies

Core Layer (packages/core/*)
  └─ LeetCodeScraper
  └─ Receives BrowserFactory
  └─ Passes to strategies

Scraper Strategies (packages/scrapers/*)
  └─ Constructor: BrowserFactory
  └─ execute(): Request driver from factory
  └─ Use driver
  └─ Release driver (factory returns to pool)

Browser Automation (packages/browser-automation/*)
  └─ BrowserPool (manages instances)
  └─ BrowserFactory (allocation/release logic)
  └─ SessionManager (persistence)
  └─ PlaywrightDriver (Playwright interface)
```

### Configuration

```yaml
# .lesca/config.yaml
browser:
  enabled: true
  headless: true
  timeout: 30000

  # Session Management
  session:
    enabled: true # Enable session persistence
    name: 'default' # Default session name
    autoSave: true # Save state on exit
    autoRestore: true # Restore state on start
    expiry: 604800000 # 7 days in ms

  # Browser Pooling
  pool:
    enabled: true # Enable pooling
    minSize: 0 # Min browsers to keep ready
    maxSize: 3 # Max concurrent browsers
    maxIdleTime: 300000 # 5 minutes
    reusePages: false # Create fresh page per scrape

  # Request Interception
  interception:
    enabled: true
    blockResources: ['image', 'font', 'media']
    captureResponses: false
```

---

## Implementation Roadmap

### Phase 1: Activation (1-2 days)

- [ ] Enable SessionManager in config
- [ ] Create BrowserFactory in packages/browser-automation
- [ ] Update CLI to instantiate factory
- [ ] Pass factory to strategies

### Phase 2: Integration (2-3 days)

- [ ] Modify strategies to use factory
- [ ] Update PlaywrightDriver to support pooling
- [ ] Test browser reuse
- [ ] Verify session persistence

### Phase 3: Enhancement (1-2 days)

- [ ] Add CLI commands:
  - `lesca session list` - List all sessions
  - `lesca session clear <name>` - Clear session
  - `lesca session switch <name>` - Switch session
- [ ] Add pool metrics:
  - `lesca debug pool-stats` - Show pool usage
- [ ] Add lifecycle hooks

### Phase 4: Testing (2-3 days)

- [ ] Test session persistence
- [ ] Test pool efficiency gains
- [ ] Test memory usage
- [ ] Test concurrent scraping

---

## Key Questions for Team

1. **Session Persistence**: Should we use the hybrid approach (optional, configurable)?
2. **Default Behavior**: Enable sessions by default or opt-in?
3. **Session Switching**: Need ability to switch between named sessions in CLI?
4. **Pool Size**: Is `maxSize: 3` appropriate for typical usage?
5. **Page Isolation**: Fresh page per scrape or reuse pages?
6. **Authentication**: Should expired sessions auto-refresh or prompt?

---

## Risks & Mitigations

| Risk                            | Impact | Mitigation                                  |
| ------------------------------- | ------ | ------------------------------------------- |
| Memory leak from retained pages | High   | Add explicit page.close() in finally blocks |
| State leakage between scrapes   | Medium | Use fresh page per operation                |
| Session expiry issues           | Medium | Add expiry validation before use            |
| Concurrent pool access          | Medium | Queue-based pool with async locks           |
| Browser process zombie          | Low    | Cleanup handlers on process exit            |

---

## Success Criteria

- ✅ Browser instance reuse working (verified via pool stats)
- ✅ Session persistence across CLI runs (no re-auth)
- ✅ Memory efficient (no leaks on repeated operations)
- ✅ Performance improvement (measure vs. current)
- ✅ All tests passing (existing + new)
- ✅ Type-safe throughout (strict TS mode)

---

## Next Steps

1. **Decide on approach**: Confirm recommendation vs. alternatives
2. **Design detailed interfaces**: Finalize factory pattern
3. **Create implementation tickets**: Break into sprints
4. **Start Phase 1**: Activate existing components
5. **Measure gains**: Document performance improvements

---

## References

- `packages/browser-automation/src/session-manager.ts` - Full implementation
- `packages/browser-automation/src/pool.ts` - Full implementation
- `packages/browser-automation/src/cookie-manager.ts` - Cookie handling
- `shared/config/src/defaults.ts` - Current configuration
- `packages/cli/src/commands/scrape.ts` - Current integration point
