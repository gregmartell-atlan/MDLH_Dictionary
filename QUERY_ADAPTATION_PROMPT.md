# Query Architecture Adaptation Prompt

> **Use this prompt with Claude Code to adapt the MDLH query system to your new architecture.**

---

## The Prompt

Copy and paste the following prompt into Claude Code, replacing the placeholders with your specific details:

---

```
I need to adapt a comprehensive SQL query system from an existing Atlan MDLH (Metadata Lakehouse) application to my new architecture.

## Source Documentation
I'm providing you with `QUERY_ARCHITECTURE_EXPORT.md` which contains:
- 70+ query templates for metadata, lineage, governance, glossary, usage, and quality
- A dual-layer architecture (metadata layer + platform system layer)
- Dynamic query builder patterns with discovery-first approach
- Multi-step query wizard/flow definitions
- SQL injection protection and validation utilities
- React Query caching configuration
- User research queries organized by frequency

## My Target Architecture

**Database Platform**: [YOUR_DATABASE: e.g., PostgreSQL, BigQuery, Databricks, Redshift, etc.]

**Metadata Source**: [YOUR_METADATA_SOURCE: e.g.,
  - Custom metadata tables
  - DataHub
  - OpenMetadata
  - Unity Catalog
  - AWS Glue Catalog
  - Custom lineage tables
  - etc.]

**Table Naming Convention**: [YOUR_CONVENTION: e.g.,
  - metadata.assets, metadata.lineage, metadata.tags
  - catalog.tables, catalog.columns
  - Custom naming pattern]

**Key Entity Tables** (if known):
- Tables: [YOUR_TABLE_ENTITY_TABLE]
- Columns: [YOUR_COLUMN_ENTITY_TABLE]
- Lineage/Process: [YOUR_LINEAGE_TABLE]
- Tags/Classifications: [YOUR_TAGS_TABLE]
- Glossary Terms: [YOUR_GLOSSARY_TABLE]
- Users/Ownership: [YOUR_USERS_TABLE]

**Special Considerations**:
- [Any JSON/ARRAY column handling differences]
- [Any timestamp format differences]
- [Any specific SQL dialect requirements]
- [Any permission/access patterns to consider]

## What I Need You To Do

1. **Analyze the source queries** in QUERY_ARCHITECTURE_EXPORT.md

2. **Create adapted versions** for my target architecture:
   - Convert Snowflake-specific syntax to my database dialect
   - Map Atlan entity table names to my metadata table names
   - Adapt ARRAY/OBJECT column handling for my database
   - Preserve the query categorization and structure

3. **Generate the following files**:

   a. **queryTemplates.js** - Adapted query templates with:
      - Same category structure (STRUCTURE, LINEAGE, GOVERNANCE, USAGE, QUALITY, GLOSSARY, COST)
      - Same placeholder syntax ({{DATABASE}}, {{SCHEMA}}, {{TABLE}}, etc.)
      - Queries converted to my database dialect

   b. **dynamicQueryBuilder.js** - Adapted dynamic query generation:
      - Entity type detection patterns for my table naming
      - Query builders for my table structure
      - Discovery queries for my metadata catalog

   c. **discoveryQueries.js** - Schema discovery queries:
      - Table discovery for my information_schema equivalent
      - Column discovery adapted to my catalog
      - Entity type registry for my naming conventions

   d. **queryHelpers.js** - SQL security utilities:
      - Identifier escaping for my database (backticks, brackets, double-quotes, etc.)
      - String value escaping for my database
      - FQN building for my database

4. **Preserve these patterns**:
   - Discovery-first approach (never assume table names)
   - No hardcoded table names in execution
   - SQL injection protection on all identifiers
   - Template placeholder system
   - Query availability checking before display

5. **Adapt these specific query types** (prioritize by user research frequency):

   **High Priority (Very High/High frequency)**:
   - Verified/certified asset discovery
   - Asset counts by connector/database
   - Most queried/popular tables
   - Direct upstream/downstream lineage
   - Glossary term lookup
   - Owner/steward discovery
   - PII/sensitive data discovery

   **Medium Priority**:
   - Recursive multi-hop lineage
   - Dashboard impact analysis
   - Column-level lineage
   - Tag propagation
   - Data freshness monitoring
   - Unused asset discovery

6. **Handle these Snowflake-specific patterns**:

   Original (Snowflake):
   ```sql
   -- ARRAY column search
   WHERE INPUTS::STRING ILIKE '%guid%'

   -- OBJECT field extraction
   WHERE ANCHOR:guid::STRING = 'value'

   -- Array flattening
   FROM table, LATERAL FLATTEN(array_column) f

   -- Timestamp conversion
   TO_TIMESTAMP(UPDATETIME/1000)
   ```

   Convert to: [MY_DATABASE_EQUIVALENTS]

7. **Output format**: Provide complete, working code files that I can drop into my project. Include:
   - JSDoc comments explaining each function
   - TypeScript type definitions (or JSDoc @typedef)
   - Export statements matching the original structure
   - Any necessary utility functions

## Additional Context

[Add any additional context about your project here:
- Frontend framework (React, Vue, Angular, etc.)
- State management approach
- Any existing query utilities you want to integrate with
- Specific use cases you want to prioritize]
```

