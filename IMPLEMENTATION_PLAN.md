# Lesca Implementation Plan

## Current State
- **Existing Code**: Python/Selenium prototype with basic cookie auth
- **Target Architecture**: TypeScript/Node.js modular system with GraphQL
- **Gap**: Need to bridge from prototype to production architecture

## Critical First Decision

### Technology Stack Choice

**Option A: TypeScript/Node.js** (Recommended per architecture)
- ✅ Better type safety for complex architecture
- ✅ Rich npm ecosystem for tools
- ✅ Better async/await patterns
- ✅ Easier monorepo management
- ❌ Need to rewrite existing Python code
- ❌ Steeper learning curve if team knows Python better

**Option B: Python** (Leverage existing code)
- ✅ Can build on existing prototype
- ✅ Simpler deployment (single file possible)
- ✅ Good libraries (requests, BeautifulSoup, Playwright)
- ❌ Weaker type system (even with type hints)
- ❌ Less mature monorepo tools
- ❌ Architecture document assumes TypeScript

**Recommendation**: Go with TypeScript/Node.js as per your architecture. The existing Python code is minimal (40 lines with typos) and easy to rewrite.

---

## Phase 0: Validation & Setup (1-2 days)

**Goal**: Validate core assumptions before building

### Tasks

#### 0.1 Validate GraphQL Approach
```bash
# Test LeetCode GraphQL endpoint manually
# Verify it provides all needed data:
# - Problem content with examples
# - Editorial content
# - Discussion threads
# - User statistics
# - Company/tag listings
```

**Acceptance Criteria**:
- [ ] GraphQL returns problem statements with HTML
- [ ] GraphQL returns editorial content (or identify if browser needed)
- [ ] GraphQL returns discussion threads
- [ ] Identify any content that requires browser automation

**Output**: Document `graphql-coverage.md` listing what GraphQL provides vs what needs browser

#### 0.2 Set Up Development Environment
```bash
# Initialize project
npm init -y
npm install -D typescript @types/node tsx
npm install -D eslint prettier @typescript-eslint/eslint-plugin
npm install -D vitest @vitest/ui

# Set up monorepo structure
mkdir -p packages/{core,auth,api-client,scrapers,converters,storage,cli}
mkdir -p shared/{types,config,utils}
mkdir -p plugins examples

# Initialize TypeScript
npx tsc --init
```

**Files to Create**:
- `package.json` - Root workspace configuration
- `tsconfig.json` - Base TypeScript config
- `tsconfig.build.json` - Build-specific config
- `.eslintrc.js` - Linting rules
- `.prettierrc` - Code formatting
- `vitest.config.ts` - Test configuration

**Acceptance Criteria**:
- [ ] TypeScript compiles successfully
- [ ] Can run tests with vitest
- [ ] Workspaces configured (npm/pnpm/yarn)
- [ ] Linting and formatting work

#### 0.3 Create Shared Types
```typescript
// shared/types/index.ts
export interface Problem {
  id: number
  titleSlug: string
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  content: string
  examples: Example[]
  constraints: string[]
  tags: string[]
  companies: string[]
  acceptance: number
  // ... more fields
}

export interface ScrapeRequest {
  type: 'problem' | 'list' | 'discussion'
  // ... discriminated union based on type
}

// ... other core types
```

**Acceptance Criteria**:
- [ ] Core domain types defined
- [ ] Proper TypeScript discriminated unions
- [ ] Types exported and importable by packages

---

## Phase 1: Minimal Viable Scraper (3-5 days)

**Goal**: Scrape a single problem and save as markdown

### Architecture Focus
- Core facade (minimal)
- GraphQL client (basic)
- Cookie authentication (simple)
- One scraper strategy (problem)
- One converter (HTML to Markdown)
- File system storage (basic)

### 1.1 GraphQL Client (`packages/api-client`)

```typescript
// packages/api-client/src/graphql-client.ts
export class GraphQLClient {
  async query<T>(query: string, variables?: object): Promise<T>
  async getProblem(titleSlug: string): Promise<Problem>
}
```

**Key Features**:
- Basic fetch-based GraphQL queries
- Cookie authentication (from file)
- Error handling
- No rate limiting yet (add in Phase 3)

**Tests**:
- Mock GraphQL responses
- Test error handling
- Test cookie injection

**Acceptance Criteria**:
- [ ] Can query LeetCode GraphQL
- [ ] Returns parsed Problem object
- [ ] Handles network errors gracefully

### 1.2 Cookie Authentication (`packages/auth`)

