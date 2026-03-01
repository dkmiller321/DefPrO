import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SparqlClient } from "./sparql/client.js";
import { queryContractors } from "./tools/query_contractors.js";
import { analyzeTeaming } from "./tools/analyze_teaming.js";
import { capabilityGapAnalysis } from "./tools/capability_gap.js";
import { contractorProfile } from "./tools/contractor_profile.js";
import { naturalLanguageQuery } from "./tools/natural_language_query.js";

const sparqlClient = new SparqlClient();

const server = new McpServer({
  name: "defpro-intelligence",
  version: "1.0.0",
});

server.tool(
  "query_contractors",
  "Find contractors by capability, size, location, or agency relationships",
  {
    capability: z.string().optional().describe("Technical capability area (e.g., AIandML, CyberSecurity, ElectronicWarfare)"),
    agency: z.string().optional().describe("Government agency name"),
    minAwardValue: z.number().optional().describe("Minimum total award value"),
    maxAwardValue: z.number().optional().describe("Maximum total award value"),
    isSmallBusiness: z.boolean().optional().describe("Filter for small businesses"),
    fiscalYear: z.string().optional().describe("Fiscal year (e.g., 2024)"),
    state: z.string().optional().describe("State code (e.g., VA, CA)"),
  },
  async (params) => {
    const result = await queryContractors(sparqlClient, params);
    return { content: [{ type: "text", text: result }] };
  }
);

server.tool(
  "analyze_teaming",
  "Find teaming patterns between contractors — who works with whom on what",
  {
    contractor: z.string().optional().describe("Contractor name to search for"),
    role: z.enum(["prime", "sub", "any"]).optional().describe("Role filter"),
    capability: z.string().optional().describe("Technical capability area"),
    fiscalYear: z.string().optional().describe("Fiscal year"),
  },
  async (params) => {
    const result = await analyzeTeaming(sparqlClient, params);
    return { content: [{ type: "text", text: result }] };
  }
);

server.tool(
  "capability_gap_analysis",
  "Identify capability areas with growing spend but shrinking contractor base",
  {
    agency: z.string().optional().describe("Filter by agency"),
    startYear: z.string().optional().describe("Start fiscal year"),
    endYear: z.string().optional().describe("End fiscal year"),
  },
  async (params) => {
    const result = await capabilityGapAnalysis(sparqlClient, params);
    return { content: [{ type: "text", text: result }] };
  }
);

server.tool(
  "contractor_profile",
  "Get full profile of a contractor — awards, capabilities, agencies, teaming partners",
  {
    contractor: z.string().describe("Contractor name or UEI to look up"),
  },
  async ({ contractor }) => {
    const result = await contractorProfile(sparqlClient, contractor);
    return { content: [{ type: "text", text: result }] };
  }
);

server.tool(
  "natural_language_query",
  "Convert a natural language question into a SPARQL query and execute it against the procurement knowledge graph",
  {
    question: z.string().describe("Natural language question about defense procurement"),
  },
  async ({ question }) => {
    const result = await naturalLanguageQuery(sparqlClient, question);
    return { content: [{ type: "text", text: result }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DefPrO MCP Server running on stdio");
}

main().catch(console.error);
