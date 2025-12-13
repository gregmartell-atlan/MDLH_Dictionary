/**
 * Recipe Builder - Converts data-driven recipes into executable MultiStepFlows
 * 
 * This is the bridge between the declarative QUERY_RECIPES and the 
 * executable MultiStepFlow format that StepWizard consumes.
 * 
 * CONFIG-DRIVEN: All entity locations are resolved from SystemConfig when available.
 */

import { buildExtractorFromBindings } from './extractors';

/**
 * Resolve entity location from SystemConfig.
 * 
 * @param {string} entityName - Logical entity name (e.g., 'PROCESS_ENTITY')
 * @param {Object} systemConfig - SystemConfig from backend
 * @returns {{ database: string, schema: string, table: string } | null}
 */
function getEntityFromConfig(entityName, systemConfig) {
  if (!systemConfig?.snowflake?.entities) return null;
  return systemConfig.snowflake.entities[entityName] || null;
}

/**
 * Get the fully qualified table name from SystemConfig or defaults.
 * 
 * @param {string} entityName - Logical entity name
 * @param {Object} systemConfig - SystemConfig from backend
 * @param {string} defaultDb - Default database
 * @param {string} defaultSchema - Default schema
 * @returns {string} Fully qualified table name
 */
function getEntityFQN(entityName, systemConfig, defaultDb = 'FIELD_METADATA', defaultSchema = 'PUBLIC') {
  const entity = getEntityFromConfig(entityName, systemConfig);
  
  if (entity) {
    return `"${entity.database}"."${entity.schema}"."${entity.table}"`;
  }
  
  // Fallback to defaults
  return `"${defaultDb}"."${defaultSchema}"."${entityName}"`;
}

/**
 * Get metadata db/schema from SystemConfig or defaults.
 */
function getMetadataContext(systemConfig, fallbackDb = 'FIELD_METADATA', fallbackSchema = 'PUBLIC') {
  const defaults = systemConfig?.queryDefaults || {};
  return {
    db: defaults.metadataDb || fallbackDb,
    schema: defaults.metadataSchema || fallbackSchema,
  };
}

/**
 * SQL Query Templates - These are the actual SQL generators.
 * Each template is a function that takes params and returns SQL.
 * 
 * Add new templates here as you add queries to recipes.
 */
