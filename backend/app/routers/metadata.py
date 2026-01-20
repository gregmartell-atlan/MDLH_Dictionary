"""Metadata discovery endpoints for schema browser with session support."""

import re
from fastapi import APIRouter, HTTPException, Query, Header
from fastapi.responses import JSONResponse
from typing import List, Optional
import snowflake.connector.errors
from snowflake.connector.errors import OperationalError
from app.models.schemas import DatabaseInfo, SchemaInfo, TableInfo, ColumnInfo
from app.services.session import session_manager
from app.services import metadata_cache
from app.utils.logger import logger

router = APIRouter(prefix="/api/metadata", tags=["metadata"])
METADATA_STATEMENT_TIMEOUT_SECONDS = 30

# Priority tables to always discover columns for (these are most commonly used)
PRIORITY_TABLES = [
    "ASSETS",
    "CUSTOM_METADATA",
    "LINEAGE",
    "TAGS",
    "PIPELINE_DETAILS",
    "RELATIONAL_ASSET_DETAILS",
    "TABLE_ENTITY",
    "COLUMN_ENTITY",
    "PROCESS_ENTITY",
]

# Maximum tables to discover columns for (to avoid overwhelming queries)
MAX_COLUMN_DISCOVERY_TABLES = 25


def _validate_identifier(name: str) -> str:
    """Validate and quote Snowflake identifier to prevent SQL injection."""
    if not name or not re.match(r'^[A-Za-z_][A-Za-z0-9_$]*$', name):
        if not re.match(r'^"[^"]*"$', name):  # Already quoted
            # Quote the identifier
            name = '"' + name.replace('"', '""') + '"'
    return name


def _get_session_or_none(session_id: Optional[str]):
    """Get session from header, returns None if invalid."""
    if not session_id:
        return None
    return session_manager.get_session(session_id)


def _cache_scope(session) -> str:
    """Scope cache entries by identity to avoid cross-tenant leaks."""
    return f"{session.account}:{session.user}:{session.role}:{session.warehouse}"


def _handle_snowflake_error(e: Exception, context: str):
    """
    Handle Snowflake errors gracefully.
    
    Returns:
    - [] for permission/access issues
    - JSONResponse with 503 for network/timeout issues
    """
    error_msg = str(e)
    logger.warning(f"[Metadata] {context}: {error_msg}")
    
    # Network/timeout errors -> return 503 so frontend knows backend is unreachable
    if isinstance(e, (OperationalError, TimeoutError)):
        return JSONResponse(
            status_code=503,
            content={"error": "Snowflake unreachable", "detail": error_msg}
        )
    
    # Permission/access errors - return empty list instead of 500
    if isinstance(e, snowflake.connector.errors.ProgrammingError):
        error_code = getattr(e, 'errno', None)
        # Common permission-related error codes
        # 2003: Object does not exist or not authorized
        # 2043: Insufficient privileges
        # 90105: Cannot perform operation
        if error_code in (2003, 2043, 90105) or 'does not exist' in error_msg.lower() or 'not authorized' in error_msg.lower():
            return []
    
    # For other errors, still return empty list but log it
    # This prevents the UI from breaking on edge cases
    return []


def _detect_profile(tables: List[str]) -> str:
    """Infer schema profile from available tables."""
    upper = {t.upper() for t in tables}
    has_gold = "ASSETS" in upper and "TAGS" in upper
    has_field_metadata = "TABLE_ENTITY" in upper and "COLUMN_ENTITY" in upper
    if has_gold:
        return "ATLAN_GOLD"
    if has_field_metadata:
        return "FIELD_METADATA"
    return "CUSTOM"


