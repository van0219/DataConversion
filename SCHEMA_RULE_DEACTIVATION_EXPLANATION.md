# Schema Deletion and Validation Rules - Explanation

## Your Question
"What will happen to the validation rules under the deleted schema, will they be inactivated too?"

## Answer: YES ✅ (Now Implemented)

When you delete a schema, **all auto-generated validation rules from that schema are automatically deactivated**.

## Implementation Details

### Before (Original Implementation)
- ❌ Schema was soft-deleted (`is_active = False`)
- ❌ Validation rules remained active
- ❌ Orphaned rules could cause confusion
- ❌ Rules would still execute during validation

### After (Enhanced Implementation)
- ✅ Schema is soft-deleted (`is_active = False`)
- ✅ All schema-generated rules are also deactivated (`is_active = False`)
- ✅ No orphaned rules
- ✅ Clean, consistent state

## What Gets Deactivated

### Schema-Generated Rules (Deactivated) ✅
These rules are automatically created when you import a Swagger file:

1. **PATTERN_MATCH Rules**
   - Date format validation (e.g., YYYYMMDD pattern)
   - Regex pattern validation
   - Example: "PostingDate must match pattern: ^\d{8}$"

2. **ENUM_VALIDATION Rules**
   - Status field validation (e.g., "0" or "1")
   - Code field validation with allowed values
   - Example: "Status must be one of: 0, 1"

3. **REQUIRED_FIELD Rules**
   - Mandatory field validation
   - Example: "FinanceEnterpriseGroup is required"

**Identification**: 
- `source = 'schema'`
- `schema_id = <deleted_schema_id>`
- `is_readonly = True`

### Custom Rules (NOT Affected) ❌
These rules remain active:

1. **User-Created Rules**
   - REFERENCE_EXISTS rules (e.g., Vendor must exist)
   - Custom REQUIRED_OVERRIDE rules
   - Any manually created validation rules

**Identification**:
- `source = 'custom'`
- `schema_id = NULL` (not linked to schema)
- `is_readonly = False`

## Database Relationship

```sql
-- ValidationRuleTemplate model
CREATE TABLE validation_rule_templates (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255),
    business_class VARCHAR(255),
    rule_type VARCHAR(100),
    field_name VARCHAR(255),
    
    -- Schema relationship
    schema_id INTEGER,  -- Links to schemas.id
    source VARCHAR(20),  -- 'schema' or 'custom'
    is_readonly BOOLEAN,  -- TRUE for schema rules
    is_active BOOLEAN,  -- Deactivated when schema deleted
    
    FOREIGN KEY (schema_id) REFERENCES schemas(id) ON DELETE CASCADE
);
```

## Deactivation Process

### Step 1: User Deletes Schema
```
User clicks "🗑️ Delete" on GLTransactionInterface v3
```

### Step 2: Backend Deactivates Rules
```python
# Find all schema-generated rules for this schema
rules_deactivated = db.query(ValidationRuleTemplate).filter(
    ValidationRuleTemplate.schema_id == schema_id,
    ValidationRuleTemplate.source == "schema"
).update({"is_active": False})

# Result: 17 rules deactivated
```

### Step 3: Backend Deactivates Schema
```python
# Deactivate the schema
schema.is_active = False
db.commit()
```

### Step 4: User Sees Confirmation
```
✅ Schema GLTransactionInterface v3 has been deactivated successfully.
17 validation rule(s) also deactivated.
```

## Example Scenario

### Before Deletion
```
Schema: GLTransactionInterface v3 (is_active = True)
Rules:
  ✅ PostingDate Pattern Validation (source='schema', is_active=True)
  ✅ Status Enum Validation (source='schema', is_active=True)
  ✅ FinanceEnterpriseGroup Required (source='schema', is_active=True)
  ✅ Vendor Reference Exists (source='custom', is_active=True)
  ... (14 more schema rules)
```

### After Deletion
```
Schema: GLTransactionInterface v3 (is_active = False)
Rules:
  ❌ PostingDate Pattern Validation (source='schema', is_active=False)
  ❌ Status Enum Validation (source='schema', is_active=False)
  ❌ FinanceEnterpriseGroup Required (source='schema', is_active=False)
  ✅ Vendor Reference Exists (source='custom', is_active=True)  ← Still active!
  ... (14 more schema rules, all deactivated)

Result: 17 schema rules deactivated, 1 custom rule remains active
```

## Why This Matters

### Data Integrity
- Schema and rules are kept in sync
- No orphaned rules pointing to inactive schemas
- Clean database state

### User Experience
- Clear feedback on what was affected
- No confusion about which rules are active
- Predictable behavior

### Validation Behavior
- Inactive rules don't execute during validation
- Only active rules from active schemas are used
- Custom rules continue to work

## Verification

### Check Rules in Validation Rules Page
1. Navigate to Validation Rules page
2. Filter by business class (e.g., GLTransactionInterface)
3. Schema-generated rules should no longer appear
4. Custom rules should still be visible

### Check Database
```sql
-- Count active schema rules for deleted schema
SELECT COUNT(*) 
FROM validation_rule_templates 
WHERE schema_id = 5 
  AND source = 'schema' 
  AND is_active = 1;
-- Result: 0 (all deactivated)

-- Count active custom rules
SELECT COUNT(*) 
FROM validation_rule_templates 
WHERE business_class = 'GLTransactionInterface' 
  AND source = 'custom' 
  AND is_active = 1;
-- Result: 1 (custom rule still active)
```

## Important Notes

1. **Soft Delete**: Both schema and rules are soft-deleted (marked inactive), not physically deleted
2. **Historical Data**: Conversion jobs that used these rules remain intact
3. **Version Continuity**: New schema uploads create higher version numbers
4. **Selective Deactivation**: Only schema-generated rules are affected
5. **Reversible**: Rules can be manually reactivated if needed (though schema remains inactive)

## Summary

✅ **YES**, validation rules are automatically deactivated when you delete a schema  
✅ Only schema-generated rules are affected  
✅ Custom rules remain active  
✅ User sees count of deactivated rules in success message  
✅ Clean, consistent state maintained  

---

**Implementation Status**: Complete and tested  
**Files Modified**: 
- `backend/app/modules/schema/router.py`
- `frontend/src/pages/SchemaManagement.tsx`
