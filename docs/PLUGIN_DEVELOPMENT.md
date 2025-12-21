# Plugin Development Guide

This guide covers everything you need to know to develop plugins for Lesca.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Plugin Interface](#plugin-interface)
- [Hook Lifecycle](#hook-lifecycle)
- [Configuration](#configuration)
- [Working with Data](#working-with-data)
- [Testing Plugins](#testing-plugins)
- [Publishing Plugins](#publishing-plugins)
- [Security Considerations](#security-considerations)
- [Debugging](#debugging)
- [Best Practices](#best-practices)

## Overview

The Lesca plugin system allows you to extend and customize the scraping pipeline. Plugins can:

- Modify scrape requests before execution
- Transform or filter scrape results
- Add metadata or enhance content
- Track statistics and generate reports
- Integrate with external services

Plugins hook into the scraping lifecycle at specific points, receiving data and optionally modifying it before passing it along.

## Quick Start

### 1. Create a Plugin File

```typescript
// my-plugin.ts
import type { Plugin, PluginContext, ScrapeResult } from '@lesca/shared/types'

let logger: PluginContext['logger']

export const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My custom Lesca plugin',

  onInit(context: PluginContext): void {
    logger = context.logger
    logger.info('My plugin initialized!')
  },

  onScrapeResult(result: ScrapeResult): ScrapeResult {
    if (result.success && result.data) {
      logger.debug('Processing result', { type: result.data.type })
      // Add custom footer
      result.data.content += '\n\n---\n*Processed by my-plugin*'
    }
    return result
  },

  onCleanup(): void {
    logger.info('My plugin cleaned up')
  },
}

export default myPlugin
```

### 2. Register the Plugin

**Option A: Programmatic Registration**

```typescript
import { PluginManager } from '@lesca/core'
import { myPlugin } from './my-plugin'

const pluginManager = new PluginManager()
pluginManager.register(myPlugin)
await pluginManager.init()
```

**Option B: Configuration File**

```yaml
# lesca.config.yaml
plugins:
  enabled: true
  directory: './plugins'
  plugins:
    - name: './my-plugin'
      enabled: true
      options:
        customOption: 'value'
```

### 3. Test Your Plugin

```typescript
import { describe, it, expect, vi } from 'vitest'
import { myPlugin } from './my-plugin'

describe('My Plugin', () => {
  const mockContext = {
    config: {},
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }

  it('should initialize correctly', () => {
    myPlugin.onInit?.(mockContext)
    expect(mockContext.logger.info).toHaveBeenCalledWith('My plugin initialized!')
  })
})
```

## Plugin Interface

### Required Properties

| Property  | Type   | Description                    |
| --------- | ------ | ------------------------------ |
| `name`    | string | Unique identifier for plugin   |
| `version` | string | Semantic version (e.g., 1.0.0) |

### Optional Properties

| Property      | Type   | Description                   |
| ------------- | ------ | ----------------------------- |
| `description` | string | Human-readable plugin summary |

### Hooks

All hooks are optional. Implement only the ones you need.

```typescript
interface Plugin {
  name: string
  version: string
  description?: string

  onInit?(context: PluginContext): Promise<void> | void
  onScrape?(request: ScrapeRequest): Promise<ScrapeRequest | undefined> | ScrapeRequest | undefined
  onScrapeResult?(
    result: ScrapeResult
  ): Promise<ScrapeResult | undefined> | ScrapeResult | undefined
  onSave?(data: unknown): Promise<unknown>
  onCleanup?(): Promise<void> | void
}
```

### PluginContext

Passed to `onInit`, provides access to configuration and logging:

```typescript
interface PluginContext {
  config: Record<string, unknown> // Plugin-specific options
  logger: {
    debug(message: string, ...args: unknown[]): void
    info(message: string, ...args: unknown[]): void
    warn(message: string, ...args: unknown[]): void
    error(message: string, ...args: unknown[]): void
  }
}
```

## Hook Lifecycle

Hooks execute in a specific order during the scraping process:

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Start                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. onInit(context)                                          │
│     - Called once when pluginManager.init() is invoked       │
│     - Store logger reference, initialize state               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  For each scrape request:                                    │
│                                                              │
│  2. onScrape(request) → ScrapeRequest                        │
│     - Modify or validate the request                         │
│     - Return undefined to use original request               │
│                                                              │
│  3. [Scraping happens]                                       │
│                                                              │
│  4. onScrapeResult(result) → ScrapeResult                    │
│     - Transform, filter, or enhance the result               │
│     - Mark as failed to prevent saving                       │
│                                                              │
│  5. onSave(data) → data                                      │
│     - Final transformation before storage                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  6. onCleanup()                                              │
│     - Called when pluginManager.cleanup() is invoked         │
│     - Release resources, generate reports                    │
└─────────────────────────────────────────────────────────────┘
```

### Hook Details

#### `onInit(context)`

Called once when the plugin manager initializes. Use this to:

- Store the logger reference for later use
- Initialize plugin state
- Read configuration options

```typescript
onInit(context: PluginContext): void {
  this.logger = context.logger
  this.apiKey = context.config.apiKey as string
  this.logger.info('Plugin initialized with API key')
}
```

#### `onScrape(request)`

Called before each scrape request. Use this to:

- Validate or modify requests
- Skip certain requests
- Add request metadata

```typescript
onScrape(request: ScrapeRequest): ScrapeRequest | undefined {
  // Skip premium problems
  if (request.type === 'problem' && request.includePremium) {
    this.logger.info(`Skipping premium request: ${request.titleSlug}`)
  }
  return request // Return the request (modified or not)
}
```

#### `onScrapeResult(result)`

Called after each scrape completes. Use this to:

- Transform the scraped content
- Add metadata to frontmatter
- Filter out unwanted results
- Track statistics

```typescript
onScrapeResult(result: ScrapeResult): ScrapeResult {
  if (!result.success || !result.data) {
    return result
  }

  // Add custom metadata
  result.data.frontmatter.processedAt = new Date().toISOString()
  result.data.frontmatter.processedBy = 'my-plugin'

  return result
}
```

**Filtering Results:**

To filter out a result (prevent it from being saved), mark it as unsuccessful:

```typescript
onScrapeResult(result: ScrapeResult): ScrapeResult {
  if (shouldFilter(result)) {
    return {
      ...result,
      success: false,
      error: new Error('Filtered by my-plugin'),
    }
  }
  return result
}
```

#### `onSave(data)`

Called before data is saved to storage. Use this for final transformations:

```typescript
async onSave(data: unknown): Promise<unknown> {
  // Compress or encrypt data before saving
  return data
}
```

#### `onCleanup()`

Called when the application shuts down. Use this to:

- Release resources
- Generate final reports
- Flush buffers

```typescript
onCleanup(): void {
  this.logger.info(`Processed ${this.count} items`)
  this.generateReport()
}
```

## Configuration

### Configuration File Structure

```yaml
# lesca.config.yaml
plugins:
  enabled: true # Enable the plugin system
  directory: './plugins' # Default plugin directory
  autoLoad: true # Auto-load plugins from directory

  plugins:
    # Local plugin
    - name: './my-plugin'
      enabled: true
      options:
        apiKey: 'xxx'
        threshold: 50

    # NPM package
    - name: 'lesca-plugin-analytics'
      enabled: true
      options:
        endpoint: 'https://api.example.com'

    # Absolute path
    - name: '/home/user/plugins/custom-plugin'
      enabled: false
```

### Accessing Configuration in Plugins

```typescript
onInit(context: PluginContext): void {
  const { apiKey, threshold } = context.config as {
    apiKey?: string
    threshold?: number
  }

  this.apiKey = apiKey ?? 'default-key'
  this.threshold = threshold ?? 50
}
```

### Environment Variable Overrides

```bash
LESCA_PLUGINS_ENABLED=true
LESCA_PLUGINS_DIR=./custom-plugins
```

## Working with Data

### ScrapeRequest Types

```typescript
type ScrapeRequest =
  | { type: 'problem'; titleSlug: string; includePremium?: boolean }
  | { type: 'editorial'; titleSlug: string }
  | { type: 'discussion'; titleSlug: string; discussionId?: string }
  | { type: 'user'; username: string }
  | { type: 'list'; difficulty?: string; limit?: number }
```

### ScrapeResult Structure

```typescript
interface ScrapeResult {
  success: boolean
  request: ScrapeRequest
  data?: ProcessedData
  error?: Error
}

interface ProcessedData {
  type: 'problem' | 'editorial' | 'discussion' | 'user' | 'list'
  content: string // Markdown content
  frontmatter: Record<string, unknown> // YAML frontmatter data
  metadata: {
    originalData: RawData
    processors: string[]
    processedAt: Date
  }
}
```

### Accessing Problem Data

```typescript
onScrapeResult(result: ScrapeResult): ScrapeResult {
  if (!result.success || !result.data) return result
  if (result.data.type !== 'problem') return result

  const originalData = result.data.metadata.originalData
  if (originalData.type !== 'problem') return result

  // Access problem properties
  const problem = originalData.data as Problem
  console.log(problem.title)
  console.log(problem.difficulty)
  console.log(problem.topicTags)

  return result
}
```

### Problem Interface (Key Fields)

```typescript
interface Problem {
  questionId: string
  questionFrontendId: string
  title: string
  titleSlug: string
  content: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  likes: number
  dislikes: number
  isPaidOnly: boolean
  topicTags: Array<{ name: string; slug: string }>
  stats: string // JSON string with acceptance rate
  // ... more fields
}
```

## Testing Plugins

### Test Setup

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PluginContext, ScrapeResult, ProcessedData, RawData } from '@lesca/shared/types'
import { createProblem, createProblemRequest } from '@/tests/factories/problem-factory'

import { myPlugin } from '../my-plugin'

describe('My Plugin', () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }

  const mockContext: PluginContext = {
    config: {},
    logger: mockLogger,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Tests here
})
```

### Creating Mock Results

```typescript
function createMockResult(problemOverrides = {}): ScrapeResult {
  const problem = createProblem(problemOverrides)

  const rawData: RawData = {
    type: 'problem',
    data: problem,
    metadata: { scrapedAt: new Date(), source: 'graphql' },
  }

  const processedData: ProcessedData = {
    type: 'problem',
    content: '# Test Problem',
    frontmatter: { title: problem.title },
    metadata: {
      originalData: rawData,
      processors: [],
      processedAt: new Date(),
    },
  }

  return {
    success: true,
    request: createProblemRequest({ titleSlug: problem.titleSlug }),
    data: processedData,
  }
}
```

### Example Tests

```typescript
it('should initialize correctly', () => {
  myPlugin.onInit?.(mockContext)
  expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('initialized'))
})

it('should process successful results', () => {
  myPlugin.onInit?.(mockContext)
  const result = myPlugin.onScrapeResult?.(createMockResult())
  expect(result?.data?.content).toContain('my-plugin')
})

it('should pass through failed results', () => {
  myPlugin.onInit?.(mockContext)
  const failedResult: ScrapeResult = {
    success: false,
    request: createProblemRequest(),
    error: new Error('Test error'),
  }
  const result = myPlugin.onScrapeResult?.(failedResult)
  expect(result).toEqual(failedResult)
})
```

## Publishing Plugins

### Package Structure

```
lesca-plugin-myname/
├── src/
│   ├── index.ts        # Main plugin export
│   └── __tests__/
│       └── index.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

### package.json

```json
{
  "name": "lesca-plugin-myname",
  "version": "1.0.0",
  "description": "My Lesca plugin",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "keywords": ["lesca", "lesca-plugin", "leetcode"],
  "peerDependencies": {
    "@lesca/shared": "^0.1.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  }
}
```

### Export Patterns

Plugins can be exported in multiple ways:

```typescript
// Default export (recommended)
export default myPlugin

// Named export
export const plugin = myPlugin

// Both
export const myPlugin: Plugin = { ... }
export default myPlugin
```

## Security Considerations

### Plugin Capabilities

Plugins have full Node.js API access. They can:

- Read/write files anywhere on the system
- Make network requests
- Execute system commands
- Access environment variables

### Security Best Practices

1. **Only use trusted plugins** - Review source code before installing
2. **Limit file access** - Only read/write within expected directories
3. **Validate inputs** - Don't trust data from external sources
4. **Don't log secrets** - Use the sanitized logger, never raw console
5. **Handle errors gracefully** - Don't expose sensitive data in error messages

### Path Validation

The plugin loader validates paths to prevent traversal attacks:

```typescript
// These will be rejected:
'../../../etc/passwd'
'./plugins/../../../secret'
```

## Debugging

### Enable Debug Logging

```bash
# Via environment variable
DEBUG=lesca:* lesca scrape two-sum

# Via CLI flag
lesca --debug scrape two-sum
```

### Plugin Debug Output

```typescript
onInit(context: PluginContext): void {
  this.logger = context.logger
  this.logger.debug('Plugin config:', context.config)
}

onScrapeResult(result: ScrapeResult): ScrapeResult {
  this.logger.debug('Processing result', {
    type: result.data?.type,
    success: result.success,
  })
  return result
}
```

### Common Issues

| Issue              | Solution                                    |
| ------------------ | ------------------------------------------- |
| Plugin not loading | Check path and export format                |
| Hooks not called   | Verify plugin is registered and initialized |
| Data not modified  | Ensure you return the modified data         |
| TypeScript errors  | Import types from `@lesca/shared/types`     |

## Best Practices

### 1. Always Return Data

Hooks should always return the input (modified or not):

```typescript
// Good
onScrapeResult(result: ScrapeResult): ScrapeResult {
  if (!result.success) return result
  // modify...
  return result
}

// Bad - may cause undefined behavior
onScrapeResult(result: ScrapeResult): ScrapeResult | undefined {
  if (!result.success) return // Missing return!
  return result
}
```

### 2. Use the Provided Logger

```typescript
// Good
context.logger.info('Processing item', { id: item.id })

// Bad - bypasses log sanitization
console.log('Processing item', item)
```

### 3. Handle Errors Gracefully

```typescript
onScrapeResult(result: ScrapeResult): ScrapeResult {
  try {
    // Risky operation
    const enhanced = this.enhance(result)
    return enhanced
  } catch (error) {
    this.logger.error('Enhancement failed', error as Error)
    return result // Return original on failure
  }
}
```

### 4. Keep State Minimal

```typescript
// Good - minimal, necessary state
let logger: PluginContext['logger']
let processedCount = 0

// Bad - storing large data structures
let allResults: ScrapeResult[] = [] // Memory leak risk
```

### 5. Use TypeScript Properly

```typescript
// Good - proper type imports
import type { Plugin, PluginContext, ScrapeResult } from '@lesca/shared/types'

// Good - type assertions after type guards
if (result.data?.type === 'problem') {
  const problem = originalData.data as Problem
}
```

### 6. Document Your Plugin

Include clear documentation:

- What the plugin does
- Configuration options
- Example usage
- Any dependencies

## Example Plugins

See the `examples/plugins/` directory for complete, working examples:

- **quality-enhancer** - Adds quality metrics to problems
- **stats-tracker** - Tracks scraping statistics
- **problem-filter** - Filters problems by criteria

These examples demonstrate patterns for:

- State management
- Factory functions for configuration
- Type-safe data access
- Comprehensive testing

---

**Related Documentation:**

- [Configuration Guide](./CONFIGURATION.md)
- [Security Policy](../SECURITY.md)
- [Example Plugins](../examples/plugins/README.md)
