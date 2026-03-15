import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../theme';

interface SchemaVersion {
  id: number;
  business_class: string;
  version: number;
  version_hash: string;
  fields_count: number;
  required_fields_count: number;
  operations: string[];
  source: string;
  created_at: string;
}

interface ImportResult {
  business_class: string;
  version: number;
  new_schema: boolean;
  fields_count: number;
  required_fields: number;
  operations: string[];
  schema_hash: string;
  schema_id: number;
  reactivated?: boolean;  // Flag to indicate schema was reactivated
}

const SchemaManagement: React.FC = () => {
  const [schemas, setSchemas] = useState<SchemaVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [businessClass, setBusinessClass] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOperations, setShowOperations] = useState(false);
  const [expandedSchemaId, setExpandedSchemaId] = useState<number | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<SchemaVersion | null>(null);
  const [schemaDetails, setSchemaDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadSchemas();
  }, []);

  const loadSchemas = async () => {
    setLoading(true);
    try {
      const response = await api.get('/schema/list');
      setSchemas(response.data.schemas || []);
    } catch (err: any) {
      console.error('Failed to load schemas:', err);
      setSchemas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);

      // Try to extract business class name from the Swagger file
      try {
        const text = await file.text();
        const swagger = JSON.parse(text);
        
        // Try to extract from info.title (e.g., "Raw Data Web Service API - FinanceDimension1")
        if (swagger.info?.title) {
          const title = swagger.info.title;
          const match = title.match(/API - (.+)$/);
          if (match) {
            setBusinessClass(match[1]);
            return;
          }
          
          // Try "Webservice APIs for Currency" format
          const match2 = title.match(/APIs for (.+)$/);
          if (match2) {
            setBusinessClass(match2[1]);
            return;
          }
        }
        
        // Fallback: Try to extract from filename (remove .json extension)
        const filenameMatch = file.name.match(/^(.+)\.json$/);
        if (filenameMatch) {
          setBusinessClass(filenameMatch[1]);
        }
      } catch (err) {
        console.error('Failed to parse Swagger file:', err);
        // Fallback to filename without extension
        const filenameMatch = file.name.match(/^(.+)\.json$/);
        if (filenameMatch) {
          setBusinessClass(filenameMatch[1]);
        }
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !businessClass) {
      setError('Please select a file and enter business class name');
      return;
    }

    setUploading(true);
    setError(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('swagger_file', selectedFile);
      formData.append('business_class', businessClass);

      const response = await api.post('/schema/import-swagger', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportResult(response.data);
      setSelectedFile(null);
      setBusinessClass('');
      
      // Reset file input
      const fileInput = document.getElementById('swagger-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Reload schemas
      loadSchemas();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to import Swagger file');
    } finally {
      setUploading(false);
    }
  };

  const formatOperations = (operations: string[]) => {
    const opMap: { [key: string]: string } = {
      'createReleased': 'cR',
      'createUnreleased': 'cU',
      'create': 'c',
      'update': 'u',
      'delete': 'd',
    };
    return operations.map(op => opMap[op] || op).join(', ');
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'imported':
        return '#2196F3'; // Blue
      case 'local_swagger':
        return '#4CAF50'; // Green
      case 'fsm_api':
        return '#FF9800'; // Orange
      default:
        return '#9E9E9E'; // Gray
    }
  };

  const handleViewDetails = async (schema: SchemaVersion) => {
    setSelectedSchema(schema);
    setLoadingDetails(true);
    
    try {
      const response = await api.get(`/schema/${schema.business_class}/version/${schema.version}`);
      setSchemaDetails(response.data);
    } catch (err: any) {
      console.error('Failed to load schema details:', err);
      setSchemaDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetailsPanel = () => {
    setSelectedSchema(null);
    setSchemaDetails(null);
  };

  const handleDeleteSchema = async (schemaId: number, businessClass: string, version: number) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete this schema?\n\n` +
      `Business Class: ${businessClass}\n` +
      `Version: v${version}\n\n` +
      `This will deactivate the schema (soft delete). ` +
      `The schema will no longer appear in the list, but historical data remains intact. ` +
      `All auto-generated validation rules from this schema will also be deactivated.\n\n` +
      `New uploads for this business class will create a higher version number.`
    );

    if (!confirmed) {
      return;
    }

    try {
      // Call DELETE endpoint
      const response = await api.delete(`/schema/${schemaId}`);

      // Show success message with rules count
      const rulesCount = response.data.rules_deactivated || 0;
      const rulesMessage = rulesCount > 0 
        ? `\n${rulesCount} validation rule(s) also deactivated.`
        : '';
      
      alert(
        `✅ Schema ${businessClass} v${version} has been deactivated successfully.${rulesMessage}`
      );

      // Reload schemas list
      await loadSchemas();

      // Close details panel if this schema was being viewed
      if (selectedSchema?.id === schemaId) {
        closeDetailsPanel();
      }
    } catch (err: any) {
      console.error('Failed to delete schema:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to delete schema';
      alert(`❌ Error: ${errorMessage}`);
    }
  };

  const parseSchemaJson = (schemaJson: string) => {
    try {
      const parsed = JSON.parse(schemaJson);
      return parsed;
    } catch {
      return null;
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: theme.background.primary, minHeight: '100vh', color: theme.text.primary }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '10px', color: theme.text.primary }}>
          Schema Management
        </h1>
        <p style={{ color: theme.text.secondary, fontSize: '14px' }}>
          Upload Swagger/OpenAPI files to register FSM business classes
        </p>
      </div>

      {/* Upload Section */}
      <div style={{
        backgroundColor: theme.background.secondary,
        padding: '30px',
        borderRadius: '8px',
        marginBottom: '30px',
        border: `1px solid ${theme.background.quaternary}`
      }}>
        <h2 style={{ fontSize: '20px', marginBottom: '20px', color: theme.text.primary }}>Upload Swagger File</h2>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'stretch', width: '100%' }}>
          {/* Business Class Input */}
          <div style={{ 
            flex: '0 0 280px',
            backgroundColor: theme.background.secondary,
            padding: '15px',
            borderRadius: '6px',
            border: `1px solid ${theme.background.quaternary}`
          }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: theme.text.secondary }}>
              Business Class Name
            </label>
            <input
              type="text"
              value={businessClass}
              onChange={(e) => setBusinessClass(e.target.value)}
              placeholder="e.g., GLTransactionInterface"
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: theme.background.secondary,
                border: `1px solid ${theme.background.quaternary}`,
                borderRadius: '4px',
                color: theme.text.primary,
                fontSize: '14px',
                boxSizing: 'border-box' as const
              }}
            />
          </div>

          {/* File Input */}
          <div style={{ 
            flex: '1',
            minWidth: 0,
            backgroundColor: theme.background.secondary,
            padding: '15px',
            borderRadius: '6px',
            border: `1px solid ${theme.background.quaternary}`
          }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: theme.text.secondary }}>
              Swagger JSON File
            </label>
            <input
              id="swagger-file"
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: theme.background.secondary,
                border: `1px solid ${theme.background.quaternary}`,
                borderRadius: '4px',
                color: theme.text.primary,
                fontSize: '14px',
                boxSizing: 'border-box' as const
              }}
            />
          </div>

          {/* Upload Button */}
          <div style={{ 
            flex: '0 0 auto',
            display: 'flex',
            flexDirection: 'column' as const,
            justifyContent: 'flex-end',
            backgroundColor: theme.background.secondary,
            padding: '15px',
            borderRadius: '6px',
            border: `1px solid ${theme.background.quaternary}`
          }}>
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !businessClass}
              style={{
                padding: '10px 24px',
                backgroundColor: uploading ? theme.interactive.disabled : theme.primary.main,
                color: theme.background.secondary,
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                whiteSpace: 'nowrap' as const,
                height: '42px'
              }}
              onMouseEnter={(e) => {
                if (!uploading && selectedFile && businessClass) {
                  e.currentTarget.style.backgroundColor = theme.primary.dark;
                }
              }}
              onMouseLeave={(e) => {
                if (!uploading) {
                  e.currentTarget.style.backgroundColor = theme.primary.main;
                }
              }}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            marginTop: '20px',
            padding: '12px',
            backgroundColor: '#FEE2E2',
            border: `1px solid ${theme.status.error}`,
            borderRadius: '4px',
            color: theme.status.error,
            fontSize: '14px'
          }}>
            ❌ {error}
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div style={{
            marginTop: '20px',
            padding: '20px',
            backgroundColor: importResult.new_schema ? '#D1FAE5' : '#DBEAFE',
            border: `1px solid ${importResult.new_schema ? theme.status.success : theme.status.info}`,
            borderRadius: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <span style={{ fontSize: '24px', marginRight: '10px' }}>
                {importResult.new_schema ? '✅' : 'ℹ️'}
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: theme.text.primary }}>
                {importResult.reactivated 
                  ? 'Schema Reactivated' 
                  : importResult.new_schema 
                    ? 'New Schema Version Created' 
                    : 'Schema Already Exists'
                }
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto auto', gap: '20px', alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: '12px', color: theme.text.tertiary, marginBottom: '4px' }}>Business Class</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: theme.text.primary }}>{importResult.business_class}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: theme.text.tertiary, marginBottom: '4px' }}>Version</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: theme.text.primary }}>v{importResult.version}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: theme.text.tertiary, marginBottom: '4px' }}>Fields</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: theme.text.primary }}>{importResult.fields_count}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: theme.text.tertiary, marginBottom: '4px' }}>Required</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: theme.text.primary }}>{importResult.required_fields}</div>
              </div>
            </div>

            {/* Operations - Collapsible */}
            <div style={{ marginTop: '15px' }}>
              <button
                onClick={() => setShowOperations(!showOperations)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: theme.background.secondary,
                  border: `1px solid ${theme.background.quaternary}`,
                  borderRadius: '4px',
                  color: theme.text.primary,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
              >
                <span style={{ fontSize: '12px' }}>{showOperations ? '▼' : '▶'}</span>
                <span>Operations ({importResult.operations.length})</span>
              </button>
              
              {showOperations && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '6px', 
                  marginTop: '10px',
                  padding: '12px',
                  backgroundColor: theme.background.primary,
                  borderRadius: '4px',
                  border: `1px solid ${theme.background.quaternary}`
                }}>
                  {importResult.operations.map((op, idx) => (
                    <span key={idx} style={{
                      padding: '4px 8px',
                      backgroundColor: theme.background.secondary,
                      border: `1px solid ${theme.background.quaternary}`,
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: theme.text.primary,
                      whiteSpace: 'nowrap'
                    }}>
                      {op}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '15px', fontSize: '12px', color: theme.text.tertiary }}>
              Schema Hash: {importResult.schema_hash.substring(0, 16)}...
            </div>
          </div>
        )}
      </div>

      {/* Schema Versions Table */}
      <div style={{
        backgroundColor: theme.background.secondary,
        padding: '30px',
        borderRadius: '8px',
        border: `1px solid ${theme.background.quaternary}`
      }}>
        <h2 style={{ fontSize: '20px', marginBottom: '20px', color: theme.text.primary }}>Schema Versions</h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: theme.text.tertiary }}>
            Loading schemas...
          </div>
        ) : schemas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: theme.text.tertiary }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>📄</div>
            <div style={{ fontSize: '16px' }}>No schemas uploaded yet</div>
            <div style={{ fontSize: '14px', marginTop: '5px' }}>
              Upload a Swagger file to get started
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: theme.background.tertiary, borderBottom: `2px solid ${theme.background.quaternary}` }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', color: theme.text.secondary, fontWeight: '600' }}>
                    Business Class
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: theme.text.secondary, fontWeight: '600' }}>
                    Version
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: theme.text.secondary, fontWeight: '600' }}>
                    Fields
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: theme.text.secondary, fontWeight: '600' }}>
                    Required
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: theme.text.secondary, fontWeight: '600' }}>
                    Operations
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: theme.text.secondary, fontWeight: '600' }}>
                    Source
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: theme.text.secondary, fontWeight: '600' }}>
                    Created
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: theme.text.secondary, fontWeight: '600' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {schemas.map((schema) => (
                  <React.Fragment key={schema.id}>
                  <tr style={{ borderBottom: `1px solid ${theme.background.quaternary}` }}>
                    <td style={{ padding: '12px', fontSize: '14px', color: theme.text.primary }}>
                      {schema.business_class}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: theme.text.primary }}>
                      v{schema.version}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: theme.text.primary }}>
                      {schema.fields_count}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: theme.text.primary }}>
                      {schema.required_fields_count}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>
                      <button
                        onClick={() => setExpandedSchemaId(expandedSchemaId === schema.id ? null : schema.id)}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: theme.background.secondary,
                          border: `1px solid ${theme.background.quaternary}`,
                          borderRadius: '4px',
                          color: theme.text.primary,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                      >
                        <span style={{ fontSize: '10px' }}>{expandedSchemaId === schema.id ? '▼' : '▶'}</span>
                        <span>{schema.operations.length} ops</span>
                      </button>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: getSourceBadgeColor(schema.source) + '20',
                        color: getSourceBadgeColor(schema.source),
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {schema.source}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: theme.text.tertiary }}>
                      {new Date(schema.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleViewDetails(schema)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: theme.background.secondary,
                          color: theme.text.primary,
                          border: `1px solid ${theme.background.quaternary}`,
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          marginRight: '8px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.interactive.hover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = theme.background.secondary;
                        }}
                      >
                        👁️ View Details
                      </button>
                      <button
                        onClick={() => handleDeleteSchema(schema.id, schema.business_class, schema.version)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#b91c1c';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#dc2626';
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                  {/* Expanded Operations Row */}
                  {expandedSchemaId === schema.id && (
                    <tr style={{ backgroundColor: theme.background.primary }}>
                      <td colSpan={8} style={{ padding: '15px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {schema.operations.map((op, idx) => (
                            <span key={idx} style={{
                              padding: '4px 8px',
                              backgroundColor: theme.background.secondary,
                              border: `1px solid ${theme.background.quaternary}`,
                              borderRadius: '4px',
                              fontSize: '11px',
                              color: theme.text.primary,
                              whiteSpace: 'nowrap'
                            }}>
                              {op}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: theme.accent.purpleTintLight,
        border: `1px solid ${theme.accent.purpleTintMedium}`,
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '16px', marginBottom: '10px', color: theme.primary.main }}>
          ℹ️ About Schema Management
        </h3>
        <ul style={{ fontSize: '14px', color: theme.text.secondary, lineHeight: '1.8', paddingLeft: '20px' }}>
          <li>Upload Swagger/OpenAPI JSON files to register new FSM business classes</li>
          <li>Schema versions are automatically created when schemas change (SHA256 hash detection)</li>
          <li>Duplicate schemas are detected and won't create new versions</li>
          <li>Operations are extracted from paths (create, createUnreleased, createReleased, update, delete)</li>
          <li>Load methods are automatically determined based on available operations</li>
          <li>Validation rules are automatically generated from schema metadata (pattern, enum, required fields)</li>
          <li>Deleting a schema deactivates it and all auto-generated validation rules (soft delete)</li>
          <li>Historical conversion jobs remain stable with locked schema versions</li>
        </ul>
      </div>

      {/* Schema Details Panel */}
      {selectedSchema && (
        <>
          {/* Overlay */}
          <div
            onClick={closeDetailsPanel}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              zIndex: 999,
              animation: 'fadeIn 0.2s ease-out'
            }}
          />
          
          {/* Sliding Panel */}
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '600px',
            maxWidth: '90vw',
            backgroundColor: theme.background.secondary,
            borderLeft: `1px solid ${theme.background.quaternary}`,
            zIndex: 1000,
            overflowY: 'auto',
            animation: 'slideInRight 0.3s ease-out',
            boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)'
          }}>
            {/* Panel Header */}
            <div style={{
              position: 'sticky',
              top: 0,
              backgroundColor: theme.background.tertiary,
              borderBottom: `1px solid ${theme.background.quaternary}`,
              padding: '20px',
              zIndex: 10
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: theme.text.primary }}>
                    {selectedSchema.business_class}
                  </h2>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: theme.text.tertiary }}>
                      Version {selectedSchema.version}
                    </span>
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: getSourceBadgeColor(selectedSchema.source) + '20',
                      color: getSourceBadgeColor(selectedSchema.source),
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {selectedSchema.source}
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeDetailsPanel}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: theme.background.secondary,
                    border: `1px solid ${theme.background.quaternary}`,
                    borderRadius: '4px',
                    color: theme.text.primary,
                    fontSize: '18px',
                    cursor: 'pointer',
                    lineHeight: '1'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.interactive.hover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.background.secondary}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Panel Content */}
            <div style={{ padding: '20px' }}>
              {loadingDetails ? (
                <div style={{ textAlign: 'center', padding: '40px', color: theme.text.tertiary }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
                  <div>Loading schema details...</div>
                </div>
              ) : schemaDetails ? (
                <>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                    <div style={{
                      padding: '16px',
                      backgroundColor: theme.background.primary,
                      border: `1px solid ${theme.background.quaternary}`,
                      borderRadius: '6px'
                    }}>
                      <div style={{ fontSize: '12px', color: theme.text.tertiary, marginBottom: '4px' }}>Total Fields</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: theme.text.primary }}>
                        {selectedSchema.fields_count}
                      </div>
                    </div>
                    <div style={{
                      padding: '16px',
                      backgroundColor: theme.background.primary,
                      border: `1px solid ${theme.background.quaternary}`,
                      borderRadius: '6px'
                    }}>
                      <div style={{ fontSize: '12px', color: theme.text.tertiary, marginBottom: '4px' }}>Required Fields</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: theme.status.error }}>
                        {selectedSchema.required_fields_count}
                      </div>
                    </div>
                  </div>

                  {/* Fields List */}
                  {(() => {
                    const parsedSchema = parseSchemaJson(schemaDetails.schema_json);
                    if (!parsedSchema || !parsedSchema.properties) return null;

                    const fields = Object.entries(parsedSchema.properties).map(([name, field]: [string, any]) => ({
                      name,
                      type: field.type || 'string',
                      required: parsedSchema.required?.includes(name) || false,
                      enum: field.enum,
                      pattern: field.pattern,
                      format: field.format,
                      maxLength: field.maxLength,
                      description: field.description
                    }));

                    const requiredFields = fields.filter(f => f.required);
                    const optionalFields = fields.filter(f => !f.required);

                    return (
                      <>
                        {/* Required Fields */}
                        {requiredFields.length > 0 && (
                          <div style={{
                            padding: '16px',
                            backgroundColor: theme.background.primary,
                            border: `1px solid ${theme.background.quaternary}`,
                            borderRadius: '6px',
                            marginBottom: '16px'
                          }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 'bold',
                              marginBottom: '12px',
                              color: theme.status.error,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span>⚠️</span>
                              <span>Required Fields ({requiredFields.length})</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {requiredFields.map((field, idx) => (
                                <div key={idx} style={{
                                  padding: '12px',
                                  backgroundColor: theme.background.secondary,
                                  border: `1px solid ${theme.background.quaternary}`,
                                  borderRadius: '4px'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: theme.text.primary }}>
                                      {field.name}
                                    </span>
                                    <span style={{
                                      padding: '2px 6px',
                                      backgroundColor: theme.background.tertiary,
                                      borderRadius: '3px',
                                      fontSize: '10px',
                                      color: theme.text.tertiary,
                                      fontFamily: 'monospace'
                                    }}>
                                      {field.type}
                                    </span>
                                  </div>
                                  {field.description && (
                                    <div style={{ fontSize: '11px', color: theme.text.tertiary, marginTop: '4px' }}>
                                      {field.description}
                                    </div>
                                  )}
                                  {field.enum && (
                                    <div style={{ fontSize: '11px', color: theme.status.success, marginTop: '4px' }}>
                                      Enum: {field.enum.join(', ')}
                                    </div>
                                  )}
                                  {field.pattern && (
                                    <div style={{ fontSize: '11px', color: theme.status.info, marginTop: '4px', fontFamily: 'monospace' }}>
                                      Pattern: {field.pattern}
                                    </div>
                                  )}
                                  {field.maxLength && (
                                    <div style={{ fontSize: '11px', color: theme.status.warning, marginTop: '4px' }}>
                                      Max Length: {field.maxLength}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Optional Fields */}
                        {optionalFields.length > 0 && (
                          <div style={{
                            padding: '16px',
                            backgroundColor: theme.background.primary,
                            border: `1px solid ${theme.background.quaternary}`,
                            borderRadius: '6px',
                            marginBottom: '24px'
                          }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 'bold',
                              marginBottom: '12px',
                              color: theme.text.primary,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span>📋</span>
                              <span>Optional Fields ({optionalFields.length})</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {optionalFields.map((field, idx) => (
                                <div key={idx} style={{
                                  padding: '12px',
                                  backgroundColor: theme.background.secondary,
                                  border: `1px solid ${theme.background.quaternary}`,
                                  borderRadius: '4px'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: theme.text.primary }}>
                                      {field.name}
                                    </span>
                                    <span style={{
                                      padding: '2px 6px',
                                      backgroundColor: theme.background.tertiary,
                                      borderRadius: '3px',
                                      fontSize: '10px',
                                      color: theme.text.tertiary,
                                      fontFamily: 'monospace'
                                    }}>
                                      {field.type}
                                    </span>
                                  </div>
                                  {field.description && (
                                    <div style={{ fontSize: '11px', color: theme.text.tertiary, marginTop: '4px' }}>
                                      {field.description}
                                    </div>
                                  )}
                                  {field.enum && (
                                    <div style={{ fontSize: '11px', color: theme.status.success, marginTop: '4px' }}>
                                      Enum: {field.enum.join(', ')}
                                    </div>
                                  )}
                                  {field.pattern && (
                                    <div style={{ fontSize: '11px', color: theme.status.info, marginTop: '4px', fontFamily: 'monospace' }}>
                                      Pattern: {field.pattern}
                                    </div>
                                  )}
                                  {field.maxLength && (
                                    <div style={{ fontSize: '11px', color: theme.status.warning, marginTop: '4px' }}>
                                      Max Length: {field.maxLength}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Operations */}
                  {selectedSchema.operations && selectedSchema.operations.length > 0 && (
                    <div style={{
                      padding: '16px',
                      backgroundColor: theme.background.primary,
                      border: `1px solid ${theme.background.quaternary}`,
                      borderRadius: '6px',
                      marginBottom: '24px'
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: theme.text.primary }}>
                        Available Operations ({selectedSchema.operations.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {selectedSchema.operations.map((op, idx) => (
                          <div
                            key={idx}
                            title={op}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: theme.background.secondary,
                              border: `1px solid ${theme.background.quaternary}`,
                              borderRadius: '4px',
                              fontSize: '11px',
                              color: theme.text.primary,
                              fontFamily: 'monospace',
                              wordBreak: 'break-all',
                              lineHeight: '1.4'
                            }}
                          >
                            {op}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Schema Hash */}
                  <div style={{
                    padding: '16px',
                    backgroundColor: theme.background.primary,
                    border: `1px solid ${theme.background.quaternary}`,
                    borderRadius: '6px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ fontSize: '12px', color: theme.text.tertiary, marginBottom: '8px' }}>Schema Hash (SHA256)</div>
                    <div style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: theme.text.secondary,
                      wordBreak: 'break-all',
                      backgroundColor: theme.background.secondary,
                      padding: '8px',
                      borderRadius: '4px'
                    }}>
                      {selectedSchema.version_hash}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div style={{
                    padding: '16px',
                    backgroundColor: theme.background.primary,
                    border: `1px solid ${theme.background.quaternary}`,
                    borderRadius: '6px',
                    marginTop: '16px'
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: theme.text.primary }}>
                      Metadata
                    </div>
                    <div style={{ fontSize: '12px', color: theme.text.secondary, lineHeight: '1.8' }}>
                      <div><strong>Created:</strong> {new Date(schemaDetails.fetched_timestamp).toLocaleString()}</div>
                      <div><strong>Schema ID:</strong> {schemaDetails.id}</div>
                      <div><strong>Version Number:</strong> {schemaDetails.version_number}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: theme.text.tertiary }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>❌</div>
                  <div>Failed to load schema details</div>
                </div>
              )}
            </div>
          </div>

          {/* CSS Animations */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideInRight {
              from {
                transform: translateX(100%);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `}</style>
        </>
      )}
    </div>
  );
};

export default SchemaManagement;
