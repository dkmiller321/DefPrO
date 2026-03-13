import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X } from "lucide-react";

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  capabilities: string[];
  selectedCapabilities: string[];
  onCapabilitiesChange: (caps: string[]) => void;
  showSmallBusinessOnly: boolean;
  onSmallBusinessToggle: (value: boolean) => void;
}

export default function FilterBar({
  searchValue,
  onSearchChange,
  capabilities,
  selectedCapabilities,
  onCapabilitiesChange,
  showSmallBusinessOnly,
  onSmallBusinessToggle,
}: FilterBarProps) {
  const [capOpen, setCapOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setCapOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleCap(cap: string) {
    if (selectedCapabilities.includes(cap)) {
      onCapabilitiesChange(selectedCapabilities.filter((c) => c !== cap));
    } else {
      onCapabilitiesChange([...selectedCapabilities, cap]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Text search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search by name or UEI..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-navy-700 border border-gray-700/50 rounded-lg text-sm focus:outline-none focus:border-teal-500 transition-colors"
        />
      </div>

      {/* Capability filter dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setCapOpen(!capOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-navy-700 border border-gray-700/50 rounded-lg text-sm hover:border-gray-600 transition-colors"
        >
          <span className="text-gray-400">
            {selectedCapabilities.length > 0
              ? `${selectedCapabilities.length} capability${selectedCapabilities.length > 1 ? "ies" : ""}`
              : "All Capabilities"}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        </button>

        {capOpen && (
          <div className="absolute z-50 top-full mt-1 left-0 w-64 max-h-64 overflow-y-auto bg-navy-700 border border-gray-700/50 rounded-lg shadow-xl">
            {selectedCapabilities.length > 0 && (
              <button
                onClick={() => onCapabilitiesChange([])}
                className="w-full px-3 py-1.5 text-xs text-teal-400 hover:bg-white/5 text-left"
              >
                Clear all
              </button>
            )}
            {capabilities.map((cap) => (
              <label
                key={cap}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedCapabilities.includes(cap)}
                  onChange={() => toggleCap(cap)}
                  className="rounded border-gray-600 bg-navy-800 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                />
                <span className="text-gray-300">{cap}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Small business toggle */}
      <button
        onClick={() => onSmallBusinessToggle(!showSmallBusinessOnly)}
        className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
          showSmallBusinessOnly
            ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
            : "bg-navy-700 border-gray-700/50 text-gray-400 hover:border-gray-600"
        }`}
      >
        Small Business
      </button>

      {/* Active filter pills */}
      {selectedCapabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCapabilities.map((cap) => (
            <span
              key={cap}
              className="flex items-center gap-1 px-2 py-0.5 bg-teal-500/15 text-teal-400 text-xs rounded-full"
            >
              {cap}
              <X
                className="w-3 h-3 cursor-pointer hover:text-white"
                onClick={() => toggleCap(cap)}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
