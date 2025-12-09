# Browser Pooling Guide

This guide covers Lesca's browser pooling system, which provides efficient browser instance reuse for high-throughput scraping operations.

## Overview

Browser pooling significantly improves scraping performance by:

- **Reducing cold-start latency**: Reusing warm browser instances instead of launching new ones
- **Managing resources**: Controlling maximum concurrent browsers
- **Improving reliability**: Circuit breaker protection against cascading failures
- **Enabling monitoring**: Real-time metrics and statistics

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SessionPoolManager                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐    ┌──────────────────────┐          │
│  │  Session "auth-1"    │    │  Session "auth-2"    │          │
│  │  ┌────────────────┐  │    │  ┌────────────────┐  │          │
│  │  │  BrowserPool   │  │    │  │  BrowserPool   │  │          │
│  │  │ ┌────┐ ┌────┐  │  │    │  │ ┌────┐         │  │          │
│  │  │ │ B1 │ │ B2 │  │  │    │  │ │ B1 │         │  │          │
│  │  │ └────┘ └────┘  │  │    │  │ └────┘         │  │          │
│  │  └────────────────┘  │    │  └────────────────┘  │          │
│  └──────────────────────┘    └──────────────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│                     MetricsCollector                            │
│  (Records acquire/release timing, pool utilization, failures)   │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

### Pool Configuration Options

| Option        | Type    | Default  | Description                       |
| ------------- | ------- | -------- | --------------------------------- |
| `enabled`     | boolean | `true`   | Enable/disable browser pooling    |
| `minSize`     | number  | `0`      | Minimum browsers to keep ready    |
| `maxSize`     | number  | `3`      | Maximum concurrent browsers       |
| `maxIdleTime` | number  | `300000` | Idle timeout before eviction (ms) |
| `reusePages`  | boolean | `true`   | Close contexts on release         |

### Session Pool Configuration

| Option               | Type    | Default         | Description                        |
| -------------------- | ------- | --------------- | ---------------------------------- |
| `strategy`           | string  | `'per-session'` | Pool strategy                      |
| `perSessionMaxSize`  | number  | `2`             | Max browsers per session           |
| `perSessionIdleTime` | number  | `180000`        | Per-session idle timeout (ms)      |
| `acquireTimeout`     | number  | `30000`         | Timeout for acquire operation (ms) |
| `retryOnFailure`     | boolean | `true`          | Retry on acquire failure           |
| `maxRetries`         | number  | `3`             | Maximum retry attempts             |

## CLI Commands

### Session Management

```bash
# List all saved sessions
lesca session list

# Show session details
lesca session info <name>

# Delete a session
lesca session delete <name>

# Rename a session
lesca session rename <old> <new>
```

### Pool Statistics

```bash
# Show pool statistics
lesca session stats

# Show stats for specific session
lesca session stats --session <name>

# Output as JSON
lesca session stats --json

# Watch mode (real-time updates)
lesca session stats --watch

# Custom update interval
lesca session stats --watch --interval 1000

# Reset statistics
lesca session stats-reset
```

## Usage Examples

### Basic Pool Usage

```typescript
import { BrowserPool } from '@lesca/browser-automation'

// Create pool with default settings
const pool = new BrowserPool()

// Acquire a browser
const browser = await pool.acquire()

try {
  const page = await browser.newPage()
  await page.goto('https://example.com')
  // ... perform scraping
} finally {
  // Always release back to pool
  await pool.release(browser)
}

// Cleanup on shutdown
await pool.drain()
```

### Session-Based Pooling

```typescript
import { SessionPoolManager, MetricsCollector } from '@lesca/browser-automation'

// Create manager with metrics
const collector = new MetricsCollector()
const manager = new SessionPoolManager(
  {
    perSessionMaxSize: 3,
    acquireTimeout: 60000,
    retryOnFailure: true,
    maxRetries: 3,
  },
  { headless: true },
  { metricsCollector: collector }
)

// Acquire browser for a named session
const browser = await manager.acquireBrowser('my-session')

try {
  // Use browser...
} finally {
  await manager.releaseBrowser(browser, 'my-session')
}

// Get session statistics
const stats = manager.getStatistics('my-session')
console.log(`Active: ${stats[0]?.activeBrowsers}`)

// Cleanup
await manager.drainAll()
```

### With Session Persistence

```typescript
import { BrowserService } from '@lesca/browser-automation'

const service = new BrowserService({
  sessionName: 'leetcode-auth',
  autoRestore: true,
  persistOnShutdown: true,
})

await service.startup({ headless: true })

const driver = service.getDriver()
await driver.navigate('https://leetcode.com')
// Session cookies are automatically restored

await service.shutdown()
// Session is saved for next time
```

### Monitoring Pool Health

