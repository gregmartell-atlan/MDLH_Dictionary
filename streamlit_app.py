import csv
import io
import json
import re
import zipfile
from pathlib import Path

import streamlit as st

APP_DIR = Path(__file__).resolve().parent
DATA_PATH = APP_DIR / "streamlit_data.json"


def generate_gold_layer_erd():
    """Generate Gold Layer ERD using Graphviz DOT notation."""
    return """
    digraph GoldLayerERD {
        rankdir=LR;
        splines=ortho;
        nodesep=0.4;
        ranksep=1.5;
        bgcolor="transparent";
        node [shape=none, fontname="Helvetica", fontsize=8];
        edge [fontname="Helvetica", fontsize=7, color="#666666"];

        ASSETS [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#3366ff">
                <TR><TD COLSPAN="2" BGCOLOR="#3366ff"><FONT COLOR="white"><B>ASSETS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">PK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_TYPE</TD><TD BGCOLOR="white">Table, Column, Dashboard</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_NAME</TD><TD BGCOLOR="white">Display name</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">QUALIFIED_NAME</TD><TD BGCOLOR="white">Unique path</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">DESCRIPTION</TD><TD BGCOLOR="white">Description</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">STATUS</TD><TD BGCOLOR="white">active/archived</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CONNECTOR_NAME</TD><TD BGCOLOR="white">Snowflake, etc.</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">README_GUID</TD><TD BGCOLOR="white">FK → README</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TERM_GUIDS</TD><TD BGCOLOR="white">FK[] → GLOSSARY</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">POPULARITY_SCORE</TD><TD BGCOLOR="white">Usage score</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">HAS_LINEAGE</TD><TD BGCOLOR="white">Boolean</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CERTIFICATE_STATUS</TD><TD BGCOLOR="white">Verified</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CREATED_AT/BY</TD><TD BGCOLOR="white">Audit</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">UPDATED_AT/BY</TD><TD BGCOLOR="white">Audit</TD></TR>
            </TABLE>
        >];

        RELATIONAL [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#4CAF50">
                <TR><TD COLSPAN="2" BGCOLOR="#4CAF50"><FONT COLOR="white"><B>RELATIONAL_ASSET_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_TYPE</TD><TD BGCOLOR="white">DB/Table/Column</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">DATABASE_SCHEMAS</TD><TD BGCOLOR="white">Schema GUIDs</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">SCHEMA_TABLES</TD><TD BGCOLOR="white">Table GUIDs</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TABLE_COLUMN_COUNT</TD><TD BGCOLOR="white"># columns</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TABLE_SIZE_BYTES</TD><TD BGCOLOR="white">Size</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TABLE_ROW_COUNT</TD><TD BGCOLOR="white">Rows</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">COLUMN_DATATYPE</TD><TD BGCOLOR="white">Data type</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">VIEW_DEFINITION</TD><TD BGCOLOR="white">DDL</TD></TR>
            </TABLE>
        >];

        GLOSSARY [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#9C27B0">
                <TR><TD COLSPAN="2" BGCOLOR="#9C27B0"><FONT COLOR="white"><B>GLOSSARY_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_TYPE</TD><TD BGCOLOR="white">Glossary/Term/Cat</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ANCHOR_GUID</TD><TD BGCOLOR="white">Parent glossary</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">PARENT_GUID</TD><TD BGCOLOR="white">Parent category</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSIGNED_ENTITIES</TD><TD BGCOLOR="white">Linked assets</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">POPULARITY_SCORE</TD><TD BGCOLOR="white">Score</TD></TR>
            </TABLE>
        >];

        LINEAGE [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#FF9800">
                <TR><TD COLSPAN="2" BGCOLOR="#FF9800"><FONT COLOR="white"><B>LINEAGE</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">GUID</TD><TD BGCOLOR="white">Process PK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>START_GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>END_GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">RELATED_GUID</TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">DIRECTION</TD><TD BGCOLOR="white">UP/DOWNSTREAM</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">LEVEL</TD><TD BGCOLOR="white">Hops</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">SQL_CODE</TD><TD BGCOLOR="white">SQL</TD></TR>
            </TABLE>
        >];

        TAGS [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#F44336">
                <TR><TD COLSPAN="2" BGCOLOR="#F44336"><FONT COLOR="white"><B>TAGS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>ASSET_GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_TYPE</TD><TD BGCOLOR="white">Asset type</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TAG_GUID</TD><TD BGCOLOR="white">Tag GUID</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TAG_NAME</TD><TD BGCOLOR="white">PII, etc.</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TAG_VALUE</TD><TD BGCOLOR="white">Enum value</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">PROPAGATE</TD><TD BGCOLOR="white">Boolean</TD></TR>
            </TABLE>
        >];

        CUSTOM_METADATA [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#E91E63">
                <TR><TD COLSPAN="2" BGCOLOR="#E91E63"><FONT COLOR="white"><B>CUSTOM_METADATA</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>ASSET_GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_TYPE</TD><TD BGCOLOR="white">Asset type</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CM_SET_NAME</TD><TD BGCOLOR="white">Set name</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ATTRIBUTE_NAME</TD><TD BGCOLOR="white">Key</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ATTRIBUTE_VALUE</TD><TD BGCOLOR="white">Value</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">STATUS</TD><TD BGCOLOR="white">active</TD></TR>
            </TABLE>
        >];

        README [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#607D8B">
                <TR><TD COLSPAN="2" BGCOLOR="#607D8B"><FONT COLOR="white"><B>README</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">PK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_TYPE</TD><TD BGCOLOR="white">Readme</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_NAME</TD><TD BGCOLOR="white">Name</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">DESCRIPTION</TD><TD BGCOLOR="white">Content</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">STATUS</TD><TD BGCOLOR="white">Status</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CREATED_AT/BY</TD><TD BGCOLOR="white">Audit</TD></TR>
            </TABLE>
        >];

        PIPELINE [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#00BCD4">
                <TR><TD COLSPAN="2" BGCOLOR="#00BCD4"><FONT COLOR="white"><B>PIPELINE_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_TYPE</TD><TD BGCOLOR="white">sql/fivetran</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ORCHESTRATION_TOOL</TD><TD BGCOLOR="white">Airflow</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">OUTPUT_FROM_PROCESS</TD><TD BGCOLOR="white">Outputs</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">VIEW_DEFINITION</TD><TD BGCOLOR="white">DDL</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">FUNCTION_LANGUAGE</TD><TD BGCOLOR="white">Language</TD></TR>
            </TABLE>
        >];

        DATA_QUALITY [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#795548">
                <TR><TD COLSPAN="2" BGCOLOR="#795548"><FONT COLOR="white"><B>DATA_QUALITY_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">SOURCE_URL</TD><TD BGCOLOR="white">DQ tool URL</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ANOMALO_CHECK_*</TD><TD BGCOLOR="white">Anomalo</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">SODA_CHECK_*</TD><TD BGCOLOR="white">Soda</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">MC_MONITOR_*</TD><TD BGCOLOR="white">Monte Carlo</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">DATA_PRODUCTS</TD><TD BGCOLOR="white">Products</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">STAKEHOLDERS</TD><TD BGCOLOR="white">Owners</TD></TR>
            </TABLE>
        >];

        DATA_MESH [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#FFC107">
                <TR><TD COLSPAN="2" BGCOLOR="#FFC107"><FONT COLOR="black"><B>DATA_MESH_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">DATA_DOMAIN</TD><TD BGCOLOR="white">Domain GUID</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">DATA_PRODUCTS</TD><TD BGCOLOR="white">Products</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">VISIBILITY</TD><TD BGCOLOR="white">Visibility</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CRITICALITY</TD><TD BGCOLOR="white">Priority</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">OUTPUT_PORT_GUIDS</TD><TD BGCOLOR="white">Ports</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">POLICIES</TD><TD BGCOLOR="white">Policies</TD></TR>
            </TABLE>
        >];

        ASSETS -> RELATIONAL [label="1:1\\nGUID=GUID"];
        ASSETS -> PIPELINE [label="1:1\\nGUID=GUID"];
        ASSETS -> DATA_QUALITY [label="1:1\\nGUID=GUID"];
        ASSETS -> DATA_MESH [label="1:1\\nGUID=GUID"];
        ASSETS -> README [label="1:1\\nREADME_GUID=GUID"];
        ASSETS -> GLOSSARY [label="1:M\\nTERM_GUIDS"];
        ASSETS -> LINEAGE [label="1:M\\nSTART/END_GUID"];
        ASSETS -> TAGS [label="1:M\\nGUID=ASSET_GUID"];
        ASSETS -> CUSTOM_METADATA [label="1:M\\nGUID=ASSET_GUID"];
    }
    """


