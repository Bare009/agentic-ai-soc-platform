import { NavLink } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Database,
  LayoutDashboard,
  Share2,
  Shield,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/correlation", label: "Correlation", icon: Share2 },
  { to: "/enrichment", label: "Enrichment", icon: Database },
  { to: "/agent-ops", label: "Agent Ops", icon: Bot },
  { to: "/system-health", label: "System Health", icon: Activity },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 px-5">
        <Shield className="h-6 w-6 text-brand-600" />
        <span className="text-lg font-semibold tracking-tight text-slate-900">AI_SOC</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 px-5 py-4 text-[11px] text-slate-400">
        Agentic AI SOC Platform
      </div>
    </aside>
  );
}
