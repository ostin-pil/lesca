# Test Factories

This directory contains factory functions for generating test data dynamically.

## Purpose

Factories provide a flexible way to create test data with:
- Sensible defaults
- Customizable properties
- Type safety
- Consistency across tests

## Usage

```typescript
import { createProblem, createScrapeRequest } from '../factories/problem-factory'

// Create with defaults
const problem = createProblem()

// Create with custom properties
const customProblem = createProblem({
  title: 'Custom Problem',
  difficulty: 'Hard',
  titleSlug: 'custom-problem',
})

// Create scrape request
const request = createScrapeRequest({ titleSlug: 'two-sum' })
```

## Guidelines

- Factories should return valid, complete objects
- Use sensible defaults that work in most cases
- Allow overriding any property
- Document required vs optional overrides
- Keep factories pure (no side effects)
