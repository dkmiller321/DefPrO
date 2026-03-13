import { Network, Share2 } from "lucide-react";

interface NetworkControlsProps {
  viewMode: "contractor-agency" | "shared-capabilities";
  onViewModeChange: (mode: "contractor-agency" | "shared-capabilities") => void;
  capabilities: string[];
  selectedCapability: string | null;
  onCapabilityChange: (cap: string | null) => void;
  agencies: string[];
  selectedAgency: string | null;
  onAgencyChange: (agency: string | null) => void;
}

export default function NetworkControls({
  viewMode,
  onViewModeChange,
  capabilities,
  selectedCapability,
  onCapabilityChange,
  agencies,
  selectedAgency,
  onAgencyChange,
}: NetworkControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* View mode toggle */}
      <div className="flex rounded-lg overflow-hidden border border-gray-700/50">
        <button
          onClick={() => onViewModeChange("contractor-agency")}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
            viewMode === "contractor-agency"
              ? "bg-teal-500/20 text-teal-400"
              : "bg-navy-700 text-gray-400 hover:text-white"
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          Contractor–Agency
        </button>
        <button
          onClick={() => onViewModeChange("shared-capabilities")}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
            viewMode === "shared-capabilities"
              ? "bg-teal-500/20 text-teal-400"
              : "bg-navy-700 text-gray-400 hover:text-white"
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          Shared Capabilities
        </button>
      </div>

      {/* Capability filter */}
      <select
        value={selectedCapability || ""}
        onChange={(e) =>
          onCapabilityChange(e.target.value || null)
        }
        className="px-3 py-2 bg-navy-700 border border-gray-700/50 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-teal-500"
      >
        <option value="">All Capabilities</option>
        {capabilities.map((cap) => (
          <option key={cap} value={cap}>
            {cap}
          </option>
        ))}
      </select>

      {/* Agency filter (only in contractor-agency mode) */}
      {viewMode === "contractor-agency" && (
        <select
          value={selectedAgency || ""}
          onChange={(e) =>
            onAgencyChange(e.target.value || null)
          }
          className="px-3 py-2 bg-navy-700 border border-gray-700/50 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-teal-500"
        >
          <option value="">All Agencies</option>
          {agencies.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
