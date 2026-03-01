# SPARQL Query Catalog

All seven analytic queries in the DefPrO knowledge graph, with business context, the full SPARQL, expected output, and interpretation guidance.

**Endpoint:** Apache Jena Fuseki at `http://localhost:3030/procurement/sparql`
**Namespace:** `dp: <http://defenseprocurement.io/ontology#>`

---

## 1. capability_gap

**File:** `triplestore/queries/capability_gap.sparql`

**Business Question:** Which technical capabilities have growing contract spend but a shrinking contractor base?

```sparql
PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT
    ?capability
    ?capabilityLabel
    ?fiscalYear
    (COUNT(DISTINCT ?contractor) AS ?contractorCount)
    (SUM(?amount) AS ?totalSpend)
WHERE {
    ?award a dp:ContractAward ;
           dp:requiresCapability ?capability ;
           dp:awardedTo ?contractor ;
           dp:obligatedAmount ?amount ;
           dp:fiscalYear ?fiscalYear .
    ?capability rdfs:label ?capabilityLabel .
}
GROUP BY ?capability ?capabilityLabel ?fiscalYear
ORDER BY ?capabilityLabel ?fiscalYear
```

**Sample Output:**

| capabilityLabel | fiscalYear | contractorCount | totalSpend |
|---|---|---|---|
| AI and Machine Learning | 2022 | 12 | 145000000 |
| AI and Machine Learning | 2023 | 10 | 198000000 |
| AI and Machine Learning | 2024 | 8 | 267000000 |
| Hypersonics | 2022 | 4 | 320000000 |
| Hypersonics | 2023 | 3 | 410000000 |

**Interpretation Guidance:**

- Compare `contractorCount` and `totalSpend` across fiscal years for the same capability. A gap exists when spend increases while the contractor count decreases.
- Capabilities showing this divergence represent markets where demand exceeds supply -- opportunities for new entrants, teaming arrangements, or acquisitions.
- High spend with very few contractors also signals single-vendor dependency risk (see query 7).

---

## 2. teaming_patterns

**File:** `triplestore/queries/teaming_patterns.sparql`

**Business Question:** Which contractors have won awards across multiple agencies within the same capability area?

```sparql
PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT
    ?contractor
    ?contractorName
    ?capability
    ?capabilityLabel
    (COUNT(DISTINCT ?agency) AS ?agencyCount)
    (GROUP_CONCAT(DISTINCT ?agencyName; separator=", ") AS ?agencies)
    (SUM(?amount) AS ?totalValue)
WHERE {
    ?award a dp:ContractAward ;
           dp:requiresCapability ?capability ;
           dp:awardedTo ?contractor ;
           dp:awardedBy ?agency ;
           dp:obligatedAmount ?amount .
    ?contractor rdfs:label ?contractorName .
    ?capability rdfs:label ?capabilityLabel .
    ?agency rdfs:label ?agencyName .
}
GROUP BY ?contractor ?contractorName ?capability ?capabilityLabel
HAVING (COUNT(DISTINCT ?agency) >= 2)
ORDER BY DESC(?agencyCount) ?capabilityLabel
```

**Sample Output:**

| contractorName | capabilityLabel | agencyCount | agencies | totalValue |
|---|---|---|---|---|
| Raytheon Technologies | Electronic Warfare | 4 | DARPA, Navy, Air Force, MDA | 890000000 |
| Palantir Technologies | AI and Machine Learning | 3 | Army, SOCOM, DARPA | 234000000 |

**Interpretation Guidance:**

- Contractors appearing across many agencies for the same capability are deeply entrenched in that domain. They are likely the "go-to" providers.
- For BD teams: high agency count signals a strong competitive position and established past performance. These are formidable incumbents.
- For teaming: contractors with high cross-agency presence in your target capability are strong potential prime partners.

---

## 3. contractor_diversification

**File:** `triplestore/queries/contractor_diversification.sparql`

**Business Question:** Which contractors span the most capability areas, and what is their total spend?

```sparql
PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT
    ?contractor
    ?contractorName
    (COUNT(DISTINCT ?capability) AS ?totalCapabilities)
    (SUM(?amount) AS ?totalSpend)
    (GROUP_CONCAT(DISTINCT ?capLabel; separator=", ") AS ?capabilities)
WHERE {
    ?award a dp:ContractAward ;
           dp:awardedTo ?contractor ;
           dp:requiresCapability ?capability ;
           dp:obligatedAmount ?amount .
    ?contractor rdfs:label ?contractorName .
    ?capability rdfs:label ?capLabel .
}
GROUP BY ?contractor ?contractorName
ORDER BY DESC(?totalCapabilities)
```

