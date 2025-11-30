---
description: Session Management and Browser Pooling Implementation Plan
alwaysApply: true
---

# Lesca: Session Management & Browser Pooling Implementation

## Executive Summary

This document outlines the implementation strategy for a **hybrid session & browser pooling system** in Lesca. The architecture supports:

- **Named, switchable sessions** with persistent authentication state (cookies, localStorage, sessionStorage)
- **Hybrid browser pooling** (per-session by default, global fallback)
- **Configurable page lifecycle** per strategy (reuse vs. fresh contexts)
- **Dependency injection** pattern for pool management
- **Sessions stored in** `~/.lesca/sessions/` with JSON persistence

---

## 1. Session Management Architecture

### 1.1 Current State

**Already Implemented (SessionManager)**:

- ✅ Session creation, retrieval, deletion
- ✅ Persistent storage in `~/.lesca/sessions/{name}.json`
- ✅ Cookie/localStorage/sessionStorage capture & restoration
- ✅ Session metadata (created, lastUsed, expires, userAgent, description)
- ✅ Expiration checking & cleanup

**Location**: `packages/browser-automation/src/session-manager.ts`

### 1.2 Session Storage Structure

```json
{
  "name": "premium",
  "cookies": [
    {
      "name": "LEETCODE_SESSION",
      "value": "...",
      "domain": ".leetcode.com",
      "path": "/",
      "expires": 1893456000,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "localStorage": {
    "app_theme": "dark",
    "preferred_language": "python3"
  },
  "sessionStorage": {
    "temp_cache": "..."
  },
  "metadata": {
    "created": 1732867200000,
    "lastUsed": 1732867800000,
    "expires": 1735545600000,
    "userAgent": "Mozilla/5.0...",
    "description": "Premium account for paid problems"
  }
}
```

### 1.3 Configuration Integration

**Schema** (`shared/config/src/schema.ts`):

```typescript
session: z.object({
  enabled: z.boolean().default(false),
  name: z.string().default('default'),
  autoSave: z.boolean().default(true),
  autoRestore: z.boolean().default(true),
  persistAcrossRuns: z.boolean().default(false), // NEW: per-command configurability
})
```

**Defaults** (`shared/config/src/defaults.ts`):

```typescript
session: {
  enabled: false,
  name: 'default',
  autoSave: true,
  autoRestore: true,
  persistAcrossRuns: false,
}
```

### 1.4 CLI Integration Points

**New Option for Scrape Commands**:

```bash
lesca scrape two-sum --session premium --session-persist
lesca scrape-list problems.txt --session free
lesca scrape-editorial --session-persist --session test
```

**Command Options**:

- `--session <name>` - Use named session (default: 'default')
- `--session-persist` - Persist session state across CLI runs (optional)
- `--session-list` - List available sessions
- `--session-delete <name>` - Delete a session
- `--session-rename <old> <new>` - Rename a session

**Implementation Location**: `packages/cli/src/commands/*`

---

## 2. Browser Pooling Architecture

### 2.1 Current State

**Already Implemented (BrowserPool)**:

- ✅ Pool with configurable min/max size (default: 0 min, 3 max)
- ✅ Browser acquisition & release
- ✅ Idle browser cleanup (5-minute default)
- ✅ Page reuse within browser context
- ✅ Connection monitoring & recovery
- ✅ Statistics tracking

**Location**: `packages/browser-automation/src/pool.ts`

### 2.2 Hybrid Pooling Strategy

**Per-Session Pooling (Default)**:

```
Session: premium
├── BrowserPool (private to session)
│   ├── Browser 1 (idle)
│   ├── Browser 2 (in-use)
│   └── Browser 3 (idle)

Session: free
├── BrowserPool (separate instance)
│   ├── Browser 4 (idle)
│   └── Browser 5 (in-use)

Global Pool (fallback)
├── Used only if per-session pool exhausted
```

**Pool Hierarchy**:

1. **Session-scoped pool** (preferred) - owns browsers, respects session isolation
2. **Global pool** (fallback) - shared across sessions only if session pool full
3. **Single browser** (emergency) - if all pools exhausted

### 2.3 BrowserPool Integration via Dependency Injection

**PlaywrightDriver Constructor** (modified):

