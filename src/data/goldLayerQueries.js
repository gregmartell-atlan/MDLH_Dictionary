/**
 * MDLH Gold Layer Query Library
 * 
 * Reference-ready queries for the curated Gold Layer views in the Metadata Lakehouse.
 * These queries use Snowflake syntax against an Iceberg REST catalog (context_store DB).
 * 
 * Gold Layer provides pre-joined, curated views for common use cases:
 * - GOLD.ASSETS - General asset information with enrichments
 * - GOLD.README - Readme documentation
 * - GOLD.TAGS - Tag relationships
 * - GOLD.CUSTOM_METADATA - Custom metadata attributes
 * - GOLD.GLOSSARY_DETAILS - Glossary terms and categories
 * - GOLD.DATA_QUALITY_DETAILS - Data quality check results
 * - GOLD.PIPELINE_DETAILS - Pipeline/process touchpoints
 * - GOLD.RELATIONAL_ASSET_DETAILS - Table statistics
 * - GOLD.DATA_MESH_DETAILS - Data products and domains
 * - GOLD.FULL_LINEAGE - Complete lineage graph
 * - GOLD.ASSET_LOOKUP_TABLE - Fast asset lookup with key attributes
 * 
 * Source: MDLH Query Library Documentation
 * @see /Users/greg.martell/MDLH-Query-Library.md
 */

// =============================================================================
// GOLD LAYER QUERY CATEGORIES
// =============================================================================

export const GOLD_QUERY_CATEGORIES = {
  ASSETS: 'gold_assets',
  LINEAGE: 'gold_lineage',
  GOVERNANCE: 'gold_governance',
  GLOSSARY: 'gold_glossary',
  QUALITY: 'gold_quality',
  COMPLETENESS: 'gold_completeness',
  HISTORY: 'gold_history',
};

// =============================================================================
// FREQUENCY LEVELS FOR GOLD QUERIES
// =============================================================================

export const GOLD_FREQUENCY_LEVELS = {
  STARTER: 'Starter',      // Essential getting-started queries
  COMMON: 'Common',        // Frequently used patterns
  ADVANCED: 'Advanced',    // Complex analysis queries
  EXPORT: 'Export',        // Data export queries
};

export const GOLD_FREQUENCY_STYLES = {
  'Starter': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  'Common': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  'Advanced': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  'Export': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
};

// =============================================================================
// GOLD LAYER TABLES REFERENCED
// =============================================================================

export const GOLD_LAYER_TABLES = [
  'GOLD.ASSETS',
  'GOLD.README',
  'GOLD.TAGS',
  'GOLD.CUSTOM_METADATA',
  'GOLD.GLOSSARY_DETAILS',
  'GOLD.DATA_QUALITY_DETAILS',
  'GOLD.PIPELINE_DETAILS',
  'GOLD.RELATIONAL_ASSET_DETAILS',
  'GOLD.DATA_MESH_DETAILS',
  'GOLD.FULL_LINEAGE',
  'GOLD.ASSET_LOOKUP_TABLE',
];

// =============================================================================
// GOLD LAYER QUERIES
// =============================================================================

// =============================================================================
// GOLD TABLE DISCOVERY QUERY
// =============================================================================

/**
 * Discovery query to find Gold Layer tables in the database
 * Run this first to see what Gold tables are available
 */
export const GOLD_DISCOVERY_QUERY = {
  id: 'gold-discovery',
  name: 'Discover Gold Layer Tables',
  description: 'Find available Gold Layer tables in your database',
  sql: `-- Discover Gold Layer tables
-- Checks both GOLD schema and PUBLIC schema for Gold-like tables
SELECT 
    table_schema,
    table_name,
    row_count,
    bytes
FROM {{DATABASE}}.information_schema.tables
WHERE table_schema IN ('GOLD', 'PUBLIC')
  AND (
    table_name IN ('ASSETS', 'FULL_LINEAGE', 'GLOSSARY_DETAILS', 'ASSET_LOOKUP_TABLE', 
                   'TAGS', 'README', 'CUSTOM_METADATA', 'DATA_QUALITY_DETAILS',
                   'PIPELINE_DETAILS', 'RELATIONAL_ASSET_DETAILS', 'DATA_MESH_DETAILS')
    OR table_name LIKE 'GOLD_%'
    OR table_name LIKE '%_GOLD'
  )
ORDER BY table_schema, table_name;`,
};

