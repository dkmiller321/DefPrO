# CLAUDE.md — Defense Procurement Ontology Intelligence Platform

## Project Overview

You are building an ontology-driven knowledge graph platform over public US federal procurement data. The platform ingests data from USASpending.gov, transforms it into RDF triples conforming to a BFO/CCO-based domain ontology, loads it into a triple store, and exposes intelligence queries through a SPARQL endpoint, MCP server, and React dashboard.

The goal is to surface relationships that flat databases cannot — contractor capability mapping, teaming patterns, industrial base gaps, and acquisition target identification.

---

## Architecture

```
defense-procurement-ontology/
├── CLAUDE.md                          # This file
├── ontology/
│   ├── bfo/                           # BFO 2020 (cloned, read-only reference)
│   ├── cco/                           # Common Core Ontologies (cloned, read-only reference)
│   ├── defense-procurement.owl        # Our domain ontology (Turtle/OWL)
│   ├── capability-taxonomy.ttl        # Technical capability class hierarchy
│   └── naics-psc-mapping.ttl          # NAICS/PSC → Capability mapping rules
├── etl/
│   ├── __init__.py
│   ├── config.py                      # API endpoints, rate limits, field mappings
│   ├── usaspending_client.py          # USASpending API client with pagination + retry
│   ├── sam_client.py                  # SAM.gov entity enrichment client
│   ├── sbir_client.py                 # SBIR.gov data client
│   ├── rdf_transformer.py            # Raw JSON → RDF triples (using rdflib)
│   ├── capability_classifier.py       # Claude API: contract descriptions → capability labels
│   ├── pipeline.py                    # Orchestrator: extract → classify → transform → load
│   └── validators.py                  # Data quality checks + ontology conformance
├── triplestore/
│   ├── docker-compose.yml             # Jena Fuseki in Docker
│   ├── fuseki-config.ttl              # Dataset config with OWL reasoner
│   ├── load_data.sh                   # Bulk load script
│   └── queries/
│       ├── capability_gap.sparql
│       ├── teaming_patterns.sparql
│       ├── contractor_diversification.sparql
│       ├── spend_concentration.sparql
│       ├── sbir_pipeline.sparql
│       ├── emerging_contractors.sparql
│       └── supply_chain_risk.sparql
├── mcp-server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                   # MCP server entry point
│   │   ├── tools/
│   │   │   ├── query_contractors.ts
│   │   │   ├── analyze_teaming.ts
│   │   │   ├── capability_gap.ts
│   │   │   ├── natural_language_query.ts
│   │   │   └── contractor_profile.ts
│   │   ├── sparql/
│   │   │   ├── client.ts              # Fuseki SPARQL HTTP client
│   │   │   ├── query_builder.ts       # Programmatic SPARQL construction
│   │   │   └── nl_to_sparql.ts        # Claude API: NL → SPARQL translation
│   │   └── types.ts
│   └── tests/
├── dashboard/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── api/
│   │   │   ├── sparql.ts              # SPARQL endpoint client
│   │   │   └── mcp.ts                 # MCP server client (optional)
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── MainLayout.tsx
│   │   │   ├── graphs/
│   │   │   │   ├── ContractorNetwork.tsx       # D3 force-directed graph
│   │   │   │   ├── CapabilityHeatmap.tsx       # Agency × Capability spend matrix
│   │   │   │   ├── SpendTrend.tsx              # Recharts time series
│   │   │   │   └── TeamingDiagram.tsx          # Prime→Sub relationship viz
│   │   │   ├── tables/
│   │   │   │   ├── ContractorTable.tsx
│   │   │   │   ├── AwardTable.tsx
│   │   │   │   └── CapabilityTable.tsx
│   │   │   ├── search/
│   │   │   │   ├── NaturalLanguageSearch.tsx   # NL query input
│   │   │   │   ├── SparqlEditor.tsx            # Raw SPARQL editor
│   │   │   │   └── FilterPanel.tsx
│   │   │   └── cards/
│   │   │       ├── ContractorProfile.tsx
│   │   │       ├── CapabilityCard.tsx
│   │   │       └── IntelligenceSummary.tsx
│   │   ├── hooks/
│   │   │   ├── useSparqlQuery.ts
│   │   │   └── useContractorData.ts
│   │   ├── utils/
│   │   │   ├── sparql-helpers.ts
│   │   │   └── graph-transforms.ts
│   │   └── types/
│   │       ├── ontology.ts                     # TypeScript types mirroring ontology classes
│   │       └── api.ts
│   └── public/
├── scripts/
│   ├── setup.sh                       # Full environment setup
│   ├── seed_sample_data.py            # Generate sample data for development
│   └── run_all_queries.sh             # Execute all SPARQL queries and output results
├── tests/
│   ├── test_etl.py
│   ├── test_transformer.py
│   ├── test_classifier.py
│   ├── test_queries.sparql
│   └── test_ontology_consistency.py
├── docs/
│   ├── ontology-decisions.md          # Design rationale for ontology choices
│   ├── capability-taxonomy.md         # Human-readable capability hierarchy
│   ├── api-reference.md               # MCP server tool documentation
│   └── query-catalog.md              # All SPARQL queries with explanations
├── .env.example
├── requirements.txt
└── docker-compose.yml                 # Full stack: Fuseki + MCP server + dashboard
```

