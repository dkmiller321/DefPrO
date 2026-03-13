export interface SparqlBinding {
  [key: string]: {
    type: string;
    value: string;
    datatype?: string;
  };
}

export interface SparqlResponse {
  head: { vars: string[] };
  results: { bindings: SparqlBinding[] };
}

// Deduplicated contractor row for the list table
export interface ContractorSummary {
  uri: string;
  name: string;
  ueis: string[];
  awardCount: number;
  totalValue: number;
  isSmallBusiness: boolean;
  capabilities: string[];
}

// Detailed contractor info for the detail panel
export interface ContractorDetail {
  capabilities: { name: string; spend: number }[];
  topAwards: {
    id: string;
    amount: number;
    description: string;
    fiscalYear: string;
  }[];
  agencies: { name: string; spend: number }[];
  spendByYear: { fiscalYear: string; spend: number }[];
}

// Capability stats for the capabilities page
export interface CapabilitySummary {
  name: string;
  totalSpend: number;
  contractorCount: number;
  awardCount: number;
}

// Concentration risk per capability
export interface CapabilityConcentration {
  capability: string;
  topContractor: string;
  topContractorSpend: number;
  totalSpend: number;
  share: number;
}

export interface HeatmapCell {
  capability: string;
  agency: string;
  spend: number;
}

export interface NetworkNode {
  id: string;
  label: string;
  value: number;
  group: string;
  type: "contractor" | "agency";
}

export interface NetworkLink {
  source: string | NetworkNode;
  target: string | NetworkNode;
  value: number;
}

export interface NetworkFilters {
  capability?: string;
  agency?: string;
  minValue?: number;
}
