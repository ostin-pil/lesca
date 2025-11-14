# Lesca Troubleshooting Guide

Solutions to common problems and issues with Lesca.

## Table of Contents

- [Authentication Issues](#authentication-issues)
- [API and Rate Limiting](#api-and-rate-limiting)
- [Browser Automation Issues](#browser-automation-issues)
- [Caching Problems](#caching-problems)
- [Configuration Issues](#configuration-issues)
- [Performance Issues](#performance-issues)
- [Output Problems](#output-problems)
- [Installation Issues](#installation-issues)
- [Getting Help](#getting-help)

---

## Authentication Issues

### Problem: "Authentication failed, continuing without auth"

**Symptoms**:
```
✖ Authentication failed, continuing without auth
```

**Causes**:
1. Cookies file not found
2. Invalid cookie format
3. Expired session
4. Incorrect cookie path

**Solutions**:

**1. Verify cookie file exists**:
```bash
ls -la ~/.lesca/cookies.json
```

**2. Check cookie file format**:
```bash
cat ~/.lesca/cookies.json | jq .
```

Should look like:
```json
[
  {
    "name": "LEETCODE_SESSION",
    "value": "your-session-here",
    "domain": ".leetcode.com",
    ...
  }
]
```

**3. Refresh cookies**:
1. Open browser, log into LeetCode
2. Export cookies using browser extension
3. Save to `~/.lesca/cookies.json`

**4. Use explicit cookie path**:
```bash
npm run dev -- scrape two-sum --cookies /path/to/cookies.json
```

**5. Test authentication**:
```bash
npm run dev -- scrape two-sum
```

If you see "✔ Authentication loaded", it's working!

---

### Problem: "CSRF token missing"

**Symptoms**:
```
Error: CSRF token not found in cookies
```

**Cause**: Cookie file missing `csrftoken` cookie.

**Solution**:

Ensure your cookies.json includes both required cookies:
```json
[
  {
    "name": "LEETCODE_SESSION",
    "value": "...",
    ...
  },
  {
    "name": "csrftoken",
    "value": "...",
    ...
  }
]
```

---

### Problem: Session expires quickly

**Symptoms**: Need to refresh cookies frequently.

**Solutions**:

**1. Set longer session timeout**:
```yaml
# lesca.config.yaml
auth:
  sessionTimeout: 86400  # 24 hours
  autoRefresh: true
```

**2. Check cookie expiration**:
```bash
cat ~/.lesca/cookies.json | jq '.[].expires'
```

Set to `-1` for session cookies.

---

## API and Rate Limiting

### Problem: "Rate limit exceeded"

**Symptoms**:
```
✖ Error: Rate limit exceeded
Retry-After: 60
```

**Cause**: Too many requests to LeetCode API.

**Solutions**:

**1. Reduce concurrency**:
```bash
npm run dev -- scrape-list --concurrency 2
```

**2. Increase delays**:
```yaml
# lesca.config.yaml
api:
  rateLimit:
    requestsPerMinute: 20  # Lower from 30
    minDelay: 3000         # Increase from 2000
    maxDelay: 5000
```

**3. Wait before retrying**:
```bash
# Wait 60 seconds
sleep 60
npm run dev -- scrape-list --resume
```

**4. Enable jitter**:
```yaml
api:
  rateLimit:
    jitter: true  # Randomize request timing
```

---

### Problem: "Request timeout"

**Symptoms**:
```
Error: Request timeout after 30000ms
```

**Cause**: Slow network or overloaded server.

**Solutions**:

**1. Increase timeout**:
```yaml
api:
  timeout: 60000  # 60 seconds
```

**2. Check network**:
```bash
ping leetcode.com
curl -I https://leetcode.com/graphql
```

**3. Try with fewer concurrent requests**:
```bash
npm run dev -- scrape-list --concurrency 1
```

---

### Problem: "GraphQL errors"

**Symptoms**:
```
GraphQL errors: Cannot query field "xyz" on type "Problem"
```

**Cause**: LeetCode API schema changed.

**Solutions**:

**1. Update Lesca**:
```bash
git pull origin master
npm install
```

**2. Report the issue**:
Open an issue at https://github.com/yourusername/lesca/issues

---

## Browser Automation Issues

### Problem: "Chromium not found"

**Symptoms**:
```
Error: Chromium browser not found
```

**Cause**: Playwright browsers not installed.

**Solution**:

```bash
npx playwright install chromium
```

Or install all browsers:
```bash
npx playwright install
```

---

### Problem: "Browser launch failed"

**Symptoms**:
```
Error: Failed to launch browser
```

**Solutions**:

**1. Install browser dependencies** (Linux):
```bash
# Debian/Ubuntu
sudo apt-get install libnss3 libatk-bridge2.0-0 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2

# Or let Playwright install them
npx playwright install-deps chromium
```

**2. Use system browser**:
```yaml
browser:
  executable: /usr/bin/google-chrome
```

**3. Check permissions**:
```bash
# Linux
sudo chmod +x ~/.cache/ms-playwright/chromium-*/chrome-linux/chrome
```

---

### Problem: "Browser timeout"

**Symptoms**:
```
Error: Browser timeout after 30000ms
```

**Solutions**:

**1. Increase browser timeout**:
```yaml
browser:
  timeout: 60000  # 60 seconds
```

**2. Run in non-headless mode** (to see what's happening):
```bash
npm run dev -- scrape-editorial two-sum --no-headless
```

**3. Check page is loading**:
```bash
# Test manually
chromium https://leetcode.com/problems/two-sum/editorial
```

---

### Problem: "Page not found in browser"

**Symptoms**: Browser opens but shows 404 error.

**Cause**: Invalid problem slug.

**Solution**:

**1. Verify slug**:
```bash
# Go to https://leetcode.com/problems/{slug}
# Example: https://leetcode.com/problems/two-sum/
```

**2. Use correct format**:
```bash
# Good
npm run dev -- scrape-editorial two-sum

# Bad (spaces not allowed)
npm run dev -- scrape-editorial "two sum"
```

---

## Caching Problems

### Problem: "Stale cached data"

**Symptoms**: Scraping returns old/outdated content.

**Cause**: Cache TTL not expired.

**Solutions**:

**1. Clear cache**:
```bash
rm -rf ~/.lesca/cache
```

**2. Disable cache temporarily**:
```bash
npm run dev -- scrape two-sum --no-cache
```

**3. Reduce cache TTL**:
```yaml
cache:
  ttl:
    problem: 3600000  # 1 hour instead of 7 days
```

---

### Problem: "Cache taking too much space"

**Symptoms**: `~/.lesca/cache` directory very large.

**Solutions**:

**1. Clear old cache**:
```bash
rm -rf ~/.lesca/cache
```

**2. Reduce max cache size**:
```yaml
cache:
  maxSize: 104857600  # 100 MB
```

**3. Disable compression** (if using lots of CPU):
```yaml
cache:
  compression: false
```

---

### Problem: "Cache permission denied"

**Symptoms**:
```
Error: EACCES: permission denied, open '~/.lesca/cache/...'
```

**Solutions**:

**1. Fix permissions**:
```bash
chmod -R 755 ~/.lesca/cache
```

**2. Use different cache directory**:
```yaml
cache:
  directory: ./cache  # Local directory
```

---

## Configuration Issues

### Problem: "Configuration file not found"

**Symptoms**: Lesca uses defaults instead of your config.

**Solutions**:

**1. Check file exists**:
```bash
ls -la lesca.config.yaml
```

**2. Use explicit path**:
```bash
npm run dev -- --config ./lesca.config.yaml scrape two-sum
```

**3. Check file location**:
Lesca searches:
1. `./lesca.config.yaml`
2. `./lesca.config.yml`
3. `~/.lesca/config.yaml`

Place file in one of these locations.

---

### Problem: "Invalid YAML syntax"

**Symptoms**:
```
Error: Failed to parse configuration file
```

**Cause**: Syntax error in YAML file.

**Solutions**:

**1. Validate YAML**:
```bash
# Install yq
brew install yq  # macOS
apt-get install yq  # Linux

# Validate syntax
yq eval . lesca.config.yaml
```

**2. Common issues**:
- Use **spaces**, not tabs for indentation
- Add **colon + space** after keys: `key: value`
- Quote strings with special characters: `"value: with: colons"`

**3. Use JSON instead** (if YAML is problematic):
```bash
# Convert to JSON
yq eval -o json lesca.config.yaml > lesca.config.json
```

---

### Problem: "Environment variable not working"

**Symptoms**: Env var doesn't override config.

**Solutions**:

**1. Check variable name**:
```bash
# Correct
export LESCA_OUTPUT_FORMAT=obsidian

# Incorrect
export LESCA_FORMAT=obsidian
```

**2. Verify export**:
```bash
echo $LESCA_OUTPUT_FORMAT
```

**3. Export in same shell**:
```bash
# Same terminal session
export LESCA_OUTPUT_FORMAT=obsidian
npm run dev -- scrape two-sum
```

**4. Use .env file** (if supported):
```bash
# .env
LESCA_OUTPUT_FORMAT=obsidian
LESCA_CONCURRENCY=5
```

---

## Performance Issues

### Problem: "Scraping is very slow"

**Symptoms**: Taking hours to scrape 100 problems.

**Solutions**:

**1. Increase concurrency**:
```bash
npm run dev -- scrape-list --concurrency 5
```

**2. Reduce delays**:
```yaml
scraping:
  delay: 500  # Reduce from 1000ms
```

**3. Enable caching**:
```yaml
cache:
  enabled: true
  memorySize: 100
```

**4. Block more resources** (for browser scraping):
```yaml
browser:
  blockedResources:
    - image
    - font
    - media
    - stylesheet
    - script  # If not needed
```

**5. Use headless mode**:
```yaml
browser:
  headless: true
```

---

### Problem: "High memory usage"

**Symptoms**: Node process using excessive RAM.

**Solutions**:

**1. Reduce cache memory size**:
```yaml
cache:
  memorySize: 20  # Reduce from 50
```

**2. Reduce concurrency**:
```bash
npm run dev -- scrape-list --concurrency 2
```

**3. Process in batches**:
```bash
# Instead of scraping 1000 at once
npm run dev -- scrape-list --limit 100
# Repeat in batches
```

**4. Close browser between scrapes**:
Lesca should do this automatically, but report if you see memory leaks.

---

### Problem: "High CPU usage"

**Symptoms**: CPU at 100% during scraping.

**Solutions**:

**1. Disable cache compression**:
```yaml
cache:
  compression: false
```

**2. Reduce concurrency**:
```bash
npm run dev -- scrape-list --concurrency 2
```

**3. Use headless browser**:
```yaml
browser:
  headless: true
```

---

## Output Problems

### Problem: "Output files not created"

**Symptoms**: Scraping succeeds but no files in output directory.

**Solutions**:

**1. Check output directory**:
```bash
ls -la ./output
```

**2. Verify permissions**:
```bash
chmod 755 ./output
```

**3. Check disk space**:
```bash
df -h
```

**4. Use absolute path**:
```bash
npm run dev -- scrape two-sum --output /full/path/to/output
```

---

### Problem: "Filename collisions"

**Symptoms**: Files overwriting each other.

**Cause**: Multiple problems with same slug.

**Solution**:

**Use ID in filename pattern**:
```yaml
output:
  pattern: "{id}-{slug}.md"
  # Example: 1-two-sum.md, 15-3sum.md
```

---

### Problem: "Markdown formatting issues"

**Symptoms**: Broken links, formatting in output.

**Solutions**:

**1. Try different output format**:
```bash
npm run dev -- scrape two-sum --format obsidian
```

**2. Check converter options**:
```yaml
processing:
  options:
    codeBlockStyle: fenced  # Use ``` instead of indented
    bulletListMarker: '-'   # Use - instead of *
```

**3. Report formatting issues**:
Open issue with example problem slug.

---

### Problem: "Images not downloading"

**Symptoms**: Image links instead of local images.

**Cause**: Image download not enabled.

**Solution**:

```yaml
output:
  images:
    download: true
    directory: images
```

---

## Installation Issues

See [Installation Guide - Troubleshooting](./INSTALLATION.md#troubleshooting-installation) for:
- npm install failures
- Node version issues
- Permission errors
- Playwright installation
- Platform-specific issues

---

## General Debugging

### Enable Debug Logging

```yaml
logging:
  level: debug
  output: both
  file: ./lesca-debug.log
```

```bash
npm run dev -- scrape two-sum
cat lesca-debug.log
```

### Check Lesca Version

```bash
npm run dev -- --version
```

### Verify Installation

```bash
# Check Node/npm versions
node --version
npm --version

# Run tests
npm test

# Check dependencies
npm list
```

### Reset to Defaults

```bash
# Remove config
rm lesca.config.yaml

# Clear cache
rm -rf ~/.lesca/cache

# Reinitialize
npm run dev -- init
```

---

## Common Error Messages

### "Cannot find module"

**Error**:
```
Error: Cannot find module '@lesca/shared-types'
```

**Solution**:
```bash
npm install
```

### "ENOENT: no such file or directory"

**Error**:
```
ENOENT: no such file or directory, open './output/two-sum.md'
```

**Solution**:
```bash
mkdir -p ./output
npm run dev -- scrape two-sum
```

### "Port already in use"

**Error**:
```
Error: Port 9222 is already in use
```

**Solution**:
```bash
# Kill existing Chrome processes
pkill chrome
pkill chromium

# Or use different port (if configuration exists for it)
```

### "Unexpected token"

**Error**:
```
SyntaxError: Unexpected token < in JSON
```

**Cause**: Receiving HTML instead of JSON (often means not authenticated).

**Solution**: Refresh authentication cookies.

---

## Reporting Bugs

If you've tried everything and still have issues:

### 1. Gather Information

```bash
# System info
node --version
npm --version
uname -a  # Linux/macOS

# Lesca version
npm run dev -- --version

# Error output with debug logging
npm run dev -- scrape two-sum > debug-output.txt 2>&1
```

### 2. Create Minimal Reproduction

```bash
# Minimal config
cat > lesca.config.yaml <<EOF
storage:
  path: ./output
output:
  format: markdown
EOF

# Test with simple command
npm run dev -- scrape two-sum
```

### 3. Open GitHub Issue

Go to: https://github.com/yourusername/lesca/issues

Include:
- Lesca version
- Node version
- OS and version
- Complete error message
- Configuration file (remove sensitive data)
- Steps to reproduce

---

## Getting Help

### Documentation

- [User Guide](./USER_GUIDE.md) - Comprehensive usage guide
- [Installation Guide](./INSTALLATION.md) - Installation help
- [CLI Reference](./CLI_REFERENCE.md) - Command reference
- [Configuration Guide](./CONFIGURATION.md) - All configuration options

### Community

- GitHub Issues: Report bugs and request features
- Discussions: Ask questions and share tips

### Before Asking

1. **Search existing issues**: Your question may be answered
2. **Read documentation**: Check relevant guide
3. **Try debugging steps**: Enable debug logging
4. **Create minimal example**: Isolate the problem

### Good Question Format

```
## Problem
Brief description of issue

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Steps to Reproduce
1. Step 1
2. Step 2
3. ...

## Environment
- Lesca version: 0.1.0
- Node version: 18.0.0
- OS: Ubuntu 22.04

## Configuration
```yaml
# Your config (remove sensitive data)
```

## Error Output
```
# Full error message
```
```

---

## Quick Reference

### Most Common Issues

| Issue | Quick Fix |
|-------|-----------|
| Auth failed | Refresh cookies from browser |
| Rate limited | Reduce concurrency: `--concurrency 2` |
| Browser timeout | Increase timeout in config |
| Cache stale | Clear cache: `rm -rf ~/.lesca/cache` |
| Config not loading | Use `--config ./lesca.config.yaml` |
| Slow scraping | Increase concurrency: `--concurrency 5` |
| Files not created | Check permissions: `chmod 755 ./output` |

### Emergency Reset

```bash
# Nuclear option: Reset everything
rm -rf ~/.lesca
rm lesca.config.yaml
rm .lesca-progress.json
rm -rf output/
npm run dev -- init
```

---

**Still having issues?** Open an issue on GitHub with detailed information!
