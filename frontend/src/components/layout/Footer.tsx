import { useLiveStats } from "../../hooks/useLiveStats";

export default function Footer() {
  const { stats, connected } = useLiveStats();

  const item = (label: string, value: string | number | null | undefined) => (
    <span className="text-slate-400">
      {label}: <span className="text-slate-600">{value ?? "—"}</span>
    </span>
  );

  return (
    <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-slate-200 bg-white px-6 text-[11px]">
      <span className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-rose-500"}`}
        />
        <span className={connected ? "text-emerald-600" : "text-rose-600"}>
          {connected ? "WS Connected" : "WS Disconnected"}
        </span>
      </span>
      <span className="text-slate-200">|</span>
      {item("Queue", stats?.queue_pending)}
      <span className="text-slate-200">|</span>
      {item("DLQ", stats?.dlq)}
      <span className="text-slate-200">|</span>
      {item("Alerts/hr", stats?.alerts_last_hour)}
      <span className="text-slate-200">|</span>
      <span className="flex items-center gap-1.5 text-slate-400">
        Worker:
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            stats?.worker_ok ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />
      </span>
      <span className="text-slate-200">|</span>
      {item("Model", stats?.model)}
    </footer>
  );
}