```typescript
import { MetricsCollector } from '@lesca/browser-automation'

const collector = new MetricsCollector({
  windowDurationMs: 60000, // 1 minute rate window
  maxHistorySize: 1000,
})

// Subscribe to events
collector.on('metric', (event) => {
  if (event.type === 'pool:failure') {
    console.error(`Pool failure: ${event.error}`)
  }
  if (event.type === 'circuit:trip') {
    console.warn('Circuit breaker tripped!')
  }
})

// Get summary
const summary = collector.getSummary()
console.log(`Sessions: ${summary.totalSessions}`)
console.log(`Active browsers: ${summary.totalActiveBrowsers}`)
console.log(`Failure rate: ${(summary.globalFailureRate * 100).toFixed(1)}%`)
```

## Circuit Breaker

The circuit breaker protects against cascading failures when browser launches fail repeatedly.

### States

| State         | Behavior                                               |
| ------------- | ------------------------------------------------------ |
| **Closed**    | Normal operation, all calls pass through               |
| **Open**      | Failures exceeded threshold, calls blocked immediately |
| **Half-Open** | Testing recovery, limited calls allowed                |

### Configuration

```typescript
import { CircuitBreaker } from '@lesca/browser-automation'

const breaker = new CircuitBreaker({
  failureThreshold: 3, // Open after 3 consecutive failures
  resetTimeout: 30000, // Try again after 30 seconds
  successThreshold: 2, // Need 2 successes in half-open to close
})
```

### Manual Control

```typescript
// Check circuit state
if (!breaker.canExecute()) {
  console.log('Circuit is open, operations blocked')
}

// Get statistics
const stats = breaker.getStats()
console.log(`State: ${stats.state}, Failures: ${stats.failures}`)

// Manual reset (after fixing issues)
breaker.reset()

// Manual trip (preemptive protection)
breaker.trip()
```

## Metrics Reference

### Event Types

| Event                    | Description                |
| ------------------------ | -------------------------- |
| `pool:acquire`           | Browser acquired from pool |
| `pool:release`           | Browser released to pool   |
| `pool:failure`           | Pool operation failed      |
| `pool:exhausted`         | Pool at capacity, waiting  |
| `pool:browser-created`   | New browser launched       |
| `pool:browser-destroyed` | Browser closed             |
| `circuit:trip`           | Circuit breaker opened     |
| `circuit:reset`          | Circuit breaker closed     |
| `circuit:half-open`      | Circuit entering half-open |

### Session Metrics

```typescript
interface SessionMetrics {
  sessionName: string
  poolSize: number
  activeBrowsers: number
  idleBrowsers: number
  acquireTiming: TimingStats // min, max, avg, count
  releaseTiming: TimingStats
  browserCreateTiming: TimingStats
  totalAcquisitions: number
  totalReleases: number
  totalFailures: number
  acquisitionsPerMinute: number
  failureRate: number // 0-1
  circuitState: CircuitState
  circuitTrips: number
}
```

## Troubleshooting

### Pool Exhaustion

**Symptom**: `BROWSER_POOL_EXHAUSTED` error

**Causes**:

- More concurrent operations than `maxSize`
- Browsers not being released
- Long-running operations blocking pool

**Solutions**:

```typescript
// 1. Increase pool size
const pool = new BrowserPool({ maxSize: 5 })

// 2. Ensure browsers are always released
const browser = await pool.acquire()
try {
  // ... use browser
} finally {
  await pool.release(browser) // Always release!
}

// 3. Reduce concurrent operations
```

### Circuit Breaker Open

**Symptom**: `BROWSER_CIRCUIT_OPEN` error

**Causes**:

- Browser launch failures (missing dependencies, resource exhaustion)
- Network issues
- System resource limits

**Solutions**:

```bash
# 1. Check browser installation
npx playwright install chromium

# 2. Check system resources
free -h
ulimit -a

# 3. Reset circuit after fixing
```

```typescript
pool.resetCircuitBreaker()
```

### Memory Issues

**Symptom**: High memory usage, OOM errors

**Solutions**:

```typescript
// 1. Reduce pool size
const pool = new BrowserPool({ maxSize: 2 })

// 2. Reduce idle time
const pool = new BrowserPool({ maxIdleTime: 60000 })

// 3. Enable page cleanup
const pool = new BrowserPool({ reusePages: true })
```

### Session Not Restoring

**Symptom**: Session data not applied to new context

**Causes**:

- Session expired
- Session file corrupted
- Wrong session name

**Solutions**:

```typescript
// 1. Check session validity
const isValid = await sessionManager.validateSession('my-session')

// 2. List available sessions
const sessions = await sessionManager.listActiveSessions()

// 3. Check for expired sessions
await sessionManager.cleanupExpiredSessions()
```

## Best Practices

1. **Always release browsers** - Use try/finally to ensure browsers are returned to pool

2. **Size pools appropriately** - Match `maxSize` to your concurrency needs

3. **Monitor metrics** - Use watch mode or subscribe to events for operational visibility

4. **Handle circuit breaker** - Implement fallback behavior when circuit is open

5. **Clean up on shutdown** - Call `drain()` or `drainAll()` during application shutdown

6. **Use sessions for auth** - Store authentication state to avoid repeated logins

7. **Set reasonable timeouts** - Configure `acquireTimeout` based on your browser launch time
