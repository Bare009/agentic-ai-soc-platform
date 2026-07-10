"""
Agent Ops router — the agentic pipeline view: aggregate stage/verdict stats and
the per-case ordered agent chain (dispatcher -> triage -> investigation ->
verification -> remediation -> approval -> reporting) with each agent's output.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from api.services import metrics
from api.services.common import DEFAULT_WINDOW, WINDOWS, window_start_iso
from common.database import get_mongo_db

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])

# The pipeline order, with the case field each stage writes.
_STAGES = [
    ("dispatcher", "Dispatcher", None, "Creates the case and initializes pipeline state."),
    ("triage", "Triage", "triage", "Classifies alert type and initial severity (LLM)."),
    ("investigation", "Investigation", "investigation", "Gathers evidence, matches MITRE, sets the verdict (LLM)."),
    ("verification", "Verification", "verification", "Independent hallucination/policy check on true positives (LLM)."),
    ("remediation", "Remediation", "remediation", "Drafts targeted response actions from the runbook (LLM)."),
    ("approval", "Approval", "approval", "Gates destructive actions for human sign-off."),
    ("reporting", "Reporting", "report", "Produces the analyst-facing incident report (LLM)."),
]


@router.get("/overview")
async def agents_overview(window: str = Query(DEFAULT_WINDOW, enum=list(WINDOWS.keys()))):
    """Aggregate pipeline health: statuses, verdicts, verification and remediation stats."""
    db = get_mongo_db()
    since = window_start_iso(window)
    base = {"created_at": {"$gte": since}}

    statuses = await metrics.status_counts(db, window)
    verdicts = await metrics.verdict_counts(db, window)

    # Verification pass/fail.
    verif_pipeline = [
        {"$match": {**base, "verification": {"$ne": None}}},
        {"$group": {"_id": "$verification.verified", "n": {"$sum": 1}}},
    ]
    verified = rejected = 0
    async for row in db.cases.aggregate(verif_pipeline):
        if row["_id"] in (True, "true", 1):
            verified += row["n"]
        else:
            rejected += row["n"]

    triaged = await db.cases.count_documents({**base, "triage": {"$ne": None}})
    investigated = await db.cases.count_documents({**base, "investigation": {"$ne": None}})
    remediated = await db.cases.count_documents({**base, "remediation": {"$ne": None}})
    reported = await db.cases.count_documents({**base, "report": {"$ne": None}})

    return {
        "window": window,
        "status_breakdown": statuses,
        "verdict_breakdown": verdicts,
        "verification": {"verified": verified, "rejected": rejected},
        "stage_counts": {
            "triaged": triaged,
            "investigated": investigated,
            "remediated": remediated,
            "reported": reported,
            "pending_approval": statuses.get("pending_approval", 0),
        },
    }


@router.get("/pipeline/{case_id}")
async def case_pipeline(case_id: str):
    """The ordered agent chain for one case, each stage flagged ran/pending with its output."""
    db = get_mongo_db()
    doc = await db.cases.find_one({"case_id": case_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Case not found")

    stages = []
    for key, label, field, description in _STAGES:
        output = doc.get(field) if field else None
        # Dispatcher always runs; other stages "ran" if their output exists.
        ran = True if field is None else output is not None
        stages.append({
            "key": key,
            "label": label,
            "description": description,
            "ran": ran,
            "output": output,
        })

    alert = doc.get("alert") or {}
    return {
        "case_id": case_id,
        "status": doc.get("status", ""),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
        "alert": {
            "alert_id": alert.get("alert_id", ""),
            "rule_description": alert.get("rule_description", ""),
            "source_ip": alert.get("source_ip", ""),
            "user": alert.get("user", ""),
            "hostname": alert.get("hostname", ""),
        },
        "stages": stages,
    }
