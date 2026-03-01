import type { SparqlResponse } from "../types/api";

const ENDPOINT = import.meta.env.VITE_SPARQL_ENDPOINT || "/sparql";

export async function executeSparql(query: string): Promise<SparqlResponse> {
  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
    },
    body: `query=${encodeURIComponent(query)}`,
  });

  if (!resp.ok) {
    throw new Error(`SPARQL query failed: ${resp.status} ${resp.statusText}`);
  }

  return resp.json();
}

const PREFIXES = `
PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX data: <http://defenseprocurement.io/data#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
`;

export async function getOverviewStats(): Promise<{
  totalContracts: number;
  totalSpend: number;
  uniqueContractors: number;
  uniqueCapabilities: number;
}> {
  const query = `${PREFIXES}
SELECT
  (COUNT(DISTINCT ?award) AS ?totalContracts)
  (SUM(?amount) AS ?totalSpend)
  (COUNT(DISTINCT ?contractor) AS ?uniqueContractors)
  (COUNT(DISTINCT ?cap) AS ?uniqueCapabilities)
WHERE {
  ?award a dp:ContractAward ;
         dp:awardedTo ?contractor ;
         dp:obligatedAmount ?amount .
  OPTIONAL { ?award dp:requiresCapability ?cap . }
}`;

  const resp = await executeSparql(query);
  const b = resp.results.bindings[0] || {};
  return {
    totalContracts: parseInt(b.totalContracts?.value || "0"),
    totalSpend: parseFloat(b.totalSpend?.value || "0"),
    uniqueContractors: parseInt(b.uniqueContractors?.value || "0"),
    uniqueCapabilities: parseInt(b.uniqueCapabilities?.value || "0"),
  };
}

export async function getSpendByCapability(): Promise<
  { capability: string; spend: number }[]
> {
  const query = `${PREFIXES}
SELECT ?capLabel (SUM(?amount) AS ?spend)
WHERE {
  ?award a dp:ContractAward ;
         dp:requiresCapability ?cap ;
         dp:obligatedAmount ?amount .
  ?cap rdfs:label ?capLabel .
}
GROUP BY ?capLabel
ORDER BY DESC(?spend)`;

  const resp = await executeSparql(query);
  return resp.results.bindings.map((b) => ({
    capability: b.capLabel?.value || "Unknown",
    spend: parseFloat(b.spend?.value || "0"),
  }));
}

export async function getTopContractors(limit = 10): Promise<
  { name: string; totalValue: number; awardCount: number; capabilities: string }[]
> {
  const query = `${PREFIXES}
SELECT ?contractorName
  (SUM(?amount) AS ?totalValue)
  (COUNT(DISTINCT ?award) AS ?awardCount)
  (GROUP_CONCAT(DISTINCT ?capLabel; separator=", ") AS ?capabilities)
WHERE {
  ?award a dp:ContractAward ;
         dp:awardedTo ?contractor ;
         dp:obligatedAmount ?amount .
  ?contractor rdfs:label ?contractorName .
  OPTIONAL { ?award dp:requiresCapability ?cap . ?cap rdfs:label ?capLabel . }
}
GROUP BY ?contractorName
ORDER BY DESC(?totalValue)
LIMIT ${limit}`;

  const resp = await executeSparql(query);
  return resp.results.bindings.map((b) => ({
    name: b.contractorName?.value || "Unknown",
    totalValue: parseFloat(b.totalValue?.value || "0"),
    awardCount: parseInt(b.awardCount?.value || "0"),
    capabilities: b.capabilities?.value || "",
  }));
}

export async function getSpendOverTime(): Promise<
  { fiscalYear: string; spend: number; awards: number }[]
> {
  const query = `${PREFIXES}
SELECT ?fy (SUM(?amount) AS ?spend) (COUNT(?award) AS ?awards)
WHERE {
  ?award a dp:ContractAward ;
         dp:obligatedAmount ?amount ;
         dp:fiscalYear ?fy .
}
GROUP BY ?fy
ORDER BY ?fy`;

  const resp = await executeSparql(query);
  return resp.results.bindings.map((b) => ({
    fiscalYear: b.fy?.value || "",
    spend: parseFloat(b.spend?.value || "0"),
    awards: parseInt(b.awards?.value || "0"),
  }));
}

export async function getContractorList(): Promise<
  { name: string; uri: string; uei: string; awardCount: number; totalValue: number; isSmallBusiness: boolean; capabilities: string }[]
