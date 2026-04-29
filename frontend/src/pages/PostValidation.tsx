import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { theme } from '../theme';
import api from '../services/api';

interface AvailableClass {
  name: string;
  source: string;
  has_generic_list: boolean;
}

interface QueryResult {
  business_class: string;
  records: Record<string, string>[];
  record_count: number;
  columns: string[];
  metadata: any;
}

interface AggRow {
  groupKey: string;
  groupValues: Record<string, string>;
  count: number;
  aggregations: Record<string, { sum: number; min: number; max: number; avg: number }>;
}

interface SavedReport {
  id: number;
  name: string;
  description: string | null;
  business_class: string;
  config: {
    fields: string[];
    groupByFields: string[];
    aggregateFields: string[];
    aggregateOps?: Record<string, string[]>;
    lplFilter: string;
    limit: number;
    reportMode: ReportMode;
  };
  result_data: QueryResult | null;
  created_at: string | null;
  updated_at: string | null;
}

type ReportMode = 'detail' | 'summary';

const PostValidation: React.FC = () => {
  // Business class selection
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Field selection
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fieldSearch, setFieldSearch] = useState('');
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [defaultFieldsSaved, setDefaultFieldsSaved] = useState(false);
  const dragFieldRef = useRef<number | null>(null);
  const dragOverFieldRef = useRef<number | null>(null);

  // Query parameters
  const [lplFilter, setLplFilter] = useState('');

  // Record count
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [estimatedBatches, setEstimatedBatches] = useState(0);
  const [countLoading, setCountLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{ fetched: number; total: number } | null>(null);

  // Report mode
  const [reportMode, setReportMode] = useState<ReportMode>('detail');
  const [groupByFields, setGroupByFields] = useState<string[]>([]);
  const [aggregateFields, setAggregateFields] = useState<string[]>([]);
  const [aggregateOps, setAggregateOps] = useState<Record<string, string[]>>({}); // field -> ['SUM', 'AVG', 'MIN', 'MAX']
  const [dateGranularity, setDateGranularity] = useState<Record<string, string>>({}); // field -> 'exact' | 'year-month' | 'year-quarter' | 'year'

  // Saved reports
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveReportName, setSaveReportName] = useState('');
  const [saveReportDesc, setSaveReportDesc] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [showSavedReports, setShowSavedReports] = useState(true);
  const [reportSearchTerm, setReportSearchTerm] = useState('');

  // Server-side aggregation support
  const [aggSupported, setAggSupported] = useState(false);
  const [aggListName, setAggListName] = useState('');
  const [serverAggResult, setServerAggResult] = useState<QueryResult | null>(null);
  const [serverAggLoading, setServerAggLoading] = useState(false);

  // Results
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Detail table state
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [columnSearch, setColumnSearch] = useState<Record<string, string>>({});
  const [pageSizeOption, setPageSizeOption] = useState(10);

  // Summary table state
  const [summarySort, setSummarySort] = useState('');
  const [summarySortDir, setSummarySortDir] = useState<'asc' | 'desc'>('desc');
  const [summaryPage, setSummaryPage] = useState(1);
  const summaryPageSize = 25;

  // Load available classes on mount
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const res = await api.get('/post-validation/available-classes');
        setAvailableClasses(res.data.classes || []);
      } catch (e: any) {
        console.error('Failed to load classes:', e);
      }
    };
    loadClasses();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load fields when class is selected
  useEffect(() => {
    if (!selectedClass) return;
    const loadFields = async () => {
      try {
        const res = await api.get(`/post-validation/schema-fields/${selectedClass}`);
        const fields = res.data.fields || [];
        const required = res.data.required_fields || [];
        setAvailableFields(fields);
        // Only auto-select if not loading from a saved report
        if (!activeReportId) {
          // Check for saved defaults first
          const savedDefaults = localStorage.getItem(`pv_default_fields_${selectedClass}`);
          if (savedDefaults) {
            try {
              const parsed = JSON.parse(savedDefaults);
              const valid = parsed.filter((f: string) => fields.includes(f));
              if (valid.length > 0) { setSelectedFields(valid); return; }
            } catch {}
          }
          // Fallback: required fields first, then fill to 8
          const remaining = fields.filter((f: string) => !required.includes(f));
          const preSelected = [...required, ...remaining.slice(0, Math.max(0, 8 - required.length))];
          setSelectedFields(preSelected);
        }
      } catch (e: any) {
        console.error('Failed to load fields:', e);
        setAvailableFields([]);
      }
    };
    loadFields();
  }, [selectedClass]);

  // Check aggregation support when class changes
  useEffect(() => {
    if (!selectedClass) { setAggSupported(false); return; }
    const checkAgg = async () => {
      try {
        const res = await api.get(`/post-validation/aggregation-support/${selectedClass}`);
        setAggSupported(res.data.supported);
        setAggListName(res.data.list_name || '');
      } catch { setAggSupported(false); }
    };
    checkAgg();
  }, [selectedClass]);

  // Manual count check — triggered by button
  const handleCheckCount = async () => {
    if (!selectedClass || selectedFields.length === 0) return;
    if (!lplFilter) {
      if (!window.confirm('No LPL filter is set. This will count ALL records for this business class, which could be very large.\n\nProceed without a filter?')) return;
    }
    setCountLoading(true);
    setRecordCount(null);
    try {
      const res = await api.post('/post-validation/count', {
        business_class: selectedClass,
        fields: selectedFields[0],
        lpl_filter: lplFilter || undefined,
      });
      setRecordCount(res.data.count);
      setEstimatedBatches(res.data.estimated_batches);
    } catch (e: any) {
      console.error('Count failed:', e);
      setRecordCount(null);
    } finally {
      setCountLoading(false);
    }
  };

  // Load saved reports on mount
  useEffect(() => {
    loadSavedReports();
  }, []);

  const loadSavedReports = async () => {
    try {
      const res = await api.get('/post-validation/reports');
      setSavedReports(res.data || []);
    } catch (e: any) {
      console.error('Failed to load saved reports:', e);
    }
  };

  const handleSaveReport = async () => {
    if (!saveReportName.trim() || !selectedClass) return;
    setSavingReport(true);
    try {
      const config = { fields: selectedFields, groupByFields, aggregateFields, aggregateOps, lplFilter, reportMode, dateGranularity };
      // Include aggregation result snapshot when in summary mode
      const result_data = reportMode === 'summary' && serverAggResult ? serverAggResult : null;
      if (activeReportId) {
        await api.put(`/post-validation/reports/${activeReportId}`, { name: saveReportName, description: saveReportDesc || null, config, result_data });
      } else {
        const res = await api.post('/post-validation/reports', { name: saveReportName, description: saveReportDesc || null, business_class: selectedClass, config, result_data });
        setActiveReportId(res.data.id);
      }
      await loadSavedReports();
      setShowSaveModal(false);
    } catch (e: any) {
      console.error('Failed to save report:', e);
    } finally {
      setSavingReport(false);
    }
  };

  const handleLoadReport = async (report: SavedReport) => {
    setActiveReportId(report.id);
    setSelectedClass(report.business_class);
    setSearchTerm(report.business_class);
    setReportMode(report.config.reportMode || 'detail');
    setLplFilter(report.config.lplFilter || '');
    setGroupByFields(report.config.groupByFields || []);
    setAggregateFields(report.config.aggregateFields || []);
    setAggregateOps((report.config as any).aggregateOps || {});
    setDateGranularity((report.config as any).dateGranularity || {});
    setQueryResult(null);
    setError('');
    setColumnSearch({});
    // Restore saved aggregation result if available
    if (report.result_data && report.config.reportMode === 'summary') {
      setServerAggResult(report.result_data);
    } else {
      setServerAggResult(null);
    }
    // Fields will be loaded by the useEffect, then we override with saved selection
    try {
      const res = await api.get(`/post-validation/schema-fields/${report.business_class}`);
      setAvailableFields(res.data.fields || []);
      setSelectedFields(report.config.fields || []);
    } catch (e: any) {
      console.error('Failed to load fields for report:', e);
    }
  };

  const handleDeleteReport = async (id: number) => {
    if (!window.confirm('Delete this saved report?')) return;
    try {
      await api.delete(`/post-validation/reports/${id}`);
      if (activeReportId === id) setActiveReportId(null);
      await loadSavedReports();
    } catch (e: any) {
      console.error('Failed to delete report:', e);
    }
  };

  const openSaveModal = () => {
    const existing = savedReports.find(r => r.id === activeReportId);
    setSaveReportName(existing?.name || '');
    setSaveReportDesc(existing?.description || '');
    setShowSaveModal(true);
  };

  const filteredClasses = availableClasses.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredFields = availableFields.filter(f =>
    f.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const handleSelectClass = (className: string) => {
    setSelectedClass(className);
    setSearchTerm(className);
    setShowDropdown(false);
    setQueryResult(null);
    setError('');
    setSelectedFields([]);
    setGroupByFields([]);
    setAggregateFields([]);
    setAggregateOps({});
    setDateGranularity({});
    setColumnSearch({});
    setSortColumn('');
    setCurrentPage(1);
    setSummaryPage(1);
    setActiveReportId(null);
    setRecordCount(null);
    setEstimatedBatches(0);
    setServerAggResult(null);
  };

  const toggleField = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const handleFieldDragEnd = () => {
    const from = dragFieldRef.current;
    const to = dragOverFieldRef.current;
    if (from === null || to === null || from === to) return;
    setSelectedFields(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      return updated;
    });
    dragFieldRef.current = null;
    dragOverFieldRef.current = null;
  };

  const handleQuery = async () => {
    if (!selectedClass || selectedFields.length === 0) {
      setError('Please select a business class and at least one field.');
      return;
    }
    setLoading(true);
    setError('');
    setQueryResult(null);
    setServerAggResult(null);
    setCurrentPage(1);
    setSummaryPage(1);
    setColumnSearch({});
    setSortColumn('');
    setFetchProgress({ fetched: 0, total: recordCount || 0 });

    // Start polling progress
    const progressInterval = setInterval(async () => {
      try {
        const p = await api.get('/post-validation/query-progress');
        const fetched = p.data.fetched || 0;
        const total = Math.max(recordCount || 0, fetched); // use whichever is larger
        setFetchProgress({ fetched, total });
      } catch {}
    }, 1500);

    try {
      const res = await api.post('/post-validation/query', {
        business_class: selectedClass,
        fields: selectedFields.join(','),
        limit: recordCount || 999999999,
        lpl_filter: lplFilter || undefined,
      });
      setQueryResult(res.data);
      setFetchProgress(null);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail) || 'Query failed');
      setFetchProgress(null);
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
    }
  };

  // Server-side aggregation — auto-trigger when group-by or aggregate changes
  useEffect(() => {
    if (reportMode !== 'summary' || groupByFields.length === 0 || !queryResult) return;
    const runAgg = async () => {
      setServerAggLoading(true);
      setServerAggResult(null);
      try {
        const res = await api.post('/post-validation/aggregate', {
          group_by: groupByFields,
          aggregate_columns: aggregateFields,
          aggregate_ops: aggregateOps,
          date_granularity: dateGranularity,
        });
        setServerAggResult(res.data);
      } catch (e: any) {
        const detail = e.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : JSON.stringify(detail) || 'Aggregation failed');
      } finally {
        setServerAggLoading(false);
      }
    };
    runAgg();
  }, [reportMode, groupByFields, aggregateFields, aggregateOps, dateGranularity, queryResult]);

  // ── Detail table helpers ──
  const getFilteredAndSortedRecords = useCallback(() => {
    if (!queryResult) return [];
    let records = [...queryResult.records];
    Object.entries(columnSearch).forEach(([col, term]) => {
      if (term) records = records.filter(r => (r[col] || '').toLowerCase().includes(term.toLowerCase()));
    });
    if (sortColumn) {
      records.sort((a, b) => {
        const aVal = a[sortColumn] || '';
        const bVal = b[sortColumn] || '';
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    return records;
  }, [queryResult, columnSearch, sortColumn, sortDirection]);

  const filteredRecords = useMemo(() => getFilteredAndSortedRecords(), [getFilteredAndSortedRecords]);
  const totalPages = Math.ceil(filteredRecords.length / pageSizeOption);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSizeOption, currentPage * pageSizeOption);

  const handleSort = (col: string) => {
    if (sortColumn === col) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortDirection('asc'); }
    setCurrentPage(1);
  };

  // ── Date helpers ──
  const isDateField = (field: string) => /date/i.test(field);

  const applyDateGranularity = (value: string, field: string): string => {
    const gran = dateGranularity[field] || 'exact';
    if (gran === 'exact' || !value || !/^\d{8}$/.test(value)) return value;
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    if (gran === 'year') return y;
    if (gran === 'year-month') return `${y}-${m}`;
    if (gran === 'year-quarter') {
      const q = Math.ceil(parseInt(m) / 3);
      return `${y}-Q${q}`;
    }
    return value;
  };

  // ── Summary / Aggregation helpers ──
  const computeSummary = useCallback((): AggRow[] => {
    if (!queryResult || groupByFields.length === 0) return [];
    const groups: Record<string, { groupValues: Record<string, string>; records: Record<string, string>[] }> = {};

    // Apply column filters first
    let records = [...queryResult.records];
    Object.entries(columnSearch).forEach(([col, term]) => {
      if (term) records = records.filter(r => (r[col] || '').toLowerCase().includes(term.toLowerCase()));
    });

    for (const rec of records) {
      const key = groupByFields.map(f => {
        const raw = rec[f] || '(empty)';
        return isDateField(f) ? applyDateGranularity(raw, f) : raw;
      }).join(' | ');
      if (!groups[key]) {
        const gv: Record<string, string> = {};
        groupByFields.forEach(f => {
          const raw = rec[f] || '(empty)';
          gv[f] = isDateField(f) ? applyDateGranularity(raw, f) : raw;
        });
        groups[key] = { groupValues: gv, records: [] };
      }
      groups[key].records.push(rec);
    }

    return Object.entries(groups).map(([key, g]) => {
      const aggs: Record<string, { sum: number; min: number; max: number; avg: number }> = {};
      for (const af of aggregateFields) {
        let sum = 0, min = Infinity, max = -Infinity, count = 0;
        for (const r of g.records) {
          const n = parseFloat(r[af] || '');
          if (!isNaN(n)) { sum += n; if (n < min) min = n; if (n > max) max = n; count++; }
        }
        aggs[af] = { sum: Math.round(sum * 100) / 100, min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max, avg: count > 0 ? Math.round((sum / count) * 100) / 100 : 0 };
      }
      return { groupKey: key, groupValues: g.groupValues, count: g.records.length, aggregations: aggs };
    });
  }, [queryResult, groupByFields, aggregateFields, columnSearch, dateGranularity]);

  const summaryRows = useMemo(() => computeSummary(), [computeSummary]);

  // Sort summary
  const sortedSummary = useCallback(() => {
    if (!summarySort) return summaryRows;
    return [...summaryRows].sort((a, b) => {
      if (summarySort === '_count') {
        return summarySortDir === 'asc' ? a.count - b.count : b.count - a.count;
      }
      // Check if it's a group field
      if (groupByFields.includes(summarySort)) {
        const av = a.groupValues[summarySort] || '';
        const bv = b.groupValues[summarySort] || '';
        return summarySortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      // It's an aggregate field — sort by sum
      const aVal = a.aggregations[summarySort]?.sum || 0;
      const bVal = b.aggregations[summarySort]?.sum || 0;
      return summarySortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [summaryRows, summarySort, summarySortDir, groupByFields]);

  const sortedSummaryRows = useMemo(() => sortedSummary(), [sortedSummary]);
  const summaryTotalPages = Math.ceil(sortedSummaryRows.length / summaryPageSize);
  const paginatedSummary = sortedSummaryRows.slice((summaryPage - 1) * summaryPageSize, summaryPage * summaryPageSize);

  const handleSummarySort = (col: string) => {
    if (summarySort === col) setSummarySortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSummarySort(col); setSummarySortDir('desc'); }
    setSummaryPage(1);
  };

  // ── Grand totals for summary ──
  const grandTotals = useCallback(() => {
    const totals: Record<string, number> = {};
    let totalCount = 0;
    for (const row of summaryRows) {
      totalCount += row.count;
      for (const af of aggregateFields) {
        totals[af] = (totals[af] || 0) + (row.aggregations[af]?.sum || 0);
      }
    }
    return { totalCount, totals };
  }, [summaryRows, aggregateFields]);

  const gt = useMemo(() => grandTotals(), [grandTotals]);

  // ── Export CSV ──
  const handleExportCSV = async () => {
    if (!queryResult) return;
    if (reportMode === 'summary' && summaryRows.length > 0) {
      const cols = [...groupByFields, 'Record Count', ...aggregateFields.map(f => `SUM(${f})`)];
      const header = cols.join(',');
      const rows = sortedSummaryRows.map(r => [
        ...groupByFields.map(f => r.groupValues[f]),
        r.count,
        ...aggregateFields.map(f => r.aggregations[f]?.sum || 0)
      ].join(','));
      const csv = [header, ...rows].join('\n');
      downloadCSV(csv, `${selectedClass}_summary`);
    } else {
      // For large datasets, export from backend (streams from temp table)
      try {
        const resp = await api.post('/post-validation/export-detail', {
          fields: selectedFields.filter(c => queryResult.columns.includes(c)),
        }, { responseType: 'blob' });
        const blob = new Blob([resp.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedClass}_detail_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e: any) {
        console.error('Export failed:', e);
        alert('Export failed. Try again.');
      }
    }
  };

  const downloadCSV = (csv: string, prefix: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ════════════════════════════════════════════════════════════════
  // JSX
  // ════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '32px', maxWidth: '100%' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: theme.primary.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', color: '#fff', boxShadow: '0 4px 12px rgba(70,0,175,0.25)'
          }}>📊</div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: theme.text.primary, margin: 0 }}>
              Post Validation Report
            </h1>
            <p style={{ fontSize: '13px', color: theme.text.tertiary, margin: 0 }}>
              Query FSM data to verify loaded records — filter, aggregate, and reconcile conversion results
            </p>
          </div>
        </div>
      </div>

      {/* ── Saved Reports Panel ── */}
      <div style={{
        backgroundColor: theme.background.secondary, borderRadius: '14px',
        border: `1px solid ${theme.background.quaternary}`, marginBottom: '24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden'
      }}>
        <div
          onClick={() => setShowSavedReports(!showSavedReports)}
          style={{
            padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', userSelect: 'none',
            background: showSavedReports ? `linear-gradient(135deg, ${theme.accent.purpleTintLight} 0%, #fff 100%)` : theme.background.secondary,
            transition: 'background 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>💾</span>
            <span style={{ fontSize: '15px', fontWeight: '600', color: theme.text.primary }}>Saved Reports</span>
            <span style={{ fontSize: '12px', color: theme.text.muted, backgroundColor: theme.background.quaternary, padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>{savedReports.length}</span>
          </div>
          <span style={{ fontSize: '12px', color: theme.text.muted, transition: 'transform 0.2s', transform: showSavedReports ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </div>
        {showSavedReports && (
          <div style={{ padding: '0 0 0' }}>
            {savedReports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 24px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.4 }}>📋</div>
                <p style={{ fontSize: '13px', color: theme.text.muted, margin: 0 }}>No saved reports yet. Configure a report and click "Save Report" to save it here.</p>
              </div>
            ) : (
              <>
                {savedReports.length > 5 && (
                  <div style={{ padding: '12px 24px 0' }}>
                    <input type="text" value={reportSearchTerm} onChange={e => setReportSearchTerm(e.target.value)} placeholder="Search by name, class, or description..."
                      style={{ ...inputStyle, fontSize: '12px', padding: '8px 12px' }} />
                  </div>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: theme.background.primary, borderBottom: `2px solid ${theme.background.quaternary}` }}>
                        <th style={{ padding: '10px 24px', textAlign: 'left', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.text.muted, width: '36px' }}></th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.text.muted }}>Report Name</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.text.muted }}>Business Class</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.text.muted }}>Mode</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.text.muted }}>Fields</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.text.muted }}>Data</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.text.muted }}>Updated</th>
                        <th style={{ padding: '10px 24px', textAlign: 'center', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.text.muted, width: '80px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedReports
                        .filter(r => !reportSearchTerm || r.name.toLowerCase().includes(reportSearchTerm.toLowerCase()) || r.business_class.toLowerCase().includes(reportSearchTerm.toLowerCase()) || (r.description || '').toLowerCase().includes(reportSearchTerm.toLowerCase()))
                        .map(r => {
                          const isActive = activeReportId === r.id;
                          const updatedDate = r.updated_at ? new Date(r.updated_at) : null;
                          const dateStr = updatedDate ? updatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                          const timeStr = updatedDate ? updatedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
                          return (
                            <tr key={r.id}
                              onClick={() => handleLoadReport(r)}
                              style={{
                                cursor: 'pointer',
                                backgroundColor: isActive ? theme.accent.purpleTintLight : 'transparent',
                                borderBottom: `1px solid ${theme.background.quaternary}`,
                                transition: 'background-color 0.15s',
                              }}
                              onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#FAFAFE'; }}
                              onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? theme.accent.purpleTintLight : 'transparent'; }}
                            >
                              <td style={{ padding: '10px 12px 10px 24px', width: '36px' }}>
                                <div style={{
                                  width: '8px', height: '8px', borderRadius: '50%',
                                  backgroundColor: isActive ? theme.primary.main : 'transparent',
                                  border: `2px solid ${isActive ? theme.primary.main : theme.background.quaternary}`,
                                  transition: 'all 0.15s',
                                }} />
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: '600', color: isActive ? theme.primary.main : theme.text.primary, fontSize: '13px', lineHeight: '1.3' }}>{r.name}</div>
                                {r.description && <div style={{ fontSize: '11px', color: theme.text.muted, marginTop: '1px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', backgroundColor: '#EDE9FE', color: theme.primary.main, fontWeight: '600' }}>{r.business_class}</span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <span style={{
                                  fontSize: '11px', padding: '3px 10px', borderRadius: '12px', fontWeight: '600',
                                  backgroundColor: r.config.reportMode === 'summary' ? '#ECFDF5' : theme.background.quaternary,
                                  color: r.config.reportMode === 'summary' ? '#059669' : theme.text.muted,
                                }}>
                                  {r.config.reportMode === 'summary' ? '📊 Summary' : '📋 Detail'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: theme.text.secondary, fontFamily: 'monospace', fontSize: '12px' }}>
                                {r.config.fields?.length || 0}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                {r.result_data ? (
                                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: '600' }}>📎 Cached</span>
                                ) : (
                                  <span style={{ fontSize: '11px', color: theme.text.muted }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: '11px', color: theme.text.muted, whiteSpace: 'nowrap' }}>
                                <div>{dateStr}</div>
                                {timeStr && <div style={{ fontSize: '10px', opacity: 0.7 }}>{timeStr}</div>}
                              </td>
                              <td style={{ padding: '10px 24px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleLoadReport(r); }}
                                    style={{ background: 'none', border: `1px solid ${theme.primary.main}`, borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: theme.primary.main, padding: '4px 10px', fontWeight: '600', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = theme.primary.main; e.currentTarget.style.color = '#fff'; }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = theme.primary.main; }}
                                    title="Open this report"
                                  >Open</button>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDeleteReport(r.id); }}
                                    style={{ background: 'none', border: `1px solid ${theme.background.quaternary}`, borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: theme.text.muted, padding: '4px 8px', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = theme.background.quaternary; e.currentTarget.style.color = theme.text.muted; }}
                                    title="Delete this report"
                                  >✕</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Query Builder Card ── */}
      <div style={{
        backgroundColor: theme.background.secondary, borderRadius: '14px',
        border: `1px solid ${theme.background.quaternary}`, padding: '28px',
        marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>⚙️</span>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: theme.text.primary, margin: 0 }}>Report Setup</h2>
            {activeReportId && (
              <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '10px', backgroundColor: '#EDE9FE', color: theme.primary.main, fontWeight: '600' }}>Editing saved report</span>
            )}
          </div>
          {activeReportId && (
            <button onClick={() => {
              setActiveReportId(null);
              setSelectedClass('');
              setSearchTerm('');
              setSelectedFields([]);
              setGroupByFields([]);
              setAggregateFields([]);
              setAggregateOps({});
              setDateGranularity({});
              setLplFilter('');
              setReportMode('detail');
              setQueryResult(null);
              setServerAggResult(null);
              setRecordCount(null);
              setEstimatedBatches(0);
              setError('');
              setColumnSearch({});
              setSortColumn('');
              setCurrentPage(1);
              setSummaryPage(1);
            }}
              style={{ padding: '6px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '8px', border: `2px solid ${theme.primary.main}`, backgroundColor: 'transparent', color: theme.primary.main, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = theme.primary.main; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = theme.primary.main; }}
            >
              ＋ New Report
            </button>
          )}
        </div>

        {/* Row 1: Business Class + Limit */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '20px' }}>
          <div ref={searchRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Business Class</label>
            <div style={{ position: 'relative' }}>
              <input type="text" value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search business class (e.g. GLTransactionInterface)..."
                style={{ ...inputStyle, paddingLeft: '38px', borderColor: selectedClass ? theme.primary.main : theme.background.quaternary }}
                onKeyDown={e => { if (e.key === 'Escape') setShowDropdown(false); }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', opacity: 0.5 }}>🔎</span>
            </div>
            {showDropdown && filteredClasses.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                backgroundColor: theme.background.secondary, border: `1px solid ${theme.background.quaternary}`,
                borderRadius: '8px', marginTop: '4px', maxHeight: '280px', overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
              }}>
                {filteredClasses.map(c => (
                  <div key={c.name} onClick={() => handleSelectClass(c.name)}
                    style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background-color 0.15s', backgroundColor: c.name === selectedClass ? theme.accent.purpleTintLight : 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.accent.purpleTintLight}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = c.name === selectedClass ? theme.accent.purpleTintLight : 'transparent'}
                  >
                    <span style={{ fontSize: '13px', fontWeight: c.name === selectedClass ? '600' : '400', color: theme.text.primary }}>{c.name}</span>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: c.source === 'conversion' ? '#EDE9FE' : '#ECFDF5', color: c.source === 'conversion' ? theme.primary.main : '#059669', fontWeight: '600', textTransform: 'uppercase' }}>{c.source}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* LPL Filter */}
        {selectedClass && (
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>
              LPL Filter <span style={{ fontWeight: '400', textTransform: 'none', color: theme.text.muted }}>(e.g. GLTransactionInterface.RunGroup = "GLTRANS_20260401")</span>
            </label>
            <input type="text" value={lplFilter} onChange={e => setLplFilter(e.target.value)}
              placeholder='e.g. AccountingEntity = "10" AND Status = "0"'
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '13px' }}
            />
          </div>
        )}

        {/* Field Picker */}
        {selectedClass && availableFields.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Fields ({selectedFields.length} of {availableFields.length})</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setSelectedFields([...availableFields])} style={smallBtnStyle}>Select All</button>
                <button onClick={() => setSelectedFields([])} style={{ ...smallBtnStyle, color: theme.status.error }}>Clear</button>
                <button onClick={() => {
                  localStorage.setItem(`pv_default_fields_${selectedClass}`, JSON.stringify(selectedFields));
                  setDefaultFieldsSaved(true);
                  setTimeout(() => setDefaultFieldsSaved(false), 2000);
                }} disabled={selectedFields.length === 0} style={{ ...smallBtnStyle, color: '#059669', borderColor: '#059669' }}>
                  {defaultFieldsSaved ? '✓ Saved' : '📌 Set as Default'}
                </button>
                <button onClick={() => setShowFieldPicker(!showFieldPicker)} style={{ ...smallBtnStyle, backgroundColor: showFieldPicker ? theme.primary.main : 'transparent', color: showFieldPicker ? '#fff' : theme.primary.main, borderColor: theme.primary.main }}>{showFieldPicker ? 'Hide Picker' : 'Show Picker'}</button>
              </div>
            </div>
            {/* Selected tags — drag to reorder */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: showFieldPicker ? '12px' : '0' }}>
              {selectedFields.map((f, idx) => (
                <span key={f}
                  draggable
                  onDragStart={() => { dragFieldRef.current = idx; }}
                  onDragEnter={() => { dragOverFieldRef.current = idx; }}
                  onDragEnd={handleFieldDragEnd}
                  onDragOver={e => e.preventDefault()}
                  style={{ ...tagStyle, cursor: 'grab', userSelect: 'none' }}
                >
                  <span style={{ opacity: 0.35, marginRight: '4px', fontSize: '10px' }}>⠿</span>
                  {f}
                  <span onClick={e => { e.stopPropagation(); toggleField(f); }} style={{ opacity: 0.5, marginLeft: '4px', cursor: 'pointer' }}>×</span>
                </span>
              ))}
              {selectedFields.length === 0 && <span style={{ fontSize: '12px', color: theme.text.muted, fontStyle: 'italic' }}>No fields selected</span>}
            </div>
            {showFieldPicker && (
              <div style={{ backgroundColor: theme.background.primary, borderRadius: '10px', border: `1px solid ${theme.background.quaternary}`, padding: '14px', maxHeight: '220px', overflowY: 'auto' }}>
                <input type="text" value={fieldSearch} onChange={e => setFieldSearch(e.target.value)} placeholder="Filter fields..." style={{ ...inputStyle, fontSize: '12px', marginBottom: '10px', padding: '8px 12px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2px' }}>
                  {filteredFields.map(f => (
                    <label key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', overflow: 'hidden' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.accent.purpleTintLight}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <input type="checkbox" checked={selectedFields.includes(f)} onChange={() => toggleField(f)} style={{ accentColor: theme.primary.main, flexShrink: 0 }} />
                      <span title={f} style={{ fontFamily: 'monospace', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Report Mode & Aggregation ── */}
        {selectedClass && selectedFields.length > 0 && (
          <div style={{ backgroundColor: theme.background.primary, borderRadius: '10px', border: `1px solid ${theme.background.quaternary}`, padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Report Mode</label>
              <div style={{ display: 'flex', gap: '4px', backgroundColor: theme.background.quaternary, borderRadius: '8px', padding: '3px' }}>
                <button onClick={() => setReportMode('detail')} style={{ padding: '6px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: reportMode === 'detail' ? theme.primary.main : 'transparent', color: reportMode === 'detail' ? '#fff' : theme.text.secondary, transition: 'all 0.15s' }}>
                  📋 Detail View
                </button>
                <button onClick={() => { if (queryResult) setReportMode('summary'); }} style={{ padding: '6px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', border: 'none', cursor: queryResult ? 'pointer' : 'not-allowed', backgroundColor: reportMode === 'summary' ? theme.primary.main : 'transparent', color: reportMode === 'summary' ? '#fff' : queryResult ? theme.text.secondary : theme.text.muted, transition: 'all 0.15s', opacity: queryResult ? 1 : 0.5 }}>
                  📊 Summary / Aggregation {!queryResult && '(run report first)'}
                </button>
              </div>
            </div>

            {reportMode === 'summary' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Group By */}
                <div>
                  <label style={labelStyle}>Group By</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    {selectedFields.map(f => {
                      const active = groupByFields.includes(f);
                      const isDate = isDateField(f);
                      return (
                        <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: '0' }}>
                          <button onClick={() => {
                            setGroupByFields(prev => active ? prev.filter(x => x !== f) : [...prev, f]);
                            if (!active && isDate && !dateGranularity[f]) setDateGranularity(prev => ({ ...prev, [f]: 'year-month' }));
                          }}
                            style={{ padding: '4px 10px', fontSize: '11px', borderRadius: isDate && active ? '14px 0 0 14px' : '14px', borderTop: `1px solid ${active ? theme.primary.main : theme.background.quaternary}`, borderBottom: `1px solid ${active ? theme.primary.main : theme.background.quaternary}`, borderLeft: `1px solid ${active ? theme.primary.main : theme.background.quaternary}`, borderRight: isDate && active ? 'none' : `1px solid ${active ? theme.primary.main : theme.background.quaternary}`, backgroundColor: active ? theme.accent.purpleTintLight : 'transparent', color: active ? theme.primary.main : theme.text.secondary, cursor: 'pointer', fontWeight: active ? '600' : '400', transition: 'all 0.15s' }}>
                            {active && '✓ '}{f}
                          </button>
                          {active && isDate && (
                            <select value={dateGranularity[f] || 'exact'} onClick={e => e.stopPropagation()}
                              onChange={e => setDateGranularity(prev => ({ ...prev, [f]: e.target.value }))}
                              style={{ padding: '4px 6px', fontSize: '10px', borderRadius: '0 14px 14px 0', border: `1px solid ${theme.primary.main}`, backgroundColor: theme.accent.purpleTintLight, color: theme.primary.main, cursor: 'pointer', fontWeight: '600', outline: 'none', appearance: 'auto' as any }}>
                              <option value="exact">Exact Date</option>
                              <option value="year-month">Year-Month</option>
                              <option value="year-quarter">Year-Quarter</option>
                              <option value="year">Year</option>
                            </select>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  {groupByFields.length === 0 && <p style={{ fontSize: '11px', color: theme.text.muted, marginTop: '6px' }}>Select fields to group records by</p>}
                </div>
                {/* Aggregate (SUM) */}
                <div>
                  <label style={labelStyle}>Aggregate (SUM / AVG / MIN / MAX)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'flex-start' }}>
                    {selectedFields.filter(f => !groupByFields.includes(f)).map(f => {
                      const active = aggregateFields.includes(f);
                      const ops = aggregateOps[f] || ['SUM'];
                      return (
                        <div key={f} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                          <button onClick={() => {
                            if (active) {
                              setAggregateFields(prev => prev.filter(x => x !== f));
                              setAggregateOps(prev => { const n = { ...prev }; delete n[f]; return n; });
                            } else {
                              setAggregateFields(prev => [...prev, f]);
                              setAggregateOps(prev => ({ ...prev, [f]: ['SUM'] }));
                            }
                          }}
                            style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '14px', border: `1px solid ${active ? theme.status.success : theme.background.quaternary}`, backgroundColor: active ? '#ECFDF5' : 'transparent', color: active ? '#059669' : theme.text.secondary, cursor: 'pointer', fontWeight: active ? '600' : '400', transition: 'all 0.15s' }}>
                            {active && 'Σ '}{f}
                          </button>
                          {active && (
                            <div style={{ display: 'flex', gap: '2px', paddingLeft: '4px' }}>
                              {(['SUM', 'AVG', 'MIN', 'MAX'] as const).map(op => {
                                const isOn = ops.includes(op);
                                return (
                                  <button key={op} onClick={() => {
                                    setAggregateOps(prev => {
                                      const current = prev[f] || ['SUM'];
                                      const next = isOn ? current.filter(o => o !== op) : [...current, op];
                                      if (next.length === 0) return prev;
                                      return { ...prev, [f]: next };
                                    });
                                  }}
                                    style={{
                                      padding: '2px 6px', fontSize: '9px', fontWeight: isOn ? '700' : '500', letterSpacing: '0.3px',
                                      backgroundColor: isOn ? '#059669' : '#F0FDF4', color: isOn ? '#fff' : '#059669',
                                      border: `1px solid ${isOn ? '#059669' : '#BBF7D0'}`, borderRadius: '4px',
                                      cursor: 'pointer', transition: 'all 0.15s', lineHeight: '1.4',
                                    }}>
                                    {op}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {aggregateFields.length === 0 && <p style={{ fontSize: '11px', color: theme.text.muted, marginTop: '6px' }}>Select numeric fields to aggregate</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Record Count Check */}
        {selectedClass && selectedFields.length > 0 && (
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', backgroundColor: recordCount !== null ? (recordCount > 0 ? '#F0FDF4' : '#FFFBEB') : theme.background.primary, borderRadius: '10px', border: `1px solid ${recordCount !== null ? (recordCount > 0 ? '#BBF7D0' : '#FDE68A') : theme.background.quaternary}` }}>
            <button onClick={handleCheckCount} disabled={countLoading}
              style={{ padding: '8px 18px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: `2px solid ${theme.primary.main}`, backgroundColor: countLoading ? theme.background.primary : 'transparent', color: theme.primary.main, cursor: countLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              {countLoading ? (<><span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(70,0,175,0.2)', borderTop: '2px solid #4600AF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Checking...</>) : (<>🔢 Check Count</>)}
            </button>
            {recordCount !== null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>{recordCount > 0 ? '📊' : '📭'}</span>
                <span style={{ fontSize: '15px', fontWeight: '700', color: recordCount > 0 ? '#059669' : '#92400E' }}>{recordCount.toLocaleString()}</span>
                <span style={{ fontSize: '13px', color: theme.text.secondary }}>records match{lplFilter ? ' (filtered)' : ''}</span>
                {recordCount > 0 && estimatedBatches > 1 && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', backgroundColor: theme.accent.purpleTintLight, color: theme.primary.main, fontWeight: '600' }}>{estimatedBatches} batches × 10,000</span>
                )}
              </div>
            ) : (
              <span style={{ fontSize: '13px', color: theme.text.muted }}>Click to check how many records match your filter</span>
            )}
          </div>
        )}

        {/* Execute Button + Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleQuery} disabled={!selectedClass || selectedFields.length === 0 || loading || recordCount === null || recordCount === 0}
            style={{ padding: '11px 28px', fontSize: '14px', fontWeight: '600', borderRadius: '8px', border: 'none', cursor: selectedClass && selectedFields.length > 0 && !loading && recordCount ? 'pointer' : 'not-allowed', background: selectedClass && selectedFields.length > 0 && recordCount ? theme.primary.gradient : theme.interactive.disabled, color: '#fff', transition: 'all 0.2s', boxShadow: recordCount ? '0 4px 12px rgba(70,0,175,0.25)' : 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {loading ? (<><span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Fetching from FSM...</>) : (<>🚀 Run Report</>)}
          </button>
          {/* Progress indicator */}
          {loading && fetchProgress && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <div style={{ flex: 1, maxWidth: '200px', height: '8px', backgroundColor: theme.background.quaternary, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${fetchProgress.total > 0 ? Math.min(100, (fetchProgress.fetched / fetchProgress.total) * 100) : 0}%`, height: '100%', backgroundColor: theme.primary.main, borderRadius: '4px', transition: 'width 0.5s ease' }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: theme.primary.main, whiteSpace: 'nowrap' }}>
                {fetchProgress.fetched.toLocaleString()} {fetchProgress.total > 0 ? `/ ${fetchProgress.total.toLocaleString()}` : ''}
              </span>
              <span style={{ fontSize: '11px', color: theme.text.muted }}>
                {fetchProgress.total > 0 ? `${Math.min(100, Math.round((fetchProgress.fetched / fetchProgress.total) * 100))}%` : ''}
              </span>
            </div>
          )}
          {selectedClass && selectedFields.length > 0 && recordCount !== null && recordCount > 0 && (
            <button onClick={openSaveModal}
              style={{ padding: '11px 20px', fontSize: '14px', fontWeight: '600', borderRadius: '8px', border: `2px solid ${theme.primary.main}`, backgroundColor: 'transparent', color: theme.primary.main, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = theme.accent.purpleTintLight; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              💾 {activeReportId ? 'Update Report' : 'Save Report'}
            </button>
          )}
          {queryResult && <span style={{ fontSize: '13px', color: theme.text.tertiary }}>{(recordCount || queryResult.record_count).toLocaleString()} records fetched from FSM</span>}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>❌</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#991B1B', marginBottom: '4px' }}>Query Failed</div>
            <div style={{ fontSize: '13px', color: '#B91C1C', fontFamily: 'monospace', wordBreak: 'break-all' }}>{error}</div>
          </div>
        </div>
      )}

      {/* ── KPI Summary Cards ── */}
      {(queryResult && queryResult.record_count > 0 || serverAggResult) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {queryResult && <KpiCard icon="📄" label="Records Fetched" value={(recordCount || queryResult.record_count).toLocaleString()} color={theme.primary.main} />}
          <KpiCard icon="📐" label="Fields Selected" value={String(selectedFields.length)} color={theme.primary.light} />
          {reportMode === 'summary' && serverAggResult && (
            <KpiCard icon="⚡" label="Server-Side Groups" value={serverAggResult.record_count.toLocaleString()} color="#059669" />
          )}
          {reportMode === 'summary' && !serverAggResult && groupByFields.length > 0 && queryResult && (
            <KpiCard icon="📊" label="Unique Groups" value={summaryRows.length.toLocaleString()} color="#059669" />
          )}
          {reportMode === 'summary' && aggregateFields.length > 0 && !serverAggResult && aggregateFields.map(af => (
            <KpiCard key={af} icon="Σ" label={`Total ${af.split('.').pop()}`} value={fmt(gt.totals[af] || 0)} color="#D97706" />
          ))}
          {reportMode === 'detail' && (
            <KpiCard icon="🔍" label="LPL Filter" value={lplFilter ? 'Active' : 'None'} color={lplFilter ? '#D97706' : theme.text.muted} />
          )}
        </div>
      )}

      {/* ── Server-Side Aggregation Results (GLTransactionInterface) ── */}
      {/* ── Server-Side Aggregation Results ── */}
      {serverAggLoading && reportMode === 'summary' && (
        <div style={{ backgroundColor: theme.background.secondary, borderRadius: '14px', border: `1px solid ${theme.background.quaternary}`, padding: '32px', textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid rgba(70,0,175,0.2)', borderTop: '3px solid #4600AF', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
          <p style={{ fontSize: '13px', color: theme.text.secondary }}>Aggregating data...</p>
        </div>
      )}
      {serverAggResult && reportMode === 'summary' && serverAggResult.record_count > 0 && (
        <div style={{ backgroundColor: theme.background.secondary, borderRadius: '14px', border: `1px solid ${theme.background.quaternary}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${theme.background.quaternary}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(135deg, #ECFDF5 0%, #fff 100%)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '16px' }}>⚡</span>
              <span style={{ fontSize: '15px', fontWeight: '600', color: theme.text.primary }}>Server-Side Group Count</span>
              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#059669', fontWeight: '600' }}>Paged from FSM</span>
              <span style={{ fontSize: '12px', color: theme.text.muted }}>{serverAggResult.record_count} groups • {(serverAggResult.metadata as any)?.total_records_scanned?.toLocaleString() || '?'} records scanned • Grouped by: {groupByFields.join(', ')}</span>
            </div>
            <button onClick={() => {
              if (!serverAggResult) return;
              const cols = serverAggResult.columns;
              const header = cols.join(',');
              const rows = serverAggResult.records.map(r => cols.map(c => { const v = r[c] || ''; return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v; }).join(','));
              const csv = [header, ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `${selectedClass}_aggregation_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
            }} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', border: `1px solid ${theme.status.success}`, backgroundColor: 'transparent', color: theme.status.success, cursor: 'pointer' }}>📥 Export</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: theme.background.primary }}>
                  {serverAggResult.columns.map(col => {
                    const isActive = summarySort === col;
                    const isNumCol = col === '_count' || /^(SUM|AVG|MIN|MAX)\(/.test(col);
                    return (
                      <th key={col} onClick={() => handleSummarySort(col)} style={{ ...thStyle, cursor: 'pointer', textAlign: isNumCol ? 'right' : 'left', color: isActive ? theme.primary.main : theme.text.secondary, borderBottom: isActive ? `2px solid ${theme.primary.main}` : undefined, userSelect: 'none' }}>
                        {col === '_count' ? 'Record Count' : col} {isActive && (summarySortDir === 'asc' ? '▲' : '▼')}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {[...serverAggResult.records].sort((a, b) => {
                  if (!summarySort) return 0;
                  const aVal = a[summarySort] || '';
                  const bVal = b[summarySort] || '';
                  // Only use numeric sort if the entire value is a number
                  const isFullNum = (v: string) => /^-?\d+(\.\d+)?$/.test(v.trim());
                  if (isFullNum(aVal) && isFullNum(bVal)) {
                    const diff = parseFloat(aVal) - parseFloat(bVal);
                    return summarySortDir === 'asc' ? diff : -diff;
                  }
                  return summarySortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                }).map((record, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${theme.background.quaternary}` }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.accent.purpleTintLight}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    {serverAggResult.columns.map(col => {
                      const val = record[col] || '';
                      const isCount = col === '_count';
                      const isNum = /^-?\d+(\.\d+)?$/.test(val);
                      return (
                        <td key={col} style={{ padding: '10px 14px', fontSize: '12px', fontFamily: isNum ? 'monospace' : 'inherit', textAlign: isCount || isNum ? 'right' : 'left', fontWeight: isCount ? '700' : isNum ? '600' : '400', color: isCount ? theme.primary.main : isNum ? '#D97706' : theme.text.primary }}>{isCount ? parseInt(val).toLocaleString() : val}</td>
                      );
                    })}
                  </tr>
                ))}
                {/* Grand Total Row */}
                {serverAggResult.metadata && (
                  <tr style={{ backgroundColor: theme.accent.purpleTintLight, borderTop: `2px solid ${theme.primary.main}` }}>
                    {serverAggResult.columns.map((col, ci) => {
                      if (col === '_count') {
                        return <td key={col} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', fontSize: '12px', color: theme.primary.main, fontFamily: 'monospace' }}>{((serverAggResult.metadata as any)?.grand_count || 0).toLocaleString()}</td>;
                      }
                      if (/^(SUM|AVG|MIN|MAX)\(/.test(col)) {
                        const grandSums = (serverAggResult.metadata as any)?.grand_sums || {};
                        return <td key={col} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', fontSize: '12px', color: theme.primary.main, fontFamily: 'monospace' }}>{fmt(grandSums[col] || 0)}</td>;
                      }
                      if (ci === 0) {
                        return <td key={col} style={{ padding: '10px 14px', fontWeight: '700', fontSize: '12px', color: theme.primary.main }}>GRAND TOTAL ({serverAggResult.record_count} groups)</td>;
                      }
                      return <td key={col} style={{ padding: '10px 14px' }} />;
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Client-Side Summary Table (fallback, used when server-side not available but data loaded) ── */}
      {queryResult && reportMode === 'summary' && !serverAggResult && !aggSupported && groupByFields.length > 0 && summaryRows.length > 0 && (
        <div style={{ backgroundColor: theme.background.secondary, borderRadius: '14px', border: `1px solid ${theme.background.quaternary}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${theme.background.quaternary}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(135deg, #ECFDF5 0%, #fff 100%)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '16px' }}>📊</span>
              <span style={{ fontSize: '15px', fontWeight: '600', color: theme.text.primary }}>Summary Report</span>
              <span style={{ fontSize: '12px', color: theme.text.muted }}>Grouped by: {groupByFields.map(f => {
                const gran = dateGranularity[f];
                return gran && gran !== 'exact' ? `${f} (${gran})` : f;
              }).join(', ')}</span>
            </div>
            <button onClick={handleExportCSV} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', border: `1px solid ${theme.status.success}`, backgroundColor: 'transparent', color: theme.status.success, cursor: 'pointer' }}>📥 Export Summary</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: theme.background.primary }}>
                  {groupByFields.map(f => (
                    <th key={f} onClick={() => handleSummarySort(f)} style={{ ...thStyle, cursor: 'pointer', color: summarySort === f ? theme.primary.main : theme.text.secondary, borderBottomColor: summarySort === f ? theme.primary.main : theme.background.quaternary }}>
                      {f} {summarySort === f && (summarySortDir === 'asc' ? '▲' : '▼')}
                    </th>
                  ))}
                  <th onClick={() => handleSummarySort('_count')} style={{ ...thStyle, cursor: 'pointer', textAlign: 'right', color: summarySort === '_count' ? theme.primary.main : theme.text.secondary, borderBottomColor: summarySort === '_count' ? theme.primary.main : theme.background.quaternary }}>
                    Record Count {summarySort === '_count' && (summarySortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  {aggregateFields.map(af => (
                    <th key={af} onClick={() => handleSummarySort(af)} style={{ ...thStyle, cursor: 'pointer', textAlign: 'right', color: summarySort === af ? theme.primary.main : theme.text.secondary, borderBottomColor: summarySort === af ? theme.primary.main : theme.background.quaternary }}>
                      SUM({af.split('.').pop()}) {summarySort === af && (summarySortDir === 'asc' ? '▲' : '▼')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedSummary.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${theme.background.quaternary}` }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.accent.purpleTintLight}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    {groupByFields.map(f => (
                      <td key={f} style={{ padding: '10px 14px', fontSize: '12px', fontFamily: 'monospace', color: theme.text.primary }}>{row.groupValues[f]}</td>
                    ))}
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', fontSize: '12px', color: theme.text.primary }}>{row.count.toLocaleString()}</td>
                    {aggregateFields.map(af => (
                      <td key={af} style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: '12px', color: '#D97706', fontWeight: '600' }}>{fmt(row.aggregations[af]?.sum || 0)}</td>
                    ))}
                  </tr>
                ))}
                {/* Grand Total Row */}
                <tr style={{ backgroundColor: theme.accent.purpleTintLight, borderTop: `2px solid ${theme.primary.main}` }}>
                  <td colSpan={groupByFields.length} style={{ padding: '10px 14px', fontSize: '12px', fontWeight: '700', color: theme.primary.main }}>GRAND TOTAL ({summaryRows.length} groups)</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', fontSize: '12px', color: theme.primary.main }}>{gt.totalCount.toLocaleString()}</td>
                  {aggregateFields.map(af => (
                    <td key={af} style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: theme.primary.main }}>{fmt(gt.totals[af] || 0)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {summaryTotalPages > 1 && <Pagination current={summaryPage} total={summaryTotalPages} count={sortedSummaryRows.length} pageSize={summaryPageSize} onChange={setSummaryPage} />}
        </div>
      )}

      {/* Summary mode but no group-by selected */}
      {queryResult && reportMode === 'summary' && groupByFields.length === 0 && (
        <div style={{ backgroundColor: theme.background.secondary, borderRadius: '14px', border: `1px dashed ${theme.accent.purpleTintMedium}`, padding: '48px 20px', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: theme.text.secondary, marginBottom: '6px' }}>Select Group By Fields</h3>
          <p style={{ fontSize: '13px', color: theme.text.tertiary }}>Choose one or more fields above to group and aggregate your data</p>
        </div>
      )}

      {/* ── Detail Table ── */}
      {queryResult && queryResult.record_count > 0 && reportMode === 'detail' && (
        <div style={{ backgroundColor: theme.background.secondary, borderRadius: '14px', border: `1px solid ${theme.background.quaternary}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${theme.background.quaternary}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(135deg, ${theme.accent.purpleTintLight} 0%, #fff 100%)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '16px' }}>📋</span>
              <span style={{ fontSize: '15px', fontWeight: '600', color: theme.text.primary }}>Detail Records</span>
              <span style={{ fontSize: '12px', color: theme.text.muted }}>{filteredRecords.length === queryResult.record_count ? `${queryResult.record_count} records` : `${filteredRecords.length} of ${queryResult.record_count} (filtered)`}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleExportCSV} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', border: `1px solid ${theme.status.success}`, backgroundColor: 'transparent', color: theme.status.success, cursor: 'pointer' }}>📥 Export CSV</button>
              <button onClick={handleQuery} disabled={loading} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', border: `1px solid ${theme.primary.main}`, backgroundColor: 'transparent', color: theme.primary.main, cursor: 'pointer' }}>🔄 Refresh</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: theme.background.primary }}>
                  <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>#</th>
                  {selectedFields.filter(c => queryResult.columns.includes(c)).map(col => (
                    <th key={col} onClick={() => handleSort(col)} style={{ ...thStyle, cursor: 'pointer', whiteSpace: 'nowrap', color: sortColumn === col ? theme.primary.main : theme.text.secondary, borderBottomColor: sortColumn === col ? theme.primary.main : theme.background.quaternary }}>
                      {col} {sortColumn === col && (sortDirection === 'asc' ? '▲' : '▼')}
                    </th>
                  ))}
                </tr>
                <tr style={{ backgroundColor: theme.background.primary }}>
                  <td style={{ padding: '4px 6px', borderBottom: `1px solid ${theme.background.quaternary}` }} />
                  {selectedFields.filter(c => queryResult.columns.includes(c)).map(col => (
                    <td key={`f-${col}`} style={{ padding: '4px 6px', borderBottom: `1px solid ${theme.background.quaternary}` }}>
                      <input type="text" value={columnSearch[col] || ''} onChange={e => { setColumnSearch(prev => ({ ...prev, [col]: e.target.value })); setCurrentPage(1); }} placeholder="Filter..."
                        style={{ width: '100%', padding: '4px 8px', fontSize: '11px', border: `1px solid ${theme.background.quaternary}`, borderRadius: '4px', outline: 'none', backgroundColor: theme.background.secondary, color: theme.text.primary, boxSizing: 'border-box' as const }} />
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${theme.background.quaternary}` }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.accent.purpleTintLight}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '9px 14px', textAlign: 'center', fontSize: '11px', color: theme.text.muted }}>{(currentPage - 1) * pageSizeOption + idx + 1}</td>
                    {selectedFields.filter(c => queryResult.columns.includes(c)).map(col => {
                      const val = record[col] || '';
                      const isNum = /^-?\d+(\.\d+)?$/.test(val);
                      const isDate = /^\d{8}$/.test(val);
                      const isErr = col.toLowerCase().includes('error') && val.length > 0;
                      return (
                        <td key={col} title={val} style={{ padding: '9px 14px', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: isNum || isDate ? 'monospace' : 'inherit', textAlign: isNum ? 'right' : 'left', color: isErr ? theme.status.error : theme.text.primary, fontWeight: isErr ? '600' : '400', fontSize: '12px' }}>
                          {isDate ? `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}` : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Rows per page + Pagination */}
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${theme.background.quaternary}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.background.primary }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: theme.text.muted }}>Rows per page:</span>
              <select value={pageSizeOption} onChange={e => { setPageSizeOption(Number(e.target.value)); setCurrentPage(1); }}
                style={{ padding: '4px 8px', fontSize: '12px', border: `1px solid ${theme.background.quaternary}`, borderRadius: '4px', backgroundColor: theme.background.secondary, color: theme.text.primary, cursor: 'pointer', outline: 'none' }}>
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span style={{ fontSize: '12px', color: theme.text.muted, marginLeft: '8px' }}>
                {filteredRecords.length === queryResult.record_count ? `${queryResult.record_count} records` : `${filteredRecords.length} of ${queryResult.record_count} (filtered)`}
              </span>
            </div>
            {totalPages > 1 && (
              <Pagination current={currentPage} total={totalPages} count={filteredRecords.length} pageSize={pageSizeOption} onChange={setCurrentPage} />
            )}
          </div>
        </div>
      )}

      {/* Empty result */}
      {queryResult && queryResult.record_count === 0 && (
        <div style={{ backgroundColor: theme.background.secondary, borderRadius: '14px', border: `1px solid ${theme.background.quaternary}`, padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: theme.text.primary, marginBottom: '8px' }}>No Records Found</h3>
          <p style={{ fontSize: '13px', color: theme.text.tertiary }}>Try adjusting your LPL filter or selecting a different business class.</p>
        </div>
      )}

      {/* Welcome */}
      {!queryResult && !loading && !error && (
        <div style={{ backgroundColor: theme.background.secondary, borderRadius: '14px', border: `1px dashed ${theme.accent.purpleTintMedium}`, padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.8 }}>📊</div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: theme.text.secondary, marginBottom: '8px' }}>Post Validation Report</h3>
          <p style={{ fontSize: '13px', color: theme.text.tertiary, maxWidth: '520px', margin: '0 auto', lineHeight: '1.6' }}>
            Select a conversion business class, choose fields, and run a report to verify your loaded data.
            Use Summary mode to aggregate totals by RunGroup, AccountingEntity, or any combination.
          </p>
        </div>
      )}

      {/* ── Save Report Modal ── */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowSaveModal(false)}>
          <div style={{ backgroundColor: theme.background.secondary, borderRadius: '16px', padding: '32px', width: '460px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: theme.primary.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#fff' }}>💾</div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: theme.text.primary, margin: 0 }}>{activeReportId ? 'Update Report' : 'Save Report'}</h3>
                <p style={{ fontSize: '12px', color: theme.text.muted, margin: 0 }}>Save this report configuration for quick access later</p>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Report Name *</label>
              <input type="text" value={saveReportName} onChange={e => setSaveReportName(e.target.value)} placeholder="e.g. GL RunGroup Reconciliation"
                autoFocus style={{ ...inputStyle, borderColor: saveReportName.trim() ? theme.primary.main : theme.background.quaternary }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Description <span style={{ fontWeight: '400', textTransform: 'none', color: theme.text.muted }}>(optional)</span></label>
              <input type="text" value={saveReportDesc} onChange={e => setSaveReportDesc(e.target.value)} placeholder="e.g. Check total amounts per RunGroup and AccountingEntity"
                style={inputStyle} />
            </div>
            {/* Preview */}
            <div style={{ backgroundColor: theme.background.primary, borderRadius: '8px', padding: '12px 14px', marginBottom: '24px', border: `1px solid ${theme.background.quaternary}` }}>
              <div style={{ fontSize: '11px', color: theme.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Report Configuration</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#EDE9FE', color: theme.primary.main, fontWeight: '600' }}>{selectedClass}</span>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: theme.background.quaternary, color: theme.text.secondary, fontWeight: '600' }}>{selectedFields.length} fields</span>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: reportMode === 'summary' ? '#ECFDF5' : theme.background.quaternary, color: reportMode === 'summary' ? '#059669' : theme.text.muted, fontWeight: '600' }}>{reportMode === 'summary' ? '📊 Summary' : '📋 Detail'}</span>
                {groupByFields.length > 0 && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: '600' }}>Group: {groupByFields.join(', ')}</span>}
                {aggregateFields.length > 0 && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#059669', fontWeight: '600' }}>Σ {aggregateFields.join(', ')}</span>}
                {lplFilter && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#991B1B', fontWeight: '600' }}>Filter active</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSaveModal(false)} style={{ padding: '10px 20px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: `1px solid ${theme.background.quaternary}`, backgroundColor: 'transparent', color: theme.text.secondary, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveReport} disabled={!saveReportName.trim() || savingReport}
                style={{ padding: '10px 24px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: 'none', background: saveReportName.trim() ? theme.primary.gradient : theme.interactive.disabled, color: '#fff', cursor: saveReportName.trim() ? 'pointer' : 'not-allowed', boxShadow: saveReportName.trim() ? '0 4px 12px rgba(70,0,175,0.25)' : 'none' }}>
                {savingReport ? 'Saving...' : activeReportId ? '💾 Update' : '💾 Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ── Reusable Components ──

const KpiCard: React.FC<{ icon: string; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
  <div style={{ backgroundColor: theme.background.secondary, borderRadius: '10px', border: `1px solid ${theme.background.quaternary}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
    <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color, fontWeight: '700' }}>{icon}</div>
    <div>
      <div style={{ fontSize: '11px', color: theme.text.muted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: '700', color: theme.text.primary }}>{value}</div>
    </div>
  </div>
);

const Pagination: React.FC<{ current: number; total: number; count: number; pageSize: number; onChange: (p: number) => void }> = ({ current, total, count, pageSize, onChange }) => (
  <div style={{ padding: '14px 24px', borderTop: `1px solid ${theme.background.quaternary}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.background.primary }}>
    <span style={{ fontSize: '12px', color: theme.text.muted }}>Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, count)} of {count}</span>
    <div style={{ display: 'flex', gap: '4px' }}>
      {[{ label: '«', page: 1 }, { label: '‹ Prev', page: current - 1 }].map(b => (
        <button key={b.label} onClick={() => onChange(b.page)} disabled={current === 1} style={pgBtnStyle(current === 1)}>{b.label}</button>
      ))}
      <span style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', color: theme.primary.main, display: 'flex', alignItems: 'center' }}>{current} / {total}</span>
      {[{ label: 'Next ›', page: current + 1 }, { label: '»', page: total }].map(b => (
        <button key={b.label} onClick={() => onChange(b.page)} disabled={current === total} style={pgBtnStyle(current === total)}>{b.label}</button>
      ))}
    </div>
  </div>
);

// ── Shared Styles ──
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: '600', color: theme.text.secondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', fontSize: '14px', border: `2px solid ${theme.background.quaternary}`, borderRadius: '8px', outline: 'none', backgroundColor: theme.background.primary, color: theme.text.primary, boxSizing: 'border-box' };
const smallBtnStyle: React.CSSProperties = { fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${theme.background.quaternary}`, backgroundColor: 'transparent', color: theme.primary.main, cursor: 'pointer', fontWeight: '600' };
const tagStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '11px', borderRadius: '14px', backgroundColor: theme.accent.purpleTintLight, color: theme.primary.main, fontWeight: '500', cursor: 'pointer', border: `1px solid ${theme.accent.purpleTintMedium}` };
const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: `2px solid ${theme.background.quaternary}`, userSelect: 'none' };
const pgBtnStyle = (disabled: boolean): React.CSSProperties => ({ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: `1px solid ${theme.background.quaternary}`, backgroundColor: disabled ? theme.background.primary : theme.background.secondary, color: disabled ? theme.text.muted : theme.text.primary, cursor: disabled ? 'default' : 'pointer' });

export default PostValidation;
