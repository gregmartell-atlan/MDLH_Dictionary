/**
 * Dynamic Example Query Generator
 * 
 * Transforms static example queries to use actual discovered table names and FQNs.
 * NO HARDCODED TABLE NAMES - everything adapts to what exists in the connected database.
 * 
 * CRITICAL RULE: Never show queries that reference tables that don't exist!
 */

import { buildSafeFQN } from './queryHelpers';

// =============================================================================
// TABLE NAME MAPPINGS
// =============================================================================

/**
 * Map of hardcoded table names to patterns for finding alternatives
 * Each entry has the canonical name and patterns to match in discovered tables
 */
const TABLE_PATTERNS = {
  'TABLE_ENTITY': {
    patterns: ['TABLE_ENTITY', 'SNOWFLAKETABLE_ENTITY', 'DATABRICKSTABLE_ENTITY'],
    category: 'tables'
  },
  'COLUMN_ENTITY': {
    patterns: ['COLUMN_ENTITY', 'SNOWFLAKECOLUMN_ENTITY', 'DATABRICKSCOLUMN_ENTITY', 'DBTMODELCOLUMN_ENTITY'],
    category: 'columns'
  },
  'VIEW_ENTITY': {
    patterns: ['VIEW_ENTITY', 'SNOWFLAKEVIEW_ENTITY', 'MATERIALISEDVIEW_ENTITY'],
    category: 'views'
  },
  'PROCESS_ENTITY': {
    patterns: ['PROCESS_ENTITY', 'LINEAGEPROCESS_ENTITY', 'COLUMNPROCESS_ENTITY', 'DBTCOLUMNPROCESS_ENTITY'],
    category: 'lineage'
  },
  'ATLASGLOSSARY_ENTITY': {
    patterns: ['ATLASGLOSSARY_ENTITY', 'ATLASGLOSSARY'],
    category: 'glossary'
  },
  'ATLASGLOSSARY': {
    patterns: ['ATLASGLOSSARY_ENTITY', 'ATLASGLOSSARY'],
    category: 'glossary'
  },
  'ATLASGLOSSARYTERM_ENTITY': {
    patterns: ['ATLASGLOSSARYTERM_ENTITY', 'ATLASGLOSSARYTERM'],
    category: 'glossary'
  },
  'ATLASGLOSSARYTERM': {
    patterns: ['ATLASGLOSSARYTERM_ENTITY', 'ATLASGLOSSARYTERM'],
    category: 'glossary'
  },
  'ATLASGLOSSARYCATEGORY_ENTITY': {
    patterns: ['ATLASGLOSSARYCATEGORY_ENTITY', 'ATLASGLOSSARYCATEGORY'],
    category: 'glossary'
  },
  'ATLASGLOSSARYCATEGORY': {
    patterns: ['ATLASGLOSSARYCATEGORY_ENTITY', 'ATLASGLOSSARYCATEGORY'],
    category: 'glossary'
  },
  'DASHBOARD_ENTITY': {
    patterns: ['DASHBOARD_ENTITY', 'TABLEAUDASHBOARD_ENTITY', 'POWERBIDASHBOARD_ENTITY', 'LOOKEREXPLORE_ENTITY'],
    category: 'dashboards'
  },
  'SCHEMA_ENTITY': {
    patterns: ['SCHEMA_ENTITY', 'SNOWFLAKESCHEMA_ENTITY'],
    category: 'schemas'
  },
  'DATABASE_ENTITY': {
    patterns: ['DATABASE_ENTITY', 'SNOWFLAKEDATABASE_ENTITY'],
    category: 'databases'
  },
  'CONNECTION_ENTITY': {
    patterns: ['CONNECTION_ENTITY'],
    category: 'connections'
  }
};

