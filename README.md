# Atlan MDLH Entity Dictionary

An interactive reference guide for Atlan Metadata Lakehouse (MDLH) entity types, tables, attributes, and the Gold Layer schema. Available as both a React web app and Streamlit application.

## Gold Layer Schema

The MDLH Gold Layer provides pre-joined, query-optimized views for analytics. **ASSETS** is the central hub - start all queries there.

### Entity Relationship Diagram

```
                              ┌─────────────────────┐
                              │       ASSETS        │
                              │─────────────────────│
                              │ GUID (PK)           │
                              │ ASSET_TYPE          │
                              │ ASSET_NAME          │
                              │ STATUS              │
                              │ CONNECTOR_NAME      │
                              │ README_GUID (FK)    │
                              │ TERM_GUIDS (FK[])   │
                              │ POPULARITY_SCORE    │
                              │ HAS_LINEAGE         │
                              └──────────┬──────────┘
                                         │
        ┌────────────┬──────────┬────────┼────────┬──────────┬────────────┐
        │            │          │        │        │          │            │
        ▼            ▼          ▼        ▼        ▼          ▼            ▼
   ┌─────────┐ ┌─────────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌─────────┐ ┌─────────┐
   │RELATIONAL│ │PIPELINE │ │  DATA  │ │ DATA │ │README│ │GLOSSARY │ │ LINEAGE │
   │ DETAILS │ │ DETAILS │ │QUALITY │ │ MESH │ │      │ │ DETAILS │ │         │
   │  (1:1)  │ │  (1:1)  │ │ (1:1)  │ │(1:1) │ │(1:1) │ │  (1:M)  │ │  (1:M)  │
   └─────────┘ └─────────┘ └────────┘ └──────┘ └──────┘ └─────────┘ └─────────┘
        │            │          │        │        │          │            │
        ▼            ▼          ▼        ▼        ▼          ▼            ▼
   ┌─────────┐ ┌─────────┐                              ┌─────────┐ ┌─────────┐
   │  TAGS   │ │ CUSTOM  │                              │         │ │         │
   │  (1:M)  │ │METADATA │                              │         │ │         │
   │         │ │  (1:M)  │                              │         │ │         │
   └─────────┘ └─────────┘                              └─────────┘ └─────────┘
```

### Gold Layer Views

| View | Description | Join Key | Cardinality |
|------|-------------|----------|-------------|
| **ASSETS** | Core lookup table - central hub | `GUID` (PK) | Primary |
| **RELATIONAL_ASSET_DETAILS** | SQL assets (tables, columns, views) | `GUID` | 1:1 |
| **GLOSSARY_DETAILS** | Business terms and glossaries | `GUID`, `TERM_GUIDS` | 1:M |
| **LINEAGE** | Upstream/downstream lineage paths | `START_GUID`, `RELATED_GUID` | 1:M |
| **TAGS** | Classification tags | `ASSET_GUID` | 1:M |
| **CUSTOM_METADATA** | Custom metadata key-value pairs | `ASSET_GUID` | 1:M |
| **README** | Asset documentation | `README_GUID` | 1:1 |
| **PIPELINE_DETAILS** | Orchestration assets (Airflow, dbt) | `GUID` | 1:1 |
| **DATA_QUALITY_DETAILS** | DQ checks (Anomalo, Soda, Monte Carlo) | `GUID` | 1:1 |
| **DATA_MESH_DETAILS** | Domains, products, stakeholders | `GUID` | 1:1 |

### Relationship Summary

```sql
ASSETS (1) ←──── (1) RELATIONAL_ASSET_DETAILS  [GUID = GUID]
ASSETS (1) ←──── (1) PIPELINE_DETAILS          [GUID = GUID]
ASSETS (1) ←──── (1) DATA_QUALITY_DETAILS      [GUID = GUID]
ASSETS (1) ←──── (1) DATA_MESH_DETAILS         [GUID = GUID]
ASSETS (1) ←──── (1) README                    [README_GUID = GUID]
ASSETS (1) ←──── (M) GLOSSARY_DETAILS          [TERM_GUIDS contains GUID]
ASSETS (1) ←──── (M) LINEAGE                   [START_GUID/RELATED_GUID]
ASSETS (1) ←──── (M) TAGS                      [GUID = ASSET_GUID]
ASSETS (1) ←──── (M) CUSTOM_METADATA           [GUID = ASSET_GUID]
```

