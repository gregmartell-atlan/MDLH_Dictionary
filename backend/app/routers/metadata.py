"""Metadata discovery endpoints for schema browser with session support."""

import re
from fastapi import APIRouter, HTTPException, Query, Header
from typing import List, Optional
from app.models.schemas import DatabaseInfo, SchemaInfo, TableInfo, ColumnInfo
from app.services.session import session_manager
from app.services import metadata_cache

router = APIRouter(prefix="/api/metadata", tags=["metadata"])


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


@router.get("/databases", response_model=List[DatabaseInfo])
async def list_databases(
    refresh: bool = False,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """List all accessible databases."""
    session = _get_session_or_none(x_session_id)
    if not session:
        return []
    
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_databases()
        if cached:
            return cached
    
    try:
        cursor = session.conn.cursor()
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
        
        metadata_cache.set_databases(databases)
        return [DatabaseInfo(**db) for db in databases]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_schemas(database)
        if cached:
            return cached
    
    try:
        safe_db = _validate_identifier(database)
        cursor = session.conn.cursor()
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
        
        metadata_cache.set_schemas(database, schemas)
        return [SchemaInfo(**s) for s in schemas]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables", response_model=List[TableInfo])
async def list_tables(
    database: str = Query(..., description="Database name"),
    schema: str = Query(..., description="Schema name"),
    refresh: bool = False,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """List all tables and views in a schema."""
    session = _get_session_or_none(x_session_id)
    if not session:
        return []
    
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_tables(database, schema)
        if cached:
            return cached
    
    try:
        safe_db = _validate_identifier(database)
        safe_schema = _validate_identifier(schema)
        cursor = session.conn.cursor()
        cursor.execute(f"SHOW TABLES IN {safe_db}.{safe_schema}")
        
        tables = []
        for row in cursor.fetchall():
            tables.append({
                "name": row[1],
                "database": database,
                "schema": schema,
                "kind": "TABLE",
                "owner": row[4] if len(row) > 4 else None,
                "row_count": row[6] if len(row) > 6 else None,
                "comment": row[8] if len(row) > 8 else None
            })
        cursor.close()
        
        # Also get views
        cursor = session.conn.cursor()
        cursor.execute(f"SHOW VIEWS IN {safe_db}.{safe_schema}")
        
        for row in cursor.fetchall():
            tables.append({
                "name": row[1],
                "database": database,
                "schema": schema,
                "kind": "VIEW",
                "owner": row[4] if len(row) > 4 else None,
                "comment": row[7] if len(row) > 7 else None
            })
        cursor.close()
        
        metadata_cache.set_tables(database, schema, tables)
        return [TableInfo(**t) for t in tables]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_columns(database, schema, table)
        if cached:
            return cached
    
    try:
        safe_db = _validate_identifier(database)
        safe_schema = _validate_identifier(schema)
        safe_table = _validate_identifier(table)
        
        cursor = session.conn.cursor()
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
        
        metadata_cache.set_columns(database, schema, table, columns)
        return [ColumnInfo(**c) for c in columns]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh")
async def refresh_cache(
    database: str = None,
    schema: str = None,
    table: str = None
):
    """Manually refresh cached metadata."""
    if table and schema and database:
        metadata_cache.clear_columns(database, schema, table)
    elif schema and database:
        metadata_cache.clear_tables(database, schema)
    elif database:
        metadata_cache.clear_schemas(database)
    else:
        metadata_cache.clear_all()
    
    return {"message": "Cache cleared", "scope": {
        "database": database,
        "schema": schema,
        "table": table
    }}
