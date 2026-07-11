"""
Prometheus metrics for the Agentic AI SOC Platform.

Shared instrumentation imported by all services (ingestion, API, worker).
Queue-depth gauges use a custom collector so they read Redis at scrape time
rather than on every event — this keeps the worker loop untouched and
non-blocking.

Usage
-----
- FastAPI services: mount ``get_metrics_app()`` at ``/metrics``
- Worker (non-HTTP): call ``setup_http_metrics_server(port)`` once at startup
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from prometheus_client import (
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
    start_http_server,
    CONTENT_TYPE_LATEST,
    REGISTRY,
)

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import Response

logger = logging.getLogger("soc.metrics")

# ---------------------------------------------------------------------------
# Counters
# ---------------------------------------------------------------------------

ALERTS_RECEIVED = Counter(
    "soc_alerts_received_total",
    "Total alerts received by the ingestion service.",
)

ALERTS_PARSED = Counter(
    "soc_alerts_parsed_total",
    "Alerts successfully normalized and queued.",
)

ALERTS_DLQ = Counter(
    "soc_alerts_dlq_total",
    "Alerts routed to the Dead Letter Queue.",
)

CASES_TOTAL = Counter(
    "soc_cases_total",
    "Cases created, labelled by verdict.",
    ["verdict"],
)

LLM_CALLS = Counter(
    "soc_llm_calls_total",
    "LLM invocations by agent node and outcome.",
    ["agent", "outcome"],
)

# ---------------------------------------------------------------------------
# Gauges (updated at scrape time via the ASGI endpoint / HTTP server)
# ---------------------------------------------------------------------------

QUEUE_DEPTH = Gauge(
    "soc_queue_depth",
    "Current depth of a Redis queue.",
    ["queue"],
)

# ---------------------------------------------------------------------------
# Histograms
# ---------------------------------------------------------------------------

PIPELINE_DURATION = Histogram(
    "soc_pipeline_duration_seconds",
    "End-to-end case processing time (correlation → reporting).",
    buckets=(0.5, 1, 2, 5, 10, 20, 30, 60, 120),
)

AGENT_DURATION = Histogram(
    "soc_agent_duration_seconds",
    "Per-agent-node processing time.",
    ["agent"],
    buckets=(0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30),
)

# ---------------------------------------------------------------------------
# Queue-depth refresh (called before generating /metrics output)
# ---------------------------------------------------------------------------

# The Redis client is resolved lazily — each service sets this once at
# startup so the scrape handler can read queue lengths without importing
# database.py at module level (which would trigger connection init).
_redis_getter = None


def set_redis_getter(fn):
    """Register a zero-arg callable that returns the async Redis client."""
    global _redis_getter
    _redis_getter = fn


async def _refresh_queue_gauges() -> None:
    """Read current queue depths from Redis and update Prometheus gauges."""
    if _redis_getter is None:
        return
    try:
        redis = await _redis_getter()
        from common.config import settings
        incoming = await redis.llen(settings.redis_queue_key)
        dlq = await redis.llen(settings.redis_dlq_key)
        QUEUE_DEPTH.labels(queue="incoming").set(incoming)
        QUEUE_DEPTH.labels(queue="dlq").set(dlq)
    except Exception:
        logger.debug("Failed to refresh queue gauges", exc_info=True)


# ---------------------------------------------------------------------------
# FastAPI / Starlette metrics endpoint
# ---------------------------------------------------------------------------

def get_metrics_app():
    """
    Return a Starlette ASGI app that serves ``/metrics`` in Prometheus format.

    Mount this on your FastAPI app::

        from common.metrics import get_metrics_app
        app.mount("/metrics", get_metrics_app())
    """
    from starlette.applications import Starlette
    from starlette.responses import Response
    from starlette.routing import Route

    async def metrics_endpoint(request: "Request") -> "Response":
        await _refresh_queue_gauges()
        body = generate_latest(REGISTRY)
        return Response(content=body, media_type=CONTENT_TYPE_LATEST)

    return Starlette(routes=[Route("/", metrics_endpoint)])


# ---------------------------------------------------------------------------
# Standalone HTTP server (for the worker, which has no ASGI framework)
# ---------------------------------------------------------------------------

def setup_http_metrics_server(port: int = 9100) -> None:
    """
    Start a background HTTP server on *port* that serves ``/metrics``.

    Uses ``prometheus_client.start_http_server`` which spawns a daemon thread.
    Call once at worker startup before entering the main loop.

    Note: the default ``start_http_server`` doesn't call our async
    ``_refresh_queue_gauges``, so the worker additionally calls
    ``sync_refresh_queue_gauges()`` in its main loop.
    """
    start_http_server(port)
    logger.info("Prometheus metrics server started on :%d", port)


def sync_refresh_queue_gauges() -> None:
    """
    Synchronously refresh queue gauges.

    The worker calls this in its asyncio loop so the standalone HTTP server
    has up-to-date gauge values when Prometheus scrapes.
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_refresh_queue_gauges())
    except RuntimeError:
        pass  # no running loop — skip silently
