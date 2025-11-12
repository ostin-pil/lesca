# Lesca - LeetCode Scraper Architecture

A powerful, modular TypeScript-based LeetCode content scraper designed for creating personal knowledge bases in Obsidian and other markdown-based systems.

## Features

- 🚀 **GraphQL-First**: Leverages LeetCode's official GraphQL API for reliable data fetching
- 🎯 **Type-Safe**: Built with TypeScript for maximum reliability
- 🔌 **Modular Architecture**: Clean separation of concerns with swappable components
- 📝 **Markdown Export**: Convert problems to beautifully formatted Markdown
- 💎 **Obsidian Compatible**: Generate notes with proper frontmatter and wikilinks
- 🎨 **Extensible**: Plugin system for custom processors and exporters
- ⚡ **Rate Limiting**: Built-in respectful rate limiting
- 💾 **Multiple Storage**: Filesystem or SQLite storage adapters
- 🔍 **Smart Filtering**: Filter by difficulty, tags, companies
- 📦 **Multiple Deployment**: npm package, standalone binary, or Docker

## Quick Start

```bash
# Install dependencies
npm install

# Run development CLI
npm run dev -- scrape problem two-sum

# Build for production
npm run build

# Run tests
npm test
```

## Architecture

### Monorepo Structure

```
lesca/
├── packages/
│   ├── core/                # Facade & orchestration
│   ├── auth/                # Authentication strategies
│   ├── api-client/          # GraphQL client
│   ├── browser-automation/  # Playwright integration
│   ├── scrapers/            # Scraping strategies
│   ├── converters/          # Content transformers
│   ├── storage/             # Storage adapters
│   └── cli/                 # CLI application
├── shared/
│   ├── types/               # Shared TypeScript types
│   ├── config/              # Configuration system
│   └── utils/               # Common utilities
└── plugins/                 # Extensibility plugins
```

### Design Patterns

- **Facade Pattern**: Core orchestration layer with zero business logic
- **Strategy Pattern**: Swappable scraping and authentication strategies
- **Pipeline Pattern**: Composable data processing
- **Plugin Architecture**: Extend functionality without modifying core

## Development

### Available Scripts

```bash
npm run dev          # Development mode with watch
npm run build        # Build all packages
npm run test         # Run tests
npm run test:ui      # Run tests with UI
npm run lint         # Lint code
npm run format       # Format code
npm run typecheck    # Type checking
```

### Testing GraphQL Coverage

```bash
npm run test:graphql
```

This will test LeetCode's GraphQL API and generate coverage reports.

## Documentation

- [Architecture Overview](./ARCHITECTURE.md) - Detailed architectural decisions
- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Development roadmap
- [Architecture Review](./ARCHITECTURE_REVIEW.md) - Critical analysis and recommendations
- [GraphQL Coverage](./docs/graphql-coverage.md) - API coverage analysis

## Current Status

🚧 **Under Active Development** 🚧

- [x] Phase 0: Project setup and GraphQL validation
- [ ] Phase 1: Core scraping functionality
- [ ] Phase 2: Processing pipeline
- [ ] Phase 3: CLI and configuration
- [ ] Phase 4: Browser automation
- [ ] Phase 5: Quality features
- [ ] Phase 6: Plugin system
- [ ] Phase 7: Testing and documentation

## Contributing

This is currently a personal project. Contribution guidelines will be added once the core is stable.

## License

MIT

## Acknowledgments

- LeetCode for providing an excellent platform and API
- The TypeScript and Node.js communities for amazing tools