> {
  const query = `${PREFIXES}
SELECT ?contractor ?contractorName ?uei ?isSmall
  (COUNT(DISTINCT ?award) AS ?awardCount)
  (SUM(?amount) AS ?totalValue)
  (GROUP_CONCAT(DISTINCT ?capLabel; separator=", ") AS ?capabilities)
WHERE {
  ?award a dp:ContractAward ;
         dp:awardedTo ?contractor ;
         dp:obligatedAmount ?amount .
  ?contractor rdfs:label ?contractorName .
  OPTIONAL { ?contractor dp:ueiNumber ?uei . }
  OPTIONAL { ?contractor dp:isSmallBusiness ?isSmall . }
  OPTIONAL { ?award dp:requiresCapability ?cap . ?cap rdfs:label ?capLabel . }
}
GROUP BY ?contractor ?contractorName ?uei ?isSmall
ORDER BY DESC(?totalValue)
LIMIT 200`;

  const resp = await executeSparql(query);
  return resp.results.bindings.map((b) => ({
    name: b.contractorName?.value || "Unknown",
    uri: b.contractor?.value || "",
    uei: b.uei?.value || "",
    awardCount: parseInt(b.awardCount?.value || "0"),
    totalValue: parseFloat(b.totalValue?.value || "0"),
    isSmallBusiness: b.isSmall?.value === "true",
    capabilities: b.capabilities?.value || "",
  }));
}

export async function getCapabilityHeatmap(): Promise<
  { capability: string; agency: string; spend: number }[]
> {
  const query = `${PREFIXES}
SELECT ?capLabel ?agencyName (SUM(?amount) AS ?spend)
WHERE {
  ?award a dp:ContractAward ;
         dp:requiresCapability ?cap ;
         dp:awardedBy ?agency ;
         dp:obligatedAmount ?amount .
  ?cap rdfs:label ?capLabel .
  ?agency rdfs:label ?agencyName .
}
GROUP BY ?capLabel ?agencyName
ORDER BY ?capLabel ?agencyName`;

  const resp = await executeSparql(query);
  return resp.results.bindings.map((b) => ({
    capability: b.capLabel?.value || "",
    agency: b.agencyName?.value || "",
    spend: parseFloat(b.spend?.value || "0"),
  }));
}

export async function getNetworkData(): Promise<{
  nodes: { id: string; label: string; value: number; group: string }[];
  links: { source: string; target: string; value: number }[];
}> {
  const query = `${PREFIXES}
SELECT ?contractor ?contractorName ?agency ?agencyName
  (COUNT(?award) AS ?awardCount)
  (SUM(?amount) AS ?totalValue)
  (SAMPLE(?capLabel) AS ?primaryCap)
WHERE {
  ?award a dp:ContractAward ;
         dp:awardedTo ?contractor ;
         dp:awardedBy ?agency ;
         dp:obligatedAmount ?amount .
  ?contractor rdfs:label ?contractorName .
  ?agency rdfs:label ?agencyName .
  OPTIONAL { ?award dp:requiresCapability ?cap . ?cap rdfs:label ?capLabel . }
}
GROUP BY ?contractor ?contractorName ?agency ?agencyName
ORDER BY DESC(?totalValue)
LIMIT 100`;

  const resp = await executeSparql(query);

  const nodeMap = new Map<string, { id: string; label: string; value: number; group: string }>();
  const links: { source: string; target: string; value: number }[] = [];

  for (const b of resp.results.bindings) {
    const cId = b.contractor?.value || "";
    const cName = b.contractorName?.value || "";
    const aId = b.agency?.value || "";
    const aName = b.agencyName?.value || "";
    const value = parseFloat(b.totalValue?.value || "0");
    const cap = b.primaryCap?.value || "Other";

    if (cId && !nodeMap.has(cId)) {
      nodeMap.set(cId, { id: cId, label: cName, value: 0, group: cap });
    }
    if (cId) {
      const node = nodeMap.get(cId)!;
      node.value += value;
    }

    if (aId && !nodeMap.has(aId)) {
      nodeMap.set(aId, { id: aId, label: aName, value: 0, group: "Agency" });
    }
    if (aId) {
      const node = nodeMap.get(aId)!;
      node.value += value;
    }

    if (cId && aId) {
      links.push({ source: cId, target: aId, value });
    }
  }

  return { nodes: [...nodeMap.values()], links };
}
