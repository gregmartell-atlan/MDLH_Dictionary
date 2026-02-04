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
        nodesep=0.8;
        ranksep=1.2;
        bgcolor="transparent";
        node [shape=none, fontname="Helvetica", fontsize=10];
        edge [fontname="Helvetica", fontsize=9, color="#666666"];

        ASSETS [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="6" BGCOLOR="#3366ff">
                <TR><TD COLSPAN="2" BGCOLOR="#3366ff"><FONT COLOR="white"><B>ASSETS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">PK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_TYPE</TD><TD BGCOLOR="white">Table, Column, etc.</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ASSET_NAME</TD><TD BGCOLOR="white">Display name</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">STATUS</TD><TD BGCOLOR="white">ACTIVE, archived</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">CONNECTOR_NAME</TD><TD BGCOLOR="white">Snowflake, etc.</TD></TR>
            </TABLE>
        >];

        RELATIONAL [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#4CAF50">
                <TR><TD COLSPAN="2" BGCOLOR="#4CAF50"><FONT COLOR="white"><B>RELATIONAL_ASSET_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">FK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TABLE_ROW_COUNT</TD><TD BGCOLOR="white">Row count</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">COLUMN_DATATYPE</TD><TD BGCOLOR="white">Data type</TD></TR>
            </TABLE>
        >];

        GLOSSARY [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#9C27B0">
                <TR><TD COLSPAN="2" BGCOLOR="#9C27B0"><FONT COLOR="white"><B>GLOSSARY_DETAILS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>GUID</B></TD><TD BGCOLOR="white">FK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ANCHOR_GUID</TD><TD BGCOLOR="white">Parent</TD></TR>
            </TABLE>
        >];

        LINEAGE [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#FF9800">
                <TR><TD COLSPAN="2" BGCOLOR="#FF9800"><FONT COLOR="white"><B>LINEAGE</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">START_GUID</TD><TD BGCOLOR="white">FK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">RELATED_GUID</TD><TD BGCOLOR="white">FK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">LEVEL</TD><TD BGCOLOR="white">Hop count</TD></TR>
            </TABLE>
        >];

        TAGS [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#F44336">
                <TR><TD COLSPAN="2" BGCOLOR="#F44336"><FONT COLOR="white"><B>TAGS</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>ASSET_GUID</B></TD><TD BGCOLOR="white">FK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">TAG_NAME</TD><TD BGCOLOR="white">Name</TD></TR>
            </TABLE>
        >];

        CUSTOM_METADATA [label=<
            <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#E91E63">
                <TR><TD COLSPAN="2" BGCOLOR="#E91E63"><FONT COLOR="white"><B>CUSTOM_METADATA</B></FONT></TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT"><B>ASSET_GUID</B></TD><TD BGCOLOR="white">FK</TD></TR>
                <TR><TD BGCOLOR="white" ALIGN="LEFT">ATTRIBUTE_NAME</TD><TD BGCOLOR="white">Key</TD></TR>
            </TABLE>
        >];

        ASSETS -> RELATIONAL [label="1:1"];
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
            ]
        },
        "LINEAGE": {
            "color": "#FF9800",
            "description": "Pre-computed lineage paths",
            "join_key": "START_GUID, RELATED_GUID → ASSETS.GUID",
            "cardinality": "M:M",
            "columns": [
                ("DIRECTION", "VARCHAR", "UPSTREAM or DOWNSTREAM"),
                ("START_GUID", "VARCHAR", "Starting asset GUID"),
                ("RELATED_GUID", "VARCHAR", "Connected asset GUID"),
                ("LEVEL", "NUMBER", "Hop count / distance"),
            ]
        },
        "TAGS": {
            "color": "#F44336",
            "description": "Classification tags assigned to assets",
            "join_key": "ASSET_GUID → ASSETS.GUID",
            "cardinality": "1:M",
            "columns": [
                ("ASSET_GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("TAG_NAME", "VARCHAR", "Classification name"),
                ("TAG_VALUE", "VARCHAR", "Tag value"),
            ]
        },
        "CUSTOM_METADATA": {
            "color": "#E91E63",
            "description": "Custom metadata attribute-value pairs",
            "join_key": "ASSET_GUID → ASSETS.GUID",
            "cardinality": "1:M",
            "columns": [
                ("ASSET_GUID", "VARCHAR", "FK → ASSETS.GUID"),
                ("ATTRIBUTE_NAME", "VARCHAR", "Attribute key"),
                ("ATTRIBUTE_VALUE", "VARCHAR", "Attribute value"),
            ]
        },
    }


st.set_page_config(
    page_title="MDLH Entity Dictionary",
    layout="wide",
    initial_sidebar_state="expanded",
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

TABS = [
    {"id": "goldLayer", "label": "Gold Layer", "icon": "★"},
    {"id": "core", "label": "Core", "icon": "◉"},
    {"id": "glossary", "label": "Glossary", "icon": "◈"},
    {"id": "datamesh", "label": "Data Mesh", "icon": "⬡"},
    {"id": "relational", "label": "Relational DB", "icon": "▤"},
    {"id": "queries", "label": "Query Org", "icon": "▷"},
    {"id": "bi", "label": "BI Tools", "icon": "▥"},
    {"id": "dbt", "label": "dbt", "icon": "◇"},
    {"id": "storage", "label": "Object Storage", "icon": "▣"},
    {"id": "orchestration", "label": "Orchestration", "icon": "⟳"},
    {"id": "governance", "label": "Governance", "icon": "△"},
    {"id": "ai", "label": "AI/ML", "icon": "◎"},
]

# Initialize session state
if "selected_tab" not in st.session_state:
    st.session_state.selected_tab = "goldLayer"

# Sidebar
with st.sidebar:
    st.markdown("◉ **MDLH Dictionary**")
    st.markdown("---")

    for tab in TABS:
        is_active = st.session_state.selected_tab == tab["id"]
        btn_type = "primary" if is_active else "secondary"
        if st.button(f"{tab['icon']} {tab['label']}", key=f"nav_{tab['id']}", use_container_width=True, type=btn_type):
            st.session_state.selected_tab = tab["id"]
            st.experimental_rerun()

    selected_tab = st.session_state.selected_tab
    st.markdown("---")
    st.caption("v1.1 · Gold Layer")

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
tab = next(t for t in TABS if t["id"] == selected_tab)
tab_id = tab["id"]
tab_label = tab["label"]
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