---

## Implementation Contracts

Build each component in the order listed below. Each section is a self-contained contract. Complete and test each one before moving to the next.

---

### Contract 1: Domain Ontology

**File:** `ontology/defense-procurement.owl`

**Format:** Turtle (`.ttl` extension also acceptable). Use `rdflib` to validate.

**Requirements:**

1. Import BFO 2020 as upper ontology (`http://purl.obolibrary.org/obo/bfo.owl`)
2. Import relevant CCO modules:
   - AgentOntology
   - ArtifactOntology  
   - EventOntology
   - InformationEntityOntology
3. Define namespace: `@prefix dp: <http://defenseprocurement.io/ontology#> .`
4. Define these classes as subclasses of appropriate BFO/CCO classes:

```
Core Entity Classes:
- dp:Contractor          (subclass of cco:Agent / obo:BFO_0000040)
  - dp:PrimeContractor
  - dp:Subcontractor
  - dp:SmallBusiness
- dp:GovernmentAgency    (subclass of cco:Agent / obo:BFO_0000040)
  - dp:ContractingOffice
  - dp:ProgramOffice
- dp:PlaceOfPerformance  (subclass of obo:BFO_0000029 Site)

Capability Classes:
- dp:TechnicalCapability (subclass of obo:BFO_0000016 Disposition)
  - dp:ElectronicWarfare
  - dp:C4ISR
  - dp:AutonomousSystems
  - dp:CyberSecurity
  - dp:SpaceSystems
  - dp:AIandML
  - dp:MissileDefense
  - dp:Logistics
  - dp:TrainingSimulation
  - dp:Hypersonics
  - dp:DirectedEnergy
  - dp:QuantumTechnology
  - dp:Biotechnology

Event / Process Classes:
- dp:ContractAward       (subclass of obo:BFO_0000015 Process)
- dp:ContractModification
- dp:CompetitionProcess

Information Classes:
- dp:ContractDocument     (subclass of cco:InformationBearingEntity)
- dp:SBIRAward
- dp:CapabilityStatement

Classification Classes:
- dp:NAICSCode
- dp:PSCCode
- dp:SetAsideType
- dp:CompetitionType
```

5. Define object properties:

```
dp:awardedTo             domain: dp:ContractAward       range: dp:Contractor
dp:awardedBy             domain: dp:ContractAward       range: dp:GovernmentAgency
dp:hasSubcontractor      domain: dp:PrimeContractor     range: dp:Subcontractor
dp:performedAt           domain: dp:ContractAward       range: dp:PlaceOfPerformance
dp:hasCapability         domain: dp:Contractor          range: dp:TechnicalCapability
dp:requiresCapability    domain: dp:ContractAward       range: dp:TechnicalCapability
dp:demonstratesCapability domain: dp:SBIRAward          range: dp:TechnicalCapability
dp:classifiedAs          domain: dp:ContractAward       range: dp:NAICSCode
dp:hasPSCCode            domain: dp:ContractAward       range: dp:PSCCode
dp:modifies              domain: dp:ContractModification range: dp:ContractAward
dp:fundedUnder           domain: dp:ContractAward       range: dp:Program
dp:parentAgency          domain: dp:GovernmentAgency    range: dp:GovernmentAgency
```

