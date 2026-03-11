import { useState, useEffect } from 'react';
import Login from './pages/Login';
import ConversionWorkflow from './pages/ConversionWorkflow';
import SetupDataManagement from './pages/SetupDataManagement';
import RulesManagement from './pages/RulesManagement';
import SchemaManagement from './pages/SchemaManagement';
import api from './services/api';

type Page = 'login' | 'dashboard' | 'conversion' | 'setup' | 'rules' | 'schema';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [account, setAccount] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('access_token');
    const storedAccount = localStorage.getItem('account');
    
    if (token && storedAccount) {
      setAccount(JSON.parse(storedAccount));
      setCurrentPage('dashboard');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('account');
    setAccount(null);
    setCurrentPage('login');
  };

  if (currentPage === 'login') {
    return <Login />;
  }

  return (
    <div style={styles.container}>
      {/* Add CSS animation for skeleton */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      
      {/* Sidebar */}
      <div style={{
        ...styles.sidebar,
        width: sidebarCollapsed ? '80px' : '250px',
        transition: 'width 0.3s ease',
        position: 'relative' as const
      }}>
        {/* Toggle button attached to the right edge */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={styles.toggleButton}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>

        <div style={{
          ...styles.logoContainer,
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
        }}>
          {!sidebarCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="40" height="40" viewBox="0 0 64 64" style={styles.logoIcon}>
                <circle cx="32" cy="32" r="32" fill="#000000"/>
                <text x="32" y="42" fontFamily="Arial, sans-serif" fontSize="32" fontWeight="bold" fill="#C8102E" textAnchor="middle">DB</text>
                <line x1="16" y1="50" x2="48" y2="50" stroke="#C8102E" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="16" cy="50" r="3" fill="#FFFFFF"/>
                <circle cx="48" cy="50" r="3" fill="#FFFFFF"/>
              </svg>
              <div style={styles.logo}>FSM DataBridge</div>
            </div>
          ) : (
            <svg width="40" height="40" viewBox="0 0 64 64" style={styles.logoIcon}>
              <circle cx="32" cy="32" r="32" fill="#000000"/>
              <text x="32" y="42" fontFamily="Arial, sans-serif" fontSize="32" fontWeight="bold" fill="#C8102E" textAnchor="middle">DB</text>
              <line x1="16" y1="50" x2="48" y2="50" stroke="#C8102E" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="16" cy="50" r="3" fill="#FFFFFF"/>
              <circle cx="48" cy="50" r="3" fill="#FFFFFF"/>
            </svg>
          )}
        </div>
        
        {!sidebarCollapsed && (
          <div style={styles.accountInfo}>
            <div style={styles.greetingText}>
              👋 Hey there!
            </div>
            <div style={styles.accountDescription}>
              You're working in <span style={styles.highlightText}>{account?.account_name}</span>
            </div>
            <div style={styles.tenantInfo}>
              <span style={styles.tenantLabel}>Tenant:</span> {account?.tenant_id?.split('_')[0]}
            </div>
            <div style={getEnvironmentBadge(account?.tenant_id)}>
              {getEnvironment(account?.tenant_id)} Environment
            </div>
          </div>
        )}

        <nav style={styles.nav}>
          <button
            onClick={() => setCurrentPage('dashboard')}
            style={currentPage === 'dashboard' ? styles.navItemActive : styles.navItem}
            title="Dashboard"
          >
            <span style={styles.navIcon}>📊</span>
            {!sidebarCollapsed && 'Dashboard'}
          </button>
          <button
            onClick={() => setCurrentPage('conversion')}
            style={currentPage === 'conversion' ? styles.navItemActive : styles.navItem}
            title="Conversions"
          >
            <span style={styles.navIcon}>📤</span>
            {!sidebarCollapsed && 'Conversions'}
          </button>
          <button
            onClick={() => setCurrentPage('setup')}
            style={currentPage === 'setup' ? styles.navItemActive : styles.navItem}
            title="Reference Data"
          >
            <span style={styles.navIcon}>🔄</span>
            {!sidebarCollapsed && 'Reference Data'}
          </button>
          <button
            onClick={() => setCurrentPage('rules')}
            style={currentPage === 'rules' ? styles.navItemActive : styles.navItem}
            title="Validation Rules"
          >
            <span style={styles.navIcon}>📋</span>
            {!sidebarCollapsed && 'Validation Rules'}
          </button>
          <button
            onClick={() => setCurrentPage('schema')}
            style={currentPage === 'schema' ? styles.navItemActive : styles.navItem}
            title="Schema Management"
          >
            <span style={styles.navIcon}>📐</span>
            {!sidebarCollapsed && 'Schema Management'}
          </button>
        </nav>

        <button onClick={handleLogout} style={styles.logoutButton} title="Logout">
          {!sidebarCollapsed ? 'Logout' : 'Logout'}
        </button>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        {currentPage === 'dashboard' && <Dashboard onNewConversion={() => setCurrentPage('conversion')} onSetupData={() => setCurrentPage('setup')} onViewRules={() => setCurrentPage('rules')} />}
        {currentPage === 'conversion' && <ConversionWorkflow onBack={() => setCurrentPage('dashboard')} />}
        {currentPage === 'setup' && <SetupDataManagement />}
        {currentPage === 'rules' && <RulesManagement />}
        {currentPage === 'schema' && <SchemaManagement />}
      </div>
    </div>
  );
}

