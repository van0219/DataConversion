# Import Files Directory

This directory is for storing sample and demo data files.

## What to Include in Git

✅ **Include**:
- Demo files (e.g., `GLTransactionInterface_DEMO.csv`)
- Sample files (e.g., `*_SAMPLE.csv`)
- This README.md

❌ **Exclude** (via .gitignore):
- Real customer data files
- Production CSV/Excel files
- Any files with sensitive information

## Current Files

### Demo Files
- `GLTransactionInterface_DEMO.csv` - Sample GL transactions with intentional errors for testing validation

### Sample Files
- `GLTransactionInterface_20251128.csv` - Clean sample data (if contains real data, should be excluded)

## Usage

1. Place your CSV/Excel files here for conversion
2. The application will read files from this directory
3. Demo files are safe to commit to git
4. Real data files are automatically excluded by .gitignore

## File Naming Convention

For auto-detection to work:
- `GLTransactionInterface_*.csv` - GL transactions
- `Vendor_*.csv` - Vendor master data
- `Customer_*.csv` - Customer master data
- `PayablesInvoice_*.csv` - AP invoices

---

**Note**: Never commit files containing real customer data, credentials, or sensitive information.
