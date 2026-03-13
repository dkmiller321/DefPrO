import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatDollars } from "../../utils/format";

interface SpendTrendProps {
  data: { fiscalYear: string; spend: number; awards: number }[];
  loading?: boolean;
}

export default function SpendTrend({ data, loading }: SpendTrendProps) {
  if (loading) {
    return <div className="skeleton h-64 w-full rounded-xl" />;
  }

  return (
    <div className="bg-navy-700 rounded-xl border border-gray-700/50 p-5">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Spend Over Time</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="fiscalYear" stroke="#9ca3af" tick={{ fontSize: 12 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={formatDollars} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a2235",
              border: "1px solid #374151",
              borderRadius: 8,
              color: "#e5e7eb",
            }}
            formatter={(value: number) => [formatDollars(value), "Spend"]}
          />
          <Line
            type="monotone"
            dataKey="spend"
            stroke="#14b8a6"
            strokeWidth={2}
            dot={{ fill: "#14b8a6", r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