6. Define data properties:

```
dp:contractNumber        domain: dp:ContractAward       range: xsd:string
dp:cageCode              domain: dp:Contractor          range: xsd:string
dp:ueiNumber             domain: dp:Contractor          range: xsd:string
dp:isSmallBusiness       domain: dp:Contractor          range: xsd:boolean
dp:employeeCount         domain: dp:Contractor          range: xsd:integer
dp:annualRevenue         domain: dp:Contractor          range: xsd:decimal
dp:awardDate             domain: dp:ContractAward       range: xsd:date
dp:completionDate        domain: dp:ContractAward       range: xsd:date
dp:obligatedAmount       domain: dp:ContractAward       range: xsd:decimal
dp:totalAwardValue       domain: dp:ContractAward       range: xsd:decimal
dp:fiscalYear            domain: dp:ContractAward       range: xsd:gYear
dp:description           domain: dp:ContractAward       range: xsd:string
dp:competitionType       domain: dp:ContractAward       range: xsd:string
dp:setAsideType          domain: dp:ContractAward       range: xsd:string
dp:stateCode             domain: dp:PlaceOfPerformance  range: xsd:string
dp:congressionalDistrict domain: dp:PlaceOfPerformance  range: xsd:string
```

7. Add OWL axioms:
   - `dp:hasSubcontractor` is the inverse of `dp:subcontractorOf`
   - `dp:PrimeContractor` and `dp:Subcontractor` are not disjoint (a company can be both on different contracts)
   - `dp:SmallBusiness` is defined as: `dp:Contractor` and `dp:isSmallBusiness value true`

**Validation:** Load in rdflib and check for consistency. Also validate the ontology can be opened in Protégé without errors.

**Test:** Write `tests/test_ontology_consistency.py` that:
- Loads the ontology
- Verifies all classes exist
- Verifies all properties have correct domains and ranges
- Creates a sample individual of each class and verifies it's valid

---

### Contract 2: ETL Pipeline — USASpending Client

**File:** `etl/usaspending_client.py`

**API Base:** `https://api.usaspending.gov/api/v2/`

**Requirements:**

1. Implement `USASpendingClient` class with:
   - `search_awards(filters, fields, limit, page)` → paginated award search
   - `get_award_detail(award_id)` → single award with full detail
   - `get_recipient(recipient_id)` → recipient/contractor details
   - `get_agency_awards(agency_name, fiscal_year)` → all awards for an agency/year

2. Filters must support:
   - Agency (awarding, funding — toptier and subtier)
   - Time period (start_date, end_date)
   - Award type (contracts, grants, etc.)
   - NAICS code, PSC code
   - Recipient name/UEI
   - Award amount range

3. Handle:
   - Rate limiting (USASpending allows ~2 req/sec) — implement exponential backoff
   - Pagination — USASpending caps at 100 results per page, implement auto-pagination up to a configurable max
   - Retry on 5xx errors (3 retries with backoff)
   - Response caching to local JSON files (cache by query hash, configurable TTL)

4. Default fields to request for awards:
```python
DEFAULT_AWARD_FIELDS = [
    "Award ID",
    "Recipient Name",
    "Recipient UEI",
    "Award Amount",
    "Total Obligated Amount",
    "Description",
    "Start Date",
    "End Date",
    "Awarding Agency",
    "Awarding Sub Agency",
    "Funding Agency",
    "NAICS Code",
    "NAICS Description",
    "PSC Code",
    "PSC Description",
    "Place of Performance State Code",
    "Place of Performance Congressional District",
    "Type of Contract Pricing",
    "Type of Set Aside",
    "Extent Competed",
    "Contract Award Type",
]
```

5. Config via environment variables:
   - `USASPENDING_CACHE_DIR` (default: `.cache/usaspending/`)
   - `USASPENDING_CACHE_TTL_HOURS` (default: 24)
   - `USASPENDING_MAX_PAGES` (default: 50)
   - `USASPENDING_RATE_LIMIT` (default: 2.0 requests/sec)