```typescript
// packages/auth/src/cookie-auth.ts
export class CookieFileAuth implements AuthStrategy {
  async load(filePath: string): Promise<void>
  getCookieString(): string
  getCsrfToken(): string
  isValid(): boolean
}
```

**Key Features**:
- Load cookies from JSON file
- Format for HTTP headers
- Extract CSRF token
- Basic validation (not expired)

**Cookie File Format**:
```json
{
  "cookies": [
    {"name": "LEETCODE_SESSION", "value": "...", "domain": ".leetcode.com"},
    {"name": "csrftoken", "value": "...", "domain": "leetcode.com"}
  ]
}
```

**Acceptance Criteria**:
- [ ] Loads cookie file successfully
- [ ] Formats cookies for GraphQL client
- [ ] Validates cookie expiry

### 1.3 HTML to Markdown Converter (`packages/converters`)

```typescript
// packages/converters/src/html-to-markdown.ts
export class HtmlToMarkdownConverter {
  convert(html: string, options?: ConvertOptions): string
}
```

**Key Features**:
- Use `turndown` library as base
- Preserve code blocks with language detection
- Handle inline code
- Simple table conversion
- Strip JavaScript/tracking

**Acceptance Criteria**:
- [ ] Converts basic HTML to markdown
- [ ] Preserves code blocks correctly
- [ ] Handles LeetCode-specific HTML patterns

### 1.4 File System Storage (`packages/storage`)

```typescript
// packages/storage/src/filesystem-storage.ts
export class FileSystemStorage {
  async save(key: string, content: string): Promise<void>
  async load(key: string): Promise<string>
  async exists(key: string): Promise<boolean>
}
```

**Key Features**:
- Save markdown files
- Consistent naming: `{id}-{slug}.md`
- Create directories as needed
- Atomic writes (temp + rename)

**Acceptance Criteria**:
- [ ] Saves files with correct names
- [ ] Creates nested directories
- [ ] Handles file system errors

### 1.5 Problem Scraper Strategy (`packages/scrapers`)

```typescript
// packages/scrapers/src/problem-strategy.ts
export class ProblemStrategy implements ScraperStrategy {
  canHandle(request: ScrapeRequest): boolean
  async execute(request: ProblemRequest): Promise<RawData>
}
```

**Key Features**:
- Fetch problem via GraphQL
- Basic data validation
- Return structured raw data
- No enhancements yet

**Acceptance Criteria**:
- [ ] Fetches problem from GraphQL
- [ ] Returns complete problem data
- [ ] Handles missing problems (404)

### 1.6 Core Facade (`packages/core`)

```typescript
// packages/core/src/scraper.ts
export class LeetCodeScraper {
  async scrape(request: ScrapeRequest): Promise<ScrapeResult> {
    const strategy = this.selectStrategy(request)
    const raw = await strategy.execute(request)
    const markdown = this.converter.convert(raw.content)
    await this.storage.save(raw.titleSlug, markdown)
    return { success: true, path: `${raw.id}-${raw.titleSlug}.md` }
  }
}
```

**Key Features**:
- Strategy selection (only one for now)
- Call converter
- Call storage
- Return result

**Acceptance Criteria**:
- [ ] Orchestrates the full flow
- [ ] Handles errors from strategies
- [ ] Returns success/failure status

### 1.7 Simple CLI (`packages/cli`)

```bash
# Goal: Make it work with minimal commands
lesca scrape problem two-sum
```

```typescript
// packages/cli/src/index.ts
import { Command } from 'commander'

const program = new Command()

program
  .command('scrape problem <slug>')
  .description('Scrape a single problem')
  .action(async (slug) => {
    // Load config
    // Initialize scraper
    // Execute scraping
    // Print result
  })
```

**Key Features**:
- Use `commander` for CLI parsing
- Load simple config (just cookie path and output dir)
- Pretty error messages
- Success feedback

**Acceptance Criteria**:
- [ ] Can run from command line
- [ ] Scrapes and saves problem
- [ ] Shows clear success/error messages

---

## Phase 2: Processing Pipeline (2-3 days)

**Goal**: Add proper processing pipeline with multiple processors

### 2.1 Pipeline Architecture

```typescript
// packages/core/src/pipeline.ts
export interface Processor {
  name: string
  shouldProcess(data: any): boolean
  process(data: any): Promise<any>
}

export class ProcessingPipeline {
  constructor(private processors: Processor[])

  async process(data: RawData): Promise<ProcessedData> {
    let result = data
    for (const processor of this.processors) {
      if (processor.shouldProcess(result)) {
        result = await processor.process(result)
      }
    }
    return result
  }
}
```

### 2.2 Built-in Processors

