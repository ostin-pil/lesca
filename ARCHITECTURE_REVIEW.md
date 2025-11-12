# Lesca Architecture Review

## Executive Summary

Your architecture document is **exceptionally well-designed** with strong patterns, clear rationale, and comprehensive coverage. However, there's a gap between your current state (Python prototype) and the target architecture (TypeScript monorepo).

**Recommendation**: Start fresh with TypeScript following a phased approach, building MVP first then adding sophistication.

---

## Detailed Review

### 🟢 Strong Architectural Decisions

#### 1. Pure Facade Pattern
```typescript
// Excellent: Zero branching in facade
async scrape(request: ScrapeRequest): Promise<ScrapeResult> {
  const strategy = this.selectStrategy(request)
  const raw = await strategy.execute(request)
  const processed = await this.pipeline.process(raw)
  return processed
}
```

**Why it's good**:
- Business logic stays in strategies
- Easy to test (mock strategies)
- New features don't touch core
- Clear orchestration vs implementation

#### 2. Strategy Pattern for Scrapers
```typescript
interface ScraperStrategy {
  canHandle(request: ScrapeRequest): boolean
  execute(request: ScrapeRequest): Promise<RawData>
}
```

**Why it's good**:
- Each content type has its own strategy
- Strategies evolve independently
- Chain of responsibility for selection
- Testable in isolation

#### 3. Processing Pipeline
```typescript
for (const processor of this.processors) {
  if (processor.shouldProcess(result)) {
    result = await processor.process(result)
  }
}
```

**Why it's good**:
- Composable data transformations
- Each processor single-purpose
- Easy to add/remove processors
- Order-independent where possible

#### 4. Sequential Processing (No Concurrency)
**Why it's good**:
- No race conditions
- Easier debugging
- Natural rate limiting
- Predictable behavior
- Simpler error handling

#### 5. GraphQL-Only Approach
**Why it's good**:
- Single API to maintain
- LeetCode has migrated to GraphQL
- Get exactly what you need
- Batch queries possible

#### 6. Local-First Storage
**Why it's good**:
- Privacy (data stays local)
- No cloud complexity
- Works offline
- Easy backup (just files)
- Full user control

---

### 🟡 Areas That Need Consideration

#### 1. Monorepo Complexity

**Your Plan**:
```
packages/
├── core/
├── auth/
├── api-client/
├── browser-automation/
├── scrapers/
├── converters/
├── storage/
├── cli/
└── web-ui/
```

**Concern**: 9 packages from day one is complex

**Recommendation**:
```
Phase 1 (MVP):
lesca/
├── src/
│   ├── core/         # Facade + pipeline
│   ├── graphql/      # API client
│   ├── auth/         # Cookie auth
│   ├── converters/   # HTML → Markdown
│   └── cli/          # CLI entry point
├── shared/
│   └── types/        # TypeScript types
└── package.json      # Single package

Phase 2+:
- Split into packages when needed
- Add monorepo tooling (pnpm workspaces)
```

**Why**: Start simple, split when pain points emerge

#### 2. Browser Automation as Default

**Your Plan**: Include browser automation from start

**Concern**: Heavy dependency (Playwright/Puppeteer) if not needed

**Recommendation**:
1. **Phase 0**: Test GraphQL coverage first (2-4 hours)
2. **If GraphQL sufficient**: Skip browser automation entirely
3. **If GraphQL insufficient**: Add browser as Phase 4

**Test Checklist**:
```graphql
# Can GraphQL provide:
✓ Problem statement with HTML
✓ Examples and constraints
✓ Hints (if any)
✓ Tags and companies
✓ Acceptance rate
✓ Discussion thread list
? Editorial content (premium)
? Full discussion content (with formatting)
? User-specific data (submissions)
```

**Why**: Browser automation is 80% of complexity for maybe 20% of features

#### 3. Quality Scoring Sophistication

**Your Plan**: Wilson score, multi-factor quality ranking

**Concern**: Complex algorithm for MVP

**Recommendation**:

**Phase 1 (MVP)**:
```typescript
// Simple: Just download everything
async scrapeDiscussions(problemId: number) {
  const discussions = await this.graphql.getDiscussions(problemId)
  return discussions // No filtering
}
```

**Phase 3 (Enhancement)**:
```typescript
// Add simple filtering
async scrapeDiscussions(problemId: number) {
  const discussions = await this.graphql.getDiscussions(problemId)
  return discussions
    .filter(d => d.upvotes > 10)  // Simple threshold
    .slice(0, 10)                  // Top 10
}
```

