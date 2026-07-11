import { useState } from "react";
import { BarChart3 } from "lucide-react";
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
import { titleCase } from "../lib/format";

const VERDICT_COLORS: Record<string, string> = {
  true_positive: "#e11d48",
  false_positive: "#10b981",
  unverified: "#f59e0b",
  rejected: "#94a3b8",
};

export default function Analytics() {
  const [window, setWindow] = useState("14d");
  const volume = useApi(() => Api.alertVolume(window), [window]);
  const resolution = useApi(() => Api.resolution(window), [window]);
  const verdicts = useApi(() => Api.dashboardSummary(window), [window]);

  return (
    <div>
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Analytics"
        subtitle="Security analytics from case data · infra metrics live in Grafana"
        actions={<WindowTabs value={window} onChange={setWindow} />}
      />

      {volume.error && <ErrorState message={volume.error} />}

      <Card className="p-5">
        <SectionLabel>Alert Volume by Severity</SectionLabel>
        <div className="mt-3">
          {volume.loading && !volume.data ? (
            <Spinner />
          ) : volume.data && volume.data.series.length ? (
            <VolumeAreaChart data={volume.data.series} />
          ) : (
            <div className="py-16 text-center text-sm text-slate-400">No data in this window.</div>
          )}
        </div>
        {volume.data && (
          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
            <div className="text-center">
              <div className="text-2xl font-semibold text-slate-900">{volume.data.totals.total}</div>
              <div className="text-xs text-slate-400">Total this period</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-slate-900">{volume.data.totals.peak}</div>
              <div className="text-xs text-slate-400">Peak bucket</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-slate-900">{volume.data.totals.avg}</div>
              <div className="text-xs text-slate-400">Avg per bucket</div>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionLabel>Verdict Distribution</SectionLabel>
          <div className="mt-3">
            {verdicts.data ? (
              <DonutChart
                data={Object.entries(verdicts.data.verdict_breakdown).map(([k, v]) => ({
                  name: titleCase(k),
                  value: v,
                }))}
                colors={Object.keys(verdicts.data.verdict_breakdown).map(
                  (k) => VERDICT_COLORS[k] || "#94a3b8"
                )}
              />
            ) : (
              <Spinner />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionLabel>Resolution</SectionLabel>
          {resolution.data ? (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Auto-resolved" value={resolution.data.auto_resolved} valueClass="text-emerald-600" />
                <StatCard label="Pending Human" value={resolution.data.pending_human} valueClass="text-amber-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Closed" value={resolution.data.closed} />
                <StatCard
                  label="Avg Processing"
                  value={`${resolution.data.avg_processing_seconds}s`}
                  hint={`${resolution.data.sample_size} cases`}
                />
              </div>
            </div>
          ) : (
            <Spinner />
          )}
        </Card>
      </div>
    </div>
  );
}
