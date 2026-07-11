import { useState } from "react";
import type { ReactNode } from "react";
import { Check, ThumbsDown, X } from "lucide-react";
import { Api } from "../api/client";
import { useApi } from "../hooks/useApi";
import type { CaseDetail } from "../api/types";
import {
  Badge,
  CriticalityBadge,
  SectionLabel,
  Spinner,
  StatusBadge,
  VerdictBadge,
} from "./primitives";
import { timeAgo, titleCase } from "../lib/format";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm text-slate-700">{value ?? "—"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function CaseDrawer({
  caseId,
  onClose,
  onActioned,
}: {
  caseId: string | null;
  onClose: () => void;
  onActioned?: () => void;
}) {
  const { data, loading, refresh } = useApi<CaseDetail>(
    () => Api.caseDetail(caseId as string),
    [caseId]
  );
  const [busy, setBusy] = useState(false);

  if (!caseId) return null;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      refresh();
      onActioned?.();
    } finally {
      setBusy(false);
    }
  };

  const alert = data?.alert || {};
  const correlation = data?.correlation || {};
  const enrichment = data?.enrichment || {};
  const otx = enrichment.otx_reputation || null;
  const triage = data?.triage;
  const investigation = data?.investigation;
  const verification = data?.verification;
  const remediation = data?.remediation;
  const report = data?.report;
  const isPending = data?.status === "pending_approval";

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/20" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {alert.rule_description || "Case"}
            </div>
            <div className="mt-1 flex items-center gap-2">
              {data && <StatusBadge status={data.status} />}
              <span className="font-mono text-xs text-slate-400">{caseId.slice(0, 8)}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && !data ? (
          <Spinner />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <Section title="Alert">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Source IP" value={alert.source_ip || "—"} />
                <Field label="Dest IP" value={alert.dest_ip || "—"} />
                <Field label="User" value={alert.user || "—"} />
                <Field label="Host" value={alert.hostname || "—"} />
                <Field label="Rule" value={`${alert.rule_id || "—"} (level ${alert.rule_level ?? "—"})`} />
                <Field label="Time" value={timeAgo(alert.timestamp)} />
              </div>
            </Section>

            <Section title="Correlation">
              {correlation.pattern_matched ? (
                <div className="space-y-2">
                  <Badge className="bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    {titleCase(correlation.pattern_matched)}
                  </Badge>
                  <div className="text-sm text-slate-600">{correlation.details}</div>
                  <div className="text-xs text-slate-400">
                    {correlation.related_alert_count} related · window {correlation.time_window_minutes}m
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400">No correlation pattern matched.</div>
              )}
            </Section>

            <Section title="Enrichment">
              <div className="flex flex-wrap items-center gap-2">
                <CriticalityBadge criticality={enrichment.asset_criticality || "unknown"} />
                {otx ? (
                  otx.is_known_malicious ? (
                    <Badge className="bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                      Malicious IP · {otx.pulse_count} pulses{otx.country ? ` · ${otx.country}` : ""}
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                      Clean IP
                    </Badge>
                  )
                ) : (
                  <Badge className="bg-slate-100 text-slate-500 ring-1 ring-slate-200">No OTX data</Badge>
                )}
                <Badge className="bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                  {enrichment.historical_case_count ?? 0} prior cases
                </Badge>
              </div>
              {otx?.tags?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {otx.tags.slice(0, 8).map((t: string) => (
                    <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </Section>

            {triage && (
              <Section title="Triage">
                <div className="mb-2 flex items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                    {titleCase(triage.alert_type)}
                  </Badge>
                  <span className="text-xs text-slate-400">severity {triage.initial_severity}/10</span>
                </div>
                <p className="text-sm text-slate-600">{triage.reasoning}</p>
              </Section>
            )}

            {investigation && (
              <Section title="Investigation">
                <div className="mb-2 flex items-center gap-2">
                  <VerdictBadge verdict={investigation.verdict} />
                  <span className="text-xs text-slate-400">
                    confidence {Math.round((investigation.confidence_score || 0) * 100)}% · severity{" "}
                    {investigation.final_severity}/10
                  </span>
                </div>
                {investigation.matched_mitre_techniques?.length ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {investigation.matched_mitre_techniques.map((m: any, i: number) => (
                      <Badge key={i} className="bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                        {m.technique_id} {m.name}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {investigation.timeline?.length ? (
                  <ul className="mb-2 list-disc space-y-0.5 pl-4 text-sm text-slate-600">
                    {investigation.timeline.map((t: string, i: number) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-sm text-slate-600">{investigation.reasoning}</p>
              </Section>
            )}

            {verification && (
              <Section title="Verification">
                <div className="mb-2">
                  {verification.verified ? (
                    <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Verified</Badge>
                  ) : (
                    <Badge className="bg-rose-50 text-rose-700 ring-1 ring-rose-200">Rejected</Badge>
                  )}
                </div>
                {verification.rejection_reason && (
                  <p className="mb-1 text-sm text-rose-600">{verification.rejection_reason}</p>
                )}
                <div className="space-y-1 text-sm text-slate-600">
                  {verification.evidence_check && <div>Evidence: {verification.evidence_check}</div>}
                  {verification.mitre_check && <div>MITRE: {verification.mitre_check}</div>}
                  {verification.policy_check && <div>Policy: {verification.policy_check}</div>}
                </div>
              </Section>
            )}

            {remediation && (
              <Section title="Remediation">
                <div className="mb-2 text-xs text-slate-400">
                  Runbook: <span className="font-mono">{remediation.runbook_reference || "—"}</span>
                </div>
                <div className="space-y-2">
                  {(remediation.proposed_actions || []).map((a: any, i: number) => (
                    <div key={i} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{titleCase(a.action)}</span>
                        {a.is_destructive && (
                          <Badge className="bg-rose-50 text-rose-700 ring-1 ring-rose-200">Destructive</Badge>
                        )}
                        {a.target && <span className="font-mono text-xs text-slate-500">{a.target}</span>}
                      </div>
                      {a.details && <div className="mt-1 text-xs text-slate-500">{a.details}</div>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {report && (
              <Section title="Incident Report">
                <p className="text-sm text-slate-600">{report.summary}</p>
                {report.recommendations?.length ? (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm text-slate-600">
                    {report.recommendations.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                ) : null}
              </Section>
            )}
          </div>
        )}

        {/* actions */}
        <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-3">
          {isPending && (
            <>
              <button
                disabled={busy}
                onClick={() => act(() => Api.approveCase(caseId))}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Approve
              </button>
              <button
                disabled={busy}
                onClick={() => act(() => Api.rejectCase(caseId))}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Reject
              </button>
            </>
          )}
          <button
            disabled={busy}
            onClick={() => act(() => Api.submitFeedback(caseId, "false_positive", "Marked FP from UI"))}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <ThumbsDown className="h-4 w-4" /> Mark FP
          </button>
        </div>
      </div>
    </div>
  );
}
