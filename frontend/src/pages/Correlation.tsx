import { useState } from "react";
import { Share2 } from "lucide-react";
import { Api } from "../api/client";
import { useApi } from "../hooks/useApi";
import type { CorrelationCluster } from "../api/types";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionLabel,
  SeverityBadge,
  Spinner,
  WindowTabs,
} from "../components/primitives";
import { timeAgo, titleCase } from "../lib/format";

function ClusterPanel({ caseId }: { caseId: string }) {
  const { data, loading } = useApi<CorrelationCluster>(() => Api.correlationCluster(caseId), [caseId]);
  if (loading && !data) return <Spinner />;
  if (!data) return <EmptyState message="No cluster data." />;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Badge className="bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          {titleCase(data.pattern_matched) || "No pattern"}
        </Badge>
        <span className="text-xs text-slate-400">
          {data.related_alert_count} related · window {data.time_window_minutes}m
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{data.details}</p>

      <div className="mt-4">
        <SectionLabel>Trigger Alert</SectionLabel>
        <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50/40 px-3 py-2">
          <div className="text-sm text-slate-800">{data.trigger.rule_description}</div>
          <div className="mt-1 font-mono text-xs text-slate-500">
            {data.trigger.source_ip || "—"} · {data.trigger.user || "—"} · {data.trigger.hostname || "—"}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <SectionLabel>Related Alerts ({data.members.length})</SectionLabel>
        <div className="mt-2 space-y-2">
          {data.members.length === 0 && <EmptyState message="No prior related alerts resolved." />}
          {data.members.map((m, i) => (
            <div key={i} className="flex items-start gap-3 border-l-2 border-slate-200 pl-3">
              <div className="flex-1">
                <div className="text-sm text-slate-700">{m.rule_description}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {m.event_classes.map((c) => (
                    <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right text-xs text-slate-400">{timeAgo(m.event_ts)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Correlation() {
  const [window, setWindow] = useState("14d");
  const [pattern, setPattern] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);

  const patterns = useApi(() => Api.correlationPatterns(window), [window], 20000);
  const cases = useApi(() => Api.correlationCases(window, pattern || undefined), [window, pattern], 20000);

  return (
    <div>
      <PageHeader
        icon={<Share2 className="h-5 w-5" />}
        title="Correlation"
        subtitle="Rules-based patterns linking related alerts across IP, user, and host"
        actions={<WindowTabs value={window} onChange={setWindow} />}
      />

      {patterns.error && <ErrorState message={patterns.error} />}

      {/* pattern chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => { setPattern(""); setSelected(null); }}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            pattern === "" ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          All · {patterns.data?.total_correlated ?? 0}
        </button>
        {patterns.data?.patterns.map((p) => (
          <button
            key={p.pattern}
            onClick={() => { setPattern(p.pattern); setSelected(null); }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              pattern === p.pattern ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {titleCase(p.pattern)} · {p.count}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* correlated cases list */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <SectionLabel>Correlated Cases</SectionLabel>
          </div>
          {cases.loading && !cases.data ? (
            <Spinner />
          ) : cases.data && cases.data.items.length ? (
            <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
              {cases.data.items.map((c) => (
                <button
                  key={c.case_id}
                  onClick={() => setSelected(c.case_id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${
                    selected === c.case_id ? "bg-brand-50/50" : ""
                  }`}
                >
                  <SeverityBadge severity={c.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-slate-700">{c.rule_description}</div>
                    <div className="truncate text-xs text-slate-400">
                      {titleCase(c.pattern_matched)} · {c.source_ip || c.hostname || "—"}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{timeAgo(c.created_at)}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState message="No correlated cases in this window." />
          )}
        </Card>

        {/* cluster detail */}
        <Card className="p-5">
          <SectionLabel>Alert Cluster</SectionLabel>
          <div className="mt-3">
            {selected ? (
              <ClusterPanel caseId={selected} />
            ) : (
              <EmptyState message="Select a correlated case to see its linked alert cluster." />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
