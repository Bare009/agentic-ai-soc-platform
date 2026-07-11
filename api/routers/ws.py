"""
Live WebSocket — powers the footer status bar (WS Connected | queue | rate |
model) and lightweight live refresh. Pushes a small stats payload on an
interval; the frontend also polls REST endpoints as a robust fallback.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from common.config import settings
from common.database import get_mongo_db, get_redis_client

logger = logging.getLogger("soc.api.ws")
router = APIRouter(tags=["ws"])

_PUSH_INTERVAL_SECONDS = 3.0


async def _collect_stats() -> dict:
    now = datetime.now(timezone.utc)
    queue_pending = dlq = None
    worker_ok = False
    try:
        redis = await get_redis_client()
        queue_pending = await redis.llen(settings.redis_queue_key)
        dlq = await redis.llen(settings.redis_dlq_key)
        beat = await redis.get(settings.worker_heartbeat_key)
        if beat:
            age = (now - datetime.fromisoformat(beat)).total_seconds()
            worker_ok = age <= settings.worker_heartbeat_stale_seconds
    except Exception:
        pass

    alerts_last_hour = None
    try:
        db = get_mongo_db()
        since = (now - timedelta(hours=1)).isoformat()
        alerts_last_hour = await db.cases.count_documents({"created_at": {"$gte": since}})
    except Exception:
        pass

    return {
        "connected": True,
        "queue_pending": queue_pending,
        "dlq": dlq,
        "alerts_last_hour": alerts_last_hour,
        "worker_ok": worker_ok,
        "model": settings.groq_model,
        "timestamp": now.isoformat(),
    }


@router.websocket("/api/v1/ws/live")
async def live_ws(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket client connected")
    try:
        while True:
            await websocket.send_json(await _collect_stats())
            await asyncio.sleep(_PUSH_INTERVAL_SECONDS)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as exc:  # noqa: BLE001
        logger.warning("WebSocket closed on error: %s", exc)
