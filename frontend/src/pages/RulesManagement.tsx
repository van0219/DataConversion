import { useState, useEffect } from 'react';
import api from '../services/api';

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
  const [newRule, setNewRule] = useState({
    name: '',
    business_class: '',
    rule_type: 'REFERENCE_EXISTS',
    field_name: '',
    reference_business_class: '',
    condition_expression: '',
    error_message: '',
    is_active: true,
    rule_set_id: null as number | null
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

  const account = JSON.parse(localStorage.getItem('account') || '{}');

  useEffect(() => {
    loadRules();
    loadRuleSets();
  }, [selectedBusinessClass]);

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
      
      // Auto-select Common rule set if available
      const common = response.data.find((rs: RuleSet) => rs.is_common);
      if (common && !selectedRuleSet) {
        setSelectedRuleSet(common);
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
        condition_expression: '',
        error_message: '',
        is_active: true,
        rule_set_id: selectedRuleSet?.id || null
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
        <button onClick={() => setShowCreateModal(true)} style={styles.createButton}>
          + Create Rule
        </button>
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
            <option value="GLTransactionInterface">GLTransactionInterface</option>
            <option value="PayablesInvoice">PayablesInvoice</option>
            <option value="Vendor">Vendor</option>
            <option value="Customer">Customer</option>
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
                      <span style={styles.ruleSetName}>{ruleSet.name}</span>
                      {ruleSet.is_common && (
                        <span style={styles.commonBadge}>Always Applied</span>
                      )}
                    </div>
                    <span style={styles.ruleCount}>{ruleSet.rule_count} rules</span>
                  </div>

                  {ruleSet.description && (
                    <div style={styles.ruleSetDescription}>{ruleSet.description}</div>
                  )}

                  {!ruleSet.is_common && (
                    <div style={styles.ruleSetActions}>
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rules Section */}
      {selectedRuleSet && (
        <div style={styles.rulesSection}>
          <h3 style={styles.sectionTitle}>
            Rules in "{selectedRuleSet.name}" ({filteredRules.length})
          </h3>
        </div>
      )}

      <div style={styles.rulesGrid}>
        {filteredRules.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📋</div>
            <div style={styles.emptyText}>No validation rules found</div>
            <div style={styles.emptySubtext}>
              {selectedRuleSet 
                ? `Create your first rule in "${selectedRuleSet.name}" rule set`
                : 'Select a rule set to view its rules'}
            </div>
          </div>
        ) : (
          filteredRules.map((rule) => (
            <div key={rule.id} style={styles.ruleCard}>
              <div style={styles.ruleHeader}>
                <div style={styles.ruleName}>{rule.name}</div>
                <div style={styles.ruleActions}>
                  <label style={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={rule.is_enabled}
                      onChange={() => handleToggleRule(rule)}
                      style={styles.toggleCheckbox}
                    />
                    <span style={styles.toggleText}>
                      {rule.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    style={styles.deleteButton}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div style={styles.ruleDetails}>
                <div style={styles.ruleRow}>
                  <span style={styles.ruleLabel}>Scope:</span>
                  <span style={styles.scopeBadge}>
                    {getScopeLabel(rule.business_class)}
                  </span>
                </div>

                <div style={styles.ruleRow}>
                  <span style={styles.ruleLabel}>Type:</span>
                  <span style={{
                    ...styles.typeBadge,
                    backgroundColor: getRuleTypeColor(rule.rule_type)
                  }}>
                    {rule.rule_type}
                  </span>
                </div>

                <div style={styles.ruleRow}>
                  <span style={styles.ruleLabel}>Field:</span>
                  <span style={styles.ruleValue}>{rule.field_name}</span>
                </div>

                {rule.reference_business_class && (
                  <div style={styles.ruleRow}>
                    <span style={styles.ruleLabel}>Reference:</span>
                    <span style={styles.ruleValue}>{rule.reference_business_class}</span>
                  </div>
                )}

                <div style={styles.ruleRow}>
                  <span style={styles.ruleLabel}>Error:</span>
                  <span style={styles.ruleValue}>
                    {rule.override_error_message || rule.error_message}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Create Validation Rule</h2>

            <div style={styles.formGroup}>
              <label style={styles.label}>Rule Name</label>
              <input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                style={styles.input}
                placeholder="e.g., Vendor Must Exist"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Scope</label>
              <select
                value={newRule.business_class}
                onChange={(e) => setNewRule({ ...newRule, business_class: e.target.value })}
                style={styles.input}
              >
                <option value="">GLOBAL (all business classes)</option>
                <option value="GLTransactionInterface">GLTransactionInterface</option>
                <option value="PayablesInvoice">PayablesInvoice</option>
                <option value="Vendor">Vendor</option>
                <option value="Customer">Customer</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Rule Set</label>
              <select
                value={newRule.rule_set_id || ''}
                onChange={(e) => setNewRule({ ...newRule, rule_set_id: e.target.value ? parseInt(e.target.value) : null })}
                style={styles.input}
              >
                <option value="">Select rule set...</option>
                {ruleSets.map((rs) => (
                  <option key={rs.id} value={rs.id}>
                    {rs.name} {rs.is_common && '(Common - Always Applied)'}
                  </option>
                ))}
              </select>
              <div style={styles.helpText}>
                {ruleSets.find(rs => rs.is_common) && (
                  <span>💡 Common rules apply to all conversions. Optional rules apply only when selected.</span>
                )}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Rule Type</label>
              <select
                value={newRule.rule_type}
                onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
                style={styles.input}
              >
                <option value="REFERENCE_EXISTS">REFERENCE_EXISTS</option>
                <option value="REQUIRED_OVERRIDE">REQUIRED_OVERRIDE</option>
                <option value="NUMERIC_COMPARISON">NUMERIC_COMPARISON (future)</option>
                <option value="DATE_COMPARISON">DATE_COMPARISON (future)</option>
                <option value="PATTERN_MATCH">PATTERN_MATCH (future)</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Field Name</label>
              <input
                type="text"
                value={newRule.field_name}
                onChange={(e) => setNewRule({ ...newRule, field_name: e.target.value })}
                style={styles.input}
                placeholder="e.g., Vendor"
              />
            </div>

            {newRule.rule_type === 'REFERENCE_EXISTS' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Reference Business Class</label>
                <input
                  type="text"
                  value={newRule.reference_business_class}
                  onChange={(e) => setNewRule({ ...newRule, reference_business_class: e.target.value })}
                  style={styles.input}
                  placeholder="e.g., Vendor"
                />
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Error Message</label>
              <textarea
                value={newRule.error_message}
                onChange={(e) => setNewRule({ ...newRule, error_message: e.target.value })}
                style={{ ...styles.input, minHeight: '80px' }}
                placeholder="e.g., Vendor '{value}' does not exist in FSM"
              />
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowCreateModal(false)} style={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={handleCreateRule} style={styles.saveButton}>
                Create Rule
              </button>
            </div>
          </div>
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
                  ⚠️ Common rule set name cannot be changed
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
                  ⚠️ Common rule set cannot be deactivated
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
    </div>
  );
};

const styles = {
  container: {
    padding: '40px',
    minHeight: '100vh',
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
    color: '#ffffff',
  },
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#C8102E',
    color: '#ffffff',
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
    color: '#ffffff',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  filterSelect: {
    padding: '8px 12px',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    border: '1px solid #2a2a2a',
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
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    padding: '20px',
  },
  ruleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    paddingBottom: '15px',
    borderBottom: '1px solid #2a2a2a',
  },
  ruleName: {
    fontSize: '18px',
    fontWeight: '600' as const,
    color: '#ffffff',
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
    color: '#cccccc',
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
    color: '#ffffff',
    fontSize: '14px',
    flex: 1,
  },
  scopeBadge: {
    padding: '4px 12px',
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600' as const,
  },
  typeBadge: {
    padding: '4px 12px',
    color: '#ffffff',
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
    color: '#ffffff',
    marginBottom: '10px',
  },
  emptySubtext: {
    fontSize: '16px',
    color: '#999999',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '60px',
    fontSize: '18px',
    color: '#999999',
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
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
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
    color: '#ffffff',
    marginBottom: '20px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    color: '#ffffff',
    fontSize: '14px',
    marginBottom: '8px',
    fontWeight: '500' as const,
  },
  input: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    border: '1px solid #3a3a3a',
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
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    border: '1px solid #3a3a3a',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#C8102E',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600' as const,
  },
  ruleSetsSection: {
    marginBottom: '40px',
    padding: '20px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
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
    color: '#ffffff',
    margin: 0,
  },
  createRuleSetButton: {
    padding: '8px 16px',
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    border: '1px solid #3a3a3a',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  ruleSetsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '15px',
  },
  ruleSetCard: {
    padding: '15px',
    backgroundColor: '#1a1a1a',
    border: '2px solid #2a2a2a',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  ruleSetCardSelected: {
    borderColor: '#C8102E',
    backgroundColor: '#2a1a1a',
  },
  ruleSetCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  ruleSetInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  ruleSetIndicator: {
    fontSize: '16px',
    color: '#C8102E',
  },
  ruleSetName: {
    fontSize: '16px',
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  commonBadge: {
    padding: '2px 8px',
    backgroundColor: '#C8102E',
    color: '#ffffff',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600' as const,
  },
  ruleCount: {
    fontSize: '13px',
    color: '#999999',
  },
  ruleSetDescription: {
    fontSize: '13px',
    color: '#cccccc',
    marginBottom: '10px',
    lineHeight: '1.4',
  },
  ruleSetActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px solid #2a2a2a',
  },
  editButton: {
    padding: '6px 12px',
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    border: '1px solid #3a3a3a',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    flex: 1,
  },
  deleteButtonSmall: {
    padding: '6px 12px',
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    border: '1px solid #3a3a3a',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    flex: 1,
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
    color: '#999999',
    marginTop: '5px',
  },
};

export default RulesManagement;
