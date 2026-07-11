"""
Correlation router — surfaces the correlation engine's work: which patterns
fired, the cases they fired on, and the alert cluster behind each match.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from api.services.common import (
    DEFAULT_WINDOW,
    LIST_PROJECTION,
    WINDOWS,
    case_summary,
    window_start_iso,
)
from common.config import settings
from common.database import get_mongo_db

router = APIRouter(prefix="/api/v1/correlation", tags=["correlation"])

RECENT_ALERTS_COLLECTION = "recent_alerts"
_HAS_PATTERN = {"$nin": ["", None]}


@router.get("/patterns")
async def correlation_patterns(window: str = Query(DEFAULT_WINDOW, enum=list(WINDOWS.keys()))):
    """Count of cases per matched correlation pattern."""
    db = get_mongo_db()
    pipeline = [
        {"$match": {"created_at": {"$gte": window_start_iso(window)},
                    "correlation.pattern_matched": _HAS_PATTERN}},
        {"$group": {"_id": "$correlation.pattern_matched", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    patterns = [{"pattern": row["_id"], "count": row["count"]}
                async for row in db.cases.aggregate(pipeline)]
    total_correlated = sum(p["count"] for p in patterns)
    return {"window": window, "total_correlated": total_correlated, "patterns": patterns}


@router.get("/cases")
async def correlated_cases(
    window: str = Query(DEFAULT_WINDOW, enum=list(WINDOWS.keys())),
    pattern: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Cases that matched a correlation pattern (optionally a specific one)."""
    db = get_mongo_db()
    query: dict = {"created_at": {"$gte": window_start_iso(window)},
                   "correlation.pattern_matched": pattern if pattern else _HAS_PATTERN}

    total = await db.cases.count_documents(query)
    cursor = db.cases.find(query, LIST_PROJECTION).sort("created_at", -1).skip(skip).limit(limit)
    items = []
    async for doc in cursor:
        summary = case_summary(doc)
        corr = doc.get("correlation") or {}
        summary["correlation"] = {
            "related_alert_count": corr.get("related_alert_count", 0),
            "time_window_minutes": corr.get("time_window_minutes", 0),
            "details": corr.get("details", ""),
        }
        items.append(summary)
    return {"total": total, "skip": skip, "limit": limit, "items": items}


@router.get("/{case_id}/cluster")
async def correlation_cluster(case_id: str):
    """
    The alert cluster behind a correlation match: the trigger alert, the shared
    entity, and the related prior alerts (resolved from recent_alerts).
    """
    db = get_mongo_db()
    case = await db.cases.find_one({"case_id": case_id}, {"_id": 0, "alert": 1, "correlation": 1})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    correlation = case.get("correlation") or {}
    alert = case.get("alert") or {}
    related_ids = correlation.get("related_alert_ids", [])

    members = []
    if related_ids:
        cursor = db[RECENT_ALERTS_COLLECTION].find(
            {"alert_id": {"$in": related_ids}}, {"_id": 0}
        ).sort("event_ts", 1)
        members = [doc async for doc in cursor]

    return {
        "case_id": case_id,
        "pattern_matched": correlation.get("pattern_matched", ""),
        "time_window_minutes": correlation.get("time_window_minutes", 0),
        "related_alert_count": correlation.get("related_alert_count", 0),
        "details": correlation.get("details", ""),
        "trigger": {
            "alert_id": alert.get("alert_id", ""),
            "source_ip": alert.get("source_ip", ""),
            "user": alert.get("user", ""),
            "hostname": alert.get("hostname", ""),
            "rule_description": alert.get("rule_description", ""),
            "timestamp": alert.get("timestamp", ""),
        },
        "members": members,
        "config": {
            "brute_force_threshold": settings.brute_force_threshold,
            "brute_force_window_minutes": settings.brute_force_window_minutes,
            "priv_esc_window_minutes": settings.priv_esc_window_minutes,
        },
    }
