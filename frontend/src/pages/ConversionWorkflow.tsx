import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface ConversionWorkflowProps {
  onBack: () => void;
}

interface FileInfo {
  filename: string;
  headers: string[];
  sample_records: any[];
  total_records: number;
}

interface MappingData {
  mapping: Record<string, {
    fsm_field: string;
    confidence: string;
    score: number;
  }>;
  unmapped_csv_columns: string[];
  unmapped_fsm_fields: string[];
}

interface ValidationProgress {
  status: string;
  progress: number;
  current_chunk: number;
  total_chunks: number;
  records_processed: number;
  total_records: number;
  errors_found: number;
  filename: string;
}

interface ValidationError {
  row_number: number;
  field_name: string;
  error_type: string;
  error_message: string;
  field_value: string;
}

interface LoadResult {
  status: string;
  total_records: number;
  success_count: number;
  failure_count: number;
  chunks_processed: number;
  run_group: string;
  business_class: string;
  timestamp: string;
}

const ConversionWorkflow: React.FC<ConversionWorkflowProps> = ({ onBack }) => {
  // Step management
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'validation' | 'load' | 'completed'>('upload');
  
  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  
  // Mapping state
  const [businessClass, setBusinessClass] = useState('GLTransactionInterface');
  const [schema, setSchema] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mappingData, setMappingData] = useState<MappingData>({
    mapping: {},
    unmapped_csv_columns: [],
    unmapped_fsm_fields: []
  });
  const [fetchingSchema, setFetchingSchema] = useState(false);
  const [autoMapping, setAutoMapping] = useState(false);

  // Validation state
  const [validating, setValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState<ValidationProgress | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [errorFilter, setErrorFilter] = useState('');
  const [errorTypeFilter, setErrorTypeFilter] = useState('');

  // Load state
  const [loading, setLoading] = useState(false);
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);
  const [showRunGroupDialog, setShowRunGroupDialog] = useState(false);
  const [runGroupCheckResult, setRunGroupCheckResult] = useState<{
    exists: boolean;
    record_count: number;
    run_group: string;
  } | null>(null);

  // Interface state
  const [interfaceParams, setInterfaceParams] = useState({
    runGroup: '',
    enterpriseGroup: '',
    accountingEntity: '',
    editOnly: false,
    editAndInterface: false,
    partialUpdate: false,
    journalizeByEntity: true,
    journalByJournalCode: false,
    bypassOrganizationCode: true,
    bypassAccountCode: true,
    bypassStructureRelationEdit: false,
    interfaceInDetail: true,
    currencyTable: '',
    bypassNegativeRateEdit: false,
    primaryLedger: '',
    moveErrorsToNewRunGroup: false,
    errorRunGroupPrefix: ''
  });
  const [interfacing, setInterfacing] = useState(false);
  const [interfaceResult, setInterfaceResult] = useState<string>('');
  const [showInterfaceForm, setShowInterfaceForm] = useState(false);

  // Delete RunGroup state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  // File upload handler
  const handleFileUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('business_class', businessClass);

      const response = await api.post('/upload/', formData);
      
      setJobId(response.data.job_id);
      setFileInfo(response.data.file_info);
      setCurrentStep('mapping');
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Schema fetching
  const fetchSchema = async () => {
    setFetchingSchema(true);
    try {
      const response = await api.get(`/schema/fetch/${businessClass}`);
      setSchema(response.data);
    } catch (error: any) {
      console.error('Schema fetch failed:', error);
      alert(`Schema fetch failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setFetchingSchema(false);
    }
  };

  // Auto-mapping
  const performAutoMapping = async () => {
    if (!jobId || !schema) return;

    setAutoMapping(true);
    try {
      const response = await api.post('/mapping/auto-map', {
        job_id: jobId,
        business_class: businessClass,
        csv_headers: fileInfo?.headers || [],
        fsm_schema: schema
      });

      setMappingData(response.data);
      
      // Convert to UI format (FSM field -> CSV column)
      const uiMapping: Record<string, string> = {};
      Object.entries(response.data.mapping).forEach(([csvCol, fsmData]: [string, any]) => {
        uiMapping[fsmData.fsm_field] = csvCol;
      });
      setMapping(uiMapping);
    } catch (error: any) {
      console.error('Auto-mapping failed:', error);
      alert(`Auto-mapping failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setAutoMapping(false);
    }
  };
  // Manual mapping update
  const updateMapping = (fsmField: string, csvColumn: string) => {
    setMapping(prev => ({ ...prev, [fsmField]: csvColumn }));
    
    // Update backend-compatible format
    setMappingData(prev => ({
      ...prev,
      mapping: {
        ...prev.mapping,
        [csvColumn]: {
          fsm_field: fsmField,
          confidence: 'manual',
          score: 0.0
        }
      }
    }));
  };

  // Validation handlers
  const handleStartValidation = async () => {
    if (!jobId) return;

    setValidating(true);
    setValidationProgress(null);
    setValidationErrors([]);
    
    try {
      await api.post('/validation/start', {
        job_id: jobId,
        business_class: businessClass,
        mapping: mappingData.mapping // Use backend-compatible format
      });

      // Start polling for progress
      pollValidationProgress();
    } catch (error: any) {
      console.error('Validation failed:', error);
      alert(`Validation failed: ${error.response?.data?.detail || error.message}`);
      setValidating(false);
    }
  };

  const pollValidationProgress = async () => {
    if (!jobId) return;

    try {
      const response = await api.get(`/validation/progress/${jobId}`);
      const progress = response.data;
      
      setValidationProgress(progress);

      if (progress.status === 'completed') {
        setValidating(false);
        setCurrentStep('validation');
        await loadValidationErrors();
      } else if (progress.status === 'failed') {
        setValidating(false);
        alert('Validation failed');
      } else {
        // Continue polling
        setTimeout(pollValidationProgress, 1000);
      }
    } catch (error: any) {
      console.error('Progress check failed:', error);
      setValidating(false);
    }
  };

  const loadValidationErrors = async () => {
    if (!jobId) return;

    try {
      const response = await api.get(`/validation/errors/${jobId}`);
      setValidationErrors(response.data.errors || []);
    } catch (error: any) {
      console.error('Failed to load errors:', error);
    }
  };
  // Export errors
  const exportErrors = async () => {
    if (!jobId) return;

    try {
      const response = await api.get(`/validation/export-errors/${jobId}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `validation_errors_job_${jobId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error.response?.data?.detail || error.message}`);
    }
  };

  // Load handlers
  const handleStartLoad = async () => {
    if (!jobId || !mappingData.mapping) return;

    console.log('handleStartLoad: Starting load process');
    
    // Extract RunGroup from mapping
    let runGroup = '';
    Object.entries(mappingData.mapping).forEach(([csvCol, fsmData]) => {
      if (fsmData.fsm_field === 'GLTransactionInterface.RunGroup' || fsmData.fsm_field === 'RunGroup') {
        runGroup = csvCol;
      }
    });

    console.log('handleStartLoad: Found RunGroup:', runGroup);

    if (!runGroup) {
      alert('RunGroup field must be mapped before loading');
      return;
    }

    try {
      // Check if RunGroup already exists
      console.log('handleStartLoad: Checking if RunGroup exists');
      const checkResponse = await api.get(`/load/check-rungroup/${jobId}/${runGroup}`);
      const checkResult = checkResponse.data;
      
      console.log('handleStartLoad: RunGroup check response:', checkResult);

      if (checkResult.exists) {
        // Show dialog for user decision
        console.log('handleStartLoad: RunGroup exists, showing dialog');
        setRunGroupCheckResult(checkResult);
        setShowRunGroupDialog(true);
      } else {
        // Proceed with load
        console.log('handleStartLoad: Proceeding with load');
        await proceedWithLoad();
      }
    } catch (error: any) {
      console.error('RunGroup check failed:', error);
      alert(`RunGroup check failed: ${error.response?.data?.detail || error.message}`);
    }
  };
  const proceedWithLoad = async () => {
    if (!jobId || !mappingData.mapping) return;

    console.log('proceedWithLoad: Starting load');
    setLoading(true);
    
    try {
      console.log('proceedWithLoad: Sending load request to backend');
      const response = await api.post('/load/start', {
        job_id: jobId,
        business_class: businessClass,
        mapping: mappingData.mapping,
        chunk_size: 100,
        trigger_interface: false
      });

      console.log('proceedWithLoad: Load response received:', response.data);
      setLoadResult(response.data);
      setCurrentStep('completed');
      
      // Set interface params with RunGroup
      if (response.data.run_group) {
        setInterfaceParams(prev => ({
          ...prev,
          runGroup: response.data.run_group
        }));
      }
    } catch (error: any) {
      console.error('Load failed:', error);
      alert(`Load failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // RunGroup dialog handlers
  const handleRunGroupDeleteAndLoad = async () => {
    if (!runGroupCheckResult || !jobId) return;

    try {
      // Delete existing RunGroup
      await api.post('/load/delete-rungroup', {
        job_id: jobId,
        business_class: businessClass,
        run_group: runGroupCheckResult.run_group
      });

      // Close dialog and proceed with load
      setShowRunGroupDialog(false);
      setRunGroupCheckResult(null);
      await proceedWithLoad();
    } catch (error: any) {
      console.error('Delete and load failed:', error);
      alert(`Delete and load failed: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleRunGroupContinue = async () => {
    // Close dialog and proceed with load (will add to existing RunGroup)
    setShowRunGroupDialog(false);
    setRunGroupCheckResult(null);
    await proceedWithLoad();
  };

  const handleRunGroupCancel = () => {
    // Close dialog and cancel load
    setShowRunGroupDialog(false);
    setRunGroupCheckResult(null);
  };
  // Interface handlers
  const handleInterfaceTransactions = async () => {
    if (!jobId || !interfaceParams.runGroup) return;

    setInterfacing(true);
    try {
      const response = await api.post('/load/interface', {
        job_id: jobId,
        business_class: businessClass,
        run_group: interfaceParams.runGroup,
        enterprise_group: interfaceParams.enterpriseGroup,
        accounting_entity: interfaceParams.accountingEntity,
        edit_only: interfaceParams.editOnly,
        edit_and_interface: interfaceParams.editAndInterface,
        partial_update: interfaceParams.partialUpdate,
        journalize_by_entity: interfaceParams.journalizeByEntity,
        journal_by_journal_code: interfaceParams.journalByJournalCode,
        bypass_organization_code: interfaceParams.bypassOrganizationCode,
        bypass_account_code: interfaceParams.bypassAccountCode,
        bypass_structure_relation_edit: interfaceParams.bypassStructureRelationEdit,
        interface_in_detail: interfaceParams.interfaceInDetail,
        currency_table: interfaceParams.currencyTable,
        bypass_negative_rate_edit: interfaceParams.bypassNegativeRateEdit,
        primary_ledger: interfaceParams.primaryLedger,
        move_errors_to_new_run_group: interfaceParams.moveErrorsToNewRunGroup,
        error_run_group_prefix: interfaceParams.errorRunGroupPrefix
      });

      setInterfaceResult(`Interface completed successfully for RunGroup: ${interfaceParams.runGroup}`);
      setShowInterfaceForm(false);
    } catch (error: any) {
      console.error('Interface failed:', error);
      alert(`Interface failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setInterfacing(false);
    }
  };

  // Delete RunGroup handlers
  const handleDeleteRunGroup = () => {
    setShowDeleteDialog(true);
    setDeleteConfirmation('');
  };

  const confirmDeleteRunGroup = async () => {
    if (!loadResult || !jobId) return;
    if (deleteConfirmation !== loadResult.run_group) {
      alert('RunGroup name does not match. Please type the exact RunGroup name to confirm.');
      return;
    }

    setDeleting(true);
    try {
      await api.post('/load/delete-rungroup', {
        job_id: jobId,
        business_class: businessClass,
        run_group: loadResult.run_group
      });

      alert(`RunGroup "${loadResult.run_group}" has been deleted successfully.`);
      setShowDeleteDialog(false);
      setDeleteConfirmation('');
    } catch (error: any) {
      console.error('Delete failed:', error);
      alert(`Delete failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#000000', 
      color: '#ffffff', 
      padding: '20px' 
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px' 
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: '600', 
          color: '#dc2626' 
        }}>
          FSM Data Conversion Workflow
        </h1>
        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2a2a2a',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Upload Step */}
      {currentStep === 'upload' && (
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '2px solid #FF9800',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#FF9800',
              marginBottom: '8px'
            }}>
              📁 Upload CSV File
            </h3>
            <p style={{ fontSize: '13px', color: '#999' }}>
              Select a CSV file to begin the conversion process
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: '500' 
            }}>
              Business Class:
            </label>
            <select
              value={businessClass}
              onChange={(e) => setBusinessClass(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px'
              }}
            >
              <option value="GLTransactionInterface">GL Transaction Interface</option>
              <option value="PayablesInvoice">Payables Invoice</option>
              <option value="Vendor">Vendor</option>
              <option value="Customer">Customer</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: '500' 
            }}>
              CSV File:
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px'
              }}
            />
          </div>

          <button
            onClick={handleFileUpload}
            disabled={!file || uploading}
            style={{
              padding: '12px 24px',
              backgroundColor: file && !uploading ? '#dc2626' : '#2a2a2a',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: file && !uploading ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>

          {fileInfo && (
            <div style={{ 
              marginTop: '20px', 
              padding: '16px', 
              backgroundColor: '#0a0a0a', 
              borderRadius: '6px',
              border: '1px solid #2a2a2a'
            }}>
              <h4 style={{ color: '#FF9800', marginBottom: '12px' }}>File Information</h4>
              <p><strong>Filename:</strong> {fileInfo.filename}</p>
              <p><strong>Total Records:</strong> {fileInfo.total_records.toLocaleString()}</p>
              <p><strong>Headers:</strong> {fileInfo.headers.join(', ')}</p>
            </div>
          )}
        </div>
      )}

      {/* Mapping Step */}
      {currentStep === 'mapping' && (
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '2px solid #FF9800',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#FF9800',
              marginBottom: '8px'
            }}>
              🔗 Field Mapping
            </h3>
            <p style={{ fontSize: '13px', color: '#999' }}>
              Map CSV columns to FSM fields
            </p>
          </div>

          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            marginBottom: '20px' 
          }}>
            <button
              onClick={fetchSchema}
              disabled={fetchingSchema}
              style={{
                padding: '10px 20px',
                backgroundColor: fetchingSchema ? '#2a2a2a' : '#FF9800',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: fetchingSchema ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {fetchingSchema ? 'Fetching...' : 'Fetch Schema'}
            </button>

            <button
              onClick={performAutoMapping}
              disabled={!schema || autoMapping}
              style={{
                padding: '10px 20px',
                backgroundColor: schema && !autoMapping ? '#dc2626' : '#2a2a2a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: schema && !autoMapping ? 'pointer' : 'not-allowed',
                fontSize: '14px'
              }}
            >
              {autoMapping ? 'Auto-Mapping...' : 'Auto-Map Fields'}
            </button>

            <button
              onClick={() => setCurrentStep('validation')}
              disabled={Object.keys(mapping).length === 0}
              style={{
                padding: '10px 20px',
                backgroundColor: Object.keys(mapping).length > 0 ? '#dc2626' : '#2a2a2a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: Object.keys(mapping).length > 0 ? 'pointer' : 'not-allowed',
                fontSize: '14px'
              }}
            >
              Continue to Validation
            </button>
          </div>

          {Object.keys(mapping).length > 0 && (
            <div style={{
              padding: '16px',
              backgroundColor: '#0a0a0a',
              borderRadius: '6px',
              border: '1px solid #2a2a2a'
            }}>
              <h4 style={{ color: '#FF9800', marginBottom: '12px' }}>Field Mappings</h4>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '12px',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {Object.entries(mapping).map(([fsmField, csvColumn]) => (
                  <div key={fsmField} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '4px'
                  }}>
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#FF9800',
                      minWidth: '120px'
                    }}>
                      {fsmField}
                    </span>
                    <span style={{ fontSize: '12px', color: '#999' }}>→</span>
                    <select
                      value={csvColumn}
                      onChange={(e) => updateMapping(fsmField, e.target.value)}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #2a2a2a',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                    >
                      <option value="">Select column...</option>
                      {fileInfo?.headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Validation Step */}
      {currentStep === 'validation' && (
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '2px solid #FF9800',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#FF9800',
              marginBottom: '8px'
            }}>
              ✅ Data Validation
            </h3>
            <p style={{ fontSize: '13px', color: '#999' }}>
              Validate data against FSM schema and business rules
            </p>
          </div>

          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            marginBottom: '20px' 
          }}>
            <button
              onClick={handleStartValidation}
              disabled={validating}
              style={{
                padding: '10px 20px',
                backgroundColor: validating ? '#2a2a2a' : '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: validating ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {validating ? 'Validating...' : 'Start Validation'}
            </button>

            {validationErrors.length > 0 && (
              <button
                onClick={exportErrors}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#FF9800',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Export Errors
              </button>
            )}

            {validationProgress?.status === 'completed' && (
              <button
                onClick={() => setCurrentStep('load')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Continue to Load
              </button>
            )}
          </div>

          {validationProgress && (
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#0a0a0a',
              borderRadius: '6px',
              border: '1px solid #2a2a2a'
            }}>
              <h4 style={{ color: '#FF9800', marginBottom: '12px' }}>
                Validation Progress
              </h4>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#2a2a2a',
                borderRadius: '4px',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: `${validationProgress.progress}%`,
                  height: '100%',
                  backgroundColor: '#dc2626',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '12px',
                fontSize: '12px'
              }}>
                <div>
                  <strong>Status:</strong> {validationProgress.status}
                </div>
                <div>
                  <strong>Progress:</strong> {validationProgress.progress.toFixed(1)}%
                </div>
                <div>
                  <strong>Records:</strong> {validationProgress.records_processed.toLocaleString()} / {validationProgress.total_records.toLocaleString()}
                </div>
                <div>
                  <strong>Errors:</strong> {validationProgress.errors_found.toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Load Step */}
      {currentStep === 'load' && (
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '2px solid #FF9800',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#FF9800',
              marginBottom: '8px'
            }}>
              ⚡ Load to FSM
            </h3>
            <p style={{ fontSize: '13px', color: '#999' }}>
              Load validated records to FSM system
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={handleStartLoad}
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: loading ? '#2a2a2a' : '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {loading ? 'Loading...' : 'Load to FSM'}
            </button>
          </div>
        </div>
      )}

      {/* Completed Step */}
      {currentStep === 'completed' && loadResult && (
        <div style={{
          backgroundColor: loadResult.status === 'success' ? '#1a2e1a' : '#2e1a1a',
          border: `2px solid ${loadResult.status === 'success' ? '#22c55e' : '#dc2626'}`,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: loadResult.status === 'success' ? '#22c55e' : '#dc2626',
              marginBottom: '8px'
            }}>
              {loadResult.status === 'success' ? '🎉 Load Completed Successfully' : '❌ Load Failed'}
            </h3>
            <p style={{ fontSize: '13px', color: '#999' }}>
              {loadResult.status === 'success' 
                ? 'All records have been loaded to FSM successfully'
                : 'Load failed and all records have been rolled back'
              }
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              padding: '16px',
              backgroundColor: '#0a0a0a',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '600', color: '#FF9800' }}>
                {loadResult.success_count.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>Records Loaded</div>
            </div>
            <div style={{
              padding: '16px',
              backgroundColor: '#0a0a0a',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '600', color: '#FF9800' }}>
                {loadResult.business_class}
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>Business Class</div>
            </div>
            <div style={{
              padding: '16px',
              backgroundColor: '#0a0a0a',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '600', color: '#FF9800' }}>
                {loadResult.run_group}
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>Run Group</div>
            </div>
          </div>
        </div>
      )}

      {/* RunGroup Dialog */}
      {showRunGroupDialog && runGroupCheckResult && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '2px solid #FF9800',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: '#FF9800',
                marginBottom: '8px'
              }}>
                RunGroup Already Exists
              </h3>
              <p style={{ fontSize: '14px', color: '#999' }}>
                The RunGroup "<span style={{ color: '#FF9800', fontWeight: '500' }}>{runGroupCheckResult.run_group}</span>" 
                already exists with <span style={{ color: '#FF9800', fontWeight: '500' }}>{runGroupCheckResult.record_count}</span> records.
              </p>
            </div>

            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '12px'
            }}>
              <button
                onClick={handleRunGroupDeleteAndLoad}
                style={{
                  padding: '14px 20px',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                🗑️ Delete Existing & Load New Records
              </button>

              <button
                onClick={handleRunGroupContinue}
                style={{
                  padding: '14px 20px',
                  backgroundColor: '#FF9800',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                ➕ Continue Anyway (Add to Existing)
              </button>

              <button
                onClick={handleRunGroupCancel}
                style={{
                  padding: '14px 20px',
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversionWorkflow;