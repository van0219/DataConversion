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
    return () => document.head.removeChild(style);
  }, []);

  // Step management
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'validation' | 'load' | 'completed'>('upload');
  const [previousStep, setPreviousStep] = useState<'upload' | 'mapping' | 'validation' | 'load' | 'completed'>('upload');
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward'>('forward');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set(['upload'])); // Track completed steps

  // Helper function to change steps with animation
  const changeStep = (newStep: 'upload' | 'mapping' | 'validation' | 'load' | 'completed') => {
    const stepOrder = ['upload', 'mapping', 'validation', 'load', 'completed'];
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
  const handleStepClick = (step: 'upload' | 'mapping' | 'validation' | 'load' | 'completed') => {
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
  const [interfaceParams, setInterfaceParams] = useState({
    runGroup: '',
    enterpriseGroup: '',
    accountingEntity: '',
    editOnly: false,                    // Don't edit only - we want to interface
    editAndInterface: true,             // Edit AND interface to GL (this is what we want)
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
      if (currentStep === 'load' && interfaceParams.editAndInterface && jobId && mappingData.mapping) {
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
  }, [currentStep, interfaceParams.editAndInterface, jobId, mappingData.mapping]);

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
    console.log('handleInterfaceCheckboxChange:', checked, 'jobId:', jobId, 'mappingData:', mappingData);
    
    setInterfaceParams(prev => ({
      ...prev,
      editAndInterface: checked
    }));
    
    if (checked && jobId && mappingData.mapping) {
      console.log('Auto-populating Finance Enterprise Group...');
      
      // Note: RunGroup will be generated by backend, so we only populate Enterprise Group
      const financeEnterpriseGroup = await getMostFrequentValue('FinanceEnterpriseGroup');
      
      console.log('Auto-population results:', { financeEnterpriseGroup });
      
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
  } | null>(null);
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
      // First fetch schema
      setFetchingSchema(true);
      const schemaResponse = await api.post('/schema/fetch', {
        business_class: businessClass,
        force_refresh: false
      });
      
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
        enable_rules: true
      });

      console.log('Validation start response:', response.data);

      // Validation is synchronous - it's already complete!
      // Just load the summary and errors
      setValidating(false);
      setCompletedSteps(prev => new Set([...prev, 'validation', 'load'])); // Mark validation and load as available
      changeStep('validation');
      await loadValidationSummary();
      await loadValidationErrors();
      
    } catch (error: any) {
      console.error('Validation failed:', error);
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
      let progressInterval: NodeJS.Timeout | null = null;
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
        trigger_interface: interfaceParams.editAndInterface,
        interface_params: interfaceParams.editAndInterface ? {
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
            verification: verification
          });
        } else {
          setInterfaceResult({
            success: false,
            message: `Interface failed for RunGroup: ${interfaceParams.runGroup}`,
            verification: verification,
            error: result.error || 'Interface verification failed - records were not successfully posted to GL'
          });
        }
      } else {
        // Fallback for old format - assume success if no verification data
        setInterfaceResult({
          success: true,
          message: `Interface API call completed for RunGroup: ${interfaceParams.runGroup} (verification unavailable)`,
          verification: null
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
            backgroundColor: '#2a2a2a',
            color: '#fff',
            border: 'none',
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
              backgroundColor: currentStep === 'upload' ? '#dc2626' : (canNavigateToStep('upload') ? '#4a5568' : '#2a2a2a'),
              color: '#ffffff',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: canNavigateToStep('upload') ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              border: canNavigateToStep('upload') ? '1px solid #4a5568' : '1px solid transparent',
              opacity: canNavigateToStep('upload') ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (canNavigateToStep('upload') && currentStep !== 'upload') {
                e.currentTarget.style.backgroundColor = '#5a6578';
              }
            }}
            onMouseLeave={(e) => {
              if (canNavigateToStep('upload') && currentStep !== 'upload') {
                e.currentTarget.style.backgroundColor = '#4a5568';
              }
            }}
          >
            1. Upload File {canNavigateToStep('upload') && currentStep !== 'upload' && '✓'}
          </div>
          <div 
            onClick={() => handleStepClick('mapping')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentStep === 'mapping' ? '#dc2626' : (canNavigateToStep('mapping') ? '#4a5568' : '#2a2a2a'),
              color: '#ffffff',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: canNavigateToStep('mapping') ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              border: canNavigateToStep('mapping') ? '1px solid #4a5568' : '1px solid transparent',
              opacity: canNavigateToStep('mapping') ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (canNavigateToStep('mapping') && currentStep !== 'mapping') {
                e.currentTarget.style.backgroundColor = '#5a6578';
              }
            }}
            onMouseLeave={(e) => {
              if (canNavigateToStep('mapping') && currentStep !== 'mapping') {
                e.currentTarget.style.backgroundColor = '#4a5568';
              }
            }}
          >
            2. Mapping {canNavigateToStep('mapping') && currentStep !== 'mapping' && '✓'}
          </div>
          <div 
            onClick={() => handleStepClick('validation')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentStep === 'validation' ? '#dc2626' : (canNavigateToStep('validation') ? '#4a5568' : '#2a2a2a'),
              color: '#ffffff',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: canNavigateToStep('validation') ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              border: canNavigateToStep('validation') ? '1px solid #4a5568' : '1px solid transparent',
              opacity: canNavigateToStep('validation') ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (canNavigateToStep('validation') && currentStep !== 'validation') {
                e.currentTarget.style.backgroundColor = '#5a6578';
              }
            }}
            onMouseLeave={(e) => {
              if (canNavigateToStep('validation') && currentStep !== 'validation') {
                e.currentTarget.style.backgroundColor = '#4a5568';
              }
            }}
          >
            3. Validation {canNavigateToStep('validation') && currentStep !== 'validation' && '✓'}
          </div>
          <div 
            onClick={() => handleStepClick('load')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentStep === 'load' || currentStep === 'completed' ? '#dc2626' : (canNavigateToStep('load') ? '#4a5568' : '#2a2a2a'),
              color: '#ffffff',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: canNavigateToStep('load') ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              border: canNavigateToStep('load') ? '1px solid #4a5568' : '1px solid transparent',
              opacity: canNavigateToStep('load') ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (canNavigateToStep('load') && currentStep !== 'load' && currentStep !== 'completed') {
                e.currentTarget.style.backgroundColor = '#5a6578';
              }
            }}
            onMouseLeave={(e) => {
              if (canNavigateToStep('load') && currentStep !== 'load' && currentStep !== 'completed') {
                e.currentTarget.style.backgroundColor = '#4a5568';
              }
            }}
          >
            4. Load {canNavigateToStep('load') && currentStep !== 'load' && currentStep !== 'completed' && '✓'}
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
        <div className={getAnimationClass()} style={{
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
        <div className={getAnimationClass()} style={{
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
                onClick={() => changeStep('validation')}
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
                {Object.entries(mappingData.mapping || {}).map(([csvColumn, mappingInfo], index) => {
                  const isEnabled = mappingInfo.enabled !== false;
                  return (
                  <div key={csvColumn} style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 1fr 120px',
                    gap: '16px',
                    padding: '12px 16px',
                    borderBottom: index < Object.keys(mappingData.mapping || {}).length - 1 ? '1px solid #2a2a2a' : 'none',
                    alignItems: 'center',
                    fontSize: '13px',
                    opacity: isEnabled ? 1 : 0.4,
                    backgroundColor: isEnabled ? 'transparent' : '#0a0a0a'
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
                      color: isEnabled ? '#fff' : '#666',
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
                        onFocus={() => {
                          if (isEnabled) {
                            setSearchDropdownOpen(csvColumn);
                            setSearchQuery(prev => ({ ...prev, [csvColumn]: mappingInfo.fsm_field || '' }));
                          }
                        }}
                        onChange={(e) => {
                          if (!isEnabled) return;
                          setSearchQuery(prev => ({ ...prev, [csvColumn]: e.target.value }));
                        }}
                        placeholder="Search FSM field..."
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          backgroundColor: isEnabled ? '#1a1a1a' : '#0a0a0a',
                          border: `1px solid ${isEnabled ? '#2a2a2a' : '#1a1a1a'}`,
                          borderRadius: '4px',
                          color: isEnabled ? '#fff' : '#666',
                          fontSize: '12px',
                          cursor: isEnabled ? 'text' : 'not-allowed'
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
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #2a2a2a',
                          borderRadius: '4px',
                          marginTop: '4px',
                          zIndex: 1000,
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
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
                                  color: '#fff',
                                  borderBottom: '1px solid #2a2a2a',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
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
                  );
                })}
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
                onClick={() => changeStep('validation')}
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
        <div className={getAnimationClass()} style={{
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
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={handleStartValidation}
              disabled={validating || (validationProgress?.status === 'validated')}
              style={{
                padding: '12px 24px',
                backgroundColor: (validating || (validationProgress?.status === 'validated')) ? '#2a2a2a' : '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: (validating || (validationProgress?.status === 'validated')) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {validating ? 'Validating...' : (validationProgress?.status === 'validated') ? 'Validation Complete' : 'Start Validation'}
            </button>

            {validationProgress?.status === 'validated' && (
              <>
                {validationProgress.errors_found > 0 && (
                  <>
                    <button
                      onClick={async () => {
                        await loadValidationErrors();
                      }}
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
                  backgroundColor: '#dc2626',
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
        <div className={getAnimationClass()} style={{
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
                  color: '#fff'
                }}>
                  <input
                    type="checkbox"
                    checked={interfaceParams.editAndInterface}
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
                  color: '#999',
                  marginTop: '4px',
                  marginLeft: '30px'
                }}>
                  Automatically post/journalize loaded records to GL (saves manual step)
                </div>
              </div>

              {/* Interface Parameters Form - Show when checkbox is checked */}
              {interfaceParams.editAndInterface && (
                <div style={{
                  backgroundColor: '#1a1a1a',
                  border: '2px solid #FF9800',
                  borderRadius: '12px',
                  padding: '24px',
                  marginBottom: '20px'
                }}>
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      color: '#FF9800',
                      marginBottom: '8px'
                    }}>
                      ⚙️ Interface Parameters
                    </h3>
                    <p style={{ fontSize: '13px', color: '#999' }}>
                      Configure parameters for interfacing transactions to General Ledger
                    </p>
                  </div>

                  {/* Text Input Parameters - 5 column grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '16px',
                    marginBottom: '20px'
                  }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px', display: 'block' }}>
                        RunGroup * (Generated by system)
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.runGroup}
                        readOnly
                        placeholder="Auto-generated unique RunGroup"
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #2a2a2a',
                          borderRadius: '6px',
                          color: '#999',
                          fontSize: '13px',
                          cursor: 'not-allowed'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px', display: 'block' }}>
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
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #2a2a2a',
                          borderRadius: '6px',
                          color: '#999',
                          fontSize: '13px',
                          cursor: 'not-allowed'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px', display: 'block' }}>
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
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #2a2a2a',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px', display: 'block' }}>
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
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #2a2a2a',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px', display: 'block' }}>
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
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #2a2a2a',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  </div>

                  {/* Processing Mode Radio Buttons */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', color: '#ccc', marginBottom: '8px', display: 'block' }}>
                      Processing Mode
                    </label>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: '#fff'
                      }}>
                        <input
                          type="radio"
                          name="processingModeLoad"
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
                        color: '#fff'
                      }}>
                        <input
                          type="radio"
                          name="processingModeLoad"
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
                      backgroundColor: '#1a1a1a',
                      borderRadius: '6px',
                      border: '1px solid #2a2a2a',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
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
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Journalize by Entity
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
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
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Journal by Journal Code
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
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
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Interface in Detail
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
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
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Bypass Structure Relation Edit
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
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
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Bypass Negative Rate Edit
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
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
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Move Errors to New RunGroup
                      </span>
                    </label>
                  </div>

                  {/* Error RunGroup Prefix - Show only if Move Errors is checked */}
                  {interfaceParams.moveErrorsToNewRunGroup && (
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px', display: 'block' }}>
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
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #2a2a2a',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '13px'
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
                  backgroundColor: '#dc2626',
                  color: '#fff',
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
              backgroundColor: '#0a0a0a',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              {/* Animated Spinner */}
              <div style={{
                width: '48px',
                height: '48px',
                border: '4px solid #2a2a2a',
                borderTop: '4px solid #FF9800',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px auto'
              }} />
              
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#FF9800', marginBottom: '8px' }}>
                {interfaceParams.editAndInterface ? 'Loading Records to FSM & Interfacing to GL...' : 'Loading Records to FSM...'}
              </div>
              
              {interfaceParams.editAndInterface && (
                <div style={{ fontSize: '13px', color: '#ccc', marginBottom: '12px' }}>
                  Phase 1: Loading records → Phase 2: Wait 3 seconds → Phase 3: Interface to GL
                </div>
              )}
              
              {loadProgress && (
                <div style={{ fontSize: '13px', color: '#999' }}>
                  <div style={{ marginBottom: '12px' }}>
                    Processing {loadProgress.records_processed.toLocaleString()} of {loadProgress.total_records.toLocaleString()} records
                  </div>
                  
                  {/* Progress Bar */}
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      width: `${Math.min(100, (loadProgress.records_processed / loadProgress.total_records) * 100)}%`,
                      height: '100%',
                      backgroundColor: '#FF9800',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span>Chunk {loadProgress.chunks_processed} of {loadProgress.total_chunks}</span>
                    <span>{loadProgress.elapsed_seconds}s elapsed</span>
                  </div>
                  
                  {loadProgress.total_records > 10000 && (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                      Large dataset detected - this may take several minutes
                    </div>
                  )}
                </div>
              )}
              
              {!loadProgress && (
                <div style={{ fontSize: '13px', color: '#999' }}>
                  Preparing data for FSM...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Completed Step */}
      {currentStep === 'completed' && loadResult && (
        <div className={getAnimationClass()}>
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

            {/* Error Details (only show if load failed) */}
            {loadResult.total_failure > 0 && (
              <div style={{
                backgroundColor: '#1a0a0a',
                border: '1px solid #dc2626',
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
                    color: '#dc2626',
                    margin: 0
                  }}>
                    ⚠️ Error Details
                  </h4>
                </div>
                
                {loadResult.error_message && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#0a0a0a',
                    borderRadius: '6px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
                      Error Message:
                    </div>
                    <div style={{ fontSize: '13px', color: '#fff', fontFamily: 'monospace' }}>
                      {loadResult.error_message}
                    </div>
                  </div>
                )}
                
                {loadResult.error_details && (
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#FF9800',
                      padding: '8px',
                      backgroundColor: '#0a0a0a',
                      borderRadius: '4px',
                      userSelect: 'none'
                    }}>
                      View Full API Response
                    </summary>
                    <pre style={{
                      marginTop: '8px',
                      padding: '12px',
                      backgroundColor: '#0a0a0a',
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
                  backgroundColor: '#0a0a0a',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#999'
                }}>
                  💡 <strong style={{ color: '#FF9800' }}>Next Steps:</strong>
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

          {/* Interface Transactions Section - Only show if interface was NOT selected during load */}
          {loadResult.total_failure === 0 && !interfaceParams.editAndInterface && (
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
                        Finance Enterprise Group
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
                        Currency Table
                      </label>
                      <input
                        type="text"
                        value={interfaceParams.currencyTable}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, currencyTable: e.target.value }))}
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

                  {/* Processing Mode Radio Buttons */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', color: '#ccc', marginBottom: '8px', display: 'block' }}>
                      Processing Mode
                    </label>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: '#fff'
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
                        color: '#fff'
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
                      backgroundColor: '#1a1a1a',
                      borderRadius: '6px',
                      border: '1px solid #2a2a2a',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.journalizeByEntity}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, journalizeByEntity: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Journalize by Entity
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.journalByJournalCode}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, journalByJournalCode: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Journal by Journal Code
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    >
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    >
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.interfaceInDetail}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, interfaceInDetail: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Interface in Detail
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.bypassStructureRelationEdit}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, bypassStructureRelationEdit: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Bypass Structure Relation Edit
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.bypassNegativeRateEdit}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, bypassNegativeRateEdit: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Bypass Negative Rate Edit
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
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#252525'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    >
                      <input
                        type="checkbox"
                        checked={interfaceParams.moveErrorsToNewRunGroup}
                        onChange={(e) => setInterfaceParams(prev => ({ ...prev, moveErrorsToNewRunGroup: e.target.checked }))}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                        Move Errors to New RunGroup
                      </span>
                    </label>
                  </div>

                  {/* Error RunGroup Prefix - Show only if Move Errors is checked */}
                  {interfaceParams.moveErrorsToNewRunGroup && (
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px', display: 'block' }}>
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
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #2a2a2a',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '13px'
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
                      backgroundColor: interfaceResult.success ? '#1a2e1a' : '#2e1a1a',
                      border: `1px solid ${interfaceResult.success ? '#22c55e' : '#dc2626'}`,
                      borderRadius: '6px'
                    }}>
                      <p style={{ 
                        color: interfaceResult.success ? '#22c55e' : '#dc2626', 
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
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', color: '#ccc' }}>
                            <div>Status: <span style={{ color: interfaceResult.verification.status_label === 'Complete' ? '#22c55e' : '#dc2626', fontWeight: '500' }}>
                              {interfaceResult.verification.status_label || 'Unknown'}
                            </span></div>
                            <div>Result Sequence: {interfaceResult.verification.result_sequence}</div>
                            <div>Total Records: {interfaceResult.verification.total_records.toLocaleString()}</div>
                            <div>Successfully Imported: <span style={{ color: '#22c55e' }}>{interfaceResult.verification.successfully_imported.toLocaleString()}</span></div>
                            <div>Records with Error: <span style={{ color: interfaceResult.verification.records_with_error > 0 ? '#dc2626' : '#22c55e' }}>
                              {interfaceResult.verification.records_with_error.toLocaleString()}
                            </span></div>
                            <div>RunGroup: {interfaceResult.verification.run_group}</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Error Details */}
                      {interfaceResult.error && (
                        <div style={{
                          marginTop: '12px',
                          padding: '8px',
                          backgroundColor: 'rgba(220, 38, 38, 0.1)',
                          border: '1px solid #dc2626',
                          borderRadius: '4px',
                          fontSize: '13px',
                          color: '#dc2626'
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