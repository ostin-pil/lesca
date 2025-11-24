# Configuration Guide

Lesca supports flexible configuration through multiple sources with a clear precedence order:

1. **CLI flags** (highest priority)
2. **Environment variables**
3. **Config file** (`lesca.config.yaml` or `.lesca.json`)
4. **Default values** (lowest priority)

## Quick Start

```bash
# Create a default configuration file
lesca config init

# Show current configuration
lesca config show

# Get a specific value
lesca config get browser.headless

# Set a value
lesca config set browser.headless false
```

## Configuration File

Lesca looks for configuration files in the following locations (first found wins):

- `./lesca.config.yaml`
- `./lesca.config.yml`
- `./lesca.config.json`
- `./.lesca.yaml`
- `./.lesca.yml`
- `./.lesca.json`
- `~/.lesca/config.yaml`
- `~/.config/lesca/config.yaml`

### Example Configuration

```yaml
auth:
  method: cookie
  cookiePath: ~/.lesca/cookies.json
  sessionTimeout: 3600
  autoRefresh: true

api:
  endpoint: https://leetcode.com/graphql
  timeout: 30000
  retries: 3
  rateLimit:
    enabled: true
    requestsPerMinute: 30
    minDelay: 2000
    maxDelay: 10000
    jitter: true

storage:
  type: filesystem
  path: ./output

output:
  format: markdown # or "obsidian"
  pattern: '{slug}.md'
  frontmatter: true
  images:
    download: false
    directory: images

scraping:
  strategies:
    - problem
  concurrency: 3
  batchSize: 10
  delay: 1000
  timeout: 60000

browser:
  enabled: true
  headless: true
  timeout: 30000
  viewport:
    width: 1920
    height: 1080
  blockedResources:
    - image
    - font
    - media
  pool:
    enabled: true
    minSize: 0
    maxSize: 3
    maxIdleTime: 300000

cache:
  enabled: true
  directory: ~/.lesca/cache
  memorySize: 50
  ttl:
    problem: 604800000 # 7 days
    list: 86400000 # 1 day
    editorial: 604800000
    discussion: 3600000 # 1 hour
  maxSize: 524288000 # 500MB
  compression: true

logging:
  level: info # debug | info | warn | error
  output: console
  format: text
```

## Environment Variables

All configuration options can be set via environment variables using the `LESCA_` prefix:

| Variable                 | Config Path            | Example                        |
| ------------------------ | ---------------------- | ------------------------------ |
| `LESCA_AUTH_METHOD`      | `auth.method`          | `cookie`                       |
| `LESCA_COOKIE_PATH`      | `auth.cookiePath`      | `~/.lesca/cookies.json`        |
| `LESCA_API_ENDPOINT`     | `api.endpoint`         | `https://leetcode.com/graphql` |
| `LESCA_OUTPUT_PATH`      | `storage.path`         | `./output`                     |
| `LESCA_OUTPUT_FORMAT`    | `output.format`        | `markdown` or `obsidian`       |
| `LESCA_CONCURRENCY`      | `scraping.concurrency` | `5`                            |
| `LESCA_BATCH_SIZE`       | `scraping.batchSize`   | `20`                           |
| `LESCA_BROWSER_HEADLESS` | `browser.headless`     | `true` or `false`              |
| `LESCA_CACHE_ENABLED`    | `cache.enabled`        | `true` or `false`              |
| `LESCA_LOG_LEVEL`        | `logging.level`        | `debug`                        |

Example:

```bash
LESCA_OUTPUT_FORMAT=obsidian LESCA_CONCURRENCY=5 lesca scrape-list
```

## CLI Flags

Most commands accept CLI flags that override configuration:

### Global Flags

```bash
--config <path>    # Specify config file path
--debug            # Enable debug logging
```

### Scrape Command

```bash
lesca scrape <problem> [options]

Options:
  -o, --output <dir>       # Output directory
  -f, --format <format>    # Output format (markdown|obsidian)
  -c, --cookies <file>     # Cookie file path
  --cache-dir <dir>        # Cache directory
  --no-cache               # Disable caching
  --no-auth                # Skip authentication
```

### Scrape-List Command

```bash
lesca scrape-list [options]

Options:
  -o, --output <dir>         # Output directory
  -f, --format <format>      # Output format
  -c, --cookies <file>       # Cookie file
  -d, --difficulty <level>   # Filter by difficulty
  -t, --tags <tags>          # Filter by tags (comma-separated)
  -l, --limit <number>       # Limit number of problems
  --concurrency <number>     # Parallel scrapes
  --resume                   # Resume from previous progress
  --no-auth                  # Skip authentication
```

