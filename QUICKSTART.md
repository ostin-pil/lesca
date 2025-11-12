# Quick Start Guide

Get Lesca up and running in 5 minutes!

## Installation

```bash
# Install dependencies (if not already done)
npm install

# Build the project
npm run build

# OR run in development mode
npm run dev -- scrape two-sum
```

## Setup Authentication

### Option 1: Using Cookie File (Recommended)

1. **Log into LeetCode** in your browser

2. **Export cookies** using a browser extension:
   - Chrome/Edge: [EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie)
   - Firefox: [Cookie Editor](https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/)

3. **Create cookie file** at `~/.lesca/cookies.json`:

```json
{
  "cookies": [
    {
      "name": "LEETCODE_SESSION",
      "value": "your_session_value",
      "domain": ".leetcode.com"
    },
    {
      "name": "csrftoken",
      "value": "your_csrf_token",
      "domain": "leetcode.com"
    }
  ]
}
```

**Required cookies:**
- `LEETCODE_SESSION` - Your session cookie (most important!)
- `csrftoken` - CSRF protection token

**Optional cookies** (for better reliability):
- `cf_clearance` - Cloudflare clearance
- `INGRESSCOOKIE` - Ingress routing

See `examples/cookies.example.json` for a complete example.

### Option 2: Without Authentication

You can scrape public problems without authentication:

```bash
npm run dev -- scrape two-sum --no-auth
```

**Limitations without auth:**
- Can only access free problems
- No premium editorial content
- May hit rate limits faster

## Usage

### Scrape a Single Problem

```bash
# Using development mode
npm run dev -- scrape two-sum

# With custom output directory
npm run dev -- scrape two-sum --output ./my-vault

# Different format
npm run dev -- scrape two-sum --format markdown

# With custom cookie file
npm run dev -- scrape two-sum --cookies ./my-cookies.json
```

### Scrape Multiple Problems

```bash
# Scrape 10 easy problems
npm run dev -- scrape-list --difficulty Easy --limit 10

# Scrape array problems
npm run dev -- scrape-list --tags array --limit 20

# Scrape hard dynamic programming problems
npm run dev -- scrape-list --difficulty Hard --tags dynamic-programming --limit 5
```

### Command Options

```bash
lesca scrape <problem>
  -o, --output <dir>      Output directory (default: "./output")
  -f, --format <format>   Output format: markdown, obsidian (default: "obsidian")
  -c, --cookies <file>    Cookie file path (default: "~/.lesca/cookies.json")
  --no-auth              Skip authentication

lesca scrape-list
  -o, --output <dir>      Output directory (default: "./output")
  -f, --format <format>   Output format (default: "obsidian")
  -d, --difficulty <level> Filter by difficulty: Easy, Medium, Hard
  -t, --tags <tags>       Filter by tags (comma-separated)
  -l, --limit <number>    Limit number of problems (default: 10)
  -c, --cookies <file>    Cookie file path
  --no-auth              Skip authentication

lesca init
  Initialize configuration (shows setup instructions)
```

## Output Formats

### Obsidian Format (Default)

Creates markdown files with:
- YAML frontmatter (tags, difficulty, metadata)
- Formatted content with emojis
- Wiki-links to similar problems
- Perfect for Obsidian vaults

**Example output:**

```markdown
---
leetcode_id: "1"
frontend_id: "1"
title: Two Sum
difficulty: Easy
tags:
  - array
  - hash-table
acceptance: "56.5%"
---

# Two Sum

**Difficulty:** 🟢 Easy
**Tags:** `Array` `Hash Table`
**Acceptance Rate:** 56.5%
**LeetCode:** [Link](https://leetcode.com/problems/two-sum/)

---

Given an array of integers...
```

### Markdown Format

Standard markdown without Obsidian-specific features:
- No YAML frontmatter
- Regular markdown links
- Clean, portable format

## Examples

### Example 1: Scrape Your First Problem

```bash
# 1. Set up cookies (see Setup Authentication above)

# 2. Scrape "Two Sum" problem
npm run dev -- scrape two-sum

# 3. Check the output
ls -la output/
# You should see: 1-two-sum.md
```

### Example 2: Build Your Obsidian Vault

```bash
# Scrape top 50 easy problems to your Obsidian vault
npm run dev -- scrape-list \
  --difficulty Easy \
  --limit 50 \
  --output ~/Documents/ObsidianVault/LeetCode \
  --format obsidian
```

### Example 3: Prepare for FAANG Interviews

```bash
# Scrape popular array problems
npm run dev -- scrape-list --tags array --limit 30

# Scrape popular tree problems
npm run dev -- scrape-list --tags tree --limit 30

# Scrape popular dynamic programming problems
npm run dev -- scrape-list --tags dynamic-programming --limit 30
```

## Troubleshooting

### "Authentication failed"

**Problem:** Cookie file not found or invalid

**Solutions:**
1. Check file exists at `~/.lesca/cookies.json`
2. Verify JSON format is correct
3. Ensure cookies haven't expired (re-export from browser)
4. Try using `--cookies` option with explicit path

### "Rate limit exceeded"

**Problem:** Too many requests to LeetCode API

**Solutions:**
1. Wait 1-2 minutes and try again
2. Reduce `--limit` for batch scraping
3. The scraper has built-in rate limiting (2-3 seconds between requests)

### "Problem not found"

**Problem:** Invalid problem slug

**Solutions:**
1. Check the problem slug is correct (use URL slug from LeetCode)
2. Example: `https://leetcode.com/problems/two-sum/` → use `two-sum`
3. Premium problems require authentication

### "No such file or directory"

**Problem:** Output directory doesn't exist

**Solutions:**
1. Create the directory: `mkdir -p ./output`
2. Or use an existing directory: `--output ~/Documents`

## Next Steps

- [Architecture Documentation](./ARCHITECTURE_REVIEW.md) - Understand the system design
- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - See the development roadmap
- [GraphQL Coverage](./docs/graphql-coverage.md) - What data we can fetch

## Tips

1. **Start with authentication** - Set up cookies first for best experience

2. **Test with one problem** - Always test with a single problem before bulk scraping

3. **Use filters** - Narrow down problems by difficulty, tags to get relevant content

4. **Be patient** - Rate limiting means 2-3 seconds per problem (intentional!)

5. **Organize your vault** - Use the `--output` option to save directly to your note-taking app

## Getting Help

If you encounter issues:

1. Check this guide first
2. Review error messages carefully
3. Try running with `--no-auth` to test without authentication
4. Check that LeetCode.com is accessible in your region

Happy scraping! 🚀
