/**
 * MDLH Asset Fetcher
 *
 * Fetches assets from MDLH Snowflake tables for assessment.
 * This replaces the AtlanApiFetcher from the original implementation.
 * 
 * Uses the existing MDLH Dict backend connection to query Snowflake.
 */

import { buildSafeFQN, escapeStringValue } from '../../utils/queryHelpers';
import { normalizeQueryRows } from '../../utils/queryResults';
import { createLogger } from '../../utils/logger';
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

const GOLD_ASSET_TABLE = 'ASSETS';

const GOLD_ASSET_COLUMNS = new Set([
  'GUID',
  'ASSET_TYPE',
  'ASSET_NAME',
  'ASSET_QUALIFIED_NAME',
  'DESCRIPTION',
  'README_GUID',
  'STATUS',
  'UPDATED_AT',
  'CREATED_AT',
  'CREATED_BY',
  'SOURCE_CREATED_AT',
  'SOURCE_CREATED_BY',
  'SOURCE_UPDATED_AT',
  'SOURCE_UPDATED_BY',
  'CERTIFICATE_STATUS',
  'CERTIFICATE_UPDATED_AT',
  'CERTIFICATE_UPDATED_BY',
  'CONNECTOR_NAME',
  'CONNECTOR_QUALIFIED_NAME',
  'POPULARITY_SCORE',
  'OWNER_USERS',
  'TERM_GUIDS',
  'TAGS',
  'HAS_LINEAGE',
]);

const GOLD_COLUMN_MAP = {
  GUID: 'GUID',
  TYPENAME: 'ASSET_TYPE',
  NAME: 'ASSET_NAME',
  QUALIFIEDNAME: 'ASSET_QUALIFIED_NAME',
  DISPLAYNAME: 'ASSET_NAME',
  DESCRIPTION: 'DESCRIPTION',
  USERDESCRIPTION: 'DESCRIPTION',
  OWNERUSERS: 'OWNER_USERS',
  OWNERGROUPS: 'OWNER_USERS',
  CERTIFICATESTATUS: 'CERTIFICATE_STATUS',
  CERTIFICATESTATUSMESSAGE: 'CERTIFICATE_STATUS',
  HASLINEAGE: 'HAS_LINEAGE',
  __HASLINEAGE: 'HAS_LINEAGE',
  CLASSIFICATIONNAMES: 'TAGS',
  ASSIGNEDTERMS: 'TERM_GUIDS',
  MEANINGS: 'TERM_GUIDS',
  READMENAME: 'README_GUID',
  READMEGUID: 'README_GUID',
  README: 'README_GUID',
  UPDATETIME: 'UPDATED_AT',
  UPDATE_TIME: 'UPDATED_AT',
  CONNECTORNAME: 'CONNECTOR_NAME',
  CONNECTIONQUALIFIEDNAME: 'CONNECTOR_QUALIFIED_NAME',
  DATABASEQUALIFIEDNAME: 'ASSET_QUALIFIED_NAME',
  SCHEMAQUALIFIEDNAME: 'ASSET_QUALIFIED_NAME',
  DOMAINGUIDS: 'TAGS',
};

