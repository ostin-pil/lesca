# Lesca - LeetCode Scraper Architecture

A powerful, modular TypeScript-based LeetCode content scraper for creating personal knowledge bases in Obsidian and other markdown-based systems.

[![Tests](https://img.shields.io/badge/tests-631%20passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-68.43%25-yellow)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## ⚠️ Legal Notice

**Use at your own risk.** This tool violates LeetCode's Terms of Service regarding automated access. It is intended strictly for **personal, offline use** (e.g., studying while disconnected).

- **Do not redistribute** scraped content.
- **Read [LEGAL.md](./LEGAL.md)** carefully before use.
- The authors are not responsible for account bans or other consequences.

## ✨ Features

### Core Functionality

- 🚀 **Comprehensive Scraping**: Problems, editorials, discussions, and problem lists
- 🎯 **Type-Safe**: Built with strict TypeScript for maximum reliability
- 📝 **Markdown Export**: Beautiful, readable Markdown output
- 💎 **Obsidian Ready**: Full support with frontmatter and wikilinks
- ⚡ **Smart Rate Limiting**: Respectful, configurable API throttling
- 💾 **Intelligent Caching**: Speed up re-scraping with tiered cache system
- 🔧 **Highly Configurable**: YAML/JSON config with environment variable support
- 🧩 **Plugin System**: Extend functionality with custom plugins
- 🔒 **Premium Content**: Detects and handles premium-only problems gracefully
- 🛡️ **Robust Error Handling**: Automatic retries and backoff for network stability

### Developer Experience

- 🔌 **Modular Architecture**: Clean separation with swappable components
- 🧪 **Well-Tested**: 631 passing tests with 68.43% coverage
- 📦 **Monorepo Structure**: Organized, maintainable codebase
- 🎨 **Extensible**: Plugin-ready architecture
- 🔍 **Smart Filtering**: Filter by difficulty, tags, and limits
- 🌐 **Browser Automation**: Playwright-based for dynamic content
- 📊 **Progress Tracking**: Resume interrupted batch scrapes

---

## 📚 Documentation

### For Users

- **[User Guide](./docs/USER_GUIDE.md)** - Complete usage guide with examples
- **[Installation](./docs/INSTALLATION.md)** - Installation instructions
- **[CLI Reference](./docs/CLI_REFERENCE.md)** - All commands and options
- **[Configuration](./docs/CONFIGURATION.md)** - Configuration guide
- **[Examples](./docs/EXAMPLES.md)** - Common usage patterns and recipes
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

### For Developers

- **[Architecture Review](./ARCHITECTURE_REVIEW.md)** - Design decisions and patterns
- **[Coding Standards](./docs/CODING_STANDARDS.md)** - Code style and best practices
- **[Testing Guide](./docs/TESTING.md)** - Testing infrastructure and best practices
- **[Agent Guidelines](./docs/AGENT_GUIDELINES.md)** - Guidelines for AI assistants
- **[TypeScript Guide](./docs/TYPESCRIPT_GUIDE.md)** - TypeScript patterns used
- **[Contributing](./CONTRIBUTING.md)** - How to contribute

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/lesca.git
cd lesca

# Install dependencies
npm install

# Initialize configuration
npm run dev -- init
```

### Set Up Authentication

1. Run the interactive authentication command:
   ```bash
   npm run dev -- auth
   ```
2. Follow the prompts to provide your cookie file path or paste your cookies.

See [User Guide - Authentication Setup](./docs/USER_GUIDE.md#authentication-setup) for detailed instructions.

### Explore Problems

```bash
# List easy problems
npm run dev -- list --difficulty Easy

# Search for a specific problem
npm run dev -- search "two sum"
```

### Scrape Your First Problem

```bash
# Scrape a single problem
npm run dev -- scrape two-sum

# Scrape multiple problems
npm run dev -- scrape-list --difficulty Medium --limit 10

# Interactive selection
npm run dev -- list --interactive

# Scrape with Obsidian format
npm run dev -- scrape two-sum --format obsidian
```

**Output**: Files saved to `./output/` directory by default.

---

## 📖 Usage Examples

### Scrape Problem Types

```bash
# Single problem
npm run dev -- scrape two-sum

# Multiple problems with filtering
npm run dev -- scrape-list \
  --difficulty Medium \
  --tags "dynamic-programming,array" \
  --limit 50

# Editorial (requires browser)
npm run dev -- scrape-editorial two-sum

# Discussions
npm run dev -- scrape-discussions two-sum \
  --category solution \
  --sort most-votes \
  --limit 10
```

### Batch Scraping

```bash
# Scrape all Easy problems
npm run dev -- scrape-list --difficulty Easy --concurrency 3

# Resume interrupted scraping
npm run dev -- scrape-list --limit 500 --resume

# Organized by difficulty
npm run dev -- scrape-list --difficulty Hard --output ./hard-problems

# Sort by quality
npm run dev -- list --sort quality --limit 20

```

### Advanced Usage

```bash
# Custom configuration
npm run dev -- --config ./custom-config.yaml scrape-list

# Disable caching
npm run dev -- scrape two-sum --no-cache

# Visible browser mode (debugging)
npm run dev -- scrape-editorial two-sum --no-headless

# Manage configuration
npm run dev -- config list
npm run dev -- config get browser.headless
```

See [CLI Reference](./docs/CLI_REFERENCE.md) for all commands and options.

---

## 🏗️ Architecture

### Monorepo Structure

```
lesca/
├── packages/
│   ├── core/                # Facade & orchestration layer
│   ├── auth/                # Cookie-based authentication
│   ├── api-client/          # GraphQL client with rate limiting
│   ├── browser-automation/  # Playwright driver
│   ├── scrapers/            # Scraping strategies (Problem, List, Editorial, Discussion)
│   ├── converters/          # HTML to Markdown/Obsidian
│   ├── storage/             # Filesystem & SQLite adapters
│   └── cli/                 # CLI application
├── shared/
│   ├── types/               # Shared TypeScript types
│   ├── config/              # Configuration system
│   └── utils/               # Caching, logging, utilities
├── docs/                    # User & developer documentation
└── examples/                # Example configurations
```

### Design Patterns

- **Facade Pattern**: `LeetCodeScraper` orchestrates all components
- **Strategy Pattern**: Pluggable scrapers, storage, converters
- **Singleton Pattern**: Configuration manager
- **Pipeline Pattern**: Composable content processing
- **Builder Pattern**: Progressive configuration building

See [Architecture Review](./ARCHITECTURE_REVIEW.md) for detailed analysis.

---

## 🧪 Testing

```bash
# Run unit tests (fast - runs on every PR)
npm test
# or
npm run test:unit

# Run integration tests (slower - runs on release)
npm run test:integration

# Run all tests (unit + integration)
npm run test:all

# Run with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:ui

# Check coverage thresholds
npm run check-coverage

# Run performance benchmarks
npm run benchmark
```

### Test Infrastructure

- **Unit Tests**: Fast tests that run on every PR (< 30s target)
- **Integration Tests**: End-to-end tests that run on release
- **Benchmarks**: Performance tracking for critical paths
- **Factories**: Dynamic test data generation
- **Fixtures**: Static test data for consistent testing

---

## ⚙️ Configuration

Lesca uses a flexible configuration system supporting YAML/JSON files and environment variables.

### Basic Configuration

```yaml
# lesca.config.yaml
auth:
  cookiePath: ~/.lesca/cookies.json

api:
  rateLimit:
    requestsPerMinute: 30
    minDelay: 2000

storage:
  path: ./output

output:
  format: obsidian # or 'markdown'
  frontmatter: true

scraping:
  concurrency: 3
  batchSize: 10

cache:
  enabled: true
  ttl:
    problem: 604800000 # 7 days
```

See [Configuration Guide](./docs/CONFIGURATION.md) for all options.

---

## 🛠️ Development

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- scrape two-sum

# Build all packages
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
```

### Available Scripts

| Command                    | Description                            |
| -------------------------- | -------------------------------------- |
| `npm run dev`              | Development mode with TypeScript watch |
| `npm run build`            | Build all packages                     |
| `npm test`                 | Run unit tests (fast)                  |
| `npm run test:unit`        | Run unit tests only                    |
| `npm run test:integration` | Run integration tests only             |
| `npm run test:all`         | Run all tests (unit + integration)     |
| `npm run test:coverage`    | Generate coverage report               |
| `npm run check-coverage`   | Validate coverage thresholds           |
| `npm run benchmark`        | Run performance benchmarks             |
| `npm run lint`             | Lint codebase                          |
| `npm run lint:fix`         | Fix linting issues                     |
| `npm run format`           | Format code with Prettier              |
| `npm run typecheck`        | Type check without emitting            |

### Testing Guidelines

See [Coding Standards](./docs/CODING_STANDARDS.md) for testing best practices.

---

## 🗺️ Roadmap

### Current Status: **v0.1.0 - MVP Complete** ✅

- ✅ Core scraping functionality
- ✅ Configuration system
- ✅ CLI with all major commands
- ✅ Browser automation
- ✅ Caching system
- ✅ Comprehensive testing (539 tests)
- ✅ User documentation

### Upcoming Releases

#### v0.2.0 - Production Ready

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] npm package publication
- [ ] Binary releases (Windows, macOS, Linux)
- [ ] Docker image

#### v0.3.0 - Enhanced Features

- [ ] Quality scoring (Wilson score algorithm)
- [ ] SQLite storage adapter
- [ ] Enhanced filtering options
- [ ] Performance optimizations

#### v1.0.0 - Stable Release

- [ ] Plugin system
- [ ] Web UI (optional)
- [ ] Advanced analytics
- [ ] Cloud deployment options

See [Roadmap](./ROADMAP.md) for detailed plans.

---

## 📝 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- **LeetCode** for providing an excellent platform and GraphQL API
- **TypeScript** and **Node.js** communities for amazing tools
- **Playwright** for robust browser automation
- **Vitest** for fast, modern testing
- All contributors and users of this project

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting PRs.

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow [Coding Standards](./docs/CODING_STANDARDS.md)
4. Write tests for new features
5. Ensure all tests pass (`npm test`)
6. Commit changes (`git commit -m 'Add amazing feature'`)
7. Push to branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

---

## 🐛 Bug Reports

Found a bug? Please open an issue with:

- Lesca version (`npm run dev -- --version`)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs. actual behavior

See [Troubleshooting Guide](./docs/TROUBLESHOOTING.md) for common issues.

---

## 💬 Support

- **Documentation**: Start with [User Guide](./docs/USER_GUIDE.md)
