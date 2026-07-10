import { useState } from "react";
import { Bot } from "lucide-react";
import { Api } from "../api/client";
import { useApi } from "../hooks/useApi";
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionLabel,
  Spinner,
  StatCard,
  StatusBadge,
  VerdictBadge,
  WindowTabs,
} from "../components/primitives";
import CaseDrawer from "../components/CaseDrawer";
import { timeAgo } from "../lib/format";

export default function AgentOps() {
  const [window, setWindow] = useState("14d");
  const [selected, setSelected] = useState<string | null>(null);

  const overview = useApi(() => Api.agentsOverview(window), [window], 15000);
  const cases = useApi(() => Api.listCases({ window, limit: 30 }), [window], 15000);

  const sc = overview.data?.stage_counts;
  const verif = overview.data?.verification;

  return (
    <div>
      <PageHeader
        icon={<Bot className="h-5 w-5" />}
        title="Agent Ops"
        subtitle="The LangGraph agent pipeline: triage → investigation → verification → remediation → reporting"
        actions={<WindowTabs value={window} onChange={setWindow} />}
      />

      {overview.error && <ErrorState message={overview.error} />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Triaged" value={sc?.triaged ?? "—"} />
        <StatCard label="Investigated" value={sc?.investigated ?? "—"} />
        <StatCard label="Remediated" value={sc?.remediated ?? "—"} valueClass="text-brand-600" />
        <StatCard label="Reported" value={sc?.reported ?? "—"} valueClass="text-emerald-600" />
        <StatCard label="Pending Approval" value={sc?.pending_approval ?? "—"} valueClass="text-amber-600" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <SectionLabel>Verification Guard</SectionLabel>
          <div className="mt-3 flex items-center gap-6">
            <div>
              <div className="text-2xl font-semibold text-emerald-600">{verif?.verified ?? 0}</div>
              <div className="text-xs text-slate-400">Verified</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-rose-600">{verif?.rejected ?? 0}</div>
              <div className="text-xs text-slate-400">Rejected</div>
            </div>
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <SectionLabel>Verdict Breakdown</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-4">
            {overview.data &&
              Object.entries(overview.data.verdict_breakdown).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <VerdictBadge verdict={k} />
                  <span className="text-sm font-medium text-slate-600">{v}</span>
                </div>
              ))}
            {overview.data && Object.keys(overview.data.verdict_breakdown).length === 0 && (
              <span className="text-sm text-slate-400">No verdicts yet.</span>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <SectionLabel>Recent Cases — click to inspect the agent chain</SectionLabel>
      </div>
      <Card className="mt-2 overflow-hidden">
        {cases.loading && !cases.data ? (
          <Spinner />
        ) : cases.data && cases.data.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Alert</th>
                  <th className="px-4 py-3 font-semibold">Stage / Status</th>
                  <th className="px-4 py-3 font-semibold">Verdict</th>
                  <th className="px-4 py-3 font-semibold">Host</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.data.items.map((c) => (
                  <tr key={c.case_id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(c.case_id)}>
                    <td className="max-w-[280px] truncate px-4 py-3 text-slate-700">{c.rule_description}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3"><VerdictBadge verdict={c.verdict} /></td>
                    <td className="px-4 py-3 text-slate-600">{c.hostname || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No cases in this window." />
        )}
      </Card>

      {selected && <CaseDrawer caseId={selected} onClose={() => setSelected(null)} onActioned={cases.refresh} />}
    </div>
  );
}
