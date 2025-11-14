# Lesca Installation Guide

This guide covers all the ways to install and set up Lesca on your system.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
  - [From Source (Development)](#from-source-development)
  - [npm Package (Coming Soon)](#npm-package-coming-soon)
  - [Binary Releases (Coming Soon)](#binary-releases-coming-soon)
  - [Docker (Coming Soon)](#docker-coming-soon)
- [Post-Installation Setup](#post-installation-setup)
- [Verification](#verification)
- [Updating](#updating)
- [Uninstallation](#uninstallation)

---

## Prerequisites

### Required

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Optional

- **Git** (for source installation)
- **Docker** (for Docker installation)

### Check Your Versions

```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be 9.0.0 or higher
```

### Installing Node.js

If you don't have Node.js or need to upgrade:

#### macOS

```bash
# Using Homebrew
brew install node@18

# Or using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

#### Linux

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Or using package manager
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Fedora
sudo dnf install nodejs
```

#### Windows

1. Download from [nodejs.org](https://nodejs.org/)
2. Run the installer
3. Verify installation:
   ```cmd
   node --version
   npm --version
   ```

---

## Installation Methods

### From Source (Development)

**Best for**: Developers, contributors, or users who want the latest features.

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/lesca.git
cd lesca
```

#### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies for all packages in the monorepo.

#### 3. Build the Project (Optional)

```bash
# Build all packages
npm run build

# Or run in development mode (no build needed)
npm run dev -- --help
```

#### 4. Verify Installation

```bash
# Check if CLI works
npm run dev -- --version

# Should output: 0.1.0
```

#### 5. Run Tests (Optional)

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

---

### npm Package (Coming Soon)

**Best for**: Users who want a simple, global installation.

**Status**: Not yet published to npm registry. Coming in v1.0 release.

**Planned usage**:

```bash
# Global installation
npm install -g lesca

# Local installation
npm install lesca

# Run globally
lesca scrape two-sum

# Run locally
npx lesca scrape two-sum
```

---

### Binary Releases (Coming Soon)

**Best for**: Users who don't want to install Node.js.

**Status**: Binary builds planned for v1.0 release.

**Planned platforms**:
- Windows (x64)
- macOS (x64, arm64)
- Linux (x64, arm64)

**Planned usage**:

```bash
# Download binary
wget https://github.com/yourusername/lesca/releases/download/v1.0.0/lesca-linux-x64

# Make executable
chmod +x lesca-linux-x64

# Run
./lesca-linux-x64 scrape two-sum

# Or install globally
sudo mv lesca-linux-x64 /usr/local/bin/lesca
lesca scrape two-sum
```

---

### Docker (Coming Soon)

**Best for**: Users who prefer containerized applications.

**Status**: Docker image planned for v1.0 release.

**Planned usage**:

```bash
# Pull image
docker pull lesca/lesca:latest

# Run Lesca
docker run -v $(pwd)/output:/output lesca/lesca scrape two-sum

# With custom config
docker run -v $(pwd)/lesca.config.yaml:/config.yaml \
           -v $(pwd)/output:/output \
           lesca/lesca scrape two-sum --config /config.yaml
```

**Planned docker-compose.yml**:

```yaml
version: '3.8'
services:
  lesca:
    image: lesca/lesca:latest
    volumes:
      - ./output:/output
      - ./lesca.config.yaml:/config.yaml
      - ~/.lesca/cookies.json:/cookies.json
    environment:
      - LESCA_OUTPUT_PATH=/output
      - LESCA_COOKIE_PATH=/cookies.json
```

---

## Post-Installation Setup

After installing Lesca, complete these setup steps:

### 1. Initialize Configuration

```bash
npm run dev -- init
```

This creates:
- Configuration file: `./lesca.config.yaml`
- Config directory: `~/.lesca/`
- Cache directory: `~/.lesca/cache/`
- Example cookie file: `~/.lesca/cookies.example.json`

### 2. Set Up Authentication

See [User Guide - Authentication Setup](./USER_GUIDE.md#authentication-setup) for detailed instructions.

**Quick setup**:

1. Log into LeetCode in your browser
2. Export cookies using a browser extension
3. Save to `~/.lesca/cookies.json`

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

### 3. Install Playwright Browsers (Optional)

Required for scraping editorials and discussions:

```bash
npx playwright install chromium
```

This downloads Chromium browser for browser automation.

### 4. Configure Your Preferences

Edit `lesca.config.yaml` to customize:

```yaml
# Example customizations
output:
  format: obsidian      # or 'markdown'

storage:
  path: ./my-problems   # Custom output directory

scraping:
  concurrency: 5        # Increase for faster scraping

cache:
  enabled: true         # Enable caching
```

See [Configuration Guide](./CONFIGURATION.md) for all options.

---

## Verification

### Test Your Installation

Run these commands to verify everything works:

#### 1. Check Version

```bash
npm run dev -- --version
# Expected: 0.1.0
```

#### 2. Check Help

```bash
npm run dev -- --help
# Should display available commands
```

#### 3. Test Scraping (No Auth)

```bash
# Try scraping a public problem
npm run dev -- scrape two-sum --no-auth
```

**Expected output**:
```
✔ Running without authentication
✔ Problem scraped successfully!
   Saved to: ./output/two-sum.md
```

#### 4. Test with Authentication

```bash
# After setting up cookies
npm run dev -- scrape two-sum
```

**Expected output**:
```
✔ Authentication loaded
✔ Problem scraped successfully!
   Saved to: ./output/two-sum.md
```

#### 5. Run Tests (Source Installation Only)

```bash
npm test
# Expected: All tests should pass
```

---

## Updating

### Update Source Installation

```bash
# Pull latest changes
git pull origin master

# Install new dependencies
npm install

# Rebuild if necessary
npm run build
```

### Update npm Package (When Available)

```bash
# Global update
npm update -g lesca

# Local update
npm update lesca
```

### Check for Updates

```bash
# Check current version
npm run dev -- --version

# Check latest version on npm (when published)
npm view lesca version
```

---

## Uninstallation

### Remove Source Installation

```bash
# Navigate to lesca directory
cd lesca

# Remove node_modules
rm -rf node_modules

# Remove generated files
npm run clean

# Remove entire directory
cd ..
rm -rf lesca
```

### Remove Configuration and Data

```bash
# Remove config directory
rm -rf ~/.lesca

# Remove local config files
rm -f lesca.config.yaml
rm -f .lesca-progress.json

# Remove output (if default location)
rm -rf ./output
```

### Uninstall npm Package (When Available)

```bash
# Global uninstall
npm uninstall -g lesca

# Local uninstall
npm uninstall lesca
```

### Remove Docker (When Available)

```bash
# Remove image
docker rmi lesca/lesca:latest

# Remove volumes
docker volume prune
```

---

## Troubleshooting Installation

### Issue: `npm install` Fails

**Error**:
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Delete package-lock.json and node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

---

### Issue: Node.js Version Too Old

**Error**:
```
error: The engine "node" is incompatible with this module
```

**Solution**:
```bash
# Check your Node version
node --version

# Upgrade to Node 18 or higher using nvm
nvm install 18
nvm use 18

# Or update via package manager
```

---

### Issue: Permission Errors on Linux/macOS

**Error**:
```
EACCES: permission denied
```

**Solution**:
```bash
# Don't use sudo with npm!
# Instead, configure npm to use a different directory:

mkdir ~/.npm-global
npm config set prefix '~/.npm-global'

# Add to ~/.bashrc or ~/.zshrc:
export PATH=~/.npm-global/bin:$PATH

# Reload shell
source ~/.bashrc  # or source ~/.zshrc
```

---

### Issue: Playwright Installation Fails

**Error**:
```
Failed to download Chromium
```

**Solution**:
```bash
# Install Chromium manually
npx playwright install chromium --force

# Or install all browsers
npx playwright install

# If behind a proxy, set environment variable:
export HTTPS_PROXY=http://proxy.example.com:8080
npx playwright install chromium
```

---

### Issue: TypeScript Compilation Errors

**Error**:
```
TSError: ⨯ Unable to compile TypeScript
```

**Solution**:
```bash
# Make sure TypeScript is installed
npm install

# Check TypeScript version
npx tsc --version

# Try running without build (development mode)
npm run dev -- scrape two-sum
```

---

## Platform-Specific Notes

### Windows

**PowerShell Execution Policy**:

If you get errors running npm scripts:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Path Separators**:

Use forward slashes or escaped backslashes:
```bash
# Good
npm run dev -- scrape two-sum --output ./output

# Also good
npm run dev -- scrape two-sum --output .\\output
```

---

### macOS

**Xcode Command Line Tools**:

Some dependencies may require Xcode tools:
```bash
xcode-select --install
```

**Gatekeeper Issues**:

If you get security warnings with binaries (future releases):
```bash
xattr -d com.apple.quarantine lesca-macos-x64
```

---

### Linux

**Missing Dependencies**:

Install build essentials if needed:
```bash
# Debian/Ubuntu
sudo apt-get install build-essential

# Fedora/RHEL
sudo dnf groupinstall "Development Tools"
```

**Library Dependencies**:

Playwright may need additional libraries:
```bash
# Debian/Ubuntu
sudo apt-get install libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2

# Or let Playwright install them:
npx playwright install-deps chromium
```

---

## Next Steps

After installation:

1. **Read the User Guide**: [USER_GUIDE.md](./USER_GUIDE.md)
2. **Configure Lesca**: [CONFIGURATION.md](./CONFIGURATION.md)
3. **Try Examples**: See [examples/](../examples/) directory
4. **Explore CLI Commands**: [CLI_REFERENCE.md](./CLI_REFERENCE.md)

**Welcome to Lesca!** 🎉
