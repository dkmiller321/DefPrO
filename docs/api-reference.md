# MCP Server API Reference

The DefPrO MCP server (`defpro-intelligence` v1.0.0) exposes five tools over the Model Context Protocol for querying the defense procurement knowledge graph. The server communicates via stdio transport and connects to an Apache Jena Fuseki SPARQL endpoint.

**Server name:** `defpro-intelligence`
**Transport:** stdio
**SPARQL endpoint:** Configurable via `FUSEKI_URL` environment variable (default: `http://localhost:3030/procurement/sparql`)

---

## Tools

### 1. query_contractors

Find contractors by capability, size, location, or agency relationships.

**Description:** Searches the knowledge graph for contractors matching a combination of filters. Returns a ranked list of contractors with award counts, total obligated value, and classified capabilities.

**Input Schema:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `capability` | string | No | Technical capability area. Must match an ontology class local name (e.g., `AIandML`, `CyberSecurity`, `ElectronicWarfare`, `AutonomousSystems`, `SpaceSystems`, `MissileDefense`, `Logistics`, `TrainingSimulation`, `Hypersonics`, `DirectedEnergy`, `QuantumTechnology`, `Biotechnology`, `C4ISR`). |
| `agency` | string | No | Government agency name (substring match, case-insensitive). |
| `minAwardValue` | number | No | Minimum obligated amount per award in USD. |
| `maxAwardValue` | number | No | Maximum obligated amount per award in USD. |
| `isSmallBusiness` | boolean | No | Filter to small businesses (`true`) or non-small businesses (`false`). |
| `fiscalYear` | string | No | Fiscal year filter (e.g., `"2024"`). |
| `state` | string | No | State code for place of performance (e.g., `"VA"`, `"CA"`). |

**Example Request:**

```json
{
  "capability": "CyberSecurity",
  "isSmallBusiness": true,
  "fiscalYear": "2024",
  "state": "VA"
}
```

**Example Response:**

```
Found 5 contractors:

1. **CyberDefense Corp**
   Awards: 8 | Value: $12,400,000
   Capabilities: Cyber Security, AI and Machine Learning

2. **SecureNet Solutions**
   Awards: 3 | Value: $4,200,000
   Capabilities: Cyber Security
```

**Notes:**

- Results are ordered by total award value descending.
- Default limit is 50 contractors. The response aggregates all matching awards per contractor.
- The `capability` value must be the exact ontology class local name (the portion after `dp:` in the namespace).

---

### 2. analyze_teaming

Find teaming patterns between contractors -- who works with whom on what.

**Description:** Analyzes contractor-agency-capability relationships to reveal teaming patterns. Shows which contractors are active with which agencies in which capability areas, along with award counts and spend.

**Input Schema:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `contractor` | string | No | Contractor name to search for (substring match, case-insensitive). |
| `role` | enum | No | Role filter: `"prime"`, `"sub"`, or `"any"`. Currently used as a hint; the underlying query searches award relationships. |
| `capability` | string | No | Technical capability area (ontology class local name). |
| `fiscalYear` | string | No | Fiscal year filter. |

**Example Request:**

```json
{
  "contractor": "Raytheon",
  "capability": "ElectronicWarfare"
}
```

**Example Response:**

```
Found 4 teaming relationships:

1. **Raytheon Technologies** -> Navy
   Awards: 12 | Value: $340,000,000
   Capabilities: Electronic Warfare, C4ISR

2. **Raytheon Technologies** -> Air Force
   Awards: 7 | Value: $185,000,000
   Capabilities: Electronic Warfare
```

**Notes:**

- Results are ordered by award count descending, limited to 100 rows.
- The `role` parameter is accepted but the current implementation queries general award relationships rather than distinguishing prime vs. sub roles at the query level.

---

### 3. capability_gap_analysis

Identify capability areas with growing spend but a shrinking contractor base.

**Description:** Groups contract awards by capability and fiscal year, then computes year-over-year trends in both spend and contractor count. Flags capabilities where spend is growing while the number of active contractors is declining -- a capability gap.

**Input Schema:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `agency` | string | No | Filter by agency name (substring match, case-insensitive). |
| `startYear` | string | No | Start of fiscal year range (e.g., `"2020"`). |
| `endYear` | string | No | End of fiscal year range (e.g., `"2024"`). |

**Example Request:**

```json
{
  "agency": "DARPA",
  "startYear": "2021",
  "endYear": "2024"
}
```

**Example Response:**

