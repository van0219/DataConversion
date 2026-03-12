import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../theme';

interface SetupBusinessClass {
  id: number;
  name: string;
  endpoint_url: string;
  key_field: string;
  is_active: boolean;
  category: string; // 'standard' or 'custom'
  original_endpoint_url: string | null;
  original_key_field: string | null;
  created_at: string;
  updated_at: string;
}

interface SnapshotRegistryItem {
  id: number;
  business_class: string;
  last_sync_timestamp: string | null;
  record_count: number;
}

interface SyncResult {
  business_class: string;
  status: string;
  record_count: number;
  last_sync: string;
  error?: string;
}

type SyncStatus = 'idle' | 'syncing' | 'completed' | 'failed' | 'queued';

interface ClassSyncStatus {
  name: string;
  status: SyncStatus;
  recordCount?: number;
  error?: string;
}

const SetupDataManagement: React.FC = () => {
  const [setupClasses, setSetupClasses] = useState<SetupBusinessClass[]>([]);
  const [registry, setRegistry] = useState<SnapshotRegistryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatuses, setSyncStatuses] = useState<Map<string, ClassSyncStatus>>(new Map());
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClass, setEditingClass] = useState<SetupBusinessClass | null>(null);
  const [availableSwaggerFiles, setAvailableSwaggerFiles] = useState<any[]>([]);
  const [selectedSwagger, setSelectedSwagger] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingClasses, setSyncingClasses] = useState<Set<number>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    list_name: '',
    endpoint_url: '',
    key_field: '',
    is_active: true
  });

  useEffect(() => {
    loadSetupClasses();
    loadRegistry();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadSetupClasses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/snapshot/setup-classes');
      setSetupClasses(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load setup classes');
    } finally {
      setLoading(false);
    }
  };

  const loadRegistry = async () => {
    try {
      const response = await api.get('/snapshot/registry');
      setRegistry(response.data);
    } catch (err: any) {
      console.error('Failed to load registry:', err);
    }
  };

  const loadAvailableSwaggerFiles = async () => {
    try {
      const response = await api.get('/snapshot/available-swagger-files');
      setAvailableSwaggerFiles(response.data.available_files);
    } catch (err: any) {
      console.error('Failed to load available swagger files:', err);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      setError('');
      
      // Get active classes
      const activeClasses = setupClasses.filter(c => c.is_active);
      
      // Initialize sync statuses - all queued
      const initialStatuses = new Map<string, ClassSyncStatus>();
      activeClasses.forEach((cls) => {
        initialStatuses.set(cls.name, {
          name: cls.name,
          status: 'queued'
        });
      });
      setSyncStatuses(initialStatuses);
      
      // Sync each class individually for real-time progress
      for (const cls of activeClasses) {
        try {
          // Update to syncing
          setSyncStatuses(prev => {
            const updated = new Map(prev);
            updated.set(cls.name, {
              name: cls.name,
              status: 'syncing'
            });
            return updated;
          });
          
          // Sync this class
          const response = await api.post('/snapshot/sync/single', {
            business_class_name: cls.name
          });
          
          // Update to completed
          const result = response.data.classes_synced[0];
          setSyncStatuses(prev => {
            const updated = new Map(prev);
            updated.set(cls.name, {
              name: cls.name,
              status: result.status === 'success' ? 'completed' : 'failed',
              recordCount: result.record_count,
              error: result.error
            });
            return updated;
          });
          
        } catch (err: any) {
          // Mark this class as failed
          setSyncStatuses(prev => {
            const updated = new Map(prev);
            updated.set(cls.name, {
              name: cls.name,
              status: 'failed',
              error: err.response?.data?.detail || 'Sync failed'
            });
            return updated;
          });
        }
      }
      
      // Reload registry to show updated last sync times
      await loadRegistry();
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const getRegistryForClass = (className: string): SnapshotRegistryItem | undefined => {
    return registry.find(r => r.business_class === className);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getSyncStatusBadge = (className: string) => {
    const syncStatus = syncStatuses.get(className);
    if (!syncStatus) return null;

    const statusConfig = {
      queued: { bg: theme.background.quaternary, border: '#4b5563', text: ' Queued', color: theme.text.secondary },
      syncing: { bg: '#1e40af', border: '#3b82f6', text: ' Syncing...', color: theme.background.secondary },
      completed: { bg: '#064e3b', border: '#059669', text: ' Completed', color: theme.background.secondary },
      failed: { bg: '#7f1d1d', border: theme.status.error, text: ' Failed', color: theme.background.secondary },
      idle: { bg: theme.background.quaternary, border: '#4b5563', text: 'Idle', color: theme.text.secondary }
    };

    const config = statusConfig[syncStatus.status];

    return (
      <div style={{
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        display: 'inline-block'
      }}>
        {config.text}
        {syncStatus.recordCount !== undefined && syncStatus.status === 'completed' && (
          <span style={{ marginLeft: '5px' }}>({syncStatus.recordCount} records)</span>
        )}
      </div>
    );
  };

  const handleAddClass = async () => {
    try {
      await api.post('/snapshot/setup-classes', formData);
      setShowAddModal(false);
      setSelectedSwagger(null);
      setFormData({ name: '', endpoint_url: '', key_field: '', is_active: true });
      await loadSetupClasses();
      await loadAvailableSwaggerFiles(); // Refresh available files
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add setup class');
    }
  };

  const handleEditClass = async () => {
    if (!editingClass) return;
    try {
      await api.put(`/snapshot/setup-classes/${editingClass.id}`, formData);
      setShowEditModal(false);
      setEditingClass(null);
      setFormData({ name: '', endpoint_url: '', key_field: '', is_active: true });
      await loadSetupClasses();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update setup class');
    }
  };

  const handleDeleteClass = async (setupClass: SetupBusinessClass) => {
    if (setupClass.category === 'standard') {
      setError('Cannot delete standard setup classes. Use deactivate instead.');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete "${setupClass.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/snapshot/setup-classes/${setupClass.id}`);
      await loadSetupClasses();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete setup class');
    }
  };

  const handleToggleActive = async (setupClass: SetupBusinessClass) => {
    try {
      await api.post(`/snapshot/setup-classes/${setupClass.id}/toggle`);
      await loadSetupClasses();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to toggle setup class');
    }
  };

  const handleResetClass = async (setupClass: SetupBusinessClass) => {
    if (!confirm(`Reset "${setupClass.name}" to original values?`)) {
      return;
    }

    try {
      await api.post(`/snapshot/setup-classes/${setupClass.id}/reset`);
      await loadSetupClasses();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset setup class');
    }
  };

  const openEditModal = (setupClass: SetupBusinessClass) => {
    setEditingClass(setupClass);
    setFormData({
      name: setupClass.name,
      endpoint_url: setupClass.endpoint_url,
      key_field: setupClass.key_field,
      is_active: setupClass.is_active
    });
    setShowEditModal(true);
  };

  const openAddModal = async () => {
    await loadAvailableSwaggerFiles();
    setShowAddModal(true);
  };

  const handleSwaggerSelect = (swaggerFile: any) => {
    setSelectedSwagger(swaggerFile);
    // Set default list (first one) if available
    const defaultList = swaggerFile.available_lists?.[0] || '';
    const endpointUrl = defaultList 
      ? `soap/classes/${swaggerFile.name}/lists/${defaultList}?_fields=_all&_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false`
      : '';
    
    setFormData({
      name: swaggerFile.name,
      list_name: defaultList,
      endpoint_url: endpointUrl,
      key_field: swaggerFile.key_field,
      is_active: true
    });
  };
  
  const handleListSelect = (listName: string) => {
    const endpointUrl = `soap/classes/${formData.name}/lists/${listName}?_fields=_all&_limit=100000&_links=false&_pageNav=true&_out=JSON&_flatten=false`;
    setFormData({
      ...formData,
      list_name: listName,
      endpoint_url: endpointUrl
    });
  };

  const handleSyncSingle = async (setupClass: SetupBusinessClass) => {
    if (!setupClass.is_active) {
      setError('Cannot sync inactive class. Activate it first.');
      return;
    }

    try {
      setSyncingClasses(prev => new Set(prev).add(setupClass.id));
      setError('');

      const response = await api.post('/snapshot/sync/single', {
        business_class_name: setupClass.name
      });

      // Reload registry to show updated sync time
      await loadRegistry();

    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to sync ${setupClass.name}`);
    } finally {
      setSyncingClasses(prev => {
        const newSet = new Set(prev);
        newSet.delete(setupClass.id);
        return newSet;
      });
    }
  };

  // Filter setup classes based on search term
  const filteredSetupClasses = setupClasses.filter(cls =>
    cls.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', backgroundColor: theme.background.primary, minHeight: '100vh', color: theme.text.primary }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ color: theme.text.primary, marginBottom: '10px' }}>Setup Data Management</h1>
        <p style={{ color: theme.text.secondary }}>
          Manage FSM setup business classes and sync reference data for validation
        </p>
      </div>

      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#7f1d1d',
          border: `1px solid ${theme.status.error}`,
          borderRadius: '4px',
          marginBottom: '20px',
          color: theme.background.secondary
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '30px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <button
          onClick={handleSyncAll}
          disabled={syncing || loading}
          style={{
            padding: '12px 24px',
            backgroundColor: syncing ? '#6b7280' : theme.primary.main,
            color: theme.background.secondary,
            border: 'none',
            borderRadius: '4px',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          {syncing ? 'Syncing...' : 'Sync All Active Classes'}
        </button>
        
        <button
          onClick={openAddModal}
          disabled={syncing || loading}
          style={{
            padding: '12px 24px',
            backgroundColor: theme.background.secondary,
            color: theme.text.primary,
            border: `1px solid ${theme.background.quaternary}`,
            borderRadius: '4px',
            cursor: syncing || loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          + Add New Class
        </button>

        <div style={{ marginLeft: 'auto', flex: '0 0 300px' }}>
          <input
            type="text"
            placeholder="Search classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 15px',
              backgroundColor: theme.background.secondary,
              border: `1px solid ${theme.background.quaternary}`,
              borderRadius: '4px',
              color: theme.text.primary,
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      <div style={{
        backgroundColor: theme.background.secondary,
        border: `1px solid ${theme.background.quaternary}`,
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: theme.background.tertiary, borderBottom: `1px solid ${theme.background.quaternary}` }}>
              <th style={{ padding: '12px', textAlign: 'left', color: theme.text.secondary, fontWeight: '500' }}>
                Name
              </th>
              <th style={{ padding: '12px', textAlign: 'center', color: theme.text.secondary, fontWeight: '500' }}>
                Category
              </th>
              <th style={{ padding: '12px', textAlign: 'center', color: theme.text.secondary, fontWeight: '500' }}>
                Status
              </th>
              <th style={{ padding: '12px', textAlign: 'right', color: theme.text.secondary, fontWeight: '500' }}>
                Records
              </th>
              <th style={{ padding: '12px', textAlign: 'left', color: theme.text.secondary, fontWeight: '500' }}>
                Last Sync
              </th>
              <th style={{ padding: '12px', textAlign: 'center', color: theme.text.secondary, fontWeight: '500' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: theme.text.secondary }}>
                  Loading...
                </td>
              </tr>
            ) : filteredSetupClasses.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: theme.text.secondary }}>
                  {searchTerm ? `No classes found matching "${searchTerm}"` : 'No setup classes configured'}
                </td>
              </tr>
            ) : (
              filteredSetupClasses.map((setupClass, idx) => {
                const registryItem = getRegistryForClass(setupClass.name);
                const isSyncing = syncingClasses.has(setupClass.id);
                return (
                  <tr 
                    key={setupClass.id} 
                    style={{ 
                      borderBottom: '1px solid theme.background.quaternary',
                      backgroundColor: idx % 2 === 0 ? theme.background.secondary : theme.background.primary
                    }}
                  >
                    <td style={{ padding: '12px', color: theme.text.primary }}>
                      {setupClass.name}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: setupClass.category === 'standard' ? '#1e40af' : '#7c2d12',
                        color: theme.background.secondary
                      }}>
                        {setupClass.category === 'standard' ? 'Standard' : 'Custom'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: setupClass.is_active ? '#064e3b' : '#7f1d1d',
                        color: theme.background.secondary
                      }}>
                        {setupClass.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: theme.text.primary }}>
                      {registryItem ? registryItem.record_count.toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '12px', color: theme.text.secondary, fontSize: '14px' }}>
                      {formatDate(registryItem?.last_sync_timestamp || null)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                        {/* Primary Action: Sync */}
                        <button
                          onClick={() => handleSyncSingle(setupClass)}
                          disabled={!setupClass.is_active || isSyncing}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: isSyncing ? '#6b7280' : theme.primary.main,
                            color: theme.background.secondary,
                            border: 'none',
                            borderRadius: '4px',
                            cursor: setupClass.is_active && !isSyncing ? 'pointer' : 'not-allowed',
                            fontSize: '12px',
                            opacity: setupClass.is_active ? 1 : 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Sync this business class from FSM"
                        >
                          {(() => {
                            const syncStatus = syncStatuses.get(setupClass.name);
                            if (syncStatus) {
                              switch (syncStatus.status) {
                                case 'queued':
                                  return 'Queued';
                                case 'syncing':
                                  return 'Syncing...';
                                case 'completed':
                                  return `Completed (${syncStatus.recordCount || 0})`;
                                case 'failed':
                                  return 'Failed';
                                default:
                                  return 'Sync';
                              }
                            }
                            return isSyncing ? 'Syncing...' : 'Sync';
                          })()}
                        </button>

                        {/* Overflow Menu Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === setupClass.id ? null : setupClass.id);
                          }}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: theme.background.secondary,
                            color: theme.text.primary,
                            border: `1px solid ${theme.background.quaternary}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            lineHeight: '1'
                          }}
                          title="More actions"
                        >
                          ⋮
                        </button>

                        {/* Overflow Menu Dropdown */}
                        {openMenuId === setupClass.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: '4px',
                              backgroundColor: theme.background.secondary,
                              border: `1px solid ${theme.background.quaternary}`,
                              borderRadius: '4px',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                              zIndex: 1000,
                              minWidth: '180px'
                            }}
                          >
                            {/* Edit */}
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                openEditModal(setupClass);
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 15px',
                                backgroundColor: 'transparent',
                                color: theme.text.primary,
                                border: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.background.quaternary}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              Edit
                            </button>

                            {/* Activate/Deactivate */}
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                if (setupClass.is_active) {
                                  if (confirm(`Are you sure you want to deactivate "${setupClass.name}"?`)) {
                                    handleToggleActive(setupClass);
                                  }
                                } else {
                                  handleToggleActive(setupClass);
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 15px',
                                backgroundColor: 'transparent',
                                color: setupClass.is_active ? theme.status.error : theme.status.success,
                                border: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.background.quaternary}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              {setupClass.is_active ? 'Deactivate' : 'Activate'}
                            </button>

                            {/* Reset */}
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                if (setupClass.original_endpoint_url) {
                                  if (confirm(`Reset configuration for "${setupClass.name}" to default values?`)) {
                                    handleResetClass(setupClass);
                                  }
                                }
                              }}
                              disabled={!setupClass.original_endpoint_url}
                              style={{
                                width: '100%',
                                padding: '10px 15px',
                                backgroundColor: 'transparent',
                                color: setupClass.original_endpoint_url ? '#9ca3af' : '#4b5563',
                                border: 'none',
                                textAlign: 'left',
                                cursor: setupClass.original_endpoint_url ? 'pointer' : 'not-allowed',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                opacity: setupClass.original_endpoint_url ? 1 : 0.5
                              }}
                              onMouseEnter={(e) => {
                                if (setupClass.original_endpoint_url) {
                                  e.currentTarget.style.backgroundColor = theme.background.quaternary;
                                }
                              }}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              Reset
                            </button>

                            {/* Delete (only for custom classes) */}
                            {setupClass.category === 'custom' && (
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleDeleteClass(setupClass);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 15px',
                                  backgroundColor: 'transparent',
                                  color: theme.status.error,
                                  border: 'none',
                                  borderTop: '1px solid theme.background.quaternary',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.background.quaternary}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add New Class Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: theme.background.secondary,
            border: '1px solid theme.background.quaternary',
            borderRadius: '8px',
            padding: '30px',
            width: '500px',
            maxWidth: '90%'
          }}>
            <h2 style={{ color: theme.text.primary, marginBottom: '20px' }}>Add New Setup Class</h2>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', color: theme.text.secondary, marginBottom: '5px' }}>
                Select Business Class
              </label>
              <select
                value={selectedSwagger?.name || ''}
                onChange={(e) => {
                  const selected = availableSwaggerFiles.find(f => f.name === e.target.value);
                  if (selected) handleSwaggerSelect(selected);
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: theme.background.tertiary,
                  border: '1px solid theme.background.quaternary',
                  borderRadius: '4px',
                  color: theme.text.primary
                }}
              >
                <option value="">-- Select a business class --</option>
                {availableSwaggerFiles.map((file) => (
                  <option key={file.name} value={file.name}>
                    {file.name}
                  </option>
                ))}
              </select>
              {availableSwaggerFiles.length === 0 && (
                <p style={{ color: theme.text.secondary, fontSize: '12px', marginTop: '5px' }}>
                  No available business classes found. All classes have been added.
                </p>
              )}
            </div>

            {selectedSwagger && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', color: theme.text.secondary, marginBottom: '5px' }}>
                    Class Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    readOnly
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: theme.background.primary,
                      border: '1px solid theme.background.quaternary',
                      borderRadius: '4px',
                      color: theme.text.secondary,
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', color: theme.text.secondary, marginBottom: '5px' }}>
                    Select List
                  </label>
                  <select
                    value={formData.list_name}
                    onChange={(e) => handleListSelect(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: theme.background.tertiary,
                      border: `1px solid ${theme.background.quaternary}`,
                      borderRadius: '4px',
                      color: theme.text.primary,
                      fontSize: '14px'
                    }}
                  >
                    <option value="">-- Select a list --</option>
                    {selectedSwagger.available_lists?.map((listName: string) => (
                      <option key={listName} value={listName}>
                        {listName}
                      </option>
                    ))}
                  </select>
                  {selectedSwagger.available_lists && selectedSwagger.available_lists.length > 0 && (
                    <p style={{ color: theme.text.secondary, fontSize: '12px', marginTop: '5px' }}>
                      {selectedSwagger.available_lists.length} list(s) available
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', color: theme.text.secondary, marginBottom: '5px' }}>
                    Endpoint URL (Read-only)
                  </label>
                  <textarea
                    value={formData.endpoint_url}
                    readOnly
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: theme.background.primary,
                      border: '1px solid theme.background.quaternary',
                      borderRadius: '4px',
                      color: theme.text.secondary,
                      cursor: 'not-allowed',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      resize: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', color: theme.text.secondary, marginBottom: '5px' }}>
                    Key Field
                  </label>
                  <input
                    type="text"
                    value={formData.key_field}
                    readOnly
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: theme.background.primary,
                      border: '1px solid theme.background.quaternary',
                      borderRadius: '4px',
                      color: theme.text.secondary,
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', color: theme.text.primary, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      style={{ marginRight: '8px' }}
                    />
                    Active
                  </label>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedSwagger(null);
                  setFormData({ name: '', list_name: '', endpoint_url: '', key_field: '', is_active: true });
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: theme.background.quaternary,
                  color: theme.background.secondary,
                  border: '1px solid #4b5563',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddClass}
                disabled={!selectedSwagger || !formData.list_name}
                style={{
                  padding: '10px 20px',
                  backgroundColor: (selectedSwagger && formData.list_name) ? theme.primary.main : '#6b7280',
                  color: theme.background.secondary,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (selectedSwagger && formData.list_name) ? 'pointer' : 'not-allowed'
                }}
              >
                Add Class
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {showEditModal && editingClass && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: theme.background.secondary,
            border: '1px solid theme.background.quaternary',
            borderRadius: '8px',
            padding: '30px',
            width: '500px',
            maxWidth: '90%'
          }}>
            <h2 style={{ color: theme.text.primary, marginBottom: '20px' }}>
              Edit Setup Class: {editingClass.name}
            </h2>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', color: theme.text.secondary, marginBottom: '5px' }}>
                Class Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: theme.background.tertiary,
                  border: '1px solid theme.background.quaternary',
                  borderRadius: '4px',
                  color: theme.text.primary
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', color: theme.text.secondary, marginBottom: '5px' }}>
                Endpoint URL
              </label>
              <input
                type="text"
                value={formData.endpoint_url}
                onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: theme.background.tertiary,
                  border: '1px solid theme.background.quaternary',
                  borderRadius: '4px',
                  color: theme.text.primary
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', color: theme.text.secondary, marginBottom: '5px' }}>
                Key Field
              </label>
              <input
                type="text"
                value={formData.key_field}
                onChange={(e) => setFormData({ ...formData, key_field: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: theme.background.tertiary,
                  border: '1px solid theme.background.quaternary',
                  borderRadius: '4px',
                  color: theme.text.primary
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', color: theme.text.primary, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Active
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingClass(null);
                  setFormData({ name: '', endpoint_url: '', key_field: '', is_active: true });
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: theme.background.quaternary,
                  color: theme.text.primary,
                  border: '1px solid #4b5563',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditClass}
                style={{
                  padding: '10px 20px',
                  backgroundColor: theme.status.error,
                  color: theme.text.primary,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetupDataManagement;


