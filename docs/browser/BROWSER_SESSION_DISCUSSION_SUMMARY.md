# Browser Session & Pooling - Discussion Summary

**Status**: Design phase - awaiting team input  
**Impact**: Performance (2-6x faster batch scraping), UX (session persistence)  
**Effort**: 4-5 days implementation

---

## TL;DR - Key Points

### Current Problem

Every CLI command launches a fresh browser and loses session state. This means:

- ❌ Re-authenticate every time
- ❌ No session/localStorage persistence
- ❌ Slow batch operations (6-12 seconds per scrape)
- ❌ Wastes resources (10 launches for 10 scrapes)

### Available Solution

All the infrastructure is already built! We just need to connect it:

- ✅ SessionManager - persists cookies/storage
- ✅ BrowserPool - reuses browser instances
- ✅ CookieManager - manages cookies
- ✅ Configuration - all options defined

### Proposed Benefit

With proper integration:

- ⚡ **2-6x faster** batch scraping
- 🔑 **One login**, reused across operations
- 💾 **Persistent sessions** across CLI runs
- 🎯 **Better resource utilization**

---

## Three Strategic Decisions Required

### Decision 1: Session Persistence

#### Current: ❌ Sessions NOT persisted

```
Run 1: lesca scrape problem-A
  → Login
  → Scrape
  → Close browser
  → Session lost

Run 2: lesca scrape problem-B
  → Must login again 😞
```

#### Proposed: ✅ Sessions ARE persisted

```
Run 1: lesca scrape problem-A
  → Login once
  → Save session to ~/.lesca/sessions/default.json
  → Scrape

Run 2: lesca scrape problem-B (next day)
  → Load session from file
  → Restore cookies automatically
  → Scrape (already authenticated!) ✅
  → Update session timestamp
```

#### Questions for Team:

- **Q1a**: Should sessions persist by default, or be opt-in?
  - `browser.session.enabled: true` (default) vs `false`
- **Q1b**: Should users be able to manage multiple named sessions?
  - Example: `lesca scrape --session premium` vs `--session free`
- **Q1c**: How long should sessions be valid?
  - Current default: 7 days
  - Should this be configurable?

---

### Decision 2: Browser Pooling Strategy

#### Current: ❌ New browser per command

```
One browser, launched then closed
Scaling: 10 scrapes = 10 launches
Performance: 6-10s per scrape
```

#### Proposed: ✅ Reuse browser instances

```
Options A: Global pool (recommended)
  - One pool for entire CLI session
  - maxSize: 3 browsers
  - Pages created fresh for each scrape
  - Result: 1 launch, reused for all operations

Options B: Per-session pool
  - Pool per named session
  - More isolation but more memory
  - Useful if managing multiple accounts

Options C: Custom pooling
  - Config-driven sizing
  - Dynamic scaling based on load
  - Complex but flexible
```

#### Questions for Team:

- **Q2a**: Which pooling strategy?
  - Option A: Global pool (simplest)
  - Option B: Per-session pool (more isolation)
  - Option C: Custom/dynamic (most complex)
- **Q2b**: Browser pool size?
  - Recommend: `maxSize: 3` (typical laptop)
  - Should be configurable based on RAM?
- **Q2c**: Page reuse policy?
  - `reusePages: true` (faster, but state accumulation)
  - `reusePages: false` (cleaner, but slower)
  - Current recommendation: `false` (safety over speed)

---

### Decision 3: Where to Manage Pool

#### Option A: CLI level (Singleton)

```typescript
// packages/cli/src/index.ts
const browserPool = new BrowserPool(config.browser.pool)

scrapeCommand.action(async () => {
  const browser = await browserPool.acquire()
  // Use browser
})
```

**Pros**: Simple, lifecycle clear  
**Cons**: Couples CLI to browser logic

#### Option B: Core level (Injected)

```typescript
// packages/core/src/scraper.ts
export class LeetCodeScraper {
  constructor(
    ...,
    browserPool: BrowserPool
  ) {}
}
```

**Pros**: Reusable from other contexts  
**Cons**: Core becomes browser-aware

#### Option C: Factory pattern (Recommended)

```typescript
// packages/browser-automation/src/browser-factory.ts
export class BrowserFactory {
  static async getDriver(): Promise<BrowserDriver> {
    // Pool management internal
  }
}

// Usage: anywhere
const driver = await BrowserFactory.acquire()
```

**Pros**: Decoupled, clean API, reusable  
**Cons**: Requires factory pattern setup

#### Questions for Team:

- **Q3a**: Which architecture pattern?
  - Option A: Simple (CLI-level)
  - Option B: Flexible (injected)
  - Option C: Clean (factory pattern)
- **Q3b**: Should pool be process-scoped or global?
  - Process-scoped: New pool per `npm run` invocation
  - Global: Persistent pool across commands (would need daemon)
- **Q3c**: Who creates/destroys the pool?
  - Auto on CLI init/exit?
  - Manual lifecycle?

---

## Performance Impact Estimates

### Current (No Pooling)

```
Scraping 10 problems:
  Time: 80-100 seconds
  Browsers launched: 10
  Authentications: 10
  Memory peak: 200MB
```

### Proposed (With Pooling + Sessions)

