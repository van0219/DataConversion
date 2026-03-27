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

const RULE_TYPE_OPTIONS = [
  { value: 'REFERENCE_EXISTS',          label: 'Reference Exists',         description: 'Value must exist in a setup class' },
  { value: 'REQUIRED_OVERRIDE',         label: 'Required Field',           description: 'Field must not be empty' },
  { value: 'FIELD_MUST_BE_EMPTY',       label: 'Must Be Empty',            description: 'Field must be blank/null' },
  { value: 'PATTERN_MATCH',             label: 'Pattern Match',            description: 'Value must match a regex pattern' },
  { value: 'ENUM_VALIDATION',           label: 'Allowed Values',           description: 'Value must be from a fixed list' },
  { value: 'DATE_RANGE_FROM_REFERENCE', label: 'Date Range (Reference)',   description: 'Date must fall within a referenced record\'s date range' },
  { value: 'OPEN_PERIOD_CHECK',         label: 'Open Period Check',        description: 'Date must fall within the current open GL period' },
];

// File-level rules operate on the entire file, not on individual fields
const FILE_LEVEL_RULE_OPTIONS = [
  { value: 'BALANCE_CHECK', label: 'Balance Check', description: 'Group of records must net to zero (e.g. debits = credits per RunGroup)' },
];

const getDefaultErrorMessage = (ruleType: string, fieldName: string): string => {
  const map: Record<string, string> = {
    REFERENCE_EXISTS:          `${fieldName} does not exist in FSM`,
    REQUIRED_OVERRIDE:         `${fieldName} is required`,
    FIELD_MUST_BE_EMPTY:       `${fieldName} must be empty for this transaction type`,
    PATTERN_MATCH:             `${fieldName} does not match the required format`,
    ENUM_VALIDATION:           `${fieldName} must be one of the allowed values`,
    DATE_RANGE_FROM_REFERENCE: `${fieldName} is outside the allowed date range`,
    OPEN_PERIOD_CHECK:         `${fieldName} is not within the current open accounting period`,
    BALANCE_CHECK:             `Transactions in this group do not net to zero`,
  };
  return map[ruleType] || `Validation failed for ${fieldName}`;
};

