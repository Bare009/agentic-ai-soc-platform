"""
Cases router — powers the Alerts table (list/filter/search/paginate), the
case detail (drill-down used by Alerts and Agent Ops), JSON export, and the
interactive approve / reject / feedback actions.

In this platform every ingested alert becomes one case document, so "alerts"
and "cases" are the same records viewed differently.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from api.services.common import (
    DEFAULT_WINDOW,
    LIST_PROJECTION,
    WINDOWS,
    case_summary,
    clean_doc,
    severity_filter,
    window_start_iso,
)
from common.database import get_mongo_db

router = APIRouter(prefix="/api/v1/cases", tags=["cases"])

_EXPORT_CAP = 1000


def _build_query(
    window: Optional[str],
    severity: Optional[str],
    status: Optional[str],
    source: Optional[str],
    verdict: Optional[str],
    q: Optional[str],
) -> dict[str, Any]:
    query: dict[str, Any] = {}
    if window:
        query["created_at"] = {"$gte": window_start_iso(window)}
    if status:
        query["status"] = status
    if verdict:
        query["investigation.verdict"] = verdict
    if source:
        query["alert.hostname"] = source
    sev = severity_filter(severity)
    if sev:
        query["alert.rule_level"] = sev
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [
            {"alert.rule_description": rx},
            {"alert.user": rx},
            {"alert.source_ip": rx},
            {"alert.hostname": rx},
            {"case_id": rx},
            {"alert.alert_id": rx},
        ]
    return query


@router.get("")
async def list_cases(
    window: str = Query(DEFAULT_WINDOW, enum=list(WINDOWS.keys())),
    severity: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    verdict: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=200),
):
    """Filtered, paginated list of case summaries for the Alerts table."""
    db = get_mongo_db()
    query = _build_query(window, severity, status, source, verdict, q)

    total = await db.cases.count_documents(query)
    cursor = (
        db.cases.find(query, LIST_PROJECTION)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    items = [case_summary(doc) async for doc in cursor]
    return {"total": total, "skip": skip, "limit": limit, "items": items}


@router.get("/sources")
async def list_sources(window: str = Query(DEFAULT_WINDOW, enum=list(WINDOWS.keys()))):
    """Distinct source hostnames in the window (for the Source filter dropdown)."""
    db = get_mongo_db()
    sources = await db.cases.distinct("alert.hostname", {"created_at": {"$gte": window_start_iso(window)}})
    return {"sources": sorted(s for s in sources if s)}


@router.get("/export")
async def export_cases(
    window: str = Query(DEFAULT_WINDOW, enum=list(WINDOWS.keys())),
    severity: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    verdict: Optional[str] = None,
    q: Optional[str] = None,
):
    """Export the filtered cases as a JSON array (capped)."""
    db = get_mongo_db()
    query = _build_query(window, severity, status, source, verdict, q)
    cursor = db.cases.find(query, {"_id": 0}).sort("created_at", -1).limit(_EXPORT_CAP)
    return {"count": 0, "cases": [doc async for doc in cursor]}


@router.get("/{case_id}")
async def get_case(case_id: str):
    """Full case document (all pipeline stages) for the drill-down view."""
    db = get_mongo_db()
    doc = await db.cases.find_one({"case_id": case_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Case not found")
    return clean_doc(doc)


# ---------------------------------------------------------------------------
# Interactive actions
# ---------------------------------------------------------------------------

class ApprovalDecision(BaseModel):
    decided_by: str = "analyst"
    note: str = ""


class FeedbackBody(BaseModel):
    corrected_verdict: Optional[str] = None  # e.g. "false_positive"
    note: str = ""


async def _require_case(db, case_id: str) -> dict[str, Any]:
    doc = await db.cases.find_one({"case_id": case_id}, {"_id": 0, "status": 1, "approval": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Case not found")
    return doc


@router.post("/{case_id}/approve")
async def approve_case(case_id: str, decision: ApprovalDecision):
    """Approve a case's pending destructive remediation (human-in-the-loop gate)."""
    db = get_mongo_db()
    doc = await _require_case(db, case_id)
    if doc.get("status") != "pending_approval":
        raise HTTPException(status_code=409, detail="Case is not pending approval")

    now = datetime.now(timezone.utc).isoformat()
    await db.cases.update_one(
        {"case_id": case_id},
        {"$set": {
            "approval.status": "approved",
            "approval.decided_at": now,
            "approval.decided_by": decision.decided_by,
            "approval.note": decision.note,
            "status": "closed",
            "updated_at": now,
        }},
    )
    return {"case_id": case_id, "status": "closed", "approval": "approved"}


@router.post("/{case_id}/reject")
async def reject_case(case_id: str, decision: ApprovalDecision):
    """Reject a case's pending remediation — no action is taken, case closes."""
    db = get_mongo_db()
    doc = await _require_case(db, case_id)
    if doc.get("status") != "pending_approval":
        raise HTTPException(status_code=409, detail="Case is not pending approval")

    now = datetime.now(timezone.utc).isoformat()
    await db.cases.update_one(
        {"case_id": case_id},
        {"$set": {
            "approval.status": "rejected",
            "approval.decided_at": now,
            "approval.decided_by": decision.decided_by,
            "approval.note": decision.note,
            "status": "closed",
            "updated_at": now,
        }},
    )
    return {"case_id": case_id, "status": "closed", "approval": "rejected"}


@router.post("/{case_id}/feedback")
async def submit_feedback(case_id: str, body: FeedbackBody):
    """Record analyst feedback (e.g. Mark FP) for the RLHF/tuning loop."""
    db = get_mongo_db()
    await _require_case(db, case_id)

    now = datetime.now(timezone.utc).isoformat()
    updates: dict[str, Any] = {"analyst_feedback": body.note, "feedback_timestamp": now, "updated_at": now}
    if body.corrected_verdict:
        updates["analyst_corrected_verdict"] = body.corrected_verdict
    await db.cases.update_one({"case_id": case_id}, {"$set": updates})
    return {"case_id": case_id, "feedback_recorded": True}
