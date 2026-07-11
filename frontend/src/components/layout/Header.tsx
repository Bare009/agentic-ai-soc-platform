import { Bell, Search, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { Api } from "../../api/client";
import { useApi } from "../../hooks/useApi";

function MtlsBadge() {
  const { data } = useApi(() => Api.mtlsStatus(), [], 10000);

  // Not reached through the TLS gateway (e.g. dev on :5173 / direct :3000).
  if (!data || !data.behind_gateway) {
    return (
      <span
        title="Not accessed through the mTLS gateway"
        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200"
      >
        <Shield className="h-3.5 w-3.5" /> mTLS: n/a
      </span>
    );
  }

  if (data.client_cert_present) {
    return (
      <span
        title={data.subject_dn || "client certificate verified"}
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        mTLS: {data.common_name || "verified"}
      </span>
    );
  }

  return (
    <span
      title="No client certificate presented — destructive actions will be blocked"
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
    >
      <ShieldAlert className="h-3.5 w-3.5" /> mTLS: no cert
    </span>
  );
}

export default function Header() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6">
      <div className="relative flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <MtlsBadge />
      <button className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
        <Bell className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          AD
        </div>
        <span className="hidden text-sm text-slate-600 sm:inline">admin@ai-soc.local</span>
      </div>
    </header>
  );
}
