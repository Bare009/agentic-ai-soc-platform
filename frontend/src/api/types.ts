// Types mirroring the AI_SOC API responses.

export interface DashboardCounters {
  total_alerts: number;
  critical_high: number;
  resolved: number;
  open: number;
  in_progress: number;
  pending_approval: number;
  true_positive: number;
  false_positive: number;
}

export interface TopAsset {
  hostname: string;
  count: number;
  critical_high: number;
}

export interface DashboardSummary {
  window: string;
  counters: DashboardCounters;
  severity_breakdown: Record<string, number>;
  status_breakdown: Record<string, number>;
  verdict_breakdown: Record<string, number>;
  top_assets: TopAsset[];
}

export interface CorrelationInfo {
  related_alert_count: number;
  time_window_minutes: number;
  details: string;
}

export interface OTXReputation {
  is_known_malicious: boolean;
  pulse_count: number;
  reputation_score: number;
  tags: string[];
  country: string;
}

export interface EnrichmentInfo {
  otx_reputation: OTXReputation | null;
  asset_criticality: string;
  historical_case_count: number;
}

export interface CaseSummary {
  case_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  alert_id: string;
  timestamp: string;
  source_ip: string;
  dest_ip: string;
  user: string;
  hostname: string;
  rule_id: string;
  rule_level: number;
  severity: string;
  rule_description: string;
  pattern_matched: string;
  asset_criticality: string;
  otx_malicious: boolean;
  alert_type: string;
  verdict: string;
  confidence_score: number;
  final_severity: number;
  correlation?: CorrelationInfo;
  enrichment?: EnrichmentInfo;
}

export interface CaseListResponse {
  total: number;
  skip: number;
  limit: number;
  items: CaseSummary[];
}

// The full case detail is loose (all pipeline stages) — use a permissive shape.
export type CaseDetail = Record<string, any>;

export interface PatternCount {
  pattern: string;
  count: number;
}

export interface CorrelationPatterns {
  window: string;
  total_correlated: number;
  patterns: PatternCount[];
}

export interface ClusterMember {
  alert_id: string;
  source_ip: string;
  user: string;
  hostname: string;
  rule_description: string;
  rule_level: number;
  event_classes: string[];
  event_ts: string;
}

export interface CorrelationCluster {
  case_id: string;
  pattern_matched: string;
  time_window_minutes: number;
  related_alert_count: number;
  details: string;
  trigger: {
    alert_id: string;
    source_ip: string;
    user: string;
    hostname: string;
    rule_description: string;
    timestamp: string;
  };
  members: ClusterMember[];
  config: Record<string, number>;
}

export interface MaliciousIp {
  source_ip: string;
  count: number;
  pulse_count: number;
  country: string;
}

export interface EnrichmentSummary {
  window: string;
  enriched_count: number;
  malicious_ip_alerts: number;
  asset_criticality_breakdown: Record<string, number>;
  top_malicious_ips: MaliciousIp[];
}

export interface AgentsOverview {
  window: string;
  status_breakdown: Record<string, number>;
  verdict_breakdown: Record<string, number>;
  verification: { verified: number; rejected: number };
  stage_counts: {
    triaged: number;
    investigated: number;
    remediated: number;
    reported: number;
    pending_approval: number;
  };
}

export interface PipelineStage {
  key: string;
  label: string;
  description: string;
  ran: boolean;
  output: any;
}

export interface CasePipeline {
  case_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  alert: {
    alert_id: string;
    rule_description: string;
    source_ip: string;
    user: string;
    hostname: string;
  };
  stages: PipelineStage[];
}

export interface ServiceHealth {
  name: string;
  key: string;
  status: "healthy" | "down";
  endpoint: string;
  latency_ms: number | null;
  last_check: string;
  description: string;
  last_heartbeat?: string | null;
  heartbeat_age_seconds?: number;
}

export interface SystemHealth {
  services: ServiceHealth[];
  summary: {
    healthy: number;
    total: number;
    down: number;
    queue_pending: number | null;
    dlq: number | null;
    model: string;
  };
  generated_at: string;
}

export interface VolumeBucket {
  bucket: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface AlertVolume {
  window: string;
  series: VolumeBucket[];
  totals: { total: number; peak: number; avg: number };
}

export interface ResolutionStats {
  window: string;
  auto_resolved: number;
  pending_human: number;
  closed: number;
  avg_processing_seconds: number;
  sample_size: number;
}

export interface LiveStats {
  connected: boolean;
  queue_pending: number | null;
  dlq: number | null;
  alerts_last_hour: number | null;
  worker_ok: boolean;
  model: string;
  timestamp: string;
}

export interface MtlsStatus {
  client_cert_present: boolean;
  verify: string;
  common_name: string;
  subject_dn: string;
  behind_gateway: boolean;
}
