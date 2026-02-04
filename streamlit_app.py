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
        // Graph settings
        rankdir=TB;
        splines=ortho;
        nodesep=0.8;
        ranksep=1.2;
        bgcolor="transparent";

        // Node defaults
        node [
            shape=none,
            fontname="Helvetica",
            fontsize=10
        ];

        edge [
            fontname="Helvetica",
            fontsize=9,
            color="#666666"
        ];

        // ASSETS - Central table
        ASSETS [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="6" BGCOLOR="#3366ff">
                <TR><TD COLSPAN="2" BGCOLOR="#3366ff"><FONT COLOR="white"><B>ASSETS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">PK - Primary Key</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_TYPE</TD><TD BGCOLOR="white">Table, Column, Dashboard</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_NAME</TD><TD BGCOLOR="white">Display name</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_QUALIFIED_NAME</TD><TD BGCOLOR="white">Unique path</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">STATUS</TD><TD BGCOLOR="white">ACTIVE, archived</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CONNECTOR_NAME</TD><TD BGCOLOR="white">Snowflake, etc.</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">README_GUID</TD><TD BGCOLOR="white">FK → README</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TERM_GUIDS</TD><TD BGCOLOR="white">FK → GLOSSARY</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">POPULARITY_SCORE</TD><TD BGCOLOR="white">Usage metric</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">HAS_LINEAGE</TD><TD BGCOLOR="white">Boolean</TD></TR>
            </TABLE>
        >];

        // Detail tables
        RELATIONAL [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#4CAF50">
                <TR><TD COLSPAN="2" BGCOLOR="#4CAF50"><FONT COLOR="white"><B>RELATIONAL_ASSET_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">DATABASE_SCHEMAS</TD><TD BGCOLOR="white">Schema GUIDs</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TABLE_ROW_COUNT</TD><TD BGCOLOR="white">Row count</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TABLE_SIZE_BYTES</TD><TD BGCOLOR="white">Storage size</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">COLUMN_DATATYPE</TD><TD BGCOLOR="white">Data type</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">VIEW_DEFINITION</TD><TD BGCOLOR="white">SQL DDL</TD></TR>
            </TABLE>
        >];

        GLOSSARY [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#9C27B0">
                <TR><TD COLSPAN="2" BGCOLOR="#9C27B0"><FONT COLOR="white"><B>GLOSSARY_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_TYPE</TD><TD BGCOLOR="white">Glossary/Term/Category</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ANCHOR_GUID</TD><TD BGCOLOR="white">Parent glossary</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSIGNED_ENTITIES</TD><TD BGCOLOR="white">Linked assets</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CATEGORIES</TD><TD BGCOLOR="white">Category GUIDs</TD></TR>
            </TABLE>
        >];

        LINEAGE [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#FF9800">
                <TR><TD COLSPAN="2" BGCOLOR="#FF9800"><FONT COLOR="white"><B>LINEAGE</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">DIRECTION</TD><TD BGCOLOR="white">UPSTREAM/DOWNSTREAM</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>START_GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>RELATED_GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">LEVEL</TD><TD BGCOLOR="white">Hop count</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CONNECTING_GUID</TD><TD BGCOLOR="white">Process link</TD></TR>
            </TABLE>
        >];

        TAGS [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#F44336">
                <TR><TD COLSPAN="2" BGCOLOR="#F44336"><FONT COLOR="white"><B>TAGS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>ASSET_GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TAG_NAME</TD><TD BGCOLOR="white">Classification name</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TAG_VALUE</TD><TD BGCOLOR="white">Tag value</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">PROPAGATES</TD><TD BGCOLOR="white">Inheritance flag</TD></TR>
            </TABLE>
        >];

        CUSTOM_METADATA [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#E91E63">
                <TR><TD COLSPAN="2" BGCOLOR="#E91E63"><FONT COLOR="white"><B>CUSTOM_METADATA</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>ASSET_GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CUSTOM_METADATA_NAME</TD><TD BGCOLOR="white">CM set name</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ATTRIBUTE_NAME</TD><TD BGCOLOR="white">Attribute key</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ATTRIBUTE_VALUE</TD><TD BGCOLOR="white">Attribute value</TD></TR>
            </TABLE>
        >];

        README [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#607D8B">
                <TR><TD COLSPAN="2" BGCOLOR="#607D8B"><FONT COLOR="white"><B>README</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">PK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_GUID</TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">DESCRIPTION</TD><TD BGCOLOR="white">README content</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CREATED_BY</TD><TD BGCOLOR="white">Author</TD></TR>
            </TABLE>
        >];

        PIPELINE [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#00BCD4">
                <TR><TD COLSPAN="2" BGCOLOR="#00BCD4"><FONT COLOR="white"><B>PIPELINE_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">INPUT_GUIDS_TO_PROCESSES</TD><TD BGCOLOR="white">Input refs</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">OUTPUT_GUIDS_TO_PROCESSES</TD><TD BGCOLOR="white">Output refs</TD></TR>
            </TABLE>
        >];

        DATA_QUALITY [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#795548">
                <TR><TD COLSPAN="2" BGCOLOR="#795548"><FONT COLOR="white"><B>DATA_QUALITY_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ANOMALO_CHECK_STATUS</TD><TD BGCOLOR="white">Anomalo status</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">SODA_CHECK_STATUS</TD><TD BGCOLOR="white">Soda status</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">MC_MONITOR_STATUS</TD><TD BGCOLOR="white">Monte Carlo</TD></TR>
            </TABLE>
        >];

        DATA_MESH [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#FFC107">
                <TR><TD COLSPAN="2" BGCOLOR="#FFC107"><FONT COLOR="black"><B>DATA_MESH_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">FK → ASSETS</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">DATA_DOMAIN</TD><TD BGCOLOR="white">Domain GUID</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">DATA_PRODUCTS</TD><TD BGCOLOR="white">Product list</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CRITICALITY</TD><TD BGCOLOR="white">Priority level</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">STAKEHOLDERS</TD><TD BGCOLOR="white">Owner GUIDs</TD></TR>
            </TABLE>
        >];

        // Relationships
        ASSETS -> RELATIONAL [label="1:1\\nGUID=GUID", dir=both, arrowtail=none, arrowhead=normal];
        ASSETS -> GLOSSARY [label="1:M\\nTERM_GUIDS", dir=both, arrowtail=none, arrowhead=crow];
        ASSETS -> LINEAGE [label="1:M\\nSTART/RELATED_GUID", dir=both, arrowtail=none, arrowhead=crow];
        ASSETS -> TAGS [label="1:M\\nGUID=ASSET_GUID", dir=both, arrowtail=none, arrowhead=crow];
        ASSETS -> CUSTOM_METADATA [label="1:M\\nGUID=ASSET_GUID", dir=both, arrowtail=none, arrowhead=crow];
        ASSETS -> README [label="1:1\\nREADME_GUID=GUID", dir=both, arrowtail=none, arrowhead=normal];
        ASSETS -> PIPELINE [label="1:1\\nGUID=GUID", dir=both, arrowtail=none, arrowhead=normal];
        ASSETS -> DATA_QUALITY [label="1:1\\nGUID=GUID", dir=both, arrowtail=none, arrowhead=normal];
        ASSETS -> DATA_MESH [label="1:1\\nGUID=GUID", dir=both, arrowtail=none, arrowhead=normal];
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
                ("GUID", "VARCHAR", "Primary key - globally unique identifier"),
                ("ASSET_TYPE", "VARCHAR", "Type: Table, Column, Dashboard, etc."),
                ("ASSET_NAME", "VARCHAR", "Human-readable asset name"),
                ("ASSET_QUALIFIED_NAME", "VARCHAR", "Unique fully-qualified path"),
                ("DESCRIPTION", "VARCHAR", "Asset description"),
                ("STATUS", "VARCHAR", "ACTIVE, archived, deleted"),
                ("CONNECTOR_NAME", "VARCHAR", "Snowflake, Redshift, Tableau, etc."),
                ("CONNECTOR_QUALIFIED_NAME", "VARCHAR", "Connection path"),
                ("README_GUID", "VARCHAR", "FK → README.GUID"),
                ("TERM_GUIDS", "ARRAY", "FK → GLOSSARY_DETAILS (term links)"),
                ("OWNER_USERS", "ARRAY", "Assigned owner user IDs"),
                ("TAGS", "ARRAY", "Embedded tag references"),
                ("CUSTOM_METADATA", "ARRAY", "Embedded CM key-value pairs"),
                ("POPULARITY_SCORE", "FLOAT", "Usage/popularity metric"),
                ("HAS_LINEAGE", "BOOLEAN", "Whether asset has lineage"),
                ("CERTIFICATE_STATUS", "VARCHAR", "VERIFIED, DRAFT, etc."),
                ("CREATED_AT", "NUMBER", "Creation time (epoch ms)"),
                ("UPDATED_AT", "NUMBER", "Last update time (epoch ms)"),
            ]
        },
        "RELATIONAL_ASSET_DETAILS": {
            "color": "#4CAF50",
            "description": "SQL assets: databases, schemas, tables, views, columns, functions",
            "join_key": "GUID → ASSETS.GUID",
            "cardinality": "1:1 with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("DATABASE_SCHEMAS", "ARRAY", "Schema GUIDs within database"),
                ("SCHEMA_DATABASE_NAME", "VARCHAR", "Parent database reference"),
                ("SCHEMA_TABLES", "ARRAY", "Table GUIDs in schema"),
                ("SCHEMA_VIEWS", "ARRAY", "View GUIDs in schema"),
                ("TABLE_ROW_COUNT", "NUMBER", "Row count for tables"),
                ("TABLE_SIZE_BYTES", "NUMBER", "Storage size"),
                ("TABLE_COLUMN_COUNT", "NUMBER", "Number of columns"),
                ("TABLE_TOTAL_READ_COUNT", "NUMBER", "Query access count"),
                ("TABLE_RECENT_USERS", "ARRAY", "Recent accessor usernames"),
                ("COLUMN_DATATYPE", "VARCHAR", "Column data type"),
                ("COLUMN_IS_NULLABLE", "BOOLEAN", "Nullable constraint"),
                ("VIEW_DEFINITION", "VARCHAR", "SQL definition for views"),
                ("FUNCTION_LANGUAGE", "VARCHAR", "UDF language"),
                ("PROCEDURE_DEFINITION", "VARCHAR", "Stored proc code"),
            ]
        },
        "GLOSSARY_DETAILS": {
            "color": "#9C27B0",
            "description": "Glossaries, categories, and business terms",
            "join_key": "GUID → ASSETS.GUID, TERM_GUIDS contains GUID",
            "cardinality": "1:M with ASSETS (via TERM_GUIDS)",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("ASSET_TYPE", "VARCHAR", "Glossary, GlossaryTerm, GlossaryCategory"),
                ("ASSET_NAME", "VARCHAR", "Term or glossary name"),
                ("ANCHOR_GUID", "VARCHAR", "Parent glossary GUID"),
                ("CATEGORIES", "ARRAY", "Category assignments"),
                ("ASSIGNED_ENTITIES", "ARRAY", "Assets linked to this term"),
                ("TERMS", "ARRAY", "Terms within glossary/category"),
                ("README", "VARCHAR", "Documentation content"),
            ]
        },
        "LINEAGE": {
            "color": "#FF9800",
            "description": "Pre-computed lineage paths (upstream and downstream)",
            "join_key": "START_GUID, RELATED_GUID → ASSETS.GUID",
            "cardinality": "M:M (many lineage paths per asset)",
            "columns": [
                ("DIRECTION", "VARCHAR", "UPSTREAM or DOWNSTREAM"),
                ("START_GUID", "VARCHAR", "Starting asset GUID"),
                ("START_NAME", "VARCHAR", "Starting asset name"),
                ("START_TYPE", "VARCHAR", "Starting asset type"),
                ("RELATED_GUID", "VARCHAR", "Connected asset GUID"),
                ("RELATED_NAME", "VARCHAR", "Connected asset name"),
                ("RELATED_TYPE", "VARCHAR", "Connected asset type"),
                ("CONNECTING_GUID", "VARCHAR", "Process linking the assets"),
                ("LEVEL", "NUMBER", "Hop count / distance"),
            ]
        },
        "TAGS": {
            "color": "#F44336",
            "description": "Classification tags assigned to assets",
            "join_key": "ASSET_GUID → ASSETS.GUID",
            "cardinality": "1:M (many tags per asset)",
            "columns": [
                ("ASSET_GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("ASSET_NAME", "VARCHAR", "Asset name"),
                ("ASSET_TYPE", "VARCHAR", "Asset type"),
                ("TAG_GUID", "VARCHAR", "Tag definition GUID"),
                ("TAG_NAME", "VARCHAR", "Classification name (e.g., PII)"),
                ("TAG_VALUE", "VARCHAR", "Tag value if applicable"),
                ("TAG_CONNECTOR_NAME", "VARCHAR", "Source connector for tag"),
                ("PROPAGATES", "BOOLEAN", "Whether tag propagates"),
            ]
        },
        "CUSTOM_METADATA": {
            "color": "#E91E63",
            "description": "Custom metadata attribute-value pairs",
            "join_key": "ASSET_GUID → ASSETS.GUID",
            "cardinality": "1:M (many attributes per asset)",
            "columns": [
                ("ASSET_GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("ASSET_NAME", "VARCHAR", "Asset name"),
                ("ASSET_TYPE", "VARCHAR", "Asset type"),
                ("CUSTOM_METADATA_GUID", "VARCHAR", "CM definition GUID"),
                ("CUSTOM_METADATA_NAME", "VARCHAR", "CM set name"),
                ("ATTRIBUTE_NAME", "VARCHAR", "Attribute key"),
                ("ATTRIBUTE_VALUE", "VARCHAR", "Attribute value"),
            ]
        },
        "README": {
            "color": "#607D8B",
            "description": "README documentation for assets",
            "join_key": "GUID ← ASSETS.README_GUID",
            "cardinality": "1:1 with ASSETS",
            "columns": [
                ("ASSET_GUID", "VARCHAR", "Linked asset GUID"),
                ("ASSET_NAME", "VARCHAR", "Asset name"),
                ("ASSET_TYPE", "VARCHAR", "Asset type"),
                ("DESCRIPTION", "VARCHAR", "README content"),
                ("CREATED_AT", "NUMBER", "Creation time (epoch ms)"),
                ("CREATED_BY", "VARCHAR", "Author"),
                ("UPDATED_AT", "NUMBER", "Last update (epoch ms)"),
                ("UPDATED_BY", "VARCHAR", "Last editor"),
            ]
        },
        "PIPELINE_DETAILS": {
            "color": "#00BCD4",
            "description": "Orchestration and pipeline assets (Airflow, dbt, Matillion)",
            "join_key": "GUID → ASSETS.GUID",
            "cardinality": "1:1 with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("INPUT_GUIDS_TO_PROCESSES", "ARRAY", "Upstream input assets"),
                ("OUTPUT_GUIDS_TO_PROCESSES", "ARRAY", "Downstream output assets"),
            ]
        },
        "DATA_QUALITY_DETAILS": {
            "color": "#795548",
            "description": "Data quality checks (Anomalo, Soda, Monte Carlo)",
            "join_key": "GUID → ASSETS.GUID",
            "cardinality": "1:1 with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("SOURCE_URL", "VARCHAR", "DQ tool source URL"),
                ("ANOMALO_CHECK_TYPE", "VARCHAR", "Anomalo check type"),
                ("ANOMALO_CHECK_STATUS", "VARCHAR", "Anomalo status"),
                ("ANOMALO_CHECK_PRIORITY_LEVEL", "VARCHAR", "Priority"),
                ("SODA_CHECK_ID", "VARCHAR", "Soda check ID"),
                ("SODA_CHECK_EVALUATION_STATUS", "VARCHAR", "Soda status"),
                ("MC_MONITOR_ID", "VARCHAR", "Monte Carlo monitor ID"),
                ("MC_MONITOR_TYPE", "VARCHAR", "MC monitor type"),
                ("MC_MONITOR_STATUS", "VARCHAR", "MC status"),
            ]
        },
        "DATA_MESH_DETAILS": {
            "color": "#FFC107",
            "description": "Data mesh: domains, products, stakeholders",
            "join_key": "GUID → ASSETS.GUID",
            "cardinality": "1:1 with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("DATA_PRODUCTS", "ARRAY", "Product GUIDs in domain"),
                ("PARENT_DOMAIN", "VARCHAR", "Parent domain GUID"),
                ("SUBDOMAINS", "ARRAY", "Child domain GUIDs"),
                ("STAKEHOLDERS", "ARRAY", "Stakeholder user GUIDs"),
                ("DATA_PRODUCT_STATUS", "VARCHAR", "Product status"),
                ("CRITICALITY", "VARCHAR", "Criticality level"),
                ("SENSITIVITY", "VARCHAR", "Sensitivity classification"),
                ("VISIBILITY", "VARCHAR", "Visibility setting"),
                ("INPUT_PORT_GUIDS", "ARRAY", "Input ports"),
                ("OUTPUT_PORT_GUIDS", "ARRAY", "Output ports"),
            ]
        },
    }

