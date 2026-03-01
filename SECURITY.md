# Security Guidelines

## Overview

This document outlines security practices for the FSM Conversion Workbench to protect sensitive data and credentials.

## ⚠️ NEVER COMMIT TO GIT

The following files contain sensitive information and must NEVER be committed to version control:

### 1. Credentials and API Keys
- `*.ionapi` - FSM ION API credentials
- `Van_Test.ionapi` - Test credentials
- `backend/.env` - Environment variables with secrets

### 2. Database Files
- `backend/fsm_workbench.db` - Contains encrypted credentials and user data
- `*.db`, `*.sqlite`, `*.sqlite3` - Any SQLite database files

### 3. Uploaded Files
- `backend/uploads/*` - User uploaded CSV files (may contain customer data)
- `Import_Files/*.csv` - Real data files (except *_DEMO.csv and *_SAMPLE.csv)

### 4. Logs
- `*.log` - May contain sensitive information in error messages

## ✅ Safe to Commit

The following are safe to commit:

### 1. Code
- All Python source files (`*.py`)
- All TypeScript/React files (`*.ts`, `*.tsx`)
- Configuration files (without secrets)

### 2. Documentation
- All markdown files (`*.md`)
- Steering files (`.kiro/steering/*.md`)
- User guides and setup instructions

### 3. Sample Data
- Demo files (`*_DEMO.csv`)
- Sample files (`*_SAMPLE.csv`)
- Swagger files (`FSM_Swagger/*.json`)

### 4. Configuration Templates
- `backend/.env.example` - Template without actual secrets
- Package files (`package.json`, `requirements.txt`)

## 🔐 Encryption

### FSM Credentials
FSM credentials are encrypted using Fernet (symmetric encryption) before storing in the database:

```python
from cryptography.fernet import Fernet

# Generate encryption key (do this once)
key = Fernet.generate_key()
# Store in .env as ENCRYPTION_KEY

# Encrypt credentials
cipher = Fernet(key)
encrypted = cipher.encrypt(credentials.encode())
```

### JWT Tokens
JWT tokens are signed using HS256 algorithm:

```python
# Generate secret key (do this once)
import secrets
secret = secrets.token_urlsafe(32)
# Store in .env as JWT_SECRET_KEY
```

## 🛡️ Security Best Practices

### 1. Environment Variables
- Never hardcode secrets in code
- Use `.env` file for local development
- Use environment variables in production
- Keep `.env.example` updated (without actual secrets)

### 2. Database Security
- Database file is excluded from git
- Credentials are encrypted before storage
- Account-level data isolation enforced
- Parameterized queries prevent SQL injection

### 3. API Security
- JWT authentication required for all endpoints
- Tokens expire after 8 hours
- CORS configured for localhost only
- No eval() or dynamic code execution

### 4. File Upload Security
- Only CSV files accepted
- File type validation enforced
- Uploaded files stored outside web root
- Files are account-isolated

### 5. Password Security
- Bcrypt hashing with cost factor 12
- No password storage in logs
- Password reset requires email verification (future)

## 🚨 If Secrets Are Exposed

If you accidentally commit sensitive data:

### 1. Immediate Actions
```bash
# Remove file from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/sensitive/file" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (if already pushed)
git push origin --force --all
```

### 2. Rotate Credentials
- Generate new JWT_SECRET_KEY
- Generate new ENCRYPTION_KEY
- Update FSM credentials
- Notify team members

### 3. Review Access
- Check who had access to the repository
- Review git history for other exposures
- Update security policies

## 📋 Pre-Commit Checklist

Before committing, verify:

- [ ] No `.env` files
- [ ] No `*.ionapi` files
- [ ] No `*.db` files
- [ ] No real customer data in CSV files
- [ ] No credentials in code comments
- [ ] No API keys in configuration files
- [ ] No sensitive data in logs

## 🔍 Scanning for Secrets

Use git-secrets or similar tools:

```bash
# Install git-secrets
brew install git-secrets  # macOS
# or download from: https://github.com/awslabs/git-secrets

# Initialize
git secrets --install
git secrets --register-aws

# Add custom patterns
git secrets --add 'JWT_SECRET_KEY.*'
git secrets --add 'ENCRYPTION_KEY.*'
git secrets --add '\.ionapi$'

# Scan repository
git secrets --scan
```

## 📞 Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** create a public GitHub issue
2. Email the security team directly
3. Include detailed description and steps to reproduce
4. Allow time for fix before public disclosure

## 🔄 Regular Security Reviews

### Monthly
- Review access logs
- Check for exposed credentials
- Update dependencies
- Review .gitignore effectiveness

### Quarterly
- Rotate encryption keys
- Update JWT secrets
- Security audit of codebase
- Penetration testing

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Python Security Best Practices](https://python.readthedocs.io/en/stable/library/security_warnings.html)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Last Updated**: March 1, 2026  
**Version**: 1.0  
**Maintainer**: Development Team