**Test:** `tests/test_etl.py` — mock the API, test pagination, caching, retry logic, and filter construction.

---

### Contract 3: Capability Classifier

**File:** `etl/capability_classifier.py`

**Purpose:** Given a contract description, NAICS code, and PSC code, classify the contract into one or more `dp:TechnicalCapability` classes from the ontology.

**Requirements:**

1. Implement `CapabilityClassifier` class with:
   - `classify(description, naics_code, psc_code) → list[str]` — returns list of capability URIs
   - `classify_batch(records: list[dict]) → list[list[str]]` — batch classification with rate limiting

2. Classification strategy (layered, not just LLM):

   **Layer 1: Deterministic rules (fast, free)**
   - PSC code prefix mapping (hardcoded lookup table):
     ```
     "R4" → [dp:ElectronicWarfare, dp:C4ISR]  (Electronics R&D)
     "AC" → [dp:ElectronicWarfare]              (Electronic components)
     "AA" → [dp:MissileDefense, dp:Hypersonics] (Missiles)
     "AJ" → [dp:AutonomousSystems]              (UAVs)
     ```
   - NAICS code mapping (hardcoded):
     ```
     "541715" → check description for subcategory
     "518210" → [dp:CyberSecurity, dp:C4ISR]
     "334511" → [dp:SpaceSystems, dp:C4ISR]
     ```
   - Keyword matching on description (regex patterns):
     ```
     r"electronic.warfare|EW\b|jamming|SIGINT" → dp:ElectronicWarfare
     r"artificial.intelligence|machine.learning|neural.net|deep.learn" → dp:AIandML
     r"autonomous|UAS\b|UAV\b|unmanned|drone|robotic" → dp:AutonomousSystems
     r"cyber|information.assurance|zero.trust|penetration.test" → dp:CyberSecurity
     r"hypersonic|scramjet|boost.glide" → dp:Hypersonics
     r"directed.energy|laser.weapon|high.energy.laser|HEL\b" → dp:DirectedEnergy
     r"quantum.comput|quantum.sens|quantum.commun" → dp:QuantumTechnology
     ```

   **Layer 2: Claude API (for ambiguous cases)**
   - Only invoke when Layer 1 returns 0 results or confidence is low
   - System prompt must include the full capability taxonomy with definitions
   - Request structured JSON output: `{"capabilities": ["dp:AIandML", "dp:CyberSecurity"], "confidence": 0.85}`
   - Cache results keyed on (description_hash, naics, psc)
   - Rate limit: respect Anthropic API limits

3. Config:
   - `ANTHROPIC_API_KEY` — for Claude API calls
   - `CLASSIFIER_MODEL` — default `claude-sonnet-4-20250514`
   - `CLASSIFIER_CACHE_DIR` — default `.cache/classifications/`
   - `CLASSIFIER_USE_LLM` — default `true`, set `false` to use only deterministic rules

**Test:** `tests/test_classifier.py` — test each layer independently:
- Deterministic rules with known PSC/NAICS/description combos
- Mock Claude API responses for Layer 2
- Test batch classification with mixed deterministic + LLM results

---

### Contract 4: RDF Transformer

**File:** `etl/rdf_transformer.py`

**Purpose:** Transform raw USASpending JSON records into RDF triples conforming to the domain ontology.

**Requirements:**

1. Implement `RDFTransformer` class with:
   - `transform_award(raw_record: dict, capabilities: list[str]) → rdflib.Graph`
   - `transform_batch(records: list[dict], capabilities: list[list[str]]) → rdflib.Graph`
   - `serialize(graph, format="turtle") → str`
   - `save(graph, filepath, format="turtle")`

2. For each award record, generate triples for:
   - The ContractAward individual (URI: `dp:award_{award_id_cleaned}`)
   - The Contractor individual (URI: `dp:contractor_{uei}`) — deduplicate by UEI
   - The GovernmentAgency individual (URI: `dp:agency_{agency_name_slug}`)
   - The PlaceOfPerformance individual (URI: `dp:location_{state}_{district}`)
   - All data properties (dates, amounts, descriptions, codes)
   - All object properties (awardedTo, awardedBy, performedAt, requiresCapability, classifiedAs)
   - rdf:type assertions for each individual

