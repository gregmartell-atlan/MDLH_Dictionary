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
    QueryStatus, CancelQueryResponse,
    PreflightRequest, PreflightResponse, TableCheckResult, TableSuggestion
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


def _extract_tables_from_sql(sql: str) -> List[Tuple[str, str, str]]:
    """
    Extract table references from SQL.
    Returns list of (database, schema, table) tuples.
    """
    # Remove comments
    clean_sql = re.sub(r'--[^\n]*', '', sql)
    clean_sql = re.sub(r'/\*.*?\*/', '', clean_sql, flags=re.DOTALL)
    
    tables = []
    
    # Pattern for fully qualified: database.schema.table
    full_pattern = r'(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)'
    for match in re.finditer(full_pattern, clean_sql, re.IGNORECASE):
        tables.append((match.group(1), match.group(2), match.group(3)))
    
    # Pattern for schema.table (no database)
    partial_pattern = r'(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(?!\.)'
    for match in re.finditer(partial_pattern, clean_sql, re.IGNORECASE):
        # Only add if not already captured as full reference
        schema, table = match.group(1), match.group(2)
        if not any(t[2].upper() == table.upper() for t in tables):
            tables.append((None, schema, table))
    
    # Pattern for bare table name
    bare_pattern = r'(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)(?!\.)'
    keywords = {'SELECT', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'AS', 'ON', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS'}
    for match in re.finditer(bare_pattern, clean_sql, re.IGNORECASE):
        table = match.group(1)
        if table.upper() not in keywords and not any(t[2].upper() == table.upper() for t in tables):
            tables.append((None, None, table))
    
    return tables


def _check_table_exists(cursor, database: str, schema: str, table: str) -> dict:
    """Check if a table exists and get its row count."""
    result = {
        "exists": False,
        "row_count": None,
        "columns": [],
        "error": None
    }
    
    try:
        # Try to get table info
        fqn = f'"{database}"."{schema}"."{table}"'
        cursor.execute(f"DESCRIBE TABLE {fqn}")
        columns = [row[0] for row in cursor.fetchall()]
        result["columns"] = columns
        result["exists"] = True
        
        # Get approximate row count (fast)
        cursor.execute(f"SELECT COUNT(*) FROM {fqn} LIMIT 1")
        row = cursor.fetchone()
        result["row_count"] = row[0] if row else 0
        
    except Exception as e:
        error_msg = str(e)
        if "does not exist" in error_msg.lower() or "not authorized" in error_msg.lower():
            result["exists"] = False
            result["error"] = "Table does not exist or not authorized"
        else:
            result["error"] = error_msg
    
    return result


def _find_similar_tables(cursor, database: str, schema: str, target_table: str, limit: int = 10) -> List[dict]:
    """Find similar tables that have data."""
    similar = []
    
    try:
        # Get all tables in the schema
        cursor.execute(f'SHOW TABLES IN "{database}"."{schema}"')
        tables = cursor.fetchall()
        
        target_upper = target_table.upper().replace('_ENTITY', '').replace('_', '')
        
        for row in tables:
            table_name = row[1]  # name column
            row_count = row[6] if len(row) > 6 and row[6] else 0  # row_count column
            
            # Skip empty tables
            try:
                row_count = int(row_count) if row_count else 0
            except (ValueError, TypeError):
                row_count = 0
            
            if row_count == 0:
                continue
            
            # Calculate similarity
            table_upper = table_name.upper().replace('_ENTITY', '').replace('_', '')
            
            # Exact match scores highest
            if table_upper == target_upper:
                score = 1.0
                reason = "Exact match with data"
            # Contains target
            elif target_upper in table_upper or table_upper in target_upper:
                score = 0.8
                reason = f"Similar name, has {row_count:,} rows"
            # Shared prefix (at least 4 chars)
            elif len(target_upper) >= 4 and table_upper.startswith(target_upper[:4]):
                score = 0.6
                reason = f"Same category, has {row_count:,} rows"
            # Entity table with data
            elif table_name.upper().endswith('_ENTITY') and row_count > 0:
                score = 0.3
                reason = f"Entity table with {row_count:,} rows"
            else:
                continue
            
            similar.append({
                "table_name": table_name,
                "fully_qualified": f"{database}.{schema}.{table_name}",
                "row_count": row_count,
                "relevance_score": score,
                "reason": reason
            })
        
        # Sort by score descending, then by row_count
        similar.sort(key=lambda x: (-x["relevance_score"], -x["row_count"]))
        return similar[:limit]
        
    except Exception as e:
        logger.warning(f"Failed to find similar tables: {e}")
        return []


def _generate_suggested_query(original_sql: str, replacements: dict) -> str:
    """Generate a suggested query with table replacements."""
    suggested = original_sql
    
    for original, replacement in replacements.items():
        # Try different patterns
        patterns = [
            (rf'(FROM|JOIN)\s+{re.escape(original)}\b', rf'\1 {replacement}'),
            (rf'(FROM|JOIN)\s+[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*\.{re.escape(original.split(".")[-1])}\b', rf'\1 {replacement}'),
        ]
        
        for pattern, repl in patterns:
            suggested = re.sub(pattern, repl, suggested, flags=re.IGNORECASE)
    
    return suggested


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


@router.post("/preflight", response_model=PreflightResponse)
async def preflight_check(
    request: PreflightRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    """
    Check a query before execution.
    
    Validates tables exist, checks row counts, and suggests alternatives
    if tables are empty or don't exist.
    """
    session = _get_session_or_401(x_session_id)
    
    # Default database/schema from request or session
    default_db = request.database or session.database or "FIELD_METADATA"
    default_schema = request.schema_name or session.schema or "PUBLIC"
    
    # Extract tables from SQL
    tables = _extract_tables_from_sql(request.sql)
    
    if not tables:
        return PreflightResponse(
            valid=True,
            message="No tables detected in query (might be a SHOW/DESCRIBE command)",
            tables_checked=[],
            suggestions=[],
            issues=[]
        )
    
    cursor = session.conn.cursor()
    tables_checked = []
    issues = []
    suggestions = []
    replacements = {}
    
    try:
        for db, schema, table in tables:
            # Resolve defaults
            resolved_db = db or default_db
            resolved_schema = schema or default_schema
            fqn = f"{resolved_db}.{resolved_schema}.{table}"
            
            # Check table
            check_result = _check_table_exists(cursor, resolved_db, resolved_schema, table)
            
            table_check = TableCheckResult(
                table_name=table,
                fully_qualified=fqn,
                exists=check_result["exists"],
                row_count=check_result["row_count"],
                columns=check_result["columns"],
                error=check_result["error"]
            )
            tables_checked.append(table_check)
            
            # Collect issues
            if not check_result["exists"]:
                issues.append(f"Table '{fqn}' does not exist or you don't have access")
                
                # Find alternatives
                similar = _find_similar_tables(cursor, resolved_db, resolved_schema, table)
                for s in similar:
                    suggestions.append(TableSuggestion(**s))
                    # Use first high-scoring suggestion for replacement
                    if s["relevance_score"] >= 0.6 and fqn not in replacements:
                        replacements[fqn] = s["fully_qualified"]
                        
            elif check_result["row_count"] == 0:
                issues.append(f"Table '{fqn}' exists but is empty (0 rows)")
                
                # Find alternatives with data
                similar = _find_similar_tables(cursor, resolved_db, resolved_schema, table)
                for s in similar:
                    suggestions.append(TableSuggestion(**s))
                    # Suggest replacement for empty tables too
                    if s["relevance_score"] >= 0.5 and fqn not in replacements:
                        replacements[fqn] = s["fully_qualified"]
        
        cursor.close()
        
        # Generate suggested query if we have replacements
        suggested_query = None
        if replacements:
            suggested_query = _generate_suggested_query(request.sql, replacements)
        
        # Build response message
        if not issues:
            message = f"All {len(tables_checked)} table(s) exist and have data"
            valid = True
        else:
            message = f"Found {len(issues)} issue(s) with query"
            valid = False
        
        return PreflightResponse(
            valid=valid,
            tables_checked=tables_checked,
            issues=issues,
            suggestions=suggestions,
            suggested_query=suggested_query,
            message=message
        )
        
    except Exception as e:
        logger.error(f"Preflight check failed: {e}")
        cursor.close()
        return PreflightResponse(
            valid=False,
            message=f"Preflight check failed: {str(e)}",
            issues=[str(e)]
        )


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
        columns = []
        rows = []
        
        if statement_count > 1:
            logger.info(f"Executing {statement_count} statements")
            cursor.execute(request.sql, num_statements=statement_count)
            
            # For multi-statement, collect results from each statement
            # Keep the last non-empty result set (usually the SELECT/SHOW)
            while True:
                if cursor.description:
                    current_columns = [desc[0] for desc in cursor.description]
                    current_rows = cursor.fetchall()
                    # Keep results if this statement returned rows
                    if current_rows or not rows:
                        columns = current_columns
                        rows = [list(row) for row in current_rows]
                        logger.info(f"Statement returned {len(rows)} rows, {len(columns)} columns")
                
                # Move to next result set, break if none left
                if not cursor.nextset():
                    break
        else:
            cursor.execute(request.sql)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
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
