/**
 * useFieldPresence Hook
 * 
 * Checks field presence and coverage across MDLH Snowflake schemas.
 * Supports multi-schema comparison and coverage analysis.
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from './useSnowflake';
import { createLogger } from '../utils/logger';
import { escapeIdentifier, escapeStringValue } from '../utils/queryHelpers';
import { UNIFIED_FIELD_CATALOG, getFieldById } from '../evaluation/catalog/unifiedFields';

const log = createLogger('useFieldPresence');

// Primary table candidates in order of preference
const PRIMARY_TABLE_CANDIDATES = ['ASSETS', 'ASSET', 'GOLD_ASSETS', 'TABLE_ENTITY', 'ALL_ASSETS'];

// Array columns that need special handling
const ARRAY_COLUMNS = new Set([
  'OWNERUSERS', 'OWNER_USERS',
  'OWNERGROUPS', 'OWNER_GROUPS',
  'ADMINUSERS', 'ADMIN_USERS',
  'ADMINGROUPS', 'ADMIN_GROUPS',
  'CLASSIFICATIONNAMES', 'CLASSIFICATION_NAMES', 'TAGS',
  'TERMGUIDS', 'TERM_GUIDS', 'MEANINGS', 'ASSIGNEDTERMS',
  'DOMAINGUIDS', 'DOMAIN_GUIDS', '__DOMAINGUIDS',
]);

// Boolean columns that need special handling
const BOOLEAN_COLUMNS = new Set([
  'HAS_LINEAGE', 'HASLINEAGE', '__HASLINEAGE',
  'ISPRIMARYKEY', 'IS_PRIMARY_KEY',
  'ISFOREIGNKEY', 'IS_FOREIGN_KEY',
  'ASSETMCISMONITORED', 'ASSET_MC_IS_MONITORED',
]);

/**
 * Check if a field's MDLH column exists in the schema
 * @param {Set<string>} columns - Set of column names (uppercase)
 * @param {import('../evaluation/catalog/unifiedFields').UnifiedField} field
 * @returns {{ found: boolean, matchedColumn: string | null }}
 */
function checkFieldPresence(columns, field) {
  if (!field.mdlhColumn) {
    return { found: false, matchedColumn: null };
  }
  
  // Check primary column
  const primaryCol = field.mdlhColumn.toUpperCase();
  if (columns.has(primaryCol)) {
    return { found: true, matchedColumn: primaryCol };
  }
  
  // For fields with multiple source attributes, check alternatives
  if (field.source?.attributes) {
    for (const attr of field.source.attributes) {
      const altCol = attr.toUpperCase().replace(/([a-z])([A-Z])/g, '$1_$2');
      if (columns.has(altCol)) {
        return { found: true, matchedColumn: altCol };
      }
    }
  }
  
  return { found: false, matchedColumn: null };
}

/**
 * Build coverage query for populated field values
 */
function buildCoverageQuery(tableFqn, fieldMappings) {
  const countExpressions = [];
  
  for (const [fieldId, columnName] of Object.entries(fieldMappings)) {
    const colUpper = columnName.toUpperCase();
    
    let expr;
    if (ARRAY_COLUMNS.has(colUpper)) {
      expr = `COUNT_IF(${columnName} IS NOT NULL AND ARRAY_SIZE(${columnName}) > 0) AS "${fieldId}"`;
    } else if (BOOLEAN_COLUMNS.has(colUpper)) {
      expr = `COUNT_IF(${columnName} = TRUE) AS "${fieldId}"`;
    } else {
      expr = `COUNT_IF(${columnName} IS NOT NULL AND ${columnName} <> '') AS "${fieldId}"`;
    }
    
    countExpressions.push(expr);
  }
  
  if (countExpressions.length === 0) {
    return null;
  }
  
  return `
SELECT
  COUNT(*) AS total_count,
  ${countExpressions.join(',\n  ')}
FROM ${tableFqn}
WHERE STATUS = 'ACTIVE'
`;
}

/**
 * Hook for checking field presence and coverage
 */
