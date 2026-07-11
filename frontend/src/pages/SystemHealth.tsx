import { Activity } from "lucide-react";
import { Api } from "../api/client";
import { useApi } from "../hooks/useApi";
import {
  Card,
  ErrorState,
  PageHeader,
  SectionLabel,
  Spinner,
  StatCard,
  StatusDot,
} from "../components/primitives";
import type { ServiceHealth } from "../api/types";
import { timeAgo } from "../lib/format";

function ServiceCard({ svc }: { svc: ServiceHealth }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{svc.name}</div>
          <div className="mt-0.5 text-xs text-slate-500">{svc.description}</div>
        </div>
        <StatusDot status={svc.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <div className="section-label">Latency</div>
          <div className="mt-0.5 text-sm text-slate-700">
            {svc.latency_ms != null ? `${svc.latency_ms}ms` : "n/a"}
          </div>
        </div>
        <div>
          <div className="section-label">Last Check</div>
          <div className="mt-0.5 text-sm text-slate-700">{timeAgo(svc.last_check)}</div>
        </div>
        <div className="col-span-2">
          <div className="section-label">Endpoint</div>
          <div className="mt-0.5 truncate font-mono text-xs text-slate-500">{svc.endpoint}</div>
        </div>
        {svc.key === "worker" && svc.heartbeat_age_seconds != null && (
          <div className="col-span-2">
            <div className="section-label">Heartbeat</div>
            <div className="mt-0.5 text-xs text-slate-500">{svc.heartbeat_age_seconds}s ago</div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function SystemHealth() {
  const { data, loading, error } = useApi(() => Api.systemHealth(), [], 10000);

  return (
    <div>
      <PageHeader
        icon={<Activity className="h-5 w-5" />}
        title="System Health"
        subtitle="Live status of every platform service and dependency"
      />

      {error && <ErrorState message={error} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Healthy Services"
          value={data ? `${data.summary.healthy}/${data.summary.total}` : "—"}
          hint={data ? `${data.summary.down} down` : undefined}
          valueClass={data && data.summary.down > 0 ? "text-amber-600" : "text-emerald-600"}
        />
        <StatCard label="Queue Pending" value={data?.summary.queue_pending ?? "—"} />
        <StatCard label="DLQ Backlog" value={data?.summary.dlq ?? "—"} valueClass={data && (data.summary.dlq ?? 0) > 0 ? "text-rose-600" : "text-slate-900"} />
        <StatCard label="LLM Model" value={<span className="text-base">{data?.summary.model ?? "—"}</span>} />
      </div>

      <div className="mt-6">
        <SectionLabel>Services</SectionLabel>
      </div>
      {loading && !data ? (
        <Spinner />
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.services.map((svc) => (
            <ServiceCard key={svc.key} svc={svc} />
          ))}
        </div>
      )}
    </div>
  );
}