def get_erd_schema_details():
    """Return detailed schema information for each Gold Layer view."""
    return {
        "ASSETS": {
            "color": "#3366ff",
            "description": "Core lookup table - primary entry point for all Gold layer queries",
            "join_key": "GUID (Primary Key)",
            "cardinality": "Central hub",
            "columns": [
                ("GUID", "VARCHAR", "PK - Primary Key"),
                ("ASSET_TYPE", "VARCHAR", "Type: Table, Column, Dashboard"),
                ("ASSET_NAME", "VARCHAR", "Asset display name"),
                ("QUALIFIED_NAME", "VARCHAR", "URL, unique path"),
                ("DESCRIPTION", "VARCHAR", "Description"),
                ("README_GUID", "VARCHAR", "FK → README"),
                ("STATUS", "VARCHAR", "active, archived, deleted"),
                ("CREATED_AT", "NUMBER", "Created time (epoch ms)"),
                ("CREATED_BY", "VARCHAR", "Creator"),
                ("UPDATED_AT", "NUMBER", "Update time (epoch ms)"),
                ("UPDATED_BY", "VARCHAR", "Updater"),
                ("CERTIFICATE_STATUS", "VARCHAR", "Verified"),
                ("CERTIFICATE_UPDATED_BY", "VARCHAR", "Cert updater"),
                ("CERTIFICATE_UPDATED_AT", "NUMBER", "Cert time"),
                ("CONNECTOR_NAME", "VARCHAR", "Snowflake, Redshift"),
                ("CONNECTION_SOURCE_NAME", "VARCHAR", "Connection path"),
                ("TENANT_CODE", "VARCHAR", "Tenant ID"),
                ("CHANGE_TYPE", "VARCHAR", "Insert/Update"),
                ("TERM_GUIDS", "ARRAY", "FK → GLOSSARY_DETAILS"),
                ("POPULARITY_SCORE", "FLOAT", "Usage score"),
                ("TAGS", "ARRAY", "Tag labels"),
                ("HAS_LINEAGE", "BOOLEAN", "Has lineage?"),
            ]
        },
        "RELATIONAL_ASSET_DETAILS": {
            "color": "#4CAF50",
            "description": "SQL assets: databases, schemas, tables, views, columns",
            "join_key": "GUID → ASSETS.GUID",
            "cardinality": "1:1 with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("ASSET_TYPE", "VARCHAR", "Database, Table, Column"),
                ("DATABASE_SCHEMAS", "ARRAY", "Schema GUIDs"),
                ("SCHEMA_DATABASE_NAME", "VARCHAR", "Parent database"),
                ("SCHEMA_TABLES", "ARRAY", "Table GUIDs"),
                ("SCHEMA_MATERIALIZED_VIEWS", "ARRAY", "MV GUIDs"),
                ("SCHEMA_PROCEDURES", "ARRAY", "Proc GUIDs"),
                ("TABLE_COLUMN_COUNT", "NUMBER", "# columns"),
                ("TABLE_SIZE_BYTES", "NUMBER", "Size"),
                ("TABLE_ROW_COUNT", "NUMBER", "Row count"),
                ("TABLE_INDEX_COUNT", "NUMBER", "Indexes"),
                ("TABLE_PARTITION_STRATEGY", "VARCHAR", "Strategy"),
                ("COLUMN_PARENT_TABLE", "VARCHAR", "Parent table"),
                ("COLUMN_DATATYPE", "VARCHAR", "Data type"),
                ("VIEW_DEFINITION", "VARCHAR", "DDL"),
            ]
        },
        "GLOSSARY_DETAILS": {
            "color": "#9C27B0",
            "description": "Glossaries, categories, and business terms",
            "join_key": "GUID → ASSETS.GUID, TERM_GUIDS contains GUID",
            "cardinality": "1:M with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("ASSET_TYPE", "VARCHAR", "Glossary, Term, Category"),
                ("QUALIFIED_NAME", "VARCHAR", "Qual name"),
                ("STATUS", "VARCHAR", "Status"),
                ("UPDATED_TIME", "NUMBER", "Updated"),
                ("UPDATED_BY", "VARCHAR", "Updater"),
                ("OWNER_BY", "VARCHAR", "Owner"),
                ("CREATED_TIME", "NUMBER", "Created"),
                ("CONNECTION_SOURCE_NAME", "VARCHAR", "Source"),
                ("POPULARITY_SCORE", "FLOAT", "Score"),
                ("PARENT_GUID", "ARRAY", "Parent"),
                ("README_GUID", "VARCHAR", "FK → README"),
                ("ANCHOR_GUID", "VARCHAR", "FK → Parent GUID"),
                ("ASSIGNED_ENTITIES", "ARRAY", "Linked assets"),
            ]
        },
        "LINEAGE": {
            "color": "#FF9800",
            "description": "Pre-computed lineage paths (upstream and downstream)",
            "join_key": "GUID = START_GUID or RELATED_GUID",
            "cardinality": "M:M",
            "columns": [
                ("GUID", "VARCHAR", "LINEAGEPROCESS PK"),
                ("START_GUID", "VARCHAR", "FK → ASSETS (source)"),
                ("END_GUID", "VARCHAR", "FK → ASSETS (target)"),
                ("ASSET_TYPE", "VARCHAR", "Type"),
                ("RELATED_GUID", "VARCHAR", "FK → ASSETS.Report"),
                ("SQL_CODE", "VARCHAR", "SQL"),
                ("CONNECTING_SQL", "VARCHAR", "Connecting SQL"),
                ("LEVEL", "NUMBER", "Hops/Levels"),
                ("DIRECTION", "VARCHAR", "UPSTREAM/DOWNSTREAM"),
            ]
        },
        "TAGS": {
            "color": "#F44336",
            "description": "Classification tags assigned to assets",
            "join_key": "GUID = ASSET_GUID",
            "cardinality": "1:M",
            "columns": [
                ("ASSET_GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("ASSET_TYPE", "VARCHAR", "Asset type"),
                ("TAG_GUID", "VARCHAR", "Tag GUID"),
                ("TAG_NAME", "VARCHAR", "PII, Confidential"),
                ("TAG_VALUE", "VARCHAR", "Enum value"),
                ("PROPAGATE", "BOOLEAN", "Propagated?"),
            ]
        },
        "CUSTOM_METADATA": {
            "color": "#E91E63",
            "description": "Custom metadata attribute-value pairs",
            "join_key": "GUID = ASSET_GUID",
            "cardinality": "1:M",
            "columns": [
                ("ASSET_GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("ASSET_TYPE", "VARCHAR", "Asset type"),
                ("CUSTOM_METADATA_SET", "VARCHAR", "CM set name"),
                ("CUSTOM_METADATA_NAME", "VARCHAR", "CM attribute name"),
                ("ATTRIBUTE_VALUE", "VARCHAR", "Field value"),
                ("STATUS", "VARCHAR", "active/inactive"),
            ]
        },
        "README": {
            "color": "#607D8B",
            "description": "README documentation for assets",
            "join_key": "README_GUID = GUID",
            "cardinality": "1:1 with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "PK"),
                ("ASSET_TYPE", "VARCHAR", "Readme"),
                ("ASSET_NAME", "VARCHAR", "Name"),
                ("DESCRIPTION", "VARCHAR", "Description"),
                ("STATUS", "VARCHAR", "Status"),
                ("CREATED_AT", "NUMBER", "Created"),
                ("UPDATED_AT", "NUMBER", "Updated"),
                ("UPDATED_BY", "VARCHAR", "Updater"),
                ("CREATED_BY", "VARCHAR", "Creator"),
            ]
        },
        "PIPELINE_DETAILS": {
            "color": "#00BCD4",
            "description": "Orchestration and pipeline assets (Airflow, dbt, Matillion, Fivetran)",
            "join_key": "GUID = GUID",
            "cardinality": "1:1 with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("ASSET_TYPE", "VARCHAR", "sql, storage, fivetran"),
                ("ORCHESTRATION_TOOL", "VARCHAR", "Airflow"),
                ("OUTPUT_FROM_PROCESS", "ARRAY", "Downstream outputs"),
                ("COLUMNS_TO_PULL", "ARRAY", "Pull columns"),
                ("COLUMNS_NULL_ALLOWED", "BOOLEAN", "Nulls allowed"),
                ("COLUMN_VIEW_NAME", "VARCHAR", "Parent view"),
                ("VIEW_COLUMNS", "VARCHAR", "Column Entity"),
                ("VIEW_DEFINITION", "VARCHAR", "DDL"),
                ("QUERY_BASE_QUERY_TEXT", "VARCHAR", "SQL text"),
                ("QUERY_GUID", "VARCHAR", "Query link"),
                ("FUNCTION_LANGUAGE", "VARCHAR", "Language"),
                ("FUNCTION_RETURN_TYPE", "VARCHAR", "Return type"),
                ("PROCEDURE_DEFINITION", "VARCHAR", "Info"),
            ]
        },
        "DATA_QUALITY_DETAILS": {
            "color": "#795548",
            "description": "Data quality checks (Anomalo, Soda, Monte Carlo)",
            "join_key": "ANCHOR_GUID = GUID",
            "cardinality": "1:1 with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("SOURCE_URL", "VARCHAR", "Source URL"),
                ("ANOMALY_CHECK_CATEGORY_TYPE", "VARCHAR", "Category"),
                ("DATA_PRODUCTS", "ARRAY", "Product Details"),
                ("STAKEHOLDERS", "ARRAY", "Stakeholder GUID"),
                ("ANOMALY_CHECK_PRIORITY_LEVEL", "VARCHAR", "Priority"),
                ("ANOMALY_CHECK_LAST_RUN_AT", "NUMBER", "Last run"),
                ("ANOMALY_CHECK_INCIDENT_COUNT", "NUMBER", "Incident count"),
                ("SODA_CHECK_ID", "VARCHAR", "Suite ID"),
                ("SODA_CHECK_EVALUATION_STATUS", "VARCHAR", "Status"),
                ("SODA_CHECK_LAST_SYNC_AT", "NUMBER", "Last sync"),
                ("MC_MONITOR_ID", "VARCHAR", "Monitor ID"),
                ("MC_MONITOR_SCHEDULE_TYPE", "VARCHAR", "Schedule"),
                ("MC_MONITOR_STATUS", "VARCHAR", "Status"),
                ("MC_MONITOR_TYPE", "VARCHAR", "Type"),
                ("MC_MONITOR_LAST_RUN_AT", "NUMBER", "Last run"),
                ("MC_MONITOR_RULE_CUSTOM_SQL", "VARCHAR", "Custom SQL"),
                ("MC_MONITOR_ASSETS", "ARRAY", "Assets"),
            ]
        },
        "DATA_MESH_DETAILS": {
            "color": "#FFC107",
            "description": "Data mesh: domains, products, stakeholders",
            "join_key": "GUID = GUID",
            "cardinality": "1:1 with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("DATA_PRODUCTS", "ARRAY", "Product Details"),
                ("VISIBILITY", "VARCHAR", "Visibility"),
                ("CRITICALITY", "VARCHAR", "Criticality"),
                ("OUTPUT_PORT_GUIDS", "ARRAY", "Output ports"),
                ("DATA_SCHEMA", "VARCHAR", "Domain GUID"),
                ("DATA_DOMAIN", "VARCHAR", "Data Domain"),
                ("PERSONA_TYPE", "VARCHAR", "Role"),
                ("POLICIES", "ARRAY", "Policies"),
                ("GIT_PLATFORM_URL", "VARCHAR", "URL"),
            ]
        },
    }


