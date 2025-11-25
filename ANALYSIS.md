# Lesca Project: Current State Analysis & Next Steps

## Executive Summary

Lesca is a **mature MVP-stage LeetCode scraper** with comprehensive core functionality complete:

- **Core scraping**: Problems, lists, editorials, discussions via GraphQL + browser automation (Playwright).
- **Modular monorepo**: 11 packages (core, scrapers, converters, storage, browser-automation, auth, api-client, cli, converters, shared/\*).
- **Quality metrics**: 631 passing tests, 68-73% coverage (high in most packages, low in CLI), zero TypeScript errors.
- **Production-ready features**: Caching (tiered, TTL), batch scraping with resume/progress, Obsidian/Markdown output, CLI commands.
- **Gaps**: CI/CD missing, integration tests incomplete (TODOs), GraphQL caching needs re-enable, CLI UX (no init/auth), full config integration.

**Status**: **v0.1.0 MVP ✅ → Ready for v0.2.0 Stability**

## Current Architecture

```mermaid
graph TD
    CLI[CLI Entry] --> Core[LeetCodeScraper]
    Core --> Strategy[ScraperStrategy<br/>- ProblemStrategy<br/>- ListStrategy<br/>- EditorialStrategy<br/>- DiscussionStrategy]
    Strategy --> API[GraphQLClient<br/>+ RateLimiter]
    Strategy --> Browser[BrowserAutomation<br/>- PlaywrightDriver<br/>- SessionManager<br/>- CookieManager]
    Core --> Converter[Converters<br/>- HTMLtoMD<br/>- Obsidian<br/>- Enhancers]
    Converter --> Storage[Storage<br/>FilesystemStorage]
    Core -.-> Config[Shared Config<br/>Zod Schema]
    Core -.-> Utils[Shared Utils<br/>Cache, Logger]
    API -.-> Auth[CookieAuth]
```

## Codebase Health

| Package            | Coverage | Tests | Status |
| ------------------ | -------- | ----- | ------ |
| api-client         | 98%      | 28    | ✅     |
| auth               | 96%      | 41    | ✅     |
| browser-automation | 96%      | 65    | ✅     |
| cli                | 16%      | 61    | 🚧     |
| converters         | 86%      | 154   | ✅     |
| core               | 82%      | 29    | ✅     |
| scrapers           | 91%      | 105   | ✅     |
| storage            | 91%      | 35    | ✅     |

- **TODOs/FIXMEs**: Minimal (4x in integration tests: mock API responses, partial failures).
- **Key Classes**:
  - `packages/core`: [`BatchScraper`](packages/core/src/batch-scraper.ts), [`LeetCodeScraper`](packages/core/src/scraper.ts)
  - `packages/scrapers`: 4 strategies fully implemented with browser fallbacks.

## Roadmap Alignment

```mermaid
gantt
    title Lesca Roadmap to v1.0
    dateFormat YYYY-MM-DD
    section Phase 1: Stability (v0.2)
    CI/CD Pipeline :ci, 2025-11-25, 3d
    Full Testing :test, after ci, 7d
    Re-enable Caching :cache, after ci, 2d
    CLI Improvements :cli, after test, 4d
    section Phase 2: Features (v0.3)
    Plugin System :plugin, after cli, 10d
    SQLite Storage :db, after plugin, 6d
    Quality Scoring :score, after db, 4d
    section Phase 3: v1.0
    Performance/Security :perf, after score, 7d
    npm Publish :publish, after perf, 2d
```

**Docs Consensus on Next**:

1. **CI/CD** (critical blocker)
2. **Testing** (integration E2E, CLI coverage)
3. **Caching** (re-enable in GraphQLClient)
4. **CLI UX** (init, auth, list/search)
5. **Config** (replace hardcodes)

## Proposed Action Plan

```
[ ] 1. Set up CI/CD (GitHub Actions: lint/test/build on PR, full on release)
[ ] 2. Complete integration tests (implement TODOs with mocks/fixtures)
[ ] 3. Re-enable GraphQL caching (api-client)
[ ] 4. CLI enhancements (init/auth commands, interactive prompts)
[ ] 5. Full config integration (audit hardcodes → config.get())
[ ] 6. Publish v0.2.0 to npm
[-] 7. Monitor selectors (daily GitHub Action)
[ ] 8. Performance benchmarks
```

**Estimated Effort**: 3-4 weeks (parallelizable).

**Risks**: LeetCode UI changes (mitigate: selector fallbacks + monitoring).

Approve this plan? Ready to switch to `orchestrator` mode for execution?
