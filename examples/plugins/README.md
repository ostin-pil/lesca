# Lesca Example Plugins

This directory contains example plugins that demonstrate the Lesca plugin system. These plugins are fully functional and can be used as-is or as templates for your own plugins.

## Available Plugins

### 1. Quality Enhancer (`quality-enhancer.ts`)

Enhances scraped problem data with additional quality metrics:

- **Quality Score**: 0-100 based on likes/dislikes ratio
- **Difficulty Rating**: 1-10 scale based on acceptance rate
- **Estimated Time**: Minutes to solve based on difficulty
- **Categories**: Grouped topic tags (e.g., "Dynamic Programming", "Trees")
- **Recommended**: Boolean flag for high-quality, reasonable-difficulty problems

```typescript
import { qualityEnhancerPlugin } from './examples/plugins'

pluginManager.register(qualityEnhancerPlugin)
```

**Output Example:**

The plugin adds a "Quality Metrics" section to the markdown output:

```markdown
## Quality Metrics

| Metric            | Value                                 |
| ----------------- | ------------------------------------- |
| Quality Score     | 85/100                                |
| Difficulty Rating | 6/10                                  |
| Estimated Time    | 30 min                                |
| Categories        | Dynamic Programming, Arrays & Strings |
| Recommended       | Yes                                   |
```

### 2. Stats Tracker (`stats-tracker.ts`)

Tracks scraping statistics and generates reports:

- Total/successful/failed scrapes
- Scrapes by type and difficulty
- Timing statistics (min/max/average)
- Recent scrape history

```typescript
import { statsTrackerPlugin, getStats, generateReport } from './examples/plugins'

pluginManager.register(statsTrackerPlugin)

// After scraping...
const stats = getStats()
console.log(`Success rate: ${((stats.successful / stats.total) * 100).toFixed(1)}%`)

// Generate full report
const report = generateReport()
console.log(report)
```

**Exported Functions:**

- `getStats()`: Get current statistics
- `resetStats()`: Reset all counters
- `generateReport()`: Generate markdown report

### 3. Problem Filter (`problem-filter.ts`)

Filters problems based on configurable criteria:

```typescript
import { createProblemFilterPlugin } from './examples/plugins'

const filterPlugin = createProblemFilterPlugin({
  skipPremium: true, // Skip premium-only problems
  minQuality: 60, // Minimum quality score
  difficulties: ['Easy', 'Medium'], // Only these difficulties
  requiredTags: ['array'], // Must have at least one of these tags
  excludedTags: ['math'], // Skip if has any of these tags
  skipScraped: true, // Skip already-scraped problems
})

pluginManager.register(filterPlugin)
```

**Configuration Options:**

| Option         | Type     | Description                   |
| -------------- | -------- | ----------------------------- |
| `skipPremium`  | boolean  | Skip premium-only problems    |
| `minQuality`   | number   | Minimum quality score (0-100) |
| `maxQuality`   | number   | Maximum quality score (0-100) |
| `difficulties` | string[] | Allowed difficulties          |
| `requiredTags` | string[] | At least one tag must match   |
| `excludedTags` | string[] | None of these tags allowed    |
| `skipScraped`  | boolean  | Skip already-scraped problems |
| `customFilter` | function | Custom filter function        |

**Exported Functions:**

- `createProblemFilterPlugin(options)`: Create configured plugin
- `getScrapedProblems()`: Get list of scraped slugs
- `clearScrapedCache()`: Clear the scraped cache
- `markAsScraped(slug)`: Manually mark a problem as scraped

## Creating Your Own Plugin

### Plugin Interface

```typescript
interface Plugin {
  name: string
  version: string
  description?: string

  // Called when plugin is initialized
  onInit?(context: PluginContext): Promise<void> | void

  // Called before scraping - can modify the request
  onScrape?(request: ScrapeRequest): Promise<ScrapeRequest | undefined> | ScrapeRequest | undefined

  // Called after scraping - can modify the result
  onScrapeResult?(
    result: ScrapeResult
  ): Promise<ScrapeResult | undefined> | ScrapeResult | undefined

  // Called before saving - can modify the data
  onSave?(data: unknown): Promise<unknown>

  // Called on shutdown
  onCleanup?(): Promise<void> | void
}
```

### Plugin Context

The `PluginContext` provides:

```typescript
interface PluginContext {
  config: Record<string, unknown> // Plugin configuration
  logger: {
    debug(message: string, ...args: unknown[]): void
    info(message: string, ...args: unknown[]): void
    warn(message: string, ...args: unknown[]): void
    error(message: string, ...args: unknown[]): void
  }
}
```

### Minimal Plugin Example

```typescript
import type { Plugin, PluginContext } from '@lesca/shared/types'

export const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My custom plugin',

  onInit(context: PluginContext): void {
    context.logger.info('My plugin initialized!')
  },

  onScrapeResult(result) {
    if (result.success && result.data) {
      // Modify the result
      result.data.content += '\n\n<!-- Processed by my-plugin -->'
    }
    return result
  },
}

export default myPlugin
```

### Hook Execution Order

1. `onInit` - Called once when `pluginManager.init()` is called
2. `onScrape` - Called before each scrape request
3. `onScrapeResult` - Called after each scrape completes
4. `onSave` - Called before data is saved to storage
5. `onCleanup` - Called when `pluginManager.cleanup()` is called

### Best Practices

1. **Always return the input if not modifying**: Hooks should return the input unchanged if no modification is needed.

2. **Use the provided logger**: Don't use `console.log` - use `context.logger` for consistent output.

3. **Handle errors gracefully**: Wrap risky operations in try/catch to prevent breaking the pipeline.

4. **Keep hooks fast**: Avoid slow operations in hooks as they run synchronously in the pipeline.

5. **Use TypeScript**: Type your plugins properly for better IDE support and error checking.

## Testing Plugins

See `examples/plugins/__tests__/` for example test files.

```typescript
import { describe, it, expect, vi } from 'vitest'
import { qualityEnhancerPlugin } from '../quality-enhancer'

describe('Quality Enhancer Plugin', () => {
  it('should calculate quality score correctly', () => {
    // Test implementation...
  })
})
```

## Loading Plugins Dynamically

Plugins can be loaded dynamically from paths:

```typescript
const pluginManager = new PluginManager({}, [
  './examples/plugins/quality-enhancer',
  './examples/plugins/stats-tracker',
])

await pluginManager.init()
```

Or from npm packages:

```typescript
const pluginManager = new PluginManager({}, [
  'lesca-plugin-custom', // Loads from node_modules
])
```