st.set_page_config(
    page_title="MDLH Entity Dictionary",
    layout="wide",
)

st.markdown("""
<style>
:root {
    --atlan-blue: #3366ff;
    --atlan-blue-dark: #2952cc;
    --bg-subtle: #f8f9fa;
    --text-muted: #666;
}
.metric-card {
    background: var(--bg-subtle);
    border-radius: 6px;
    padding: 1rem;
    text-align: center;
    border: 1px solid #e8e8e8;
}
.metric-value {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--atlan-blue);
}
.metric-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
}
.category-pill {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 500;
    margin-right: 0.25rem;
    background: #f0f0f0;
    color: #444;
    border: 1px solid #ddd;
}
</style>
""", unsafe_allow_html=True)


def load_data():
    if not DATA_PATH.exists():
        st.error("Missing streamlit_data.json.")
        st.stop()
    with DATA_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def filter_entities(rows, search_term):
    if not rows or not search_term or not search_term.strip():
        return rows if rows else []
    search_lower = search_term.lower()
    return [row for row in rows if any(search_lower in str(v).lower() for v in row.values() if v)]


def filter_queries(queries, search_term, category_filter=None):
    if not queries:
        return []
    result = queries
    if search_term and search_term.strip():
        search_lower = search_term.lower()
        result = [q for q in result if search_lower in q.get("title", "").lower() or search_lower in q.get("query", "").lower()]
    if category_filter and category_filter != "All Categories":
        result = [q for q in result if categorize_query(q.get("title", "")) == category_filter]
    return result


