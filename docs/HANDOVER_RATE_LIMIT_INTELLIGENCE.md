# Handover: Rate Limit Intelligence Implementation

> Created: December 2024
> Status: Ready to Implement (Plan Approved)
> Phase: 3 of Browser Automation Improvements

## Quick Start

To continue this work, simply tell Claude:

```
Continue implementing Phase 3: Rate Limit Intelligence following the plan in docs/HANDOVER_RATE_LIMIT_INTELLIGENCE.md
```

## Context

This is Phase 3 of the Browser Automation Improvements roadmap:

| Phase | Feature                     | Status                    |
| ----- | --------------------------- | ------------------------- |
| 1     | Stealth Mode                | ✅ Complete               |
| 2     | Cookie Encryption           | ✅ Complete               |
| **3** | **Rate Limit Intelligence** | **⏳ Ready to Implement** |
| 4     | Session Context             | Pending                   |

## What We're Building

An intelligent rate limit handling system with:

1. **Configurable Backoff Strategies** - Exponential, linear, fibonacci, constant
2. **Retry-After Header Parsing** - Honor server-specified delays
3. **Per-Endpoint Tracking** - Track rate limit state per URL pattern
4. **Session Rotation** - Distribute requests across sessions when rate limited

## Existing Components to Leverage

| Component            | Location                                         | Purpose                     |
| -------------------- | ------------------------------------------------ | --------------------------- |
| `RateLimitError`     | `shared/error/src/errors.ts`                     | Has `retryAfter` property   |
| `detectRateLimit()`  | `browser-automation/src/detectors.ts`            | Text pattern matching       |
| `RateLimiter`        | `api-client/src/graphql-client.ts`               | Proactive delay with jitter |
| `SessionPoolManager` | `browser-automation/src/session-pool-manager.ts` | Multi-session management    |
| `MetricsCollector`   | `browser-automation/src/metrics-collector.ts`    | Event tracking              |

## Architecture

```
RateLimitManager (orchestrator)
├── BackoffStrategy (exponential/linear/fibonacci/constant)
├── EndpointStateCollection (per-endpoint tracking)
├── SessionRotator (request distribution)
└── Integrates with: MetricsCollector, SessionPoolManager
```

## Files to Create

All new files go in `packages/browser-automation/src/rate-limit/`:

| #   | File                    | Purpose                   | Est. Lines |
| --- | ----------------------- | ------------------------- | ---------- |
| 1   | `types.ts`              | Type definitions          | ~80        |
| 2   | `backoff-strategy.ts`   | 4 backoff implementations | ~150       |
| 3   | `retry-after-parser.ts` | Parse Retry-After headers | ~60        |
| 4   | `endpoint-state.ts`     | Per-endpoint tracking     | ~120       |
| 5   | `session-rotator.ts`    | Session distribution      | ~130       |
| 6   | `rate-limit-manager.ts` | Main orchestrator         | ~200       |
| 7   | `index.ts`              | Module exports            | ~30        |

## Files to Modify

| File                      | Changes                                                |
| ------------------------- | ------------------------------------------------------ |
| `interfaces.ts`           | Add `IRateLimitManager` interface                      |
| `index.ts`                | Export rate-limit module                               |
| `session-pool-manager.ts` | Register sessions with RateLimitManager                |
| `playwright-driver.ts`    | Add `setRateLimitManager()`, integrate in `navigate()` |
| `auth-helper.ts`          | Enhanced rate limit handling in `loginWithRetry()`     |
| `graphql-client.ts`       | Integrate for HTTP 429 handling                        |

## Implementation Order

```
Step 1:  types.ts           (no dependencies)
Step 2:  backoff-strategy.ts + tests
Step 3:  retry-after-parser.ts + tests
Step 4:  endpoint-state.ts + tests
Step 5:  session-rotator.ts + tests
Step 6:  rate-limit-manager.ts + tests
Step 7:  index.ts (exports)
Step 8:  interfaces.ts (add IRateLimitManager)
Step 9:  browser-automation/index.ts (exports)
Step 10: session-pool-manager.ts (session registration)
Step 11: playwright-driver.ts (browser integration)
Step 12: auth-helper.ts (enhanced retry)
Step 13: graphql-client.ts (HTTP 429 handling)
Step 14: Run full validation
```

## Key Interfaces

```typescript
interface RateLimitConfig {
  enabled?: boolean
  backoff?: {
    strategy?: 'exponential' | 'linear' | 'fibonacci' | 'constant'
    initialDelayMs?: number // Default: 1000
    maxDelayMs?: number // Default: 60000
    multiplier?: number // Default: 2
    jitter?: boolean // Default: true
    maxRetries?: number // Default: 5
  }
  sessionRotation?: {
    enabled?: boolean
    cooldownMs?: number // Default: 30000
    distributionStrategy?: 'round-robin' | 'least-loaded' | 'least-errors'
  }
  integration?: {
    honorRetryAfter?: boolean // Default: true
    maxRetryAfterMs?: number // Default: 120000
  }
}

interface RateLimitDecision {
  shouldProceed: boolean
  delayMs: number
  recommendedSession: string | undefined
  reason: 'ok' | 'delay-required' | 'rate-limited' | 'cooldown'
}

interface EndpointState {
  endpoint: string
  hitCount: number
  lastHitTime: number
  isRateLimited: boolean
  rateLimitedUntil: number | undefined
  retryAfterMs: number | undefined
  consecutiveFailures: number
}
```

## Usage Example (Target API)

```typescript
// Create manager
const rateLimitManager = new RateLimitManager({
  backoff: { strategy: 'exponential', maxRetries: 5 },
  sessionRotation: { enabled: true, distributionStrategy: 'least-loaded' },
})

// Execute with automatic retry
const result = await rateLimitManager.executeWithRetry(
  () => fetch('/api/data'),
  '/api/data',
  'session-1'
)

// Manual decision making
const decision = rateLimitManager.getDecision('/api/endpoint', 'session-1')
if (decision.shouldProceed) {
  if (decision.delayMs > 0) await sleep(decision.delayMs)
  // Make request
}
```

## Test Strategy

- Unit tests for each module (35+ tests expected)
- Follow existing patterns in `__tests__/` directories
- Use factories from `tests/factories/` for test data
- Mock MetricsCollector for event verification

## Validation Checklist

Before completing, run:

```bash
npm run typecheck  # Must pass
npm run lint       # 0 errors
npm test           # All tests pass
```

## Related Files for Reference

- Plan file: `/home/pil/.claude/plans/velvet-seeking-tarjan.md`
- Roadmap: `/home/pil/lesca/docs/BROWSER_AUTOMATION_IMPROVEMENTS.md`
- Existing RateLimiter: `/home/pil/lesca/packages/api-client/src/graphql-client.ts` (lines 407-459)
- Error types: `/home/pil/lesca/shared/error/src/errors.ts`

## Notes

- All features are opt-in (backward compatible)
- Uses existing error codes (`NET_RATE_LIMITED`)
- Integrates with existing MetricsCollector for events
- GraphQL client falls back to existing p-retry if no manager configured
