"""
System Health router — up/down status of every platform container plus
external dependencies, with queue depth and the worker heartbeat.
"""

from __future__ import annotations

from fastapi import APIRouter

from api.services.health import get_system_health

router = APIRouter(prefix="/api/v1/system", tags=["system"])


@router.get("/health")
async def system_health():
    """Live health of all services for the System Health tab."""
    return await get_system_health()