def categorize_query(title):
    title_lower = title.lower()
    if any(w in title_lower for w in ["adoption", "popular", "usage"]):
        return "Adoption"
    if any(w in title_lower for w in ["owner", "tag", "governance"]):
        return "Governance"
    if any(w in title_lower for w in ["glossary", "term", "readme"]):
        return "Glossary"
    if any(w in title_lower for w in ["lineage", "upstream", "downstream"]):
        return "Lineage"
    return "General"


def rows_to_csv(rows, columns, headers):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([headers.get(col, col) for col in columns])
    for row in rows:
        writer.writerow([row.get(col, "") for col in columns])
    return output.getvalue()


def build_zip(data, columns, headers):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
        for tab_id, rows in data.items():
            if tab_id in columns:
                csv_text = rows_to_csv(rows, columns[tab_id], headers)
                zipf.writestr(f"mdlh_{tab_id}_entities.csv", csv_text)
    buffer.seek(0)
    return buffer


def build_display_rows(rows, columns, headers):
    return [{headers.get(col, col): row.get(col, "") for col in columns} for row in rows]


def render_metric_card(value, label):
    return f'<div class="metric-card"><div class="metric-value">{value}</div><div class="metric-label">{label}</div></div>'


# Load data
data_bundle = load_data()
entity_data = data_bundle["data"]
example_queries = data_bundle["exampleQueries"]
columns = data_bundle["columns"]
col_headers = data_bundle["colHeaders"]

