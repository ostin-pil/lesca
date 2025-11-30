# Browser Architecture - Visual Diagrams

---

## Current State (Before Implementation)

### Single Command Execution

```
┌─────────────────────────────────────────────┐
│          CLI: lesca scrape two-sum          │
└─────────────────────────────────────────────┘
  │
  ├─ new PlaywrightDriver()
  │  │
  │  └─ launch()
  │     ├─ chromium.launch()     [5-10s]
  │     └─ newPage()             [1-2s]
  │
  ├─ EditorialScraperStrategy.execute()
  │  ├─ navigate(url)
  │  ├─ waitForSelector()
  │  └─ evaluate() + screenshot()
  │
  └─ 🔴 browser.close()           [Session LOST]

─────────────────────────────────────────────
⏱️  TOTAL TIME: 6-12 seconds
💾 SESSION: ❌ Lost on exit
🔑 AUTH: ❌ Must re-authenticate next run
────────────────────────────────────────────
```

### Multiple Commands (Sequential)

```
┌──────────────────────────┐
│ CLI: lesca scrape A      │
└──────────────────────────┘
  Launch browser → Scrape → Close
  Auth: Need login ⚠️

         [5 min later]

┌──────────────────────────┐
│ CLI: lesca scrape B      │
└──────────────────────────┘
  Launch browser → Scrape → Close ❌ SESSION LOST!
  Auth: Need login AGAIN ⚠️

─────────────────────────────
😞 Result:
  - 2 browser launches (expensive)
  - 2 authentications (rate limit issue)
  - No session reuse
  - 12-24 seconds total
```

---

## Proposed State (After Implementation)

### Single CLI Process with Session + Pool

```
┌─────────────────────────────────────────────┐
│       CLI: lesca scrape-list --count 10     │
└─────────────────────────────────────────────┘
  │
  ├─ [1] SessionManager.load('default')
  │      └─ Restore cookies, localStorage
  │         ├─ Check expiry ✅
  │         └─ Validate auth ✅
  │
  ├─ [2] BrowserFactory.initialize(pool)
  │      └─ Create BrowserPool
  │         ├─ minSize: 0
  │         ├─ maxSize: 3
  │         └─ maxIdleTime: 5 min
  │
  ├─ [3] For each problem (10 items):
  │      │
  │      ├─ Strategy.execute()
  │      │  │
  │      │  ├─ driver = await factory.acquire()
  │      │  │          (reuses from pool if available)
  │      │  │
  │      │  ├─ page = await browser.newPage()
  │      │  │
  │      │  ├─ await page.goto(url)
  │      │  │  └─ Uses injected cookies ✅ (no new login!)
  │      │  │
  │      │  ├─ Scrape content
  │      │  │
  │      │  └─ await page.close()
  │      │      await factory.release(driver)
  │      │      (returns browser to pool)
  │      │
  │      └─ SessionManager.save()
  │         (Auto-save after each scrape)
  │
  └─ [4] On exit: SessionManager.persist()
         └─ Save cookies, localStorage, sessionStorage
            └─ Ready for next CLI run ✅

─────────────────────────────────────────────
⏱️  TIMING BREAKDOWN:
   Session restore:         100ms (from file)
   First browser launch:    8-10s (one time cost!)
   Scrape 1:                1-2s (browser reused)
   Scrape 2:                1-2s (browser reused)
   Scrape 3:                1-2s (browser reused)
   ───────────────────────────
   TOTAL: 12-16s (vs 20-40s without pooling!)

💾 SESSION: ✅ Persisted across runs
🔑 AUTH: ✅ One login, reused for all
────────────────────────────────────────────
```

---

## Browser Pool State Machine

```
┌─────────────────────────────────────────────────────┐
│         BROWSER POOL STATE MACHINE                  │
└─────────────────────────────────────────────────────┘

                    IDLE
              [Browser waiting]
                    │
                    │ acquire()
                    ↓
              ┌──────────────┐
              │   IN_USE     │
              │ [Scraping]   │
              └──────────────┘
                    │
         ┌──────────┴──────────┐
         ↓                     ↓
      release()            maxIdleTime
         │                  exceeded
         │                     │
         ↓                     ↓
    IDLE or ACTIVE       EVICTED
    [Back to pool]       [Destroyed]
         │
    [Reused next time!]

─────────────────────────────────────────
Example: maxSize=3, maxIdleTime=5min

Time    Pool State       Action
──────────────────────────────────────
0:00    [idle pool]
0:10    [Browser 1]      acquire()
        in use
0:30    [B1, Browser 2]  acquire() again
        in use
0:35    [B1, B2]         release() B1
        in use    (1 idle)
0:45    [B1, B2,         acquire() again
        Browser 3]       (creates new)
1:00    [B1, B2, B3]     release() B2
        all idle
5:30    [B1, B2, B3]     Clean up interval
        (idle 5 min)     runs
        →[B1, B3]        B2 evicted!
                         (maxIdleTime exceeded)
────────────────────────────────────────
```

