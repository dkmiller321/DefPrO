# Ontology Design Decisions

This document records the rationale behind the Defense Procurement Ontology (DefPrO) architecture, including upper ontology selection, class design, modeling patterns, and known limitations.

**Namespace:** `dp: <http://defenseprocurement.io/ontology#>`

---

## 1. Upper Ontology: BFO 2020

The ontology is grounded in the Basic Formal Ontology (BFO), ISO 21838-2.

**Why BFO:**

- **DoD alignment.** BFO is the mandated upper ontology for most US Department of Defense ontology efforts. Building on BFO makes DefPrO immediately interoperable with other DoD knowledge assets.
- **ISO standardization.** BFO 2020 is an international standard, reducing the risk of adopting a niche or abandoned framework.
- **Continuant/occurrent distinction.** BFO's separation of enduring entities (continuants) from processes (occurrents) maps naturally to procurement: contractors and agencies persist over time, while contract awards and modifications are time-bounded events.

**Alternatives considered:**

| Upper Ontology | Reason Rejected |
|---|---|
| SUMO | Less adoption in defense; weaker tooling ecosystem. |
| DOLCE | Academic focus; limited DoD community use. |
| Schema.org | Too shallow for formal reasoning; no process/disposition modeling. |

## 2. Mid-Level: Common Core Ontologies (CCO)

CCO provides the bridge between BFO abstractions and defense procurement domain classes.

**Modules used:**

- `cco:Organization` -- parent class for `dp:Contractor` and `dp:GovernmentAgency`.
- `cco:Agent` -- situates organizations within the BFO material entity hierarchy.
- `cco:Artifact` -- available for future deliverable/system modeling.
- `cco:InformationBearingEntity` -- parent for `dp:ContractDocument`, `dp:SBIRAward`, `dp:NAICSCode`, `dp:PSCCode`, and classification codes.

## 3. Capability Classes

### Why `dp:TechnicalCapability` as a BFO Disposition

Technical capabilities are modeled as subclasses of `obo:BFO_0000016` (Disposition). This is a deliberate ontological commitment:

- A disposition is a realizable entity that inheres in a material entity and is realized through processes.
- A contractor's capability in, say, electronic warfare is not a process itself -- it is a latent capacity that gets realized when the contractor performs work on a contract.
- This disposition pattern allows the ontology to distinguish between *having* a capability (`dp:hasCapability`) and *exercising* it on a specific contract (`dp:requiresCapability`).

### Capability Taxonomy

The 13 top-level capability classes were selected to cover the priority modernization areas identified in the National Defense Strategy and DoD critical technology areas:

| Class | Rationale |
|---|---|
| `dp:ElectronicWarfare` | Core EMS operations, SIGINT, jamming. High contract volume. |
| `dp:C4ISR` | Command/control/communications/ISR. Largest spend category. |
| `dp:AutonomousSystems` | UAS, UGV, UMV, robotics. Rapid growth area. |
| `dp:CyberSecurity` | Cybersecurity, IA, zero trust. Cross-cutting priority. |
| `dp:SpaceSystems` | Satellites, launch, SDA. Emerging domain. |
| `dp:AIandML` | AI/ML, deep learning. Cross-cutting modernization priority. |
| `dp:MissileDefense` | Interceptors, BMD. High-value programs. |
| `dp:Logistics` | Supply chain, sustainment, depot maintenance. |
| `dp:TrainingSimulation` | Simulators, LVC environments. Distinct procurement niche. |
| `dp:Hypersonics` | Scramjets, boost-glide. Top acquisition priority. |
| `dp:DirectedEnergy` | HEL, HPM weapons. Emerging technology area. |
| `dp:QuantumTechnology` | Quantum computing, sensing, PQC. Future capability. |
| `dp:Biotechnology` | Synthetic biology, biodefense. Emerging priority. |

A secondary taxonomy in `capability-taxonomy.ttl` provides subcapabilities (e.g., `dp:SIGINT` under `dp:ElectronicWarfare`, `dp:ComputerVision` under `dp:AIandML`) for finer-grained classification.

## 4. Design Patterns

### 4.1 Role Pattern for Contractors

A single organization can act as a prime contractor on one award and a subcontractor on another. Rather than making `dp:PrimeContractor` and `dp:Subcontractor` disjoint, the ontology explicitly allows overlap:

```
dp:PrimeContractor   rdfs:subClassOf dp:Contractor .
dp:Subcontractor     rdfs:subClassOf dp:Contractor .
# NOT declared owl:disjointWith
```

Per-award roles are captured through object properties (`dp:primeOn`, `dp:subsOn`) rather than class membership alone. This avoids the common error of conflating an entity's role with its identity.

### 4.2 Capability-Disposition Pattern

```
dp:TechnicalCapability  rdfs:subClassOf obo:BFO_0000016 .  # Disposition
dp:hasCapability        rdfs:domain dp:Contractor ;
                        rdfs:range  dp:TechnicalCapability .
dp:requiresCapability   rdfs:domain dp:ContractAward ;
                        rdfs:range  dp:TechnicalCapability .
```

- `dp:hasCapability` links a contractor to what it *can* do (inferred or asserted).
- `dp:requiresCapability` links an award to what it *needs*. The gap between these two sets drives the capability gap analysis queries.

### 4.3 Defined Class for Small Business

`dp:SmallBusiness` is an OWL defined class (equivalent class axiom), not just a named subclass:

```turtle
dp:SmallBusiness owl:equivalentClass [
    owl:intersectionOf (
        dp:Contractor
        [ owl:onProperty dp:isSmallBusiness ; owl:hasValue true ]
    )
] .
```

Any contractor with `dp:isSmallBusiness true` is automatically classified as a `dp:SmallBusiness` by a DL reasoner, without requiring explicit assertion.

### 4.4 Transitive Supply Chain

```turtle
dp:inSupplyChainOf  a owl:TransitiveProperty .
```

If contractor A subcontracts to B, and B subcontracts to C, then A is inferred to be in C's supply chain. This enables the supply chain risk query to detect deep dependencies without manual traversal.

### 4.5 Symmetric Teaming

```turtle
dp:teamsWithOn  a owl:SymmetricProperty .
```

If A teams with B, then B teams with A. A single assertion covers both directions.

### 4.6 Existential Restrictions on ContractAward

Every `dp:ContractAward` must have at least one contractor and at least one awarding agency:

```turtle
dp:ContractAward rdfs:subClassOf [
    owl:onProperty dp:awardedTo ;
    owl:someValuesFrom dp:Contractor
] .
dp:ContractAward rdfs:subClassOf [
    owl:onProperty dp:awardedBy ;
    owl:someValuesFrom dp:GovernmentAgency
] .
```

These axioms support consistency checking: a contract award without a contractor or agency will be flagged as inconsistent by an OWL DL reasoner.

## 5. NAICS/PSC to Capability Mapping

Contract awards carry NAICS and PSC codes, which are too broad for capability analysis. The mapping layer (`naics-psc-mapping.ttl`) provides deterministic mappings from codes to capability classes. When codes are ambiguous (e.g., NAICS 541715 "R&D in Physical/Engineering/Life Sciences"), the ETL pipeline falls through to keyword-based classification of the contract description using an LLM classifier.

## 6. Known Limitations

| Limitation | Impact | Mitigation Path |
|---|---|---|
| **No temporal qualification on capabilities.** A contractor's capability is asserted without a time interval; historical capability loss is not modeled. | May overstate current capabilities for contractors who have exited a market. | Future: introduce `dp:CapabilityAssertion` as a time-bounded process linking contractor, capability, and validity period. |
| **NAICS/PSC mapping is incomplete.** Only high-frequency defense-relevant codes are mapped. | Some awards will lack capability classification. | Expand mapping table incrementally; LLM fallback covers most gaps. |
| **No formal provenance tracking.** Capability assertions do not record whether they came from code mapping, LLM classification, or manual curation. | Hard to audit classification accuracy. | Future: use W3C PROV-O to annotate capability assertions with method and confidence. |
| **Open world assumption.** Absence of a capability assertion does not mean the contractor lacks it. | Capability gap queries may undercount. | Acceptable for intelligence use cases; document this caveat in query output. |
| **Sub-award data is sparse.** USASpending sub-award coverage is incomplete, limiting teaming analysis. | Teaming queries may miss relationships. | Supplement with SAM.gov, press releases, and manual curation over time. |
| **Single fiscal year granularity.** Awards are tagged by fiscal year, not by month or quarter. | Trend analysis is coarse-grained. | Sufficient for strategic intelligence; add `dp:awardDate` filtering for finer analysis. |