```typescript
export class PlaywrightDriver implements BrowserDriver {
  private browser?: Browser
  private page?: Page
  private pool?: BrowserPool
  private sessionName?: string

  constructor(
    private auth?: AuthCredentials,
    pool?: BrowserPool,  // NEW: dependency injection
    sessionName?: string // NEW: session context
  ) {
    this.pool = pool
    this.sessionName = sessionName
  }

  async launch(options: BrowserLaunchOptions = {}): Promise<void> {
    if (this.pool) {
      this.browser = await this.pool.acquire()
    } else {
      this.browser = await chromium.launch({...})
    }
    // Rest of initialization...
  }

  async close(): Promise<void> {
    if (this.pool && this.browser) {
      await this.pool.release(this.browser)
    } else if (this.browser) {
      await this.browser.close()
    }
  }
}
```

### 2.4 Pool Configuration

**Config Schema** (`shared/config/src/schema.ts`):

```typescript
pool: z.object({
  enabled: z.boolean().default(true),
  strategy: z.enum(['per-session', 'global', 'hybrid']).default('hybrid'),
  minSize: z.number().min(0).default(0),
  maxSize: z.number().min(1).default(3),
  maxIdleTime: z.number().default(300000), // 5 minutes
  reusePages: z.boolean().default(true),
  globalMaxSize: z.number().min(1).default(5), // NEW: global pool limit
})
```

---

## 3. Strategy Configuration

### 3.1 Strategy Page Lifecycle

**New Interface** (`packages/scrapers/src/types.ts`):

```typescript
export interface StrategyConfig {
  pageReuse: 'always' | 'never' | 'auto'
  contextIsolation: 'strict' | 'shared'
  timeout: number
  retries: number
}

export interface ScraperStrategy {
  config?: StrategyConfig
  // ... existing methods
}
```

**Defaults per Strategy**:

- **ProblemScraperStrategy**: `pageReuse: 'auto'` (reuse within session)
- **ListScraperStrategy**: `pageReuse: 'never'` (fresh context per item)
- **EditorialScraperStrategy**: `pageReuse: 'auto'`
- **DiscussionScraperStrategy**: `pageReuse: 'never'`

### 3.2 Strategy Request Flow

```typescript
// In LeetCodeScraper.ts (facade)
async scrape(request: ScrapeRequest): Promise<ScrapeResult> {
  const strategy = this.selectStrategy(request)
  const config = strategy.config || DEFAULT_CONFIG

  // 1. Get browser from pool or create new
  const driver = new PlaywrightDriver(
    this.auth,
    this.browserPool,  // Dependency injection
    this.sessionName
  )

  // 2. Respect strategy's page lifecycle preference
  if (config.pageReuse === 'never') {
    await driver.launch({ createFreshContext: true })
  } else {
    await driver.launch()
  }

  // 3. Restore session if available
  if (this.sessionManager && this.sessionName) {
    await this.sessionManager.restoreSession(
      this.sessionName,
      driver.getContext()
    )
  }

  // 4. Execute strategy
  const result = await strategy.execute(request)

  // 5. Auto-save session if configured
  if (config.pageReuse === 'auto' && this.sessionName) {
    await this.sessionManager?.createSession(
      this.sessionName,
      driver.getContext()
    )
  }

  // 6. Release driver (returns browser to pool)
  await driver.close()

  return result
}
```

---

## 4. File Organization & Storage

### 4.1 Directory Structure

```
~/.lesca/
├── sessions/                 # Session data
│   ├── default.json        # Default session
│   ├── premium.json        # Premium account
│   ├── free.json           # Free account
│   └── test.json           # Test session
├── cache/                  # Existing cache directory
├── cookies.json            # Legacy cookie file (deprecated)
├── config.yaml             # Main config
└── logs/                   # Logs directory
```

### 4.2 Session Manager Updates

**Constructor & Initialization**:

```typescript
export class SessionManager {
  private sessionsDir: string

  constructor(baseDir?: string) {
    // Priority:
    // 1. Constructor param
    // 2. LESCA_SESSIONS_DIR env var
    // 3. Default: ~/.lesca/sessions
    this.sessionsDir =
      baseDir || process.env.LESCA_SESSIONS_DIR || resolve(homedir(), '.lesca', 'sessions')
  }
}
```

### 4.3 New Methods in SessionManager

```typescript
// Rename session
async renameSession(oldName: string, newName: string): Promise<void>

// List active sessions (not expired)
async listActiveSessions(): Promise<SessionData[]>

// Get session size/metadata
async getSessionInfo(name: string): Promise<SessionMetadata | null>

// Validate session before use
async validateSession(name: string): Promise<boolean>

// Merge sessions (combine cookies/storage from multiple sessions)
async mergeSessions(
  sourceNames: string[],
  targetName: string,
  strategy: 'keep-existing' | 'prefer-fresh' | 'merge-all'
): Promise<void>
```

