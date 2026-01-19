/**
 * DynamicSchemaContext
 * 
 * Centralized context for dynamic MDLH schema discovery and caching.
 * Provides a single source of truth for:
 * - Available databases, schemas, and tables
 * - Discovered MDLH columns per table
 * - Field-to-column mappings that adapt to what actually exists
 * - Hierarchy traversal (Connection → Database → Schema → Table → Column)
 * 
 * This context enables all components (FieldPresenceChecker, ModelBuilder, 
 * Assessment) to dynamically adapt to whatever MDLH structure is present.
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useConnection, useMetadata, useQuery } from '../hooks/useSnowflake';
import { buildSafeFQN } from '../utils/queryHelpers';
import { UNIFIED_FIELD_CATALOG, getFieldById } from '../evaluation/catalog/unifiedFields';
import { escapeIdentifier, escapeStringValue, buildSafeFQN } from '../utils/queryHelpers';
import { createLogger } from '../utils/logger';

const log = createLogger('DynamicSchemaContext');

// =============================================================================
// TYPE DEFINITIONS (for documentation)
// =============================================================================

/**
 * @typedef {Object} DiscoveredColumn
 * @property {string} name - Column name
 * @property {string} dataType - Snowflake data type
 * @property {boolean} isNullable - Whether column allows nulls
 * @property {number} position - Ordinal position
 */

/**
 * @typedef {Object} DiscoveredTable
 * @property {string} name - Table name
 * @property {string} kind - TABLE | VIEW | MATERIALIZED_VIEW
 * @property {number} rowCount - Approximate row count
 * @property {DiscoveredColumn[]} columns - Discovered columns
 * @property {string} primaryKey - Detected primary key column if any
 */

/**
 * @typedef {Object} DiscoveredSchema
 * @property {string} name - Schema name
 * @property {Map<string, DiscoveredTable>} tables - Tables keyed by name
 * @property {string[]} mdlhTables - Tables matching MDLH patterns
 */

/**
 * @typedef {Object} DiscoveredDatabase
 * @property {string} name - Database name
 * @property {Map<string, DiscoveredSchema>} schemas - Schemas keyed by name
 */

// =============================================================================
// MDLH TABLE PATTERNS
// =============================================================================

/**
 * Known MDLH table patterns - these are the tables we look for
 * to identify a valid MDLH schema.
 */
const MDLH_TABLE_PATTERNS = {
  // Primary asset tables (in priority order)
  assetTables: ['ASSETS', 'ASSET', 'GOLD_ASSETS', 'ALL_ASSETS', 'TABLE_ENTITY'],
  
  // Relationship tables
  relationshipTables: ['LINEAGE', 'RELATIONSHIPS', 'ASSET_LINKS', 'ENTITY_RELATIONSHIPS'],
  
  // Classification tables
  classificationTables: ['CLASSIFICATIONS', 'TAGS', 'ASSET_TAGS'],
  
  // Glossary tables
  glossaryTables: ['GLOSSARY_TERMS', 'TERMS', 'GLOSSARY'],
  
  // Process/lineage tables
  processTables: ['PROCESSES', 'LINEAGE_PROCESSES'],
  
  // Quality tables
  qualityTables: ['QUALITY_CHECKS', 'DQ_RESULTS', 'ANOMALO_CHECKS', 'SODA_CHECKS'],
};

/**
 * Check if a table name matches any MDLH pattern
 */
function isMdlhTable(tableName) {
  const upper = tableName.toUpperCase();
  return Object.values(MDLH_TABLE_PATTERNS).flat().some(pattern => 
    upper === pattern || upper.includes(pattern)
  );
}

/**
 * Categorize a table into MDLH table type
 */
function categorizeMdlhTable(tableName) {
  const upper = tableName.toUpperCase();
  
  for (const [category, patterns] of Object.entries(MDLH_TABLE_PATTERNS)) {
    if (patterns.some(pattern => upper === pattern || upper.includes(pattern))) {
      return category.replace('Tables', '');
    }
  }
  
  return null;
}

// =============================================================================
// HIERARCHY FIELD EXTRACTION
// =============================================================================

/**
 * Known hierarchy columns in MDLH for filtering
 */
