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
