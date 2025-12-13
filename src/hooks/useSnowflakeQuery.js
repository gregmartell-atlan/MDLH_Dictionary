/**
 * React Query-powered Snowflake hooks
 *
 * Provides Snowflake/Databricks-like caching:
 * - Instant results for repeated queries (from cache)
 * - Background refresh keeps data fresh
 * - Automatic retry with exponential backoff
 * - Prefetch on hover for instant navigation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import { queryKeys, CACHE_CONFIG, prefetchQuery } from '../services/queryClient';
import { createLogger } from '../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SESSION_KEY = 'snowflake_session';

const log = createLogger('useSnowflakeQuery');

// =============================================================================
// Helpers
// =============================================================================

function getSessionId() {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      return JSON.parse(stored).sessionId;
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// =============================================================================
// Query Execution with React Query Caching
// =============================================================================

/**
 * Execute a SQL query with automatic caching
 *
 * @param {string} sql - SQL query to execute
 * @param {object} options - Query options (database, schema, etc.)
 * @returns {object} - { data, isLoading, error, refetch, isCached }
 */
export function useCachedQuery(sql, options = {}) {
  const queryClient = useQueryClient();
  const { database, schema, warehouse, enabled = true, timeout = 60 } = options;

  const queryFn = useCallback(async () => {
    const sessionId = getSessionId();
    if (!sessionId) {
      throw new Error('Not connected. Please connect to Snowflake first.');
    }

    const timeoutMs = timeout * 1000 + 5000; // Buffer

    // Execute query
    const response = await fetchWithTimeout(
      `${API_URL}/api/query/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
        },
        body: JSON.stringify({
          sql,
          database,
          schema_name: schema,
          warehouse,
          timeout,
          limit: options.limit || 10000,
        }),
      },
      timeoutMs
    );

    if (response.status === 401) {
      sessionStorage.removeItem(SESSION_KEY);
      throw new Error('Session expired. Please reconnect.');
    }

    const data = await response.json();

    if (data.status !== 'SUCCESS') {
      throw new Error(data.message || 'Query failed');
    }

    // Fetch results
    const resultsRes = await fetchWithTimeout(
      `${API_URL}/api/query/${data.query_id}/results`,
      { headers: { 'X-Session-ID': sessionId } },
      30000
    );

    const resultsData = await resultsRes.json();

    return {
      columns: resultsData.columns || [],
      rows: resultsData.rows || [],
      rowCount: resultsData.total_rows ?? resultsData.rows?.length ?? data.row_count ?? 0,
      executionTime: data.execution_time_ms,
      queryId: data.query_id,
    };
  }, [sql, database, schema, warehouse, timeout, options.limit]);

  const queryKey = queryKeys.query(sql, { database, schema });

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: enabled && !!sql?.trim(),
    staleTime: CACHE_CONFIG.QUERY_STALE_TIME_MS,
    gcTime: CACHE_CONFIG.GC_TIME_MS,
    refetchOnWindowFocus: false,
  });

  // Check if data came from cache
  const isCached = query.isSuccess && query.fetchStatus === 'idle';

  return {
    ...query,
    results: query.data,
    isCached,
    clearCache: () => queryClient.removeQueries({ queryKey }),
  };
}

/**
 * Execute query imperatively (for one-off queries)
 * Results are still cached!
 */
export function useQueryMutation() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ sql, database, schema, warehouse, timeout = 60, limit = 10000 }) => {
      const sessionId = getSessionId();
      if (!sessionId) {
        throw new Error('Not connected');
      }

      const response = await fetchWithTimeout(
        `${API_URL}/api/query/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId,
          },
          body: JSON.stringify({
            sql,
            database,
            schema_name: schema,
            warehouse,
            timeout,
            limit,
          }),
        },
        timeout * 1000 + 5000
      );

      if (response.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        throw new Error('Session expired');
      }

      const data = await response.json();

      if (data.status !== 'SUCCESS') {
        throw new Error(data.message || 'Query failed');
      }

      const resultsRes = await fetchWithTimeout(
        `${API_URL}/api/query/${data.query_id}/results`,
        { headers: { 'X-Session-ID': sessionId } },
        30000
      );

      const resultsData = await resultsRes.json();

      const result = {
        columns: resultsData.columns || [],
        rows: resultsData.rows || [],
        rowCount: resultsData.total_rows ?? resultsData.rows?.length ?? 0,
        executionTime: data.execution_time_ms,
      };

      // Cache the result
      const queryKey = queryKeys.query(sql, { database, schema });
      queryClient.setQueryData(queryKey, result);

      return result;
    },
  });

  return {
    executeQuery: mutation.mutate,
    executeQueryAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error?.message || null,
    results: mutation.data,
    reset: mutation.reset,
  };
}

// =============================================================================
// Metadata with Caching
// =============================================================================

/**
 * Fetch databases with caching
 */
export function useDatabases(enabled = true) {
  const queryFn = useCallback(async () => {
    const sessionId = getSessionId();
    if (!sessionId) return [];

    const res = await fetchWithTimeout(
      `${API_URL}/api/metadata/databases`,
      { headers: { 'X-Session-ID': sessionId } },
      15000
    );

    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    return res.json();
  }, []);

  return useQuery({
    queryKey: queryKeys.metadata.databases(),
    queryFn,
    enabled,
    staleTime: CACHE_CONFIG.METADATA_STALE_TIME_MS,
    gcTime: CACHE_CONFIG.GC_TIME_MS,
  });
}

