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
  progressMessage?: string;
}

const AnimatedDots: React.FC = () => {
  const [dotCount, setDotCount] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDotCount(prev => (prev % 3) + 1), 400);
    return () => clearInterval(id);
  }, []);
  return <>{'.'.repeat(dotCount)}</>;
};

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

  // View Records modal state
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewClassName, setViewClassName] = useState('');
  const [viewRecords, setViewRecords] = useState<any[]>([]);
  const [viewColumns, setViewColumns] = useState<string[]>([]);
  const [viewTotal, setViewTotal] = useState(0);
  const [viewPage, setViewPage] = useState(1);
  const [viewTotalPages, setViewTotalPages] = useState(1);
  const [viewSearch, setViewSearch] = useState('');
  const [viewLoading, setViewLoading] = useState(false);
  const [viewPageSize, setViewPageSize] = useState(50);
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

  // Debounced search for view modal
  useEffect(() => {
    if (!viewModalOpen) return;
    const timer = setTimeout(() => {
      fetchViewRecords(viewClassName, 1, viewSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [viewSearch]);

  const fetchViewRecords = async (businessClass: string, page: number, search: string, pageSize?: number) => {
    try {
      setViewLoading(true);
      const resp = await api.get(`/snapshot/records/${encodeURIComponent(businessClass)}`, {
        params: { page, page_size: pageSize ?? viewPageSize, search }
      });
      setViewRecords(resp.data.records);
      setViewColumns(resp.data.columns);
      setViewTotal(resp.data.total);
      setViewPage(resp.data.page);
      setViewTotalPages(resp.data.total_pages);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load records');
    } finally {
      setViewLoading(false);
    }
  };

  const openViewModal = (businessClass: string) => {
    setViewClassName(businessClass);
    setViewSearch('');
    setViewModalOpen(true);
    fetchViewRecords(businessClass, 1, '');
  };

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
      
      // Fire background sync — returns immediately
      await api.post('/snapshot/sync/all-background');
      
      // Start polling batch status
      startBatchPolling();
      
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 409) {
        // Already running — just start polling
        startBatchPolling();
      } else {
        setError(detail || 'Sync failed');
        setSyncing(false);
      }
    }
  };

  const batchPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const startBatchPolling = () => {
    // Clear any existing poll
    if (batchPollRef.current) clearInterval(batchPollRef.current);

    setSyncing(true);

    batchPollRef.current = setInterval(async () => {
      try {
        const resp = await api.get('/snapshot/sync/batch-status');
        const batch = resp.data;
        if (!batch || !batch.classes) return;

        const updated = new Map<string, ClassSyncStatus>();
        for (const [name, status] of Object.entries(batch.classes)) {
          const result = batch.results?.[name] as any;
          updated.set(name, {
            name,
            status: status as SyncStatus,
            recordCount: result?.record_count,
            error: result?.error
          });
        }
        setSyncStatuses(updated);

        // Refresh registry when any class completes
        await loadRegistry();

        // Stop polling when batch is done
        if (!batch.running) {
          if (batchPollRef.current) clearInterval(batchPollRef.current);
          batchPollRef.current = null;
          setSyncing(false);
        }
      } catch { /* ignore polling errors */ }
    }, 1000);
  };

  // On mount: check if a batch sync is already running (e.g., user navigated away and came back)
  useEffect(() => {
    const checkRunningBatch = async () => {
      try {
        const resp = await api.get('/snapshot/sync/batch-status');
        if (resp.data?.running) {
          startBatchPolling();
        }
      } catch { /* ignore */ }
    };
    checkRunningBatch();
    return () => {
      if (batchPollRef.current) clearInterval(batchPollRef.current);
    };
  }, []);

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
        {syncStatus.status === 'syncing' && syncStatus.progressMessage && (
          <span style={{ marginLeft: '5px' }}>{syncStatus.progressMessage}</span>
        )}
        {syncStatus.recordCount !== undefined && syncStatus.status === 'completed' && (
          <span style={{ marginLeft: '5px' }}>({syncStatus.recordCount.toLocaleString()} records)</span>
        )}
        {syncStatus.status === 'failed' && syncStatus.error && (
          <span style={{ marginLeft: '5px' }} title={syncStatus.error}>⚠</span>
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
      ? `soap/classes/${swaggerFile.name}/lists/${defaultList}?_fields=_all&_limit=10000&_links=false&_pageNav=true&_out=JSON&_flatten=false`
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
    const endpointUrl = `soap/classes/${formData.name}/lists/${listName}?_fields=_all&_limit=10000&_links=false&_pageNav=true&_out=JSON&_flatten=false`;
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
      setSyncStatuses(prev => {
        const updated = new Map(prev);
        updated.set(setupClass.name, { name: setupClass.name, status: 'syncing', progressMessage: 'Starting sync...' });
        return updated;
      });
      setError('');

      // Start polling progress
      const progressInterval = setInterval(async () => {
        try {
          const prog = await api.get(`/snapshot/sync/progress/${setupClass.name}`);
          if (prog.data && prog.data.phase) {
            const isDone = prog.data.done === true;
            const isError = prog.data.phase === 'error';
            setSyncStatuses(prev => {
              const updated = new Map(prev);
              updated.set(setupClass.name, {
                name: setupClass.name,
                status: isError ? 'failed' : (isDone ? 'completed' : 'syncing'),
                recordCount: prog.data.records_stored || prog.data.records_fetched || 0,
                progressMessage: isDone ? undefined : prog.data.message,
                error: isError ? prog.data.error : undefined
              });
              return updated;
            });
          }
        } catch { /* ignore polling errors */ }
      }, 1000);

      const response = await api.post('/snapshot/sync/single', {
        business_class_name: setupClass.name
      });

      clearInterval(progressInterval);

      // Update to completed
      const result = response.data.classes_synced?.[0];
      setSyncStatuses(prev => {
        const updated = new Map(prev);
        updated.set(setupClass.name, {
          name: setupClass.name,
          status: 'completed',
          recordCount: result?.record_count || 0,
          progressMessage: `Done — ${(result?.record_count || 0).toLocaleString()} records`
        });
        return updated;
      });

      await loadRegistry();

    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to sync ${setupClass.name}`);
      setSyncStatuses(prev => {
        const updated = new Map(prev);
        updated.set(setupClass.name, {
          name: setupClass.name,
          status: 'failed',
          error: err.response?.data?.detail || 'Sync failed',
          progressMessage: 'Failed'
        });
        return updated;
      });
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
          Sync All Active Classes
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
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
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
              <th style={{ padding: '12px', textAlign: 'center', color: theme.text.secondary, fontWeight: '500', width: '280px', minWidth: '280px' }}>
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
                    <td style={{ padding: '12px', textAlign: 'center', width: '280px', minWidth: '280px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                        {/* Primary Action: Sync */}
                        <button
                          onClick={() => handleSyncSingle(setupClass)}
                          disabled={!setupClass.is_active || isSyncing}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: (() => {
                              const syncStatus = syncStatuses.get(setupClass.name);
                              if (syncStatus?.status === 'failed') return '#dc2626';
                              if (syncStatus?.status === 'completed') return '#064e3b';
                              if (isSyncing) return '#6b7280';
                              if (!syncStatus && registryItem && registryItem.record_count > 0) return '#064e3b';
                              return theme.primary.main;
                            })(),
                            color: theme.background.secondary,
                            border: 'none',
                            borderRadius: '4px',
                            cursor: setupClass.is_active && !isSyncing ? 'pointer' : 'not-allowed',
                            fontSize: '12px',
                            opacity: setupClass.is_active ? 1 : 0.5,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            minWidth: '120px',
                            maxWidth: '220px',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' as const
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
                                  return <>Fetching<AnimatedDots /></>;
                                case 'completed':
                                  return `✓ ${(syncStatus.recordCount || 0).toLocaleString()}`;
                                case 'failed':
                                  return '⟳ Retry';
                                default:
                                  return 'Sync';
                              }
                            }
                            return isSyncing ? <>Fetching<AnimatedDots /></> : (
                              registryItem && registryItem.record_count > 0
                                ? `✓ ${registryItem.record_count.toLocaleString()}`
                                : 'Sync'
                            );
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
                            {/* View Records */}
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                openViewModal(setupClass.name);
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
                              👁 View Data
                            </button>

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

      {/* View Records Modal */}
      {viewModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: theme.background.primary,
            borderRadius: '12px',
            width: '95vw', maxWidth: '1400px', height: '90vh',
            display: 'flex', flexDirection: 'column',
            border: `1px solid ${theme.background.quaternary}`,
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: `1px solid ${theme.background.quaternary}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  padding: '4px 10px', borderRadius: '4px', fontSize: '12px',
                  backgroundColor: theme.primary.main, color: '#fff'
                }}>{viewClassName}</span>
                <span style={{ color: theme.text.secondary, fontSize: '14px' }}>
                  {viewTotal.toLocaleString()} records
                </span>
              </div>
              <button onClick={() => setViewModalOpen(false)} style={{
                background: 'none', border: 'none', color: theme.text.secondary,
                fontSize: '24px', cursor: 'pointer', padding: '4px 8px'
              }}>✕</button>
            </div>

            {/* Search bar */}
            <div style={{ padding: '12px 24px', borderBottom: `1px solid ${theme.background.quaternary}`, flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Search across all fields..."
                value={viewSearch}
                onChange={(e) => setViewSearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px',
                  backgroundColor: theme.background.secondary,
                  border: `1px solid ${theme.background.quaternary}`,
                  borderRadius: '6px', color: theme.text.primary,
                  fontSize: '14px', outline: 'none'
                }}
              />
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {viewLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: theme.text.secondary }}>
                  Loading...
                </div>
              ) : viewRecords.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: theme.text.secondary }}>
                  {viewSearch ? 'No records match your search' : 'No records synced yet'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: theme.background.tertiary, position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: theme.text.secondary, fontWeight: '500', fontSize: '11px', borderBottom: `1px solid ${theme.background.quaternary}` }}>#</th>
                      {viewColumns.map(col => (
                        <th key={col} style={{
                          padding: '8px 12px', textAlign: 'left', color: theme.text.secondary,
                          fontWeight: '500', fontSize: '11px', whiteSpace: 'nowrap',
                          borderBottom: `1px solid ${theme.background.quaternary}`
                        }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewRecords.map((record, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${theme.background.quaternary}` }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.background.tertiary}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '6px 12px', color: theme.text.secondary, fontSize: '12px' }}>
                          {(viewPage - 1) * viewPageSize + idx + 1}
                        </td>
                        {viewColumns.map(col => (
                          <td key={col} style={{
                            padding: '6px 12px', color: theme.text.primary,
                            maxWidth: '250px', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }} title={String(record[col] ?? '')}>
                            {String(record[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            <div style={{
              padding: '12px 24px',
              borderTop: `1px solid ${theme.background.quaternary}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0, fontSize: '13px'
            }}>
              <span style={{ color: theme.text.secondary }}>
                Page {viewPage} of {viewTotalPages} ({viewTotal.toLocaleString()} records, {viewColumns.length} columns)
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={viewPageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    setViewPageSize(newSize);
                    setViewPage(1);
                    fetchViewRecords(viewClassName, 1, viewSearch, newSize);
                  }}
                  style={{
                    padding: '6px 8px', borderRadius: '4px',
                    border: `1px solid ${theme.background.quaternary}`,
                    backgroundColor: theme.background.secondary,
                    color: theme.text.primary, fontSize: '12px', cursor: 'pointer'
                  }}
                >
                  {[25, 50, 100, 200, 500].map(n => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
                <button
                  disabled={viewPage <= 1}
                  onClick={() => { setViewPage(1); fetchViewRecords(viewClassName, 1, viewSearch); }}
                  style={{
                    padding: '6px 12px', borderRadius: '4px', border: `1px solid ${theme.background.quaternary}`,
                    backgroundColor: theme.background.secondary, color: viewPage <= 1 ? theme.text.secondary : theme.text.primary,
                    cursor: viewPage <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: viewPage <= 1 ? 0.5 : 1
                  }}
                >First</button>
                <button
                  disabled={viewPage <= 1}
                  onClick={() => { const p = viewPage - 1; setViewPage(p); fetchViewRecords(viewClassName, p, viewSearch); }}
                  style={{
                    padding: '6px 12px', borderRadius: '4px', border: `1px solid ${theme.background.quaternary}`,
                    backgroundColor: theme.background.secondary, color: viewPage <= 1 ? theme.text.secondary : theme.text.primary,
                    cursor: viewPage <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: viewPage <= 1 ? 0.5 : 1
                  }}
                >Previous</button>
                <button
                  disabled={viewPage >= viewTotalPages}
                  onClick={() => { const p = viewPage + 1; setViewPage(p); fetchViewRecords(viewClassName, p, viewSearch); }}
                  style={{
                    padding: '6px 12px', borderRadius: '4px', border: `1px solid ${theme.background.quaternary}`,
                    backgroundColor: theme.background.secondary, color: viewPage >= viewTotalPages ? theme.text.secondary : theme.text.primary,
                    cursor: viewPage >= viewTotalPages ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: viewPage >= viewTotalPages ? 0.5 : 1
                  }}
                >Next</button>
                <button
                  disabled={viewPage >= viewTotalPages}
                  onClick={() => { setViewPage(viewTotalPages); fetchViewRecords(viewClassName, viewTotalPages, viewSearch); }}
                  style={{
                    padding: '6px 12px', borderRadius: '4px', border: `1px solid ${theme.background.quaternary}`,
                    backgroundColor: theme.background.secondary, color: viewPage >= viewTotalPages ? theme.text.secondary : theme.text.primary,
                    cursor: viewPage >= viewTotalPages ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: viewPage >= viewTotalPages ? 0.5 : 1
                  }}
                >Last</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetupDataManagement;


