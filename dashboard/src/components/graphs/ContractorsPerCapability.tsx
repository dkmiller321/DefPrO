import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CapabilitySummary } from "../../types/api";

interface Props {
  data: CapabilitySummary[];
  loading?: boolean;
}

export default function ContractorsPerCapability({ data, loading }: Props) {
  if (loading) {
    return <div className="skeleton h-64 w-full rounded-xl" />;
  }

  const chartData = [...data].sort(
    (a, b) => b.contractorCount - a.contractorCount
  );

  return (
    <div className="bg-navy-700 rounded-xl border border-gray-700/50 p-5">
      <h3 className="text-sm font-medium text-gray-400 mb-4">
        Contractors per Capability
      </h3>
      {chartData.length === 0 ? (
        <p className="text-gray-500 text-sm">No data available</p>
      ) : (
        <ResponsiveContainer width="100%" height={chartData.length * 32 + 40}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ left: 130, right: 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#374151"
              horizontal={false}
            />
            <XAxis
              type="number"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              width={120}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a2235",
                border: "1px solid #374151",
                borderRadius: 8,
                color: "#e5e7eb",
              }}
              formatter={(value: number) => [value, "Contractors"]}
            />
            <Bar
              dataKey="contractorCount"
              fill="#8b5cf6"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
