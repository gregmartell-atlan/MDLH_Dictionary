/**
 * useMDLHSchema Hook
 * 
 * Discovers available columns in MDLH Snowflake tables.
 * Used to validate which fields from the model can actually be queried.
 * 
 * Two-phase validation:
 * 1. Check if field exists in Atlan data model (via unifiedFields catalog)
 * 2. Check if corresponding MDLH column exists in Snowflake (this hook)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConnection, useQuery } from './useSnowflake';
import { UNIFIED_FIELD_CATALOG, getFieldById } from '../evaluation/catalog/unifiedFields';
import { buildSafeFQN } from '../utils/queryHelpers';
import { matchFieldToColumn, matchCatalogToColumns, MATCH_CONFIDENCE } from '../utils/columnMatcher';

/**
 * Discover columns available in a specific MDLH table
 * @param {string} database - Database name
 * @param {string} schema - Schema name  
 * @param {string} tableName - Table name (default: ASSETS)
 * @returns {Object} - { columns, loading, error, hasColumn, getFieldAvailability }
 */
export function useMDLHSchema(database, schema, tableName = 'ASSETS') {
  const { status: connectionStatus } = useConnection();
  const { executeQuery, loading: queryLoading } = useQuery(connectionStatus);
  
  const [columns, setColumns] = useState(new Map()); // columnName -> { dataType, isNullable }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  
  const isConnected = connectionStatus?.connected === true;

  /**
   * Fetch column metadata from INFORMATION_SCHEMA
   */
  const discoverColumns = useCallback(async () => {
    if (!isConnected || !database || !schema) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Query INFORMATION_SCHEMA.COLUMNS to get all columns in the table
      const query = `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          CHARACTER_MAXIMUM_LENGTH,
          NUMERIC_PRECISION,
          ORDINAL_POSITION
        FROM "${database}".INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${schema}'
          AND TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
      `;
      
      console.log('[useMDLHSchema] Discovering columns:', { database, schema, tableName });
      
      const result = await executeQuery(query, { database, schema });
      
      if (result && Array.isArray(result)) {
        const columnMap = new Map();
        result.forEach(row => {
          const name = row.COLUMN_NAME || row.column_name;
          columnMap.set(name, {
            dataType: row.DATA_TYPE || row.data_type,
            isNullable: row.IS_NULLABLE === 'YES',
            maxLength: row.CHARACTER_MAXIMUM_LENGTH || row.character_maximum_length,
            numericPrecision: row.NUMERIC_PRECISION || row.numeric_precision,
            position: row.ORDINAL_POSITION || row.ordinal_position,
          });
        });
        
        console.log('[useMDLHSchema] Discovered columns:', columnMap.size);
        setColumns(columnMap);
        setLastFetched(new Date());
      } else {
        console.warn('[useMDLHSchema] No columns found or invalid result:', result);
        setColumns(new Map());
      }
    } catch (err) {
      console.error('[useMDLHSchema] Error discovering columns:', err);
      setError(err.message || 'Failed to discover columns');
    } finally {
      setLoading(false);
    }
  }, [isConnected, database, schema, tableName, executeQuery]);

  // Fetch columns when connection/database/schema changes
  useEffect(() => {
    if (isConnected && database && schema) {
      discoverColumns();
    }
  }, [isConnected, database, schema, discoverColumns]);

  /**
   * Get list of column names for matching
   */
  const columnList = useMemo(() => Array.from(columns.keys()), [columns]);

  /**
   * Check if a specific column exists (exact match)
   */
  const hasColumn = useCallback((columnName) => {
    if (!columnName) return false;
    // Check both exact match and uppercase (MDLH uses uppercase)
    return columns.has(columnName) || columns.has(columnName.toUpperCase());
  }, [columns]);

  /**
   * Find a column using fuzzy matching (for schema variations)
   * Returns the matched column name or null
   */
  const findColumn = useCallback((fieldId, mdlhColumn = null) => {
    if (columnList.length === 0) return null;
    const result = matchFieldToColumn(fieldId, columnList, mdlhColumn);
    return result.matched ? result.column : null;
  }, [columnList]);

  /**
   * Get column info for a specific column
   */
  const getColumn = useCallback((columnName) => {
    if (!columnName) return null;
    return columns.get(columnName) || columns.get(columnName.toUpperCase()) || null;
  }, [columns]);

  /**
   * Check field availability - combines Atlan catalog check with MDLH column check
   * Now uses fuzzy matching to find columns even with naming variations
   * Returns: { inCatalog, mdlhColumn, actualColumn, inMDLH, status, message, matchConfidence, matchMethod }
   */
  const getFieldAvailability = useCallback((fieldId) => {
    const field = getFieldById(fieldId);
    
    if (!field) {
      return {
        inCatalog: false,
        mdlhColumn: null,
        actualColumn: null,
        inMDLH: false,
        status: 'unknown',
        message: `Field "${fieldId}" not found in catalog`,
        matchConfidence: 0,
        matchMethod: 'none',
      };
    }
    
    const mdlhColumn = field.mdlhColumn;
    
    if (!mdlhColumn) {
      return {
        inCatalog: true,
        mdlhColumn: null,
        actualColumn: null,
        inMDLH: false,
        status: 'no_mapping',
        message: `Field "${field.displayName}" has no MDLH column mapping`,
        field,
        matchConfidence: 0,
        matchMethod: 'none',
      };
    }
    
    // If we haven't fetched columns yet, status is "pending"
    if (columns.size === 0 && !loading && !error) {
      return {
        inCatalog: true,
        mdlhColumn,
        actualColumn: null,
        inMDLH: null, // Unknown
        status: 'pending',
        message: `Connect to Snowflake to verify column "${mdlhColumn}"`,
        field,
        matchConfidence: 0,
        matchMethod: 'none',
      };
    }
    
    // Try exact match first
    if (hasColumn(mdlhColumn)) {
      const actualCol = mdlhColumn.toUpperCase();
      return {
        inCatalog: true,
        mdlhColumn,
        actualColumn: actualCol,
        inMDLH: true,
        status: 'available',
        message: `Column "${actualCol}" available in MDLH`,
        field,
        columnInfo: getColumn(actualCol),
        matchConfidence: 1.0,
        matchMethod: 'exact_mdlh',
      };
    }
    
    // Try fuzzy matching
    const fuzzyMatch = matchFieldToColumn(fieldId, columnList, mdlhColumn);
    
    if (fuzzyMatch.matched) {
      return {
        inCatalog: true,
        mdlhColumn,
        actualColumn: fuzzyMatch.column,
        inMDLH: true,
        status: fuzzyMatch.confidence >= MATCH_CONFIDENCE.thresholds.high ? 'available' : 'available_fuzzy',
        message: `Column "${fuzzyMatch.column}" matched (${Math.round(fuzzyMatch.confidence * 100)}% confidence via ${fuzzyMatch.method})`,
        field,
        columnInfo: getColumn(fuzzyMatch.column),
        matchConfidence: fuzzyMatch.confidence,
        matchMethod: fuzzyMatch.method,
      };
    }
    
    return {
      inCatalog: true,
      mdlhColumn,
      actualColumn: null,
      inMDLH: false,
      status: 'missing',
      message: `Column "${mdlhColumn}" not found in ${tableName} table`,
      field,
      columnInfo: null,
      matchConfidence: 0,
      matchMethod: 'none',
    };
  }, [columns, loading, error, hasColumn, getColumn, tableName, columnList]);

  /**
   * Get availability for multiple fields at once
   */
  const getFieldsAvailability = useCallback((fieldIds) => {
    return fieldIds.map(id => ({
      fieldId: id,
      ...getFieldAvailability(id),
    }));
  }, [getFieldAvailability]);

  /**
   * Match all catalog fields to available columns (with fuzzy matching)
   */
  const catalogMatch = useMemo(() => {
    if (columnList.length === 0) return null;
    
    const catalog = UNIFIED_FIELD_CATALOG.map(f => ({
      id: f.id,
      displayName: f.displayName,
      mdlhColumn: f.mdlhColumn,
    }));
    
    return matchCatalogToColumns(catalog, columnList);
  }, [columnList]);

  /**
   * Get all fields that are available in MDLH (including fuzzy matches)
   */
  const availableFields = useMemo(() => {
    if (!catalogMatch) {
      // Fallback to exact matching if catalog match not available
      return UNIFIED_FIELD_CATALOG.filter(field => {
        if (!field.mdlhColumn) return false;
        return hasColumn(field.mdlhColumn);
      });
    }
    
    return UNIFIED_FIELD_CATALOG.filter(field => {
      const match = catalogMatch.catalog.find(m => m.fieldId === field.id);
      return match?.matched || false;
    });
  }, [hasColumn, catalogMatch]);

  /**
   * Get all fields missing from MDLH
   */
  const missingFields = useMemo(() => {
    if (!catalogMatch) {
      return UNIFIED_FIELD_CATALOG.filter(field => {
        if (!field.mdlhColumn) return true;
        return !hasColumn(field.mdlhColumn);
      });
    }
    
    return UNIFIED_FIELD_CATALOG.filter(field => {
      const match = catalogMatch.catalog.find(m => m.fieldId === field.id);
      return !match?.matched;
    });
  }, [hasColumn, catalogMatch]);

  /**
   * Get match statistics
   */
  const matchStats = useMemo(() => {
    return catalogMatch?.stats || {
      total: UNIFIED_FIELD_CATALOG.length,
      matched: availableFields.length,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      unmatched: missingFields.length,
    };
  }, [catalogMatch, availableFields.length, missingFields.length]);

  /**
   * Build a dynamic coverage query for available fields only
   */
  const buildCoverageQuery = useCallback((assetTypeFilter = '1=1', limit = null) => {
    if (availableFields.length === 0) {
      return null;
    }
    
    const assetsFQN = buildSafeFQN(database, schema, tableName);
    if (!assetsFQN) return null;
    
    // Build COUNT_IF expressions for each available field
    const countExpressions = availableFields
      .filter(f => f.contributesToSignals && f.contributesToSignals.length > 0)
      .slice(0, 20) // Limit to avoid query complexity
      .map(field => {
        const col = field.mdlhColumn;
        const colInfo = getColumn(col);
        
        // Handle array types vs scalar types
        if (colInfo?.dataType === 'ARRAY' || ['OWNERUSERS', 'OWNERGROUPS', 'TAGS', 'CLASSIFICATIONNAMES', 'DOMAINGUIDS'].includes(col)) {
          return `COUNT_IF(${col} IS NOT NULL AND ARRAY_SIZE(${col}) > 0) AS "${field.id}"`;
        } else if (colInfo?.dataType === 'BOOLEAN') {
          return `COUNT_IF(${col} = TRUE) AS "${field.id}"`;
        } else {
          return `COUNT_IF(${col} IS NOT NULL AND ${col} <> '') AS "${field.id}"`;
        }
      })
      .join(',\n      ');
    
    if (!countExpressions) {
      return null;
    }
    
    return `
      SELECT
        COUNT(*) AS total_assets,
        ${countExpressions}
      FROM ${assetsFQN}
      WHERE STATUS = 'ACTIVE'
        AND ${assetTypeFilter}
      ${limit ? `LIMIT ${limit}` : ''}
    `;
  }, [availableFields, database, schema, tableName, getColumn]);

  return {
    // Column data
    columns,
    columnCount: columns.size,
    columnList,
    
    // Loading state
    loading: loading || queryLoading,
    error,
    isConnected,
    lastFetched,
    
    // Column checks
    hasColumn,
    getColumn,
    findColumn, // Fuzzy column finder
    
    // Field availability (two-phase check with fuzzy matching)
    getFieldAvailability,
    getFieldsAvailability,
    availableFields,
    missingFields,
    
    // Match statistics
    matchStats,
    catalogMatch,
    
    // Query building
    buildCoverageQuery,
    
    // Manual refresh
    refresh: discoverColumns,
  };
}

export default useMDLHSchema;
