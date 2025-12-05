"""Query execution endpoints."""

from fastapi import APIRouter, HTTPException, Query as QueryParam
from typing import Optional
from app.models.schemas import (
    QueryRequest, QuerySubmitResponse, QueryStatusResponse,
    QueryResultsResponse, QueryHistoryResponse, QueryHistoryItem,
    QueryStatus
)
from app.services import snowflake_service
from app.database import query_history_db

router = APIRouter(prefix="/api/query", tags=["query"])

# Valid status values for filtering
VALID_STATUSES = {s.value for s in QueryStatus}


@router.post("/execute", response_model=QuerySubmitResponse)
async def execute_query(request: QueryRequest):
    """Submit a SQL query for execution."""
    if not request.sql or not request.sql.strip():
        raise HTTPException(status_code=400, detail="SQL query cannot be empty")
    
    # Check for active connection first
    if not snowflake_service.is_connected():
        raise HTTPException(
            status_code=503,  # Service Unavailable - more appropriate than 400
            detail="Not connected to Snowflake. Please configure your connection first using the 'Configure Connection' button."
        )
    
    try:
        query_id = snowflake_service.execute_query(
            sql=request.sql,
            database=request.database,
            schema=request.schema_name,
            warehouse=request.warehouse,
            timeout=request.timeout,
            limit=request.limit
        )
        
        # Get status to return
        status_info = snowflake_service.get_query_status(query_id)
        
        # Store in history (after execution completes, so status is final)
        if status_info:
            query_history_db.add_query(
                query_id=query_id,
                sql=request.sql,
                database=request.database,
                schema=request.schema_name,
                warehouse=request.warehouse,
                status=status_info["status"],
                row_count=status_info.get("row_count"),
                error_message=status_info.get("error_message"),
                started_at=status_info.get("started_at"),
                completed_at=status_info.get("completed_at"),
                duration_ms=status_info.get("execution_time_ms")
            )
        
        return QuerySubmitResponse(
            query_id=query_id,
            status=status_info["status"] if status_info else QueryStatus.FAILED,
            message="Query executed" if status_info and status_info["status"] == QueryStatus.SUCCESS else "Query failed"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{query_id}/status", response_model=QueryStatusResponse)
async def get_query_status(query_id: str):
    """Get the status of a query."""
    status = snowflake_service.get_query_status(query_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    return QueryStatusResponse(**status)


@router.get("/{query_id}/results", response_model=QueryResultsResponse)
async def get_query_results(
    query_id: str,
    page: int = QueryParam(1, ge=1, description="Page number"),
    page_size: int = QueryParam(100, ge=1, le=1000, description="Results per page")
):
    """Get paginated results for a completed query."""
    # First check if query exists
    status = snowflake_service.get_query_status(query_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
    
    # Check if query is still running
    if status["status"] == QueryStatus.RUNNING:
        raise HTTPException(
            status_code=202,  # Accepted but not ready
            detail="Query is still running. Please wait and try again."
        )
    
    # Check if query failed
    if status["status"] == QueryStatus.FAILED:
        raise HTTPException(
            status_code=400,
            detail=f"Query failed: {status.get('error_message', 'Unknown error')}"
        )
    
    # Check if query was cancelled
    if status["status"] == QueryStatus.CANCELLED:
        raise HTTPException(
            status_code=400,
            detail="Query was cancelled"
        )
    
    results = snowflake_service.get_query_results(query_id, page, page_size)
    if not results:
        raise HTTPException(status_code=500, detail="Failed to retrieve query results")
    return QueryResultsResponse(**results)


@router.post("/{query_id}/cancel")
async def cancel_query(query_id: str):
    """Cancel a running query."""
    success, error = snowflake_service.cancel_query(query_id)
    
    if not success:
        if error == "Query not found":
            raise HTTPException(status_code=404, detail=f"Query '{query_id}' not found")
        else:
            raise HTTPException(status_code=400, detail=error or "Query cannot be cancelled")
    
    return {"message": "Query cancelled", "query_id": query_id}


@router.get("/history", response_model=QueryHistoryResponse)
async def get_query_history(
    limit: int = QueryParam(50, ge=1, le=200, description="Number of queries to return"),
    offset: int = QueryParam(0, ge=0, description="Offset for pagination"),
    status: Optional[str] = QueryParam(None, description="Filter by status")
):
    """Get query execution history."""
    # Validate status filter if provided
    if status is not None and status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status filter '{status}'. Valid values: {', '.join(VALID_STATUSES)}"
        )
    
    items, total = query_history_db.get_history(limit, offset, status)
    return QueryHistoryResponse(
        items=[QueryHistoryItem(**item) for item in items],
        total=total,
        limit=limit,
        offset=offset
    )


@router.delete("/history")
async def clear_query_history():
    """Clear all query history."""
    query_history_db.clear_history()
    return {"message": "Query history cleared"}
