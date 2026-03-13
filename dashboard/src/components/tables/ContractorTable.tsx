import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ContractorSummary } from "../../types/api";
import { formatDollars } from "../../utils/format";

const CAP_COLORS: Record<string, string> = {
  "AI and Machine Learning": "bg-purple-500/20 text-purple-400",
  "Cyber Security": "bg-red-500/20 text-red-400",
  "Electronic Warfare": "bg-cyan-500/20 text-cyan-400",
  "Autonomous Systems": "bg-green-500/20 text-green-400",
  C4ISR: "bg-blue-500/20 text-blue-400",
  "Space Systems": "bg-violet-500/20 text-violet-400",
  "Missile Defense": "bg-orange-500/20 text-orange-400",
  Logistics: "bg-gray-400/20 text-gray-300",
  Hypersonics: "bg-rose-500/20 text-rose-400",
  "Training and Simulation": "bg-yellow-500/20 text-yellow-400",
  "Directed Energy": "bg-pink-500/20 text-pink-400",
  "Quantum Technology": "bg-indigo-500/20 text-indigo-400",
  Biotechnology: "bg-emerald-500/20 text-emerald-400",
};

type SortKey = "name" | "awardCount" | "totalValue";
type SortDir = "asc" | "desc";

interface Props {
  data: ContractorSummary[];
  loading?: boolean;
  onSelect?: (contractor: ContractorSummary) => void;
}

export default function ContractorTable({ data, loading, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("totalValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const maxValue = useMemo(
    () => Math.max(...data.map((d) => d.totalValue), 1),
    [data]
  );

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "awardCount") cmp = a.awardCount - b.awardCount;
      else cmp = a.totalValue - b.totalValue;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column)
      return <ArrowUpDown className="w-3 h-3 text-gray-600" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-teal-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-teal-400" />
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
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
            <th
              className="text-left p-3 text-gray-400 font-medium cursor-pointer hover:text-white select-none"
              onClick={() => toggleSort("name")}
            >
              <span className="flex items-center gap-1.5">
                Contractor <SortIcon column="name" />
              </span>
            </th>
            <th
              className="text-right p-3 text-gray-400 font-medium cursor-pointer hover:text-white select-none w-24"
              onClick={() => toggleSort("awardCount")}
            >
              <span className="flex items-center justify-end gap-1.5">
                Awards <SortIcon column="awardCount" />
              </span>
            </th>
            <th
              className="text-right p-3 text-gray-400 font-medium cursor-pointer hover:text-white select-none w-40"
              onClick={() => toggleSort("totalValue")}
            >
              <span className="flex items-center justify-end gap-1.5">
                Total Value <SortIcon column="totalValue" />
              </span>
            </th>
            <th className="text-left p-3 text-gray-400 font-medium">
              Capabilities
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-6 text-center text-gray-500">
                No contractors match your filters
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={row.uri}
                className="border-b border-gray-700/30 hover:bg-white/5 cursor-pointer transition-colors"
                onClick={() => onSelect?.(row)}
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{row.name}</span>
                    {row.isSmallBusiness && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                        SB
                      </span>
                    )}
                  </div>
                  {row.ueis.length > 0 && (
                    <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                      {row.ueis[0]}
                      {row.ueis.length > 1 && ` +${row.ueis.length - 1}`}
                    </div>
                  )}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {row.awardCount}
                </td>
                <td className="p-3 text-right">
                  <div className="relative">
                    <div
                      className="absolute inset-y-0 right-0 bg-teal-500/10 rounded-sm"
                      style={{
                        width: `${(row.totalValue / maxValue) * 100}%`,
                      }}
                    />
                    <span className="relative text-teal-400 font-medium tabular-nums">
                      {formatDollars(row.totalValue)}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {row.capabilities.slice(0, 4).map((cap) => (
                      <span
                        key={cap}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          CAP_COLORS[cap] || "bg-gray-600/30 text-gray-400"
                        }`}
                      >
                        {cap.length > 18 ? cap.slice(0, 16) + "\u2026" : cap}
                      </span>
                    ))}
                    {row.capabilities.length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 text-gray-500">
                        +{row.capabilities.length - 4}
                      </span>
                    )}
                    {row.capabilities.length === 0 && (
                      <span className="text-gray-600 text-xs">\u2014</span>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
