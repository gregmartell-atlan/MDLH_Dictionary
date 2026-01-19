/**
 * Pivot Templates - Pre-configured pivot analyses for common use cases
 *
 * Templates are matched by table name patterns and validated against
 * available fields before being shown to the user.
 */

// Template definitions organized by table pattern
export const PIVOT_TEMPLATES = {
  // Asset/Entity tables (*_ENTITY)
  '*_ENTITY': [
    {
      id: 'assets-by-type-status',
      name: 'Assets by Type & Status',
      description: 'Count assets grouped by type and certification status',
      icon: '📊',
      requiredFields: ['typeName', 'guid'],
      optionalFields: ['certificateStatus'],
      config: {
        rows: [{ fieldName: 'typeName' }],
        columns: [],
        values: [{
          fieldName: 'guid',
          aggregation: 'COUNT',
          alias: 'asset_count'
        }],
        filters: []
      }
    },
    {
      id: 'asset-ownership',
      name: 'Asset Ownership Analysis',
      description: 'Distribution of assets by owner and type',
      icon: '👥',
      requiredFields: ['typeName', 'guid'],
      optionalFields: ['ownerUsers', 'ownerGroups'],
      config: {
        rows: [
          { fieldName: 'ownerUsers' },
          { fieldName: 'typeName' }
        ],
        columns: [],
        values: [{
          fieldName: 'guid',
          aggregation: 'COUNT',
          alias: 'owned_assets'
        }],
        filters: []
      }
    },
    {
      id: 'popular-assets',
      name: 'Most Popular Assets',
      description: 'Assets with highest view counts and popularity scores',
      icon: '⭐',
      requiredFields: ['name', 'guid'],
      optionalFields: ['viewCount', 'popularity'],
      config: {
        rows: [
          { fieldName: 'typeName' },
          { fieldName: 'name' }
        ],
        columns: [],
        values: [
          {
            fieldName: 'viewCount',
            aggregation: 'SUM',
            alias: 'total_views'
          }
        ],
        filters: []
      }
    },
    {
      id: 'certified-assets',
      name: 'Certification Status Report',
      description: 'Assets grouped by certification level',
      icon: '✓',
      requiredFields: ['certificateStatus', 'guid'],
      optionalFields: ['typeName'],
      config: {
        rows: [
          { fieldName: 'certificateStatus' },
          { fieldName: 'typeName' }
        ],
        columns: [],
        values: [{
          fieldName: 'guid',
          aggregation: 'COUNT',
          alias: 'certified_count'
        }],
        filters: []
      }
    },
    {
      id: 'assets-by-owner',
      name: 'Assets by Owner',
      description: 'Count assets grouped by owner and type',
      icon: '👤',
      requiredFields: ['ownerUsers', 'guid'],
      optionalFields: ['typeName'],
      config: {
        rows: [
          { fieldName: 'ownerUsers' },
          { fieldName: 'typeName' }
        ],
        columns: [],
        values: [{
          fieldName: 'guid',
          aggregation: 'COUNT',
          alias: 'asset_count'
        }],
        filters: []
      }
    },
    {
      id: 'assets-by-status',
      name: 'Assets by Status',
      description: 'Distribution of assets by status and type',
      icon: '🧭',
      requiredFields: ['status', 'guid'],
      optionalFields: ['typeName'],
      config: {
        rows: [
          { fieldName: 'status' },
          { fieldName: 'typeName' }
        ],
        columns: [],
        values: [{
          fieldName: 'guid',
          aggregation: 'COUNT',
          alias: 'status_count'
        }],
        filters: []
      }
    }
  ],

  // Process/Lineage tables (PROCESS_*)
  'PROCESS_*': [
    {
      id: 'lineage-depth',
      name: 'Lineage Depth Analysis',
      description: 'Analyze data pipeline complexity by input/output counts',
      icon: '🔀',
      requiredFields: ['guid'],
      optionalFields: ['inputs', 'outputs', 'processType'],
      config: {
        rows: [{ fieldName: 'processType' }],
        columns: [],
        values: [
          {
            fieldName: 'guid',
            aggregation: 'COUNT',
            alias: 'process_count'
          }
        ],
        filters: []
      }
    },
    {
      id: 'pipeline-health',
      name: 'Pipeline Health Overview',
      description: 'Process success rates by type and status',
      icon: '💚',
      requiredFields: ['guid'],
      optionalFields: ['status', 'processType'],
      config: {
        rows: [
          { fieldName: 'processType' },
          { fieldName: 'status' }
        ],
        columns: [],
        values: [{
          fieldName: 'guid',
          aggregation: 'COUNT',
          alias: 'execution_count'
        }],
        filters: []
      }
    },
    {
      id: 'processes-by-type',
      name: 'Processes by Type',
      description: 'Count processes grouped by process type',
      icon: '⚙️',
      requiredFields: ['processType', 'guid'],
      optionalFields: ['status'],
      config: {
        rows: [
          { fieldName: 'processType' }
        ],
        columns: [],
        values: [{
          fieldName: 'guid',
          aggregation: 'COUNT',
          alias: 'process_count'
        }],
        filters: []
      }
    }
  ],

  // Information Schema Tables
  'INFORMATION_SCHEMA.TABLES': [
    {
      id: 'storage-by-schema',
      name: 'Storage by Schema',
      description: 'Which schemas use the most storage and rows?',
      icon: '💾',
      requiredFields: ['table_schema', 'row_count', 'bytes'],
      optionalFields: [],
      config: {
        rows: [{ fieldName: 'table_schema' }],
        columns: [],
        values: [
          {
            fieldName: 'row_count',
            aggregation: 'SUM',
            alias: 'total_rows'
          },
          {
            fieldName: 'bytes',
            aggregation: 'SUM',
            alias: 'total_bytes'
          }
        ],
        filters: []
      }
    },
    {
      id: 'table-growth',
      name: 'Largest Tables',
      description: 'Tables with highest row counts',
      icon: '📈',
      requiredFields: ['table_schema', 'table_name', 'row_count'],
      optionalFields: [],
      config: {
        rows: [
          { fieldName: 'table_schema' },
          { fieldName: 'table_name' }
        ],
        columns: [],
        values: [{
          fieldName: 'row_count',
          aggregation: 'MAX',
          alias: 'rows'
        }],
        filters: []
      }
    },
    {
      id: 'table-type-distribution',
      name: 'Table Type Distribution',
      description: 'Count of tables by schema and type',
      icon: '📋',
      requiredFields: ['table_schema', 'table_type'],
      optionalFields: [],
      config: {
        rows: [
          { fieldName: 'table_schema' },
          { fieldName: 'table_type' }
        ],
        columns: [],
        values: [{
          fieldName: 'table_name',
          aggregation: 'COUNT',
          alias: 'table_count'
        }],
        filters: []
      }
    }
  ],

  // Information Schema Columns
  'INFORMATION_SCHEMA.COLUMNS': [
    {
      id: 'data-type-distribution',
      name: 'Data Type Distribution',
      description: 'What data types are most common across schemas?',
      icon: '🔤',
      requiredFields: ['table_schema', 'data_type', 'column_name'],
      optionalFields: [],
      config: {
        rows: [
          { fieldName: 'table_schema' },
          { fieldName: 'data_type' }
        ],
        columns: [],
        values: [{
          fieldName: 'column_name',
          aggregation: 'COUNT',
          alias: 'column_count'
        }],
        filters: []
      }
    },
    {
      id: 'nullable-analysis',
      name: 'Nullable Columns Analysis',
      description: 'Data quality: count of nullable vs non-nullable columns',
      icon: '⚠️',
      requiredFields: ['table_name', 'is_nullable', 'column_name'],
      optionalFields: [],
      config: {
        rows: [
          { fieldName: 'table_name' },
          { fieldName: 'is_nullable' }
        ],
        columns: [],
        values: [{
          fieldName: 'column_name',
          aggregation: 'COUNT',
          alias: 'column_count'
        }],
        filters: []
      }
    },
    {
      id: 'columns-per-table',
      name: 'Columns per Table',
      description: 'Count columns grouped by table',
      icon: '🧱',
      requiredFields: ['table_name', 'column_name'],
      optionalFields: ['table_schema'],
      config: {
        rows: [
          { fieldName: 'table_schema' },
          { fieldName: 'table_name' }
        ],
        columns: [],
        values: [{
          fieldName: 'column_name',
          aggregation: 'COUNT',
          alias: 'column_count'
        }],
        filters: []
      }
    }
  ],

  // ============ GOLD LAYER METRICS PIVOTS ============
  // Based on MDLH Metrics Spec - Coverage, Lineage, Quality scores
  
  // GOLD.ASSETS - Core asset metrics
  'GOLD.ASSETS': [
    {
      id: 'gold-completeness-by-type',
      name: '📊 Metadata Completeness by Asset Type',
      description: 'Coverage metrics: description, owner, tags, certification by asset type',
      icon: '📊',
      isGold: true,
      requiredFields: ['ASSET_TYPE', 'GUID'],
      optionalFields: ['DESCRIPTION', 'OWNER_USERS', 'TAGS', 'CERTIFICATE_STATUS'],
      config: {
        rows: [{ fieldName: 'ASSET_TYPE' }],
        columns: [],
        values: [
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'total_assets' },
          { fieldName: 'DESCRIPTION', aggregation: 'COUNT', alias: 'with_description' },
          { fieldName: 'OWNER_USERS', aggregation: 'COUNT', alias: 'with_owner' },
          { fieldName: 'CERTIFICATE_STATUS', aggregation: 'COUNT', alias: 'certified' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-assets-by-connector',
      name: '🔌 Assets by Connector & Status',
      description: 'Asset distribution across connectors with certification status',
      icon: '🔌',
      isGold: true,
      requiredFields: ['CONNECTOR_NAME', 'GUID'],
      optionalFields: ['CERTIFICATE_STATUS', 'STATUS'],
      config: {
        rows: [
          { fieldName: 'CONNECTOR_NAME' },
          { fieldName: 'CERTIFICATE_STATUS' }
        ],
        columns: [],
        values: [
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'asset_count' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-orphaned-assets',
      name: '⚠️ Orphaned Assets (No Owner)',
      description: 'Find assets without owners - governance risk analysis',
      icon: '⚠️',
      isGold: true,
      requiredFields: ['ASSET_TYPE', 'GUID'],
      optionalFields: ['OWNER_USERS', 'OWNER_GROUPS', 'POPULARITY_SCORE'],
      config: {
        rows: [{ fieldName: 'ASSET_TYPE' }],
        columns: [],
        values: [
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'orphan_count' },
          { fieldName: 'POPULARITY_SCORE', aggregation: 'AVG', alias: 'avg_popularity' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-popularity-analysis',
      name: '⭐ Asset Popularity Analysis',
      description: 'Most-used assets by type and connector',
      icon: '⭐',
      isGold: true,
      requiredFields: ['ASSET_TYPE', 'POPULARITY_SCORE'],
      optionalFields: ['CONNECTOR_NAME', 'HAS_LINEAGE'],
      config: {
        rows: [
          { fieldName: 'ASSET_TYPE' },
          { fieldName: 'CONNECTOR_NAME' }
        ],
        columns: [],
        values: [
          { fieldName: 'POPULARITY_SCORE', aggregation: 'AVG', alias: 'avg_popularity' },
          { fieldName: 'POPULARITY_SCORE', aggregation: 'MAX', alias: 'max_popularity' },
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'asset_count' }
        ],
        filters: []
      }
    }
  ],

  // GOLD.FULL_LINEAGE - Lineage coverage metrics
  'GOLD.FULL_LINEAGE': [
    {
      id: 'gold-lineage-coverage',
      name: '🔀 Lineage Coverage by Direction',
      description: 'Upstream vs downstream lineage distribution',
      icon: '🔀',
      isGold: true,
      requiredFields: ['DIRECTION', 'START_GUID'],
      optionalFields: ['LEVEL', 'RELATED_TYPE'],
      config: {
        rows: [{ fieldName: 'DIRECTION' }],
        columns: [],
        values: [
          { fieldName: 'START_GUID', aggregation: 'COUNT_DISTINCT', alias: 'unique_assets' },
          { fieldName: 'LEVEL', aggregation: 'AVG', alias: 'avg_depth' },
          { fieldName: 'LEVEL', aggregation: 'MAX', alias: 'max_depth' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-lineage-depth-analysis',
      name: '📏 Lineage Depth Analysis',
      description: 'How deep is your lineage? Distribution by hop count',
      icon: '📏',
      isGold: true,
      requiredFields: ['LEVEL', 'RELATED_GUID'],
      optionalFields: ['DIRECTION', 'RELATED_TYPE'],
      config: {
        rows: [
          { fieldName: 'LEVEL' },
          { fieldName: 'DIRECTION' }
        ],
        columns: [],
        values: [
          { fieldName: 'RELATED_GUID', aggregation: 'COUNT', alias: 'relationship_count' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-lineage-by-type',
      name: '🔗 Lineage by Asset Type',
      description: 'Which asset types have the most lineage connections?',
      icon: '🔗',
      isGold: true,
      requiredFields: ['RELATED_TYPE', 'RELATED_GUID'],
      optionalFields: ['DIRECTION'],
      config: {
        rows: [
          { fieldName: 'RELATED_TYPE' },
          { fieldName: 'DIRECTION' }
        ],
        columns: [],
        values: [
          { fieldName: 'RELATED_GUID', aggregation: 'COUNT', alias: 'lineage_count' }
        ],
        filters: []
      }
    }
  ],

  // GOLD.TAGS - Tag governance metrics
  'GOLD.TAGS': [
    {
      id: 'gold-tag-distribution',
      name: '🏷️ Tag Distribution by Asset Type',
      description: 'Which tags are applied to which asset types?',
      icon: '🏷️',
      isGold: true,
      requiredFields: ['TAG_NAME', 'ASSET_TYPE'],
      optionalFields: ['PROPAGATES', 'TAG_VALUE'],
      config: {
        rows: [
          { fieldName: 'TAG_NAME' },
          { fieldName: 'ASSET_TYPE' }
        ],
        columns: [],
        values: [
          { fieldName: 'ASSET_GUID', aggregation: 'COUNT', alias: 'tagged_assets' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-pii-classification',
      name: '🔒 PII/Sensitive Data Coverage',
      description: 'Track PII and Confidential tag coverage',
      icon: '🔒',
      isGold: true,
      requiredFields: ['TAG_NAME', 'ASSET_GUID'],
      optionalFields: ['PROPAGATES', 'ASSET_TYPE'],
      config: {
        rows: [{ fieldName: 'TAG_NAME' }],
        columns: [{ fieldName: 'PROPAGATES' }],
        values: [
          { fieldName: 'ASSET_GUID', aggregation: 'COUNT', alias: 'classified_count' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-tag-propagation',
      name: '📡 Tag Propagation Analysis',
      description: 'Which tags propagate through lineage?',
      icon: '📡',
      isGold: true,
      requiredFields: ['TAG_NAME', 'PROPAGATES'],
      optionalFields: ['ASSET_TYPE'],
      config: {
        rows: [
          { fieldName: 'TAG_NAME' },
          { fieldName: 'PROPAGATES' }
        ],
        columns: [],
        values: [
          { fieldName: 'ASSET_GUID', aggregation: 'COUNT', alias: 'tag_count' }
        ],
        filters: []
      }
    }
  ],

  // GOLD.GLOSSARY_DETAILS - Business glossary metrics
  'GOLD.GLOSSARY_DETAILS': [
    {
      id: 'gold-glossary-coverage',
      name: '📖 Glossary Term Coverage',
      description: 'How many terms are linked to assets?',
      icon: '📖',
      isGold: true,
      requiredFields: ['ASSET_TYPE', 'GUID'],
      optionalFields: ['ASSIGNED_ASSETS', 'ANCHOR'],
      config: {
        rows: [{ fieldName: 'ASSET_TYPE' }],
        columns: [],
        values: [
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'term_count' },
          { fieldName: 'ASSIGNED_ASSETS', aggregation: 'COUNT', alias: 'with_assignments' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-glossary-by-anchor',
      name: '📚 Terms by Glossary',
      description: 'Distribution of terms across glossaries',
      icon: '📚',
      isGold: true,
      requiredFields: ['ANCHOR', 'GUID'],
      optionalFields: ['ASSET_TYPE'],
      config: {
        rows: [{ fieldName: 'ANCHOR' }],
        columns: [],
        values: [
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'term_count' }
        ],
        filters: []
      }
    }
  ],

  // GOLD.DATA_QUALITY_DETAILS - DQ check metrics
  'GOLD.DATA_QUALITY_DETAILS': [
    {
      id: 'gold-dq-coverage',
      name: '✅ Data Quality Check Coverage',
      description: 'Which assets have DQ checks from Anomalo, Soda, Monte Carlo?',
      icon: '✅',
      isGold: true,
      requiredFields: ['ASSET_TYPE', 'ASSET_GUID'],
      optionalFields: ['ANOMALO_CHECK_TYPE', 'SODA_CHECK_DEFINITION', 'MC_MONITOR_TYPE'],
      config: {
        rows: [{ fieldName: 'ASSET_TYPE' }],
        columns: [],
        values: [
          { fieldName: 'ASSET_GUID', aggregation: 'COUNT', alias: 'assets_with_dq' },
          { fieldName: 'ANOMALO_CHECK_TYPE', aggregation: 'COUNT', alias: 'anomalo_checks' },
          { fieldName: 'MC_MONITOR_TYPE', aggregation: 'COUNT', alias: 'mc_monitors' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-mc-monitor-status',
      name: '🔍 Monte Carlo Monitor Status',
      description: 'Status of Monte Carlo monitors across assets',
      icon: '🔍',
      isGold: true,
      requiredFields: ['MC_MONITOR_STATUS', 'ASSET_GUID'],
      optionalFields: ['MC_MONITOR_TYPE', 'ASSET_TYPE'],
      config: {
        rows: [
          { fieldName: 'MC_MONITOR_STATUS' },
          { fieldName: 'MC_MONITOR_TYPE' }
        ],
        columns: [],
        values: [
          { fieldName: 'ASSET_GUID', aggregation: 'COUNT', alias: 'monitor_count' }
        ],
        filters: []
      }
    }
  ],

  // GOLD.RELATIONAL_ASSET_DETAILS - Table size/usage metrics
  'GOLD.RELATIONAL_ASSET_DETAILS': [
    {
      id: 'gold-table-usage',
      name: '📊 Table Usage Analysis',
      description: 'Row counts, read activity, and user engagement',
      icon: '📊',
      isGold: true,
      requiredFields: ['ASSET_TYPE', 'TABLE_ROW_COUNT'],
      optionalFields: ['TABLE_SIZE_BYTES', 'TABLE_TOTAL_READ_COUNT', 'TABLE_RECENT_USERS'],
      config: {
        rows: [{ fieldName: 'ASSET_TYPE' }],
        columns: [],
        values: [
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'table_count' },
          { fieldName: 'TABLE_ROW_COUNT', aggregation: 'SUM', alias: 'total_rows' },
          { fieldName: 'TABLE_SIZE_BYTES', aggregation: 'SUM', alias: 'total_bytes' },
          { fieldName: 'TABLE_TOTAL_READ_COUNT', aggregation: 'SUM', alias: 'total_reads' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-storage-distribution',
      name: '💾 Storage Distribution by Connector',
      description: 'Which connectors use the most storage?',
      icon: '💾',
      isGold: true,
      requiredFields: ['CONNECTOR_NAME', 'TABLE_SIZE_BYTES'],
      optionalFields: ['TABLE_ROW_COUNT'],
      config: {
        rows: [{ fieldName: 'CONNECTOR_NAME' }],
        columns: [],
        values: [
          { fieldName: 'TABLE_SIZE_BYTES', aggregation: 'SUM', alias: 'total_bytes' },
          { fieldName: 'TABLE_ROW_COUNT', aggregation: 'SUM', alias: 'total_rows' },
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'table_count' }
        ],
        filters: []
      }
    }
  ],

  // GOLD.DATA_MESH_DETAILS - Data Product metrics
  'GOLD.DATA_MESH_DETAILS': [
    {
      id: 'gold-data-product-status',
      name: '📦 Data Product Status',
      description: 'Status and criticality of data products',
      icon: '📦',
      isGold: true,
      requiredFields: ['DATA_PRODUCT_STATUS', 'GUID'],
      optionalFields: ['CRITICALITY', 'SENSITIVITY'],
      config: {
        rows: [
          { fieldName: 'DATA_PRODUCT_STATUS' },
          { fieldName: 'CRITICALITY' }
        ],
        columns: [],
        values: [
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'product_count' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-domain-coverage',
      name: '🏢 Domain Coverage Analysis',
      description: 'Assets by data domain and sensitivity level',
      icon: '🏢',
      isGold: true,
      requiredFields: ['ASSET_TYPE', 'GUID'],
      optionalFields: ['SENSITIVITY', 'CRITICALITY'],
      config: {
        rows: [
          { fieldName: 'ASSET_TYPE' },
          { fieldName: 'SENSITIVITY' }
        ],
        columns: [],
        values: [
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'asset_count' }
        ],
        filters: []
      }
    }
  ],

  // GOLD.ASSET_LOOKUP_TABLE - Fast lookup pivots
  'GOLD.ASSET_LOOKUP_TABLE': [
    {
      id: 'gold-asset-completeness-score',
      name: '📈 Asset Completeness Scorecard',
      description: 'Comprehensive metadata completeness by type',
      icon: '📈',
      isGold: true,
      requiredFields: ['TYPE_NAME', 'GUID'],
      optionalFields: ['DESCRIPTION', 'OWNER_USERS', 'TAG_NAMES', 'CERTIFICATE_STATUS', 'HAS_LINEAGE'],
      config: {
        rows: [{ fieldName: 'TYPE_NAME' }],
        columns: [],
        values: [
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'total_assets' },
          { fieldName: 'DESCRIPTION', aggregation: 'COUNT', alias: 'has_description' },
          { fieldName: 'OWNER_USERS', aggregation: 'COUNT', alias: 'has_owner' },
          { fieldName: 'TAG_NAMES', aggregation: 'COUNT', alias: 'has_tags' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-lineage-status',
      name: '🔗 Lineage Status Overview',
      description: 'Assets with/without lineage by type and connector',
      icon: '🔗',
      isGold: true,
      requiredFields: ['TYPE_NAME', 'HAS_LINEAGE'],
      optionalFields: ['CONNECTOR_NAME', 'STATUS'],
      config: {
        rows: [
          { fieldName: 'TYPE_NAME' },
          { fieldName: 'HAS_LINEAGE' }
        ],
        columns: [],
        values: [
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'asset_count' }
        ],
        filters: []
      }
    },
    {
      id: 'gold-certification-by-connector',
      name: '✓ Certification by Connector',
      description: 'Certification status across data sources',
      icon: '✓',
      isGold: true,
      requiredFields: ['CONNECTOR_NAME', 'CERTIFICATE_STATUS'],
      optionalFields: ['TYPE_NAME', 'STATUS'],
      config: {
        rows: [
          { fieldName: 'CONNECTOR_NAME' },
          { fieldName: 'CERTIFICATE_STATUS' }
        ],
        columns: [],
        values: [
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'asset_count' }
        ],
        filters: []
      }
    }
  ],

  // Generic GOLD.* pattern for any Gold table
  'GOLD.*': [
    {
      id: 'gold-generic-by-type',
      name: '📊 Gold Layer Analysis by Type',
      description: 'Generic pivot for any Gold Layer table',
      icon: '📊',
      isGold: true,
      requiredFields: ['ASSET_TYPE', 'GUID'],
      optionalFields: [],
      config: {
        rows: [{ fieldName: 'ASSET_TYPE' }],
        columns: [],
        values: [
          { fieldName: 'GUID', aggregation: 'COUNT', alias: 'count' }
        ],
        filters: []
      }
    }
  ],

  // Default templates for any table
  'DEFAULT': [
    {
      id: 'row-count',
      name: 'Simple Row Count',
      description: 'Count total rows in the table',
      icon: '#️⃣',
      requiredFields: [],
      optionalFields: [],
      config: {
        rows: [],
        columns: [],
        values: [{
          fieldName: '*',
          aggregation: 'COUNT',
          alias: 'row_count'
        }],
        filters: []
      }
    }
  ]
};

/**
 * Match table name against pattern
 */
function matchesPattern(tableName, pattern) {
  if (pattern === 'DEFAULT') return true;

  const regex = new RegExp(
    '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    'i'
  );
  return regex.test(tableName);
}

/**
 * Check if all required fields exist in available fields
 */
function hasRequiredFields(template, availableFields) {
  const fieldNames = availableFields.map(f => f.fieldName.toLowerCase());

  return template.requiredFields.every(required =>
    fieldNames.includes(required.toLowerCase())
  );
}

/**
 * Enrich template config with full field objects
 */
function enrichTemplateConfig(template, availableFields) {
  const fieldMap = new Map(
    availableFields.map(f => [f.fieldName.toLowerCase(), f])
  );

  const enrichField = (fieldRef) => {
    if (fieldRef.fieldName === '*') {
      // Special case for COUNT(*)
      return {
        ...fieldRef,
        fieldName: 'guid', // Use first field or guid as proxy
        dataType: 'NUMBER',
        fieldType: 'measure'
      };
    }

    const field = fieldMap.get(fieldRef.fieldName.toLowerCase());
    if (!field) return null;

    return {
      ...field,
      aggregation: fieldRef.aggregation,
      alias: fieldRef.alias
    };
  };

  return {
    ...template.config,
    rows: template.config.rows
      .map(enrichField)
      .filter(Boolean),
    columns: template.config.columns
      .map(enrichField)
      .filter(Boolean),
    values: template.config.values
      .map(enrichField)
      .filter(Boolean),
    filters: template.config.filters || []
  };
}

/**
 * Get recommended pivot templates for a table
 *
 * @param {string} tableName - Name of the table
 * @param {Array} availableFields - Discovered fields
 * @returns {Array} Array of applicable templates with enriched configs
 */
export function getRecommendedPivots(tableName, availableFields) {
  if (!tableName || !availableFields || availableFields.length === 0) {
    return [];
  }

  const recommendations = [];

  // Find matching template sets
  for (const [pattern, templates] of Object.entries(PIVOT_TEMPLATES)) {
    if (pattern === 'DEFAULT') continue; // Handle default last

    if (matchesPattern(tableName, pattern)) {
      // Filter templates that have required fields
      const applicable = templates
        .filter(template => hasRequiredFields(template, availableFields))
        .map(template => ({
          ...template,
          enrichedConfig: enrichTemplateConfig(template, availableFields)
        }));

      recommendations.push(...applicable);
    }
  }

  // Add default templates if no specific matches
  if (recommendations.length === 0 && PIVOT_TEMPLATES.DEFAULT) {
    const defaultTemplates = PIVOT_TEMPLATES.DEFAULT.map(template => ({
      ...template,
      enrichedConfig: enrichTemplateConfig(template, availableFields)
    }));
    recommendations.push(...defaultTemplates);
  }

  return recommendations;
}

/**
 * Apply a template to current pivot configuration
 *
 * @param {Object} template - Template to apply
 * @returns {Object} Configuration object ready for pivot state
 */
export function applyTemplate(template) {
  if (!template.enrichedConfig) {
    throw new Error('Template must be enriched before applying');
  }

  return template.enrichedConfig;
}

export default {
  PIVOT_TEMPLATES,
  getRecommendedPivots,
  applyTemplate
};