---

## Session Lifecycle

```
┌────────────────────────────────────────────────────┐
│            SESSION LIFECYCLE                       │
└────────────────────────────────────────────────────┘

[First Run]
┌─────────────────────────────┐
│ lesca scrape --auth         │
│ (No session exists)         │
└─────────────────────────────┘
  │
  ├─ SessionManager.restore()
  │  └─ No session found
  │
  ├─ PlaywrightDriver.launch()
  │  └─ Empty context (no cookies)
  │
  ├─ CookieFileAuth.authenticate()
  │  └─ User: manual login via browser
  │     or cookie file import
  │
  ├─ BrowserDriver.injectCookies()
  │  └─ Set session cookies
  │
  ├─ Scrape content
  │
  └─ SessionManager.save('default')
     └─ ~/.lesca/sessions/default.json
        {
          name: 'default',
          cookies: [...]
          localStorage: {...},
          sessionStorage: {...},
          metadata: {
            created: 1701234567890,
            lastUsed: 1701234567890,
            expires: 1702000000000, // 7 days
            userAgent: '...'
          }
        }

[Second Run - Same Day]
┌─────────────────────────────┐
│ lesca scrape two-sum        │
│ (Same process)              │
└─────────────────────────────┘
  │
  ├─ SessionManager.restore()
  │  ├─ Load: ~/.lesca/sessions/default.json
  │  ├─ Check expiry: 1702000000000 > now? ✅ Valid
  │  └─ Return session data
  │
  ├─ PlaywrightDriver.launch()
  │  └─ BrowserContext initialized
  │
  ├─ CookieManager.injectCookies()
  │  └─ Restore all cookies from session
  │     └─ User already authenticated! ✅
  │
  ├─ Scrape content (using authenticated session)
  │
  └─ SessionManager.update()
     └─ Update lastUsed timestamp
        {
          ...same data...
          metadata: {
            ...
            lastUsed: 1701234999890  // Updated
          }
        }

[After 7 Days]
┌─────────────────────────────┐
│ lesca scrape climbing-stairs│
└─────────────────────────────┘
  │
  ├─ SessionManager.restore()
  │  ├─ Load: ~/.lesca/sessions/default.json
  │  ├─ Check expiry: 1702000000000 > now? ❌ Expired!
  │  └─ Return null
  │
  ├─ SessionManager.handle(expiredSession)
  │  ├─ Option 1: autoRefresh (if enabled)
  │  │   └─ Attempt to refresh cookies
  │  │   └─ If fail → ask user to login
  │  │
  │  └─ Option 2: prompt user
  │      └─ "Session expired. Please login: lesca auth"
  │
  ├─ User logs in (new session)
  │
  └─ SessionManager.save('default')
     └─ New session with fresh expiry

[Named Sessions]
┌─────────────────────────────┐
│ lesca scrape --session      │
│         premium             │
└─────────────────────────────┘
  │
  ├─ SessionManager.restore('premium')
  │  └─ Load: ~/.lesca/sessions/premium.json
  │
  ├─ (continue as above with premium auth)
  │
  └─ SessionManager.save('premium')

─────────────────────────────
Cleanup: lesca session clear <name>
  └─ Delete ~/.lesca/sessions/<name>.json
─────────────────────────────
```

---

## Memory Usage Comparison

```
┌─────────────────────────────────────────────┐
│  MEMORY: 10 Sequential Scrapes              │
└─────────────────────────────────────────────┘

WITHOUT POOLING (Current):
┌─────────────────────────────────────────────┐
│ Scrape 1: Launch   [████████] 200MB (peak)  │
│           Close    [         ] 0MB          │
│ Scrape 2: Launch   [████████] 200MB (peak)  │
│           Close    [         ] 0MB          │
│ Scrape 3: Launch   [████████] 200MB (peak)  │
│           Close    [         ] 0MB          │
│ ...                                         │
│ Scrape 10: Launch  [████████] 200MB (peak)  │
│            Close   [         ] 0MB          │
└─────────────────────────────────────────────┘
Total Peak: 200MB, 10 launches/closes

WITH POOLING (Proposed):
┌─────────────────────────────────────────────┐
│ Init:  Launch Pool [████████████] 300MB     │
│                    [████████    ] 250MB     │
│        (maxSize=3)  [████████   ] 200MB     │
│                                             │
│ Scrape 1-3:        [████████   ] 200MB     │
│ (use pool pages)   [████████   ] 200MB     │
│ Scrape 4-6:        [████████   ] 200MB     │
│ (reuse browsers)                            │
│ Scrape 7-10:       [████████   ] 200MB     │
│ (reuse browsers)                            │
│                                             │
│ Cleanup:           [         ] 0MB          │
└─────────────────────────────────────────────┘
Total Peak: 300MB (saves launch/close overhead)
Launches: 1-3 (vs 10!)
```

---