---

## 5. Core Implementation: SessionPoolManager

### 5.1 New Class (Per-Session Pool Management)

**Location**: `packages/browser-automation/src/session-pool-manager.ts`

```typescript
/**
 * Manages per-session browser pools with fallback to global pool
 */
export class SessionPoolManager {
  private sessionPools: Map<string, BrowserPool> = new Map()
  private globalPool?: BrowserPool
  private config: Required<SessionPoolConfig>

  constructor(
    config: SessionPoolConfig = {},
    globalPoolConfig?: BrowserPoolConfig
  ) {
    this.config = {
      strategy: config.strategy ?? 'hybrid',
      perSessionMaxSize: config.perSessionMaxSize ?? 3,
      globalMaxSize: config.globalMaxSize ?? 5,
      ...
    }

    if (this.config.strategy === 'global' || this.config.strategy === 'hybrid') {
      this.globalPool = new BrowserPool({
        maxSize: this.config.globalMaxSize,
        ...globalPoolConfig,
      })
    }
  }

  /**
   * Get or create pool for session
   */
  async getPool(sessionName: string): Promise<BrowserPool> {
    if (this.config.strategy === 'global') {
      return this.globalPool!
    }

    if (!this.sessionPools.has(sessionName)) {
      this.sessionPools.set(
        sessionName,
        new BrowserPool({
          maxSize: this.config.perSessionMaxSize,
          ...this.config,
        })
      )
    }

    return this.sessionPools.get(sessionName)!
  }

  /**
   * Try per-session pool, fallback to global
   */
  async acquireBrowser(sessionName: string): Promise<Browser> {
    if (this.config.strategy === 'hybrid') {
      try {
        const sessionPool = await this.getPool(sessionName)
        return await sessionPool.acquire()
      } catch (error) {
        if (this.globalPool) {
          logger.warn('Session pool full, using global pool')
          return await this.globalPool.acquire()
        }
        throw error
      }
    }

    const pool = await this.getPool(sessionName)
    return await pool.acquire()
  }

  /**
   * Release browser back to appropriate pool
   */
  async releaseBrowser(
    browser: Browser,
    sessionName?: string
  ): Promise<void> {
    if (sessionName && this.sessionPools.has(sessionName)) {
      await this.sessionPools.get(sessionName)!.release(browser)
    } else if (this.globalPool) {
      await this.globalPool.release(browser)
    }
  }

  /**
   * Cleanup session pool
   */
  async drainSessionPool(sessionName: string): Promise<void> {
    const pool = this.sessionPools.get(sessionName)
    if (pool) {
      await pool.drain()
      this.sessionPools.delete(sessionName)
    }
  }

  /**
   * Drain all pools
   */
  async drainAll(): Promise<void> {
    const promises: Promise<void>[] = []
    for (const pool of this.sessionPools.values()) {
      promises.push(pool.drain())
    }
    if (this.globalPool) {
      promises.push(this.globalPool.drain())
    }
    await Promise.all(promises)
  }
}
```

---

## 6. CLI Command Updates

### 6.1 Scrape Command (Updated)

**File**: `packages/cli/src/commands/scrape.ts`

```typescript
interface ScrapeOptions {
  output: string
  format: 'markdown' | 'obsidian'
  cookies?: string
  session?: string // NEW
  sessionPersist?: boolean // NEW
  sessionList?: boolean // NEW
  cacheDir: string
  cache: boolean
  auth: boolean
}

export const scrapeCommand = new Command('scrape')
  .option('--session <name>', 'Use named session (default: "default")')
  .option('--session-persist', 'Persist session state across CLI invocations')
  .option('--session-list', 'List available sessions')
  .action(async (problem: string, options: ScrapeOptions) => {
    const sessionName = options.session || 'default'
    const shouldPersist = options.sessionPersist || config.browser.session.persistAcrossRuns

    // 1. Initialize SessionPoolManager
    const poolManager = new SessionPoolManager({
      strategy: config.browser.pool.strategy,
      perSessionMaxSize: config.browser.pool.maxSize,
      globalMaxSize: 5,
    })

    // 2. Initialize SessionManager
    const sessionManager = new SessionManager()

    // 3. Create driver with pool injection
    const browser = await poolManager.acquireBrowser(sessionName)
    const driver = new PlaywrightDriver(
      auth?.getCredentials(),
      poolManager, // Pass pool manager for release()
      sessionName
    )

    try {
      await driver.launch(config.browser)

      // 4. Restore session if exists
      if (options.session) {
        const restored = await sessionManager.restoreSession(sessionName, driver.getContext())
        if (!restored) {
          logger.warn(`Session "${sessionName}" not found, using fresh session`)
        }
      }

      // 5. Execute scraping
      const result = await scraper.scrape(request)

      // 6. Save session if configured
      if (shouldPersist && options.session) {
        await sessionManager.createSession(sessionName, driver.getContext(), {
          description: `Auto-saved from ${new Date().toISOString()}`,
        })
      }
    } finally {
      await driver.close()
      await poolManager.drainSessionPool(sessionName)
    }
  })
```

