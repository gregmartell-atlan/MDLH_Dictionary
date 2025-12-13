/**
 * React Query Client Configuration
 *
 * Provides Snowflake/Databricks-like caching behavior:
 * - Result cache: Identical queries return instantly (5 min stale time)
 * - Background refetch: Data stays fresh without blocking UI
 * - Retry with backoff: Automatic retry on network failures
 */

import { QueryClient } from '@tanstack/react-query';

// Cache configuration - tune these for your use case
export const CACHE_CONFIG = {
  // How long data is considered "fresh" - no refetch during this period
  STALE_TIME_MS: 5 * 60 * 1000, // 5 minutes (like Snowflake result cache)

  // How long to keep data in cache after it becomes inactive
  GC_TIME_MS: 30 * 60 * 1000, // 30 minutes

  // For metadata (databases, schemas, tables) - cache longer
  METADATA_STALE_TIME_MS: 10 * 60 * 1000, // 10 minutes

  // For query results - shorter cache
  QUERY_STALE_TIME_MS: 2 * 60 * 1000, // 2 minutes

  // Number of retries for failed requests
  RETRY_COUNT: 2,

  // Retry delay multiplier (exponential backoff)
  RETRY_DELAY_BASE_MS: 1000,
};

/**
 * Create the query client with optimized defaults
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 5 minutes - no automatic refetch
      staleTime: CACHE_CONFIG.STALE_TIME_MS,

      // Keep unused data in cache for 30 minutes
      gcTime: CACHE_CONFIG.GC_TIME_MS,

      // Don't refetch on window focus (Snowflake queries are expensive)
      refetchOnWindowFocus: false,

      // Don't refetch on reconnect automatically
      refetchOnReconnect: false,

      // Retry failed requests with exponential backoff
      retry: (failureCount, error) => {
        // Don't retry on 401 (auth) or 404 (not found)
        if (error?.status === 401 || error?.status === 404) {
          return false;
        }
        return failureCount < CACHE_CONFIG.RETRY_COUNT;
      },

      // Exponential backoff for retries
      retryDelay: (attemptIndex) =>
        Math.min(
          CACHE_CONFIG.RETRY_DELAY_BASE_MS * 2 ** attemptIndex,
          30000 // Max 30 seconds
        ),
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

/**
 * Query key factories for consistent cache keys
 *
 * Usage:
 *   queryKey: queryKeys.query(sql)
 *   queryKey: queryKeys.metadata.databases()
 *   queryKey: queryKeys.metadata.tables(database, schema)
 */
export const queryKeys = {
  // Query execution
  query: (sql, options = {}) => ['query', sql, options],

  // Preflight validation
  preflight: (sql) => ['preflight', sql],

  // Batch validation
  batchValidation: (queries) => ['batchValidation', queries],

  // Metadata
  metadata: {
    all: () => ['metadata'],
    databases: () => ['metadata', 'databases'],
    schemas: (database) => ['metadata', 'schemas', database],
    tables: (database, schema) => ['metadata', 'tables', database, schema],
    columns: (database, schema, table) => ['metadata', 'columns', database, schema, table],
  },

  // Sample entities
  samples: (database, schema) => ['samples', database, schema],

  // Query history
  history: () => ['history'],

  // Connection status
  connection: () => ['connection'],
};

/**
 * Invalidate all query-related caches
 * Call this when user reconnects or changes database context
 */
export function invalidateAllQueries() {
  queryClient.invalidateQueries({ queryKey: ['query'] });
  queryClient.invalidateQueries({ queryKey: ['preflight'] });
  queryClient.invalidateQueries({ queryKey: ['batchValidation'] });
}

/**
 * Invalidate all metadata caches
 * Call this when schema changes or user requests refresh
 */
export function invalidateMetadata() {
  queryClient.invalidateQueries({ queryKey: queryKeys.metadata.all() });
  queryClient.invalidateQueries({ queryKey: ['samples'] });
}

/**
 * Prefetch query results (for hover optimization)
 * Returns immediately, fetches in background
 */
export function prefetchQuery(queryFn, queryKey, options = {}) {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: options.staleTime ?? CACHE_CONFIG.QUERY_STALE_TIME_MS,
  });
}

/**
 * Check if query data exists in cache
 */
export function hasQueryData(queryKey) {
  return queryClient.getQueryData(queryKey) !== undefined;
}

/**
 * Get cached query data without triggering a fetch
 */
export function getCachedData(queryKey) {
  return queryClient.getQueryData(queryKey);
}

export default queryClient;
