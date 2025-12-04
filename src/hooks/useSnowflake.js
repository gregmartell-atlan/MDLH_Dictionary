/**
 * React hooks for Snowflake API interactions
 */

import { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:8000/api';

/**
 * Hook for managing Snowflake connection
 */
export function useConnection() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const testConnection = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setStatus(data);
      if (!data.connected) {
        setError(data.error || 'Connection failed');
      }
      return data;
    } catch (err) {
      setError(err.message);
      setStatus({ connected: false, error: err.message });
      return { connected: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/session/status`);
      const data = await res.json();
      setStatus(data);
      return data;
    } catch (err) {
      setError(err.message);
      return { connected: false, error: err.message };
    }
  }, []);

  return { status, loading, error, testConnection, checkSession };
}

/**
 * Hook for fetching metadata (databases, schemas, tables, columns)
 */
export function useMetadata() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDatabases = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/metadata/databases?refresh=${refresh}`);
      if (!res.ok) throw new Error('Failed to fetch databases');
      return await res.json();
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchemas = useCallback(async (database, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/metadata/schemas?database=${database}&refresh=${refresh}`);
      if (!res.ok) throw new Error('Failed to fetch schemas');
      return await res.json();
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTables = useCallback(async (database, schema, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/metadata/tables?database=${database}&schema=${schema}&refresh=${refresh}`);
      if (!res.ok) throw new Error('Failed to fetch tables');
      return await res.json();
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchColumns = useCallback(async (database, schema, table, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/metadata/columns?database=${database}&schema=${schema}&table=${table}&refresh=${refresh}`);
      if (!res.ok) throw new Error('Failed to fetch columns');
      return await res.json();
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCache = useCallback(async (database, schema, table) => {
    try {
      const params = new URLSearchParams();
      if (database) params.append('database', database);
      if (schema) params.append('schema', schema);
      if (table) params.append('table', table);
      
      await fetch(`${API_BASE}/metadata/refresh?${params}`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to refresh cache:', err);
    }
  }, []);

  return {
    loading,
    error,
    fetchDatabases,
    fetchSchemas,
    fetchTables,
    fetchColumns,
    refreshCache
  };
}

/**
 * Hook for executing queries
 */
export function useQuery() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [status, setStatus] = useState(null);

  const executeQuery = useCallback(async (sql, options = {}) => {
    setLoading(true);
    setError(null);
    setResults(null);
    setStatus({ status: 'RUNNING' });

    try {
      const res = await fetch(`${API_BASE}/query/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql,
          database: options.database,
          schema: options.schema,
          warehouse: options.warehouse,
          timeout: options.timeout || 60,
          limit: options.limit || 10000
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Query execution failed');
      }

      const submitResult = await res.json();
      setStatus(submitResult);

      // If query completed (success or fail), fetch results
      if (submitResult.status === 'SUCCESS') {
        const resultsRes = await fetch(`${API_BASE}/query/${submitResult.query_id}/results`);
        if (resultsRes.ok) {
          const resultsData = await resultsRes.json();
          setResults(resultsData);
        }
      } else if (submitResult.status === 'FAILED') {
        // Fetch status to get error message
        const statusRes = await fetch(`${API_BASE}/query/${submitResult.query_id}/status`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setError(statusData.error_message || 'Query failed');
          setStatus(statusData);
        }
      }

      return submitResult;
    } catch (err) {
      setError(err.message);
      setStatus({ status: 'FAILED', error_message: err.message });
      return { status: 'FAILED', error_message: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchResults = useCallback(async (queryId, page = 1, pageSize = 100) => {
    try {
      const res = await fetch(`${API_BASE}/query/${queryId}/results?page=${page}&page_size=${pageSize}`);
      if (!res.ok) throw new Error('Failed to fetch results');
      const data = await res.json();
      setResults(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const cancelQuery = useCallback(async (queryId) => {
    try {
      await fetch(`${API_BASE}/query/${queryId}/cancel`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to cancel query:', err);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setStatus(null);
    setError(null);
  }, []);

  return {
    loading,
    error,
    results,
    status,
    executeQuery,
    fetchResults,
    cancelQuery,
    clearResults
  };
}

/**
 * Hook for query history
 */
export function useQueryHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchHistory = useCallback(async (limit = 50, offset = 0, status = null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit, offset });
      if (status) params.append('status', status);
      
      const res = await fetch(`${API_BASE}/query/history?${params}`);
      if (!res.ok) throw new Error('Failed to fetch history');
      
      const data = await res.json();
      setHistory(data.items);
      setTotal(data.total);
      return data;
    } catch (err) {
      console.error('Failed to fetch history:', err);
      return { items: [], total: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/query/history`, { method: 'DELETE' });
      setHistory([]);
      setTotal(0);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }, []);

  return { history, loading, total, fetchHistory, clearHistory };
}