st.set_page_config(
    page_title="MDLH Entity Dictionary",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown("""
<style>
:root {
    --atlan-blue: #3366ff;
    --atlan-blue-dark: #2952cc;
    --bg-subtle: #f8f9fa;
    --text-muted: #666;
}
h1, h2, h3 { letter-spacing: -0.01em; }
div.stDownloadButton > button, div.stButton > button {
    background: var(--atlan-blue);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.4rem 1rem;
}
div.stDownloadButton > button:hover, div.stButton > button:hover {
    background: var(--atlan-blue-dark);
}
section.main > div { padding-top: 1rem; }
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
    letter-spacing: 0.05em;
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
[data-testid="stSidebar"] .stButton > button {
    background: transparent;
    color: #333;
    text-align: left;
    justify-content: flex-start;
    padding: 0.5rem 0.75rem;
    width: 100%;
    border: none;
    font-weight: 500;
}
[data-testid="stSidebar"] .stButton > button:hover {
    background: #f0f0f0;
    color: #333;
}
[data-testid="stSidebar"] .stButton > button:focus {
    box-shadow: none;
}
</style>
""", unsafe_allow_html=True)


def load_data():
    if not DATA_PATH.exists():
        st.error("Missing streamlit_data.json. Run the export step first.")
        st.stop()
    with DATA_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def filter_entities(rows, search_term):
    if not rows:
        return []
    if not search_term or not search_term.strip():
        return rows
    search_lower = search_term.lower()
    filtered = []
    for row in rows:
        for value in row.values():
            if value is None:
                continue
            if search_lower in str(value).lower():
                filtered.append(row)
                break
    return filtered


def filter_queries(queries, search_term, category_filter=None):
    if not queries:
        return []
    result = queries
    if search_term and search_term.strip():
        search_lower = search_term.lower()
        result = [
            query
            for query in result
            if search_lower in query.get("title", "").lower()
            or search_lower in query.get("description", "").lower()
            or search_lower in query.get("query", "").lower()
        ]
    if category_filter and category_filter != "All Categories":
        result = [q for q in result if categorize_query(q.get("title", "")) == category_filter]
    return result


def categorize_query(title):
    """Categorize a query based on its title."""
    title_lower = title.lower()
    if any(w in title_lower for w in ["adoption", "popular", "usage", "read count", "recent users", "inventory"]):
        return "Adoption & Usage"
    if any(w in title_lower for w in ["owner", "tag", "governance", "compliance", "missing", "coverage", "export"]):
        return "Governance"
    if any(w in title_lower for w in ["glossary", "term", "readme", "documentation"]):
        return "Glossary & Docs"
    if any(w in title_lower for w in ["domain", "mesh", "product", "stakeholder"]):
        return "Data Mesh"
    if any(w in title_lower for w in ["lineage", "upstream", "downstream", "impact", "pipeline"]):
        return "Lineage & Impact"
    if any(w in title_lower for w in ["quality", "dq", "check", "stale"]):
        return "Data Quality"
    return "General"


def get_category_class(category):
    """Get CSS class for category (all use same monochrome style now)."""
    return "category-pill"


def find_query_for_entity(entity_name, table_name, queries):
    if not queries or not table_name or table_name == "(abstract)":
        return None
    table_lower = table_name.lower()
    entity_lower = entity_name.lower()

    for query in queries:
        query_lower = query.get("query", "").lower()
        if (
            f"from {table_lower}" in query_lower
            or f"from\n    {table_lower}" in query_lower
            or f"from\n{table_lower}" in query_lower
            or f"join {table_lower}" in query_lower
        ):
            return query
        if re.search(rf"\b{re.escape(table_lower)}\b", query_lower):
            return query

    for query in queries:
        title_lower = query.get("title", "").lower()
        if (
            entity_lower in title_lower
            or f"{entity_lower}s" in title_lower
            or f"{entity_lower} " in title_lower
        ):
            return query

    return None


def has_query_for_entity(entity_name, table_name, example_query, queries):
    if example_query:
        return True
    if not table_name or table_name == "(abstract)":
        return False
    return find_query_for_entity(entity_name, table_name, queries) is not None


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
    display_rows = []
    for row in rows:
        display_rows.append({headers.get(col, col): row.get(col, "") for col in columns})
    return display_rows


def render_metric_card(value, label):
    return f"""
    <div class="metric-card">
        <div class="metric-value">{value}</div>
        <div class="metric-label">{label}</div>
    </div>
    """


# Load data
data_bundle = load_data()
entity_data = data_bundle["data"]
example_queries = data_bundle["exampleQueries"]
columns = data_bundle["columns"]
col_headers = data_bundle["colHeaders"]

TABS = [
    {"id": "goldLayer", "label": "Gold Layer", "icon": "star"},
    {"id": "core", "label": "Core", "icon": "database"},
    {"id": "glossary", "label": "Glossary", "icon": "book_2"},
    {"id": "datamesh", "label": "Data Mesh", "icon": "hub"},
    {"id": "relational", "label": "Relational DB", "icon": "table_chart"},
    {"id": "queries", "label": "Query Org", "icon": "folder"},
    {"id": "bi", "label": "BI Tools", "icon": "bar_chart"},
    {"id": "dbt", "label": "dbt", "icon": "code"},
    {"id": "storage", "label": "Object Storage", "icon": "inventory_2"},
    {"id": "orchestration", "label": "Orchestration", "icon": "sync"},
    {"id": "governance", "label": "Governance", "icon": "shield"},
    {"id": "ai", "label": "AI/ML", "icon": "smart_toy"},
]

# Initialize session state for selected tab
if "selected_tab" not in st.session_state:
    st.session_state.selected_tab = "goldLayer"

# Sidebar
with st.sidebar:
    st.markdown(":material/database: **MDLH Dictionary**")
    st.markdown("---")

    # Category selection with Material Symbols
    for tab in TABS:
        is_active = st.session_state.selected_tab == tab["id"]
        btn_type = "primary" if is_active else "secondary"
        if st.button(
            f":material/{tab['icon']}: {tab['label']}",
            key=f"nav_{tab['id']}",
            use_container_width=True,
            type=btn_type,
        ):
            st.session_state.selected_tab = tab["id"]
            st.rerun()

    selected_tab = st.session_state.selected_tab

    st.markdown("---")

    # Quick stats
    total_entities = sum(len(entity_data.get(t["id"], [])) for t in TABS)
    total_queries = sum(len(example_queries.get(t["id"], [])) for t in TABS)

    col1, col2 = st.columns(2)
    with col1:
        st.metric("Entities", total_entities)
    with col2:
        st.metric("Queries", total_queries)

    st.markdown("---")
    st.caption("Resources")
    st.markdown("[Atlan Docs](https://docs.atlan.com)")
    st.markdown("[Developer Portal](https://developer.atlan.com)")
    st.markdown("---")
    st.caption("v1.1 · Gold Layer")

# Main content
st.title("Metadata Lakehouse Entity Dictionary")
st.markdown(
    "Reference guide for MDLH entity types, tables, attributes, and example queries."
)

header_cols = st.columns([3, 1, 1])
with header_cols[0]:
    search = st.text_input("Search", placeholder="Search entities and queries", label_visibility="collapsed")
with header_cols[1]:
    st.download_button(
        "Export all CSVs",
        data=build_zip(entity_data, columns, col_headers),
        file_name="mdlh_entity_dictionary.zip",
        mime="application/zip",
        use_container_width=True,
    )
with header_cols[2]:
    st.caption("Snowflake Streamlit ready")

st.markdown("---")

# Get selected tab info
tab = next(t for t in TABS if t["id"] == selected_tab)
tab_id = tab["id"]
tab_label = tab["label"]
rows = entity_data.get(tab_id, [])
queries = example_queries.get(tab_id, [])

# Special handling for Gold Layer tab
if tab_id == "goldLayer":
    # Quick reference cards
    st.subheader("Quick Reference")
    ref_cols = st.columns(5)
    with ref_cols[0]:
        st.markdown(render_metric_card("10", "Gold Views"), unsafe_allow_html=True)
    with ref_cols[1]:
        st.markdown(render_metric_card(str(len(queries)), "Example Queries"), unsafe_allow_html=True)
    with ref_cols[2]:
        st.markdown(render_metric_card("ASSETS", "Entry Point"), unsafe_allow_html=True)
    with ref_cols[3]:
        st.markdown(render_metric_card("GUID", "Join Key"), unsafe_allow_html=True)
    with ref_cols[4]:
        st.markdown(render_metric_card("ACTIVE", "Status Filter"), unsafe_allow_html=True)

    st.markdown("")
    st.info("**Best Practice:** Start queries with `FROM ASSETS WHERE STATUS = 'ACTIVE'`, then JOIN to detail views on GUID for specialized attributes.")

    st.markdown("---")

    # ERD Section
    st.subheader("Entity Relationship Diagram")

    erd_tab1, erd_tab2 = st.tabs(["Visual ERD", "Schema Details"])

    with erd_tab1:
        st.graphviz_chart(generate_gold_layer_erd(), use_container_width=True)
        st.caption("**ASSETS** is the central hub. All detail views join on GUID.")

        # Relationship summary
        st.markdown("##### Relationship Summary")
        rel_col1, rel_col2 = st.columns(2)
        with rel_col1:
            st.markdown("""
**1:1 Relationships (JOIN on GUID)**
- ASSETS → RELATIONAL_ASSET_DETAILS
- ASSETS → PIPELINE_DETAILS
- ASSETS → DATA_QUALITY_DETAILS
- ASSETS → DATA_MESH_DETAILS
- ASSETS → README (via README_GUID)
""")
        with rel_col2:
            st.markdown("""
**1:M Relationships**
- ASSETS → TAGS (GUID = ASSET_GUID)
- ASSETS → CUSTOM_METADATA (GUID = ASSET_GUID)
- ASSETS → GLOSSARY_DETAILS (TERM_GUIDS contains GUID)
- ASSETS → LINEAGE (START_GUID, RELATED_GUID)
""")

    with erd_tab2:
        schema_details = get_erd_schema_details()
        selected_view = st.selectbox(
            "Select a view to explore",
            list(schema_details.keys()),
            key="schema_view_selector"
        )

        if selected_view:
            view_info = schema_details[selected_view]
            st.markdown(f"""
<div style="background: {view_info['color']}; color: white; padding: 0.5rem 1rem; border-radius: 8px 8px 0 0;">
    <strong>{selected_view}</strong>
</div>
<div style="background: #f8f9fa; padding: 1rem; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none;">
    <p><strong>Description:</strong> {view_info['description']}</p>
    <p><strong>Join Key:</strong> <code>{view_info['join_key']}</code></p>
    <p><strong>Cardinality:</strong> {view_info['cardinality']}</p>
</div>
""", unsafe_allow_html=True)

            st.markdown("##### Columns")
            col_data = []
            for col_name, col_type, col_desc in view_info['columns']:
                col_data.append({
                    "Column": col_name,
                    "Type": col_type,
                    "Description": col_desc
                })
            st.dataframe(col_data, use_container_width=True)

            # Show example join
            if selected_view != "ASSETS":
                st.markdown("##### Example Join Pattern")
                if selected_view in ["TAGS", "CUSTOM_METADATA"]:
                    join_code = f"""SELECT a.ASSET_NAME, a.ASSET_TYPE, d.*
FROM ASSETS a
JOIN {selected_view} d ON a.GUID = d.ASSET_GUID
WHERE a.STATUS = 'ACTIVE';"""
                elif selected_view == "LINEAGE":
                    join_code = f"""SELECT a.ASSET_NAME AS start_name, l.RELATED_NAME, l.LEVEL
FROM ASSETS a
JOIN LINEAGE l ON a.GUID = l.START_GUID
WHERE a.STATUS = 'ACTIVE'
  AND l.DIRECTION = 'DOWNSTREAM';"""
                elif selected_view == "README":
                    join_code = f"""SELECT a.ASSET_NAME, r.DESCRIPTION AS readme_text
FROM ASSETS a
JOIN README r ON a.README_GUID = r.GUID
WHERE a.STATUS = 'ACTIVE';"""
                else:
                    join_code = f"""SELECT a.ASSET_NAME, a.ASSET_TYPE, d.*
FROM ASSETS a
JOIN {selected_view} d ON a.GUID = d.GUID
WHERE a.STATUS = 'ACTIVE';"""
                st.code(join_code, language="sql")

    st.markdown("---")

# Entity reference table
filtered_rows = filter_entities(rows, search)

if tab_id == "goldLayer":
    st.subheader("Gold Layer Views Reference")
else:
    st.subheader(f"{tab_label} Entities")

col1, col2 = st.columns([1, 5])
with col1:
    csv_text = rows_to_csv(filtered_rows, columns[tab_id], col_headers)
    st.download_button(
        "Export CSV",
        data=csv_text,
        file_name=f"mdlh_{tab_id}_entities.csv",
        mime="text/csv",
    )

display_rows = build_display_rows(filtered_rows, columns[tab_id], col_headers)
if display_rows:
    st.dataframe(display_rows, use_container_width=True)
else:
    st.info("No results found. Try adjusting your search terms.")

st.caption(
    f"Showing {len(filtered_rows)} of {len(rows)} {'views' if tab_id == 'goldLayer' else 'entities'} in {tab_label}."
)

st.markdown("---")

# Example queries section
st.subheader("Example Queries")

# Category filter for Gold Layer
if tab_id == "goldLayer" and queries:
    categories = sorted(set(categorize_query(q.get("title", "")) for q in queries))
    filter_cols = st.columns([2, 4])
    with filter_cols[0]:
        category_filter = st.selectbox(
            "Filter by category",
            ["All Categories"] + categories,
            key=f"cat_filter_{tab_id}",
        )
    with filter_cols[1]:
        # Show category legend
        st.markdown("**Categories:** ", unsafe_allow_html=True)
        legend_html = ""
        for cat in categories:
            css_class = get_category_class(cat)
            legend_html += f'<span class="category-pill {css_class}">{cat}</span>'
        st.markdown(legend_html, unsafe_allow_html=True)

    filtered_queries = filter_queries(queries, search, category_filter)
else:
    filtered_queries = filter_queries(queries, search)
    category_filter = None

# Entity-based query selector (for non-Gold Layer tabs)
if tab_id != "goldLayer":
    entity_with_queries = []
    for row in filtered_rows:
        example_query = row.get("exampleQuery")
        if has_query_for_entity(row.get("entity", ""), row.get("table", ""), example_query, queries):
            entity_with_queries.append(row)

    if entity_with_queries:
        entity_names = [row.get("entity", "") for row in entity_with_queries]
        selected_entity = st.selectbox(
            "Quick query by entity",
            ["Choose an entity"] + entity_names,
            key=f"entity_select_{tab_id}",
        )
        if selected_entity != "Choose an entity":
            row = next(
                (r for r in entity_with_queries if r.get("entity") == selected_entity),
                None,
            )
            if row:
                inline_query = row.get("exampleQuery")
                if inline_query:
                    st.code(inline_query, language="sql")
                else:
                    matched = find_query_for_entity(
                        row.get("entity", ""), row.get("table", ""), queries
                    )
                    if matched:
                        st.markdown(f"**{matched.get('title', 'Example query')}**")
                        st.caption(matched.get("description", ""))
                        st.code(matched.get("query", ""), language="sql")
                    else:
                        st.info("No related query found for this entity.")

# Query list
if filtered_queries:
    st.markdown(f"**{len(filtered_queries)} queries** {'in ' + category_filter if category_filter and category_filter != 'All Categories' else 'available'}")
    st.markdown("---")
    for idx, query in enumerate(filtered_queries, start=1):
        title = query.get("title", "Query")
        desc = query.get("description", "")
        category = categorize_query(title) if tab_id == "goldLayer" else ""

        expander_label = f"{idx}. {title} — {desc}"

        with st.expander(expander_label):
            if category:
                st.markdown(f'<span class="category-pill {get_category_class(category)}">{category}</span>', unsafe_allow_html=True)
            st.code(query.get("query", ""), language="sql")
elif queries:
    st.info("No queries matched your search or filter.")
else:
    st.info("No queries available for this category.")
