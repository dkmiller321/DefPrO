import type {
  SparqlResponse,
  ContractorSummary,
  ContractorDetail,
  CapabilitySummary,
  CapabilityConcentration,
  HeatmapCell,
  NetworkNode,
  NetworkLink,
  NetworkFilters,
} from "../types/api";

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

// ---------------------------------------------------------------------------
// Overview page (unchanged)
// ---------------------------------------------------------------------------

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
  {
    name: string;
    totalValue: number;
    awardCount: number;
    capabilities: string;
  }[]
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

// ---------------------------------------------------------------------------
// Contractors page — FIXED: GROUP BY without UEI to avoid duplicate rows
// ---------------------------------------------------------------------------

export async function getContractorList(): Promise<ContractorSummary[]> {
  const query = `${PREFIXES}
SELECT ?contractor ?contractorName
  (GROUP_CONCAT(DISTINCT ?uei; separator="|") AS ?ueis)
  (SAMPLE(?isSmall) AS ?isSmallBusiness)
  (COUNT(DISTINCT ?award) AS ?awardCount)
  (SUM(?amount) AS ?totalValue)
  (GROUP_CONCAT(DISTINCT ?capLabel; separator="|") AS ?capabilities)
WHERE {
  ?award a dp:ContractAward ;
         dp:awardedTo ?contractor ;
         dp:obligatedAmount ?amount .
  ?contractor rdfs:label ?contractorName .
  OPTIONAL { ?contractor dp:ueiNumber ?uei . }
  OPTIONAL { ?contractor dp:isSmallBusiness ?isSmall . }
  OPTIONAL { ?contractor dp:hasCapability ?cap . ?cap rdfs:label ?capLabel . }
}
GROUP BY ?contractor ?contractorName
ORDER BY DESC(?totalValue)
LIMIT 200`;

  const resp = await executeSparql(query);
  return resp.results.bindings.map((b) => ({
    uri: b.contractor?.value || "",
    name: b.contractorName?.value || "Unknown",
    ueis: (b.ueis?.value || "").split("|").filter(Boolean),
    awardCount: parseInt(b.awardCount?.value || "0"),
    totalValue: parseFloat(b.totalValue?.value || "0"),
    isSmallBusiness: b.isSmallBusiness?.value === "true",
    capabilities: (b.capabilities?.value || "").split("|").filter(Boolean),
  }));
}

