import { useState } from "react";
import type { HeatmapCell } from "../../types/api";
import { formatDollars } from "../../utils/format";

interface HeatmapProps {
  data: HeatmapCell[];
  loading?: boolean;
  onCellClick?: (capability: string) => void;
}

function getIntensity(value: number, max: number): string {
  if (max === 0) return "bg-gray-800/20";
  // Use log scale for better color distribution
  const ratio = Math.log1p(value) / Math.log1p(max);
  if (ratio > 0.75) return "bg-teal-400/80";
  if (ratio > 0.5) return "bg-teal-500/60";
  if (ratio > 0.3) return "bg-teal-600/45";
  if (ratio > 0.15) return "bg-teal-700/35";
  if (ratio > 0) return "bg-teal-800/25";
  return "bg-gray-800/20";
}

export default function CapabilityHeatmap({
  data,
  loading,
  onCellClick,
}: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    cap: string;
    agency: string;
    spend: number;
  } | null>(null);

  if (loading) {
    return <div className="skeleton h-64 w-full rounded-xl" />;
  }

  const capabilities = [...new Set(data.map((d) => d.capability))].sort();
  const agencies = [...new Set(data.map((d) => d.agency))].sort();
  const maxSpend = Math.max(...data.map((d) => d.spend), 1);

  const lookup = new Map(
    data.map((d) => [`${d.capability}|${d.agency}`, d.spend])
  );

  return (
    <div className="bg-navy-700 rounded-xl border border-gray-700/50 p-5 overflow-x-auto relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">
          Capability x Agency Spend
        </h3>
        {/* Color legend */}
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <span>Low</span>
          <div className="flex gap-px">
            <div className="w-4 h-3 rounded-sm bg-teal-800/25" />
            <div className="w-4 h-3 rounded-sm bg-teal-700/35" />
            <div className="w-4 h-3 rounded-sm bg-teal-600/45" />
            <div className="w-4 h-3 rounded-sm bg-teal-500/60" />
            <div className="w-4 h-3 rounded-sm bg-teal-400/80" />
          </div>
          <span>High</span>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-gray-500 text-sm">No heatmap data available</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left p-1.5 text-gray-400 font-normal sticky left-0 bg-navy-700 z-10">
                Capability
              </th>
              {agencies.map((a) => (
                <th
                  key={a}
                  className="p-1.5 text-gray-400 font-normal text-center"
                  title={a}
                >
                  <div className="max-w-[120px] mx-auto truncate">{a}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {capabilities.map((cap) => (
              <tr
                key={cap}
                className="cursor-pointer hover:bg-white/5"
                onClick={() => onCellClick?.(cap)}
              >
                <td className="p-1.5 text-gray-300 whitespace-nowrap sticky left-0 bg-navy-700 z-10">
                  {cap}
                </td>
                {agencies.map((agency) => {
                  const val = lookup.get(`${cap}|${agency}`) || 0;
                  return (
                    <td key={agency} className="p-1">
                      <div
                        className={`rounded px-2 py-2 text-center text-[11px] font-medium transition-colors ${getIntensity(val, maxSpend)}`}
                        onMouseEnter={(e) => {
                          const rect = (
                            e.target as HTMLElement
                          ).getBoundingClientRect();
                          setTooltip({
                            x: rect.left + rect.width / 2,
                            y: rect.top - 8,
                            cap,
                            agency,
                            spend: val,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {val > 0 ? formatDollars(val) : "\u2014"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-[100] bg-navy-800 border border-gray-700/50 rounded-lg px-3 py-2 shadow-xl pointer-events-none text-xs"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-medium text-white">{tooltip.cap}</div>
          <div className="text-gray-400">{tooltip.agency}</div>
          <div className="text-teal-400 font-medium mt-0.5">
            {formatDollars(tooltip.spend)}
          </div>
        </div>
      )}
    </div>
  );
}
