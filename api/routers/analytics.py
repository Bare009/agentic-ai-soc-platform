"""
Analytics router — time-series and distribution data for the Analytics tab
(native Recharts on the frontend; Grafana handles infra metrics separately).
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Query

from api.services import metrics
from api.services.common import DEFAULT_WINDOW, WINDOWS, window_start_iso
from common.database import get_mongo_db

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/alert-volume")
async def alert_volume(window: str = Query(DEFAULT_WINDOW, enum=list(WINDOWS.keys()))):
    """Alert volume over time, stacked by severity."""
    db = get_mongo_db()
    series = await metrics.alert_volume_series(db, window)
    totals = {
        "total": sum(b["total"] for b in series),
        "peak": max((b["total"] for b in series), default=0),
        "avg": round(sum(b["total"] for b in series) / len(series), 1) if series else 0,
    }
    return {"window": window, "series": series, "totals": totals}


@router.get("/verdicts")
async def verdict_distribution(window: str = Query(DEFAULT_WINDOW, enum=list(WINDOWS.keys()))):
    """Verdict distribution over the window."""
    db = get_mongo_db()
    return {"window": window, "verdicts": await metrics.verdict_counts(db, window)}


@router.get("/resolution")
async def resolution_stats(window: str = Query(DEFAULT_WINDOW, enum=list(WINDOWS.keys()))):
    """
    Auto-resolved vs. pending-human split, and average pipeline processing time
    (created_at -> updated_at) as a lightweight MTTR proxy.
    """
    db = get_mongo_db()
    since = window_start_iso(window)

    auto_resolved = await db.cases.count_documents(
        {"created_at": {"$gte": since}, "approval.status": "auto_approved"})
    pending_human = await db.cases.count_documents(
        {"created_at": {"$gte": since}, "status": "pending_approval"})
    closed = await db.cases.count_documents(
        {"created_at": {"$gte": since}, "status": "closed"})

    # Average processing time across cases that have both timestamps.
    durations: list[float] = []
    cursor = db.cases.find(
        {"created_at": {"$gte": since}},
        {"_id": 0, "created_at": 1, "updated_at": 1},
    )
    async for doc in cursor:
        try:
            c = datetime.fromisoformat(doc["created_at"])
            u = datetime.fromisoformat(doc["updated_at"])
            durations.append((u - c).total_seconds())
        except (ValueError, TypeError, KeyError):
            continue

    avg_seconds = round(sum(durations) / len(durations), 1) if durations else 0.0
    return {
        "window": window,
        "auto_resolved": auto_resolved,
        "pending_human": pending_human,
        "closed": closed,
        "avg_processing_seconds": avg_seconds,
        "sample_size": len(durations),
    }
