# GitHub Repository Setup Guide

## Pre-Push Checklist

Before pushing to GitHub for the first time, ensure:

### 1. Sensitive Data Protection ✅
- [x] `.gitignore` files created (root, backend, frontend)
- [x] `.env` file is excluded
- [x] Database files are excluded
- [x] `*.ionapi` files are excluded
- [x] Uploaded files are excluded
- [x] Temporary files are excluded

### 2. Documentation ✅
- [x] README.md updated for web application
- [x] SECURITY.md created
- [x] LICENSE file (add if needed)
- [x] CONTRIBUTING.md (optional)

### 3. Clean Workspace ✅
- [x] Temporary files moved to temp/
- [x] No sensitive data in commit history
- [x] No real customer data in Import_Files/

## Initial Repository Setup

### Step 1: Verify .gitignore

```bash
# Check what will be committed
git status

# Verify sensitive files are ignored
git check-ignore backend/.env
git check-ignore backend/fsm_workbench.db
git check-ignore Van_Test.ionapi

# Should output the file paths if properly ignored
```

### Step 2: Initialize Git (if not already done)

```bash
# Initialize repository
git init

# Add all files
git add .

# Check what's staged
git status

# Verify no sensitive files are staged
git diff --cached --name-only | grep -E '\.(env|db|ionapi)$'
# Should return nothing
```

### Step 3: Create Initial Commit

```bash
# Create initial commit
git commit -m "Initial commit: FSM Conversion Workbench web application

- FastAPI backend with SQLAlchemy ORM
- React frontend with TypeScript
- JWT authentication
- Encrypted credential storage
- Setup data management (12 FSM classes)
- Schema fetching (local swagger + FSM API)
- Streaming CSV processing
- Real-time validation
- Batch loading to FSM

Status: 87% complete (20/23 tasks), demo-ready"
```

### Step 4: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `fsm-conversion-workbench` (or your choice)
3. Description: "Web application for Infor FSM data conversion, validation, and loading"
4. Visibility: **Private** (recommended for enterprise tools)
5. Do NOT initialize with README (we already have one)
6. Click "Create repository"

### Step 5: Connect and Push

```bash
# Add remote
git remote add origin https://github.com/YOUR_USERNAME/fsm-conversion-workbench.git

# Verify remote
git remote -v

# Push to GitHub
git push -u origin main
# or if using master branch:
git push -u origin master
```

## Repository Settings

### 1. Branch Protection

Protect the main branch:

1. Go to Settings → Branches
2. Add rule for `main` branch
3. Enable:
   - Require pull request reviews before merging
   - Require status checks to pass
   - Require branches to be up to date

### 2. Secrets Management

Add secrets for CI/CD (if using GitHub Actions):

1. Go to Settings → Secrets and variables → Actions
2. Add repository secrets:
   - `JWT_SECRET_KEY`
   - `ENCRYPTION_KEY`
   - `FSM_CLIENT_ID` (if needed for testing)
   - `FSM_CLIENT_SECRET` (if needed for testing)

### 3. Security Alerts

Enable security features:

1. Go to Settings → Security & analysis
2. Enable:
   - Dependency graph
   - Dependabot alerts
   - Dependabot security updates
   - Secret scanning (if available)

## .gitignore Verification

### Files That MUST Be Ignored

Run these checks before pushing:

```bash
# Check if sensitive files are tracked
git ls-files | grep -E '\.(env|db|ionapi)$'
# Should return nothing

# Check if temp directories are tracked
git ls-files | grep '^temp/'
# Should return nothing

# Check if uploads are tracked
git ls-files | grep '^backend/uploads/.*\.csv$'
# Should return nothing (except .gitkeep)
```

### Files That SHOULD Be Tracked

Verify important files are included:

```bash
# Check documentation
git ls-files | grep '\.md$'

# Check source code
git ls-files | grep -E '\.(py|ts|tsx)$'

# Check configuration templates
git ls-files | grep '\.example$'

# Check swagger files (organized in Setup/ and Conversion/ folders)
git ls-files | grep 'FSM_Swagger/.*\.json$'
```

## Recommended Repository Structure

```
fsm-conversion-workbench/
├── .github/
│   ├── workflows/          # GitHub Actions (optional)
│   └── ISSUE_TEMPLATE/     # Issue templates (optional)
├── .gitignore              ✅ Created
├── README.md               ✅ Updated
├── SECURITY.md             ✅ Created
├── LICENSE                 ⏳ Add if needed
├── CONTRIBUTING.md         ⏳ Optional
├── backend/
│   ├── .gitignore          ✅ Created
│   ├── .env.example        ✅ Exists
│   └── ...
├── frontend/
│   ├── .gitignore          ✅ Created
│   └── ...
└── ...
```

## Post-Push Verification

After pushing to GitHub:

### 1. Check Repository

1. Visit your repository on GitHub
2. Verify README.md displays correctly
3. Check that sensitive files are NOT visible
4. Verify folder structure is correct

### 2. Clone Test

Test cloning in a new directory:

```bash
# Clone to new location
cd /tmp
git clone https://github.com/YOUR_USERNAME/fsm-conversion-workbench.git
cd fsm-conversion-workbench

# Verify .env is NOT present
ls backend/.env
# Should show: No such file or directory

# Verify .gitignore is working
cat .gitignore
```

### 3. Setup Test

Test that new developers can set up:

```bash
# Copy .env.example
cp backend/.env.example backend/.env

# Edit .env with actual values
# (Don't commit this!)

# Install and run
cd backend
pip install -r requirements.txt
python init_db.py
```

## Collaboration Workflow

### For Team Members

1. **Clone Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/fsm-conversion-workbench.git
   cd fsm-conversion-workbench
   ```

2. **Setup Environment**
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   # Edit backend/.env with actual credentials
   
   cd backend
   pip install -r requirements.txt
   python init_db.py
   
   # Frontend
   cd ../frontend
   npm install --legacy-peer-deps
   ```

3. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make Changes and Commit**
   ```bash
   git add .
   git commit -m "Description of changes"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create Pull Request on GitHub
   ```

## Common Issues

### Issue: Accidentally Committed .env

**Solution:**
```bash
# Remove from git but keep local file
git rm --cached backend/.env

# Commit the removal
git commit -m "Remove .env from git"

# Push
git push
```

### Issue: Database File Committed

**Solution:**
```bash
# Remove from git
git rm --cached backend/fsm_workbench.db

# Commit
git commit -m "Remove database from git"

# Push
git push
```

### Issue: Large Files

If you have large files (>100MB):

```bash
# Use Git LFS
git lfs install
git lfs track "*.db"
git add .gitattributes
git commit -m "Add Git LFS tracking"
```

## Maintenance

### Regular Tasks

**Weekly:**
- Review open pull requests
- Update dependencies
- Check security alerts

**Monthly:**
- Review and update documentation
- Clean up old branches
- Update .gitignore if needed

**Quarterly:**
- Security audit
- Dependency updates
- Performance review

## Additional Resources

- [GitHub Docs](https://docs.github.com/)
- [Git Best Practices](https://git-scm.com/book/en/v2)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Status**: Ready for GitHub  
**Last Updated**: March 1, 2026  
**Sensitive Data**: Protected ✅