#### Content Cleaner
```typescript
// packages/core/src/processors/content-cleaner.ts
export class ContentCleanerProcessor implements Processor {
  // Remove scripts, styles, tracking
  // Normalize whitespace
  // Fix broken HTML
}
```

#### Image Downloader
```typescript
// packages/core/src/processors/image-downloader.ts
export class ImageDownloaderProcessor implements Processor {
  // Find images in content
  // Download to local directory
  // Update paths to local references
}
```

#### Metadata Enhancer
```typescript
// packages/core/src/processors/metadata-enhancer.ts
export class MetadataEnhancerProcessor implements Processor {
  // Add computed fields
  // Normalize tags
  // Add timestamps
}
```

### 2.3 Obsidian Converter

```typescript
// packages/converters/src/obsidian-converter.ts
export class ObsidianConverter {
  // Generate YAML frontmatter
  // Convert to wiki-links
  // Format tags
  // Add backlinks
}
```

**Frontmatter Example**:
```yaml
---
leetcode_id: 1
title: Two Sum
difficulty: Easy
tags:
  - array
  - hash-table
companies:
  - google
  - amazon
acceptance: 47.3%
date_scraped: 2024-01-15
---
```

**Acceptance Criteria**:
- [ ] Pipeline executes processors in order
- [ ] Each processor is testable in isolation
- [ ] Content is cleaned properly
- [ ] Images are downloaded and referenced correctly
- [ ] Obsidian format has proper frontmatter

---

## Phase 3: Configuration & CLI Enhancement (2-3 days)

**Goal**: Production-ready CLI with configuration system

### 3.1 Configuration System

```typescript
// shared/config/src/config.ts
export interface Config {
  auth: AuthConfig
  api: ApiConfig
  output: OutputConfig
  // ... more sections
}

export class ConfigManager {
  static async load(): Promise<Config> {
    // Load from multiple sources
    // Merge with priority
    // Validate against schema
  }
}
```

**Configuration Files**:
- `~/.lesca/config.yaml` - User config
- `.lesca.yaml` - Project config (optional)
- Environment variables
- CLI arguments

**Validation**:
- Use `zod` or `joi` for schema validation
- Helpful error messages
- Default values for optional fields

### 3.2 Rate Limiting

```typescript
// shared/utils/src/rate-limiter.ts
export class RateLimiter {
  async acquire(): Promise<void>
  reportRateLimit(): void  // Trigger backoff
}
```

**Features**:
- Configurable delays
- Random jitter
- Exponential backoff
- 429 detection

### 3.3 Enhanced CLI

```bash
# All basic commands
lesca init                          # Setup wizard
lesca auth import <file>            # Import cookies
lesca scrape problem <slug>         # Single problem
lesca scrape list --tag array       # Filter by tag
lesca scrape range 1-100           # Problem range
lesca export --format obsidian      # Export
```

**Features**:
- Progress bars (`cli-progress`)
- Colored output (`chalk`)
- Interactive prompts (`inquirer`)
- Shell completion

### 3.4 Logging System

```typescript
// shared/utils/src/logger.ts
export class Logger {
  debug(message: string, meta?: object): void
  info(message: string, meta?: object): void
  warn(message: string, meta?: object): void
  error(message: string, meta?: object): void
}
```

**Features**:
- Multiple transports (console, file)
- Log levels
- Structured logging (JSON)
- Log rotation

**Acceptance Criteria**:
- [ ] Config loads from multiple sources
- [ ] Rate limiting prevents API abuse
- [ ] CLI has good UX (colors, progress)
- [ ] Logs are useful for debugging

---

## Phase 4: Browser Automation (2-4 days)

**Goal**: Add browser automation for content GraphQL can't fetch

### Prerequisites
- Complete Phase 0.1 to identify what needs browser
- Only implement if GraphQL is insufficient

### 4.1 Browser Driver Interface

```typescript
// packages/browser-automation/src/driver.ts
export interface BrowserDriver {
  launch(options?: LaunchOptions): Promise<void>
  navigate(url: string): Promise<void>
  waitForSelector(selector: string, timeout?: number): Promise<void>
  extractContent(selector: string): Promise<string>
  close(): Promise<void>
}
```

### 4.2 Playwright Implementation

```typescript
// packages/browser-automation/src/playwright-driver.ts
export class PlaywrightDriver implements BrowserDriver {
  // Implement using Playwright
  // Resource blocking for performance
  // Cookie injection for auth
}
```

### 4.3 Selector Manager

