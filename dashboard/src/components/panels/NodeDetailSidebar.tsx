import { X } from "lucide-react";
import type { NetworkNode } from "../../types/api";
import { formatDollars } from "../../utils/format";

interface Props {
  node: NetworkNode;
  onClose: () => void;
}

export default function NodeDetailSidebar({ node, onClose }: Props) {
  return (
    <div className="w-72 bg-navy-800 border-l border-gray-700/50 p-4 shrink-0 overflow-y-auto">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">{node.label}</h3>
          <span className="text-xs text-gray-500 capitalize">
            {node.type}
            {node.type === "contractor" && node.group !== "Other" && (
              <> &middot; {node.group}</>
            )}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="bg-navy-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-500">Total Award Value</div>
          <div className="text-lg font-semibold text-teal-400">
            {formatDollars(node.value)}
          </div>
        </div>

        {node.type === "contractor" && (
          <div className="bg-navy-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Primary Capability</div>
            <div className="text-sm text-gray-300">{node.group}</div>
          </div>
        )}

        <p className="text-[10px] text-gray-600">
          Click a different node in the graph to view its details. Click
          background to reset focus.
        </p>
      </div>
    </div>
  );
}
