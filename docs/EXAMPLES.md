# Lesca Examples

This guide provides practical examples and "recipes" for common Lesca workflows.

## Table of Contents

- [Batch Scraping](#batch-scraping)
- [Filtering and Searching](#filtering-and-searching)
- [Obsidian Integration](#obsidian-integration)
- [Advanced Configuration](#advanced-configuration)
- [Automation](#automation)

---

## Batch Scraping

### Scrape Top 100 Liked Questions

Scrape the most popular questions for interview prep.

```bash
# 1. Initialize with a specific output directory
npm run dev -- init --output-dir ./top-100-liked

# 2. Scrape list (LeetCode doesn't have a "most liked" filter in API,
# so we scrape by difficulty and limit)
npm run dev -- list --limit 100 > top_problems.txt

# 3. Scrape them in batch
npm run dev -- scrape-list --limit 100 --concurrency 5
```

### Resume Interrupted Scrape

If you're scraping thousands of problems and lose internet connection:

```bash
# The initial command
npm run dev -- scrape-list --limit 2000

# ... connection lost ...

# Resume from where it left off
npm run dev -- scrape-list --limit 2000 --resume
```

### Scrape by Difficulty Levels

Organize problems into separate folders by difficulty.

```bash
# Easy
npm run dev -- scrape-list --difficulty Easy --output ./problems/easy

# Medium
npm run dev -- scrape-list --difficulty Medium --output ./problems/medium

# Hard
npm run dev -- scrape-list --difficulty Hard --output ./problems/hard
```

---

## Filtering and Searching

### Topic-Specific Study Plan

Create a study set for Dynamic Programming.

```bash
# List all DP problems
npm run dev -- list --tags "dynamic-programming"

# Scrape them to a specific folder
npm run dev -- scrape-list \
  --tags "dynamic-programming" \
  --output ./study-plan/dp \
  --limit 50
```

### Company-Specific Prep (Tag Search)

Search for problems often asked by specific companies (if tagged).

```bash
# Search for "google" or "facebook" in tags
npm run dev -- search "google"
```

---

## Obsidian Integration

Create a personal knowledge base of LeetCode problems.

### 1. Initialize Vault

```bash
npm run dev -- init \
  --output-dir ./LeetCode-Vault \
  --format obsidian
```

### 2. Configure Frontmatter

Edit `lesca.config.yaml` to ensure rich metadata:

```yaml
output:
  format: obsidian
  frontmatter:
    title: true
    difficulty: true
    tags: true
    url: true
    date: true
```

### 3. Scrape Content

```bash
npm run dev -- scrape-list --limit 200
```

### 4. Link Notes in Obsidian

In Obsidian, you can now link to problems:

```markdown
Today I solved [[1-two-sum]]. It uses a [[Hash Table]] approach.
```

---

## Advanced Configuration

### High-Performance Scraping

For fast scraping (be careful of rate limits):

```yaml
# lesca.config.yaml
scraping:
  concurrency: 10
  delay: 500

api:
  timeout: 10000
  retries: 5

browser:
  headless: true
  blockedResources:
    - image
    - font
    - media
    - stylesheet
```

### Offline/Cache-First Mode

If you've already scraped data and want to re-process it without hitting the API:

```yaml
# lesca.config.yaml
cache:
  enabled: true
  ttl:
    problem: 31536000000 # 1 year
```

Then run commands as normal. Lesca will hit the cache first.

---

## Automation

### Daily Challenge Scraper

Create a script `daily.sh` to scrape the daily challenge (requires finding the slug manually or via search first).

```bash
#!/bin/bash

# 1. Search for today's problem (manual step usually needed as API doesn't expose "daily" directly yet)
# But you can scrape a specific problem if you know the slug
SLUG=$1

if [ -z "$SLUG" ]; then
  echo "Usage: ./daily.sh <problem-slug>"
  exit 1
fi

# 2. Scrape problem
npm run dev -- scrape "$SLUG" --output ./daily-challenges

# 3. Scrape editorial
npm run dev -- scrape-editorial "$SLUG" --output ./daily-challenges

echo "Done! Open ./daily-challenges/$SLUG.md"
```