```yaml
# selectors.yaml
selectors:
  problem:
    title: "[data-cy='question-title']"
    content: ".question-content__JfgR"
    difficulty: "[diff-label]"

  discussion:
    threads: ".discuss-item"
    content: ".discuss-markdown-container"
```

```typescript
// shared/utils/src/selectors.ts
export class SelectorManager {
  get(key: string): string
  testAll(html: string): TestResults
}
```

### 4.4 Browser-Based Strategies

```typescript
// packages/scrapers/src/discussion-strategy.ts
export class DiscussionStrategy implements ScraperStrategy {
  // Use browser to navigate discussion page
  // Extract thread content
  // Parse and structure
}
```

**Acceptance Criteria**:
- [ ] Browser launches headlessly
- [ ] Can navigate and extract content
- [ ] Selectors are configurable
- [ ] Resource blocking improves performance
- [ ] Only used when GraphQL insufficient

---

## Phase 5: Quality Features (3-5 days)

**Goal**: Add quality filtering, caching, and polish

### 5.1 Quality Scoring

```typescript
// shared/utils/src/quality-scorer.ts
export class QualityScorer {
  scoreDiscussion(discussion: Discussion): number
  filterByQuality(items: any[], minScore: number): any[]
}
```

**Scoring Factors**:
- Wilson score for voting
- Code presence detection
- Length and completeness
- Technical term density
- Recency

### 5.2 Caching System

```typescript
// shared/utils/src/cache.ts
export class Cache {
  async get<T>(key: string): Promise<T | null>
  async set<T>(key: string, value: T, ttl?: number): Promise<void>
  async clear(pattern?: string): Promise<void>
}
```

**Features**:
- File-based cache
- TTL support
- Size limits
- Compression (gzip)

### 5.3 Checkpoint & Resume

```typescript
// packages/core/src/checkpoint.ts
export class CheckpointManager {
  save(state: ScrapeState): Promise<void>
  load(): Promise<ScrapeState | null>
  clear(): Promise<void>
}
```

**Features**:
- Save progress periodically
- Resume on interrupt
- Clear on completion

### 5.4 List Scraping

```typescript
// packages/scrapers/src/list-strategy.ts
export class ListStrategy implements ScraperStrategy {
  // Filter by tags, companies, difficulty
  // Batch fetching
  // Progress tracking
  // Checkpoint support
}
```

**Acceptance Criteria**:
- [ ] Quality filtering works effectively
- [ ] Cache reduces redundant API calls
- [ ] Can resume interrupted scrapes
- [ ] Can scrape problem lists efficiently

---

## Phase 6: Plugin System (2-3 days)

**Goal**: Enable extensibility through plugins

### 6.1 Plugin Architecture

```typescript
// packages/core/src/plugin.ts
export interface Plugin {
  name: string
  version: string
  type: PluginType

  install(context: PluginContext): Promise<void>
  activate(): Promise<void>
  deactivate(): Promise<void>
}

export interface PluginContext {
  config: ConfigManager
  hooks: HookManager
  logger: Logger
  storage: StorageAdapter
}
```

### 6.2 Hook System

```typescript
// packages/core/src/hooks.ts
export class HookManager {
  register(event: string, handler: Function): void
  emit(event: string, data: any): Promise<void>
}
```

**Events**:
- `before:scrape`
- `after:scrape`
- `before:process`
- `after:process`
- `before:save`
- `after:save`

### 6.3 Example Plugin: Anki Export

```typescript
// plugins/anki-export/src/index.ts
export class AnkiExportPlugin implements Plugin {
  async activate() {
    this.hooks.register('after:scrape', this.generateFlashcard)
  }

  private generateFlashcard(problem: Problem) {
    // Convert to Anki format
    // Save as .apkg
  }
}
```

**Acceptance Criteria**:
- [ ] Plugins can be loaded dynamically
- [ ] Hook system works correctly
- [ ] Example plugin demonstrates capability
- [ ] Plugin configuration works

---

## Phase 7: Testing & Documentation (2-3 days)

**Goal**: Comprehensive testing and documentation

### 7.1 Testing

**Unit Tests**:
- Each module tested in isolation
- Mock external dependencies
- 80%+ code coverage

**Integration Tests**:
- Test module interactions
- Use fixtures for API responses
- Test error scenarios

**E2E Tests**:
- CLI command testing
- Full scraping workflows
- Config loading and validation

### 7.2 Documentation

**User Documentation**:
- `README.md` - Quick start
- `docs/installation.md` - Setup guide
- `docs/configuration.md` - Config reference
- `docs/cli-reference.md` - Command docs
- `docs/plugins.md` - Plugin development

