# FSM Data Conversion - User Guide
*For Non-Technical Users*

## What This Workspace Does
This workspace helps you convert data from Excel/CSV files into FSM (your financial system) without needing to know technical details. Think of it as a smart translator that speaks both "Excel" and "FSM."

## 🚀 Quick Start - 3 Simple Steps

### Step 1: Prepare Your Data File
- Save your data as an **Excel (.xlsx)** or **CSV (.csv)** file
- Make sure your file has column headers (first row should contain field names)
- Place the file in the `Import_Files` folder in this workspace

### Step 2: Ask Kiro to Convert Your Data
Simply type one of these phrases in the chat:

**For automatic conversion (recommended):**
```
"Convert my file [filename] to FSM"
"Load my Excel file [filename] into FSM"
"Import [filename] to the financial system"
```

**For validation only (to check before loading):**
```
"Validate my file [filename] before loading"
"Check if [filename] is ready for FSM"
```

### Step 3: Review and Confirm
Kiro will:
1. ✅ Automatically detect what type of data you have
2. ✅ Convert it to the correct FSM format
3. ✅ Show you a preview of what will be loaded
4. ✅ Ask for your confirmation before sending to FSM

## 📁 Supported Data Types

### General Ledger Transactions
**File naming:** Include "GL" or "GLTransaction" in your filename
**What it's for:** Journal entries, account transactions
**Example:** `GL_Transactions_January2024.xlsx`

### Vendor Information
**File naming:** Include "Vendor" in your filename  
**What it's for:** Supplier master data, vendor details
**Example:** `Vendor_Master_Data.csv`

### Customer Information
**File naming:** Include "Customer" in your filename
**What it's for:** Customer master data, client details
**Example:** `Customer_List_2024.xlsx`

### Invoices
**File naming:** Include "Invoice" or "AP" in your filename
**What it's for:** Accounts payable invoices
**Example:** `AP_Invoices_December.csv`

## 💬 How to Talk to Kiro

### Simple Commands That Work:

**Loading Data:**
- "Load my GL transactions from [filename]"
- "Import the vendor data from [filename]"
- "Convert [filename] and send it to FSM"

**Checking Data First:**
- "Validate [filename] before loading"
- "Check my data in [filename]"
- "Is [filename] ready for FSM?"

**Getting Help:**
- "What types of data can I import?"
- "Show me the required fields for vendors"
- "Help me with GL transactions"

**Checking Status:**
- "Did my data load successfully?"
- "Show me what was imported"

## ✅ Best Practices

### File Preparation
1. **Use clear column headers** that match FSM field names when possible
2. **Include dates in MM/DD/YYYY format** (will be converted automatically)
3. **Use numbers without commas** for amounts (e.g., 1000.50 not 1,000.50)
4. **Keep one type of data per file** (don't mix vendors and invoices)

### File Naming
- Use descriptive names that indicate the data type
- Include dates when relevant
- Examples: `Vendors_2024.xlsx`, `GL_Entries_Jan2024.csv`

### Before Loading
- Always validate your data first by asking Kiro to check it
- Review the preview Kiro shows you
- Make sure the data looks correct before confirming

## 🔍 What Kiro Does Automatically

### Smart Detection
- **Figures out data type** from your filename and column headers
- **Detects file format** (Excel, CSV, etc.)
- **Maps your columns** to FSM fields
- **Converts dates and numbers** to the right format

### Data Validation
- **Checks required fields** are present
- **Validates data formats** (dates, amounts, etc.)
- **Identifies potential issues** before loading
- **Shows you exactly what will be sent** to FSM

### Error Handling
- **Explains problems** in plain English
- **Suggests fixes** for common issues
- **Lets you try again** after corrections

## 🚨 Common Issues and Solutions

### "File not found"
**Problem:** Kiro can't find your file
**Solution:** Make sure the file is in the `Import_Files` folder

### "Missing required fields"
**Problem:** Your data is missing important columns
**Solution:** Add the missing columns or ask Kiro what's required

### "Invalid date format"
**Problem:** Dates aren't in the right format
**Solution:** Use MM/DD/YYYY format (e.g., 01/15/2024)

### "Data validation failed"
**Problem:** Some data doesn't meet FSM requirements
**Solution:** Check the error details and fix the highlighted issues

## 📞 Getting Help

### Ask Kiro Directly:
- "I'm having trouble with [specific issue]"
- "What does this error mean?"
- "How do I fix [problem]?"
- "Show me an example of [data type]"

### Common Help Topics:
- "What are the required fields for GL transactions?"
- "How should I format dates?"
- "What file formats do you support?"
- "Can you show me a sample file?"

## 🎯 Example Workflow

Let's say you want to import vendor data:

1. **You:** Save your vendor list as `Vendors_2024.xlsx` in the `Import_Files` folder

2. **You:** Type in chat: "Validate my vendor file Vendors_2024.xlsx"

3. **Kiro:** Shows you what it found and any issues

4. **You:** Fix any issues in your Excel file and save

5. **You:** Type: "Load Vendors_2024.xlsx into FSM"

6. **Kiro:** Converts and shows preview: "I found 50 vendors. Here's what will be loaded..."

7. **You:** Review and confirm: "Yes, load them"

8. **Kiro:** "✅ Successfully loaded 50 vendors to FSM!"

## 🔒 Important Notes

- **Always validate first** before loading important data
- **Keep backups** of your original files
- **Test with small files** before loading large datasets
- **Ask questions** - Kiro is here to help!

---

*Remember: You don't need to understand the technical details. Just prepare your data, ask Kiro to help, and review what it shows you before confirming. Kiro handles all the complex conversion work behind the scenes!*

---

## Authors

**Van Anthony Silleza** - *Infor FSM Technical Consultant*  
Domain expertise, user workflow design, and FSM best practices

**Kiro AI Assistant** - *Documentation & User Experience*  
User guide creation, workflow automation, and accessibility design

*Collaborative development - January 2026*