def _discover_columns(cursor, database: str, schema: str, tables: List[str]) -> dict:
    """Discover columns for selected tables."""
    safe_db = _validate_identifier(database)
    safe_schema_literal = schema.replace("'", "''")
    table_list = ", ".join([f"'{t.upper()}'" for t in tables])
    cursor.execute(f"""
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
        FROM {safe_db}.INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '{safe_schema_literal}'
          AND TABLE_NAME IN ({table_list})
        ORDER BY TABLE_NAME, ORDINAL_POSITION
    """)
    columns_by_table: dict = {}
    for row in cursor.fetchall():
        table_name = row[0]
        columns_by_table.setdefault(table_name, []).append({
            "name": row[1],
            "type": row[2],
        })
    return columns_by_table


@router.get("/databases", response_model=List[DatabaseInfo])
async def list_databases(
    refresh: bool = False,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """List all accessible databases."""
    session = _get_session_or_none(x_session_id)
    if not session:
        return []
    scope = _cache_scope(session)
    
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_databases(scope)
        if cached:
            return cached
    
    try:
        cursor = session.conn.cursor()
        cursor.execute(f"ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = {METADATA_STATEMENT_TIMEOUT_SECONDS}")
        cursor.execute("SHOW DATABASES")
        
        databases = []
        for row in cursor.fetchall():
            databases.append({
                "name": row[1],  # name is typically second column
                "owner": row[4] if len(row) > 4 else None,
                "created": str(row[9]) if len(row) > 9 else None,
                "comment": row[8] if len(row) > 8 else None
            })
        cursor.close()
        
        metadata_cache.set_databases(databases, scope)
        return [DatabaseInfo(**db) for db in databases]
    except Exception as e:
        return _handle_snowflake_error(e, "list_databases")


@router.get("/schemas", response_model=List[SchemaInfo])
async def list_schemas(
    database: str = Query(..., description="Database name"),
    refresh: bool = False,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """List all schemas in a database."""
    session = _get_session_or_none(x_session_id)
    if not session:
        return []
    scope = _cache_scope(session)
    
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_schemas(database, scope)
        if cached:
            return cached
    
    try:
        safe_db = _validate_identifier(database)
        cursor = session.conn.cursor()
        cursor.execute(f"ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = {METADATA_STATEMENT_TIMEOUT_SECONDS}")
        cursor.execute(f"SHOW SCHEMAS IN DATABASE {safe_db}")
        
        schemas = []
        for row in cursor.fetchall():
            schemas.append({
                "name": row[1],
                "database": database,
                "owner": row[4] if len(row) > 4 else None,
                "comment": row[7] if len(row) > 7 else None
            })
        cursor.close()
        
        metadata_cache.set_schemas(database, schemas, scope)
        return [SchemaInfo(**s) for s in schemas]
    except Exception as e:
        return _handle_snowflake_error(e, f"list_schemas({database})")


@router.get("/tables", response_model=List[TableInfo])
async def list_tables(
    database: str = Query(..., description="Database name"),
    schema: str = Query(..., description="Schema name"),
    refresh: bool = False,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """List all tables and views in a schema with accurate row counts.
    
    Uses INFORMATION_SCHEMA.TABLES for accurate row counts (SHOW TABLES often has stale counts).
    Results are sorted by row_count DESC for "popular tables" functionality.
    """
    session = _get_session_or_none(x_session_id)
    if not session:
        return []
    scope = _cache_scope(session)
    
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_tables(database, schema, scope)
        if cached:
            return cached
    
    try:
        safe_db = _validate_identifier(database)
        # Use single-quoted string literal for schema name in WHERE clause
        safe_schema_literal = schema.replace("'", "''")
        
        cursor = session.conn.cursor()
        cursor.execute(f"ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = {METADATA_STATEMENT_TIMEOUT_SECONDS}")
        
        # Query INFORMATION_SCHEMA for accurate row counts
        # This is more reliable than SHOW TABLES which can have stale row_count
        cursor.execute(f"""
            SELECT 
                table_name,
                table_type,
                row_count,
                bytes,
                table_owner,
                comment
            FROM {safe_db}.INFORMATION_SCHEMA.TABLES
            WHERE table_schema = '{safe_schema_literal}'
            AND table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY row_count DESC NULLS LAST
        """)
        
        tables = []
        for row in cursor.fetchall():
            tables.append({
                "name": row[0],
                "database": database,
                "schema": schema,
                "kind": "VIEW" if row[1] == 'VIEW' else "TABLE",
                "owner": row[4],
                "row_count": row[2],
                "bytes": row[3],
                "comment": row[5]
            })
        cursor.close()
        
        metadata_cache.set_tables(database, schema, tables, scope)
        logger.info(f"[Metadata] list_tables({database}.{schema}): Found {len(tables)} tables/views (sorted by row_count)")
        
        # Create TableInfo models - wrap in try/except to see validation errors
        result = []
        for t in tables:
            try:
                result.append(TableInfo(**t))
            except Exception as ve:
                logger.warning(f"[Metadata] Validation error for table {t.get('name')}: {ve}")
        
        return result
    except Exception as e:
        return _handle_snowflake_error(e, f"list_tables({database}.{schema})")


@router.get("/columns", response_model=List[ColumnInfo])
async def list_columns(
    database: str = Query(..., description="Database name"),
    schema: str = Query(..., description="Schema name"),
    table: str = Query(..., description="Table name"),
    refresh: bool = False,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Get column metadata for a table."""
    session = _get_session_or_none(x_session_id)
    if not session:
        return []
    scope = _cache_scope(session)
    
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_columns(database, schema, table, scope)
        if cached:
            return cached
    
    try:
        safe_db = _validate_identifier(database)
        safe_schema = _validate_identifier(schema)
        safe_table = _validate_identifier(table)
        
        cursor = session.conn.cursor()
        cursor.execute(f"ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = {METADATA_STATEMENT_TIMEOUT_SECONDS}")
        cursor.execute(f"DESCRIBE TABLE {safe_db}.{safe_schema}.{safe_table}")
        
        columns = []
        for row in cursor.fetchall():
            columns.append({
                "name": row[0],
                "type": row[1],
                "kind": "COLUMN",
                "nullable": row[3] == 'Y' if len(row) > 3 else True,
                "default": row[4] if len(row) > 4 else None,
                "primary_key": row[5] == 'Y' if len(row) > 5 else False,
                "unique_key": row[6] == 'Y' if len(row) > 6 else False,
                "comment": row[8] if len(row) > 8 else None
            })
        cursor.close()
        
        metadata_cache.set_columns(database, schema, table, columns, scope)
        return [ColumnInfo(**c) for c in columns]
    except Exception as e:
        return _handle_snowflake_error(e, f"list_columns({database}.{schema}.{table})")


@router.get("/capabilities")
async def get_capabilities(
    database: str = Query(..., description="Database name"),
    schema: str = Query(..., description="Schema name"),
    refresh: bool = False,
    include_all_tables: bool = Query(False, description="Discover columns for all tables, not just priority tables"),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Discover tables/columns for a database+schema and infer profile.

    This endpoint scans the schema to discover:
    - All tables and views in the schema
    - Columns for priority tables (ASSETS, LINEAGE, etc.) by default
    - Columns for ALL tables if include_all_tables=true

    The profile is inferred from the available tables:
    - ATLAN_GOLD: Has ASSETS + TAGS tables
    - FIELD_METADATA: Has TABLE_ENTITY + COLUMN_ENTITY tables
    - CUSTOM: Other schemas
    """
    session = _get_session_or_none(x_session_id)
    if not session:
        return JSONResponse(status_code=401, content={"error": "SESSION_NOT_FOUND"})
    scope = _cache_scope(session)

    # Check cache (but skip if include_all_tables to ensure full scan)
    if not refresh and not include_all_tables:
        cached = metadata_cache.get_capabilities(database, schema, scope)
        if cached:
            return cached

    try:
        safe_db = _validate_identifier(database)
        safe_schema_literal = schema.replace("'", "''")

        cursor = session.conn.cursor()
        cursor.execute(f"ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = {METADATA_STATEMENT_TIMEOUT_SECONDS}")

        # Discover all tables and views with row counts for better context
        cursor.execute(f"""
            SELECT TABLE_NAME, TABLE_TYPE, ROW_COUNT
            FROM {safe_db}.INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = '{safe_schema_literal}'
              AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
            ORDER BY ROW_COUNT DESC NULLS LAST
        """)
        table_rows = cursor.fetchall()
        tables = [row[0] for row in table_rows]
        table_metadata = {row[0]: {"type": row[1], "row_count": row[2]} for row in table_rows}

        # Fallback to ATLAN_GOLD if schema is empty
        if not tables and database.upper() != "ATLAN_GOLD":
            cursor.execute(f"""
                SELECT TABLE_NAME, TABLE_TYPE, ROW_COUNT
                FROM "ATLAN_GOLD".INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = '{safe_schema_literal}'
                  AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
                ORDER BY ROW_COUNT DESC NULLS LAST
            """)
            gold_rows = cursor.fetchall()
            if gold_rows:
                tables = [row[0] for row in gold_rows]
                table_metadata = {row[0]: {"type": row[1], "row_count": row[2]} for row in gold_rows}
                database = "ATLAN_GOLD"
                logger.info(f"[Metadata] Fell back to ATLAN_GOLD for schema {schema}")

        # Determine which tables to discover columns for
        if include_all_tables:
            # Discover columns for all tables (up to limit)
            tables_for_columns = tables[:MAX_COLUMN_DISCOVERY_TABLES]
            logger.info(f"[Metadata] Discovering columns for ALL tables: {len(tables_for_columns)}")
        else:
            # Prioritize important tables, then add others up to limit
            priority_set = {t.upper() for t in PRIORITY_TABLES}
            priority_tables = [t for t in tables if t.upper() in priority_set]
            other_tables = [t for t in tables if t.upper() not in priority_set]

            # Start with priority tables, then add others up to limit
            tables_for_columns = priority_tables + other_tables[:MAX_COLUMN_DISCOVERY_TABLES - len(priority_tables)]
            logger.info(f"[Metadata] Discovering columns for {len(priority_tables)} priority + {len(tables_for_columns) - len(priority_tables)} other tables")

        # Discover columns for selected tables
        columns_by_table = _discover_columns(cursor, database, schema, tables_for_columns) if tables_for_columns else {}
        cursor.close()

        # Infer profile from available tables
        profile = _detect_profile(tables)

        payload = {
            "database": database,
            "schema": schema,
            "profile": profile,
            "tables": sorted(list({t.upper() for t in tables})),
            "table_metadata": table_metadata,
            "columns": columns_by_table,
            "column_discovery_scope": "all" if include_all_tables else "priority",
            "tables_with_columns": list(columns_by_table.keys()),
        }

        # Cache the result
        metadata_cache.set_capabilities(database, schema, payload, scope)
        logger.info(f"[Metadata] capabilities({database}.{schema}): {len(tables)} tables, {len(columns_by_table)} with columns")

        return payload
    except Exception as e:
        error = _handle_snowflake_error(e, f"capabilities({database}.{schema})")
        if isinstance(error, JSONResponse):
            return error
        return {"database": database, "schema": schema, "profile": "UNKNOWN", "tables": [], "columns": {}, "table_metadata": {}}


@router.post("/refresh")
async def refresh_cache(
    database: str = None,
    schema: str = None,
    table: str = None,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Manually refresh cached metadata."""
    session = _get_session_or_none(x_session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Session not found or expired")
    scope = _cache_scope(session)
    if table and schema and database:
        metadata_cache.clear_columns(database, schema, table, scope)
    elif schema and database:
        metadata_cache.clear_tables(database, schema, scope)
    elif database:
        metadata_cache.clear_schemas(database, scope)
    else:
        metadata_cache.clear_all()
    
    return {"message": "Cache cleared", "scope": {
        "database": database,
        "schema": schema,
        "table": table
    }}
