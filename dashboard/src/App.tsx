import { useState } from "react";
import {
  FileText,
  Users,
  DollarSign,
  Cpu,
} from "lucide-react";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import KPICard from "./components/cards/KPICard";
import SpendTrend from "./components/graphs/SpendTrend";
import SpendByCapability from "./components/graphs/SpendByCapability";
import CapabilityHeatmap from "./components/graphs/CapabilityHeatmap";
import ContractorNetwork from "./components/graphs/ContractorNetwork";
import ContractorTable from "./components/tables/ContractorTable";
import QueryPage from "./components/search/QueryPage";
import { useSparqlQuery } from "./hooks/useSparqlQuery";
import {
  getOverviewStats,
  getSpendByCapability,
  getTopContractors,
  getSpendOverTime,
  getContractorList,
  getCapabilityHeatmap,
  getNetworkData,
} from "./api/sparql";

const PAGE_TITLES: Record<string, string> = {
  overview: "Overview",
  contractors: "Contractors",
  capabilities: "Capabilities",
  teaming: "Teaming Network",
  query: "SPARQL Query",
};

function formatDollars(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function OverviewPage() {
  const stats = useSparqlQuery(getOverviewStats, []);
  const capSpend = useSparqlQuery(getSpendByCapability, []);
  const topContractors = useSparqlQuery(() => getTopContractors(10), []);
  const trend = useSparqlQuery(getSpendOverTime, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Total Contracts"
          value={stats.data?.totalContracts?.toLocaleString() || "0"}
          icon={<FileText className="w-5 h-5" />}
          loading={stats.loading}
        />
        <KPICard
          title="Total Spend"
          value={formatDollars(stats.data?.totalSpend || 0)}
          icon={<DollarSign className="w-5 h-5" />}
          loading={stats.loading}
        />
        <KPICard
          title="Unique Contractors"
          value={stats.data?.uniqueContractors?.toLocaleString() || "0"}
          icon={<Users className="w-5 h-5" />}
          loading={stats.loading}
        />
        <KPICard
          title="Capability Areas"
          value={stats.data?.uniqueCapabilities?.toLocaleString() || "0"}
          icon={<Cpu className="w-5 h-5" />}
          loading={stats.loading}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SpendByCapability data={capSpend.data || []} loading={capSpend.loading} />
        <SpendTrend data={trend.data || []} loading={trend.loading} />
      </div>

      <div className="bg-navy-700 rounded-xl border border-gray-700/50 p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Top Contractors by Award Value</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="text-left p-2 text-gray-400 font-medium">#</th>
              <th className="text-left p-2 text-gray-400 font-medium">Contractor</th>
              <th className="text-right p-2 text-gray-400 font-medium">Awards</th>
              <th className="text-right p-2 text-gray-400 font-medium">Total Value</th>
              <th className="text-left p-2 text-gray-400 font-medium">Capabilities</th>
            </tr>
          </thead>
          <tbody>
            {topContractors.loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={5}><div className="skeleton h-8 w-full my-1" /></td></tr>
              ))
            ) : (
              (topContractors.data || []).map((row, i) => (
                <tr key={i} className="border-b border-gray-700/30 hover:bg-white/5">
                  <td className="p-2 text-gray-500">{i + 1}</td>
                  <td className="p-2 font-medium">{row.name}</td>
                  <td className="p-2 text-right">{row.awardCount}</td>
                  <td className="p-2 text-right text-teal-400">{formatDollars(row.totalValue)}</td>
                  <td className="p-2 text-gray-400 text-xs max-w-[200px] truncate">{row.capabilities}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContractorsPage() {
  const contractors = useSparqlQuery(getContractorList, []);
  const [search, setSearch] = useState("");

  const filtered = (contractors.data || []).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.uei.toLowerCase().includes(search.toLowerCase()) ||
      c.capabilities.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search contractors by name, UEI, or capability..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 bg-navy-700 border border-gray-700/50 rounded-xl text-sm focus:outline-none focus:border-teal-500 transition-colors"
      />
      <ContractorTable data={filtered} loading={contractors.loading} />
    </div>
  );
}

function CapabilitiesPage() {
  const heatmap = useSparqlQuery(getCapabilityHeatmap, []);

  return (
    <div className="space-y-6">
      <CapabilityHeatmap data={heatmap.data || []} loading={heatmap.loading} />
    </div>
  );
}

function TeamingPage() {
  const network = useSparqlQuery(getNetworkData, []);

  return (
    <div className="space-y-6">
      <ContractorNetwork
        nodes={network.data?.nodes || []}
        links={network.data?.links || []}
        loading={network.loading}
      />
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("overview");

  return (
    <div className="flex h-screen bg-navy-900 text-gray-100">
      <Sidebar activePage={page} onNavigate={setPage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={PAGE_TITLES[page] || "DefPrO"} />
        <main className="flex-1 overflow-y-auto p-6">
          {page === "overview" && <OverviewPage />}
          {page === "contractors" && <ContractorsPage />}
          {page === "capabilities" && <CapabilitiesPage />}
          {page === "teaming" && <TeamingPage />}
          {page === "query" && <QueryPage />}
        </main>
      </div>
    </div>
  );
}
