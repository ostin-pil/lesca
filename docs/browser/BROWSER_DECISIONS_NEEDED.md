# Browser Architecture - Decisions Needed ⚡

**Status**: Awaiting team feedback on 3 key decisions  
**Impact**: 2-6x faster batch scraping, persistent sessions  
**Timeline**: 4-5 days if proceeding

---

## 🎯 The Three Decisions

### 1️⃣ SESSION PERSISTENCE

**Current State**: Sessions are lost when CLI exits ❌

**Question**: Should we enable session persistence by default?

```yaml
Option A: Enable Sessions by Default ← RECOMMENDED
browser.session.enabled: true
# Result:
#   - Users login once
#   - Session persists across runs
#   - Fast subsequent operations
#   - Works with named sessions (premium/free account)

Option B: Opt-In Sessions (Safer)
browser.session.enabled: false  # default
# Result:
#   - Users explicitly enable
#   - No surprise persistence
#   - Fresh login each time
#   - More CI/CD-friendly
```

**Recommendation**: **Option A** (Enable by default)

- Better user experience
- Progressive: users can disable if needed
- Session expires after 7 days anyway

---

### 2️⃣ BROWSER POOLING STRATEGY

**Current State**: Each command launches a fresh browser ❌

**Question**: Which pooling architecture?

```
Option A: Global Pool (Recommended) ← RECOMMENDED
┌──────────────────┐
│  BrowserPool     │
│  maxSize: 3      │
│ ┌──────────────┐ │
│ │  Browser 1   │ │
│ │  Browser 2   │ │
│ └──────────────┘ │
└──────────────────┘

Pro: Simple, single pool for all scrapes
Con: Shared browser contexts

Option B: Per-Session Pool
┌──────────────────┐
│ Session: premium │
│ ┌──────────────┐ │
│ │ Pool (size=3)│ │
│ └──────────────┘ │
└──────────────────┘
┌──────────────────┐
│ Session: free    │
│ ┌──────────────┐ │
│ │ Pool (size=2)│ │
│ └──────────────┘ │
└──────────────────┘

Pro: Better isolation between accounts
Con: More memory, more complexity

Option C: Custom/Dynamic Pool
Pro: Most flexible
Con: Overengineering for MVP
```

**Recommendation**: **Option A** (Global Pool)

- Simplest to implement
- Works for most users
- Can upgrade to B later if needed

**Follow-up questions**:

- Pool size: `maxSize: 3` appropriate?
- Page reuse: Fresh page per scrape or reuse?
  - **Recommend**: Fresh pages (safer)

---

### 3️⃣ POOL MANAGEMENT ARCHITECTURE

**Current State**: PlaywrightDriver created per command, no pooling ❌

**Question**: Who manages the browser pool?

```
Option A: CLI-Level (Simplest)
┌─────────────────────────┐
│ packages/cli/index.ts   │
├─────────────────────────┤
│ const pool = new        │
│   BrowserPool()         │
│                         │
│ scrapeCommand.action()→ │
│   pool.acquire()        │
│   pool.release()        │
└─────────────────────────┘

Pro: Simple, clear lifecycle
Con: Couples CLI to browser logic

Option B: Core-Level (Flexible)
┌─────────────────────────┐
│ LeetCodeScraper         │
├─────────────────────────┤
│ constructor(            │
│   pool: BrowserPool ← injected
│ )                       │
└─────────────────────────┘

Pro: Reusable from other code
Con: Core needs browser awareness

Option C: Factory Pattern (Recommended) ← RECOMMENDED
┌─────────────────────────┐
│ BrowserFactory          │
├─────────────────────────┤
│ static acquire()        │
│ static release(driver)  │
│                         │
│ (manages pool internal) │
└─────────────────────────┘

Usage anywhere:
  driver = BrowserFactory.acquire()
  // use
  BrowserFactory.release(driver)

Pro: Decoupled, clean API, reusable
Con: Requires factory pattern
```

**Recommendation**: **Option C** (Factory Pattern)

- Clean separation of concerns
- Strategies don't know about pooling
- Easy to test and maintain
- Standard pattern for resource management

---

## 📊 Decision Summary Table

