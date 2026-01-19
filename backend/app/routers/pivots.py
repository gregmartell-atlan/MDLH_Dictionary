"""Pivot feedback endpoints."""

import os
import re
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Header, HTTPException
from app.services.session import session_manager
from app.models.pivots import PivotFeedbackRequest, PivotFeedbackResponse, PivotFeedbackSummary
from app.utils.logger import logger

router = APIRouter(prefix="/api/pivots", tags=["pivots"])

_IDENTIFIER_PATTERN = re.compile(r'^[A-Za-z_][A-Za-z0-9_$]*$')


def _get_session_or_401(session_id: Optional[str]):
    if not session_id:
        raise HTTPException(status_code=401, detail="Missing session ID")
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Session not found")
    return session


def _quote_identifier(name: str) -> str:
    if not name:
        return name
    if _IDENTIFIER_PATTERN.match(name):
        return name
    return '"' + name.replace('"', '""') + '"'


def _resolve_feedback_target(session) -> tuple[str, str]:
    env_db = os.getenv("MDLH_FEEDBACK_DB")
    env_schema = os.getenv("MDLH_FEEDBACK_SCHEMA")
    database = env_db or getattr(session, "database", None) or "FIELD_METADATA"
    schema = env_schema or getattr(session, "schema", None) or "PUBLIC"
    return database, schema


def _ensure_feedback_table(cursor, database: str, schema: str):
    safe_db = _quote_identifier(database)
    safe_schema = _quote_identifier(schema)
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {safe_db}.{safe_schema}.MDLH_PIVOT_FEEDBACK (
            FEEDBACK_ID STRING,
            PIVOT_ID STRING,
            RATING NUMBER,
            HELPFUL BOOLEAN,
            COMMENT STRING,
            CONTEXT_DATABASE STRING,
            CONTEXT_SCHEMA STRING,
            CONTEXT_TABLE STRING,
            QUERY_ID STRING,
            SQL_TEXT STRING,
            METADATA VARIANT,
            USER_NAME STRING,
            CREATED_AT TIMESTAMP_LTZ
        )
    """)


@router.post("/feedback", response_model=PivotFeedbackResponse)
async def submit_feedback(
    request: PivotFeedbackRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    session = _get_session_or_401(x_session_id)
    database, schema = _resolve_feedback_target(session)
    feedback_id = str(uuid.uuid4())

    try:
        cursor = session.conn.cursor()
        _ensure_feedback_table(cursor, database, schema)

        cursor.execute(
            f"""
            INSERT INTO {_quote_identifier(database)}.{_quote_identifier(schema)}.MDLH_PIVOT_FEEDBACK (
                FEEDBACK_ID,
                PIVOT_ID,
                RATING,
                HELPFUL,
                COMMENT,
                CONTEXT_DATABASE,
                CONTEXT_SCHEMA,
                CONTEXT_TABLE,
                QUERY_ID,
                SQL_TEXT,
                METADATA,
                USER_NAME,
                CREATED_AT
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, PARSE_JSON(%s), %s, %s)
            """,
            (
                feedback_id,
                request.pivot_id,
                request.rating,
                request.helpful,
                request.comment,
                request.context_database,
                request.context_schema,
                request.context_table,
                request.query_id,
                request.sql,
                request.metadata or "{}",
                getattr(session, "user", None),
                datetime.utcnow(),
            ),
        )
        cursor.close()
    except Exception as exc:
        logger.error(f"Pivot feedback insert failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to store feedback") from exc

    return PivotFeedbackResponse(feedback_id=feedback_id, status="stored")


@router.get("/feedback/summary", response_model=List[PivotFeedbackSummary])
async def feedback_summary(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
):
    session = _get_session_or_401(x_session_id)
    database, schema = _resolve_feedback_target(session)
    try:
        cursor = session.conn.cursor()
        _ensure_feedback_table(cursor, database, schema)
        cursor.execute(
            f"""
            SELECT
                PIVOT_ID,
                COUNT(*) AS TOTAL_FEEDBACK,
                AVG(RATING) AS AVG_RATING,
                SUM(CASE WHEN HELPFUL = TRUE THEN 1 ELSE 0 END) AS HELPFUL_COUNT,
                MAX(CREATED_AT) AS LAST_FEEDBACK_AT
            FROM {_quote_identifier(database)}.{_quote_identifier(schema)}.MDLH_PIVOT_FEEDBACK
            GROUP BY 1
            ORDER BY TOTAL_FEEDBACK DESC
            """
        )
        rows = cursor.fetchall()
        cursor.close()
    except Exception as exc:
        logger.error(f"Pivot feedback summary failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load feedback summary") from exc

    summaries = []
    for row in rows:
        summaries.append(PivotFeedbackSummary(
            pivot_id=row[0],
            total_feedback=row[1] or 0,
            avg_rating=float(row[2]) if row[2] is not None else None,
            helpful_count=row[3] or 0,
            last_feedback_at=row[4].isoformat() if row[4] else None
        ))
    return summaries
