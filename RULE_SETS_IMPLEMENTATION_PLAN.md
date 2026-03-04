# Validation Rule Sets - Implementation Plan

## Overview

Implementing hybrid rule sets to support different validation scenarios for the same business class.

## Problem Statement

Multiple data sources feed the same FSM business class (e.g., GLTransactionInterface) but require different validation rules:
- Legacy System → Strict validation (8 rules)
- Manual Entry → Lenient validation (3 rules)
- Third Party → Different required fields (6 rules)

## Solution: Hybrid Rule Sets

**Common Rules** + **Optional Rule Sets**

### Architecture

```
Business Class: GLTransactionInterface
├─ Common (Always Applied)
│  ├─ Currency must exist in Currency
│  ├─ Account must exist in Account
│  └─ FinanceEnterpriseGroup must exist
│
├─ Legacy System Import (Optional)
│  ├─ Amount must be > 0
│  ├─ PostingDate must match YYYY-MM-DD
│  └─ Description required
│
├─ Manual Entry (Optional)
│  ├─ Amount can be negative
│  └─ Reference field required
│
└─ Third Party (Optional)
   ├─ ExternalID required
   └─ Source system must be specified
```

**Validation Logic**: Common Rules + Selected Rule Set

## Implementation Phases

### Phase 1: Database Schema ✅ COMPLETE

#### 1.1 New Table: validation_rule_sets
```sql
CREATE TABLE validation_rule_sets (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    business_class VARCHAR(255) NOT NULL,
    description TEXT,
    is_common BOOLEAN DEFAULT 0,  -- Common rules always apply
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### 1.2 Update Table: validation_rule_templates
```sql
ALTER TABLE validation_rule_templates 
ADD COLUMN rule_set_id INTEGER REFERENCES validation_rule_sets(id);
```

#### 1.3 Migration Script
- ✅ Created `migrate_add_rule_sets.py`
- ✅ Creates validation_rule_sets table
- ✅ Adds rule_set_id column
- ✅ Creates "Common" rule set for each business class
- ✅ Assigns existing rules to "Common"
- ✅ Executed successfully

#### 1.4 Model Updates
- ✅ Created `ValidationRuleSet` model
- ✅ Updated `ValidationRuleTemplate` model with rule_set_id
- ✅ Updated models/__init__.py

### Phase 2: Backend API (IN PROGRESS)

#### 2.1 Rule Set Service
Create `backend/app/modules/rules/rule_set_service.py`:
- `get_all_rule_sets(business_class)` - List all rule sets for a business class
- `get_common_rule_set(business_class)` - Get Common rule set
- `create_rule_set(name, business_class, description)` - Create new rule set
- `update_rule_set(id, name, description, is_active)` - Update rule set
- `delete_rule_set(id)` - Delete rule set (only if not Common)
- `get_rules_for_set(rule_set_id)` - Get all rules in a set

#### 2.2 Rule Set Router
Create endpoints in `backend/app/modules/rules/router.py`:
- `GET /rules/rule-sets?business_class={class}` - List rule sets
- `GET /rules/rule-sets/{id}` - Get rule set details
- `POST /rules/rule-sets` - Create rule set
- `PUT /rules/rule-sets/{id}` - Update rule set
- `DELETE /rules/rule-sets/{id}` - Delete rule set
- `GET /rules/rule-sets/{id}/rules` - Get rules in set

#### 2.3 Update Validation Service
Modify `backend/app/services/rule_executor.py`:
- Load Common rules (is_common=True)
- Load Selected rule set rules
- Combine and execute both sets

#### 2.4 Update Conversion Job
Add `rule_set_id` to `conversion_jobs` table:
```sql
ALTER TABLE conversion_jobs 
ADD COLUMN rule_set_id INTEGER REFERENCES validation_rule_sets(id);
```

Store selected rule set with each conversion job.

### Phase 3: Frontend UI (PENDING)

#### 3.1 Rule Sets Management Page
New section in Validation Rules page:

```
┌─────────────────────────────────────────────────────────┐
│ Validation Rule Sets                                     │
├─────────────────────────────────────────────────────────┤
│ Business Class: [GLTransactionInterface ▼]              │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Rule Sets                                           │ │
│ │                                                     │ │
│ │ ● Common (Always Applied) - 3 rules                │ │
│ │   Cannot be deleted or disabled                    │ │
│ │                                                     │ │
│ │ ○ Legacy System Import - 5 rules                   │ │
│ │   [Edit] [Deactivate] [Delete]                     │ │
│ │                                                     │ │
│ │ ○ Manual Entry - 2 rules                           │ │
│ │   [Edit] [Deactivate] [Delete]                     │ │
│ │                                                     │ │
│ │ [+ Create New Rule Set]                            │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Rules in "Common":                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 1. Currency must exist in Currency                  │ │
│ │ 2. Account must exist in Account                    │ │
│ │ 3. FinanceEnterpriseGroup must exist                │ │
│ │                                                     │ │
│ │ [+ Add Rule to Common]                              │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### 3.2 Rule Set Selector in Mapping Page
Add dropdown after business class selection:

