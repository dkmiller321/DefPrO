import { Database } from "lucide-react";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="h-14 border-b border-gray-700/50 bg-navy-800/50 backdrop-blur flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-3 text-sm text-gray-400">
        <Database className="w-4 h-4 text-teal-400" />
        <span>Fuseki Connected</span>
      </div>
    </header>
  );
}
