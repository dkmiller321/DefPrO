import type { CapabilityConcentration } from "../../types/api";
import { formatDollars, formatPercent } from "../../utils/format";

interface Props {
  data: CapabilityConcentration[];
  loading?: boolean;
}

function riskColor(share: number): string {
  if (share >= 0.8) return "text-red-400";
  if (share >= 0.5) return "text-amber-400";
  return "text-green-400";
}

function riskBg(share: number): string {
  if (share >= 0.8) return "bg-red-500";
  if (share >= 0.5) return "bg-amber-500";
  return "bg-green-500";
}

export default function ConcentrationPanel({ data, loading }: Props) {
  if (loading) {
    return <div className="skeleton h-64 w-full rounded-xl" />;
  }

  return (
    <div className="bg-navy-700 rounded-xl border border-gray-700/50 p-5">
      <h3 className="text-sm font-medium text-gray-400 mb-1">
        Concentration Risk
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Top contractor&apos;s share of spend per capability
      </p>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm">No data available</p>
      ) : (
        <div className="space-y-3">
          {data.map((row) => (
            <div key={row.capability}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-300">{row.capability}</span>
                <span className={`font-medium ${riskColor(row.share)}`}>
                  {formatPercent(row.share)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Concentration bar */}
                <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${riskBg(row.share)}`}
                    style={{ width: `${row.share * 100}%`, opacity: 0.7 }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 w-28 text-right truncate">
                  {row.topContractor}
                </span>
              </div>
              <div className="text-[10px] text-gray-600 mt-0.5">
                {formatDollars(row.topContractorSpend)} of{" "}
                {formatDollars(row.totalSpend)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
