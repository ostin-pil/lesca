# Check Test Coverage

Run tests with coverage and validate against thresholds.

## Steps

1. Run coverage: `npm run test:coverage`
2. Run threshold validation: `npm run check-coverage`
3. Report coverage by package with comparison to targets:
   - api-client: 90%+
   - auth: 90%+
   - browser-automation: 85%+
   - scrapers: 85%+
   - converters: 80%+
   - core: 80%+
   - storage: 85%+
   - shared/config: 80%+
   - shared/utils: 80%+
   - shared/error: 95%+
4. Highlight any packages below their threshold
