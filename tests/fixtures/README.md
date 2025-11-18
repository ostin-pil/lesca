# Test Fixtures

This directory contains static test data fixtures for integration and unit tests.

## Structure

- `problems/` - Sample LeetCode problem data
- `responses/` - Sample API/GraphQL responses
- `html/` - Sample HTML content for conversion tests
- `markdown/` - Expected markdown output samples

## Usage

```typescript
import { problemFixtures } from '../fixtures/problems'
import { graphqlResponses } from '../fixtures/responses'

// In your test
const problem = problemFixtures.twoSum
const response = graphqlResponses.problemQuery.twoSum
```

## Guidelines

- Fixtures should be real-world examples (anonymized if needed)
- Keep fixtures small and focused
- Document any special cases or edge cases
- Use TypeScript for type safety
