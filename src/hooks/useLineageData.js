/**
 * useLineageData - Intelligent lineage hook
 * 
 * OpenLineage-compliant implementation that:
 * - Works with any entity type (tables, dashboards, reports, etc.)
 * - Parses SQL queries to detect referenced entities
 * - Builds proper graph visualization data
 * - Provides interactive exploration support
 * 
 * @see https://openlineage.io/docs/spec/
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  LineageService, 
  extractEntitiesFromSQL, 
  parseProcessName,
  createLineageService,
  isLineageQueryResult,
  transformLineageResultsToGraph,
  autoDetectLineage,
} from '../services/lineageService';

// Re-export utilities for external use
export { 
  extractEntitiesFromSQL, 
  parseProcessName,
  isLineageQueryResult,
  transformLineageResultsToGraph,
  autoDetectLineage,
};

/**
 * Main lineage data hook
 *
 * @param {Function} executeQuery - Query execution function
 * @param {boolean} isConnected - Whether connected to Snowflake
 * @param {string} database - Current database
 * @param {string} schema - Current schema
 * @param {string} currentQuery - Current SQL in editor (for auto-detection)
 * @param {Set|Array} discoveredTables - Tables that exist in the database
 * @returns {Object} Lineage data and controls
 */
export function useLineageData(executeQuery, isConnected, database, schema, currentQuery = '', discoveredTables = null) {
  const [lineageData, setLineageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentEntity, setCurrentEntity] = useState(null);
  
  // Debounce query changes
  const debounceRef = useRef(null);
  const lastQueryRef = useRef('');
  
  // Create memoized service instance
  const lineageService = useMemo(() => {
    console.log('[useLineageData] Creating lineage service:', {
      hasExecuteQuery: !!executeQuery,
      database,
      schema,
      discoveredTablesCount: discoveredTables?.size || (Array.isArray(discoveredTables) ? discoveredTables.length : 0)
    });

    if (!executeQuery || !database || !schema) {
      console.warn('[useLineageData] Cannot create service - missing:', {
        executeQuery: !executeQuery ? 'MISSING' : 'ok',
        database: !database ? 'MISSING' : 'ok',
        schema: !schema ? 'MISSING' : 'ok'
      });
      return null;
    }

    const service = createLineageService(executeQuery, database, schema, discoveredTables);
    console.log('[useLineageData] Service created:', {
      hasLineage: service?.hasLineage,
      processTable: service?.processTable,
      entityTables: service?.entityTables?.length
    });
    return service;
  }, [executeQuery, database, schema, discoveredTables]);

  /**
   * Fetch lineage for a specific entity
   */
  const fetchLineageForEntity = useCallback(async (entityNameOrGuid) => {
    console.log('[useLineageData.fetchLineageForEntity] Called with:', {
      entityNameOrGuid,
      isConnected,
      hasService: !!lineageService,
      serviceHasLineage: lineageService?.hasLineage
    });

    if (!isConnected || !lineageService || !entityNameOrGuid) {
      console.warn('[useLineageData.fetchLineageForEntity] Skipping - missing requirements');
      return;
    }

    console.log('[useLineageData.fetchLineageForEntity] Starting fetch for:', entityNameOrGuid);
    setLoading(true);
    setError(null);
    setCurrentEntity(entityNameOrGuid);

    try {
      const result = await lineageService.getLineage(entityNameOrGuid);
      
      if (result.error) {
        setError(result.error);
        setLineageData(null);
      } else {
        console.log('[useLineageData] Lineage result:', {
          nodeCount: result.nodes?.length,
          edgeCount: result.edges?.length,
          processCount: result.rawProcesses?.length,
        });
        
        // Set error if no lineage found but entity exists
        if (result.nodes?.length === 1 && result.rawProcesses?.length === 0) {
          setError(`No lineage data found for "${entityNameOrGuid}". This asset may not have recorded lineage.`);
        }
        
        setLineageData(result);
      }
    } catch (err) {
      console.error('[useLineageData] Error:', err);
      setError(err.message || 'Failed to fetch lineage');
      setLineageData(null);
    } finally {
      setLoading(false);
    }
  }, [isConnected, lineageService]);

  /**
   * Fetch lineage based on SQL query (auto-detect entities)
   */
  const fetchLineageFromQuery = useCallback(async (sql) => {
    if (!isConnected || !lineageService || !sql?.trim()) {
      return;
    }

    const entities = extractEntitiesFromSQL(sql);
    console.log('[useLineageData] Detected entities:', entities);
    
    if (entities.length === 0) {
      return;
    }

    // Fetch lineage for the primary entity (first one detected)
    await fetchLineageForEntity(entities[0]);
  }, [isConnected, lineageService, fetchLineageForEntity]);

  /**
   * Fetch sample lineage (for initial view when no query)
   */
  const fetchSampleLineage = useCallback(async () => {
    if (!isConnected || !lineageService) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Find a popular entity with lineage
      const sql = `
        SELECT t."NAME"
        FROM ${database}.${schema}.TABLE_ENTITY t
        WHERE t."HASLINEAGE" = TRUE
        ORDER BY t."POPULARITYSCORE" DESC NULLS LAST
        LIMIT 1
      `;
      
      const result = await executeQuery(sql);
      
      if (result?.rows?.length) {
        const row = Array.isArray(result.rows[0]) 
          ? { NAME: result.rows[0][0] }
          : result.rows[0];
        const tableName = row?.NAME || row?.name;
        
        if (tableName) {
          setCurrentEntity(tableName);
          await fetchLineageForEntity(tableName);
          return;
        }
      }
      
      // Fallback: any table
      const fallbackSql = `
        SELECT t."NAME"
        FROM ${database}.${schema}.TABLE_ENTITY t
        ORDER BY t."POPULARITYSCORE" DESC NULLS LAST
        LIMIT 1
      `;
      
      const fallbackResult = await executeQuery(fallbackSql);
      if (fallbackResult?.rows?.length) {
        const row = Array.isArray(fallbackResult.rows[0]) 
          ? { NAME: fallbackResult.rows[0][0] }
          : fallbackResult.rows[0];
        const tableName = row?.NAME || row?.name;
        
        if (tableName) {
          setCurrentEntity(tableName);
          await fetchLineageForEntity(tableName);
        }
      }
    } catch (err) {
      console.error('[useLineageData] Sample lineage error:', err);
      setError('Failed to fetch sample lineage');
    } finally {
      setLoading(false);
    }
  }, [isConnected, lineageService, database, schema, executeQuery, fetchLineageForEntity]);

  // Watch for query changes and extract entities
  useEffect(() => {
    if (!isConnected || !lineageService) return;
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Debounce query parsing
    debounceRef.current = setTimeout(() => {
      const entities = extractEntitiesFromSQL(currentQuery);
      
      if (entities.length > 0) {
        const primaryEntity = entities[0];
        if (primaryEntity !== lastQueryRef.current) {
          lastQueryRef.current = primaryEntity;
          fetchLineageForEntity(primaryEntity);
        }
      } else if (!currentQuery || currentQuery.trim() === '') {
        // No query - fetch sample lineage
        if (lastQueryRef.current !== '__sample__') {
          lastQueryRef.current = '__sample__';
          fetchSampleLineage();
        }
      }
    }, 500);
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [currentQuery, isConnected, lineageService, fetchLineageForEntity, fetchSampleLineage]);

  // Initial fetch when connected - with proper dependency tracking
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    console.log('[useLineageData] Initial fetch check:', {
      isConnected,
      hasLineageData: !!lineageData,
      loading,
      hasService: !!lineageService,
      hasLineage: lineageService?.hasLineage,
      hasInitialized: hasInitializedRef.current
    });

    // Only fetch once on initial connection
    if (isConnected && lineageService && !hasInitializedRef.current) {
      console.log('[useLineageData] Triggering initial sample lineage fetch');
      hasInitializedRef.current = true;
      fetchSampleLineage();
    }

    // Reset initialized flag when disconnected
    if (!isConnected) {
      hasInitializedRef.current = false;
    }
  }, [isConnected, lineageService, fetchSampleLineage]);

  return {
    lineageData,
    loading,
    error,
    currentTable: currentEntity,
    currentEntity,
    // Methods
    refetch: () => {
      if (currentEntity) {
        fetchLineageForEntity(currentEntity);
      } else {
        const entities = extractEntitiesFromSQL(currentQuery);
        if (entities.length > 0) {
          fetchLineageForEntity(entities[0]);
        } else {
          fetchSampleLineage();
        }
      }
    },
    fetchForEntity: fetchLineageForEntity,
    fetchFromQuery: fetchLineageFromQuery,
  };
}

/**
 * Hook to fetch lineage for a specific asset by GUID
 */
export function useAssetLineage(executeQuery, isConnected, database, schema, assetGuid) {
  const [lineageData, setLineageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lineageService = useMemo(() => {
    if (!executeQuery || !database || !schema) return null;
    return createLineageService(executeQuery, database, schema);
  }, [executeQuery, database, schema]);

  const fetchLineage = useCallback(async () => {
    if (!isConnected || !lineageService || !assetGuid) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await lineageService.getLineage(assetGuid);
      
      if (result.error) {
        setError(result.error);
      }
      
      setLineageData(result);
    } catch (err) {
      console.error('[useAssetLineage] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isConnected, lineageService, assetGuid]);

  useEffect(() => {
    fetchLineage();
  }, [fetchLineage]);

  return {
    lineageData,
    loading,
    error,
    refetch: fetchLineage,
  };
}

export default useLineageData;
