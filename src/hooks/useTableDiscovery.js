/**
 * useTableDiscovery - Hook to discover available tables from Snowflake
 * 
 * Fetches live table list from the metadata API and provides
 * search/filter capabilities for table selection.
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getSessionId() {
  const stored = sessionStorage.getItem('snowflake_session');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.sessionId;
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Hook to discover tables from a database and schema
 */
export function useTableDiscovery(database, schema) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const discoverTables = useCallback(async (forceRefresh = false) => {
    if (!database || !schema) {
      setTables([]);
      return;
    }

    const sessionId = getSessionId();
    if (!sessionId) {
      setError('Not connected to Snowflake');
      setTables([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/metadata/tables?database=${encodeURIComponent(database)}&schema=${encodeURIComponent(schema)}&refresh=${forceRefresh}`,
        { headers: { 'X-Session-ID': sessionId } }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch tables: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle both array format and object format
      const tableList = Array.isArray(data) ? data : (data.tables || []);
      
      setTables(tableList.map(t => ({
        name: t.name || t,
        kind: t.kind || 'TABLE',
        rowCount: t.rows || t.row_count || 0,
        database: t.database_name || database,
        schema: t.schema_name || schema,
      })));
    } catch (err) {
      console.error('[useTableDiscovery] Error:', err);
      setError(err.message || 'Failed to discover tables');
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [database, schema]);

  useEffect(() => {
    discoverTables(false);
  }, [discoverTables]);

  return {
    tables,
    loading,
    error,
    refresh: () => discoverTables(true),
  };
}

export default useTableDiscovery;
