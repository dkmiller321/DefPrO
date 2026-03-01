import { useState } from "react";
import { Play, Download, Loader2 } from "lucide-react";
import { executeSparql } from "../../api/sparql";
import type { SparqlResponse } from "../../types/api";

const EXAMPLE_QUERIES = [
  {
    label: "Top 10 Contractors",
    query: `PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?name (SUM(?amount) AS ?totalSpend) (COUNT(?award) AS ?awards)
WHERE {
  ?award a dp:ContractAward ;
         dp:awardedTo ?c ;
         dp:obligatedAmount ?amount .
  ?c rdfs:label ?name .
}
GROUP BY ?name
ORDER BY DESC(?totalSpend)
LIMIT 10`,
  },
  {
    label: "Capability Gap",
    query: `PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?cap (COUNT(DISTINCT ?c) AS ?contractors) (SUM(?amt) AS ?spend)
WHERE {
  ?a dp:requiresCapability ?capUri ;
     dp:awardedTo ?c ;
     dp:obligatedAmount ?amt .
  ?capUri rdfs:label ?cap .
}
GROUP BY ?cap
ORDER BY DESC(?spend)`,
  },
];

export default function QueryPage() {
  const [query, setQuery] = useState(EXAMPLE_QUERIES[0].query);
  const [results, setResults] = useState<SparqlResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function executeQuery() {
    setLoading(true);
    setError(null);
    try {
      const resp = await executeSparql(query);
      setResults(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    if (!results) return;
    const vars = results.head.vars;
    const rows = results.results.bindings.map((b) =>
      vars.map((v) => b[v]?.value || "").join(",")
    );
    const csv = [vars.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {EXAMPLE_QUERIES.map((eq) => (
          <button
            key={eq.label}
            onClick={() => setQuery(eq.query)}
            className="px-3 py-1.5 text-xs bg-navy-700 border border-gray-700/50 rounded-lg hover:bg-navy-600 transition-colors"
          >
            {eq.label}
          </button>
        ))}
      </div>

      <div className="bg-navy-700 rounded-xl border border-gray-700/50 overflow-hidden">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-48 p-4 bg-transparent text-sm font-mono text-gray-200 resize-y focus:outline-none"
          spellCheck={false}
        />
        <div className="flex items-center gap-2 p-3 border-t border-gray-700/50">
          <button
            onClick={executeQuery}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Execute
          </button>
          {results && (
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2 bg-navy-600 text-gray-300 rounded-lg text-sm hover:bg-navy-500 transition-colors"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
          {results && (
            <span className="ml-auto text-xs text-gray-400">
              {results.results.bindings.length} rows
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {results && results.results.bindings.length > 0 && (
        <div className="bg-navy-700 rounded-xl border border-gray-700/50 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                {results.head.vars.map((v) => (
                  <th key={v} className="text-left p-3 text-gray-400 font-medium whitespace-nowrap">
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.results.bindings.slice(0, 100).map((row, i) => (
                <tr key={i} className="border-b border-gray-700/30 hover:bg-white/5">
                  {results.head.vars.map((v) => (
                    <td key={v} className="p-3 max-w-[300px] truncate" title={row[v]?.value || ""}>
                      {(row[v]?.value || "")
                        .replace("http://defenseprocurement.io/ontology#", "dp:")
                        .replace("http://defenseprocurement.io/data#", "data:")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
