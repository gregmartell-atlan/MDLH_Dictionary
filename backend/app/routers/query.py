"""Query execution endpoints with session support."""

import logging
import re
import time
import uuid
from datetime import datetime
from typing import Optional, List, Tuple
from fastapi import APIRouter, HTTPException, Query as QueryParam, Header

from app.models.schemas import (
    QueryRequest, QuerySubmitResponse, QueryStatusResponse,
    QueryResultsResponse, QueryHistoryResponse, QueryHistoryItem,
    QueryStatus, CancelQueryResponse
)
from app.services.session import session_manager
from app.database import query_history_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/query", tags=["query"])


def _split_sql_statements(sql: str) -> List[str]:
    """
    Split SQL into individual statements, handling:
    - Single-line comments (-- ...)
    - Block comments (/* ... */)
    - String literals ('...' and "...")
    - Semicolons as statement separators
    
    Returns list of non-empty statements.
    """
    # Remove block comments
    sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.DOTALL)
    
    # Remove single-line comments
    sql = re.sub(r'--.*?$', '', sql, flags=re.MULTILINE)
    
    # Split on semicolons (simple approach - works for most cases)
    # For production, consider a proper SQL parser
    statements = []
    current = []
    in_string = False
    string_char = None
    
    for char in sql:
        if char in ("'", '"') and not in_string:
            in_string = True
            string_char = char
            current.append(char)
        elif char == string_char and in_string:
            in_string = False
            string_char = None
            current.append(char)
        elif char == ';' and not in_string:
            stmt = ''.join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
        else:
            current.append(char)
    
    # Don't forget the last statement (may not end with ;)
    stmt = ''.join(current).strip()
    if stmt:
        statements.append(stmt)
    
    return statements


def _count_statements(sql: str) -> int:
    """Count the number of SQL statements."""
    return len(_split_sql_statements(sql))

VALID_STATUSES = {s.value for s in QueryStatus}


class QueryExecutionError(Exception):
    """Base exception for query execution issues."""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class SessionNotFoundError(QueryExecutionError):
    def __init__(self):
        super().__init__(
            "Session not found or expired. Please reconnect.",
            status_code=401
        )


def _get_session_or_401(session_id: Optional[str]):
    """Get session from header or raise 401."""
    if not session_id:
        raise HTTPException(
            status_code=401, 
            detail="X-Session-ID header required. Please connect first."
        )
    
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Session not found or expired. Please reconnect."
        )
    
    return session


def _record_query_history(
    query_id: str,
    sql: str,
    request: QueryRequest,
    status: str,
    row_count: Optional[int] = None,
    error_message: Optional[str] = None,
    execution_time_ms: Optional[int] = None
) -> None:
    """Record query to history, logging failures without raising."""
    try:
        query_history_db.add_query(
            query_id=query_id,
            sql=sql,
            database=request.database,
            schema=request.schema_name,
            warehouse=request.warehouse,
            status=status,
            row_count=row_count,
            error_message=error_message,
            started_at=datetime.utcnow().isoformat(),
            completed_at=datetime.utcnow().isoformat(),
            duration_ms=execution_time_ms
        )
    except Exception as e:
        logger.error(f"Failed to record query history for {query_id}: {e}")


