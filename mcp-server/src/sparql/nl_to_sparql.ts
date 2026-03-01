import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are a SPARQL query expert for a defense procurement knowledge graph. The ontology uses these prefixes and structure:

PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX data: <http://defenseprocurement.io/data#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

Key classes:
- dp:ContractAward (awards with dp:obligatedAmount, dp:awardDate, dp:fiscalYear, dp:description)
- dp:Contractor (with dp:ueiNumber, dp:isSmallBusiness, dp:cageCode)
- dp:GovernmentAgency (with dp:parentAgency)
- dp:TechnicalCapability subclasses: dp:ElectronicWarfare, dp:C4ISR, dp:AutonomousSystems, dp:CyberSecurity, dp:SpaceSystems, dp:AIandML, dp:MissileDefense, dp:Logistics, dp:TrainingSimulation, dp:Hypersonics, dp:DirectedEnergy, dp:QuantumTechnology, dp:Biotechnology
- dp:PlaceOfPerformance (dp:stateCode, dp:congressionalDistrict)
- dp:NAICSCode, dp:PSCCode

Key properties:
- dp:awardedTo (ContractAward → Contractor)
- dp:awardedBy (ContractAward → GovernmentAgency)
- dp:requiresCapability (ContractAward → TechnicalCapability)
- dp:hasCapability (Contractor → TechnicalCapability)
- dp:performedAt (ContractAward → PlaceOfPerformance)
- dp:classifiedAs (ContractAward → NAICSCode)
- dp:hasPSCCode (ContractAward → PSCCode)
- dp:obligatedAmount (xsd:decimal)
- dp:fiscalYear (xsd:gYear)

All entities have rdfs:label for human-readable names.

Rules:
1. Always include PREFIX declarations
2. Use rdfs:label for readable output
3. Return ONLY the SPARQL query, no explanation
4. Use GROUP BY and aggregation where appropriate
5. Add LIMIT 50 unless the question implies wanting all results`;

export async function naturalLanguageToSparql(question: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required for NL queries");
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Convert this question to a SPARQL query:\n\n${question}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  // Extract SPARQL from markdown code blocks if present
  const codeBlockMatch = text.match(/```(?:sparql)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  return text.trim();
}