**Sample Output:**

| contractorName | totalCapabilities | totalSpend | capabilities |
|---|---|---|---|
| Lockheed Martin | 9 | 4500000000 | C4ISR, Cyber Security, AI and Machine Learning, Space Systems, ... |
| Northrop Grumman | 7 | 3200000000 | Autonomous Systems, Space Systems, C4ISR, ... |
| Shield AI | 2 | 45000000 | Autonomous Systems, AI and Machine Learning |

**Interpretation Guidance:**

- High capability count with high spend indicates a diversified prime contractor. These companies are resilient to fluctuations in any single capability market.
- Small businesses with 2-3 capabilities and growing spend may be expanding into adjacent markets -- potential acquisition targets.
- Compare across fiscal years (by adding a `dp:fiscalYear` filter) to detect which contractors are newly diversifying vs. maintaining stable portfolios.

---

## 4. spend_concentration

**File:** `triplestore/queries/spend_concentration.sparql`

**Business Question:** For each capability area, what percentage of total spend goes to the top contractor?

```sparql
PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT
    ?capability
    ?capabilityLabel
    ?topContractor
    ?topContractorName
    ?topSpend
    ?totalSpend
    ((?topSpend / ?totalSpend * 100) AS ?concentrationPct)
WHERE {
    {
        SELECT
            ?capability
            (MAX(?contractorSpend) AS ?topSpend)
            (SUM(?contractorSpend) AS ?totalSpend)
        WHERE {
            {
                SELECT ?capability ?contractor (SUM(?amount) AS ?contractorSpend)
                WHERE {
                    ?award a dp:ContractAward ;
                           dp:requiresCapability ?capability ;
                           dp:awardedTo ?contractor ;
                           dp:obligatedAmount ?amount .
                }
                GROUP BY ?capability ?contractor
            }
        }
        GROUP BY ?capability
    }
    ?award2 a dp:ContractAward ;
            dp:requiresCapability ?capability ;
            dp:awardedTo ?topContractor ;
            dp:obligatedAmount ?amount2 .
    ?capability rdfs:label ?capabilityLabel .
    ?topContractor rdfs:label ?topContractorName .
    {
        SELECT ?capability ?topContractor (SUM(?amt) AS ?cs)
        WHERE {
            ?a dp:requiresCapability ?capability ;
               dp:awardedTo ?topContractor ;
               dp:obligatedAmount ?amt .
        }
        GROUP BY ?capability ?topContractor
    }
    FILTER(?cs = ?topSpend)
}
ORDER BY DESC(?concentrationPct)
```

**Sample Output:**

| capabilityLabel | topContractorName | topSpend | totalSpend | concentrationPct |
|---|---|---|---|---|
| Hypersonics | Lockheed Martin | 380000000 | 410000000 | 92.7 |
| Directed Energy | Raytheon Technologies | 120000000 | 180000000 | 66.7 |
| Cyber Security | Booz Allen Hamilton | 95000000 | 450000000 | 21.1 |

**Interpretation Guidance:**

- `concentrationPct` above 50% signals a single-vendor dependency. The government faces supply chain risk, and competitors face a high barrier to entry.
- Concentration above 80% in a critical capability area (e.g., Hypersonics, Missile Defense) is a strategic vulnerability.
- For BD teams: low concentration areas are more open to competition; high concentration areas require teaming with the incumbent or offering a differentiated solution.

---

## 5. sbir_pipeline

**File:** `triplestore/queries/sbir_pipeline.sparql`

**Business Question:** Which SBIR awardees have also won production-scale contracts (>$1M) in the same capability area?

```sparql
PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT
    ?contractor
    ?contractorName
    ?capability
    ?capabilityLabel
    ?sbirTopic
    ?productionAward
    ?prodAmount
WHERE {
    ?sbir a dp:SBIRAward ;
          dp:awardedTo ?contractor ;
          dp:demonstratesCapability ?capability ;
          dp:sbirTopic ?sbirTopic .
    ?productionAward a dp:ContractAward ;
                     dp:awardedTo ?contractor ;
                     dp:requiresCapability ?capability ;
                     dp:obligatedAmount ?prodAmount .
    ?contractor rdfs:label ?contractorName .
    ?capability rdfs:label ?capabilityLabel .
    FILTER(?prodAmount > 1000000)
}
ORDER BY DESC(?prodAmount)
```

**Sample Output:**

