import { SparqlClient } from "../sparql/client.js";
import { buildTeamingQuery, type TeamingQueryParams } from "../sparql/query_builder.js";

export async function analyzeTeaming(
  client: SparqlClient,
  params: TeamingQueryParams
): Promise<string> {
  const sparql = buildTeamingQuery(params);
  const results = await client.query(sparql);
  const bindings = results.results.bindings;

  if (bindings.length === 0) {
    return "No teaming relationships found matching the criteria.";
  }

  const rows = bindings.map((b) => ({
    contractor: b.contractorName?.value || "Unknown",
    agency: b.agencyName?.value || "Unknown",
    awardCount: parseInt(b.awardCount?.value || "0"),
    totalValue: parseFloat(b.totalValue?.value || "0"),
    capabilities: b.capabilities?.value || "None",
  }));

  const header = `Found ${rows.length} teaming relationships:\n\n`;
  const table = rows
    .map(
      (r, i) =>
        `${i + 1}. **${r.contractor}** → ${r.agency}\n   Awards: ${r.awardCount} | Value: $${r.totalValue.toLocaleString()}\n   Capabilities: ${r.capabilities}`
    )
    .join("\n\n");

  return header + table;
}
