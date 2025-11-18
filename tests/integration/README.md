# Integration Tests

This directory contains slow integration tests that verify end-to-end workflows and cross-package integration.

## Test Categories

### End-to-End Workflows
- `e2e-single-problem.test.ts` - Single problem scraping to Obsidian
- `e2e-batch-scraping.test.ts` - Batch scraping multiple problems
- `e2e-list-scraping.test.ts` - Problem list scraping
- `e2e-with-browser.test.ts` - Browser automation workflow
- `e2e-cache-persistence.test.ts` - Cache persistence across sessions

### Cross-Package Integration
Tests that verify the integration between multiple packages:
- Scraper → Converter → Storage pipeline
- CLI → Core → Scrapers flow
- Browser → Scrapers → Cache flow
- Config → All packages validation

## Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npx vitest run tests/integration/e2e-single-problem.test.ts --config vitest.integration.config.ts

# Run in watch mode
npx vitest tests/integration --config vitest.integration.config.ts
```

## Notes

- Integration tests run on release only (not on every PR)
- Tests may use fixtures and mocked data
- Timeout is set to 30 seconds for slower operations
- Tests should clean up after themselves (temp files, etc.)
