import { useState, useMemo } from "react";
import { FileText, Users, DollarSign, Cpu, TrendingUp, AlertTriangle } from "lucide-react";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import KPICard from "./components/cards/KPICard";
import SpendTrend from "./components/graphs/SpendTrend";
import SpendByCapability from "./components/graphs/SpendByCapability";
import CapabilityHeatmap from "./components/graphs/CapabilityHeatmap";
import ContractorsPerCapability from "./components/graphs/ContractorsPerCapability";
import ContractorNetwork from "./components/graphs/ContractorNetwork";
import ContractorTable from "./components/tables/ContractorTable";
import FilterBar from "./components/filters/FilterBar";
import NetworkControls from "./components/filters/NetworkControls";
import ContractorDetailPanel from "./components/panels/ContractorDetailPanel";
import ConcentrationPanel from "./components/panels/ConcentrationPanel";
import NodeDetailSidebar from "./components/panels/NodeDetailSidebar";
import QueryPage from "./components/search/QueryPage";
import { useSparqlQuery } from "./hooks/useSparqlQuery";
import { formatDollars, formatPercent } from "./utils/format";
import type { ContractorSummary, NetworkNode } from "./types/api";
import {
  getOverviewStats,
  getSpendByCapability,
  getTopContractors,
  getSpendOverTime,
  getContractorList,
  getCapabilityOptions,
  getCapabilityHeatmap,
  getCapabilityStats,
  getCapabilityConcentration,
  getNetworkData,
  getSharedCapabilityNetwork,
  getAgencyOptions,
} from "./api/sparql";

const PAGE_TITLES: Record<string, string> = {
  overview: "Overview",
  contractors: "Contractors",
  capabilities: "Capabilities",
  teaming: "Teaming Network",
  query: "SPARQL Query",
};

// ---------------------------------------------------------------------------
// Overview page (unchanged)
// ---------------------------------------------------------------------------

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
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          Top Contractors by Award Value
        </h3>
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
            {topContractors.loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5}>
                      <div className="skeleton h-8 w-full my-1" />
                    </td>
                  </tr>
                ))
              : (topContractors.data || []).map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-700/30 hover:bg-white/5"
                  >
                    <td className="p-2 text-gray-500">{i + 1}</td>
                    <td className="p-2 font-medium">{row.name}</td>
                    <td className="p-2 text-right">{row.awardCount}</td>
                    <td className="p-2 text-right text-teal-400">
                      {formatDollars(row.totalValue)}
                    </td>
                    <td className="p-2 text-gray-400 text-xs max-w-[200px] truncate">
                      {row.capabilities}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contractors page — REDESIGNED
// ---------------------------------------------------------------------------