3. Handle:
   - URI sanitization — no spaces, special chars in URIs
   - Null/missing field handling — skip triple rather than insert null
   - Deduplication — same contractor appearing in multiple awards should map to same URI
   - Amount normalization — all amounts as xsd:decimal
   - Date parsing — various USASpending date formats → xsd:date

4. Namespace management:
```python
DP = Namespace("http://defenseprocurement.io/ontology#")
DATA = Namespace("http://defenseprocurement.io/data#")
BFO = Namespace("http://purl.obolibrary.org/obo/")
CCO = Namespace("http://www.ontologyrepository.com/CommonCoreOntologies/")
```

Use `DP` for ontology classes/properties, `DATA` for individual instances.

**Test:** `tests/test_transformer.py` — given a sample USASpending record, verify correct triples are generated. Check URI format, data types, and completeness.

---

### Contract 5: ETL Pipeline Orchestrator

**File:** `etl/pipeline.py`

**Purpose:** Orchestrate the full ETL: extract from USASpending → classify capabilities → transform to RDF → load into Fuseki.

**Requirements:**

1. Implement `Pipeline` class with:
   - `run(agency, fiscal_year, max_records=None)` — full pipeline
   - `extract(agency, fiscal_year, max_records)` → raw records
   - `classify(records)` → capabilities per record
   - `transform(records, capabilities)` → RDF graph
   - `load(graph, fuseki_endpoint)` → upload to Fuseki via SPARQL UPDATE or GSP
   - `validate(graph)` → run quality checks before loading

2. Pipeline steps with logging:
```
[EXTRACT]  Fetching DARPA awards FY2024... 1,247 records retrieved
[CLASSIFY] Classifying capabilities... 1,102 deterministic, 145 via Claude API
[TRANSFORM] Generating RDF triples... 28,439 triples generated
[VALIDATE] Running quality checks... 3 warnings, 0 errors
[LOAD]     Uploading to Fuseki... done (graph: <http://defenseprocurement.io/data/darpa/fy2024>)
```

3. Support:
   - Named graphs per agency/year: `<http://defenseprocurement.io/data/{agency}/{fy}>`
   - Incremental loading — don't reload data already in Fuseki
   - Dry run mode — do everything except load
   - Resume from checkpoint — if classify step fails, don't re-extract
   - Progress reporting — log every 100 records

4. Fuseki loading via:
   - SPARQL Graph Store Protocol (GSP): `POST /procurement/data?graph=<named_graph>`
   - Content-Type: `text/turtle`
   - Chunked uploads for large graphs (>10K triples per chunk)

5. CLI entry point:
```bash
python -m etl.pipeline --agency "DARPA" --fiscal-year 2024 --max-records 500
python -m etl.pipeline --agency "Navy" --fiscal-year 2024 --dry-run
python -m etl.pipeline --agency "DARPA" --fiscal-year 2023 --fiscal-year 2024  # multi-year
```

**Test:** Integration test with mocked API and local Fuseki — verify end-to-end pipeline produces valid, loadable triples.

---

### Contract 6: Triple Store Setup

**Files:** `triplestore/docker-compose.yml`, `triplestore/fuseki-config.ttl`

**Requirements:**

1. Docker Compose for Apache Jena Fuseki:
   - Image: `stain/jena-fuseki` (or official `apache/jena-fuseki`)
   - Port: 3030
   - Persistent volume for TDB2 data
   - Admin password via env var
   - Memory: allocate 2GB min for JVM

2. Fuseki config with:
   - TDB2 dataset (not in-memory) for persistence
   - OWL reasoning enabled (OWL Micro reasoner at minimum — full OWL DL if performance allows)
   - SPARQL 1.1 Query and Update endpoints
   - Graph Store Protocol endpoint

3. `load_data.sh` script:
   - Load the domain ontology first
   - Then load data graphs
   - Run a verification query to confirm triple count