const SQL_TEMPLATES = {
  // ============================================
  // CORE - Process/Lineage Tables
  // ============================================
  
  core_show_process_tables: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- Discovery: Find lineage/process tables WITH row counts
-- Tables with more rows are more likely to have useful data

SELECT 
    table_name AS name,
    row_count,
    ROUND(bytes / 1024 / 1024, 2) AS size_mb,
    CASE 
        WHEN table_name LIKE '%PROCESS%' THEN 'lineage'
        WHEN table_name LIKE '%COLUMN%' THEN 'column-level'
        ELSE 'other'
    END AS category
FROM ${db}.information_schema.tables
WHERE table_schema = '${schema}'
  AND table_name LIKE '%PROCESS%'
  AND row_count > 0
ORDER BY row_count DESC
LIMIT 20;`;
  },

  core_describe_process_table: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.processTable || 'PROCESS_ENTITY';
    return `-- Discovery: Get columns with data types for ${table}
-- This helps us understand how to query and display the data

SELECT 
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN data_type LIKE 'ARRAY%' THEN 'expandable'
        WHEN data_type LIKE 'OBJECT%' OR data_type = 'VARIANT' THEN 'json'
        WHEN column_name IN ('GUID', 'QUALIFIEDNAME') THEN 'identifier'
        WHEN data_type LIKE 'TIMESTAMP%' THEN 'datetime'
        ELSE 'text'
    END AS display_hint
FROM ${db}.information_schema.columns
WHERE table_schema = '${schema}'
  AND table_name = '${table}'
ORDER BY ordinal_position;

-- Key columns for lineage: INPUTS, OUTPUTS, GUID, NAME`;
  },

  core_sample_process_rows: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.processTable || 'PROCESS_ENTITY';
    const guid = params.entityGuid;
    
    if (guid) {
      return `-- Look for your asset in lineage data
-- Your asset GUID: ${guid}
-- Using FLATTEN to search within ARRAY<OBJECT> columns

SELECT DISTINCT
    p.guid AS process_guid,
    p.name AS process_name,
    ARRAY_SIZE(p.inputs) AS input_count,
    ARRAY_SIZE(p.outputs) AS output_count
FROM ${db}.${schema}.${table} p,
    LATERAL FLATTEN(input => ARRAY_CAT(
        COALESCE(p.inputs, ARRAY_CONSTRUCT()),
        COALESCE(p.outputs, ARRAY_CONSTRUCT())
    ), OUTER => TRUE) f
WHERE f.value:guid::VARCHAR ILIKE '%${guid}%'
   OR f.value:qualifiedName::VARCHAR ILIKE '%${guid}%'
LIMIT 10;`;
    }
    
    return `-- Sample lineage data to find assets
-- Shows processes that have inputs or outputs

SELECT 
    guid AS process_guid,
    name AS process_name,
    typename AS process_type,
    ARRAY_SIZE(inputs) AS input_count,
    ARRAY_SIZE(outputs) AS output_count
FROM ${db}.${schema}.${table}
WHERE ARRAY_SIZE(inputs) > 0 OR ARRAY_SIZE(outputs) > 0
LIMIT 10;`;
  },

  core_full_lineage_query: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.processTable || 'PROCESS_ENTITY';
    const direction = params.direction || 'DOWNSTREAM';
    const guid = params.guid || params.entityGuid;
    const entityName = params.entityName || guid || 'unknown';
    
    // For downstream: find processes where inputs contain our asset (our asset feeds INTO them)
    // For upstream: find processes where outputs contain our asset (they feed INTO our asset)
    const searchColumn = direction === 'UPSTREAM' ? 'outputs' : 'inputs';
    const directionLabel = direction === 'UPSTREAM' ? 'upstream sources' : 'downstream consumers';
    
    // If no GUID provided, show a sample of processes with lineage data
    if (!guid || guid === '<YOUR_ASSET_GUID>') {
      return `-- Lineage Query - Sample processes with ${directionLabel}
-- No specific GUID provided - showing sample data
-- TIP: Click a row above to use its GUID, or run Step 3 to find assets

SELECT 
    p.guid AS process_guid,
    p.name AS process_name,
    p.typename AS process_type,
    ARRAY_SIZE(p.inputs) AS input_count,
    ARRAY_SIZE(p.outputs) AS output_count
FROM ${db}.${schema}.${table} p
WHERE ARRAY_SIZE(p.${searchColumn}) > 0
ORDER BY p.name
LIMIT 20;`;
    }
    
    return `-- Full Lineage Query - ${direction} dependencies
-- Starting from: ${entityName}
-- Finding: ${directionLabel}
-- Search GUID: ${guid}

-- Step 1: Find processes connected to this asset
SELECT DISTINCT
    p.guid AS process_guid,
    p.name AS process_name,
    p.typename AS process_type,
    ARRAY_SIZE(p.inputs) AS input_count,
    ARRAY_SIZE(p.outputs) AS output_count
FROM ${db}.${schema}.${table} p,
    LATERAL FLATTEN(input => p.${searchColumn}, OUTER => TRUE) f
WHERE f.value:guid::VARCHAR = '${guid}'
   OR f.value:qualifiedName::VARCHAR ILIKE '%${guid}%'
LIMIT 20;

-- Step 2: See the actual linked assets (uncomment to run):
/*
SELECT 
    p.guid AS process_guid,
    p.name AS process_name,
    f.value:guid::VARCHAR AS linked_asset_guid,
    f.value:typeName::VARCHAR AS linked_asset_type,
    f.value:qualifiedName::VARCHAR AS linked_asset_name
FROM ${db}.${schema}.${table} p,
    LATERAL FLATTEN(input => p.${direction === 'UPSTREAM' ? 'inputs' : 'outputs'}) f
WHERE p.guid IN (
    SELECT DISTINCT p2.guid 
    FROM ${db}.${schema}.${table} p2,
        LATERAL FLATTEN(input => p2.${searchColumn}) f2
    WHERE f2.value:guid::VARCHAR = '${guid}'
)
LIMIT 50;
*/`;
  },

  // ============================================
  // CORE - Schema Discovery
  // ============================================
  
  core_show_all_tables: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- List all tables in the schema
SHOW TABLES IN ${db}.${schema};`;
  },

  core_describe_table: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.table || params.selectedTable || 'TABLE_ENTITY';
    return `-- Describe table structure
DESCRIBE TABLE ${db}.${schema}.${table};`;
  },

  core_sample_table_rows: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.table || params.selectedTable || 'TABLE_ENTITY';
    return `-- Sample rows from table
SELECT * FROM ${db}.${schema}.${table} LIMIT 20;`;
  },

  // ============================================
  // GLOSSARY
  // ============================================
  
  glossary_show_tables: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- Find glossary-related tables
