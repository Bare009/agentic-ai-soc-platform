export const WINDOWS = ["15m", "1h", "24h", "7d", "30d"];

export function titleCase(str: string): string {
  if (!str) return "";
  return str
    .split(/[_-\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function severityClasses(severity: string | n
  umber): string {
  const sev = String(severity).toLowerCase();
  if (sev === "critical" || sev === "high" || Number(sev) >= 8) {
    return "bg-rose-100 text-rose-800 border border-rose-200";
  }
  if (sev === "medium" || (Number(sev) >= 4 && Number(sev) < 8)) {
    return "bg-amber-100 text-amber-800 border border-amber-200";
  }
  return "bg-blue-100 text-blue-800 border border-blue-200";
}

export function verdictClasses(verdict: string): string {
  const v = (verdict || "").toLowerCase();
  if (v === "true_positive") return "bg-rose-100 text-rose-800 border border-rose-200";
  if (v === "false_positive") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  if (v === "rejected") return "bg-amber-100 text-amber-800 border border-amber-200";
  return "bg-slate-100 text-slate-800 border border-slate-200";
}

export function statusClasses(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "closed") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  if (s === "pending_approval") return "bg-amber-100 text-amber-800 border border-amber-200";
  if (s === "investigating" || s === "triaging" || s === "remediating" || s === "verifying") {
    return "bg-blue-100 text-blue-800 border border-blue-200";
  }
  return "bg-slate-100 text-slate-800 border border-slate-200";
}

export function criticalityClasses(criticality: string): string {
  const c = (criticality || "").toLowerCase();
  if (c === "critical" || c === "high") {
    return "bg-rose-100 text-rose-800 border border-rose-200";
  }
  if (c === "medium") {
    return "bg-amber-100 text-amber-800 border border-amber-200";
  }
  return "bg-slate-100 text-slate-800 border border-slate-200";
}

export function timeAgo(dateString: string | undefined): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444", // rose-500
  high: "#f97316",     // orange-500
  medium: "#f59e0b",   // amber-500
  low: "#3b82f6",      // blue-500
  unknown: "#94a3b8",  // slate-400
};

export function shortId(id: string): string {
  if (!id) return "";
  return id.split("-")[0];
}
