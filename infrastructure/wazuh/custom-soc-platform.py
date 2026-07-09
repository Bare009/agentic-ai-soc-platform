#!/usr/bin/env python3
"""
Custom Wazuh integration — forwards alerts to the SOC Platform ingestion API.

Wazuh calls this script with:
  custom-soc-platform <alert_file> <api_key> <hook_url> [alert_format]

The alert_file contains the JSON alert. We POST it to our FastAPI endpoint.
Uses only stdlib (urllib) to avoid dependency issues inside the Wazuh container.
"""

import json
import sys
import os
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

# Logging to Wazuh's integration log
LOG_FILE = "/var/ossec/logs/integrations.log"


def log(msg: str):
    try:
        with open(LOG_FILE, "a") as f:
            f.write(f"custom-soc-platform: {msg}\n")
    except Exception:
        pass


def main():
    if len(sys.argv) < 4:
        log(f"ERROR: Expected 3+ args, got {len(sys.argv) - 1}")
        sys.exit(1)

    alert_file = sys.argv[1]
    api_key = sys.argv[2]
    hook_url = sys.argv[3]

    # Read the alert JSON from the temp file Wazuh created
    try:
        with open(alert_file, "r") as f:
            alert_data = json.load(f)
    except Exception as e:
        log(f"ERROR: Failed to read alert file {alert_file}: {e}")
        sys.exit(1)

    # POST to our ingestion endpoint
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    try:
        payload = json.dumps(alert_data).encode("utf-8")
        req = Request(hook_url, data=payload, headers=headers, method="POST")
        with urlopen(req, timeout=10) as resp:
            status = resp.getcode()
            body = resp.read().decode("utf-8")
            log(f"OK: status={status} response={body}")
    except HTTPError as e:
        log(f"ERROR: HTTP {e.code} — {e.read().decode('utf-8', errors='replace')}")
        sys.exit(1)
    except URLError as e:
        log(f"ERROR: Connection failed — {e.reason}")
        sys.exit(1)
    except Exception as e:
        log(f"ERROR: Unexpected — {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
