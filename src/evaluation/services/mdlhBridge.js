/**
 * MDLH Bridge Service
 * 
 * Bridges the evaluation platform's MDLH service to the MDLH Explorer's
 * Snowflake connection. This replaces the standalone backend API calls
 * with direct Snowflake queries via the Explorer's useQuery hook.
 */

// This module provides a singleton that can be configured with the Explorer's
// query execution function and connection state.

let queryExecutor = null;
let connectionState = { connected: false, database: null, schema: null };
let sessionId = null;

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8000';

/**
 * Configure the bridge with the Explorer's Snowflake connection
 */
export function configureMDLHBridge(config) {
  if (config.executeQuery) {
    queryExecutor = config.executeQuery;
  }
  if (config.database) {
    connectionState.database = config.database;
  }
  if (config.schema) {
    connectionState.schema = config.schema;
  }
  if (config.connected !== undefined) {
    connectionState.connected = config.connected;
  }
  if (config.sessionId) {
    sessionId = config.sessionId;
  }
}

/**
 * Get the session ID from sessionStorage
 */
function getSessionId() {
  if (sessionId) return sessionId;
  
  const stored = sessionStorage.getItem('snowflake_session');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.sessionId;
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Get current bridge configuration
 */
export function getMDLHBridgeConfig() {
  return { ...connectionState };
}

/**
 * Check if we're connected via the Explorer
 */
export function isConnected() {
  return connectionState.connected;
}

/**
 * Build fully qualified name for a table
 */
export function buildFQN(tableName) {
  const { database, schema } = connectionState;
  if (!database || !schema) return null;
  return `"${database}"."${schema}"."${tableName}"`;
}

/**
 * Execute a query using the Explorer's backend API directly
 */
export async function executeQuery(sql, options = {}) {
  const currentSessionId = getSessionId();
  
  if (!currentSessionId) {
    console.error('[MDLHBridge] No session ID available');
    return { rows: [], columns: [], error: 'Not connected to Snowflake' };
  }

  try {
    const response = await fetch(`${API_URL}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': currentSessionId,
      },
      body: JSON.stringify({
        sql,
        database: options.database || connectionState.database,
        schema: options.schema || connectionState.schema,
        limit: options.limit || 10000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { rows: [], columns: [], error: errorText };
    }

    const data = await response.json();
    return {
      rows: data.rows || data.data || [],
      columns: data.columns || Object.keys(data.rows?.[0] || {}),
    };
  } catch (error) {
    console.error('[MDLHBridge] Query error:', error);
    return {
      rows: [],
      columns: [],
      error: error instanceof Error ? error.message : 'Query failed',
    };
  }
}

/**
 * Get the Gold schema table reference
 */
export function getGoldSchema(tableName = 'ASSETS') {
  return buildFQN(tableName);
}

// ============================================
// MDLH GOLD LAYER QUERIES
// Based on MDLH Foundation document
// ============================================

/**
 * Field coverage query - counts populated fields across all active assets
 */
export function getFieldCoverageQuery() {
  const assetsTable = buildFQN('ASSETS');
  if (!assetsTable) return null;
  
  return `
    SELECT
      COUNT(*) AS total_assets,
      COUNT_IF(OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0) AS with_owner_users,
      COUNT_IF(DESCRIPTION IS NOT NULL AND DESCRIPTION <> '') AS with_description,
      COUNT_IF(TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0) AS with_tags,
      COUNT_IF(TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(TERM_GUIDS) > 0) AS with_glossary_terms,
      COUNT_IF(HAS_LINEAGE = TRUE) AS with_lineage,
      COUNT_IF(CERTIFICATE_STATUS IS NOT NULL AND CERTIFICATE_STATUS <> '' AND CERTIFICATE_STATUS <> 'NONE') AS with_certificate,
      COUNT_IF(README_GUID IS NOT NULL) AS with_readme
    FROM ${assetsTable}
    WHERE STATUS = 'ACTIVE'
  `;
}

/**
 * Field coverage by asset type
 */
export function getFieldCoverageByTypeQuery() {
  const assetsTable = buildFQN('ASSETS');
  if (!assetsTable) return null;
  
  return `
    SELECT
      ASSET_TYPE,
      COUNT(*) AS total_assets,
      COUNT_IF(OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0) AS with_owner_users,
      COUNT_IF(DESCRIPTION IS NOT NULL AND DESCRIPTION <> '') AS with_description,
      COUNT_IF(TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0) AS with_tags,
      COUNT_IF(CERTIFICATE_STATUS IS NOT NULL AND CERTIFICATE_STATUS <> '') AS with_certificate
    FROM ${assetsTable}
    WHERE STATUS = 'ACTIVE'
    GROUP BY ASSET_TYPE
    ORDER BY total_assets DESC
  `;
}

/**
 * Asset type breakdown query
 */
export function getAssetBreakdownQuery() {
  const assetsTable = buildFQN('ASSETS');
  if (!assetsTable) return null;
  
  return `
    SELECT
      ASSET_TYPE,
      COUNT(*) AS asset_count,
      COUNT_IF(OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0) AS with_owners,
      COUNT_IF(DESCRIPTION IS NOT NULL AND DESCRIPTION <> '') AS with_description
    FROM ${assetsTable}
    WHERE STATUS = 'ACTIVE'
    GROUP BY ASSET_TYPE
    ORDER BY asset_count DESC
    LIMIT 50
  `;
}

/**
 * Orphan assets query (no owner)
 */
export function getOrphanAssetsQuery(limit = 100) {
  const assetsTable = buildFQN('ASSETS');
  if (!assetsTable) return null;
  
  return `
    SELECT
      GUID,
      ASSET_NAME AS name,
      ASSET_QUALIFIED_NAME AS qualified_name,
      ASSET_TYPE,
      CONNECTOR_NAME
    FROM ${assetsTable}
    WHERE STATUS = 'ACTIVE'
      AND (OWNER_USERS IS NULL OR ARRAY_SIZE(OWNER_USERS) = 0)
      AND (OWNER_GROUPS IS NULL OR ARRAY_SIZE(OWNER_GROUPS) = 0)
    ORDER BY POPULARITY_SCORE DESC NULLS LAST
    LIMIT ${limit}
  `;
}

/**
 * Assets with lowest completeness scores
 */
export function getLowestCompletenessQuery(limit = 100) {
  const assetsTable = buildFQN('ASSETS');
  if (!assetsTable) return null;
  
  return `
    SELECT
      GUID,
      ASSET_NAME AS name,
      ASSET_QUALIFIED_NAME AS qualified_name,
      ASSET_TYPE,
      CONNECTOR_NAME,
      CASE 
        WHEN OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0 THEN 20 ELSE 0 
      END +
      CASE 
        WHEN DESCRIPTION IS NOT NULL AND DESCRIPTION <> '' THEN 20 ELSE 0 
      END +
      CASE 
        WHEN TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0 THEN 20 ELSE 0 
      END +
      CASE 
        WHEN TERM_GUIDS IS NOT NULL AND ARRAY_SIZE(TERM_GUIDS) > 0 THEN 20 ELSE 0 
      END +
      CASE 
        WHEN CERTIFICATE_STATUS IS NOT NULL AND CERTIFICATE_STATUS <> '' THEN 20 ELSE 0 
      END AS completeness_score
    FROM ${assetsTable}
    WHERE STATUS = 'ACTIVE'
      AND ASSET_TYPE NOT IN ('AtlasGlossary', 'AtlasGlossaryTerm', 'AtlasGlossaryCategory', 'Persona', 'Purpose', 'AuthPolicy')
    ORDER BY completeness_score ASC, POPULARITY_SCORE DESC NULLS LAST
    LIMIT ${limit}
  `;
}

/**
 * Connector summary query
 */
export function getConnectorSummaryQuery() {
  const assetsTable = buildFQN('ASSETS');
  if (!assetsTable) return null;
  
  return `
    SELECT
      CONNECTOR_NAME,
      COUNT(*) AS asset_count,
      COUNT(DISTINCT ASSET_TYPE) AS type_count
    FROM ${assetsTable}
    WHERE STATUS = 'ACTIVE'
    GROUP BY CONNECTOR_NAME
    ORDER BY asset_count DESC
  `;
}

// ============================================
// HIGH-LEVEL FETCH FUNCTIONS
// ============================================

/**
 * Fetch field coverage data
 */
export async function fetchFieldCoverage() {
  const sql = getFieldCoverageQuery();
  if (!sql) {
    return { coverage: [], error: 'Not configured - missing database/schema' };
  }

  const result = await executeQuery(sql);
  if (result.error) {
    return { coverage: [], error: result.error };
  }

  if (result.rows.length === 0) {
    return { coverage: [], error: 'No data returned' };
  }

  const row = result.rows[0];
  const totalAssets = row.TOTAL_ASSETS || row.total_assets || 0;

  const coverage = [
    {
      field: 'ownerUsers',
      totalAssets,
      populatedAssets: row.WITH_OWNER_USERS || row.with_owner_users || 0,
      coveragePercent: totalAssets > 0 ? Math.round(((row.WITH_OWNER_USERS || row.with_owner_users || 0) / totalAssets) * 100) : 0,
    },
    {
      field: 'description',
      totalAssets,
      populatedAssets: row.WITH_DESCRIPTION || row.with_description || 0,
      coveragePercent: totalAssets > 0 ? Math.round(((row.WITH_DESCRIPTION || row.with_description || 0) / totalAssets) * 100) : 0,
    },
    {
      field: 'tags',
      totalAssets,
      populatedAssets: row.WITH_TAGS || row.with_tags || 0,
      coveragePercent: totalAssets > 0 ? Math.round(((row.WITH_TAGS || row.with_tags || 0) / totalAssets) * 100) : 0,
    },
    {
      field: 'glossaryTerms',
      totalAssets,
      populatedAssets: row.WITH_GLOSSARY_TERMS || row.with_glossary_terms || 0,
      coveragePercent: totalAssets > 0 ? Math.round(((row.WITH_GLOSSARY_TERMS || row.with_glossary_terms || 0) / totalAssets) * 100) : 0,
    },
    {
      field: 'lineage',
      totalAssets,
      populatedAssets: row.WITH_LINEAGE || row.with_lineage || 0,
      coveragePercent: totalAssets > 0 ? Math.round(((row.WITH_LINEAGE || row.with_lineage || 0) / totalAssets) * 100) : 0,
    },
    {
      field: 'certificate',
      totalAssets,
      populatedAssets: row.WITH_CERTIFICATE || row.with_certificate || 0,
      coveragePercent: totalAssets > 0 ? Math.round(((row.WITH_CERTIFICATE || row.with_certificate || 0) / totalAssets) * 100) : 0,
    },
    {
      field: 'readme',
      totalAssets,
      populatedAssets: row.WITH_README || row.with_readme || 0,
      coveragePercent: totalAssets > 0 ? Math.round(((row.WITH_README || row.with_readme || 0) / totalAssets) * 100) : 0,
    },
  ];

  return { coverage };
}

/**
 * Fetch asset breakdown by type
 */
export async function fetchAssetBreakdown() {
  const sql = getAssetBreakdownQuery();
  if (!sql) {
    return { breakdown: [], error: 'Not configured' };
  }

  const result = await executeQuery(sql);
  if (result.error) {
    return { breakdown: [], error: result.error };
  }

  const breakdown = result.rows.map((row) => ({
    assetType: row.ASSET_TYPE || row.asset_type,
    count: row.ASSET_COUNT || row.asset_count || 0,
    withOwners: row.WITH_OWNERS || row.with_owners || 0,
    withDescription: row.WITH_DESCRIPTION || row.with_description || 0,
  }));

  return { breakdown };
}

/**
 * Fetch orphan assets (assets without owners)
 */
export async function fetchOrphanAssets(limit = 100) {
  const sql = getOrphanAssetsQuery(limit);
  if (!sql) {
    return { assets: [], error: 'Not configured' };
  }

  const result = await executeQuery(sql);
  if (result.error) {
    return { assets: [], error: result.error };
  }

  const assets = result.rows.map((row) => ({
    guid: row.GUID || row.guid,
    name: row.NAME || row.name,
    qualifiedName: row.QUALIFIED_NAME || row.qualified_name,
    assetType: row.ASSET_TYPE || row.asset_type,
    connector: row.CONNECTOR_NAME || row.connector_name,
  }));

  return { assets };
}

/**
 * Fetch connector summary
 */
export async function fetchConnectorSummary() {
  const sql = getConnectorSummaryQuery();
  if (!sql) {
    return { connectors: [], error: 'Not configured' };
  }

  const result = await executeQuery(sql);
  if (result.error) {
    return { connectors: [], error: result.error };
  }

  const connectors = result.rows.map((row) => ({
    name: row.CONNECTOR_NAME || row.connector_name,
    assetCount: row.ASSET_COUNT || row.asset_count || 0,
    typeCount: row.TYPE_COUNT || row.type_count || 0,
  }));

  return { connectors };
}

/**
 * Fetch full audit result
 */
export async function fetchAuditResult() {
  const [coverageResult, breakdownResult] = await Promise.all([
    fetchFieldCoverage(),
    fetchAssetBreakdown(),
  ]);

  if (coverageResult.error) {
    return { audit: null, error: coverageResult.error };
  }

  const coverage = coverageResult.coverage;
  const totalAssets = coverage[0]?.totalAssets || 0;

  const summary = {
    totalAssets,
    assetsWithOwner: coverage.find(c => c.field === 'ownerUsers')?.populatedAssets || 0,
    assetsWithDescription: coverage.find(c => c.field === 'description')?.populatedAssets || 0,
    assetsWithTags: coverage.find(c => c.field === 'tags')?.populatedAssets || 0,
    assetsWithGlossary: coverage.find(c => c.field === 'glossaryTerms')?.populatedAssets || 0,
    assetsWithLineage: coverage.find(c => c.field === 'lineage')?.populatedAssets || 0,
    overallCompletenessScore: calculateOverallCompleteness(coverage),
  };

  return {
    audit: {
      timestamp: new Date(),
      tenantId: connectionState.database,
      summary,
      fieldCoverage: coverage,
      assetBreakdown: breakdownResult.breakdown || [],
    },
  };
}

/**
 * Calculate overall completeness score
 */
function calculateOverallCompleteness(coverage) {
  const weights = {
    ownerUsers: 30,
    description: 20,
    certificate: 25,
    tags: 25,
    glossaryTerms: 15,
    lineage: 10,
  };

  let totalScore = 0;
  let totalWeight = 0;

  for (const c of coverage) {
    const weight = weights[c.field];
    if (weight) {
      totalScore += c.coveragePercent * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
}

export default {
  configureMDLHBridge,
  getMDLHBridgeConfig,
  isConnected,
  buildFQN,
  executeQuery,
  fetchFieldCoverage,
  fetchAssetBreakdown,
  fetchOrphanAssets,
  fetchConnectorSummary,
  fetchAuditResult,
};