4. Pre-built SPARQL queries in `triplestore/queries/`:
   - Each query in its own `.sparql` file with comments explaining the business question
   - Include the 5 queries from the project plan plus:
     - `emerging_contractors.sparql` — contractors with first-ever award in a new capability area in the last fiscal year
     - `supply_chain_risk.sparql` — single-source dependencies for critical capabilities

---

### Contract 7: MCP Server

**Files:** `mcp-server/src/`

**Stack:** TypeScript, `@modelcontextprotocol/sdk`

**Requirements:**

1. Implement MCP server with these tools:

   **`query_contractors`**
   - Input: capability, agency, minAwardValue, maxAwardValue, isSmallBusiness, fiscalYear, state
   - Builds SPARQL query dynamically based on provided filters
   - Returns: contractor name, UEI, total awards, total value, capabilities list

   **`analyze_teaming`**
   - Input: contractor (name or UEI), role (prime/sub/any), capability, fiscalYear
   - Returns: teaming relationships — who they prime/sub with, on what contracts, in what capability areas

   **`capability_gap_analysis`**
   - Input: agency (optional), startYear, endYear
   - Returns: capabilities with spend trend, contractor count trend, concentration metrics

   **`contractor_profile`**
   - Input: contractor name or UEI
   - Returns: full profile — all awards, capabilities, agencies worked with, teaming partners, spend by year, small business status

   **`natural_language_query`**
   - Input: question (natural language string)
   - Uses Claude API to translate NL → SPARQL
   - System prompt includes: full ontology schema, example SPARQL queries, common patterns
   - Executes generated SPARQL against Fuseki
   - Returns: raw results + Claude-generated summary of findings

2. SPARQL client (`sparql/client.ts`):
   - HTTP client for Fuseki SPARQL endpoint
   - Support both SELECT (returns JSON bindings) and CONSTRUCT (returns triples)
   - Timeout handling
   - Connection pooling

3. Query builder (`sparql/query_builder.ts`):
   - Programmatic SPARQL construction from tool inputs
   - Handles optional filters (only add FILTER clauses for provided params)
   - Prevents SPARQL injection
   - Supports pagination (LIMIT/OFFSET)

**Test:** Unit tests for query builder. Integration tests with Fuseki.

---

### Contract 8: React Dashboard

**Files:** `dashboard/src/`

**Stack:** React 18, TypeScript, Vite, Tailwind CSS, Recharts, D3.js (for network graph)

**Requirements:**

1. **Layout:**
   - Sidebar navigation: Overview, Contractors, Capabilities, Teaming, Queries
   - Header with agency/fiscal year filter (global)
   - Dark mode default (professional, data-heavy UI)

2. **Overview Page:**
   - KPI cards: Total contracts, total spend, unique contractors, unique capabilities
   - Spend by capability bar chart (Recharts)
   - Top 10 contractors by award value table
   - Awards over time line chart

3. **Contractors Page:**
   - Searchable/filterable table of all contractors
   - Click through to ContractorProfile:
     - Summary card: name, UEI, CAGE, small business status, employee count
     - Awards timeline
     - Capability radar chart
     - Teaming partners list
     - Spend by agency breakdown

4. **Capabilities Page:**
   - Capability × Agency heatmap (D3 or Recharts)
   - Per-capability drill-down:
     - Contractor count trend
     - Spend trend
     - Top contractors
     - Concentration risk metric (HHI)

5. **Teaming Page:**
   - D3 force-directed network graph:
     - Nodes = contractors (sized by award volume)
     - Edges = teaming relationships (weighted by frequency)
     - Color by primary capability
     - Click node to highlight connections
     - Filter by capability, agency
   - Teaming frequency table

