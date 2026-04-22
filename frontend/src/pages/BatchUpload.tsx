import React, { useState, useEffect, useRef, useCallback } from 'react';
import { theme } from '../theme';
import api from '../services/api';

// ── AnimatedDots ────────────────────────────────────────────────────────────
const AnimatedDots: React.FC = () => {
  const [dotCount, setDotCount] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDotCount(prev => (prev % 3) + 1), 400);
    return () => clearInterval(id);
  }, []);
  return <>{'.'.repeat(dotCount)}</>;
};

// ── Types ───────────────────────────────────────────────────────────────────
type FileStatus = 'queued' | 'uploading' | 'mapping' | 'validating' | 'done' | 'error' | 'loading' | 'loaded';

interface FileInfo {
  status: FileStatus;
  job_id?: number;
  records?: number;
  valid?: number;
  invalid?: number;
  errors?: number;
  error_message?: string | null;
  load_result?: { success: number; failed: number; run_group?: string } | null;
  mapping?: Record<string, any>;
  interfacing?: boolean;
  interfaced?: boolean;
  interface_message?: string | null;
}

interface BatchStatusResponse {
  batch_id: string;
  running: boolean;
  files: Record<string, FileInfo>;
  completed: number;
  total: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const statusLabel = (s: FileStatus): string =>
  ({ queued: 'Queued', uploading: 'Uploading', mapping: 'Mapping', validating: 'Validating', done: 'Validated', error: 'Error', loading: 'Loading', loaded: 'Loaded' }[s]);

const isActive = (s: FileStatus): boolean =>
  s === 'uploading' || s === 'mapping' || s === 'validating' || s === 'loading';

// ── Main Component ──────────────────────────────────────────────────────────
const BatchUpload: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [fileStatuses, setFileStatuses] = useState<Record<string, FileInfo>>({});
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [businessClass, setBusinessClass] = useState('GLTransactionInterface');
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [bcDropdownOpen, setBcDropdownOpen] = useState(false);
  const [ruleSets, setRuleSets] = useState<{id: number; name: string; is_common: boolean; is_user_default: boolean; rule_count: number}[]>([]);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<number | null>(null);
  const [dateTransformEnabled, setDateTransformEnabled] = useState(false);
  const [dateSourceFormat, setDateSourceFormat] = useState('MM/DD/YYYY');
  const [loadChunkSize, setLoadChunkSize] = useState(1000);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cardVisible, setCardVisible] = useState<Record<string, boolean>>({});

  // Error modal state
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorModalFilename, setErrorModalFilename] = useState('');
  const [errorModalJobId, setErrorModalJobId] = useState<number | null>(null);
  const [errorModalData, setErrorModalData] = useState<any[]>([]);
  const [errorModalLoading, setErrorModalLoading] = useState(false);
  const [errorModalPage, setErrorModalPage] = useState(1);
  const [errorModalTotal, setErrorModalTotal] = useState(0);
  const [errorModalTotalPages, setErrorModalTotalPages] = useState(1);
  const errorModalPageSize = 50;

  // ── Cleanup polling on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ── Load available business classes on mount ────────────────────────────
  useEffect(() => {
    api.get('/schema/available-business-classes')
      .then(res => setAvailableClasses(res.data.business_classes || []))
      .catch(() => {});
  }, []);

  // ── Load rule sets when business class changes ─────────────────────────
  useEffect(() => {
    if (!businessClass.trim()) { setRuleSets([]); setSelectedRuleSetId(null); return; }
    api.get('/rules/rule-sets', { params: { business_class: businessClass } })
      .then(res => {
        const sets = res.data || [];
        setRuleSets(sets);
        // Auto-select: user default > common > first
        const userDefault = sets.find((s: any) => s.is_user_default);
        const common = sets.find((s: any) => s.is_common);
        setSelectedRuleSetId(userDefault?.id || common?.id || sets[0]?.id || null);
      })
      .catch(() => { setRuleSets([]); setSelectedRuleSetId(null); });
  }, [businessClass]);

  // ── Fade-in cards when new files appear ─────────────────────────────────
  useEffect(() => {
    const names = selectedFiles.map(f => f.name);
    const newVisible: Record<string, boolean> = {};
    names.forEach(n => { newVisible[n] = true; });
    // Stagger: mark visible after a tiny delay per card
    names.forEach((n, i) => {
      if (!cardVisible[n]) {
        setTimeout(() => setCardVisible(prev => ({ ...prev, [n]: true })), i * 80);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles]);

  // ── File selection ──────────────────────────────────────────────────────
  const addFiles = useCallback((files: FileList | File[]) => {
    const csvFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.csv'));
    if (csvFiles.length === 0) return;
    setSelectedFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      const newFiles = csvFiles.filter(f => !existing.has(f.name));
      return [...prev, ...newFiles];
    });
  }, []);

  const removeFile = (name: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== name));
    setCardVisible(prev => { const n = { ...prev }; delete n[name]; return n; });
  };

  // ── Drag & drop handlers ───────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = () => setIsDragOver(false);
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files); };

  // ── Start batch ─────────────────────────────────────────────────────────
  const startBatch = async () => {
    if (selectedFiles.length === 0) return;
    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('files', f));
    formData.append('business_class', businessClass);
    if (selectedRuleSetId) formData.append('rule_set_id', String(selectedRuleSetId));
    if (dateTransformEnabled) formData.append('date_source_format', dateSourceFormat);

    // Initialise all as queued
    const initial: Record<string, FileInfo> = {};
    selectedFiles.forEach(f => { initial[f.name] = { status: 'queued' }; });
    setFileStatuses(initial);
    setTotal(selectedFiles.length);
    setCompleted(0);
    setRunning(true);
    setShowSummary(false);

    try {
      const res = await api.post('/upload/batch', formData);
      const id: string = res.data.batch_id;
      setBatchId(id);
      startPolling(id);
    } catch (err: any) {
      setRunning(false);
      console.error('Batch upload failed', err);
    }
  };

  // ── Polling ─────────────────────────────────────────────────────────────
  const startPolling = (id: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get<BatchStatusResponse>('/upload/batch-status', { params: { batch_id: id } });
        const data = res.data;
        setFileStatuses(data.files);
        setCompleted(data.completed);
        setTotal(data.total);
        if (!data.running) {
          setRunning(false);
          setShowSummary(true);
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        }
      } catch {
        // keep polling
      }
    }, 1500);
  };

  // ── Cancel ──────────────────────────────────────────────────────────────
  const cancelBatch = async () => {
    if (batchId) {
      try { await api.post('/upload/batch-cancel', { batch_id: batchId }); } catch { /* best effort */ }
    }
    setRunning(false);
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  // ── Reset ───────────────────────────────────────────────────────────────
  const resetBatch = () => {
    setSelectedFiles([]);
    setBatchId(null);
    setFileStatuses({});
    setCompleted(0);
    setTotal(0);
    setRunning(false);
    setShowSummary(false);
    setCardVisible({});
  };

  // ── Load a single file to FSM ─────────────────────────────────────────
  const loadFileToFSM = async (filename: string) => {
    const info = fileStatuses[filename];
    if (!info?.job_id || info.status !== 'done') return;

    setFileStatuses(prev => ({
      ...prev,
      [filename]: { ...prev[filename], status: 'loading' }
    }));

    try {
      // Get mapping from batch status (stored during batch processing)
      const mapping = info.mapping || {};
      
      const resp = await api.post('/load/start', {
        job_id: info.job_id,
        business_class: businessClass,
        mapping: mapping,
        chunk_size: loadChunkSize,
        date_source_format: dateTransformEnabled ? dateSourceFormat : undefined
      });
      const result = resp.data;
      setFileStatuses(prev => ({
        ...prev,
        [filename]: {
          ...prev[filename],
          status: 'loaded',
          load_result: {
            success: result.success_count || result.total_success || 0,
            failed: result.failure_count || result.total_failure || 0,
            run_group: result.run_group
          }
        }
      }));
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ') : err.message);
      setFileStatuses(prev => ({
        ...prev,
        [filename]: {
          ...prev[filename],
          status: 'done',
          error_message: `Load failed: ${msg}`
        }
      }));
    }
  };

  // ── Load all validated files ──────────────────────────────────────────
  const loadAllToFSM = async () => {
    const loadable = Object.entries(fileStatuses)
      .filter(([_, info]) => info.status === 'done' && (info.valid || 0) > 0 && (info.errors || 0) === 0);

    for (const [filename] of loadable) {
      await loadFileToFSM(filename);
    }
  };

  // ── Interface transactions for a loaded file ───────────────────────────
  const interfaceFile = async (filename: string) => {
    const info = fileStatuses[filename];
    if (!info?.load_result?.run_group || !info?.job_id) return;

    setFileStatuses(prev => ({
      ...prev,
      [filename]: { ...prev[filename], interfacing: true }
    }));

    try {
      const resp = await api.post('/load/interface', {
        job_id: info.job_id,
        business_class: businessClass,
        run_group: info.load_result.run_group,
        journalize_by_entity: true,
        bypass_organization_code: true,
        bypass_account_code: true,
        interface_in_detail: true
      });
      setFileStatuses(prev => ({
        ...prev,
        [filename]: {
          ...prev[filename],
          interfacing: false,
          interfaced: true,
          interface_message: resp.data?.message || 'Interface completed'
        }
      }));
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : err.message;
      setFileStatuses(prev => ({
        ...prev,
        [filename]: { ...prev[filename], interfacing: false, interface_message: `Failed: ${msg}` }
      }));
    }
  };

  // ── Delete RunGroup for a loaded file ─────────────────────────────────
  const deleteRunGroup = async (filename: string) => {
    const info = fileStatuses[filename];
    if (!info?.load_result?.run_group || !info?.job_id) return;

    const rg = info.load_result.run_group;
    if (!confirm(`⚠️ Delete ALL transactions for RunGroup "${rg}"?\n\nThis cannot be undone.`)) return;

    try {
      await api.post('/load/delete-rungroup', {
        job_id: info.job_id,
        business_class: businessClass,
        run_group: rg
      });
      setFileStatuses(prev => ({
        ...prev,
        [filename]: {
          ...prev[filename],
          status: 'done',
          load_result: null,
          error_message: null,
          interfaced: false,
          interface_message: null
        }
      }));
      alert(`RunGroup "${rg}" deleted successfully.`);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : err.message;
      alert(`Delete failed: ${msg}`);
    }
  };

  // ── Error modal ────────────────────────────────────────────────────────
  const openErrorModal = (filename: string, jobId: number) => {
    setErrorModalFilename(filename);
    setErrorModalJobId(jobId);
    setErrorModalOpen(true);
    setErrorModalPage(1);
    fetchErrors(jobId, 1);
  };

  const fetchErrors = async (jobId: number, page: number) => {
    setErrorModalLoading(true);
    try {
      const resp = await api.get(`/validation/${jobId}/errors`, {
        params: { limit: errorModalPageSize, offset: (page - 1) * errorModalPageSize }
      });
      const errors = resp.data;
      setErrorModalData(errors);

      // Get total from validation summary
      const summary = await api.get(`/validation/${jobId}/summary`);
      const totalErrors = summary.data?.error_count || summary.data?.invalid_records || errors.length;
      setErrorModalTotal(totalErrors);
      setErrorModalTotalPages(Math.max(1, Math.ceil(totalErrors / errorModalPageSize)));
    } catch {
      setErrorModalData([]);
    } finally {
      setErrorModalLoading(false);
    }
  };

  // ── Summary totals ─────────────────────────────────────────────────────
  const summaryTotals = Object.values(fileStatuses).reduce(
    (acc, f) => ({
      records: acc.records + (f.records || 0),
      valid: acc.valid + (f.valid || 0),
      errors: acc.errors + (f.errors || 0),
    }),
    { records: 0, valid: 0, errors: 0 }
  );

  const hasStarted = batchId !== null;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>📦 Batch Upload</h1>
        <p style={styles.subtitle}>Upload multiple CSV files for sequential processing</p>
      </div>

      {/* Overall progress bar (visible once started) */}
      {hasStarted && (
        <div style={styles.progressSection}>
          <div style={styles.progressHeader}>
            <span style={styles.progressLabel}>
              {running ? 'Processing' : 'Complete'}: {completed} of {total} files
            </span>
            <span style={styles.progressPct}>{progressPct}%</span>
          </div>
          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${progressPct}%`,
                backgroundColor: progressPct === 100 ? theme.status.success : theme.primary.main,
              }}
            />
          </div>
        </div>
      )}

      {/* Drop zone (only when no files selected) */}
      {!hasStarted && selectedFiles.length === 0 && (
        <div
          style={{
            ...styles.dropZone,
            borderColor: isDragOver ? theme.primary.main : theme.background.quaternary,
            backgroundColor: isDragOver ? theme.accent.purpleTintLight : theme.background.secondary,
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            multiple
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          />
          <div style={styles.dropIcon}>📁</div>
          <p style={styles.dropText}>
            Drag & drop CSV files here, or click to browse
          </p>
          <p style={styles.dropHint}>Only .csv files accepted</p>
        </div>
      )}

      {/* Mini setup (when files are selected, before starting) */}
      {!hasStarted && selectedFiles.length > 0 && (
        <div style={{
          padding: '20px 24px',
          backgroundColor: theme.background.secondary,
          borderRadius: 10,
          border: `1px solid ${theme.background.quaternary}`,
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: theme.text.primary }}>⚙️ Batch Configuration</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '6px 14px',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.background.quaternary}`,
                borderRadius: 6,
                color: theme.text.secondary,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              + Add More Files
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {/* Business Class */}
            <div style={{ position: 'relative' as const, zIndex: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: theme.text.muted, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                Business Class
              </label>
              <div style={{ position: 'relative' as const }}>
                <input
                  type="text"
                  value={businessClass}
                  onChange={e => setBusinessClass(e.target.value)}
                  onFocus={() => setBcDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setBcDropdownOpen(false), 200)}
                  placeholder="Type to search..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: theme.background.primary,
                    border: `1px solid ${theme.background.quaternary}`,
                    borderRadius: 6,
                    color: theme.text.primary,
                    fontSize: 14,
                    fontWeight: 500,
                    boxSizing: 'border-box' as const
                  }}
                />
                {bcDropdownOpen && availableClasses.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    maxHeight: 200, overflowY: 'auto',
                    backgroundColor: theme.background.secondary,
                    border: `1px solid ${theme.background.quaternary}`,
                    borderRadius: 6, zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    {availableClasses
                      .filter(bc => bc.toLowerCase().includes(businessClass.toLowerCase()))
                      .map(bc => (
                        <div
                          key={bc}
                          onMouseDown={e => {
                            e.preventDefault();
                            setBusinessClass(bc);
                            setBcDropdownOpen(false);
                          }}
                          style={{
                            padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                            color: theme.text.primary,
                            borderBottom: `1px solid ${theme.background.tertiary}`,
                            backgroundColor: bc === businessClass ? theme.accent.purpleTintLight : 'transparent'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.background.tertiary}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = bc === businessClass ? theme.accent.purpleTintLight : 'transparent'}
                        >
                          {bc}
                        </div>
                      ))}
                    {availableClasses.filter(bc => bc.toLowerCase().includes(businessClass.toLowerCase())).length === 0 && (
                      <div style={{ padding: '8px 14px', fontSize: 12, color: theme.text.muted, textAlign: 'center' as const }}>
                        No matching schemas
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Rule Set */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: theme.text.muted, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                Rule Set
              </label>
              <select
                value={selectedRuleSetId || ''}
                onChange={e => setSelectedRuleSetId(Number(e.target.value) || null)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: theme.background.primary,
                  border: `1px solid ${theme.background.quaternary}`,
                  borderRadius: 6,
                  color: theme.text.primary,
                  fontSize: 14,
                  boxSizing: 'border-box' as const
                }}
              >
                {ruleSets.length === 0 && <option value="">No rule sets available</option>}
                {ruleSets.map(rs => (
                  <option key={rs.id} value={rs.id}>
                    {rs.name} ({rs.rule_count} rules){rs.is_user_default ? ' ★ Default' : ''}
                  </option>
                ))}
              </select>
            </div>
            {/* Load Chunk Size */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: theme.text.muted, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                Load Chunk Size
              </label>
              <select
                value={loadChunkSize}
                onChange={e => setLoadChunkSize(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: theme.background.primary,
                  border: `1px solid ${theme.background.quaternary}`,
                  borderRadius: 6,
                  color: theme.text.primary,
                  fontSize: 14,
                  boxSizing: 'border-box' as const
                }}
              >
                <option value={100}>100 records/batch</option>
                <option value={250}>250 records/batch</option>
                <option value={500}>500 records/batch</option>
                <option value={1000}>1,000 records/batch</option>
                <option value={2000}>2,000 records/batch</option>
              </select>
            </div>
          </div>

          {/* Data Cleaning: Date Format Transform */}
          <div style={{
            marginTop: 16,
            padding: '16px 20px',
            backgroundColor: dateTransformEnabled ? '#fefce8' : theme.background.primary,
            borderRadius: 8,
            border: `1px solid ${dateTransformEnabled ? '#facc15' : theme.background.quaternary}`,
            transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: dateTransformEnabled ? 14 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>🔄</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: theme.text.primary }}>Date Format Conversion</div>
                  <div style={{ fontSize: 11, color: theme.text.muted }}>Convert date fields from source format to FSM format (YYYYMMDD)</div>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <div
                  onClick={() => setDateTransformEnabled(!dateTransformEnabled)}
                  style={{
                    width: 44, height: 24, borderRadius: 12,
                    backgroundColor: dateTransformEnabled ? theme.primary.main : '#d1d5db',
                    position: 'relative' as const, cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: '#fff',
                    position: 'absolute' as const, top: 2,
                    left: dateTransformEnabled ? 22 : 2,
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </label>
            </div>

            {dateTransformEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.text.muted, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                    Source Format
                  </label>
                  <select
                    value={dateSourceFormat}
                    onChange={e => setDateSourceFormat(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px',
                      backgroundColor: theme.background.secondary,
                      border: `1px solid ${theme.background.quaternary}`,
                      borderRadius: 6, color: theme.text.primary, fontSize: 13,
                      boxSizing: 'border-box' as const
                    }}
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 01/25/2025)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 25/01/2025)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2025-01-25)</option>
                    <option value="MM-DD-YYYY">MM-DD-YYYY (e.g. 01-25-2025)</option>
                    <option value="DD-MM-YYYY">DD-MM-YYYY (e.g. 25-01-2025)</option>
                    <option value="M/D/YYYY">M/D/YYYY (e.g. 1/5/2025)</option>
                  </select>
                </div>
                <div style={{ fontSize: 20, color: theme.text.muted, paddingTop: 18 }}>→</div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.text.muted, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                    Target Format (FSM)
                  </label>
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: 6, fontSize: 13, fontWeight: 600,
                    color: '#166534'
                  }}>
                    YYYYMMDD (e.g. 20250125)
                  </div>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            multiple
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div style={styles.actions}>
        {!hasStarted && selectedFiles.length > 0 && (
          <button
            style={{
              ...styles.btnPrimary,
              opacity: businessClass.trim() ? 1 : 0.5,
              cursor: businessClass.trim() ? 'pointer' : 'not-allowed'
            }}
            onClick={startBatch}
            disabled={!businessClass.trim()}
          >
            🚀 Start Batch ({selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''})
          </button>
        )}
        {running && (
          <button style={styles.btnCancel} onClick={cancelBatch}>
            ✕ Cancel
          </button>
        )}
        {hasStarted && !running && (
          <>
            {Object.values(fileStatuses).some(f => f.status === 'done' && (f.valid || 0) > 0) && (
              <button style={{ ...styles.btnPrimary, backgroundColor: theme.status.success }} onClick={() => {
                const loadable = Object.entries(fileStatuses).filter(([_, f]) => f.status === 'done' && (f.valid || 0) > 0 && (f.errors || 0) === 0);
                const excluded = Object.entries(fileStatuses).filter(([_, f]) => f.status === 'done' && (f.errors || 0) > 0);
                const errorFiles = Object.entries(fileStatuses).filter(([_, f]) => f.status === 'error');

                let msg = `📤 Files to be loaded (${loadable.length}):\n`;
                loadable.forEach(([name, f]) => { msg += `  ✓ ${name} — ${(f.valid || 0).toLocaleString()} records\n`; });

                if (excluded.length > 0 || errorFiles.length > 0) {
                  msg += `\n🚫 Excluded (${excluded.length + errorFiles.length}):\n`;
                  excluded.forEach(([name, f]) => { msg += `  ✕ ${name} — ${(f.errors || 0).toLocaleString()} errors\n`; });
                  errorFiles.forEach(([name]) => { msg += `  ✕ ${name} — processing error\n`; });
                }

                msg += `\nProceed with loading ${loadable.length} file(s) to FSM?`;
                if (confirm(msg)) {
                  loadAllToFSM();
                }
              }}>
                ⬆️ Load All Files w/o Errors
              </button>
            )}
            <button style={styles.btnPrimary} onClick={resetBatch}>
              ↻ New Batch
            </button>
          </>
        )}
      </div>

      {/* Summary (above file cards) */}
      {showSummary && (
        <div style={{ ...styles.summary, marginBottom: 24 }}>
          <h3 style={styles.summaryTitle}>Batch Complete</h3>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryValue}>{summaryTotals.records.toLocaleString()}</span>
              <span style={styles.summaryLabel}>Total Records</span>
            </div>
            <div style={{ ...styles.summaryCard, borderColor: theme.status.success }}>
              <span style={{ ...styles.summaryValue, color: theme.status.success }}>
                {summaryTotals.valid.toLocaleString()}
              </span>
              <span style={styles.summaryLabel}>Valid</span>
            </div>
            <div style={{ ...styles.summaryCard, borderColor: theme.status.error }}>
              <span style={{ ...styles.summaryValue, color: theme.status.error }}>
                {summaryTotals.errors.toLocaleString()}
              </span>
              <span style={styles.summaryLabel}>Errors</span>
            </div>
          </div>
        </div>
      )}

      {/* File cards grid */}
      {selectedFiles.length > 0 && (
        <div style={styles.grid}>
          {selectedFiles.map(file => {
            const info = fileStatuses[file.name];
            const status: FileStatus = info?.status || 'queued';
            const visible = cardVisible[file.name];
            return (
              <div
                key={file.name}
                style={{
                  ...styles.card,
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(12px)',
                  borderColor:
                    status === 'done' ? theme.status.success
                    : status === 'loaded' ? '#2563eb'
                    : status === 'error' ? theme.status.error
                    : isActive(status) ? theme.primary.main
                    : theme.background.quaternary,
                  backgroundColor:
                    status === 'queued' ? '#F9F9FC' : theme.background.secondary,
                }}
              >
                {/* Remove button (only before start) */}
                {!hasStarted && (
                  <button
                    style={styles.removeBtn}
                    onClick={() => removeFile(file.name)}
                    title="Remove file"
                  >
                    ✕
                  </button>
                )}

                {/* Filename & size */}
                <div style={styles.cardHeader}>
                  <span style={styles.fileName}>{file.name}</span>
                  <span style={styles.fileSize}>{formatSize(file.size)}</span>
                </div>

                {/* Status badge */}
                <div style={styles.badgeRow}>
                  <span
                    style={{
                      ...styles.badge,
                      backgroundColor:
                        status === 'done' ? theme.status.success
                        : status === 'loaded' ? '#2563eb'
                        : status === 'error' ? theme.status.error
                        : isActive(status) ? theme.primary.main
                        : theme.interactive.disabled,
                      color: '#fff',
                    }}
                  >
                    {status === 'done' && '✓ '}
                    {status === 'loaded' && '⬆ '}
                    {status === 'error' && '✕ '}
                    {statusLabel(status)}
                    {isActive(status) && <AnimatedDots />}
                  </span>
                </div>

                {/* Stats row */}
                {info && (info.records !== undefined || info.valid !== undefined || info.errors !== undefined) && (
                  <div style={styles.statsRow}>
                    {info.records !== undefined && (
                      <span style={styles.stat}>
                        📄 {info.records.toLocaleString()} records
                      </span>
                    )}
                    {info.valid !== undefined && info.valid > 0 && (
                      <span style={{ ...styles.stat, color: theme.status.success, fontWeight: 600 }}>
                        ✓ {info.valid.toLocaleString()} valid
                      </span>
                    )}
                    {info.errors !== undefined && info.errors > 0 && (
                      <span style={{ ...styles.stat, color: theme.status.error, fontWeight: 600 }}>
                        ✕ {info.errors.toLocaleString()} errors
                      </span>
                    )}
                  </div>
                )}

                {/* Error message */}
                {info?.error_message && (
                  <p style={styles.errorMsg}>{info.error_message}</p>
                )}

                {/* Load to FSM button (only for validated files with valid records) */}
                {status === 'done' && (info?.valid || 0) > 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`Load ${info!.valid!.toLocaleString()} valid records from "${file.name}" to FSM?`)) {
                        loadFileToFSM(file.name);
                      }
                    }}
                    style={styles.loadBtn}
                  >
                    ⬆️ Load to FSM
                  </button>
                )}

                {/* Loading indicator */}
                {status === 'loading' && (
                  <div style={{ marginTop: 10, fontSize: 13, color: theme.primary.main, fontWeight: 600 }}>
                    Loading to FSM<AnimatedDots />
                  </div>
                )}

                {/* Load result */}
                {status === 'loaded' && info?.load_result && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', borderRadius: 6,
                    backgroundColor: info.load_result.failed === 0 ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${info.load_result.failed === 0 ? theme.status.success : theme.status.error}`,
                    fontSize: 12
                  }}>
                    <div style={{ fontWeight: 600, color: info.load_result.failed === 0 ? theme.status.success : theme.text.primary }}>
                      {info.load_result.failed === 0 ? '✓ Loaded successfully' : '⚠ Loaded with issues'}
                    </div>
                    <div style={{ color: theme.text.secondary, marginTop: 2 }}>
                      {info.load_result.success.toLocaleString()} loaded
                      {info.load_result.failed > 0 && `, ${info.load_result.failed.toLocaleString()} failed`}
                    </div>
                    {info.load_result.run_group && (
                      <div style={{ color: theme.text.muted, marginTop: 2, fontFamily: 'monospace', fontSize: 11 }}>
                        RunGroup: {info.load_result.run_group}
                      </div>
                    )}
                  </div>
                )}

                {/* Post-load actions: Interface + Delete RunGroup */}
                {status === 'loaded' && info?.load_result?.run_group && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    {/* Interface button */}
                    {!info.interfaced && (
                      <button
                        onClick={() => interfaceFile(file.name)}
                        disabled={!!info.interfacing}
                        style={{
                          flex: 1, padding: '6px 10px',
                          backgroundColor: info.interfacing ? '#6b7280' : '#FF9800',
                          color: '#fff', border: 'none', borderRadius: 5,
                          fontSize: 11, fontWeight: 600, cursor: info.interfacing ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {info.interfacing ? <>Interface<AnimatedDots /></> : '⚡ Interface'}
                      </button>
                    )}
                    {/* Interface result */}
                    {info.interfaced && info.interface_message && (
                      <div style={{
                        flex: 1, padding: '5px 8px', borderRadius: 5, fontSize: 11,
                        backgroundColor: info.interface_message.startsWith('Failed') ? '#fef2f2' : '#f0fdf4',
                        color: info.interface_message.startsWith('Failed') ? theme.status.error : theme.status.success,
                        fontWeight: 500
                      }}>
                        {info.interface_message.startsWith('Failed') ? '✕ ' : '✓ '}{info.interface_message}
                      </div>
                    )}
                    {/* Delete RunGroup button */}
                    <button
                      onClick={() => deleteRunGroup(file.name)}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.status.error}`,
                        borderRadius: 5, fontSize: 11, color: theme.status.error,
                        cursor: 'pointer', whiteSpace: 'nowrap' as const
                      }}
                    >
                      🗑 Delete
                    </button>
                  </div>
                )}

                {/* No valid records message */}
                {status === 'done' && (info?.valid || 0) === 0 && (
                  <p style={{ ...styles.errorMsg, color: theme.status.warning }}>
                    No valid records to load
                  </p>
                )}

                {/* View Errors button */}
                {(status === 'done' || status === 'loaded') && (info?.errors || 0) > 0 && info?.job_id && (
                  <button
                    onClick={() => openErrorModal(file.name, info.job_id!)}
                    style={{
                      marginTop: 8, padding: '6px 12px',
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.status.error}`,
                      borderRadius: 6, fontSize: 12, color: theme.status.error,
                      cursor: 'pointer', width: '100%'
                    }}
                  >
                    🔍 View Errors ({(info.errors || 0).toLocaleString()})
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}

      {/* Error Details Modal */}
      {errorModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: theme.background.primary,
            borderRadius: 12, width: '90vw', maxWidth: 1100, height: '80vh',
            display: 'flex', flexDirection: 'column',
            border: `1px solid ${theme.background.quaternary}`, overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 24px', borderBottom: `1px solid ${theme.background.quaternary}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: theme.status.error }}>
                  Validation Errors
                </span>
                <span style={{
                  padding: '3px 10px', borderRadius: 4, fontSize: 12,
                  backgroundColor: theme.primary.main, color: '#fff'
                }}>{errorModalFilename}</span>
                <span style={{ color: theme.text.secondary, fontSize: 13 }}>
                  {errorModalTotal.toLocaleString()} errors
                </span>
              </div>
              <button onClick={() => setErrorModalOpen(false)} style={{
                background: 'none', border: 'none', color: theme.text.secondary,
                fontSize: 22, cursor: 'pointer', padding: '2px 8px'
              }}>✕</button>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {errorModalLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: theme.text.secondary }}>
                  Loading<AnimatedDots />
                </div>
              ) : errorModalData.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: theme.text.secondary }}>
                  No errors found
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: theme.background.tertiary, position: 'sticky', top: 0, zIndex: 1 }}>
                      {['Row', 'Field', 'Value', 'Error Type', 'Error Message'].map(col => (
                        <th key={col} style={{
                          padding: '8px 12px', textAlign: 'left', color: theme.text.secondary,
                          fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap',
                          borderBottom: `1px solid ${theme.background.quaternary}`
                        }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {errorModalData.map((err: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${theme.background.quaternary}` }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.background.tertiary}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '6px 12px', color: theme.text.secondary, fontFamily: 'monospace', fontSize: 12 }}>
                          {err.row_number}
                        </td>
                        <td style={{ padding: '6px 12px', color: theme.primary.main, fontWeight: 500 }}>
                          {err.field_name}
                        </td>
                        <td style={{ padding: '6px 12px', color: theme.text.primary, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={err.invalid_value || ''}>
                          {err.invalid_value || '(empty)'}
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 11,
                            backgroundColor: theme.status.error, color: '#fff'
                          }}>{err.error_type}</span>
                        </td>
                        <td style={{ padding: '6px 12px', color: theme.text.secondary, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={err.error_message || ''}>
                          {err.error_message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            <div style={{
              padding: '10px 24px', borderTop: `1px solid ${theme.background.quaternary}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, fontSize: 13
            }}>
              <span style={{ color: theme.text.secondary }}>
                Page {errorModalPage} of {errorModalTotalPages}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={errorModalPage <= 1}
                  onClick={() => { setErrorModalPage(p => p - 1); fetchErrors(errorModalJobId!, errorModalPage - 1); }}
                  style={{
                    padding: '5px 12px', borderRadius: 4, border: `1px solid ${theme.background.quaternary}`,
                    backgroundColor: theme.background.secondary, color: errorModalPage <= 1 ? theme.text.muted : theme.text.primary,
                    cursor: errorModalPage <= 1 ? 'not-allowed' : 'pointer', fontSize: 12, opacity: errorModalPage <= 1 ? 0.5 : 1
                  }}>Previous</button>
                <button disabled={errorModalPage >= errorModalTotalPages}
                  onClick={() => { setErrorModalPage(p => p + 1); fetchErrors(errorModalJobId!, errorModalPage + 1); }}
                  style={{
                    padding: '5px 12px', borderRadius: 4, border: `1px solid ${theme.background.quaternary}`,
                    backgroundColor: theme.background.secondary, color: errorModalPage >= errorModalTotalPages ? theme.text.muted : theme.text.primary,
                    cursor: errorModalPage >= errorModalTotalPages ? 'not-allowed' : 'pointer', fontSize: 12, opacity: errorModalPage >= errorModalTotalPages ? 0.5 : 1
                  }}>Next</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '32px 40px',
    backgroundColor: theme.background.primary,
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: { marginBottom: 24 },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: theme.text.primary,
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: theme.text.tertiary,
    marginTop: 4,
  },

  /* Progress bar */
  progressSection: {
    marginBottom: 24,
    padding: '16px 20px',
    backgroundColor: theme.background.secondary,
    borderRadius: 10,
    border: `1px solid ${theme.background.quaternary}`,
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: { fontSize: 14, fontWeight: 600, color: theme.text.primary },
  progressPct: { fontSize: 14, fontWeight: 600, color: theme.primary.main },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.background.tertiary,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.4s ease, background-color 0.4s ease',
  },

  /* Drop zone */
  dropZone: {
    border: '2px dashed',
    borderRadius: 12,
    padding: '48px 24px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'border-color 0.2s ease, background-color 0.2s ease',
    marginBottom: 20,
  },
  dropIcon: { fontSize: 40, marginBottom: 8 },
  dropText: { fontSize: 15, color: theme.text.secondary, margin: '0 0 4px' },
  dropHint: { fontSize: 12, color: theme.text.muted, margin: 0 },

  /* Actions */
  actions: {
    display: 'flex',
    gap: 12,
    marginBottom: 24,
  },
  btnPrimary: {
    padding: '10px 24px',
    backgroundColor: theme.primary.main,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  btnCancel: {
    padding: '10px 24px',
    backgroundColor: theme.status.error,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },

  /* Card grid */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
    marginBottom: 32,
  },
  card: {
    position: 'relative' as const,
    padding: '18px 20px',
    borderRadius: 10,
    border: '2px solid',
    transition: 'opacity 0.4s ease, transform 0.4s ease, border-color 0.4s ease, background-color 0.3s ease',
  },
  removeBtn: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    background: 'none',
    border: 'none',
    fontSize: 14,
    color: theme.text.muted,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
    lineHeight: 1,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
    paddingRight: 20,
  },
  fileName: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.text.primary,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    maxWidth: '70%',
  },
  fileSize: { fontSize: 12, color: theme.text.muted, flexShrink: 0 },

  /* Badge */
  badgeRow: { marginBottom: 10 },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.3,
  },

  /* Stats */
  statsRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 12,
    fontSize: 13,
    color: theme.text.secondary,
  },
  stat: { whiteSpace: 'nowrap' as const },

  /* Error message */
  errorMsg: {
    marginTop: 8,
    fontSize: 12,
    color: theme.status.error,
    lineHeight: 1.4,
    wordBreak: 'break-word' as const,
  },

  /* Load button */
  loadBtn: {
    marginTop: 10,
    padding: '7px 14px',
    backgroundColor: theme.primary.main,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    transition: 'background-color 0.2s ease',
  },

  /* Summary */
  summary: {
    padding: '24px 28px',
    backgroundColor: theme.background.secondary,
    borderRadius: 12,
    border: `2px solid ${theme.status.success}`,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: theme.text.primary,
    margin: '0 0 16px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 16,
  },
  summaryCard: {
    textAlign: 'center' as const,
    padding: '16px 12px',
    borderRadius: 8,
    border: `1px solid ${theme.background.quaternary}`,
    backgroundColor: theme.background.primary,
  },
  summaryValue: {
    display: 'block',
    fontSize: 28,
    fontWeight: 700,
    color: theme.text.primary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: theme.text.tertiary,
  },
};

export default BatchUpload;
