# Lesca CLI Reference

Complete reference for all Lesca command-line interface commands and options.

## Table of Contents

- [Global Options](#global-options)
- [Commands](#commands)
  - [init](#init)
  - [scrape](#scrape)
  - [scrape-list](#scrape-list)
  - [scrape-editorial](#scrape-editorial)
  - [scrape-discussions](#scrape-discussions)
- [Common Patterns](#common-patterns)
- [Exit Codes](#exit-codes)
- [Environment Variables](#environment-variables)

---

## Global Options

These options can be used with any command:

### `--config <path>`

Specify a custom configuration file path.

```bash
npm run dev -- --config ./my-config.yaml scrape two-sum
```

**Default**: Searches standard locations (see [Configuration Guide](./CONFIGURATION.md))

### `--help`, `-h`

Display help information for any command.

```bash
# Global help
npm run dev -- --help

# Command-specific help
npm run dev -- scrape --help
npm run dev -- scrape-list --help
```

### `--version`, `-v`

Display Lesca version.

```bash
npm run dev -- --version
# Output: 0.1.0
```

---

## Commands

### `init`

Initialize Lesca configuration and create necessary directories.

#### Syntax

```bash
npm run dev -- init [options]
```

#### Options

| Option                 | Type    | Default                 | Description                                      |
| ---------------------- | ------- | ----------------------- | ------------------------------------------------ |
| `--config-path <path>` | string  | `./lesca.config.yaml`   | Path to create config file                       |
| `--cookie-path <path>` | string  | `~/.lesca/cookies.json` | Path for cookie storage                          |
| `--output-dir <path>`  | string  | `./output`              | Default output directory                         |
| `--format <format>`    | string  | `markdown`              | Default output format (`markdown` or `obsidian`) |
| `--force`              | boolean | `false`                 | Overwrite existing configuration                 |

#### Examples

**Basic initialization**:

```bash
npm run dev -- init
```

**Custom configuration**:

```bash
npm run dev -- init \
  --config-path ./lesca.config.yaml \
  --output-dir ./my-problems \
  --format obsidian
```

**Force overwrite existing config**:

```bash
npm run dev -- init --force
```

**Create config for Obsidian vault**:

```bash
npm run dev -- init \
  --output-dir ./LeetCode-Vault \
  --format obsidian \
  --cookie-path ~/.lesca/cookies.json
```

#### Output

```
✔ Configuration created at /path/to/lesca.config.yaml

Next steps:
1. Copy your LeetCode cookies to: /home/user/.lesca/cookies.json
2. Start scraping: lesca scrape two-sum
3. Customize config: /path/to/lesca.config.yaml
```

#### Files Created

- Configuration file at specified path
- `~/.lesca/` directory
- `~/.lesca/cache/` directory
- `~/.lesca/cookies.example.json` (example file)

---

---

### `auth`

Authenticate with LeetCode interactively or via flags.

#### Syntax

```bash
npm run dev -- auth [options]
```

#### Options

| Option             | Short | Type    | Default | Description                           |
| ------------------ | ----- | ------- | ------- | ------------------------------------- |
| `--cookies <file>` | `-c`  | string  |         | Path to cookies.json file             |
| `--browser`        |       | boolean | `false` | Use browser-based login (Coming Soon) |

#### Examples

**Interactive mode**:

```bash
npm run dev -- auth
```

**Use existing cookie file**:

```bash
npm run dev -- auth --cookies ~/.lesca/cookies.json
```

---

### `config`

Manage and inspect Lesca configuration.

#### Syntax

```bash
npm run dev -- config <subcommand> [options]
```

#### Subcommands

##### `config list`

Display the full current configuration in YAML format.

**Syntax:**

```bash
npm run dev -- config list
```

**Example:**

```bash
npm run dev -- config list
```

**Output:**

```yaml
auth:
  cookiePath: /home/user/.lesca/cookies.json
  sessionTimeout: 3600
api:
  endpoint: https://leetcode.com/graphql
  timeout: 30000
  retries: 3
browser:
  headless: true
  timeout: 30000
storage:
  path: ./output
... (full configuration)
```

##### `config get <key>`

Get a specific configuration value using dot notation.

**Syntax:**

```bash
npm run dev -- config get <key>
```

**Arguments:**

| Argument | Required | Description                                                                 |
| -------- | -------- | --------------------------------------------------------------------------- |
| `<key>`  | Yes      | Configuration key in dot notation (e.g., `browser.headless`, `api.timeout`) |

**Examples:**

**Get single value:**

```bash
npm run dev -- config get browser.headless
# Output: true
```

**Get nested object:**

```bash
npm run dev -- config get auth
# Output:
# {
#   "cookiePath": "/home/user/.lesca/cookies.json",
#   "sessionTimeout": 3600
# }
```

**Get array or complex value:**

```bash
npm run dev -- config get cache.ttl
# Output: JSON formatted object
```

**Common configuration keys:**

- `auth.cookiePath` - Cookie file location
- `browser.headless` - Browser headless mode setting
- `api.endpoint` - LeetCode GraphQL API endpoint
- `api.timeout` - API request timeout in milliseconds
- `storage.path` - Output directory path
- `scraping.concurrency` - Number of parallel scrapes

##### `config path`

Show information about the loaded configuration.

**Syntax:**

```bash
npm run dev -- config path
```

**Example:**

```bash
npm run dev -- config path
# Output: Configuration loaded.
```

**Note:** The configuration is loaded from standard locations in this priority order:

1. `--config` CLI option
2. `LESCA_CONFIG_PATH` environment variable
3. `./lesca.config.yaml`
4. `./lesca.config.json`
5. `~/.lesca/config.yaml`
6. Default values

---

---

### `list`

List available LeetCode problems without scraping.

#### Syntax

```bash
npm run dev -- list [options]
```

#### Options

| Option                 | Short | Type   | Default | Description                                     |
| ---------------------- | ----- | ------ | ------- | ----------------------------------------------- |
| `--difficulty <level>` | `-d`  | string | All     | Filter by difficulty (`Easy`, `Medium`, `Hard`) |
| `--tags <tags>`        | `-t`  | string | All     | Filter by tags (comma-separated)                |
| `--limit <number>`     | `-l`  | number | `50`    | Limit number of problems displayed              |
| `--offset <number>`    |       | number | `0`     | Offset for pagination                           |

#### Examples

**List recent problems**:

```bash
npm run dev -- list
```

**Filter by difficulty**:

```bash
npm run dev -- list --difficulty Medium
```

**Filter by tags**:

```bash
npm run dev -- list --tags "array,dp"
```

---

### `search`

Search for problems by title or keywords.

#### Syntax

```bash
npm run dev -- search <query> [options]
```

#### Arguments

| Argument  | Required | Description         |
| --------- | -------- | ------------------- |
| `<query>` | Yes      | Search query string |

#### Options

| Option                 | Short | Type   | Default | Description             |
| ---------------------- | ----- | ------ | ------- | ----------------------- |
| `--difficulty <level>` | `-d`  | string | All     | Filter by difficulty    |
| `--tags <tags>`        | `-t`  | string | All     | Filter by tags          |
| `--limit <number>`     | `-l`  | number | `10`    | Limit number of results |

#### Examples

**Search by keyword**:

```bash
npm run dev -- search "two sum"
```

**Search with filters**:

```bash
npm run dev -- search "substring" --difficulty Hard
```

---

### `scrape`

Scrape a single LeetCode problem.

#### Syntax

```bash
npm run dev -- scrape <problem> [options]
```

#### Arguments

| Argument    | Required | Description                                                                            |
| ----------- | -------- | -------------------------------------------------------------------------------------- |
| `<problem>` | Yes      | Problem title slug (e.g., `two-sum`, `longest-substring-without-repeating-characters`) |

#### Options

| Option              | Short | Type    | Default     | Description                            |
| ------------------- | ----- | ------- | ----------- | -------------------------------------- |
| `--output <dir>`    | `-o`  | string  | From config | Output directory                       |
| `--format <format>` | `-f`  | string  | From config | Output format (`markdown`, `obsidian`) |
| `--cookies <file>`  | `-c`  | string  | From config | Cookie file path                       |
| `--cache-dir <dir>` |       | string  | From config | Cache directory                        |
| `--no-cache`        |       | boolean | `false`     | Disable caching                        |
| `--no-auth`         |       | boolean | `false`     | Skip authentication                    |

#### Examples

**Basic scraping**:

```bash
npm run dev -- scrape two-sum
```

**Custom output directory**:

```bash
npm run dev -- scrape two-sum --output ./problems
```

**Change output format**:

```bash
npm run dev -- scrape two-sum --format obsidian
```

**Without authentication** (public problems only):

```bash
npm run dev -- scrape two-sum --no-auth
```

**Custom cookie file**:

```bash
npm run dev -- scrape two-sum --cookies ./my-cookies.json
```

**Disable caching**:

```bash
npm run dev -- scrape two-sum --no-cache
```

**Multiple options combined**:

```bash
npm run dev -- scrape longest-substring-without-repeating-characters \
  --output ./hard-problems \
  --format obsidian \
  --cookies ~/.lesca/cookies.json
```

#### Output

**Success**:

```
✔ Authentication loaded
✔ Cache enabled
✔ Problem scraped successfully!
   Saved to: ./output/two-sum.md

  Preview:
  # 1. Two Sum

  **Difficulty**: Easy
  **Topics**: Array, Hash Table
```

**Error**:

```
✖ Failed to scrape problem
Error: Problem not found: invalid-slug
```

---

### `scrape-list`

Scrape multiple LeetCode problems with filtering options.

#### Syntax

```bash
npm run dev -- scrape-list [options]
```

#### Options

| Option                   | Short | Type    | Default     | Description                                     |
| ------------------------ | ----- | ------- | ----------- | ----------------------------------------------- |
| `--output <dir>`         | `-o`  | string  | From config | Output directory                                |
| `--format <format>`      | `-f`  | string  | From config | Output format                                   |
| `--cookies <file>`       | `-c`  | string  | From config | Cookie file path                                |
| `--cache-dir <dir>`      |       | string  | From config | Cache directory                                 |
| `--no-cache`             |       | boolean | `false`     | Disable caching                                 |
| `--difficulty <level>`   | `-d`  | string  | All         | Filter by difficulty (`Easy`, `Medium`, `Hard`) |
| `--tags <tags>`          | `-t`  | string  | All         | Filter by tags (comma-separated)                |
| `--limit <number>`       | `-l`  | number  | `10`        | Limit number of problems                        |
| `--concurrency <number>` |       | number  | `3`         | Number of parallel scrapes (1-10)               |
| `--resume`               |       | boolean | `false`     | Resume from previous progress                   |
| `--no-auth`              |       | boolean | `false`     | Skip authentication                             |

#### Examples

**Scrape first 10 problems**:

```bash
npm run dev -- scrape-list
```

**Filter by difficulty**:

```bash
npm run dev -- scrape-list --difficulty Medium
npm run dev -- scrape-list -d Easy
npm run dev -- scrape-list -d Hard --limit 50
```

**Filter by tags**:

```bash
# Single tag
npm run dev -- scrape-list --tags array

# Multiple tags (problems matching ANY tag)
npm run dev -- scrape-list --tags "array,hash-table,dynamic-programming"

# Combined with difficulty
npm run dev -- scrape-list \
  --difficulty Medium \
  --tags "dynamic-programming" \
  --limit 30
```

**Custom limit**:

```bash
npm run dev -- scrape-list --limit 100
npm run dev -- scrape-list -l 50
```

**Adjust concurrency**:

```bash
# Slower, more conservative
npm run dev -- scrape-list --concurrency 2

# Faster, more aggressive (max: 10)
npm run dev -- scrape-list --concurrency 5

# Combined with limit
npm run dev -- scrape-list --concurrency 5 --limit 200
```

**Resume interrupted scraping**:

```bash
# Start scraping
npm run dev -- scrape-list --limit 500

# If interrupted, resume from where you left off
npm run dev -- scrape-list --limit 500 --resume
```

**Complex filtering**:

```bash
npm run dev -- scrape-list \
  --difficulty Hard \
  --tags "dynamic-programming,graph" \
  --limit 50 \
  --concurrency 3 \
  --output ./hard-dp-problems \
  --format obsidian
```

#### Output

**Progress bar**:

```
███████████████████░░░░░░░░░ | 65% | 65/100 | ✓ 63 ✗ 2 | ETA: 00:35

Summary:
  ✓ Successful: 98
  ✗ Failed: 2
  ⏱  Duration: 2m 34s
  ⌀  Average: 1.54s
  → Output: ./output
```

**With errors**:

```
Errors:
  ✗ problem-slug-1: Authentication required
  ✗ problem-slug-2: Problem not found
```

#### Progress File

When scraping is interrupted, progress is saved to `.lesca-progress.json`:

```json
{
  "completedIndices": [0, 1, 2, 5, 6],
  "results": [...],
  "startTime": 1234567890
}
```

Use `--resume` to continue from this file.

---

### `scrape-editorial`

Scrape official LeetCode editorials and solutions. Requires browser automation.

#### Syntax

```bash
npm run dev -- scrape-editorial <problem> [options]
```

#### Arguments

| Argument    | Required | Description        |
| ----------- | -------- | ------------------ |
| `<problem>` | Yes      | Problem title slug |

#### Options

| Option              | Short | Type    | Default     | Description                       |
| ------------------- | ----- | ------- | ----------- | --------------------------------- |
| `--output <dir>`    | `-o`  | string  | From config | Output directory                  |
| `--format <format>` | `-f`  | string  | From config | Output format                     |
| `--cookies <file>`  | `-c`  | string  | From config | Cookie file path                  |
| `--headless`        |       | boolean | From config | Run browser in headless mode      |
| `--no-headless`     |       | boolean |             | Run browser in visible mode       |
| `--premium`         |       | boolean | `false`     | Attempt to scrape premium content |
| `--no-auth`         |       | boolean | `false`     | Skip authentication               |

#### Examples

**Basic editorial scraping**:

```bash
npm run dev -- scrape-editorial two-sum
```

**Premium content** (requires LeetCode subscription):

```bash
npm run dev -- scrape-editorial two-sum --premium
```

**Visible browser mode** (for debugging):

```bash
npm run dev -- scrape-editorial two-sum --no-headless
```

**Custom output**:

```bash
npm run dev -- scrape-editorial two-sum \
  --output ./editorials \
  --format obsidian
```

**Multiple editorials**:

```bash
for problem in "two-sum" "three-sum" "four-sum"; do
  npm run dev -- scrape-editorial "$problem"
done
```

#### Output

```
✔ Authentication loaded
✔ Browser launched
✔ Editorial scraped successfully!
   Saved to: ./output/two-sum-editorial.md

  Preview:
  # Two Sum - Editorial

  ## Approach 1: Brute Force
  ...
```

#### Browser Requirements

First-time setup:

```bash
npx playwright install chromium
```

---

### `scrape-discussions`

Scrape community discussions and solutions. Requires browser automation.

#### Syntax

```bash
npm run dev -- scrape-discussions <problem> [options]
```

#### Arguments

| Argument    | Required | Description        |
| ----------- | -------- | ------------------ |
| `<problem>` | Yes      | Problem title slug |

#### Options

| Option              | Short | Type    | Default     | Description                                                   |
| ------------------- | ----- | ------- | ----------- | ------------------------------------------------------------- |
| `--output <dir>`    | `-o`  | string  | From config | Output directory                                              |
| `--format <format>` | `-f`  | string  | From config | Output format                                                 |
| `--cookies <file>`  | `-c`  | string  | From config | Cookie file path                                              |
| `--category <cat>`  |       | string  | All         | Filter category (`solution`, `general`, `interview-question`) |
| `--sort <order>`    |       | string  | `hot`       | Sort order (`hot`, `most-votes`, `recent`)                    |
| `--limit <number>`  |       | number  | `10`        | Number of discussions                                         |
| `--comments`        |       | boolean | `false`     | Include comments                                              |
| `--headless`        |       | boolean | From config | Run browser in headless mode                                  |
| `--no-headless`     |       | boolean |             | Run browser in visible mode                                   |
| `--no-auth`         |       | boolean | `false`     | Skip authentication                                           |

#### Examples

**Basic discussions**:

```bash
npm run dev -- scrape-discussions two-sum
```

**Solution discussions only**:

```bash
npm run dev -- scrape-discussions two-sum --category solution
```

**Sort by votes**:

```bash
npm run dev -- scrape-discussions two-sum --sort most-votes
```

**Get recent discussions**:

```bash
npm run dev -- scrape-discussions two-sum --sort recent
```

**More discussions**:

```bash
npm run dev -- scrape-discussions two-sum --limit 50
```

**Include comments**:

```bash
npm run dev -- scrape-discussions two-sum --comments
```

**Visible browser**:

```bash
npm run dev -- scrape-discussions two-sum --no-headless
```

**Complex query**:

```bash
npm run dev -- scrape-discussions two-sum \
  --category solution \
  --sort most-votes \
  --limit 20 \
  --comments \
  --output ./solutions
```

#### Output

```
✔ Authentication loaded
✔ Browser launched
✔ Discussions scraped successfully!
   Saved to: ./output/two-sum-discussions.md

  Preview:
  # Two Sum - Discussions

  ## Discussion 1: One-pass Hash Table
  Author: user123
  Votes: 1234
  ...
```

---

## Common Patterns

### Pattern 1: Batch Scraping with Resume

```bash
# Start large batch
npm run dev -- scrape-list --limit 1000 --concurrency 5

# If interrupted, resume
npm run dev -- scrape-list --limit 1000 --concurrency 5 --resume
```

### Pattern 2: Scrape Problem with Editorial and Discussions

```bash
#!/bin/bash
PROBLEM="two-sum"

# 1. Scrape problem
npm run dev -- scrape "$PROBLEM"

# 2. Scrape editorial
npm run dev -- scrape-editorial "$PROBLEM"

# 3. Scrape top discussions
npm run dev -- scrape-discussions "$PROBLEM" \
  --category solution \
  --sort most-votes \
  --limit 10
```

### Pattern 3: Difficulty-Based Organization

```bash
# Create directories for each difficulty
mkdir -p problems/{easy,medium,hard}

# Scrape each difficulty
npm run dev -- scrape-list --difficulty Easy \
  --output ./problems/easy

npm run dev -- scrape-list --difficulty Medium \
  --output ./problems/medium

npm run dev -- scrape-list --difficulty Hard \
  --output ./problems/hard
```

### Pattern 4: Topic-Based Study

```bash
# Array problems
npm run dev -- scrape-list --tags array \
  --output ./topics/arrays

# Dynamic Programming
npm run dev -- scrape-list --tags "dynamic-programming" \
  --output ./topics/dp

# Graph problems
npm run dev -- scrape-list \
  --tags "graph,depth-first-search,breadth-first-search" \
  --output ./topics/graphs
```

### Pattern 5: Using Configuration File

```bash
# Create config for Obsidian
npm run dev -- init \
  --config-path ./obsidian-config.yaml \
  --output-dir ./LeetCode-Vault \
  --format obsidian

# Use config
npm run dev -- --config ./obsidian-config.yaml scrape-list
```

---

## Exit Codes

Lesca uses standard exit codes:

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| `0`  | Success                                                |
| `1`  | General error (authentication, network, invalid input) |
| `2`  | Configuration error                                    |

**Examples**:

```bash
# Check exit code
npm run dev -- scrape two-sum
echo $?  # 0 if successful, 1 if error

# Use in scripts
if npm run dev -- scrape two-sum; then
  echo "Success!"
else
  echo "Failed with code $?"
fi
```

---

## Environment Variables

Override configuration via environment variables:

### Authentication

```bash
export LESCA_AUTH_METHOD=cookie
export LESCA_COOKIE_PATH=/path/to/cookies.json
export LESCA_SESSION_TIMEOUT=3600
```

### API Settings

```bash
export LESCA_API_ENDPOINT=https://leetcode.com/graphql
export LESCA_API_TIMEOUT=30000
export LESCA_API_RETRIES=3
export LESCA_RATE_LIMIT=true
export LESCA_RATE_LIMIT_RPM=30
```

### Storage and Output

```bash
export LESCA_STORAGE_TYPE=filesystem
export LESCA_OUTPUT_PATH=./output
export LESCA_OUTPUT_FORMAT=obsidian
export LESCA_OUTPUT_PATTERN="{slug}.md"
export LESCA_FRONTMATTER=true
export LESCA_DOWNLOAD_IMAGES=false
```

### Scraping Behavior

```bash
export LESCA_CONCURRENCY=5
export LESCA_BATCH_SIZE=10
export LESCA_DELAY=1000
export LESCA_TIMEOUT=60000
```

### Browser Settings

```bash
export LESCA_BROWSER_ENABLED=true
export LESCA_BROWSER_HEADLESS=true
export LESCA_BROWSER_EXECUTABLE=/path/to/chrome
```

### Cache Settings

```bash
export LESCA_CACHE_ENABLED=true
export LESCA_CACHE_DIR=~/.lesca/cache
export LESCA_CACHE_COMPRESSION=true
```

### Logging

```bash
export LESCA_LOG_LEVEL=info  # debug, info, warn, error
export LESCA_LOG_OUTPUT=console  # console, file, both
export LESCA_LOG_FILE=/path/to/logfile.log
```

### Example Usage

```bash
# Set multiple environment variables
export LESCA_OUTPUT_FORMAT=obsidian
export LESCA_CONCURRENCY=5
export LESCA_CACHE_ENABLED=false

# Run command with overrides
npm run dev -- scrape-list --limit 100
```

---

## Tips and Tricks

### 1. Create Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias lesca="npm run dev --"
alias lesca-scrape="npm run dev -- scrape"
alias lesca-list="npm run dev -- scrape-list"
```

Usage:

```bash
lesca scrape two-sum
lesca-list --difficulty Medium
```

### 2. Use Shell Functions

```bash
# Scrape problem with all related content
scrape-all() {
  npm run dev -- scrape "$1"
  npm run dev -- scrape-editorial "$1"
  npm run dev -- scrape-discussions "$1" --limit 10
}

# Usage
scrape-all two-sum
```

### 3. Combine with Other Tools

```bash
# Count scraped problems
npm run dev -- scrape-list --limit 100
ls output/*.md | wc -l

# Find problems by difficulty in filename
grep -l "Difficulty: Medium" output/*.md

# Search for specific topics
grep -r "Dynamic Programming" output/
```

### 4. Progress Monitoring

```bash
# Watch output directory
watch -n 1 'ls -lh output/'

# Monitor progress file
watch -n 1 'cat .lesca-progress.json | jq .completedIndices | wc -l'
```

---

## See Also

- [User Guide](./USER_GUIDE.md) - Comprehensive usage guide
- [Configuration Guide](./CONFIGURATION.md) - All configuration options
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [Examples](../examples/) - Sample configurations and use cases
