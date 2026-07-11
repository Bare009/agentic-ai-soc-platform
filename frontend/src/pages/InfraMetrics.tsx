import { useState } from "react";

/**
 * Infra Metrics page — embeds the Grafana SOC Pipeline dashboard in kiosk mode.
 *
 * The iframe points to the nginx-proxied `/grafana/` path (same-origin) which
 * avoids CORS issues. Grafana is configured with anonymous viewing + embedding
 * enabled via environment variables in docker-compose.yml.
 */
export default function InfraMetrics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Grafana dashboard URL in kiosk mode (strips Grafana's own nav)
  const grafanaUrl =
    "/grafana/d/soc-pipeline/soc-pipeline-overview?orgId=1&kiosk&refresh=10s";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Infra Metrics
          </h1>
          <p className="text-sm text-slate-500">
            Real-time infrastructure &amp; pipeline metrics from Prometheus +
            Grafana
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/grafana/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Open in Grafana
          </a>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* Grafana iframe */}
      <div className="relative flex-1 min-h-0">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
              <p className="text-sm text-slate-500">Loading Grafana dashboard…</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="flex flex-col items-center gap-3 text-center max-w-md">
              <div className="rounded-full bg-red-50 p-3">
                <svg
                  className="h-6 w-6 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-slate-900">
                Grafana Unavailable
              </h2>
              <p className="text-sm text-slate-500">
                Could not load the Grafana dashboard. Make sure the Grafana
                service is running:{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                  docker compose up grafana -d
                </code>
              </p>
              <button
                onClick={() => {
                  setError(false);
                  setLoading(true);
                }}
                className="mt-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        <iframe
          src={grafanaUrl}
          title="SOC Pipeline Grafana Dashboard"
          className="h-full w-full border-0"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      </div>
    </div>
  );
}