/**
 * Fetch schemas with caching
 */
export function useSchemas(database, enabled = true) {
  const queryFn = useCallback(async () => {
    const sessionId = getSessionId();
    if (!sessionId || !database) return [];

    const res = await fetchWithTimeout(
      `${API_URL}/api/metadata/schemas?database=${encodeURIComponent(database)}`,
      { headers: { 'X-Session-ID': sessionId } },
      15000
    );

    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    return res.json();
  }, [database]);

  return useQuery({
    queryKey: queryKeys.metadata.schemas(database),
    queryFn,
    enabled: enabled && !!database,
    staleTime: CACHE_CONFIG.METADATA_STALE_TIME_MS,
  });
}

/**
 * Fetch tables with caching
 */
export function useTables(database, schema, enabled = true) {
  const queryFn = useCallback(async () => {
    const sessionId = getSessionId();
    if (!sessionId || !database || !schema) return [];

    const res = await fetchWithTimeout(
      `${API_URL}/api/metadata/tables?database=${encodeURIComponent(database)}&schema=${encodeURIComponent(schema)}`,
      { headers: { 'X-Session-ID': sessionId } },
      15000
    );

    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    return res.json();
  }, [database, schema]);

  return useQuery({
    queryKey: queryKeys.metadata.tables(database, schema),
    queryFn,
    enabled: enabled && !!database && !!schema,
    staleTime: CACHE_CONFIG.METADATA_STALE_TIME_MS,
  });
}

// =============================================================================
// Prefetch Helpers (for hover optimization)
// =============================================================================

/**
 * Hook to prefetch data on hover
 * Returns handlers to attach to elements
 */
export function usePrefetchOnHover() {
  const queryClient = useQueryClient();
  const prefetchTimeoutRef = useRef(null);

  const prefetchSchemas = useCallback((database) => {
    if (!database) return;

    // Small delay to avoid prefetching on accidental hovers
    prefetchTimeoutRef.current = setTimeout(() => {
      log.debug('Prefetching schemas for', database);
      queryClient.prefetchQuery({
        queryKey: queryKeys.metadata.schemas(database),
        queryFn: async () => {
          const sessionId = getSessionId();
          if (!sessionId) return [];
          const res = await fetchWithTimeout(
            `${API_URL}/api/metadata/schemas?database=${encodeURIComponent(database)}`,
            { headers: { 'X-Session-ID': sessionId } },
            15000
          );
          return res.json();
        },
        staleTime: CACHE_CONFIG.METADATA_STALE_TIME_MS,
      });
    }, 200);
  }, [queryClient]);

  const prefetchTables = useCallback((database, schema) => {
    if (!database || !schema) return;

    prefetchTimeoutRef.current = setTimeout(() => {
      log.debug('Prefetching tables for', database, schema);
      queryClient.prefetchQuery({
        queryKey: queryKeys.metadata.tables(database, schema),
        queryFn: async () => {
          const sessionId = getSessionId();
          if (!sessionId) return [];
          const res = await fetchWithTimeout(
            `${API_URL}/api/metadata/tables?database=${encodeURIComponent(database)}&schema=${encodeURIComponent(schema)}`,
            { headers: { 'X-Session-ID': sessionId } },
            15000
          );
          return res.json();
        },
        staleTime: CACHE_CONFIG.METADATA_STALE_TIME_MS,
      });
    }, 200);
  }, [queryClient]);

  const cancelPrefetch = useCallback(() => {
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
    }
  }, []);

  return {
    prefetchSchemas,
    prefetchTables,
    cancelPrefetch,
  };
}

// =============================================================================
// Batch Validation with Caching
// =============================================================================

/**
 * Batch validate queries with caching
 */
export function useBatchValidationCached() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ queries, database, schema }) => {
      const sessionId = getSessionId();
      if (!sessionId) throw new Error('Not connected');

      const response = await fetchWithTimeout(
        `${API_URL}/api/query/validate-batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId,
          },
          body: JSON.stringify({
            queries,
            database,
            schema_name: schema,
            include_samples: true,
            sample_limit: 3,
          }),
        },
        60000
      );

      if (response.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        throw new Error('Session expired');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Cache individual query results
      if (data.results) {
        data.results.forEach((result, index) => {
          const sql = variables.queries[index]?.query || variables.queries[index]?.sql;
          if (sql && result.valid) {
            // Pre-populate cache with validation results
            queryClient.setQueryData(
              queryKeys.preflight(sql),
              { valid: true, issues: [] }
            );
          }
        });
      }
    },
  });

  return {
    validateBatch: mutation.mutateAsync,
    isValidating: mutation.isPending,
    results: mutation.data,
    error: mutation.error?.message,
  };
}

export default {
  useCachedQuery,
  useQueryMutation,
  useDatabases,
  useSchemas,
  useTables,
  usePrefetchOnHover,
  useBatchValidationCached,
};