**Phase 5 (Sophisticated)**:
```typescript
// Add Wilson score and multi-factor
const scored = discussions.map(d => ({
  ...d,
  score: this.qualityScorer.score(d)
}))
return scored
  .filter(d => d.score > 60)
  .sort((a, b) => b.score - a.score)
  .slice(0, config.maxDiscussions)
```

**Why**: Get value early, add sophistication later

#### 4. Configuration Complexity

**Your Plan**: 4-layer config (defaults → user → project → CLI)

**Concern**: Complex for MVP

**Recommendation**:

**Phase 1 Config**:
```yaml
# ~/.lesca/config.yaml (minimal)
cookiePath: ~/.lesca/cookies.json
outputDir: ~/lesca-output
```

**Phase 3 Config**:
```yaml
# Add more layers
auth:
  method: cookie-file
  path: ~/.lesca/cookies.json

output:
  directory: ~/lesca-output
  format: obsidian

rateLimit:
  delay: 2000
  jitter: true
```

**Phase 5 Config**:
```yaml
# Full hierarchical config
# With validation, env vars, CLI override
```

**Why**: Configuration should grow with features

#### 5. Plugin System Timing

**Your Plan**: Plugin architecture from start

**Concern**: Premature abstraction

**Recommendation**:
- **Phase 1-3**: Build core without plugin hooks
- **Phase 6**: Add plugin system once core is stable
- **Phase 7**: Create example plugins

**Why**: You need to use the system to know where plugin points should be

---

### 🔴 Critical Decisions Needed

#### Decision 1: Technology Stack

**Current State**: Python prototype (40 lines, has typos)

**Your Architecture**: TypeScript/Node.js

**Options**:

| Aspect | TypeScript | Python |
|--------|-----------|---------|
| Type Safety | ✅ Excellent | ⚠️ Okay (type hints) |
| Architecture Fit | ✅ Perfect | ⚠️ Adapt needed |
| Async Patterns | ✅ Native async/await | ⚠️ asyncio complex |
| Monorepo Tools | ✅ Rich ecosystem | ⚠️ Limited |
| Existing Code | ❌ Rewrite needed | ✅ Can build on |
| Deployment | ⚠️ Node.js required | ✅ Simpler |
| Learning Curve | ⚠️ If new to TS | ✅ If know Python |

**Recommendation**: **TypeScript** because:
1. Your architecture assumes TypeScript
2. Existing Python code is minimal (easy to rewrite)
3. Better fit for complex patterns (Strategy, Facade, Pipeline)
4. Stronger ecosystem for tooling
5. Existing code has typos anyway (`selenuim`, `seleniujm`)

**Action**: Commit to TypeScript and start Phase 0

#### Decision 2: Browser Automation Need

**Question**: Does GraphQL provide all needed data?

**Action**: Spend 2-4 hours testing GraphQL before any coding

**Test Plan**:
```typescript
// Test 1: Problem content
const problem = await fetch('https://leetcode.com/graphql', {
  method: 'POST',
  body: JSON.stringify({
    query: `query problemData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        title
        content
        exampleTestcases
        hints
        solution {
          content
        }
        topicTags { name }
        companyTagStats
      }
    }`,
    variables: { titleSlug: 'two-sum' }
  })
})

// Test 2: Discussions
const discussions = await fetch('https://leetcode.com/graphql', {
  body: JSON.stringify({
    query: `query discussionPosts($questionId: String!) {
      questionTopicsList(questionId: $questionId) {
        edges {
          node {
            id
            title
            post { content }
            viewCount
            voteUpCount
          }
        }
      }
    }`,
    variables: { questionId: '1' }
  })
})

// Document: What's available vs what's missing
```

**Outcome**: Document in `docs/graphql-coverage.md`

#### Decision 3: MVP Scope

**Question**: What's the minimum useful product?

**My Recommendation**:

**MVP Features** (2 weeks):
- ✅ Scrape single problem by slug
- ✅ GraphQL client with cookie auth
- ✅ Convert HTML to Markdown
- ✅ Save with Obsidian frontmatter
- ✅ Download images locally
- ✅ Basic CLI (`lesca scrape problem <slug>`)
- ✅ Simple config file

**Not in MVP**:
- ❌ Browser automation
- ❌ Quality scoring
- ❌ Caching
- ❌ Resume capability
- ❌ List scraping
- ❌ Plugins
- ❌ Web UI

**Why**: Get something working quickly, then iterate

**Action**: Agree on MVP scope before starting