---

## Example Filled Prompt (PostgreSQL + Custom Metadata)

```
I need to adapt a comprehensive SQL query system from an existing Atlan MDLH application to my new architecture.

## Source Documentation
I'm providing you with `QUERY_ARCHITECTURE_EXPORT.md` which contains the full query architecture.

## My Target Architecture

**Database Platform**: PostgreSQL 15

**Metadata Source**: Custom metadata tables built from dbt artifacts and Airflow lineage

**Table Naming Convention**:
- All metadata in `metadata` schema
- Tables named: assets, columns, lineage_edges, tags, glossary_terms

**Key Entity Tables**:
- Tables: metadata.assets (where asset_type = 'table')
- Columns: metadata.columns
- Lineage/Process: metadata.lineage_edges
- Tags/Classifications: metadata.tags
- Glossary Terms: metadata.glossary_terms
- Users/Ownership: metadata.asset_owners

**Special Considerations**:
- JSONB columns instead of Snowflake VARIANT
- Use `jsonb_array_elements` instead of LATERAL FLATTEN
- Timestamps are already PostgreSQL timestamp type
- No warehouse cost data available (skip cost queries)

## What I Need You To Do
[... rest of prompt ...]
```

---

## Example Filled Prompt (Databricks + Unity Catalog)

```
I need to adapt a comprehensive SQL query system from an existing Atlan MDLH application to my new architecture.

## Source Documentation
I'm providing you with `QUERY_ARCHITECTURE_EXPORT.md` which contains the full query architecture.

## My Target Architecture

**Database Platform**: Databricks SQL (Spark SQL dialect)

**Metadata Source**: Unity Catalog system tables + custom lineage tables

**Table Naming Convention**:
- Unity Catalog: system.information_schema.*
- Custom lineage: analytics.data_lineage
- Custom governance: analytics.data_governance

**Key Entity Tables**:
- Tables: system.information_schema.tables + analytics.table_metadata
- Columns: system.information_schema.columns + analytics.column_metadata
- Lineage/Process: analytics.data_lineage
- Tags/Classifications: system.information_schema.column_tags
- Glossary Terms: analytics.business_glossary
- Users/Ownership: analytics.data_owners

**Special Considerations**:
- Use EXPLODE() instead of LATERAL FLATTEN
- STRUCT fields accessed with dot notation
- Delta Lake timestamp columns
- Unity Catalog 3-level namespace (catalog.schema.table)
- GRANT-based access control queries available

## What I Need You To Do
[... rest of prompt ...]
```

---

## Example Filled Prompt (BigQuery + Dataplex)

