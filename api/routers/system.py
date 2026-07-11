"""
System Health router — up/down status of every platform container plus
external dependencies, with queue depth and the worker heartbeat.
"""

from __future__ import annotations

import re

from fastapi import APIRouter, Request

from api.services.health import get_system_health

router = APIRouter(prefix="/api/v1/system", tags=["system"])


@router.get("/health")
async def system_health():
    """Live health of all services for the System Health tab."""
    return await get_system_health()


@router.get("/mtls")
async def mtls_status(request: Request):
    """
    Report the caller's mutual-TLS state, derived from the client-cert headers
    the gateway forwards ($ssl_client_verify / $ssl_client_s_dn). Used by the UI
    to show whether the analyst presented a valid client certificate.

    The gateway overwrites these headers on every request, so they can't be
    spoofed through it. When the API is hit directly (bypassing the gateway) the
    headers are absent -> behind_gateway=False.
    """
    verify = request.headers.get("x-ssl-client-verify", "") or ""
    dn = request.headers.get("x-ssl-client-dn", "") or ""

    common_name = ""
    match = re.search(r"CN\s*=\s*([^,/]+)", dn)
    if match:
        common_name = match.group(1).strip()

    return {
        "client_cert_present": verify.upper() == "SUCCESS",
        "verify": verify or "NONE",
        "common_name": common_name,
        "subject_dn": dn,
        "behind_gateway": bool(verify),
    }
