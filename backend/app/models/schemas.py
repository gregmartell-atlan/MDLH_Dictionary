"""Pydantic models for API request/response schemas."""

from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime
from enum import Enum


# ============ Connection Models ============

class ConnectionStatus(BaseModel):
    """Connection status response."""
    connected: bool
    account: Optional[str] = None
    user: Optional[str] = None
    warehouse: Optional[str] = None
    database: Optional[str] = None
    schema_name: Optional[str] = Field(None, alias="schema")
    role: Optional[str] = None
    error: Optional[str] = None


class ConnectionRequest(BaseModel):
    """Request to test/establish connection."""
    warehouse: Optional[str] = None
    database: Optional[str] = None
    schema_name: Optional[str] = Field(None, alias="schema")


# ============ Metadata Models ============

class DatabaseInfo(BaseModel):
    """Database metadata."""
    name: str
    created_on: Optional[datetime] = None
    owner: Optional[str] = None


class SchemaInfo(BaseModel):
    """Schema metadata."""
    name: str
    database_name: str
    created_on: Optional[datetime] = None
    owner: Optional[str] = None


class TableInfo(BaseModel):
    """Table or view metadata."""
    name: str
    database_name: str
    schema_name: str
    kind: str  # TABLE, VIEW, MATERIALIZED VIEW
    rows: Optional[int] = None
    created_on: Optional[datetime] = None
    owner: Optional[str] = None


class ColumnInfo(BaseModel):
    """Column metadata."""
    name: str
    data_type: str
    nullable: bool = True
    default: Optional[str] = None
    primary_key: bool = False
    comment: Optional[str] = None


# ============ Query Models ============

class QueryStatus(str, Enum):
    """Query execution status."""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class QueryRequest(BaseModel):
    """Request to execute a SQL query."""
    sql: str
    database: Optional[str] = None
    schema_name: Optional[str] = Field(None, alias="schema")
    warehouse: Optional[str] = None
    timeout: int = 60  # seconds
    limit: Optional[int] = 10000  # max rows to return


class QuerySubmitResponse(BaseModel):
    """Response after submitting a query."""
    query_id: str
    status: QueryStatus
    message: str


class QueryStatusResponse(BaseModel):
    """Query status check response."""
    query_id: str
    status: QueryStatus
    row_count: Optional[int] = None
    execution_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ColumnMetadata(BaseModel):
    """Column metadata for query results."""
    name: str
    type: str


class QueryResultsResponse(BaseModel):
    """Paginated query results."""
    query_id: str
    columns: List[ColumnMetadata]
    rows: List[List[Any]]
    total_rows: int
    page: int
    page_size: int
    has_more: bool


class QueryHistoryItem(BaseModel):
    """Single query history entry."""
    query_id: str
    sql: str
    database: Optional[str] = None
    schema_name: Optional[str] = None
    warehouse: Optional[str] = None
    status: QueryStatus
    row_count: Optional[int] = None
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None


class QueryHistoryResponse(BaseModel):
    """Query history list response."""
    items: List[QueryHistoryItem]
    total: int
    limit: int
    offset: int

