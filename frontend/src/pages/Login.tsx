import { useState, useEffect } from 'react';
import api from '../services/api';
import LoadingScreen from '../components/LoadingScreen';
import { useLoading } from '../hooks/useLoading';

interface Account {
  id: number;
  account_name: string;
  project_name: string;
}

export default function Login() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const { isLoading, loadingMessage, withLoading } = useLoading();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await api.get('/accounts/list');
      setAccounts(response.data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await withLoading(async () => {
        const response = await api.post('/accounts/login', {
          account_name: selectedAccount,
          password: password
        });

        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('refresh_token', response.data.refresh_token);
        localStorage.setItem('account', JSON.stringify(response.data.account));
      }, 3, 'Logging in...');
      
      // Small delay to ensure loading screen stays visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Redirect after loading completes
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    }
  };

  if (showCreateAccount) {
    return <CreateAccount onBack={() => setShowCreateAccount(false)} onSuccess={loadAccounts} />;
  }

  return (
    <div style={styles.container}>
      {/* Global Loading Screen */}
      {isLoading && <LoadingScreen message={loadingMessage} />}
      
      <div style={styles.leftPanel}>
        <div style={styles.card}>
          <h1 style={styles.title}>FSM DataBridge</h1>
        
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              style={styles.select}
              required
            >
              <option value="" style={styles.option}>Select Account</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.account_name} style={styles.option}>
                  {acc.project_name ? `${acc.account_name} (${acc.project_name})` : acc.account_name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#C8102E';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(200, 16, 46, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#3a3a3a';
                e.currentTarget.style.boxShadow = 'none';
              }}
              required
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button 
            type="submit" 
            style={styles.button} 
            disabled={isLoading}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(200, 16, 46, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(200, 16, 46, 0.3)';
            }}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>

          <button
            type="button"
            onClick={() => setShowCreateAccount(true)}
            style={styles.linkButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ff4458';
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#C8102E';
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Create New Account
          </button>
        </form>
      </div>
      </div>
      
      <div style={styles.rightPanel}>
        <div style={styles.brandingContent}>
          <div style={styles.logoContainer}>
            <svg width="140" height="140" viewBox="0 0 64 64" style={styles.logoCircle}>
              <circle cx="32" cy="32" r="32" fill="#000000"/>
              <text x="32" y="42" fontFamily="Arial, sans-serif" fontSize="32" fontWeight="bold" fill="#C8102E" textAnchor="middle">DB</text>
              <line x1="16" y1="50" x2="48" y2="50" stroke="#C8102E" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="16" cy="50" r="3" fill="#FFFFFF"/>
              <circle cx="48" cy="50" r="3" fill="#FFFFFF"/>
            </svg>
          </div>
          <h2 style={styles.brandTitle}>Data Conversion Workbench</h2>
          <p style={styles.brandSubtitle}>Convert and load data into Infor FSM</p>
          
          <div style={styles.featureList}>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>✓</span>
              <span style={styles.featureText}>Intelligent field mapping with auto-detection</span>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>✓</span>
              <span style={styles.featureText}>Real-time validation with detailed error reporting</span>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>✓</span>
              <span style={styles.featureText}>Streaming architecture for millions of records</span>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>✓</span>
              <span style={styles.featureText}>Secure credential management with encryption</span>
            </div>
          </div>
          
          <div style={styles.versionInfo}>
            <span style={styles.versionText}>Version 1.0.0</span>
            <span style={styles.versionDivider}>•</span>
            <span style={styles.versionText}>March 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateAccount({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    account_name: '',
    project_name: '',
    tenant_id: '',
    username: '',
    password: ''
  });
  const [ionapiFile, setIonapiFile] = useState<File | null>(null);
  const [ionapiData, setIonapiData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.ionapi')) {
      setError('Please select a valid .ionapi file');
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate required fields
      if (!data.iu || !data.ci || !data.cs || !data.ti || !data.pu || !data.saak || !data.sask) {
        setError('Invalid .ionapi file: missing required fields (iu, ci, cs, ti, pu, saak, sask)');
        return;
      }

      setIonapiFile(file);
      setIonapiData(data);
      setFormData(prev => ({ ...prev, tenant_id: data.ti }));
      setError('');
    } catch (err) {
      setError('Failed to parse .ionapi file. Please check the file format.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!ionapiData) {
      setError('Please upload a .ionapi file');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        account_name: formData.account_name,
        project_name: formData.project_name,
        tenant_id: ionapiData.ti,
        base_url: ionapiData.iu,
        oauth_url: ionapiData.pu,
        client_id: ionapiData.ci,
        client_secret: ionapiData.cs,
        saak: ionapiData.saak,
        sask: ionapiData.sask,
        username: formData.username,
        password: formData.password
      };

      await api.post('/accounts/', payload);
      onSuccess();
      onBack();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.leftPanel}>
        <div style={styles.card}>
          <h1 style={styles.title}>Create New Account</h1>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Account Name</label>
            <input
              type="text"
              value={formData.account_name}
              onChange={(e) => setFormData({...formData, account_name: e.target.value})}
              style={styles.input}
              placeholder="e.g., BayCare_TRN"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Project Name</label>
            <input
              type="text"
              value={formData.project_name}
              onChange={(e) => setFormData({...formData, project_name: e.target.value})}
              style={styles.input}
              placeholder="e.g., BayCare"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Upload .ionapi File</label>
            <input
              type="file"
              accept=".ionapi"
              onChange={handleFileChange}
              style={styles.fileInput}
              required
            />
            {ionapiFile && (
              <div style={styles.fileInfo}>
                ✓ {ionapiFile.name} (Tenant: {ionapiData?.ti})
              </div>
            )}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Tenant ID</label>
            <input
              type="text"
              value={formData.tenant_id}
              onChange={(e) => setFormData({...formData, tenant_id: e.target.value})}
              style={styles.input}
              placeholder="Auto-filled from .ionapi file"
              disabled
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              style={styles.input}
              placeholder="Your username"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              style={styles.input}
              placeholder="Your password"
              minLength={8}
              required
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button 
            type="submit" 
            style={styles.button} 
            disabled={loading}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(200, 16, 46, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(200, 16, 46, 0.3)';
            }}
          >
            {loading ? 'Creating...' : 'Create Account'}
          </button>

          <button 
            type="button" 
            onClick={onBack} 
            style={styles.linkButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ff4458';
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#C8102E';
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Back to Login
          </button>
        </form>
      </div>
      </div>
      
      <div style={styles.rightPanel}>
        <div style={styles.brandingContent}>
          <div style={styles.logoContainer}>
            <svg width="140" height="140" viewBox="0 0 64 64" style={styles.logoCircle}>
              <circle cx="32" cy="32" r="32" fill="#000000"/>
              <text x="32" y="42" fontFamily="Arial, sans-serif" fontSize="32" fontWeight="bold" fill="#C8102E" textAnchor="middle">DB</text>
              <line x1="16" y1="50" x2="48" y2="50" stroke="#C8102E" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="16" cy="50" r="3" fill="#FFFFFF"/>
              <circle cx="48" cy="50" r="3" fill="#FFFFFF"/>
            </svg>
          </div>
          <h2 style={styles.brandTitle}>Data Conversion Workbench</h2>
          <p style={styles.brandSubtitle}>Convert and load data into Infor FSM</p>
          
          <div style={styles.featureList}>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>✓</span>
              <span style={styles.featureText}>Intelligent field mapping with auto-detection</span>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>✓</span>
              <span style={styles.featureText}>Real-time validation with detailed error reporting</span>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>✓</span>
              <span style={styles.featureText}>Streaming architecture for millions of records</span>
            </div>
            <div style={styles.featureItem}>
              <span style={styles.featureIcon}>✓</span>
              <span style={styles.featureText}>Secure credential management with encryption</span>
            </div>
          </div>
          
          <div style={styles.versionInfo}>
            <span style={styles.versionText}>Version 1.0.0</span>
            <span style={styles.versionDivider}>•</span>
            <span style={styles.versionText}>March 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#000000',
    position: 'relative' as const,
  },
  leftPanel: {
    flex: '0 0 450px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    backgroundColor: '#000000',
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  card: {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #1f1f1f 100%)',
    padding: '50px 40px',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '450px',
    boxShadow: '0 8px 32px rgba(200, 16, 46, 0.2)',
    border: '1px solid #2a2a2a',
  },
  brandingContent: {
    maxWidth: '600px',
    padding: '60px',
    textAlign: 'center' as const,
  },
  logoContainer: {
    marginBottom: '40px',
  },
  logoCircle: {
    width: '140px',
    height: '140px',
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    background: 'linear-gradient(135deg, #ffffff 0%, #cccccc 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontSize: '36px',
    fontWeight: '700' as const,
    marginBottom: '16px',
    lineHeight: '1.2',
  },
  brandSubtitle: {
    color: '#999999',
    fontSize: '18px',
    marginBottom: '60px',
    lineHeight: '1.5',
  },
  featureList: {
    textAlign: 'left' as const,
    marginBottom: '60px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '24px',
    color: '#cccccc',
    transition: 'transform 0.2s ease',
  },
  featureIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #C8102E 0%, #ff4458 100%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '16px',
    marginRight: '16px',
    fontWeight: '700' as const,
    flexShrink: 0,
  },
  featureText: {
    fontSize: '16px',
    lineHeight: '1.5',
  },
  versionInfo: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    color: '#666666',
    fontSize: '14px',
  },
  versionText: {
    color: '#666666',
  },
  versionDivider: {
    color: '#444444',
  },
  title: {
    background: 'linear-gradient(135deg, #C8102E 0%, #ff4458 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontSize: '32px',
    fontWeight: '700' as const,
    marginBottom: '40px',
    textAlign: 'center' as const,
    lineHeight: '1.3',
    paddingBottom: '4px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  label: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600' as const,
  },
  input: {
    padding: '14px 16px',
    background: 'linear-gradient(135deg, #2a2a2a 0%, #252525 100%)',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '15px',
    transition: 'all 0.3s ease',
  },
  select: {
    padding: '14px 16px',
    background: 'linear-gradient(135deg, #2a2a2a 0%, #252525 100%)',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '15px',
    transition: 'all 0.3s ease',
  },
  option: {
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    padding: '10px',
  },
  button: {
    padding: '16px',
    background: 'linear-gradient(135deg, #C8102E 0%, #a00d25 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600' as const,
    cursor: 'pointer',
    marginTop: '10px',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(200, 16, 46, 0.3)',
  },
  linkButton: {
    padding: '12px',
    backgroundColor: 'transparent',
    color: '#C8102E',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontWeight: '500' as const,
  },
  error: {
    color: '#ff6b6b',
    fontSize: '14px',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, rgba(200, 16, 46, 0.15) 0%, rgba(200, 16, 46, 0.1) 100%)',
    borderRadius: '8px',
    border: '1px solid rgba(200, 16, 46, 0.3)',
  },
  fileInput: {
    padding: '14px 16px',
    background: 'linear-gradient(135deg, #2a2a2a 0%, #252525 100%)',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '15px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  fileInfo: {
    color: '#4ade80',
    fontSize: '13px',
    marginTop: '8px',
    padding: '8px 12px',
    background: 'rgba(74, 222, 128, 0.1)',
    borderRadius: '6px',
    border: '1px solid rgba(74, 222, 128, 0.2)',
  },
};




