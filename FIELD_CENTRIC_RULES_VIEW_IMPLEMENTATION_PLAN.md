# Field-Centric Rules View - Implementation Plan

## Status: Backend Complete ✅ | Frontend In Progress ⏳

**Date**: March 13, 2026  
**Task**: Implement field-centric table view for validation rules

## Summary

Transform the Validation Rules page from a rule-centric card view to a field-centric table view that shows ALL fields from the schema with their associated rules. This provides better visibility of validation coverage and makes it easier to add rules to specific fields.

## Backend Implementation ✅ COMPLETE

### New Endpoint Added

**File**: `backend/app/modules/rules/router.py`

**Endpoint**: `GET /rules/rule-sets/{rule_set_id}/fields`

**Response Structure**:
```json
{
  "business_class": "GLTransactionInterface",
  "rule_set_id": 5,
  "rule_set_name": "GLTransactionInterface_Default",
  "schema_id": 3,
  "schema_version": 1,
  "total_fields": 91,
  "fields_with_rules": 17,
  "fields": [
    {
      "field_name": "AccountCode",
      "field_type": "string",
      "required": true,
      "description": "Account code description",
      "enum_values": null,
      "pattern": null,
      "rules": [
        {
          "id": 12,
          "name": "AccountCode Required",
          "rule_type": "REQUIRED_FIELD",
          "source": "schema",
          "is_readonly": true,
          "error_message": "AccountCode is required",
          "reference_business_class": null,
          "pattern": null,
          "enum_values": null
        }
      ],
      "rule_count": 1
    },
    {
      "field_name": "Account",
      "field_type": "string",
      "required": false,
      "description": null,
      "enum_values": null,
      "pattern": null,
      "rules": [],
      "rule_count": 0
    }
    // ... 89 more fields
  ]
}
```

**Key Features**:
- Returns ALL fields from the schema (91 fields for GLTransactionInterface)
- Shows which fields have rules and which don't
- Groups multiple rules per field
- Sorts fields: required first, then alphabetically
- Includes field metadata (type, description, enum values, pattern)

## Frontend Implementation ⏳ IN PROGRESS

### Changes Needed

#### 1. Add State for Field View

```typescript
// Add to RulesManagement component state
const [showFieldView, setShowFieldView] = useState(false);
const [fieldViewData, setFieldViewData] = useState<any>(null);
const [loadingFields, setLoadingFields] = useState(false);
const [showAddRuleModal, setShowAddRuleModal] = useState(false);
const [selectedField, setSelectedField] = useState<any>(null);
```

#### 2. Add Function to Load Fields

```typescript
const loadRuleSetFields = async (ruleSetId: number) => {
  setLoadingFields(true);
  try {
    const response = await api.get(`/rules/rule-sets/${ruleSetId}/fields`);
    setFieldViewData(response.data);
    setShowFieldView(true);
  } catch (error) {
    console.error('Failed to load rule set fields:', error);
    alert('Failed to load fields');
  } finally {
    setLoadingFields(false);
  }
};
```

#### 3. Update Rule Set Card UI

**Current**:
```tsx
<div style={styles.ruleSetActions}>
  <button onClick={() => handleEditRuleSet(ruleSet)}>
    ✏️ Edit
  </button>
  <button onClick={() => handleDeleteRuleSet(ruleSet.id)}>
    🗑️ Delete
  </button>
</div>
```

**New**:
```tsx
<div style={styles.ruleSetActions}>
  <button onClick={() => loadRuleSetFields(ruleSet.id)}>
    👁️ View Rules
  </button>
  <button onClick={() => handleEditRuleSet(ruleSet)}>
    ✏️ Edit
  </button>
  <button onClick={() => handleDeleteRuleSet(ruleSet.id)}>
    🗑️ Delete
  </button>
</div>
```

#### 4. Create Field View Modal/Panel

