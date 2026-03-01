import type { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  loading?: boolean;
}

export default function KPICard({ title, value, icon, loading }: KPICardProps) {
  return (
    <div className="bg-navy-700 rounded-xl border border-gray-700/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">{title}</span>
        <div className="text-teal-400">{icon}</div>
      </div>
      {loading ? (
        <div className="skeleton h-8 w-32" />
      ) : (
        <p className="text-2xl font-bold tracking-tight">{value}</p>
      )}
    </div>
  );
}
