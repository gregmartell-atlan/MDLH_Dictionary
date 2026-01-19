#!/usr/bin/env python3
"""
End-to-End Field Presence Check Script

This script performs a comprehensive validation of field mappings across:
1. Backend MDLH canonical fields (mdlh_tenant_config.py)
2. Snowflake MDLH tables in multiple schemas

Usage:
    python scripts/field_presence_check.py

Requirements:
    - Active Snowflake session via the backend
    - Backend server running on localhost:8000
"""

import requests
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from collections import defaultdict

# Configuration
API_BASE_URL = "http://localhost:8000"

# Schemas to test
TEST_SCHEMAS = [
    {"database": "ATLAN_GOLD", "schema": "PUBLIC"},
    {"database": "WIDE_WORLD_IMPORTERS", "schema": "PROCESSED_GOLD"},
]

# Primary tables to check for presence
PRIMARY_TABLES = ["ASSETS", "ASSET", "GOLD_ASSETS", "TABLE_ENTITY", "ALL_ASSETS"]

# Complete field catalog from both backend and frontend
UNIFIED_FIELD_CATALOG = {
    # Identity fields
    "guid": {
        "displayName": "GUID",
        "category": "identity",
        "mdlhColumns": ["GUID"],
        "atlanAttribute": "guid",
    },
    "name": {
        "displayName": "Name",
        "category": "identity", 
        "mdlhColumns": ["ASSET_NAME", "NAME"],
        "atlanAttribute": "name",
    },
    "asset_type": {
        "displayName": "Asset Type",
        "category": "identity",
        "mdlhColumns": ["ASSET_TYPE", "TYPE_NAME", "TYPENAME"],
        "atlanAttribute": "typeName",
    },
    "qualified_name": {
        "displayName": "Qualified Name",
        "category": "identity",
        "mdlhColumns": ["ASSET_QUALIFIED_NAME", "QUALIFIED_NAME", "QUALIFIEDNAME"],
        "atlanAttribute": "qualifiedName",
    },
    "status": {
        "displayName": "Status",
        "category": "identity",
        "mdlhColumns": ["STATUS"],
        "atlanAttribute": "__state",
    },
    "connector_name": {
        "displayName": "Connector Name",
        "category": "identity",
        "mdlhColumns": ["CONNECTOR_NAME", "CONNECTORNAME"],
        "atlanAttribute": "connectorName",
    },
    
    # Ownership fields
    "owner_users": {
        "displayName": "Owner Users",
        "category": "ownership",
        "mdlhColumns": ["OWNER_USERS", "OWNERUSERS"],
        "atlanAttribute": "ownerUsers",
    },
    "owner_groups": {
        "displayName": "Owner Groups",
        "category": "ownership",
        "mdlhColumns": ["OWNER_GROUPS", "OWNERGROUPS"],
        "atlanAttribute": "ownerGroups",
    },
    "admin_users": {
        "displayName": "Admin Users",
        "category": "ownership",
        "mdlhColumns": ["ADMIN_USERS", "ADMINUSERS"],
        "atlanAttribute": "adminUsers",
    },
    "admin_groups": {
        "displayName": "Admin Groups",
        "category": "ownership",
        "mdlhColumns": ["ADMIN_GROUPS", "ADMINGROUPS"],
        "atlanAttribute": "adminGroups",
    },
    
    # Documentation fields
    "description": {
        "displayName": "Description",
        "category": "documentation",
        "mdlhColumns": ["DESCRIPTION", "USER_DESCRIPTION", "USERDESCRIPTION"],
        "atlanAttribute": "description",
    },
    "readme": {
        "displayName": "README",
        "category": "documentation",
        "mdlhColumns": ["README", "README_GUID", "READMEGUID"],
        "atlanAttribute": "readme",
    },
    "glossary_terms": {
        "displayName": "Glossary Terms",
        "category": "documentation",
        "mdlhColumns": ["TERM_GUIDS", "TERMGUIDS", "MEANINGS", "ASSIGNEDTERMS"],
        "atlanAttribute": "meanings",
    },
    
    # Lineage fields
    "has_lineage": {
        "displayName": "Has Lineage",
        "category": "lineage",
        "mdlhColumns": ["HAS_LINEAGE", "HASLINEAGE", "__HASLINEAGE"],
        "atlanAttribute": "__hasLineage",
    },
    "is_primary_key": {
        "displayName": "Is Primary Key",
        "category": "lineage",
        "mdlhColumns": ["IS_PRIMARY_KEY", "ISPRIMARYKEY"],
        "atlanAttribute": "isPrimary",
    },
    "is_foreign_key": {
        "displayName": "Is Foreign Key",
        "category": "lineage",
        "mdlhColumns": ["IS_FOREIGN_KEY", "ISFOREIGNKEY"],
        "atlanAttribute": "isForeign",
    },
    
    # Governance fields
    "tags": {
        "displayName": "Tags",
        "category": "governance",
        "mdlhColumns": ["TAGS", "CLASSIFICATIONNAMES", "CLASSIFICATION_NAMES"],
        "atlanAttribute": "classificationNames",
    },
    "certificate_status": {
        "displayName": "Certificate Status",
        "category": "governance",
        "mdlhColumns": ["CERTIFICATE_STATUS", "CERTIFICATESTATUS"],
        "atlanAttribute": "certificateStatus",
    },
    "certificate_message": {
        "displayName": "Certificate Message",
        "category": "governance",
        "mdlhColumns": ["CERTIFICATE_STATUS_MESSAGE", "CERTIFICATESTATUSMESSAGE"],
        "atlanAttribute": "certificateStatusMessage",
    },
    "policy_count": {
        "displayName": "Policy Count",
        "category": "governance",
        "mdlhColumns": ["ASSET_POLICIES_COUNT", "ASSETPOLICIESCOUNT"],
        "atlanAttribute": "assetPoliciesCount",
    },
    
    # Quality fields
    "dq_soda_status": {
        "displayName": "Soda DQ Status",
        "category": "quality",
        "mdlhColumns": ["ASSET_SODA_DQ_STATUS", "ASSETSODADQSTATUS"],
        "atlanAttribute": "assetSodaDQStatus",
    },
    "mc_is_monitored": {
        "displayName": "Monte Carlo Monitored",
        "category": "quality",
        "mdlhColumns": ["ASSET_MC_IS_MONITORED", "ASSETMCISMONITORED"],
        "atlanAttribute": "assetMcIsMonitored",
    },
    
    # Usage fields
    "popularity_score": {
        "displayName": "Popularity Score",
        "category": "usage",
        "mdlhColumns": ["POPULARITY_SCORE", "POPULARITYSCORE"],
        "atlanAttribute": "popularityScore",
    },
    "query_count": {
        "displayName": "Query Count",
        "category": "usage",
        "mdlhColumns": ["QUERY_COUNT", "QUERYCOUNT"],
        "atlanAttribute": "queryCount",
    },
    "query_user_count": {
        "displayName": "Query User Count",
        "category": "usage",
        "mdlhColumns": ["QUERY_USER_COUNT", "QUERYUSERCOUNT"],
        "atlanAttribute": "queryUserCount",
    },
    
    # Hierarchy fields
    "connection_qualified_name": {
        "displayName": "Connection Qualified Name",
        "category": "hierarchy",
        "mdlhColumns": ["CONNECTION_QUALIFIED_NAME", "CONNECTIONQUALIFIEDNAME"],
        "atlanAttribute": "connectionQualifiedName",
    },
    "database_qualified_name": {
        "displayName": "Database Qualified Name",
        "category": "hierarchy",
        "mdlhColumns": ["DATABASE_QUALIFIED_NAME", "DATABASEQUALIFIEDNAME"],
        "atlanAttribute": "databaseQualifiedName",
    },
    "schema_qualified_name": {
        "displayName": "Schema Qualified Name",
        "category": "hierarchy",
        "mdlhColumns": ["SCHEMA_QUALIFIED_NAME", "SCHEMAQUALIFIEDNAME"],
        "atlanAttribute": "schemaQualifiedName",
    },
    "domain_guids": {
        "displayName": "Domain GUIDs",
        "category": "hierarchy",
        "mdlhColumns": ["DOMAIN_GUIDS", "DOMAINGUIDS", "__DOMAINGUIDS"],
        "atlanAttribute": "domainGUIDs",
    },
    
    # Lifecycle fields
    "created_at": {
        "displayName": "Created At",
        "category": "lifecycle",
        "mdlhColumns": ["CREATE_TIME", "CREATETIME", "__TIMESTAMP"],
        "atlanAttribute": "__timestamp",
    },
    "updated_at": {
        "displayName": "Updated At",
        "category": "lifecycle",
        "mdlhColumns": ["UPDATE_TIME", "UPDATETIME", "__MODIFICATIONTIMESTAMP"],
        "atlanAttribute": "__modificationTimestamp",
    },
}