---

## Specific Recommendations

### Recommendation 1: Start Simpler

**Instead of**:
```typescript
// Complex from day 1
export class LeetCodeScraper {
  constructor(
    private readonly strategies: ScraperStrategy[],
    private readonly pipeline: ProcessingPipeline,
    private readonly config: Config,
    private readonly cache: Cache,
    private readonly checkpointer: CheckpointManager
  ) {}
}
```

**Start with**:
```typescript
// Simple MVP
export class LeetCodeScraper {
  constructor(
    private readonly graphql: GraphQLClient,
    private readonly converter: MarkdownConverter,
    private readonly storage: FileStorage
  ) {}

  async scrapeProblem(slug: string): Promise<void> {
    const problem = await this.graphql.getProblem(slug)
    const markdown = await this.converter.convert(problem)
    await this.storage.save(`${problem.id}-${slug}.md`, markdown)
  }
}
```

**Then evolve**:
- Phase 2: Add pipeline
- Phase 3: Add strategies
- Phase 5: Add cache, checkpointing

### Recommendation 2: Validate GraphQL First

**Before writing any code**:

```bash
# Create test script
cat > test-graphql.ts << 'EOF'
async function testGraphQL() {
  const queries = {
    problem: '...',      // Test problem query
    discussions: '...',  // Test discussion query
    editorial: '...',    // Test editorial query
    list: '...'         // Test problem list query
  }

  for (const [name, query] of Object.entries(queries)) {
    console.log(`Testing ${name}...`)
    const result = await fetch(/* ... */)
    console.log(`✓ ${name}: ${result.status}`)
    console.log(JSON.stringify(result.data, null, 2))
  }
}
EOF

npx tsx test-graphql.ts
```

**Document results**: Create `docs/graphql-coverage.md`

### Recommendation 3: Use Existing Tools

**HTML to Markdown**: Don't write from scratch
```bash
npm install turndown
npm install @types/turndown
```

**CLI Framework**: Use mature library
```bash
npm install commander
npm install @types/commander
```

**Config Management**: Use established tool
```bash
npm install cosmiconfig
npm install yaml
```

**Rate Limiting**: Use existing library
```bash
npm install p-throttle
# or
npm install bottleneck
```

### Recommendation 4: Test-Driven Development

**For each module**:

1. **Write types first**:
```typescript
// types.ts
export interface GraphQLClient {
  query<T>(query: string): Promise<T>
  getProblem(slug: string): Promise<Problem>
}
```

2. **Write tests second**:
```typescript
// graphql-client.test.ts
describe('GraphQLClient', () => {
  it('should fetch problem by slug', async () => {
    const client = new GraphQLClient(mockAuth)
    const problem = await client.getProblem('two-sum')
    expect(problem.title).toBe('Two Sum')
  })
})
```

3. **Implement third**:
```typescript
// graphql-client.ts
export class GraphQLClient {
  async getProblem(slug: string): Promise<Problem> {
    // Implementation
  }
}
```

### Recommendation 5: Progressive Enhancement

**Phase 1**: Hardcode everything
```typescript
const GRAPHQL_ENDPOINT = 'https://leetcode.com/graphql'
const OUTPUT_DIR = './output'
```

**Phase 2**: Add config file
```typescript
const config = await loadConfig()
const endpoint = config.api.endpoint
const outputDir = config.output.directory
```

**Phase 3**: Add environment variables
```typescript
const endpoint = process.env.LESCA_API_ENDPOINT || config.api.endpoint
```

**Phase 4**: Add CLI flags
```typescript
const endpoint = args.endpoint || process.env.LESCA_API_ENDPOINT || config.api.endpoint
```

---

## Implementation Strategy

### Approach A: Strict MVP (Recommended)

**Timeline**: 2 weeks

**Scope**:
- Single problem scraping only
- GraphQL + Cookie auth only
- Basic Markdown conversion
- Simple file storage
- Minimal CLI

**Pros**:
- Fast time to value
- Learn system requirements
- Get user feedback early
- Low risk

**Cons**:
- Limited initial functionality
- Need follow-up phases

### Approach B: Feature-Complete v1.0

**Timeline**: 4-6 weeks

**Scope**:
- Everything in your architecture
- All strategies, processors
- Browser automation
- Quality scoring
- Caching, resume
- Plugin system

**Pros**:
- Complete from day 1
- Fewer iterations

**Cons**:
- Long time before any value
- High risk of scope creep
- Harder to course-correct

