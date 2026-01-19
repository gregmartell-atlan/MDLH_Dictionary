# MDLH Entity Dictionary - Query Architecture Export

> **Purpose**: Complete documentation of the query system, query templates, and query builder patterns for adaptation to other architectures.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Query Layers](#2-query-layers)
3. [Query Template System](#3-query-template-system)
4. [MDLH Queries (Atlan Metadata Layer)](#4-mdlh-queries-atlan-metadata-layer)
5. [Snowflake System Queries](#5-snowflake-system-queries)
6. [User Research Queries](#6-user-research-queries)
7. [Dynamic Query Builder](#7-dynamic-query-builder)
8. [Discovery-First Pattern](#8-discovery-first-pattern)
9. [Query Security & Validation](#9-query-security--validation)
10. [Query Flows & Wizards](#10-query-flows--wizards)
11. [React Query Caching](#11-react-query-caching)
12. [Type Definitions](#12-type-definitions)

---

## 1. Architecture Overview

### System Purpose
The MDLH Entity Dictionary is a metadata exploration tool that queries:
- **Atlan MDLH tables** (TABLE_ENTITY, COLUMN_ENTITY, PROCESS_ENTITY, etc.) for metadata, lineage, and governance
- **Snowflake system tables** (INFORMATION_SCHEMA, account_usage) for live structure and usage data

### Key Principles
1. **Discovery-First**: Never assume table names exist - always discover from schema first
2. **No Hardcoded Tables**: Dynamic query generation based on what's actually available
3. **SQL Injection Protection**: All identifiers validated and escaped
4. **Template Placeholders**: Use `{{PLACEHOLDER}}` syntax for dynamic values
5. **Dual-Layer Queries**: Metadata layer (MDLH) + Platform layer (Snowflake)

### Directory Structure
```
src/
├── data/
│   ├── queryTemplates.js      # 70+ query templates (MDLH + Snowflake)
│   ├── mdlhUserQueries.js     # 100+ user research queries
│   └── exampleQueries.js      # Example queries for onboarding
├── utils/
│   ├── dynamicQueryBuilder.js # Dynamic SQL generation
│   ├── discoveryQueries.js    # Schema-agnostic discovery
│   ├── queryHelpers.js        # SQL injection protection
│   ├── queryAvailability.js   # Query validation
│   └── queryResultAdapter.js  # Result normalization
├── hooks/
│   ├── useSnowflakeQuery.js   # Query execution with caching
│   └── useSnowflake.js        # Session-based operations
├── queryFlows/
│   ├── queryRecipes.js        # Multi-step wizard definitions
│   └── sql/                   # Domain-specific query builders
└── services/
    └── queryClient.js         # React Query configuration
```

---

## 2. Query Layers

### Layer 1: MDLH (Atlan Metadata)
```javascript
QUERY_LAYERS.MDLH = 'mdlh'
```
- Queries Atlan entity tables stored in Snowflake
- Focus: Metadata, lineage, governance, glossary
- Tables: `TABLE_ENTITY`, `COLUMN_ENTITY`, `PROCESS_ENTITY`, `TAG_RELATIONSHIP`, etc.

### Layer 2: Snowflake System
```javascript
QUERY_LAYERS.SNOWFLAKE = 'snowflake'
```
- Queries native Snowflake system catalogs
- Focus: Live structure, usage patterns, costs, performance
- Tables: `INFORMATION_SCHEMA.TABLES`, `account_usage.QUERY_HISTORY`, etc.

### Query Categories
```javascript
QUERY_CATEGORIES = {
  STRUCTURE: 'structure',   // Database schemas, columns, statistics
  LINEAGE: 'lineage',       // Upstream/downstream asset tracking
  GOVERNANCE: 'governance', // Tags, policies, compliance
  USAGE: 'usage',           // Popularity, access history
  QUALITY: 'quality',       // Null analysis, data freshness
  GLOSSARY: 'glossary',     // Business terms, definitions
  COST: 'cost',             // Warehouse credits, optimization
}
```

---

## 3. Query Template System

### Template Format
```javascript
{
  id: 'unique_query_id',
  label: 'Human-Readable Name',
  description: 'What this query does',
  category: QUERY_CATEGORIES.STRUCTURE,
  layer: QUERY_LAYERS.MDLH,
  icon: 'LucideIconName',
  requires: ['database', 'schema', 'table'],  // Required context fields
  sql: `SELECT * FROM TABLE_ENTITY WHERE ...`
}
```

### Placeholder Syntax
```sql
-- UPPERCASE placeholders (primary)
{{DATABASE}}, {{SCHEMA}}, {{TABLE}}, {{COLUMN}}, {{GUID}}
{{QUALIFIED_NAME}}, {{DAYS_BACK}}, {{OWNER_USERNAME}}
{{TERM_GUID}}, {{GLOSSARY_GUID}}, {{START_GUID}}

-- lowercase placeholders (from user research)
{{database}}, {{schema}}, {{table}}, {{column}}, {{guid}}
{{filter}}, {{domain}}, {{term}}, {{source}}

-- Legacy angle bracket format
<YOUR_GUID>, <COLUMN_GUID>, <CORE_GLOSSARY_GUID>
```

### Template Fill Functions

```javascript
// Basic fill - for display/copy-paste
fillTemplate(sqlTemplate, ctx, samples)

// Safe fill - for execution (escapes values)
fillTemplateSafe(sqlTemplate, ctx)

// Fill with sample info - returns what samples were used
fillTemplateWithSampleInfo(sqlTemplate, ctx, samples)
```

---

## 4. MDLH Queries (Atlan Metadata Layer)

### A. Asset Discovery & Structure

```sql
-- Entity Types Overview
SELECT
  table_name AS entity_type,
  row_count,
  ROUND(bytes / 1024 / 1024, 2) AS size_mb
FROM INFORMATION_SCHEMA.TABLES
WHERE table_schema = 'PUBLIC'
  AND table_type = 'BASE TABLE'
ORDER BY row_count DESC;

-- Table Asset Details
SELECT *
FROM TABLE_ENTITY
WHERE QUALIFIEDNAME LIKE '%{{DATABASE}}.{{SCHEMA}}.{{TABLE}}%'
LIMIT 10;

-- Column Metadata with Custom Metadata & Tags
WITH FILTERED_COLUMNS AS (
    SELECT GUID FROM COLUMN_ENTITY WHERE CONNECTORNAME IN ('glue', 'snowflake')
),
CM_AGG AS (
    SELECT CM.ENTITYGUID,
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
    SELECT TR.ENTITYGUID,
        '[' || LISTAGG(
            OBJECT_CONSTRUCT('name', TR.TAGNAME, 'value', TR.TAGVALUE)::STRING, ','
        ) WITHIN GROUP (ORDER BY TR.TAGNAME) || ']' AS TAG_JSON
    FROM TAG_RELATIONSHIP TR
    JOIN FILTERED_COLUMNS FC ON TR.ENTITYGUID = FC.GUID
    GROUP BY TR.ENTITYGUID
)
SELECT
    COL.NAME, COL.QUALIFIEDNAME, COL.GUID, COL.DISPLAYNAME,
    COL.DESCRIPTION, COL.USERDESCRIPTION, COL.CONNECTORNAME,
    COL.DATABASENAME, COL.SCHEMANAME, COL.TABLENAME, COL.DATATYPE,
    TR_AGG.TAG_JSON, CM_AGG.CUSTOM_METADATA_JSON,
    COL.STATUS, COL.OWNERUSERS, COL.ISPROFILED,
    COL.COLUMNDISTINCTVALUESCOUNT, COL.COLUMNMAX, COL.COLUMNMIN
FROM COLUMN_ENTITY COL
LEFT JOIN CM_AGG ON COL.GUID = CM_AGG.ENTITYGUID
LEFT JOIN TR_AGG ON COL.GUID = TR_AGG.ENTITYGUID
WHERE COL.CONNECTORNAME IN ('glue', 'snowflake')
LIMIT 100;
```

### B. Lineage Analysis

```sql
-- Direct Upstream (1 hop)
-- INPUTS/OUTPUTS are ARRAY - use ::STRING for display and WHERE
SELECT
    P.GUID AS process_guid,
    P.NAME AS process_name,
    P.INPUTS::STRING AS upstream_assets,
    P.OUTPUTS::STRING AS downstream_assets
FROM PROCESS_ENTITY P
WHERE P.OUTPUTS::STRING ILIKE '%{{GUID}}%'
LIMIT 50;

-- Direct Downstream (1 hop)
SELECT
    P.GUID AS process_guid,
    P.NAME AS process_name,
    P.INPUTS::STRING AS upstream_assets,
    P.OUTPUTS::STRING AS downstream_assets
FROM PROCESS_ENTITY P
WHERE P.INPUTS::STRING ILIKE '%{{GUID}}%'
LIMIT 50;

-- Recursive Lineage Chain (up to 5 hops)
WITH RECURSIVE lineage_chain AS (
    -- Base: direct upstream
    SELECT
        P.GUID AS process_guid,
        INPUT.VALUE::STRING AS asset_guid,
        1 AS hop_level,
        'UPSTREAM' AS direction
    FROM PROCESS_ENTITY P,
         LATERAL FLATTEN(P.INPUTS) INPUT
    WHERE P.OUTPUTS::STRING ILIKE '%{{GUID}}%'

    UNION ALL

    -- Recursive: follow upstream
    SELECT
        P.GUID,
        INPUT.VALUE::STRING,
        lc.hop_level + 1,
        'UPSTREAM'
    FROM lineage_chain lc
    JOIN PROCESS_ENTITY P ON P.OUTPUTS::STRING ILIKE '%' || lc.asset_guid || '%'
    CROSS JOIN LATERAL FLATTEN(P.INPUTS) INPUT
    WHERE lc.hop_level < 5
)
SELECT DISTINCT
    asset_guid, hop_level, direction,
    T.NAME AS asset_name, T.TYPENAME AS asset_type
FROM lineage_chain lc
LEFT JOIN TABLE_ENTITY T ON lc.asset_guid = T.GUID
ORDER BY hop_level, asset_name;

-- Impacted Dashboards
WITH downstream AS (
    SELECT OUTPUT.VALUE::STRING AS downstream_guid
    FROM PROCESS_ENTITY P,
         LATERAL FLATTEN(P.OUTPUTS) OUTPUT
    WHERE P.INPUTS::STRING ILIKE '%{{GUID}}%'
)
SELECT D.GUID, D.NAME, D.TYPENAME, D.CONNECTIONNAME
FROM downstream ds
JOIN TABLEAUDASHBOARD_ENTITY D ON ds.downstream_guid = D.GUID
UNION ALL
SELECT D.GUID, D.NAME, D.TYPENAME, D.CONNECTIONNAME
FROM downstream ds
JOIN POWERBIDASHBOARD_ENTITY D ON ds.downstream_guid = D.GUID;
```

### C. Governance & Compliance

```sql
-- Tags for Asset
SELECT
    TR.ENTITYGUID, TR.ENTITYTYPENAME, TR.TAGNAME, TR.TAGVALUE,
    TR.PROPAGATE, TR.PROPAGATEFROMLINEAGE
FROM TAG_RELATIONSHIP TR
WHERE TR.ENTITYGUID = '{{GUID}}';

-- Untagged Tables (Compliance Gap)
SELECT DISTINCT
    TB.GUID, TB.NAME AS table_name, TB.CREATEDBY, TB.DATABASEQUALIFIEDNAME
FROM TABLE_ENTITY TB
LEFT JOIN TAG_RELATIONSHIP TG ON TB.GUID = TG.ENTITYGUID
WHERE TG.TAGNAME IS NULL AND TB.STATUS = 'ACTIVE'
LIMIT 100;

-- PII/Sensitive Data Discovery
SELECT
    TR.ENTITYGUID, TE.NAME AS entity_name, TE.QUALIFIEDNAME,
    TR.TAGNAME, TR.TAGVALUE
FROM TAG_RELATIONSHIP TR
JOIN TABLE_ENTITY TE ON TR.ENTITYGUID = TE.GUID
WHERE TR.TAGNAME IN ('PII', 'Confidential', 'Sensitive', 'PHI')
ORDER BY TR.TAGNAME, TE.NAME
LIMIT 100;

-- Assets by Owner (OWNERUSERS is ARRAY)
SELECT NAME, TYPENAME, QUALIFIEDNAME, OWNERUSERS, OWNERGROUPS, STATUS
FROM TABLE_ENTITY
WHERE OWNERUSERS::STRING ILIKE '%{{OWNER_USERNAME}}%'
ORDER BY TYPENAME, NAME
LIMIT 100;
```

### D. Glossary & Business Context

```sql
-- All Glossaries
SELECT NAME, GUID, CREATEDBY, USERDESCRIPTION
FROM ATLASGLOSSARY_ENTITY
ORDER BY NAME;

-- Terms in Glossary (ANCHOR is OBJECT)
SELECT GUID, NAME, USERDESCRIPTION, STATUS
FROM ATLASGLOSSARYTERM_ENTITY
WHERE ANCHOR:guid::STRING ILIKE '%{{GLOSSARY_GUID}}%'
ORDER BY NAME;

-- Assets Linked to Term (MEANINGS is ARRAY)
SELECT T.GUID, T.NAME, T.TYPENAME, T.QUALIFIEDNAME
FROM TABLE_ENTITY T
WHERE T.MEANINGS::STRING ILIKE '%{{TERM_GUID}}%'
UNION ALL
SELECT C.GUID, C.NAME, C.TYPENAME, C.QUALIFIEDNAME
FROM COLUMN_ENTITY C
WHERE C.MEANINGS::STRING ILIKE '%{{TERM_GUID}}%';

-- Duplicate Terms Detection
SELECT
    LOWER(NAME) AS normalized_name,
    COUNT(*) AS term_count,
    ARRAY_AGG(GUID) AS guids,
    ARRAY_AGG(NAME) AS original_names
FROM ATLASGLOSSARYTERM_ENTITY
GROUP BY LOWER(NAME)
HAVING COUNT(*) > 1
ORDER BY term_count DESC;
```

### E. Usage & Popularity

```sql
-- Most Popular Tables
SELECT
    NAME, QUALIFIEDNAME, POPULARITYSCORE, ROWCOUNT,
    SIZEBYTES / 1024 / 1024 AS size_mb
FROM TABLE_ENTITY
WHERE POPULARITYSCORE IS NOT NULL
ORDER BY POPULARITYSCORE DESC
LIMIT 50;

-- Large Unused Tables (Cost Optimization)
SELECT
    NAME, QUALIFIEDNAME, ROWCOUNT,
    SIZEBYTES / 1024 / 1024 AS size_mb, POPULARITYSCORE
FROM TABLE_ENTITY
WHERE SIZEBYTES IS NOT NULL
  AND (POPULARITYSCORE IS NULL OR POPULARITYSCORE < 0.1)
ORDER BY SIZEBYTES DESC
LIMIT 50;

-- Most Active Users
SELECT
    UPDATEDBY,
    TO_TIMESTAMP(MAX(UPDATETIME)/1000) AS last_update,
    COUNT(*) AS update_count
FROM COLUMN_ENTITY
GROUP BY UPDATEDBY
ORDER BY update_count DESC
LIMIT 20;
```

---

## 5. Snowflake System Queries

### A. Structure & Stats

```sql
-- Live Column Structure
SELECT column_name, data_type, is_nullable, comment
FROM {{DATABASE}}.information_schema.columns
WHERE table_schema = '{{SCHEMA}}' AND table_name = '{{TABLE}}'
ORDER BY ordinal_position;

-- Table Size & Rows
SELECT
    t.table_name, t.row_count,
    t.bytes / 1024 / 1024 AS size_mb,
    t.retention_time, t.last_altered
FROM {{DATABASE}}.information_schema.tables t
WHERE t.table_schema = '{{SCHEMA}}' AND t.table_name = '{{TABLE}}';

-- Data Freshness
SELECT
    table_name, last_altered,
    DATEDIFF('hour', last_altered, CURRENT_TIMESTAMP()) AS hours_since_update
FROM {{DATABASE}}.information_schema.tables
WHERE table_schema = '{{SCHEMA}}' AND table_name = '{{TABLE}}';
```

### B. Usage & Query History

```sql
-- Top Users (30 days)
WITH table_access AS (
    SELECT q.query_id, q.user_name, q.role_name, q.start_time,
           q.total_elapsed_time, q.rows_produced
    FROM snowflake.account_usage.query_history q
    WHERE q.start_time >= DATEADD(day, -{{DAYS_BACK}}, CURRENT_TIMESTAMP())
      AND POSITION('{{DATABASE}}.{{SCHEMA}}.{{TABLE}}' IN UPPER(q.query_text)) > 0
)
SELECT
    user_name, role_name, COUNT(*) AS query_count,
    SUM(total_elapsed_time) / 1000.0 AS total_seconds,
    SUM(rows_produced) AS total_rows_produced
FROM table_access
GROUP BY user_name, role_name
ORDER BY query_count DESC
LIMIT 20;

-- Most Expensive Queries (by bytes scanned)
SELECT
    q.query_id, q.user_name, q.start_time,
    q.total_elapsed_time / 1000.0 AS duration_seconds,
    q.bytes_scanned / 1024 / 1024 / 1024 AS gb_scanned,
    LEFT(q.query_text, 200) AS query_preview
FROM snowflake.account_usage.query_history q
WHERE q.start_time >= DATEADD(day, -{{DAYS_BACK}}, CURRENT_TIMESTAMP())
  AND POSITION('{{DATABASE}}.{{SCHEMA}}.{{TABLE}}' IN UPPER(q.query_text)) > 0
ORDER BY q.bytes_scanned DESC
LIMIT 20;

-- Access History
SELECT
    ah.query_id, ah.user_name, ah.query_start_time,
    boa.value:"objectName"::string AS accessed_object
FROM snowflake.account_usage.access_history ah,
     LATERAL FLATTEN(ah.base_objects_accessed) AS boa
WHERE boa.value:"objectDomain"::string = 'Table'
  AND UPPER(boa.value:"objectName"::string) = '{{DATABASE}}.{{SCHEMA}}.{{TABLE}}'
  AND ah.query_start_time >= DATEADD(day, -{{DAYS_BACK}}, CURRENT_TIMESTAMP())
ORDER BY ah.query_start_time DESC
LIMIT 100;
```

### C. Tags & Policies

```sql
-- Native Snowflake Tags
SELECT
    object_database, object_schema, object_name, column_name,
    tag_database, tag_schema, tag_name, tag_value
FROM {{DATABASE}}.information_schema.tag_references_all_columns
WHERE object_schema = '{{SCHEMA}}' AND object_name = '{{TABLE}}'
ORDER BY column_name, tag_name;

-- Masking & Row Access Policies
SELECT
    policy_name, policy_kind, policy_status, policy_body, ref_column_name
FROM {{DATABASE}}.information_schema.policy_references
WHERE ref_database = '{{DATABASE}}'
  AND ref_schema = '{{SCHEMA}}'
  AND ref_entity_name = '{{TABLE}}'
ORDER BY policy_name;
```

### D. Data Quality & Profiling

```sql
-- Column Null & Distinct Stats
SELECT
    COUNT(*) AS total_rows,
    COUNT(*) - COUNT({{COLUMN}}) AS null_count,
    ROUND((COUNT(*) - COUNT({{COLUMN}}))::FLOAT / NULLIF(COUNT(*), 0) * 100, 2) AS null_pct,
    COUNT(DISTINCT {{COLUMN}}) AS distinct_values
FROM {{DATABASE}}.{{SCHEMA}}.{{TABLE}};

-- Top Values for Column
SELECT
    {{COLUMN}} AS value,
    COUNT(*) AS freq,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS pct
FROM {{DATABASE}}.{{SCHEMA}}.{{TABLE}}
GROUP BY {{COLUMN}}
ORDER BY freq DESC
LIMIT 50;

-- Numeric Column Statistics
SELECT
    MIN({{COLUMN}}) AS min_value,
    MAX({{COLUMN}}) AS max_value,
    AVG({{COLUMN}}) AS avg_value,
    MEDIAN({{COLUMN}}) AS median_value,
    STDDEV({{COLUMN}}) AS stddev_value
FROM {{DATABASE}}.{{SCHEMA}}.{{TABLE}};
```

### E. Cost Analysis

```sql
-- Warehouse Costs (30 days)
SELECT
    warehouse_name, COUNT(*) AS query_count,
    SUM(credits_used_cloud_services) AS credits_cloud,
    SUM(credits_used_compute) AS credits_compute,
    SUM(credits_used_cloud_services + credits_used_compute) AS total_credits
FROM snowflake.account_usage.warehouse_metering_history
WHERE start_time >= DATEADD(day, -{{DAYS_BACK}}, CURRENT_TIMESTAMP())
GROUP BY warehouse_name
ORDER BY total_credits DESC
LIMIT 20;

-- Most Accessed Tables (Account-Wide)
WITH accessed AS (
    SELECT
        boa.value:"objectName"::string AS table_name,
        ah.user_name, ah.query_start_time
    FROM snowflake.account_usage.access_history ah,
         LATERAL FLATTEN(ah.base_objects_accessed) boa
    WHERE boa.value:"objectDomain"::string = 'Table'
      AND ah.query_start_time >= DATEADD(day, -{{DAYS_BACK}}, CURRENT_TIMESTAMP())
)
SELECT
    table_name, COUNT(*) AS access_events,
    COUNT(DISTINCT user_name) AS distinct_users
FROM accessed
GROUP BY table_name
ORDER BY access_events DESC
LIMIT 100;
```

---

## 6. User Research Queries

### Frequency Levels
```javascript
FREQUENCY_LEVELS = {
  VERY_HIGH: 'Very High',  // ~20-25% of user questions
  HIGH: 'High',            // ~10-15% of user questions
  MEDIUM: 'Medium',        // ~5-10% of user questions
  LOW: 'Low',              // <5% of user questions
}
```

### Query Categories by User Research
| Category | % of Questions | Primary Use Cases |
|----------|---------------|-------------------|
| Asset Discovery | ~25% | Find verified tables, search by data source |
| Count & Statistics | ~20% | Total counts, breakdowns by connector |
| Usage & Popularity | ~15% | Most queried tables, unused assets |
| Data Lineage | ~12% | Upstream/downstream tracing |
| Glossary & Terms | ~10% | Term definitions, linked assets |
| Governance & Ownership | ~8% | Find owners, PII discovery |
| Data Quality | ~3% | Missing descriptions, compliance gaps |

### Sample User Research Queries

```sql
-- Show All Verified Tables (Very High frequency)
SELECT
    NAME, QUALIFIEDNAME, SCHEMANAME, DATABASENAME,
    CONNECTIONNAME, USERDESCRIPTION, OWNERUSERS, STATUSMESSAGE
FROM TABLE_ENTITY
WHERE STATUSMESSAGE IS NOT NULL AND STATUS = 'ACTIVE'
ORDER BY UPDATETIME DESC;

-- Most Queried Tables Last Month (High frequency)
SELECT
    NAME, SCHEMANAME, DATABASENAME, QUERYCOUNT,
    QUERYUSERCOUNT, QUERYCOUNTUPDATEDAT, POPULARITYSCORE
FROM TABLE_ENTITY
WHERE QUERYCOUNT > 0
  AND QUERYCOUNTUPDATEDAT >= DATEADD(month, -1, CURRENT_DATE())
  AND STATUS = 'ACTIVE'
ORDER BY QUERYCOUNT DESC
LIMIT 50;

-- Tableau Dashboards with Upstream Tables (High frequency)
SELECT
    ds.NAME AS datasource_name, ds.GUID AS datasource_guid,
    ds.HASEXTRACTS, ds.STATUS,
    p.OUTPUTS::STRING AS linked_to
FROM TABLEAUDATASOURCE_ENTITY ds
LEFT JOIN PROCESS_ENTITY p ON p.INPUTS::STRING ILIKE '%' || ds.GUID || '%'
WHERE ds.STATUS = 'ACTIVE'
ORDER BY ds.POPULARITYSCORE DESC NULLS LAST
LIMIT 50;

-- dbt Models Overview (High frequency)
SELECT
    NAME, DBTALIAS, DBTMATERIALIZATION, STATUS, OWNERUSERS, QUALIFIEDNAME
FROM DBTMODEL_ENTITY
WHERE STATUS = 'ACTIVE'
ORDER BY DBTMATERIALIZATION, NAME
LIMIT 100;

-- All Data Connections (High frequency)
SELECT
    NAME, CONNECTORNAME, CATEGORY, HOST, STATUS,
    ADMINUSERS::STRING AS admins
FROM CONNECTION_ENTITY
WHERE STATUS = 'ACTIVE'
ORDER BY CONNECTORNAME, NAME
LIMIT 100;
```

---

## 7. Dynamic Query Builder

### Core Functions

```javascript
// Analyze discovered tables and categorize by entity type
analyzeDiscoveredTables(discoveredTables) → {
  entityTables: [],      // All *_ENTITY tables
  tableEntities: [],     // TABLE_ENTITY, SNOWFLAKETABLE, etc.
  columnEntities: [],    // COLUMN_ENTITY variants
  processEntities: [],   // PROCESS_ENTITY, lineage tables
  glossaryEntities: [],  // ATLASGLOSSARY*, term tables
  dashboardEntities: [], // BI dashboard entities
  hasLineage: boolean,
  hasGlossary: boolean,
  hasTags: boolean,
}

// Build dynamic query recommendations
buildDynamicRecommendations({
  database, schema, discoveredTables, samples, context
}) → Array<QueryObject>
```

### Dynamic Query Builders

```javascript
// Simple preview query
buildPreviewQuery(database, schema, table, limit = 100)

// Row count query
buildCountQuery(database, schema, table)

// GUID lookup (only with real GUIDs, never placeholders)
buildGuidLookupQuery(database, schema, table, sampleGuid)

// Upstream lineage (requires real GUID)
buildUpstreamLineageQuery(database, schema, processTable, sampleGuid)

// Downstream lineage (requires real GUID)
buildDownstreamLineageQuery(database, schema, processTable, sampleGuid)

// Glossary search
buildGlossarySearchQuery(database, schema, glossaryTable, searchTerm)

// Popular tables
buildPopularTablesQuery(database, schema, tableEntity)
```

### Entity Type Detection Patterns
```javascript
ENTITY_TYPE_PATTERNS = {
  lineage: ['PROCESS', 'BIPROCESS', 'DBTPROCESS', 'COLUMNPROCESS', 'AIRFLOWDAG'],
  assets: ['TABLE', 'VIEW', 'COLUMN', 'SCHEMA', 'DATABASE'],
  quality: ['METRIC', 'QUALITYRULE', 'DATAQUALITY'],
  governance: ['GLOSSARY', 'TERM', 'POLICY', 'CLASSIFICATION', 'TAG'],
  bi: ['DASHBOARD', 'REPORT', 'TABLEAU', 'LOOKER', 'POWERBI', 'METABASE'],
}
```

---

## 8. Discovery-First Pattern

### Step 1: Discover Tables with Row Counts
```sql
SELECT
  table_name, row_count, bytes, created, last_altered
FROM {{DATABASE}}.information_schema.tables
WHERE table_schema = '{{SCHEMA}}'
  AND table_name LIKE '%_ENTITY'
  AND table_type = 'BASE TABLE'
ORDER BY row_count DESC NULLS LAST;
```

### Step 2: Discover Columns for Selected Table
```sql
SELECT
  column_name, data_type, is_nullable, column_default,
  ordinal_position, character_maximum_length,
  numeric_precision, numeric_scale
FROM {{DATABASE}}.information_schema.columns
WHERE table_schema = '{{SCHEMA}}'
  AND table_name = '{{TABLE}}'
ORDER BY ordinal_position;
```

### Step 3: Build Entity Type Registry
```javascript
buildEntityTypeRegistry(discoveredTables) → {
  lineage: ['PROCESS_ENTITY', 'DBTPROCESS_ENTITY'],
  assets: ['TABLE_ENTITY', 'VIEW_ENTITY'],
  governance: ['ATLASGLOSSARY_ENTITY', 'ATLASGLOSSARYTERM_ENTITY'],
  bi: ['TABLEAUDASHBOARD_ENTITY', 'POWERBIREPORT_ENTITY'],
  other: [...],
}
```

### Step 4: Select Best Table by Row Count
```javascript
selectBestTable(tables, { preferCategory: 'lineage' })
// Returns table with highest row_count in preferred category
```

---

## 9. Query Security & Validation

### SQL Injection Protection

```javascript
// Validate identifier (table/column names)
isValidIdentifier(identifier) → boolean
// Pattern: /^[A-Za-z_][A-Za-z0-9_]*$/

// Escape identifier (double-quote wrapping)
escapeIdentifier(identifier) → `"${escaped}"`

// Escape string value (single-quote wrapping)
escapeStringValue(value) → `'${escaped}'`

// Build safe fully-qualified name
buildSafeFQN(database, schema, table) → "DB"."SCHEMA"."TABLE"

// Sanitize identifier (clean dangerous characters)
sanitizeIdentifier(identifier) → cleanedString

// Validate entity object
validateEntityIdentifiers(entity) → { valid: boolean, issues: string[] }
```

### Query Validation

```javascript
// Extract tables referenced in SQL
extractReferencedTables(sql) → string[]

// Check if query can run with available tables
canQueryRunWithTables(query, availableTables) → boolean

// Check if query has required context
canExecuteQuery(query, context) → boolean

// Pre-validate all queries against discovered tables
preValidateAllQueries(queries, discoveredTables, database, schema) → Map
```

### Safety Rules
1. **No Placeholder Execution**: Never execute queries with `<GUID>`, `{{PLACEHOLDER}}` values
2. **Table Allowlisting**: Only use tables discovered from schema scan
3. **Identifier Validation**: All identifiers must pass regex + length checks
4. **Null Byte Detection**: Reject identifiers containing `\0`
5. **Read-Only Enforcement**: Only allow SELECT, SHOW, DESCRIBE, EXPLAIN

---

## 10. Query Flows & Wizards

### Intent Types
```javascript
QUERY_INTENTS = {
  LINEAGE: 'LINEAGE',     // Upstream/downstream tracing
  PROFILE: 'PROFILE',     // Column statistics
  DISCOVERY: 'DISCOVERY', // Schema exploration
  QUALITY: 'QUALITY',     // Data quality audit
  USAGE: 'USAGE',         // Usage analytics
  GLOSSARY: 'GLOSSARY',   // Term search
  SCHEMA: 'SCHEMA',       // Schema browsing
  SAMPLE: 'SAMPLE',       // Data sampling
}
```

### Step Kinds
```javascript
STEP_KINDS = {
  DISCOVER: 'DISCOVER',     // Find available tables
  INSPECT: 'INSPECT',       // Examine structure
  SAMPLE: 'SAMPLE',         // Preview data
  BUILD_FINAL: 'BUILD_FINAL', // Generate final query
  SEARCH: 'SEARCH',         // Search/filter
  VALIDATE: 'VALIDATE',     // Validation step
}
```

### Recipe Structure
```javascript
{
  id: 'lineage_downstream',
  intent: QUERY_INTENTS.LINEAGE,
  label: 'Trace Downstream Lineage',
  description: 'Step-by-step lineage discovery',
  icon: 'GitBranch',
  domains: ['Core'],
  supportedEntityTypes: ['TABLE', 'VIEW', 'COLUMN', 'PROCESS'],
  defaultInputs: { direction: 'DOWNSTREAM' },

  steps: [
    {
      id: 'discover_process_tables',
      kind: STEP_KINDS.DISCOVER,
      queryId: 'core_show_process_tables',
      title: 'Step 1: Discover Lineage Tables',
      description: 'Find lineage/process tables in this schema.',
      inputBindings: { database: 'database', schema: 'schema' },
      outputBindings: {
        discoveredTables: { fromColumn: 'name', mode: 'collectArray' },
        processTable: { fromColumn: 'name', mode: 'findFirst', match: 'PROCESS_ENTITY' },
        hasProcessTable: { mode: 'hasRows' },
      },
      optional: false,
    },
    // ... more steps
  ],
}
```

### Available Wizards
1. **lineage_downstream** - Trace what this asset feeds into
2. **lineage_upstream** - Trace what feeds into this asset
3. **schema_discovery** - Explore tables and columns
4. **glossary_search** - Find and link glossary terms
5. **column_profile** - Analyze column statistics
6. **usage_analysis** - Query patterns and popularity
7. **dbt_model_lineage** - dbt-specific lineage
8. **bi_dashboard_lineage** - Dashboard data sources
9. **impact_analysis** - Multi-hop downstream impact
10. **data_quality_audit** - Quality scorecard
11. **governance_compliance** - Governance audit
12. **orphan_asset_discovery** - Find abandoned assets
13. **cost_attribution** - Query cost analysis

---

## 11. React Query Caching

### Cache Configuration
```javascript
CACHE_CONFIG = {
  STALE_TIME_MS: 5 * 60 * 1000,      // 5 min (like Snowflake result cache)
  GC_TIME_MS: 30 * 60 * 1000,        // 30 min garbage collection
  METADATA_STALE_TIME_MS: 10 * 60 * 1000, // 10 min for metadata
  QUERY_STALE_TIME_MS: 2 * 60 * 1000,     // 2 min for query results
  RETRY_COUNT: 2,
  RETRY_DELAY_BASE_MS: 1000,         // Exponential backoff
}
```

### Query Keys
```javascript
queryKeys = {
  query: (sql, options) => ['query', sql, options],
  preflight: (sql) => ['preflight', sql],
  batchValidation: (queries) => ['batchValidation', queries],
  metadata: {
    all: () => ['metadata'],
    databases: () => ['metadata', 'databases'],
    schemas: (database) => ['metadata', 'schemas', database],
    tables: (database, schema) => ['metadata', 'tables', database, schema],
    columns: (database, schema, table) => ['metadata', 'columns', database, schema, table],
  },
  samples: (database, schema) => ['samples', database, schema],
  history: () => ['history'],
  connection: () => ['connection'],
}
```

### Cache Invalidation
```javascript
// Invalidate query results
invalidateAllQueries()

// Invalidate metadata caches
invalidateMetadata()

// Prefetch for hover optimization
prefetchQuery(queryFn, queryKey, options)
```

---

## 12. Type Definitions

### EntityContext
```typescript
interface EntityContext {
  database?: string;
  schema?: string;
  table?: string;
  column?: string;
  guid?: string;
  qualifiedName?: string;
  entityType?: 'TABLE' | 'VIEW' | 'COLUMN' | 'PROCESS' | 'TERM' | 'DASHBOARD' | 'MODEL' | 'GLOSSARY';
  connectorName?: 'snowflake' | 'databricks' | 'tableau' | 'looker' | 'powerbi';
  daysBack?: number;
  termGuid?: string;
  glossaryGuid?: string;
  startGuid?: string;
  ownerUsername?: string;
  filter?: string;
  searchTerm?: string;
}
```

### QueryDefinition
```typescript
interface QueryDefinition {
  id: string;
  label: string;
  description: string;
  category: QueryCategory;
  layer: 'mdlh' | 'snowflake';
  icon: string;
  requires: string[];
  sql: string;
  requiredTables?: string[];
  userIntent?: string;
  frequency?: 'Very High' | 'High' | 'Medium' | 'Low';
  source?: string;
  warning?: string;
  confidence?: 'high' | 'medium' | 'low';
}
```

### RawQueryResult
```typescript
interface RawQueryResult {
  columns: (string | { name: string; type?: string })[];
  rows: any[][];
  rowCount?: number;
  executionTime?: number;
}
```

### SampleEntities
```typescript
interface SampleEntities {
  tables?: object[];
  columns?: object[];
  processes?: object[];
  terms?: object[];
  glossaries?: object[];
  tablesTable?: string;      // Actual table name discovered
  columnsTable?: string;
  processesTable?: string;
  termsTable?: string;
  glossariesTable?: string;
}
```

---

## Key Implementation Notes

### Array/Object Column Handling in Snowflake
```sql
-- ARRAY columns: use ::STRING for ILIKE searches
WHERE INPUTS::STRING ILIKE '%guid%'

-- OBJECT columns: use :field::STRING to extract
WHERE ANCHOR:guid::STRING = 'some-guid'

-- ARRAY flattening: use LATERAL FLATTEN
FROM PROCESS_ENTITY P,
     LATERAL FLATTEN(P.OUTPUTS) OUTPUT
```

### Common Atlan Entity Columns
| Column | Type | Description |
|--------|------|-------------|
| GUID | VARCHAR | Unique identifier |
| NAME | VARCHAR | Display name |
| QUALIFIEDNAME | VARCHAR | Full path identifier |
| TYPENAME | VARCHAR | Entity type |
| STATUS | VARCHAR | ACTIVE, DELETED, etc. |
| OWNERUSERS | ARRAY | Assigned owners |
| OWNERGROUPS | ARRAY | Assigned groups |
| MEANINGS | ARRAY | Linked glossary terms |
| CLASSIFICATIONNAMES | ARRAY | Applied tags |
| USERDESCRIPTION | VARCHAR | User-provided description |
| POPULARITYSCORE | FLOAT | Usage popularity (0-1) |
| QUERYCOUNT | NUMBER | Query frequency |
| CREATETIME | NUMBER | Unix timestamp (ms) |
| UPDATETIME | NUMBER | Unix timestamp (ms) |

### Timestamp Handling
```sql
-- Convert MDLH timestamps (milliseconds) to readable
TO_TIMESTAMP(UPDATETIME/1000) AS updated_at
```

---

*This document is auto-generated from the MDLH Entity Dictionary codebase.*
