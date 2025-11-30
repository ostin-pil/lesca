---
name: strategy-patterns
description: Provides knowledge of design patterns used in Lesca including Facade, Strategy, Singleton, and Adapter patterns. Use when implementing or extending scrapers and converters.
allowed-tools: Read, Grep, Glob
---

# Lesca Design Patterns Skill

You understand and apply the design patterns used in the Lesca project.

## 1. Strategy Pattern (Scrapers)

Location: `packages/scrapers/src/`

Interface: `ScraperStrategy` from `@/shared/types`

```typescript
export interface ScraperStrategy {
  name: string
  priority: number
  canHandle(request: ScrapeRequest): boolean
  execute(request: ScrapeRequest): Promise<RawData>
}
```

Existing Strategies:

- `ProblemScraperStrategy` - Individual problems
- `ListScraperStrategy` - Problem lists
- `EditorialScraperStrategy` - Editorials (browser required)
- `DiscussionScraperStrategy` - Discussion threads

## 2. Facade Pattern (Core)

Location: `packages/core/src/scraper.ts`

The `LeetCodeScraper` class orchestrates strategies, converters, and storage.

```typescript
export class LeetCodeScraper {
  constructor(
    private strategies: ScraperStrategy[],
    private storage: StorageAdapter,
    private converter: Converter
  ) {}

  async scrape(request: ScrapeRequest): Promise<ScrapeResult> {
    const strategy = this.selectStrategy(request)
    const raw = await strategy.execute(request)
    const processed = await this.converter.convert(raw)
    await this.storage.save(processed)
    return { success: true, data: processed }
  }
}
```

## 3. Singleton Pattern (Config)

Location: `shared/config/src/manager.ts`

```typescript
export class ConfigManager {
  private static instance: ConfigManager | null = null

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(createDefaultConfig())
    }
    return ConfigManager.instance
  }
}
```

## 4. Adapter Pattern (Converters)

Location: `packages/converters/src/html-to-markdown.ts`

The `TurndownAdapter` isolates the Turndown library from the converter interface.

```typescript
interface HtmlToMarkdownAdapter {
  convert(html: string): string
}

class TurndownAdapter implements HtmlToMarkdownAdapter {
  // Turndown-specific implementation
}

export class HtmlToMarkdownConverter implements Converter {
  private adapter: HtmlToMarkdownAdapter
  // Uses adapter internally
}
```

## Key Interfaces

All in `shared/types/src/index.ts`:

- `ScraperStrategy` - Scraping implementations
- `Converter` - Format transformation
- `StorageAdapter` - Persistence abstraction
- `ScrapeRequest` / `ScrapeResult` - Request/response types