**Recommendation**: **Approach A** - Get MVP working, then iterate based on actual usage

---

## Migration Plan from Python

Your existing Python code:
```python
# main.py
def setup_driver():
    options = webdriver.ChromeOptions()
    # ... Selenium setup
```

**Don't migrate it**. Instead:

1. **Extract requirements**:
   - Need cookie authentication ✓
   - Need LeetCode company-specific URL ✓
   - Output to directory ✓

2. **Implement in TypeScript**:
   - Cookie auth: Phase 1
   - Company filtering: Phase 3 (list scraping)
   - Output directory: Phase 1

3. **Archive Python code**:
```bash
mkdir archive
mv main.py archive/
mv requirements.txt archive/
mv Dockerfile archive/
# Keep .env for cookie values
```

**Why**: The Python code is incomplete and doesn't align with your architecture. Starting fresh is cleaner.

---

## Questions to Answer Before Starting

### Q1: Technology Stack
**Question**: Confirm TypeScript/Node.js?

**Options**: TypeScript (recommended) or Python

**Your Answer**: TypeScript

### Q2: MVP Scope
**Question**: MVP features?

**Options**:
- A) Just single problem scraping (2 weeks)
- B) Single problem + list scraping (3 weeks)
- C) Everything in architecture (6 weeks)

**Your Answer**: Everything in architecture

### Q3: Browser Automation
**Question**: Include browser automation?

**Options**:
- A) Yes, from day 1
- B) Only if GraphQL insufficient (recommended)
- C) No, GraphQL only

**Your Answer**: Yes, from day 1

### Q4: Deployment Target
**Question**: How will users install it?

**Options**:
- A) npm package (recommended)
- B) Standalone binary
- C) Docker container
- D) All of the above

**Your Answer**: All of the above

### Q5: Timeline
**Question**: Target completion date?

**Options**:
- A) 2 weeks (strict MVP)
- B) 4 weeks (MVP + enhancements)
- C) 6 weeks (full v1.0)
- D) Flexible

**Your Answer**: Flexible, but lets target 2 weeks

---

## Next Steps

### Immediate (Today)
1. ✅ Review architecture (done)
2. ✅ Review implementation plan (done)
3. ⏳ Answer 5 questions above
4. ⏳ Decide: TypeScript or Python?

### This Week
5. ⏳ Phase 0.1: Test GraphQL coverage (2-4 hours)
6. ⏳ Phase 0.2: Set up TypeScript project (1 hour)
7. ⏳ Phase 0.3: Create shared types (1 hour)
8. ⏳ Phase 1.1: Implement GraphQL client (4 hours)
9. ⏳ Phase 1.2: Implement cookie auth (2 hours)

### Next Week
10. ⏳ Phase 1.3-1.7: Complete MVP (remaining)
11. ⏳ Test end-to-end
12. ⏳ Document what worked/didn't
13. ⏳ Plan Phase 2

---

## Success Metrics

### MVP Success (End of 2 Weeks)
- [ ] Can scrape "Two Sum" problem
- [ ] Saves as `1-two-sum.md`
- [ ] Markdown has Obsidian frontmatter
- [ ] Images are downloaded to `./assets/`
- [ ] CLI command works: `lesca scrape problem two-sum`
- [ ] Can scrape 10 different problems successfully

### v1.0 Success (End of 6 Weeks)
- [ ] Can scrape problem lists (by tag, company, difficulty)
- [ ] Respects rate limits (no blocking)
- [ ] Can resume interrupted scrapes
- [ ] Quality filtering works
- [ ] Caching reduces redundant API calls
- [ ] Documentation is complete
- [ ] Published to npm

---

## Final Thoughts

Your architecture is **excellent** - well-thought-out with solid patterns and clear reasoning. The main challenge is bridging from architectural vision to working code.

**My advice**:
1. **Start small**: Build MVP first (2 weeks)
2. **Validate early**: Test GraphQL before committing
3. **Iterate fast**: Ship → Learn → Improve
4. **Add complexity gradually**: Don't build everything at once
5. **Stay disciplined**: Resist scope creep

The architecture will emerge naturally as you build. Some of your planned patterns might be over-engineering for the actual problem space - you'll discover that through building.

**Remember**: "Perfect is the enemy of good." Get something working, then make it better.

---

## Ready to Start?

Once you answer the 5 questions, I can help you:
1. Set up the TypeScript project structure
2. Create the initial GraphQL test script
3. Implement the first module (GraphQL client)
4. Build the MVP step by step

Let me know what you'd like to do next!
