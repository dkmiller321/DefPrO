import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { capability: string; spend: number }[];
  loading?: boolean;
}

function formatDollars(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export default function SpendByCapability({ data, loading }: Props) {
  if (loading) {
    return <div className="skeleton h-64 w-full rounded-xl" />;
  }

  return (
    <div className="bg-navy-700 rounded-xl border border-gray-700/50 p-5">
      <h3 className="text-sm font-medium text-gray-400 mb-4">
        Spend by Capability
      </h3>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm">No data available</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={formatDollars} />
            <YAxis
              type="category"
              dataKey="capability"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              width={110}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a2235",
                border: "1px solid #374151",
                borderRadius: 8,
                color: "#e5e7eb",
              }}
              formatter={(value: number) => [formatDollars(value), "Spend"]}
            />
            <Bar dataKey="spend" fill="#14b8a6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
