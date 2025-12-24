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
