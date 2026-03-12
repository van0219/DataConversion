import { useEffect } from 'react';
import { theme } from '../theme';

interface LoadingScreenProps {
  message?: string;
  minDuration?: number; // in milliseconds
  onComplete?: () => void;
}

export default function LoadingScreen({ 
  message = 'Loading...', 
  minDuration = 0,
  onComplete 
}: LoadingScreenProps) {
  
  useEffect(() => {
    if (minDuration > 0 && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, minDuration);
      
      return () => clearTimeout(timer);
    }
  }, [minDuration, onComplete]);

  return (
    <>
      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
      
      {/* Loading Overlay */}
      <div style={styles.loadingOverlay}>
        <div style={styles.loadingContent}>
          <svg width="80" height="80" viewBox="0 0 64 64" style={styles.loadingLogo}>
            <circle cx="32" cy="32" r="32" fill="#FFFFFF"/>
            <text x="32" y="42" fontFamily="Arial, sans-serif" fontSize="32" fontWeight="bold" fill="#4600AF" textAnchor="middle">DB</text>
            <line x1="16" y1="50" x2="48" y2="50" stroke="#4600AF" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="16" cy="50" r="3" fill="#4600AF"/>
            <circle cx="48" cy="50" r="3" fill="#4600AF"/>
          </svg>
          <div style={styles.loadingSpinner}></div>
          <div style={styles.loadingText}>{message}</div>
        </div>
      </div>
    </>
  );
}

const styles = {
  loadingOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(247, 247, 251, 0.98)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '30px',
  },
  loadingLogo: {
    animation: 'pulse 2s ease-in-out infinite',
  },
  loadingSpinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #E6E6EF',
    borderTop: '4px solid #4600AF',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: theme.text.primary,
    fontSize: '18px',
    fontWeight: '500' as const,
  },
};
