import { useState } from "react";
import { Database, Globe, ShieldAlert } from "lucide-react";
import { Api } from "../api/client";
import { useApi } from "../hooks/useApi";
import {
  Badge,
  Card,
  CriticalityBadge,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionLabel,
  Spinner,
  StatCard,
  WindowTabs,
} from "../components/primitives";
import CaseDrawer from "../components/CaseDrawer";
import { timeAgo, titleCase } from "../lib/format";

const FILTERS = [
  { key: "", label: "All enriched" },
  { key: "malicious", label: "Malicious IP" },
  { key: "critical", label: "Critical assets" },
];

export default function Enrichment() {
  const [window, setWindow] = useState("14d");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const summary = useApi(() => Api.enrichmentSummary(window), [window], 20000);
  const cases = useApi(() => Api.enrichmentCases(window, filter || undefined), [window, filter], 20000);

  return (
    <div>
      <PageHeader
        icon={<Database className="h-5 w-5" />}
        title="Enrichment"
        subtitle="Threat intel, asset criticality, and historical context added to each alert"
        actions={<WindowTabs value={window} onChange={setWindow} />}
      />

      {summary.error && <ErrorState message={summary.error} />}

      {/* summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Enriched Alerts" value={summary.data?.enriched_count ?? "—"} icon={<Database className="h-4 w-4" />} />
        <StatCard label="Malicious IP Alerts" value={summary.data?.malicious_ip_alerts ?? "—"} valueClass="text-rose-600" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="Critical Assets Hit" value={summary.data?.asset_criticality_breakdown?.critical ?? 0} valueClass="text-orange-600" />
        <StatCard label="High Assets Hit" value={summary.data?.asset_criticality_breakdown?.high ?? 0} valueClass="text-amber-600" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionLabel>Asset Criticality Breakdown</SectionLabel>
          <div className="mt-3 space-y-2">
            {summary.data ? (
              Object.entries(summary.data.asset_criticality_breakdown).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <CriticalityBadge criticality={k} />
                  <span className="text-sm font-medium text-slate-600">{v}</span>
                </div>
              ))
            ) : (
              <Spinner />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionLabel>Top Malicious Source IPs</SectionLabel>
          <div className="mt-3">
            {summary.data && summary.data.top_malicious_ips.length ? (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {summary.data.top_malicious_ips.map((ip) => (
                    <tr key={ip.source_ip}>
                      <td className="py-2 font-mono text-xs text-slate-600">{ip.source_ip}</td>
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Globe className="h-3 w-3" /> {ip.country || "—"}
                        </span>
                      </td>
                      <td className="py-2 text-right text-xs text-slate-500">{ip.pulse_count} pulses</td>
                      <td className="py-2 text-right text-sm font-medium text-slate-600">{ip.count}×</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState message="No malicious IPs detected (internal traffic isn't looked up)." />
            )}
          </div>
        </Card>
      </div>

      {/* filter chips */}
      <div className="mb-3 mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f.key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {cases.loading && !cases.data ? (
          <Spinner />
        ) : cases.data && cases.data.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Alert</th>
                  <th className="px-4 py-3 font-semibold">Source IP</th>
                  <th className="px-4 py-3 font-semibold">Threat Intel</th>
                  <th className="px-4 py-3 font-semibold">Asset</th>
                  <th className="px-4 py-3 font-semibold">History</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.data.items.map((c) => {
                  const otx = c.enrichment?.otx_reputation;
                  return (
                    <tr key={c.case_id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(c.case_id)}>
                      <td className="max-w-[240px] truncate px-4 py-3 text-slate-700">{c.rule_description}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.source_ip || "—"}</td>
                      <td className="px-4 py-3">
                        {otx ? (
                          otx.is_known_malicious ? (
                            <Badge className="bg-rose-50 text-rose-700 ring-1 ring-rose-200">Malicious · {otx.pulse_count}</Badge>
                          ) : (
                            <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Clean</Badge>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">n/a</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><CriticalityBadge criticality={c.enrichment?.asset_criticality || "unknown"} /></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{c.enrichment?.historical_case_count ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(c.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No enriched cases in this window." />
        )}
      </Card>

      {selected && <CaseDrawer caseId={selected} onClose={() => setSelected(null)} onActioned={cases.refresh} />}
    </div>
  );
}
