/**
 * MDLH Asset Fetcher
 *
 * Fetches assets from MDLH Snowflake tables for assessment.
 * This replaces the AtlanApiFetcher from the original implementation.
 * 
 * Uses the existing MDLH Dict backend connection to query Snowflake.
 */

import { buildSafeFQN, escapeStringValue } from '../../utils/queryHelpers';
import { getAllMdlhColumnsForSignals, UNIFIED_FIELD_CATALOG } from '../catalog/unifiedFields';

// =============================================================================
// TYPES
// =============================================================================

/**
 * @typedef {Object} AssessmentScope
 * @property {'tenant' | 'connection' | 'database' | 'schema' | 'table' | 'domain'} level
 * @property {string} [scopeId] - Qualified name or GUID for scoping
 * @property {string[]} [assetTypes] - Asset types to include
 * @property {number} [sampleSize] - Max number of assets
 * @property {Record<string, any>} [filters] - Additional filters
 */

/**
 * @typedef {Object} AssetRecord
 * @property {string} guid
 * @property {string} typeName
 * @property {string} qualifiedName
 * @property {string} [displayName]
 * @property {Record<string, any>} attributes
 * @property {string[]} classifications
 * @property {Record<string, any>} customMetadata
 * @property {HierarchyPath} [hierarchy]
 */

/**
 * @typedef {Object} HierarchyPath
 * @property {string} [connectionQualifiedName]
 * @property {string} [connectionName]
 * @property {string} [databaseQualifiedName]
 * @property {string} [databaseName]
 * @property {string} [schemaQualifiedName]
 * @property {string} [schemaName]
 * @property {string} [domainGuid]
 */

// =============================================================================
// ENTITY TABLE MAPPING
// =============================================================================

/**
 * Map asset types to MDLH entity tables
 */
const ASSET_TYPE_TO_TABLE = {
  'Table': 'TABLE_ENTITY',
  'View': 'VIEW_ENTITY',
  'Column': 'COLUMN_ENTITY',
  'Database': 'DATABASE_ENTITY',
  'Schema': 'SCHEMA_ENTITY',
  'Connection': 'CONNECTION_ENTITY',
  'MaterialisedView': 'MATERIALISEDVIEW_ENTITY',
  'AtlasGlossaryTerm': 'ATLASGLOSSARYTERM_ENTITY',
  'AtlasGlossaryCategory': 'ATLASGLOSSARYCATEGORY_ENTITY',
  'Process': 'PROCESS_ENTITY',
  'Dashboard': 'TABLEAUDASHBOARD_ENTITY', // Default to Tableau, could be others
  'DbtModel': 'DBTMODEL_ENTITY',
  'DataProduct': 'DATAPRODUCT_ENTITY',
};

/**
 * Default asset types by scope level
 */
const DEFAULT_ASSET_TYPES_BY_LEVEL = {
  'tenant': ['Table', 'View', 'Column'],
  'connection': ['Table', 'View', 'Column'],
  'database': ['Table', 'View', 'Column'],
  'schema': ['Table', 'View', 'Column'],
  'table': ['Table', 'Column'],
  'domain': ['Table', 'View', 'Column'],
};

// =============================================================================
// MDLH ASSET FETCHER
// =============================================================================

/**
 * MDLH-based asset fetcher
 * Fetches asset data from Snowflake MDLH tables
 */
export class MDLHAssetFetcher {
  /**
   * @param {Object} config
   * @property {string} database - MDLH database name
   * @property {string} schema - MDLH schema (usually 'PUBLIC')
   * @property {Function} executeQuery - Function to execute SQL against Snowflake
   */
  constructor(config) {
    this.database = config.database;
    this.schema = config.schema || 'PUBLIC';
    this.executeQuery = config.executeQuery;
  }

