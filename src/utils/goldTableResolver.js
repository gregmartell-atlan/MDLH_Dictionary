/**
 * Gold Table Resolver
 * 
 * Resolves Gold Layer table names based on actual database structure.
 * Handles cases where:
 * - GOLD schema exists: GOLD.ASSETS
 * - GOLD schema doesn't exist: PUBLIC.ASSETS or DATABASE.PUBLIC.ASSETS
 * - Tables might be named differently
 */

/**
 * Map of Gold Layer table names to possible actual table names
 */
const GOLD_TABLE_MAPPINGS = {
  'GOLD.ASSETS': ['ASSETS', 'GOLD_ASSETS', 'ASSET_VIEW'],
  'GOLD.README': ['README', 'GOLD_README', 'README_VIEW'],
  'GOLD.TAGS': ['TAGS', 'GOLD_TAGS', 'TAG_VIEW'],
  'GOLD.CUSTOM_METADATA': ['CUSTOM_METADATA', 'GOLD_CUSTOM_METADATA', 'CUSTOM_METADATA_VIEW'],
  'GOLD.GLOSSARY_DETAILS': ['GLOSSARY_DETAILS', 'GOLD_GLOSSARY_DETAILS', 'GLOSSARY_DETAILS_VIEW'],
  'GOLD.DATA_QUALITY_DETAILS': ['DATA_QUALITY_DETAILS', 'GOLD_DATA_QUALITY_DETAILS', 'DATA_QUALITY_DETAILS_VIEW'],
  'GOLD.PIPELINE_DETAILS': ['PIPELINE_DETAILS', 'GOLD_PIPELINE_DETAILS', 'PIPELINE_DETAILS_VIEW'],
  'GOLD.RELATIONAL_ASSET_DETAILS': ['RELATIONAL_ASSET_DETAILS', 'GOLD_RELATIONAL_ASSET_DETAILS', 'RELATIONAL_ASSET_DETAILS_VIEW'],
  'GOLD.DATA_MESH_DETAILS': ['DATA_MESH_DETAILS', 'GOLD_DATA_MESH_DETAILS', 'DATA_MESH_DETAILS_VIEW'],
  'GOLD.FULL_LINEAGE': ['FULL_LINEAGE', 'GOLD_FULL_LINEAGE', 'FULL_LINEAGE_VIEW'],
  'GOLD.ASSET_LOOKUP_TABLE': ['ASSET_LOOKUP_TABLE', 'GOLD_ASSET_LOOKUP_TABLE', 'ASSET_LOOKUP_TABLE_VIEW'],
};

/**
 * Resolve a Gold Layer table name to actual table name
 * 
 * @param {string} goldTableName - Gold table name like "GOLD.ASSETS"
 * @param {string} database - Database name (e.g., "ATLAN_GOLD")
 * @param {string} schema - Schema name (e.g., "PUBLIC" or "GOLD")
 * @param {Set<string>} discoveredTables - Set of discovered table names (uppercase)
 * @returns {string|null} Resolved table name or null if not found
 */
export function resolveGoldTable(goldTableName, database, schema, discoveredTables) {
  if (!goldTableName || !database || !schema || !discoveredTables) {
    return null;
  }
  
  const upperGoldTable = goldTableName.toUpperCase();
  const upperSchema = schema.toUpperCase();
  const upperTables = new Set([...discoveredTables].map(t => t.toUpperCase()));
  
  // Try exact match first: GOLD.ASSETS -> GOLD.ASSETS
  const exactMatch = `${upperSchema}.${upperGoldTable.split('.').pop()}`;
  if (upperTables.has(exactMatch)) {
    return `${database}.${upperSchema}.${upperGoldTable.split('.').pop()}`;
  }
  
  // Try without schema prefix: GOLD.ASSETS -> ASSETS
  const tableNameOnly = upperGoldTable.split('.').pop();
  if (upperTables.has(tableNameOnly)) {
    return `${database}.${upperSchema}.${tableNameOnly}`;
  }
  
  // Try alternative names from mapping
  const alternatives = GOLD_TABLE_MAPPINGS[upperGoldTable] || [];
  for (const altName of alternatives) {
    if (upperTables.has(altName)) {
      return `${database}.${upperSchema}.${altName}`;
    }
    // Try with schema prefix
    const withSchema = `${upperSchema}.${altName}`;
    if (upperTables.has(withSchema)) {
      return `${database}.${upperSchema}.${altName}`;
    }
  }
  
  // Try GOLD schema if it exists
  if (upperSchema !== 'GOLD') {
    const goldSchemaTable = `GOLD.${tableNameOnly}`;
    if (upperTables.has(goldSchemaTable)) {
      return `${database}.GOLD.${tableNameOnly}`;
    }
  }
  
  return null;
}

/**
 * Resolve all Gold tables in a SQL query
 * 
 * @param {string} sql - SQL query with Gold table references
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @param {Set<string>} discoveredTables - Discovered table names
 * @returns {string} SQL with resolved table names, or original if resolution fails
 */