// List of common hardcoded entity table names to check for
const COMMON_ENTITY_TABLES = [
  'TABLE_ENTITY', 'COLUMN_ENTITY', 'VIEW_ENTITY', 'PROCESS_ENTITY',
  'ATLASGLOSSARY', 'ATLASGLOSSARY_ENTITY', 'ATLASGLOSSARYTERM', 'ATLASGLOSSARYTERM_ENTITY',
  'ATLASGLOSSARYCATEGORY', 'ATLASGLOSSARYCATEGORY_ENTITY',
  'SCHEMA_ENTITY', 'DATABASE_ENTITY', 'CONNECTION_ENTITY', 'DASHBOARD_ENTITY',
  'COLUMNPROCESS_ENTITY', 'LINEAGEPROCESS_ENTITY', 'BIPROCESS_ENTITY',
  'MATERIALISEDVIEW_ENTITY', 'SNOWFLAKETABLE_ENTITY', 'SNOWFLAKECOLUMN_ENTITY'
];

/**
 * Find the actual table name that exists in discovered tables
 * @param {string} canonicalName - The hardcoded table name (e.g., TABLE_ENTITY)
 * @param {Set<string>|string[]} discoveredTables - Tables from schema scan
 * @returns {string|null} The actual table name that exists, or null if NOT FOUND
 */
export function findActualTableName(canonicalName, discoveredTables) {
  // CRITICAL: Return null (not original) if no tables discovered - this prevents
  // showing queries with hardcoded names that don't exist
  if (!discoveredTables || (discoveredTables.size === 0 && discoveredTables.length === undefined)) {
    return null;
  }
  
  const tableSet = discoveredTables instanceof Set 
    ? discoveredTables 
    : new Set(discoveredTables);
  
  if (tableSet.size === 0) {
    return null;
  }
  
  const tableArray = [...tableSet].map(t => t.toUpperCase());
  const upperCanonical = canonicalName.toUpperCase();
  
  // First check if the exact name exists
  if (tableArray.includes(upperCanonical)) {
    return upperCanonical;
  }
  
  // Look up patterns for this canonical name
  const config = TABLE_PATTERNS[upperCanonical];
  if (!config) {
    // No pattern defined, try to find any table containing the base name
    const baseName = upperCanonical.replace('_ENTITY', '');
    const match = tableArray.find(t => 
      t.includes(baseName) && (t.endsWith('_ENTITY') || t.startsWith('ATLAS'))
    );
    return match || null;
  }
  
  // Check each pattern
  for (const pattern of config.patterns) {
    const upperPattern = pattern.toUpperCase();
    
    // Exact match
    if (tableArray.includes(upperPattern)) {
      return upperPattern;
    }
    
    // Pattern match (contains) - but be more strict to avoid false positives
    const match = tableArray.find(t => 
      t === upperPattern || 
      t.includes(upperPattern + '_') ||
      t.startsWith(upperPattern)
    );
    if (match) {
      return match;
    }
  }
  
  return null;
}

/**
 * Build a mapping of canonical table names to actual discovered names
 * @param {Set<string>|string[]} discoveredTables - Tables from schema scan
 * @returns {Map<string, string>} Map of canonical -> actual table names
 */
export function buildTableMapping(discoveredTables) {
  const mapping = new Map();
  
  for (const canonical of Object.keys(TABLE_PATTERNS)) {
    const actual = findActualTableName(canonical, discoveredTables);
    if (actual) {
      mapping.set(canonical, actual);
    }
  }
  
  return mapping;
}

/**
 * Known Gold Layer table names
 * These are the canonical names used in GOLD.* queries
 */
const GOLD_TABLE_NAMES = [
  'ASSETS', 'README', 'TAGS', 'CUSTOM_METADATA', 'GLOSSARY_DETAILS',
  'DATA_QUALITY_DETAILS', 'PIPELINE_DETAILS', 'RELATIONAL_ASSET_DETAILS',
  'DATA_MESH_DETAILS', 'FULL_LINEAGE', 'ASSET_LOOKUP_TABLE'
];

/**
 * Extract ALL table names referenced in a SQL query
 * Looks for patterns like FROM TABLE, JOIN TABLE, etc.
 * Also detects Gold Layer tables (GOLD.ASSETS, etc.)
 * @param {string} sql - SQL query
 * @returns {string[]} Array of table names (uppercase)
 */
