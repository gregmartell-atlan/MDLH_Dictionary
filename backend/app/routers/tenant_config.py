"""Tenant Configuration endpoints for MDLH field mapping."""

from fastapi import APIRouter, Header, Query, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.session import session_manager
from app.services.mdlh_tenant_config import build_tenant_config
from app.utils.logger import logger

router = APIRouter(prefix="/api/tenant-config", tags=["tenant-config"])


class TenantConfigRequest(BaseModel):
    tenantId: str
    baseUrl: str
    database: str
    schema: str


@router.post("/discover")
async def discover_tenant_config(
    request: TenantConfigRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """
    Discover MDLH schema and build tenant configuration.
    
    This endpoint:
    1. Discovers all tables and columns in the specified schema
    2. Reconciles canonical fields to actual MDLH columns
    3. Returns a tenant configuration with field mappings
    """
    session = session_manager.get_session(x_session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Not connected to Snowflake")
    
    try:
        logger.info(f"Discovering tenant config for {request.tenantId}")
        
        config = build_tenant_config(
            conn=session.conn,
            tenant_id=request.tenantId,
            base_url=request.baseUrl,
            database=request.database,
            schema=request.schema
        )
        
        return config
        
    except Exception as e:
        logger.error(f"Tenant config discovery failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}")


@router.get("/schema")
async def get_schema_snapshot(
    database: str = Query(..., description="Database name"),
    schema: str = Query(..., description="Schema name"),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """
    Get schema snapshot (tables and columns) without building full config.
    """
    from app.services.mdlh_tenant_config import discover_mdlh_schema
    
    session = session_manager.get_session(x_session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Not connected to Snowflake")
    
    try:
        snapshot = discover_mdlh_schema(
            conn=session.conn,
            database=database,
            schema=schema
        )
        return snapshot
    except Exception as e:
        logger.error(f"Schema discovery failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}")