export const GOLD_LAYER_QUERIES = [
  // ---------------------------------------------------------------------------
  // GOLD TABLE DISCOVERY (Run this first!)
  // ---------------------------------------------------------------------------
  {
    id: 'gold-discovery-tables',
    category: GOLD_QUERY_CATEGORIES.ASSETS,
    name: '🔍 Discover Gold Layer Tables',
    description: 'Find which Gold Layer tables exist in your database (run this first!)',
    userIntent: 'What Gold Layer tables are available?',
    frequency: GOLD_FREQUENCY_LEVELS.STARTER,
    frequencyDetail: 'Essential - Run First',
    source: 'MDLH Query Library - Discovery',
    confidence: 'high',
    goldTables: [],
    sql: GOLD_DISCOVERY_QUERY.sql,
  },
  
  // ---------------------------------------------------------------------------
  // GOLD LAYER STARTERS (Curated Views)
  // ---------------------------------------------------------------------------
  {
    id: 'gold-general-assets',
    category: GOLD_QUERY_CATEGORIES.ASSETS,
    name: 'General Asset Slice',
    description: 'Browse Snowflake tables and views with key metadata from GOLD.ASSETS',
    userIntent: 'Show me all tables and views with their metadata',
    frequency: GOLD_FREQUENCY_LEVELS.STARTER,
    frequencyDetail: 'Essential',
    source: 'MDLH Query Library - Gold Layer Starters',
    confidence: 'high',
    goldTables: ['GOLD.ASSETS'],
    sql: `-- General asset slice from Gold Layer
-- Note: Automatically resolves GOLD.ASSETS to the correct schema path
-- If GOLD schema exists, uses it; otherwise uses current schema (typically PUBLIC)
SELECT 
    ASSET_NAME, 
    GUID, 
    ASSET_TYPE, 
    ASSET_QUALIFIED_NAME, 
    DESCRIPTION,
    STATUS, 
    CERTIFICATE_STATUS, 
    OWNER_USERS, 
    TAGS, 
    POPULARITY_SCORE, 
    HAS_LINEAGE
FROM GOLD.ASSETS
WHERE ASSET_TYPE IN ('Table','View') 
  AND CONNECTOR_NAME = 'snowflake'
LIMIT 100;`,
  },
  {
    id: 'gold-readme-enriched',
    category: GOLD_QUERY_CATEGORIES.ASSETS,
    name: 'Readme-Enriched Assets',
    description: 'Assets with documentation from linked README entities',
    userIntent: 'Show assets that have README documentation',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    source: 'MDLH Query Library - Gold Layer Starters',
    confidence: 'high',
    goldTables: ['GOLD.ASSETS', 'GOLD.README'],
    sql: `-- Assets with README documentation
-- Automatically resolves GOLD.* tables to correct schema path
SELECT 
    A.ASSET_NAME, 
    A.ASSET_TYPE, 
    A.ASSET_QUALIFIED_NAME, 
    R.DESCRIPTION AS README_TEXT
FROM GOLD.ASSETS A
LEFT JOIN GOLD.README R ON A.README_GUID = R.GUID
WHERE R.DESCRIPTION IS NOT NULL;`,
  },
  {
    id: 'gold-tag-inventory',
    category: GOLD_QUERY_CATEGORIES.GOVERNANCE,
    name: 'Tag Inventory (PII/Confidential)',
    description: 'Find assets tagged with PII or Confidential classifications',
    userIntent: 'Show me PII and Confidential tagged assets',
    frequency: GOLD_FREQUENCY_LEVELS.STARTER,
    source: 'MDLH Query Library - Gold Layer Starters',
    confidence: 'high',
    goldTables: ['GOLD.TAGS'],
    sql: `-- Tag inventory for sensitive data
SELECT 
    ASSET_NAME, 
    ASSET_TYPE, 
    TAG_NAME, 
    TAG_VALUE, 
    PROPAGATES
FROM GOLD.TAGS
WHERE TAG_NAME ILIKE 'PII' 
   OR TAG_NAME ILIKE 'Confidential';`,
  },
  {
    id: 'gold-custom-metadata',
    category: GOLD_QUERY_CATEGORIES.GOVERNANCE,
    name: 'Custom Metadata Values',
    description: 'View custom metadata attributes like AI Readiness',
    userIntent: 'Show custom metadata for AI Readiness',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    source: 'MDLH Query Library - Gold Layer Starters',
    confidence: 'high',
    goldTables: ['GOLD.CUSTOM_METADATA'],
    sql: `-- Custom metadata values
SELECT 
    ASSET_NAME, 
    ASSET_TYPE, 
    CUSTOM_METADATA_NAME, 
    ATTRIBUTE_NAME, 
    ATTRIBUTE_VALUE
FROM GOLD.CUSTOM_METADATA
WHERE CUSTOM_METADATA_NAME = 'AI Readiness';`,
  },
  {
    id: 'gold-glossary-terms',
    category: GOLD_QUERY_CATEGORIES.GLOSSARY,
    name: 'Glossary Terms + Assignments',
    description: 'View glossary terms with their categories and assigned assets',
    userIntent: 'Show glossary terms and what assets they are assigned to',
    frequency: GOLD_FREQUENCY_LEVELS.STARTER,
    source: 'MDLH Query Library - Gold Layer Starters',
    confidence: 'high',
    goldTables: ['GOLD.GLOSSARY_DETAILS'],
    sql: `-- Glossary terms with assignments
SELECT 
    ASSET_NAME AS TERM, 
    ASSET_TYPE, 
    TERMS, 
    CATEGORIES, 
    ASSIGNED_ASSETS, 
    ANCHOR AS GLOSSARY
FROM GOLD.GLOSSARY_DETAILS
WHERE ASSET_TYPE = 'AtlasGlossaryTerm';`,
  },
  {
    id: 'gold-data-quality',
    category: GOLD_QUERY_CATEGORIES.QUALITY,
    name: 'Data Quality Checks (Anomalo/Soda/MC)',
    description: 'View data quality check definitions from Anomalo, Soda, and Monte Carlo',
    userIntent: 'Show data quality checks from our DQ tools',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    source: 'MDLH Query Library - Gold Layer Starters',
    confidence: 'high',
    goldTables: ['GOLD.DATA_QUALITY_DETAILS'],
    sql: `-- Data quality checks from Anomalo/Soda/Monte Carlo
SELECT 
    ASSET_NAME, 
    ANOMALO_CHECK_TYPE, 
    SODA_CHECK_DEFINITION, 
    MC_MONITOR_TYPE, 
    MC_MONITOR_STATUS
FROM GOLD.DATA_QUALITY_DETAILS
WHERE COALESCE(SODA_CHECK_DEFINITION, ANOMALO_CHECK_TYPE, MC_MONITOR_TYPE) IS NOT NULL;`,
  },
  {
    id: 'gold-pipeline-touchpoints',
    category: GOLD_QUERY_CATEGORIES.LINEAGE,
    name: 'Pipeline Touchpoints (dbt/Airflow/Matillion)',
    description: 'Find pipeline processes that touch assets',
    userIntent: 'Show dbt and Airflow pipeline touchpoints',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    source: 'MDLH Query Library - Gold Layer Starters',
    confidence: 'high',
    goldTables: ['GOLD.PIPELINE_DETAILS'],
    sql: `-- Pipeline touchpoints (dbt/Airflow/Matillion)
SELECT 
    ASSET_NAME, 
    INPUT_GUIDS_TO_PROCESSES, 
    OUTPUT_GUIDS_TO_PROCESSES
FROM GOLD.PIPELINE_DETAILS
WHERE ASSET_NAME ILIKE '%dbt%' 
   OR ASSET_NAME ILIKE '%airflow%';`,
  },
  {
    id: 'gold-relational-profile',
    category: GOLD_QUERY_CATEGORIES.ASSETS,
    name: 'Relational Profile (Tables)',
    description: 'Table statistics including row counts, size, and read activity',
    userIntent: 'Show table sizes and usage statistics',
    frequency: GOLD_FREQUENCY_LEVELS.STARTER,
    source: 'MDLH Query Library - Gold Layer Starters',
    confidence: 'high',
    goldTables: ['GOLD.RELATIONAL_ASSET_DETAILS'],
    sql: `-- Relational profile for tables
SELECT 
    ASSET_NAME, 
    TABLE_ROW_COUNT, 
    TABLE_SIZE_BYTES, 
    TABLE_RECENT_USERS, 
    TABLE_TOTAL_READ_COUNT
FROM GOLD.RELATIONAL_ASSET_DETAILS
WHERE ASSET_TYPE = 'Table' 
  AND CONNECTOR_NAME = 'snowflake'
ORDER BY TABLE_ROW_COUNT DESC
LIMIT 50;`,
  },
  {
    id: 'gold-data-mesh-overview',
    category: GOLD_QUERY_CATEGORIES.GOVERNANCE,
    name: 'Data Mesh Overview',
    description: 'View data products and domains with their ports and stakeholders',
    userIntent: 'Show data products and domains',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    source: 'MDLH Query Library - Gold Layer Starters',
    confidence: 'high',
    goldTables: ['GOLD.DATA_MESH_DETAILS'],
    sql: `-- Data mesh overview
SELECT 
    ASSET_NAME AS DOMAIN_OR_PRODUCT, 
    ASSET_TYPE, 
    DATA_PRODUCT_STATUS, 
    CRITICALITY, 
    SENSITIVITY,
    STAKEHOLDERS, 
    INPUT_PORT_GUIDS, 
    OUTPUT_PORT_GUIDS
FROM GOLD.DATA_MESH_DETAILS;`,
  },

  // ---------------------------------------------------------------------------
  // LINEAGE LIBRARY (GOLD.FULL_LINEAGE + ASSET_LOOKUP)
  // ---------------------------------------------------------------------------
  {
    id: 'gold-base-lineage',
    category: GOLD_QUERY_CATEGORIES.LINEAGE,
    name: 'Base Lineage (Upstream + Downstream)',
    description: 'View upstream and downstream lineage for assets with lineage',
    userIntent: 'Show me lineage for assets',
    frequency: GOLD_FREQUENCY_LEVELS.STARTER,
    source: 'MDLH Query Library - Lineage Library',
    confidence: 'high',
    goldTables: ['GOLD.ASSET_LOOKUP_TABLE', 'GOLD.FULL_LINEAGE'],
    sql: `-- Base lineage (upstream + downstream)
SELECT 
    AL.NAME, 
    AL.TYPE_NAME, 
    FL.RELATED_NAME, 
    FL.RELATED_TYPE, 
    FL.DIRECTION, 
    FL.LEVEL
FROM GOLD.ASSET_LOOKUP_TABLE AL
JOIN GOLD.FULL_LINEAGE FL ON AL.GUID = FL.START_GUID
WHERE AL.HAS_LINEAGE
ORDER BY AL.QUALIFIED_NAME, FL.DIRECTION, FL.LEVEL
LIMIT 200;`,
  },
  {
    id: 'gold-downstream-dashboards',
    category: GOLD_QUERY_CATEGORIES.LINEAGE,
    name: 'Downstream Dashboards for a Table',
    description: 'Find BI dashboards that depend on a specific table',
    userIntent: 'What dashboards use this table?',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    requires: ['qualifiedName'],
    source: 'MDLH Query Library - Lineage Library',
    confidence: 'high',
    goldTables: ['GOLD.ASSET_LOOKUP_TABLE', 'GOLD.FULL_LINEAGE'],
    sql: `-- Downstream dashboards for a table
SELECT 
    FL.LEVEL AS HOPS, 
    FL.RELATED_NAME AS DASHBOARD, 
    FL.RELATED_TYPE, 
    RAL.OWNER_USERS
FROM GOLD.ASSET_LOOKUP_TABLE AL
JOIN GOLD.FULL_LINEAGE FL ON AL.GUID = FL.START_GUID
LEFT JOIN GOLD.ASSET_LOOKUP_TABLE RAL ON FL.RELATED_GUID = RAL.GUID
WHERE AL.QUALIFIED_NAME = '{{QUALIFIED_NAME}}'
  AND FL.DIRECTION = 'DOWNSTREAM'
  AND FL.RELATED_TYPE IN ('TableauDashboard','PowerBIDashboard','LookerDashboard','TableauWorkbook','PowerBIReport')
ORDER BY FL.LEVEL;`,
  },
  {
    id: 'gold-column-impact',
    category: GOLD_QUERY_CATEGORIES.LINEAGE,
    name: 'Column-Level Impact Analysis',
    description: 'Trace downstream column-level impacts',
    userIntent: 'What columns are impacted by changes to this column?',
    frequency: GOLD_FREQUENCY_LEVELS.ADVANCED,
    requires: ['qualifiedName'],
    source: 'MDLH Query Library - Lineage Library',
    confidence: 'high',
    goldTables: ['GOLD.ASSET_LOOKUP_TABLE', 'GOLD.FULL_LINEAGE'],
    sql: `-- Column-level impact analysis
SELECT 
    FL.LEVEL, 
    FL.RELATED_NAME AS IMPACTED_COLUMN, 
    RAL.QUALIFIED_NAME, 
    RAL.OWNER_USERS
FROM GOLD.ASSET_LOOKUP_TABLE AL
JOIN GOLD.FULL_LINEAGE FL ON AL.GUID = FL.START_GUID
LEFT JOIN GOLD.ASSET_LOOKUP_TABLE RAL ON FL.RELATED_GUID = RAL.GUID
WHERE AL.QUALIFIED_NAME = '{{QUALIFIED_NAME}}'
  AND AL.TYPE_NAME = 'Column'
  AND FL.DIRECTION = 'DOWNSTREAM'
  AND FL.RELATED_TYPE = 'Column';`,
  },
  {
    id: 'gold-full-lineage-export',
    category: GOLD_QUERY_CATEGORIES.LINEAGE,
    name: 'Full Lineage Export (Enriched)',
    description: 'Export complete lineage graph with all asset attributes',
    userIntent: 'Export full lineage data for analysis',
    frequency: GOLD_FREQUENCY_LEVELS.EXPORT,
    source: 'MDLH Query Library - Lineage Library',
    confidence: 'high',
    goldTables: ['GOLD.ASSET_LOOKUP_TABLE', 'GOLD.FULL_LINEAGE'],
    sql: `-- Full lineage export (enriched)
SELECT 
    AL.GUID AS START_GUID, 
    AL.NAME AS START_NAME, 
    AL.TYPE_NAME AS START_TYPE,
    AL.QUALIFIED_NAME AS START_PATH, 
    AL.CONNECTOR_NAME AS START_CONNECTOR,
    AL.OWNER_USERS AS START_OWNERS, 
    AL.CERTIFICATE_STATUS AS START_CERTIFICATE_STATUS,
    FL.RELATED_GUID, 
    FL.RELATED_NAME, 
    FL.RELATED_TYPE, 
    FL.DIRECTION, 
    FL.LEVEL,
    RAL.QUALIFIED_NAME AS RELATED_PATH, 
    RAL.CONNECTOR_NAME AS RELATED_CONNECTOR,
    RAL.OWNER_USERS AS RELATED_OWNERS, 
    RAL.CERTIFICATE_STATUS AS RELATED_CERTIFICATE_STATUS
FROM GOLD.ASSET_LOOKUP_TABLE AL
JOIN GOLD.FULL_LINEAGE FL ON AL.GUID = FL.START_GUID
LEFT JOIN GOLD.ASSET_LOOKUP_TABLE RAL ON FL.RELATED_GUID = RAL.GUID;`,
  },
  {
    id: 'gold-tag-propagation',
    category: GOLD_QUERY_CATEGORIES.GOVERNANCE,
    name: 'Tag Propagation Across Lineage',
    description: 'Check if sensitive tags propagate correctly through lineage',
    userIntent: 'Are PII tags propagating to downstream assets?',
    frequency: GOLD_FREQUENCY_LEVELS.ADVANCED,
    source: 'MDLH Query Library - Lineage Library',
    confidence: 'high',
    goldTables: ['GOLD.ASSET_LOOKUP_TABLE', 'GOLD.FULL_LINEAGE'],
    sql: `-- Tag propagation across lineage
WITH tagged_sources AS (
  SELECT GUID, NAME, TYPE_NAME, QUALIFIED_NAME, CONNECTOR_NAME, TAG_NAMES
  FROM GOLD.ASSET_LOOKUP_TABLE
  WHERE STATUS = 'ACTIVE' 
    AND CONNECTOR_NAME = 'snowflake'
    AND TAG_NAMES IS NOT NULL 
    AND ARRAY_SIZE(TAG_NAMES) > 0
    AND (ARRAY_CONTAINS('PII'::VARIANT, TAG_NAMES)
      OR ARRAY_CONTAINS('Confidential'::VARIANT, TAG_NAMES)
      OR ARRAY_CONTAINS('Finance'::VARIANT, TAG_NAMES)
      OR ARRAY_CONTAINS('Cost_center'::VARIANT, TAG_NAMES))
),
downstream_lineage AS (
  SELECT 
    TS.GUID AS SOURCE_GUID, 
    TS.NAME AS SOURCE_NAME, 
    TS.TAG_NAMES AS SOURCE_TAGS,
    FL.RELATED_GUID, 
    FL.RELATED_NAME, 
    FL.RELATED_TYPE, 
    FL.LEVEL,
    RAL.TAG_NAMES AS DOWNSTREAM_TAGS, 
    RAL.QUALIFIED_NAME
  FROM tagged_sources TS
  JOIN GOLD.FULL_LINEAGE FL ON TS.GUID = FL.START_GUID
  LEFT JOIN GOLD.ASSET_LOOKUP_TABLE RAL ON FL.RELATED_GUID = RAL.GUID
  WHERE FL.DIRECTION = 'DOWNSTREAM'
)
SELECT 
    SOURCE_NAME, 
    FL.LEVEL,
    RELATED_NAME, 
    RELATED_TYPE, 
    DOWNSTREAM_TAGS,
    CASE
      WHEN DOWNSTREAM_TAGS IS NULL OR ARRAY_SIZE(DOWNSTREAM_TAGS) = 0 THEN 'NO TAGS'
      WHEN ARRAYS_OVERLAP(SOURCE_TAGS, DOWNSTREAM_TAGS) THEN 'PROPAGATED'
      ELSE 'DIFFERENT TAGS'
    END AS TAG_PROPAGATION_STATUS,
    ARRAY_EXCEPT(SOURCE_TAGS, COALESCE(DOWNSTREAM_TAGS, ARRAY_CONSTRUCT())) AS DROPPED_TAGS
FROM downstream_lineage FL;`,
  },
  {
    id: 'gold-notification-owners',
    category: GOLD_QUERY_CATEGORIES.LINEAGE,
    name: 'Notification List (Owners to Ping)',
    description: 'Get list of owners to notify for downstream impact',
    userIntent: 'Who should I notify about changes to this asset?',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    requires: ['guid'],
    source: 'MDLH Query Library - Lineage Library',
    confidence: 'high',
    goldTables: ['GOLD.ASSET_LOOKUP_TABLE', 'GOLD.FULL_LINEAGE'],
    sql: `-- Notification list (owners to ping)
SELECT 
    AL.NAME AS SOURCE_ASSET, 
    FL.LEVEL AS DEPENDENCY_LEVEL,
    COUNT(DISTINCT FL.RELATED_GUID) AS IMPACTED_ASSET_COUNT,
    ARRAY_AGG(DISTINCT OU.VALUE) AS ALL_OWNERS_TO_NOTIFY
FROM GOLD.ASSET_LOOKUP_TABLE AL
JOIN GOLD.FULL_LINEAGE FL ON AL.GUID = FL.START_GUID
LEFT JOIN GOLD.ASSET_LOOKUP_TABLE RAL ON FL.RELATED_GUID = RAL.GUID
LEFT JOIN LATERAL FLATTEN(INPUT => RAL.OWNER_USERS) OU
WHERE AL.GUID = '{{GUID}}' 
  AND FL.DIRECTION = 'DOWNSTREAM'
GROUP BY AL.NAME, FL.LEVEL
ORDER BY FL.LEVEL;`,
  },

  // ---------------------------------------------------------------------------
  // METADATA COMPLETENESS & EXPORT
  // ---------------------------------------------------------------------------
  {
    id: 'gold-enrichment-coverage',
    category: GOLD_QUERY_CATEGORIES.COMPLETENESS,
    name: 'Enrichment Coverage by Asset Type',
    description: 'Measure metadata completeness across asset types',
    userIntent: 'How complete is our metadata documentation?',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    source: 'MDLH Query Library - Metadata Completeness',
    confidence: 'high',
    goldTables: ['GOLD.ASSET_LOOKUP_TABLE', 'GOLD.CUSTOM_METADATA'],
    sql: `-- Enrichment coverage by asset type
WITH cm_stats AS (
  SELECT 
    alt.guid AS asset_guid,
    COUNT(CASE
      WHEN cm.attribute_value IS NULL THEN 0
      WHEN TRY_PARSE_JSON(cm.attribute_value) IS NOT NULL
           AND ARRAY_SIZE(TRY_PARSE_JSON(cm.attribute_value)) > 0 THEN 1
      WHEN cm.attribute_value IS NOT NULL THEN 1 
    END) AS linked_cm_prop_count
  FROM GOLD.ASSET_LOOKUP_TABLE alt
  LEFT JOIN GOLD.CUSTOM_METADATA cm ON alt.guid = cm.asset_guid
  GROUP BY alt.guid
),
entity_stats AS (
  SELECT 
    type_name AS asset_type,
    COUNT(*) AS total_count,
    COUNT(CASE WHEN description IS NOT NULL AND description <> '' THEN 1 END) AS with_description,
    COUNT(CASE WHEN LOWER(certificate_status) = 'verified' THEN 1 END) AS certified,
    COUNT(CASE WHEN tag_names IS NOT NULL AND ARRAY_SIZE(tag_names) > 0 THEN 1 END) AS with_tags,
    COUNT(CASE WHEN owner_users IS NOT NULL AND ARRAY_SIZE(owner_users) > 0 THEN 1 END) AS with_owners,
    COUNT(CASE WHEN linked_cm_prop_count > 0 THEN 1 END) AS with_linked_cm_props
  FROM GOLD.ASSET_LOOKUP_TABLE alt
  LEFT JOIN cm_stats cm ON alt.guid = cm.asset_guid
  WHERE type_name IN ('Table','Schema','TableauDashboard','TableauWorkbook')
  GROUP BY type_name
)
SELECT * FROM entity_stats ORDER BY asset_type;`,
  },
  {
    id: 'gold-base-metadata-export',
    category: GOLD_QUERY_CATEGORIES.COMPLETENESS,
    name: 'Base Metadata Export (Doc-Friendly)',
    description: 'Export assets with documentation for knowledge bases',
    userIntent: 'Export documented assets for our data catalog',
    frequency: GOLD_FREQUENCY_LEVELS.EXPORT,
    source: 'MDLH Query Library - Metadata Completeness',
    confidence: 'high',
    goldTables: ['GOLD.ASSETS', 'GOLD.README'],
    sql: `-- Base metadata export (doc-friendly assets)
SELECT 
    A.ASSET_NAME, 
    A.GUID, 
    A.ASSET_QUALIFIED_NAME, 
    A.ASSET_TYPE,
    A.DESCRIPTION, 
    A.STATUS, 
    A.CERTIFICATE_STATUS, 
    A.OWNER_USERS, 
    A.TAGS,
    R.DESCRIPTION AS README_TEXT, 
    A.POPULARITY_SCORE, 
    A.HAS_LINEAGE
FROM GOLD.ASSETS A
LEFT JOIN GOLD.README R ON A.README_GUID = R.GUID
WHERE A.ASSET_TYPE IN ('Table','Column','View')
  AND A.CONNECTOR_NAME IN ('snowflake','redshift','bigquery')
  AND R.DESCRIPTION IS NOT NULL;`,
  },

  // ---------------------------------------------------------------------------
  // GLOSSARY ANALYTICS
  // ---------------------------------------------------------------------------
  {
    id: 'gold-term-rollup',
    category: GOLD_QUERY_CATEGORIES.GLOSSARY,
    name: 'Term Rollup with Glossary Details',
    description: 'Comprehensive glossary term view with categories and assignments',
    userIntent: 'Show all terms with their glossaries and linked assets',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    source: 'MDLH Query Library - Glossary Analytics',
    confidence: 'high',
    goldTables: ['GOLD.GLOSSARY_DETAILS', 'GOLD.README'],
    sql: `-- Term rollup with glossary/categories/readme/assignments
WITH glossary_terms AS (
  SELECT 
    GUID AS term_guid, 
    NAME AS term_name, 
    QUALIFIED_NAME AS term_qn,
    DESCRIPTION AS term_description, 
    STATUS AS term_status,
    CERTIFICATE_STATUS AS term_cert, 
    OWNER_USERS AS term_owners,
    TO_TIMESTAMP_LTZ(CREATED_TIME/1000) AS term_created_at,
    TO_TIMESTAMP_LTZ(UPDATED_TIME/1000) AS term_updated_at,
    ANCHOR_GUID AS glossary_guid, 
    CATEGORIES AS term_categories,
    README_GUID AS term_readme_guid, 
    ASSIGNED_ENTITIES AS term_assigned_entities
  FROM GOLD.GLOSSARY_DETAILS
  WHERE ASSET_TYPE = 'AtlasGlossaryTerm' 
    AND STATUS = 'ACTIVE'
),
glossary_info AS (
  SELECT 
    GUID AS glossary_guid, 
    NAME AS glossary_name, 
    DESCRIPTION AS glossary_description
  FROM GOLD.GLOSSARY_DETAILS 
  WHERE ASSET_TYPE = 'AtlasGlossary' 
    AND STATUS = 'ACTIVE'
),
readme_info AS (
  SELECT 
    GUID AS readme_guid, 
    DESCRIPTION AS readme_description 
  FROM GOLD.README 
  WHERE STATUS = 'ACTIVE'
)
SELECT 
    gt.term_name, 
    gi.glossary_name, 
    gt.term_description,
    gt.term_owners, 
    gt.term_cert, 
    gt.term_created_at,
    ri.readme_description AS term_readme,
    gt.term_assigned_entities
FROM glossary_terms gt
LEFT JOIN glossary_info gi ON gt.glossary_guid = gi.glossary_guid
LEFT JOIN readme_info ri ON gt.term_readme_guid = ri.readme_guid;`,
  },

  // ---------------------------------------------------------------------------
  // HISTORY (ENTITY_HISTORY) PATTERNS
  // ---------------------------------------------------------------------------
  {
    id: 'gold-latest-snapshot',
    category: GOLD_QUERY_CATEGORIES.HISTORY,
    name: 'Latest Snapshot for an Asset',
    description: 'Get the most recent historical snapshot of an asset',
    userIntent: 'Show me the latest version of this asset',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    requires: ['qualifiedName'],
    source: 'MDLH Query Library - History Patterns',
    confidence: 'high',
    goldTables: ['ENTITY_HISTORY.TABLE_ENTITY'],
    sql: `-- Latest snapshot for an asset
SELECT *
FROM ENTITY_HISTORY.TABLE_ENTITY
WHERE QUALIFIED_NAME = '{{QUALIFIED_NAME}}'
QUALIFY ROW_NUMBER() OVER (PARTITION BY QUALIFIED_NAME ORDER BY snapshot_timestamp DESC) = 1;`,
  },
  {
    id: 'gold-certification-trend',
    category: GOLD_QUERY_CATEGORIES.HISTORY,
    name: 'Certification Trend (Daily)',
    description: 'Track certification status changes over time',
    userIntent: 'How has certification coverage changed?',
    frequency: GOLD_FREQUENCY_LEVELS.ADVANCED,
    source: 'MDLH Query Library - History Patterns',
    confidence: 'high',
    goldTables: ['ENTITY_HISTORY.TABLE_ENTITY'],
    sql: `-- Certification trend (daily)
SELECT 
    snapshot_date, 
    CERTIFICATE_STATUS, 
    COUNT(*) AS asset_count
FROM ENTITY_HISTORY.TABLE_ENTITY
GROUP BY snapshot_date, CERTIFICATE_STATUS
ORDER BY snapshot_date DESC;`,
  },
  {
    id: 'gold-changes-by-user',
    category: GOLD_QUERY_CATEGORIES.HISTORY,
    name: 'Changes by User in Time Window',
    description: 'Track who made the most metadata changes',
    userIntent: 'Who has been updating metadata this month?',
    frequency: GOLD_FREQUENCY_LEVELS.ADVANCED,
    source: 'MDLH Query Library - History Patterns',
    confidence: 'high',
    goldTables: ['ENTITY_HISTORY.TABLE_ENTITY'],
    sql: `-- Changes by user in a window
SELECT 
    UPDATED_BY, 
    COUNT(*) AS changes
FROM ENTITY_HISTORY.TABLE_ENTITY
WHERE snapshot_date BETWEEN DATEADD(day, -{{DAYS_BACK}}, CURRENT_DATE()) AND CURRENT_DATE()
GROUP BY UPDATED_BY
ORDER BY changes DESC;`,
  },

  // ---------------------------------------------------------------------------
  // MDLH METRICS QUERIES (Based on Metrics Spec)
  // Coverage, Lineage, Quality Scores
  // ---------------------------------------------------------------------------
  {
    id: 'gold-metrics-completeness-by-type',
    category: GOLD_QUERY_CATEGORIES.COMPLETENESS,
    name: '📊 Metadata Completeness by Asset Type',
    description: 'Coverage metrics: % with description, owner, tags, certification by asset type',
    userIntent: 'What is my metadata completeness score?',
    frequency: GOLD_FREQUENCY_LEVELS.STARTER,
    frequencyDetail: 'Essential Metrics',
    source: 'MDLH Metrics Spec',
    confidence: 'high',
    goldTables: ['GOLD.ASSETS'],
    sql: `-- Metadata Completeness by Asset Type
-- Based on MDLH Metrics Spec: Coverage flags per asset
SELECT 
    ASSET_TYPE,
    COUNT(*) AS total_assets,
    
    -- Coverage percentages
    ROUND(AVG(CASE WHEN DESCRIPTION IS NOT NULL AND DESCRIPTION <> '' THEN 1 ELSE 0 END) * 100, 1) AS pct_with_description,
    ROUND(AVG(CASE 
        WHEN (OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0)
          OR (OWNER_GROUPS IS NOT NULL AND ARRAY_SIZE(OWNER_GROUPS) > 0)
        THEN 1 ELSE 0 END) * 100, 1) AS pct_with_owner,
    ROUND(AVG(CASE WHEN TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0 THEN 1 ELSE 0 END) * 100, 1) AS pct_with_tags,
    ROUND(AVG(CASE WHEN LOWER(CERTIFICATE_STATUS) = 'verified' THEN 1 ELSE 0 END) * 100, 1) AS pct_certified,
    
    -- Weighted completeness score (10*desc + 8*tags + 15*owner + 12*cert) / 45
    ROUND(AVG(
        (10 * CASE WHEN DESCRIPTION IS NOT NULL AND DESCRIPTION <> '' THEN 1 ELSE 0 END +
         8 * CASE WHEN TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0 THEN 1 ELSE 0 END +
         15 * CASE 
             WHEN (OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0)
               OR (OWNER_GROUPS IS NOT NULL AND ARRAY_SIZE(OWNER_GROUPS) > 0)
             THEN 1 ELSE 0 END +
         12 * CASE WHEN LOWER(CERTIFICATE_STATUS) = 'verified' THEN 1 ELSE 0 END)
        / 45.0
    ) * 100, 1) AS completeness_score
    
FROM GOLD.ASSETS
WHERE STATUS = 'ACTIVE' AND ASSET_TYPE IN ('Table', 'View', 'Column')
GROUP BY ASSET_TYPE
ORDER BY total_assets DESC;`,
  },
  {
    id: 'gold-metrics-lineage-coverage',
    category: GOLD_QUERY_CATEGORIES.LINEAGE,
    name: '🔀 Lineage Coverage Analysis',
    description: 'Track % of assets with upstream, downstream, full, or orphaned lineage',
    userIntent: 'What percentage of my assets have lineage?',
    frequency: GOLD_FREQUENCY_LEVELS.STARTER,
    frequencyDetail: 'Essential Metrics',
    source: 'MDLH Metrics Spec',
    confidence: 'high',
    goldTables: ['GOLD.ASSET_LOOKUP_TABLE', 'GOLD.FULL_LINEAGE'],
    sql: `-- Lineage Coverage Analysis
-- Based on MDLH Metrics Spec: Lineage flags per asset
WITH lineage_flags AS (
    SELECT
        AL.GUID,
        AL.TYPE_NAME AS asset_type,
        AL.CONNECTOR_NAME,
        CASE WHEN EXISTS (
            SELECT 1 FROM GOLD.FULL_LINEAGE FL 
            WHERE FL.START_GUID = AL.GUID AND FL.DIRECTION = 'UPSTREAM'
        ) THEN 1 ELSE 0 END AS has_upstream,
        CASE WHEN EXISTS (
            SELECT 1 FROM GOLD.FULL_LINEAGE FL 
            WHERE FL.START_GUID = AL.GUID AND FL.DIRECTION = 'DOWNSTREAM'
        ) THEN 1 ELSE 0 END AS has_downstream
    FROM GOLD.ASSET_LOOKUP_TABLE AL
    WHERE AL.STATUS = 'ACTIVE' AND AL.TYPE_NAME IN ('Table', 'View')
)
SELECT
    asset_type,
    connector_name,
    COUNT(*) AS total_assets,
    
    ROUND(AVG(has_upstream) * 100, 1) AS pct_has_upstream,
    ROUND(AVG(has_downstream) * 100, 1) AS pct_has_downstream,
    ROUND(AVG(CASE WHEN has_upstream = 1 OR has_downstream = 1 THEN 1 ELSE 0 END) * 100, 1) AS pct_has_lineage,
    ROUND(AVG(CASE WHEN has_upstream = 1 AND has_downstream = 1 THEN 1 ELSE 0 END) * 100, 1) AS pct_full_lineage,
    ROUND(AVG(CASE WHEN has_upstream = 0 AND has_downstream = 0 THEN 1 ELSE 0 END) * 100, 1) AS pct_orphaned
    
FROM lineage_flags
GROUP BY asset_type, connector_name
ORDER BY total_assets DESC;`,
  },
  {
    id: 'gold-metrics-by-connector',
    category: GOLD_QUERY_CATEGORIES.COMPLETENESS,
    name: '🔌 Overall Metrics by Connector',
    description: 'Full scorecard: completeness, lineage, and quality metrics per connector',
    userIntent: 'How does metadata quality vary by data source?',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    source: 'MDLH Metrics Spec',
    confidence: 'high',
    goldTables: ['GOLD.ASSETS'],
    sql: `-- Overall Metrics by Connector (Slice-level)
-- Based on MDLH Metrics Spec: Slice-level metrics
SELECT
    CONNECTOR_NAME AS slice_key,
    COUNT(*) AS total_assets,
    
    -- Coverage metrics
    ROUND(AVG(CASE WHEN DESCRIPTION IS NOT NULL AND DESCRIPTION <> '' THEN 1 ELSE 0 END) * 100, 1) AS pct_with_description,
    ROUND(AVG(CASE 
        WHEN (OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0)
          OR (OWNER_GROUPS IS NOT NULL AND ARRAY_SIZE(OWNER_GROUPS) > 0)
        THEN 1 ELSE 0 END) * 100, 1) AS pct_with_owner,
    ROUND(AVG(CASE WHEN LOWER(CERTIFICATE_STATUS) = 'verified' THEN 1 ELSE 0 END) * 100, 1) AS pct_certified,
    ROUND(AVG(CASE WHEN HAS_LINEAGE = TRUE THEN 1 ELSE 0 END) * 100, 1) AS pct_with_lineage,
    
    -- Weighted completeness score
    ROUND(AVG(
        (10 * CASE WHEN DESCRIPTION IS NOT NULL AND DESCRIPTION <> '' THEN 1 ELSE 0 END +
         8 * CASE WHEN TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0 THEN 1 ELSE 0 END +
         15 * CASE 
             WHEN (OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0)
               OR (OWNER_GROUPS IS NOT NULL AND ARRAY_SIZE(OWNER_GROUPS) > 0)
             THEN 1 ELSE 0 END +
         12 * CASE WHEN LOWER(CERTIFICATE_STATUS) = 'verified' THEN 1 ELSE 0 END)
        / 45.0
    ) * 100, 1) AS avg_completeness_score,
    
    -- Overall score (weighted: 40% completeness + 20% accuracy + 20% timeliness + 20% consistency)
    -- Stubbing accuracy/timeliness/consistency to 0 for now
    ROUND(0.4 * AVG(
        (10 * CASE WHEN DESCRIPTION IS NOT NULL AND DESCRIPTION <> '' THEN 1 ELSE 0 END +
         8 * CASE WHEN TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0 THEN 1 ELSE 0 END +
         15 * CASE 
             WHEN (OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0)
               OR (OWNER_GROUPS IS NOT NULL AND ARRAY_SIZE(OWNER_GROUPS) > 0)
             THEN 1 ELSE 0 END +
         12 * CASE WHEN LOWER(CERTIFICATE_STATUS) = 'verified' THEN 1 ELSE 0 END)
        / 45.0
    ) * 100, 1) AS overall_score
    
FROM GOLD.ASSETS
WHERE STATUS = 'ACTIVE' AND ASSET_TYPE IN ('Table', 'View', 'DataProduct')
GROUP BY CONNECTOR_NAME
ORDER BY total_assets DESC;`,
  },
  {
    id: 'gold-metrics-orphaned-assets',
    category: GOLD_QUERY_CATEGORIES.GOVERNANCE,
    name: '⚠️ Orphaned Assets Report',
    description: 'High-risk assets: no owner, active, not deprecated - governance gaps',
    userIntent: 'Which assets need attention due to missing ownership?',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    source: 'MDLH Metrics Spec',
    confidence: 'high',
    goldTables: ['GOLD.ASSETS'],
    sql: `-- Orphaned Assets Report
-- Assets with no owner that are active and not deprecated
SELECT 
    ASSET_TYPE,
    CONNECTOR_NAME,
    COUNT(*) AS orphan_count,
    ROUND(AVG(POPULARITY_SCORE), 2) AS avg_popularity,
    MAX(POPULARITY_SCORE) AS max_popularity,
    -- Sample of high-priority orphans
    ARRAY_AGG(ASSET_NAME) WITHIN GROUP (ORDER BY POPULARITY_SCORE DESC NULLS LAST) AS sample_assets
FROM GOLD.ASSETS
WHERE 
    STATUS = 'ACTIVE'
    AND (CERTIFICATE_STATUS IS NULL OR LOWER(CERTIFICATE_STATUS) != 'deprecated')
    AND (OWNER_USERS IS NULL OR ARRAY_SIZE(OWNER_USERS) = 0)
    AND (OWNER_GROUPS IS NULL OR ARRAY_SIZE(OWNER_GROUPS) = 0)
GROUP BY ASSET_TYPE, CONNECTOR_NAME
ORDER BY orphan_count DESC
LIMIT 20;`,
  },
  {
    id: 'gold-metrics-timeliness',
    category: GOLD_QUERY_CATEGORIES.QUALITY,
    name: '⏰ Metadata Timeliness Analysis',
    description: 'Track metadata freshness: updated within 30 days vs stale',
    userIntent: 'How fresh is my metadata?',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    source: 'MDLH Metrics Spec',
    confidence: 'high',
    goldTables: ['GOLD.ASSETS'],
    sql: `-- Metadata Timeliness Analysis
-- Based on MDLH Metrics Spec: timeliness_horizon_days = 30
SELECT 
    ASSET_TYPE,
    COUNT(*) AS total_assets,
    
    -- Timely = updated within 30 days
    SUM(CASE 
        WHEN TO_TIMESTAMP(UPDATED_AT/1000) >= DATEADD(day, -30, CURRENT_TIMESTAMP())
        THEN 1 ELSE 0 
    END) AS timely_count,
    
    ROUND(AVG(CASE 
        WHEN TO_TIMESTAMP(UPDATED_AT/1000) >= DATEADD(day, -30, CURRENT_TIMESTAMP())
        THEN 1 ELSE 0 
    END) * 100, 1) AS pct_timely,
    
    -- Stale buckets
    SUM(CASE 
        WHEN TO_TIMESTAMP(UPDATED_AT/1000) < DATEADD(day, -90, CURRENT_TIMESTAMP())
        THEN 1 ELSE 0 
    END) AS stale_90d_count,
    
    MIN(TO_TIMESTAMP(UPDATED_AT/1000)) AS oldest_update,
    MAX(TO_TIMESTAMP(UPDATED_AT/1000)) AS newest_update
    
FROM GOLD.ASSETS
WHERE STATUS = 'ACTIVE'
GROUP BY ASSET_TYPE
ORDER BY total_assets DESC;`,
  },
  {
    id: 'gold-metrics-tag-coverage',
    category: GOLD_QUERY_CATEGORIES.GOVERNANCE,
    name: '🏷️ Tag Coverage by Sensitivity',
    description: 'Track PII, Confidential, and other sensitive tag coverage',
    userIntent: 'What percentage of my data is classified as sensitive?',
    frequency: GOLD_FREQUENCY_LEVELS.COMMON,
    source: 'MDLH Metrics Spec',
    confidence: 'high',
    goldTables: ['GOLD.TAGS', 'GOLD.ASSETS'],
    sql: `-- Tag Coverage by Sensitivity
-- Track PII and sensitive data classification
WITH tag_summary AS (
    SELECT 
        TAG_NAME,
        COUNT(DISTINCT ASSET_GUID) AS tagged_assets,
        COUNT(CASE WHEN PROPAGATES = TRUE THEN 1 END) AS propagating_count
    FROM GOLD.TAGS
    WHERE TAG_NAME IN ('PII', 'Confidential', 'Sensitive', 'PHI', 'HIPAA', 'GDPR', 'Finance', 'Cost_center')
    GROUP BY TAG_NAME
),
total_assets AS (
    SELECT COUNT(DISTINCT GUID) AS total
    FROM GOLD.ASSETS
    WHERE STATUS = 'ACTIVE' AND ASSET_TYPE IN ('Table', 'View', 'Column')
)
SELECT 
    ts.TAG_NAME,
    ts.tagged_assets,
    ROUND(ts.tagged_assets * 100.0 / ta.total, 2) AS pct_of_total,
    ts.propagating_count,
    ROUND(ts.propagating_count * 100.0 / NULLIF(ts.tagged_assets, 0), 1) AS pct_propagating
FROM tag_summary ts
CROSS JOIN total_assets ta
ORDER BY tagged_assets DESC;`,
  },
  {
    id: 'gold-metrics-ai-readiness-scorecard',
    category: GOLD_QUERY_CATEGORIES.COMPLETENESS,
    name: '🤖 AI Readiness Scorecard',
    description: 'Comprehensive metadata quality score for AI/ML readiness',
    userIntent: 'Is my metadata ready for AI/ML use cases?',
    frequency: GOLD_FREQUENCY_LEVELS.ADVANCED,
    frequencyDetail: 'Strategic Metrics',
    source: 'MDLH Metrics Spec',
    confidence: 'high',
    goldTables: ['GOLD.ASSETS', 'GOLD.ASSET_LOOKUP_TABLE'],
    sql: `-- AI Readiness Scorecard
-- Comprehensive metadata quality assessment for AI/ML readiness
SELECT
    CONNECTOR_NAME,
    COUNT(*) AS total_assets,
    
    -- Documentation (critical for AI context)
    ROUND(AVG(CASE WHEN DESCRIPTION IS NOT NULL AND LENGTH(DESCRIPTION) > 50 THEN 1 ELSE 0 END) * 100, 1) AS pct_well_documented,
    
    -- Ownership (accountability)
    ROUND(AVG(CASE 
        WHEN (OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0)
        THEN 1 ELSE 0 END) * 100, 1) AS pct_with_owner,
    
    -- Certification (trust)
    ROUND(AVG(CASE WHEN LOWER(CERTIFICATE_STATUS) = 'verified' THEN 1 ELSE 0 END) * 100, 1) AS pct_certified,
    
    -- Lineage (understanding data flow)
    ROUND(AVG(CASE WHEN HAS_LINEAGE = TRUE THEN 1 ELSE 0 END) * 100, 1) AS pct_with_lineage,
    
    -- Tags (semantic context)
    ROUND(AVG(CASE WHEN TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0 THEN 1 ELSE 0 END) * 100, 1) AS pct_with_tags,
    
    -- AI Readiness Score (weighted average)
    ROUND((
        0.30 * AVG(CASE WHEN DESCRIPTION IS NOT NULL AND LENGTH(DESCRIPTION) > 50 THEN 1 ELSE 0 END) +
        0.15 * AVG(CASE 
            WHEN (OWNER_USERS IS NOT NULL AND ARRAY_SIZE(OWNER_USERS) > 0)
            THEN 1 ELSE 0 END) +
        0.20 * AVG(CASE WHEN LOWER(CERTIFICATE_STATUS) = 'verified' THEN 1 ELSE 0 END) +
        0.20 * AVG(CASE WHEN HAS_LINEAGE = TRUE THEN 1 ELSE 0 END) +
        0.15 * AVG(CASE WHEN TAGS IS NOT NULL AND ARRAY_SIZE(TAGS) > 0 THEN 1 ELSE 0 END)
    ) * 100, 1) AS ai_readiness_score
    
FROM GOLD.ASSETS
WHERE STATUS = 'ACTIVE' AND ASSET_TYPE IN ('Table', 'View')
GROUP BY CONNECTOR_NAME
HAVING COUNT(*) >= 10
ORDER BY ai_readiness_score DESC;`,
  },
];

