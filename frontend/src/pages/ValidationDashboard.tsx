import { useState, useEffect } from 'react';
import api from '../services/api';

interface ValidationProgress {
  job_id: number;
  status: string;
  total_records: number;
  processed_records: number;
  valid_records: number;
  invalid_records: number;
  current_chunk: number;
  total_chunks: number;
  filename: string;
}

interface ValidationSummary {
  job_id: number;
  status: string;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  error_count: number;
  top_errors: TopError[];
}

interface TopError {
  error_type: string;
  field_name: string;
  count: number;
}

interface ValidationError {
  row_number: number;
  field_name: string;
  invalid_value: string;
  error_type: string;
  error_message: string;
}

interface Props {
  jobId: number;
  onBack?: () => void;
  onProceedToLoad?: () => void;
}

export default function ValidationDashboard({ jobId, onBack, onProceedToLoad }: Props) {
  const [progress, setProgress] = useState<ValidationProgress | null>(null);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorFilter, setErrorFilter] = useState({ type: '', field: '' });
  const [showErrors, setShowErrors] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  useEffect(() => {
    loadProgress();
    const interval = setInterval(() => {
      if (progress?.status === 'validating') {
        loadProgress();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, progress?.status]);

  useEffect(() => {
    if (progress?.status === 'validated') {
      loadSummary();
    }
  }, [progress?.status]);

  const loadProgress = async () => {
    try {
      const response = await api.get(`/validation/${jobId}/progress`);
      setProgress(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load progress:', err);
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await api.get(`/validation/${jobId}/summary`);
      setSummary(response.data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  };

  const loadErrors = async () => {
    try {
      const params = new URLSearchParams();
      if (errorFilter.type) params.append('error_type', errorFilter.type);
      if (errorFilter.field) params.append('field_name', errorFilter.field);
      params.append('limit', '100');

      const response = await api.get(`/validation/${jobId}/errors?${params}`);
      setErrors(response.data);
      setShowErrors(true);
    } catch (err) {
      console.error('Failed to load errors:', err);
    }
  };

  // Group errors by row number
  const groupedErrors = errors.reduce((acc, error) => {
    if (!acc[error.row_number]) {
      acc[error.row_number] = [];
    }
    acc[error.row_number].push(error);
    return acc;
  }, {} as Record<number, ValidationError[]>);

  const exportErrors = async () => {
    try {
      // Check if there are no errors
      if (summary && summary.error_count === 0) {
        setExportMessage('No errors to export');
        setTimeout(() => setExportMessage(''), 3000);
        return;
      }

      const response = await api.get(`/validation/${jobId}/errors/export`, {
        responseType: 'blob'
      });
      
      // Construct filename from original filename
      let filename = `validation_errors_${jobId}.csv`; // fallback
      
      console.log('DEBUG: progress object:', progress);
      console.log('DEBUG: progress.filename:', progress?.filename);
      
      if (progress?.filename) {
        const originalFilename = progress.filename;
        console.log('DEBUG: originalFilename:', originalFilename);
        if (originalFilename.includes('.')) {
          const parts = originalFilename.split('.');
          const ext = parts.pop();
          const name = parts.join('.');
          filename = `${name}_error.${ext}`;
        } else {
          filename = `${originalFilename}_error.csv`;
        }
        console.log('DEBUG: constructed filename:', filename);
      } else {
        console.log('DEBUG: No progress.filename, using fallback');
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export errors:', err);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingSpinner}>Loading...</div>
      </div>
    );
  }

  const progressPercent = progress
    ? Math.round((progress.processed_records / progress.total_records) * 100)
    : 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Validation Dashboard</h1>
        {onBack && (
          <button onClick={onBack} style={styles.backButton}>
            ← Back
          </button>
        )}
      </div>

      {/* Progress Section */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Validation Progress</h2>
        
        <div style={styles.statusBadge}>
          Status: <span style={getStatusStyle(progress?.status || '')}>{progress?.status}</span>
        </div>

        {progress?.status === 'validating' && (
          <>
            <div style={styles.progressBar}>
              <div style={{...styles.progressFill, width: `${progressPercent}%`}} />
            </div>
            <div style={styles.progressText}>
              {progress.processed_records} / {progress.total_records} records ({progressPercent}%)
            </div>
            <div style={styles.chunkInfo}>
              Chunk {progress.current_chunk} of {progress.total_chunks}
            </div>
          </>
        )}

        {progress && (
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Total Records</div>
              <div style={styles.statValue}>{progress.total_records.toLocaleString()}</div>
            </div>
            <div style={{...styles.statCard, borderColor: '#4CAF50'}}>
              <div style={styles.statLabel}>Valid Records</div>
              <div style={{...styles.statValue, color: '#4CAF50'}}>{progress.valid_records.toLocaleString()}</div>
            </div>
            <div style={{...styles.statCard, borderColor: '#C8102E'}}>
              <div style={styles.statLabel}>Invalid Records</div>
              <div style={{...styles.statValue, color: '#C8102E'}}>{progress.invalid_records.toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* Proceed to Load button - only show if no invalid records */}
        {progress?.status === 'validated' && progress.invalid_records === 0 && onProceedToLoad && (
          <div style={{ marginTop: '30px', textAlign: 'center' }}>
            <button 
              onClick={() => {
                onProceedToLoad();
                // Scroll to load section after a short delay
                setTimeout(() => {
                  const loadSection = document.querySelector('[data-section="load"]');
                  if (loadSection) {
                    loadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 100);
              }}
              style={{
                padding: '16px 48px',
                backgroundColor: '#4CAF50',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#45a049';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(76, 175, 80, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#4CAF50';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
              }}
            >
              ✓ Proceed to Load → Step 4
            </button>
            <div style={{
              marginTop: '12px',
              fontSize: '14px',
              color: '#4CAF50',
              fontWeight: '600'
            }}>
              All records passed validation! Ready to load to FSM.
            </div>
          </div>
        )}
      </div>

      {/* Summary Section */}
      {summary && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Validation Summary</h2>
          
          <div style={styles.summaryStats}>
            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Error Count:</span>
              <span style={styles.summaryValue}>{summary.error_count.toLocaleString()}</span>
            </div>
            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Success Rate:</span>
              <span style={styles.summaryValue}>
                {((summary.valid_records / summary.total_records) * 100).toFixed(2)}%
              </span>
            </div>
          </div>

          <h3 style={styles.sectionTitle}>Top 10 Most Common Errors</h3>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Error Type</th>
                  <th style={styles.th}>Field Name</th>
                  <th style={styles.th}>Count</th>
                </tr>
              </thead>
              <tbody>
                {summary.top_errors.map((error, idx) => (
                  <tr key={idx} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={getErrorTypeBadge(error.error_type)}>{error.error_type}</span>
                    </td>
                    <td style={styles.td}>{error.field_name}</td>
                    <td style={styles.td}>{error.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.actionButtons}>
            <button onClick={loadErrors} style={styles.primaryButton}>
              View Errors
            </button>
            <button onClick={exportErrors} style={styles.secondaryButton}>
              Export Errors (CSV)
            </button>
            {exportMessage && (
              <span style={{
                marginLeft: '15px',
                color: '#FFA500',
                fontSize: '14px',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                animation: 'fadeIn 0.3s ease-in'
              }}>
                ℹ️ {exportMessage}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error Details Section */}
      {showErrors && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Error Details</h2>
          
          <div style={styles.filterRow}>
            <input
              type="text"
              placeholder="Filter by error type"
              value={errorFilter.type}
              onChange={(e) => setErrorFilter({...errorFilter, type: e.target.value})}
              style={styles.filterInput}
            />
            <input
              type="text"
              placeholder="Filter by field name"
              value={errorFilter.field}
              onChange={(e) => setErrorFilter({...errorFilter, field: e.target.value})}
              style={styles.filterInput}
            />
            <button onClick={loadErrors} style={styles.filterButton}>
              Apply Filter
            </button>
          </div>

          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Row</th>
                  <th style={styles.th}>Fields</th>
                  <th style={styles.th}>Invalid Values</th>
                  <th style={styles.th}>Types</th>
                  <th style={styles.th}>Messages</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(groupedErrors).length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{
                      ...styles.td,
                      textAlign: 'center',
                      padding: '40px',
                      color: '#4CAF50',
                      fontSize: '16px',
                      fontWeight: '600'
                    }}>
                      🎉 No errors found! All records passed validation.
                    </td>
                  </tr>
                ) : (
                  Object.entries(groupedErrors).map(([rowNum, rowErrors]) => (
                    <tr key={rowNum} style={styles.tr}>
                      <td style={styles.td}>{rowNum}</td>
                      <td style={styles.td}>
                        {rowErrors.map((err, idx) => (
                          <div key={idx} style={styles.errorItem}>
                            {err.field_name}
                          </div>
                        ))}
                      </td>
                      <td style={styles.td}>
                        {rowErrors.map((err, idx) => (
                          <div key={idx} style={styles.errorItem}>
                            {err.invalid_value || '(empty)'}
                          </div>
                        ))}
                      </td>
                      <td style={styles.td}>
                        {rowErrors.map((err, idx) => (
                          <div key={idx} style={styles.errorItem}>
                            <span style={getErrorTypeBadge(err.error_type)}>{err.error_type}</span>
                          </div>
                        ))}
                      </td>
                      <td style={styles.td}>
                        {rowErrors.map((err, idx) => (
                          <div key={idx} style={styles.errorItem}>
                            {err.error_message}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusStyle(status: string) {
  const baseStyle = {
    padding: '4px 12px',
    borderRadius: '4px',
    fontWeight: '600' as const,
    marginLeft: '8px',
  };

  switch (status) {
    case 'validating':
      return { ...baseStyle, backgroundColor: '#FFA500', color: '#000' };
    case 'validated':
      return { ...baseStyle, backgroundColor: '#4CAF50', color: '#fff' };
    case 'failed':
      return { ...baseStyle, backgroundColor: '#C8102E', color: '#fff' };
    default:
      return { ...baseStyle, backgroundColor: '#666', color: '#fff' };
  }
}

function getErrorTypeBadge(errorType: string) {
  const colors: Record<string, string> = {
    required: '#C8102E',
    type: '#FF6B6B',
    enum: '#FFA500',
    pattern: '#9C27B0',
    reference: '#2196F3',
    rule: '#FF9800',
    length: '#E91E63',
    format: '#00BCD4',
  };

  return {
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: colors[errorType] || '#666',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600' as const,
  };
}

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#000000',
    minHeight: '100vh',
    color: '#ffffff',
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
    color: '#ffffff',
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    border: '1px solid #3a3a3a',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  card: {
    backgroundColor: '#1a1a1a',
    padding: '30px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #2a2a2a',
  },
  cardTitle: {
    fontSize: '24px',
    fontWeight: '600' as const,
    marginBottom: '20px',
    color: '#ffffff',
  },
  statusBadge: {
    fontSize: '16px',
    marginBottom: '20px',
    color: '#ffffff',
  },
  progressBar: {
    width: '100%',
    height: '30px',
    backgroundColor: '#2a2a2a',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#C8102E',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '14px',
    color: '#cccccc',
    marginBottom: '5px',
  },
  chunkInfo: {
    fontSize: '12px',
    color: '#999999',
    marginBottom: '20px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginTop: '20px',
  },
  statCard: {
    padding: '20px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    border: '2px solid #3a3a3a',
  },
  statLabel: {
    fontSize: '14px',
    color: '#999999',
    marginBottom: '8px',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  summaryStats: {
    display: 'flex',
    gap: '40px',
    marginBottom: '30px',
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  summaryLabel: {
    fontSize: '14px',
    color: '#999999',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600' as const,
    marginBottom: '15px',
    color: '#ffffff',
  },
  tableContainer: {
    overflowX: 'auto' as const,
    marginBottom: '20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    padding: '12px',
    textAlign: 'left' as const,
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    fontWeight: '600' as const,
    borderBottom: '2px solid #C8102E',
    position: 'sticky' as const,
    top: 0,
  },
  tr: {
    borderBottom: '1px solid #2a2a2a',
  },
  td: {
    padding: '12px',
    color: '#cccccc',
    verticalAlign: 'top' as const,
  },
  errorItem: {
    padding: '6px 0',
    borderBottom: '1px solid #2a2a2a',
  },
  actionButtons: {
    display: 'flex',
    gap: '15px',
    marginTop: '20px',
  },
  primaryButton: {
    padding: '12px 24px',
    backgroundColor: '#C8102E',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: '600' as const,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '12px 24px',
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    border: '1px solid #3a3a3a',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: '600' as const,
    cursor: 'pointer',
  },
  filterRow: {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px',
  },
  filterInput: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '4px',
    color: '#ffffff',
    fontSize: '14px',
  },
  filterButton: {
    padding: '10px 20px',
    backgroundColor: '#C8102E',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '600' as const,
    cursor: 'pointer',
  },
  loadingSpinner: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '24px',
    color: '#ffffff',
  },
};
