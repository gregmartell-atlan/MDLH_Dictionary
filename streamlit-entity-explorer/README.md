# MDLH Entity Dictionary

A Streamlit application for exploring Atlan's Metadata Lakehouse (MDLH) Gold Layer schema. Provides an interactive entity relationship diagram, schema reference, and example SQL queries.

## Features

- **Interactive ERD**: Visual entity relationship diagram of all 10 Gold Layer views
- **Schema Explorer**: Detailed column information for each view with data types and descriptions
- **Example Queries**: 40+ ready-to-use SQL queries organized by category
- **Search**: Filter entities and queries across all categories
- **Export**: Download entity data as CSV

## Gold Layer Views

| View | Description | Relationship |
|------|-------------|--------------|
| ASSETS | Core lookup table - central hub | Primary |
| RELATIONAL_ASSET_DETAILS | SQL assets (tables, columns, views) | 1:1 |
| GLOSSARY_DETAILS | Business terms and glossaries | 1:M |
| LINEAGE | Upstream/downstream lineage paths | 1:M |
| TAGS | Classification tags | 1:M |
| CUSTOM_METADATA | Custom metadata key-value pairs | 1:M |
| README | Asset documentation | 1:1 |
| PIPELINE_DETAILS | Orchestration assets (Airflow, dbt) | 1:1 |
| DATA_QUALITY_DETAILS | DQ checks (Anomalo, Soda, Monte Carlo) | 1:1 |
| DATA_MESH_DETAILS | Domains, products, stakeholders | 1:1 |

## Installation

### Snowflake Streamlit (Recommended)

1. Navigate to **Snowsight** > **Projects** > **Streamlit**
2. Click **+ Streamlit** to create a new app
3. Upload the following files:
   - `streamlit_app.py`
   - `streamlit_data.json`
   - `environment.yml`
4. Add the `graphviz` package via **Packages**
5. Click **Run**

### Local Development

```bash
# Install dependencies
pip install streamlit graphviz

# Run the app
streamlit run streamlit_app.py
```

### Streamlit Community Cloud

1. Fork this repository
2. Go to [share.streamlit.io](https://share.streamlit.io)
3. Deploy from your fork with `streamlit_app.py` as the main file

## Files

| File | Description |
|------|-------------|
| `streamlit_app.py` | Main Streamlit application |
| `streamlit_data.json` | Entity data and example queries |
| `environment.yml` | Snowflake Streamlit dependencies |

## Usage

### Basic Query Pattern

```sql
-- Start with ASSETS, filter by STATUS, JOIN to detail views
SELECT a.ASSET_NAME, a.ASSET_TYPE, r.*
FROM ASSETS a
JOIN RELATIONAL_ASSET_DETAILS r ON a.GUID = r.GUID
WHERE a.STATUS = 'ACTIVE'
  AND a.CONNECTOR_NAME = 'snowflake';
```

### Key Relationships

```
ASSETS (1) <──── (1) RELATIONAL_ASSET_DETAILS  [GUID = GUID]
ASSETS (1) <──── (1) PIPELINE_DETAILS          [GUID = GUID]
ASSETS (1) <──── (1) DATA_QUALITY_DETAILS      [GUID = GUID]
ASSETS (1) <──── (1) DATA_MESH_DETAILS         [GUID = GUID]
ASSETS (1) <──── (1) README                    [README_GUID = GUID]
ASSETS (1) <──── (M) GLOSSARY_DETAILS          [TERM_GUIDS contains GUID]
ASSETS (1) <──── (M) LINEAGE                   [START_GUID/RELATED_GUID]
ASSETS (1) <──── (M) TAGS                      [GUID = ASSET_GUID]
ASSETS (1) <──── (M) CUSTOM_METADATA           [GUID = ASSET_GUID]
```

## Categories

The dictionary covers these entity categories:

- **Gold Layer** - MDLH Gold views and relationships
- **Core** - Base entity types
- **Glossary** - Business glossary entities
- **Data Mesh** - Domains, products, stakeholders
- **Relational DB** - Database, schema, table, column entities
- **Query Org** - Query and collection entities
- **BI Tools** - Dashboard, report, chart entities
- **dbt** - dbt models, tests, sources
- **Object Storage** - S3, GCS, ADLS entities
- **Orchestration** - Airflow, Prefect, Dagster entities
- **Governance** - Policies, purposes, personas
- **AI/ML** - ML models, features, experiments

## Resources

- [Atlan Docs - Gold Layer Reference](https://docs.atlan.com/platform/lakehouse/references/gold-layer/)
- [Atlan Developer Portal](https://developer.atlan.com)

## License

MIT