**Developer Documentation**:
- `docs/architecture.md` - Your existing doc
- `docs/contributing.md` - Contribution guide
- `docs/api.md` - API reference
- Code comments and JSDoc

**Acceptance Criteria**:
- [ ] Test coverage >80%
- [ ] All critical paths tested
- [ ] Documentation is complete
- [ ] Examples work correctly

---

## Deployment (1 day)

### Package for Distribution

```json
{
  "name": "@lesca/cli",
  "version": "1.0.0",
  "bin": {
    "lesca": "./dist/cli/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ]
}
```

### Build Process

```bash
# Build all packages
npm run build

# Create standalone binary (optional)
npm run build:binary

# Publish to npm
npm publish --access public
```

### Distribution Options

1. **NPM Package** (Primary)
   ```bash
   npm install -g @lesca/cli
   ```

2. **Standalone Binary** (Optional)
   - Use `pkg` or `esbuild` to create executables
   - Distribute via GitHub releases

3. **Docker Image** (Optional)
   - For users who prefer containers

**Acceptance Criteria**:
- [ ] Builds successfully
- [ ] Can install via npm
- [ ] Binary works on major platforms
- [ ] Published to npm registry

---

## Timeline Summary

| Phase | Duration | Description |
|-------|----------|-------------|
| Phase 0 | 1-2 days | Validation & Setup |
| Phase 1 | 3-5 days | Minimal Viable Scraper |
| Phase 2 | 2-3 days | Processing Pipeline |
| Phase 3 | 2-3 days | Configuration & CLI |
| Phase 4 | 2-4 days | Browser Automation |
| Phase 5 | 3-5 days | Quality Features |
| Phase 6 | 2-3 days | Plugin System |
| Phase 7 | 2-3 days | Testing & Docs |
| Deployment | 1 day | Package & Publish |
| **Total** | **18-29 days** | **~4-6 weeks** |

---

## Priority Ranking

### Must Have (MVP)
1. ✅ GraphQL client with cookie auth
2. ✅ Single problem scraping
3. ✅ HTML to Markdown conversion
4. ✅ File system storage
5. ✅ Basic CLI

### Should Have (v1.0)
6. ✅ Processing pipeline
7. ✅ Obsidian format support
8. ✅ Configuration system
9. ✅ Rate limiting
10. ✅ List scraping
11. ✅ Quality filtering
12. ✅ Caching
13. ✅ Resume capability

### Nice to Have (v1.x)
14. ⭕ Browser automation (if needed)
15. ⭕ Plugin system
16. ⭕ Web UI
17. ⭕ SQLite storage
18. ⭕ Advanced quality scoring

---

## Risks & Mitigation

### Risk 1: GraphQL May Not Provide Everything
**Mitigation**: Phase 0 validates this first. If needed, add browser automation.

### Risk 2: Rate Limiting/Blocking by LeetCode
**Mitigation**:
- Implement conservative rate limiting from day 1
- Add exponential backoff
- Respect robots.txt
- Add user-agent identification

### Risk 3: Selectors Break on UI Updates
**Mitigation**:
- Use data attributes when possible
- Implement selector fallback chains
- Make selectors configurable
- Community can update selector file

### Risk 4: Cookie Expiration
**Mitigation**:
- Implement session refresh logic
- Warn user before expiry
- Graceful degradation to public content

### Risk 5: Scope Creep
**Mitigation**:
- Stick to MVP first (Phases 0-3)
- Resist adding features until core is solid
- Use plugin system for "nice to have" features

---

## Success Criteria

### MVP Success (End of Phase 3)
- [ ] Can scrape a single problem
- [ ] Saves as properly formatted Markdown
- [ ] Obsidian frontmatter is correct
- [ ] Images are downloaded locally
- [ ] CLI is intuitive and works
- [ ] Configuration is simple

### v1.0 Success (End of Phase 5)
- [ ] Can scrape problem lists efficiently
- [ ] Quality filtering works well
- [ ] Caching reduces API calls
- [ ] Can resume interrupted scrapes
- [ ] Rate limiting prevents blocking
- [ ] Works reliably for common use cases

### v1.x Success (End of Phase 7)
- [ ] Plugin system enables extensions
- [ ] Well documented and tested
- [ ] Published and installable
- [ ] Community can contribute

---

## Next Steps

1. **Decision Point**: Confirm TypeScript/Node.js as technology stack
2. **Validate GraphQL**: Spend 2-4 hours testing GraphQL coverage
3. **Start Phase 0**: Set up development environment
4. **Create First PR**: Simple GraphQL client that fetches one problem

Would you like me to start with any specific phase?