## Example Queries

### Basic Query Pattern

```sql
-- Always start with ASSETS, filter by STATUS = 'ACTIVE'
SELECT a.ASSET_NAME, a.ASSET_TYPE, r.*
FROM ASSETS a
JOIN RELATIONAL_ASSET_DETAILS r ON a.GUID = r.GUID
WHERE a.STATUS = 'ACTIVE'
  AND a.CONNECTOR_NAME = 'snowflake';
```

### Asset Inventory

```sql
-- Count assets by type and connector
SELECT
    CONNECTOR_NAME,
    ASSET_TYPE,
    COUNT(*) as asset_count
FROM ASSETS
WHERE STATUS = 'ACTIVE'
GROUP BY CONNECTOR_NAME, ASSET_TYPE
ORDER BY asset_count DESC;
```

### Lineage Analysis

```sql
-- Find downstream dependencies
SELECT
    a.ASSET_NAME AS source_asset,
    l.RELATED_NAME AS downstream_asset,
    l.LEVEL AS hops
FROM ASSETS a
JOIN LINEAGE l ON a.GUID = l.START_GUID
WHERE a.STATUS = 'ACTIVE'
  AND l.DIRECTION = 'DOWNSTREAM'
ORDER BY l.LEVEL;
```

### Governance Coverage

```sql
-- Assets missing owners
SELECT
    ASSET_NAME,
    ASSET_TYPE,
    CONNECTOR_NAME
FROM ASSETS
WHERE STATUS = 'ACTIVE'
  AND (OWNER_USERS IS NULL OR ARRAY_SIZE(OWNER_USERS) = 0);

-- Assets with PII tags
SELECT a.ASSET_NAME, t.TAG_NAME
FROM ASSETS a
JOIN TAGS t ON a.GUID = t.ASSET_GUID
WHERE t.TAG_NAME ILIKE '%PII%'
  AND a.STATUS = 'ACTIVE';
```

### Data Quality

```sql
-- Assets with failing DQ checks
SELECT
    a.ASSET_NAME,
    d.ANOMALO_CHECK_STATUS,
    d.SODA_CHECK_EVALUATION_STATUS,
    d.MC_MONITOR_STATUS
FROM ASSETS a
JOIN DATA_QUALITY_DETAILS d ON a.GUID = d.GUID
WHERE a.STATUS = 'ACTIVE'
  AND (d.ANOMALO_CHECK_STATUS = 'FAILED'
       OR d.SODA_CHECK_EVALUATION_STATUS = 'FAILED'
       OR d.MC_MONITOR_STATUS = 'ERROR');
```

## Applications

### Streamlit App (Snowflake)

Deploy the interactive explorer directly in Snowflake:

```
streamlit-entity-explorer/
├── streamlit_app.py      # Main application
├── streamlit_data.json   # Entity data & queries
├── environment.yml       # Dependencies
└── README.md             # Setup instructions
```

**Quick Deploy:**
1. Snowsight → Projects → Streamlit → + Streamlit
2. Upload all files from `streamlit-entity-explorer/`
3. Add `graphviz` package
4. Run

### React Web App

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Entity Categories

| Category | Description |
|----------|-------------|
| **Gold Layer** | MDLH Gold views and relationships |
| **Core** | Base entity types (Asset, Process, etc.) |
| **Glossary** | Business glossary entities |
| **Data Mesh** | Domains, products, stakeholders |
| **Relational DB** | Database, schema, table, column entities |
| **Query Org** | Query and collection entities |
| **BI Tools** | Dashboard, report, chart entities |
| **dbt** | dbt models, tests, sources |
| **Object Storage** | S3, GCS, ADLS entities |
| **Orchestration** | Airflow, Prefect, Dagster entities |
| **Governance** | Policies, purposes, personas |
| **AI/ML** | ML models, features, experiments |

## Resources

- [Atlan Docs - Gold Layer Reference](https://docs.atlan.com/platform/lakehouse/references/gold-layer/)
- [Atlan Developer Portal](https://developer.atlan.com)

## License

MIT