SHOW TABLES LIKE '%GLOSSARY%' IN ${db}.${schema};`;
  },

  glossary_list_all: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- List all glossaries
SELECT guid, name, displayname, qualifiedname
FROM ${db}.${schema}.ATLASGLOSSARY_ENTITY
ORDER BY name
LIMIT 100;`;
  },

  glossary_search_terms: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const searchTerm = params.searchTerm || '%';
    return `-- Search for glossary terms
SELECT guid, name, displayname, qualifiedname, description
FROM ${db}.${schema}.ATLASGLOSSARYTERM_ENTITY
WHERE name ILIKE '%${searchTerm}%' 
   OR displayname ILIKE '%${searchTerm}%'
ORDER BY name
LIMIT 50;`;
  },

  // ============================================
  // COLUMN PROFILING
  // ============================================
  
  profile_column_stats: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.table;
    const column = params.column;
    return `-- Column statistics
SELECT 
    COUNT(*) AS total_count,
    COUNT(${column}) AS non_null_count,
    COUNT(*) - COUNT(${column}) AS null_count,
    ROUND(100.0 * (COUNT(*) - COUNT(${column})) / NULLIF(COUNT(*), 0), 2) AS null_percent,
    COUNT(DISTINCT ${column}) AS distinct_count
FROM ${db}.${schema}.${table};`;
  },

  profile_top_values: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.table;
    const column = params.column;
    return `-- Top values by frequency
SELECT 
    ${column} AS value,
    COUNT(*) AS count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) AS percent
FROM ${db}.${schema}.${table}
WHERE ${column} IS NOT NULL
GROUP BY ${column}
ORDER BY count DESC
LIMIT 20;`;
  },

  profile_sample_values: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const table = params.table;
    const column = params.column;
    return `-- Sample values
SELECT DISTINCT ${column} AS value
FROM ${db}.${schema}.${table}
WHERE ${column} IS NOT NULL
LIMIT 50;`;
  },

  // ============================================
  // USAGE
  // ============================================
  
  usage_find_tables: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- Find usage/query history tables
SHOW TABLES LIKE '%QUERY%' IN ${db}.${schema};`;
  },

  usage_recent_queries: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const assetName = params.assetName || '';
    return `-- Recent queries referencing this asset
-- Note: This requires QUERY_HISTORY_ENTITY or Snowflake ACCOUNT_USAGE access
SELECT 
    guid,
    name,
    createtime,
    username
FROM ${db}.${schema}.QUERY_ENTITY
WHERE qualifiedname ILIKE '%${assetName}%'
ORDER BY createtime DESC
LIMIT 20;`;
  },

  usage_popularity: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const assetName = params.assetName || '';
    return `-- Asset popularity analysis
-- Requires usage data in your schema
SELECT 
    name,
    COUNT(*) AS query_count,
    COUNT(DISTINCT username) AS unique_users
FROM ${db}.${schema}.QUERY_ENTITY
WHERE qualifiedname ILIKE '%${assetName}%'
GROUP BY name
ORDER BY query_count DESC
LIMIT 20;`;
  },

  // ============================================
  // DBT
  // ============================================
  
  dbt_show_tables: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- Find dbt-related tables
SHOW TABLES LIKE '%DBT%' IN ${db}.${schema};`;
  },

  dbt_list_models: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- List dbt models
SELECT guid, name, displayname, qualifiedname
FROM ${db}.${schema}.DBTMODEL_ENTITY
ORDER BY name
LIMIT 100;`;
  },

  dbt_model_dependencies: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const modelGuid = params.modelGuid || params.selectedModelGuid || '<MODEL_GUID>';
    return `-- Find dbt model dependencies
SELECT 
    p."GUID" AS process_guid,
    p."NAME" AS process_name,
    p."INPUTS",
    p."OUTPUTS"
FROM ${db}.${schema}.PROCESS_ENTITY p
WHERE p."INPUTS"::VARCHAR ILIKE '%${modelGuid}%'
   OR p."OUTPUTS"::VARCHAR ILIKE '%${modelGuid}%'
LIMIT 20;`;
  },

  // ============================================
  // BI TOOLS
  // ============================================
  
  bi_show_tables: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- Find BI-related entity tables
SHOW TABLES LIKE '%DASHBOARD%' IN ${db}.${schema};`;
  },

  bi_list_dashboards: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    return `-- List dashboards (adjust table name for your BI tool)
SELECT guid, name, displayname, qualifiedname
FROM ${db}.${schema}.POWERBIDASHBOARD_ENTITY
ORDER BY name
LIMIT 50;`;
  },

  bi_dashboard_sources: (params) => {
    const db = params.database || 'FIELD_METADATA';
    const schema = params.schema || 'PUBLIC';
    const dashboardGuid = params.dashboardGuid || params.selectedDashboardGuid || '<DASHBOARD_GUID>';
    return `-- Find data sources for dashboard
SELECT 
    p."GUID" AS process_guid,
    p."NAME" AS process_name,
    p."INPUTS" AS data_sources
FROM ${db}.${schema}.BIPROCESS_ENTITY p
WHERE p."OUTPUTS"::VARCHAR ILIKE '%${dashboardGuid}%'
LIMIT 20;`;
  },
};

