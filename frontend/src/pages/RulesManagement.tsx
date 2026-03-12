import { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../theme';

interface Rule {
  id: number;
  name: string;
  business_class: string | null;
  rule_type: string;
  field_name: string;
  reference_business_class: string | null;
  condition_expression: string | null;
  error_message: string;
  is_active: boolean;
  assignment_id: number | null;
  is_enabled: boolean;
  override_error_message: string | null;
  rule_set_id: number | null;
}

interface RuleSet {
  id: number;
  name: string;
  business_class: string;
  description: string | null;
  is_common: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  rule_count: number;
}

const RulesManagement = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBusinessClass, setSelectedBusinessClass] = useState<string>('all');
  const [availableBusinessClasses, setAvailableBusinessClasses] = useState<string[]>([]);
  const [newRule, setNewRule] = useState({
    name: '',
    business_class: '',
    rule_type: 'REFERENCE_EXISTS',
    field_name: '',
    reference_business_class: '',
    reference_field_name: '',
    condition_expression: '',
    error_message: '',
    is_active: true,
    rule_set_id: null as number | null,
    enum_values: '',
    pattern: ''
  });

  // Rule Sets state
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [selectedRuleSet, setSelectedRuleSet] = useState<RuleSet | null>(null);
  const [showRuleSetModal, setShowRuleSetModal] = useState(false);
  const [editingRuleSet, setEditingRuleSet] = useState<RuleSet | null>(null);
  const [ruleSetFormData, setRuleSetFormData] = useState({
    name: '',
    description: '',
    is_active: true
  });

  // Field View state
  const [showFieldView, setShowFieldView] = useState(false);
  const [fieldViewData, setFieldViewData] = useState<any>(null);
  const [loadingFields, setLoadingFields] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [selectedField, setSelectedField] = useState<any>(null);
  const [availableReferenceClasses, setAvailableReferenceClasses] = useState<string[]>([]);
  const [referenceClassSearch, setReferenceClassSearch] = useState('');
  const [availableReferenceFields, setAvailableReferenceFields] = useState<string[]>([]);
  const [loadingReferenceFields, setLoadingReferenceFields] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState<number | null>(null);

  const account = JSON.parse(localStorage.getItem('account') || '{}');

  useEffect(() => {
    loadAvailableBusinessClasses();
    loadAvailableReferenceClasses();
  }, []);

  useEffect(() => {
    loadRules();
    loadRuleSets();
  }, [selectedBusinessClass]);

  const loadAvailableBusinessClasses = async () => {
    try {
      const response = await api.get('/schema/list');
      const schemas = response.data.schemas || [];
      
      // Extract unique business classes from schemas
      const businessClasses = [...new Set(schemas.map((s: any) => s.business_class))];
      setAvailableBusinessClasses(businessClasses);
      
      // If no business class selected and we have schemas, select the first one
      if (selectedBusinessClass === 'all' && businessClasses.length > 0) {
        setSelectedBusinessClass(businessClasses[0]);
      }
    } catch (error) {
      console.error('Failed to load business classes:', error);
    }
  };

  const loadAvailableReferenceClasses = async () => {
    try {
      const response = await api.get('/snapshot/setup-classes');
      const setupClasses = response.data || [];
      
      // Extract business class names from setup classes
      const referenceClasses = setupClasses.map((cls: any) => cls.name);
      setAvailableReferenceClasses(referenceClasses);
    } catch (error) {
      console.error('Failed to load reference classes:', error);
    }
  };

  const loadReferenceFields = async (businessClass: string) => {
    if (!businessClass) {
      setAvailableReferenceFields([]);
      return;
    }

    setLoadingReferenceFields(true);
    try {
      const response = await api.get(`/schema/${businessClass}/fields`);
      const fields = response.data.fields || [];
      setAvailableReferenceFields(fields);
    } catch (error) {
      console.error(`Failed to load fields for ${businessClass}:`, error);
      setAvailableReferenceFields([]);
    } finally {
      setLoadingReferenceFields(false);
    }
  };

  const loadRules = async () => {
    try {
      setLoading(true);
      const businessClass = selectedBusinessClass === 'all' ? null : selectedBusinessClass;
      const response = await api.get(`/rules/account/${account.id}`, {
        params: { business_class: businessClass }
      });
      setRules(response.data);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRuleSets = async () => {
    try {
      const businessClass = selectedBusinessClass === 'all' || selectedBusinessClass === '' ? null : selectedBusinessClass;
      const response = await api.get('/rules/rule-sets', {
        params: { business_class: businessClass }
      });
      setRuleSets(response.data);
      
      // Auto-select Default rule set if available
      const defaultRuleSet = response.data.find((rs: RuleSet) => rs.is_common);
      if (defaultRuleSet && !selectedRuleSet) {
        setSelectedRuleSet(defaultRuleSet);
      }
    } catch (error) {
      console.error('Failed to load rule sets:', error);
    }
  };

  const handleCreateRule = async () => {
    try {
      // Create rule template
      const ruleData = {
        ...newRule,
        business_class: newRule.business_class || null,
        reference_business_class: newRule.reference_business_class || null,
        condition_expression: newRule.condition_expression || null,
        rule_set_id: newRule.rule_set_id
      };
      
      await api.post('/rules/templates', ruleData);
      
      // Reset form
      setNewRule({
        name: '',
        business_class: '',
        rule_type: 'REFERENCE_EXISTS',
        field_name: '',
        reference_business_class: '',
        reference_field_name: '',
        condition_expression: '',
        error_message: '',
        is_active: true,
        rule_set_id: selectedRuleSet?.id || null,
        enum_values: '',
        pattern: ''
      });
      
      setShowCreateModal(false);
      loadRules();
      loadRuleSets(); // Refresh rule counts
    } catch (error: any) {
      alert(`Failed to create rule: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleCreateRuleSet = async () => {
    try {
      if (!ruleSetFormData.name.trim()) {
        alert('Rule set name is required');
        return;
      }

      const businessClass = selectedBusinessClass === 'all' || selectedBusinessClass === '' ? '' : selectedBusinessClass;
      if (!businessClass) {
        alert('Please select a business class first');
        return;
      }

      await api.post('/rules/rule-sets', {
        ...ruleSetFormData,
        business_class: businessClass
      });

      setRuleSetFormData({ name: '', description: '', is_active: true });
      setShowRuleSetModal(false);
      loadRuleSets();
    } catch (error: any) {
      alert(`Failed to create rule set: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleUpdateRuleSet = async () => {
    try {
      if (!editingRuleSet) return;

      await api.put(`/rules/rule-sets/${editingRuleSet.id}`, ruleSetFormData);

      setRuleSetFormData({ name: '', description: '', is_active: true });
      setEditingRuleSet(null);
      setShowRuleSetModal(false);
      loadRuleSets();
    } catch (error: any) {
      alert(`Failed to update rule set: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleEditRuleSet = (ruleSet: RuleSet) => {
    setEditingRuleSet(ruleSet);
    setRuleSetFormData({
      name: ruleSet.name,
      description: ruleSet.description || '',
      is_active: ruleSet.is_active
    });
    setShowRuleSetModal(true);
  };

  const handleDeleteRuleSet = async (ruleSetId: number) => {
    if (!confirm('Are you sure you want to delete this rule set? This will also delete all rules in this set.')) {
      return;
    }

    try {
      await api.delete(`/rules/rule-sets/${ruleSetId}`);
      loadRuleSets();
      if (selectedRuleSet?.id === ruleSetId) {
        setSelectedRuleSet(null);
      }
    } catch (error: any) {
      alert(`Failed to delete rule set: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDuplicateRuleSet = async (ruleSet: RuleSet) => {
    // Find the next available Custom number
    let customNumber = 1;
    let newName = `Custom${customNumber}`;
    
    // Check if name already exists and increment until we find an available name
    while (ruleSets.some(rs => rs.name === newName)) {
      customNumber++;
      newName = `Custom${customNumber}`;
    }
    
    const userProvidedName = prompt(`Enter name for duplicated rule set:`, newName);
    
    if (!userProvidedName || userProvidedName.trim() === '') {
      return;
    }

    try {
      // Create new rule set with same properties
      const response = await api.post('/rules/rule-sets', {
        name: userProvidedName.trim(),
        business_class: ruleSet.business_class,
        description: ruleSet.description ? `${ruleSet.description} (Duplicated)` : 'Duplicated rule set',
        is_active: ruleSet.is_active
      });

      const newRuleSetId = response.data.id;

      // Get all rules from the original rule set
      const rulesResponse = await api.get(`/rules/rule-sets/${ruleSet.id}/rules`);
      const rules = rulesResponse.data;

      // Duplicate each rule to the new rule set
      for (const rule of rules) {
        await api.post('/rules/templates', {
          name: rule.name,
          business_class: rule.business_class,
          rule_set_id: newRuleSetId,
          rule_type: rule.rule_type,
          field_name: rule.field_name,
          reference_business_class: rule.reference_business_class,
          reference_field_name: rule.reference_field_name,
          condition_expression: rule.condition_expression,
          error_message: rule.error_message,
          is_active: rule.is_active,
          pattern: rule.pattern,
          enum_values: rule.enum_values
        });
      }

      alert(`✅ Rule set duplicated successfully with ${rules.length} rules`);
      loadRuleSets();
      setShowMoreMenu(null);
    } catch (error: any) {
      alert(`Failed to duplicate rule set: ${error.response?.data?.detail || error.message}`);
    }
  };

  const loadRuleSetFields = async (ruleSetId: number) => {
    setLoadingFields(true);
    try {
      const response = await api.get(`/rules/rule-sets/${ruleSetId}/fields`);
      setFieldViewData(response.data);
      setShowFieldView(true);
    } catch (error: any) {
      console.error('Failed to load rule set fields:', error);
      alert(`Failed to load fields: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoadingFields(false);
    }
  };

  const handleAddRuleToField = async () => {
    if (!selectedField || !fieldViewData) return;

    try {
      // Create rule with field name from selected field
      const ruleData: any = {
        name: `${selectedField.field_name} ${newRule.rule_type}`,
        business_class: fieldViewData.business_class,
        rule_set_id: fieldViewData.rule_set_id,
        rule_type: newRule.rule_type,
        field_name: selectedField.field_name,
        reference_business_class: newRule.reference_business_class || null,
        reference_field_name: newRule.reference_field_name || null,
        condition_expression: null,
        error_message: newRule.error_message,
        is_active: true
      };

      // Add type-specific fields
      if (newRule.rule_type === 'PATTERN_MATCH') {
        ruleData.pattern = newRule.pattern;
        ruleData.condition_expression = newRule.pattern; // Store pattern in condition_expression for backend
      } else if (newRule.rule_type === 'ENUM_VALIDATION') {
        ruleData.enum_values = newRule.enum_values;
      }

      await api.post('/rules/templates', ruleData);

      // Reset form
      setNewRule({
        name: '',
        business_class: '',
        rule_type: 'REFERENCE_EXISTS',
        field_name: '',
        reference_business_class: '',
        reference_field_name: '',
        condition_expression: '',
        error_message: '',
        is_active: true,
        rule_set_id: null,
        enum_values: '',
        pattern: ''
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

  const handleToggleRule = async (rule: Rule) => {
    try {
      if (rule.assignment_id) {
        // Update existing assignment
        await api.put(`/rules/assignments/${rule.assignment_id}`, {
          is_enabled: !rule.is_enabled
        });
      } else {
        // Create new assignment
        await api.post('/rules/assignments', {
          rule_template_id: rule.id,
          account_id: account.id,
          is_enabled: true
        });
      }
      loadRules();
    } catch (error: any) {
      alert(`Failed to toggle rule: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this rule? This will remove it for all accounts.')) {
      return;
    }
    
    try {
      await api.delete(`/rules/templates/${ruleId}`);
      loadRules();
    } catch (error: any) {
      alert(`Failed to delete rule: ${error.response?.data?.detail || error.message}`);
    }
  };

  const getRuleTypeColor = (ruleType: string) => {
    const colors: Record<string, string> = {
      'REFERENCE_EXISTS': '#2196F3',
      'REQUIRED_OVERRIDE': '#FFA500',
      'NUMERIC_COMPARISON': '#9C27B0',
      'DATE_COMPARISON': '#4CAF50',
      'PATTERN_MATCH': '#FF5722'
    };
    return colors[ruleType] || '#666666';
  };

  const getScopeLabel = (businessClass: string | null) => {
    if (!businessClass) return 'GLOBAL';
    return businessClass;
  };

  // Filter rules by selected rule set
  const filteredRules = selectedRuleSet 
    ? rules.filter(rule => rule.rule_set_id === selectedRuleSet.id)
    : rules;

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading rules...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Validation Rules</h1>
      </div>

      <div style={styles.filters}>
        <label style={styles.filterLabel}>
          Business Class:
          <select
            value={selectedBusinessClass}
            onChange={(e) => setSelectedBusinessClass(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">All Classes</option>
            <option value="">GLOBAL</option>
            {availableBusinessClasses.map((businessClass) => (
              <option key={businessClass} value={businessClass}>
                {businessClass}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Rule Sets Section */}
      {selectedBusinessClass !== 'all' && (
        <div style={styles.ruleSetsSection}>
          <div style={styles.ruleSetsHeader}>
            <h3 style={styles.sectionTitle}>Rule Sets</h3>
            <button 
              onClick={() => {
                setEditingRuleSet(null);
                setRuleSetFormData({ name: '', description: '', is_active: true });
                setShowRuleSetModal(true);
              }} 
              style={styles.createRuleSetButton}
            >
              + Create Rule Set
            </button>
          </div>

          {ruleSets.length === 0 ? (
            <div style={styles.emptyRuleSets}>
              <div style={styles.emptyIcon}>📁</div>
              <div style={styles.emptyText}>No rule sets found for this business class</div>
              <div style={styles.emptySubtext}>Create your first rule set to organize validation rules</div>
            </div>
          ) : (
            <div style={styles.ruleSetsGrid}>
              {ruleSets.map((ruleSet) => (
                <div
                  key={ruleSet.id}
                  style={{
                    ...styles.ruleSetCard,
                    ...(selectedRuleSet?.id === ruleSet.id ? styles.ruleSetCardSelected : {})
                  }}
                  onClick={() => setSelectedRuleSet(ruleSet)}
                >
                  <div style={styles.ruleSetCardHeader}>
                    <div style={styles.ruleSetInfo}>
                      <span style={styles.ruleSetIndicator}>
                        {ruleSet.is_common ? '●' : '○'}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={styles.ruleSetName}>{ruleSet.name}</span>
                          {ruleSet.is_common && (
                            <span style={styles.commonBadge}>Always Applied</span>
                          )}
                        </div>
                        <span style={styles.ruleCount}>{ruleSet.rule_count} rules</span>
                      </div>
                    </div>
                  </div>

                  {ruleSet.description && (
                    <div style={styles.ruleSetDescription}>{ruleSet.description}</div>
                  )}

                  <div style={styles.ruleSetActions}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        loadRuleSetFields(ruleSet.id);
                      }}
                      style={styles.viewButton}
                    >
                      👁️ View
                    </button>
                    {ruleSet.is_common ? (
                      // Default rule set: Show Duplicate button directly
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateRuleSet(ruleSet);
                        }}
                        style={styles.duplicateButton}
                      >
                        📋 Duplicate
                      </button>
                    ) : (
                      // Custom rule sets: Show Edit, Delete, and More menu
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditRuleSet(ruleSet);
                          }}
                          style={styles.editButton}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRuleSet(ruleSet.id);
                          }}
                          style={styles.deleteButtonSmall}
                        >
                          🗑️ Delete
                        </button>
                        <div style={{ position: 'relative' as const }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMoreMenu(showMoreMenu === ruleSet.id ? null : ruleSet.id);
                            }}
                            style={styles.moreButton}
                            id={`more-button-${ruleSet.id}`}
                          >
                            ⋮
                          </button>
                          {showMoreMenu === ruleSet.id && (
                            <>
                              <div
                                style={styles.menuOverlay}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowMoreMenu(null);
                                }}
                              />
                              <div 
                                style={{
                                  ...styles.dropdownMenu,
                                  top: (() => {
                                    const button = document.getElementById(`more-button-${ruleSet.id}`);
                                    if (button) {
                                      const rect = button.getBoundingClientRect();
                                      return `${rect.bottom + 4}px`;
                                    }
                                    return '0px';
                                  })(),
                                  left: (() => {
                                    const button = document.getElementById(`more-button-${ruleSet.id}`);
                                    if (button) {
                                      const rect = button.getBoundingClientRect();
                                      return `${rect.right - 150}px`; // 150px is minWidth of menu
                                    }
                                    return '0px';
                                  })(),
                                }}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateRuleSet(ruleSet);
                                  }}
                                  style={styles.menuItem}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  📋 Duplicate
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Rule Set Modal */}
      {showRuleSetModal && (
        <div style={styles.modalOverlay} onClick={() => {
          setShowRuleSetModal(false);
          setEditingRuleSet(null);
        }}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>
              {editingRuleSet ? 'Edit Rule Set' : 'Create Rule Set'}
            </h2>

            <div style={styles.formGroup}>
              <label style={styles.label}>Rule Set Name</label>
              <input
                type="text"
                value={ruleSetFormData.name}
                onChange={(e) => setRuleSetFormData({ ...ruleSetFormData, name: e.target.value })}
                style={styles.input}
                placeholder="e.g., Legacy System Import"
                disabled={editingRuleSet?.is_common}
              />
              {editingRuleSet?.is_common && (
                <div style={styles.helpText}>
                  ⚠️ Default rule set name cannot be changed
                </div>
              )}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                value={ruleSetFormData.description}
                onChange={(e) => setRuleSetFormData({ ...ruleSetFormData, description: e.target.value })}
                style={{ ...styles.input, minHeight: '80px' }}
                placeholder="Describe when this rule set should be used..."
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={ruleSetFormData.is_active}
                  onChange={(e) => setRuleSetFormData({ ...ruleSetFormData, is_active: e.target.checked })}
                  style={styles.toggleCheckbox}
                  disabled={editingRuleSet?.is_common}
                />
                <span style={styles.toggleText}>Active</span>
              </label>
              {editingRuleSet?.is_common && (
                <div style={styles.helpText}>
                  ⚠️ Default rule set cannot be deactivated
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button 
                onClick={() => {
                  setShowRuleSetModal(false);
                  setEditingRuleSet(null);
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={editingRuleSet ? handleUpdateRuleSet : handleCreateRuleSet} 
                style={styles.saveButton}
              >
                {editingRuleSet ? 'Update' : 'Create'} Rule Set
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field View Modal */}
      {showFieldView && fieldViewData && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setShowFieldView(false)}
            style={{
              position: 'fixed' as const,
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
            position: 'fixed' as const,
            top: 0,
            right: 0,
            bottom: 0,
            width: '90%',
            maxWidth: '1200px',
            backgroundColor: theme.background.secondary,
            zIndex: 1000,
            overflowY: 'auto' as const,
            boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Header */}
            <div style={{
              position: 'sticky' as const,
              top: 0,
              backgroundColor: theme.background.tertiary,
              padding: '20px',
              borderBottom: `1px solid ${theme.background.quaternary}`,
              zIndex: 10
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: theme.text.primary }}>
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
                    fontSize: '18px',
                    color: theme.text.primary
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Table */}
            <div style={{ padding: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ backgroundColor: theme.background.tertiary, borderBottom: `2px solid ${theme.background.quaternary}` }}>
                    <th style={{ padding: '12px', textAlign: 'left' as const, fontSize: '14px', color: theme.text.secondary, fontWeight: '600' }}>
                      Field Name
                    </th>
                    <th style={{ padding: '12px', textAlign: 'center' as const, fontSize: '14px', color: theme.text.secondary, fontWeight: '600', width: '80px' }}>
                      Type
                    </th>
                    <th style={{ padding: '12px', textAlign: 'center' as const, fontSize: '14px', color: theme.text.secondary, fontWeight: '600', width: '100px' }}>
                      Required
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left' as const, fontSize: '14px', color: theme.text.secondary, fontWeight: '600' }}>
                      Rules
                    </th>
                    {!fieldViewData.is_common && (
                      <th style={{ padding: '12px', textAlign: 'center' as const, fontSize: '14px', color: theme.text.secondary, fontWeight: '600', width: '80px' }}>
                        Actions
                      </th>
                    )}
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
                        <div style={{ fontWeight: field.required ? 'bold' : 'normal', color: theme.text.primary }}>
                          {field.field_name}
                        </div>
                        {field.description && (
                          <div style={{ fontSize: '12px', color: theme.text.tertiary, marginTop: '4px' }}>
                            {field.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' as const, fontSize: '12px', color: theme.text.tertiary }}>
                        {field.field_type}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' as const }}>
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
                          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px' }}>
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
                      {!fieldViewData.is_common && (
                        <td style={{ padding: '12px', textAlign: 'center' as const }}>
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
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.primary.dark}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.primary.main}
                            title="Add rule to this field"
                          >
                            +
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Rule Modal */}
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
              <>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Reference Business Class</label>
                  <input
                    type="text"
                    list="reference-classes"
                    value={newRule.reference_business_class}
                    onChange={(e) => {
                      const selectedClass = e.target.value;
                      setNewRule({ ...newRule, reference_business_class: selectedClass, reference_field_name: '' });
                      setReferenceClassSearch(selectedClass);
                      // Load fields for selected class
                      if (selectedClass) {
                        loadReferenceFields(selectedClass);
                      } else {
                        setAvailableReferenceFields([]);
                      }
                    }}
                    style={styles.input}
                    placeholder="Type to search... (e.g., Account, Vendor, Customer)"
                  />
                  <datalist id="reference-classes">
                    {availableReferenceClasses
                      .filter(cls => 
                        cls.toLowerCase().includes((newRule.reference_business_class || '').toLowerCase())
                      )
                      .map(cls => (
                        <option key={cls} value={cls} />
                      ))
                    }
                  </datalist>
                  <div style={styles.helpText}>
                    The FSM business class to check against (must be synced in Setup Data)
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Reference Field Name</label>
                  <input
                    type="text"
                    list="reference-fields"
                    value={newRule.reference_field_name}
                    onChange={(e) => setNewRule({ ...newRule, reference_field_name: e.target.value })}
                    style={{
                      ...styles.input,
                      backgroundColor: !newRule.reference_business_class ? '#f5f5f5' : styles.input.backgroundColor,
                      cursor: !newRule.reference_business_class ? 'not-allowed' : 'text'
                    }}
                    placeholder={
                      !newRule.reference_business_class 
                        ? "Select a Reference Business Class first" 
                        : loadingReferenceFields
                        ? "Loading fields..."
                        : "Type to search... (e.g., Account, Vendor)"
                    }
                    disabled={!newRule.reference_business_class || loadingReferenceFields}
                  />
                  <datalist id="reference-fields">
                    {availableReferenceFields
                      .filter(field => 
                        field.toLowerCase().includes((newRule.reference_field_name || '').toLowerCase())
                      )
                      .map(field => (
                        <option key={field} value={field} />
                      ))
                    }
                  </datalist>
                  <div style={styles.helpText}>
                    {!newRule.reference_business_class 
                      ? "Select a Reference Business Class to see available fields"
                      : loadingReferenceFields
                      ? "Loading fields from schema..."
                      : `The key field name in the ${newRule.reference_business_class} class. Example: "AccountCode" in GLTransactionInterface checks against "Account" field in Account class.`
                    }
                  </div>
                </div>
              </>
            )}

            {newRule.rule_type === 'PATTERN_MATCH' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Regex Pattern</label>
                <input
                  type="text"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                  style={styles.input}
                  placeholder="e.g., ^\d{8}$ for YYYYMMDD dates"
                />
                <div style={styles.helpText}>
                  Regular expression pattern to validate the field format
                </div>
              </div>
            )}

            {newRule.rule_type === 'ENUM_VALIDATION' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Allowed Values (comma-separated)</label>
                <input
                  type="text"
                  value={newRule.enum_values}
                  onChange={(e) => setNewRule({ ...newRule, enum_values: e.target.value })}
                  style={styles.input}
                  placeholder='e.g., 0, 1 or Active, Inactive, Pending'
                />
                <div style={styles.helpText}>
                  List of valid values separated by commas (case-sensitive)
                </div>
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Error Message</label>
              <textarea
                value={newRule.error_message}
                onChange={(e) => setNewRule({ ...newRule, error_message: e.target.value })}
                style={{ ...styles.input, minHeight: '80px' }}
                placeholder={
                  newRule.rule_type === 'REFERENCE_EXISTS'
                    ? `${selectedField.field_name} does not exist in FSM`
                    : newRule.rule_type === 'REQUIRED_OVERRIDE'
                    ? `${selectedField.field_name} is required`
                    : newRule.rule_type === 'PATTERN_MATCH'
                    ? `${selectedField.field_name} must match the required format`
                    : newRule.rule_type === 'ENUM_VALIDATION'
                    ? `${selectedField.field_name} must be one of the allowed values`
                    : `Validation failed for ${selectedField.field_name}`
                }
              />
              <div style={styles.helpText}>
                Message shown when validation fails. The actual field value will be included automatically.
              </div>
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
    </div>
  );
};

const styles = {
  container: {
    padding: '40px',
    minHeight: '100vh',
    backgroundColor: theme.background.primary,
    color: theme.text.primary,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
  },
  title: {
    fontSize: '32px',
    fontWeight: '700' as const,
    color: theme.text.primary,
  },
  createButton: {
    padding: '12px 24px',
    backgroundColor: theme.primary.main,
    color: theme.background.secondary,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600' as const,
  },
  filters: {
    marginBottom: '30px',
  },
  filterLabel: {
    color: theme.text.primary,
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  filterSelect: {
    padding: '8px 12px',
    backgroundColor: theme.background.secondary,
    color: theme.text.primary,
    border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '4px',
    fontSize: '14px',
    marginLeft: '10px',
  },
  rulesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: '20px',
  },
  ruleCard: {
    backgroundColor: theme.background.secondary,
    border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '8px',
    padding: '20px',
  },
  ruleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    paddingBottom: '15px',
    borderBottom: `1px solid ${theme.background.quaternary}`,
  },
  ruleName: {
    fontSize: '18px',
    fontWeight: '600' as const,
    color: theme.text.primary,
  },
  ruleActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  toggleCheckbox: {
    cursor: 'pointer',
  },
  toggleText: {
    color: theme.text.secondary,
    fontSize: '14px',
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '4px',
  },
  ruleDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  ruleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  ruleLabel: {
    color: '#999999',
    fontSize: '14px',
    minWidth: '80px',
  },
  ruleValue: {
    color: theme.text.primary,
    fontSize: '14px',
    flex: 1,
  },
  scopeBadge: {
    padding: '4px 12px',
    backgroundColor: theme.background.tertiary,
    color: theme.text.primary,
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600' as const,
  },
  typeBadge: {
    padding: '4px 12px',
    color: theme.background.secondary,
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600' as const,
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center' as const,
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  emptyText: {
    fontSize: '20px',
    color: theme.text.primary,
    marginBottom: '10px',
  },
  emptySubtext: {
    fontSize: '16px',
    color: theme.text.secondary,
  },
  loading: {
    textAlign: 'center' as const,
    padding: '60px',
    fontSize: '18px',
    color: theme.text.secondary,
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: theme.background.secondary,
    border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '8px',
    padding: '30px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: '600' as const,
    color: theme.text.primary,
    marginBottom: '20px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    color: theme.text.primary,
    fontSize: '14px',
    marginBottom: '8px',
    fontWeight: '500' as const,
  },
  input: {
    width: '100%',
    padding: '10px',
    backgroundColor: theme.background.secondary,
    color: theme.text.primary,
    border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '30px',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: theme.background.secondary,
    color: theme.text.primary,
    border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: theme.primary.main,
    color: theme.background.secondary,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600' as const,
  },
  ruleSetsSection: {
    marginBottom: '40px',
    padding: '20px',
    backgroundColor: theme.background.secondary,
    border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '8px',
    overflow: 'visible' as const,
  },
  ruleSetsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600' as const,
    color: theme.text.primary,
    margin: 0,
  },
  createRuleSetButton: {
    padding: '8px 16px',
    backgroundColor: theme.background.secondary,
    color: theme.text.primary,
    border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  ruleSetsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '15px',
    overflow: 'visible' as const,
  },
  ruleSetCard: {
    padding: '20px',
    backgroundColor: theme.background.secondary,
    border: `2px solid ${theme.background.quaternary}`,
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    overflow: 'visible' as const,
  },
  ruleSetCardSelected: {
    border: `2px solid ${theme.primary.main}`,
    backgroundColor: theme.accent.purpleTintLight,
  },
  ruleSetCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  ruleSetInfo: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    flex: 1,
  },
  ruleSetIndicator: {
    fontSize: '18px',
    color: theme.primary.main,
  },
  ruleSetName: {
    fontSize: '17px',
    fontWeight: '600' as const,
    color: theme.text.primary,
  },
  commonBadge: {
    padding: '3px 10px',
    backgroundColor: theme.primary.main,
    color: theme.background.secondary,
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600' as const,
  },
  ruleCount: {
    fontSize: '14px',
    color: theme.text.secondary,
    fontWeight: '500' as const,
  },
  ruleSetDescription: {
    fontSize: '14px',
    color: theme.text.secondary,
    marginBottom: '15px',
    lineHeight: '1.5',
  },
  ruleSetActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '15px',
    paddingTop: '15px',
    borderTop: `1px solid ${theme.background.quaternary}`,
    overflow: 'visible' as const,
  },
  editButton: {
    padding: '6px 10px',
    backgroundColor: theme.background.secondary,
    color: theme.text.primary,
    border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    whiteSpace: 'nowrap' as const,
  },
  deleteButtonSmall: {
    padding: '6px 10px',
    backgroundColor: theme.background.secondary,
    color: theme.text.primary,
    border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    whiteSpace: 'nowrap' as const,
  },
  viewButton: {
    padding: '6px 10px',
    backgroundColor: theme.primary.main,
    color: theme.background.secondary,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600' as const,
    whiteSpace: 'nowrap' as const,
  },
  duplicateButton: {
    padding: '6px 10px',
    backgroundColor: theme.background.secondary,
    color: theme.text.primary,
    border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    whiteSpace: 'nowrap' as const,
  },
  moreButton: {
    padding: '6px 10px',
    backgroundColor: theme.background.secondary,
    color: theme.text.primary,
    border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    lineHeight: '1',
  },
  menuOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  dropdownMenu: {
    position: 'fixed' as const,
    backgroundColor: theme.background.secondary,
    border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
    minWidth: '150px',
  },
  menuItem: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: 'transparent',
    color: theme.text.primary,
    border: 'none',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background-color 0.2s',
  },
  emptyRuleSets: {
    textAlign: 'center' as const,
    padding: '40px 20px',
  },
  rulesSection: {
    marginBottom: '20px',
  },
  helpText: {
    fontSize: '12px',
    color: theme.text.secondary,
    marginTop: '5px',
  },
};

export default RulesManagement;
