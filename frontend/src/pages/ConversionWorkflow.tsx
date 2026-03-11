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
  total_failure: number;
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
  const [businessClass, setBusinessClass] = useState('');
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
      
      // Automatically perform mapping after successful upload
      setCurrentStep('mapping');
      await performAutomaticMapping(response.data.job_id);
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Automatic mapping after upload
  const performAutomaticMapping = async (uploadJobId: number) => {
    try {
      // First fetch schema
      setFetchingSchema(true);
      const schemaResponse = await api.post('/schema/fetch', {
        business_class: businessClass,
        force_refresh: false
      });
      setSchema(schemaResponse.data);
      setFetchingSchema(false);
      
      // Then perform auto-mapping
      setAutoMapping(true);
      const mappingResponse = await api.post('/mapping/auto-map', {
        job_id: uploadJobId,
        business_class: businessClass
      });

      setMappingData(mappingResponse.data);
      
      // Convert to UI format (FSM field -> CSV column)
      const uiMapping: Record<string, string> = {};
      Object.entries(mappingResponse.data.mapping).forEach(([csvCol, fsmData]: [string, any]) => {
        uiMapping[fsmData.fsm_field] = csvCol;
      });
      setMapping(uiMapping);
      
    } catch (error: any) {
      console.error('Automatic mapping failed:', error);
      
      // If automatic mapping fails, still show the mapping step but without mappings
      // User can manually map fields
      setMappingData({
        mapping: {},
        unmapped_csv_columns: fileInfo?.headers || [],
        unmapped_fsm_fields: []
      });
      
      // Show a more user-friendly error message
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      alert(`Automatic mapping failed: ${errorMessage}\n\nYou can still manually map fields in the next step.`);
    } finally {
      setFetchingSchema(false);
      setAutoMapping(false);
    }
  };

  // Schema fetching
  const fetchSchema = async () => {
    setFetchingSchema(true);
    try {
      const response = await api.post('/schema/fetch', {
        business_class: businessClass,
        force_refresh: false
      });
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
    if (!jobId) return;

    setAutoMapping(true);
    try {
      const response = await api.post('/mapping/auto-map', {
        job_id: jobId,
        business_class: businessClass
      });

      // The response structure from the backend
      const mappingResult = response.data;
      
      // Convert backend mapping format to frontend format
      setMappingData({
        mapping: mappingResult.mapping || {},
        unmapped_csv_columns: mappingResult.validation?.unmapped_csv_columns || [],
        unmapped_fsm_fields: mappingResult.validation?.unmapped_fsm_fields || []
      });
      
      // Convert to UI format (FSM field -> CSV column)
      const uiMapping: Record<string, string> = {};
      Object.entries(mappingResult.mapping || {}).forEach(([csvCol, fsmData]: [string, any]) => {
        if (fsmData && fsmData.fsm_field) {
          uiMapping[fsmData.fsm_field] = csvCol;
        }
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
    if (!jobId) {
      alert('No job ID available. Please upload a file first.');
      return;
    }

    if (!mappingData.mapping || Object.keys(mappingData.mapping).length === 0) {
      alert('No field mappings available. Please map fields first.');
      return;
    }

    setValidating(true);
    setValidationProgress(null);
    setValidationErrors([]);
    
    try {
      console.log('Starting validation for job:', jobId);
      console.log('Business class:', businessClass);
      console.log('Mapping:', mappingData.mapping);
      
      const response = await api.post('/validation/start', {
        job_id: jobId,
        business_class: businessClass,
        mapping: mappingData.mapping, // Use backend-compatible format
        enable_rules: true
      });

      console.log('Validation start response:', response.data);

      // Reset retry counter for polling
      (pollValidationProgress as any).retryCount = 0;
      
      // Wait a bit longer before starting to poll to allow backend to initialize
      setTimeout(pollValidationProgress, 2000); // Wait 2 seconds before first poll
    } catch (error: any) {
      console.error('Validation failed:', error);
      setValidating(false);
      
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      alert(`Validation failed to start: ${errorMessage}`);
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
      
      // If it's a 404, the job might not exist or validation not started
      if (error.response?.status === 404) {
        console.log('Validation job not found, stopping polling');
        setValidating(false);
        setValidationProgress(null);
      } else {
        // For other errors, retry a few times before giving up
        const retryCount = (pollValidationProgress as any).retryCount || 0;
        if (retryCount < 3) {
          (pollValidationProgress as any).retryCount = retryCount + 1;
          console.log(`Retrying progress check (${retryCount + 1}/3)...`);
          setTimeout(pollValidationProgress, 2000); // Wait longer before retry
        } else {
          console.error('Max retries reached, stopping validation polling');
          setValidating(false);
          alert('Failed to check validation progress. Please try again.');
        }
      }
    }
  };

  const loadValidationErrors = async () => {
    if (!jobId) return;

    try {
      const response = await api.get(`/validation/errors/${jobId}`);
      setValidationErrors(response.data.errors || []);
    } catch (error: any) {
      console.error('Failed to load errors:', error);
      
      if (error.response?.status === 404) {
        console.log('No validation errors found for this job');
        setValidationErrors([]);
      } else {
        console.error('Error loading validation errors:', error.response?.data?.detail || error.message);
      }
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
          fontSize: '32px', 
          fontWeight: '700', 
          color: '#ffffff' 
        }}>
          Data Conversion Workflow
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

      {/* Step Indicator */}
      <div style={{
        marginBottom: '30px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '12px',
          gap: '20px'
        }}>
          <div style={{
            padding: '8px 16px',
            backgroundColor: currentStep === 'upload' ? '#dc2626' : '#2a2a2a',
            color: '#ffffff',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            1. Upload File
          </div>
          <div style={{
            padding: '8px 16px',
            backgroundColor: currentStep === 'mapping' ? '#dc2626' : '#2a2a2a',
            color: '#ffffff',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            2. Mapping
          </div>
          <div style={{
            padding: '8px 16px',
            backgroundColor: currentStep === 'validation' ? '#dc2626' : '#2a2a2a',
            color: '#ffffff',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            3. Validation
          </div>
          <div style={{
            padding: '8px 16px',
            backgroundColor: currentStep === 'load' || currentStep === 'completed' ? '#dc2626' : '#2a2a2a',
            color: '#ffffff',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            4. Load
          </div>
        </div>
        
        {/* Step Descriptions */}
        <div style={{
          fontSize: '12px',
          color: '#999',
          textAlign: 'left',
          lineHeight: '1.4'
        }}>
          {currentStep === 'upload' && (
            <p>Select your CSV file and business class to begin the conversion process</p>
          )}
          {currentStep === 'mapping' && (
            <p>Map CSV columns to FSM fields using auto-mapping or manual selection</p>
          )}
          {currentStep === 'validation' && (
            <p>Validate data against FSM schema and business rules to identify errors</p>
          )}
          {currentStep === 'load' && (
            <p>Load validated records to FSM system with automatic error handling</p>
          )}
          {currentStep === 'completed' && (
            <p>Review load results and optionally interface transactions to General Ledger</p>
          )}
        </div>
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
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              📁 Upload CSV File
            </h3>
            <p style={{ fontSize: '14px', color: '#999' }}>
              Select a CSV file to begin the conversion process
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: '500',
              color: '#ffffff'
            }}>
              Business Class:
            </label>
            <input
              type="text"
              value={businessClass}
              readOnly
              style={{
                width: '400px',
                padding: '12px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #3a3a3a',
                borderRadius: '6px',
                color: '#FF9800',
                fontSize: '14px',
                cursor: 'not-allowed',
                fontWeight: '500'
              }}
              placeholder="Auto-detected from filename"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: '500',
              color: '#ffffff'
            }}>
              CSV File:
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0] || null;
                setFile(selectedFile);
                
                // Auto-detect business class from filename
                if (selectedFile) {
                  const filename = selectedFile.name;
                  const filenameParts = filename.split('_');
                  if (filenameParts.length > 0) {
                    const detectedBusinessClass = filenameParts[0];
                    
                    // Map common filename patterns to business classes
                    const businessClassMap: Record<string, string> = {
                      'GLTransactionInterface': 'GLTransactionInterface',
                      'GLTransaction': 'GLTransactionInterface',
                      'GL': 'GLTransactionInterface',
                      'PayablesInvoice': 'PayablesInvoice',
                      'Payables': 'PayablesInvoice',
                      'Invoice': 'PayablesInvoice',
                      'AP': 'PayablesInvoice',
                      'Vendor': 'Vendor',
                      'Suppliers': 'Vendor',
                      'Customer': 'Customer',
                      'Customers': 'Customer',
                      'AR': 'Customer'
                    };
                    
                    // Check if detected business class matches any known patterns
                    const mappedBusinessClass = businessClassMap[detectedBusinessClass];
                    if (mappedBusinessClass) {
                      setBusinessClass(mappedBusinessClass);
                    } else {
                      // If no exact match, use the detected part as-is
                      setBusinessClass(detectedBusinessClass);
                    }
                  }
                }
              }}
              style={{
                width: '400px',
                padding: '12px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #3a3a3a',
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
              backgroundColor: file && !uploading ? '#FF9800' : '#2a2a2a',
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
              <p style={{ color: '#fff', marginBottom: '8px' }}>
                <strong>Filename:</strong> {fileInfo.filename}
              </p>
              <p style={{ color: '#fff', marginBottom: '8px' }}>
                <strong>Total Records:</strong> {fileInfo.total_records.toLocaleString()}
              </p>
              <p style={{ color: '#fff' }}>
                <strong>Headers:</strong> {fileInfo.headers.join(', ')}
              </p>
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
              {Object.keys(mappingData.mapping || {}).length > 0 
                ? 'Auto-mapped CSV columns to FSM fields based on field name similarity'
                : 'Map CSV columns to FSM fields using auto-mapping or manual selection'
              }
            </p>
          </div>

          {/* Loading State */}
          {(fetchingSchema || autoMapping) && (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: '#FF9800'
            }}>
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                {fetchingSchema ? 'Fetching FSM Schema...' : 'Auto-Mapping Fields...'}
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                Please wait while we analyze your data
              </div>
            </div>
          )}

          {/* Manual Mapping Buttons (shown if auto-mapping failed or no mappings) */}
          {!fetchingSchema && !autoMapping && Object.keys(mappingData.mapping).length === 0 && (
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
            </div>
          )}

          {/* Continue Button */}
          {Object.keys(mappingData.mapping || {}).length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={() => setCurrentStep('validation')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Continue to Validation
              </button>
            </div>
          )}

          {/* Mapping Table */}
          {Object.keys(mappingData.mapping || {}).length > 0 && (
            <div style={{
              backgroundColor: '#0a0a0a',
              borderRadius: '6px',
              border: '1px solid #2a2a2a',
              overflow: 'hidden'
            }}>
              <h4 style={{ 
                color: '#FF9800', 
                marginBottom: '0px',
                padding: '16px',
                borderBottom: '1px solid #2a2a2a',
                fontSize: '16px',
                fontWeight: '600'
              }}>
                Field Mappings ({Object.keys(mappingData.mapping || {}).length} mapped)
              </h4>
              
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 1fr 120px',
                gap: '16px',
                padding: '12px 16px',
                backgroundColor: '#1a1a1a',
                borderBottom: '1px solid #2a2a2a',
                fontSize: '12px',
                fontWeight: '600',
                color: '#999',
                textTransform: 'uppercase'
              }}>
                <div>Enable</div>
                <div>CSV Fields</div>
                <div>Map to FSM Fields</div>
                <div>Confidence</div>
              </div>

              {/* Table Rows */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {Object.entries(mappingData.mapping || {}).map(([csvColumn, mappingInfo], index) => (
                  <div key={csvColumn} style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 1fr 120px',
                    gap: '16px',
                    padding: '12px 16px',
                    borderBottom: index < Object.keys(mappingData.mapping || {}).length - 1 ? '1px solid #2a2a2a' : 'none',
                    alignItems: 'center',
                    fontSize: '13px'
                  }}>
                    {/* Enable Checkbox */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => {}}
                        style={{
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>

                    {/* CSV Field */}
                    <div style={{ 
                      color: '#fff',
                      fontWeight: '500',
                      fontFamily: 'monospace'
                    }}>
                      {csvColumn}
                    </div>

                    {/* FSM Field Searchable Input */}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={mappingInfo.fsm_field || ''}
                        onChange={(e) => {
                          const newFsmField = e.target.value;
                          // Update both mapping structures
                          setMapping(prev => {
                            const newMapping = { ...prev };
                            // Remove old mapping
                            Object.keys(newMapping).forEach(key => {
                              if (newMapping[key] === csvColumn) {
                                delete newMapping[key];
                              }
                            });
                            // Add new mapping
                            if (newFsmField) {
                              newMapping[newFsmField] = csvColumn;
                            }
                            return newMapping;
                          });
                          
                          setMappingData(prev => ({
                            ...prev,
                            mapping: {
                              ...prev.mapping,
                              [csvColumn]: {
                                ...mappingInfo,
                                fsm_field: newFsmField,
                                confidence: 'manual'
                              }
                            }
                          }));
                        }}
                        placeholder="Type FSM field name..."
                        list={`fsm-fields-${csvColumn}`}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #2a2a2a',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '12px'
                        }}
                      />
                      <datalist id={`fsm-fields-${csvColumn}`}>
                        {schema && Object.keys(schema.properties || {})
                          .filter(field => 
                            field.toLowerCase().includes((mappingInfo.fsm_field || '').toLowerCase())
                          )
                          .slice(0, 20) // Limit to 20 suggestions for performance
                          .map(field => (
                            <option key={field} value={field} />
                          ))}
                      </datalist>
                    </div>

                    {/* Confidence Badge */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500',
                        textTransform: 'uppercase',
                        backgroundColor: 
                          mappingInfo.confidence === 'exact' ? '#1a4d2e' :
                          mappingInfo.confidence === 'fuzzy' ? '#4d2e1a' :
                          mappingInfo.confidence === 'manual' ? '#1a2e4d' : '#2a2a2a',
                        color: 
                          mappingInfo.confidence === 'exact' ? '#4CAF50' :
                          mappingInfo.confidence === 'fuzzy' ? '#FF9800' :
                          mappingInfo.confidence === 'manual' ? '#2196F3' : '#999',
                        border: `1px solid ${
                          mappingInfo.confidence === 'exact' ? '#4CAF50' :
                          mappingInfo.confidence === 'fuzzy' ? '#FF9800' :
                          mappingInfo.confidence === 'manual' ? '#2196F3' : '#2a2a2a'
                        }`
                      }}>
                        {mappingInfo.confidence === 'exact' ? 'Exact' :
                         mappingInfo.confidence === 'fuzzy' ? 'Fuzzy' :
                         mappingInfo.confidence === 'manual' ? 'Manual' : 'Unknown'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Unmapped Fields Summary */}
              {((mappingData.unmapped_csv_columns?.length || 0) > 0 || (mappingData.unmapped_fsm_fields?.length || 0) > 0) && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#1a1a1a',
                  borderTop: '1px solid #2a2a2a',
                  fontSize: '12px'
                }}>
                  {(mappingData.unmapped_csv_columns?.length || 0) > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ color: '#FF9800', fontWeight: '500' }}>
                        Unmapped CSV Columns ({mappingData.unmapped_csv_columns?.length || 0}):
                      </span>
                      <span style={{ color: '#999', marginLeft: '8px' }}>
                        {mappingData.unmapped_csv_columns?.join(', ') || ''}
                      </span>
                    </div>
                  )}
                  {(mappingData.unmapped_fsm_fields?.length || 0) > 0 && (
                    <div>
                      <span style={{ color: '#dc2626', fontWeight: '500' }}>
                        Unmapped FSM Fields ({mappingData.unmapped_fsm_fields?.length || 0}):
                      </span>
                      <span style={{ color: '#999', marginLeft: '8px' }}>
                        {mappingData.unmapped_fsm_fields?.join(', ') || ''}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manual Mapping Helper (when no automatic mappings) */}
          {!fetchingSchema && !autoMapping && Object.keys(mappingData.mapping || {}).length === 0 && schema && (
            <div style={{
              padding: '20px',
              backgroundColor: '#0a0a0a',
              borderRadius: '6px',
              border: '1px solid #2a2a2a',
              textAlign: 'center'
            }}>
              <p style={{ color: '#999', marginBottom: '16px' }}>
                Automatic mapping failed. You can manually create mappings by clicking "Auto-Map Fields" above,
                or proceed to validation without mappings.
              </p>
              <button
                onClick={() => setCurrentStep('validation')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  border: '1px solid #3a3a3a',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Skip Mapping (Continue to Validation)
              </button>
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

          {/* Validation Errors Display */}
          {validationErrors.length > 0 && (
            <div style={{
              backgroundColor: '#0a0a0a',
              borderRadius: '6px',
              border: '1px solid #2a2a2a',
              overflow: 'hidden',
              marginBottom: '20px'
            }}>
              <h4 style={{ 
                color: '#dc2626', 
                marginBottom: '0px',
                padding: '16px',
                borderBottom: '1px solid #2a2a2a',
                fontSize: '16px',
                fontWeight: '600'
              }}>
                Validation Errors ({validationErrors.length} found)
              </h4>
              
              {/* Error Filters */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid #2a2a2a',
                display: 'flex',
                gap: '16px',
                alignItems: 'center'
              }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#999', marginRight: '8px' }}>
                    Filter by field:
                  </label>
                  <input
                    type="text"
                    value={errorFilter}
                    onChange={(e) => setErrorFilter(e.target.value)}
                    placeholder="Field name..."
                    style={{
                      padding: '6px 8px',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #2a2a2a',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px',
                      width: '150px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#999', marginRight: '8px' }}>
                    Filter by type:
                  </label>
                  <select
                    value={errorTypeFilter}
                    onChange={(e) => setErrorTypeFilter(e.target.value)}
                    style={{
                      padding: '6px 8px',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #2a2a2a',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px',
                      width: '150px'
                    }}
                  >
                    <option value="">All types</option>
                    <option value="required">Required</option>
                    <option value="type">Type</option>
                    <option value="enum">Enum</option>
                    <option value="pattern">Pattern</option>
                    <option value="reference">Reference</option>
                  </select>
                </div>
              </div>

              {/* Error Table */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 120px 1fr 1fr 120px',
                  gap: '12px',
                  padding: '12px 16px',
                  backgroundColor: '#1a1a1a',
                  borderBottom: '1px solid #2a2a2a',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#999',
                  textTransform: 'uppercase'
                }}>
                  <div>Row</div>
                  <div>Field</div>
                  <div>Value</div>
                  <div>Error</div>
                  <div>Type</div>
                </div>

                {validationErrors
                  .filter(error => 
                    (!errorFilter || error.field_name.toLowerCase().includes(errorFilter.toLowerCase())) &&
                    (!errorTypeFilter || error.error_type.toLowerCase().includes(errorTypeFilter.toLowerCase()))
                  )
                  .slice(0, 50) // Show first 50 errors
                  .map((error, index) => (
                    <div key={index} style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 120px 1fr 1fr 120px',
                      gap: '12px',
                      padding: '12px 16px',
                      borderBottom: '1px solid #2a2a2a',
                      alignItems: 'center',
                      fontSize: '13px'
                    }}>
                      <div style={{ color: '#FF9800', fontWeight: '500' }}>
                        {error.row_number}
                      </div>
                      <div style={{ color: '#fff', fontFamily: 'monospace' }}>
                        {error.field_name}
                      </div>
                      <div style={{ 
                        color: '#999',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {error.field_value || '(empty)'}
                      </div>
                      <div style={{ color: '#dc2626', fontSize: '12px' }}>
                        {error.error_message}
                      </div>
                      <div>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontSize: '10px',
                          fontWeight: '500',
                          textTransform: 'uppercase',
                          backgroundColor: 
                            error.error_type === 'required' ? '#4d1a1a' :
                            error.error_type === 'type' ? '#1a2e4d' :
                            error.error_type === 'enum' ? '#4d2e1a' :
                            error.error_type === 'pattern' ? '#2e1a4d' :
                            error.error_type === 'reference' ? '#1a4d2e' : '#2a2a2a',
                          color: 
                            error.error_type === 'required' ? '#dc2626' :
                            error.error_type === 'type' ? '#2196F3' :
                            error.error_type === 'enum' ? '#FF9800' :
                            error.error_type === 'pattern' ? '#9C27B0' :
                            error.error_type === 'reference' ? '#4CAF50' : '#999'
                        }}>
                          {error.error_type}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {validationErrors.length > 50 && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#1a1a1a',
                  borderTop: '1px solid #2a2a2a',
                  fontSize: '12px',
                  color: '#999',
                  textAlign: 'center'
                }}>
                  Showing first 50 errors. Export CSV to see all {validationErrors.length} errors.
                </div>
              )}
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
        <div>
          {/* Load Results Display */}
          <div style={{
            backgroundColor: loadResult.total_failure === 0 ? '#1a2e1a' : '#2e1a1a',
            border: `2px solid ${loadResult.total_failure === 0 ? '#22c55e' : '#dc2626'}`,
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: loadResult.total_failure === 0 ? '#22c55e' : '#dc2626',
                marginBottom: '8px'
              }}>
                {loadResult.total_failure === 0 ? '🎉 Load Completed Successfully' : '❌ Load Failed'}
              </h3>
              <p style={{ fontSize: '13px', color: '#999' }}>
                {loadResult.total_failure === 0 
                  ? 'All records have been loaded to FSM successfully'
                  : 'Load failed and all records have been rolled back'
                }
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
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
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#FF9800' }}>
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
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#FF9800' }}>
                  {loadResult.run_group}
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>Run Group</div>
              </div>
              <div style={{
                padding: '16px',
                backgroundColor: '#0a0a0a',
                borderRadius: '6px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#FF9800' }}>
                  {loadResult.chunks_processed}
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>Chunks Processed</div>
              </div>
            </div>

            {/* Next Steps */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px'
            }}>
              <button
                onClick={() => {
                  setCurrentStep('upload');
                  setFile(null);
                  setJobId(null);
                  setFileInfo(null);
                  setMapping({});
                  setMappingData({ mapping: {}, unmapped_csv_columns: [], unmapped_fsm_fields: [] });
                  setValidationErrors([]);
                  setLoadResult(null);
                }}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                🔄 Start New Conversion
              </button>
              <button
                onClick={() => setCurrentStep('validation')}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#4CAF50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                📊 View Validation Results
              </button>
              <button
                onClick={onBack}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                🏠 Back to Dashboard
              </button>
            </div>
          </div>

          {/* Interface Transactions Section */}
          {loadResult.total_failure === 0 && (
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
                  ⚡ Interface Transactions
                </h3>
                <p style={{ fontSize: '13px', color: '#999' }}>
                  Post/journalize loaded transactions to General Ledger
                </p>
              </div>

              {!showInterfaceForm ? (
                <button
                  onClick={() => setShowInterfaceForm(true)}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#FF9800',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Interface Transactions
                </button>
              ) : (
                <div>
                  {/* Interface Parameters Form */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '16px',
                    marginBottom: '20px'
                  }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#999' }}>
                        RunGroup
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.runGroup}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, runGroup: e.target.value }))}
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
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#999' }}>
                        Enterprise Group
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.enterpriseGroup}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, enterpriseGroup: e.target.value }))}
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
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#999' }}>
                        Accounting Entity
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.accountingEntity}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, accountingEntity: e.target.value }))}
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
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#999' }}>
                        Primary Ledger
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.primaryLedger}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, primaryLedger: e.target.value }))}
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
                  </div>

                  {/* Boolean Parameters */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px'
                  }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: '#1a1a1a',
                      borderRadius: '6px',
                      border: '1px solid #2a2a2a',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={interfaceParams.journalizeByEntity}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, journalizeByEntity: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Journalize By Entity
                      </span>
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: '#1a1a1a',
                      borderRadius: '6px',
                      border: '1px solid #2a2a2a',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={interfaceParams.bypassOrganizationCode}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, bypassOrganizationCode: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Bypass Organization Code
                      </span>
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: '#1a1a1a',
                      borderRadius: '6px',
                      border: '1px solid #2a2a2a',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={interfaceParams.bypassAccountCode}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, bypassAccountCode: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Bypass Account Code
                      </span>
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: '#1a1a1a',
                      borderRadius: '6px',
                      border: '1px solid #2a2a2a',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={interfaceParams.interfaceInDetail}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, interfaceInDetail: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Interface In Detail
                      </span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={handleInterfaceTransactions}
                      disabled={interfacing}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: interfacing ? '#2a2a2a' : '#FF9800',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: interfacing ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      {interfacing ? 'Interfacing...' : 'Start Interface'}
                    </button>
                    <button
                      onClick={() => setShowInterfaceForm(false)}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: '#2a2a2a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Interface Result */}
                  {interfaceResult && (
                    <div style={{
                      marginTop: '20px',
                      padding: '16px',
                      backgroundColor: '#1a2e1a',
                      border: '1px solid #22c55e',
                      borderRadius: '6px'
                    }}>
                      <p style={{ color: '#22c55e', fontSize: '14px', margin: 0 }}>
                        {interfaceResult}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Delete RunGroup Section */}
          {loadResult.total_failure === 0 && (
            <div style={{
              backgroundColor: '#1a1a1a',
              border: '2px solid #dc2626',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  color: '#dc2626',
                  marginBottom: '8px'
                }}>
                  🗑️ Delete RunGroup
                </h3>
                <p style={{ fontSize: '13px', color: '#999' }}>
                  Permanently delete all transactions for this RunGroup (useful for testing)
                </p>
              </div>

              <button
                onClick={handleDeleteRunGroup}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Delete RunGroup
              </button>
            </div>
          )}
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

      {/* Delete RunGroup Confirmation Dialog */}
      {showDeleteDialog && (
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
            border: '2px solid #dc2626',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗑️</div>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: '#dc2626',
                marginBottom: '8px'
              }}>
                Delete RunGroup
              </h3>
              <p style={{ fontSize: '14px', color: '#999', marginBottom: '16px' }}>
                This will permanently delete all transactions for RunGroup:
              </p>
              <p style={{ fontSize: '16px', color: '#dc2626', fontWeight: '600', marginBottom: '16px' }}>
                {loadResult?.run_group}
              </p>
              <p style={{ fontSize: '12px', color: '#dc2626' }}>
                ⚠️ This action cannot be undone!
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#fff' }}>
                Type the RunGroup name to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={loadResult?.run_group}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #dc2626',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '12px'
            }}>
              <button
                onClick={confirmDeleteRunGroup}
                disabled={deleting || deleteConfirmation !== loadResult?.run_group}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  backgroundColor: deleting || deleteConfirmation !== loadResult?.run_group ? '#2a2a2a' : '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deleting || deleteConfirmation !== loadResult?.run_group ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {deleting ? 'Deleting...' : 'Delete RunGroup'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmation('');
                }}
                style={{
                  flex: 1,
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