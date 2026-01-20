/**
 * Table Discovery Utilities
 * 
 * Functions for discovering which MDLH entity tables exist in a Snowflake database,
 * finding alternative table names, and fixing queries to use available tables.
 */

import { LRUCache } from './LRUCache.js';
import { createLogger } from './logger.js';

const log = createLogger('tableDiscovery');

// API base URL for fetching metadata
const metaEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
const API_BASE_URL = metaEnv?.VITE_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';

// Cache for discovered tables (LRU with 5-minute TTL)
const tableCache = new LRUCache(10, 5 * 60 * 1000);

// Cache for column metadata
const columnCache = new LRUCache(100, 10 * 60 * 1000);

/**
 * Get session ID from sessionStorage
 * @returns {string|null}
 */
function getSessionId() {
  const stored = sessionStorage.getItem('snowflake_session');
  log.debug('getSessionId() - raw storage', { exists: !!stored });
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const sessionId = parsed.sessionId;
      log.debug('getSessionId() - parsed', {
        hasSessionId: !!sessionId,
        sessionIdPrefix: sessionId?.substring(0, 8),
        age: parsed.timestamp ? `${Math.round((Date.now() - parsed.timestamp) / 1000)}s` : 'unknown'
      });
      return sessionId;
    } catch (e) {
      log.error('getSessionId() - parse error', { error: e.message });
      return null;
    }
  }
  return null;
}

/**
 * Discover which MDLH entity tables exist in the connected database
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @returns {Promise<Set<string>>} Set of table names (uppercase)
 */
export async function discoverMDLHTables(database, schema) {
  const cacheKey = `${database}.${schema}`;
  
  // Return cached if available
  const cached = tableCache.get(cacheKey);
  if (cached && cached.size > 0) {
    return cached;
  }
  
  try {
    const sessionId = getSessionId();
    
    if (!sessionId) {
      log.warn('discoverMDLHTables() - no session, cannot discover tables');
      return new Set();
    }
    
    // Force refresh if previous attempt returned empty
    const forceRefresh = !cached || cached.size === 0;
    
    // Fetch all tables in the schema
    const response = await fetch(
      `${API_BASE_URL}/api/metadata/tables?database=${database}&schema=${schema}&refresh=${forceRefresh}`,
      { headers: { 'X-Session-ID': sessionId } }
    );
    
    if (response.ok) {
      const tables = await response.json();
      const tableNames = new Set(tables.map(t => t.name?.toUpperCase() || t.toUpperCase()));
      
      // Update cache
      tableCache.set(cacheKey, tableNames);
      
      log.info('Discovered tables', { count: tableNames.size, database, schema });
      return tableNames;
    }
  } catch (err) {
    log.error('Failed to discover tables', { error: err.message });
  }
  
  return new Set();
}

/**
 * Find alternative table name if expected one doesn't exist
 * @param {string} expectedTable - Expected table name
 * @param {Set<string>} discoveredTables - Set of discovered table names
 * @returns {string|null} Alternative table name or null
 */
export function findAlternativeTable(expectedTable, discoveredTables) {
  if (!expectedTable || discoveredTables.size === 0) return null;
  
  const expected = expectedTable.toUpperCase();
  
  // If exact match exists, return it
  if (discoveredTables.has(expected)) return expected;
  
  // Try common variations
  const variations = [
    expected,
    expected.replace('_ENTITY', ''),  // TABLE_ENTITY -> TABLE
    expected + '_ENTITY',              // TABLE -> TABLE_ENTITY
    expected.replace('ATLAS', ''),     // ATLASGLOSSARY -> GLOSSARY
    'ATLAS' + expected,                // GLOSSARY -> ATLASGLOSSARY
  ];
  
  for (const variation of variations) {
    if (discoveredTables.has(variation)) return variation;
  }
  
  // Try fuzzy match - find tables containing the key part
  const keyPart = expected.replace('_ENTITY', '').replace('ATLAS', '');
  for (const table of discoveredTables) {
    if (table.includes(keyPart) && table.endsWith('_ENTITY')) {
      return table;
    }
  }
  
  return null;
}

/**
 * Fix a query to use available tables
 * @param {string} sql - SQL query
 * @param {Set<string>} discoveredTables - Set of discovered tables
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @returns {{sql: string, fixed: boolean, changes: Array}} Fixed query info
 */
export function fixQueryForAvailableTables(sql, discoveredTables, database, schema) {
  if (!sql || discoveredTables.size === 0) return { sql, fixed: false, changes: [] };
  
  const changes = [];
  let fixedSql = sql;
  
  // Find all table references in the query (FROM/JOIN clauses)
  const tablePattern = /(?:FROM|JOIN)\s+(?:[\w.]+\.)?(\w+_ENTITY)/gi;
  let match;
  
  while ((match = tablePattern.exec(sql)) !== null) {
    const originalTable = match[1].toUpperCase();
    
    if (!discoveredTables.has(originalTable)) {
      const alternative = findAlternativeTable(originalTable, discoveredTables);
      
      if (alternative && alternative !== originalTable) {
        // Replace the table name in the query
        const fullRef = `${database}.${schema}.${alternative}`;
        fixedSql = fixedSql.replace(
          new RegExp(`(FROM|JOIN)\\s+(?:[\\w.]+\\.)?${match[1]}`, 'gi'),
          `$1 ${fullRef}`
        );
        changes.push({ from: originalTable, to: alternative });
      }
    }
  }
  
  return {
    sql: fixedSql,
    fixed: changes.length > 0,
    changes
  };
}