## Configuration Options Reference

### auth

Authentication settings for LeetCode.

- `method`: Authentication method (`cookie` | `browser` | `session`)
- `cookiePath`: Path to cookies.json file
- `sessionTimeout`: Session timeout in seconds
- `autoRefresh`: Auto-refresh expired sessions
- `autoSave`: Auto-save cookies after login
- `validateOnLoad`: Validate cookies on load

### api

GraphQL API client settings.

- `endpoint`: GraphQL API endpoint URL
- `timeout`: Request timeout in milliseconds
- `retries`: Number of retry attempts
- `retryDelay`: Delay between retries
- `rateLimit.enabled`: Enable rate limiting
- `rateLimit.requestsPerMinute`: Max requests per minute
- `rateLimit.minDelay`: Minimum delay between requests (ms)
- `rateLimit.maxDelay`: Maximum delay between requests (ms)
- `rateLimit.jitter`: Add random jitter to delays

### storage

Output storage configuration.

- `type`: Storage type (`filesystem` | `sqlite`)
- `path`: Output directory path
- `options`: Storage-specific options

### output

Output formatting options.

- `format`: Output format (`markdown` | `obsidian`)
- `pattern`: Filename pattern (supports `{slug}`, `{id}`, `{title}`)
- `frontmatter`: Include YAML frontmatter
- `images.download`: Download and embed images
- `images.directory`: Image storage directory
- `images.pattern`: Image filename pattern

### scraping

Scraping behavior settings.

- `strategies`: Enabled scraper strategies
- `concurrency`: Number of parallel scrapes
- `batchSize`: Default batch size for list scraping
- `delay`: Delay between batches (ms)
- `timeout`: Scraping timeout (ms)

### browser

Browser automation settings.

- `enabled`: Enable browser automation
- `headless`: Run browser in headless mode
- `timeout`: Browser operation timeout (ms)
- `viewport.width`: Browser viewport width
- `viewport.height`: Browser viewport height
- `blockedResources`: Resources to block (e.g., `image`, `font`)
- `pool.enabled`: Enable browser pooling
- `pool.minSize`: Minimum pool size
- `pool.maxSize`: Maximum pool size
- `pool.maxIdleTime`: Max idle time before closing (ms)

### cache

Caching configuration.

- `enabled`: Enable caching
- `directory`: Cache directory path
- `memorySize`: In-memory cache size (number of items)
- `ttl.problem`: TTL for problem cache (ms)
- `ttl.list`: TTL for list cache (ms)
- `ttl.editorial`: TTL for editorial cache (ms)
- `ttl.discussion`: TTL for discussion cache (ms)
- `maxSize`: Maximum cache size in bytes
- `compression`: Enable cache compression

### logging

Logging configuration.

- `level`: Log level (`debug` | `info` | `warn` | `error`)
- `output`: Output target (`console` | `file`)
- `format`: Log format (`text` | `json`)

## Examples

### Minimal Configuration

```yaml
storage:
  path: ./problems

output:
  format: markdown
```

### Power User Configuration

```yaml
auth:
  method: cookie
  cookiePath: ~/.lesca/cookies.json

scraping:
  concurrency: 5
  batchSize: 50

browser:
  headless: false # Show browser for debugging
  pool:
    maxSize: 5

cache:
  enabled: true
  ttl:
    problem: 2592000000 # 30 days

logging:
  level: debug
```

### CI/CD Environment

```bash
# Use environment variables
export LESCA_AUTH_METHOD=none
export LESCA_CACHE_ENABLED=false
export LESCA_OUTPUT_PATH=/output
export LESCA_BROWSER_HEADLESS=true

lesca scrape-list --no-auth --limit 10
```

## Troubleshooting

### Configuration Not Loading

1. Check file location with `lesca config path`
2. Verify YAML/JSON syntax
3. Use `--config` flag to specify path explicitly

### CLI Flags Not Working

CLI flags should always override config. If not working:

1. Check flag spelling and format
2. Verify the flag is supported for that command
3. Use `lesca <command> --help` to see available flags

### Environment Variables Ignored

1. Ensure correct `LESCA_` prefix
2. Check variable name matches mapping table above
3. Environment variables are loaded before config file
