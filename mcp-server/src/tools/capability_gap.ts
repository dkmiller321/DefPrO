import { SparqlClient } from "../sparql/client.js";
import { buildCapabilityGapQuery, type CapabilityGapParams } from "../sparql/query_builder.js";

export async function capabilityGapAnalysis(
  client: SparqlClient,
  params: CapabilityGapParams
): Promise<string> {
  const sparql = buildCapabilityGapQuery(params);
  const results = await client.query(sparql);
  const bindings = results.results.bindings;

  if (bindings.length === 0) {
    return "No capability gap data found for the specified criteria.";
  }

  // Group by capability
  const byCapability = new Map<
    string,
    { years: { fy: string; contractors: number; spend: number }[] }
  >();

  for (const b of bindings) {
    const cap = b.capabilityLabel?.value || "Unknown";
    const fy = b.fiscalYear?.value || "Unknown";
    const contractors = parseInt(b.contractorCount?.value || "0");
    const spend = parseFloat(b.totalSpend?.value || "0");

    if (!byCapability.has(cap)) {
      byCapability.set(cap, { years: [] });
    }
    byCapability.get(cap)!.years.push({ fy, contractors, spend });
  }

  let output = `Capability Gap Analysis (${byCapability.size} capabilities):\n\n`;

  for (const [cap, data] of byCapability) {
    const sorted = data.years.sort((a, b) => a.fy.localeCompare(b.fy));
    output += `### ${cap}\n`;
    for (const yr of sorted) {
      output += `  FY${yr.fy}: ${yr.contractors} contractors, $${yr.spend.toLocaleString()} spend\n`;
    }

    if (sorted.length >= 2) {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const spendTrend = last.spend > first.spend ? "GROWING" : "SHRINKING";
      const baseTrend = last.contractors > first.contractors ? "GROWING" : last.contractors < first.contractors ? "SHRINKING" : "STABLE";
      output += `  Spend trend: ${spendTrend} | Contractor base: ${baseTrend}\n`;

      if (spendTrend === "GROWING" && baseTrend === "SHRINKING") {
        output += `  ⚠ GAP DETECTED: Growing spend with shrinking contractor base\n`;
      }
    }
    output += "\n";
  }

  return output;
}
