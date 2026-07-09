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
