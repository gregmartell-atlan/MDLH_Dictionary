/**
 * useSnowflakeSession - React hook for managing Snowflake session state
 * 
 * Handles connection, disconnection, query execution, and session persistence.
 * The session ID is stored in sessionStorage (cleared on tab close) or 
 * localStorage (persists across sessions) based on your preference.
 */

import { useState, useCallback, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SESSION_STORAGE_KEY = 'snowflake_session';
const CONFIG_STORAGE_KEY = 'snowflake_config';

export function useSnowflakeSession() {
  const [session, setSession] = useState(null);  // { sessionId, user, warehouse, database, role }
  const [isConnecting, setIsConnecting] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [error, setError] = useState(null);

  // ==========================================================================
  // Session Persistence
  // ==========================================================================
  
  // Load session from storage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Validate session is still alive
        validateSession(parsed.sessionId).then(isValid => {
          if (isValid) {
            setSession(parsed);
          } else {
            // Session expired, clear storage
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
          }
        });
      } catch (e) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }, []);

  // Save session to storage when it changes
  useEffect(() => {
    if (session) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [session]);

  // ==========================================================================
  // API Helpers
  // ==========================================================================

  const validateSession = async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/session/status`, {
        headers: { 'X-Session-ID': sessionId }
      });
      const data = await response.json();
      return data.valid === true;
    } catch {
      return false;
    }
  };

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  const connect = useCallback(async (config) => {
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: config.account,
          user: config.user,
          token: config.token,
          warehouse: config.warehouse,
          database: config.database,
          schema_name: config.schema,  // Note: backend uses schema_name
          role: config.role || undefined,
          auth_type: config.authMethod || 'token'
        })
      });

      const result = await response.json();

      if (result.connected && result.session_id) {
        const newSession = {
          sessionId: result.session_id,
          user: result.user,
          warehouse: result.warehouse,
          database: result.database,
          role: result.role
        };
        setSession(newSession);

        // Save config (without sensitive data) for reconnection UI
        const { token, ...safeConfig } = config;
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(safeConfig));

        return { success: true, ...result };
      } else {
        setError(result.error || 'Connection failed');
        return { success: false, error: result.error };
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to connect';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!session?.sessionId) return;

    try {
      await fetch(`${API_BASE_URL}/api/disconnect`, {
        method: 'POST',
        headers: { 'X-Session-ID': session.sessionId }
      });
    } catch {
      // Ignore errors on disconnect
    } finally {
      setSession(null);
      setError(null);
    }
  }, [session]);

  // ==========================================================================
  // Query Execution
  // ==========================================================================

  const executeQuery = useCallback(async (sql, options = {}) => {
    if (!session?.sessionId) {
      return { 
        success: false, 
        error: 'Not connected. Please connect to Snowflake first.' 
      };
    }

    setIsQuerying(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/query/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': session.sessionId
        },
        body: JSON.stringify({
          sql,
          timeout: options.timeout || 60,
          limit: options.limit || 10000
        })
      });

      // Handle session expiration
      if (response.status === 401) {
        setSession(null);
        return { 
          success: false, 
          error: 'Session expired. Please reconnect.',
          sessionExpired: true 
        };
      }

      const result = await response.json();

      if (result.status === 'SUCCESS') {
        // Fetch the results
        const resultsResponse = await fetch(
          `${API_BASE_URL}/api/query/${result.query_id}/results`,
          { headers: { 'X-Session-ID': session.sessionId } }
        );
        const resultsData = await resultsResponse.json();
        
        return {
          success: true,
          queryId: result.query_id,
          columns: resultsData.columns,
          rows: resultsData.rows,
          rowCount: resultsData.total_rows,
          executionTime: result.execution_time_ms
        };
      } else {
        const errorMsg = result.message || result.error || 'Query failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = err.message || 'Query failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsQuerying(false);
    }
  }, [session]);

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  const getSessionStatus = useCallback(async () => {
    if (!session?.sessionId) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/session/status`, {
        headers: { 'X-Session-ID': session.sessionId }
      });
      return await response.json();
    } catch {
      return null;
    }
  }, [session]);

  const getSavedConfig = useCallback(() => {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  // ==========================================================================
  // Return Hook Interface
  // ==========================================================================

  return {
    // State
    session,
    isConnected: !!session,
    isConnecting,
    isQuerying,
    error,
    
    // Connection
    connect,
    disconnect,
    
    // Queries
    executeQuery,
    
    // Utilities
    getSessionStatus,
    getSavedConfig,
    clearError: () => setError(null)
  };
}

export default useSnowflakeSession;

