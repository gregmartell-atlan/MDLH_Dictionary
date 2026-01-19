/**
 * ConnectionContext - Centralized Snowflake connection state management
 * 
 * Provides a single source of truth for connection status across the app.
 * Components can use useConnectionContext() instead of individually tracking state.
 * 
 * Features:
 * - Centralized connection status (connected, unreachable, user, database, etc.)
 * - Automatic session validation on mount
 * - Periodic health checks (configurable)
 * - Event-based sync across browser tabs
 * - Memoized values to prevent unnecessary re-renders
 * 
 * Usage:
 * ```jsx
 * // In App.jsx
 * import { ConnectionProvider } from './context/ConnectionContext';
 * 
 * function App() {
 *   return (
 *     <ConnectionProvider>
 *       <YourApp />
 *     </ConnectionProvider>
 *   );
 * }
 * 
 * // In any component
 * import { useConnectionContext } from '../context/ConnectionContext';
 * 
 * function MyComponent() {
 *   const { status, testConnection, disconnect, openConnectionModal } = useConnectionContext();
 *   
 *   if (!status.connected) {
 *     return <button onClick={openConnectionModal}>Connect</button>;
 *   }
 *   
 *   return <div>Connected as {status.user}</div>;
 * }
 * ```
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createLogger } from '../utils/logger';
import { getPythonApiUrl, SESSION_STORAGE_KEY } from '../config/api';
import { TIMEOUTS, CONNECTION_CONFIG } from '../data/constants';

const log = createLogger('ConnectionContext');
const API_URL = getPythonApiUrl();

// Default context value (for components outside provider)
const defaultContextValue = {
  status: { connected: false, unreachable: false },
  loading: false,
  error: null,
  sessionId: null,
  testConnection: async () => ({ connected: false }),
  disconnect: async () => {},
  showConnectionModal: false,
  openConnectionModal: () => {},
  closeConnectionModal: () => {},
  setConnectionModalOpen: () => {},
};

const ConnectionContext = createContext(defaultContextValue);

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Get stored session from sessionStorage
 */
