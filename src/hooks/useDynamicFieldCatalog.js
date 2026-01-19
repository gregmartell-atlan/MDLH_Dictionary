/**
 * useDynamicFieldCatalog Hook
 * 
 * Provides a field catalog that dynamically adapts to the actual MDLH 
 * columns available in the connected Snowflake schema.
 * 
 * Features:
 * - Discovers which UNIFIED_FIELD_CATALOG fields are available
 * - Dynamically adapts field mappings based on discovered columns
 * - Handles column name variations (camelCase vs snake_case)
 * - Computes coverage only for available fields
 * - Provides signals that can be evaluated based on available data
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from './useSnowflake';
import { UNIFIED_FIELD_CATALOG, getFieldById, getFieldsByCategory } from '../evaluation/catalog/unifiedFields';
import { escapeIdentifier, escapeStringValue, buildSafeFQN } from '../utils/queryHelpers';
import { createLogger } from '../utils/logger';

const log = createLogger('useDynamicFieldCatalog');

// =============================================================================
// COLUMN NAME VARIATIONS
// =============================================================================

/**
 * Generate all possible column name variations for a field
 */
function getColumnVariations(fieldId, mdlhColumn, sourceAttributes) {
  const variations = new Set();
  
  if (mdlhColumn) {
    // Original column name
    variations.add(mdlhColumn.toUpperCase());
    
    // Snake case version
    const snakeCase = mdlhColumn.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
    variations.add(snakeCase);
    
    // Without underscores (e.g., OWNER_USERS -> OWNERUSERS)
    const noUnderscores = mdlhColumn.replace(/_/g, '').toUpperCase();
    variations.add(noUnderscores);
    
    // With __ prefix (MDLH sometimes uses this)
    variations.add(`__${mdlhColumn}`.toUpperCase());
  }
  
  // Add source attribute variations
  if (sourceAttributes) {
    for (const attr of sourceAttributes) {
      variations.add(attr.toUpperCase());
      variations.add(attr.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase());
    }
  }
  
  return Array.from(variations);
}

/**
 * Special column handling by data type
 */
const ARRAY_COLUMN_PATTERNS = [
  'OWNER', 'ADMIN', 'CLASSIFICATION', 'TAG', 'TERM', 'GUID', 'DOMAIN', 'MEANING',
];

const BOOLEAN_COLUMN_PATTERNS = [
  'HAS_', 'IS_', 'ISPRIMARY', 'ISFOREIGN', 'MONITORED',
];

const TIMESTAMP_COLUMN_PATTERNS = [
  'CREATED_AT', 'UPDATED_AT', 'MODIFIED', 'TIMESTAMP', '_AT',
];

