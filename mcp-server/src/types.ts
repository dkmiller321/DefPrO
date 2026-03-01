export interface SparqlBinding {
  [key: string]: {
    type: string;
    value: string;
    datatype?: string;
    "xml:lang"?: string;
  };
}

export interface SparqlResults {
  head: { vars: string[] };
  results: { bindings: SparqlBinding[] };
}

export interface ContractorResult {
  name: string;
  uei: string;
  totalAwards: number;
  totalValue: number;
  capabilities: string[];
  isSmallBusiness?: boolean;
}

export interface TeamingResult {
  contractor: string;
  partner: string;
  capability: string;
  awardCount: number;
  totalValue: number;
}

export interface CapabilityGapResult {
  capability: string;
  fiscalYear: string;
  contractorCount: number;
  totalSpend: number;
  trend: "growing" | "shrinking" | "stable";
}

export interface ContractorProfile {
  name: string;
  uei: string;
  isSmallBusiness: boolean;
  capabilities: string[];
  agencies: string[];
  totalAwards: number;
  totalSpend: number;
  awards: AwardSummary[];
}

export interface AwardSummary {
  awardId: string;
  amount: number;
  agency: string;
  capability: string;
  fiscalYear: string;
  description: string;
}