6. **Query Page:**
   - Natural language search input (sends to MCP server's NL query tool)
   - Raw SPARQL editor (CodeMirror or Monaco with SPARQL syntax highlighting)
   - Results displayed as table with download to CSV
   - Save/load query library

7. **API Layer:**
   - All data fetched via SPARQL queries to Fuseki endpoint directly (no backend needed for MVP)
   - `src/api/sparql.ts`: generic SPARQL query executor
   - Configurable endpoint via env var `VITE_SPARQL_ENDPOINT`

8. **Design:**
   - Use shadcn/ui components where appropriate
   - Color palette: dark navy backgrounds, teal/cyan accents, warm amber for alerts
   - All charts must have tooltips
   - Responsive but prioritize desktop (this is a professional tool)
   - Loading skeletons for all data-dependent components

---

### Contract 9: Docker Compose (Full Stack)

**File:** `docker-compose.yml` (root)

**Services:**

```yaml
services:
  fuseki:
    # Apache Jena Fuseki triple store
    ports: 3030
    volumes: fuseki-data
    
  mcp-server:
    # MCP server (optional — for Claude Code integration)
    build: ./mcp-server
    ports: 8080
    depends_on: fuseki
    environment:
      FUSEKI_ENDPOINT: http://fuseki:3030/procurement
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    
  dashboard:
    # React dashboard
    build: ./dashboard
    ports: 5173
    depends_on: fuseki
    environment:
      VITE_SPARQL_ENDPOINT: http://localhost:3030/procurement/sparql
```

---

### Contract 10: Documentation & Sample Data

1. **`scripts/seed_sample_data.py`:**
   - Generate 500 realistic sample awards for development/testing
   - 20 contractors with realistic names, capabilities, and relationships
   - 3 agencies (DARPA, Navy, MDA)
   - 2 fiscal years
   - Include teaming relationships (sub-award data)
   - Output as Turtle file loadable into Fuseki

2. **`docs/ontology-decisions.md`:**
   - Why BFO as upper ontology
   - Why each capability class exists
   - Design patterns used (role pattern for Contractor, capability disposition pattern)
   - Known limitations and future extensions

3. **`docs/query-catalog.md`:**
   - Every SPARQL query with:
     - Business question it answers
     - The query itself
     - Sample output
     - How to interpret results

4. **`docs/api-reference.md`:**
   - MCP server tool documentation
   - Input/output schemas
   - Example requests and responses

---

## Development Guidelines

### Code Style
- **Python:** Use type hints everywhere. Follow PEP 8. Use dataclasses for data structures. Use `logging` module (not print).
- **TypeScript:** Strict mode. Use interfaces for all data shapes. No `any` types.
- **SPARQL:** Uppercase keywords, lowercase prefixes, indent graph patterns.

### Error Handling
- Never swallow exceptions silently
- Log all API errors with request context
- Graceful degradation: if Claude API is unavailable, capability classifier falls back to deterministic-only mode
- If Fuseki is unreachable, dashboard shows clear error state (not blank page)

### Testing
- Unit tests for all pure functions
- Integration tests for API clients (mocked)
- SPARQL query tests against sample data
- Ontology consistency test

### Git Workflow
- Feature branches per contract
- Commit messages: `[contract-N] description`
- Each contract should be independently mergeable to main

### Environment Variables
```bash
# .env.example
ANTHROPIC_API_KEY=sk-ant-...
FUSEKI_ENDPOINT=http://localhost:3030/procurement
FUSEKI_ADMIN_PASSWORD=admin
USASPENDING_CACHE_DIR=.cache/usaspending
CLASSIFIER_CACHE_DIR=.cache/classifications
VITE_SPARQL_ENDPOINT=http://localhost:3030/procurement/sparql
```

---

## Build Order

Execute contracts in this exact order. Each depends on the previous:

```
1. Domain Ontology          → Foundation everything else builds on
2. USASpending Client       → Data extraction
3. Capability Classifier    → Intelligence layer on raw data  
4. RDF Transformer          → Convert data to ontology-conformant triples
5. Pipeline Orchestrator    → Wire 2+3+4 together
6. Triple Store Setup       → Where data lives
7. MCP Server               → AI-powered query interface
8. React Dashboard          → Human interface
9. Docker Compose           → Deployment
10. Docs & Sample Data      → Polish
```

After each contract, verify by running its tests before proceeding.

---

## Success Criteria

The project is complete when:

1. Running `docker compose up` starts the full stack
2. Running the ETL pipeline for DARPA FY2024 ingests real data into Fuseki
3. All 7 SPARQL queries in `triplestore/queries/` return meaningful results
4. The dashboard displays data from all query types
5. The MCP server can answer "Which small companies sub for multiple primes on AI contracts?" and return correct results
6. The network graph visualization shows real teaming relationships
7. All tests pass