TABS = {
    "goldLayer": "Gold Layer",
    "core": "Core",
    "glossary": "Glossary",
    "datamesh": "Data Mesh",
    "relational": "Relational DB",
    "queries": "Query Org",
    "bi": "BI Tools",
    "dbt": "dbt",
    "storage": "Object Storage",
    "orchestration": "Orchestration",
    "governance": "Governance",
    "ai": "AI/ML",
}

# Sidebar
with st.sidebar:
    st.markdown("**MDLH Dictionary**")
    selected_tab = st.radio("", list(TABS.keys()), format_func=lambda x: TABS[x])

# Main content
st.title("Metadata Lakehouse Entity Dictionary")
st.markdown("Reference guide for MDLH entity types, tables, attributes, and example queries.")

header_cols = st.columns([3, 1, 1])
with header_cols[0]:
    search = st.text_input("Search", placeholder="Search entities and queries", label_visibility="collapsed")
with header_cols[1]:
    st.download_button("Export all CSVs", data=build_zip(entity_data, columns, col_headers), file_name="mdlh_entity_dictionary.zip", mime="application/zip", use_container_width=True)
with header_cols[2]:
    st.caption("Snowflake Streamlit ready")

st.markdown("---")

# Get selected tab info
tab_id = selected_tab
tab_label = TABS[selected_tab]
rows = entity_data.get(tab_id, [])
queries = example_queries.get(tab_id, [])

