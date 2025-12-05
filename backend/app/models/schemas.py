"""Pydantic models for API request/response schemas."""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any
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
    created: Optional[str] = None
    owner: Optional[str] = None
    comment: Optional[str] = None
    
    @field_validator('comment', mode='before')
    @classmethod
    def coerce_comment(cls, v):
        if v is None:
            return None
        return str(v) if v else None

    class Config:
        extra = "ignore"


class SchemaInfo(BaseModel):
    """Schema metadata."""
    name: str
    database: Optional[str] = None
    owner: Optional[str] = None
    comment: Optional[str] = None
    
    @field_validator('comment', mode='before')
    @classmethod
    def coerce_comment(cls, v):
        if v is None:
            return None
        return str(v) if v else None

    class Config:
        extra = "ignore"


class TableInfo(BaseModel):
    """Table or view metadata."""
    name: str
    database: Optional[str] = None
    schema_name: Optional[str] = Field(None, alias="schema")
    kind: str = "TABLE"  # TABLE, VIEW, MATERIALIZED VIEW
    row_count: Optional[int] = None
    owner: Optional[str] = None
    comment: Optional[str] = None
    
    # Handle Snowflake returning empty strings or wrong types
    @field_validator('row_count', mode='before')
    @classmethod
    def coerce_row_count(cls, v):
        if v is None or v == '' or v == 'NULL':
            return None
        try:
            return int(v)
        except (ValueError, TypeError):
            return None
    
    @field_validator('comment', mode='before')
    @classmethod
    def coerce_comment(cls, v):
        if v is None:
            return None
        return str(v) if v else None

    class Config:
        extra = "ignore"


class ColumnInfo(BaseModel):
    """Column metadata."""
    name: str
    type: str
    kind: str = "COLUMN"
    nullable: bool = True
    default: Optional[str] = None
    primary_key: bool = False
    unique_key: bool = False
    comment: Optional[str] = None

    class Config:
        extra = "ignore"


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
    execution_time_ms: Optional[int] = None
    row_count: Optional[int] = None


class QueryStatusResponse(BaseModel):
    """Query status check response."""
    query_id: str
    status: QueryStatus
    row_count: Optional[int] = None
    execution_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class QueryResultsResponse(BaseModel):
    """Paginated query results."""
    columns: List[str]
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
    status: str
    row_count: Optional[int] = None
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_ms: Optional[int] = None


class QueryHistoryResponse(BaseModel):
    """Query history list response."""
    items: List[QueryHistoryItem]
    total: int
    limit: int
    offset: int


class CancelQueryResponse(BaseModel):
    """Response after cancelling a query."""
    message: str
    query_id: str