```tsx
{showFieldView && fieldViewData && (
  <>
    {/* Overlay */}
    <div
      onClick={() => setShowFieldView(false)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 999
      }}
    />
    
    {/* Sliding Panel */}
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '90%',
      maxWidth: '1200px',
      backgroundColor: theme.background.secondary,
      zIndex: 1000,
      overflowY: 'auto',
      boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)'
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        backgroundColor: theme.background.tertiary,
        padding: '20px',
        borderBottom: `1px solid ${theme.background.quaternary}`,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
              {fieldViewData.rule_set_name} - Field Rules
            </h2>
            <div style={{ fontSize: '14px', color: theme.text.tertiary }}>
              {fieldViewData.total_fields} fields | {fieldViewData.fields_with_rules} with rules
            </div>
          </div>
          <button
            onClick={() => setShowFieldView(false)}
            style={{
              padding: '8px 12px',
              backgroundColor: theme.background.secondary,
              border: `1px solid ${theme.background.quaternary}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '18px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: theme.background.tertiary }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>
                Field Name
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', width: '80px' }}>
                Type
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', width: '100px' }}>
                Required
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>
                Rules
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', width: '60px' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {fieldViewData.fields.map((field: any, idx: number) => (
              <tr
                key={idx}
                style={{
                  borderBottom: `1px solid ${theme.background.quaternary}`,
                  backgroundColor: idx % 2 === 0 ? theme.background.secondary : theme.background.primary
                }}
              >
                <td style={{ padding: '12px', fontSize: '14px' }}>
                  <div style={{ fontWeight: field.required ? 'bold' : 'normal' }}>
                    {field.field_name}
                  </div>
                  {field.description && (
                    <div style={{ fontSize: '12px', color: theme.text.tertiary, marginTop: '4px' }}>
                      {field.description}
                    </div>
                  )}
                </td>
                <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: theme.text.tertiary }}>
                  {field.field_type}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {field.required ? (
                    <span style={{ color: theme.status.error, fontSize: '18px' }}>●</span>
                  ) : (
                    <span style={{ color: theme.text.tertiary, fontSize: '18px' }}>○</span>
                  )}
                </td>
                <td style={{ padding: '12px' }}>
                  {field.rule_count === 0 ? (
                    <span style={{ fontSize: '12px', color: theme.text.tertiary, fontStyle: 'italic' }}>
                      (no rules)
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {field.rules.map((rule: any) => (
                        <span
                          key={rule.id}
                          title={rule.error_message}
                          style={{
                            padding: '2px 8px',
                            backgroundColor: rule.source === 'schema' ? theme.accent.purpleTintLight : theme.background.tertiary,
                            border: `1px solid ${rule.source === 'schema' ? theme.primary.main : theme.background.quaternary}`,
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: rule.source === 'schema' ? theme.primary.main : theme.text.primary,
                            cursor: 'help'
                          }}
                        >
                          {rule.rule_type}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    onClick={() => {
                      setSelectedField(field);
                      setShowAddRuleModal(true);
                    }}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: theme.primary.main,
                      color: theme.background.secondary,
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '16px',
                      cursor: 'pointer'
                    }}
                    title="Add rule to this field"
                  >
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </>
)}
```

#### 5. Create Add Rule Modal

```tsx
{showAddRuleModal && selectedField && (
  <div style={styles.modalOverlay} onClick={() => setShowAddRuleModal(false)}>
    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
      <h2 style={styles.modalTitle}>Add Rule for Field: {selectedField.field_name}</h2>

      <div style={styles.formGroup}>
        <label style={styles.label}>Rule Type</label>
        <select
          value={newRule.rule_type}
          onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
          style={styles.input}
        >
          <option value="REFERENCE_EXISTS">REFERENCE_EXISTS</option>
          <option value="REQUIRED_OVERRIDE">REQUIRED_OVERRIDE</option>
          <option value="PATTERN_MATCH">PATTERN_MATCH</option>
          <option value="ENUM_VALIDATION">ENUM_VALIDATION</option>
        </select>
      </div>

      {newRule.rule_type === 'REFERENCE_EXISTS' && (
        <div style={styles.formGroup}>
          <label style={styles.label}>Reference Business Class</label>
          <input
            type="text"
            value={newRule.reference_business_class}
            onChange={(e) => setNewRule({ ...newRule, reference_business_class: e.target.value })}
            style={styles.input}
            placeholder="e.g., Account, Vendor, Customer"
          />
        </div>
      )}

      <div style={styles.formGroup}>
        <label style={styles.label}>Error Message</label>
        <textarea
          value={newRule.error_message}
          onChange={(e) => setNewRule({ ...newRule, error_message: e.target.value })}
          style={{ ...styles.input, minHeight: '80px' }}
          placeholder="e.g., {field_name} '{value}' does not exist in FSM"
        />
      </div>

      <div style={styles.modalActions}>
        <button onClick={() => setShowAddRuleModal(false)} style={styles.cancelButton}>
          Cancel
        </button>
        <button onClick={handleAddRuleToField} style={styles.saveButton}>
          Add Rule
        </button>
      </div>
    </div>
  </div>
)}
```

#### 6. Add Handler for Adding Rule to Field

```typescript
const handleAddRuleToField = async () => {
  if (!selectedField || !fieldViewData) return;

  try {
    // Create rule with field name from selected field
    const ruleData = {
      name: `${selectedField.field_name} ${newRule.rule_type}`,
      business_class: fieldViewData.business_class,
      rule_set_id: fieldViewData.rule_set_id,
      rule_type: newRule.rule_type,
      field_name: selectedField.field_name,
      reference_business_class: newRule.reference_business_class || null,
      condition_expression: null,
      error_message: newRule.error_message,
      is_active: true,
      source: 'custom'
    };

    await api.post('/rules/templates', ruleData);

    // Reset form
    setNewRule({
      name: '',
      business_class: '',
      rule_type: 'REFERENCE_EXISTS',
      field_name: '',
      reference_business_class: '',
      condition_expression: '',
      error_message: '',
      is_active: true,
      rule_set_id: null
    });

    setShowAddRuleModal(false);
    setSelectedField(null);

    // Reload field view
    await loadRuleSetFields(fieldViewData.rule_set_id);

    alert('✅ Rule added successfully');
  } catch (error: any) {
    alert(`Failed to add rule: ${error.response?.data?.detail || error.message}`);
  }
};
```

## UI Design

### Rule Set Card (Updated)
```
┌─────────────────────────────────────────────────┐
│ ○ GLTransactionInterface_Default    17 rules   │
│   Auto-generated schema validation rules        │
│                                                  │
│   [👁️ View Rules]  [✏️ Edit]  [🗑️ Delete]      │
└─────────────────────────────────────────────────┘
```

### Field-Centric Table View
```
┌──────────────────────────────────────────────────────────────────────────┐
│  GLTransactionInterface_Default - Field Rules                      [✕]   │
│  91 fields | 17 with rules                                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Field Name        │ Type   │ Req │ Rules              │ Actions   │ │
│  ├───────────────────┼────────┼─────┼────────────────────┼───────────┤ │
│  │ AccountCode       │ string │  ●  │ REQUIRED_FIELD     │    +      │ │
│  │ AccountingEntity  │ string │  ●  │ REQUIRED_FIELD     │    +      │ │
│  │ Account           │ string │  ○  │ (no rules)         │    +      │ │
│  │ APPaid            │ string │  ○  │ ENUM_VALIDATION    │    +      │ │
│  │ PostingDate       │ string │  ●  │ PATTERN_MATCH,     │    +      │ │
│  │                   │        │     │ REQUIRED_FIELD     │           │ │
│  └───────────────────┴────────┴─────┴────────────────────┴───────────┘ │
│                                                                           │
│  [Close]                                                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Benefits

1. **Complete Visibility**: See ALL 91 fields, not just the 17 with rules
2. **Coverage Analysis**: Quickly identify which fields lack validation
3. **Field-Centric**: Natural mental model (fields → rules, not rules → fields)
4. **Easy Rule Addition**: Add rules directly from field rows
5. **Clean UI**: No more crowded card grid for 91+ fields
6. **Scalable**: Works for business classes with hundreds of fields
7. **Sortable**: Required fields first, then alphabetical
8. **Rule Badges**: Visual distinction between schema and custom rules

## Testing Checklist

- [ ] Backend endpoint returns all fields with rules
- [ ] "View Rules" button opens field view panel
- [ ] Table displays all 91 fields for GLTransactionInterface
- [ ] Required fields marked with red dot
- [ ] Fields without rules show "(no rules)"
- [ ] Fields with rules show rule type badges
- [ ] Schema rules have purple theme, custom rules have gray theme
- [ ] Clicking + button opens Add Rule modal
- [ ] Add Rule modal pre-fills field name
- [ ] Adding rule refreshes field view
- [ ] Close button closes field view panel
- [ ] Panel scrolls for long field lists

## Files Modified

- ✅ `backend/app/modules/rules/router.py` - Added GET /rule-sets/{id}/fields endpoint
- ⏳ `frontend/src/pages/RulesManagement.tsx` - Add field view UI (IN PROGRESS)

## Next Steps

1. ⏳ Complete frontend implementation
2. ⏳ Test with GLTransactionInterface (91 fields)
3. ⏳ Test with PurchaseOrderImport (146 fields)
4. ⏳ Add field search/filter functionality (optional enhancement)
5. ⏳ Add rule deletion from field view (optional enhancement)

---

**Status**: Backend complete, frontend implementation plan documented
**Estimated Completion**: 1-2 hours for frontend implementation