  /**
   * Fetch assets matching the scope
   * @param {AssessmentScope} scope
   * @param {Object} [tenantConfig] - Optional tenant configuration
   * @returns {Promise<AssetRecord[]>}
   */
  async fetchAssets(scope, tenantConfig = null) {
    const assetTypes = scope.assetTypes || DEFAULT_ASSET_TYPES_BY_LEVEL[scope.level] || ['Table', 'View'];
    const limit = scope.sampleSize || 1000;
    
    // Get all required columns for signal evaluation
    const columns = this.getRequiredColumns(tenantConfig);
    
    // Build queries for each asset type
    const queries = [];
    for (const assetType of assetTypes) {
      const tableName = ASSET_TYPE_TO_TABLE[assetType];
      if (!tableName) continue;
      
      const sql = this.buildAssetQuery(tableName, columns, scope, limit);
      queries.push({ assetType, tableName, sql });
    }
    
    // Execute queries and combine results
    const allAssets = [];
    for (const { assetType, sql } of queries) {
      try {
        const result = await this.executeQuery(sql);
        const rows = result.rows || result.data || [];
        for (const row of rows) {
          allAssets.push(this.mapToAssetRecord(row, assetType));
        }
      } catch (error) {
        console.warn(`Failed to fetch ${assetType} assets:`, error.message);
      }
    }
    
    // Sort by popularity and limit
    allAssets.sort((a, b) => (b.attributes.popularityScore || 0) - (a.attributes.popularityScore || 0));
    return allAssets.slice(0, limit);
  }

  /**
   * Fetch a single asset by GUID
   * @param {string} guid
   * @param {Object} [tenantConfig]
   * @returns {Promise<AssetRecord | null>}
   */
  async fetchAsset(guid, tenantConfig = null) {
    const columns = this.getRequiredColumns(tenantConfig);
    const escapedGuid = escapeStringValue(guid);
    
    // Try each entity table
    for (const [assetType, tableName] of Object.entries(ASSET_TYPE_TO_TABLE)) {
      const fqn = buildSafeFQN(this.database, this.schema, tableName);
      const sql = `
        SELECT ${columns.join(', ')}
        FROM ${fqn}
        WHERE GUID = '${escapedGuid}'
        LIMIT 1
      `;
      
      try {
        const result = await this.executeQuery(sql);
        const rows = result.rows || result.data || [];
        if (rows.length > 0) {
          return this.mapToAssetRecord(rows[0], assetType);
        }
      } catch (error) {
        // Table might not exist, continue
      }
    }
    
    return null;
  }

  /**
   * Count assets matching the scope
   * @param {AssessmentScope} scope
   * @param {Object} [tenantConfig]
   * @returns {Promise<number>}
   */
  async countAssets(scope, tenantConfig = null) {
    const assetTypes = scope.assetTypes || DEFAULT_ASSET_TYPES_BY_LEVEL[scope.level] || ['Table', 'View'];
    let totalCount = 0;
    
    for (const assetType of assetTypes) {
      const tableName = ASSET_TYPE_TO_TABLE[assetType];
      if (!tableName) continue;
      
      const fqn = buildSafeFQN(this.database, this.schema, tableName);
      const whereClause = this.buildWhereClause(scope);
      const sql = `SELECT COUNT(*) as cnt FROM ${fqn} ${whereClause}`;
      
      try {
        const result = await this.executeQuery(sql);
        const rows = result.rows || result.data || [];
        if (rows.length > 0) {
          totalCount += rows[0].cnt || rows[0].CNT || 0;
        }
      } catch (error) {
        // Table might not exist
      }
    }
    
    return totalCount;
  }

  /**
   * Get required columns for query
   * @param {Object} [tenantConfig]
   * @returns {string[]}
   */
  getRequiredColumns(tenantConfig) {
    // Base columns always needed
    const baseColumns = [
      'GUID',
      'TYPENAME',
      'NAME',
      'QUALIFIEDNAME',
      'DISPLAYNAME',
    ];
    
    // Columns for signal evaluation
    const signalColumns = getAllMdlhColumnsForSignals();
    
    // Additional columns for hierarchy
    const hierarchyColumns = [
      'CONNECTIONQUALIFIEDNAME',
      'DATABASEQUALIFIEDNAME',
      'SCHEMAQUALIFIEDNAME',
      'DOMAINGUIDS',
    ];
    
    // Combine and dedupe
    const allColumns = new Set([...baseColumns, ...signalColumns, ...hierarchyColumns]);
    
    // Add tenant-specific columns if provided
    if (tenantConfig?.fieldMappings) {
      for (const mapping of tenantConfig.fieldMappings) {
        if (mapping.mdlhColumn) {
          allColumns.add(mapping.mdlhColumn);
        }
      }
    }
    
    return Array.from(allColumns);
  }

