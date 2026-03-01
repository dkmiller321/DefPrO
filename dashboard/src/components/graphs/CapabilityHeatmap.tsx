interface HeatmapProps {
  data: { capability: string; agency: string; spend: number }[];
  loading?: boolean;
}

function formatDollars(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function getIntensity(value: number, max: number): string {
  const ratio = max > 0 ? value / max : 0;
  if (ratio > 0.8) return "bg-teal-400/90";
  if (ratio > 0.6) return "bg-teal-500/70";
  if (ratio > 0.4) return "bg-teal-600/50";
  if (ratio > 0.2) return "bg-teal-700/40";
  if (ratio > 0) return "bg-teal-800/30";
  return "bg-gray-800/20";
}

export default function CapabilityHeatmap({ data, loading }: HeatmapProps) {
  if (loading) {
    return <div className="skeleton h-64 w-full rounded-xl" />;
  }

  const capabilities = [...new Set(data.map((d) => d.capability))];
  const agencies = [...new Set(data.map((d) => d.agency))];
  const maxSpend = Math.max(...data.map((d) => d.spend), 1);

  const lookup = new Map(data.map((d) => [`${d.capability}|${d.agency}`, d.spend]));

  return (
    <div className="bg-navy-700 rounded-xl border border-gray-700/50 p-5 overflow-x-auto">
      <h3 className="text-sm font-medium text-gray-400 mb-4">
        Capability x Agency Spend
      </h3>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm">No heatmap data available</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left p-1 text-gray-400 font-normal">Capability</th>
              {agencies.map((a) => (
                <th key={a} className="p-1 text-gray-400 font-normal text-center max-w-[100px] truncate" title={a}>
                  {a.length > 15 ? a.slice(0, 15) + "..." : a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {capabilities.map((cap) => (
              <tr key={cap}>
                <td className="p-1 text-gray-300 whitespace-nowrap">{cap}</td>
                {agencies.map((agency) => {
                  const val = lookup.get(`${cap}|${agency}`) || 0;
                  return (
                    <td key={agency} className="p-1">
                      <div
                        className={`rounded px-2 py-1 text-center ${getIntensity(val, maxSpend)}`}
                        title={`${cap} / ${agency}: ${formatDollars(val)}`}
                      >
                        {val > 0 ? formatDollars(val) : "-"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