### 6.2 New Session Management Commands

**File**: `packages/cli/src/commands/session.ts` (NEW)

```typescript
export const sessionCommand = new Command('session').description('Manage browser sessions')

sessionCommand
  .command('list')
  .description('List all saved sessions')
  .action(async () => {
    const sessionManager = new SessionManager()
    const sessions = await sessionManager.listActiveSessions()

    if (sessions.length === 0) {
      logger.info('No sessions found')
      return
    }

    for (const session of sessions) {
      logger.info(`
        ${session.name}
        Created: ${new Date(session.metadata.created).toISOString()}
        Last Used: ${new Date(session.metadata.lastUsed).toISOString()}
        Cookies: ${session.cookies.length}
        Description: ${session.metadata.description || 'N/A'}
      `)
    }
  })

sessionCommand
  .command('delete <name>')
  .description('Delete a session')
  .action(async (name: string) => {
    const sessionManager = new SessionManager()
    const deleted = await sessionManager.deleteSession(name)
    if (deleted) {
      logger.info(`Session "${name}" deleted`)
    } else {
      logger.warn(`Session "${name}" not found`)
    }
  })

sessionCommand
  .command('rename <old> <new>')
  .description('Rename a session')
  .action(async (oldName: string, newName: string) => {
    const sessionManager = new SessionManager()
    await sessionManager.renameSession(oldName, newName)
    logger.info(`Session renamed: "${oldName}" -> "${newName}"`)
  })

sessionCommand
  .command('info <name>')
  .description('Show session details')
  .action(async (name: string) => {
    const sessionManager = new SessionManager()
    const session = await sessionManager.getSession(name)
    if (!session) {
      logger.warn(`Session "${name}" not found`)
      return
    }

    logger.info(`
      Session: ${session.name}
      Created: ${new Date(session.metadata.created).toISOString()}
      Last Used: ${new Date(session.metadata.lastUsed).toISOString()}
      Expires: ${
        session.metadata.expires ? new Date(session.metadata.expires).toISOString() : 'Never'
      }
      Cookies: ${session.cookies.length}
      LocalStorage Keys: ${Object.keys(session.localStorage).length}
      SessionStorage Keys: ${Object.keys(session.sessionStorage).length}
      Description: ${session.metadata.description || 'N/A'}
    `)
  })
```

---

## 7. Type Definitions

### 7.1 New Interfaces (shared/types/src/index.ts)

```typescript
export interface SessionPoolConfig {
  strategy: 'per-session' | 'global' | 'hybrid'
  perSessionMaxSize: number
  globalMaxSize: number
  perSessionIdleTime: number
  globalIdleTime: number
}

export interface BrowserDriverOptions {
  auth?: AuthCredentials
  pool?: BrowserPool | SessionPoolManager
  sessionName?: string
  contextIsolation?: 'strict' | 'shared'
}

export interface StrategyExecutionConfig {
  pageReuse: 'always' | 'never' | 'auto'
  contextIsolation: 'strict' | 'shared'
  timeout: number
  retries: number
  sessionName?: string
}
```

---

## 8. Implementation Checklist

### Phase 1: Configuration & Types

- [ ] Update `BrowserConfig` schema with session persistence options
- [ ] Add `pool.strategy` to config schema ('per-session', 'global', 'hybrid')
- [ ] Create type definitions for `SessionPoolConfig`, `BrowserDriverOptions`
- [ ] Create `SessionPoolManager` class
- [ ] Update defaults to support session-based pooling

### Phase 2: PlaywrightDriver & Pool Integration

- [ ] Modify `PlaywrightDriver` constructor to accept `pool` & `sessionName`
- [ ] Update `launch()` to use injected pool
- [ ] Update `close()` to release browser to pool
- [ ] Preserve non-null assertion comment style

### Phase 3: SessionManager Enhancements

