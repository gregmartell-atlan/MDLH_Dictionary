"""Connection management endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.models.schemas import ConnectionStatus
from app.services import snowflake_service

router = APIRouter(prefix="/api", tags=["connection"])


class ConnectionRequest(BaseModel):
    """Connection request with optional credentials."""
    account: Optional[str] = None
    user: Optional[str] = None
    password: Optional[str] = None
    token: Optional[str] = None  # Personal Access Token
    auth_type: Optional[str] = "token"  # 'token' or 'sso'
    warehouse: Optional[str] = None
    database: Optional[str] = None
    schema: Optional[str] = None
    role: Optional[str] = None


@router.post("/connect", response_model=ConnectionStatus)
async def test_connection(request: ConnectionRequest = None):
    """Test connection to Snowflake and return connection info."""
    try:
        # If credentials provided in request, use them
        if request and request.account and request.user:
            # Check auth type
            if request.auth_type == "sso":
                # External browser authentication (SSO/Okta)
                result = snowflake_service.connect_with_sso(
                    account=request.account,
                    user=request.user,
                    warehouse=request.warehouse,
                    database=request.database,
                    schema=request.schema,
                    role=request.role
                )
            elif request.auth_type == "token" and request.token:
                result = snowflake_service.connect_with_token(
                    account=request.account,
                    user=request.user,
                    token=request.token,
                    warehouse=request.warehouse,
                    database=request.database,
                    schema=request.schema,
                    role=request.role
                )
            elif request.password:
                result = snowflake_service.connect_with_credentials(
                    account=request.account,
                    user=request.user,
                    password=request.password,
                    warehouse=request.warehouse,
                    database=request.database,
                    schema=request.schema,
                    role=request.role
                )
            else:
                return ConnectionStatus(connected=False, error="No authentication credentials provided. Use SSO or provide a token.")
        else:
            # Use environment config
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

