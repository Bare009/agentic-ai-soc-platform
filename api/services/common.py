"""
Shared helpers for the read API: time windows, severity mapping, and
Mongo-document serialization.

Note on timestamps: the pipeline writes case documents with
`model_dump(mode="json")`, so `created_at`/`updated_at` are ISO-8601 strings
(all UTC, `+00:00` offset). Lexicographic comparison of those strings is a
valid chronological comparison, so window filters use an ISO boundary string.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

# Supported dashboard/analytics windows.
WINDOWS: dict[str, timedelta] = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "14d": timedelta(days=14),
    "30d": timedelta(days=30),
}
DEFAULT_WINDOW = "14d"

# Non-terminal case statuses (still moving through the pipeline).
TERMINAL_STATUSES = {"closed"}
OPEN_STATUSES = {
    "ingested", "correlating", "enriching", "triaging", "investigating",
    "deciding", "verifying", "remediating", "pending_approval", "reporting",
}


def window_delta(window: str) -> timedelta:
    return WINDOWS.get(window, WINDOWS[DEFAULT_WINDOW])


def window_start_dt(window: str) -> datetime:
    return datetime.now(timezone.utc) - window_delta(window)


def window_start_iso(window: str) -> str:
    """ISO boundary string for filtering `cases.created_at` (a stored string)."""
    return window_start_dt(window).isoformat()


# ---------------------------------------------------------------------------
# Severity (derived from Wazuh rule level, always present on every alert)
# ---------------------------------------------------------------------------

def severity_label(level: int) -> str:
    if level >= 12:
        return "critical"
    if level >= 8:
        return "high"
    if level >= 4:
        return "medium"
    return "low"


# rule_level ranges per label, for building Mongo filters from a severity filter.
SEVERITY_RANGES: dict[str, dict[str, int]] = {
    "critical": {"$gte": 12},
    "high": {"$gte": 8, "$lte": 11},
    "medium": {"$gte": 4, "$lte": 7},
    "low": {"$lte": 3},
}


def severity_filter(severity: Optional[str]) -> Optional[dict[str, int]]:
    if not severity:
        return None
    return SEVERITY_RANGES.get(severity.lower())


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def clean_doc(doc: dict[str, Any]) -> dict[str, Any]:
    """Drop Mongo's ObjectId so the doc is JSON-serializable."""
    if doc and "_id" in doc:
        doc = {k: v for k, v in doc.items() if k != "_id"}
    return doc


def case_summary(doc: dict[str, Any]) -> dict[str, Any]:
    """Compact row for the Alerts table / list views (no heavy payloads)."""
    alert = doc.get("alert") or {}
    correlation = doc.get("correlation") or {}
    enrichment = doc.get("enrichment") or {}
    triage = doc.get("triage") or {}
    investigation = doc.get("investigation") or {}
    otx = enrichment.get("otx_reputation") or {}
    level = alert.get("rule_level", 0) or 0

    return {
        "case_id": doc.get("case_id", ""),
        "status": doc.get("status", ""),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
        "alert_id": alert.get("alert_id", ""),
        "timestamp": alert.get("timestamp", ""),
        "source_ip": alert.get("source_ip", ""),
        "dest_ip": alert.get("dest_ip", ""),
        "user": alert.get("user", ""),
        "hostname": alert.get("hostname", ""),
        "rule_id": alert.get("rule_id", ""),
        "rule_level": level,
        "severity": severity_label(level),
        "rule_description": alert.get("rule_description", ""),
        "pattern_matched": correlation.get("pattern_matched", ""),
        "asset_criticality": enrichment.get("asset_criticality", "unknown"),
        "otx_malicious": bool(otx.get("is_known_malicious", False)),
        "alert_type": triage.get("alert_type", ""),
        "verdict": investigation.get("verdict", ""),
        "confidence_score": investigation.get("confidence_score", 0),
        "final_severity": investigation.get("final_severity", 0),
    }


# Fields excluded from list queries to keep payloads small.
LIST_PROJECTION = {
    "alert.raw_payload": 0,
    "alert.full_log": 0,
}