// =============================================================================
// COMMON FILTER PATTERNS (Documentation)
// =============================================================================

export const GOLD_COMMON_FILTERS = {
  productionOnly: "CERTIFICATE_STATUS = 'VERIFIED' AND STATUS = 'ACTIVE'",
  piiAssets: "ARRAY_CONTAINS('PII'::VARIANT, TAGS)",
  ownerSlice: "ARRAY_CONTAINS('team@company.com'::VARIANT, OWNER_USERS)",
  pathPattern: "ASSET_QUALIFIED_NAME LIKE 'default/snowflake/%/ANALYTICS/%'",
  hasLineage: "HAS_LINEAGE = TRUE",
  orphaned: "(OWNER_USERS IS NULL OR ARRAY_SIZE(OWNER_USERS) = 0) AND STATUS = 'ACTIVE' AND CERTIFICATE_STATUS != 'DEPRECATED'",
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get Gold Layer queries sorted by frequency
 */
export function getGoldQueriesByFrequency() {
  const order = ['Starter', 'Common', 'Advanced', 'Export'];
  return [...GOLD_LAYER_QUERIES].sort((a, b) => {
    return order.indexOf(a.frequency) - order.indexOf(b.frequency);
  });
}

/**
 * Get Gold Layer queries grouped by category
 */
export function getGoldQueriesByCategory() {
  const grouped = {};
  GOLD_LAYER_QUERIES.forEach(q => {
    if (!grouped[q.category]) {
      grouped[q.category] = [];
    }
    grouped[q.category].push(q);
  });
  return grouped;
}

/**
 * Find a Gold Layer query by ID
 */
export function findGoldQueryById(id) {
  return GOLD_LAYER_QUERIES.find(q => q.id === id);
}

/**
 * Search Gold Layer queries
 */
export function searchGoldQueries(searchTerm) {
  const term = searchTerm.toLowerCase();
  return GOLD_LAYER_QUERIES.filter(q => 
    q.userIntent?.toLowerCase().includes(term) ||
    q.name?.toLowerCase().includes(term) ||
    q.description?.toLowerCase().includes(term) ||
    q.sql?.toLowerCase().includes(term)
  );
}

/**
 * Get queries that reference a specific Gold table
 */
export function getQueriesByGoldTable(tableName) {
  return GOLD_LAYER_QUERIES.filter(q => 
    q.goldTables?.some(t => t.toUpperCase() === tableName.toUpperCase())
  );
}

// =============================================================================
// METADATA
// =============================================================================

export const GOLD_QUERIES_METADATA = {
  title: 'MDLH Gold Layer Query Library',
  description: 'Reference-ready queries for the curated Gold Layer views in the Metadata Lakehouse. Uses Snowflake syntax against an Iceberg REST catalog.',
  totalQueries: GOLD_LAYER_QUERIES.length,
  schemas: ['GOLD', 'ENTITY_HISTORY'],
  database: 'context_store',
  source: 'MDLH Query Library Documentation',
  lastUpdated: new Date().toISOString().split('T')[0],
  operationalNotes: [
    'Compute must be on the same cloud as your tenant; Iceberg REST compatible.',
    'Typical freshness: ≤ ~15 minutes.',
    'Primitive attributes are covered; complex (enums/structs/nested) limited today.',
  ],
};

export default {
  GOLD_LAYER_QUERIES,
  GOLD_QUERY_CATEGORIES,
  GOLD_FREQUENCY_LEVELS,
  GOLD_FREQUENCY_STYLES,
  GOLD_LAYER_TABLES,
  GOLD_COMMON_FILTERS,
  GOLD_QUERIES_METADATA,
  getGoldQueriesByFrequency,
  getGoldQueriesByCategory,
  findGoldQueryById,
  searchGoldQueries,
  getQueriesByGoldTable,
};
