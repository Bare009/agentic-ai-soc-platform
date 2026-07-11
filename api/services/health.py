"""
Service health checks for the System Health tab.

Pings each platform dependency and reports status, latency, and endpoint in a
uniform shape. The worker is a non-HTTP process, so its liveness is read from
the Redis heartbeat it refreshes each loop. External deps (Groq, OTX) get a
light reachability probe with a short timeout.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from common.config import settings
from common.database import get_mongo_client, get_redis_client

_now_iso = lambda: datetime.now(timezone.utc).isoformat()


def _result(name: str, key: str, status: str, endpoint: str,
            description: str, latency_ms: float | None, extra: dict | None = None) -> dict[str, Any]:
    return {
        "name": name,
        "key": key,
        "status": status,  # "healthy" | "down"
        "endpoint": endpoint,
        "latency_ms": round(latency_ms, 1) if latency_ms is not None else None,
        "last_check": _now_iso(),
        "description": description,
        **(extra or {}),
    }


async def _check_redis() -> dict[str, Any]:
    start = time.perf_counter()
    try:
        client = await get_redis_client()
        await client.ping()
        latency = (time.perf_counter() - start) * 1000
        return _result("Redis", "redis", "healthy", settings.redis_url,
                       "Alert queue, DLQ, caches, and worker heartbeat.", latency)
    except Exception:
        return _result("Redis", "redis", "down", settings.redis_url,
                       "Alert queue, DLQ, caches, and worker heartbeat.", None)


async def _check_mongo() -> dict[str, Any]:
    start = time.perf_counter()
    try:
        await get_mongo_client().admin.command("ping")
        latency = (time.perf_counter() - start) * 1000
        return _result("MongoDB", "mongodb", "healthy", settings.mongo_url,
                       "Primary store for cases, alerts, and history.", latency)
    except Exception:
        return _result("MongoDB", "mongodb", "down", settings.mongo_url,
                       "Primary store for cases, alerts, and history.", None)


async def _check_qdrant() -> dict[str, Any]:
    endpoint = f"http://{settings.qdrant_host}:{settings.qdrant_port}"
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(f"{endpoint}/healthz")
            resp.raise_for_status()
        latency = (time.perf_counter() - start) * 1000
        return _result("Qdrant", "qdrant", "healthy", endpoint,
                       "Vector store for the RAG knowledge layer.", latency)
    except Exception:
        return _result("Qdrant", "qdrant", "down", endpoint,
                       "Vector store for the RAG knowledge layer.", None)


async def _check_ingestion() -> dict[str, Any]:
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(settings.ingestion_health_url)
            resp.raise_for_status()
        latency = (time.perf_counter() - start) * 1000
        return _result("Ingestion API", "ingestion", "healthy", settings.ingestion_health_url,
                       "FastAPI webhook receiving and normalizing Wazuh alerts.", latency)
    except Exception:
        return _result("Ingestion API", "ingestion", "down", settings.ingestion_health_url,
                       "FastAPI webhook receiving and normalizing Wazuh alerts.", None)


async def _check_worker() -> dict[str, Any]:
    """Worker liveness via the Redis heartbeat it refreshes each loop."""
    try:
        client = await get_redis_client()
        beat = await client.get(settings.worker_heartbeat_key)
        if not beat:
            return _result("Pipeline Worker", "worker", "down", "internal",
                           "Correlation, enrichment, and agentic pipeline runner.", None,
                           {"last_heartbeat": None})
        last = datetime.fromisoformat(beat)
        age = (datetime.now(timezone.utc) - last).total_seconds()
        status = "healthy" if age <= settings.worker_heartbeat_stale_seconds else "down"
        return _result("Pipeline Worker", "worker", status, "internal",
                       "Correlation, enrichment, and agentic pipeline runner.", None,
                       {"last_heartbeat": beat, "heartbeat_age_seconds": round(age, 1)})
    except Exception:
        return _result("Pipeline Worker", "worker", "down", "internal",
                       "Correlation, enrichment, and agentic pipeline runner.", None)


async def _check_url(name: str, key: str, url: str, description: str) -> dict[str, Any]:
    """Light reachability probe for an external dependency (no auth/quota use)."""
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            await client.get(url)
        latency = (time.perf_counter() - start) * 1000
        return _result(name, key, "healthy", url, description, latency)
    except Exception:
        return _result(name, key, "down", url, description, None)


async def get_system_health() -> dict[str, Any]:
    """Run all checks concurrently and return services + a summary."""
    checks = [
        _check_redis(),
        _check_mongo(),
        _check_qdrant(),
        _check_ingestion(),
        _check_worker(),
        _check_url("Groq LLM", "groq", "https://api.groq.com",
                   "External LLM inference backing the agent pipeline."),
        _check_url("AlienVault OTX", "otx", settings.otx_base_url,
                   "External threat-intelligence source for IP reputation."),
    ]
    services = await asyncio.gather(*checks)

    # Queue depth + DLQ (best-effort).
    queue_pending = dlq = None
    try:
        client = await get_redis_client()
        queue_pending = await client.llen(settings.redis_queue_key)
        dlq = await client.llen(settings.redis_dlq_key)
    except Exception:
        pass

    healthy = sum(1 for s in services if s["status"] == "healthy")
    return {
        "services": services,
        "summary": {
            "healthy": healthy,
            "total": len(services),
            "down": len(services) - healthy,
            "queue_pending": queue_pending,
            "dlq": dlq,
            "model": settings.groq_model,
        },
        "generated_at": _now_iso(),
    }
