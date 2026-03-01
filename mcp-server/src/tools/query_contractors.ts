import { SparqlClient } from "../sparql/client.js";
import { buildContractorQuery, type ContractorQueryParams } from "../sparql/query_builder.js";

export async function queryContractors(
  client: SparqlClient,
  params: ContractorQueryParams
): Promise<string> {
  const sparql = buildContractorQuery(params);
  const results = await client.query(sparql);
  const bindings = results.results.bindings;

  if (bindings.length === 0) {
    return "No contractors found matching the specified criteria.";
  }

  const rows = bindings.map((b) => ({
    name: b.contractorName?.value || "Unknown",
    totalAwards: parseInt(b.totalAwards?.value || "0"),
    totalValue: parseFloat(b.totalValue?.value || "0"),
    capabilities: b.capabilities?.value || "None classified",
  }));

  const header = `Found ${rows.length} contractors:\n\n`;
  const table = rows
    .map(
      (r, i) =>
        `${i + 1}. **${r.name}**\n   Awards: ${r.totalAwards} | Value: $${r.totalValue.toLocaleString()}\n   Capabilities: ${r.capabilities}`
    )
    .join("\n\n");

  return header + table;
}