function detectColumnType(columnName, dataType) {
  const upper = columnName.toUpperCase();
  
  if (ARRAY_COLUMN_PATTERNS.some(p => upper.includes(p))) {
    return 'array';
  }
  
  if (BOOLEAN_COLUMN_PATTERNS.some(p => upper.includes(p))) {
    return 'boolean';
  }
  
  if (TIMESTAMP_COLUMN_PATTERNS.some(p => upper.includes(p))) {
    return 'timestamp';
  }
  
  // Check data type
  if (dataType?.toUpperCase().includes('ARRAY')) {
    return 'array';
  }
  
  if (dataType?.toUpperCase().includes('BOOLEAN')) {
    return 'boolean';
  }
  
  if (dataType?.toUpperCase().includes('TIMESTAMP') || dataType?.toUpperCase().includes('DATE')) {
    return 'timestamp';
  }
  
  return 'string';
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for dynamic field catalog that adapts to available MDLH columns
 */
export function useDynamicFieldCatalog(database, schema, table = 'ASSETS') {
  const { executeQuery, loading: queryLoading } = useQuery();
  
  const [discoveredColumns, setDiscoveredColumns] = useState([]);
  const [columnSet, setColumnSet] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastDiscovered, setLastDiscovered] = useState(null);
  
  // ==========================================================================
  // COLUMN DISCOVERY
  // ==========================================================================
  
  /**
   * Discover columns from the target table
   */
  const discoverColumns = useCallback(async () => {
    if (!database || !schema) {
      setDiscoveredColumns([]);
      setColumnSet(new Set());
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const query = `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          ORDINAL_POSITION
        FROM ${escapeIdentifier(database)}.INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ${escapeStringValue(schema)}
          AND TABLE_NAME = ${escapeStringValue(table)}
        ORDER BY ORDINAL_POSITION
      `;
      
      const result = await executeQuery(query, { database, schema });
      
      // Normalize rows
      const normalizeRows = (rawResult) => {
        const columns = rawResult?.columns || [];
        const rows = rawResult?.rows || [];
        if (!Array.isArray(rows)) return [];
        return rows.map((row) => {
          if (Array.isArray(row)) {
            return columns.reduce((acc, col, idx) => {
              acc[col] = row[idx];
              return acc;
            }, {});
          }
          return row || {};
        });
      };
      
      const normalizedRows = normalizeRows(result);
      
      const columns = normalizedRows.map(row => ({
        name: row.COLUMN_NAME ?? row.column_name,
        dataType: row.DATA_TYPE ?? row.data_type,
        isNullable: (row.IS_NULLABLE ?? row.is_nullable) === 'YES',
        position: row.ORDINAL_POSITION ?? row.ordinal_position ?? 0,
        columnType: detectColumnType(row.COLUMN_NAME ?? row.column_name, row.DATA_TYPE ?? row.data_type),
      })).filter(c => c.name);
      
      setDiscoveredColumns(columns);
      setColumnSet(new Set(columns.map(c => c.name.toUpperCase())));
      setLastDiscovered(new Date());
      
      log.info(`Discovered ${columns.length} columns in ${database}.${schema}.${table}`);
    } catch (err) {
      log.error('Failed to discover columns', { error: err.message });
      setError(err.message);
      setDiscoveredColumns([]);
      setColumnSet(new Set());
    } finally {
      setLoading(false);
    }
  }, [database, schema, table, executeQuery]);
  
  // Auto-discover on mount/change
  useEffect(() => {
    if (database && schema) {
      discoverColumns();
    }
  }, [database, schema, table]);
  
  // ==========================================================================
  // DYNAMIC FIELD CATALOG
  // ==========================================================================
  
  /**
   * Get the dynamic field catalog based on available columns
   */
  const dynamicCatalog = useMemo(() => {
    return UNIFIED_FIELD_CATALOG.map(field => {
      const variations = getColumnVariations(
        field.id, 
        field.mdlhColumn, 
        field.source?.attributes
      );
      
      // Find first matching column
      const matchedColumn = variations.find(v => columnSet.has(v));
      
      // Get the actual column info if matched
      const columnInfo = matchedColumn 
        ? discoveredColumns.find(c => c.name.toUpperCase() === matchedColumn)
        : null;
      
      return {
        ...field,
        // Dynamic availability
        available: matchedColumn !== null,
        matchedColumn: matchedColumn || null,
        columnInfo,
        variations,
        
        // For queries
        queryColumn: matchedColumn || field.mdlhColumn,
      };
    });
  }, [columnSet, discoveredColumns]);
  
  /**
   * Get only available fields
   */
  const availableFields = useMemo(() => {
    return dynamicCatalog.filter(f => f.available);
  }, [dynamicCatalog]);
  
  /**
   * Get missing fields
   */
  const missingFields = useMemo(() => {
    return dynamicCatalog.filter(f => !f.available && f.mdlhColumn);
  }, [dynamicCatalog]);
  
  /**
   * Get fields by category (only available ones)
   */
  const getAvailableByCategory = useCallback((category) => {
    return availableFields.filter(f => f.category === category);
  }, [availableFields]);
  
  /**
   * Get field availability status
   */
  const getFieldStatus = useCallback((fieldId) => {
    const field = dynamicCatalog.find(f => f.id === fieldId);
    
    if (!field) {
      return { inCatalog: false, available: false, status: 'unknown' };
    }
    
    return {
      inCatalog: true,
      available: field.available,
      matchedColumn: field.matchedColumn,
      columnInfo: field.columnInfo,
      status: field.available ? 'available' : 'missing',
    };
  }, [dynamicCatalog]);
  
  // ==========================================================================
  // COVERAGE COMPUTATION
  // ==========================================================================
  
  /**
   * Compute coverage for available fields
   */
  const computeCoverage = useCallback(async (assetTypeFilter = null) => {
    if (!database || !schema || availableFields.length === 0) {
      return null;
    }
    
    try {
      const fqn = buildSafeFQN(database, schema, table);
      
      // Build coverage expressions based on column type
      const expressions = availableFields.map(field => {
        const col = escapeIdentifier(field.matchedColumn);
        const colType = field.columnInfo?.columnType || 'string';
        
        switch (colType) {
          case 'array':
            return `COUNT_IF(${col} IS NOT NULL AND ARRAY_SIZE(${col}) > 0) AS "${field.id}"`;
          case 'boolean':
            return `COUNT_IF(${col} = TRUE) AS "${field.id}"`;
          case 'timestamp':
            return `COUNT_IF(${col} IS NOT NULL) AS "${field.id}"`;
          default:
            return `COUNT_IF(${col} IS NOT NULL AND ${col} <> '') AS "${field.id}"`;
        }
      });
      
      let whereClause = "WHERE STATUS = 'ACTIVE'";
      if (assetTypeFilter) {
        whereClause += ` AND TYPENAME = ${escapeStringValue(assetTypeFilter)}`;
      }
      
      const query = `
        SELECT
          COUNT(*) AS total_count,
          ${expressions.join(',\n          ')}
        FROM ${fqn}
        ${whereClause}
      `;
      
      const result = await executeQuery(query, { database, schema });
      
      if (result?.rows?.[0]) {
        const row = result.rows[0];
        const total = row.TOTAL_COUNT ?? row.total_count ?? 0;
        
        const coverage = {};
        for (const field of availableFields) {
          const count = row[field.id] ?? row[field.id.toUpperCase()] ?? 0;
          coverage[field.id] = {
            fieldId: field.id,
            displayName: field.displayName,
            category: field.category,
            count,
            total,
            percentage: total > 0 ? (count / total * 100) : 0,
            matchedColumn: field.matchedColumn,
          };
        }
        
        return {
          totalAssets: total,
          coverage,
          timestamp: new Date(),
        };
      }
      
      return null;
    } catch (err) {
      log.error('Failed to compute coverage', { error: err.message });
      throw err;
    }
  }, [database, schema, table, availableFields, executeQuery]);
  
  // ==========================================================================
  // SIGNAL AVAILABILITY
  // ==========================================================================
  
  /**
   * Get which signals can be evaluated based on available fields
   */
  const availableSignals = useMemo(() => {
    const signalMap = {};
    
    for (const field of availableFields) {
      if (!field.contributesToSignals) continue;
      
      for (const contribution of field.contributesToSignals) {
        if (!signalMap[contribution.signal]) {
          signalMap[contribution.signal] = {
            signal: contribution.signal,
            fields: [],
            totalWeight: 0,
            canEvaluate: false,
          };
        }
        
        signalMap[contribution.signal].fields.push({
          fieldId: field.id,
          weight: contribution.weight,
          required: contribution.required,
          matchedColumn: field.matchedColumn,
        });
        
        signalMap[contribution.signal].totalWeight += contribution.weight;
        signalMap[contribution.signal].canEvaluate = true;
      }
    }
    
    return signalMap;
  }, [availableFields]);
  
  /**
   * Check if a specific signal can be evaluated
   */
  const canEvaluateSignal = useCallback((signalType) => {
    return availableSignals[signalType]?.canEvaluate || false;
  }, [availableSignals]);
  
  // ==========================================================================
  // RETURN
  // ==========================================================================
  
  return {
    // State
    loading: loading || queryLoading,
    error,
    lastDiscovered,
    
    // Raw columns
    discoveredColumns,
    columnSet,
    
    // Dynamic catalog
    dynamicCatalog,
    availableFields,
    missingFields,
    
    // Field functions
    getAvailableByCategory,
    getFieldStatus,
    
    // Coverage
    computeCoverage,
    
    // Signals
    availableSignals,
    canEvaluateSignal,
    
    // Actions
    refresh: discoverColumns,
  };
}

export default useDynamicFieldCatalog;
