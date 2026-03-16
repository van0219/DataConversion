import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../theme';

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
    enabled?: boolean; // Add enabled flag
  }>;
  unmapped_csv_columns: string[];
  unmapped_fsm_fields: string[];
}

interface ValidationProgress {
  job_id: number;
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
  invalid_value: string;
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
  error_details?: any; // FSM API error response
  error_message?: string; // Human-readable error message
  interface_result?: any; // Interface result if triggered
}

const ConversionWorkflow: React.FC<ConversionWorkflowProps> = ({ onBack }) => {
  // Add CSS animations for transitions
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes slideInFromRight {
        0% {
          opacity: 0;
          transform: translateX(30px);
        }
        100% {
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      @keyframes slideInFromLeft {
        0% {
          opacity: 0;
          transform: translateX(-30px);
        }
        100% {
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      @keyframes fadeIn {
        0% {
          opacity: 0;
          transform: translateY(20px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .step-container {
        animation: fadeIn 0.5s ease-out;
      }
      
      .step-forward {
        animation: slideInFromRight 0.5s ease-out;
      }
      
      .step-backward {
        animation: slideInFromLeft 0.5s ease-out;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Step management
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'validation' | 'load' | 'postValidation' | 'completed'>('upload');
  const [previousStep, setPreviousStep] = useState<'upload' | 'mapping' | 'validation' | 'load' | 'postValidation' | 'completed'>('upload');
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward'>('forward');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set(['upload'])); // Track completed steps

  // Helper function to change steps with animation
  const changeStep = (newStep: 'upload' | 'mapping' | 'validation' | 'load' | 'postValidation' | 'completed') => {
    const stepOrder = ['upload', 'mapping', 'validation', 'load', 'postValidation', 'completed'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const newIndex = stepOrder.indexOf(newStep);
    
    setPreviousStep(currentStep);
    setTransitionDirection(newIndex > currentIndex ? 'forward' : 'backward');
    setCurrentStep(newStep);
    
    // Mark the new step as completed when moving forward
    if (newIndex > currentIndex) {
      setCompletedSteps(prev => new Set([...prev, newStep]));
    }
  };

  // Helper function to check if a step can be navigated to
  const canNavigateToStep = (step: string) => {
    return completedSteps.has(step);
  };

  // Helper function to handle step click
  const handleStepClick = (step: 'upload' | 'mapping' | 'validation' | 'load' | 'postValidation' | 'completed') => {
    if (canNavigateToStep(step) && step !== currentStep) {
      changeStep(step);
    }
  };

  // Get animation class based on transition direction
  const getAnimationClass = () => {
    if (transitionDirection === 'forward') {
      return 'step-forward';
    } else if (transitionDirection === 'backward') {
      return 'step-backward';
    }
    return 'step-container';
  };
  
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
  const [searchDropdownOpen, setSearchDropdownOpen] = useState<string | null>(null); // Track which dropdown is open
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({}); // Track search query per field
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchDropdownOpen) {
        setSearchDropdownOpen(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchDropdownOpen]);

  // Validation state
  const [validating, setValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState<ValidationProgress | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [errorFilter, setErrorFilter] = useState('');
  const [errorTypeFilter, setErrorTypeFilter] = useState('');
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<number | null>(null);
  const [loadingRuleSets, setLoadingRuleSets] = useState(false);
  const [availableRuleSets, setAvailableRuleSets] = useState<any[]>([]);
  const [enableRules, setEnableRules] = useState(true);

  // Load state
  const [loading, setLoading] = useState(false);
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);
  const [loadProgress, setLoadProgress] = useState<{
    records_processed: number;
    total_records: number;
    chunks_processed: number;
    total_chunks: number;
    elapsed_seconds: number;
  } | null>(null);

  // Interface state
  const [showInterfaceForm, setShowInterfaceForm] = useState(false);
  const [interfaceParams, setInterfaceParams] = useState({
    runGroup: '',
    enterpriseGroup: '',
    accountingEntity: '',
    editOnly: false,                    // Don't edit only - we want to interface
    editAndInterface: false,            // Default to unchecked - user must opt-in
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

  // Auto-populate interface parameters when entering Load step
  useEffect(() => {
    const autoPopulateOnLoadStep = async () => {
      // Only auto-populate when entering Load step and checkbox is already checked
      if (currentStep === 'load' && showInterfaceForm && jobId && mappingData.mapping) {
        // Check if fields are already populated to avoid unnecessary API calls
        if (!interfaceParams.enterpriseGroup) {
          console.log('Auto-populating interface parameters on Load step entry...');
          
          // Note: RunGroup will be generated by backend, so we only populate Enterprise Group
          const financeEnterpriseGroup = await getMostFrequentValue('FinanceEnterpriseGroup');
          
          console.log('Auto-population results on step entry:', { financeEnterpriseGroup });
          
          setInterfaceParams(prev => ({
            ...prev,
            enterpriseGroup: financeEnterpriseGroup
          }));
        }
      }
    };

    autoPopulateOnLoadStep();
  }, [currentStep, showInterfaceForm, jobId, mappingData.mapping]);

  // Load rule sets when entering validation step
  useEffect(() => {
    if (currentStep === 'validation' && businessClass) {
      loadRuleSets();
    }
  }, [currentStep, businessClass]);

  // Function to get most frequent value from CSV data
  const getMostFrequentValue = async (fieldName: string): Promise<string> => {
    console.log(`getMostFrequentValue called for field: ${fieldName}`);
    
    if (!jobId) {
      console.log('No jobId available');
      return '';
    }
    
    try {
      console.log(`Making API call to /upload/${jobId}/sample-data`);
      
      // Get sample records from the job
      const response = await api.get(`/upload/${jobId}/sample-data`);
      const sampleData = response.data;
      
      console.log('Sample data response:', sampleData);
      
      if (!sampleData || !sampleData.sample_records) {
        console.log('No sample records found in response');
        return '';
      }
      
      // Find the CSV column that maps to this FSM field
      let csvColumn = '';
      console.log('Current mapping data:', mappingData.mapping);
      
      Object.entries(mappingData.mapping).forEach(([csvCol, fsmData]) => {
        console.log(`Checking mapping: ${csvCol} -> ${fsmData.fsm_field}`);
        if (fsmData.fsm_field === fieldName || fsmData.fsm_field === `GLTransactionInterface.${fieldName}`) {
          csvColumn = csvCol;
          console.log(`Found matching column: ${csvColumn}`);
        }
      });
      
      if (!csvColumn) {
        console.log(`No CSV column found for field: ${fieldName}`);
        return '';
      }
      
      // Count frequency of values in the sample data
      const valueCounts: Record<string, number> = {};
      sampleData.sample_records.forEach((record: any, index: number) => {
        const value = record[csvColumn];
        console.log(`Record ${index}, column '${csvColumn}':`, value);
        if (value && typeof value === 'string' && value.trim()) {
          const trimmedValue = value.trim();
          valueCounts[trimmedValue] = (valueCounts[trimmedValue] || 0) + 1;
        }
      });
      
      console.log('Value counts:', valueCounts);
      
      // Find the most frequent value
      let mostFrequentValue = '';
      let maxCount = 0;
      Object.entries(valueCounts).forEach(([value, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostFrequentValue = value;
        }
      });
      
      console.log(`Most frequent value for ${fieldName}: '${mostFrequentValue}' (count: ${maxCount})`);
      return mostFrequentValue;
    } catch (error) {
      console.error(`Error getting most frequent value for ${fieldName}:`, error);
      return '';
    }
  };

  // Auto-populate RunGroup and Finance Enterprise Group when interface checkbox is checked
  const handleInterfaceCheckboxChange = async (checked: boolean) => {
    setShowInterfaceForm(checked);
    
    if (checked && jobId && mappingData.mapping) {
      const financeEnterpriseGroup = await getMostFrequentValue('FinanceEnterpriseGroup');
      setInterfaceParams(prev => ({
        ...prev,
        enterpriseGroup: financeEnterpriseGroup
      }));
    }
  };
  const [interfaceResult, setInterfaceResult] = useState<{
    success: boolean;
    message: string;
    verification?: {
      result_sequence: string;
      status: string;
      status_label: string;
      total_records: number;
      successfully_imported: number;
      records_with_error: number;
      run_group: string;
      interface_successful: boolean;
    } | null;
    error?: string;
    error_details?: Array<{
      sequence_number: string;
      run_group: string;
      error_message: string;
      description: string;
      transaction_amount: string;
      account_code: string;
      posting_date: string;
      finance_enterprise_group: string;
      accounting_entity: string;
    }>;
  } | null>(null);

  // Reset error table pagination when interface result changes
  useEffect(() => {
    setErrorTableCurrentPage(1);
  }, [interfaceResult]);

  // Delete RunGroup state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Interface error table pagination state
  const [errorTableCurrentPage, setErrorTableCurrentPage] = useState(1);
  const errorTablePageSize = 10;
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
      setCompletedSteps(prev => new Set([...prev, 'mapping'])); // Mark mapping as available
      changeStep('mapping');
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
      // Get existing schema (no auto-fetch)
      setFetchingSchema(true);
      const schemaResponse = await api.get(`/schema/${businessClass}/latest`);
      
      // Parse schema_json string to object
      const schemaData = schemaResponse.data;
      let parsedSchema: any = {};
      
      if (schemaData.schema_json && typeof schemaData.schema_json === 'string') {
        parsedSchema = JSON.parse(schemaData.schema_json);
      } else if (schemaData.schema_json && typeof schemaData.schema_json === 'object') {
        parsedSchema = schemaData.schema_json;
      }
      
      // Convert fields array to properties object for frontend compatibility
      if (parsedSchema.fields && Array.isArray(parsedSchema.fields)) {
        const properties: Record<string, any> = {};
        parsedSchema.fields.forEach((field: any) => {
          properties[field.name] = {
            type: field.type,
            required: field.required,
            enum: field.enum,
            pattern: field.pattern,
            format: field.format,
            maxLength: field.maxLength,
            description: field.description
          };
        });
        parsedSchema.properties = properties;
      }
      
      setSchema(parsedSchema);
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
      
      // Check if it's a schema not found error
      if (error.response?.status === 404) {
        alert(
          `No schema found for business class '${businessClass}'.\n\n` +
          `Please upload a schema via the Schema Management page first, then try again.`
        );
        return;
      }
      
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
      const response = await api.get(`/schema/${businessClass}/latest`);
      
      // Parse schema_json string to object
      const schemaData = response.data;
      console.log('Raw schema data:', schemaData);
      console.log('schema_json type:', typeof schemaData.schema_json);
      
      let parsedSchema: any = {};
      
      if (schemaData.schema_json && typeof schemaData.schema_json === 'string') {
        try {
          parsedSchema = JSON.parse(schemaData.schema_json);
          console.log('Successfully parsed schema_json');
        } catch (e) {
          console.error('Failed to parse schema_json:', e);
        }
      } else if (schemaData.schema_json && typeof schemaData.schema_json === 'object') {
        parsedSchema = schemaData.schema_json;
        console.log('schema_json is already an object');
      }
      
      // Convert fields array to properties object for frontend compatibility
      if (parsedSchema.fields && Array.isArray(parsedSchema.fields)) {
        const properties: Record<string, any> = {};
        parsedSchema.fields.forEach((field: any) => {
          properties[field.name] = {
            type: field.type,
            required: field.required,
            enum: field.enum,
            pattern: field.pattern,
            format: field.format,
            maxLength: field.maxLength,
            description: field.description
          };
        });
        parsedSchema.properties = properties;
        console.log('Converted fields array to properties object');
      }
      
      console.log('Final parsed schema:', parsedSchema);
      console.log('Schema properties:', parsedSchema.properties);
      console.log('Schema properties count:', parsedSchema.properties ? Object.keys(parsedSchema.properties).length : 0);
      
      setSchema(parsedSchema);
    } catch (error: any) {
      console.error('Schema fetch failed:', error);
      
      // Check if it's a schema not found error
      if (error.response?.status === 404) {
        alert(
          `No schema found for business class '${businessClass}'.\n\n` +
          `Please upload a schema via the Schema Management page first.`
        );
      } else {
        alert(`Schema fetch failed: ${error.response?.data?.detail || error.message}`);
      }
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
  const loadRuleSets = async () => {
    if (!businessClass) {
      console.log('No business class selected, skipping rule set load');
      return;
    }

    setLoadingRuleSets(true);
    try {
      console.log('Loading rule sets for business class:', businessClass);
      const response = await api.get('/rules/rule-sets', {
        params: { business_class: businessClass }
      });
      console.log('Rule sets loaded:', response.data);
      
      setAvailableRuleSets(response.data || []); // Store in availableRuleSets
      
      // Don't auto-select Default rule set - let user choose
      // Default will be used if selectedRuleSetId is null
    } catch (error) {
      console.error('Failed to load rule sets:', error);
      setAvailableRuleSets([]);
    } finally {
      setLoadingRuleSets(false);
    }
  };

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
    
    const startTime = Date.now();
    
    try {
      console.log('Starting validation for job:', jobId);
      console.log('Business class:', businessClass);
      console.log('Selected rule set ID:', selectedRuleSetId);
      
      // Filter out disabled fields
      const enabledMapping = Object.entries(mappingData.mapping)
        .filter(([_, mappingInfo]) => mappingInfo.enabled !== false)
        .reduce((acc, [csvColumn, mappingInfo]) => {
          acc[csvColumn] = mappingInfo;
          return acc;
        }, {} as Record<string, any>);
      
      console.log('Enabled mapping:', enabledMapping);
      
      const response = await api.post('/validation/start', {
        job_id: jobId,
        business_class: businessClass,
        mapping: enabledMapping, // Use filtered mapping
        enable_rules: enableRules, // Use state variable
        selected_rule_set_id: selectedRuleSetId // Pass selected rule set
      });

      console.log('Validation start response:', response.data);

      // Ensure minimum 2-second loading animation
      const elapsed = Date.now() - startTime;
      const minDisplayTime = 2000; // 2 seconds
      if (elapsed < minDisplayTime) {
        await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsed));
      }

      // Validation is synchronous - it's already complete!
      // Just load the summary and errors
      setValidating(false);
      setCompletedSteps(prev => new Set([...prev, 'validation', 'load'])); // Mark validation and load as available
      changeStep('validation');
      await loadValidationSummary();
      await loadValidationErrors();
      
    } catch (error: any) {
      console.error('Validation failed:', error);
      
      // Ensure minimum 2-second loading animation even on error
      const elapsed = Date.now() - startTime;
      const minDisplayTime = 2000;
      if (elapsed < minDisplayTime) {
        await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsed));
      }
      
      setValidating(false);
      
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      alert(`Validation failed: ${errorMessage}`);
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
        setCompletedSteps(prev => new Set([...prev, 'validation', 'load'])); // Mark validation and load as available
        changeStep('validation');
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

  const loadValidationSummary = async () => {
    if (!jobId) return;

    try {
      const response = await api.get(`/validation/${jobId}/summary`);
      const summary = response.data;
      
      // Set validation progress with summary data
      setValidationProgress({
        job_id: summary.job_id,
        status: summary.status,
        progress: 100,
        current_chunk: 1,
        total_chunks: 1,
        records_processed: summary.total_records,
        total_records: summary.total_records,
        errors_found: summary.error_count,
        filename: fileInfo?.filename || ''
      });
    } catch (error: any) {
      console.error('Failed to load validation summary:', error);
    }
  };

  const loadValidationErrors = async () => {
    if (!jobId) return;

    try {
      const response = await api.get(`/validation/${jobId}/errors`);
      setValidationErrors(response.data || []);
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
      const response = await api.get(`/validation/${jobId}/errors/export`, {
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

    console.log('handleStartLoad: Starting load process with unique RunGroup');
    
    // No need to check for existing RunGroup since we generate unique ones
    await proceedWithLoad();
  };
  const proceedWithLoad = async () => {
    if (!jobId || !mappingData.mapping) return;

    console.log('proceedWithLoad: Starting load');
    setLoading(true);
    setLoadProgress({
      records_processed: 0,
      total_records: fileInfo?.total_records || 0,
      chunks_processed: 0,
      total_chunks: Math.ceil((fileInfo?.total_records || 0) / 100),
      elapsed_seconds: 0
    });
    
    const startTime = Date.now();
    
    try {
      // Filter out disabled fields
      const enabledMapping = Object.entries(mappingData.mapping)
        .filter(([_, mappingInfo]) => mappingInfo.enabled !== false)
        .reduce((acc, [csvColumn, mappingInfo]) => {
          acc[csvColumn] = mappingInfo;
          return acc;
        }, {} as Record<string, any>);
      
      console.log('proceedWithLoad: Sending load request with enabled mapping');
      
      // Start progress polling for large files
      let progressInterval: number | null = null;
      if ((fileInfo?.total_records || 0) > 1000) {
        progressInterval = setInterval(async () => {
          try {
            const progressResponse = await api.get(`/load/${jobId}/progress`);
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setLoadProgress(prev => ({
              ...progressResponse.data,
              elapsed_seconds: elapsed
            }));
          } catch (error) {
            // Progress endpoint might not exist yet, ignore errors
          }
        }, 1000);
      }
      
      const response = await api.post('/load/start', {
        job_id: jobId,
        business_class: businessClass,
        mapping: enabledMapping,
        chunk_size: 100,
        trigger_interface: showInterfaceForm,
        interface_params: showInterfaceForm ? {
          enterpriseGroup: interfaceParams.enterpriseGroup,
          accountingEntity: interfaceParams.accountingEntity,
          editOnly: interfaceParams.editOnly,
          editAndInterface: interfaceParams.editAndInterface,
          partialUpdate: interfaceParams.partialUpdate,
          journalizeByEntity: interfaceParams.journalizeByEntity,
          journalByJournalCode: interfaceParams.journalByJournalCode,
          bypassOrganizationCode: interfaceParams.bypassOrganizationCode,
          bypassAccountCode: interfaceParams.bypassAccountCode,
          bypassStructureRelationEdit: interfaceParams.bypassStructureRelationEdit,
          interfaceInDetail: interfaceParams.interfaceInDetail,
          currencyTable: interfaceParams.currencyTable,
          bypassNegativeRateEdit: interfaceParams.bypassNegativeRateEdit,
          primaryLedger: interfaceParams.primaryLedger
        } : null
      });

      // Clear progress polling
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      
      // Ensure minimum display time for better UX (only for small files)
      const elapsed = Date.now() - startTime;
      const recordCount = fileInfo?.total_records || 0;
      
      // Only enforce minimum display for small files (under 1000 records)
      // Large files naturally take longer and don't need artificial delay
      if (recordCount < 1000) {
        const minDisplayTime = 1500; // Reduced to 1.5 seconds for small files
        if (elapsed < minDisplayTime) {
          await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsed));
        }
      }

      console.log('proceedWithLoad: Load response received:', response.data);
      setLoadResult(response.data);
      setCompletedSteps(prev => new Set([...prev, 'completed'])); // Mark completed step as available
      changeStep('completed');
      
      // Set interface params with RunGroup from backend and Finance Enterprise Group from CSV
      if (response.data.run_group) {
        // Get Finance Enterprise Group from CSV data
        const financeEnterpriseGroup = await getMostFrequentValue('FinanceEnterpriseGroup');
        
        setInterfaceParams(prev => ({
          ...prev,
          runGroup: response.data.run_group,  // Use backend-generated RunGroup
          enterpriseGroup: financeEnterpriseGroup
        }));
      }
    } catch (error: any) {
      console.error('Load failed:', error);
      alert(`Load failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
      setLoadProgress(null);
    }
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

      // Parse interface result with verification data
      const result = response.data.result;
      if (result && result.verification) {
        const verification = result.verification;
        const success = result.interface_successful; // Use backend verification flag
        
        if (success) {
          setInterfaceResult({
            success: true,
            message: `Interface completed successfully for RunGroup: ${interfaceParams.runGroup}`,
            verification: verification,
            error_details: result.error_details || []
          });
        } else {
          setInterfaceResult({
            success: false,
            message: `Interface failed for RunGroup: ${interfaceParams.runGroup}`,
            verification: verification,
            error: result.error || 'Interface verification failed - records were not successfully posted to GL',
            error_details: result.error_details || []
          });
        }
      } else {
        // Fallback for old format - assume success if no verification data
        setInterfaceResult({
          success: true,
          message: `Interface API call completed for RunGroup: ${interfaceParams.runGroup} (verification unavailable)`,
          verification: null,
          error_details: []
        });
      }
      
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
      backgroundColor: theme.background.primary, 
      color: theme.text.primary, 
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
          color: theme.text.primary 
        }}>
          Data Conversion Workflow
        </h1>
        <button
          onClick={() => {
            // Go back to previous step
            if (currentStep === 'mapping') {
              changeStep('upload');
            } else if (currentStep === 'validation') {
              changeStep('mapping');
            } else if (currentStep === 'load' || currentStep === 'completed') {
              changeStep('validation');
            } else {
              // Reset workflow state and go to dashboard
              setFile(null);
              setJobId(null);
              setFileInfo(null);
              setBusinessClass('');
              setSchema(null);
              setMapping({});
              setMappingData({ mapping: {}, unmapped_csv_columns: [], unmapped_fsm_fields: [] });
              setValidationProgress(null);
              setValidationErrors([]);
              setLoadResult(null);
              setCompletedSteps(new Set(['upload'])); // Reset completed steps
              changeStep('upload');
              onBack();
            }
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: theme.background.tertiary,
            color: theme.text.primary,
            border: `1px solid ${theme.background.quaternary}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ← {currentStep === 'upload' ? 'Back to Dashboard' : 'Back to Previous Step'}
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
          <div 
            onClick={() => handleStepClick('upload')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentStep === 'upload' ? theme.primary.main : (canNavigateToStep('upload') ? theme.background.tertiary : theme.interactive.disabled),
              color: currentStep === 'upload' ? '#ffffff' : theme.text.primary,
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: canNavigateToStep('upload') ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              border: canNavigateToStep('upload') ? `1px solid ${theme.background.quaternary}` : '1px solid transparent',
              opacity: canNavigateToStep('upload') ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (canNavigateToStep('upload') && currentStep !== 'upload') {
                e.currentTarget.style.backgroundColor = theme.interactive.hover;
              }
            }}
            onMouseLeave={(e) => {
              if (canNavigateToStep('upload') && currentStep !== 'upload') {
                e.currentTarget.style.backgroundColor = theme.background.tertiary;
              }
            }}
          >
            1. Upload File {canNavigateToStep('upload') && currentStep !== 'upload' && '✓'}
          </div>
          <div 
            onClick={() => handleStepClick('mapping')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentStep === 'mapping' ? theme.primary.main : (canNavigateToStep('mapping') ? theme.background.tertiary : theme.interactive.disabled),
              color: currentStep === 'mapping' ? '#ffffff' : theme.text.primary,
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: canNavigateToStep('mapping') ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              border: canNavigateToStep('mapping') ? `1px solid ${theme.background.quaternary}` : '1px solid transparent',
              opacity: canNavigateToStep('mapping') ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (canNavigateToStep('mapping') && currentStep !== 'mapping') {
                e.currentTarget.style.backgroundColor = theme.interactive.hover;
              }
            }}
            onMouseLeave={(e) => {
              if (canNavigateToStep('mapping') && currentStep !== 'mapping') {
                e.currentTarget.style.backgroundColor = theme.background.tertiary;
              }
            }}
          >
            2. Mapping {canNavigateToStep('mapping') && currentStep !== 'mapping' && '✓'}
          </div>
          <div 
            onClick={() => handleStepClick('validation')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentStep === 'validation' ? theme.primary.main : (canNavigateToStep('validation') ? theme.background.tertiary : theme.interactive.disabled),
              color: currentStep === 'validation' ? '#ffffff' : theme.text.primary,
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: canNavigateToStep('validation') ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              border: canNavigateToStep('validation') ? `1px solid ${theme.background.quaternary}` : '1px solid transparent',
              opacity: canNavigateToStep('validation') ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (canNavigateToStep('validation') && currentStep !== 'validation') {
                e.currentTarget.style.backgroundColor = theme.interactive.hover;
              }
            }}
            onMouseLeave={(e) => {
              if (canNavigateToStep('validation') && currentStep !== 'validation') {
                e.currentTarget.style.backgroundColor = theme.background.tertiary;
              }
            }}
          >
            3. Validation {canNavigateToStep('validation') && currentStep !== 'validation' && '✓'}
          </div>
          <div 
            onClick={() => handleStepClick('load')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentStep === 'load' || currentStep === 'completed' ? theme.primary.main : (canNavigateToStep('load') ? theme.background.tertiary : theme.interactive.disabled),
              color: currentStep === 'load' || currentStep === 'completed' ? '#ffffff' : theme.text.primary,
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: canNavigateToStep('load') ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              border: canNavigateToStep('load') ? `1px solid ${theme.background.quaternary}` : '1px solid transparent',
              opacity: canNavigateToStep('load') ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (canNavigateToStep('load') && currentStep !== 'load' && currentStep !== 'completed') {
                e.currentTarget.style.backgroundColor = theme.interactive.hover;
              }
            }}
            onMouseLeave={(e) => {
              if (canNavigateToStep('load') && currentStep !== 'load' && currentStep !== 'completed') {
                e.currentTarget.style.backgroundColor = theme.background.tertiary;
              }
            }}
          >
            4. Load {canNavigateToStep('load') && currentStep !== 'load' && currentStep !== 'postValidation' && currentStep !== 'completed' && '✓'}
          </div>
          <div 
            onClick={() => handleStepClick('postValidation')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentStep === 'postValidation' ? theme.primary.main : (canNavigateToStep('postValidation') ? theme.background.tertiary : theme.interactive.disabled),
              color: currentStep === 'postValidation' ? '#ffffff' : theme.text.primary,
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: canNavigateToStep('postValidation') ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              border: canNavigateToStep('postValidation') ? `1px solid ${theme.background.quaternary}` : '1px solid transparent',
              opacity: canNavigateToStep('postValidation') ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (canNavigateToStep('postValidation') && currentStep !== 'postValidation') {
                e.currentTarget.style.backgroundColor = theme.interactive.hover;
              }
            }}
            onMouseLeave={(e) => {
              if (canNavigateToStep('postValidation') && currentStep !== 'postValidation') {
                e.currentTarget.style.backgroundColor = theme.background.tertiary;
              }
            }}
          >
            5. Post Validation {canNavigateToStep('postValidation') && currentStep !== 'postValidation' && '✓'}
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
          {currentStep === 'postValidation' && (
            <p>Post-load validation and reconciliation features (coming soon)</p>
          )}
          {currentStep === 'completed' && (
            <p>Review load results and optionally interface transactions to General Ledger</p>
          )}
        </div>
      </div>

      {/* Upload Step */}
      {currentStep === 'upload' && (
        <div className={getAnimationClass()} style={{
          backgroundColor: theme.background.secondary,
          border: `2px solid ${theme.accent.purpleTintMedium}`,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: theme.primary.main,
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ⬆️ Upload CSV File
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
              color: theme.text.primary
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
                backgroundColor: theme.background.tertiary,
                border: `1px solid ${theme.background.quaternary}`,
                borderRadius: '6px',
                color: theme.primary.main,
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
              color: theme.text.primary
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
                backgroundColor: theme.background.secondary,
                border: `1px solid ${theme.background.quaternary}`,
                borderRadius: '6px',
                color: theme.text.primary,
                fontSize: '14px'
              }}
            />
          </div>

          <button
            onClick={handleFileUpload}
            disabled={!file || uploading}
            style={{
              padding: '12px 24px',
              backgroundColor: file && !uploading ? theme.primary.main : theme.interactive.disabled,
              color: file && !uploading ? '#ffffff' : theme.text.muted,
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
              backgroundColor: theme.background.tertiary, 
              borderRadius: '6px',
              border: `1px solid ${theme.background.quaternary}`
            }}>
              <h4 style={{ color: 'theme.primary.main', marginBottom: '12px' }}>File Information</h4>
              <p style={{ color: theme.text.primary, marginBottom: '8px' }}>
                <strong>Filename:</strong> {fileInfo.filename}
              </p>
              <p style={{ color: theme.text.primary, marginBottom: '8px' }}>
                <strong>Total Records:</strong> {fileInfo.total_records.toLocaleString()}
              </p>
              <p style={{ color: theme.text.primary }}>
                <strong>Headers:</strong> {fileInfo.headers.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Mapping Step */}
      {currentStep === 'mapping' && (
        <div className={getAnimationClass()} style={{
          backgroundColor: theme.background.secondary,
          border: `2px solid ${theme.background.quaternary}`,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: theme.primary.main,
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
              color: 'theme.primary.main'
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
                  backgroundColor: fetchingSchema ? theme.background.tertiary : theme.primary.main,
                  color: '#FFFFFF',
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
                  backgroundColor: schema && !autoMapping ? theme.primary.main : theme.background.tertiary,
                  color: '#FFFFFF',
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
                onClick={() => changeStep('validation')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: theme.primary.main,
                  color: '#FFFFFF',
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
              backgroundColor: theme.background.secondary,
              borderRadius: '6px',
              border: `1px solid ${theme.background.quaternary}`,
              overflow: 'hidden'
            }}>
              <h4 style={{ 
                color: theme.primary.main, 
                marginBottom: '0px',
                padding: '16px',
                borderBottom: `1px solid ${theme.background.quaternary}`,
                fontSize: '16px',
                fontWeight: '600'
              }}>
                Field Mappings ({Object.keys(mappingData.mapping || {}).length} mapped)
              </h4>
              
              {/* Mapping Summary Bar */}
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#F7F7FB',
                borderBottom: `1px solid ${theme.background.quaternary}`,
                display: 'flex',
                gap: '24px',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                {(() => {
                  const totalFields = Object.keys(mappingData.mapping || {}).length;
                  const enabledFields = Object.values(mappingData.mapping || {}).filter(m => m.enabled !== false).length;
                  const mappedFields = Object.values(mappingData.mapping || {}).filter(m => m.fsm_field && m.enabled !== false).length;
                  const unmappedFields = enabledFields - mappedFields;
                  const conflictFields = 0; // Could add conflict detection logic here
                  
                  return (
                    <>
                      <span style={{ color: theme.text.primary }}>
                        <strong>{mappedFields}</strong> fields mapped
                      </span>
                      {unmappedFields > 0 && (
                        <span style={{ color: '#FF9800' }}>
                          <strong>{unmappedFields}</strong> unmapped
                        </span>
                      )}
                      {conflictFields > 0 && (
                        <span style={{ color: '#C8102E' }}>
                          <strong>{conflictFields}</strong> conflicts
                        </span>
                      )}
                      <span style={{ color: theme.text.secondary }}>
                        {totalFields - enabledFields} disabled
                      </span>
                    </>
                  );
                })()}
              </div>
              
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 1fr 120px',
                gap: '16px',
                padding: '12px 16px',
                backgroundColor: '#F1F1F6',
                borderBottom: `1px solid ${theme.background.quaternary}`,
                fontSize: '12px',
                fontWeight: '600',
                color: theme.text.secondary,
                textTransform: 'uppercase'
              }}>
                <div>Enable</div>
                <div>CSV Fields</div>
                <div>Map to FSM Fields</div>
                <div>Confidence</div>
              </div>

              {/* Table Rows */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {Object.entries(mappingData.mapping || {}).map(([csvColumn, mappingInfo], index) => {
                  const isEnabled = mappingInfo.enabled !== false;
                  return (
                  <div key={csvColumn} style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 1fr 120px',
                    gap: '16px',
                    padding: '10px 16px',
                    borderBottom: index < Object.keys(mappingData.mapping || {}).length - 1 ? `1px solid ${theme.background.quaternary}` : 'none',
                    alignItems: 'center',
                    fontSize: '13px',
                    opacity: isEnabled ? 1 : 0.4,
                    backgroundColor: index % 2 === 0 ? theme.background.secondary : '#FAFAFC',
                    transition: 'background-color 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (isEnabled) {
                      e.currentTarget.style.backgroundColor = theme.interactive.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = index % 2 === 0 ? theme.background.secondary : '#FAFAFC';
                  }}>
                    {/* Enable Checkbox */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => {
                          setMappingData(prev => ({
                            ...prev,
                            mapping: {
                              ...prev.mapping,
                              [csvColumn]: {
                                ...mappingInfo,
                                enabled: e.target.checked
                              }
                            }
                          }));
                        }}
                        style={{
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>

                    {/* CSV Field */}
                    <div style={{ 
                      color: isEnabled ? theme.text.primary : theme.text.muted,
                      fontWeight: '500',
                      fontFamily: 'monospace'
                    }}>
                      {csvColumn}
                    </div>

                    {/* FSM Field Searchable Dropdown */}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={searchQuery[csvColumn] !== undefined ? searchQuery[csvColumn] : (mappingInfo.fsm_field || '')}
                        disabled={!isEnabled}
                        onChange={(e) => {
                          if (!isEnabled) return;
                          setSearchQuery(prev => ({ ...prev, [csvColumn]: e.target.value }));
                        }}
                        placeholder="Search FSM field..."
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          backgroundColor: isEnabled ? theme.background.secondary : theme.background.secondary,
                          border: `1px solid ${isEnabled ? theme.background.quaternary : theme.background.secondary}`,
                          borderRadius: '4px',
                          color: isEnabled ? theme.text.primary : theme.text.muted,
                          fontSize: '12px',
                          cursor: isEnabled ? 'text' : 'not-allowed',
                          transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                        }}
                        onFocus={(e) => {
                          if (isEnabled) {
                            e.target.style.borderColor = theme.primary.main;
                            e.target.style.boxShadow = `0 0 0 2px ${theme.accent.purpleTintMedium}`;
                            setSearchDropdownOpen(csvColumn);
                            setSearchQuery(prev => ({ ...prev, [csvColumn]: mappingInfo.fsm_field || '' }));
                          }
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = isEnabled ? theme.background.quaternary : theme.background.secondary;
                          e.target.style.boxShadow = 'none';
                          // Delay closing to allow click on dropdown items
                          setTimeout(() => setSearchDropdownOpen(null), 150);
                        }}
                      />
                      
                      {/* Dropdown List */}
                      {searchDropdownOpen === csvColumn && isEnabled && schema && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          maxHeight: '200px',
                          overflowY: 'auto',
                          backgroundColor: theme.background.secondary,
                          border: `1px solid ${theme.background.quaternary}`,
                          borderRadius: '4px',
                          marginTop: '4px',
                          zIndex: 1000,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                        }}>
                          {(() => {
                            const allFields = Object.keys(schema.properties || {});
                            const searchTerm = (searchQuery[csvColumn] || '').toLowerCase();
                            const filteredFields = allFields.filter(field => 
                              field.toLowerCase().includes(searchTerm)
                            );
                            
                            console.log('Schema fields:', allFields.length);
                            console.log('Search term:', searchTerm);
                            console.log('Filtered fields:', filteredFields.length);
                            
                            if (filteredFields.length === 0) {
                              return (
                                <div style={{
                                  padding: '8px 12px',
                                  fontSize: '12px',
                                  color: '#666',
                                  textAlign: 'center'
                                }}>
                                  No matching fields found
                                </div>
                              );
                            }
                            
                            return filteredFields.slice(0, 50).map(field => (
                              <div
                                key={field}
                                onClick={() => {
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
                                    newMapping[field] = csvColumn;
                                    return newMapping;
                                  });
                                  
                                  setMappingData(prev => ({
                                    ...prev,
                                    mapping: {
                                      ...prev.mapping,
                                      [csvColumn]: {
                                        ...mappingInfo,
                                        fsm_field: field,
                                        confidence: 'manual'
                                      }
                                    }
                                  }));
                                  
                                  setSearchDropdownOpen(null);
                                  setSearchQuery(prev => ({ ...prev, [csvColumn]: field }));
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  color: theme.text.primary,
                                  borderBottom: '1px solid theme.background.tertiary',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'theme.background.tertiary'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {field}
                              </div>
                            ));
                          })()}
                        </div>
                      )}
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
                          mappingInfo.confidence === 'manual' ? '#1a2e4d' : 'theme.background.tertiary',
                        color: '#FFFFFF',
                        border: `1px solid ${
                          mappingInfo.confidence === 'exact' ? '#4CAF50' :
                          mappingInfo.confidence === 'fuzzy' ? 'theme.primary.main' :
                          mappingInfo.confidence === 'manual' ? '#2196F3' : 'theme.background.tertiary'
                        }`
                      }}>
                        {mappingInfo.confidence === 'exact' ? 'Exact' :
                         mappingInfo.confidence === 'fuzzy' ? 'Fuzzy' :
                         mappingInfo.confidence === 'manual' ? 'Manual' : 'Unknown'}
                      </span>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Unmapped Fields Summary */}
              {((mappingData.unmapped_csv_columns?.length || 0) > 0 || (mappingData.unmapped_fsm_fields?.length || 0) > 0) && (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'theme.background.secondary',
                  borderTop: '1px solid theme.background.tertiary',
                  fontSize: '12px'
                }}>
                  {(mappingData.unmapped_csv_columns?.length || 0) > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ color: 'theme.primary.main', fontWeight: '500' }}>
                        Unmapped CSV Columns ({mappingData.unmapped_csv_columns?.length || 0}):
                      </span>
                      <span style={{ color: '#999', marginLeft: '8px' }}>
                        {mappingData.unmapped_csv_columns?.join(', ') || ''}
                      </span>
                    </div>
                  )}
                  {(mappingData.unmapped_fsm_fields?.length || 0) > 0 && (
                    <div>
                      <span style={{ color: 'theme.primary.main', fontWeight: '500' }}>
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
              backgroundColor: 'theme.background.secondary',
              borderRadius: '6px',
              border: `1px solid ${theme.background.tertiary}`,
              textAlign: 'center'
            }}>
              <p style={{ color: '#999', marginBottom: '16px' }}>
                Automatic mapping failed. You can manually create mappings by clicking "Auto-Map Fields" above,
                or proceed to validation without mappings.
              </p>
              <button
                onClick={() => changeStep('validation')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'theme.background.tertiary',
                  color: '#fff',
                  border: `1px solid ${theme.background.quaternary}`,
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
        <div className={getAnimationClass()} style={{
          backgroundColor: 'theme.background.secondary',
          border: `2px solid ${theme.accent.purpleTintMedium}`,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: 'theme.primary.main',
              marginBottom: '8px'
            }}>
              ✅ Data Validation
            </h3>
            <p style={{ fontSize: '13px', color: '#999' }}>
              Validate data against FSM schema and business rules
            </p>
          </div>

          {/* Validation Options */}
          {!validating && validationProgress?.status !== 'validated' && (
            <div style={{
              backgroundColor: theme.background.primary,
              border: `1px solid ${theme.background.quaternary}`,
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <h4 style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: theme.text.primary,
                marginBottom: '16px'
              }}>
                Validation Options
              </h4>

              {/* Rule Set Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  color: theme.text.secondary,
                  fontSize: '13px',
                  fontWeight: '500'
                }}>
                  Rule Set:
                </label>
                <select
                  value={selectedRuleSetId || ''}
                  onChange={(e) => setSelectedRuleSetId(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: theme.background.secondary,
                    border: `1px solid ${theme.background.quaternary}`,
                    borderRadius: '6px',
                    color: theme.text.primary,
                    fontSize: '14px'
                  }}
                >
                  <option value="">{availableRuleSets.find(rs => rs.is_common)?.name || 'Default'} ({availableRuleSets.find(rs => rs.is_common)?.rule_count ?? 0} rules)</option>
                  {availableRuleSets.filter(rs => !rs.is_common && rs.is_active).map(rs => (
                    <option key={rs.id} value={rs.id}>
                      {rs.name} ({rs.rule_count} rules)
                    </option>
                  ))}
                </select>
                <p style={{ 
                  fontSize: '12px', 
                  color: theme.text.tertiary, 
                  marginTop: '6px' 
                }}>
                  Select which rule set to apply during validation. Default rule set is used if none selected.
                </p>
              </div>

            </div>
          )}

          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={handleStartValidation}
              disabled={validating}
              style={{
                padding: '12px 24px',
                backgroundColor: validating ? theme.background.tertiary : theme.primary.main,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                cursor: validating ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {validating ? 'Validating...' : (validationProgress?.status === 'validated' || validationProgress?.status === 'failed') ? 'Re-run Validation' : 'Start Validation'}
            </button>

            {(validationProgress?.status === 'validated' || validationProgress?.status === 'failed') && (
              <>
                {validationProgress.errors_found > 0 && (
                  <>
                    <button
                      onClick={async () => {
                        await loadValidationErrors();
                      }}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: theme.primary.main,
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      📋 View Errors ({validationProgress.errors_found})
                    </button>

                    <button
                      onClick={exportErrors}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: '#4CAF50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      📥 Download Error Report
                    </button>
                  </>
                )}

                <button
                  onClick={() => changeStep('load')}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginLeft: 'auto'
                  }}
                >
                  ➡️ Continue to Load
                </button>
              </>
            )}
          </div>

          {/* Loading Animation */}
          {validating && (
            <div style={{
              padding: '24px',
              backgroundColor: theme.background.secondary,
              borderRadius: '8px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              {/* Animated Spinner */}
              <div style={{
                width: '48px',
                height: '48px',
                border: `4px solid ${theme.background.quaternary}`,
                borderTop: `4px solid ${theme.primary.main}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px auto'
              }} />
              
              <div style={{ fontSize: '16px', fontWeight: '600', color: theme.primary.main, marginBottom: '8px' }}>
                Validating Data...
              </div>
              
              <div style={{ fontSize: '13px', color: theme.text.secondary }}>
                Checking {fileInfo?.total_records || 0} records against FSM schema{enableRules ? ' and business rules' : ''}...
              </div>
            </div>
          )}

          {validationProgress && (
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: 'theme.background.secondary',
              borderRadius: '6px',
              border: `1px solid ${theme.background.tertiary}`
            }}>
              <h4 style={{ color: 'theme.primary.main', marginBottom: '12px' }}>
                Validation Progress
              </h4>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'theme.background.tertiary',
                borderRadius: '4px',
                marginBottom: '12px',
                overflow: 'hidden',
                display: 'flex'
              }}>
                {/* Green bar for valid records */}
                <div style={{
                  width: `${(validationProgress.records_processed - validationProgress.errors_found) / validationProgress.total_records * 100}%`,
                  height: '100%',
                  backgroundColor: '#22c55e',
                  transition: 'width 0.3s ease'
                }} />
                {/* Red bar for invalid records */}
                <div style={{
                  width: `${validationProgress.errors_found / validationProgress.total_records * 100}%`,
                  height: '100%',
                  backgroundColor: 'theme.primary.main',
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
              backgroundColor: 'theme.background.secondary',
              borderRadius: '6px',
              border: `1px solid ${theme.background.tertiary}`,
              overflow: 'hidden',
              marginBottom: '20px'
            }}>
              <h4 style={{ 
                color: 'theme.primary.main', 
                marginBottom: '0px',
                padding: '16px',
                borderBottom: '1px solid theme.background.tertiary',
                fontSize: '16px',
                fontWeight: '600'
              }}>
                Validation Errors ({validationErrors.length} found)
              </h4>
              
              {/* Error Filters */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid theme.background.tertiary',
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
                      backgroundColor: 'theme.background.secondary',
                      border: `1px solid ${theme.background.tertiary}`,
                      borderRadius: '4px',
                      color: theme.text.primary, fontSize: '12px',
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
                      backgroundColor: 'theme.background.secondary',
                      border: `1px solid ${theme.background.tertiary}`,
                      borderRadius: '4px',
                      color: theme.text.primary, fontSize: '12px',
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
                  backgroundColor: 'theme.background.secondary',
                  borderBottom: '1px solid theme.background.tertiary',
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

                {(() => {
                  // Group errors by row_number
                  const filtered = validationErrors.filter(error =>
                    (!errorFilter || error.field_name.toLowerCase().includes(errorFilter.toLowerCase())) &&
                    (!errorTypeFilter || error.error_type.toLowerCase().includes(errorTypeFilter.toLowerCase()))
                  );

                  const grouped: Record<number, ValidationError[]> = {};
                  filtered.forEach(err => {
                    if (!grouped[err.row_number]) grouped[err.row_number] = [];
                    grouped[err.row_number].push(err);
                  });

                  const rows = Object.entries(grouped).slice(0, 50);

                  return rows.map(([rowNum, errs]) => (
                    <div key={rowNum} style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 120px 1fr 1fr 120px',
                      gap: '12px',
                      padding: '12px 16px',
                      borderBottom: '1px solid theme.background.tertiary',
                      alignItems: 'start',
                      fontSize: '13px'
                    }}>
                      <div style={{ color: 'theme.primary.main', fontWeight: '500', paddingTop: '2px' }}>
                        {rowNum}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {errs.map((err, i) => (
                          <div key={i} style={{ color: theme.text.primary, fontFamily: 'monospace' }}>
                            {err.field_name}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {errs.map((err, i) => (
                          <div key={i} style={{ color: '#999', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {err.invalid_value || '(empty)'}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {errs.map((err, i) => (
                          <div key={i} style={{ color: 'theme.primary.main', fontSize: '12px' }}>
                            {err.error_message}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {errs.map((err, i) => (
                          <span key={i} style={{
                            padding: '2px 6px',
                            borderRadius: '8px',
                            fontSize: '10px',
                            fontWeight: '500',
                            textTransform: 'uppercase',
                            backgroundColor:
                              err.error_type === 'required' ? '#4d1a1a' :
                              err.error_type === 'type' ? '#1a2e4d' :
                              err.error_type === 'enum' ? '#4d2e1a' :
                              err.error_type === 'pattern' ? '#2e1a4d' :
                              err.error_type === 'reference' ? '#1a4d2e' : 'theme.background.tertiary',
                            color:
                              err.error_type === 'required' ? 'theme.primary.main' :
                              err.error_type === 'type' ? '#2196F3' :
                              err.error_type === 'enum' ? 'theme.primary.main' :
                              err.error_type === 'pattern' ? '#9C27B0' :
                              err.error_type === 'reference' ? '#4CAF50' : '#999'
                          }}>
                            {err.error_type}
                          </span>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {validationErrors.length > 50 && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'theme.background.secondary',
                  borderTop: '1px solid theme.background.tertiary',
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
        <div className={getAnimationClass()} style={{
          backgroundColor: 'theme.background.secondary',
          border: `2px solid ${theme.accent.purpleTintMedium}`,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: 'theme.primary.main',
              marginBottom: '8px'
            }}>
              ⚡ Load to FSM
            </h3>
            <p style={{ fontSize: '13px', color: theme.text.secondary }}>
              Load validated records to FSM system
            </p>
          </div>

          {!loading && (
            <div style={{ marginBottom: '20px' }}>
              {/* Interface Option Checkbox */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: theme.text.primary
                }}>
                  <input
                    type="checkbox"
                    checked={showInterfaceForm}
                    onChange={(e) => handleInterfaceCheckboxChange(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontWeight: '500' }}>
                    ⚡ Interface transactions to General Ledger after load
                  </span>
                </label>
                <div style={{
                  fontSize: '12px',
                  color: theme.text.secondary,
                  marginTop: '4px',
                  marginLeft: '30px'
                }}>
                  Automatically post/journalize loaded records to GL (saves manual step)
                </div>
              </div>

              {/* Interface Parameters Form - Show when checkbox is checked */}
              {showInterfaceForm && (
                <div style={{
                  backgroundColor: 'theme.background.secondary',
                  border: `2px solid ${theme.accent.purpleTintMedium}`,
                  borderRadius: '12px',
                  padding: '24px',
                  marginBottom: '20px'
                }}>
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      color: theme.primary.main,
                      marginBottom: '8px'
                    }}>
                      ⚙️ Interface Parameters
                    </h3>
                    <p style={{ fontSize: '13px', color: theme.text.secondary }}>
                      Configure parameters for interfacing transactions to General Ledger
                    </p>
                  </div>

                  {/* Text Input Parameters - Flexbox 2 column layout */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ flex: '1 1 calc(50% - 8px)', minWidth: '300px' }}>
                      <label style={{ fontSize: '12px', color: theme.text.primary, marginBottom: '4px', display: 'block', fontWeight: '500' }}>
                        RunGroup * (Generated by system)
                      </label>
                      <input
                        type="text"
                        value={businessClass ? `${businessClass.toUpperCase().substring(0, 15)}_${new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14)}` : ''}
                        readOnly
                        placeholder="Example: GLTRANSACTIONIN_20260313063353"
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: theme.background.tertiary,
                          border: `1px solid ${theme.background.quaternary}`,
                          borderRadius: '6px',
                          color: theme.text.primary,
                          fontSize: '13px',
                          cursor: 'not-allowed',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{ flex: '1 1 calc(50% - 8px)', minWidth: '300px' }}>
                      <label style={{ fontSize: '12px', color: theme.text.primary, marginBottom: '4px', display: 'block', fontWeight: '500' }}>
                        Finance Enterprise Group (Auto-filled from file)
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.enterpriseGroup}
                        readOnly
                        placeholder="Auto-filled from CSV data"
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: theme.background.tertiary,
                          border: `1px solid ${theme.background.quaternary}`,
                          borderRadius: '6px',
                          color: theme.text.secondary,
                          fontSize: '13px',
                          cursor: 'not-allowed',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{ flex: '1 1 calc(50% - 8px)', minWidth: '300px' }}>
                      <label style={{ fontSize: '12px', color: theme.text.primary, marginBottom: '4px', display: 'block', fontWeight: '500' }}>
                        Accounting Entity
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.accountingEntity}
                        onChange={(e) => setInterfaceParams(prev => ({
                          ...prev,
                          accountingEntity: e.target.value
                        }))}
                        placeholder="Optional filter"
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: theme.background.secondary,
                          border: `1px solid ${theme.background.tertiary}`,
                          borderRadius: '6px',
                          color: theme.text.primary,
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{ flex: '1 1 calc(50% - 8px)', minWidth: '300px' }}>
                      <label style={{ fontSize: '12px', color: theme.text.primary, marginBottom: '4px', display: 'block', fontWeight: '500' }}>
                        Currency Table
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.currencyTable}
                        onChange={(e) => setInterfaceParams(prev => ({
                          ...prev,
                          currencyTable: e.target.value
                        }))}
                        placeholder="Optional"
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: theme.background.secondary,
                          border: `1px solid ${theme.background.tertiary}`,
                          borderRadius: '6px',
                          color: theme.text.primary,
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{ flex: '1 1 calc(50% - 8px)', minWidth: '300px' }}>
                      <label style={{ fontSize: '12px', color: theme.text.primary, marginBottom: '4px', display: 'block', fontWeight: '500' }}>
                        Primary Ledger
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.primaryLedger}
                        onChange={(e) => setInterfaceParams(prev => ({
                          ...prev,
                          primaryLedger: e.target.value
                        }))}
                        placeholder="Optional"
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: theme.background.secondary,
                          border: `1px solid ${theme.background.tertiary}`,
                          borderRadius: '6px',
                          color: theme.text.primary,
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {/* Processing Mode Checkboxes */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', color: theme.text.primary, marginBottom: '8px', display: 'block', fontWeight: '500' }}>
                      Processing Mode
                    </label>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: theme.text.primary
                      }}>
                        <input
                          type="checkbox"
                          checked={interfaceParams.editAndInterface}
                          onChange={(e) => setInterfaceParams(prev => ({
                            ...prev,
                            editAndInterface: e.target.checked
                          }))}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        Edit and Interface
                      </label>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: theme.text.primary
                      }}>
                        <input
                          type="checkbox"
                          checked={interfaceParams.editOnly}
                          onChange={(e) => setInterfaceParams(prev => ({
                            ...prev,
                            editOnly: e.target.checked
                          }))}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        Edit Only
                      </label>
                    </div>
                  </div>

                  {/* Boolean Parameters - Auto-fit grid */}
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
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.journalizeByEntity}
                        onChange={(e) => setInterfaceParams(prev => ({
                          ...prev,
                          journalizeByEntity: e.target.checked
                        }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Journalize by Entity
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.journalByJournalCode}
                        onChange={(e) => setInterfaceParams(prev => ({
                          ...prev,
                          journalByJournalCode: e.target.checked
                        }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Journal by Journal Code
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.bypassOrganizationCode}
                        onChange={(e) => setInterfaceParams(prev => ({
                          ...prev,
                          bypassOrganizationCode: e.target.checked
                        }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Bypass Organization Code
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.bypassAccountCode}
                        onChange={(e) => setInterfaceParams(prev => ({
                          ...prev,
                          bypassAccountCode: e.target.checked
                        }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Bypass Account Code
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.interfaceInDetail}
                        onChange={(e) => setInterfaceParams(prev => ({
                          ...prev,
                          interfaceInDetail: e.target.checked
                        }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Interface in Detail
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.bypassStructureRelationEdit}
                        onChange={(e) => setInterfaceParams(prev => ({
                          ...prev,
                          bypassStructureRelationEdit: e.target.checked
                        }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Bypass Structure Relation Edit
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.bypassNegativeRateEdit}
                        onChange={(e) => setInterfaceParams(prev => ({
                          ...prev,
                          bypassNegativeRateEdit: e.target.checked
                        }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Bypass Negative Rate Edit
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.moveErrorsToNewRunGroup}
                        onChange={(e) => setInterfaceParams(prev => ({
                          ...prev,
                          moveErrorsToNewRunGroup: e.target.checked
                        }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Move Errors to New RunGroup
                      </span>
                    </label>
                  </div>

                  {/* Error RunGroup Prefix - Show only if Move Errors is checked */}
                  {interfaceParams.moveErrorsToNewRunGroup && (
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ fontSize: '12px', color: theme.text.primary, marginBottom: '4px', display: 'block', fontWeight: '500' }}>
                        Error RunGroup Prefix
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.errorRunGroupPrefix}
                        onChange={(e) => setInterfaceParams(prev => ({
                          ...prev,
                          errorRunGroupPrefix: e.target.value
                        }))}
                        placeholder="Prefix for error RunGroup"
                        style={{
                          width: '300px',
                          padding: '10px',
                          backgroundColor: 'theme.background.secondary',
                          border: `1px solid ${theme.background.tertiary}`,
                          borderRadius: '6px',
                          color: theme.text.primary, fontSize: '13px'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleStartLoad}
                style={{
                  padding: '12px 24px',
                  backgroundColor: theme.primary.main,
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {interfaceParams.editAndInterface ? 'Load to FSM & Interface to GL' : 'Load to FSM'}
              </button>
            </div>
          )}

          {loading && (
            <div style={{
              padding: '24px',
              backgroundColor: theme.background.secondary,
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              {/* Animated Spinner */}
              <div style={{
                width: '48px',
                height: '48px',
                border: `4px solid ${theme.background.quaternary}`,
                borderTop: `4px solid ${theme.primary.main}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px auto'
              }} />
              
              <div style={{ fontSize: '16px', fontWeight: '600', color: theme.primary.main, marginBottom: '8px' }}>
                {interfaceParams.editAndInterface ? 'Loading Records to FSM & Interfacing to GL...' : 'Loading Records to FSM...'}
              </div>
              
              {interfaceParams.editAndInterface && (
                <div style={{ fontSize: '13px', color: theme.text.secondary, marginBottom: '12px' }}>
                  Phase 1: Loading records → Phase 2: Wait 3 seconds → Phase 3: Interface to GL
                </div>
              )}
              
              <div style={{ fontSize: '13px', color: theme.text.secondary }}>
                Please wait while we process your data...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Post Validation Step */}
      {currentStep === 'postValidation' && (
        <div className={getAnimationClass()} style={{
          backgroundColor: theme.background.secondary,
          border: `2px solid ${theme.accent.purpleTintMedium}`,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ 
            textAlign: 'center',
            padding: '60px 20px'
          }}>
            <div style={{
              fontSize: '64px',
              marginBottom: '24px'
            }}>
              🚧
            </div>
            <h3 style={{ 
              fontSize: '24px', 
              fontWeight: '600', 
              color: theme.primary.main,
              marginBottom: '12px'
            }}>
              Post Validation
            </h3>
            <p style={{
              fontSize: '16px',
              color: theme.text.secondary,
              marginBottom: '8px'
            }}>
              Coming Soon
            </p>
            <p style={{
              fontSize: '14px',
              color: theme.text.tertiary,
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: '1.6'
            }}>
              This feature will provide post-load validation and reconciliation capabilities to verify data integrity after loading to FSM.
            </p>
          </div>
        </div>
      )}

      {/* Completed Step */}
      {currentStep === 'completed' && loadResult && (
        <div className={getAnimationClass()}>
          {/* Load Results Display */}
          <div style={{
            backgroundColor: theme.background.secondary,
            border: `2px solid ${loadResult.total_failure === 0 ? '#22c55e' : theme.status.error}`,
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: loadResult.total_failure === 0 ? '#22c55e' : theme.status.error,
                marginBottom: '8px'
              }}>
                {loadResult.total_failure === 0 ? '🎉 Load Completed Successfully' : '❌ Load Failed'}
              </h3>
              <p style={{ fontSize: '13px', color: theme.text.secondary }}>
                {loadResult.total_failure === 0 
                  ? 'All records have been loaded to FSM successfully'
                  : 'Load failed and all records have been rolled back'
                }
                {loadResult.interface_result && loadResult.interface_result.interface_successful && (
                  <span style={{ color: '#22c55e', marginLeft: '8px' }}>
                    • Interface to GL completed successfully
                  </span>
                )}
                {loadResult.interface_result && !loadResult.interface_result.interface_successful && (
                  <span style={{ color: '#FFA500', marginLeft: '8px' }}>
                    • Interface to GL failed (records still loaded)
                  </span>
                )}
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '20px'
            }}>
              {/* Show interface metrics ONLY if interface was triggered AND has verification results */}
              {loadResult.interface_result && loadResult.interface_result.verification ? (
                /* Interface KPIs - Show interface-specific metrics */
                <>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#FFFFFF',
                    border: `2px solid ${theme.background.quaternary}`,
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: theme.primary.main }}>
                      {loadResult.interface_result.verification.total_records.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.text.secondary, fontWeight: '500' }}>Records Processed</div>
                  </div>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#FFFFFF',
                    border: `2px solid ${theme.background.quaternary}`,
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: '#22c55e' }}>
                      {loadResult.interface_result.verification.successfully_imported.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.text.secondary, fontWeight: '500' }}>Successfully Interfaced</div>
                  </div>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#FFFFFF',
                    border: `2px solid ${theme.background.quaternary}`,
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: loadResult.interface_result.verification.records_with_error > 0 ? '#dc2626' : '#22c55e' }}>
                      {loadResult.interface_result.verification.records_with_error.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.text.secondary, fontWeight: '500' }}>Records with Errors</div>
                  </div>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#FFFFFF',
                    border: `2px solid ${theme.background.quaternary}`,
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: loadResult.interface_result.verification.status_label === 'Complete' ? '#22c55e' : '#dc2626' }}>
                      {loadResult.interface_result.verification.status_label}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.text.secondary, fontWeight: '500' }}>Interface Status</div>
                  </div>
                </>
              ) : (
                /* Import Only KPIs - Show original load metrics */
                <>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#FFFFFF',
                    border: `2px solid ${theme.background.quaternary}`,
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: theme.primary.main }}>
                      {loadResult.success_count.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.text.secondary, fontWeight: '500' }}>Records Loaded</div>
                  </div>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#FFFFFF',
                    border: `2px solid ${theme.background.quaternary}`,
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: theme.primary.main }}>
                      {loadResult.business_class}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.text.secondary, fontWeight: '500' }}>Business Class</div>
                  </div>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#FFFFFF',
                    border: `2px solid ${theme.background.quaternary}`,
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: theme.primary.main }}>
                      {loadResult.run_group}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.text.secondary, fontWeight: '500' }}>Run Group</div>
                  </div>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#FFFFFF',
                    border: `2px solid ${theme.background.quaternary}`,
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: theme.primary.main }}>
                      {loadResult.chunks_processed}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.text.secondary, fontWeight: '500' }}>Chunks Processed</div>
                  </div>
                </>
              )}
            </div>

            {/* Interface Error Records Table - Show only if interface has errors */}
            {loadResult.interface_result && loadResult.interface_result.verification && 
             loadResult.interface_result.verification.records_with_error > 0 && 
             loadResult.interface_result.error_details && loadResult.interface_result.error_details.length > 0 && (
              <div style={{
                backgroundColor: '#FFFFFF',
                border: `2px solid #dc2626`,
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <div style={{ 
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#dc2626',
                    margin: 0
                  }}>
                    ⚠️ Interface Error Records ({(loadResult.interface_result.error_details?.length || 0)} total) for RunGroup: {loadResult.interface_result.verification?.run_group || 'Unknown'}
                  </h4>
                  
                  {/* Pagination Controls */}
                  {(loadResult.interface_result.error_details?.length || 0) > errorTablePageSize && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      color: theme.text.secondary
                    }}>
                      <button
                        onClick={() => setErrorTableCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={errorTableCurrentPage === 1}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: errorTableCurrentPage === 1 ? theme.background.tertiary : theme.primary.main,
                          color: errorTableCurrentPage === 1 ? theme.text.muted : '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: errorTableCurrentPage === 1 ? 'not-allowed' : 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ← Prev
                      </button>
                      
                      <span style={{ color: theme.text.primary, fontWeight: '500' }}>
                        Page {errorTableCurrentPage} of {Math.ceil((loadResult.interface_result.error_details?.length || 0) / errorTablePageSize)}
                      </span>
                      
                      <button
                        onClick={() => setErrorTableCurrentPage(prev => 
                          Math.min(Math.ceil((loadResult.interface_result.error_details?.length || 0) / errorTablePageSize), prev + 1)
                        )}
                        disabled={errorTableCurrentPage >= Math.ceil((loadResult.interface_result.error_details?.length || 0) / errorTablePageSize)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: errorTableCurrentPage >= Math.ceil(loadResult.interface_result.error_details.length / errorTablePageSize) ? theme.background.tertiary : theme.primary.main,
                          color: errorTableCurrentPage >= Math.ceil(loadResult.interface_result.error_details.length / errorTablePageSize) ? theme.text.muted : '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: errorTableCurrentPage >= Math.ceil(loadResult.interface_result.error_details.length / errorTablePageSize) ? 'not-allowed' : 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </div>

                {/* Error Records Table */}
                <div style={{
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px',
                  overflow: 'hidden'
                }}>
                  {/* Table Header */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 100px 80px 100px 120px 1fr 2fr',
                    backgroundColor: '#f8f9fa',
                    borderBottom: '1px solid #e5e5e5',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    <div style={{ padding: '12px 8px', borderRight: '1px solid #e5e5e5' }}>Sequence</div>
                    <div style={{ padding: '12px 8px', borderRight: '1px solid #e5e5e5' }}>Account</div>
                    <div style={{ padding: '12px 8px', borderRight: '1px solid #e5e5e5' }}>Entity</div>
                    <div style={{ padding: '12px 8px', borderRight: '1px solid #e5e5e5' }}>Posting Date</div>
                    <div style={{ padding: '12px 8px', borderRight: '1px solid #e5e5e5' }}>Amount</div>
                    <div style={{ padding: '12px 8px', borderRight: '1px solid #e5e5e5' }}>Description</div>
                    <div style={{ padding: '12px 8px' }}>Error Message</div>
                  </div>

                  {/* Table Rows */}
                  {(() => {
                    const errorDetails = loadResult.interface_result.error_details || [];
                    const startIndex = (errorTableCurrentPage - 1) * errorTablePageSize;
                    const endIndex = startIndex + errorTablePageSize;
                    const pageErrors = errorDetails.slice(startIndex, endIndex);
                    
                    return pageErrors.map((error: any, index: number) => (
                      <div 
                        key={startIndex + index}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '80px 100px 80px 100px 120px 1fr 2fr',
                          borderBottom: index < pageErrors.length - 1 ? '1px solid #e5e5e5' : 'none',
                          fontSize: '12px',
                          color: '#374151',
                          backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb'
                        }}
                      >
                        <div style={{ 
                          padding: '12px 8px', 
                          borderRight: '1px solid #e5e5e5',
                          fontFamily: 'monospace',
                          fontWeight: '500'
                        }}>
                          {error.sequence_number || '-'}
                        </div>
                        <div style={{ 
                          padding: '12px 8px', 
                          borderRight: '1px solid #e5e5e5',
                          fontFamily: 'monospace'
                        }}>
                          {error.account_code || '-'}
                        </div>
                        <div style={{ 
                          padding: '12px 8px', 
                          borderRight: '1px solid #e5e5e5',
                          fontFamily: 'monospace'
                        }}>
                          {error.accounting_entity || '-'}
                        </div>
                        <div style={{ 
                          padding: '12px 8px', 
                          borderRight: '1px solid #e5e5e5',
                          fontFamily: 'monospace'
                        }}>
                          {error.posting_date || '-'}
                        </div>
                        <div style={{ 
                          padding: '12px 8px', 
                          borderRight: '1px solid #e5e5e5',
                          textAlign: 'right',
                          fontFamily: 'monospace'
                        }}>
                          {error.transaction_amount ? parseFloat(error.transaction_amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }) : '-'}
                        </div>
                        <div style={{ 
                          padding: '12px 8px', 
                          borderRight: '1px solid #e5e5e5',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          <span title={error.description || '-'}>
                            {error.description || '-'}
                          </span>
                        </div>
                        <div style={{ 
                          padding: '12px 8px',
                          color: '#dc2626',
                          fontWeight: '500',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          <span title={error.error_message || '-'}>
                            {error.error_message || '-'}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* Table Footer with Summary */}
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: theme.text.secondary,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>
                    Showing {Math.min(errorTablePageSize, (loadResult.interface_result.error_details?.length || 0) - (errorTableCurrentPage - 1) * errorTablePageSize)} of {loadResult.interface_result.error_details?.length || 0} error records
                  </span>
                  {(loadResult.interface_result.error_details?.length || 0) > errorTablePageSize && (
                    <span>
                      Use pagination controls above to view all errors
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Error Details (only show if load failed) */}
            {loadResult.total_failure > 0 && (
              <div style={{
                backgroundColor: '#1a0a0a',
                border: `1px solid ${theme.primary.main}`,
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: theme.primary.main,
                    margin: 0
                  }}>
                    ⚠️ Error Details
                  </h4>
                </div>
                
                {loadResult.error_message && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: theme.background.secondary,
                    borderRadius: '6px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ fontSize: '12px', color: theme.text.secondary, marginBottom: '4px' }}>
                      Error Message:
                    </div>
                    <div style={{ fontSize: '13px', color: theme.text.primary, fontFamily: 'monospace' }}>
                      {loadResult.error_message}
                    </div>
                  </div>
                )}
                
                {loadResult.error_details && (
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: theme.primary.main,
                      padding: '8px',
                      backgroundColor: theme.background.secondary,
                      borderRadius: '4px',
                      userSelect: 'none'
                    }}>
                      View Full API Response
                    </summary>
                    <pre style={{
                      marginTop: '8px',
                      padding: '12px',
                      backgroundColor: theme.background.secondary,
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#fff',
                      overflow: 'auto',
                      maxHeight: '300px',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {JSON.stringify(loadResult.error_details, null, 2)}
                    </pre>
                  </details>
                )}
                
                <div style={{
                  marginTop: '12px',
                  padding: '10px',
                  backgroundColor: 'theme.background.secondary',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: theme.text.secondary
                }}>
                  💡 <strong style={{ color: theme.primary.main }}>Next Steps:</strong>
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                    <li>Review the error message above to understand what went wrong</li>
                    <li>Check validation results for data quality issues</li>
                    <li>Verify FSM field mappings are correct</li>
                    <li>Contact FSM administrator if the error persists</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px'
            }}>
              <button
                onClick={() => {
                  changeStep('upload');
                  setFile(null);
                  setJobId(null);
                  setFileInfo(null);
                  setMapping({});
                  setMappingData({ mapping: {}, unmapped_csv_columns: [], unmapped_fsm_fields: [] });
                  setValidationErrors([]);
                  setLoadResult(null);
                  setCompletedSteps(new Set(['upload'])); // Reset completed steps
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
                onClick={() => changeStep('validation')}
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
                  backgroundColor: theme.primary.main,
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

          {/* Interface Transactions Section - Only show if interface was NOT selected during load */}
          {loadResult.total_failure === 0 && !interfaceParams.editAndInterface && (
            <div style={{
              backgroundColor: 'theme.background.secondary',
              border: `2px solid ${theme.accent.purpleTintMedium}`,
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  color: theme.primary.main,
                  marginBottom: '8px'
                }}>
                  ⚡ Interface Transactions
                </h3>
                <p style={{ fontSize: '13px', color: theme.text.secondary }}>
                  Post/journalize loaded transactions to General Ledger
                </p>
              </div>

              {!showInterfaceForm ? (
                <button
                  onClick={() => {
                    setShowInterfaceForm(true);
                    // Auto-populate RunGroup when opening the form
                    setInterfaceParams(prev => ({
                      ...prev,
                      runGroup: loadResult?.run_group || ''
                    }));
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: theme.primary.main,
                    color: '#FFFFFF',
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
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px',
                    marginBottom: '20px'
                  }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: theme.text.primary, fontWeight: '500' }}>
                        RunGroup * (Generated by system)
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.runGroup || loadResult?.run_group || ''}
                        readOnly
                        disabled
                        placeholder="Auto-generated unique RunGroup"
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: theme.background.tertiary,
                          border: `1px solid ${theme.background.quaternary}`,
                          borderRadius: '6px',
                          color: theme.text.primary,
                          fontSize: '14px',
                          cursor: 'not-allowed'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: theme.text.primary, fontWeight: '500' }}>
                        Finance Enterprise Group (Auto-filled from file)
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.enterpriseGroup}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, enterpriseGroup: e.target.value }))}
                        placeholder="Optional filter"
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: theme.background.secondary,
                          border: `1px solid ${theme.background.tertiary}`,
                          borderRadius: '6px',
                          color: theme.text.primary, fontSize: '14px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: theme.text.primary, fontWeight: '500' }}>
                        Accounting Entity
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.accountingEntity}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, accountingEntity: e.target.value }))}
                        placeholder="Optional filter"
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: theme.background.secondary,
                          border: `1px solid ${theme.background.tertiary}`,
                          borderRadius: '6px',
                          color: theme.text.primary, fontSize: '14px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: theme.text.primary, fontWeight: '500' }}>
                        Currency Table
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.currencyTable}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, currencyTable: e.target.value }))}
                        placeholder="Optional"
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: theme.background.secondary,
                          border: `1px solid ${theme.background.tertiary}`,
                          borderRadius: '6px',
                          color: theme.text.primary, fontSize: '14px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: theme.text.primary, fontWeight: '500' }}>
                        Primary Ledger
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.primaryLedger}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, primaryLedger: e.target.value }))}
                        placeholder="Optional"                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: theme.background.secondary,
                          border: `1px solid ${theme.background.tertiary}`,
                          borderRadius: '6px',
                          color: theme.text.primary, fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>

                  {/* Processing Mode Radio Buttons */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', color: theme.text.primary, fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                      Processing Mode
                    </label>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: theme.text.primary
                      }}>
                        <input
                          type="radio"
                          name="processingModeCompleted"
                          checked={interfaceParams.editAndInterface && !interfaceParams.editOnly}
                          onChange={() => setInterfaceParams(prev => ({
                            ...prev,
                            editOnly: false,
                            editAndInterface: true
                          }))}
                          style={{ cursor: 'pointer' }}
                        />
                        Edit and Interface
                      </label>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: theme.text.primary
                      }}>
                        <input
                          type="radio"
                          name="processingModeCompleted"
                          checked={interfaceParams.editOnly}
                          onChange={() => setInterfaceParams(prev => ({
                            ...prev,
                            editOnly: true,
                            editAndInterface: false
                          }))}
                          style={{ cursor: 'pointer' }}
                        />
                        Edit Only
                      </label>
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
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.journalizeByEntity}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, journalizeByEntity: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Journalize by Entity
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.journalByJournalCode}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, journalByJournalCode: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Journal by Journal Code
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.bypassOrganizationCode}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, bypassOrganizationCode: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Bypass Organization Code
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.bypassAccountCode}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, bypassAccountCode: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Bypass Account Code
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.interfaceInDetail}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, interfaceInDetail: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Interface in Detail
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.bypassStructureRelationEdit}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, bypassStructureRelationEdit: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Bypass Structure Relation Edit
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.bypassNegativeRateEdit}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, bypassNegativeRateEdit: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Bypass Negative Rate Edit
                      </span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'theme.background.secondary',
                      borderRadius: '6px',
                      border: `1px solid ${theme.background.tertiary}`,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.moveErrorsToNewRunGroup}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, moveErrorsToNewRunGroup: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
                        Move Errors to New RunGroup
                      </span>
                    </label>
                  </div>

                  {/* Error RunGroup Prefix - Show only if Move Errors is checked */}
                  {interfaceParams.moveErrorsToNewRunGroup && (
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ fontSize: '12px', color: theme.text.primary, marginBottom: '4px', display: 'block', fontWeight: '500' }}>
                        Error RunGroup Prefix
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.errorRunGroupPrefix}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, errorRunGroupPrefix: e.target.value }))}
                        placeholder="Prefix for error RunGroup"
                        style={{
                          width: '300px',
                          padding: '10px',
                          backgroundColor: 'theme.background.secondary',
                          border: `1px solid ${theme.background.tertiary}`,
                          borderRadius: '6px',
                          color: theme.text.primary, fontSize: '13px'
                        }}
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={handleInterfaceTransactions}
                      disabled={interfacing}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: interfacing ? theme.background.tertiary : theme.primary.main,
                        color: '#FFFFFF',
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
                        backgroundColor: theme.background.secondary,
                        color: theme.text.primary,
                        border: `1px solid ${theme.background.quaternary}`,
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
                      backgroundColor: interfaceResult.success ? '#1a2e1a' : '#2e1a1a',
                      border: `1px solid ${interfaceResult.success ? '#22c55e' : 'theme.primary.main'}`,
                      borderRadius: '6px'
                    }}>
                      <p style={{ 
                        color: interfaceResult.success ? '#22c55e' : 'theme.primary.main', 
                        fontSize: '14px', 
                        margin: '0 0 12px 0',
                        fontWeight: '600'
                      }}>
                        {interfaceResult.message}
                      </p>
                      
                      {/* Verification Details */}
                      {interfaceResult.verification && (
                        <div style={{
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          padding: '12px',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}>
                          <div style={{ marginBottom: '8px', fontWeight: '600', color: '#fff' }}>
                            Interface Verification Results:
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', color: theme.text.secondary }}>
                            <div>Status: <span style={{ color: interfaceResult.verification.status_label === 'Complete' ? '#22c55e' : 'theme.primary.main', fontWeight: '500' }}>
                              {interfaceResult.verification.status_label || 'Unknown'}
                            </span></div>
                            <div>Result Sequence: {interfaceResult.verification.result_sequence}</div>
                            <div>Total Records: {interfaceResult.verification.total_records.toLocaleString()}</div>
                            <div>Successfully Imported: <span style={{ color: '#22c55e' }}>{interfaceResult.verification.successfully_imported.toLocaleString()}</span></div>
                            <div>Records with Error: <span style={{ color: interfaceResult.verification.records_with_error > 0 ? 'theme.primary.main' : '#22c55e' }}>
                              {interfaceResult.verification.records_with_error.toLocaleString()}
                            </span></div>
                            <div>RunGroup: {interfaceResult.verification.run_group}</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Detailed Error Information */}
                      {interfaceResult.error_details && interfaceResult.error_details.length > 0 && (
                        <div style={{
                          marginTop: '16px',
                          backgroundColor: 'rgba(220, 38, 38, 0.1)',
                          border: '1px solid #dc2626',
                          borderRadius: '6px',
                          padding: '16px'
                        }}>
                          <div style={{ 
                            marginBottom: '12px', 
                            fontWeight: '600', 
                            color: '#dc2626',
                            fontSize: '14px'
                          }}>
                            Interface Error Details ({interfaceResult.error_details?.length || 0} records with errors):
                          </div>
                          
                          <div style={{
                            maxHeight: '300px',
                            overflowY: 'auto',
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            borderRadius: '4px',
                            padding: '12px'
                          }}>
                            {(interfaceResult.error_details || []).slice(0, 10).map((error: any, index: number) => (
                              <div key={index} style={{
                                marginBottom: '12px',
                                paddingBottom: '12px',
                                borderBottom: index < Math.min((interfaceResult.error_details?.length || 0), 10) - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none'
                              }}>
                                <div style={{ 
                                  display: 'grid', 
                                  gridTemplateColumns: 'auto 1fr', 
                                  gap: '8px 16px',
                                  fontSize: '12px',
                                  color: theme.text.secondary
                                }}>
                                  <strong style={{ color: '#fff' }}>Sequence:</strong>
                                  <span>{error.sequence_number}</span>
                                  
                                  <strong style={{ color: '#fff' }}>Account:</strong>
                                  <span>{error.account_code}</span>
                                  
                                  <strong style={{ color: '#fff' }}>Entity:</strong>
                                  <span>{error.accounting_entity}</span>
                                  
                                  <strong style={{ color: '#fff' }}>Date:</strong>
                                  <span>{error.posting_date}</span>
                                  
                                  <strong style={{ color: '#fff' }}>Amount:</strong>
                                  <span>{error.transaction_amount}</span>
                                  
                                  <strong style={{ color: '#fff' }}>Description:</strong>
                                  <span>{error.description}</span>
                                  
                                  <strong style={{ color: '#dc2626' }}>Error:</strong>
                                  <span style={{ color: '#dc2626', fontWeight: '500' }}>{error.error_message}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {(interfaceResult.error_details?.length || 0) > 10 && (
                            <div style={{
                              marginTop: '12px',
                              fontSize: '12px',
                              color: theme.text.secondary,
                              fontStyle: 'italic'
                            }}>
                              Showing first 10 errors. Total errors: {interfaceResult.error_details?.length || 0}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Error Details */}
                      {interfaceResult.error && (
                        <div style={{
                          marginTop: '12px',
                          padding: '8px',
                          backgroundColor: 'rgba(220, 38, 38, 0.1)',
                          border: '1px solid theme.primary.main',
                          borderRadius: '4px',
                          fontSize: '13px',
                          color: 'theme.primary.main'
                        }}>
                          Error: {interfaceResult.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Delete RunGroup Section */}
          {loadResult.total_failure === 0 && (
            <div style={{
              backgroundColor: 'theme.background.secondary',
              border: `2px solid ${theme.accent.purpleTintMedium}`,
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  color: theme.primary.main,
                  marginBottom: '8px'
                }}>
                  🗑️ Delete RunGroup
                </h3>
                <p style={{ fontSize: '13px', color: theme.text.secondary }}>
                  Permanently delete all transactions for this RunGroup (useful for testing)
                </p>
              </div>

              <button
                onClick={handleDeleteRunGroup}
                style={{
                  padding: '12px 24px',
                  backgroundColor: theme.primary.main,
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
            backgroundColor: theme.background.secondary,
            border: `2px solid ${theme.accent.purpleTintMedium}`,
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
                color: theme.primary.main,
                marginBottom: '8px'
              }}>
                Delete RunGroup
              </h3>
              <p style={{ fontSize: '14px', color: theme.text.secondary, marginBottom: '16px' }}>
                This will permanently delete all transactions for RunGroup:
              </p>
              <p style={{ fontSize: '16px', color: theme.primary.main, fontWeight: '600', marginBottom: '16px' }}>
                {loadResult?.run_group}
              </p>
              <p style={{ fontSize: '12px', color: theme.primary.main }}>
                ⚠️ This action cannot be undone!
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: theme.text.primary, fontWeight: '500' }}>
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
                  backgroundColor: theme.background.secondary,
                  border: `1px solid ${theme.primary.main}`,
                  borderRadius: '6px',
                  color: theme.text.primary, fontSize: '14px'
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
                  backgroundColor: deleting || deleteConfirmation !== loadResult?.run_group ? theme.background.quaternary : theme.status.error,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deleting || deleteConfirmation !== loadResult?.run_group ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: deleting || deleteConfirmation !== loadResult?.run_group ? 0.5 : 1
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
                  backgroundColor: theme.primary.main,
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