function Dashboard({ onNewConversion, onSetupData, onViewRules }: { onNewConversion: () => void; onSetupData: () => void; onViewRules: () => void }) {
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [interfacing, setInterfacing] = useState<number | null>(null); // Track which job is being interfaced
  const jobsPerPage = 5;

  useEffect(() => {
    loadDashboardData();
  }, [currentPage, showAllJobs]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Calculate offset based on current page
      const offset = showAllJobs ? (currentPage - 1) * jobsPerPage : 0;
      const limit = showAllJobs ? jobsPerPage : 5;
      
      // Load recent jobs with pagination
      const jobsResponse = await api.get(`/upload/jobs/recent?limit=${limit}&offset=${offset}`);
      setRecentJobs(jobsResponse.data.jobs);
      setTotalJobs(jobsResponse.data.total);

      // Load last sync time (only on first load)
      if (!showAllJobs && currentPage === 1) {
        try {
          const syncResponse = await api.get('/snapshot/last-sync');
          setLastSync(syncResponse.data.last_sync_at);
        } catch (syncError) {
          console.error('Failed to load last sync time:', syncError);
          setLastSync(null);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJobClick = (job: any) => {
    // Store job info in localStorage so ConversionWorkflow can pick it up
    localStorage.setItem('resume_job', JSON.stringify(job));
    onNewConversion();
  };

  const handleInterfaceJob = async (job: any) => {
    if (!job.can_interface || !job.run_group) {
      alert('This job cannot be interfaced. Missing run group or job not loaded.');
      return;
    }

    const confirmed = confirm(
      `Interface transactions for RunGroup "${job.run_group}" to General Ledger?\n\n` +
      `This will post/journalize ${job.load_success_count} loaded records.`
    );

    if (!confirmed) return;

    setInterfacing(job.id);
    try {
      const response = await api.post(`/upload/jobs/${job.id}/interface`, {
        job_id: job.id,
        run_group: job.run_group,
        enterprise_group: "",
        accounting_entity: "",
        edit_only: false,
        edit_and_interface: false,
        partial_update: false,
        journalize_by_entity: true,
        journal_by_journal_code: false,
        bypass_organization_code: true,
        bypass_account_code: true,
        bypass_structure_relation_edit: false,
        interface_in_detail: true,
        currency_table: "",
        bypass_negative_rate_edit: false,
        primary_ledger: "",
        move_errors_to_new_run_group: false,
        error_run_group_prefix: ""
      });

      alert(`Interface completed successfully for RunGroup: ${job.run_group}`);
      
      // Refresh jobs list to update status
      loadDashboardData();
      
    } catch (error: any) {
      console.error('Interface failed:', error);
      alert(`Interface failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setInterfacing(null);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': '#666666',
      'validating': '#2196F3',
      'validated': '#FFA500',      // Orange - validation passed but not loaded
      'loading': '#2196F3',
      'loaded': '#4CAF50',         // Green - successfully loaded to FSM
      'completed': '#4CAF50',      // Legacy status
      'load_failed': '#C8102E',    // Red - load failed
      'failed': '#C8102E'
    };
    return colors[status] || '#666666';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div style={styles.dashboardContainer}>
      <h1 style={styles.dashboardTitle}>Dashboard</h1>
      
      <div style={styles.quickActions}>
        <button 
          onClick={onNewConversion} 
          style={styles.actionCard}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(200, 16, 46, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={styles.actionIcon}>📤</div>
          <div style={styles.actionTitle}>Start New Conversion</div>
          <div style={styles.actionDesc}>Upload and process a CSV conversion file</div>
        </button>

        <button 
          onClick={onSetupData} 
          style={styles.actionCard}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(33, 150, 243, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={styles.actionIcon}>🔄</div>
          <div style={styles.actionTitle}>Sync Reference Data</div>
          <div style={styles.actionDesc}>Update cached FSM reference data</div>
        </button>

        <button 
          onClick={onViewRules} 
          style={styles.actionCard}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(255, 165, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={styles.actionIcon}>📋</div>
          <div style={styles.actionTitle}>Manage Validation Rules</div>
          <div style={styles.actionDesc}>Configure validation rules for conversions</div>
        </button>
      </div>

      {/* System Status */}
      {!loading && lastSync && (
        <div style={styles.systemStatus}>
          <h3 style={styles.systemStatusTitle}>System Status</h3>
          <div style={styles.statusGrid}>
            <div style={styles.statusItem}>
              <span style={styles.statusLabel}>Last Reference Data Sync:</span>
              <span style={styles.statusValue}>{formatDate(lastSync)}</span>
            </div>
            <div style={styles.statusItem}>
              <span style={styles.statusLabel}>Sync Status:</span>
              <span style={{...styles.statusBadge, backgroundColor: '#4CAF50'}}>Healthy</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Jobs and Quick Metrics sections hidden per user request */}
      {/* Recent Conversion Jobs section hidden per user request
      {loading && (
        <div style={styles.recentJobsSection}>
          <h2 style={styles.sectionTitle}>Recent Conversion Jobs</h2>
          <div style={styles.jobsTable}>
            <div style={styles.tableHeader}>
              <div style={styles.headerCell}>Business Class</div>
              <div style={styles.headerCell}>Filename</div>
              <div style={styles.headerCell}>Records</div>
              <div style={styles.headerCell}>Status</div>
              <div style={styles.headerCell}>Created</div>
              <div style={styles.headerCell}>Actions</div>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} style={styles.tableRow}>
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <div key={j} style={styles.tableCell}>
                    <div style={styles.skeletonText}></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && recentJobs.length > 0 && (
        <div style={styles.recentJobsSection}>
          <h2 style={styles.sectionTitle}>Recent Conversion Jobs</h2>
          <p style={styles.sectionSubtitle}>Click on a job to resume or view details</p>
          <div style={styles.jobsTable}>
            <div style={styles.tableHeader}>
              <div style={styles.headerCell}>Business Class</div>
              <div style={styles.headerCell}>Filename</div>
              <div style={styles.headerCell}>Records</div>
              <div style={styles.headerCell}>Status</div>
              <div style={styles.headerCell}>Created</div>
              <div style={styles.headerCell}>Actions</div>
            </div>
            {recentJobs.map((job) => (
              <div 
                key={job.id} 
                style={{
                  ...styles.tableRow,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onClick={() => handleJobClick(job)}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={styles.tableCell}>{job.business_class}</div>
                <div style={styles.tableCell}>{job.filename}</div>
                <div style={styles.tableCell}>
                  {job.total_records ? (
                    <div>
                      <div>
                        {job.valid_records || 0} / {job.total_records}
                        {job.invalid_records > 0 && (
                          <span style={{ color: '#C8102E', marginLeft: '5px' }}>
                            ({job.invalid_records} errors)
                          </span>
                        )}
                      </div>
                      {(job.load_success_count > 0 || job.load_failure_count > 0) && (
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                          Loaded: {job.load_success_count || 0}
                          {job.load_failure_count > 0 && (
                            <span style={{ color: '#C8102E' }}>
                              , Failed: {job.load_failure_count}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    '-'
                  )}
                </div>
                <div style={styles.tableCell}>
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: getStatusColor(job.status)
                  }}>
                    {job.status}
                  </span>
                </div>
                <div style={styles.tableCell}>{formatDate(job.created_at)}</div>
                <div style={styles.tableCell}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJobClick(job);
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#2196F3',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                      title="Resume or view job details"
                    >
                      View
                    </button>
                    {job.can_interface && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInterfaceJob(job);
                        }}
                        disabled={interfacing === job.id}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: interfacing === job.id ? '#666' : '#FF9800',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: interfacing === job.id ? 'not-allowed' : 'pointer',
                          fontWeight: '500'
                        }}
                        title={`Interface ${job.load_success_count} records to General Ledger`}
                      >
                        {interfacing === job.id ? 'Interfacing...' : 'Interface'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {!showAllJobs && totalJobs > 5 && (
            <div style={styles.paginationContainer}>
              <button 
                onClick={() => setShowAllJobs(true)}
                style={styles.seeMoreButton}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2a2a2a';
                  e.currentTarget.style.borderColor = '#C8102E';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#3a3a3a';
                }}
              >
                See More ({totalJobs - 5} more jobs)
              </button>
            </div>
          )}
          
          {showAllJobs && (
            <div style={styles.paginationContainer}>
              <button 
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1}
                style={{
                  ...styles.paginationButton,
                  opacity: currentPage === 1 ? 0.5 : 1,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 1) {
                    e.currentTarget.style.backgroundColor = '#2a2a2a';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1a1a1a';
                }}
              >
                ← Previous
              </button>
              
              <span style={styles.pageInfo}>
                Page {currentPage} of {Math.ceil(totalJobs / jobsPerPage)}
              </span>
              
              <button 
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage >= Math.ceil(totalJobs / jobsPerPage)}
                style={{
                  ...styles.paginationButton,
                  opacity: currentPage >= Math.ceil(totalJobs / jobsPerPage) ? 0.5 : 1,
                  cursor: currentPage >= Math.ceil(totalJobs / jobsPerPage) ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (currentPage < Math.ceil(totalJobs / jobsPerPage)) {
                    e.currentTarget.style.backgroundColor = '#2a2a2a';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1a1a1a';
                }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && recentJobs.length > 0 && (
        <div style={styles.quickMetrics}>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>{totalJobs}</div>
            <div style={styles.metricLabel}>Total Conversions</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>
              {recentJobs.filter(j => j.status === 'loaded').length}
            </div>
            <div style={styles.metricLabel}>Loaded to FSM</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>
              {recentJobs.filter(j => j.status === 'validated').length}
            </div>
            <div style={styles.metricLabel}>Validated Only</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>
              {recentJobs.filter(j => j.status === 'failed' || j.status === 'load_failed').length}
            </div>
            <div style={styles.metricLabel}>Failed</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>
              {recentJobs.reduce((sum, j) => sum + (j.total_records || 0), 0).toLocaleString()}
            </div>
            <div style={styles.metricLabel}>Records Processed</div>
          </div>
        </div>
      )}
      */}

      <div style={styles.infoCard}>
        <h2 style={styles.infoTitle}>Getting Started</h2>
        <ol style={styles.stepsList}>
          <li>Click "Start New Conversion" to begin a data conversion job</li>
          <li>Upload your CSV file (business class auto-detected from filename)</li>
          <li>Review and adjust field mappings</li>
          <li>Run validation to check data quality</li>
          <li>Export errors or load valid records to FSM</li>
        </ol>
      </div>
    </div>
  );
}

function getEnvironment(tenantId: string): string {
  // Extract environment from tenant_id (e.g., "TAMICS10_AX1" -> "AX1")
  if (!tenantId) return 'DEV';
  
  const parts = tenantId.split('_');
  if (parts.length > 1) {
    return parts[1]; // Return the second part after underscore
  }
  
  return 'DEV';
}

function getEnvironmentBadge(tenantId: string) {
  const env = getEnvironment(tenantId);
  const colors: Record<string, string> = {
    TRN: '#2196F3',
    TST: '#FFA500',
    PRD: '#C8102E',
    AX1: '#2196F3',  // Add AX1 as blue (training/demo)
    AX2: '#FFA500',  // Add AX2 as orange (test)
    AX3: '#C8102E',  // Add AX3 as red (production)
    DEV: '#666666',
  };

  return {
    padding: '6px 14px',
    borderRadius: '6px',
    background: `linear-gradient(135deg, ${colors[env] || '#666666'} 0%, ${colors[env] || '#666666'}dd 100%)`,
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    marginTop: '10px',
    border: `1px solid ${colors[env] || '#666666'}`,
    boxShadow: `0 2px 8px ${colors[env] || '#666666'}33`,
  };
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#000000',
  },
  sidebar: {
    backgroundColor: '#1a1a1a',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    borderRight: '1px solid #2a2a2a',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '1px solid #2a2a2a',
  },
  toggleButton: {
    position: 'absolute' as const,
    right: '-12px',
    top: '20px',
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    border: '1px solid #3a3a3a',
    borderRadius: '4px',
    width: '24px',
    height: '48px',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    zIndex: 10,
    boxShadow: '2px 0 4px rgba(0,0,0,0.3)',
  },
  logoIcon: {
    flexShrink: 0,
  },
  logo: {
    fontSize: '18px',
    fontWeight: '700' as const,
    color: '#ffffff',
    lineHeight: '1.2',
    background: 'linear-gradient(135deg, #C8102E 0%, #ff4458 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  accountInfo: {
    padding: '16px',
    background: 'linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%)',
    borderRadius: '8px',
    marginBottom: '30px',
    border: '1px solid #3a3a3a',
  },
  greetingText: {
    fontSize: '16px',
    fontWeight: '600' as const,
    color: '#ffffff',
    marginBottom: '8px',
  },
  accountDescription: {
    fontSize: '14px',
    color: '#cccccc',
    marginBottom: '8px',
    lineHeight: '1.4',
  },
  highlightText: {
    fontWeight: '600' as const,
    background: 'linear-gradient(135deg, #C8102E 0%, #ff4458 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  tenantInfo: {
    fontSize: '13px',
    color: '#999999',
    marginBottom: '10px',
  },
  tenantLabel: {
    color: '#cccccc',
    fontWeight: '500' as const,
  },
  accountName: {
    fontSize: '16px',
    fontWeight: '600' as const,
    color: '#ffffff',
    marginBottom: '5px',
  },
  projectName: {
    fontSize: '14px',
    color: '#cccccc',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    flex: 1,
  },
  navItem: {
    padding: '12px',
    backgroundColor: 'transparent',
    color: '#cccccc',
    border: 'none',
    borderRadius: '4px',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.2s ease',
    justifyContent: 'flex-start',
    whiteSpace: 'nowrap' as const,
  },
  navItemActive: {
    padding: '12px',
    backgroundColor: '#C8102E',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    justifyContent: 'flex-start',
    whiteSpace: 'nowrap' as const,
  },
  navIcon: {
    fontSize: '18px',
    display: 'inline-block',
    width: '24px',
    textAlign: 'center' as const,
  },
  logoutButton: {
    padding: '12px',
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    border: '1px solid #3a3a3a',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    justifyContent: 'center',
    whiteSpace: 'nowrap' as const,
  },
  main: {
    flex: 1,
    overflow: 'auto',
  },
  dashboardContainer: {
    padding: '40px',
  },
  dashboardTitle: {
    fontSize: '32px',
    fontWeight: '700' as const,
    color: '#ffffff',
    marginBottom: '30px',
  },
  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '40px',
  },
  actionCard: {
    padding: '30px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textAlign: 'center' as const,
  },
  actionIcon: {
    fontSize: '48px',
    marginBottom: '15px',
  },
  actionTitle: {
    fontSize: '18px',
    fontWeight: '600' as const,
    color: '#ffffff',
    marginBottom: '8px',
  },
  actionDesc: {
    fontSize: '14px',
    color: '#999999',
  },
  infoCard: {
    padding: '30px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
  },
  infoTitle: {
    fontSize: '24px',
    fontWeight: '600' as const,
    color: '#ffffff',
    marginBottom: '20px',
  },
  stepsList: {
    color: '#cccccc',
    fontSize: '16px',
    lineHeight: '1.8',
    paddingLeft: '20px',
  },
  syncInfo: {
    padding: '15px 20px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    marginBottom: '30px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  syncLabel: {
    color: '#999999',
    fontSize: '14px',
  },
  syncValue: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600' as const,
  },
  recentJobsSection: {
    marginBottom: '30px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600' as const,
    color: '#ffffff',
    marginBottom: '8px',
  },
  sectionSubtitle: {
    fontSize: '14px',
    color: '#999999',
    marginBottom: '15px',
  },
  jobsTable: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 2fr 1.5fr 1fr 1.5fr 1fr',
    padding: '15px 20px',
    backgroundColor: '#2a2a2a',
    borderBottom: '1px solid #3a3a3a',
  },
  headerCell: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600' as const,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 2fr 1.5fr 1fr 1.5fr 1fr',
    padding: '15px 20px',
    borderBottom: '1px solid #2a2a2a',
  },
  tableCell: {
    color: '#cccccc',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '4px',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  skeletonText: {
    height: '16px',
    backgroundColor: '#2a2a2a',
    borderRadius: '4px',
    animation: 'pulse 1.5s ease-in-out infinite',
    width: '80%',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    backgroundColor: '#1a1a1a',
    border: '2px dashed #2a2a2a',
    borderRadius: '12px',
    marginBottom: '30px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '20px',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: '600' as const,
    color: '#ffffff',
    marginBottom: '12px',
  },
  emptyText: {
    fontSize: '16px',
    color: '#999999',
    marginBottom: '24px',
    lineHeight: '1.6',
  },
  emptyButton: {
    padding: '12px 24px',
    backgroundColor: '#C8102E',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600' as const,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  paginationContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '20px',
    padding: '20px',
    borderTop: '1px solid #2a2a2a',
  },
  seeMoreButton: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    color: '#ffffff',
    border: '1px solid #3a3a3a',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500' as const,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  paginationButton: {
    padding: '10px 20px',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    border: '1px solid #3a3a3a',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500' as const,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  pageInfo: {
    color: '#cccccc',
    fontSize: '14px',
    fontWeight: '500' as const,
  },
  systemStatus: {
    padding: '20px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    marginBottom: '30px',
  },
  systemStatusTitle: {
    fontSize: '18px',
    fontWeight: '600' as const,
    color: '#ffffff',
    marginBottom: '15px',
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '15px',
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  statusLabel: {
    color: '#999999',
    fontSize: '14px',
  },
  statusValue: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600' as const,
  },
  quickMetrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  metricCard: {
    padding: '20px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    textAlign: 'center' as const,
  },
  metricValue: {
    fontSize: '32px',
    fontWeight: '700' as const,
    color: '#C8102E',
    marginBottom: '8px',
  },
  metricLabel: {
    fontSize: '14px',
    color: '#999999',
  },
};

export default App;
