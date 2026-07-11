"""
Enrichment router — surfaces what the enrichment engine adds to each alert:
OTX threat-intel, asset criticality, and historical context.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from api.services.common import (
    DEFAULT_WINDOW,
    LIST_PROJECTION,
    WINDOWS,
    case_summary,
    window_start_iso,
)
from common.database import get_mongo_db

router = APIRouter(prefix="/api/v1/enrichment", tags=["enrichment"])


@router.get("/summary")
async def enrichment_summary(window: str = Query(DEFAULT_WINDOW, enum=list(WINDOWS.keys()))):
    """Aggregate enrichment insight: malicious IPs, asset criticality mix, top offenders."""
    db = get_mongo_db()
    since = window_start_iso(window)
    base = {"created_at": {"$gte": since}}

    enriched_count = await db.cases.count_documents({**base, "enrichment": {"$ne": None}})
    malicious_count = await db.cases.count_documents(
        {**base, "enrichment.otx_reputation.is_known_malicious": True})

    # Asset criticality distribution.
    crit_pipeline = [
        {"$match": base},
        {"$group": {"_id": "$enrichment.asset_criticality", "count": {"$sum": 1}}},
    ]
    criticality: dict[str, int] = {}
    async for row in db.cases.aggregate(crit_pipeline):
        criticality[row["_id"] or "unknown"] = row["count"]

    # Top malicious source IPs.
    ip_pipeline = [
        {"$match": {**base, "enrichment.otx_reputation.is_known_malicious": True,
                    "alert.source_ip": {"$nin": ["", None]}}},
        {"$group": {
            "_id": "$alert.source_ip",
            "count": {"$sum": 1},
            "pulse_count": {"$max": "$enrichment.otx_reputation.pulse_count"},
            "country": {"$first": "$enrichment.otx_reputation.country"},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_malicious_ips = [
        {"source_ip": row["_id"], "count": row["count"],
         "pulse_count": row.get("pulse_count", 0), "country": row.get("country", "")}
        async for row in db.cases.aggregate(ip_pipeline)
    ]

    return {
        "window": window,
        "enriched_count": enriched_count,
        "malicious_ip_alerts": malicious_count,
        "asset_criticality_breakdown": criticality,
        "top_malicious_ips": top_malicious_ips,
    }


@router.get("/cases")
async def enriched_cases(
    window: str = Query(DEFAULT_WINDOW, enum=list(WINDOWS.keys())),
    filter: Optional[str] = Query(None, description="'malicious' or 'critical' to narrow results"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Per-alert enrichment highlights (OTX, asset criticality, historical count)."""
    db = get_mongo_db()
    query: dict = {"created_at": {"$gte": window_start_iso(window)}, "enrichment": {"$ne": None}}
    if filter == "malicious":
        query["enrichment.otx_reputation.is_known_malicious"] = True
    elif filter == "critical":
        query["enrichment.asset_criticality"] = {"$in": ["critical", "high"]}

    total = await db.cases.count_documents(query)
    cursor = db.cases.find(query, LIST_PROJECTION).sort("created_at", -1).skip(skip).limit(limit)
    items = []
    async for doc in cursor:
        summary = case_summary(doc)
        enrichment = doc.get("enrichment") or {}
        summary["enrichment"] = {
            "otx_reputation": enrichment.get("otx_reputation"),
            "asset_criticality": enrichment.get("asset_criticality", "unknown"),
            "historical_case_count": enrichment.get("historical_case_count", 0),
        }
        items.append(summary)
    return {"total": total, "skip": skip, "limit": limit, "items": items}
