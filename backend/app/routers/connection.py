"""Connection management endpoints with session support."""

from fastapi import APIRouter, Header
from pydantic import BaseModel
from typing import Optional
import snowflake.connector
from app.services.session import session_manager

router = APIRouter(prefix="/api", tags=["connection"])


class ConnectionRequest(BaseModel):
    """Connection request with credentials."""
    account: str
    user: str
    token: Optional[str] = None
    auth_type: str = "token"
    warehouse: str = "COMPUTE_WH"
    database: str = "ATLAN_MDLH"
    schema_name: str = "PUBLIC"
    role: Optional[str] = None


class ConnectionResponse(BaseModel):
    """Connection response with session ID."""
    connected: bool
    session_id: Optional[str] = None
    user: Optional[str] = None
    warehouse: Optional[str] = None
    database: Optional[str] = None
    role: Optional[str] = None
    error: Optional[str] = None


class SessionStatusResponse(BaseModel):
    """Session status response."""
    valid: bool
    user: Optional[str] = None
    warehouse: Optional[str] = None
    database: Optional[str] = None
    schema_name: Optional[str] = None
    role: Optional[str] = None
    query_count: Optional[int] = None
    idle_seconds: Optional[float] = None
    message: Optional[str] = None


class DisconnectResponse(BaseModel):
    """Disconnect response."""
    disconnected: bool
    message: str


@router.post("/connect", response_model=ConnectionResponse)
async def connect(request: ConnectionRequest):
    """Establish Snowflake connection and return session ID."""
    try:
        connect_params = {
            "account": request.account,
            "user": request.user,
            "warehouse": request.warehouse,
            "database": request.database,
            "schema": request.schema_name,
        }
        
        if request.role:
            connect_params["role"] = request.role
        
        if request.auth_type == "sso":
            connect_params["authenticator"] = "externalbrowser"
        elif request.auth_type == "token":
            if not request.token:
                return ConnectionResponse(
                    connected=False,
                    error="Personal Access Token required"
                )
            connect_params["token"] = request.token
            connect_params["authenticator"] = "oauth"
        else:
            return ConnectionResponse(
                connected=False,
                error=f"Unknown auth_type: {request.auth_type}"
            )
        
        print(f"[Connect] {request.auth_type} auth for {request.user}@{request.account}")
        conn = snowflake.connector.connect(**connect_params)
        
        cursor = conn.cursor()
        cursor.execute("SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE()")
        row = cursor.fetchone()
        cursor.close()
        
        session_id = session_manager.create_session(
            conn=conn,
            user=row[0],
            account=request.account,
            warehouse=row[2],
            database=request.database,
            schema=request.schema_name,
            role=row[1]
        )
        
        print(f"[Connect] Session {session_id[:8]}... created for {row[0]}")
        
        return ConnectionResponse(
            connected=True,
            session_id=session_id,
            user=row[0],
            warehouse=row[2],
            database=request.database,
            role=row[1]
        )
        
    except snowflake.connector.errors.DatabaseError as e:
        print(f"[Connect] Failed: {e}")
        return ConnectionResponse(connected=False, error=str(e))
    except Exception as e:
        print(f"[Connect] Error: {e}")
        return ConnectionResponse(connected=False, error=str(e))


@router.get("/session/status", response_model=SessionStatusResponse)
async def get_session_status(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Check if a session is still valid."""
    if not x_session_id:
        return SessionStatusResponse(valid=False, message="No session ID provided")
    
    session = session_manager.get_session(x_session_id)
    if session is None:
        return SessionStatusResponse(valid=False, message="Session not found or expired")
    
    from datetime import datetime
    idle = (datetime.utcnow() - session.last_used).total_seconds()
    
    return SessionStatusResponse(
        valid=True,
        user=session.user,
        warehouse=session.warehouse,
        database=session.database,
        schema_name=session.schema,
        role=session.role,
        query_count=session.query_count,
        idle_seconds=idle
    )


@router.post("/disconnect", response_model=DisconnectResponse)
async def disconnect(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Close session and release Snowflake connection."""
    if not x_session_id:
        return DisconnectResponse(disconnected=False, message="No session ID provided")
    
    removed = session_manager.remove_session(x_session_id)
    if removed:
        return DisconnectResponse(disconnected=True, message="Session closed")
    return DisconnectResponse(disconnected=False, message="Session not found")


@router.get("/sessions")
async def list_sessions():
    """Debug: list active sessions. Secure in production!"""
    return session_manager.get_stats()


@router.get("/health")
async def health():
    """Health check."""
    stats = session_manager.get_stats()
    return {"status": "healthy", "active_sessions": stats["active_sessions"]}
