"""Connection management endpoints."""

from fastapi import APIRouter, HTTPException
from app.models.schemas import ConnectionStatus, ConnectionRequest
from app.services import snowflake_service

router = APIRouter(prefix="/api", tags=["connection"])


@router.post("/connect", response_model=ConnectionStatus)
async def test_connection(request: ConnectionRequest = None):
    """Test connection to Snowflake and return connection info."""
    try:
        if request:
            result = snowflake_service.test_connection()
        else:
            result = snowflake_service.test_connection()
        
        return ConnectionStatus(**result)
    except Exception as e:
        return ConnectionStatus(connected=False, error=str(e))


@router.get("/session/status", response_model=ConnectionStatus)
async def get_session_status():
    """Check current session health."""
    result = snowflake_service.test_connection()
    return ConnectionStatus(**result)


@router.post("/disconnect")
async def disconnect():
    """Close the Snowflake connection."""
    snowflake_service.disconnect()
    return {"message": "Disconnected"}

