import { Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Alerts from "./pages/Alerts";
import Correlation from "./pages/Correlation";
import Enrichment from "./pages/Enrichment";
import AgentOps from "./pages/AgentOps";
import SystemHealth from "./pages/SystemHealth";
import Analytics from "./pages/Analytics";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/correlation" element={<Correlation />} />
        <Route path="/enrichment" element={<Enrichment />} />
        <Route path="/agent-ops" element={<AgentOps />} />
        <Route path="/system-health" element={<SystemHealth />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Layout>
  );
}
