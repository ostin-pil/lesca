# Lesca Configuration Examples

This directory contains example configurations for common use cases.

## Available Examples

### Basic Configurations

- **[minimal.yaml](./minimal.yaml)** - Minimal configuration to get started
- **[obsidian.yaml](./obsidian.yaml)** - Optimized for Obsidian vaults
- **[markdown.yaml](./markdown.yaml)** - Standard Markdown output

### Advanced Configurations

- **[high-performance.yaml](./high-performance.yaml)** - Fast scraping with higher concurrency
- **[conservative.yaml](./conservative.yaml)** - Safe scraping with low rate limits
- **[development.yaml](./development.yaml)** - Debug mode for development

### Specialized Configurations

- **[batch-scraping.yaml](./batch-scraping.yaml)** - Optimized for large batch operations
- **[no-cache.yaml](./no-cache.yaml)** - Disable caching for always-fresh data

## Usage

Copy an example configuration:

```bash
# Copy to project root
cp examples/obsidian.yaml lesca.config.yaml

# Or use directly with --config flag
npm run dev -- --config examples/obsidian.yaml scrape two-sum
```

## Customization

These examples are starting points. Modify them for your specific needs:

1. Copy an example that matches your use case
2. Edit paths, formats, and limits
3. Test with a small scrape
4. Save as `lesca.config.yaml` in your project

## Documentation

See [Configuration Guide](../docs/CONFIGURATION.md) for detailed explanations of all options.
