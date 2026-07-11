import axios from "axios";
import type {
  AgentsOverview,
  AlertVolume,
  CaseDetail,
  CaseListResponse,
  CasePipeline,
  CorrelationCluster,
  CorrelationPatterns,
  DashboardSummary,
  EnrichmentSummary,
  MtlsStatus,
  ResolutionStats,
  SystemHealth,
} from "./types";

// Relative base — dev proxies /api to the API; nginx proxies it in production.
export const api = axios.create({ baseURL: "/api/v1", timeout: 20000 });

export type CaseFilters = {
  window?: string;
  severity?: string;
  status?: string;
  source?: string;
  verdict?: string;
  q?: string;
  skip?: number;
  limit?: number;
};

function clean(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null)
  );
}

export const Api = {
  dashboardSummary: (window: string) =>
    api.get<DashboardSummary>("/dashboard/summary", { params: { window } }).then((r) => r.data),

  listCases: (filters: CaseFilters) =>
    api.get<CaseListResponse>("/cases", { params: clean(filters) }).then((r) => r.data),

  caseSources: (window: string) =>
    api.get<{ sources: string[] }>("/cases/sources", { params: { window } }).then((r) => r.data),

  caseDetail: (caseId: string) =>
    api.get<CaseDetail>(`/cases/${caseId}`).then((r) => r.data),

  exportUrl: (filters: CaseFilters) => {
    const qs = new URLSearchParams(clean(filters) as Record<string, string>).toString();
    return `/api/v1/cases/export?${qs}`;
  },

  approveCase: (caseId: string, note = "") =>
    api.post(`/cases/${caseId}/approve`, { note }).then((r) => r.data),

  rejectCase: (caseId: string, note = "") =>
    api.post(`/cases/${caseId}/reject`, { note }).then((r) => r.data),

  submitFeedback: (caseId: string, correctedVerdict: string, note = "") =>
    api.post(`/cases/${caseId}/feedback`, { corrected_verdict: correctedVerdict, note }).then((r) => r.data),

  correlationPatterns: (window: string) =>
    api.get<CorrelationPatterns>("/correlation/patterns", { params: { window } }).then((r) => r.data),

  correlationCases: (window: string, pattern?: string) =>
    api
      .get<CaseListResponse>("/correlation/cases", { params: clean({ window, pattern }) })
      .then((r) => r.data),

  correlationCluster: (caseId: string) =>
    api.get<CorrelationCluster>(`/correlation/${caseId}/cluster`).then((r) => r.data),

  enrichmentSummary: (window: string) =>
    api.get<EnrichmentSummary>("/enrichment/summary", { params: { window } }).then((r) => r.data),

  enrichmentCases: (window: string, filter?: string) =>
    api
      .get<CaseListResponse>("/enrichment/cases", { params: clean({ window, filter }) })
      .then((r) => r.data),

  agentsOverview: (window: string) =>
    api.get<AgentsOverview>("/agents/overview", { params: { window } }).then((r) => r.data),

  casePipeline: (caseId: string) =>
    api.get<CasePipeline>(`/agents/pipeline/${caseId}`).then((r) => r.data),

  systemHealth: () => api.get<SystemHealth>("/system/health").then((r) => r.data),

  mtlsStatus: () => api.get<MtlsStatus>("/system/mtls").then((r) => r.data),

  alertVolume: (window: string) =>
    api.get<AlertVolume>("/analytics/alert-volume", { params: { window } }).then((r) => r.data),

  resolution: (window: string) =>
    api.get<ResolutionStats>("/analytics/resolution", { params: { window } }).then((r) => r.data),
};