export async function getContractorDetail(
  contractorUri: string
): Promise<ContractorDetail> {
  const escaped = contractorUri.replace(/'/g, "\\'");

  const capQuery = `${PREFIXES}
SELECT ?capLabel (SUM(?amount) AS ?capSpend)
WHERE {
  ?award a dp:ContractAward ;
         dp:awardedTo <${escaped}> ;
         dp:obligatedAmount ?amount ;
         dp:requiresCapability ?cap .
  ?cap rdfs:label ?capLabel .
}
GROUP BY ?capLabel
ORDER BY DESC(?capSpend)`;

  const awardsQuery = `${PREFIXES}
SELECT ?award ?amount ?desc ?fy
WHERE {
  ?award a dp:ContractAward ;
         dp:awardedTo <${escaped}> ;
         dp:obligatedAmount ?amount .
  OPTIONAL { ?award dp:description ?desc . }
  OPTIONAL { ?award dp:fiscalYear ?fy . }
}
ORDER BY DESC(?amount)
LIMIT 10`;

  const agencyQuery = `${PREFIXES}
SELECT ?agencyName (SUM(?amount) AS ?agencySpend)
WHERE {
  ?award a dp:ContractAward ;
         dp:awardedTo <${escaped}> ;
         dp:awardedBy ?agency ;
         dp:obligatedAmount ?amount .
  ?agency rdfs:label ?agencyName .
  FILTER NOT EXISTS { ?child dp:parentAgency ?agency . }
}
GROUP BY ?agencyName
ORDER BY DESC(?agencySpend)`;

  const trendQuery = `${PREFIXES}
SELECT ?fy (SUM(?amount) AS ?spend)
WHERE {
  ?award a dp:ContractAward ;
         dp:awardedTo <${escaped}> ;
         dp:obligatedAmount ?amount ;
         dp:fiscalYear ?fy .
}
GROUP BY ?fy
ORDER BY ?fy`;

  const [capResp, awardsResp, agencyResp, trendResp] = await Promise.all([
    executeSparql(capQuery),
    executeSparql(awardsQuery),
    executeSparql(agencyQuery),
    executeSparql(trendQuery),
  ]);

  return {
    capabilities: capResp.results.bindings.map((b) => ({
      name: b.capLabel?.value || "",
      spend: parseFloat(b.capSpend?.value || "0"),
    })),
    topAwards: awardsResp.results.bindings.map((b) => ({
      id: (b.award?.value || "").replace(
        "http://defenseprocurement.io/data#award_",
        ""
      ),
      amount: parseFloat(b.amount?.value || "0"),
      description: b.desc?.value || "",
      fiscalYear: b.fy?.value || "",
    })),
    agencies: agencyResp.results.bindings.map((b) => ({
      name: b.agencyName?.value || "",
      spend: parseFloat(b.agencySpend?.value || "0"),
    })),
    spendByYear: trendResp.results.bindings.map((b) => ({
      fiscalYear: b.fy?.value || "",
      spend: parseFloat(b.spend?.value || "0"),
    })),
  };
}

export async function getCapabilityOptions(): Promise<string[]> {
  const query = `${PREFIXES}
SELECT DISTINCT ?capLabel
WHERE {
  ?contractor dp:hasCapability ?cap .
  ?cap rdfs:label ?capLabel .
}
ORDER BY ?capLabel`;

  const resp = await executeSparql(query);
  return resp.results.bindings.map((b) => b.capLabel?.value || "").filter(Boolean);
}

// ---------------------------------------------------------------------------
// Capabilities page — FIXED: filter out toptier DoD to show subtier agencies
// ---------------------------------------------------------------------------

export async function getCapabilityHeatmap(): Promise<HeatmapCell[]> {
  const query = `${PREFIXES}
SELECT ?capLabel ?agencyName (SUM(?amount) AS ?spend)
WHERE {
  ?award a dp:ContractAward ;
         dp:requiresCapability ?cap ;
         dp:awardedBy ?agency ;
         dp:obligatedAmount ?amount .
  ?cap rdfs:label ?capLabel .
  ?agency rdfs:label ?agencyName .
  FILTER NOT EXISTS { ?child dp:parentAgency ?agency . }
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

export async function getCapabilityStats(): Promise<CapabilitySummary[]> {
  const query = `${PREFIXES}
SELECT ?capLabel
  (COUNT(DISTINCT ?contractor) AS ?contractorCount)
  (COUNT(DISTINCT ?award) AS ?awardCount)
  (SUM(?amount) AS ?totalSpend)
WHERE {
  ?award a dp:ContractAward ;
         dp:requiresCapability ?cap ;
         dp:awardedTo ?contractor ;
         dp:obligatedAmount ?amount .
  ?cap rdfs:label ?capLabel .
}
GROUP BY ?capLabel
ORDER BY DESC(?totalSpend)`;

  const resp = await executeSparql(query);
  return resp.results.bindings.map((b) => ({
    name: b.capLabel?.value || "",
    totalSpend: parseFloat(b.totalSpend?.value || "0"),
    contractorCount: parseInt(b.contractorCount?.value || "0"),
    awardCount: parseInt(b.awardCount?.value || "0"),
  }));
}

export async function getCapabilityConcentration(): Promise<
  CapabilityConcentration[]
> {
  const query = `${PREFIXES}
SELECT ?capLabel ?contractorName
  (SUM(?amount) AS ?contractorSpend)
WHERE {
  ?award a dp:ContractAward ;
         dp:requiresCapability ?cap ;
         dp:awardedTo ?contractor ;
         dp:obligatedAmount ?amount .
  ?cap rdfs:label ?capLabel .
  ?contractor rdfs:label ?contractorName .
}
GROUP BY ?capLabel ?contractorName
ORDER BY ?capLabel DESC(?contractorSpend)`;

  const resp = await executeSparql(query);

  // Post-process: for each capability find the top contractor and total
  const capMap = new Map<
    string,
    { topContractor: string; topSpend: number; totalSpend: number }
  >();

  for (const b of resp.results.bindings) {
    const cap = b.capLabel?.value || "";
    const contractor = b.contractorName?.value || "";
    const spend = parseFloat(b.contractorSpend?.value || "0");

    const entry = capMap.get(cap);
    if (!entry) {
      capMap.set(cap, {
        topContractor: contractor,
        topSpend: spend,
        totalSpend: spend,
      });
    } else {
      entry.totalSpend += spend;
      if (spend > entry.topSpend) {
        entry.topContractor = contractor;
        entry.topSpend = spend;
      }
    }
  }

  return [...capMap.entries()]
    .map(([capability, { topContractor, topSpend, totalSpend }]) => ({
      capability,
      topContractor,
      topContractorSpend: topSpend,
      totalSpend,
      share: totalSpend > 0 ? topSpend / totalSpend : 0,
    }))
    .sort((a, b) => b.share - a.share);
}

// ---------------------------------------------------------------------------
// Teaming / Network page — FIXED: filter DoD super-node, add filters
// ---------------------------------------------------------------------------

export async function getNetworkData(
  filters?: NetworkFilters
): Promise<{ nodes: NetworkNode[]; links: NetworkLink[] }> {
  const capFilter = filters?.capability
    ? `FILTER EXISTS { ?award dp:requiresCapability ?fc . ?fc rdfs:label "${filters.capability}" . }`
    : "";
  const agencyFilter = filters?.agency
    ? `FILTER(?agencyName = "${filters.agency}")`
    : "";
  const valueFilter = filters?.minValue
    ? `HAVING(SUM(?amount) >= ${filters.minValue})`
    : "";

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
  FILTER NOT EXISTS { ?child dp:parentAgency ?agency . }
  OPTIONAL { ?award dp:requiresCapability ?cap . ?cap rdfs:label ?capLabel . }
  ${capFilter}
  ${agencyFilter}
}
GROUP BY ?contractor ?contractorName ?agency ?agencyName
${valueFilter}
ORDER BY DESC(?totalValue)
LIMIT 150`;

  const resp = await executeSparql(query);

  const nodeMap = new Map<string, NetworkNode>();
  const links: NetworkLink[] = [];

  for (const b of resp.results.bindings) {
    const cId = b.contractor?.value || "";
    const cName = b.contractorName?.value || "";
    const aId = b.agency?.value || "";
    const aName = b.agencyName?.value || "";
    const value = parseFloat(b.totalValue?.value || "0");
    const cap = b.primaryCap?.value || "Other";

    if (cId && !nodeMap.has(cId)) {
      nodeMap.set(cId, {
        id: cId,
        label: cName,
        value: 0,
        group: cap,
        type: "contractor",
      });
    }
    if (cId) nodeMap.get(cId)!.value += value;

    if (aId && !nodeMap.has(aId)) {
      nodeMap.set(aId, {
        id: aId,
        label: aName,
        value: 0,
        group: "Agency",
        type: "agency",
      });
    }
    if (aId) nodeMap.get(aId)!.value += value;

    if (cId && aId) {
      links.push({ source: cId, target: aId, value });
    }
  }

  return { nodes: [...nodeMap.values()], links };
}

export async function getSharedCapabilityNetwork(): Promise<{
  nodes: NetworkNode[];
  links: NetworkLink[];
}> {
  const query = `${PREFIXES}
SELECT ?c1 ?c1Name ?c2 ?c2Name
  (GROUP_CONCAT(DISTINCT ?capLabel; separator="|") AS ?sharedCaps)
  (COUNT(DISTINCT ?cap) AS ?sharedCount)
WHERE {
  ?c1 dp:hasCapability ?cap .
  ?c2 dp:hasCapability ?cap .
  ?c1 rdfs:label ?c1Name .
  ?c2 rdfs:label ?c2Name .
  ?cap rdfs:label ?capLabel .
  FILTER(STR(?c1) < STR(?c2))
}
GROUP BY ?c1 ?c1Name ?c2 ?c2Name
HAVING(COUNT(DISTINCT ?cap) >= 2)
ORDER BY DESC(?sharedCount)
LIMIT 100`;

  const resp = await executeSparql(query);

  const nodeMap = new Map<string, NetworkNode>();
  const links: NetworkLink[] = [];

  // We need spend data for node sizing — use a separate query
  const spendQuery = `${PREFIXES}
SELECT ?contractor ?contractorName
  (SUM(?amount) AS ?totalValue)
  (SAMPLE(?capLabel) AS ?primaryCap)
WHERE {
  ?award a dp:ContractAward ;
         dp:awardedTo ?contractor ;
         dp:obligatedAmount ?amount .
  ?contractor rdfs:label ?contractorName .
  OPTIONAL { ?contractor dp:hasCapability ?cap . ?cap rdfs:label ?capLabel . }
}
GROUP BY ?contractor ?contractorName
ORDER BY DESC(?totalValue)`;

  const spendResp = await executeSparql(spendQuery);
  const spendMap = new Map<string, { value: number; group: string }>();
  for (const b of spendResp.results.bindings) {
    spendMap.set(b.contractor?.value || "", {
      value: parseFloat(b.totalValue?.value || "0"),
      group: b.primaryCap?.value || "Other",
    });
  }

  for (const b of resp.results.bindings) {
    const c1Id = b.c1?.value || "";
    const c1Name = b.c1Name?.value || "";
    const c2Id = b.c2?.value || "";
    const c2Name = b.c2Name?.value || "";
    const sharedCount = parseInt(b.sharedCount?.value || "0");

    for (const [id, name] of [
      [c1Id, c1Name],
      [c2Id, c2Name],
    ] as const) {
      if (id && !nodeMap.has(id)) {
        const spend = spendMap.get(id);
        nodeMap.set(id, {
          id,
          label: name,
          value: spend?.value || 0,
          group: spend?.group || "Other",
          type: "contractor",
        });
      }
    }

    if (c1Id && c2Id) {
      links.push({ source: c1Id, target: c2Id, value: sharedCount });
    }
  }

  return { nodes: [...nodeMap.values()], links };
}

export async function getAgencyOptions(): Promise<string[]> {
  const query = `${PREFIXES}
SELECT DISTINCT ?agencyName
WHERE {
  ?award dp:awardedBy ?agency .
  ?agency rdfs:label ?agencyName .
  FILTER NOT EXISTS { ?child dp:parentAgency ?agency . }
}
ORDER BY ?agencyName`;

  const resp = await executeSparql(query);
  return resp.results.bindings
    .map((b) => b.agencyName?.value || "")
    .filter(Boolean);
}