- [ ] Add `renameSession()` method
- [ ] Add `listActiveSessions()` method
- [ ] Add `validateSession()` method
- [ ] Add `mergeSessions()` method
- [ ] Add auto-save on scraper completion

### Phase 4: CLI Command Updates

- [ ] Add `--session <name>` option to scrape commands
- [ ] Add `--session-persist` flag
- [ ] Create `session.ts` command module
- [ ] Implement session list/delete/rename/info subcommands
- [ ] Update scrape command to use SessionPoolManager

### Phase 5: Strategy Configuration

- [ ] Add `config?` property to `ScraperStrategy` interface
- [ ] Implement per-strategy page lifecycle preferences
- [ ] Update `ProblemScraperStrategy` with `pageReuse: 'auto'`
- [ ] Update `ListScraperStrategy` with `pageReuse: 'never'`
- [ ] Modify scraper facade to respect strategy config

### Phase 6: Testing

- [ ] Test per-session pool isolation
- [ ] Test global pool fallback
- [ ] Test session persistence across runs
- [ ] Test pool cleanup on drain
- [ ] Test expired session removal
- [ ] Add integration tests for session + pool combo

### Phase 7: Documentation

- [ ] Update README with session examples
- [ ] Create session management guide
- [ ] Document pool strategy tradeoffs
- [ ] Add troubleshooting guide

---

## 9. Example Usage

### 9.1 Basic Session Workflow

```bash
# Step 1: Create premium session via login
$ lesca login --session premium
# Browser opens, user logs in, cookies saved to ~/.lesca/sessions/premium.json

# Step 2: Use premium session for scraping
$ lesca scrape two-sum --session premium
# Session auto-restored before scrape

# Step 3: Persist session for next run
$ lesca scrape climbing-stairs --session premium --session-persist
# Session state saved for future premium scrapes

# Step 4: Create separate free account session
$ lesca login --session free

# Step 5: List sessions
$ lesca session list
```

### 9.2 Advanced Pool Configuration

```yaml
# lesca.config.yaml
browser:
  pool:
    strategy: hybrid # Use per-session by default, fallback to global
    minSize: 0
    maxSize: 3 # Per-session max
    maxIdleTime: 300000 # 5 minutes
    reusePages: true
    globalMaxSize: 5 # Global pool max

  session:
    enabled: true
    persistAcrossRuns: false # Per-command via --session-persist
    autoSave: true
    autoRestore: true

scraping:
  concurrency: 3 # Matches pool size
```

### 9.3 Multi-Session Concurrent Scraping

```bash
# Future enhancement: concurrent sessions
$ lesca scrape-list urls.txt --session premium --concurrency 3
# Uses 3 browsers per session, respects session pool boundaries
```

---

## 10. Migration Notes

### Backward Compatibility

- ✅ Existing cookie-based auth continues to work (uses 'default' session)
- ✅ `PlaywrightDriver()` without pool still works (single browser mode)
- ✅ `BrowserPool` unchanged in public API
- ✅ SessionManager existing methods preserved

### Config Migration Path

1. Old: `auth.cookiePath` → New: `~/.lesca/sessions/default.json`
2. Old: Single cookie file → New: Multiple named session files
3. Auto-migrate on first run (if cookies.json exists, import as 'default' session)

---

## 11. Performance Considerations

| Strategy             | Per-Session Overhead      | Memory Usage | Isolation |
| -------------------- | ------------------------- | ------------ | --------- |
| **global**           | Minimal                   | Low          | Poor      |
| **per-session**      | Moderate (multiple pools) | Medium       | Excellent |
| **hybrid** (default) | Low (lazy pools)          | Medium       | Good      |

**Recommendation**: Use **hybrid** for balance between resource usage and isolation.

---

## 12. Future Enhancements

1. **Session expiration policies** - Auto-delete after X days/uses
2. **Session sync** - Share sessions via cloud storage
3. **Session encryption** - Secure sensitive cookie data
4. **Pool metrics dashboard** - Real-time pool statistics
5. **Session replay** - Record & replay scraping sequences per session
6. **Concurrent multi-session scraping** - Parallel workers per session

---

## References

- **SessionManager**: `packages/browser-automation/src/session-manager.ts`
- **BrowserPool**: `packages/browser-automation/src/pool.ts`
- **PlaywrightDriver**: `packages/browser-automation/src/playwright-driver.ts`
- **Config Schema**: `shared/config/src/schema.ts`
- **Config Defaults**: `shared/config/src/defaults.ts`
- **CLI Commands**: `packages/cli/src/commands/`
- **Shared Types**: `shared/types/src/`
