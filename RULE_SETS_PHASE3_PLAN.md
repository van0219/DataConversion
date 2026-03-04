# Rule Sets Phase 3: Frontend UI - Implementation Plan

## Overview

Add rule set management to the Validation Rules page with minimal disruption to existing functionality.

## Implementation Strategy

### Approach: Incremental Enhancement

Instead of rewriting the entire RulesManagement component, we'll:
1. Add rule set state management
2. Add rule set selector UI above existing rules list
3. Add rule set CRUD modals
4. Update rule creation to include rule_set_id
5. Keep existing rule management functionality intact

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Validation Rules                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Business Class: [GLTransactionInterface ▼]                  │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Rule Sets                                                ││
│ │                                                          ││
│ │ ● Common (Always Applied) - 3 rules                     ││
│ │   [View Rules]                                           ││
│ │                                                          ││
│ │ ○ Legacy System Import - 5 rules                        ││
│ │   [View Rules] [Edit] [Delete]                          ││
│ │                                                          ││
│ │ ○ Manual Entry - 2 rules                                ││
│ │   [View Rules] [Edit] [Delete]                          ││
│ │                                                          ││
│ │ [+ Create New Rule Set]                                 ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Selected Rule Set: [Common ▼]                                │
│                                                              │
│ Rules in "Common":                                           │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ [Existing rules list component - unchanged]              ││
│ │ ...                                                      ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Changes Required

### 1. State Management (Add to existing state)

```typescript
// Add these to existing state
const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
const [selectedRuleSet, setSelectedRuleSet] = useState<RuleSet | null>(null);
const [showRuleSetModal, setShowRuleSetModal] = useState(false);
const [ruleSetFormData, setRuleSetFormData] = useState({
  name: '',
  description: '',
  is_active: true
});
```

### 2. API Calls (Add new functions)

```typescript
const loadRuleSets = async () => {
  const response = await api.get('/rules/rule-sets', {
    params: { business_class: selectedBusinessClass }
  });
  setRuleSets(response.data);
  // Auto-select Common if available
  const common = response.data.find(rs => rs.is_common);
  if (common) setSelectedRuleSet(common);
};

const createRuleSet = async () => {
  await api.post('/rules/rule-sets', {
    ...ruleSetFormData,
    business_class: selectedBusinessClass
  });
  loadRuleSets();
};

const deleteRuleSet = async (id: number) => {
  await api.delete(`/rules/rule-sets/${id}`);
  loadRuleSets();
};
```

### 3. UI Components (Add before existing rules list)

```typescript
{/* Rule Sets Section - NEW */}
<div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
  <h3>Rule Sets</h3>
  
  {ruleSets.map(ruleSet => (
    <div key={ruleSet.id} style={{ 
      padding: '15px',
      backgroundColor: selectedRuleSet?.id === ruleSet.id ? '#2a2a2a' : '#0a0a0a',
      marginBottom: '10px',
      borderRadius: '4px',
      cursor: 'pointer'
    }}
    onClick={() => setSelectedRuleSet(ruleSet)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {ruleSet.is_common && <span style={{ color: '#dc2626' }}>● </span>}
          {!ruleSet.is_common && <span style={{ color: '#9ca3af' }}>○ </span>}
          <strong>{ruleSet.name}</strong>
          {ruleSet.is_common && <span style={{ color: '#9ca3af', fontSize: '12px' }}> (Always Applied)</span>}
          <span style={{ color: '#9ca3af', marginLeft: '10px' }}>- {ruleSet.rule_count} rules</span>
        </div>
        
        {!ruleSet.is_common && (
          <div>
            <button onClick={(e) => { e.stopPropagation(); handleEditRuleSet(ruleSet); }}>Edit</button>
            <button onClick={(e) => { e.stopPropagation(); handleDeleteRuleSet(ruleSet.id); }}>Delete</button>
          </div>
        )}
      </div>
    </div>
  ))}
  
  <button onClick={() => setShowRuleSetModal(true)}>+ Create New Rule Set</button>
</div>

{/* Existing rules list - filter by selectedRuleSet */}
<div>
  <h3>Rules in "{selectedRuleSet?.name}"</h3>
  {/* Existing rules component */}
</div>
```

### 4. Update Rule Creation (Modify existing)

```typescript
// In newRule state, add:
rule_set_id: selectedRuleSet?.id || null

// In create rule modal, add:
<div>
  <label>Rule Set</label>
  <select
    value={newRule.rule_set_id || ''}
    onChange={(e) => setNewRule({ ...newRule, rule_set_id: parseInt(e.target.value) })}
  >
    {ruleSets.map(rs => (
      <option key={rs.id} value={rs.id}>
        {rs.name} {rs.is_common && '(Common)'}
      </option>
    ))}
  </select>
</div>
```

## Implementation Steps

### Step 1: Add Types
- Add RuleSet interface
- Update Rule interface to include rule_set_id

### Step 2: Add State
- Add rule set state variables
- Add rule set form state

### Step 3: Add API Functions
- loadRuleSets()
- createRuleSet()
- updateRuleSet()
- deleteRuleSet()

### Step 4: Add UI Components
- Rule Sets section (before existing rules)
- Create/Edit Rule Set modal
- Rule set selector in rule creation

### Step 5: Update Existing Logic
- Filter rules by selected rule set
- Include rule_set_id when creating rules
- Load rule sets when business class changes

## Minimal Changes Approach

To minimize risk:
1. Keep all existing functionality working
2. Add new features as additions, not replacements
3. Default to Common rule set if available
4. Graceful fallback if no rule sets exist

## Testing Checklist

- [ ] Load rule sets for business class
- [ ] Select different rule sets
- [ ] Create new rule set
- [ ] Edit rule set name/description
- [ ] Delete non-Common rule set
- [ ] Cannot delete Common rule set
- [ ] Create rule assigned to rule set
- [ ] Rules filtered by selected rule set
- [ ] Common rule set auto-selected on load

## Status

**Current**: Planning complete  
**Next**: Implement Step 1 (Add Types)

---

**Date**: March 4, 2026  
**Phase**: 3 - Frontend UI  
**Approach**: Incremental enhancement