```
Capability Gap Analysis (4 capabilities):

### AI and Machine Learning
  FY2021: 8 contractors, $95,000,000 spend
  FY2022: 7 contractors, $142,000,000 spend
  FY2023: 5 contractors, $198,000,000 spend
  FY2024: 4 contractors, $267,000,000 spend
  Spend trend: GROWING | Contractor base: SHRINKING
  WARNING: GAP DETECTED: Growing spend with shrinking contractor base

### Cyber Security
  FY2021: 15 contractors, $210,000,000 spend
  FY2022: 16 contractors, $225,000,000 spend
  FY2023: 18 contractors, $240,000,000 spend
  FY2024: 20 contractors, $260,000,000 spend
  Spend trend: GROWING | Contractor base: GROWING
```

**Notes:**

- The gap detection compares the first and last fiscal year in the result set. A gap is flagged when spend grows and contractor count shrinks over that interval.
- Trend labels are `GROWING`, `SHRINKING`, or `STABLE`.
- When no year filters are provided, the query returns all fiscal years present in the data.

---

### 4. contractor_profile

Get the full profile of a contractor -- awards, capabilities, agencies, and teaming partners.

**Description:** Retrieves a comprehensive profile for a single contractor, including metadata, classified capabilities, agency relationships, and the top 10 awards by value.

**Input Schema:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `contractor` | string | **Yes** | Contractor name or UEI number to look up (substring match, case-insensitive). |

**Example Request:**

```json
{
  "contractor": "Shield AI"
}
```

**Example Response:**

```
## Contractor Profile: Shield AI

- **UEI:** J4K7EXAMPLE123
- **Small Business:** Yes
- **Total Awards:** 6
- **Total Spend:** $73,500,000
- **Capabilities:** Autonomous Systems, AI and Machine Learning
- **Agencies:** DARPA, Navy, SOCOM

### Recent Awards (top 10 by value):

- **$28,000,000** | FY2024 | Navy
  Autonomous Systems -- Autonomous ISR platform for maritime operations
- **$18,500,000** | FY2024 | DARPA
  AI and Machine Learning -- AI-driven autonomous flight control
```

**Notes:**

- The search is a substring match on `rdfs:label`. Searching for `"Shield"` will match `"Shield AI"`.
- Award descriptions are truncated to 120 characters in the output.
- The query retrieves up to 500 award bindings to build the profile. Contractors with very large award portfolios may have their older or smaller awards excluded.

---

### 5. natural_language_query

Convert a natural language question into a SPARQL query and execute it against the procurement knowledge graph.

**Description:** Uses the Anthropic API (Claude) to translate a free-text question into a SPARQL query conforming to the DefPrO ontology, executes the query against Fuseki, and returns both the generated SPARQL and the result set formatted as a markdown table.

**Input Schema:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `question` | string | **Yes** | Natural language question about defense procurement. |

**Example Request:**

```json
{
  "question": "Which small businesses have won more than $5 million in AI contracts from DARPA?"
}
```

**Example Response:**

```
**Question:** Which small businesses have won more than $5 million in AI contracts from DARPA?

**Generated SPARQL:**
```sparql
PREFIX dp: <http://defenseprocurement.io/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?contractorName (SUM(?amount) AS ?totalValue)
WHERE {
    ?award a dp:ContractAward ;
           dp:awardedTo ?contractor ;
           dp:requiresCapability dp:AIandML ;
           dp:awardedBy ?agency ;
           dp:obligatedAmount ?amount .
    ?contractor rdfs:label ?contractorName ;
                dp:isSmallBusiness true .
    ?agency rdfs:label ?agencyName .
    FILTER(CONTAINS(LCASE(?agencyName), "darpa"))
}
GROUP BY ?contractorName
HAVING(SUM(?amount) > 5000000)
ORDER BY DESC(?totalValue)
LIMIT 50
```

**Results:** 3 rows

| contractorName | totalValue |
| --- | --- |
| Shield AI | 18500000 |
| Palantir Technologies | 12300000 |
| Rebellion Defense | 7800000 |
```

**Notes:**

- Requires the `ANTHROPIC_API_KEY` environment variable to be set.
- The LLM is prompted with the full ontology schema (classes, properties, and valid capability names) to generate accurate SPARQL.
- Results are capped at 50 rows. If the result set exceeds 50, a truncation notice is appended.
- URIs in the output are shortened: `http://defenseprocurement.io/ontology#` becomes `dp:` and `http://defenseprocurement.io/data#` becomes `data:`.
- If the generated SPARQL is syntactically invalid or produces an execution error, the error message is returned alongside the generated query for debugging.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `FUSEKI_URL` | No | `http://localhost:3030/procurement/sparql` | SPARQL endpoint URL. |
| `ANTHROPIC_API_KEY` | Only for `natural_language_query` | -- | Anthropic API key for NL-to-SPARQL translation. |

## Error Handling

All tools return a plain text response in the MCP `content` array with `type: "text"`. When no results are found, each tool returns a descriptive message (e.g., `"No contractors found matching the specified criteria."`). The `natural_language_query` tool includes the generated SPARQL in its error output to aid debugging.
