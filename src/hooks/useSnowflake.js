/**
 * Snowflake hooks - React hooks for managing Snowflake operations
 * 
 * Updated to use session-based backend with X-Session-ID headers.
 */

import { useState, useCallback, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SESSION_KEY = 'snowflake_session';

// =============================================================================
// Session Management Hook
// =============================================================================

export function useConnection() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get session from storage
  const getStoredSession = () => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
    return null;
  };

  // Check if session is valid
  const testConnection = useCallback(async () => {
    setLoading(true);
    setError(null);

    const stored = getStoredSession();
    if (stored?.sessionId) {
      try {
        const res = await fetch(`${API_URL}/api/session/status`, {
          headers: { 'X-Session-ID': stored.sessionId }
        });
        const data = await res.json();
        
        if (data.valid) {
          const sessionStatus = {
            connected: true,
            sessionId: stored.sessionId,
            user: data.user,
            warehouse: data.warehouse,
            database: data.database,
            schema: data.schema_name,
            role: data.role
          };
          setStatus(sessionStatus);
          setLoading(false);
          return sessionStatus;
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }

    setStatus({ connected: false });
    setLoading(false);
    return { connected: false };
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    const stored = getStoredSession();
    if (stored?.sessionId) {
      try {
        await fetch(`${API_URL}/api/disconnect`, {
          method: 'POST',
          headers: { 'X-Session-ID': stored.sessionId }
        });
      } catch {
        // Ignore errors
      }
    }
    sessionStorage.removeItem(SESSION_KEY);
    setStatus({ connected: false });
  }, []);

  // Load session on mount
  useEffect(() => {
    testConnection();
  }, []);

  return { status, testConnection, disconnect, loading, error };
}

// =============================================================================
// Query Execution Hook
// =============================================================================

export function useQuery() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getSessionId = () => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).sessionId;
      } catch {
        return null;
      }
    }
    return null;
  };

  const executeQuery = useCallback(async (sql, options = {}) => {
    const sessionId = getSessionId();
    if (!sessionId) {
      setError('Not connected. Please connect to Snowflake first.');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/query/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({
          sql,
          database: options.database,
          schema_name: options.schema,
          warehouse: options.warehouse,
          timeout: options.timeout || 60,
          limit: options.limit || 10000
        })
      });

      // Handle session expiration
      if (response.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        setError('Session expired. Please reconnect.');
        setResults(null);
        return null;
      }

      const data = await response.json();

      if (data.status === 'SUCCESS') {
        // Fetch results
        const resultsRes = await fetch(
          `${API_URL}/api/query/${data.query_id}/results`,
          { headers: { 'X-Session-ID': sessionId } }
        );
        
        // Check for errors in results fetch
        if (!resultsRes.ok) {
          // If results fetch failed, still show what we know from the execute response
          console.warn(`[Query] Results fetch failed (${resultsRes.status}), using execute response`);
          const result = {
            columns: [],
            rows: [],
            rowCount: data.row_count || 0,
            executionTime: data.execution_time_ms,
            warning: `Results fetch failed: ${resultsRes.status}`
          };
          setResults(result);
          return result;
        }
        
        const resultsData = await resultsRes.json();

        const result = {
          columns: resultsData.columns || [],
          rows: resultsData.rows || [],
          rowCount: resultsData.total_rows ?? resultsData.rows?.length ?? data.row_count ?? 0,
          executionTime: data.execution_time_ms
        };
        setResults(result);
        return result;
      } else {
        setError(data.message || 'Query failed');
        return { success: false, error: data.message };
      }
    } catch (err) {
      setError(err.message || 'Query failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return { results, loading, error, executeQuery, clearResults };
}

// =============================================================================
// Preflight Check Hook
// =============================================================================

export function usePreflight() {
  const [preflightResult, setPreflightResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const getSessionId = () => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).sessionId;
      } catch {
        return null;
      }
    }
    return null;
  };

  const runPreflight = useCallback(async (sql, options = {}) => {
    const sessionId = getSessionId();
    if (!sessionId) {
      return { valid: false, message: 'Not connected' };
    }

    setLoading(true);
    setPreflightResult(null);

    try {
      const response = await fetch(`${API_URL}/api/query/preflight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({
          sql,
          database: options.database,
          schema_name: options.schema
        })
      });

      if (response.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        return { valid: false, message: 'Session expired' };
      }

      const data = await response.json();
      setPreflightResult(data);
      return data;
    } catch (err) {
      const error = { valid: false, message: err.message, issues: [err.message] };
      setPreflightResult(error);
      return error;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearPreflight = useCallback(() => {
    setPreflightResult(null);
  }, []);

  return { preflightResult, loading, runPreflight, clearPreflight };
}

// =============================================================================
// Query History Hook
// =============================================================================

export function useQueryHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/query/history?limit=50`);
      const data = await res.json();
      setHistory(data.items || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { history, fetchHistory, loading };
}

// =============================================================================
// Metadata Hook
// =============================================================================

export function useMetadata() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getSessionId = () => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).sessionId;
      } catch {
        return null;
      }
    }
    return null;
  };

  const fetchDatabases = useCallback(async (refresh = false) => {
    const sessionId = getSessionId();
    if (!sessionId) return [];

    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/metadata/databases?refresh=${refresh}`,
        { headers: { 'X-Session-ID': sessionId } }
      );
      return await res.json();
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchemas = useCallback(async (database, refresh = false) => {
    const sessionId = getSessionId();
    if (!sessionId) return [];

    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/metadata/schemas?database=${encodeURIComponent(database)}&refresh=${refresh}`,
        { headers: { 'X-Session-ID': sessionId } }
      );
      return await res.json();
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTables = useCallback(async (database, schema, refresh = false) => {
    const sessionId = getSessionId();
    if (!sessionId) return [];

    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/metadata/tables?database=${encodeURIComponent(database)}&schema=${encodeURIComponent(schema)}&refresh=${refresh}`,
        { headers: { 'X-Session-ID': sessionId } }
      );
      return await res.json();
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchColumns = useCallback(async (database, schema, table, refresh = false) => {
    const sessionId = getSessionId();
    if (!sessionId) return [];

    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/metadata/columns?database=${encodeURIComponent(database)}&schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(table)}&refresh=${refresh}`,
        { headers: { 'X-Session-ID': sessionId } }
      );
      return await res.json();
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchDatabases,
    fetchSchemas,
    fetchTables,
    fetchColumns
  };
}