```
I need to adapt a comprehensive SQL query system from an existing Atlan MDLH application to my new architecture.

## Source Documentation
I'm providing you with `QUERY_ARCHITECTURE_EXPORT.md` which contains the full query architecture.

## My Target Architecture

**Database Platform**: BigQuery

**Metadata Source**: Google Dataplex + BigQuery INFORMATION_SCHEMA

**Table Naming Convention**:
- Metadata: `my-project.dataplex_metadata.*`
- BigQuery native: `region-us.INFORMATION_SCHEMA.*`

**Key Entity Tables**:
- Tables: INFORMATION_SCHEMA.TABLES + dataplex_metadata.entities
- Columns: INFORMATION_SCHEMA.COLUMNS + dataplex_metadata.column_profiles
- Lineage/Process: Data Lineage API (external, not SQL)
- Tags/Classifications: dataplex_metadata.tags
- Glossary Terms: dataplex_metadata.glossary_terms
- Users/Ownership: INFORMATION_SCHEMA.OBJECT_PRIVILEGES

**Special Considerations**:
- Use UNNEST() instead of LATERAL FLATTEN
- STRUCT/ARRAY handling via BigQuery syntax
- Partitioned table considerations
- Slot-based cost model (different from Snowflake credits)
- Data Lineage API is REST-based, not SQL

## What I Need You To Do
[... rest of prompt ...]
```

---

## Tips for Best Results

1. **Provide your actual table schemas** - Include CREATE TABLE statements or column lists for your metadata tables so Claude can map columns correctly.

2. **Include sample data** - A few rows of sample data from your key tables helps Claude understand the data format.

3. **Specify your SQL dialect quirks** - Every database has unique syntax. Call out specific functions, operators, or patterns you use.

4. **Prioritize what you need** - If you only need lineage queries, say so. Don't ask for everything if you don't need it.

5. **Iterate** - Start with one category (e.g., just lineage queries), validate they work, then add more.

6. **Test the output** - Always test generated queries against your actual database before integrating.

---

## Quick Reference: Key Syntax Translations

| Snowflake | PostgreSQL | Databricks | BigQuery |
|-----------|------------|------------|----------|
| `::STRING` | `::TEXT` | implicit | `CAST(x AS STRING)` |
| `ILIKE` | `ILIKE` | `ILIKE` | Use `LOWER()` + `LIKE` |
| `LATERAL FLATTEN(arr)` | `jsonb_array_elements(arr)` | `EXPLODE(arr)` | `UNNEST(arr)` |
| `obj:field::STRING` | `obj->>'field'` | `obj.field` | `JSON_VALUE(obj, '$.field')` |
| `ARRAY_AGG()` | `ARRAY_AGG()` | `COLLECT_LIST()` | `ARRAY_AGG()` |
| `OBJECT_CONSTRUCT()` | `jsonb_build_object()` | `STRUCT()` | `STRUCT()` |
| `"identifier"` | `"identifier"` | `` `identifier` `` | `` `identifier` `` |
| `DATEADD(day, -30, x)` | `x - INTERVAL '30 days'` | `DATE_ADD(x, -30)` | `DATE_SUB(x, INTERVAL 30 DAY)` |
| `DATEDIFF('day', a, b)` | `b - a` (returns interval) | `DATEDIFF(b, a)` | `DATE_DIFF(b, a, DAY)` |

---

## Checklist After Adaptation

- [ ] All queries execute without syntax errors
- [ ] Placeholder substitution works correctly
- [ ] Discovery queries return expected table lists
- [ ] Lineage queries correctly traverse your lineage model
- [ ] Tag/classification queries match your tagging schema
- [ ] Glossary queries work with your term structure
- [ ] SQL injection protection uses correct escaping for your DB
- [ ] Query availability checking works with your table names
- [ ] Caching keys are appropriate for your use case

---

*Use this prompt with the QUERY_ARCHITECTURE_EXPORT.md file to adapt the query system to your architecture.*