  /**
   * Build SQL query for fetching assets
   * @param {string} tableName
   * @param {string[]} columns
   * @param {AssessmentScope} scope
   * @param {number} limit
   * @returns {string}
   */
  buildAssetQuery(tableName, columns, scope, limit) {
    const fqn = buildSafeFQN(this.database, this.schema, tableName);
    const whereClause = this.buildWhereClause(scope);
    
    return `
      SELECT ${columns.join(', ')}
      FROM ${fqn}
      ${whereClause}
      ORDER BY POPULARITYSCORE DESC NULLS LAST
      LIMIT ${limit}
    `;
  }

  /**
   * Build WHERE clause for scope filtering
   * @param {AssessmentScope} scope
   * @returns {string}
   */
  buildWhereClause(scope) {
    const conditions = [];
    
    // Scope filtering
    if (scope.level !== 'tenant' && scope.scopeId) {
      const escapedScopeId = escapeStringValue(scope.scopeId);
      
      switch (scope.level) {
        case 'connection':
          conditions.push(`CONNECTIONQUALIFIEDNAME = '${escapedScopeId}'`);
          break;
        case 'database':
          conditions.push(`DATABASEQUALIFIEDNAME = '${escapedScopeId}'`);
          break;
        case 'schema':
          conditions.push(`SCHEMAQUALIFIEDNAME = '${escapedScopeId}'`);
          break;
        case 'table':
          conditions.push(`(QUALIFIEDNAME = '${escapedScopeId}' OR QUALIFIEDNAME LIKE '${escapedScopeId}/%')`);
          break;
        case 'domain':
          conditions.push(`ARRAY_CONTAINS('${escapedScopeId}'::VARIANT, DOMAINGUIDS)`);
          break;
      }
    }
    
    // Additional filters
    if (scope.filters) {
      for (const [key, value] of Object.entries(scope.filters)) {
        if (value === null || value === undefined) continue;
        
        const escapedValue = escapeStringValue(String(value));
        conditions.push(`${key.toUpperCase()} = '${escapedValue}'`);
      }
    }
    
    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  /**
   * Map Snowflake row to AssetRecord
   * @param {Record<string, any>} row
   * @param {string} assetType
   * @returns {AssetRecord}
   */
  mapToAssetRecord(row, assetType) {
    // Normalize column names (Snowflake returns uppercase)
    const normalizedRow = {};
    for (const [key, value] of Object.entries(row)) {
      normalizedRow[key.toLowerCase()] = value;
    }
    
    const record = {
      guid: normalizedRow.guid || '',
      typeName: normalizedRow.typename || assetType,
      qualifiedName: normalizedRow.qualifiedname || '',
      displayName: normalizedRow.displayname || normalizedRow.name || '',
      attributes: this.extractAttributes(normalizedRow),
      classifications: this.parseJsonArray(normalizedRow.classificationnames) || [],
      customMetadata: this.parseJsonObject(normalizedRow.businessattributes) || {},
      hierarchy: this.extractHierarchy(normalizedRow),
    };
    
    return record;
  }

  /**
   * Extract attributes from row
   * @param {Record<string, any>} row
   * @returns {Record<string, any>}
   */
  extractAttributes(row) {
    const attrs = {};
    
    // Map known attributes
    const attributeMapping = {
      name: 'name',
      description: 'description',
      userdescription: 'userDescription',
      ownerusers: 'ownerUsers',
      ownergroups: 'ownerGroups',
      certificatestatus: 'certificateStatus',
      certificatestatusmessage: 'certificateStatusMessage',
      popularityscore: 'popularityScore',
      querycount: 'queryCount',
      queryusercount: 'queryUserCount',
      __haslineage: '__hasLineage',
      assignedterms: 'meanings',
      classificationnames: 'classificationNames',
      readme: 'readme',
      createtime: 'createTime',
      updatetime: 'updateTime',
      __modificationtimestamp: '__modificationTimestamp',
    };
    
    for (const [rowKey, attrKey] of Object.entries(attributeMapping)) {
      if (row[rowKey] !== undefined && row[rowKey] !== null) {
        // Parse JSON arrays/objects if needed
        let value = row[rowKey];
        if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string
          }
        }
        attrs[attrKey] = value;
      }
    }
    