| contractorName | capabilityLabel | sbirTopic | prodAmount |
|---|---|---|---|
| Shield AI | Autonomous Systems | Autonomous ISR for GPS-denied environments | 28000000 |
| Epirus Inc | Directed Energy | Solid-state HPM counter-UAS | 15000000 |

**Interpretation Guidance:**

- Contractors appearing in this result set have successfully crossed the SBIR "valley of death" from research into production. These are validated growth companies.
- For investors and M&A teams: these companies have both technical differentiation (SBIR innovation) and commercial traction (production contracts).
- The `sbirTopic` field indicates the specific technology area -- useful for assessing whether the production contract is a direct continuation of the SBIR work or a pivot.

---

## 6. emerging_contractors

**File:** `triplestore/queries/emerging_contractors.sparql`

**Business Question:** Which contractors won their first-ever award in a capability area during the most recent fiscal year?

```sparql
PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT
    ?contractor
    ?contractorName
    ?newCapability
    ?capabilityLabel
    (SUM(?amount) AS ?totalNewCapSpend)
    (COUNT(?award) AS ?awardCount)
WHERE {
    ?award a dp:ContractAward ;
           dp:awardedTo ?contractor ;
           dp:requiresCapability ?newCapability ;
           dp:obligatedAmount ?amount ;
           dp:fiscalYear ?fy .
    ?contractor rdfs:label ?contractorName .
    ?newCapability rdfs:label ?capabilityLabel .

    FILTER(?fy = "2024"^^xsd:gYear)

    FILTER NOT EXISTS {
        ?oldAward a dp:ContractAward ;
                  dp:awardedTo ?contractor ;
                  dp:requiresCapability ?newCapability ;
                  dp:fiscalYear ?oldFy .
        FILTER(?oldFy < "2024"^^xsd:gYear)
    }
}
GROUP BY ?contractor ?contractorName ?newCapability ?capabilityLabel
ORDER BY DESC(?totalNewCapSpend)
```

**Sample Output:**

| contractorName | capabilityLabel | totalNewCapSpend | awardCount |
|---|---|---|---|
| Anduril Industries | Hypersonics | 52000000 | 2 |
| Palantir Technologies | Space Systems | 18000000 | 1 |

**Interpretation Guidance:**

- These are contractors entering a capability market for the first time in the data set. Large initial spend suggests a strategic market entry, not an incidental win.
- For competitive intelligence: a well-funded contractor entering your capability area is a signal to watch.
- Combine with query 3 (diversification) to distinguish between organic expansion and one-off wins.
- Note: the `FILTER NOT EXISTS` clause depends on data completeness. If the graph only contains recent fiscal years, some contractors may appear as "emerging" when they have longer histories outside the data window.

---

## 7. supply_chain_risk

**File:** `triplestore/queries/supply_chain_risk.sparql`

**Business Question:** Which capability areas have only 1-3 contractors? These are single-source or near-single-source dependencies.

```sparql
PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT
    ?capability
    ?capabilityLabel
    (COUNT(DISTINCT ?contractor) AS ?contractorCount)
    (SUM(?amount) AS ?totalSpend)
    (GROUP_CONCAT(DISTINCT ?contractorName; separator=", ") AS ?contractors)
WHERE {
    ?award a dp:ContractAward ;
           dp:requiresCapability ?capability ;
           dp:awardedTo ?contractor ;
           dp:obligatedAmount ?amount .
    ?capability rdfs:label ?capabilityLabel .
    ?contractor rdfs:label ?contractorName .
}
GROUP BY ?capability ?capabilityLabel
HAVING (COUNT(DISTINCT ?contractor) <= 3)
ORDER BY ASC(?contractorCount) DESC(?totalSpend)
```

**Sample Output:**

| capabilityLabel | contractorCount | totalSpend | contractors |
|---|---|---|---|
| Quantum Technology | 1 | 12000000 | IonQ Inc |
| Hypersonics | 2 | 410000000 | Lockheed Martin, Raytheon Technologies |
| Directed Energy | 3 | 180000000 | Raytheon Technologies, Northrop Grumman, Epirus Inc |

**Interpretation Guidance:**

- `contractorCount` of 1 is a true single-source dependency. If that contractor exits the market or encounters capacity constraints, the government has no alternative.
- High `totalSpend` with low `contractorCount` is the most critical combination -- large programs with no fallback suppliers.
- For BD teams: these are the most promising areas for new market entry. The government is actively seeking to reduce concentration risk in these capability areas.
- This query complements query 4 (spend concentration) by focusing on absolute contractor counts rather than spend percentages.
