"""Metadata discovery endpoints for schema browser."""

from fastapi import APIRouter, HTTPException, Query
from typing import List
from app.models.schemas import DatabaseInfo, SchemaInfo, TableInfo, ColumnInfo
from app.services import snowflake_service, metadata_cache

router = APIRouter(prefix="/api/metadata", tags=["metadata"])


@router.get("/databases", response_model=List[DatabaseInfo])
async def list_databases(refresh: bool = False):
    """List all accessible databases."""
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_databases()
        if cached:
            return cached
    
    try:
        databases = snowflake_service.get_databases()
        metadata_cache.set_databases(databases)
        return [DatabaseInfo(**db) for db in databases]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schemas", response_model=List[SchemaInfo])
async def list_schemas(
    database: str = Query(..., description="Database name"),
    refresh: bool = False
):
    """List all schemas in a database."""
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_schemas(database)
        if cached:
            return cached
    
    try:
        schemas = snowflake_service.get_schemas(database)
        metadata_cache.set_schemas(database, schemas)
        return [SchemaInfo(**s) for s in schemas]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables", response_model=List[TableInfo])
async def list_tables(
    database: str = Query(..., description="Database name"),
    schema: str = Query(..., description="Schema name"),
    refresh: bool = False
):
    """List all tables and views in a schema."""
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_tables(database, schema)
        if cached:
            return cached
    
    try:
        tables = snowflake_service.get_tables(database, schema)
        metadata_cache.set_tables(database, schema, tables)
        return [TableInfo(**t) for t in tables]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/columns", response_model=List[ColumnInfo])
async def list_columns(
    database: str = Query(..., description="Database name"),
    schema: str = Query(..., description="Schema name"),
    table: str = Query(..., description="Table name"),
    refresh: bool = False
):
    """Get column metadata for a table."""
    # Check cache first
    if not refresh:
        cached = metadata_cache.get_columns(database, schema, table)
        if cached:
            return cached
    
    try:
        columns = snowflake_service.get_columns(database, schema, table)
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

