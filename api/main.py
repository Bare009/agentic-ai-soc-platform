"""
AI_SOC read/query API.

Serves the platform UI: dashboard, alerts/cases (with interactive approve /
reject / feedback), correlation, enrichment, agent ops, system health,
analytics, and a live WebSocket. Read-only over MongoDB/Redis except for the
explicit case-action endpoints. No auth in this phase (trusted local network).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import (
    agents,
    analytics,
    cases,
    correlation,
    dashboard,
    enrichment,
    system,
    ws,
)
from common.config import settings
from common.database import close_mongo, close_redis, get_redis_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("soc.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI_SOC API starting up...")
    await get_redis_client()
    yield
    logger.info("AI_SOC API shutting down...")
    await close_redis()
    await close_mongo()


app = FastAPI(
    title="AI_SOC Platform — API",
    description="Read/query API and case actions powering the AI_SOC dashboard UI.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(dashboard.router)
app.include_router(cases.router)
app.include_router(correlation.router)
app.include_router(enrichment.router)
app.include_router(agents.router)
app.include_router(system.router)
app.include_router(analytics.router)
app.include_router(ws.router)


@app.get("/api/v1/health", tags=["meta"])
async def health():
    """Liveness probe for the API itself."""
    return {"status": "healthy", "service": "ai_soc_api"}
