# Validation Rule Sets - User Guide

## Overview

Validation Rule Sets allow you to organize validation rules into groups based on different data scenarios. This feature enables flexible validation strategies for different data sources while maintaining a common set of rules that always apply.

## Concepts

### Common Rule Set

Every business class has a **Common** rule set that contains validation rules that ALWAYS apply to all conversions, regardless of the data source.

- **Always Applied**: Common rules run for every validation
- **Cannot Be Deleted**: Protected from accidental deletion
- **Cannot Be Deactivated**: Always active
- **Auto-Created**: Created automatically when you add your first rule for a business class

**Example Common Rules**:
- Currency must exist in FSM
- Account must exist in FSM
- Required fields must not be empty

### Optional Rule Sets

You can create additional **Optional** rule sets for specific scenarios or data sources. Only ONE optional rule set is applied per conversion, in addition to the Common rules.

**Example Optional Rule Sets**:
- "Legacy System Import" - Rules specific to legacy data
- "Manual Entry" - Rules for manually entered data
- "Third Party Integration" - Rules for external system data

### Hybrid Validation

When you run validation, the system applies:
```
Total Rules = Common Rules + Selected Optional Rule Set
```

**Example**:
- Common rules: 3 rules (always applied)
- Legacy System Import: 5 rules (selected)
- **Total applied**: 8 rules

## Getting Started

### 1. Navigate to Validation Rules Page

From the main menu, click **"Validation Rules"** to open the rule management page.

### 2. Select a Business Class

Use the **Business Class** dropdown to select which FSM business class you want to manage rules for:
- GLTransactionInterface
- PayablesInvoice
- Vendor
- Customer
- Or GLOBAL (applies to all classes)

### 3. View Rule Sets

Once you select a business class, you'll see the **Rule Sets** section showing:
- Common rule set (marked with red ●)
- Any optional rule sets you've created (marked with gray ○)
- Rule count for each set

## Creating a Rule Set

### Step 1: Select Business Class

First, select the business class from the dropdown (e.g., GLTransactionInterface).

### Step 2: Click "Create Rule Set"

Click the **"+ Create Rule Set"** button in the Rule Sets section.

### Step 3: Fill in Details

In the modal that appears:

**Rule Set Name** (required)
- Enter a descriptive name
- Example: "Legacy System Import"

**Description** (optional)
- Explain when this rule set should be used
- Example: "Validation rules for data imported from the legacy AX system"

