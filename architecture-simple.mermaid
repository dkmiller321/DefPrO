graph TB

subgraph Sources
    USA[USASpending.gov]
    SAM[SAM.gov]
    SBIR[SBIR.gov]
end

subgraph ETL
    EXT[Extract]
    CLASS[Classify Capabilities]
    TRANS[Transform to RDF]
    EXT --> CLASS --> TRANS
end

subgraph Ontology
    BFO[BFO 2020]
    CCO[Common Core Ontologies]
    DOM[Defense Procurement Ontology]
    BFO --> CCO --> DOM
end

subgraph KG
    FUSEKI[Apache Jena Fuseki]
    REASON[OWL Reasoner]
    FUSEKI --- REASON
end

subgraph Intelligence
    MCP[MCP Server]
    NL[NL to SPARQL - Claude API]
    MCP --- NL
end

subgraph UI
    NET[Contractor Network Graph]
    HEAT[Capability Heatmap]
    QUERY[NL Query Interface]
end

Sources --> EXT
TRANS --> FUSEKI
DOM -.-> FUSEKI
FUSEKI --> MCP
FUSEKI --> UI
MCP --> UI

classDef source fill:#1a3d2e,stroke:#4caf50,color:#e0e0e0
classDef etl fill:#1e3a5f,stroke:#4fc3f7,color:#e0e0e0
classDef onto fill:#3e2723,stroke:#ff9800,color:#e0e0e0
classDef store fill:#1a237e,stroke:#7c4dff,color:#e0e0e0
classDef intel fill:#4a148c,stroke:#ce93d8,color:#e0e0e0
classDef ui fill:#b71c1c,stroke:#ef5350,color:#e0e0e0

class USA,SAM,SBIR source
class EXT,CLASS,TRANS etl
class BFO,CCO,DOM onto
class FUSEKI,REASON store
class MCP,NL intel
class NET,HEAT,QUERY ui