/**
 * Get a SQL template by ID
 */
export function getSqlTemplate(queryId) {
  return SQL_TEMPLATES[queryId] || null;
}

/**
 * Build a FlowStep from a recipe step definition
 * 
 * @param {Object} step - Step definition from recipe
 * @param {number} stepIndex - Index of this step
 * @param {string|null} nextStepId - ID of the next step
 * @param {Object} [systemConfig] - SystemConfig for entity resolution
 */
function buildFlowStep(step, stepIndex, nextStepId, systemConfig = null) {
  const template = getSqlTemplate(step.queryId);
  
  if (!template) {
    console.warn(`[RecipeBuilder] Missing SQL template for queryId: ${step.queryId}`);
  }
  
  return {
    id: step.id,
    title: step.title || `Step ${stepIndex + 1}`,
    description: step.description || '',
    optional: !!step.optional,
    
    /**
     * Build SQL from template + inputs
     * 
     * Uses SystemConfig when available to resolve entity locations.
     */
    buildQuery: (entity, inputs) => {
      if (!template) {
        return `-- Missing SQL template for: ${step.queryId}
-- Add this template to SQL_TEMPLATES in recipeBuilder.js`;
      }
      
      // Get metadata context from SystemConfig
      const meta = getMetadataContext(inputs.systemConfig || systemConfig);
      
      // Build params from entity + inputs + inputBindings
      const params = {
        entity,
        entityGuid: entity?.guid,
        entityName: entity?.name,
        entityType: entity?.type,
        database: entity?.database || inputs.database || meta.db,
        schema: entity?.schema || inputs.schema || meta.schema,
        systemConfig: inputs.systemConfig || systemConfig,
        ...inputs,
      };
      
      // Apply input bindings (map wizard inputs to template params)
      if (step.inputBindings) {
        for (const [paramKey, inputKey] of Object.entries(step.inputBindings)) {
          if (inputs[inputKey] !== undefined) {
            params[paramKey] = inputs[inputKey];
          }
        }
      }
      
      return template(params);
    },
    
    /**
     * Extract data for next step using generic extractors
     */
    extractDataForNext: buildExtractorFromBindings(step.outputBindings),
    
    nextStep: nextStepId,
    shouldSkip: step.shouldSkip || null,
    skipMessage: step.skipMessage || '',
  };
}

/**
 * Build a complete MultiStepFlow from a recipe
 * 
 * @param {Object} recipe - The recipe definition
 * @param {Object} [systemConfig] - Optional SystemConfig for config-driven entity resolution
 */
export function buildFlowFromRecipe(recipe, systemConfig = null) {
  if (!recipe || !recipe.steps) {
    console.error('[RecipeBuilder] Invalid recipe:', recipe);
    return null;
  }
  
  // Build steps with proper next step linking
  const steps = recipe.steps.map((step, index) => {
    const nextStepId = recipe.steps[index + 1]?.id || null;
    return buildFlowStep(step, index, nextStepId, systemConfig);
  });
  
  /** @type {import('./types').MultiStepFlow} */
  const flow = {
    id: recipe.id,
    label: recipe.label,
    description: recipe.description,
    icon: recipe.icon,
    supportedEntityTypes: recipe.supportedEntityTypes || ['UNKNOWN'],
    domains: recipe.domains || [],
    intent: recipe.intent,
    steps,
    
    buildInitialInputs: (entity, availableTables = [], config = null) => {
      // Use SystemConfig to determine default db/schema
      const meta = getMetadataContext(config || systemConfig);
      
      return {
        // Standard entity context
        entityGuid: entity?.guid,
        entityName: entity?.name,
        entityType: entity?.type,
        database: entity?.database || meta.db,
        schema: entity?.schema || meta.schema,
        availableTables,
        
        // Pass systemConfig through for step builders
        systemConfig: config || systemConfig,
        
        // Recipe-specific defaults
        ...(recipe.defaultInputs || {}),
      };
    },
  };
  
  return flow;
}

/**
 * Register a custom SQL template
 */
export function registerSqlTemplate(queryId, templateFn) {
  SQL_TEMPLATES[queryId] = templateFn;
}

export default {
  buildFlowFromRecipe,
  getSqlTemplate,
  registerSqlTemplate,
};