@dataclass
class FieldPresenceResult:
    field_id: str
    display_name: str
    category: str
    expected_columns: List[str]
    matched_column: Optional[str]
    found: bool
    data_type: Optional[str] = None
    populated_count: int = 0
    total_count: int = 0
    coverage_percent: float = 0.0


def get_session_id() -> Optional[str]:
    """Get active session ID from backend."""
    try:
        # First try the sessions endpoint with full IDs
        resp = requests.get(f"{API_BASE_URL}/api/sessions?include_full_ids=true", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            sessions = data.get("sessions", [])
            if sessions:
                # Get the most recently used session (lowest idle_seconds)
                sorted_sessions = sorted(sessions, key=lambda s: s.get("idle_seconds", 9999))
                session_id = sorted_sessions[0].get("session_id")
                if session_id and "..." not in session_id:
                    return session_id
        
        # Fallback: try session status with header
        resp = requests.get(f"{API_BASE_URL}/api/session/status", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("valid"):
                return data.get("sessionId")
    except Exception as e:
        print(f"Error getting session: {e}")
    return None


def discover_schema(session_id: str, database: str, schema: str) -> Dict[str, Any]:
    """Discover schema using the backend API."""
    try:
        resp = requests.get(
            f"{API_BASE_URL}/api/tenant-config/schema",
            params={"database": database, "schema": schema},
            headers={"X-Session-ID": session_id},
            timeout=60,
        )
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"Error discovering schema: {resp.status_code} - {resp.text}")
            return {}
    except Exception as e:
        print(f"Exception discovering schema: {e}")
        return {}


def execute_query(session_id: str, sql: str, database: str, schema: str) -> Dict[str, Any]:
    """Execute a query via the backend and fetch results."""
    try:
        # Execute the query
        resp = requests.post(
            f"{API_BASE_URL}/api/query/execute",
            json={
                "sql": sql,
                "database": database,
                "schema_name": schema,
                "timeout": 60,
            },
            headers={"X-Session-ID": session_id},
            timeout=120,
        )
        if resp.status_code != 200:
            return {"error": f"{resp.status_code}: {resp.text}"}
        
        exec_result = resp.json()
        query_id = exec_result.get("query_id")
        
        if exec_result.get("status") != "SUCCESS" or not query_id:
            return {"error": exec_result.get("message", "Query failed")}
        
        # Fetch the results
        resp = requests.get(
            f"{API_BASE_URL}/api/query/{query_id}/results",
            params={"page": 1, "page_size": 1000},
            headers={"X-Session-ID": session_id},
            timeout=30,
        )
        if resp.status_code != 200:
            return {"error": f"Failed to fetch results: {resp.status_code}"}
        
        results = resp.json()
        
        # Convert to dict rows for easier access
        columns = results.get("columns", [])
        raw_rows = results.get("rows", [])
        dict_rows = []
        for row in raw_rows:
            dict_rows.append(dict(zip(columns, row)))
        
        return {"rows": dict_rows, "columns": columns, "row_count": len(dict_rows)}
        
    except Exception as e:
        return {"error": str(e)}


def find_primary_table(schema_data: Dict[str, Any]) -> Optional[str]:
    """Find the primary assets table in the schema."""
    tables = schema_data.get("tables", [])
    table_names = [t["name"].upper() for t in tables]
    
    for candidate in PRIMARY_TABLES:
        if candidate.upper() in table_names:
            # Return the actual case from the schema
            for t in tables:
                if t["name"].upper() == candidate.upper():
                    return t["name"]
    
    # If no exact match, look for tables containing "ASSET"
    for t in tables:
        if "ASSET" in t["name"].upper():
            return t["name"]
    
    return None


def check_field_presence(
    columns: List[Dict[str, Any]],
    field_def: Dict[str, Any]
) -> FieldPresenceResult:
    """Check if a field's expected columns exist in the table."""
    expected_cols = field_def.get("mdlhColumns", [])
    column_map = {c["name"].upper(): c for c in columns}
    
    matched_column = None
    data_type = None
    
    for expected in expected_cols:
        expected_upper = expected.upper()
        if expected_upper in column_map:
            matched_column = expected_upper
            data_type = column_map[expected_upper].get("type")
            break
    
    return FieldPresenceResult(
        field_id="",  # Will be set by caller
        display_name=field_def.get("displayName", ""),
        category=field_def.get("category", ""),
        expected_columns=expected_cols,
        matched_column=matched_column,
        found=matched_column is not None,
        data_type=data_type,
    )


def build_coverage_query(
    table_fqn: str,
    column_mappings: Dict[str, str]
) -> str:
    """Build a query to check population coverage for each field."""
    count_expressions = []
    
    # Array columns need ARRAY_SIZE check
    array_columns = {
        "OWNER_USERS", "OWNERUSERS", "OWNER_GROUPS", "OWNERGROUPS",
        "TAGS", "CLASSIFICATIONNAMES", "TERM_GUIDS", "TERMGUIDS",
        "ADMIN_USERS", "ADMINUSERS", "ADMIN_GROUPS", "ADMINGROUPS",
        "DOMAIN_GUIDS", "DOMAINGUIDS"
    }
    
    # Boolean columns need = TRUE check
    boolean_columns = {"HAS_LINEAGE", "HASLINEAGE", "__HASLINEAGE"}
    
    # Numeric columns just need IS NOT NULL
    numeric_columns = {"POPULARITY_SCORE", "POPULARITYSCORE", "QUERY_COUNT", "QUERYCOUNT", 
                       "QUERY_USER_COUNT", "QUERYUSERCOUNT", "ASSETPOLICIESCOUNT", "ASSET_POLICIES_COUNT"}
    
    for field_id, column_name in column_mappings.items():
        col_upper = column_name.upper()
        
        if col_upper in array_columns:
            expr = f"COUNT_IF({column_name} IS NOT NULL AND ARRAY_SIZE({column_name}) > 0) AS \"{field_id}\""
        elif col_upper in boolean_columns:
            expr = f"COUNT_IF({column_name} = TRUE) AS \"{field_id}\""
        elif col_upper in numeric_columns:
            expr = f"COUNT_IF({column_name} IS NOT NULL) AS \"{field_id}\""
        else:
            # String columns: check for non-null and non-empty
            expr = f"COUNT_IF({column_name} IS NOT NULL AND CAST({column_name} AS VARCHAR) <> '') AS \"{field_id}\""
        
        count_expressions.append(expr)
    
    if not count_expressions:
        return None
    
    return f"""
SELECT
    COUNT(*) AS total_count,
    {','.join(count_expressions)}
FROM {table_fqn}
WHERE STATUS = 'ACTIVE'
"""


def run_presence_check(session_id: str, database: str, schema: str) -> Dict[str, Any]:
    """Run full presence check for a schema."""
    print(f"\n{'='*60}")
    print(f"CHECKING: {database}.{schema}")
    print(f"{'='*60}")
    
    # Step 1: Discover schema
    print("\n[1/4] Discovering schema...")
    schema_data = discover_schema(session_id, database, schema)
    
    if not schema_data.get("tables"):
        print(f"  ERROR: No tables found in {database}.{schema}")
        return {"error": "No tables found", "database": database, "schema": schema}
    
    print(f"  Found {len(schema_data['tables'])} tables")
    
    # Step 2: Find primary table
    print("\n[2/4] Finding primary assets table...")
    primary_table = find_primary_table(schema_data)
    
    if not primary_table:
        print(f"  ERROR: No primary assets table found")
        print(f"  Available tables: {[t['name'] for t in schema_data['tables'][:10]]}")
        return {"error": "No assets table found", "database": database, "schema": schema, "tables": [t["name"] for t in schema_data["tables"]]}
    
    print(f"  Primary table: {primary_table}")
    
    # Step 3: Check field presence
    print("\n[3/4] Checking field presence...")
    table_columns = schema_data.get("columns", {}).get(primary_table, [])
    print(f"  Table has {len(table_columns)} columns")
    
    results = []
    column_mappings = {}
    
    for field_id, field_def in UNIFIED_FIELD_CATALOG.items():
        result = check_field_presence(table_columns, field_def)
        result.field_id = field_id
        results.append(result)
        
        if result.found:
            column_mappings[field_id] = result.matched_column
    
    found_count = sum(1 for r in results if r.found)
    print(f"  Found {found_count}/{len(results)} fields in table")
    
    # Step 4: Check population coverage
    print("\n[4/4] Checking population coverage...")
    
    if column_mappings:
        table_fqn = f'"{database}"."{schema}"."{primary_table}"'
        coverage_query = build_coverage_query(table_fqn, column_mappings)
        
        if coverage_query:
            query_result = execute_query(session_id, coverage_query, database, schema)
            
            if "error" in query_result:
                print(f"  ERROR: {query_result['error']}")
            elif query_result.get("rows"):
                row = query_result["rows"][0]
                total = row.get("TOTAL_COUNT") or row.get("total_count") or 0
                
                for result in results:
                    if result.found and result.field_id in row:
                        result.total_count = total
                        result.populated_count = row.get(result.field_id) or row.get(result.field_id.upper()) or 0
                        result.coverage_percent = (result.populated_count / total * 100) if total > 0 else 0
                
                print(f"  Total assets: {total:,}")
    
    return {
        "database": database,
        "schema": schema,
        "primary_table": primary_table,
        "table_columns": len(table_columns),
        "total_fields": len(results),
        "found_fields": found_count,
        "results": [r.__dict__ for r in results],
    }


def print_results_table(results: Dict[str, Any]):
    """Print a formatted results table."""
    if "error" in results:
        print(f"\n  Error: {results['error']}")
        return
    
    print(f"\n{'Field':<30} {'Category':<15} {'Status':<10} {'Column':<25} {'Coverage':<12}")
    print("-" * 92)
    
    for r in sorted(results["results"], key=lambda x: (not x["found"], x["category"], x["field_id"])):
        status = "✓ Found" if r["found"] else "✗ Missing"
        column = r["matched_column"] or "-"
        
        if r["found"] and r["total_count"] > 0:
            coverage = f"{r['coverage_percent']:.1f}%"
        else:
            coverage = "-"
        
        print(f"{r['field_id']:<30} {r['category']:<15} {status:<10} {column:<25} {coverage:<12}")


def print_comparison(results_list: List[Dict[str, Any]]):
    """Print comparison between schemas."""
    print(f"\n\n{'='*80}")
    print("SCHEMA COMPARISON")
    print(f"{'='*80}")
    
    # Filter to only successful results
    valid_results = [r for r in results_list if "error" not in r and "database" in r]
    
    if len(valid_results) < 2:
        print("Need at least 2 successful schema checks to compare")
        if len(valid_results) == 1:
            print(f"  Only {valid_results[0]['database']}.{valid_results[0]['schema']} succeeded")
        return
    
    # Build field -> schema -> result map
    field_schema_map = defaultdict(dict)
    
    for result in valid_results:
        schema_key = f"{result['database']}.{result['schema']}"
        for r in result.get("results", []):
            field_schema_map[r["field_id"]][schema_key] = r
    
    # Print header
    schemas = [f"{r['database']}.{r['schema']}" for r in valid_results]
    header = f"{'Field':<25} "
    for s in schemas:
        header += f"{s[:25]:<28} "
    print(f"\n{header}")
    print("-" * (25 + 28 * len(schemas)))
    
    # Print each field
    for field_id in sorted(field_schema_map.keys()):
        row = f"{field_id:<25} "
        for schema_key in schemas:
            r = field_schema_map[field_id].get(schema_key, {})
            if r.get("found"):
                col = r.get("matched_column", "")[:15]
                cov = f"({r.get('coverage_percent', 0):.0f}%)" if r.get("total_count") else ""
                row += f"✓ {col} {cov}".ljust(28)
            else:
                row += "✗ Missing".ljust(28)
        print(row)


def print_dry_run_report():
    """Print a dry run report showing what would be checked."""
    print("\n" + "=" * 70)
    print("DRY RUN REPORT - Field Catalog Analysis")
    print("=" * 70)
    
    print(f"\nTotal fields in catalog: {len(UNIFIED_FIELD_CATALOG)}")
    print(f"Schemas to check: {len(TEST_SCHEMAS)}")
    for s in TEST_SCHEMAS:
        print(f"  - {s['database']}.{s['schema']}")
    
    print("\n" + "-" * 70)
    print("FIELD CATALOG BREAKDOWN BY CATEGORY")
    print("-" * 70)
    
    by_category = defaultdict(list)
    for field_id, field_def in UNIFIED_FIELD_CATALOG.items():
        by_category[field_def["category"]].append((field_id, field_def))
    
    for category in sorted(by_category.keys()):
        fields = by_category[category]
        print(f"\n{category.upper()} ({len(fields)} fields)")
        for field_id, field_def in fields:
            cols = ", ".join(field_def["mdlhColumns"][:3])
            if len(field_def["mdlhColumns"]) > 3:
                cols += "..."
            print(f"  {field_id:<30} -> [{cols}]")
    
    print("\n" + "-" * 70)
    print("EXPECTED MDLH COLUMN MAPPING")
    print("-" * 70)
    
    print(f"\n{'Field ID':<25} {'Atlan Attribute':<25} {'MDLH Columns':<40}")
    print("-" * 90)
    
    for field_id, field_def in sorted(UNIFIED_FIELD_CATALOG.items()):
        atlan_attr = field_def.get("atlanAttribute", "-")
        mdlh_cols = ", ".join(field_def["mdlhColumns"][:2])
        print(f"{field_id:<25} {atlan_attr:<25} {mdlh_cols:<40}")
    
    print("\n" + "-" * 70)
    print("COVERAGE QUERY TEMPLATE")
    print("-" * 70)
    
    # Show sample coverage query
    sample_mappings = {
        "owner_users": "OWNER_USERS",
        "description": "DESCRIPTION",
        "certificate_status": "CERTIFICATE_STATUS",
        "popularity_score": "POPULARITY_SCORE",
    }
    
    sample_query = build_coverage_query('"DATABASE"."SCHEMA"."ASSETS"', sample_mappings)
    print(f"\n{sample_query}")


def main():
    print("=" * 60)
    print("END-TO-END FIELD PRESENCE CHECK")
    print("=" * 60)
    
    # Check connection
    print("\nChecking backend connection...")
    session_id = get_session_id()
    
    if not session_id:
        print("WARNING: Not connected to Snowflake.")
        print("Running in DRY RUN mode - showing field catalog analysis.")
        print_dry_run_report()
        print("\n" + "=" * 60)
        print("TO RUN LIVE CHECKS:")
        print("=" * 60)
        print("1. Open MDLH Dict UI at http://localhost:5173")
        print("2. Connect to Snowflake via the connection modal")
        print("3. Re-run this script")
        return
    
    print(f"Connected. Session: {session_id[:8]}...")
    
    # Run checks for each schema
    all_results = []
    
    for schema_config in TEST_SCHEMAS:
        result = run_presence_check(
            session_id,
            schema_config["database"],
            schema_config["schema"]
        )
        all_results.append(result)
        print_results_table(result)
    
    # Print comparison
    print_comparison(all_results)
    
    # Summary
    print(f"\n\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    
    for result in all_results:
        if "database" not in result:
            # Error result without database key
            print(f"\nSchema check failed: {result.get('error', 'Unknown error')}")
            continue
            
        schema_key = f"{result['database']}.{result['schema']}"
        if "error" in result:
            print(f"\n{schema_key}: ERROR - {result['error']}")
        else:
            found = result["found_fields"]
            total = result["total_fields"]
            pct = (found / total * 100) if total > 0 else 0
            print(f"\n{schema_key}:")
            print(f"  Primary Table: {result['primary_table']}")
            print(f"  Columns: {result['table_columns']}")
            print(f"  Fields Found: {found}/{total} ({pct:.1f}%)")
    
    # Export results
    output_file = "field_presence_results.json"
    with open(output_file, "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\nResults exported to: {output_file}")


if __name__ == "__main__":
    main()
