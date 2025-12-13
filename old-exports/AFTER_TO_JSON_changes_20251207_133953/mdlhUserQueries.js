/**
 * MDLH User Research Queries
 * 
 * Consolidated metadata lakehouse queries from Slack user research, 
 * Confluence docs, and internal implementations.
 * 
 * Sources:
 * - Himanshu - Conversational Search Analysis (~600 user questions)
 * - Priyanjna - Medtronic Implementation
 * - Ben Hudson - Thursday Demos
 * - Shubham - Fox Workshop Notes
 * - Peter Ebert - Python NetworkX Approach
 * - Internal MDLH Documentation
 */

// =============================================================================
// QUERY FREQUENCY LEVELS
// =============================================================================

export const FREQUENCY_LEVELS = {
  VERY_HIGH: 'Very High',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

// Frequency badge styling
export const FREQUENCY_STYLES = {
  'Very High': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  'High': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  'Medium': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  'Low': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
};

// =============================================================================
// CATEGORY DEFINITIONS
// =============================================================================

export const USER_QUERY_CATEGORIES = [
  { name: 'Asset Discovery', percentage: '~25%', color: '#3b82f6' },
  { name: 'Count & Statistics', percentage: '~20%', color: '#a855f7' },
  { name: 'Usage & Popularity', percentage: '~15%', color: '#22c55e' },
  { name: 'Data Lineage', percentage: '~12%', color: '#f97316' },
  { name: 'Glossary & Terms', percentage: '~10%', color: '#ec4899' },
  { name: 'Governance & Ownership', percentage: '~8%', color: '#ef4444' },
  { name: 'Data Quality', percentage: '~3%', color: '#eab308' },
  { name: 'Domain-Specific', percentage: '~5%', color: '#14b8a6' },
  { name: 'Column Metadata', percentage: 'Export', color: '#6366f1' },
  { name: 'Duplicate Detection', percentage: 'Governance', color: '#f43f5e' },
  { name: 'Storage Analysis', percentage: 'Optimization', color: '#06b6d4' },
  { name: 'Query Organization', percentage: 'Fox Use Case', color: '#f59e0b' },
];

// =============================================================================
// USER RESEARCH QUERIES
// =============================================================================

export const USER_RESEARCH_QUERIES = [
  // ---------------------------------------------------------------------------
  // Asset Discovery (~25% of user questions)
  // ---------------------------------------------------------------------------
  {
    id: 'discovery-1',
    category: 'Asset Discovery',
    name: 'Show All Verified Tables',
    description: 'Find tables with verified certificate status - most common user query',
    userIntent: 'Show me all verified tables',
    frequency: 'Very High',
    frequencyDetail: '~25%',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    NAME,
    QUALIFIEDNAME,
    SCHEMANAME,
    DATABASENAME,
    CONNECTIONNAME,
    USERDESCRIPTION,
    OWNERUSERS,
    CERTIFICATESTATUS,
    UPDATETIME
FROM TABLE_ENTITY
WHERE CERTIFICATESTATUS = 'VERIFIED'
  AND STATUS = 'ACTIVE'
ORDER BY UPDATETIME DESC;`,
  },
  {
    id: 'discovery-2',
    category: 'Asset Discovery',
    name: 'Find Assets by Data Source',
    description: 'Search for assets from a specific connector or integration',
    userIntent: 'What assets for Zoominfo do we have?',
    frequency: 'High',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    NAME,
    TYPENAME,
    QUALIFIEDNAME,
    CONNECTORNAME,
    CONNECTIONNAME,
    CERTIFICATESTATUS
FROM TABLE_ENTITY
WHERE LOWER(CONNECTIONNAME) LIKE '%{{source}}%'
   OR LOWER(DATABASENAME) LIKE '%{{source}}%'
   OR LOWER(NAME) LIKE '%{{source}}%'
ORDER BY TYPENAME, NAME;`,
  },
  {
    id: 'discovery-3',
    category: 'Asset Discovery',
    name: 'Find Assets by Database',
    description: 'Get all Snowflake assets for a specific database',
    userIntent: 'Give Snowflake assets for database GPDP_PROD_DB',
    frequency: 'High',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    t.NAME AS table_name,
    t.SCHEMANAME,
    t.TYPENAME,
    COUNT(c.GUID) AS column_count,
    t.ROWCOUNT,
    t.CERTIFICATESTATUS
FROM TABLE_ENTITY t
LEFT JOIN COLUMN_ENTITY c ON c.TABLEQUALIFIEDNAME = t.QUALIFIEDNAME
WHERE t.DATABASENAME = '{{database}}'
  AND t.CONNECTORNAME = 'snowflake'
  AND t.STATUS = 'ACTIVE'
GROUP BY t.NAME, t.SCHEMANAME, t.TYPENAME, t.ROWCOUNT, t.CERTIFICATESTATUS
ORDER BY t.SCHEMANAME, t.NAME;`,
  },

  // ---------------------------------------------------------------------------
  // Count & Statistics (~20% of user questions)
  // ---------------------------------------------------------------------------
  {
    id: 'stats-1',
    category: 'Count & Statistics',
    name: 'Total Table Count',
    description: 'Simple count of all tables in the environment',
    userIntent: 'How many tables are there?',
    frequency: 'Very High',
    frequencyDetail: '~20%',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    COUNT(*) AS total_tables
FROM TABLE_ENTITY
WHERE STATUS = 'ACTIVE';`,
  },
  {
    id: 'stats-2',
    category: 'Count & Statistics',
    name: 'Asset Counts by Connector',
    description: 'Count of Snowflake assets grouped by database',
    userIntent: 'Give count of Snowflake assets for GPDP',
    frequency: 'High',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    CONNECTORNAME,
    DATABASENAME,
    COUNT(*) AS asset_count
FROM TABLE_ENTITY
WHERE CONNECTORNAME = 'snowflake'
  AND DATABASENAME LIKE '%{{filter}}%'
  AND STATUS = 'ACTIVE'
GROUP BY CONNECTORNAME, DATABASENAME
ORDER BY asset_count DESC;`,
  },
  {
    id: 'stats-3',
    category: 'Count & Statistics',
    name: 'Database Count in Environment',
    description: 'Count distinct databases across all connectors',
    userIntent: 'Database count in this environment',
    frequency: 'High',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    CONNECTORNAME,
    COUNT(DISTINCT DATABASENAME) AS database_count,
    COUNT(DISTINCT SCHEMANAME) AS schema_count,
    COUNT(*) AS total_tables
FROM TABLE_ENTITY
WHERE STATUS = 'ACTIVE'
GROUP BY CONNECTORNAME
ORDER BY total_tables DESC;`,
  },
  {
    id: 'stats-4',
    category: 'Count & Statistics',
    name: 'All MDLH Entity Types with Row Counts',
    description: 'List all available entity types and their volume',
    userIntent: 'What data is available in MDLH?',
    frequency: 'Medium',
    source: 'Internal - MDLH Documentation',
    confidence: 'high',
    sql: `SELECT 
    TABLE_NAME AS entity_type,
    ROW_COUNT,
    ROUND(BYTES / 1024 / 1024, 2) AS size_mb
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'PUBLIC'
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY ROW_COUNT DESC;`,
  },

  // ---------------------------------------------------------------------------
  // Usage & Popularity (~15% of user questions)
  // ---------------------------------------------------------------------------
  {
    id: 'usage-1',
    category: 'Usage & Popularity',
    name: 'Most Queried Tables Last Month',
    description: 'Tables ranked by query count over the past month',
    userIntent: 'What are the most queried tables last month?',
    frequency: 'High',
    frequencyDetail: '~15%',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    NAME,
    SCHEMANAME,
    DATABASENAME,
    QUERYCOUNT,
    QUERYUSERCOUNT,
    QUERYCOUNTUPDATEDAT,
    POPULARITYSCORE
FROM TABLE_ENTITY
WHERE QUERYCOUNT > 0
  AND QUERYCOUNTUPDATEDAT >= DATEADD(month, -1, CURRENT_DATE())
  AND STATUS = 'ACTIVE'
ORDER BY QUERYCOUNT DESC
LIMIT 50;`,
  },
  {
    id: 'usage-2',
    category: 'Usage & Popularity',
    name: 'Unused Assets (Low Query Count)',
    description: 'Find assets that are not frequently used',
    userIntent: 'Which assets are not frequently used?',
    frequency: 'Medium',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    NAME,
    QUALIFIEDNAME,
    CONNECTORNAME,
    DATABASENAME,
    SCHEMANAME,
    QUERYCOUNT,
    SOURCELASTREADAT,
    CREATETIME
FROM TABLE_ENTITY
WHERE (QUERYCOUNT IS NULL OR QUERYCOUNT = 0)
  AND STATUS = 'ACTIVE'
  AND CREATETIME < DATEADD(month, -3, CURRENT_DATE())
ORDER BY CREATETIME ASC
LIMIT 100;`,
  },
  {
    id: 'usage-3',
    category: 'Usage & Popularity',
    name: 'Most Queried Assets This Week',
    description: 'Recent high-activity assets',
    userIntent: 'What are the most queried assets this week?',
    frequency: 'Medium',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    NAME,
    TYPENAME,
    QUERYCOUNT,
    QUERYUSERCOUNT,
    POPULARITYSCORE,
    SOURCEREADCOUNT,
    SOURCELASTREADAT
FROM TABLE_ENTITY
WHERE SOURCELASTREADAT >= DATEADD(week, -1, CURRENT_DATE())
  AND STATUS = 'ACTIVE'
ORDER BY QUERYCOUNT DESC
LIMIT 25;`,
  },

  // ---------------------------------------------------------------------------
  // Data Lineage (~12% of user questions)
  // ---------------------------------------------------------------------------
  {
    id: 'lineage-1',
    category: 'Data Lineage',
    name: 'Direct Upstream Assets (1 Hop)',
    description: 'Find immediate upstream dependencies for a given asset',
    userIntent: 'Show lineage for [specific table]',
    frequency: 'High',
    frequencyDetail: '~12%',
    source: 'Internal - MDLH Documentation',
    confidence: 'high',
    sql: `-- Replace {{GUID}} with target asset GUID
SELECT 
    P.GUID AS process_guid,
    P.NAME AS process_name,
    P.SQL AS transformation_sql,
    TO_JSON(P.INPUTS) AS upstream_assets,
    TO_JSON(P.OUTPUTS) AS downstream_assets
FROM PROCESS_ENTITY P
WHERE TO_JSON(P.OUTPUTS) ILIKE '%{{GUID}}%'
LIMIT 50;`,
  },
  {
    id: 'lineage-2',
    category: 'Data Lineage',
    name: 'Direct Downstream Assets (1 Hop)',
    description: 'Find immediate downstream impacts for a given asset',
    userIntent: 'Can you show downstream tables connected to billing_materialized_view?',
    frequency: 'High',
    source: 'Internal - MDLH Documentation',
    confidence: 'high',
    sql: `-- Replace {{GUID}} with target asset GUID
SELECT 
    P.GUID AS process_guid,
    P.NAME AS process_name,
    TO_JSON(P.INPUTS) AS upstream_assets,
    TO_JSON(P.OUTPUTS) AS downstream_assets
FROM PROCESS_ENTITY P
WHERE TO_JSON(P.INPUTS) ILIKE '%{{GUID}}%'
LIMIT 50;`,
  },
  {
    id: 'lineage-3',
    category: 'Data Lineage',
    name: 'Multi-Hop Downstream Lineage (Recursive CTE)',
    description: 'Traverse multiple levels of downstream lineage - WARNING: Can be expensive',
    userIntent: 'Show all downstream assets for bronze_gco_clear_dtl_general',
    frequency: 'Medium',
    warning: 'Recursive lineage queries can be expensive. Engineering is working on a more scalable approach. Consider Python + NetworkX for complex traversals.',
    source: 'Ben Hudson - Thursday Demo + Peter Ebert Warning',
    confidence: 'medium',
    sql: `-- WARNING: Recursive CTEs can cause high compute costs
-- Consider using Python + NetworkX for complex lineage (see Peter Ebert's approach)
WITH RECURSIVE lineage_cte AS (
    -- Base case: direct downstream
    SELECT 
        P.GUID AS process_guid,
        P.NAME AS process_name,
        UNNEST(P.OUTPUTS) AS asset_guid,
        1 AS hop_level
    FROM PROCESS_ENTITY P
    WHERE TO_JSON(P.INPUTS) ILIKE '%{{START_GUID}}%'
    
    UNION ALL
    
    -- Recursive case: next hop
    SELECT 
        P.GUID,
        P.NAME,
        UNNEST(P.OUTPUTS),
        L.hop_level + 1
    FROM PROCESS_ENTITY P
    JOIN lineage_cte L ON TO_JSON(P.INPUTS) ILIKE '%' || L.asset_guid || '%'
    WHERE L.hop_level < 5  -- LIMIT RECURSION DEPTH!
)
SELECT DISTINCT asset_guid, hop_level
FROM lineage_cte
ORDER BY hop_level;`,
  },
  {
    id: 'lineage-4',
    category: 'Data Lineage',
    name: 'Assets with Lineage Flag',
    description: 'Find assets that have lineage information available',
    userIntent: 'Which tables have lineage?',
    frequency: 'Medium',
    source: 'Internal - MDLH Documentation',
    confidence: 'high',
    sql: `SELECT 
    NAME,
    QUALIFIEDNAME,
    HASLINEAGE,
    TYPENAME,
    CONNECTORNAME
FROM TABLE_ENTITY
WHERE HASLINEAGE = TRUE
  AND STATUS = 'ACTIVE'
ORDER BY CONNECTORNAME, NAME;`,
  },

  // ---------------------------------------------------------------------------
  // Glossary & Terms (~10% of user questions)
  // ---------------------------------------------------------------------------
  {
    id: 'glossary-1',
    category: 'Glossary & Terms',
    name: 'Get Term Definition',
    description: 'Look up the definition of a business term',
    userIntent: 'What is Customer ID?',
    frequency: 'High',
    frequencyDetail: '~10%',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    gt.NAME AS term_name,
    gt.USERDESCRIPTION AS definition,
    gt.CERTIFICATESTATUS,
    g.NAME AS glossary_name
FROM ATLASGLOSSARYTERM_ENTITY gt
LEFT JOIN ATLASGLOSSARY_ENTITY g ON gt.ANCHOR = g.GUID
WHERE LOWER(gt.NAME) LIKE '%{{term}}%'
   OR LOWER(gt.DISPLAYNAME) LIKE '%{{term}}%';`,
  },
  {
    id: 'glossary-2',
    category: 'Glossary & Terms',
    name: 'Explain Business Term',
    description: 'Get comprehensive term details with examples',
    userIntent: 'Explain term Buy Channel',
    frequency: 'Medium',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    gt.NAME,
    gt.DISPLAYNAME,
    gt.USERDESCRIPTION AS definition,
    gt.EXAMPLES,
    gt.USAGE,
    gt.ABBREVIATION,
    gt.CERTIFICATESTATUS,
    gt.OWNERUSERS,
    g.NAME AS glossary_name,
    gc.NAME AS category_name
FROM ATLASGLOSSARYTERM_ENTITY gt
LEFT JOIN ATLASGLOSSARY_ENTITY g ON TO_JSON(gt.ANCHOR) ILIKE '%' || g.GUID || '%'
LEFT JOIN ATLASGLOSSARYCATEGORY_ENTITY gc ON TO_JSON(gt.CATEGORIES) ILIKE '%' || gc.GUID || '%'
WHERE LOWER(gt.NAME) = '{{term}}';`,
  },
  {
    id: 'glossary-3',
    category: 'Glossary & Terms',
    name: 'Verified Terms with Definitions',
    description: 'Export all verified glossary terms for documentation',
    userIntent: 'Export all verified terms',
    frequency: 'Medium',
    source: 'Internal - Fox Use Case',
    confidence: 'high',
    sql: `SELECT 
    gt.NAME AS term_name,
    gt.USERDESCRIPTION AS definition,
    gt.ABBREVIATION,
    gt.EXAMPLES,
    gt.CERTIFICATESTATUS,
    g.NAME AS glossary_name,
    gt.OWNERUSERS
FROM ATLASGLOSSARYTERM_ENTITY gt
JOIN ATLASGLOSSARY_ENTITY g ON gt.ANCHOR = g.GUID
WHERE gt.CERTIFICATESTATUS = 'VERIFIED'
ORDER BY g.NAME, gt.NAME;`,
  },

  // ---------------------------------------------------------------------------
  // Governance & Ownership (~8% of user questions)
  // ---------------------------------------------------------------------------
  {
    id: 'governance-1',
    category: 'Governance & Ownership',
    name: 'Find Data Owners',
    description: 'Find who owns assets in a specific domain',
    userIntent: 'Who owns finance data?',
    frequency: 'High',
    frequencyDetail: '~8%',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    NAME,
    QUALIFIEDNAME,
    OWNERUSERS,
    OWNERGROUPS,
    ADMINUSERS,
    DATABASENAME,
    SCHEMANAME,
    CERTIFICATESTATUS
FROM TABLE_ENTITY
WHERE LOWER(DATABASENAME) LIKE '%{{domain}}%'
   OR LOWER(SCHEMANAME) LIKE '%{{domain}}%'
   OR LOWER(NAME) LIKE '%{{domain}}%'
ORDER BY OWNERUSERS, NAME;`,
  },
  {
    id: 'governance-2',
    category: 'Governance & Ownership',
    name: 'Current Owner/Steward of Database',
    description: 'Find who is responsible for maintaining a database',
    userIntent: 'Who is the current owner or steward of the WIP_Sustainability database?',
    frequency: 'Medium',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    NAME,
    QUALIFIEDNAME,
    OWNERUSERS,
    OWNERGROUPS,
    ADMINUSERS,
    ADMINGROUPS,
    DESCRIPTION,
    USERDESCRIPTION
FROM DATABASE_ENTITY
WHERE NAME = '{{database}}';`,
  },
  {
    id: 'governance-3',
    category: 'Governance & Ownership',
    name: 'PII Tagged Assets',
    description: 'Find all assets tagged with PII classifications',
    userIntent: 'Which assets contain PII data?',
    frequency: 'Medium',
    source: 'Internal - Governance Use Cases',
    confidence: 'high',
    sql: `SELECT 
    t.NAME,
    t.QUALIFIEDNAME,
    t.SCHEMANAME,
    tr.TAGNAME,
    tr.TAGVALUE
FROM TABLE_ENTITY t
JOIN TAG_RELATIONSHIP tr ON t.GUID = tr.ENTITYGUID
WHERE tr.TAGNAME LIKE '%PII%'
   OR tr.TAGNAME LIKE '%Sensitive%'
   OR tr.TAGNAME LIKE '%Confidential%'
ORDER BY tr.TAGNAME, t.NAME;`,
  },

  // ---------------------------------------------------------------------------
  // Data Quality (~3% of user questions)
  // ---------------------------------------------------------------------------
  {
    id: 'quality-1',
    category: 'Data Quality',
    name: 'Assets Missing Descriptions',
    description: 'Find critical assets that lack documentation',
    userIntent: 'Which assets have missing descriptions?',
    frequency: 'Medium',
    frequencyDetail: '~3%',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    NAME,
    QUALIFIEDNAME,
    TYPENAME,
    CONNECTORNAME,
    OWNERUSERS,
    CERTIFICATESTATUS,
    CREATETIME
FROM TABLE_ENTITY
WHERE (USERDESCRIPTION IS NULL OR USERDESCRIPTION = '')
  AND (DESCRIPTION IS NULL OR DESCRIPTION = '')
  AND STATUS = 'ACTIVE'
ORDER BY CREATETIME DESC
LIMIT 100;`,
  },
  {
    id: 'quality-2',
    category: 'Data Quality',
    name: 'Critical Assets Missing Descriptions',
    description: 'Find verified/critical assets without documentation',
    userIntent: 'List critical assets with missing descriptions',
    frequency: 'Medium',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    NAME,
    QUALIFIEDNAME,
    CERTIFICATESTATUS,
    OWNERUSERS,
    CONNECTORNAME
FROM TABLE_ENTITY
WHERE CERTIFICATESTATUS IN ('VERIFIED', 'DRAFT')
  AND (USERDESCRIPTION IS NULL OR USERDESCRIPTION = '')
  AND STATUS = 'ACTIVE'
ORDER BY CERTIFICATESTATUS, NAME;`,
  },
  {
    id: 'quality-3',
    category: 'Data Quality',
    name: 'Governance Completeness Check',
    description: 'Find tables missing key governance metadata',
    userIntent: 'What tables lack proper governance?',
    frequency: 'Medium',
    source: 'Internal - Tag Compliance Checks',
    confidence: 'high',
    sql: `SELECT 
    NAME,
    QUALIFIEDNAME,
    CASE WHEN USERDESCRIPTION IS NULL OR USERDESCRIPTION = '' THEN 'Missing' ELSE 'Has' END AS description_status,
    CASE WHEN OWNERUSERS IS NULL THEN 'Missing' ELSE 'Has' END AS owner_status,
    CASE WHEN CERTIFICATESTATUS IS NULL THEN 'Missing' ELSE CERTIFICATESTATUS END AS certificate_status
FROM TABLE_ENTITY
WHERE STATUS = 'ACTIVE'
  AND (
    USERDESCRIPTION IS NULL 
    OR USERDESCRIPTION = ''
    OR OWNERUSERS IS NULL
    OR CERTIFICATESTATUS IS NULL
  )
ORDER BY NAME;`,
  },

  // ---------------------------------------------------------------------------
  // Domain-Specific (~5% of user questions)
  // ---------------------------------------------------------------------------
  {
    id: 'domain-1',
    category: 'Domain-Specific',
    name: 'Data Products by Domain',
    description: 'Find data products in a specific business domain',
    userIntent: 'What merchant data products are there?',
    frequency: 'Medium',
    source: 'Himanshu - Conversational Search Analysis',
    confidence: 'high',
    sql: `SELECT 
    dp.NAME AS product_name,
    dp.USERDESCRIPTION,
    dp.STATUS,
    dp.CERTIFICATESTATUS,
    dd.NAME AS domain_name
FROM DATAPRODUCT_ENTITY dp
LEFT JOIN DATADOMAIN_ENTITY dd ON dp.DOMAINGUIDS LIKE '%' || dd.GUID || '%'
WHERE LOWER(dp.NAME) LIKE '%{{domain}}%'
   OR LOWER(dd.NAME) LIKE '%{{domain}}%'
ORDER BY dp.NAME;`,
  },

  // ---------------------------------------------------------------------------
  // Column Metadata (Export use cases)
  // ---------------------------------------------------------------------------
  {
    id: 'column-1',
    category: 'Column Metadata',
    name: 'Full Column Metadata with Custom Metadata & Tags',
    description: 'Comprehensive column-level extraction including all enrichment - THE BIG ONE',
    userIntent: 'Give me all column metadata for Snowflake/Glue',
    frequency: 'High',
    frequencyDetail: 'Customer Exports',
    source: 'Priyanjna - Medtronic Implementation',
    confidence: 'high',
    sql: `WITH FILTERED_COLUMNS AS (
    SELECT GUID
    FROM COLUMN_ENTITY
    WHERE CONNECTORNAME IN ('glue', 'snowflake')
),
CM_AGG AS (
    SELECT
        CM.ENTITYGUID,
        ARRAY_AGG(DISTINCT OBJECT_CONSTRUCT(
            'set_name', SETDISPLAYNAME,
            'field_name', ATTRIBUTEDISPLAYNAME,
            'field_value', ATTRIBUTEVALUE
        )) AS CUSTOM_METADATA_JSON
    FROM CUSTOMMETADATA_RELATIONSHIP CM
    JOIN FILTERED_COLUMNS FC ON CM.ENTITYGUID = FC.GUID
    GROUP BY CM.ENTITYGUID
),
TR_AGG AS (
    SELECT
        TR.ENTITYGUID,
        '[' || LISTAGG(
            OBJECT_CONSTRUCT('name', TR.TAGNAME, 'value', TR.TAGVALUE)::STRING, ','
        ) WITHIN GROUP (ORDER BY TR.TAGNAME) || ']' AS TAG_JSON
    FROM TAG_RELATIONSHIP TR
    JOIN FILTERED_COLUMNS FC ON TR.ENTITYGUID = FC.GUID
    GROUP BY TR.ENTITYGUID
)
SELECT
    COL.NAME AS col_name,
    COL.QUALIFIEDNAME,
    COL.GUID,
    COL.DISPLAYNAME,
    COL.DESCRIPTION,
    COL.USERDESCRIPTION,
    COL.CONNECTORNAME,
    COL.CONNECTIONNAME,
    COL.DATABASENAME,
    COL.SCHEMANAME,
    COL.TABLENAME,
    COL.DATATYPE,
    COL."ORDER" AS ordinal_position,
    TR_AGG.TAG_JSON,
    CM_AGG.CUSTOM_METADATA_JSON,
    COL.CERTIFICATESTATUS,
    COL.OWNERUSERS,
    COL.OWNERGROUPS,
    COL.ISPROFILED,
    COL.COLUMNDISTINCTVALUESCOUNT,
    COL.COLUMNMAX,
    COL.COLUMNMIN,
    COL.COLUMNMEAN
FROM COLUMN_ENTITY COL
LEFT JOIN CM_AGG ON COL.GUID = CM_AGG.ENTITYGUID
LEFT JOIN TR_AGG ON COL.GUID = TR_AGG.ENTITYGUID
WHERE COL.CONNECTORNAME IN ('glue', 'snowflake')
LIMIT 100;`,
  },

  // ---------------------------------------------------------------------------
  // Duplicate Detection (Governance)
  // ---------------------------------------------------------------------------
  {
    id: 'duplicate-1',
    category: 'Duplicate Detection',
    name: 'Duplicate Glossary Terms',
    description: 'Find glossary terms with similar names across glossaries',
    userIntent: 'Are there duplicate term definitions?',
    frequency: 'Medium',
    source: 'Internal - Duplicate Detection',
    confidence: 'high',
    sql: `SELECT 
    gt1.NAME AS term_name,
    gt1.GUID AS term1_guid,
    g1.NAME AS glossary1,
    gt2.GUID AS term2_guid,
    g2.NAME AS glossary2
FROM ATLASGLOSSARYTERM_ENTITY gt1
JOIN ATLASGLOSSARYTERM_ENTITY gt2 ON LOWER(gt1.NAME) = LOWER(gt2.NAME) AND gt1.GUID < gt2.GUID
LEFT JOIN ATLASGLOSSARY_ENTITY g1 ON gt1.ANCHOR = g1.GUID
LEFT JOIN ATLASGLOSSARY_ENTITY g2 ON gt2.ANCHOR = g2.GUID
ORDER BY gt1.NAME;`,
  },
  {
    id: 'duplicate-2',
    category: 'Duplicate Detection',
    name: 'Duplicate BI Metrics',
    description: 'Find metrics with similar names that may be duplicates',
    userIntent: 'Are there duplicate metrics defined?',
    frequency: 'Low',
    source: 'Internal - Duplicate Detection',
    confidence: 'medium',
    sql: `SELECT 
    m1.NAME AS metric_name,
    m1.QUALIFIEDNAME AS metric1_qn,
    m2.QUALIFIEDNAME AS metric2_qn,
    m1.CONNECTORNAME
FROM METRIC_ENTITY m1
JOIN METRIC_ENTITY m2 ON LOWER(m1.NAME) = LOWER(m2.NAME) AND m1.GUID < m2.GUID
ORDER BY m1.NAME;`,
  },

  // ---------------------------------------------------------------------------
  // Storage Analysis (Optimization)
  // ---------------------------------------------------------------------------
  {
    id: 'storage-1',
    category: 'Storage Analysis',
    name: 'Large Unused Tables',
    description: 'Find tables with high row counts but no recent usage',
    userIntent: 'What large tables are not being used?',
    frequency: 'Medium',
    source: 'Internal - Storage Optimization',
    confidence: 'high',
    sql: `SELECT 
    NAME,
    QUALIFIEDNAME,
    ROWCOUNT,
    SIZEBYTES,
    ROUND(SIZEBYTES / 1024 / 1024 / 1024, 2) AS size_gb,
    QUERYCOUNT,
    SOURCELASTREADAT,
    OWNERUSERS
FROM TABLE_ENTITY
WHERE ROWCOUNT > 1000000
  AND (QUERYCOUNT IS NULL OR QUERYCOUNT < 10)
  AND STATUS = 'ACTIVE'
ORDER BY ROWCOUNT DESC
LIMIT 50;`,
  },

  // ---------------------------------------------------------------------------
  // Query Organization (Fox Use Case)
  // ---------------------------------------------------------------------------
  {
    id: 'query-org-1',
    category: 'Query Organization',
    name: 'Export Verified Queries for AI Context',
    description: 'Get all verified queries for powering conversational AI',
    userIntent: 'Export verified queries for our AI chatbot',
    frequency: 'Medium',
    frequencyDetail: 'Fox Use Case',
    source: 'Shubham - Fox Workshop Notes',
    confidence: 'high',
    sql: `SELECT 
    q.NAME AS query_name,
    q.RAWQUERY AS sql_text,
    q.USERDESCRIPTION AS description,
    q.CERTIFICATESTATUS,
    c.NAME AS collection_name,
    f.NAME AS folder_name
FROM QUERY_ENTITY q
JOIN COLLECTION_ENTITY c ON q.COLLECTIONQUALIFIEDNAME = c.QUALIFIEDNAME
LEFT JOIN FOLDER_ENTITY f ON q.PARENTQUALIFIEDNAME = f.QUALIFIEDNAME
WHERE q.CERTIFICATESTATUS = 'VERIFIED'
ORDER BY c.NAME, f.NAME, q.NAME;`,
  },
  {
    id: 'query-org-2',
    category: 'Query Organization',
    name: 'Collection Query Counts',
    description: 'Get all collections with their query counts',
    userIntent: 'How many queries do we have per collection?',
    frequency: 'Low',
    source: 'Internal - Query Management',
    confidence: 'high',
    sql: `SELECT 
    c.NAME AS collection_name,
    c.USERDESCRIPTION,
    COUNT(q.GUID) AS query_count,
    SUM(CASE WHEN q.CERTIFICATESTATUS = 'VERIFIED' THEN 1 ELSE 0 END) AS verified_count
FROM COLLECTION_ENTITY c
LEFT JOIN QUERY_ENTITY q ON q.COLLECTIONQUALIFIEDNAME = c.QUALIFIEDNAME
GROUP BY c.NAME, c.USERDESCRIPTION
ORDER BY query_count DESC;`,
  },
];

// =============================================================================
// METADATA
// =============================================================================

export const USER_QUERIES_METADATA = {
  title: 'MDLH Query Dictionary',
  description: 'Consolidated metadata lakehouse queries from Slack user research, Confluence docs, and internal implementations',
  totalQueries: USER_RESEARCH_QUERIES.length,
  sources: [
    'Himanshu - Conversational Search Analysis (~600 user questions)',
    'Priyanjna - Medtronic Implementation',
    'Ben Hudson - Thursday Demos',
    'Shubham - Fox Workshop Notes',
    'Peter Ebert - Python NetworkX Approach',
    'Internal MDLH Documentation',
  ],
  lastUpdated: '2025-12-06',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get queries sorted by frequency (Very High → Low)
 */
export function getQueriesByFrequency() {
  const order = ['Very High', 'High', 'Medium', 'Low'];
  return [...USER_RESEARCH_QUERIES].sort((a, b) => {
    return order.indexOf(a.frequency) - order.indexOf(b.frequency);
  });
}

/**
 * Get queries grouped by category
 */
export function getQueriesByCategory() {
  const grouped = {};
  USER_RESEARCH_QUERIES.forEach(q => {
    if (!grouped[q.category]) {
      grouped[q.category] = [];
    }
    grouped[q.category].push(q);
  });
  return grouped;
}

/**
 * Find a query by ID
 */
export function findQueryById(id) {
  return USER_RESEARCH_QUERIES.find(q => q.id === id);
}

/**
 * Search queries by userIntent or name
 */
export function searchQueries(searchTerm) {
  const term = searchTerm.toLowerCase();
  return USER_RESEARCH_QUERIES.filter(q => 
    q.userIntent.toLowerCase().includes(term) ||
    q.name.toLowerCase().includes(term) ||
    q.description.toLowerCase().includes(term)
  );
}

export default {
  USER_RESEARCH_QUERIES,
  USER_QUERY_CATEGORIES,
  USER_QUERIES_METADATA,
  FREQUENCY_LEVELS,
  FREQUENCY_STYLES,
  getQueriesByFrequency,
  getQueriesByCategory,
  findQueryById,
  searchQueries,
};

