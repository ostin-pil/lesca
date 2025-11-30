# Run Tests

Run tests for the Lesca project.

## Arguments

- `$ARGUMENTS` - Optional: specific test file or package path (e.g., `packages/core` or `packages/scrapers/src/__tests__/problem-strategy.test.ts`)

## Steps

1. If arguments provided, run: `npm test -- $ARGUMENTS`
2. Otherwise, run all unit tests: `npm test`
3. Report test results with pass/fail counts
4. If failures occur, show the failing test names and error messages

Do NOT run integration tests unless explicitly requested.
