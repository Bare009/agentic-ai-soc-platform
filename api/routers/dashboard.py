"""
Dashboard router — the Security Overview counters and headline breakdowns.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from api.services import metrics
from api.services.common import DEFAULT_WINDOW, WINDOWS, OPEN_STATUSES
from common.database import get_mongo_db

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary(window: str = Query(DEFAULT_WINDOW, enum=list(WINDOWS.keys()))):
    """Top-row counters plus severity / status / verdict breakdowns and top assets."""
    db = get_mongo_db()

    statuses = await metrics.status_counts(db, window)
    verdicts = await metrics.verdict_counts(db, window)
    severities = await metrics.severity_counts(db, window)
    assets = await metrics.top_assets(db, window)

    total = sum(statuses.values())
    resolved = statuses.get("closed", 0)
    pending_approval = statuses.get("pending_approval", 0)
    in_progress = sum(n for s, n in statuses.items() if s in OPEN_STATUSES and s != "pending_approval")
    open_cases = total - resolved

    return {
        "window": window,
        "counters": {
            "total_alerts": total,
            "critical_high": severities.get("critical", 0) + severities.get("high", 0),
            "resolved": resolved,
            "open": open_cases,
            "in_progress": in_progress,
            "pending_approval": pending_approval,
            "true_positive": verdicts.get("true_positive", 0),
            "false_positive": verdicts.get("false_positive", 0),
        },
        "severity_breakdown": severities,
        "status_breakdown": statuses,
        "verdict_breakdown": verdicts,
        "top_assets": assets,
    }
