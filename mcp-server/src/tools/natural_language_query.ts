import { SparqlClient } from "../sparql/client.js";
import { naturalLanguageToSparql } from "../sparql/nl_to_sparql.js";

export async function naturalLanguageQuery(
  client: SparqlClient,
  question: string
): Promise<string> {
  const sparql = await naturalLanguageToSparql(question);

  let output = `**Question:** ${question}\n\n`;
  output += `**Generated SPARQL:**\n\`\`\`sparql\n${sparql}\n\`\`\`\n\n`;

  try {
    const results = await client.query(sparql);
    const bindings = results.results.bindings;
    const vars = results.head.vars;

    if (bindings.length === 0) {
      output += "**Results:** No data found.\n";
      return output;
    }

    output += `**Results:** ${bindings.length} rows\n\n`;

    // Format as markdown table
    output += "| " + vars.join(" | ") + " |\n";
    output += "| " + vars.map(() => "---").join(" | ") + " |\n";

    for (const binding of bindings.slice(0, 50)) {
      const row = vars.map((v) => {
        const val = binding[v]?.value || "";
        // Shorten URIs
        return val
          .replace("http://defenseprocurement.io/ontology#", "dp:")
          .replace("http://defenseprocurement.io/data#", "data:");
      });
      output += "| " + row.join(" | ") + " |\n";
    }

    if (bindings.length > 50) {
      output += `\n_(Showing first 50 of ${bindings.length} results)_\n`;
    }

    return output;
  } catch (error) {
    output += `**Error executing query:** ${error instanceof Error ? error.message : String(error)}\n`;
    return output;
  }
}
