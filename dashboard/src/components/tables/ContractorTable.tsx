interface ContractorRow {
  name: string;
  uei: string;
  awardCount: number;
  totalValue: number;
  isSmallBusiness: boolean;
  capabilities: string;
}

interface Props {
  data: ContractorRow[];
  loading?: boolean;
  onSelect?: (name: string) => void;
}

function formatDollars(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export default function ContractorTable({ data, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-12 w-full rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-navy-700 rounded-xl border border-gray-700/50 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700/50">
            <th className="text-left p-3 text-gray-400 font-medium">Contractor</th>
            <th className="text-left p-3 text-gray-400 font-medium">UEI</th>
            <th className="text-right p-3 text-gray-400 font-medium">Awards</th>
            <th className="text-right p-3 text-gray-400 font-medium">Total Value</th>
            <th className="text-center p-3 text-gray-400 font-medium">SB</th>
            <th className="text-left p-3 text-gray-400 font-medium">Capabilities</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-6 text-center text-gray-500">
                No contractor data available
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={i}
                className="border-b border-gray-700/30 hover:bg-white/5 cursor-pointer transition-colors"
                onClick={() => onSelect?.(row.name)}
              >
                <td className="p-3 font-medium">{row.name}</td>
                <td className="p-3 text-gray-400 font-mono text-xs">{row.uei || "-"}</td>
                <td className="p-3 text-right">{row.awardCount}</td>
                <td className="p-3 text-right text-teal-400">{formatDollars(row.totalValue)}</td>
                <td className="p-3 text-center">
                  {row.isSmallBusiness ? (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">SB</span>
                  ) : "-"}
                </td>
                <td className="p-3 text-gray-400 text-xs max-w-[200px] truncate" title={row.capabilities}>
                  {row.capabilities || "-"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