export function resolveGoldTablesInSQL(sql, database, schema, discoveredTables) {
  if (!sql || !database || !schema) {
    return sql;
  }
  
  let resolvedSQL = sql;
  const upperSchema = schema.toUpperCase();
  const upperTables = discoveredTables ? new Set([...discoveredTables].map(t => t.toUpperCase())) : new Set();
  
  // Strategy 1: Try GOLD schema first (if it exists)
  const hasGoldSchema = upperTables.has('GOLD') || 
                        Array.from(upperTables).some(t => t.startsWith('GOLD.'));
  
  // Strategy 2: Find all GOLD.* table references and resolve them
  const goldTablePattern = /\bGOLD\.(\w+)\b/gi;
  const matches = [...sql.matchAll(goldTablePattern)];
  
  for (const match of matches) {
    const fullMatch = match[0]; // e.g., "GOLD.ASSETS"
    const tableName = match[1].toUpperCase();
    
    // Try to resolve using resolver function
    if (discoveredTables && discoveredTables.size > 0) {
      const resolved = resolveGoldTable(fullMatch, database, schema, discoveredTables);
      if (resolved) {
        resolvedSQL = resolvedSQL.replace(
          new RegExp(`\\b${fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
          resolved
        );
        continue;
      }
    }
    
    // Fallback: Use current schema (PUBLIC) if GOLD schema doesn't exist
    // Check if table exists in current schema
    const tableExists = !discoveredTables || discoveredTables.size === 0 || 
                       upperTables.has(tableName) || 
                       upperTables.has(`${upperSchema}.${tableName}`);
    
    if (tableExists || !discoveredTables || discoveredTables.size === 0) {
      // Default to current schema (usually PUBLIC)
      resolvedSQL = resolvedSQL.replace(
        new RegExp(`\\bGOLD\\.${match[1]}\\b`, 'gi'),
        `${database}.${schema}.${match[1]}`
      );
    } else {
      // Table doesn't exist - leave as GOLD.* but add comment warning
      console.warn(`Gold table ${fullMatch} not found in ${database}.${schema}`);
    }
  }
  
  return resolvedSQL;
}

/**
 * Check if any Gold Layer tables exist in the database
 * 
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @param {Set<string>} discoveredTables - Discovered table names
 * @returns {boolean} True if any Gold tables found
 */
export function hasGoldTables(database, schema, discoveredTables) {
  if (!discoveredTables || discoveredTables.size === 0) {
    return false;
  }
  
  const upperTables = new Set([...discoveredTables].map(t => t.toUpperCase()));
  const upperSchema = schema.toUpperCase();
  
  // Check for common Gold table names
  const goldTableNames = Object.values(GOLD_TABLE_MAPPINGS).flat();
  
  for (const goldTable of goldTableNames) {
    // Check exact match
    if (upperTables.has(goldTable)) {
      return true;
    }
    // Check with schema
    if (upperTables.has(`${upperSchema}.${goldTable}`)) {
      return true;
    }
    // Check GOLD schema
    if (upperSchema !== 'GOLD' && upperTables.has(`GOLD.${goldTable}`)) {
      return true;
    }
  }
  
  // Also check for ASSETS table (most common Gold table)
  if (upperTables.has('ASSETS') || 
      upperTables.has(`${upperSchema}.ASSETS`) ||
      (upperSchema !== 'GOLD' && upperTables.has('GOLD.ASSETS'))) {
    return true;
  }
  
  return false;
}

/**
 * Get list of available Gold tables
 * 
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @param {Set<string>} discoveredTables - Discovered table names
 * @returns {Array<{goldName: string, actualName: string}>} List of available Gold tables
 */
export function getAvailableGoldTables(database, schema, discoveredTables) {
  if (!discoveredTables || discoveredTables.size === 0) {
    return [];
  }
  
  const available = [];
  const upperTables = new Set([...discoveredTables].map(t => t.toUpperCase()));
  
  for (const [goldName, alternatives] of Object.entries(GOLD_TABLE_MAPPINGS)) {
    const resolved = resolveGoldTable(goldName, database, schema, discoveredTables);
    if (resolved) {
      available.push({
        goldName,
        actualName: resolved,
        alternatives
      });
    }
  }
  
  return available;
}

/**
 * Build a discovery query to check for Gold schema
 * 
 * @param {string} database - Database name
 * @returns {string} SQL query to check for GOLD schema
 */
export function buildGoldSchemaDiscoveryQuery(database) {
  return `
SELECT schema_name
FROM ${database}.information_schema.schemata
WHERE schema_name = 'GOLD'
LIMIT 1;
`.trim();
}

/**
 * Build a discovery query to find Gold-like tables
 * 
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @returns {string} SQL query to find potential Gold tables
 */
export function buildGoldTableDiscoveryQuery(database, schema) {
  const safeSchema = schema.replace(/['"]/g, '');
  
  return `
SELECT table_name
FROM ${database}.information_schema.tables
WHERE table_schema = '${safeSchema}'
  AND (
    table_name IN ('ASSETS', 'FULL_LINEAGE', 'GLOSSARY_DETAILS', 'ASSET_LOOKUP_TABLE', 'TAGS', 'README')
    OR table_name LIKE 'GOLD_%'
    OR table_name LIKE '%_GOLD'
  )
ORDER BY table_name;
`.trim();
}

export default {
  resolveGoldTable,
  resolveGoldTablesInSQL,
  hasGoldTables,
  getAvailableGoldTables,
  buildGoldSchemaDiscoveryQuery,
  buildGoldTableDiscoveryQuery,
  GOLD_TABLE_MAPPINGS,
};