function ContractorsPage() {
  const contractors = useSparqlQuery(getContractorList, []);
  const capOptions = useSparqlQuery(getCapabilityOptions, []);

  const [search, setSearch] = useState("");
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
  const [sbOnly, setSbOnly] = useState(false);
  const [selectedContractor, setSelectedContractor] =
    useState<ContractorSummary | null>(null);

  const filtered = useMemo(() => {
    return (contractors.data || []).filter((c) => {
      if (
        search &&
        !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !c.ueis.some((u) => u.toLowerCase().includes(search.toLowerCase()))
      )
        return false;
      if (sbOnly && !c.isSmallBusiness) return false;
      if (
        selectedCaps.length > 0 &&
        !selectedCaps.some((cap) => c.capabilities.includes(cap))
      )
        return false;
      return true;
    });
  }, [contractors.data, search, selectedCaps, sbOnly]);

  // Summary stats from data
  const stats = useMemo(() => {
    const all = contractors.data || [];
    const sbCount = all.filter((c) => c.isSmallBusiness).length;
    const totalSpend = all.reduce((sum, c) => sum + c.totalValue, 0);
    return {
      total: all.length,
      sbCount,
      sbPercent: all.length > 0 ? sbCount / all.length : 0,
      totalSpend,
    };
  }, [contractors.data]);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Total Contractors"
          value={stats.total.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
          loading={contractors.loading}
        />
        <KPICard
          title="Small Business"
          value={
            stats.sbCount > 0
              ? `${stats.sbCount} (${formatPercent(stats.sbPercent)})`
              : stats.total > 0
                ? "N/A"
                : "0"
          }
          icon={<TrendingUp className="w-5 h-5" />}
          loading={contractors.loading}
        />
        <KPICard
          title="Total Contract Spend"
          value={formatDollars(stats.totalSpend)}
          icon={<DollarSign className="w-5 h-5" />}
          loading={contractors.loading}
        />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        capabilities={capOptions.data || []}
        selectedCapabilities={selectedCaps}
        onCapabilitiesChange={setSelectedCaps}
        showSmallBusinessOnly={sbOnly}
        onSmallBusinessToggle={setSbOnly}
      />

      {/* Results count */}
      {!contractors.loading && (
        <div className="text-xs text-gray-500">
          Showing {filtered.length} of {(contractors.data || []).length}{" "}
          contractors
        </div>
      )}

      {/* Table */}
      <ContractorTable
        data={filtered}
        loading={contractors.loading}
        onSelect={setSelectedContractor}
      />

      {/* Detail panel */}
      {selectedContractor && (
        <ContractorDetailPanel
          contractorUri={selectedContractor.uri}
          contractorName={selectedContractor.name}
          isSmallBusiness={selectedContractor.isSmallBusiness}
          onClose={() => setSelectedContractor(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Capabilities page — REDESIGNED
// ---------------------------------------------------------------------------

function CapabilitiesPage() {
  const heatmap = useSparqlQuery(getCapabilityHeatmap, []);
  const capStats = useSparqlQuery(getCapabilityStats, []);
  const concentration = useSparqlQuery(getCapabilityConcentration, []);

  // Derived KPI stats
  const kpis = useMemo(() => {
    if (!capStats.data || capStats.data.length === 0) return null;
    const sorted = [...capStats.data].sort(
      (a, b) => b.totalSpend - a.totalSpend
    );
    const mostConcentrated =
      concentration.data && concentration.data.length > 0
        ? concentration.data[0]
        : null;
    return {
      capabilityCount: sorted.length,
      highestSpendName: sorted[0].name,
      highestSpendValue: sorted[0].totalSpend,
      mostConcentrated,
    };
  }, [capStats.data, concentration.data]);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Capability Areas"
          value={kpis?.capabilityCount?.toString() || "0"}
          icon={<Cpu className="w-5 h-5" />}
          loading={capStats.loading}
        />
        <KPICard
          title="Highest Spend"
          value={kpis?.highestSpendName || "\u2014"}
          icon={<DollarSign className="w-5 h-5" />}
          loading={capStats.loading}
        />
        <KPICard
          title="Most Concentrated"
          value={
            kpis?.mostConcentrated
              ? `${kpis.mostConcentrated.capability} (${formatPercent(kpis.mostConcentrated.share)})`
              : "\u2014"
          }
          icon={<AlertTriangle className="w-5 h-5" />}
          loading={concentration.loading}
        />
      </div>

      {/* Heatmap */}
      <CapabilityHeatmap data={heatmap.data || []} loading={heatmap.loading} />

      {/* Two column: contractors per cap + concentration */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ContractorsPerCapability
          data={capStats.data || []}
          loading={capStats.loading}
        />
        <ConcentrationPanel
          data={concentration.data || []}
          loading={concentration.loading}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Teaming page — REDESIGNED
// ---------------------------------------------------------------------------

function TeamingPage() {
  const [viewMode, setViewMode] = useState<
    "contractor-agency" | "shared-capabilities"
  >("contractor-agency");
  const [selectedCap, setSelectedCap] = useState<string | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);

  const capOptions = useSparqlQuery(getCapabilityOptions, []);
  const agencyOptions = useSparqlQuery(getAgencyOptions, []);

  const filters = useMemo(
    () => ({
      capability: selectedCap || undefined,
      agency: selectedAgency || undefined,
    }),
    [selectedCap, selectedAgency]
  );

  const contractorAgencyData = useSparqlQuery(
    () => getNetworkData(filters),
    [filters.capability, filters.agency]
  );

  const sharedCapData = useSparqlQuery(getSharedCapabilityNetwork, []);

  const networkData =
    viewMode === "contractor-agency" ? contractorAgencyData : sharedCapData;

  return (
    <div className="space-y-4">
      <NetworkControls
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          setSelectedNode(null);
        }}
        capabilities={capOptions.data || []}
        selectedCapability={selectedCap}
        onCapabilityChange={setSelectedCap}
        agencies={agencyOptions.data || []}
        selectedAgency={selectedAgency}
        onAgencyChange={setSelectedAgency}
      />

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <ContractorNetwork
            nodes={networkData.data?.nodes || []}
            links={networkData.data?.links || []}
            loading={networkData.loading}
            onNodeSelect={setSelectedNode}
          />
        </div>

        {selectedNode && (
          <NodeDetailSidebar
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------

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
