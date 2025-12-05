"""Query execution endpoints."""

import logging
from fastapi import APIRouter, HTTPException, Query as QueryParam
from typing import Optional

from app.models.schemas import (
    QueryRequest, QuerySubmitResponse, QueryStatusResponse,
    QueryResultsResponse, QueryHistoryResponse, QueryHistoryItem,
    QueryStatus, CancelQueryResponse
)
from app.services import snowflake_service
from app.services.snowflake import (
    SnowflakeSyntaxError, SnowflakeTimeoutError, SnowflakeConnectionError
)
from app.database import query_history_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/query", tags=["query"])

VALID_STATUSES = {s.value for s in QueryStatus}


class QueryExecutionError(Exception):
    """Base exception for query execution issues."""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class ConnectionNotAvailableError(QueryExecutionError):
    def __init__(self):
        super().__init__(
            "Not connected to Snowflake. Please configure your connection first using the 'Configure Connection' button.",
            status_code=503
        )


class QuerySyntaxError(QueryExecutionError):
    def __init__(self, detail: str):
        super().__init__(f"SQL syntax error: {detail}", status_code=400)


class QueryTimeoutError(QueryExecutionError):
    def __init__(self, query_id: str):
        super().__init__(f"Query '{query_id}' timed out", status_code=504)


def _require_connection() -> None:
    """Verify Snowflake connection is active."""
    if not snowflake_service.is_connected():
        raise ConnectionNotAvailableError()


def _record_query_history(
    query_id: str,
    sql: str,
    request: QueryRequest,
    status_info: Optional[dict]
) -> None:
    """Record query to history, logging failures without raising."""
    try:
        query_history_db.add_query(
            query_id=query_id,
            sql=sql,
            database=request.database,
            schema=request.schema_name,
            warehouse=request.warehouse,
            status=status_info["status"] if status_info else QueryStatus.FAILED,
            row_count=status_info.get("row_count") if status_info else None,
            error_message=status_info.get("error_message") if status_info else None,
            started_at=status_info.get("started_at") if status_info else None,
            completed_at=status_info.get("completed_at") if status_info else None,
            duration_ms=status_info.get("execution_time_ms") if status_info else None
        )
    except Exception as e:
        logger.error(f"Failed to record query history for {query_id}: {e}")


def _get_query_or_404(query_id: str) -> dict:
    """Fetch query status or raise 404."""
    status = snowflake_service.get_query_status(query_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    return status


@router.post("/execute", response_model=QuerySubmitResponse)
async def execute_query(request: QueryRequest):
    """Submit a SQL query for execution."""
    if not request.sql or not request.sql.strip():
        raise HTTPException(status_code=400, detail="SQL query cannot be empty")
    
    _require_connection()
    
    query_id: Optional[str] = None
    status_info: Optional[dict] = None
    
    try:
        query_id = snowflake_service.execute_query(
            sql=request.sql,
            database=request.database,
            schema=request.schema_name,
            warehouse=request.warehouse,
            timeout=request.timeout,
            limit=request.limit
        )
        status_info = snowflake_service.get_query_status(query_id)
        
    except SnowflakeSyntaxError as e:
        raise QuerySyntaxError(str(e))
    except SnowflakeTimeoutError:
        raise QueryTimeoutError(query_id or "unknown")
    except SnowflakeConnectionError:
        raise ConnectionNotAvailableError()
    except QueryExecutionError:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error executing query: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {type(e).__name__}")
    finally:
        if query_id:
            _record_query_history(query_id, request.sql, request, status_info)
    
    query_status = status_info["status"] if status_info else QueryStatus.FAILED
    return QuerySubmitResponse(
        query_id=query_id,
        status=query_status,
        message="Query executed successfully" if query_status == QueryStatus.SUCCESS else "Query failed"
    )


@router.get("/{query_id}/status", response_model=QueryStatusResponse)
async def get_query_status(query_id: str):
    """Get the status of a query."""
    status = _get_query_or_404(query_id)
    return QueryStatusResponse(**status)


@router.get("/{query_id}/results", response_model=QueryResultsResponse)
async def get_query_results(
    query_id: str,
    page: int = QueryParam(1, ge=1, description="Page number"),
    page_size: int = QueryParam(100, ge=1, le=1000, description="Results per page")
):
    """Get paginated results for a completed query."""
    status = _get_query_or_404(query_id)
    
    status_handlers = {
        QueryStatus.RUNNING: (202, "Query is still running. Please wait and try again."),
        QueryStatus.FAILED: (400, f"Query failed: {status.get('error_message', 'Unknown error')}"),
        QueryStatus.CANCELLED: (400, "Query was cancelled"),
    }
    
    if status["status"] in status_handlers:
        code, detail = status_handlers[status["status"]]
        raise HTTPException(status_code=code, detail=detail)
    
    results = snowflake_service.get_query_results(query_id, page, page_size)
    if not results:
        raise HTTPException(status_code=500, detail="Failed to retrieve query results")
    
    return QueryResultsResponse(**results)


@router.post("/{query_id}/cancel", response_model=CancelQueryResponse)
async def cancel_query(query_id: str):
    """Cancel a running query."""
    success, error = snowflake_service.cancel_query_with_reason(query_id)
    
    if not success:
        if error == "Query not found":
            raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
        raise HTTPException(status_code=400, detail=error or "Query cannot be cancelled")
    
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
            detail=f"Invalid status filter '{status}'. Valid values: {', '.join(sorted(VALID_STATUSES))}"
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
