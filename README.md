# Agentic AI SOC Platform

An Agentic AI–powered Security Operations Center (SOC) platform integrating Wazuh SIEM, rule-based correlation, threat intelligence enrichment, LangGraph multi-agent workflows, RAG-based security knowledge, human approval gates, and end-to-end observability for automated incident investigation and response.

## Architecture & Directory Structure

This repository uses a flat monorepo structure to easily manage the multiple independent services and components that make up the platform:

- `ingestion/`: FastAPI service for parsing and normalizing Wazuh JSON alerts.
- `correlation/`: Rule-based correlation engine and MongoDB interactions.
- `enrichment/`: Threat intelligence (AlienVault OTX), Asset Context, and Historical Lookup integrations.
- `agents/`: LangGraph sequential pipeline including Dispatcher, Triage, Investigation, Decision, Verification, Remediation, and Reporting agents.
- `rag/`: RAG knowledge layer interfacing with ChromaDB for MITRE ATT&CK, runbooks, and past cases.
- `common/`: Shared utilities (database connections, logging, configurations) and Pydantic data models.
- `infrastructure/`: Deployment and Operations files (NGINX config, PKI/OpenSSL scripts, Docker compose, Prometheus/Grafana configs).
- `docs/`: Documentation covering the system design, architecture diagrams, and API specifications.
- `tests/`: End-to-end integration and component unit tests.
- `.github/`: CI/CD workflows and actions.

## Running locally (development)

The main stack owns the shared `soc-network`, so no manual network setup is needed:

```bash
cp .env.example .env          # fill in keys as later phases need them
docker compose up --build -d  # ingestion (:8000), worker, redis, mongodb
curl -s http://localhost:8000/api/v1/health | python3 -m json.tool
```

### Driving the pipeline with realistic Wazuh alerts

Until the live Wazuh + Kali-agent setup is wired for the final demo (see
`infrastructure/wazuh/README.md`), the pipeline is developed and tested against
genuine Wazuh alert JSON sent over HTTP:

```bash
# Benign case (single failed login then success) — expect false positive
python tests/send_alerts.py alice

# Attack case (brute-force burst -> login -> sudo priv-esc, same IP/user)
python tests/send_alerts.py bob --count 6

# Send a single canonical fixture
python tests/send_alerts.py fixture sudo_privesc
```

Canonical single-event samples live in `tests/fixtures/` and double as
regression fixtures for the correlation, enrichment, and agent phases.

Verify alerts landed:

```bash
curl -s http://localhost:8000/api/v1/metrics | python3 -m json.tool
docker exec soc-mongodb mongosh --quiet --eval \
  "db=db.getSiblingDB('soc_platform'); db.cases.find().sort({created_at:-1}).limit(3).pretty()"
```