@router.post("/execute", response_model=QuerySubmitResponse)
async def execute_query(
    request: QueryRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """
    Submit a SQL query for execution.
    
    Requires X-Session-ID header from successful /api/connect.
    """
    if not request.sql or not request.sql.strip():
        raise HTTPException(status_code=400, detail="SQL query cannot be empty")
    
    session = _get_session_or_401(x_session_id)
    query_id = str(uuid.uuid4())
    start_time = time.time()
    
    try:
        cursor = session.conn.cursor()
        
        # Count statements (properly handles comments and strings)
        statement_count = _count_statements(request.sql)
        
        # Execute query (enable multi-statement if needed)
        if statement_count > 1:
            logger.info(f"Executing {statement_count} statements")
            cursor.execute(request.sql, num_statements=statement_count)
            # For multi-statement, get results from the last statement
            while cursor.nextset():
                pass  # Skip to last result set
        else:
            cursor.execute(request.sql)
        
        # Fetch results
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        # Convert to lists for JSON serialization
        rows = [list(row) for row in rows]
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        cursor.close()
        
        # Store results in session for retrieval
        if not hasattr(session, 'query_results'):
            session.query_results = {}
        
        session.query_results[query_id] = {
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "status": QueryStatus.SUCCESS,
            "execution_time_ms": execution_time_ms,
            "started_at": datetime.utcnow().isoformat(),
            "completed_at": datetime.utcnow().isoformat()
        }
        
        _record_query_history(
            query_id, request.sql, request,
            QueryStatus.SUCCESS, len(rows), None, execution_time_ms
        )
        
        return QuerySubmitResponse(
            query_id=query_id,
            status=QueryStatus.SUCCESS,
            message="Query executed successfully",
            execution_time_ms=execution_time_ms,
            row_count=len(rows)
        )
        
    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        error_msg = str(e)
        
        # Store failure info
        if not hasattr(session, 'query_results'):
            session.query_results = {}
        
        session.query_results[query_id] = {
            "status": QueryStatus.FAILED,
            "error_message": error_msg,
            "execution_time_ms": execution_time_ms,
            "started_at": datetime.utcnow().isoformat(),
            "completed_at": datetime.utcnow().isoformat()
        }
        
        _record_query_history(
            query_id, request.sql, request,
            QueryStatus.FAILED, None, error_msg, execution_time_ms
        )
        
        return QuerySubmitResponse(
            query_id=query_id,
            status=QueryStatus.FAILED,
            message=error_msg,
            execution_time_ms=execution_time_ms
        )


@router.get("/{query_id}/status", response_model=QueryStatusResponse)
async def get_query_status(
    query_id: str,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Get the status of a query."""
    session = _get_session_or_401(x_session_id)
    
    if not hasattr(session, 'query_results') or query_id not in session.query_results:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    
    result = session.query_results[query_id]
    return QueryStatusResponse(
        query_id=query_id,
        status=result["status"],
        row_count=result.get("row_count"),
        execution_time_ms=result.get("execution_time_ms"),
        error_message=result.get("error_message"),
        started_at=result.get("started_at"),
        completed_at=result.get("completed_at")
    )


@router.get("/{query_id}/results", response_model=QueryResultsResponse)
async def get_query_results(
    query_id: str,
    page: int = QueryParam(1, ge=1, description="Page number"),
    page_size: int = QueryParam(100, ge=1, le=1000, description="Results per page"),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Get paginated results for a completed query."""
    session = _get_session_or_401(x_session_id)
    
    if not hasattr(session, 'query_results') or query_id not in session.query_results:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    
    result = session.query_results[query_id]
    
    if result["status"] == QueryStatus.FAILED:
        raise HTTPException(
            status_code=400,
            detail=f"Query failed: {result.get('error_message', 'Unknown error')}"
        )
    
    if result["status"] == QueryStatus.RUNNING:
        raise HTTPException(status_code=202, detail="Query is still running")
    
    rows = result.get("rows", [])
    columns = result.get("columns", [])
    
    # Paginate
    start = (page - 1) * page_size
    end = start + page_size
    paginated_rows = rows[start:end]
    
    return QueryResultsResponse(
        columns=columns,
        rows=paginated_rows,
        total_rows=len(rows),
        page=page,
        page_size=page_size,
        has_more=end < len(rows)
    )


@router.post("/{query_id}/cancel", response_model=CancelQueryResponse)
async def cancel_query(
    query_id: str,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """Cancel a running query."""
    session = _get_session_or_401(x_session_id)
    
    if not hasattr(session, 'query_results') or query_id not in session.query_results:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    
    result = session.query_results[query_id]
    
    if result["status"] != QueryStatus.RUNNING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel query with status '{result['status']}'"
        )
    
    # Mark as cancelled
    result["status"] = QueryStatus.CANCELLED
    result["completed_at"] = datetime.utcnow().isoformat()
    
    return CancelQueryResponse(message="Query cancelled", query_id=query_id)


@router.get("/history", response_model=QueryHistoryResponse)
async def get_query_history(
    limit: int = QueryParam(50, ge=1, le=200, description="Number of queries to return"),
    offset: int = QueryParam(0, ge=0, description="Offset for pagination"),
    status: Optional[str] = QueryParam(None, description="Filter by status")
):
    """Get query execution history."""
    if status is not None and status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status filter '{status}'. Valid: {', '.join(sorted(VALID_STATUSES))}"
        )
    
    items, total = query_history_db.get_history(limit, offset, status)
    return QueryHistoryResponse(
        items=[QueryHistoryItem(**item) for item in items],
        total=total,
        limit=limit,
        offset=offset
    )


@router.delete("/history", response_model=dict)
async def clear_query_history():
    """Clear all query history."""
    query_history_db.clear_history()
    return {"message": "Query history cleared"}
