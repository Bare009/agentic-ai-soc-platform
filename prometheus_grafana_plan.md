Analysis summary

  Your two concerns, resolved:

  1. "System Health cards → actual container status" → Already built and 
  working. api/services/health.py actively pings every service (Redis, Mongo,
  Qdrant, Ingestion, Groq, OTX) and reads the worker's Redis heartbeat. The page
  refreshes every 10s with real status/latency/queue/DLQ. Nothing to do here.
  (It uses app-level reachability pings rather than docker ps — which is
  actually the better choice: it proves services answer, and avoids mounting the
  Docker socket into the API.)
  2. "Where does Grafana go?" → You chose the right answer: a new 'Infra 
  Metrics' sidebar item, not the Analytics tab. Because the app's Analytics page
  already owns case data (verdicts, volume, resolution from MongoDB), Grafana
  should own the thing it's uniquely good at and the app doesn't have:
  time-series infra + pipeline metrics from Prometheus.

  The plan (both your choices locked in)

  Data flow: ingestion + worker + api expose /metrics → Prometheus (:9090)
  scrapes → Grafana (:3001) dashboards → embedded via iframe in the UI's new
  Infra Metrics page.

  4 work streams:

  1. Instrument with prometheus_client (shared common/metrics.py):
    - Counters: alerts received/parsed/dlq, cases by verdict, LLM calls by
  agent/outcome
    - Gauges: queue depth, DLQ depth (read from Redis at scrape time)
    - Histograms: pipeline duration, per-agent duration
    - Worker is non-HTTP → add start_http_server(9100); ingestion & api get
  /metrics endpoints
  2. Prometheus service — infrastructure/prometheus/prometheus.yml scraping the
  3 targets + compose service
  3. Grafana service — provisioned datasource + a soc_pipeline.json dashboard
  (Alerts/min, Queue depth, DLQ, Pipeline p50/p95 latency, LLM calls/errors,
  Verdict rate). Env set for anonymous view + iframe embedding.
  4. Frontend Infra Metrics page — InfraMetrics.tsx with a full-height Grafana
  iframe (kiosk mode) + route in App.tsx + nav item in Sidebar.tsx. Likely proxy
  Grafana through nginx (/grafana/) for same-origin cleanliness.

  Verification: all 3 /metrics endpoints return data → Prometheus targets UP →
  run send_alerts.py bob → Grafana panels move live → Infra Metrics tab renders
  the embedded dashboard.

  Two things worth flagging before I start:
  - Grafana iframe needs GF_SECURITY_ALLOW_EMBEDDING=true + anonymous viewer, or
  the iframe shows a login wall. I'll set that.
  - I'll keep the gauge collection non-blocking (scrape-time Redis read), so
  instrumentation never slows the worker loop.

  Want me to go ahead and build all four streams? I'll start with the
  instrumentation (common/metrics.py + wiring), since Prometheus/Grafana config
  depends on the endpoints existing. I'll retry the plan-file write and task
  list as the classifier recovers.