# Gold Layer special handling
if tab_id == "goldLayer":
    st.subheader("Quick Reference")
    ref_cols = st.columns(5)
    with ref_cols[0]:
        st.markdown(render_metric_card("10", "Gold Views"), unsafe_allow_html=True)
    with ref_cols[1]:
        st.markdown(render_metric_card(str(len(queries)), "Queries"), unsafe_allow_html=True)
    with ref_cols[2]:
        st.markdown(render_metric_card("ASSETS", "Entry Point"), unsafe_allow_html=True)
    with ref_cols[3]:
        st.markdown(render_metric_card("GUID", "Join Key"), unsafe_allow_html=True)
    with ref_cols[4]:
        st.markdown(render_metric_card("ACTIVE", "Status Filter"), unsafe_allow_html=True)

    st.info("**Best Practice:** Start queries with `FROM ASSETS WHERE STATUS = 'ACTIVE'`, then JOIN to detail views on GUID.")
    st.markdown("---")

    st.subheader("Entity Relationship Diagram")
    erd_tab1, erd_tab2 = st.tabs(["Visual ERD", "Schema Details"])

    with erd_tab1:
        st.graphviz_chart(generate_gold_layer_erd(), use_container_width=True)
        st.caption("**ASSETS** is the central hub. All detail views join on GUID.")

    with erd_tab2:
        schema_details = get_erd_schema_details()
        selected_view = st.selectbox("Select a view to explore", list(schema_details.keys()), key="schema_view_selector")
        if selected_view:
            view_info = schema_details[selected_view]
            st.markdown(f"**{selected_view}** - {view_info['description']}")
            st.markdown(f"Join Key: `{view_info['join_key']}` | Cardinality: {view_info['cardinality']}")
            col_data = [{"Column": c[0], "Type": c[1], "Description": c[2]} for c in view_info['columns']]
            st.dataframe(col_data, use_container_width=True)

    st.markdown("---")