## Factory Pattern: Request Flow

```
┌──────────────────────────────────────────────┐
│      BROWSER FACTORY REQUEST FLOW            │
└──────────────────────────────────────────────┘

Strategy.execute()
  │
  ├─ driver = await BrowserFactory.acquire()
  │  │
  │  └─ BrowserFactory
  │     │
  │     ├─ if (pool.hasIdle())
  │     │  └─ return pool.pop()  [Fast!]
  │     │     └─ ~1ms
  │     │
  │     └─ else if (pool.size < maxSize)
  │        └─ create new browser [Slow]
  │           └─ ~8-10s
  │
  ├─ page = await driver.newPage()
  │
  ├─ await page.goto(url)
  │  └─ Session cookies injected automatically
  │
  ├─ Scrape content
  │
  ├─ await page.close()
  │
  └─ await BrowserFactory.release(driver)
     │
     └─ BrowserFactory.pool
        │
        ├─ Mark as idle
        ├─ Update lastUsedAt
        └─ Available for next acquire()

─────────────────────────────────────────────
Performance:
  First scrape:  8-10s (browser launch)
  Next scrapes:  1-3s each (reused browsers)

  Batch of 10:   8-10s + 9-27s = 17-37s
  vs no pool:    80-100s (10 launches)

  SPEEDUP: 2-6x ⚡
──────────────────────────────────────────────
```

---

## Configuration Decision Tree

```
┌─────────────────────────────────────────────┐
│       CONFIGURATION DECISION FLOW           │
└─────────────────────────────────────────────┘

Are you running a single scrape?
├─ YES → browser.pool.enabled: true (still helps)
│        browser.session.enabled: false (ephemeral)
│
└─ NO → Are you doing batch scraping?
   ├─ YES → browser.pool.enabled: true ✅
   │        browser.session.enabled: true ✅
   │        browser.pool.maxSize: 2-5
   │        browser.pool.reusePages: false
   │
   └─ NO → Are you in CI/CD?
      ├─ YES → browser.pool.enabled: true
      │        browser.session.enabled: false
      │        (Fresh auth per run)
      │
      └─ NO → Are you doing interactive work?
         ├─ YES → browser.pool.enabled: true ✅
         │        browser.session.enabled: true ✅
         │        browser.session.name: custom
         │
         └─ Standard user?
            └─ Use defaults:
               ├─ session.enabled: true ✅
               ├─ pool.enabled: true ✅
               ├─ pool.maxSize: 3
               └─ pool.reusePages: false ✅
```

---

## State Diagram: Page Lifecycle

```
┌──────────────────────────────────────────┐
│      PAGE LIFECYCLE IN BROWSER           │
└──────────────────────────────────────────┘

Browser acquired from pool
  │
  ├─ newPage()
  │  ├─ Navigation: Blank
  │  ├─ Cookies: Inherited from browser context
  │  └─ Storage: Clean (unless reusePages: true)
  │
  ├─ goto(url)
  │  ├─ Cookies: Injected from session ✅
  │  └─ Content: Loaded
  │
  ├─ evaluate() / getText() / screenshot()
  │  └─ Scraping operations
  │
  └─ close()
     ├─ Page memory freed
     ├─ Cookies NOT cleared
     │  (retained in browser context)
     ├─ localStorage NOT cleared
     │  (retained in browser context)
     └─ Browser returned to pool

Next usage of same browser:
  └─ newPage() again
     ├─ Cookies: Same as before
     │  (if reusePages: true)
     └─ OR
        └─ Clean page
           (if reusePages: false)

─────────────────────────────────────────
Key point:
- Cookies persist at BROWSER level
- SessionStorage persists at CONTEXT level
- Each page.close() prevents state leakage
- Browser context keeps auth cookies
──────────────────────────────────────────
```

---

## Implementation Checklist

```
Phase 1: Activation
─────────────────────
[ ] Enable SessionManager in config
[ ] Enable BrowserPool in config
[ ] Create BrowserFactory class
[ ] Update CLI to initialize factory
[ ] Update scraper constructors to accept factory

Phase 2: Integration
─────────────────────
[ ] Update PlaywrightDriver to use pool
[ ] Modify strategies to request browsers from factory
[ ] Test browser reuse
[ ] Test session persistence
[ ] Fix any state leakage issues

Phase 3: Commands
─────────────────────
[ ] lesca session list
[ ] lesca session clear <name>
[ ] lesca session switch <name>
[ ] lesca session show <name>

Phase 4: Testing
─────────────────────
[ ] Unit tests for BrowserFactory
[ ] Unit tests for SessionManager pool integration
[ ] Integration tests for batch scraping
[ ] Memory leak tests
[ ] Performance benchmarks

Phase 5: Documentation
─────────────────────
[ ] Update CLI_REFERENCE.md
[ ] Update CONFIGURATION.md
[ ] Add session examples to EXAMPLES.md
[ ] Document pool metrics
```
