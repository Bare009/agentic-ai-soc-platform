import { useEffect, useState } from "react";
import { Bell, Download, Search } from "lucide-react";
import { Api } from "../api/client";
import type { CaseFilters } from "../api/client";
import { useApi } from "../hooks/useApi";
import {
  Card,
  ErrorState,
  PageHeader,
  SeverityBadge,
  Spinner,
  StatusBadge,
  VerdictBadge,
  WindowTabs,
} from "../components/primitives";
import CaseDrawer from "../components/CaseDrawer";
import { shortId, timeAgo } from "../lib/format";

const PAGE = 25;

const selectClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const STATUSES = [
  "ingested", "correlating", "enriching", "triaging", "investigating",
  "verifying", "remediating", "pending_approval", "reporting", "closed",
];

export default function Alerts() {
  const [window, setWindow] = useState("14d");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [verdict, setVerdict] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [skip, setSkip] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  // debounce search into q
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(searchInput);
      setSkip(0);
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  const filters: CaseFilters = { window, severity, status, source, verdict, q, skip, limit: PAGE };
  const { data, loading, error, refresh } = useApi(() => Api.listCases(filters), [
    window, severity, status, source, verdict, q, skip,
  ], 15000);
  const sources = useApi(() => Api.caseSources(window), [window]);

  const resetPage = () => setSkip(0);

  const handleExport = async () => {
    const res = await fetch(Api.exportUrl({ window, severity, status, source, verdict, q }));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai_soc_cases_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = data?.total || 0;
  const page = Math.floor(skip / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div>
      <PageHeader
        icon={<Bell className="h-5 w-5" />}
        title="Alerts"
        subtitle="Ingested alerts flowing through the agentic pipeline"
        actions={<WindowTabs value={window} onChange={setWindow} />}
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search alerts…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <select className={selectClass} value={severity} onChange={(e) => { setSeverity(e.target.value); resetPage(); }}>
            <option value="">Severity</option>
            {["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={selectClass} value={source} onChange={(e) => { setSource(e.target.value); resetPage(); }}>
            <option value="">Source</option>
            {(sources.data?.sources || []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={selectClass} value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
            <option value="">Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={selectClass} value={verdict} onChange={(e) => { setVerdict(e.target.value); resetPage(); }}>
            <option value="">Verdict</option>
            {["true_positive", "false_positive", "unverified", "rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Export JSON
          </button>
        </div>
      </Card>

      {error && <ErrorState message={error} />}

      <Card className="overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Severity</th>
                  <th className="px-4 py-3 font-semibold">Alert ID</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Source IP</th>
                  <th className="px-4 py-3 font-semibold">Confidence</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Verdict</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((c) => (
                  <tr
                    key={c.case_id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setSelected(c.case_id)}
                  >
                    <td className="px-4 py-3"><SeverityBadge severity={c.severity} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{shortId(c.case_id)}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-slate-700">{c.rule_description}</td>
                    <td className="px-4 py-3 text-slate-600">{c.hostname || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.source_ip || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round((c.confidence_score || 0) * 100)}%` }} />
                        </div>
                        <span className="text-xs text-slate-400">{Math.round((c.confidence_score || 0) * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3"><VerdictBadge verdict={c.verdict} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(c.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-brand-600">View</span>
                    </td>
                  </tr>
                ))}
                {data && data.items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-sm text-slate-400">
                      No alerts match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          <span>{total} alerts</span>
          <div className="flex items-center gap-3">
            <span>Page {page} of {pages}</span>
            <button
              disabled={skip === 0}
              onClick={() => setSkip(Math.max(0, skip - PAGE))}
              className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setSkip(skip + PAGE)}
              className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {selected && (
        <CaseDrawer caseId={selected} onClose={() => setSelected(null)} onActioned={refresh} />
      )}
    </div>
  );
}
