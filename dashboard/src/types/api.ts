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

export interface ContractorRow {
  name: string;
  uri: string;
  totalAwards: number;
  totalValue: number;
  capabilities: string[];
}

export interface CapabilityRow {
  name: string;
  uri: string;
  contractorCount: number;
  totalSpend: number;
  fiscalYear: string;
}

export interface AwardRow {
  id: string;
  contractor: string;
  agency: string;
  amount: number;
  capability: string;
  fiscalYear: string;
  description: string;
}

export interface NetworkNode {
  id: string;
  label: string;
  value: number;
  capability: string;
}

export interface NetworkLink {
  source: string;
  target: string;
  value: number;
}
