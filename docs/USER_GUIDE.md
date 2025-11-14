# Lesca User Guide

Welcome to Lesca! This guide will help you get started with scraping LeetCode content and converting it to Markdown or Obsidian format.

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication Setup](#authentication-setup)
- [Basic Usage](#basic-usage)
- [Common Use Cases](#common-use-cases)
- [Output Formats](#output-formats)
- [Working with Configuration](#working-with-configuration)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)

---

## Quick Start

Get up and running with Lesca in 3 steps:

### 1. Initialize Configuration

```bash
npm run dev -- init
```

This creates a default configuration file at `./lesca.config.yaml` and sets up necessary directories.

### 2. Set Up Authentication

Export your LeetCode cookies and save them to `~/.lesca/cookies.json`:

```json
[
  {
    "name": "LEETCODE_SESSION",
    "value": "your-session-token-here",
    "domain": ".leetcode.com",
    "path": "/",
    "expires": -1,
    "httpOnly": true,
    "secure": true,
    "sameSite": "Lax"
  },
  {
    "name": "csrftoken",
    "value": "your-csrf-token-here",
    "domain": ".leetcode.com",
    "path": "/",
    "expires": -1,
    "httpOnly": false,
    "secure": true,
    "sameSite": "Lax"
  }
]
```

See [Authentication Setup](#authentication-setup) for detailed instructions.

### 3. Scrape Your First Problem

```bash
npm run dev -- scrape two-sum
```

The problem will be saved to `./output/two-sum.md` by default.

---

## Authentication Setup

Lesca requires LeetCode authentication cookies to access problems and premium content.

### Why Authentication is Needed

- Access to all problem descriptions
- Ability to scrape premium content (with subscription)
- Avoid rate limiting
- Access to editorials and discussions

### Getting Your Cookies

#### Method 1: Browser Extension (Recommended)

1. **Install a Cookie Extension**
   - Chrome/Edge: [EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg)
   - Firefox: [Cookie-Editor](https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/)

2. **Login to LeetCode**
   - Go to https://leetcode.com
   - Sign in to your account

3. **Export Cookies**
   - Click the extension icon
   - Find `LEETCODE_SESSION` and `csrftoken` cookies
   - Export as JSON format

4. **Save Cookie File**
   ```bash
   # Save to default location
   mkdir -p ~/.lesca
   # Paste your cookies into this file:
   nano ~/.lesca/cookies.json
   ```

#### Method 2: Browser DevTools

1. **Open DevTools**
   - Press F12 or right-click → Inspect
   - Go to Application/Storage tab

2. **Find Cookies**
   - Navigate to Cookies → https://leetcode.com
   - Copy `LEETCODE_SESSION` and `csrftoken` values

3. **Create Cookie File**
   ```json
   [
     {
       "name": "LEETCODE_SESSION",
       "value": "paste-your-session-here",
       "domain": ".leetcode.com",
       "path": "/",
       "expires": -1,
       "httpOnly": true,
       "secure": true,
       "sameSite": "Lax"
     },
     {
       "name": "csrftoken",
       "value": "paste-your-csrf-here",
       "domain": ".leetcode.com",
       "path": "/",
       "expires": -1,
       "httpOnly": false,
       "secure": true,
       "sameSite": "Lax"
     }
   ]
   ```

### Custom Cookie Path

You can specify a custom cookie file location:

```bash
# Using CLI flag
npm run dev -- scrape two-sum --cookies /path/to/cookies.json

# Using configuration
# Edit lesca.config.yaml:
auth:
  cookiePath: /path/to/cookies.json
```

---

## Basic Usage

### Scraping a Single Problem

```bash
# Basic scraping
npm run dev -- scrape two-sum

# Specify output directory
npm run dev -- scrape two-sum --output ./my-problems

# Choose output format
npm run dev -- scrape two-sum --format obsidian

# Without authentication (public problems only)
npm run dev -- scrape two-sum --no-auth
```

### Scraping Multiple Problems

```bash
# Scrape all problems
npm run dev -- scrape-list

# Filter by difficulty
npm run dev -- scrape-list --difficulty Medium

# Filter by tags
npm run dev -- scrape-list --tags "array,dynamic-programming"

# Limit number of problems
npm run dev -- scrape-list --limit 50

# Increase concurrency (faster)
npm run dev -- scrape-list --concurrency 5
```

### Scraping Editorials

```bash
# Scrape official editorial
npm run dev -- scrape-editorial two-sum

# Include premium content
npm run dev -- scrape-editorial two-sum --premium

# Run browser in visible mode (for debugging)
npm run dev -- scrape-editorial two-sum --no-headless
```

### Scraping Discussions

```bash
# Scrape discussions for a problem
npm run dev -- scrape-discussions two-sum

# Filter by category
npm run dev -- scrape-discussions two-sum --category solution

# Sort by votes
npm run dev -- scrape-discussions two-sum --sort most-votes

# Include comments
npm run dev -- scrape-discussions two-sum --comments

# Limit number of discussions
npm run dev -- scrape-discussions two-sum --limit 20
```

---

## Common Use Cases

### Use Case 1: Building a Personal Problem Bank

**Goal**: Download all problems you've solved for offline review.

```bash
# 1. Initialize configuration
npm run dev -- init --output-dir ./my-leetcode --format obsidian

# 2. Scrape all Easy problems
npm run dev -- scrape-list --difficulty Easy --output ./my-leetcode/easy

# 3. Scrape all Medium problems
npm run dev -- scrape-list --difficulty Medium --output ./my-leetcode/medium

# 4. Scrape all Hard problems
npm run dev -- scrape-list --difficulty Hard --output ./my-leetcode/hard
```

**Result**: Organized problem collection in Obsidian-compatible format.

---

### Use Case 2: Topic-Based Study

**Goal**: Study all problems related to specific topics.

```bash
# Dynamic Programming problems
npm run dev -- scrape-list --tags "dynamic-programming" --output ./topics/dp

# Graph problems
npm run dev -- scrape-list --tags "graph,depth-first-search,breadth-first-search" \
  --output ./topics/graphs

# Array problems
npm run dev -- scrape-list --tags "array" --difficulty Medium \
  --output ./topics/arrays
```

---

### Use Case 3: Interview Preparation

**Goal**: Download top interview questions with solutions.

```bash
# 1. Scrape top 50 Medium problems
npm run dev -- scrape-list --difficulty Medium --limit 50 \
  --output ./interview-prep

# 2. Get editorials for each problem
# (Run after scraping problems)
for problem in $(ls ./interview-prep/*.md); do
  slug=$(basename "$problem" .md)
  npm run dev -- scrape-editorial "$slug" --output ./interview-prep/editorials
done

# 3. Get top discussions
for problem in $(ls ./interview-prep/*.md); do
  slug=$(basename "$problem" .md)
  npm run dev -- scrape-discussions "$slug" --limit 5 \
    --category solution --output ./interview-prep/solutions
done
```

---

### Use Case 4: Creating an Obsidian Vault

**Goal**: Build a fully-linked Obsidian vault for LeetCode problems.

```bash
# 1. Initialize with Obsidian format
npm run dev -- init --format obsidian --output-dir ./LeetCode-Vault

# 2. Configure for Obsidian (edit lesca.config.yaml)
# Set:
#   output.format: obsidian
#   output.frontmatter: true
#   storage.path: ./LeetCode-Vault

# 3. Scrape all problems
npm run dev -- scrape-list --concurrency 3

# 4. Open in Obsidian
# File → Open Vault → Choose ./LeetCode-Vault
```

**Features**:
- Problems have YAML frontmatter with metadata
- Internal links between related problems
- Tags for easy filtering
- Difficulty ratings

---

### Use Case 5: Daily Problem Archive

**Goal**: Automatically scrape daily challenge problems.

```bash
# Add to cron or scheduled task:
# Run daily at 12:01 AM

# 1. Create script: scrape-daily.sh
#!/bin/bash
DATE=$(date +%Y-%m-%d)
npm run dev -- scrape-list --limit 1 \
  --output "./daily-challenges/$DATE" \
  --format obsidian

# 2. Add to crontab
# crontab -e
# 1 0 * * * /path/to/scrape-daily.sh
```

---

## Output Formats

Lesca supports two output formats:

### Markdown Format

Standard Markdown with GitHub Flavored Markdown syntax.

**Best for**:
- General Markdown editors
- GitHub repositories
- Static site generators (Jekyll, Hugo)

**Example Output**:
```markdown
# 1. Two Sum

**Difficulty**: Easy
**Topics**: Array, Hash Table

## Description

Given an array of integers nums and an integer target...

## Examples

### Example 1
...

## Solution

```python
def twoSum(nums, target):
    ...
```
```

---

### Obsidian Format

Markdown with Obsidian-specific features and frontmatter.

**Best for**:
- Obsidian vaults
- Personal knowledge management
- Linked note-taking

**Example Output**:
```markdown
---
id: 1
title: Two Sum
difficulty: Easy
topics:
  - Array
  - Hash Table
url: https://leetcode.com/problems/two-sum
---

# Two Sum

**Difficulty**: [[Easy]]
**Topics**: [[Array]], [[Hash Table]]

## Description

Given an array of integers nums and an integer target...

## Related Problems

- [[3. Longest Substring Without Repeating Characters]]
- [[15. 3Sum]]
```

**Features**:
- YAML frontmatter for metadata
- Internal [[wiki-style]] links
- Tag-based organization
- Backlink support

---

## Working with Configuration

### Configuration File Locations

Lesca searches for configuration in this order:

1. `./lesca.config.yaml` (project root)
2. `./lesca.config.yml`
3. `./lesca.config.json`
4. `./.lesca.yaml`
5. `~/.lesca/config.yaml`
6. `~/.config/lesca/config.yaml`

### Creating a Configuration File

```bash
# Create default config
npm run dev -- init

# Create config at custom location
npm run dev -- init --config-path ./my-config.yaml

# Customize output settings
npm run dev -- init --output-dir ./output --format obsidian
```

### Configuration Structure

See [CONFIGURATION.md](./CONFIGURATION.md) for detailed configuration options.

**Key sections**:
- `auth`: Authentication settings
- `api`: API endpoint and rate limiting
- `storage`: Output directory and storage type
- `output`: Format and file patterns
- `scraping`: Concurrency and behavior
- `cache`: Caching settings for faster scraping
- `browser`: Browser automation settings

### Using Environment Variables

Override configuration with environment variables:

```bash
# Set output directory
export LESCA_OUTPUT_PATH=./my-output

# Set output format
export LESCA_OUTPUT_FORMAT=obsidian

# Disable cache
export LESCA_CACHE_ENABLED=false

# Run with overrides
npm run dev -- scrape two-sum
```

See [CONFIGURATION.md](./CONFIGURATION.md) for all environment variables.

---

## Advanced Features

### Caching

Lesca caches API responses to improve performance and reduce API calls.

**Benefits**:
- Faster re-scraping
- Reduced API load
- Offline access to cached content

**Configuration**:
```yaml
cache:
  enabled: true
  directory: ~/.lesca/cache
  memorySize: 50  # Number of items in memory
  ttl:
    problem: 604800000    # 7 days
    list: 86400000        # 1 day
    editorial: 604800000  # 7 days
    discussion: 3600000   # 1 hour
```

**Clear cache**:
```bash
rm -rf ~/.lesca/cache
```

---

### Resume Capability

Resume interrupted batch scraping:

```bash
# Start scraping
npm run dev -- scrape-list --limit 100

# If interrupted, resume from where you left off
npm run dev -- scrape-list --limit 100 --resume
```

**How it works**:
- Progress saved to `.lesca-progress.json`
- Skips already-scraped problems
- Continues from interruption point

---

### Rate Limiting

Lesca includes intelligent rate limiting to avoid API throttling:

```yaml
api:
  rateLimit:
    enabled: true
    requestsPerMinute: 30  # Max requests per minute
    minDelay: 2000         # Min delay between requests (ms)
    maxDelay: 10000        # Max delay with jitter (ms)
    jitter: true           # Add randomness to avoid patterns
```

**Tips**:
- Lower `requestsPerMinute` if getting rate limited
- Increase delays for more conservative scraping
- Enable jitter to avoid detection patterns

---

### Browser Automation

For content requiring JavaScript rendering (editorials, discussions):

```yaml
browser:
  enabled: true
  headless: true           # Run browser in background
  timeout: 30000          # Page load timeout
  blockedResources:       # Block unnecessary resources
    - image
    - font
    - media
```

**Debug mode**:
```bash
# See browser in action
npm run dev -- scrape-editorial two-sum --no-headless
```

---

## Best Practices

### 1. Start Small

Don't scrape everything at once:

```bash
# Good: Test with 10 problems first
npm run dev -- scrape-list --limit 10

# Then: Scale up gradually
npm run dev -- scrape-list --limit 50
npm run dev -- scrape-list --limit 200
```

### 2. Use Appropriate Concurrency

Balance speed vs. server load:

```bash
# Conservative (safer)
npm run dev -- scrape-list --concurrency 2

# Moderate (default)
npm run dev -- scrape-list --concurrency 3

# Aggressive (faster, higher risk)
npm run dev -- scrape-list --concurrency 5
```

### 3. Enable Caching

Always use cache for re-scraping:

```yaml
cache:
  enabled: true  # ← Keep this true
```

### 4. Organize Output

Use meaningful directory structures:

```bash
# By difficulty
npm run dev -- scrape-list --difficulty Easy --output ./problems/easy

# By topic
npm run dev -- scrape-list --tags array --output ./topics/arrays

# By date
npm run dev -- scrape-list --output "./archive/$(date +%Y-%m)"
```

### 5. Keep Cookies Fresh

LeetCode sessions expire. Update cookies if you get auth errors:

```bash
# Test authentication
npm run dev -- scrape two-sum

# If it fails, refresh cookies from browser
```

### 6. Use Resume for Large Batches

For scraping 100+ problems:

```bash
# Always use --resume flag
npm run dev -- scrape-list --limit 500 --resume
```

If interrupted, just run the same command again.

### 7. Monitor Rate Limits

Watch for rate limit errors:

```
Rate limit exceeded
```

**Solutions**:
- Reduce concurrency: `--concurrency 2`
- Increase delays in config
- Wait before retrying

### 8. Version Control Your Config

Track your configuration in git:

```bash
git add lesca.config.yaml
git commit -m "Update Lesca configuration"
```

But **exclude** cookies:

```bash
# .gitignore
.lesca/cookies.json
*.cookies.json
```

---

## Troubleshooting

For detailed troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

**Common issues**:

### Authentication Failed

```
Authentication failed, continuing without auth
```

**Solution**: Update your cookies from browser.

### Rate Limit Exceeded

```
Rate limit exceeded
```

**Solution**: Reduce concurrency or increase delays.

### Browser Timeout

```
Browser timeout after 30000ms
```

**Solution**: Increase timeout in config:
```yaml
browser:
  timeout: 60000  # Increase to 60 seconds
```

### No Problems Found

```
Found 0 problems
```

**Solution**: Check your filters (difficulty, tags, limit).

---

## Next Steps

- Read [CLI Reference](./CLI_REFERENCE.md) for all commands
- See [Configuration Guide](./CONFIGURATION.md) for advanced config
- Check [Troubleshooting Guide](./TROUBLESHOOTING.md) for issues
- Review [Examples](../examples/) for sample configs

**Happy Scraping!** 🚀