// =============================================================================
// Batch Validation Hook
// =============================================================================

export function useBatchValidation() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getSessionId = () => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).sessionId;
      } catch {
        return null;
      }
    }
    return null;
  };

  const validateBatch = useCallback(async (queries, options = {}) => {
    const sessionId = getSessionId();
    if (!sessionId) {
      setError('Not connected');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/query/validate-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({
          queries,
          database: options.database,
          schema_name: options.schema,
          include_samples: options.includeSamples ?? true,
          sample_limit: options.sampleLimit ?? 3
        })
      });

      if (response.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        setError('Session expired');
        return null;
      }

      const data = await response.json();
      setResults(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return { results, loading, error, validateBatch, clearResults };
}

// =============================================================================
// Query Explanation Hook
// =============================================================================

export function useQueryExplanation() {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getSessionId = () => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).sessionId;
      } catch {
        return null;
      }
    }
    return null;
  };

  const explainQuery = useCallback(async (sql, options = {}) => {
    const sessionId = getSessionId();
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/query/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionId && { 'X-Session-ID': sessionId })
        },
        body: JSON.stringify({
          sql,
          include_execution: options.includeExecution ?? !!sessionId
        })
      });

      if (response.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
      }

      const data = await response.json();
      setExplanation(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearExplanation = useCallback(() => {
    setExplanation(null);
    setError(null);
  }, []);

  return { explanation, loading, error, explainQuery, clearExplanation };
}

export default { useConnection, useQuery, useQueryHistory, useMetadata, usePreflight, useBatchValidation, useQueryExplanation };
