# Lesca Configuration Guide

Complete guide to configuring Lesca for your needs.

## Table of Contents

- [Overview](#overview)
- [Configuration File Format](#configuration-file-format)
- [Configuration Sections](#configuration-sections)
  - [Authentication](#authentication)
  - [API Settings](#api-settings)
  - [Storage](#storage)
  - [Output Format](#output-format)
  - [Scraping Behavior](#scraping-behavior)
  - [Processing](#processing)
  - [Browser Automation](#browser-automation)
  - [Cache](#cache)
  - [Logging](#logging)
  - [Plugins](#plugins)
- [Configuration Precedence](#configuration-precedence)
- [Environment Variables](#environment-variables)
- [Example Configurations](#example-configurations)
- [Best Practices](#best-practices)

---

## Overview

Lesca uses a hierarchical configuration system that supports multiple sources:

1. **Default values** (built-in)
2. **Configuration files** (YAML/JSON)
3. **Environment variables**
4. **CLI flags** (highest priority)

---

## Configuration File Format

Lesca supports both YAML and JSON formats.

### YAML Format (Recommended)

```yaml
auth:
  method: cookie
  cookiePath: ~/.lesca/cookies.json

api:
  endpoint: https://leetcode.com/graphql
  timeout: 30000

storage:
  type: filesystem
  path: ./output

output:
  format: markdown
  frontmatter: true
```

### JSON Format

```json
{
  "auth": {
    "method": "cookie",
    "cookiePath": "~/.lesca/cookies.json"
  },
  "api": {
    "endpoint": "https://leetcode.com/graphql",
    "timeout": 30000
  },
  "storage": {
    "type": "filesystem",
    "path": "./output"
  },
  "output": {
    "format": "markdown",
    "frontmatter": true
  }
}
```

### File Locations

Lesca searches for configuration in this order:

1. `./lesca.config.yaml`
2. `./lesca.config.yml`
3. `./lesca.config.json`
4. `./.lesca.yaml`
5. `./.lesca.yml`
6. `./.lesca.json`
7. `~/.lesca/config.yaml`
8. `~/.config/lesca/config.yaml`

**Custom location**:
```bash
npm run dev -- --config /path/to/config.yaml scrape two-sum
```

---

## Configuration Sections

### Authentication

Controls how Lesca authenticates with LeetCode.

```yaml
auth:
  method: cookie              # Authentication method
  cookiePath: ~/.lesca/cookies.json  # Path to cookie file
  sessionTimeout: 3600        # Session timeout in seconds
  autoRefresh: true           # Auto-refresh session
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `method` | string | `cookie` | Authentication method (`cookie` or `none`) |
| `cookiePath` | string | `~/.lesca/cookies.json` | Path to cookie file |
| `sessionTimeout` | number | `3600` | Session timeout in seconds |
| `autoRefresh` | boolean | `true` | Automatically refresh session |

#### Examples

**Use custom cookie file**:
```yaml
auth:
  method: cookie
  cookiePath: /path/to/my-cookies.json
```

**Disable authentication** (public problems only):
```yaml
auth:
  method: none
```

---

### API Settings

Configure LeetCode API connection and rate limiting.

```yaml
api:
  endpoint: https://leetcode.com/graphql
  timeout: 30000              # Request timeout (ms)
  retries: 3                  # Number of retry attempts
  retryDelay: 1000            # Delay between retries (ms)
  rateLimit:
    enabled: true
    requestsPerMinute: 30     # Max requests per minute
    minDelay: 2000            # Min delay between requests (ms)
    maxDelay: 10000           # Max delay with jitter (ms)
    jitter: true              # Add random jitter to delays
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | string | `https://leetcode.com/graphql` | GraphQL API endpoint |
| `timeout` | number | `30000` | Request timeout in milliseconds |
| `retries` | number | `3` | Number of retry attempts (0-10) |
| `retryDelay` | number | `1000` | Delay between retries in milliseconds |
| `rateLimit.enabled` | boolean | `true` | Enable rate limiting |
| `rateLimit.requestsPerMinute` | number | `30` | Max requests per minute |
| `rateLimit.minDelay` | number | `2000` | Minimum delay between requests (ms) |
| `rateLimit.maxDelay` | number | `10000` | Maximum delay with jitter (ms) |
| `rateLimit.jitter` | boolean | `true` | Add random jitter to delays |

#### Examples

**Conservative rate limiting**:
```yaml
api:
  rateLimit:
    enabled: true
    requestsPerMinute: 20
    minDelay: 3000
    maxDelay: 5000
```

**Aggressive scraping** (higher risk of rate limiting):
```yaml
api:
  rateLimit:
    enabled: true
    requestsPerMinute: 60
    minDelay: 1000
    maxDelay: 2000
```

**Disable rate limiting** (not recommended):
```yaml
api:
  rateLimit:
    enabled: false
```

---

### Storage

Configure where and how scraped content is stored.

```yaml
storage:
  type: filesystem            # Storage type
  path: ./output              # Output directory
  database: ./lesca.db        # Database path (for SQLite)
  options: {}                 # Type-specific options
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | `filesystem` | Storage type (`filesystem` or `sqlite`) |
| `path` | string | `./output` | Output directory path |
| `database` | string | Optional | SQLite database path |
| `options` | object | `{}` | Storage-specific options |

#### Examples

**Custom output directory**:
```yaml
storage:
  type: filesystem
  path: ~/Documents/LeetCode
```

**SQLite storage** (when implemented):
```yaml
storage:
  type: sqlite
  database: ~/.lesca/problems.db
  options:
    autoVacuum: true
```

---

### Output Format

Control how scraped content is formatted and saved.

```yaml
output:
  format: markdown            # Output format
  pattern: "{slug}.md"        # Filename pattern
  frontmatter: true           # Include YAML frontmatter
  images:
    download: false           # Download images
    directory: images         # Image directory
    pattern: "{slug}-{index}.{ext}"  # Image filename pattern
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | string | `markdown` | Output format (`markdown`, `obsidian`, `json`) |
| `pattern` | string | `{slug}.md` | Filename pattern |
| `frontmatter` | boolean | `true` | Include YAML frontmatter in output |
| `images.download` | boolean | `false` | Download images locally |
| `images.directory` | string | `images` | Directory for downloaded images |
| `images.pattern` | string | `{slug}-{index}.{ext}` | Image filename pattern |

#### Filename Pattern Variables

Available variables for `pattern`:
- `{slug}` - Problem slug (e.g., `two-sum`)
- `{id}` - Problem ID (e.g., `1`)
- `{title}` - Problem title (e.g., `Two Sum`)
- `{difficulty}` - Problem difficulty (e.g., `Easy`)

#### Examples

**Obsidian format with frontmatter**:
```yaml
output:
  format: obsidian
  pattern: "{id}-{slug}.md"
  frontmatter: true
```

**Include problem ID in filename**:
```yaml
output:
  pattern: "{id}. {title}.md"
  # Example: "1. Two Sum.md"
```

**Download images**:
```yaml
output:
  images:
    download: true
    directory: assets/images
    pattern: "{slug}-{index}.{ext}"
```

**JSON output**:
```yaml
output:
  format: json
  pattern: "{slug}.json"
```

---

### Scraping Behavior

Control how scraping operations behave.

```yaml
scraping:
  strategies:
    - problem
    - list
  concurrency: 3              # Parallel scrapes
  batchSize: 10               # Problems per batch
  delay: 1000                 # Delay between batches (ms)
  timeout: 60000              # Scraping timeout (ms)
  discussion:
    defaultLimit: 10          # Default discussion limit
    defaultSort: hot          # Default sort order
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strategies` | array | `['problem']` | Enabled scraping strategies |
| `concurrency` | number | `3` | Number of concurrent scrapes (1-10) |
| `batchSize` | number | `10` | Problems per batch (1-100) |
| `delay` | number | `1000` | Delay between batches in milliseconds |
| `timeout` | number | `60000` | Scraping timeout in milliseconds |
| `discussion.defaultLimit` | number | `10` | Default number of discussions to scrape |
| `discussion.defaultSort` | string | `hot` | Default sort order (`hot`, `most-votes`, `recent`) |

#### Strategies

Available scraping strategies:
- `problem` - Scrape problem descriptions
- `list` - Scrape problem lists
- `editorial` - Scrape editorials (requires browser)
- `discussion` - Scrape discussions (requires browser)

#### Examples

**Fast scraping**:
```yaml
scraping:
  concurrency: 5
  delay: 500
```

**Conservative scraping**:
```yaml
scraping:
  concurrency: 2
  delay: 2000
```

**Discussion defaults**:
```yaml
scraping:
  discussion:
    defaultLimit: 20
    defaultSort: most-votes
```

---

### Processing

Configure content processing and conversion.

```yaml
processing:
  converters:
    - html-to-markdown
  pipeline: []                # Optional processing pipeline
  options: {}                 # Converter-specific options
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `converters` | array | `['html-to-markdown']` | List of converters to use |
| `pipeline` | array | `[]` | Custom processing pipeline |
| `options` | object | `{}` | Converter-specific options |

#### Examples

**Custom converter options**:
```yaml
processing:
  converters:
    - html-to-markdown
  options:
    codeBlockStyle: fenced
    bulletListMarker: '-'
```

---

### Browser Automation

Configure browser behavior for scraping editorials and discussions.

```yaml
browser:
  enabled: true
  headless: true              # Run browser in background
  executable: /path/to/chrome # Custom browser path
  timeout: 30000              # Page load timeout (ms)
  viewport:
    width: 1920
    height: 1080
  blockedResources:           # Block resources to speed up scraping
    - image
    - font
    - media
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable browser automation |
| `headless` | boolean | `true` | Run browser in headless mode |
| `executable` | string | Optional | Path to custom browser executable |
| `timeout` | number | `30000` | Page load timeout in milliseconds |
| `viewport.width` | number | `1920` | Browser viewport width |
| `viewport.height` | number | `1080` | Browser viewport height |
| `blockedResources` | array | `['image', 'font', 'media']` | Resource types to block |

#### Examples

**Visible browser for debugging**:
```yaml
browser:
  headless: false
```

**Custom browser**:
```yaml
browser:
  executable: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

**Larger viewport**:
```yaml
browser:
  viewport:
    width: 2560
    height: 1440
```

**Don't block any resources**:
```yaml
browser:
  blockedResources: []
```

---

### Cache

Configure caching to improve performance.

```yaml
cache:
  enabled: true
  directory: ~/.lesca/cache
  memorySize: 50              # Items in memory cache
  ttl:
    problem: 604800000        # 7 days
    list: 86400000            # 1 day
    editorial: 604800000      # 7 days
    discussion: 3600000       # 1 hour
    metadata: 3600000         # 1 hour
  maxSize: 524288000          # 500 MB
  compression: true
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable caching |
| `directory` | string | `~/.lesca/cache` | Cache directory path |
| `memorySize` | number | `50` | Number of items in memory cache (1-1000) |
| `ttl.problem` | number | `604800000` | Problem cache TTL (7 days) |
| `ttl.list` | number | `86400000` | List cache TTL (1 day) |
| `ttl.editorial` | number | `604800000` | Editorial cache TTL (7 days) |
| `ttl.discussion` | number | `3600000` | Discussion cache TTL (1 hour) |
| `ttl.metadata` | number | `3600000` | Metadata cache TTL (1 hour) |
| `maxSize` | number | `524288000` | Max cache size in bytes (500 MB) |
| `compression` | boolean | `true` | Compress cached data |

#### TTL Values

Common TTL values in milliseconds:
- 1 hour: `3600000`
- 1 day: `86400000`
- 1 week: `604800000`
- 1 month: `2592000000`
- No expiration: `-1`

#### Examples

**Aggressive caching**:
```yaml
cache:
  enabled: true
  memorySize: 100
  ttl:
    problem: 2592000000    # 30 days
    list: 604800000        # 7 days
    editorial: 2592000000  # 30 days
  maxSize: 1073741824      # 1 GB
```

**Minimal caching**:
```yaml
cache:
  enabled: true
  memorySize: 20
  ttl:
    problem: 3600000       # 1 hour
    list: 3600000          # 1 hour
  maxSize: 104857600       # 100 MB
```

**Disable caching**:
```yaml
cache:
  enabled: false
```

---

### Logging

Configure logging output.

```yaml
logging:
  level: info                 # Log level
  output: console             # Output destination
  file: ~/.lesca/lesca.log   # Log file path
  format: text                # Log format
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | string | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `output` | string | `console` | Output destination (`console`, `file`, `both`) |
| `file` | string | Optional | Log file path |
| `format` | string | `text` | Log format (`text` or `json`) |

#### Log Levels

- `debug` - Detailed debugging information
- `info` - General informational messages
- `warn` - Warning messages
- `error` - Error messages only

#### Examples

**Debug mode**:
```yaml
logging:
  level: debug
  output: both
  file: ~/.lesca/debug.log
```

**Error-only logging**:
```yaml
logging:
  level: error
  output: console
```

**JSON logging**:
```yaml
logging:
  level: info
  output: file
  file: ~/.lesca/lesca.json
  format: json
```

---

### Plugins

Configure plugin system (experimental).

```yaml
plugins:
  enabled: false
  directory: ./plugins
  autoLoad: true
  plugins: []
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable plugin system |
| `directory` | string | `./plugins` | Plugin directory |
| `autoLoad` | boolean | `true` | Auto-load plugins on startup |
| `plugins` | array | `[]` | List of plugins to load |

#### Examples

**Enable plugins**:
```yaml
plugins:
  enabled: true
  directory: ~/.lesca/plugins
  autoLoad: true
  plugins:
    - name: custom-converter
      enabled: true
      options:
        format: custom
```

---

## Configuration Precedence

Settings are merged in this order (later overrides earlier):

1. **Default values** (lowest priority)
2. **Configuration file** (YAML/JSON)
3. **Environment variables**
4. **CLI flags** (highest priority)

### Example

**Config file** (`lesca.config.yaml`):
```yaml
output:
  format: markdown
```

**Environment variable**:
```bash
export LESCA_OUTPUT_FORMAT=obsidian
```

**CLI flag**:
```bash
npm run dev -- scrape two-sum --format json
```

**Result**: `format: json` (CLI flag wins)

---

## Environment Variables

All configuration options can be overridden with environment variables.

### Naming Convention

- Prefix: `LESCA_`
- Uppercase with underscores
- Nested paths separated by underscores

**Examples**:
- `auth.method` → `LESCA_AUTH_METHOD`
- `api.rateLimit.enabled` → `LESCA_RATE_LIMIT`
- `cache.directory` → `LESCA_CACHE_DIR`

### Complete List

See [CLI Reference - Environment Variables](./CLI_REFERENCE.md#environment-variables) for the complete list.

### Usage Example

```bash
# Set multiple variables
export LESCA_OUTPUT_FORMAT=obsidian
export LESCA_CONCURRENCY=5
export LESCA_CACHE_ENABLED=true
export LESCA_OUTPUT_PATH=~/Documents/LeetCode

# Run command with overrides
npm run dev -- scrape-list
```

---

## Example Configurations

### Minimal Configuration

```yaml
storage:
  path: ./output

output:
  format: markdown
```

### Obsidian Vault Configuration

```yaml
auth:
  cookiePath: ~/.lesca/cookies.json

storage:
  path: ./LeetCode-Vault

output:
  format: obsidian
  pattern: "{id} - {title}.md"
  frontmatter: true

cache:
  enabled: true
  ttl:
    problem: 2592000000  # 30 days

logging:
  level: info
```

### High-Performance Configuration

```yaml
api:
  rateLimit:
    enabled: true
    requestsPerMinute: 60
    minDelay: 1000
    maxDelay: 2000

scraping:
  concurrency: 5
  delay: 500

cache:
  enabled: true
  memorySize: 100
  maxSize: 1073741824  # 1 GB

browser:
  headless: true
  blockedResources:
    - image
    - font
    - media
    - stylesheet
```

### Conservative Configuration

```yaml
api:
  rateLimit:
    enabled: true
    requestsPerMinute: 20
    minDelay: 3000
    maxDelay: 5000

scraping:
  concurrency: 2
  delay: 2000

cache:
  enabled: true
  memorySize: 30
```

### Development Configuration

```yaml
logging:
  level: debug
  output: both
  file: ./lesca-debug.log
  format: json

browser:
  headless: false

cache:
  enabled: false

scraping:
  concurrency: 1
```

---

## Best Practices

### 1. Use Configuration Files

Don't rely on CLI flags for repeated tasks:

```bash
# Bad: Repeat flags every time
npm run dev -- scrape-list --format obsidian --output ./vault --concurrency 5

# Good: Set in config, run simply
npm run dev -- scrape-list
```

### 2. Version Control Your Config

```bash
git add lesca.config.yaml
git commit -m "Update Lesca configuration"
```

But exclude sensitive data:
```bash
# .gitignore
.lesca/cookies.json
*.cookies.json
```

### 3. Use Environment Variables for CI/CD

```bash
# .github/workflows/scrape.yml
env:
  LESCA_OUTPUT_PATH: ./output
  LESCA_CACHE_ENABLED: false
  LESCA_LOG_LEVEL: debug
```

### 4. Separate Configs for Different Use Cases

```bash
# Obsidian vault
npm run dev -- --config ./configs/obsidian.yaml scrape-list

# GitHub repository
npm run dev -- --config ./configs/github.yaml scrape-list

# JSON export
npm run dev -- --config ./configs/json.yaml scrape-list
```

### 5. Document Your Configuration

Add comments to YAML files:

```yaml
# Production configuration for LeetCode vault
# Last updated: 2024-01-15

output:
  format: obsidian  # Obsidian-compatible markdown
  pattern: "{id} - {title}.md"  # Include ID for sorting

scraping:
  concurrency: 3  # Balance speed vs. rate limiting
```

### 6. Test Configuration Changes

```bash
# Test with a small scrape
npm run dev -- scrape two-sum

# If successful, proceed with larger scrape
npm run dev -- scrape-list --limit 10
```

### 7. Use Sensible Defaults

Start with defaults, then customize:

```bash
# Initialize with defaults
npm run dev -- init

# Customize only what you need
# Edit lesca.config.yaml
```

---

## Troubleshooting Configuration

### Config Not Loading

**Check file location**:
```bash
# List all possible locations
ls -la lesca.config.{yaml,yml,json}
ls -la .lesca.{yaml,yml,json}
ls -la ~/.lesca/config.yaml
```

**Use explicit path**:
```bash
npm run dev -- --config ./lesca.config.yaml scrape two-sum
```

### Invalid Configuration

**Validate YAML syntax**:
```bash
# Install yq
brew install yq  # macOS
apt-get install yq  # Linux

# Validate
yq eval . lesca.config.yaml
```

**Check for common errors**:
- Incorrect indentation (use spaces, not tabs)
- Missing colons after keys
- Incorrect data types (string vs. number)

### Environment Variables Not Working

**Check variable names**:
```bash
# List all Lesca environment variables
env | grep LESCA_
```

**Verify export**:
```bash
# Export in current shell
export LESCA_OUTPUT_FORMAT=obsidian
echo $LESCA_OUTPUT_FORMAT  # Should print: obsidian
```

---

## See Also

- [User Guide](./USER_GUIDE.md) - Comprehensive usage guide
- [CLI Reference](./CLI_REFERENCE.md) - All CLI commands and options
- [Examples](../examples/) - Sample configurations
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues
