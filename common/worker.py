"""
Pipeline worker — the main processing loop.

Reads alerts from Redis (BRPOP), processes them through the pipeline,
and writes results to MongoDB. In Phase 0 this is a simple pass-through;
later phases add correlation, enrichment, and the agentic layer.
"""

import asyncio
import json
import logging
import signal
import sys
import time
from datetime import datetime, timezone

from common.config import settings
from common.database import (
    get_mongo_db,
    get_redis_client,
    close_mongo,
    close_redis,
)
from common.models import NormalizedAlert, EnrichedAlert, CaseDocument, CaseStatus
from correlation.engine import CorrelationEngine
from enrichment.engine import EnrichmentEngine
from agents.pipeline import build_pipeline, run_pipeline
from common.metrics import (
    ALERTS_DLQ,
    CASES_TOTAL,
    PIPELINE_DURATION,
    set_redis_getter,
    setup_http_metrics_server,
    sync_refresh_queue_gauges,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("soc.worker")

# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------

_shutdown_event = asyncio.Event()

# ---------------------------------------------------------------------------
# Pipeline stages (shared across the worker)
# ---------------------------------------------------------------------------

correlation_engine = CorrelationEngine()
enrichment_engine = EnrichmentEngine()


def _handle_signal(sig, frame):
    logger.info("Received signal %s — shutting down gracefully", sig)
    _shutdown_event.set()


# ---------------------------------------------------------------------------
# Pipeline processing (Phase 2: correlation)
# ---------------------------------------------------------------------------

async def process_alert(alert: NormalizedAlert) -> None:
    """
    Process a single alert through the pipeline.

    Correlation -> enrichment -> create case doc -> LangGraph agent pipeline.
    The agent pipeline updates the same case document in place as it progresses.
    """
    start_time = time.perf_counter()
    db = get_mongo_db()

    # --- Correlation ---
    correlation = await correlation_engine.correlate(alert)

    # --- Enrichment (runs after correlation; historical sees prior cases) ---
    enrichment = await enrichment_engine.enrich(alert)

    # Create the case document (before the agent pipeline runs, so historical
    # enrichment of subsequent alerts in the same incident can see it).
    case = CaseDocument(
        alert=alert,
        correlation=correlation,
        enrichment=enrichment,
        status=CaseStatus.ENRICHING,
    )
    await db.cases.insert_one(case.model_dump(mode="json"))
    otx = enrichment.otx_reputation
    logger.info(
        "Case %s | alert %s | rule='%s' level=%d | pattern=%s related=%d | asset=%s otx=%s hist=%d",
        case.case_id, alert.alert_id, alert.rule_description, alert.rule_level,
        correlation.pattern_matched or "none", correlation.related_alert_count,
        enrichment.asset_criticality,
        (f"malicious({otx.pulse_count})" if otx and otx.is_known_malicious
         else "clean" if otx else "n/a"),
        enrichment.historical_case_count,
    )

    # --- Agentic pipeline (isolated: a pipeline failure must not kill the worker) ---
    enriched = EnrichedAlert(alert=alert, correlation=correlation, enrichment=enrichment)
    try:
        final_state = await run_pipeline(enriched, case.case_id)
        report = final_state.get("report")
        verdict_label = report.verdict.value if report else "unknown"
        logger.info(
            "Case %s | pipeline done | stage=%s verdict=%s",
            case.case_id, final_state.get("current_stage", "?"),
            verdict_label,
        )
        CASES_TOTAL.labels(verdict=verdict_label).inc()
    except Exception as exc:  # noqa: BLE001 - never let one alert crash the loop
        logger.exception("Agent pipeline failed for case %s: %s", case.case_id, exc)
        CASES_TOTAL.labels(verdict="error").inc()
        await db.cases.update_one(
            {"case_id": case.case_id},
            {"$set": {"status": CaseStatus.CLOSED.value, "pipeline_error": str(exc)}},
        )

    PIPELINE_DURATION.observe(time.perf_counter() - start_time)


# ---------------------------------------------------------------------------
# Main worker loop
# ---------------------------------------------------------------------------

async def worker_loop():
    """
    Main loop: BRPOP from Redis, deserialize, process.

    Uses BRPOP with a 1-second timeout so the loop can check
    the shutdown event regularly.
    """
    redis = await get_redis_client()
    set_redis_getter(get_redis_client)
    db = get_mongo_db()

    logger.info(
        "Worker started — listening on Redis queue '%s'",
        settings.redis_queue_key,
    )

    while not _shutdown_event.is_set():
        try:
            # Refresh liveness heartbeat so the API's System Health tab can tell
            # the worker (a non-HTTP service) is alive. TTL is a few multiples of
            # the stale threshold so the key disappears if the worker dies.
            await redis.set(
                settings.worker_heartbeat_key,
                datetime.now(timezone.utc).isoformat(),
                ex=settings.worker_heartbeat_stale_seconds * 3,
            )

            # BRPOP blocks until an item is available (with timeout)
            result = await redis.brpop(
                settings.redis_queue_key,
                timeout=int(settings.worker_poll_interval),
            )

            if result is None:
                # Timeout — no items in queue, loop back
                continue

            _queue_name, raw_payload = result
            logger.info("Received alert from Redis queue")

            try:
                alert_data = json.loads(raw_payload)
                alert = NormalizedAlert(**alert_data)
            except (json.JSONDecodeError, Exception) as parse_err:
                # Failed to parse — send to DLQ
                logger.error("Failed to parse alert: %s", parse_err)
                dlq_entry = json.dumps({
                    "raw_payload": raw_payload,
                    "error": str(parse_err),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                await redis.lpush(settings.redis_dlq_key, dlq_entry)
                ALERTS_DLQ.inc()
                logger.warning("Alert sent to DLQ: %s", settings.redis_dlq_key)
                continue

            # Process through the pipeline
            await process_alert(alert)

            # Refresh queue depth gauges for Prometheus scraping
            sync_refresh_queue_gauges()

        except asyncio.CancelledError:
            logger.info("Worker loop cancelled")
            break
        except Exception as exc:
            logger.exception("Unexpected error in worker loop: %s", exc)
            await asyncio.sleep(2)  # Back off on unexpected errors


async def main():
    """Entry point for the worker service."""
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    logger.info("Starting SOC Pipeline Worker...")

    try:
        setup_http_metrics_server(9100)
        await correlation_engine.initialize()
        await enrichment_engine.initialize()
        build_pipeline()  # compile the agent graph once up front
        await worker_loop()
    finally:
        logger.info("Cleaning up connections...")
        await close_redis()
        await close_mongo()
        logger.info("Worker shut down cleanly")


if __name__ == "__main__":
    asyncio.run(main())