export function extractAllReferencedTables(sql) {
  if (!sql) return [];
  
  const tables = new Set();
  
  // Match FROM <table>, JOIN <table>, INTO <table>, UPDATE <table>
  // Handles optional schema.table or database.schema.table prefixes
  const patterns = [
    /FROM\s+(?:[\w"]+\.)*(\w+_ENTITY|\w*ATLAS\w+)/gi,
    /JOIN\s+(?:[\w"]+\.)*(\w+_ENTITY|\w*ATLAS\w+)/gi,
    /INTO\s+(?:[\w"]+\.)*(\w+_ENTITY|\w*ATLAS\w+)/gi,
    /UPDATE\s+(?:[\w"]+\.)*(\w+_ENTITY|\w*ATLAS\w+)/gi,
    // Also match standalone entity table references like "TABLE_ENTITY T" or "AS TE"
    /\b(\w+_ENTITY)\b/gi,
    /\b(ATLAS\w+)\b/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(sql)) !== null) {
      const tableName = match[1].toUpperCase();
      // Exclude placeholders and common non-table patterns
      if (!tableName.includes('{{') && 
          !tableName.includes('<') &&
          !tableName.startsWith('INFORMATION_SCHEMA') &&
          tableName !== 'ENTITY') {
        tables.add(tableName);
      }
    }
  }
  
  // Also extract GOLD.* table references (Gold Layer tables)
  // These use a different pattern: GOLD.TABLENAME
  const goldPattern = /\bGOLD\.(\w+)\b/gi;
  let goldMatch;
  while ((goldMatch = goldPattern.exec(sql)) !== null) {
    const tableName = goldMatch[1].toUpperCase();
    // Only add if it's a known Gold table name
    if (GOLD_TABLE_NAMES.includes(tableName)) {
      tables.add(`GOLD.${tableName}`);
    }
  }
  
  return Array.from(tables);
}

/**
 * Check if ALL tables referenced in a query exist in discoveredTables
 * This is the CRITICAL validation function - returns false if ANY table is missing
 * 
 * For Gold Layer tables (GOLD.ASSETS, etc.), we check if:
 * 1. The exact name exists (e.g., "ASSETS", "FULL_LINEAGE")
 * 2. Or a prefixed version exists (e.g., "GOLD_ASSETS", "GOLD.ASSETS")
 * 
 * @param {string} sql - SQL query
 * @param {Set<string>|string[]} discoveredTables - Tables from schema scan
 * @returns {{valid: boolean, missingTables: string[], foundTables: string[]}}
 */
export function validateQueryTables(sql, discoveredTables) {
  if (!sql) return { valid: true, missingTables: [], foundTables: [] };
  
  const tableSet = discoveredTables instanceof Set 
    ? discoveredTables 
    : new Set((discoveredTables || []).map(t => t.toUpperCase()));
  
  // If no tables discovered yet, we can't validate - return valid with warning
  if (tableSet.size === 0) {
    return { valid: true, missingTables: [], foundTables: [], noTablesDiscovered: true };
  }
  
  const referencedTables = extractAllReferencedTables(sql);
  const missingTables = [];
  const foundTables = [];
  
  for (const table of referencedTables) {
    // Handle Gold Layer tables specially (e.g., "GOLD.ASSETS")
    if (table.startsWith('GOLD.')) {
      const goldTableName = table.replace('GOLD.', '');
      // Check various possible locations for Gold tables:
      // 1. Direct match (ASSETS)
      // 2. With GOLD prefix (GOLD_ASSETS)
      // 3. With GOLD. prefix (GOLD.ASSETS)
      // 4. In PUBLIC schema
      if (tableSet.has(goldTableName) ||
          tableSet.has(`GOLD_${goldTableName}`) ||
          tableSet.has(`GOLD.${goldTableName}`) ||
          tableSet.has(`PUBLIC.${goldTableName}`)) {
        foundTables.push(table);
      } else {
        // Also check if any table contains the gold table name as suffix
        let found = false;
        for (const discovered of tableSet) {
          if (discovered.endsWith(goldTableName) || 
              discovered.endsWith(`.${goldTableName}`)) {
            foundTables.push(discovered);
            found = true;
            break;
          }
        }
        if (!found) {
          missingTables.push(table);
        }
      }
    } else {
      // Standard table validation
      if (tableSet.has(table)) {
        foundTables.push(table);
      } else {
        // Try to find an alternative
        const alternative = findActualTableName(table, tableSet);
        if (alternative) {
          foundTables.push(alternative);
        } else {
          missingTables.push(table);
        }
      }
    }
  }
  
  return {
    valid: missingTables.length === 0,
    missingTables,
    foundTables,
    referencedTables
  };
}

/**
 * Filter an array of queries to only include those that can run
 * against the discovered tables. This is the main function to use!
 * @param {Array} queries - Array of query objects with .query or .sql property
 * @param {Set<string>|string[]} discoveredTables - Tables from schema scan
 * @returns {Array} Filtered queries that can actually run
 */
export function filterQueriesByAvailability(queries, discoveredTables) {
  if (!queries || !Array.isArray(queries)) return [];
  
  const tableSet = discoveredTables instanceof Set 
    ? discoveredTables 
    : new Set((discoveredTables || []).map(t => t.toUpperCase()));
  
  // If no tables discovered, return all queries (discovery mode)
  if (tableSet.size === 0) {
    return queries;
  }
  
  return queries.filter(q => {
    const sql = q.query || q.sql || '';
    const validation = validateQueryTables(sql, tableSet);
    return validation.valid;
  });
}

/**
 * Get alternative table suggestions for a missing table
 * @param {string} missingTable - Table name that doesn't exist
 * @param {Set<string>|string[]} discoveredTables - Tables from schema scan
 * @returns {string[]} Array of similar table names that exist
 */
export function getSuggestedAlternatives(missingTable, discoveredTables) {
  const tableSet = discoveredTables instanceof Set 
    ? discoveredTables 
    : new Set((discoveredTables || []).map(t => t.toUpperCase()));
  
  const upperMissing = missingTable.toUpperCase();
  const baseName = upperMissing.replace('_ENTITY', '');
  const suggestions = [];
  
  for (const table of tableSet) {
    // Score similarity
    if (table.includes(baseName) || baseName.includes(table.replace('_ENTITY', ''))) {
      suggestions.push(table);
    }
  }
  
  // Sort by similarity (shorter names first, then alphabetically)
  return suggestions.sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, 5);
}

/**
 * Replace hardcoded table references in SQL with discovered table names and FQNs
 * @param {string} sql - SQL query with hardcoded table names
 * @param {string} database - Current database
 * @param {string} schema - Current schema
 * @param {Set<string>|string[]} discoveredTables - Tables from schema scan
 * @returns {{ sql: string, valid: boolean, missingTables: string[] }}
 */
export function transformQueryToDiscoveredTables(sql, database, schema, discoveredTables) {
  if (!sql) return { sql: '', valid: false, missingTables: [] };
  
  const mapping = buildTableMapping(discoveredTables);
  const missingTables = [];
  let transformed = sql;
  let valid = true;
  
  // Find all table references in the SQL
  // Match patterns like: FROM TABLE_ENTITY, JOIN PROCESS_ENTITY, etc.
  const tableRefPattern = /\b(FROM|JOIN|INTO|UPDATE)\s+(?:(?:[\w"]+\.){0,2})?([\w_]+_ENTITY|ATLAS[\w]+)\b/gi;
  
  // Also match just table names after FROM/JOIN without schema prefix
  const simpleTablePattern = /\b(FROM|JOIN)\s+([\w_]+_ENTITY|ATLAS[\w]+)\b/gi;
  
  // Collect all unique table references
  const tableRefs = new Set();
  let match;
  
  while ((match = tableRefPattern.exec(sql)) !== null) {
    tableRefs.add(match[2].toUpperCase());
  }
  
  // Reset regex
  tableRefPattern.lastIndex = 0;
  
  // Replace each table reference
  for (const tableRef of tableRefs) {
    const actualTable = mapping.get(tableRef) || findActualTableName(tableRef, discoveredTables);
    
    if (actualTable) {
      // Build FQN for the actual table
      const fqn = buildSafeFQN(database, schema, actualTable);
      
      // Replace simple table reference with FQN
      // Match the table name with optional schema prefix
      const replacePattern = new RegExp(
        `\\b(FROM|JOIN|INTO|UPDATE)\\s+(?:(?:[\\w"]+\\.){0,2})?${tableRef}\\b`,
        'gi'
      );
      transformed = transformed.replace(replacePattern, `$1 ${fqn}`);
    } else {
      missingTables.push(tableRef);
      valid = false;
    }
  }
  
  // Also replace any remaining hardcoded database.schema.table patterns
  // that might use FIELD_METADATA.PUBLIC.* 
  transformed = transformed.replace(
    /FIELD_METADATA\.PUBLIC\.([\w_]+_ENTITY|ATLAS[\w]+)/gi,
    (match, tableName) => {
      const actual = mapping.get(tableName.toUpperCase()) || 
                     findActualTableName(tableName, discoveredTables);
      if (actual) {
        return buildSafeFQN(database, schema, actual);
      }
      return match; // Keep original if not found
    }
  );
  
  return { sql: transformed, valid, missingTables };
}

/**
 * Transform an entire query object (with title, description, query)
 */
export function transformQueryObject(queryObj, database, schema, discoveredTables) {
  const { sql, valid, missingTables } = transformQueryToDiscoveredTables(
    queryObj.query,
    database,
    schema,
    discoveredTables
  );
  
  return {
    ...queryObj,
    query: sql,
    _valid: valid,
    _missingTables: missingTables,
    _transformed: true
  };
}

/**
 * Transform all example queries to use discovered tables
 * @param {Object} exampleQueries - The static example queries object
 * @param {string} database - Current database
 * @param {string} schema - Current schema  
 * @param {Set<string>|string[]} discoveredTables - Tables from schema scan
 * @returns {Object} Transformed queries with actual table names and FQNs
 */
export function transformExampleQueries(exampleQueries, database, schema, discoveredTables) {
  if (!exampleQueries) return {};
  
  const transformed = {};
  
  for (const [category, queries] of Object.entries(exampleQueries)) {
    if (!Array.isArray(queries)) continue;
    
    transformed[category] = queries.map(q => 
      transformQueryObject(q, database, schema, discoveredTables)
    ).filter(q => q._valid); // Only include valid queries
  }
  
  return transformed;
}

/**
 * Get statistics about which queries are valid for the discovered schema
 */
export function getQueryValidityStats(exampleQueries, database, schema, discoveredTables) {
  const stats = {
    total: 0,
    valid: 0,
    invalid: 0,
    byCategory: {}
  };
  
  for (const [category, queries] of Object.entries(exampleQueries)) {
    if (!Array.isArray(queries)) continue;
    
    stats.byCategory[category] = { total: queries.length, valid: 0, invalid: 0 };
    
    for (const q of queries) {
      stats.total++;
      const { valid } = transformQueryToDiscoveredTables(q.query, database, schema, discoveredTables);
      
      if (valid) {
        stats.valid++;
        stats.byCategory[category].valid++;
      } else {
        stats.invalid++;
        stats.byCategory[category].invalid++;
      }
    }
  }
  
  return stats;
}

export default {
  findActualTableName,
  buildTableMapping,
  extractAllReferencedTables,
  validateQueryTables,
  filterQueriesByAvailability,
  getSuggestedAlternatives,
  transformQueryToDiscoveredTables,
  transformQueryObject,
  transformExampleQueries,
  getQueryValidityStats
};