# Entity table
filtered_rows = filter_entities(rows, search)
st.subheader(f"{tab_label} {'Views' if tab_id == 'goldLayer' else 'Entities'}")

col1, col2 = st.columns([1, 5])
with col1:
    csv_text = rows_to_csv(filtered_rows, columns[tab_id], col_headers)
    st.download_button("Export CSV", data=csv_text, file_name=f"mdlh_{tab_id}.csv", mime="text/csv")

display_rows = build_display_rows(filtered_rows, columns[tab_id], col_headers)
if display_rows:
    st.dataframe(display_rows, use_container_width=True)
else:
    st.info("No results found.")

st.caption(f"Showing {len(filtered_rows)} of {len(rows)} items.")
st.markdown("---")

# Queries section
st.subheader("Example Queries")

if tab_id == "goldLayer" and queries:
    categories = sorted(set(categorize_query(q.get("title", "")) for q in queries))
    category_filter = st.selectbox("Filter by category", ["All Categories"] + categories, key=f"cat_filter_{tab_id}")
    filtered_queries = filter_queries(queries, search, category_filter)
else:
    filtered_queries = filter_queries(queries, search)

if filtered_queries:
    st.markdown(f"**{len(filtered_queries)} queries available**")
    for idx, query in enumerate(filtered_queries, start=1):
        with st.expander(f"{idx}. {query.get('title', 'Query')} — {query.get('description', '')}"):
            st.code(query.get("query", ""), language="sql")
elif queries:
    st.info("No queries matched your search.")
else:
    st.info("No queries available for this category.")
