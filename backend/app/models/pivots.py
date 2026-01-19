"""Pydantic models for pivot feedback APIs."""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, conint


class PivotFeedbackRequest(BaseModel):
    pivot_id: str = Field(..., description="Pivot identifier")
    rating: Optional[conint(ge=1, le=5)] = Field(None, description="1-5 rating")
    helpful: Optional[bool] = Field(None, description="Whether result was helpful")
    comment: Optional[str] = Field(None, description="User feedback text")
    context_database: Optional[str] = Field(None, description="Database context")
    context_schema: Optional[str] = Field(None, description="Schema context")
    context_table: Optional[str] = Field(None, description="Table context")
    query_id: Optional[str] = Field(None, description="Backend query id")
    sql: Optional[str] = Field(None, description="SQL executed")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class PivotFeedbackResponse(BaseModel):
    feedback_id: str
    status: str


class PivotFeedbackSummary(BaseModel):
    pivot_id: str
    total_feedback: int
    avg_rating: Optional[float] = None
    helpful_count: int
    last_feedback_at: Optional[str] = None
