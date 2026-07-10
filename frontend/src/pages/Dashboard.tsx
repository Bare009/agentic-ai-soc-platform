import { useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, FolderOpen, ShieldAlert, ShieldCheck, Timer } from "lucide-react";
import { Api } from "../api/client";
import { useApi } from "../hooks/useApi";
import {
  Card,
  ErrorState,
  PageHeader,
  SectionLabel,
  Spinner,
  StatCard,
  WindowTabs,
} from "../components/primitives";
import { DonutChart, VolumeAreaChart } from "../components/charts";
import { SEVERITY_COLORS, titleCase } from "../lib/format";

export default function Dashboard() {
  const [window, setWindow] = useState("14d");
  const summary = useApi(() => Api.dashboardSummary(window), [window], 15000);
  const volume = useApi(() => Api.alertVolume(window), [window], 15000);

  return (
    <div>
      <PageHeader
        icon={<Activity className="h-5 w-5" />}
        title="Security Overview"
        subtitle="Real-time metrics · agentic pipeline status"
        actions={<WindowTabs value={window} onChange={setWindow} />}
      />

      {summary.error && <ErrorState message={summary.error} />}
      {summary.loading && !summary.data ? (
        <Spinner />
      ) : summary.data ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-4">
            <StatCard label="Total Alerts" value={summary.data.counters.total_alerts} icon={<AlertTriangle className="h-4 w-4" />} />
            <StatCard label="Critical / High" value={summary.data.counters.critical_high} valueClass="text-rose-600" icon={<ShieldAlert className="h-4 w-4" />} />
            <StatCard label="Resolved" value={summary.data.counters.resolved} valueClass="text-emerald-600" icon={<CheckCircle2 className="h-4 w-4" />} />
            <StatCard label="Open" value={summary.data.counters.open} icon={<FolderOpen className="h-4 w-4" />} />
            <StatCard label="In Progress" value={summary.data.counters.in_progress} valueClass="text-brand-600" icon={<Clock className="h-4 w-4" />} />
            <StatCard label="Pending Approval" value={summary.data.counters.pending_approval} valueClass="text-amber-600" icon={<Timer className="h-4 w-4" />} />
            <StatCard label="True Positive" value={summary.data.counters.true_positive} valueClass="text-rose-600" icon={<ShieldAlert className="h-4 w-4" />} />
            <StatCard label="False Positive" value={summary.data.counters.false_positive} valueClass="text-emerald-600" icon={<ShieldCheck className="h-4 w-4" />} />
          </div>

          <Card className="mt-4 p-5">
            <SectionLabel>Alert Volume</SectionLabel>
            <div className="mt-3">
              {volume.data && volume.data.series.length ? (
                <VolumeAreaChart data={volume.data.series} />
              ) : (
                <div className="py-16 text-center text-sm text-slate-400">No alert volume in this window.</div>
              )}
            </div>
          </Card>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <SectionLabel>Top Attacked Assets</SectionLabel>
              <div className="mt-3 space-y-2">
                {summary.data.top_assets.length === 0 && (
                  <div className="py-10 text-center text-sm text-slate-400">No asset data available.</div>
                )}
                {summary.data.top_assets.map((a) => {
                  const max = summary.data!.top_assets[0].count || 1;
                  return (
                    <div key={a.hostname} className="flex items-center gap-3">
                      <div className="w-40 shrink-0 truncate text-sm text-slate-700">{a.hostname}</div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${(a.count / max) * 100}%` }} />
                      </div>
                      <div className="w-10 shrink-0 text-right text-sm font-medium text-slate-600">{a.count}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-5">
              <SectionLabel>Severity Breakdown</SectionLabel>
              <div className="mt-3">
                <DonutChart
                  data={["critical", "high", "medium", "low"].map((k) => ({
                    name: titleCase(k),
                    value: summary.data!.severity_breakdown[k] || 0,
                  }))}
                  colors={["critical", "high", "medium", "low"].map((k) => SEVERITY_COLORS[k])}
                />
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