```
┌─────────────────────────────────────────────────────────┐
│ Field Mapping                                            │
├─────────────────────────────────────────────────────────┤
│ File: GLTransactionInterface_DEMO.csv                    │
│ Business Class: GLTransactionInterface                   │
│                                                          │
│ Validation Rule Set: [Legacy System Import ▼]           │
│ ℹ Common rules (3) + Legacy System Import rules (5)     │
│   = 8 total rules will be applied                       │
│                                                          │
│ CSV Column          Maps to FSM Field      Confidence   │
│ ─────────────────────────────────────────────────────   │
│ ...                                                      │
└─────────────────────────────────────────────────────────┘
```

#### 3.3 Create Rule Set Modal
```
┌─────────────────────────────────────────────────────────┐
│ Create New Rule Set                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Business Class: GLTransactionInterface                   │
│                                                          │
│ Rule Set Name:                                           │
│ [_____________________________]                          │
│                                                          │
│ Description:                                             │
│ [_____________________________]                          │
│ [_____________________________]                          │
│                                                          │
│ [Cancel] [Create Rule Set]                               │
└─────────────────────────────────────────────────────────┘
```

#### 3.4 Rule Assignment
When creating/editing a rule, show rule set selector:
```
Rule Set: [Common ▼]
          - Common (Always Applied)
          - Legacy System Import
          - Manual Entry
          - Third Party
```

### Phase 4: Testing (PENDING)

#### 4.1 Backend Tests
- Test rule set CRUD operations
- Test Common rule set cannot be deleted
- Test validation with Common + Selected rules
- Test rule assignment to different sets

#### 4.2 Frontend Tests
- Test rule set selection in mapping
- Test rule set management UI
- Test rule creation with set assignment

#### 4.3 E2E Tests
- Create rule sets
- Assign rules to sets
- Run conversion with different rule sets
- Verify correct rules applied

## User Workflow

### Setup (One-Time per Scenario)

1. **Create Common Rules** (applies to all):
   - Go to Validation Rules
   - Select "Common" rule set
   - Add rules that always apply
   - Example: Currency, Account, FinanceEnterpriseGroup must exist

2. **Create Scenario-Specific Rule Sets**:
   - Click "Create New Rule Set"
   - Name: "Legacy System Import"
   - Add rules specific to legacy imports
   - Example: Amount > 0, PostingDate format, Description required

3. **Repeat for Other Scenarios**:
   - Create "Manual Entry" rule set
   - Create "Third Party" rule set
   - Each with their specific rules

### Conversion (Per Job)

1. Upload CSV
2. Map fields
3. **Select Rule Set**: "Legacy System Import"
4. Validate → Applies Common (3) + Legacy (5) = 8 rules
5. Review errors
6. Load to FSM

## Benefits

✅ **Flexible**: Different rules for different scenarios  
✅ **Organized**: Rules grouped by purpose  
✅ **Reusable**: Common rules shared across all scenarios  
✅ **Clear**: Visual indication of which rules apply  
✅ **Maintainable**: Update rules per scenario independently

## Technical Considerations

### Rule Set Constraints

1. **One Common per Business Class**: Each business class has exactly one "Common" rule set
2. **Common Cannot Be Deleted**: is_common=True rule sets are protected
3. **Common Cannot Be Disabled**: Always active
4. **Unique Names**: Rule set names must be unique per business class

### Validation Logic

```python
def get_applicable_rules(business_class, selected_rule_set_id):
    # Get Common rules
    common_rules = get_rules_for_common_set(business_class)
    
    # Get Selected rule set rules
    selected_rules = get_rules_for_set(selected_rule_set_id)
    
    # Combine
    all_rules = common_rules + selected_rules
    
    return all_rules
```

### Database Queries

```sql
-- Get Common rules
SELECT * FROM validation_rule_templates vrt
JOIN validation_rule_sets vrs ON vrt.rule_set_id = vrs.id
WHERE vrs.business_class = 'GLTransactionInterface'
  AND vrs.is_common = 1
  AND vrt.is_active = 1;

-- Get Selected rule set rules
SELECT * FROM validation_rule_templates
WHERE rule_set_id = 123
  AND is_active = 1;
```

## Migration Path

### For Existing Users

1. Run migration script
2. All existing rules automatically assigned to "Common"
3. No user action required
4. Can create additional rule sets as needed

### Backward Compatibility

- Existing conversions continue to work (use Common rules)
- New conversions can select rule sets
- No breaking changes

## Next Steps

1. ✅ Complete Phase 1 (Database Schema)
2. ⏳ Implement Phase 2 (Backend API)
3. ⏳ Implement Phase 3 (Frontend UI)
4. ⏳ Complete Phase 4 (Testing)

## Status

**Phase 1**: ✅ Complete  
**Phase 2**: 🔄 In Progress  
**Phase 3**: ⏳ Pending  
**Phase 4**: ⏳ Pending

---

**Date**: March 4, 2026  
**Feature**: Validation Rule Sets (Hybrid Approach)  
**Status**: Phase 1 Complete, Phase 2 Starting