const HIERARCHY_COLUMNS = {
  connection: ['CONNECTIONQUALIFIEDNAME', 'CONNECTION_QUALIFIED_NAME', 'CONNECTORNAME', 'CONNECTOR_NAME'],
  database: ['DATABASEQUALIFIEDNAME', 'DATABASE_QUALIFIED_NAME', 'DATABASE_NAME'],
  schema: ['SCHEMAQUALIFIEDNAME', 'SCHEMA_QUALIFIED_NAME', 'SCHEMA_NAME'],
  table: ['TABLE_QUALIFIED_NAME', 'TABLEQUALIFIEDNAME', 'PARENT_QUALIFIED_NAME'],
  domain: ['DOMAINGUIDS', 'DOMAIN_GUIDS', '__DOMAINGUIDS'],
  assetType: ['TYPENAME', 'TYPE_NAME', 'ASSET_TYPE'],
};

// =============================================================================
// CONTEXT
// =============================================================================

const DynamicSchemaContext = createContext(null);

export function DynamicSchemaProvider({ children }) {
  const { status: connectionStatus } = useConnection();
  const { fetchDatabases, fetchSchemas, fetchTables, loading: metadataLoading } = useMetadata(connectionStatus);
  const { executeQuery } = useQuery(connectionStatus);
  
  const isConnected = connectionStatus?.connected === true;
  
  // ==========================================================================
  // STATE
  // ==========================================================================
  
  // Discovery cache
  const [databases, setDatabases] = useState(new Map()); // Map<dbName, DiscoveredDatabase>
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastDiscovery, setLastDiscovery] = useState(null);
  
  // Current focus/selection
  const [focusedPath, setFocusedPath] = useState({
    database: null,
    schema: null,
    table: null,
  });
  
  // Filters
  const [filters, setFilters] = useState({
    connection: null,
    database: null,
    schema: null,
    assetType: null,
    domain: null,
    onlyMdlhTables: true,
  });

  const { discoveredTables, mdlhTableTypes } = useMemo(() => {
    const tables = [];
    const types = {};

    for (const [dbName, dbEntry] of databases.entries()) {
      for (const [schemaName, schemaEntry] of dbEntry.schemas.entries()) {
        for (const [tableName, tableEntry] of schemaEntry.tables.entries()) {
          const fqn = buildSafeFQN(dbName, schemaName, tableName);
          const category = tableEntry.mdlhCategory || categorizeMdlhTable(tableName);
          tables.push({
            name: tableName,
            database: dbName,
            schema: schemaName,
            fqn,
            isMdlhTable: tableEntry.isMdlhTable,
            mdlhCategory: category,
          });
          if (category) {
            types[fqn] = category;
          }
        }
      }
    }

    return { discoveredTables: tables, mdlhTableTypes: types };
  }, [databases]);
  
  // ==========================================================================
  // DISCOVERY FUNCTIONS
  // ==========================================================================
  
  /**
   * Discover all databases
   */
  const discoverDatabases = useCallback(async (forceRefresh = false) => {
    if (!isConnected) {
      log.warn('Cannot discover databases - not connected');
      return [];
    }
    
    if (!forceRefresh && databases.size > 0) {
      return Array.from(databases.values());
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const dbList = await fetchDatabases(forceRefresh);
      const normalizedDbs = (Array.isArray(dbList) ? dbList : []).map(d => 
        typeof d === 'string' ? { name: d } : d
      ).filter(d => d.name);
      
      const newDatabases = new Map();
      for (const db of normalizedDbs) {
        newDatabases.set(db.name, {
          name: db.name,
          schemas: new Map(),
          discovered: false,
        });
      }
      
      setDatabases(newDatabases);
      log.info(`Discovered ${newDatabases.size} databases`);
      
      return normalizedDbs;
    } catch (err) {
      log.error('Failed to discover databases', { error: err.message });
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [isConnected, fetchDatabases, databases.size]);
  
  /**
   * Discover schemas for a database
   */
  const discoverSchemas = useCallback(async (databaseName, forceRefresh = false) => {
    if (!isConnected || !databaseName) {
      return [];
    }
    
    const db = databases.get(databaseName);
    if (!forceRefresh && db?.schemas?.size > 0) {
      return Array.from(db.schemas.values());
    }
    
    setLoading(true);
    
    try {
      const schemaList = await fetchSchemas(databaseName);
      const normalizedSchemas = (Array.isArray(schemaList) ? schemaList : []).map(s => 
        typeof s === 'string' ? { name: s } : s
      ).filter(s => s.name && s.name.toUpperCase() !== 'INFORMATION_SCHEMA');
      
      setDatabases(prev => {
        const next = new Map(prev);
        const dbEntry = next.get(databaseName) || { name: databaseName, schemas: new Map() };
        
        for (const schema of normalizedSchemas) {
          if (!dbEntry.schemas.has(schema.name)) {
            dbEntry.schemas.set(schema.name, {
              name: schema.name,
              tables: new Map(),
              mdlhTables: [],
              discovered: false,
            });
          }
        }
        
        dbEntry.discovered = true;
        next.set(databaseName, dbEntry);
        return next;
      });
      
      log.info(`Discovered ${normalizedSchemas.length} schemas in ${databaseName}`);
      return normalizedSchemas;
    } catch (err) {
      log.error(`Failed to discover schemas in ${databaseName}`, { error: err.message });
      return [];
    } finally {
      setLoading(false);
    }
  }, [isConnected, fetchSchemas, databases]);
  
  /**
   * Discover tables and columns for a schema - deep discovery
   */
  const discoverTablesAndColumns = useCallback(async (databaseName, schemaName, forceRefresh = false) => {
    if (!isConnected || !databaseName || !schemaName) {
      return { tables: [], columns: {} };
    }
    
    const db = databases.get(databaseName);
    const schema = db?.schemas?.get(schemaName);
    
    if (!forceRefresh && schema?.discovered && schema?.tables?.size > 0) {
      return {
        tables: Array.from(schema.tables.values()),
        columns: Object.fromEntries(
          Array.from(schema.tables.entries()).map(([name, table]) => [name, table.columns])
        ),
      };
    }
    
    setLoading(true);
    
    try {
      // Fetch all columns from INFORMATION_SCHEMA
      const columnsQuery = `
        SELECT 
          TABLE_NAME,
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          ORDINAL_POSITION,
          CHARACTER_MAXIMUM_LENGTH,
          NUMERIC_PRECISION
        FROM ${escapeIdentifier(databaseName)}.INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ${escapeStringValue(schemaName)}
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `;
      
      const result = await executeQuery(columnsQuery, { database: databaseName, schema: schemaName });
      
      // Normalize rows (handle array format from Snowflake)
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
      
      // Group by table
      const tableColumnsMap = {};
      for (const row of normalizedRows) {
        const tableName = row.TABLE_NAME ?? row.table_name;
        const columnName = row.COLUMN_NAME ?? row.column_name;
        const dataType = row.DATA_TYPE ?? row.data_type;
        const isNullable = (row.IS_NULLABLE ?? row.is_nullable) === 'YES';
        const position = row.ORDINAL_POSITION ?? row.ordinal_position ?? 0;
        
        if (!tableName || !columnName) continue;
        
        if (!tableColumnsMap[tableName]) {
          tableColumnsMap[tableName] = [];
        }
        
        tableColumnsMap[tableName].push({
          name: columnName,
          dataType,
          isNullable,
          position,
        });
      }
      
      // Update state
      setDatabases(prev => {
        const next = new Map(prev);
        const dbEntry = next.get(databaseName) || { name: databaseName, schemas: new Map() };
        const schemaEntry = dbEntry.schemas.get(schemaName) || { name: schemaName, tables: new Map(), mdlhTables: [] };
        
        const mdlhTables = [];
        
        for (const [tableName, columns] of Object.entries(tableColumnsMap)) {
          const isMdlh = isMdlhTable(tableName);
          const category = categorizeMdlhTable(tableName);
          
          schemaEntry.tables.set(tableName, {
            name: tableName,
            columns,
            columnCount: columns.length,
            isMdlhTable: isMdlh,
            mdlhCategory: category,
          });
          
          if (isMdlh) {
            mdlhTables.push(tableName);
          }
        }
        
        schemaEntry.mdlhTables = mdlhTables;
        schemaEntry.discovered = true;
        schemaEntry.tableCount = Object.keys(tableColumnsMap).length;
        
        dbEntry.schemas.set(schemaName, schemaEntry);
        next.set(databaseName, dbEntry);
        
        return next;
      });
      
      log.info(`Discovered ${Object.keys(tableColumnsMap).length} tables in ${databaseName}.${schemaName}`);
      
      return {
        tables: Object.keys(tableColumnsMap).map(name => ({
          name,
          columns: tableColumnsMap[name],
          isMdlhTable: isMdlhTable(name),
        })),
        columns: tableColumnsMap,
      };
    } catch (err) {
      log.error(`Failed to discover tables in ${databaseName}.${schemaName}`, { error: err.message });
      return { tables: [], columns: {} };
    } finally {
      setLoading(false);
    }
  }, [isConnected, executeQuery, databases]);
  
  /**
   * Full discovery - discover everything across all or selected databases/schemas
   */
  const discoverAll = useCallback(async (scope = {}) => {
    if (!isConnected) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // 1. Get databases
      const dbs = await discoverDatabases(true);
      
      const targetDbs = scope.databases?.length > 0 
        ? dbs.filter(d => scope.databases.includes(d.name))
        : dbs;
      
      // 2. Get schemas for each database
      for (const db of targetDbs) {
        const schemas = await discoverSchemas(db.name, true);
        
        const targetSchemas = scope.schemas?.length > 0
          ? schemas.filter(s => scope.schemas.includes(s.name))
          : schemas;
        
        // 3. Deep discover tables/columns for each schema
        for (const schema of targetSchemas) {
          await discoverTablesAndColumns(db.name, schema.name, true);
        }
      }
      
      setLastDiscovery(new Date());
      log.info('Full discovery completed');
    } catch (err) {
      setError(err.message);
      log.error('Full discovery failed', { error: err.message });
    } finally {
      setLoading(false);
    }
  }, [isConnected, discoverDatabases, discoverSchemas, discoverTablesAndColumns]);
  
  // ==========================================================================
  // FIELD MAPPING FUNCTIONS
  // ==========================================================================
  
  /**
   * Get available columns for a specific table
   */
  const getColumnsForTable = useCallback((database, schema, table) => {
    const db = databases.get(database);
    const schemaEntry = db?.schemas?.get(schema);
    const tableEntry = schemaEntry?.tables?.get(table);
    
    return tableEntry?.columns || [];
  }, [databases]);
  
  /**
   * Check if a specific MDLH column exists in a schema
   */
  const hasColumn = useCallback((database, schema, table, columnName) => {
    const columns = getColumnsForTable(database, schema, table);
    const upperName = columnName.toUpperCase();
    return columns.some(c => c.name.toUpperCase() === upperName);
  }, [getColumnsForTable]);
  
  /**
   * Get dynamic field mappings - maps unified fields to available columns
   */
  const getDynamicFieldMappings = useCallback((database, schema, table = 'ASSETS') => {
    const columns = getColumnsForTable(database, schema, table);
    const columnSet = new Set(columns.map(c => c.name.toUpperCase()));
    
    const mappings = [];
    
    for (const field of UNIFIED_FIELD_CATALOG) {
      if (!field.mdlhColumn) continue;
      
      const primaryCol = field.mdlhColumn.toUpperCase();
      let matchedColumn = null;
      
      // Check primary column
      if (columnSet.has(primaryCol)) {
        matchedColumn = primaryCol;
      } else if (field.source?.attributes) {
        // Check alternative attributes
        for (const attr of field.source.attributes) {
          const altCol = attr.toUpperCase().replace(/([a-z])([A-Z])/g, '$1_$2');
          if (columnSet.has(altCol)) {
            matchedColumn = altCol;
            break;
          }
        }
      }
      
      mappings.push({
        fieldId: field.id,
        displayName: field.displayName,
        category: field.category,
        mdlhColumn: field.mdlhColumn,
        available: matchedColumn !== null,
        matchedColumn,
        signals: field.contributesToSignals,
        useCases: field.useCases,
      });
    }
    
    return mappings;
  }, [getColumnsForTable]);
  
  /**
   * Get available fields (those that exist in the current schema)
   */
  const getAvailableFields = useCallback((database, schema, table = 'ASSETS') => {
    return getDynamicFieldMappings(database, schema, table).filter(m => m.available);
  }, [getDynamicFieldMappings]);
  
  /**
   * Get missing fields (those that don't exist in the current schema)
   */
  const getMissingFields = useCallback((database, schema, table = 'ASSETS') => {
    return getDynamicFieldMappings(database, schema, table).filter(m => !m.available);
  }, [getDynamicFieldMappings]);
  
  // ==========================================================================
  // HIERARCHY FUNCTIONS
  // ==========================================================================
  
  /**
   * Get distinct values for a hierarchy column
   */
  const getHierarchyValues = useCallback(async (database, schema, table, hierarchyType) => {
    if (!isConnected || !database || !schema || !table) {
      return [];
    }
    
    const columns = getColumnsForTable(database, schema, table);
    const columnSet = new Set(columns.map(c => c.name.toUpperCase()));
    
    // Find matching hierarchy column
    const candidates = HIERARCHY_COLUMNS[hierarchyType] || [];
    const matchedColumn = candidates.find(c => columnSet.has(c.toUpperCase()));
    
    if (!matchedColumn) {
      log.warn(`No ${hierarchyType} column found in ${database}.${schema}.${table}`);
      return [];
    }
    
    try {
      const fqn = buildSafeFQN(database, schema, table);
      const query = `
        SELECT DISTINCT ${escapeIdentifier(matchedColumn)} AS value
        FROM ${fqn}
        WHERE ${escapeIdentifier(matchedColumn)} IS NOT NULL
          AND STATUS = 'ACTIVE'
        ORDER BY value
        LIMIT 1000
      `;
      
      const result = await executeQuery(query, { database, schema });
      
      // Normalize result
      if (result?.rows) {
        return result.rows.map(r => r.VALUE || r.value || r[0]).filter(Boolean);
      }
      
      return [];
    } catch (err) {
      log.error(`Failed to get hierarchy values for ${hierarchyType}`, { error: err.message });
      return [];
    }
  }, [isConnected, getColumnsForTable, executeQuery]);
  
  /**
   * Get all hierarchy columns available in a table
   */
  const getAvailableHierarchyColumns = useCallback((database, schema, table) => {
    const columns = getColumnsForTable(database, schema, table);
    const columnSet = new Set(columns.map(c => c.name.toUpperCase()));
    
    const available = {};
    
    for (const [type, candidates] of Object.entries(HIERARCHY_COLUMNS)) {
      const match = candidates.find(c => columnSet.has(c.toUpperCase()));
      if (match) {
        available[type] = match;
      }
    }
    
    return available;
  }, [getColumnsForTable]);
  
  // ==========================================================================
  // MDLH DETECTION
  // ==========================================================================
  
  /**
   * Check if a schema appears to be an MDLH schema
   */
  const isMdlhSchema = useCallback((database, schema) => {
    const db = databases.get(database);
    const schemaEntry = db?.schemas?.get(schema);
    
    return schemaEntry?.mdlhTables?.length > 0;
  }, [databases]);
  
  /**
   * Get primary MDLH table for a schema
   */
  const getPrimaryMdlhTable = useCallback((database, schema) => {
    const db = databases.get(database);
    const schemaEntry = db?.schemas?.get(schema);
    
    if (!schemaEntry?.tables) return null;
    
    // Check primary candidates in order
    for (const candidate of MDLH_TABLE_PATTERNS.assetTables) {
      if (schemaEntry.tables.has(candidate)) {
        return candidate;
      }
    }
    
    // Check case-insensitive
    for (const [tableName] of schemaEntry.tables) {
      if (MDLH_TABLE_PATTERNS.assetTables.includes(tableName.toUpperCase())) {
        return tableName;
      }
    }
    
    return null;
  }, [databases]);
  
  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================
  
  const value = useMemo(() => ({
    // Connection state
    isConnected,
    loading: loading || metadataLoading,
    error,
    lastDiscovery,
    
    // Discovery data
    databases,
    discoveredTables,
    mdlhTableTypes,
    
    // Discovery functions
    discoverDatabases,
    discoverSchemas,
    discoverTablesAndColumns,
    discoverAll,
    
    // Focus/selection
    focusedPath,
    setFocusedPath,
    
    // Filters
    filters,
    setFilters,
    
    // Column/field functions
    getColumnsForTable,
    hasColumn,
    getDynamicFieldMappings,
    getAvailableFields,
    getMissingFields,
    
    // Hierarchy functions
    getHierarchyValues,
    getAvailableHierarchyColumns,
    
    // MDLH detection
    isMdlhSchema,
    getPrimaryMdlhTable,
    
    // Constants
    MDLH_TABLE_PATTERNS,
    HIERARCHY_COLUMNS,
  }), [
    isConnected, loading, metadataLoading, error, lastDiscovery,
    databases, discoveredTables, mdlhTableTypes,
    discoverDatabases, discoverSchemas, discoverTablesAndColumns, discoverAll,
    focusedPath, filters,
    getColumnsForTable, hasColumn, getDynamicFieldMappings, getAvailableFields, getMissingFields,
    getHierarchyValues, getAvailableHierarchyColumns,
    isMdlhSchema, getPrimaryMdlhTable,
  ]);
  
  return (
    <DynamicSchemaContext.Provider value={value}>
      {children}
    </DynamicSchemaContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useDynamicSchema() {
  const context = useContext(DynamicSchemaContext);
  
  if (!context) {
    throw new Error('useDynamicSchema must be used within a DynamicSchemaProvider');
  }
  
  return context;
}

export default DynamicSchemaContext;