export function useFieldPresence() {
  const { executeQuery } = useQuery();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  /**
   * Discover schema columns
   */
  const discoverSchema = useCallback(async (database, schema) => {
    const query = `
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM ${escapeIdentifier(database)}.INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ${escapeStringValue(schema)}
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `;
    
    const result = await executeQuery(query, { database, schema });
    
    if (result.error) {
      throw new Error(result.error);
    }
    
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

    // Group columns by table
    const tableColumns = {};
    const normalizedRows = normalizeRows(result);
    for (const row of normalizedRows) {
      const tableName = row.TABLE_NAME ?? row.table_name ?? row.Table_Name ?? row.tableName;
      const columnName = row.COLUMN_NAME ?? row.column_name ?? row.Column_Name ?? row.columnName;
      const dataType = row.DATA_TYPE ?? row.data_type ?? row.Data_Type ?? row.dataType;
      if (!tableName || !columnName) continue;
      if (!tableColumns[tableName]) {
        tableColumns[tableName] = [];
      }
      tableColumns[tableName].push({
        name: columnName,
        type: dataType,
      });
    }
    
    return tableColumns;
  }, [executeQuery]);

  /**
   * Find the primary assets table
   */
  const findPrimaryTable = useCallback((tableColumns) => {
    const tableNames = Object.keys(tableColumns);
    
    for (const candidate of PRIMARY_TABLE_CANDIDATES) {
      const found = tableNames.find(t => t.toUpperCase() === candidate.toUpperCase());
      if (found) return found;
    }
    
    // Fallback: find any table with "ASSET" in the name
    const assetTable = tableNames.find(t => t.toUpperCase().includes('ASSET'));
    if (assetTable) return assetTable;
    
    return null;
  }, []);

  /**
   * Check field presence for a schema
   */
  const checkPresence = useCallback(async (database, schema) => {
    log.info(`Checking field presence for ${database}.${schema}`);
    
    // 1. Discover schema
    const tableColumns = await discoverSchema(database, schema);
    const tableCount = Object.keys(tableColumns).length;
    
    if (tableCount === 0) {
      throw new Error(`No tables found in ${database}.${schema}`);
    }
    
    // 2. Find primary table
    const primaryTable = findPrimaryTable(tableColumns);
    
    if (!primaryTable) {
      const available = Object.keys(tableColumns)
        .filter((name) => name && name !== 'undefined')
        .slice(0, 5)
        .join(', ');
      throw new Error(`No primary assets table found. Available: ${available || 'none'}`);
    }
    
    const columns = tableColumns[primaryTable] || [];
    const columnSet = new Set(columns.map(c => c.name.toUpperCase()));
    
    // 3. Check each field
    const fieldResults = [];
    const fieldMappings = {};
    
    for (const field of UNIFIED_FIELD_CATALOG) {
      const { found, matchedColumn } = checkFieldPresence(columnSet, field);
      
      fieldResults.push({
        fieldId: field.id,
        displayName: field.displayName,
        category: field.category,
        mdlhColumn: field.mdlhColumn,
        found,
        matchedColumn,
        coverage: null, // Will be filled by coverage query
      });
      
      if (found && matchedColumn) {
        fieldMappings[field.id] = matchedColumn;
      }
    }
    
    // 4. Run coverage query
    const tableFqn = `${escapeIdentifier(database)}.${escapeIdentifier(schema)}.${escapeIdentifier(primaryTable)}`;
    const coverageQuery = buildCoverageQuery(tableFqn, fieldMappings);
    
    let totalCount = 0;
    if (coverageQuery) {
      try {
        const coverageResult = await executeQuery(coverageQuery, { database, schema });
        
        if (!coverageResult.error && coverageResult.rows?.[0]) {
          const row = coverageResult.rows[0];
          totalCount = row.TOTAL_COUNT || row.total_count || 0;
          
          for (const fr of fieldResults) {
            if (fr.found) {
              const populated = row[fr.fieldId] || row[fr.fieldId.toUpperCase()] || 0;
              fr.populatedCount = populated;
              fr.totalCount = totalCount;
              fr.coverage = totalCount > 0 ? (populated / totalCount * 100) : 0;
            }
          }
        }
      } catch (e) {
        log.warn('Coverage query failed', { error: e.message });
      }
    }
    
    const foundCount = fieldResults.filter(r => r.found).length;
    
    return {
      database,
      schema,
      primaryTable,
      tableCount,
      columnCount: columns.length,
      totalFields: fieldResults.length,
      foundFields: foundCount,
      totalAssets: totalCount,
      fieldResults,
    };
  }, [discoverSchema, findPrimaryTable, executeQuery]);

  /**
   * Run presence check for multiple schemas
   */
  const runPresenceCheck = useCallback(async (schemas) => {
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const allResults = [];
      
      for (const { database, schema } of schemas) {
        try {
          const result = await checkPresence(database, schema);
          allResults.push(result);
        } catch (e) {
          log.error(`Failed to check ${database}.${schema}`, { error: e.message });
          allResults.push({
            database,
            schema,
            error: e.message,
          });
        }
      }
      
      setResults(allResults);
      return allResults;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [checkPresence]);

  /**
   * Compare results across schemas
   */
  const comparison = useMemo(() => {
    if (!results || results.length < 2) return null;
    
    const comparison = {};
    
    for (const result of results) {
      if (result.error) continue;
      
      const schemaKey = `${result.database}.${result.schema}`;
      
      for (const fr of result.fieldResults) {
        if (!comparison[fr.fieldId]) {
          comparison[fr.fieldId] = {
            fieldId: fr.fieldId,
            displayName: fr.displayName,
            category: fr.category,
            schemas: {},
          };
        }
        
        comparison[fr.fieldId].schemas[schemaKey] = {
          found: fr.found,
          matchedColumn: fr.matchedColumn,
          coverage: fr.coverage,
        };
      }
    }
    
    return comparison;
  }, [results]);

  return {
    loading,
    error,
    results,
    comparison,
    runPresenceCheck,
    checkPresence,
  };
}

export default useFieldPresence;