```
Scraping 10 problems (same session):
  Time: 20-30 seconds           ← 3-5x faster!
  Browsers launched: 1-3         ← 90% reduction
  Authentications: 1             ← 90% reduction
  Memory peak: 300MB             ← Slightly higher

Session restoration: 100ms       ← Very fast
Browser reuse from pool: 1ms     ← Negligible
```

---

## Risk Assessment

| Risk                            | Severity | Mitigation                                       |
| ------------------------------- | -------- | ------------------------------------------------ |
| State leakage between scrapes   | Medium   | Fresh page per scrape, close pages properly      |
| Session expiry issues           | Low      | Check expiry before use, auto-refresh option     |
| Memory leak from retained pages | Medium   | Explicit page.close() in finally blocks          |
| Concurrent browser access       | Low      | Queue-based pool with async locks (already impl) |
| Browser zombie processes        | Low      | Process exit handlers                            |

All components already implemented; risk is mainly integration issues.

---

## Configuration Recommendation

```yaml
# .lesca/config.yaml
browser:
  enabled: true
  headless: true
  timeout: 30000

  # ← QUESTION 1: Should we enable sessions?
  session:
    enabled: true # Recommend: true
    name: 'default'
    autoSave: true
    autoRestore: true
    expiry: 604800000 # 7 days

  # ← QUESTION 2: Which pooling strategy?
  pool:
    enabled: true # Recommend: true
    minSize: 0 # Recommend: 0
    maxSize: 3 # ← QUESTION 2b: Appropriate size?
    maxIdleTime: 300000
    reusePages: false # Recommend: false (safety)


  # ← QUESTION 2c: Page reuse policy?
  # → Currently set to: false (safer)
  # → Could change to: true (faster)
```

---

## Decision Matrix

```
Use Case              Q1 (Sessions)  Q2 (Pool Type)  Q3 (Architecture)
──────────────────────────────────────────────────────────────────
Single scrape         false          A (global)      C (factory)
Batch scraping        true           A (global)      C (factory)
Interactive work      true           A/B (flexible)  C (factory)
CI/CD pipeline        false          A (global)      C (factory)
API server            true           B (per-session) B (injected)
Multi-account         true           B (per-session) B (injected)
```

**Consensus path**: Enable both (sessions + global pool) with conservative defaults

---

## Implementation Timeline

### If Decision Made Today

```
Week 1:
  - Create BrowserFactory (1 day)
  - Update CLI initialization (1 day)
  - Integration testing (2 days)

Week 2:
  - Add session management commands (1 day)
  - Performance benchmarks (1 day)
  - Documentation (2 days)

Total: 8-10 days
```

---

## Next Actions

### For Team to Decide:

1. **Session Persistence**:
   - [ ] Enable by default?
   - [ ] Support named sessions?
   - [ ] 7-day expiry OK?

2. **Pool Strategy**:
   - [ ] Global pool (recommended)?
   - [ ] Browser pool size: 3 OK?
   - [ ] Page reuse: fresh pages (recommended)?

3. **Architecture**:
   - [ ] Factory pattern (recommended)?
   - [ ] Process-scoped pooling?
   - [ ] Auto cleanup on exit?

### For Implementation:

1. **Prepare**: Review BROWSER_ARCHITECTURE_DISCUSSION.md
2. **Decide**: Answer the three key questions
3. **Design**: Finalize interfaces for BrowserFactory
4. **Implement**: Follow phased approach (4 phases)
5. **Test**: Benchmark performance gains

---

## Documents for Reference

- **BROWSER_ARCHITECTURE_DISCUSSION.md** - Full architectural analysis
- **BROWSER_ARCHITECTURE_DIAGRAMS.md** - Visual flows and state machines
- **Source Code**:
  - `packages/browser-automation/src/session-manager.ts` (470 lines)
  - `packages/browser-automation/src/pool.ts` (425 lines)
  - `packages/browser-automation/src/cookie-manager.ts` (456 lines)
  - `shared/config/src/defaults.ts` (configuration)

---

## Success Criteria

After implementation, we should see:

- ✅ Session persistence working across CLI runs
- ✅ Browser reuse verified (measure pool stats)
- ✅ 2-6x faster batch scraping
- ✅ No memory leaks on repeated operations
- ✅ All 795 tests still passing
- ✅ Type-safe (strict TS)
- ✅ New commands added (`lesca session ...`)

---

## Questions for Discussion

1. **Sessions**: Enable by default or opt-in?
2. **Pooling**: Global pool or per-session?
3. **Size**: 3 concurrent browsers appropriate?
4. **Reuse**: Fresh pages per scrape or reuse?
5. **Architecture**: Factory pattern preferred?
6. **Timeline**: Do we tackle this now or defer?
7. **Phases**: All 4 phases or implement MVP first?

---

## Recommendation

**Implement this now** because:

1. ✅ All components already built
2. ✅ Moderate effort (4-5 days)
3. ✅ High impact (2-6x faster batch ops)
4. ✅ Improves user experience significantly
5. ✅ Foundation for v1.0.0 stability goals

**Suggested approach**:

- Use recommended options (global pool + sessions + factory pattern)
- Implement all 4 phases (foundation + features + testing)
- Target: 1-week sprint
- Measure and document improvements
