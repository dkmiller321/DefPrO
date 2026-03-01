const PREFIXES = `
PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX data: <http://defenseprocurement.io/data#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
`;

function escapeLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export interface ContractorQueryParams {
  capability?: string;
  agency?: string;
  minAwardValue?: number;
  maxAwardValue?: number;
  isSmallBusiness?: boolean;
  fiscalYear?: string;
  state?: string;
  limit?: number;
  offset?: number;
}

export function buildContractorQuery(params: ContractorQueryParams): string {
  const filters: string[] = [];
  const patterns: string[] = [
    "?award a dp:ContractAward ;",
    "       dp:awardedTo ?contractor ;",
    "       dp:obligatedAmount ?amount .",
    "?contractor rdfs:label ?contractorName .",
  ];

  if (params.capability) {
    patterns.push(`?award dp:requiresCapability dp:${escapeLiteral(params.capability)} .`);
  }

  if (params.agency) {
    patterns.push("?award dp:awardedBy ?agency .");
    patterns.push("?agency rdfs:label ?agencyName .");
    filters.push(`FILTER(CONTAINS(LCASE(?agencyName), "${escapeLiteral(params.agency.toLowerCase())}"))`);
  }

  if (params.minAwardValue !== undefined) {
    filters.push(`FILTER(?amount >= ${params.minAwardValue})`);
  }

  if (params.maxAwardValue !== undefined) {
    filters.push(`FILTER(?amount <= ${params.maxAwardValue})`);
  }

  if (params.isSmallBusiness !== undefined) {
    patterns.push(`?contractor dp:isSmallBusiness ${params.isSmallBusiness} .`);
  }

  if (params.fiscalYear) {
    patterns.push(`?award dp:fiscalYear "${escapeLiteral(params.fiscalYear)}"^^xsd:gYear .`);
  }

  if (params.state) {
    patterns.push("?award dp:performedAt ?location .");
    patterns.push(`?location dp:stateCode "${escapeLiteral(params.state)}" .`);
  }

  // Optional capability list
  patterns.push("OPTIONAL { ?award dp:requiresCapability ?cap . ?cap rdfs:label ?capLabel . }");

  const limit = params.limit || 50;
  const offset = params.offset || 0;

  return `${PREFIXES}
SELECT
    ?contractor ?contractorName
    (COUNT(DISTINCT ?award) AS ?totalAwards)
    (SUM(?amount) AS ?totalValue)
    (GROUP_CONCAT(DISTINCT ?capLabel; separator=", ") AS ?capabilities)
WHERE {
    ${patterns.join("\n    ")}
    ${filters.join("\n    ")}
}
GROUP BY ?contractor ?contractorName
ORDER BY DESC(?totalValue)
LIMIT ${limit} OFFSET ${offset}`;
}

export interface TeamingQueryParams {
  contractor?: string;
  role?: "prime" | "sub" | "any";
  capability?: string;
  fiscalYear?: string;
}

export function buildTeamingQuery(params: TeamingQueryParams): string {
  const patterns: string[] = [
    "?award a dp:ContractAward ;",
    "       dp:awardedTo ?contractor ;",
    "       dp:obligatedAmount ?amount .",
    "?contractor rdfs:label ?contractorName .",
  ];
  const filters: string[] = [];

  if (params.contractor) {
    filters.push(
      `FILTER(CONTAINS(LCASE(?contractorName), "${escapeLiteral(params.contractor.toLowerCase())}"))`
    );
  }

  if (params.capability) {
    patterns.push(`?award dp:requiresCapability dp:${escapeLiteral(params.capability)} .`);
  }

  if (params.fiscalYear) {
    patterns.push(`?award dp:fiscalYear "${escapeLiteral(params.fiscalYear)}"^^xsd:gYear .`);
  }

  patterns.push("?award dp:awardedBy ?agency . ?agency rdfs:label ?agencyName .");
  patterns.push("OPTIONAL { ?award dp:requiresCapability ?cap . ?cap rdfs:label ?capLabel . }");

  return `${PREFIXES}
SELECT
    ?contractor ?contractorName ?agencyName
    (COUNT(DISTINCT ?award) AS ?awardCount)
    (SUM(?amount) AS ?totalValue)
    (GROUP_CONCAT(DISTINCT ?capLabel; separator=", ") AS ?capabilities)
WHERE {
    ${patterns.join("\n    ")}
    ${filters.join("\n    ")}
}
GROUP BY ?contractor ?contractorName ?agencyName
ORDER BY DESC(?awardCount)
LIMIT 100`;
}

export interface CapabilityGapParams {
  agency?: string;
  startYear?: string;
  endYear?: string;
}

export function buildCapabilityGapQuery(params: CapabilityGapParams): string {
  const patterns: string[] = [
    "?award a dp:ContractAward ;",
    "       dp:requiresCapability ?capability ;",
    "       dp:awardedTo ?contractor ;",
    "       dp:obligatedAmount ?amount ;",
    "       dp:fiscalYear ?fiscalYear .",
    "?capability rdfs:label ?capabilityLabel .",
  ];
  const filters: string[] = [];

  if (params.agency) {
    patterns.push("?award dp:awardedBy ?agency . ?agency rdfs:label ?agencyName .");
    filters.push(
      `FILTER(CONTAINS(LCASE(?agencyName), "${escapeLiteral(params.agency.toLowerCase())}"))`
    );
  }

  if (params.startYear) {
    filters.push(`FILTER(?fiscalYear >= "${escapeLiteral(params.startYear)}"^^xsd:gYear)`);
  }

  if (params.endYear) {
    filters.push(`FILTER(?fiscalYear <= "${escapeLiteral(params.endYear)}"^^xsd:gYear)`);
  }

  return `${PREFIXES}
SELECT
    ?capability ?capabilityLabel ?fiscalYear
    (COUNT(DISTINCT ?contractor) AS ?contractorCount)
    (SUM(?amount) AS ?totalSpend)
WHERE {
    ${patterns.join("\n    ")}
    ${filters.join("\n    ")}
}
GROUP BY ?capability ?capabilityLabel ?fiscalYear
ORDER BY ?capabilityLabel ?fiscalYear`;
}

export interface ContractorProfileParams {
  contractor: string;
}

export function buildContractorProfileQuery(params: ContractorProfileParams): string {
  const escaped = escapeLiteral(params.contractor.toLowerCase());

  return `${PREFIXES}
SELECT
    ?contractor ?contractorName ?uei ?isSmallBusiness
    ?award ?awardId ?amount ?agencyName ?capLabel ?fiscalYear ?description
WHERE {
    ?contractor a dp:Contractor ;
                rdfs:label ?contractorName .
    FILTER(CONTAINS(LCASE(?contractorName), "${escaped}"))

    OPTIONAL { ?contractor dp:ueiNumber ?uei . }
    OPTIONAL { ?contractor dp:isSmallBusiness ?isSmallBusiness . }

    ?award a dp:ContractAward ;
           dp:awardedTo ?contractor .
    OPTIONAL { ?award dp:contractNumber ?awardId . }
    OPTIONAL { ?award dp:obligatedAmount ?amount . }
    OPTIONAL { ?award dp:awardedBy ?agency . ?agency rdfs:label ?agencyName . }
    OPTIONAL { ?award dp:requiresCapability ?cap . ?cap rdfs:label ?capLabel . }
    OPTIONAL { ?award dp:fiscalYear ?fiscalYear . }
    OPTIONAL { ?award dp:description ?description . }
}
ORDER BY DESC(?amount)
LIMIT 500`;
}
