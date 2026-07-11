"""
Reusable MongoDB aggregations over the `cases` collection.

Shared by the dashboard, analytics, and agent-ops routers. Windowing uses the
ISO-string boundary described in common.py.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from api.services.common import severity_label, window_start_dt, window_start_iso


async def status_counts(db: AsyncIOMotorDatabase, window: str) -> dict[str, int]:
    pipeline = [
        {"$match": {"created_at": {"$gte": window_start_iso(window)}}},
        {"$group": {"_id": "$status", "n": {"$sum": 1}}},
    ]
    out: dict[str, int] = {}
    async for row in db.cases.aggregate(pipeline):
        out[row["_id"] or "unknown"] = row["n"]
    return out


async def verdict_counts(db: AsyncIOMotorDatabase, window: str) -> dict[str, int]:
    pipeline = [
        {"$match": {"created_at": {"$gte": window_start_iso(window)},
                    "investigation.verdict": {"$ne": None}}},
        {"$group": {"_id": "$investigation.verdict", "n": {"$sum": 1}}},
    ]
    out: dict[str, int] = {}
    async for row in db.cases.aggregate(pipeline):
        if row["_id"]:
            out[row["_id"]] = row["n"]
    return out


async def severity_counts(db: AsyncIOMotorDatabase, window: str) -> dict[str, int]:
    pipeline = [
        {"$match": {"created_at": {"$gte": window_start_iso(window)}}},
        {"$group": {
            "_id": {"$switch": {"branches": [
                {"case": {"$gte": ["$alert.rule_level", 12]}, "then": "critical"},
                {"case": {"$gte": ["$alert.rule_level", 8]}, "then": "high"},
                {"case": {"$gte": ["$alert.rule_level", 4]}, "then": "medium"},
            ], "default": "low"}},
            "n": {"$sum": 1},
        }},
    ]
    out = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    async for row in db.cases.aggregate(pipeline):
        out[row["_id"]] = row["n"]
    return out


async def top_assets(db: AsyncIOMotorDatabase, window: str, limit: int = 8) -> list[dict[str, Any]]:
    pipeline = [
        {"$match": {"created_at": {"$gte": window_start_iso(window)},
                    "alert.hostname": {"$nin": ["", None]}}},
        {"$group": {
            "_id": "$alert.hostname",
            "count": {"$sum": 1},
            "critical_high": {"$sum": {"$cond": [{"$gte": ["$alert.rule_level", 8]}, 1, 0]}},
        }},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    return [
        {"hostname": row["_id"], "count": row["count"], "critical_high": row["critical_high"]}
        async for row in db.cases.aggregate(pipeline)
    ]


async def alert_volume_series(db: AsyncIOMotorDatabase, window: str) -> list[dict[str, Any]]:
    """Time-bucketed alert volume stacked by severity (hourly for 24h, else daily)."""
    since = window_start_dt(window)
    by_hour = window == "24h"
    cursor = db.cases.find(
        {"created_at": {"$gte": since.isoformat()}},
        {"_id": 0, "created_at": 1, "alert.rule_level": 1},
    )
    buckets: dict[str, dict[str, Any]] = {}
    async for doc in cursor:
        raw = doc.get("created_at")
        try:
            dt = datetime.fromisoformat(raw)
        except (ValueError, TypeError):
            continue
        key = dt.strftime("%Y-%m-%dT%H:00") if by_hour else dt.strftime("%Y-%m-%d")
        b = buckets.setdefault(key, {"bucket": key, "critical": 0, "high": 0,
                                     "medium": 0, "low": 0, "total": 0})
        level = (doc.get("alert") or {}).get("rule_level", 0) or 0
        b[severity_label(level)] += 1
        b["total"] += 1
    return sorted(buckets.values(), key=lambda x: x["bucket"])


async def count_since(db: AsyncIOMotorDatabase, window: str, extra: dict | None = None) -> int:
    query: dict[str, Any] = {"created_at": {"$gte": window_start_iso(window)}}
    if extra:
        query.update(extra)
    return await db.cases.count_documents(query)
