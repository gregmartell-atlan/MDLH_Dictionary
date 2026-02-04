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
        rankdir=TB;
        splines=ortho;
        nodesep=0.6;
        ranksep=1.0;
        bgcolor="transparent";
        node [shape=none, fontname="Helvetica", fontsize=9];
        edge [fontname="Helvetica", fontsize=8, color="#666666"];

        ASSETS [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#3366ff">
                <TR><TD COLSPAN="2" BGCOLOR="#3366ff"><FONT COLOR="white"><B>ASSETS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">PK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_TYPE</TD><TD BGCOLOR="white">Type</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_NAME</TD><TD BGCOLOR="white">Name</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">STATUS</TD><TD BGCOLOR="white">ACTIVE</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CONNECTOR_NAME</TD><TD BGCOLOR="white">Source</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">README_GUID</TD><TD BGCOLOR="white">FK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TERM_GUIDS</TD><TD BGCOLOR="white">FK[]</TD></TR>
            </TABLE>
        >];

        RELATIONAL [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#4CAF50">
                <TR><TD BGCOLOR="#4CAF50"><FONT COLOR="white"><B>RELATIONAL_ASSET_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">GUID (FK), TABLE_ROW_COUNT, COLUMN_DATATYPE</TD></TR>
            </TABLE>
        >];

        GLOSSARY [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#9C27B0">
                <TR><TD BGCOLOR="#9C27B0"><FONT COLOR="white"><B>GLOSSARY_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">GUID (FK), ANCHOR_GUID, ASSIGNED_ENTITIES</TD></TR>
            </TABLE>
        >];

        LINEAGE [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#FF9800">
                <TR><TD BGCOLOR="#FF9800"><FONT COLOR="white"><B>LINEAGE</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">START_GUID, RELATED_GUID, DIRECTION, LEVEL</TD></TR>
            </TABLE>
        >];

        TAGS [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#F44336">
                <TR><TD BGCOLOR="#F44336"><FONT COLOR="white"><B>TAGS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_GUID (FK), TAG_NAME, TAG_VALUE</TD></TR>
            </TABLE>
        >];

        CUSTOM_METADATA [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#E91E63">
                <TR><TD BGCOLOR="#E91E63"><FONT COLOR="white"><B>CUSTOM_METADATA</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_GUID (FK), ATTRIBUTE_NAME, ATTRIBUTE_VALUE</TD></TR>
            </TABLE>
        >];

        README [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#607D8B">
                <TR><TD BGCOLOR="#607D8B"><FONT COLOR="white"><B>README</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">GUID (PK), ASSET_GUID, DESCRIPTION</TD></TR>
            </TABLE>
        >];

        PIPELINE [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#00BCD4">
                <TR><TD BGCOLOR="#00BCD4"><FONT COLOR="white"><B>PIPELINE_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">GUID (FK), INPUT_GUIDS, OUTPUT_GUIDS</TD></TR>
            </TABLE>
        >];

        DATA_QUALITY [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#795548">
                <TR><TD BGCOLOR="#795548"><FONT COLOR="white"><B>DATA_QUALITY_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">GUID (FK), ANOMALO_STATUS, SODA_STATUS, MC_STATUS</TD></TR>
            </TABLE>
        >];

        DATA_MESH [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#FFC107">
                <TR><TD BGCOLOR="#FFC107"><FONT COLOR="black"><B>DATA_MESH_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">GUID (FK), DATA_DOMAIN, DATA_PRODUCTS, STAKEHOLDERS</TD></TR>
            </TABLE>
        >];

        ASSETS -> RELATIONAL [label="1:1"];
        ASSETS -> PIPELINE [label="1:1"];
        ASSETS -> DATA_QUALITY [label="1:1"];
        ASSETS -> DATA_MESH [label="1:1"];
        ASSETS -> README [label="1:1"];
        ASSETS -> GLOSSARY [label="1:M"];
        ASSETS -> LINEAGE [label="1:M"];
        ASSETS -> TAGS [label="1:M"];
        ASSETS -> CUSTOM_METADATA [label="1:M"];
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
                ("STATUS", "VARCHAR", "ACTIVE, archived, deleted"),
                ("CONNECTOR_NAME", "VARCHAR", "Snowflake, Redshift, Tableau, etc."),
                ("README_GUID", "VARCHAR", "FK → README.GUID"),
                ("TERM_GUIDS", "ARRAY", "FK → GLOSSARY_DETAILS"),
            ]
        },
        "RELATIONAL_ASSET_DETAILS": {
            "color": "#4CAF50",
            "description": "SQL assets: databases, schemas, tables, views, columns",
            "join_key": "GUID → ASSETS.GUID",
            "cardinality": "1:1 with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("TABLE_ROW_COUNT", "NUMBER", "Row count for tables"),
                ("TABLE_SIZE_BYTES", "NUMBER", "Storage size"),
                ("COLUMN_DATATYPE", "VARCHAR", "Column data type"),
                ("VIEW_DEFINITION", "VARCHAR", "SQL DDL for views"),
            ]
        },
        "GLOSSARY_DETAILS": {
            "color": "#9C27B0",
            "description": "Glossaries, categories, and business terms",
            "join_key": "GUID → ASSETS.GUID",
            "cardinality": "1:M with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("ANCHOR_GUID", "VARCHAR", "Parent glossary GUID"),
                ("ASSIGNED_ENTITIES", "ARRAY", "Assets linked to this term"),
                ("CATEGORIES", "ARRAY", "Category assignments"),
            ]
        },
        "LINEAGE": {
            "color": "#FF9800",
            "description": "Pre-computed lineage paths (upstream and downstream)",
            "join_key": "START_GUID, RELATED_GUID → ASSETS.GUID",
            "cardinality": "M:M",
            "columns": [
                ("DIRECTION", "VARCHAR", "UPSTREAM or DOWNSTREAM"),
                ("START_GUID", "VARCHAR", "Starting asset GUID"),
                ("RELATED_GUID", "VARCHAR", "Connected asset GUID"),
                ("LEVEL", "NUMBER", "Hop count / distance"),
                ("CONNECTING_GUID", "VARCHAR", "Process linking the assets"),
            ]
        },
        "TAGS": {
            "color": "#F44336",
            "description": "Classification tags assigned to assets",
            "join_key": "ASSET_GUID → ASSETS.GUID",
            "cardinality": "1:M",
            "columns": [
                ("ASSET_GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("TAG_NAME", "VARCHAR", "Classification name (e.g., PII)"),
                ("TAG_VALUE", "VARCHAR", "Tag value"),
                ("PROPAGATES", "BOOLEAN", "Whether tag propagates"),
            ]
        },
        "CUSTOM_METADATA": {
            "color": "#E91E63",
            "description": "Custom metadata attribute-value pairs",
            "join_key": "ASSET_GUID → ASSETS.GUID",
            "cardinality": "1:M",
            "columns": [
                ("ASSET_GUID", "VARCHAR", "FK → ASSETS.GUID"),
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
                ("GUID", "VARCHAR", "Primary key"),
                ("ASSET_GUID", "VARCHAR", "Linked asset GUID"),
                ("DESCRIPTION", "VARCHAR", "README content"),
                ("CREATED_BY", "VARCHAR", "Author"),
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
                ("ANOMALO_CHECK_STATUS", "VARCHAR", "Anomalo status"),
                ("SODA_CHECK_EVALUATION_STATUS", "VARCHAR", "Soda status"),
                ("MC_MONITOR_STATUS", "VARCHAR", "Monte Carlo status"),
            ]
        },
        "DATA_MESH_DETAILS": {
            "color": "#FFC107",
            "description": "Data mesh: domains, products, stakeholders",
            "join_key": "GUID → ASSETS.GUID",
            "cardinality": "1:1 with ASSETS",
            "columns": [
                ("GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("DATA_DOMAIN", "VARCHAR", "Domain GUID"),
                ("DATA_PRODUCTS", "ARRAY", "Product GUIDs"),
                ("STAKEHOLDERS", "ARRAY", "Stakeholder user GUIDs"),
                ("CRITICALITY", "VARCHAR", "Criticality level"),
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