function getStoredSession() {
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

/**
 * ConnectionProvider - Wraps app with connection context
 */
export function ConnectionProvider({ children }) {
  const [status, setStatus] = useState({ connected: false, unreachable: false });
  const [loading, setLoading] = useState(true); // Start as loading to check session
  const [error, setError] = useState(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  
  // Refs for preventing race conditions and avoiding stale closures
  const pendingTestRef = useRef(null);
  const consecutiveTimeoutsRef = useRef(0);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);
  const statusRef = useRef(status); // Track current status for use in callbacks
  statusRef.current = status; // Keep ref in sync with state
  
  /**
   * Test/validate the current session with backend
   */
  const testConnection = useCallback(async () => {
    // Promise mutex pattern - prevent concurrent tests
    if (pendingTestRef.current) {
      log.debug('Test already in progress, returning pending promise');
      return pendingTestRef.current;
    }
    
    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    pendingTestRef.current = (async () => {
      if (!mountedRef.current) return statusRef.current;
      
      const stored = getStoredSession();
      
      if (!stored?.sessionId) {
        log.debug('No stored session');
        consecutiveTimeoutsRef.current = 0;
        const noSession = { connected: false, unreachable: false };
        setStatus(noSession);
        setLoading(false);
        setError(null);
        return noSession;
      }
      
      log.debug('Checking session', { sessionIdPrefix: stored.sessionId.substring(0, 8) });
      
      try {
        const res = await fetchWithTimeout(
          `${API_URL}/api/session/status`,
          {
            headers: { 'X-Session-ID': stored.sessionId },
            signal: abortControllerRef.current.signal,
          },
          TIMEOUTS.SESSION_STATUS_MS || 5000
        );
        
        // Handle explicit session invalid (401/404)
        if (res.status === 401 || res.status === 404) {
          let reason = 'unknown';
          try {
            const data = await res.json();
            reason = data.reason || 'unknown';
          } catch {}
          
          log.warn('Session invalid', { status: res.status, reason });
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          consecutiveTimeoutsRef.current = 0;
          
          const invalidStatus = { connected: false, unreachable: false, reason };
          if (mountedRef.current) {
            setStatus(invalidStatus);
            setLoading(false);
          }
          return invalidStatus;
        }
        
        // Handle 503 (Snowflake unreachable)
        if (res.status === 503) {
          consecutiveTimeoutsRef.current += 1;
          log.warn('Backend returned 503', { timeouts: consecutiveTimeoutsRef.current });
          throw new Error('Backend returned 503');
        }
        
        const data = await res.json();
        
        if (data.valid) {
          consecutiveTimeoutsRef.current = 0;
          const validStatus = {
            connected: true,
            unreachable: false,
            sessionId: stored.sessionId,
            user: data.user,
            warehouse: data.warehouse,
            database: data.database,
            schema: data.schema_name,
            role: data.role,
          };
          
          if (mountedRef.current) {
            setStatus(validStatus);
            setLoading(false);
            setError(null);
          }
          
          log.info('Session valid', { user: data.user, database: data.database });
          return validStatus;
        } else {
          log.warn('Session marked invalid by backend');
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          consecutiveTimeoutsRef.current = 0;
          
          const invalidStatus = { connected: false, unreachable: false };
          if (mountedRef.current) {
            setStatus(invalidStatus);
            setLoading(false);
          }
          return invalidStatus;
        }
      } catch (err) {
        // Handle abort
        if (err.name === 'AbortError' && abortControllerRef.current?.signal?.aborted) {
          log.debug('Request was aborted');
          return statusRef.current;
        }
        
        consecutiveTimeoutsRef.current += 1;
        log.warn('Session check failed', { 
          error: err.message, 
          timeouts: consecutiveTimeoutsRef.current 
        });
        
        // After threshold, mark as unreachable
        if (consecutiveTimeoutsRef.current >= (CONNECTION_CONFIG.TIMEOUT_THRESHOLD || 3)) {
          log.warn('Too many failures - marking unreachable');
          const unreachableStatus = { connected: false, unreachable: true };
          if (mountedRef.current) {
            setStatus(unreachableStatus);
            setLoading(false);
            setError('MDLH API is unreachable. Please check your connection.');
          }
          return unreachableStatus;
        }
        
        // Below threshold - optimistically trust stored session
        const assumedStatus = {
          connected: true,
          unreachable: false,
          sessionId: stored.sessionId,
          user: stored.user,
          warehouse: stored.warehouse,
          database: stored.database,
          schema: stored.schema,
          role: stored.role,
        };
        
        if (mountedRef.current) {
          setStatus(assumedStatus);
          setLoading(false);
        }
        
        log.debug('Assuming session valid despite check failure');
        return assumedStatus;
      }
    })();
    
    try {
      return await pendingTestRef.current;
    } finally {
      pendingTestRef.current = null;
    }
  }, []); // FIXED: Empty deps - status is accessed via ref pattern to avoid infinite loops
  
  /**
   * Disconnect and clear session
   */
  const disconnect = useCallback(async () => {
    log.info('Disconnecting');
    
    const stored = getStoredSession();
    if (stored?.sessionId) {
      try {
        await fetchWithTimeout(
          `${API_URL}/api/disconnect`,
          {
            method: 'POST',
            headers: { 'X-Session-ID': stored.sessionId },
          },
          5000
        );
        log.info('Backend disconnect successful');
      } catch (err) {
        log.warn('Backend disconnect failed', { error: err.message });
      }
    }
    
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    consecutiveTimeoutsRef.current = 0;
    
    setStatus({ connected: false, unreachable: false });
    setError(null);
    
    // Notify other components/tabs
    window.dispatchEvent(new CustomEvent('snowflake-session-cleared', {
      detail: { reason: 'user-disconnect' }
    }));
    
    log.info('Session cleared');
  }, []);
  
  /**
   * Open/close connection modal
   */
  const openConnectionModal = useCallback(() => {
    log.debug('Opening connection modal');
    setShowConnectionModal(true);
  }, []);
  
  const closeConnectionModal = useCallback(() => {
    log.debug('Closing connection modal');
    setShowConnectionModal(false);
  }, []);
  
  /**
   * Handle session change events (from ConnectionModal or other sources)
   */
  useEffect(() => {
    const handleSessionChange = (event) => {
      log.debug('Session change event received', { 
        connected: event.detail?.connected,
        hasSessionId: !!event.detail?.sessionId 
      });
      
      // If event indicates connected, update immediately
      if (event.detail?.connected || event.detail?.sessionId) {
        const stored = getStoredSession();
        if (stored) {
          setStatus({
            connected: true,
            unreachable: false,
            sessionId: stored.sessionId,
            user: stored.user,
            warehouse: stored.warehouse,
            database: stored.database,
            schema: stored.schema,
            role: stored.role,
          });
          setLoading(false);
          setError(null);
          consecutiveTimeoutsRef.current = 0;
        }
      }
      
      // Also re-validate with backend
      testConnection();
    };
    
    const handleSessionCleared = (event) => {
      log.info('Session cleared event', { reason: event.detail?.reason });
      consecutiveTimeoutsRef.current = 0;
      setStatus({ connected: false, unreachable: false });
      setError(null);
    };
    
    window.addEventListener('snowflake-session-changed', handleSessionChange);
    window.addEventListener('snowflake-session-cleared', handleSessionCleared);
    
    return () => {
      window.removeEventListener('snowflake-session-changed', handleSessionChange);
      window.removeEventListener('snowflake-session-cleared', handleSessionCleared);
    };
  }, [testConnection]);
  
  /**
   * Check session on mount
   */
  useEffect(() => {
    mountedRef.current = true;
    testConnection();
    
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [testConnection]);
  
  /**
   * Periodic health check (every 30 seconds when connected)
   */
  useEffect(() => {
    if (!status.connected) return;
    
    const interval = setInterval(() => {
      log.debug('Periodic session check');
      testConnection();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [status.connected, testConnection]);
  
  /**
   * Listen for storage changes (other tabs)
   */
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === SESSION_STORAGE_KEY) {
        log.debug('Storage change detected');
        testConnection();
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [testConnection]);
  
  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    status,
    loading,
    error,
    sessionId: status.sessionId || null,
    testConnection,
    disconnect,
    showConnectionModal,
    openConnectionModal,
    closeConnectionModal,
    setConnectionModalOpen: setShowConnectionModal,
  }), [
    status,
    loading,
    error,
    testConnection,
    disconnect,
    showConnectionModal,
    openConnectionModal,
    closeConnectionModal,
  ]);
  
  return (
    <ConnectionContext.Provider value={contextValue}>
      {children}
    </ConnectionContext.Provider>
  );
}

/**
 * Hook to access connection context
 * @throws {Error} If used outside ConnectionProvider
 */
export function useConnectionContext() {
  const context = useContext(ConnectionContext);
  
  // In development, warn if used outside provider
  if (context === defaultContextValue && process.env.NODE_ENV === 'development') {
    console.warn('useConnectionContext used outside ConnectionProvider - using defaults');
  }
  
  return context;
}

/**
 * HOC to inject connection props into class components
 */
export function withConnection(Component) {
  return function WrappedComponent(props) {
    const connection = useConnectionContext();
    return <Component {...props} connection={connection} />;
  };
}

export default ConnectionContext;
