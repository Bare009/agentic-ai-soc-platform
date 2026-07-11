import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { WINDOWS } from "../lib/format";
import {
  criticalityClasses,
  severityClasses,
  statusClasses,
  titleCase,
  verdictClasses,
} from "../lib/format";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label">{children}</div>;
}

export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-slate-400">{icon}</div>}
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  valueClass?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <SectionLabel>{label}</SectionLabel>
        {icon && <div className="text-slate-300">{icon}</div>}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </Card>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge className={severityClasses(severity)}>{titleCase(severity)}</Badge>;
}

export function VerdictBadge({ verdict }: { verdict: string }) {
  if (!verdict) return <span className="text-slate-300">—</span>;
  return <Badge className={verdictClasses(verdict)}>{titleCase(verdict)}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={statusClasses(status)}>{titleCase(status)}</Badge>;
}

export function CriticalityBadge({ criticality }: { criticality: string }) {
  return <Badge className={criticalityClasses(criticality)}>{titleCase(criticality)}</Badge>;
}

export function StatusDot({ status }: { status: "healthy" | "down" }) {
  const ok = status === "healthy";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        ok ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`} />
      {ok ? "Healthy" : "Down"}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label || "Loading…"}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="py-12 text-center text-sm text-slate-400">{message}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </div>
  );
}

export function WindowTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (w: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
      {WINDOWS.map((w: string) => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            value === w ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {w}
        </button>
      ))}
    </div>
  );
}