    return attrs;
  }

  /**
   * Extract hierarchy information
   * @param {Record<string, any>} row
   * @returns {HierarchyPath}
   */
  extractHierarchy(row) {
    return {
      connectionQualifiedName: row.connectionqualifiedname,
      connectionName: this.extractName(row.connectionqualifiedname),
      databaseQualifiedName: row.databasequalifiedname,
      databaseName: this.extractName(row.databasequalifiedname),
      schemaQualifiedName: row.schemaqualifiedname,
      schemaName: this.extractName(row.schemaqualifiedname),
      domainGuid: this.parseJsonArray(row.domainguids)?.[0],
    };
  }

  /**
   * Extract name from qualified name
   * @param {string} qualifiedName
   * @returns {string | undefined}
   */
  extractName(qualifiedName) {
    if (!qualifiedName) return undefined;
    const parts = qualifiedName.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Parse JSON array from string or return as-is
   * @param {any} value
   * @returns {string[] | null}
   */
  parseJsonArray(value) {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Parse JSON object from string or return as-is
   * @param {any} value
   * @returns {Record<string, any> | null}
   */
  parseJsonObject(value) {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create an MDLH asset fetcher
 * @param {Object} connectionConfig - Snowflake connection configuration
 * @param {Function} executeQuery - Function to execute SQL
 * @returns {MDLHAssetFetcher}
 */
export function createMDLHAssetFetcher(connectionConfig, executeQuery) {
  return new MDLHAssetFetcher({
    database: connectionConfig.database,
    schema: connectionConfig.schema || 'PUBLIC',
    executeQuery,
  });
}

// =============================================================================
// MOCK FETCHER (FOR TESTING)
// =============================================================================

/**
 * Mock asset fetcher for testing
 */
export class MockAssetFetcher {
  constructor(assets = []) {
    this.assets = assets;
  }

  addAssets(assets) {
    this.assets.push(...assets);
  }

  clear() {
    this.assets = [];
  }

  async fetchAssets(scope, _tenantConfig) {
    let filtered = this.assets;

    if (scope.assetTypes && scope.assetTypes.length > 0) {
      filtered = filtered.filter(a => scope.assetTypes.includes(a.typeName));
    }

    if (scope.level !== 'tenant' && scope.scopeId) {
      filtered = filtered.filter(a => {
        switch (scope.level) {
          case 'connection':
            return a.hierarchy?.connectionQualifiedName === scope.scopeId;
          case 'database':
            return a.hierarchy?.databaseQualifiedName === scope.scopeId;
          case 'schema':
            return a.hierarchy?.schemaQualifiedName === scope.scopeId;
          case 'table':
            return a.qualifiedName === scope.scopeId ||
                   a.qualifiedName.startsWith(scope.scopeId + '/');
          case 'domain':
            return a.hierarchy?.domainGuid === scope.scopeId;
          default:
            return true;
        }
      });
    }

    if (scope.sampleSize && filtered.length > scope.sampleSize) {
      filtered = filtered.slice(0, scope.sampleSize);
    }

    return filtered;
  }

  async fetchAsset(guid, _tenantConfig) {
    return this.assets.find(a => a.guid === guid) || null;
  }

  async countAssets(scope, tenantConfig) {
    const assets = await this.fetchAssets(scope, tenantConfig);
    return assets.length;
  }
}