/**
 * Check if a table exists in the discovered tables
 * @param {string} tableName - Table name to check
 * @param {Set<string>} discoveredTables - Set of discovered tables
 * @returns {boolean}
 */
export function tableExists(tableName, discoveredTables) {
  if (!tableName || tableName === '(abstract)') return false;
  return discoveredTables.has(tableName.toUpperCase());
}

/**
 * Extract table name from a SQL query
 * @param {string} sql - SQL query
 * @returns {string|null} Table name or null
 */
export function extractTableFromQuery(sql) {
  if (!sql) return null;
  const match = sql.match(/FROM\s+(?:[\w.]+\.)?(\w+_ENTITY)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Get all entity tables referenced in a category's queries and data
 * @param {Array} dataForCategory - Entity data
 * @param {Array} queriesForCategory - Query examples
 * @returns {Set<string>}
 */
export function getEntityTablesForCategory(dataForCategory, queriesForCategory) {
  const tables = new Set();
  
  // From entity data
  if (dataForCategory) {
    dataForCategory.forEach(row => {
      if (row.table && row.table !== '(abstract)') {
        tables.add(row.table.toUpperCase());
      }
    });
  }
  
  // From queries
  if (queriesForCategory) {
    queriesForCategory.forEach(q => {
      const match = q.query?.match(/FROM\s+(?:[\w.]+\.)?(\w+_ENTITY)/i);
      if (match) tables.add(match[1].toUpperCase());
    });
  }
  
  return tables;
}

/**
 * Validate a query by running it with LIMIT 0 (fast check)
 * @param {string} sql - SQL query
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @returns {Promise<{valid: boolean, error?: string, columns?: Array}>}
 */
export async function validateQuery(sql, database, schema) {
  try {
    const sessionId = getSessionId();
    
    if (!sessionId) return { valid: false, error: 'Not connected' };

    if (/(\{\{[^}]+\}\}|<DATABASE>|<SCHEMA>|<TABLE>|<COLUMN>|<GUID>)/i.test(sql)) {
      return { valid: false, error: 'Query contains unresolved placeholders.' };
    }
    
    // Modify query to add LIMIT 0 for fast validation (no data transfer)
    let testSql = sql.trim();
    // Remove existing LIMIT clause and add LIMIT 0
    testSql = testSql.replace(/LIMIT\s+\d+\s*;?\s*$/i, '');
    testSql = testSql.replace(/;?\s*$/, '') + ' LIMIT 0;';
    
    const response = await fetch(`${API_BASE_URL}/api/query/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
      },
      body: JSON.stringify({
        sql: testSql,
        database,
        schema,
        timeout: 10,
      }),
    });
    
    const submitData = await response.json();
    
    if (!response.ok || submitData.status !== 'SUCCESS') {
      return { valid: false, error: submitData.message || submitData.detail || 'Query failed' };
    }

    const resultsRes = await fetch(
      `${API_BASE_URL}/api/query/${submitData.query_id}/results`,
      { headers: { 'X-Session-ID': sessionId } }
    );

    if (!resultsRes.ok) {
      const errorText = await resultsRes.text().catch(() => '');
      return { valid: false, error: errorText || `Results fetch failed (${resultsRes.status})` };
    }

    const resultsData = await resultsRes.json();
    return { valid: true, columns: resultsData.columns || [] };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Fetch columns for a table from the backend
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @param {string} table - Table name
 * @returns {Promise<Array>} Column definitions
 */
export async function fetchTableColumns(database, schema, table) {
  const cacheKey = `${database}.${schema}.${table}`;
  
  // Return cached columns if available
  const cached = columnCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    const sessionId = getSessionId();
    
    if (!sessionId) {
      log.warn('fetchTableColumns() - no session, cannot fetch columns');
      return [];
    }
    
    const response = await fetch(
      `${API_BASE_URL}/api/metadata/columns?database=${database}&schema=${schema}&table=${table}`,
      { headers: { 'X-Session-ID': sessionId } }
    );
    
    if (response.ok) {
      const columns = await response.json();
      columnCache.set(cacheKey, columns);
      return columns;
    }
  } catch (err) {
    log.error('Failed to fetch columns', { table, error: err.message });
  }
  
  return [];
}

/**
 * Clear all discovery caches
 */
export function clearDiscoveryCache() {
  tableCache.clear();
  columnCache.clear();
}

export default {
  discoverMDLHTables,
  findAlternativeTable,
  fixQueryForAvailableTables,
  tableExists,
  extractTableFromQuery,
  getEntityTablesForCategory,
  validateQuery,
  fetchTableColumns,
  clearDiscoveryCache,
};
