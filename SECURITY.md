# Security Policy

## Overview

Lesca is a local development tool designed for personal use. This document outlines security considerations, best practices, and our approach to handling security issues.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Security Model

### Trust Model

Lesca is a **local CLI tool** that operates under a trust-based security model:

- Users control what code runs via configuration
- Similar trust level to npm scripts, webpack plugins, or VS Code extensions
- No remote code execution or untrusted third-party services

### Data Handling

**Sensitive Data**:

- Authentication cookies stored in local JSON files
- No data transmitted to external services (except LeetCode.com)
- All logging automatically sanitizes sensitive data

**File System Access**:

- Tool operates within user-specified output directories
- Configuration files stored in user's home directory (`~/.lesca/`)
- No system-wide modifications

## Best Practices

### 1. Cookie File Security

Cookie files contain authentication data. Protect them:

```bash
# Set restrictive permissions
chmod 600 ~/.lesca/cookies.json

# Never commit to version control
echo "cookies.json" >> .gitignore
```

**What's in cookie files**:

- LeetCode session cookies
- CSRF tokens
- Stored in plaintext JSON (by design for this use case)

### 2. Plugin Security

**⚠️ IMPORTANT: Only use trusted plugins**

Plugins have full Node.js API access and can:

- Read/write files anywhere on your system
- Make network requests
- Execute arbitrary code
- Access environment variables

**Before using a plugin**:

1. ✅ Review the plugin source code
2. ✅ Verify the author/publisher
3. ✅ Check 3rd-party dependencies
4. ✅ Read user reviews/issues

**Built-in Protections**:

- Path traversal validation (prevents `../` in plugin paths)
- Interface validation (ensures plugins export required fields)

### 3. Configuration Files

**Secure your `lesca.config.yaml`**:

```yaml
# ❌ DON'T: Store secrets directly
auth:
  cookiePath: '/path/to/cookies.json' # ✅ Reference file path instead

# ✅ DO: Use environment variables for sensitive data
environment:
  LEETCODE_SESSION: ${LEETCODE_SESSION}
```

### 4. Environment Variables

If using environment variables for authentication:

```bash
# Add to .env (and add .env to .gitignore)
LEETCODE_SESSION=your_session_here
CSRFTOKEN=your_csrf_here

# Load with:
source .env && lesca scrape
```

### 5. Logging

**Debug mode safely**:

```bash
# Debug logs are sanitized by default
lesca --debug scrape two-sum

# Sensitive data automatically redacted:
# - Cookies → [REDACTED]
# - Tokens → [REDACTED]
# - Passwords → [REDACTED]
```

**Log files** (if enabled):

- Stored in `./lesca.log` by default
- Automatically rotated at 10MB
- Sanitization enabled by default

## Potential Risks

### Medium Risk: Plugin System

**Risk**: Malicious plugins can execute arbitrary code.

**Mitigation**:

- User explicitly configures plugins in `lesca.config.yaml`
- Document trust requirement
- Code review recommended before use

**Future Enhancements**:

- Plugin capability permissions system
- `--allow-plugins` explicit consent flag
- Plugin sandbox/isolation

### Low Risk: Path Traversal

**Risk**: Plugin paths could reference parent directories.

**Mitigation**: ✅ Implemented path validation (v0.2.0+)

### Low Risk: Cookie Storage

**Risk**: Cookies stored in plaintext JSON files.

**Mitigation**:

- File system permissions (user's responsibility)
- Cookies never logged or transmitted externally
- Documentation provided

**Note**: This is standard for local development tools (similar to git credentials, npm tokens, etc.)

## Reporting a Vulnerability

### Responsible Disclosure

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. **Email**: [Your Security Contact Email]
   Subject: `[SECURITY] Lesca Vulnerability Report`

3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if known)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: Next release

### Recognition

We appreciate security researchers and will:

- Credit you in release notes (if desired)
- Keep you informed throughout the fix process
- Work with you to verify the fix

## Security Audit

Last security audit: December 2025

**Findings**: 0 critical, 0 high, 1 medium, 2 low issues
**Report**: See `docs/security_audit.md` (for contributors)

## Dependencies

We regularly monitor dependencies for vulnerabilities:

- `npm audit` run on every PR (CI/CD)
- Dependabot alerts enabled
- Regular dependency updates

**Current Status**: ✅ 0 known vulnerabilities

## Additional Resources

- [LEGAL.md](./LEGAL.md) - Terms of Service compliance
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guidelines
- [README.md](./README.md) - General documentation

---

**Last Updated**: December 2025
**Version**: v0.2.0
