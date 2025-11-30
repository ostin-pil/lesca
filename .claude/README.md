# Claude Code Configuration for Lesca

This directory contains Claude Code configuration for the Lesca project.

## Directory Structure

```
.claude/
├── settings.local.json    # Permission allowlist
├── commands/              # Custom slash commands
├── agents/                # Specialized sub-agents
└── skills/                # Reusable capabilities
```

## Sub-Agents

Access via `/agents` command or automatically invoked by Claude.

### Core Development Agents

| Agent                | Description                                                   | Model  |
| -------------------- | ------------------------------------------------------------- | ------ |
| `test-generator`     | Generates comprehensive unit tests following project patterns | sonnet |
| `code-reviewer`      | Reviews code for Lesca standards compliance                   | sonnet |
| `strategy-builder`   | Creates new scraper strategies using Strategy pattern         | sonnet |
| `type-fixer`         | Fixes TypeScript strict mode violations                       | sonnet |
| `security-reviewer`  | Audits code for security vulnerabilities                      | sonnet |
| `commit-preparer`    | Validates code and creates well-formatted git commits         | haiku  |
| `codemod-specialist` | Code transformations using codemods and AST tools             | sonnet |

### Domain Expert Agents

| Agent                   | Description                                                         | Model  |
| ----------------------- | ------------------------------------------------------------------- | ------ |
| `cli-developer`         | CLI development with Commander.js, terminal UX, progress indicators | sonnet |
| `graphql-specialist`    | GraphQL queries, rate limiting, LeetCode API specifics              | sonnet |
| `playwright-expert`     | Browser automation, selectors, session management, pooling          | sonnet |
| `markdown-specialist`   | HTML→Markdown, Obsidian format, frontmatter, content enhancement    | sonnet |
| `performance-optimizer` | Caching, async patterns, batch processing, benchmarking             | sonnet |
| `architect`             | System design, pattern decisions, package organization              | opus   |

### Usage

```
/agents                    # List available agents
/agents test-generator     # Use specific agent
```

## Skills

Skills are automatically invoked by Claude and agents based on context.

| Skill               | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `lesca-standards`   | Enforces Lesca coding standards (no-any, logger, imports)  |
| `strategy-patterns` | Knowledge of Facade, Strategy, Singleton, Adapter patterns |

## Slash Commands

| Command                | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `/validate`            | Run all pre-commit checks (typecheck, lint, test) |
| `/test [path]`         | Run tests (optionally for specific file/package)  |
| `/coverage`            | Run tests with coverage and check thresholds      |
| `/build`               | Clean and build the project                       |
| `/lint-fix [path]`     | Run ESLint with auto-fix                          |
| `/check-types`         | Run TypeScript type checking                      |
| `/dev <command>`       | Run CLI in development mode                       |
| `/explore <topic>`     | Research how a feature is implemented             |
| `/add-feature <desc>`  | Plan a new feature implementation                 |
| `/review-code <path>`  | Review code for standards compliance              |
| `/new-strategy <name>` | Scaffold a new scraper strategy                   |
| `/new-test <path>`     | Scaffold a test file for a source file            |

## Project Rules

The main project rules are in `/CLAUDE.md` at the repository root. Key points:

1. **No `any` type** - Use `unknown` with type guards
2. **No `console.*`** - Use `logger` from `@/shared/utils`
3. **No non-null assertions** - Check for null explicitly
4. **No file extensions in imports** - Use `@/shared/...` aliases

## Documentation

- [CLAUDE.md](../CLAUDE.md) - Project rules (auto-loaded)
- [Agent Guidelines](../docs/AGENT_GUIDELINES.md) - Detailed coding rules
- [LLM Knowledge Base](../docs/LLM_AGENT_KNOWLEDGE.md) - Comprehensive reference
- [Coding Standards](../docs/CODING_STANDARDS.md) - Style guide

## MCP Servers (Recommended)

For enhanced Claude Code capabilities, consider adding:

```bash
# Git integration
claude mcp add @modelcontextprotocol/server-git

# Memory/context persistence
claude mcp add @modelcontextprotocol/server-memory

# Sequential thinking for complex tasks
claude mcp add @modelcontextprotocol/server-sequential-thinking
```

See `.roo/mcp.json` for the MCP configuration used with Roo/Cline.

## Comparison with Roo/Cline Modes

This Claude Code configuration provides similar capabilities to the Roo modes in `.roomodes`:

| Roo Mode             | Claude Code Equivalent                 |
| -------------------- | -------------------------------------- |
| Security Reviewer    | `security-reviewer` agent              |
| Project Research     | `/explore` command + Explore sub-agent |
| User Story Creator   | `/add-feature` command                 |
| Documentation Writer | Built-in Claude capabilities           |
| DevOps               | `/build`, `/validate` commands         |
