# Create New Scraper Strategy

Scaffold a new scraper strategy following the established patterns.

## Arguments

- `$ARGUMENTS` - Required: strategy name (e.g., "contest" for ContestScraperStrategy)

## Steps

1. Read existing strategy for reference: `packages/scrapers/src/problem-strategy.ts`
2. Read the ScraperStrategy interface from: `shared/types/src/index.ts`
3. Create new strategy file at: `packages/scrapers/src/$ARGUMENTS-strategy.ts`
4. Create test file at: `packages/scrapers/src/__tests__/$ARGUMENTS-strategy.test.ts`
5. Export from `packages/scrapers/src/index.ts`

## Strategy Template Requirements

- Implement `ScraperStrategy` interface
- Use `readonly name` and `readonly priority` properties
- Implement `canHandle(request: ScrapeRequest): boolean`
- Implement `execute(request: ScrapeRequest): Promise<RawData>`
- Use logger from `@/shared/utils`, NOT console
- Add JSDoc documentation
- Follow existing code patterns