// Shared dynamic config form rendered inside both Add and Edit modals
const RuleTypeConfig = ({
  form, setForm, availableReferenceClasses, availableReferenceFields,
  loadingReferenceFields, loadReferenceFields, fieldName
}: any) => {
  const inputStyle = {
    width: '100%', padding: '9px 12px', backgroundColor: theme.background.primary,
    color: theme.text.primary, border: `1px solid ${theme.background.quaternary}`,
    borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' as const,
  };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600 as const, color: theme.text.secondary, marginBottom: '5px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
  const helpStyle = { fontSize: '11px', color: theme.text.muted, marginTop: '4px' };
  const sectionStyle = { backgroundColor: theme.background.tertiary, border: `1px solid ${theme.background.quaternary}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' };
  const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' };

  if (form.rule_type === 'REFERENCE_EXISTS') return (
    <div style={sectionStyle}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: theme.text.primary, marginBottom: '12px' }}>Reference Configuration</div>
      <div style={gridStyle}>
        <div>
          <label style={labelStyle}>Reference Class</label>
          <input type="text" list="ref-classes-list" value={form.reference_business_class}
            onChange={(e) => { setForm({ ...form, reference_business_class: e.target.value, reference_field_name: '' }); loadReferenceFields(e.target.value); }}
            style={inputStyle} placeholder="e.g., Account, Vendor" />
          <datalist id="ref-classes-list">{availableReferenceClasses.map((c: string) => <option key={c} value={c} />)}</datalist>
          <div style={helpStyle}>Must be synced in Setup Data</div>
        </div>
        <div>
          <label style={labelStyle}>Reference Field</label>
          <select value={form.reference_field_name} onChange={(e) => setForm({ ...form, reference_field_name: e.target.value })}
            style={{ ...inputStyle, cursor: !form.reference_business_class ? 'not-allowed' : 'pointer' }}
            disabled={!form.reference_business_class || loadingReferenceFields}>
            <option value="">{loadingReferenceFields ? 'Loading...' : !form.reference_business_class ? 'Select class first' : '-- Select field --'}</option>
            {availableReferenceFields.map((f: string) => <option key={f} value={f}>{f}</option>)}
          </select>
          <div style={helpStyle}>Key field to match against</div>
        </div>
      </div>
      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${theme.background.quaternary}` }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: theme.text.tertiary, marginBottom: '8px' }}>Optional: Status Filter</div>
        <div style={gridStyle}>
          <div>
            <label style={labelStyle}>Filter Field</label>
            <input type="text" value={form.condition_filter_field}
              onChange={(e) => setForm({ ...form, condition_filter_field: e.target.value })}
              style={inputStyle} placeholder="e.g., Status" />
            <div style={helpStyle}>Field in the reference record to filter by</div>
          </div>
          <div>
            <label style={labelStyle}>Filter Value</label>
            <input type="text" value={form.condition_filter_value}
              onChange={(e) => setForm({ ...form, condition_filter_value: e.target.value })}
              style={inputStyle} placeholder="e.g., Active" />
            <div style={helpStyle}>Only match records with this value</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (form.rule_type === 'PATTERN_MATCH') return (
    <div style={sectionStyle}>
      <label style={labelStyle}>Regex Pattern</label>
      <input type="text" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })}
        style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="e.g., ^\d{8}$ for YYYYMMDD" />
      <div style={helpStyle}>Regular expression. The value must fully match this pattern.</div>
      <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
        {[['YYYYMMDD date', '^\\d{8}$'], ['Positive number', '^\\d+(\\.\\d+)?$'], ['Non-empty', '^.+$']].map(([label, val]) => (
          <button key={val} onClick={() => setForm({ ...form, pattern: val })}
            style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: theme.background.secondary, border: `1px solid ${theme.background.quaternary}`, borderRadius: '4px', cursor: 'pointer', color: theme.text.secondary }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  if (form.rule_type === 'ENUM_VALIDATION') return (
    <div style={sectionStyle}>
      <label style={labelStyle}>Allowed Values</label>
      <input type="text" value={form.enum_values} onChange={(e) => setForm({ ...form, enum_values: e.target.value })}
        style={inputStyle} placeholder="e.g., Active, Inactive, Pending" />
      <div style={helpStyle}>Comma-separated list of valid values (case-sensitive)</div>
      {form.enum_values && (
        <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' as const }}>
          {form.enum_values.split(',').map((v: string) => v.trim()).filter(Boolean).map((v: string) => (
            <span key={v} style={{ padding: '2px 8px', backgroundColor: theme.accent.purpleTintLight, color: theme.primary.main, borderRadius: '4px', fontSize: '12px', border: `1px solid ${theme.accent.purpleTintMedium}` }}>{v}</span>
          ))}
        </div>
      )}
    </div>
  );

  if (form.rule_type === 'DATE_RANGE_FROM_REFERENCE') return (
    <div style={sectionStyle}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: theme.text.primary, marginBottom: '4px' }}>Date Range Configuration</div>
      <div style={{ fontSize: '12px', color: theme.text.tertiary, marginBottom: '12px' }}>
        Checks that <strong>{fieldName}</strong> falls within the begin/end dates of a referenced record.
      </div>
      <div style={gridStyle}>
        <div>
          <label style={labelStyle}>Reference Class</label>
          <input type="text" list="dr-ref-classes" value={form.reference_business_class}
            onChange={(e) => setForm({ ...form, reference_business_class: e.target.value })}
            style={inputStyle} placeholder="e.g., Project" />
          <datalist id="dr-ref-classes">{availableReferenceClasses.map((c: string) => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <label style={labelStyle}>Join Field (on this record)</label>
          <input type="text" value={form.dr_join_field}
            onChange={(e) => setForm({ ...form, dr_join_field: e.target.value })}
            style={inputStyle} placeholder="e.g., Project" />
          <div style={helpStyle}>Field that links to the reference record</div>
        </div>
        <div>
          <label style={labelStyle}>Begin Date Field</label>
          <input type="text" value={form.dr_begin_date_field}
            onChange={(e) => setForm({ ...form, dr_begin_date_field: e.target.value })}
            style={inputStyle} placeholder="BeginDate" />
        </div>
        <div>
          <label style={labelStyle}>End Date Field</label>
          <input type="text" value={form.dr_end_date_field}
            onChange={(e) => setForm({ ...form, dr_end_date_field: e.target.value })}
            style={inputStyle} placeholder="EndDate" />
        </div>
      </div>
    </div>
  );

  if (form.rule_type === 'OPEN_PERIOD_CHECK') return (
    <div style={sectionStyle}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: theme.text.primary, marginBottom: '4px' }}>Open Period Configuration</div>
      <div style={{ fontSize: '12px', color: theme.text.tertiary, marginBottom: '12px' }}>
        Two-step lookup: reads <strong>CurrentPeriod</strong> from AccountingEntity, then checks the period's date range in GeneralLedgerClosePeriod.
      </div>
      <div style={gridStyle}>
        <div>
          <label style={labelStyle}>Entity Field (on this record)</label>
          <input type="text" value={form.op_entity_field}
            onChange={(e) => setForm({ ...form, op_entity_field: e.target.value })}
            style={inputStyle} placeholder="AccountingEntity" />
        </div>
        <div>
          <label style={labelStyle}>Current Period Field</label>
          <input type="text" value={form.op_current_period_field}
            onChange={(e) => setForm({ ...form, op_current_period_field: e.target.value })}
            style={inputStyle} placeholder="CurrentPeriod" />
          <div style={helpStyle}>Field in AccountingEntity snapshot</div>
        </div>
        <div>
          <label style={labelStyle}>Period Class</label>
          <input type="text" value={form.op_period_class}
            onChange={(e) => setForm({ ...form, op_period_class: e.target.value })}
            style={inputStyle} placeholder="GeneralLedgerClosePeriod" />
        </div>
        <div>
          <label style={labelStyle}>Period Key Field</label>
          <input type="text" value={form.op_period_key_field}
            onChange={(e) => setForm({ ...form, op_period_key_field: e.target.value })}
            style={inputStyle} placeholder="GeneralLedgerCalendarPeriod" />
        </div>
        <div>
          <label style={labelStyle}>Period Begin Field</label>
          <input type="text" value={form.op_period_begin_field}
            onChange={(e) => setForm({ ...form, op_period_begin_field: e.target.value })}
            style={inputStyle} placeholder="DerivedBeginDate" />
        </div>
        <div>
          <label style={labelStyle}>Period End Field</label>
          <input type="text" value={form.op_period_end_field}
            onChange={(e) => setForm({ ...form, op_period_end_field: e.target.value })}
            style={inputStyle} placeholder="DerivedEndDate" />
        </div>
      </div>
    </div>
  );

  if (form.rule_type === 'BALANCE_CHECK') return (
    <div style={sectionStyle}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: theme.text.primary, marginBottom: '4px' }}>Balance Check Configuration</div>
      <div style={{ fontSize: '12px', color: theme.text.tertiary, marginBottom: '12px' }}>
        Groups all records by a field and verifies the amounts net to zero. Runs once across the entire file before per-row validation.
      </div>
      <div style={gridStyle}>
        <div>
          <label style={labelStyle}>Group By Field</label>
          <input type="text" value={form.bc_group_by_field}
            onChange={(e) => setForm({ ...form, bc_group_by_field: e.target.value })}
            style={inputStyle} placeholder="RunGroup" />
          <div style={helpStyle}>Records are grouped by this field</div>
        </div>
        <div>
          <label style={labelStyle}>Amount Mode</label>
          <select value={form.bc_mode} onChange={(e) => setForm({ ...form, bc_mode: e.target.value })} style={inputStyle}>
            <option value="single_field">Single field (positive = debit, negative = credit)</option>
            <option value="two_field">Two separate fields (debit field + credit field)</option>
          </select>
        </div>
        {form.bc_mode === 'single_field' ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Amount Field</label>
            <input type="text" value={form.bc_amount_field}
              onChange={(e) => setForm({ ...form, bc_amount_field: e.target.value })}
              style={inputStyle} placeholder="TransactionAmount" />
            <div style={helpStyle}>Positive values = debits, negative values = credits</div>
          </div>
        ) : (
          <>
            <div>
              <label style={labelStyle}>Debit Field</label>
              <input type="text" value={form.bc_debit_field}
                onChange={(e) => setForm({ ...form, bc_debit_field: e.target.value })}
                style={inputStyle} placeholder="DebitAmount" />
            </div>
            <div>
              <label style={labelStyle}>Credit Field</label>
              <input type="text" value={form.bc_credit_field}
                onChange={(e) => setForm({ ...form, bc_credit_field: e.target.value })}
                style={inputStyle} placeholder="CreditAmount" />
            </div>
          </>
        )}
      </div>
    </div>
  );

  // REQUIRED_OVERRIDE, FIELD_MUST_BE_EMPTY — no extra config needed
  return null;
};

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
    pattern: '',
    // REFERENCE_EXISTS filter
    condition_filter_field: '',
    condition_filter_value: '',
    // DATE_RANGE_FROM_REFERENCE
    dr_join_field: '',
    dr_begin_date_field: 'BeginDate',
    dr_end_date_field: 'EndDate',
    // OPEN_PERIOD_CHECK
    op_entity_field: 'AccountingEntity',
    op_current_period_field: 'CurrentPeriod',
    op_period_class: 'GeneralLedgerClosePeriod',
    op_period_key_field: 'GeneralLedgerCalendarPeriod',
    op_period_begin_field: 'DerivedBeginDate',
    op_period_end_field: 'DerivedEndDate',
    // BALANCE_CHECK
    bc_group_by_field: 'RunGroup',
    bc_amount_field: 'TransactionAmount',
    bc_mode: 'single_field',
    bc_debit_field: '',
    bc_credit_field: '',
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
  const [showAddFileLevelRuleModal, setShowAddFileLevelRuleModal] = useState(false);
  const [fileLevelRuleForm, setFileLevelRuleForm] = useState({
    rule_type: 'BALANCE_CHECK',
    error_message: '',
    bc_group_by_field: 'RunGroup',
    bc_amount_field: 'TransactionAmount',
    bc_mode: 'single_field',
    bc_debit_field: '',
    bc_credit_field: '',
  });
  const [availableReferenceClasses, setAvailableReferenceClasses] = useState<string[]>([]);
  const [referenceClassSearch, setReferenceClassSearch] = useState('');
  const [availableReferenceFields, setAvailableReferenceFields] = useState<string[]>([]);
  const [loadingReferenceFields, setLoadingReferenceFields] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState<number | null>(null);

  // Edit rule state
  const [showEditRuleModal, setShowEditRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [editRuleForm, setEditRuleForm] = useState({
    rule_type: '',
    error_message: '',
    reference_business_class: '',
    reference_field_name: '',
    condition_filter_field: '',
    condition_filter_value: '',
    pattern: '',
    enum_values: '',
    // DATE_RANGE_FROM_REFERENCE
    dr_join_field: '',
    dr_begin_date_field: 'BeginDate',
    dr_end_date_field: 'EndDate',
    // OPEN_PERIOD_CHECK
    op_entity_field: 'AccountingEntity',
    op_current_period_field: 'CurrentPeriod',
    op_period_class: 'GeneralLedgerClosePeriod',
    op_period_key_field: 'GeneralLedgerCalendarPeriod',
    op_period_begin_field: 'DerivedBeginDate',
    op_period_end_field: 'DerivedEndDate',
    // BALANCE_CHECK
    bc_group_by_field: 'RunGroup',
    bc_amount_field: 'TransactionAmount',
    bc_mode: 'single_field',
    bc_debit_field: '',
    bc_credit_field: '',
  });

  const account = JSON.parse(localStorage.getItem('account') || '{}');

  // Build condition_expression JSON from form fields based on rule type
  const buildConditionExpression = (form: any): string | null => {
    switch (form.rule_type) {
      case 'REFERENCE_EXISTS':
        if (form.condition_filter_field && form.condition_filter_value) {
          return JSON.stringify({ filter_field: form.condition_filter_field, filter_value: form.condition_filter_value });
        }
        return null;
      case 'DATE_RANGE_FROM_REFERENCE':
        return JSON.stringify({
          join_field: form.dr_join_field,
          begin_date_field: form.dr_begin_date_field || 'BeginDate',
          end_date_field: form.dr_end_date_field || 'EndDate',
        });
      case 'OPEN_PERIOD_CHECK':
        return JSON.stringify({
          entity_field: form.op_entity_field || 'AccountingEntity',
          current_period_field: form.op_current_period_field || 'CurrentPeriod',
          period_class: form.op_period_class || 'GeneralLedgerClosePeriod',
          period_key_field: form.op_period_key_field || 'GeneralLedgerCalendarPeriod',
          period_begin_field: form.op_period_begin_field || 'DerivedBeginDate',
          period_end_field: form.op_period_end_field || 'DerivedEndDate',
        });
      case 'BALANCE_CHECK':
        return JSON.stringify({
          group_by_field: form.bc_group_by_field || 'RunGroup',
          amount_field: form.bc_amount_field || 'TransactionAmount',
          mode: form.bc_mode || 'single_field',
          ...(form.bc_mode === 'two_field' ? {
            debit_field: form.bc_debit_field,
            credit_field: form.bc_credit_field,
          } : {}),
        });
      case 'PATTERN_MATCH':
        return form.pattern || null;
      default:
        return null;
    }
  };

  // Parse condition_expression back into form fields for editing
  const parseConditionExpression = (ruleType: string, condExpr: string | null): Partial<typeof editRuleForm> => {
    if (!condExpr) return {};
    try {
      const cfg = JSON.parse(condExpr);
      switch (ruleType) {
        case 'REFERENCE_EXISTS':
          return { condition_filter_field: cfg.filter_field || '', condition_filter_value: cfg.filter_value || '' };
        case 'DATE_RANGE_FROM_REFERENCE':
          return { dr_join_field: cfg.join_field || '', dr_begin_date_field: cfg.begin_date_field || 'BeginDate', dr_end_date_field: cfg.end_date_field || 'EndDate' };
        case 'OPEN_PERIOD_CHECK':
          return {
            op_entity_field: cfg.entity_field || 'AccountingEntity',
            op_current_period_field: cfg.current_period_field || 'CurrentPeriod',
            op_period_class: cfg.period_class || 'GeneralLedgerClosePeriod',
            op_period_key_field: cfg.period_key_field || 'GeneralLedgerCalendarPeriod',
            op_period_begin_field: cfg.period_begin_field || 'DerivedBeginDate',
            op_period_end_field: cfg.period_end_field || 'DerivedEndDate',
          };
        case 'BALANCE_CHECK':
          return {
            bc_group_by_field: cfg.group_by_field || 'RunGroup',
            bc_amount_field: cfg.amount_field || 'TransactionAmount',
            bc_mode: cfg.mode || 'single_field',
            bc_debit_field: cfg.debit_field || '',
            bc_credit_field: cfg.credit_field || '',
          };
        default:
          return {};
      }
    } catch {
      // PATTERN_MATCH stores regex directly
      if (ruleType === 'PATTERN_MATCH') return { pattern: condExpr };
      return {};
    }
  };

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
      const businessClasses = [...new Set<string>(schemas.map((s: any) => s.business_class as string))];
      setAvailableBusinessClasses(businessClasses);
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
      
      const params: any = {};
      if (businessClass) params.business_class = businessClass;
      
      const response = await api.get('/rules/rule-sets', { params });
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
        name: '', business_class: '', rule_type: 'REFERENCE_EXISTS', field_name: '',
        reference_business_class: '', reference_field_name: '', condition_expression: '',
        error_message: '', is_active: true, rule_set_id: selectedRuleSet?.id || null,
        enum_values: '', pattern: '',
        condition_filter_field: '', condition_filter_value: '',
        dr_join_field: '', dr_begin_date_field: 'BeginDate', dr_end_date_field: 'EndDate',
        op_entity_field: 'AccountingEntity', op_current_period_field: 'CurrentPeriod',
        op_period_class: 'GeneralLedgerClosePeriod', op_period_key_field: 'GeneralLedgerCalendarPeriod',
        op_period_begin_field: 'DerivedBeginDate', op_period_end_field: 'DerivedEndDate',
        bc_group_by_field: 'RunGroup', bc_amount_field: 'TransactionAmount',
        bc_mode: 'single_field', bc_debit_field: '', bc_credit_field: '',
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

      // Duplicate each rule to the new rule set (mark as readonly - copied from Default)
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
          enum_values: rule.enum_values,
          is_readonly: true  // Copied from Default - not user-added, cannot be edited/deleted
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
      const conditionExpression = buildConditionExpression(newRule);

      const ruleData: any = {
        name: `${selectedField.field_name} ${newRule.rule_type}`,
        business_class: fieldViewData.business_class,
        rule_set_id: fieldViewData.rule_set_id,
        rule_type: newRule.rule_type,
        field_name: selectedField.field_name,
        reference_business_class: newRule.reference_business_class || null,
        reference_field_name: newRule.reference_field_name || null,
        condition_expression: conditionExpression,
        error_message: newRule.error_message,
        is_active: true,
        pattern: newRule.rule_type === 'PATTERN_MATCH' ? newRule.pattern : null,
        enum_values: newRule.rule_type === 'ENUM_VALIDATION' ? newRule.enum_values : null,
      };

      await api.post('/rules/templates', ruleData);

      // Reset form
      setNewRule({
        name: '', business_class: '', rule_type: 'REFERENCE_EXISTS', field_name: '',
        reference_business_class: '', reference_field_name: '', condition_expression: '',
        error_message: '', is_active: true, rule_set_id: null, enum_values: '', pattern: '',
        condition_filter_field: '', condition_filter_value: '',
        dr_join_field: '', dr_begin_date_field: 'BeginDate', dr_end_date_field: 'EndDate',
        op_entity_field: 'AccountingEntity', op_current_period_field: 'CurrentPeriod',
        op_period_class: 'GeneralLedgerClosePeriod', op_period_key_field: 'GeneralLedgerCalendarPeriod',
        op_period_begin_field: 'DerivedBeginDate', op_period_end_field: 'DerivedEndDate',
        bc_group_by_field: 'RunGroup', bc_amount_field: 'TransactionAmount',
        bc_mode: 'single_field', bc_debit_field: '', bc_credit_field: '',
      });

      setShowAddRuleModal(false);
      setSelectedField(null);
      await loadRuleSetFields(fieldViewData.rule_set_id);
    } catch (error: any) {
      alert(`Failed to add rule: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleAddFileLevelRule = async () => {
    if (!fieldViewData) return;
    try {
      const conditionExpression = buildConditionExpression({ ...fileLevelRuleForm });
      await api.post('/rules/templates', {
        name: `${fieldViewData.business_class} ${fileLevelRuleForm.rule_type}`,
        business_class: fieldViewData.business_class,
        rule_set_id: fieldViewData.rule_set_id,
        rule_type: fileLevelRuleForm.rule_type,
        field_name: '_file_level_',   // sentinel — not a real field
        condition_expression: conditionExpression,
        error_message: fileLevelRuleForm.error_message ||
          getDefaultErrorMessage(fileLevelRuleForm.rule_type, fieldViewData.business_class),
        is_active: true,
      });
      setFileLevelRuleForm({ rule_type: 'BALANCE_CHECK', error_message: '', bc_group_by_field: 'RunGroup', bc_amount_field: 'TransactionAmount', bc_mode: 'single_field', bc_debit_field: '', bc_credit_field: '' });
      setShowAddFileLevelRuleModal(false);
      await loadRuleSetFields(fieldViewData.rule_set_id);
    } catch (error: any) {
      alert(`Failed to add rule: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDeleteFileLevelRule = async (ruleId: number) => {
    if (!confirm('Delete this file-level rule?')) return;
    try {
      await api.delete(`/rules/templates/${ruleId}`);
      await loadRuleSetFields(fieldViewData.rule_set_id);
    } catch (error: any) {
      alert(`Failed to delete rule: ${error.response?.data?.detail || error.message}`);
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

  const handleDeleteFieldRule = async (ruleId: number) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await api.delete(`/rules/templates/${ruleId}`);
      await loadRuleSetFields(fieldViewData.rule_set_id);
    } catch (error: any) {
      alert(`Failed to delete rule: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleOpenEditRule = (rule: any) => {
    setEditingRule(rule);
    const parsed = parseConditionExpression(rule.rule_type, rule.condition_expression);
    setEditRuleForm({
      rule_type: rule.rule_type,
      error_message: rule.error_message || '',
      reference_business_class: rule.reference_business_class || '',
      reference_field_name: rule.reference_field_name || '',
      condition_filter_field: parsed.condition_filter_field || '',
      condition_filter_value: parsed.condition_filter_value || '',
      pattern: rule.pattern || (rule.rule_type === 'PATTERN_MATCH' ? rule.condition_expression : '') || '',
      enum_values: rule.enum_values ? (Array.isArray(rule.enum_values) ? rule.enum_values.join(', ') : rule.enum_values) : '',
      dr_join_field: parsed.dr_join_field || '',
      dr_begin_date_field: parsed.dr_begin_date_field || 'BeginDate',
      dr_end_date_field: parsed.dr_end_date_field || 'EndDate',
      op_entity_field: parsed.op_entity_field || 'AccountingEntity',
      op_current_period_field: parsed.op_current_period_field || 'CurrentPeriod',
      op_period_class: parsed.op_period_class || 'GeneralLedgerClosePeriod',
      op_period_key_field: parsed.op_period_key_field || 'GeneralLedgerCalendarPeriod',
      op_period_begin_field: parsed.op_period_begin_field || 'DerivedBeginDate',
      op_period_end_field: parsed.op_period_end_field || 'DerivedEndDate',
      bc_group_by_field: parsed.bc_group_by_field || 'RunGroup',
      bc_amount_field: parsed.bc_amount_field || 'TransactionAmount',
      bc_mode: parsed.bc_mode || 'single_field',
      bc_debit_field: parsed.bc_debit_field || '',
      bc_credit_field: parsed.bc_credit_field || '',
    });
    if (rule.rule_type === 'REFERENCE_EXISTS' && rule.reference_business_class) {
      loadReferenceFields(rule.reference_business_class);
    } else {
      setAvailableReferenceFields([]);
    }
    setShowEditRuleModal(true);
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;
    try {
      const conditionExpression = buildConditionExpression(editRuleForm);
      await api.put(`/rules/templates/${editingRule.id}`, {
        rule_type: editRuleForm.rule_type,
        error_message: editRuleForm.error_message,
        reference_business_class: editRuleForm.reference_business_class || null,
        reference_field_name: editRuleForm.reference_field_name || null,
        condition_expression: conditionExpression,
        pattern: editRuleForm.rule_type === 'PATTERN_MATCH' ? editRuleForm.pattern : null,
        enum_values: editRuleForm.rule_type === 'ENUM_VALIDATION' ? editRuleForm.enum_values : null,
      });
      setShowEditRuleModal(false);
      setEditingRule(null);
      await loadRuleSetFields(fieldViewData.rule_set_id);
    } catch (error: any) {
      alert(`Failed to update rule: ${error.response?.data?.detail || error.message}`);
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
            {availableBusinessClasses.map((businessClass) => (
              <option key={businessClass} value={businessClass}>
                {businessClass}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Rule Sets Section */}
      <div style={styles.ruleSetsSection}>
          <div style={styles.ruleSetsHeader}>
            <h3 style={styles.sectionTitle}>Rule Sets</h3>
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
                            <span style={styles.commonBadge}>{ruleSet.business_class}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                          <span style={styles.ruleCount}>{ruleSet.rule_count} rules</span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600' as const,
                            backgroundColor: ruleSet.is_active ? '#e6f4ea' : '#fce8e6',
                            color: ruleSet.is_active ? '#1e7e34' : '#c0392b',
                            border: `1px solid ${ruleSet.is_active ? '#a8d5b5' : '#f5c6c2'}`
                          }}>
                            {ruleSet.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
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
                    {fieldViewData.business_class && (
                      <span style={{
                        marginLeft: '10px',
                        padding: '2px 8px',
                        backgroundColor: theme.accent.purpleTintLight,
                        color: theme.primary.main,
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: `1px solid ${theme.accent.purpleTintMedium}`
                      }}>
                        {fieldViewData.business_class}
                      </span>
                    )}
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

            {/* File-Level Rules Section */}
            {!fieldViewData.is_common && (() => {
              const fileLevelField = fieldViewData.fields?.find((f: any) => f.field_name === '_file_level_');
              const existingFileLevelRules = fileLevelField?.rules || [];
              return (
                <div style={{ padding: '20px 20px 0' }}>
                  <div style={{
                    backgroundColor: theme.background.tertiary,
                    border: `1px solid ${theme.background.quaternary}`,
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: existingFileLevelRules.length > 0 ? '12px' : '0' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: theme.text.primary }}>File-Level Rules</div>
                        <div style={{ fontSize: '12px', color: theme.text.tertiary, marginTop: '2px' }}>
                          Rules that apply to the entire file, not to individual fields (e.g. Balance Check)
                        </div>
                      </div>
                      <button
                        onClick={() => setShowAddFileLevelRuleModal(true)}
                        style={{ padding: '6px 14px', backgroundColor: theme.primary.main, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.primary.dark}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.primary.main}
                      >
                        + Add
                      </button>
                    </div>
                    {existingFileLevelRules.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
                        {existingFileLevelRules.map((rule: any) => (
                          <div key={rule.id} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 12px',
                            backgroundColor: theme.background.secondary,
                            border: `1px solid ${theme.background.quaternary}`,
                            borderRadius: '6px', fontSize: '13px'
                          }}>
                            <span style={{ fontWeight: 600, color: theme.primary.main }}>{rule.rule_type}</span>
                            {rule.error_message && <span style={{ color: theme.text.tertiary, fontSize: '12px' }}>{rule.error_message}</span>}
                            <button
                              onClick={() => handleDeleteFileLevelRule(rule.id)}
                              title="Delete"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.status.error, fontSize: '14px', padding: '0', lineHeight: 1 }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {existingFileLevelRules.length === 0 && (
                      <div style={{ fontSize: '12px', color: theme.text.muted, fontStyle: 'italic', marginTop: '8px' }}>No file-level rules configured</div>
                    )}
                  </div>
                </div>
              );
            })()}

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
                  {fieldViewData.fields.filter((f: any) => f.field_name !== '_file_level_').map((field: any, idx: number) => (
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
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 6px',
                                  backgroundColor: rule.source === 'schema' ? theme.accent.purpleTintLight : theme.background.tertiary,
                                  border: `1px solid ${rule.source === 'schema' ? theme.primary.main : theme.background.quaternary}`,
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  color: rule.source === 'schema' ? theme.primary.main : theme.text.primary,
                                }}
                              >
                                {rule.rule_type}
                                {!fieldViewData.is_common && !rule.is_readonly && (
                                  <>
                                    <button
                                      onClick={() => handleOpenEditRule(rule)}
                                      title="Edit rule"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', fontSize: '10px', color: theme.primary.main, lineHeight: 1 }}
                                    >✏️</button>
                                    <button
                                      onClick={() => handleDeleteFieldRule(rule.id)}
                                      title="Delete rule"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', fontSize: '10px', color: theme.status.error, lineHeight: 1 }}
                                    >✕</button>
                                  </>
                                )}
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
          <div style={{ ...styles.modal, maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ ...styles.modalTitle, marginBottom: '4px' }}>Add Validation Rule</h2>
                <div style={{ fontSize: '13px', color: theme.text.tertiary }}>
                  Field: <span style={{ fontWeight: 600, color: theme.primary.main }}>{selectedField.field_name}</span>
                  {selectedField.field_type && <span style={{ marginLeft: '8px', padding: '2px 6px', backgroundColor: theme.background.tertiary, borderRadius: '4px', fontSize: '11px' }}>{selectedField.field_type}</span>}
                </div>
              </div>
              <button onClick={() => setShowAddRuleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: theme.text.tertiary, padding: '4px' }}>✕</button>
            </div>

            {/* Rule Type Selector */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Rule Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {RULE_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setNewRule({ ...newRule, rule_type: opt.value })}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: `2px solid ${newRule.rule_type === opt.value ? theme.primary.main : theme.background.quaternary}`,
                      backgroundColor: newRule.rule_type === opt.value ? theme.accent.purpleTintLight : theme.background.secondary,
                      cursor: 'pointer',
                      textAlign: 'left' as const,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: newRule.rule_type === opt.value ? theme.primary.main : theme.text.primary }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', color: theme.text.tertiary, marginTop: '2px' }}>{opt.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic config section */}
            <RuleTypeConfig form={newRule} setForm={setNewRule} availableReferenceClasses={availableReferenceClasses} availableReferenceFields={availableReferenceFields} loadingReferenceFields={loadingReferenceFields} loadReferenceFields={loadReferenceFields} fieldName={selectedField.field_name} />

            {/* Error Message */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Error Message</label>
              <textarea
                value={newRule.error_message}
                onChange={(e) => setNewRule({ ...newRule, error_message: e.target.value })}
                style={{ ...styles.input, minHeight: '72px', resize: 'vertical' as const }}
                placeholder={getDefaultErrorMessage(newRule.rule_type, selectedField.field_name)}
              />
              <div style={styles.helpText}>Shown to the consultant when this rule fails. The invalid value is appended automatically.</div>
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowAddRuleModal(false)} style={styles.cancelButton}>Cancel</button>
              <button onClick={handleAddRuleToField} style={styles.saveButton}>Add Rule</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rule Modal */}
      {showEditRuleModal && editingRule && (
        <div style={styles.modalOverlay} onClick={() => setShowEditRuleModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ ...styles.modalTitle, marginBottom: '4px' }}>Edit Rule</h2>
                <div style={{ fontSize: '13px', color: theme.text.tertiary }}>
                  Field: <span style={{ fontWeight: 600, color: theme.primary.main }}>{editingRule.field_name}</span>
                  <span style={{ marginLeft: '8px', padding: '2px 8px', backgroundColor: theme.accent.purpleTintLight, color: theme.primary.main, borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{editRuleForm.rule_type}</span>
                </div>
              </div>
              <button onClick={() => setShowEditRuleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: theme.text.tertiary, padding: '4px' }}>✕</button>
            </div>

            <RuleTypeConfig form={editRuleForm} setForm={setEditRuleForm} availableReferenceClasses={availableReferenceClasses} availableReferenceFields={availableReferenceFields} loadingReferenceFields={loadingReferenceFields} loadReferenceFields={loadReferenceFields} fieldName={editingRule.field_name} />

            <div style={styles.formGroup}>
              <label style={styles.label}>Error Message</label>
              <textarea
                value={editRuleForm.error_message}
                onChange={(e) => setEditRuleForm({ ...editRuleForm, error_message: e.target.value })}
                style={{ ...styles.input, minHeight: '72px', resize: 'vertical' as const }}
              />
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowEditRuleModal(false)} style={styles.cancelButton}>Cancel</button>
              <button onClick={handleUpdateRule} style={styles.saveButton}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add File-Level Rule Modal */}
      {showAddFileLevelRuleModal && fieldViewData && (
        <div style={styles.modalOverlay} onClick={() => setShowAddFileLevelRuleModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ ...styles.modalTitle, marginBottom: '4px' }}>Add File-Level Rule</h2>
                <div style={{ fontSize: '13px', color: theme.text.tertiary }}>
                  Applies to the entire file for <span style={{ fontWeight: 600, color: theme.primary.main }}>{fieldViewData.business_class}</span>
                </div>
              </div>
              <button onClick={() => setShowAddFileLevelRuleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: theme.text.tertiary, padding: '4px' }}>✕</button>
            </div>

            {/* Rule type selector — file-level only */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Rule Type</label>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                {FILE_LEVEL_RULE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFileLevelRuleForm({ ...fileLevelRuleForm, rule_type: opt.value })}
                    style={{
                      padding: '12px 14px', borderRadius: '6px', textAlign: 'left' as const,
                      border: `2px solid ${fileLevelRuleForm.rule_type === opt.value ? theme.primary.main : theme.background.quaternary}`,
                      backgroundColor: fileLevelRuleForm.rule_type === opt.value ? theme.accent.purpleTintLight : theme.background.secondary,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: fileLevelRuleForm.rule_type === opt.value ? theme.primary.main : theme.text.primary }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', color: theme.text.tertiary, marginTop: '2px' }}>{opt.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <RuleTypeConfig
              form={fileLevelRuleForm}
              setForm={setFileLevelRuleForm}
              availableReferenceClasses={availableReferenceClasses}
              availableReferenceFields={availableReferenceFields}
              loadingReferenceFields={loadingReferenceFields}
              loadReferenceFields={loadReferenceFields}
              fieldName={fieldViewData.business_class}
            />

            <div style={styles.formGroup}>
              <label style={styles.label}>Error Message</label>
              <textarea
                value={fileLevelRuleForm.error_message}
                onChange={(e) => setFileLevelRuleForm({ ...fileLevelRuleForm, error_message: e.target.value })}
                style={{ ...styles.input, minHeight: '72px', resize: 'vertical' as const }}
                placeholder={getDefaultErrorMessage(fileLevelRuleForm.rule_type, fieldViewData.business_class)}
              />
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowAddFileLevelRuleModal(false)} style={styles.cancelButton}>Cancel</button>
              <button onClick={handleAddFileLevelRule} style={styles.saveButton}>Add Rule</button>
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
