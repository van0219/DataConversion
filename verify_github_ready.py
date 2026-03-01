#!/usr/bin/env python3
"""
GitHub Readiness Verification Script

This script verifies that the repository is ready for GitHub by checking:
1. Sensitive files are properly ignored
2. Required documentation exists
3. No credentials in tracked files
4. .gitignore is working correctly
"""

import os
import subprocess
import sys
from pathlib import Path

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_header(text):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}{text}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

def print_success(text):
    print(f"{GREEN}✅ {text}{RESET}")

def print_error(text):
    print(f"{RED}❌ {text}{RESET}")

def print_warning(text):
    print(f"{YELLOW}⚠️  {text}{RESET}")

def print_info(text):
    print(f"{BLUE}ℹ️  {text}{RESET}")

def check_git_initialized():
    """Check if git is initialized"""
    print_header("1. Checking Git Initialization")
    
    if not os.path.exists('.git'):
        print_error("Git not initialized")
        print_info("Run: git init")
        return False
    
    print_success("Git repository detected")
    return True

def check_gitignore_exists():
    """Check if .gitignore files exist"""
    print_header("2. Checking .gitignore Files")
    
    gitignore_files = [
        '.gitignore',
        'backend/.gitignore',
        'frontend/.gitignore'
    ]
    
    all_exist = True
    for gitignore in gitignore_files:
        if os.path.exists(gitignore):
            print_success(f"{gitignore} exists")
        else:
            print_error(f"{gitignore} missing")
            all_exist = False
    
    return all_exist

def check_sensitive_files_ignored():
    """Check if sensitive files are properly ignored"""
    print_header("3. Checking Sensitive Files Are Ignored")
    
    sensitive_files = [
        'backend/.env',
        'backend/fsm_workbench.db',
        'Van_Test.ionapi',
        'backend/uploads/test.csv',  # Test pattern
    ]
    
    all_ignored = True
    for file_path in sensitive_files:
        if os.path.exists(file_path):
            try:
                result = subprocess.run(
                    ['git', 'check-ignore', file_path],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    print_success(f"{file_path} is ignored")
                else:
                    print_error(f"{file_path} is NOT ignored!")
                    all_ignored = False
            except Exception as e:
                print_warning(f"Could not check {file_path}: {e}")
        else:
            print_info(f"{file_path} does not exist (OK)")
    
    return all_ignored

def check_no_sensitive_files_tracked():
    """Check if any sensitive files are tracked by git"""
    print_header("4. Checking No Sensitive Files Are Tracked")
    
    try:
        result = subprocess.run(
            ['git', 'ls-files'],
            capture_output=True,
            text=True
        )
        
        tracked_files = result.stdout.split('\n')
        
        sensitive_patterns = ['.env', '.db', '.ionapi', '.sqlite']
        found_sensitive = []
        
        for file in tracked_files:
            for pattern in sensitive_patterns:
                if pattern in file and '.example' not in file:
                    found_sensitive.append(file)
        
        if found_sensitive:
            print_error("Found sensitive files tracked by git:")
            for file in found_sensitive:
                print(f"  - {file}")
            return False
        else:
            print_success("No sensitive files tracked by git")
            return True
            
    except Exception as e:
        print_warning(f"Could not check tracked files: {e}")
        return True

def check_required_documentation():
    """Check if required documentation exists"""
    print_header("5. Checking Required Documentation")
    
    required_docs = [
        'README.md',
        'SECURITY.md',
        'GITHUB_SETUP.md',
        'backend/.env.example',
        'QUICK_START.md',
        'SETUP_GUIDE.md'
    ]
    
    all_exist = True
    for doc in required_docs:
        if os.path.exists(doc):
            print_success(f"{doc} exists")
        else:
            print_error(f"{doc} missing")
            all_exist = False
    
    return all_exist

def check_temp_directories_ignored():
    """Check if temp directories are ignored"""
    print_header("6. Checking Temp Directories Are Ignored")
    
    temp_dirs = ['temp', 'backend/temp']
    
    all_ignored = True
    for temp_dir in temp_dirs:
        if os.path.exists(temp_dir):
            try:
                result = subprocess.run(
                    ['git', 'check-ignore', temp_dir],
                    capture_output=True,
                    text=True
                )
                if result.returncode == 0:
                    print_success(f"{temp_dir}/ is ignored")
                else:
                    print_error(f"{temp_dir}/ is NOT ignored!")
                    all_ignored = False
            except Exception as e:
                print_warning(f"Could not check {temp_dir}: {e}")
        else:
            print_info(f"{temp_dir}/ does not exist")
    
    return all_ignored

def check_env_example_no_secrets():
    """Check if .env.example has no real secrets"""
    print_header("7. Checking .env.example Has No Secrets")
    
    env_example = 'backend/.env.example'
    
    if not os.path.exists(env_example):
        print_error(f"{env_example} does not exist")
        return False
    
    with open(env_example, 'r') as f:
        content = f.read()
    
    # Check for placeholder values
    suspicious_patterns = [
        'TAMICS10',
        'mingle-ionapi',
        'mingle-sso',
        '@infor.com'
    ]
    
    found_suspicious = []
    for pattern in suspicious_patterns:
        if pattern in content:
            found_suspicious.append(pattern)
    
    if found_suspicious:
        print_warning(f"{env_example} may contain real values:")
        for pattern in found_suspicious:
            print(f"  - Found: {pattern}")
        return False
    else:
        print_success(f"{env_example} looks safe (no real values detected)")
        return True

def main():
    """Run all checks"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}GitHub Readiness Verification{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    
    checks = [
        ("Git Initialized", check_git_initialized),
        (".gitignore Files Exist", check_gitignore_exists),
        ("Sensitive Files Ignored", check_sensitive_files_ignored),
        ("No Sensitive Files Tracked", check_no_sensitive_files_tracked),
        ("Required Documentation", check_required_documentation),
        ("Temp Directories Ignored", check_temp_directories_ignored),
        (".env.example Safe", check_env_example_no_secrets),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print_error(f"Error running check '{name}': {e}")
            results.append((name, False))
    
    # Summary
    print_header("Summary")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        if result:
            print_success(f"{name}: PASSED")
        else:
            print_error(f"{name}: FAILED")
    
    print(f"\n{BLUE}{'='*60}{RESET}")
    if passed == total:
        print_success(f"All checks passed! ({passed}/{total})")
        print_success("Repository is ready for GitHub! 🚀")
        print(f"{BLUE}{'='*60}{RESET}\n")
        return 0
    else:
        print_error(f"Some checks failed ({passed}/{total} passed)")
        print_warning("Please fix the issues before pushing to GitHub")
        print(f"{BLUE}{'='*60}{RESET}\n")
        return 1

if __name__ == '__main__':
    sys.exit(main())
