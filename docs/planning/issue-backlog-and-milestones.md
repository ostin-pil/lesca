**Milestone: v0.2.0 — Stable Foundation**

- **ISSUE:** Browser: Session Management & Pooling
  - **Files:** `packages/browser-automation/src/session-manager.ts`, `packages/browser-automation/src/pool.ts`
  - **Estimate:** 4 days
  - **Acceptance Criteria:** Persistent browser contexts; session restore; multiple-account support; browser pool with reuse and lazy init; tests covering reuse and cleanup; no memory leaks on repeated runs.

- **ISSUE:** Browser: Cookie Management & Login Helpers
  - **Files:** `packages/browser-automation/src/cookie-manager.ts`, `packages/browser-automation/src/auth.ts`
  - **Estimate:** 3 days
  - **Acceptance Criteria:** Auto-save cookies after login; cookie refresh/validation; interactive login helper; secure credential storage recommendation (keytar) and tests for cookie persistence.

- **ISSUE:** Browser: Request Interception & Performance Options
  - **Files:** `packages/browser-automation/src/interceptor.ts`, `packages/browser-automation/src/playwright-driver.ts`
  - **Estimate:** 3 days
  - **Acceptance Criteria:** Block images/fonts/ads by default; capture API responses; inject custom headers; config option `browser.headless` with headed fallback; tests for interception and header injection.

- **ISSUE:** Error Handling Audit & Structured Logger
  - **Files:** `shared/error/src/codes.ts`, `shared/error/src/recovery.ts`, `shared/utils/src/logger.ts`, `shared/utils/src/sanitizer.ts`
  - **Estimate:** 4 days
  - **Acceptance Criteria:** Standardized `LescaError` codes documented; recoverable vs fatal classification; retry/circuit-breaker hooks; structured JSON logs for production; sensitive-data redaction utilities.

- **ISSUE:** Test Coverage: fast/slow split + per-package thresholds
  - **Files:** `vitest.config.ts`, root `package.json`, `tests/` (new)
  - **Estimate:** 4 days
  - **Acceptance Criteria:** Add `test:unit` and `test:integration` scripts; unit tests run on PRs; integration tests on release only; coverage check script that enforces per-package thresholds; coverage >= 90% overall target.

- **ISSUE:** CI: PR (fast) and Release (full) workflows
  - **Files:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`
  - **Estimate:** 2 days
  - **Acceptance Criteria:** PR CI runs lint, typecheck, unit tests; release workflow runs full test suite, builds packages, uploads coverage, and creates release artifacts.

- **ISSUE:** npm Publication Pre-flight
  - **Files:** package `package.json` updates, `.npmignore`, README updates
  - **Estimate:** 2 days
  - **Acceptance Criteria:** Dry-run publish succeeds; publishing process documented; CLI `npm install -g @lesca/cli` validated locally.

---

**Milestone: v0.3.0 — Extension & Advanced Features (5 weeks)**

- **ISSUE:** Core: Plugin Manager & Hook Registry
  - **Files:** `packages/core/src/plugin-manager.ts`, `packages/core/src/hooks.ts`
  - **Estimate:** 6 days
  - **Acceptance Criteria:** Plugin discovery (local `plugins/` + npm `@lesca/plugin-*`), registration/unregistration, hook execution with priority ordering, safe isolation so plugin errors don't crash host, basic docs for API.

- **ISSUE:** Scrapers: Quality Scoring Engine for Discussions
  - **Files:** `packages/scrapers/src/quality-scorer.ts`
  - **Estimate:** 4 days
  - **Acceptance Criteria:** Implement scoring factors (content, engagement, recency, relevance), config-driven weights, integration with discussion scraper to store `quality_score` metadata, tests using sample discussion fixtures.

- **ISSUE:** Storage: SQLite Adapter + Migrations
  - **Files:** `packages/storage/src/adapters/sqlite-adapter.ts`, `packages/storage/src/migrations/`
  - **Estimate:** 6 days
  - **Acceptance Criteria:** Adapter CRUD + query/search; migration runner and example migrations; CLI commands `lesca db init` and `lesca db migrate`; tests for migrations and queries.

- **ISSUE:** Plugin Examples & Developer Guide
  - **Files:** `plugins/notion/`, `plugins/anki/`, `docs/PLUGIN_DEVELOPMENT.md`
  - **Estimate:** 3 days
  - **Acceptance Criteria:** At least 2 example plugins with tests, step-by-step plugin dev guide.

---

**Milestone: v1.0.0 — Polish & Release (2–3 weeks)**  
(Web UI deferred — Option A. only minimal placeholders kept.)

- **ISSUE:** Documentation Sweep & Release Notes
  - **Files:** `docs/`, `USER_GUIDE.md`, `CONFIGURATION.md`, `CLI_REFERENCE.md`
  - **Estimate:** 3 days
  - **Acceptance Criteria:** All new features documented, config reference updated, changelog and migration notes prepared.

- **ISSUE:** Performance Profiling & Hotpath Optimizations
  - **Files:** varies (`packages/*`)
  - **Estimate:** 4 days
  - **Acceptance Criteria:** Identify top 3 bottlenecks and reduce latency/memory for scraping flows; benchmarks added to `tests/benchmarks/`.

- **ISSUE:** Security Audit & Dependency Pinning
  - **Files:** `package.json` updates, docs for secure storage
  - **Estimate:** 3 days
  - **Acceptance Criteria:** Resolve critical `npm audit` items; document secure credential storage and input validation; basic SQL injection and XSS mitigations.

- **ISSUE:** Final Integration Tests & Release Execution
  - **Estimate:** 3 days
  - **Acceptance Criteria:** Release CI passes full test matrix; release artifacts published; smoke-checks executed.

---

**Quick Wins (parallel, 1 day each)**

- **ISSUE:** Centralize selectors & fallback logic
  - **Files:** `packages/scrapers/src/selectors/index.ts`
  - **Estimate:** 1 day

- **ISSUE:** Cache statistics & limits
  - **Files:** `shared/utils/src/metrics.ts`, `shared/utils/src/cache.ts`
  - **Estimate:** 1 day

- **ISSUE:** Adaptive rate limiter improvements
  - **Files:** `packages/api-client/src/rate-limiter.ts` (or equivalent)
  - **Estimate:** 1 day

---

**Risk & CI Actions (short tasks)**

- **ISSUE:** Selector monitoring job (scheduled)
  - **Files:** `.github/workflows/selector-monitor.yml`, `scripts/selector-monitor.js`
  - **Estimate:** 1 day
  - **Goal:** Run sample scrapes daily; open PR/issue or alert on selector failures.

- **ISSUE:** Flaky test mitigation policy
  - **Files:** CI workflow changes, test runner flags (`vitest --repeat`)
  - **Estimate:** 1 day
  - **Goal:** Re-run failing tests automatically once; label flaky tests for triage.

---

**Labels & Estimates**

- Suggested labels: `area:browser`, `area:tests`, `area:core`, `area:storage`, `priority:high`, `priority:medium`, `estimate:days`
- Estimates are in developer-days for a single full-time developer.
