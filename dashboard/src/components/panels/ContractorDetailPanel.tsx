import { X } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { useSparqlQuery } from "../../hooks/useSparqlQuery";
import { getContractorDetail } from "../../api/sparql";
import { formatDollars } from "../../utils/format";

const COLORS = [
  "#14b8a6",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#22c55e",
  "#f59e0b",
  "#3b82f6",
  "#ec4899",
  "#a855f7",
  "#f97316",
];

interface Props {
  contractorUri: string;
  contractorName: string;
  isSmallBusiness?: boolean;
  onClose: () => void;
}

export default function ContractorDetailPanel({
  contractorUri,
  contractorName,
  isSmallBusiness,
  onClose,
}: Props) {
  const { data, loading } = useSparqlQuery(
    () => getContractorDetail(contractorUri),
    [contractorUri]
  );

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-navy-800 border-l border-gray-700/50 shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-gray-700/50">
        <div>
          <h2 className="text-lg font-semibold">{contractorName}</h2>
          {isSmallBusiness && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded mt-1 inline-block">
              Small Business
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <div className="skeleton h-48 w-full rounded-lg" />
            <div className="skeleton h-32 w-full rounded-lg" />
            <div className="skeleton h-32 w-full rounded-lg" />
          </div>
        ) : data ? (
          <>
            {/* Capability breakdown donut */}
            {data.capabilities.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Spend by Capability
                </h3>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={data.capabilities}
                        dataKey="spend"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        strokeWidth={0}
                      >
                        {data.capabilities.map((_, i) => (
                          <Cell
                            key={i}
                            fill={COLORS[i % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1a2235",
                          border: "1px solid #374151",
                          borderRadius: 8,
                          color: "#e5e7eb",
                          fontSize: 12,
                        }}
                        formatter={(v: number) => formatDollars(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {data.capabilities.map((cap, i) => (
                      <div
                        key={cap.name}
                        className="flex items-center gap-2 text-xs"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                        <span className="text-gray-300 truncate">
                          {cap.name}
                        </span>
                        <span className="text-gray-500 ml-auto shrink-0">
                          {formatDollars(cap.spend)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Agencies bar chart */}
            {data.agencies.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Agencies
                </h3>
                <ResponsiveContainer width="100%" height={data.agencies.length * 36 + 20}>
                  <BarChart
                    data={data.agencies}
                    layout="vertical"
                    margin={{ left: 10, right: 10 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickFormatter={formatDollars}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      width={130}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a2235",
                        border: "1px solid #374151",
                        borderRadius: 8,
                        color: "#e5e7eb",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [formatDollars(v), "Spend"]}
                    />
                    <Bar
                      dataKey="spend"
                      fill="#14b8a6"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Year-over-year trend */}
            {data.spendByYear.length > 1 && (
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Spend Trend
                </h3>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={data.spendByYear}>
                    <XAxis
                      dataKey="fiscalYear"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickFormatter={formatDollars}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a2235",
                        border: "1px solid #374151",
                        borderRadius: 8,
                        color: "#e5e7eb",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [formatDollars(v), "Spend"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="spend"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={{ fill: "#14b8a6", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top awards */}
            {data.topAwards.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Top Awards
                </h3>
                <div className="space-y-2">
                  {data.topAwards.map((award) => (
                    <div
                      key={award.id}
                      className="bg-navy-700/50 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-gray-500">
                          {award.id}
                        </span>
                        <span className="text-sm text-teal-400 font-medium">
                          {formatDollars(award.amount)}
                        </span>
                      </div>
                      {award.description && (
                        <p className="text-xs text-gray-400 line-clamp-2">
                          {award.description}
                        </p>
                      )}
                      {award.fiscalYear && (
                        <span className="text-[10px] text-gray-600 mt-1 inline-block">
                          FY{award.fiscalYear}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-sm">No data available</p>
        )}
      </div>
    </div>
  );
}
