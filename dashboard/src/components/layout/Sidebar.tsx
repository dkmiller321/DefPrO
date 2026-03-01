import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Cpu,
  Network,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "contractors", label: "Contractors", icon: Building2 },
  { id: "capabilities", label: "Capabilities", icon: Cpu },
  { id: "teaming", label: "Teaming", icon: Network },
  { id: "query", label: "Query", icon: Search },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col bg-navy-800 border-r border-gray-700/50 transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-700/50">
        <Shield className="w-6 h-6 text-teal-400 flex-shrink-0" />
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight">
            Def<span className="text-teal-400">PrO</span>
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-gray-400 hover:text-white p-1"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-teal-500/10 text-teal-400 border-r-2 border-teal-400"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-gray-700/50 text-xs text-gray-500">
          Defense Procurement<br />Intelligence Platform
        </div>
      )}
    </aside>
  );
}
