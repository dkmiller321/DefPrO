import { SparqlClient } from "../sparql/client.js";
import { buildContractorProfileQuery } from "../sparql/query_builder.js";

export async function contractorProfile(
  client: SparqlClient,
  contractor: string
): Promise<string> {
  const sparql = buildContractorProfileQuery({ contractor });
  const results = await client.query(sparql);
  const bindings = results.results.bindings;

  if (bindings.length === 0) {
    return `No contractor found matching "${contractor}".`;
  }

  const first = bindings[0];
  const name = first.contractorName?.value || "Unknown";
  const uei = first.uei?.value || "N/A";
  const isSmall = first.isSmallBusiness?.value === "true" ? "Yes" : "No";

  // Aggregate across bindings
  const capabilities = new Set<string>();
  const agencies = new Set<string>();
  const awards = new Map<string, { amount: number; agency: string; capability: string; fy: string; desc: string }>();

  let totalSpend = 0;

  for (const b of bindings) {
    if (b.capLabel?.value) capabilities.add(b.capLabel.value);
    if (b.agencyName?.value) agencies.add(b.agencyName.value);

    const awardUri = b.award?.value || "";
    const amount = parseFloat(b.amount?.value || "0");

    if (awardUri && !awards.has(awardUri)) {
      awards.set(awardUri, {
        amount,
        agency: b.agencyName?.value || "Unknown",
        capability: b.capLabel?.value || "Unclassified",
        fy: b.fiscalYear?.value || "Unknown",
        desc: b.description?.value || "No description",
      });
      totalSpend += amount;
    }
  }

  let output = `## Contractor Profile: ${name}\n\n`;
  output += `- **UEI:** ${uei}\n`;
  output += `- **Small Business:** ${isSmall}\n`;
  output += `- **Total Awards:** ${awards.size}\n`;
  output += `- **Total Spend:** $${totalSpend.toLocaleString()}\n`;
  output += `- **Capabilities:** ${[...capabilities].join(", ") || "None classified"}\n`;
  output += `- **Agencies:** ${[...agencies].join(", ") || "None"}\n\n`;

  output += `### Recent Awards (top 10 by value):\n\n`;
  const sortedAwards = [...awards.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 10);

  for (const [, award] of sortedAwards) {
    output += `- **$${award.amount.toLocaleString()}** | FY${award.fy} | ${award.agency}\n`;
    output += `  ${award.capability} — ${award.desc.slice(0, 120)}\n`;
  }

  return output;
}