const log = createLogger('MDLHAssetFetcher');

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
    this.capabilities = config.capabilities || null;
    this.isGoldLayer = (this.database || '').toUpperCase() === 'ATLAN_GOLD'
      || this.capabilities?.profile === 'ATLAN_GOLD';
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
    log.info('Fetching assets', {
      database: this.database,
      schema: this.schema,
      isGoldLayer: this.isGoldLayer,
      scope,
      assetTypes,
      limit,
      columnCount: columns.length,
    });
    
    // Build queries for each asset type
    const queries = [];
    if (this.isGoldLayer) {
      const sql = this.buildAssetQuery(GOLD_ASSET_TABLE, columns, scope, limit, assetTypes);
      queries.push({ assetType: 'GoldAsset', tableName: GOLD_ASSET_TABLE, sql });
    } else {
      for (const assetType of assetTypes) {
        const tableName = ASSET_TYPE_TO_TABLE[assetType];
        if (!tableName) continue;
        
        const sql = this.buildAssetQuery(tableName, columns, scope, limit, assetType);
        queries.push({ assetType, tableName, sql });
      }
    }
    
    // Execute queries and combine results
    const allAssets = [];
    for (const { assetType, sql } of queries) {
      try {
        const result = await this.executeQuery(sql);
        const normalizedRows = normalizeQueryRows(result);
        for (const row of normalizedRows) {
          allAssets.push(this.mapToAssetRecord(row, assetType));
        }
      } catch (error) {
        console.warn(`Failed to fetch ${assetType} assets:`, error.message);
      }
    }
    
    // Sort by popularity and limit
    allAssets.sort((a, b) => (b.attributes.popularityScore || 0) - (a.attributes.popularityScore || 0));
    log.info('Fetched assets', { assetCount: allAssets.length });
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
    
    if (this.isGoldLayer) {
      const fqn = buildSafeFQN(this.database, this.schema, GOLD_ASSET_TABLE);
      const sql = `
        SELECT ${columns.join(', ')}
        FROM ${fqn}
        WHERE GUID = '${escapedGuid}'
        LIMIT 1
      `;
      
      try {
        const result = await this.executeQuery(sql);
        const normalizedRows = normalizeQueryRows(result);
        if (normalizedRows.length > 0) {
          return this.mapToAssetRecord(normalizedRows[0], 'GoldAsset');
        }
      } catch (error) {
        // Table might not exist, continue
      }
      
      return null;
    }

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
        const normalizedRows = normalizeQueryRows(result);
        if (normalizedRows.length > 0) {
          return this.mapToAssetRecord(normalizedRows[0], assetType);
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
    
    if (this.isGoldLayer) {
      const fqn = buildSafeFQN(this.database, this.schema, GOLD_ASSET_TABLE);
      const whereClause = this.buildWhereClause(scope, assetTypes);
      const sql = `SELECT COUNT(*) as cnt FROM ${fqn} ${whereClause}`;
      
      try {
        const result = await this.executeQuery(sql);
        const normalizedRows = normalizeQueryRows(result);
        if (normalizedRows.length > 0) {
          totalCount += normalizedRows[0].cnt || normalizedRows[0].CNT || 0;
        }
      } catch (error) {
        // Table might not exist
      }
      
      return totalCount;
    }

    for (const assetType of assetTypes) {
      const tableName = ASSET_TYPE_TO_TABLE[assetType];
      if (!tableName) continue;
      
      const fqn = buildSafeFQN(this.database, this.schema, tableName);
      const whereClause = this.buildWhereClause(scope);
      const sql = `SELECT COUNT(*) as cnt FROM ${fqn} ${whereClause}`;
      
      try {
        const result = await this.executeQuery(sql);
        const normalizedRows = normalizeQueryRows(result);
        if (normalizedRows.length > 0) {
          totalCount += normalizedRows[0].cnt || normalizedRows[0].CNT || 0;
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
    
    if (!this.isGoldLayer) {
      return Array.from(allColumns);
    }

    const goldColumns = new Set();
    for (const column of allColumns) {
      const mapped = this.resolveGoldColumn(column);
      if (mapped) {
        goldColumns.add(mapped);
      }
    }

    // Always include core asset columns for Gold Layer
    ['GUID', 'ASSET_TYPE', 'ASSET_NAME', 'ASSET_QUALIFIED_NAME', 'STATUS', 'UPDATED_AT'].forEach((col) => {
      goldColumns.add(col);
    });

    return Array.from(goldColumns);
  }

  /**
   * Build SQL query for fetching assets
   * @param {string} tableName
   * @param {string[]} columns
   * @param {AssessmentScope} scope
   * @param {number} limit
   * @returns {string}
   */
  buildAssetQuery(tableName, columns, scope, limit, assetTypes) {
    const fqn = buildSafeFQN(this.database, this.schema, tableName);
    const whereClause = this.buildWhereClause(scope, assetTypes);
    const selectColumns = columns.length > 0 ? columns.join(', ') : '*';
    
    return `
      SELECT ${selectColumns}
      FROM ${fqn}
      ${whereClause}
      ${this.isGoldLayer ? 'ORDER BY UPDATED_AT DESC NULLS LAST' : 'ORDER BY POPULARITYSCORE DESC NULLS LAST'}
      LIMIT ${limit}
    `;
  }

  /**
   * Build WHERE clause for scope filtering
   * @param {AssessmentScope} scope
   * @returns {string}
   */
  buildWhereClause(scope, assetTypes) {
    const conditions = [];
    
    if (this.isGoldLayer && Array.isArray(assetTypes) && assetTypes.length > 0) {
      const types = assetTypes.map((type) => escapeStringValue(type));
      conditions.push(`ASSET_TYPE IN (${types.join(', ')})`);
    }

    // Scope filtering
    if (scope.level !== 'tenant' && scope.scopeId) {
      const escapedScopeId = escapeStringValue(scope.scopeId);
      
      switch (scope.level) {
        case 'connection':
          if (this.isGoldLayer) {
            conditions.push(`CONNECTOR_QUALIFIED_NAME = '${escapedScopeId}'`);
          } else {
            conditions.push(`CONNECTIONQUALIFIEDNAME = '${escapedScopeId}'`);
          }
          break;
        case 'database':
          if (this.isGoldLayer) {
            conditions.push(`ASSET_QUALIFIED_NAME ILIKE '${escapedScopeId}%'`);
          } else {
            conditions.push(`DATABASEQUALIFIEDNAME = '${escapedScopeId}'`);
          }
          break;
        case 'schema':
          if (this.isGoldLayer) {
            conditions.push(`ASSET_QUALIFIED_NAME ILIKE '${escapedScopeId}%'`);
          } else {
            conditions.push(`SCHEMAQUALIFIEDNAME = '${escapedScopeId}'`);
          }
          break;
        case 'table':
          if (this.isGoldLayer) {
            conditions.push(`(ASSET_QUALIFIED_NAME = '${escapedScopeId}' OR ASSET_QUALIFIED_NAME ILIKE '${escapedScopeId}%')`);
          } else {
            conditions.push(`(QUALIFIEDNAME = '${escapedScopeId}' OR QUALIFIEDNAME LIKE '${escapedScopeId}/%')`);
          }
          break;
        case 'domain':
          if (this.isGoldLayer) {
            conditions.push(`ARRAY_CONTAINS('${escapedScopeId}'::VARIANT, TAGS)`);
          } else {
            conditions.push(`ARRAY_CONTAINS('${escapedScopeId}'::VARIANT, DOMAINGUIDS)`);
          }
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
      typeName: this.isGoldLayer ? normalizedRow.asset_type || assetType : (normalizedRow.typename || assetType),
      qualifiedName: this.isGoldLayer ? normalizedRow.asset_qualified_name || '' : (normalizedRow.qualifiedname || ''),
      displayName: this.isGoldLayer ? normalizedRow.asset_name || '' : (normalizedRow.displayname || normalizedRow.name || ''),
      attributes: this.extractAttributes(normalizedRow),
      classifications: this.isGoldLayer
        ? (this.parseJsonArray(normalizedRow.tags) || [])
        : (this.parseJsonArray(normalizedRow.classificationnames) || []),
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
      asset_name: 'name',
      description: 'description',
      userdescription: 'userDescription',
      ownerusers: 'ownerUsers',
      owner_users: 'ownerUsers',
      ownergroups: 'ownerGroups',
      certificatestatus: 'certificateStatus',
      certificate_status: 'certificateStatus',
      certificatestatusmessage: 'certificateStatusMessage',
      popularityscore: 'popularityScore',
      popularity_score: 'popularityScore',
      querycount: 'queryCount',
      queryusercount: 'queryUserCount',
      haslineage: 'hasLineage',
      has_lineage: 'hasLineage',
      __haslineage: '__hasLineage',
      assignedterms: 'meanings',
      term_guids: 'meanings',
      classificationnames: 'classificationNames',
      tags: 'classificationNames',
      readme: 'readme',
      readme_guid: 'readme',
      createtime: 'createTime',
      created_at: 'createTime',
      updatetime: 'updateTime',
      updated_at: 'updateTime',
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
    if (this.isGoldLayer) {
      return {
        connectionQualifiedName: row.connector_qualified_name,
        connectionName: row.connector_name,
        databaseQualifiedName: row.asset_qualified_name,
        databaseName: this.extractDatabaseName(row.asset_qualified_name),
        schemaQualifiedName: row.asset_qualified_name,
        schemaName: this.extractSchemaName(row.asset_qualified_name),
        domainGuid: this.parseJsonArray(row.tags)?.[0],
      };
    }

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

  extractDatabaseName(qualifiedName) {
    if (!qualifiedName) return undefined;
    const parts = qualifiedName.split('.');
    return parts[0] || undefined;
  }

  extractSchemaName(qualifiedName) {
    if (!qualifiedName) return undefined;
    const parts = qualifiedName.split('.');
    return parts[1] || undefined;
  }

  resolveGoldColumn(column) {
    if (!column) return null;
    const upper = column.toUpperCase();
    const mapped = GOLD_COLUMN_MAP[upper] || upper;
    return GOLD_ASSET_COLUMNS.has(mapped) ? mapped : null;
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
    capabilities: connectionConfig.capabilities,
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