**Active** (checkbox)
- Check to make the rule set active
- Uncheck to temporarily disable (rules won't be available for selection)

### Step 4: Create

Click **"Create Rule Set"** to save.

The new rule set will appear in the Rule Sets section.

## Creating Rules in a Rule Set

### Step 1: Select the Rule Set

Click on the rule set card where you want to add the rule. The card border will turn red to indicate it's selected.

### Step 2: Click "Create Rule"

Click the **"+ Create Rule"** button at the top of the page.

### Step 3: Fill in Rule Details

**Rule Name** (required)
- Descriptive name for the rule
- Example: "Vendor Must Exist"

**Scope** (required)
- Select business class or GLOBAL
- Usually matches the selected business class

**Rule Set** (required)
- Pre-selected with your current rule set
- Can change to a different rule set if needed
- Shows "(Common - Always Applied)" for Common rule set

**Rule Type** (required)
- REFERENCE_EXISTS - Check if value exists in reference data
- REQUIRED_OVERRIDE - Override FSM's required field validation
- Other types (future implementation)

**Field Name** (required)
- The field to validate
- Example: "Vendor"

**Reference Business Class** (for REFERENCE_EXISTS)
- The FSM class to check against
- Example: "Vendor"

**Error Message** (required)
- Message shown when validation fails
- Can use {value} placeholder
- Example: "Vendor '{value}' does not exist in FSM"

### Step 4: Create

Click **"Create Rule"** to save.

The rule will appear in the selected rule set, and the rule count will update.

## Managing Rule Sets

### Viewing Rules in a Rule Set

1. Click on any rule set card
2. The card border turns red
3. The rules section below shows only rules in that set
4. Section title shows: "Rules in [Name] (X)"

### Editing a Rule Set

1. Click the **"✏️ Edit"** button on the rule set card
2. Modify the name, description, or active status
3. Click **"Update Rule Set"**

**Note**: You cannot edit the Common rule set's name or deactivate it.

### Deleting a Rule Set

1. Click the **"🗑️ Delete"** button on the rule set card
2. Confirm the deletion
3. The rule set and ALL its rules will be deleted

**Warning**: This action cannot be undone. All rules in the set will be permanently deleted.

**Note**: You cannot delete the Common rule set.

## Using Rule Sets in Conversions

### Current Workflow (Manual Selection)

1. Upload your CSV file
2. Review and adjust field mappings
3. Manually note which rule set to use
4. Start validation
5. Common rules + all rules for the business class are applied

### Future Workflow (Integrated Selection)

In a future update, you'll be able to:
1. Upload your CSV file
2. Review and adjust field mappings
3. **Select optional rule set** from dropdown
4. Start validation
5. System applies: Common rules + Selected rule set

## Best Practices

### Organizing Rules

**Common Rule Set**:
- Put universal validation rules here
- Rules that apply regardless of data source
- Reference data existence checks
- Critical business rules

**Optional Rule Sets**:
- Create one per data source or scenario
- Name them clearly (e.g., "Legacy AX Import", "Manual Entry")
- Document when each should be used in the description

### Naming Conventions

**Rule Set Names**:
- Use clear, descriptive names
- Include the data source or scenario
- Examples:
  - "Legacy System Import"
  - "Manual Data Entry"
  - "Third Party API"
  - "Excel Upload"

**Rule Names**:
- Start with the field name
- Describe the validation
- Examples:
  - "Vendor Must Exist"
  - "Amount Must Be Positive"
  - "Date Must Be Valid"

### Rule Set Strategy

**Scenario 1: Single Data Source**
- Use only Common rule set
- All rules apply to all conversions
- Simplest approach

**Scenario 2: Multiple Data Sources**
- Common: Universal rules (reference data, required fields)
- Legacy System: Rules for legacy data quirks
- Manual Entry: Rules for user-entered data
- Third Party: Rules for external system data

**Scenario 3: Progressive Validation**
- Common: Basic validation (existence, required)
- Strict: Additional business rules
- Lenient: Minimal validation for testing

## Examples

### Example 1: GLTransactionInterface

**Common Rule Set** (3 rules):
1. Currency Must Exist
2. Account Must Exist
3. Ledger Must Exist

**Legacy System Import** (5 rules):
1. Amount Must Be Positive
2. Date Format Must Be MM/DD/YYYY
3. Vendor Must Exist (if VendorInvoice)
4. Project Must Exist (if ProjectID provided)
5. Description Cannot Be Empty

**Manual Entry** (2 rules):
1. Amount Must Be Non-Zero
2. Description Must Be At Least 10 Characters

### Example 2: PayablesInvoice

**Common Rule Set** (4 rules):
1. Vendor Must Exist
2. Currency Must Exist
3. Invoice Number Required
4. Invoice Date Required

**Legacy Import** (3 rules):
1. Payment Terms Must Match Legacy Codes
2. Tax Code Must Be Valid
3. GL Account Must Exist

**API Integration** (2 rules):
1. External Reference ID Required
2. Sync Status Must Be Valid

## Troubleshooting

### Rule Set Not Appearing

**Problem**: Created a rule set but don't see it

**Solution**:
- Check that you selected the correct business class
- Verify the rule set is marked as Active
- Refresh the page

### Cannot Delete Rule Set

**Problem**: Delete button is missing or disabled

**Solution**:
- You cannot delete the Common rule set (by design)
- Check that you have permission to delete
- Ensure you're not trying to delete a system rule set

### Rules Not Filtering

**Problem**: Clicking rule set doesn't filter rules

**Solution**:
- Ensure the rule set is selected (red border)
- Check that rules have the correct rule_set_id
- Refresh the page

### Common Rule Set Missing

**Problem**: No Common rule set appears

**Solution**:
- Common rule set is auto-created when you add your first rule
- Create a rule for the business class to trigger creation
- Check that you selected a specific business class (not "All Classes")

## FAQ

**Q: Can I have multiple Common rule sets?**  
A: No, each business class has exactly one Common rule set.

**Q: Can I apply multiple optional rule sets at once?**  
A: Currently no. You select one optional rule set per conversion. Common rules always apply.

**Q: What happens if I don't select an optional rule set?**  
A: Only the Common rules will be applied.

**Q: Can I move rules between rule sets?**  
A: Not directly. You need to delete the rule from one set and recreate it in another.

**Q: Can I copy a rule set?**  
A: Not currently. You need to manually recreate rules in a new rule set.

**Q: Do rule sets work across business classes?**  
A: No, each business class has its own set of rule sets.

**Q: Can I export/import rule sets?**  
A: Not currently. This is a potential future enhancement.

## Technical Details

### Database Structure

Rule sets are stored in the `validation_rule_sets` table:
- `id` - Unique identifier
- `name` - Rule set name
- `business_class` - Associated business class
- `description` - Usage description
- `is_common` - Flag for Common rule set
- `is_active` - Active status
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

Rules are linked via `rule_set_id` in the `validation_rule_templates` table.

### API Endpoints

- `GET /rules/rule-sets` - List all rule sets
- `GET /rules/rule-sets/{id}` - Get rule set with rules
- `POST /rules/rule-sets` - Create new rule set
- `PUT /rules/rule-sets/{id}` - Update rule set
- `DELETE /rules/rule-sets/{id}` - Delete rule set
- `GET /rules/rule-sets/{id}/rules` - Get rules in set

### Validation Logic

When validation runs:
1. Load Common rule set for business class
2. Load selected optional rule set (if any)
3. Combine rules: Common + Optional
4. Apply all rules to each record
5. Collect and report errors

---

**Version**: 1.0  
**Last Updated**: March 4, 2026  
**Feature**: Validation Rule Sets  
**Status**: Production Ready