| Decision         | Options                        | Recommendation | Why                               |
| ---------------- | ------------------------------ | -------------- | --------------------------------- |
| **Sessions**     | Enable / Opt-in                | **Enable**     | Better UX, expires anyway         |
| **Pool Type**    | Global / Per-session / Dynamic | **Global**     | Simplest, covers 90% of use cases |
| **Pool Size**    | 1-5 browsers                   | **3**          | Good for typical laptop/desktop   |
| **Page Reuse**   | Fresh / Reuse                  | **Fresh**      | Safety > speed for scraping       |
| **Architecture** | CLI / Core / Factory           | **Factory**    | Cleanest, most reusable           |

---

## 🚀 Recommended Configuration

```yaml
# .lesca/config.yaml
browser:
  enabled: true
  headless: true
  timeout: 30000

  # DECISION 1: Session Persistence
  session:
    enabled: true              ← RECOMMENDED
    name: 'default'
    autoSave: true
    autoRestore: true
    expiry: 604800000 # 7 days

  # DECISION 2 & 3: Pooling
  pool:
    enabled: true              ← RECOMMENDED
    minSize: 0
    maxSize: 3                 ← RECOMMENDED SIZE
    maxIdleTime: 300000 # 5 minutes
    reusePages: false          ← RECOMMENDED (safety)
```

---

## 📈 Expected Performance Impact

### Before (Current)

```
10 scrapes = 80-100 seconds
├─ Browser launches: 10 (expensive!)
├─ Authentications: 10
└─ Total memory: 200MB peak
```

### After (Recommended)

```
10 scrapes = 20-30 seconds      ← 3-5x FASTER! 🚀
├─ Browser launches: 1-3
├─ Authentications: 1
└─ Total memory: 300MB peak
```

---

## ✅ Implementation Checklist

### If Decision is "YES, PROCEED":

```
Week 1:
  [ ] Approve 3 decisions
  [ ] Create BrowserFactory implementation design
  [ ] Update PlaywrightDriver for pool integration
  [ ] Integrate SessionManager with auth

Week 2:
  [ ] Add CLI session commands
  [ ] Performance testing
  [ ] Update documentation
  [ ] Test with real scraping

Results:
  ✅ Faster batch operations
  ✅ Persistent user sessions
  ✅ Better resource utilization
```

---

## 🎓 Reference Documents

For detailed analysis:

- **BROWSER_ARCHITECTURE_DISCUSSION.md** (5 pages)
  - Full pros/cons for each decision
  - Implementation details
  - Risk analysis

- **BROWSER_ARCHITECTURE_DIAGRAMS.md** (8 pages)
  - Visual state machines
  - Memory comparison
  - Request flow diagrams

- **Source Code** (Already implemented!)
  - `packages/browser-automation/src/session-manager.ts` (470 lines)
  - `packages/browser-automation/src/pool.ts` (425 lines)
  - `packages/browser-automation/src/cookie-manager.ts` (456 lines)

---

## 🤔 Quick Q&A

**Q: Will this break existing functionality?**  
A: No, it's purely additive. Existing CLI still works.

**Q: Do users need to change config?**  
A: No, we're providing smart defaults.

**Q: What if sessions cause issues?**  
A: Easy to disable: `browser.session.enabled: false`

**Q: How do users manage sessions?**  
A: New commands: `lesca session list`, `lesca session clear <name>`

**Q: Will this use more memory?**  
A: Slightly (3 browsers ~300MB vs fresh launch 200MB). Worth it for 3-5x speed.

**Q: Can we do this incrementally?**  
A: Yes, Phase 1 activates existing code (1-2 days), rest is enhancement.

---

## 🗣️ What We Need From You

**Please confirm:**

1. ✅/❌ Enable sessions by default?
2. ✅/❌ Use global pool (not per-session)?
3. ✅/❌ 3 browsers OK for max pool size?
4. ✅/❌ Factory pattern for management?
5. ✅/❌ Proceed with 4-day implementation?

---

## 📌 Recommendation Summary

**Proceed with:** Option A + Option A + Option C (Recommended path)

- **Effort**: 4-5 days
- **Impact**: 3-5x faster batch operations
- **Risk**: Low (all components built, integration risk only)
- **Benefit**: Huge UX improvement, foundation for v1.0
- **Timeline**: Fits well before v1.0.0 sprint

---

## 🚦 Decision Timeline

- **Today**: Review this document
- **Tomorrow**: Team discussion (30 mins)
- **Day 3**: Confirm decisions
- **Days 4-8**: Implementation sprint
- **Day 9**: Testing and documentation
- **Day 10**: Merged and ready

---

**Status**: Waiting for your decision! 🎯
