# Browser Automation Improvements

> Analysis Date: December 2025
> Status: Phase 1 Complete (Stealth Mode)

This document captures the analysis and improvement opportunities for the browser automation package, focusing on session persistence and CAPTCHA handling.

## Table of Contents

- [Current Implementation](#current-implementation)
- [Architecture Overview](#architecture-overview)
- [Session Management](#session-management)
- [CAPTCHA Detection & Handling](#captcha-detection--handling)
- [Cookie Persistence](#cookie-persistence)
- [Authentication Helper](#authentication-helper)
- [Improvement Opportunities](#improvement-opportunities)
- [Implementation Priorities](#implementation-priorities)
- [Next Steps](#next-steps)

## Current Implementation

| Area                | Status     | Notes                                                   |
| ------------------- | ---------- | ------------------------------------------------------- |
| Session Persistence | ✅ Good    | Save/restore sessions, merging strategies, auto-cleanup |
| Cookie Management   | ✅ Good    | Validation, expiration checks, multiple merge modes     |
| CAPTCHA Detection   | ⚠️ Partial | Detects Cloudflare/reCAPTCHA/hCaptcha, but no solving   |
| Auth Helper         | ✅ Good    | Interactive login, retry logic, manual fallback         |
| **Stealth Mode**    | ✅ Done    | Evasion scripts, launch args, UA rotation, timing utils |

## Architecture Overview

```
BrowserService (orchestrator)
├── PlaywrightDriver (browser control)
│   └── StealthManager (anti-detection) ✅ NEW
├── SessionManager (persistence)
├── SessionPoolManager (pooling)
│   └── BrowserPool (individual pools)
│       └── CircuitBreaker (failure protection)
├── AuthHelper (login automation)
├── CookieManager (cookie handling)
├── MetricsCollector (monitoring)
└── RequestInterceptor (network control)
```

### Key Files

| File                           | Purpose                                    | Lines |
| ------------------------------ | ------------------------------------------ | ----- |
| `session-manager.ts`           | Session persistence, restore, merge        | ~811  |
| `auth-helper.ts`               | Interactive login, logout, verification    | ~291  |
| `detectors.ts`                 | Login state, CAPTCHA, rate limit detection | ~370  |
| `cookie-manager.ts`            | Cookie save/load, validate, merge          | ~436  |
| `browser-service.ts`           | Orchestration, lifecycle management        | ~131  |
| `playwright-driver.ts`         | Browser control, navigation, interception  | ~300+ |
| `pool.ts`                      | Browser pooling with circuit breaker       | ~300+ |
| `session-pool-manager.ts`      | Per-session pool coordination              | ~300+ |
| `session-cleanup-scheduler.ts` | Automated cleanup policies                 | ~200+ |
| `stealth/stealth-manager.ts`   | Anti-detection orchestration ✅ NEW        | ~170  |
| `stealth/evasion-scripts.ts`   | Browser JS evasion scripts ✅ NEW          | ~400  |
| `stealth/timing-utils.ts`      | Human-like timing delays ✅ NEW            | ~130  |
| `stealth/user-agents.ts`       | UA rotation utilities ✅ NEW               | ~150  |
| `stealth/launch-args.ts`       | Chrome stealth arguments ✅ NEW            | ~100  |

## Session Management

### Current Features

**SessionManager** (`session-manager.ts`):

- Save/restore browser session state to disk (`~/.lesca/sessions/`)
- Captures: cookies, localStorage, sessionStorage, and metadata
- Automatic expiration handling with timestamp tracking
- Session merging with three strategies:
  - `keep-existing`: Only add new keys from sources
  - `prefer-fresh`: Newer data takes precedence
  - `merge-all`: Combine all with conflict resolution
- Corruption handling with automatic backup (`*.bak.${timestamp}`)
- Metadata tracking: creation time, last used, expiration, user agent, description

**SessionPoolManager** (`session-pool-manager.ts`):

- Per-session browser pools for isolated resource management
- Timeout and retry logic (configurable)
- Integrated metrics collection
- Session-aware statistics

**SessionCleanupScheduler** (`session-cleanup-scheduler.ts`):

- Age-based cleanup (default: 7 days)
- Count-based cleanup (limit max sessions)
- Startup and background scheduling
- Dry-run support

### Current Limitations

1. **Filesystem-only storage** - No database option for scalability
2. **No encryption at rest** - Sensitive tokens stored as plain JSON
3. **Limited metadata** - No usage statistics (access count, last IP, etc.)
4. **No context tracking** - Sessions don't store device/IP fingerprint
5. **No conflict detection** - Beyond timestamp-based merging
6. **Sequential restoration** - localStorage/sessionStorage restored serially
7. **Name sanitization** - Dots and special chars replaced with `_`

## CAPTCHA Detection & Handling

### Current Detection

**`detectors.ts`** provides detection for:

- Cloudflare Turnstile (`.cf-turnstile`)
- Google reCAPTCHA (`.g-recaptcha`)
- hCaptcha (`.h-captcha`)
- Generic CAPTCHA patterns (`id*="captcha"`, `iframe[src*="captcha"]`)

### Current Flow

```typescript
// Integrated in login flow:
1. Check for CAPTCHA before entering credentials
2. Re-check after login attempt
3. Return state: 'captcha' | 'logged-in' | 'rate-limited' | 'logged-out'
```

### Current Handling

- **Passive detection only** - Identifies presence but doesn't solve
- **Manual login fallback** (`auth-helper.ts`):
  ```typescript
  waitForManualLogin((timeout = 300000)) // 5 minutes default
  // Polls every 2 seconds for login completion
  ```
- Early return if CAPTCHA detected - prevents wasteful credential submission

### Current Limitations

1. **No automated solving** - CAPTCHA handling is manual or requires external service
2. **No stealth/evasion** - Doesn't prevent CAPTCHA from appearing
3. **Polling-based waiting** - Inefficient 2-second intervals
4. **Limited CAPTCHA types** - Only common implementations detected
5. **No headless evasion** - Doesn't bypass automation detection
6. **No challenge tracking** - Doesn't track CAPTCHA triggers per session/IP
7. **Timeout-only recovery** - Once CAPTCHA appears, must wait for timeout

## Cookie Persistence

### Current Features

**CookieManager** (`cookie-manager.ts`):

**Save/Load:**

- Extract cookies from browser context to JSON file
- Load and inject into new browser context
- CSRF token extraction and storage

**Validation:**

```typescript
validateCookies(cookies, (requiredCookies = ['LEETCODE_SESSION', 'csrftoken']))
// Returns: { valid, expired[], missing[], warnings[] }
```

**Merge Strategies:**

- `keep-existing`: Target data preserved, only new keys added
- `prefer-fresh`: Overwrites with newer values
- `merge-all`: Combines all, preferring longer expiration times

**Advanced Features:**

- Auto-save: Enable/disable with optional path
- Load & Inject: Validates during injection, filters expired cookies
- Refresh: Extracts current cookies and validates
- Individual Cookie Ops: Get/set/clear specific cookies

### Storage Format

```json
{
  "cookies": [...],
  "csrfToken": "...",
  "savedAt": "2025-12-22T..."
}
```

### Current Limitations

1. **Plain JSON storage** - No encryption (sensitive tokens readable)
2. **No cookie versioning** - Overwrites without history
3. **Limited fingerprinting** - Doesn't track IP/device context
4. **No TTL enforcement** - Relies on browser's expiration
5. **Expired cookies saved** - Must validate on load
6. **Single CSRF token** - Only stores most recent
7. **No migration path** - Format locked to current structure

## Authentication Helper

### Current Features

**AuthHelper** (`auth-helper.ts`):

**Interactive Login Flow:**

1. Navigate to login page
2. Check for CAPTCHA (early return if found)
3. Fill credentials (username/password)
4. Submit form
5. Wait for navigation
6. Detect login state
7. Optionally save cookies

**Login Options:**

```typescript
{
  timeout?: number              // Default: 60000ms
  saveCookies?: boolean         // Default: true
  cookiePath?: string           // Path to save to
  waitForSelector?: string      // Custom selector to wait for
}
```

**Additional Methods:**

- `isLoggedIn()`: Check current auth state
- `verifyAuthentication()`: Navigate to profile, verify access
- `logout()`: Clear cookies
- `loginWithRetry()`: Retry with exponential backoff (2s, 4s, 6s)
- `waitForManualLogin()`: Handle CAPTCHA/2FA manually

### Current Limitations

1. **No 2FA support** - Beyond manual waiting
2. **No multi-account isolation** - Single credentials per helper
3. **Hardcoded URLs** - LeetCode-specific login/profile URLs
4. **No credential validation** - Trusts input format
5. **Fixed selectors** - May break with UI changes
6. **No anti-detection measures** - No browser fingerprinting spoofing
7. **Single browser per instance** - Not designed for parallel auth

## Improvement Opportunities

### HIGH PRIORITY

#### 1. Stealth Mode / Anti-Detection

**Gap:** Package detects but doesn't evade CAPTCHA services designed to block automation.

**Implementation:**

```typescript
// Techniques to implement:
- Override navigator.webdriver property
- Randomize timing between actions (human-like delays)
- Add realistic mouse movement patterns
- Vary user-agent rotation
- Implement proxy rotation support
- Use puppeteer-extra-plugin-stealth patterns
- Disable automation flags in browser launch
```

**Files to modify:**

- `playwright-driver.ts` - Add stealth launch options
- New file: `stealth-config.ts` - Stealth configuration

**Estimated effort:** Medium

#### 2. Cookie/Session Encryption

**Gap:** Sensitive auth tokens stored as plain JSON in `~/.lesca/sessions/`.

**Implementation:**

```typescript
interface EncryptionOptions {
  enabled: boolean
  algorithm: 'aes-256-gcm'
  keySource: 'env' | 'keyring' | 'file'
  keyEnvVar?: string  // e.g., LESCA_ENCRYPTION_KEY
}

// Features:
- AES-256-GCM encryption
- Key from environment variable or system keyring
- Transparent encrypt/decrypt during save/load
- Format versioning for migration
- Optional (backward compatible)
```

**Files to modify:**

- `session-manager.ts` - Add encryption layer
- `cookie-manager.ts` - Add encryption layer
- New file: `encryption.ts` - Encryption utilities

**Estimated effort:** Medium

#### 3. Session Context Awareness

**Gap:** Sessions not tracked with execution context (IP, device, user-agent).

**Implementation:**

```typescript
interface SessionContext {
  deviceId: string           // UUID generated on first use
  userAgent: string          // Browser user agent
  timezone: string           // System timezone
  screenResolution: string   // e.g., "1920x1080"
  language: string           // Browser language
  ipHash?: string            // Anonymized IP hash
}

// Features:
- Store fingerprint hash with session
- Warn if context mismatch detected
- Optional context enforcement
- Device rotation strategy support
```

**Files to modify:**

- `session-manager.ts` - Add context tracking
- `interfaces.ts` - Add SessionContext type
- New file: `fingerprint.ts` - Context collection

**Estimated effort:** Medium

### MEDIUM PRIORITY

#### 4. CAPTCHA Service Integration

**Gap:** No automated CAPTCHA solving capability.

**Implementation:**

```typescript
interface CaptchaSolverConfig {
  provider: '2captcha' | 'anti-captcha' | 'capsolver' | 'manual'
  apiKey?: string
  timeout: number  // Max wait for solution
  retries: number
}

// Features:
- Support multiple CAPTCHA solving services
- Automatic detection and submission
- Solution injection into page
- Cost tracking and limits
- Fallback to manual if service fails
```

**Files to modify:**

- `detectors.ts` - Extract CAPTCHA details for submission
- `auth-helper.ts` - Integrate solver into login flow
- New file: `captcha-solver.ts` - Solver abstraction

**Estimated effort:** High

#### 5. Rate Limit Intelligence

**Gap:** Only detects rate limit text, no backoff strategy.

**Implementation:**

```typescript
interface RateLimitConfig {
  maxRetries: number
  baseDelay: number           // Initial delay in ms
  maxDelay: number            // Maximum delay cap
  backoffMultiplier: number   // e.g., 2 for exponential
  respectRetryAfter: boolean  // Honor Retry-After header
}

// Features:
- Exponential backoff on rate-limit detection
- Parse and honor Retry-After headers
- Per-endpoint rate limit tracking
- Session rotation on persistent limits
- Request distribution across sessions
```

**Files to modify:**

- `auth-helper.ts` - Add rate limit handling
- `playwright-driver.ts` - Add header inspection
- New file: `rate-limiter.ts` - Rate limit management

**Estimated effort:** Medium

#### 6. 2FA/MFA Support

**Gap:** `waitForManualLogin()` only handles visual waiting.

**Implementation:**

```typescript
interface TwoFactorConfig {
  type: 'totp' | 'email' | 'sms' | 'manual'
  totpSecret?: string         // For TOTP generation
  emailCheckInterval?: number // For email code detection
}

// Features:
- TOTP generation (time-based one-time password)
- Email code detection from page
- SMS code input prompt
- Timeout-based failure recovery
```

**Files to modify:**

- `auth-helper.ts` - Add 2FA handling
- New file: `two-factor.ts` - 2FA utilities

**Estimated effort:** Medium

### LOW PRIORITY

#### 7. Event-Based CAPTCHA Waiting

**Gap:** Polling-based waiting (2-second intervals) is inefficient.

**Implementation:**

```typescript
// Replace polling with event listeners:
- Listen for navigation events
- Watch for DOM mutations (login form removal)
- Monitor cookie changes
- Use page.waitForFunction() with smart conditions
```

**Files to modify:**

- `auth-helper.ts` - Replace polling loop

**Estimated effort:** Low

#### 8. Session Lifecycle Metrics

**Gap:** Limited session metadata.

**Implementation:**

```typescript
interface SessionMetrics {
  accessCount: number // How many times used
  failureCount: number // Failed auth attempts
  lastIp?: string // Track IP changes
  captchaCount: number // Times CAPTCHA encountered
  rateLimitCount: number // Times rate limited
  avgRequestTime: number // Performance tracking
}
```

**Files to modify:**

- `session-manager.ts` - Add metrics tracking
- `interfaces.ts` - Add SessionMetrics type

**Estimated effort:** Low

#### 9. Database Backend Option

**Gap:** Filesystem-only storage limits scalability.

**Implementation:**

```typescript
interface StorageBackend {
  save(key: string, data: unknown): Promise<void>
  load(key: string): Promise<unknown>
  delete(key: string): Promise<void>
  list(): Promise<string[]>
}

// Implementations:
- FileSystemBackend (current)
- SQLiteBackend
- Optional cloud storage (S3, etc.)
```

**Files to modify:**

- New file: `storage/interface.ts`
- New file: `storage/filesystem.ts`
- New file: `storage/sqlite.ts`
- `session-manager.ts` - Use storage abstraction

**Estimated effort:** High

#### 10. Multi-Process Session Coordination

**Gap:** No coordination between concurrent session users.

**Implementation:**

```typescript
// Features:
- File locking for session access
- Checkout/checkin pattern
- Atomic metadata updates
- Conflict detection and resolution
```

**Files to modify:**

- `session-manager.ts` - Add locking mechanism
- New file: `session-lock.ts` - Lock management

**Estimated effort:** Medium

## Implementation Priorities

### Recommended Order

| Phase | Improvements                | Rationale                                       | Status  |
| ----- | --------------------------- | ----------------------------------------------- | ------- |
| 1     | Stealth Mode                | Reduces CAPTCHA triggers - prevention over cure | ✅ Done |
| 2     | Cookie Encryption           | Quick security win, protects sensitive data     | ⏳ Next |
| 3     | Rate Limit Intelligence     | Improves reliability and recovery               | Pending |
| 4     | Session Context             | Better security, detects anomalies              | Pending |
| 5     | CAPTCHA Service Integration | Automated solving when needed                   | Pending |
| 6     | 2FA Support                 | Complete authentication coverage                | Pending |

### Quick Wins (< 1 day each)

1. Event-based CAPTCHA waiting
2. Session lifecycle metrics
3. ~~Basic stealth flags in browser launch~~ ✅ Done (included in full Stealth Mode)

### Medium Effort (1-3 days each)

1. ~~Full stealth mode implementation~~ ✅ Done
2. Cookie/session encryption
3. Rate limit intelligence
4. Session context awareness

### Larger Efforts (3+ days)

1. CAPTCHA service integration
2. Database backend option
3. Multi-process coordination

## Test Coverage Gaps

Current test files have good unit coverage but lack:

- Integration tests with real LeetCode authentication
- CAPTCHA solving integration tests
- Concurrent session access tests
- Encryption/decryption tests
- IP rotation/fingerprint change tests
- Rate-limit recovery tests

## Next Steps

### ✅ Completed: Stealth Mode (Phase 1)

Implemented stealth mode with:

- 9 evasion scripts (webdriver, chromeRuntime, plugins, etc.)
- 15+ Chrome launch arguments for automation suppression
- User agent rotation with headless signature removal
- Human-like timing utilities
- Full test coverage (56 tests)

### Suggested Next: Cookie Encryption (Phase 2)

Start with **Cookie Encryption** as it:

- Quick security win - protects sensitive auth tokens
- Builds on existing CookieManager
- Can use Node.js built-in crypto module
- Medium implementation effort

---

**Related Documentation:**

- [Browser Pooling](./BROWSER_POOLING.md)
- [Configuration Guide](./CONFIGURATION.md)
- [Security Policy](../SECURITY.md)
