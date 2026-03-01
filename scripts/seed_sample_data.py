"""Generate realistic sample procurement data for development/testing.

Creates 500 awards across 20 contractors, 3 agencies, and 2 fiscal years.
Outputs a Turtle file loadable into Fuseki.
"""

import random
from decimal import Decimal
from pathlib import Path

from rdflib import Graph, Literal, Namespace, URIRef, RDF, RDFS, XSD

DP = Namespace("http://defenseprocurement.io/ontology#")
DATA = Namespace("http://defenseprocurement.io/data#")

# --- Contractors ---
CONTRACTORS = [
    {"name": "Lockheed Martin Corporation", "uei": "DPZXHLG39QS6", "small": False, "caps": ["MissileDefense", "SpaceSystems", "C4ISR", "Hypersonics"]},
    {"name": "Raytheon Technologies", "uei": "RB2TCA34KEN4", "small": False, "caps": ["MissileDefense", "ElectronicWarfare", "CyberSecurity", "C4ISR"]},
    {"name": "Northrop Grumman Systems Corp", "uei": "JB7MVJ3U79N1", "small": False, "caps": ["AutonomousSystems", "SpaceSystems", "C4ISR", "CyberSecurity"]},
    {"name": "General Dynamics IT", "uei": "GDT4P6QM4JK2", "small": False, "caps": ["C4ISR", "CyberSecurity", "AIandML"]},
    {"name": "BAE Systems Inc", "uei": "BAE9XKP5SN23", "small": False, "caps": ["ElectronicWarfare", "C4ISR", "AutonomousSystems"]},
    {"name": "L3Harris Technologies", "uei": "L3H7RVP8KM32", "small": False, "caps": ["ElectronicWarfare", "SpaceSystems", "C4ISR", "CyberSecurity"]},
    {"name": "Leidos Inc", "uei": "LEI5KJT9NM76", "small": False, "caps": ["CyberSecurity", "AIandML", "C4ISR", "Logistics"]},
    {"name": "Booz Allen Hamilton", "uei": "BAH8PLQ2WX45", "small": False, "caps": ["AIandML", "CyberSecurity", "C4ISR", "TrainingSimulation"]},
    {"name": "SAIC", "uei": "SAI3CVR7FN89", "small": False, "caps": ["C4ISR", "Logistics", "TrainingSimulation", "AIandML"]},
    {"name": "Peraton Inc", "uei": "PER6TKM3HJ12", "small": False, "caps": ["CyberSecurity", "SpaceSystems", "C4ISR"]},
    {"name": "Shield AI", "uei": "SHA1QWE4RF56", "small": True, "caps": ["AIandML", "AutonomousSystems"]},
    {"name": "Anduril Industries", "uei": "AND5YUI8OP90", "small": True, "caps": ["AutonomousSystems", "AIandML", "C4ISR"]},
    {"name": "Rebellion Defense", "uei": "REB2ASD6FG34", "small": True, "caps": ["AIandML", "CyberSecurity"]},
    {"name": "SpiderOak Inc", "uei": "SPD9ZXC3VB78", "small": True, "caps": ["CyberSecurity", "SpaceSystems"]},
    {"name": "Epirus Inc", "uei": "EPI4BNM7KL12", "small": True, "caps": ["DirectedEnergy", "ElectronicWarfare"]},
    {"name": "Hermeus Corporation", "uei": "HER8QWE2RT56", "small": True, "caps": ["Hypersonics"]},
    {"name": "IonQ Inc", "uei": "ION3TYU7IO90", "small": True, "caps": ["QuantumTechnology"]},
    {"name": "Ginkgo Bioworks", "uei": "GIN6ASD1FG34", "small": True, "caps": ["Biotechnology"]},
    {"name": "Palantir Technologies", "uei": "PAL2ZXC8VB78", "small": False, "caps": ["AIandML", "C4ISR", "CyberSecurity"]},
    {"name": "Dynetics Inc", "uei": "DYN5BNM4KL12", "small": False, "caps": ["MissileDefense", "Hypersonics", "AutonomousSystems", "SpaceSystems"]},
]

AGENCIES = [
    {"name": "Defense Advanced Research Projects Agency", "parent": "Department of Defense"},
    {"name": "Department of the Navy", "parent": "Department of Defense"},
    {"name": "Missile Defense Agency", "parent": "Department of Defense"},
]

NAICS_CODES = [
    ("541715", "R&D in Physical, Engineering, and Life Sciences"),
    ("541512", "Computer Systems Design Services"),
    ("518210", "Data Processing, Hosting, and Related Services"),
    ("334511", "Search, Detection, Navigation, Guidance Systems"),
    ("336414", "Guided Missile and Space Vehicle Manufacturing"),
    ("541330", "Engineering Services"),
]

PSC_CODES = [
    ("R425", "Electronics R&D"),
    ("AC11", "Electronic Components"),
    ("D399", "IT and Telecom Services"),
    ("AJ12", "Unmanned Aerial Vehicles"),
    ("AG10", "Space Vehicles"),
    ("U012", "Training Services"),
]

DESCRIPTIONS = {
    "AIandML": [
        "Development of machine learning models for predictive maintenance",
        "Artificial intelligence-based target recognition system",
        "Deep learning algorithms for sensor data fusion and analysis",
        "AI/ML powered decision support system for battle management",
    ],
    "CyberSecurity": [
        "Zero trust architecture implementation for classified networks",
        "Cybersecurity assessment and penetration testing services",
        "Network security monitoring and intrusion detection system",
        "Endpoint protection and security operations center support",
    ],
    "ElectronicWarfare": [
        "Electronic warfare threat simulation and testing",
        "SIGINT collection system modernization and upgrade",
        "Electronic attack pod development and integration",
        "Electromagnetic spectrum operations planning tool",
    ],
    "AutonomousSystems": [
        "Unmanned aerial system development and flight testing",
        "Autonomous ground vehicle navigation software",
        "Collaborative autonomy for drone swarm operations",
        "Counter-UAS detection and defeat system integration",
    ],
    "SpaceSystems": [
        "GPS satellite constellation modernization program",
        "Space domain awareness sensor development",
        "Small satellite bus manufacturing and integration",
        "Satellite communications ground terminal upgrade",
    ],
    "C4ISR": [
        "Command and control system integration and testing",
        "Intelligence surveillance reconnaissance platform support",
        "Tactical data link interoperability assessment",
        "JADC2 architecture development and prototyping",
    ],
    "MissileDefense": [
        "Missile defense interceptor component testing",
        "Ballistic missile defense system integration support",
        "THAAD radar system maintenance and sustainment",
        "Next-generation interceptor design and prototyping",
    ],
    "Hypersonics": [
        "Hypersonic boost-glide vehicle thermal protection research",
        "Scramjet engine development and wind tunnel testing",
        "Hypersonic weapon system concept design study",
    ],
    "DirectedEnergy": [
        "High energy laser weapon system integration testing",
        "High power microwave counter-electronics prototype",
        "Directed energy beam control and tracking system",
    ],
    "QuantumTechnology": [
        "Quantum computing research for cryptanalysis applications",
        "Quantum sensing prototype development for navigation",
        "Post-quantum cryptography algorithm evaluation",
    ],
    "Biotechnology": [
        "Biosurveillance system development for CBRN threats",
        "Synthetic biology research for materials science",
        "Biodefense rapid diagnostic platform development",
    ],
    "Logistics": [
        "Supply chain management system modernization",
        "Depot maintenance workload analysis and planning",
        "Predictive logistics using IoT sensor networks",
    ],
    "TrainingSimulation": [
        "Flight simulator visual system upgrade program",
        "Live-virtual-constructive training environment integration",
        "Virtual reality combat medic training system",
    ],
}

STATES = ["VA", "CA", "MD", "TX", "AL", "CO", "FL", "MA", "OH", "CT"]


def generate() -> Graph:
    g = Graph()
    g.bind("dp", DP)
    g.bind("data", DATA)

    random.seed(42)

    # Create parent agency
    dod_uri = DATA["agency_department_of_defense"]
    g.add((dod_uri, RDF.type, DP.GovernmentAgency))
    g.add((dod_uri, RDFS.label, Literal("Department of Defense")))

    # Create agencies
    agency_uris = []
    for agency in AGENCIES:
        slug = agency["name"].lower().replace(" ", "_")
        uri = DATA[f"agency_{slug}"]
        g.add((uri, RDF.type, DP.GovernmentAgency))
        g.add((uri, RDFS.label, Literal(agency["name"])))
        g.add((uri, DP.parentAgency, dod_uri))
        agency_uris.append(uri)

    # Create contractors
    contractor_uris = []
    for c in CONTRACTORS:
        uri = DATA[f"contractor_{c['uei']}"]
        g.add((uri, RDF.type, DP.Contractor))
        g.add((uri, RDFS.label, Literal(c["name"])))
        g.add((uri, DP.ueiNumber, Literal(c["uei"])))
        g.add((uri, DP.isSmallBusiness, Literal(c["small"])))
        for cap in c["caps"]:
            g.add((uri, DP.hasCapability, DP[cap]))
        contractor_uris.append(uri)

    # Create locations
    location_uris = []
    for state in STATES:
        for district in ["01", "02", "03"]:
            uri = DATA[f"location_{state}_{district}"]
            g.add((uri, RDF.type, DP.PlaceOfPerformance))
            g.add((uri, DP.stateCode, Literal(state)))
            g.add((uri, DP.congressionalDistrict, Literal(district)))
            g.add((uri, RDFS.label, Literal(f"{state}-{district}")))
            location_uris.append(uri)

    # Create NAICS and PSC code individuals
    naics_uris = []
    for code, desc in NAICS_CODES:
        uri = DATA[f"naics_{code}"]
        g.add((uri, RDF.type, DP.NAICSCode))
        g.add((uri, DP.naicsCode, Literal(code)))
        g.add((uri, DP.naicsDescription, Literal(desc)))
        g.add((uri, RDFS.label, Literal(f"NAICS {code}")))
        naics_uris.append(uri)

    psc_uris = []
    for code, desc in PSC_CODES:
        uri = DATA[f"psc_{code}"]
        g.add((uri, RDF.type, DP.PSCCode))
        g.add((uri, DP.pscCode, Literal(code)))
        g.add((uri, DP.pscDescription, Literal(desc)))
        g.add((uri, RDFS.label, Literal(f"PSC {code}")))
        psc_uris.append(uri)

    # Generate 500 awards
    for i in range(500):
        c_idx = random.choices(range(len(CONTRACTORS)), weights=[
            15, 12, 12, 8, 8, 8, 7, 7, 5, 4,  # Large contractors more awards
            3, 3, 2, 2, 1, 1, 1, 1, 3, 3,  # Small/mid companies fewer
        ])[0]
        contractor = CONTRACTORS[c_idx]
        contractor_uri = contractor_uris[c_idx]
        agency_uri = random.choice(agency_uris)
        location_uri = random.choice(location_uris)
        naics_uri = random.choice(naics_uris)
        psc_uri = random.choice(psc_uris)

        fy = random.choice(["2023", "2024"])
        month = random.randint(1, 12)
        day = random.randint(1, 28)
        year = int(fy) - 1 if month >= 10 else int(fy)
        award_date = f"{year}-{month:02d}-{day:02d}"

        cap = random.choice(contractor["caps"])
        amount = random.choice([
            random.randint(50_000, 500_000),
            random.randint(500_000, 5_000_000),
            random.randint(5_000_000, 50_000_000),
            random.randint(50_000_000, 500_000_000),
        ])

        desc_options = DESCRIPTIONS.get(cap, [f"Technical services for {cap}"])
        desc = random.choice(desc_options)

        award_id = f"W{random.randint(10, 99)}P{random.randint(10, 99)}-{fy[-2:]}-C-{i:04d}"
        award_uri = DATA[f"award_{award_id.replace('-', '_')}"]

        g.add((award_uri, RDF.type, DP.ContractAward))
        g.add((award_uri, RDFS.label, Literal(f"Award {award_id}")))
        g.add((award_uri, DP.contractNumber, Literal(award_id)))
        g.add((award_uri, DP.awardedTo, contractor_uri))
        g.add((award_uri, DP.awardedBy, agency_uri))
        g.add((award_uri, DP.performedAt, location_uri))
        g.add((award_uri, DP.classifiedAs, naics_uri))
        g.add((award_uri, DP.hasPSCCode, psc_uri))
        g.add((award_uri, DP.requiresCapability, DP[cap]))
        g.add((award_uri, DP.obligatedAmount, Literal(Decimal(amount), datatype=XSD.decimal)))
        g.add((award_uri, DP.totalAwardValue, Literal(Decimal(int(amount * 1.3)), datatype=XSD.decimal)))
        g.add((award_uri, DP.awardDate, Literal(award_date, datatype=XSD.date)))
        g.add((award_uri, DP.fiscalYear, Literal(fy, datatype=XSD.gYear)))
        g.add((award_uri, DP.description, Literal(desc)))

        comp_types = ["Full and Open Competition", "Not Available for Competition",
                      "Full and Open after Exclusion of Sources", "Not Competed"]
        g.add((award_uri, DP.competitionType, Literal(random.choice(comp_types))))

        if contractor["small"]:
            set_asides = ["Small Business Set-Aside", "8(a) Sole Source",
                          "HUBZone Set-Aside", "SDVOSB Set-Aside", None]
            sa = random.choice(set_asides)
            if sa:
                g.add((award_uri, DP.setAsideType, Literal(sa)))

    return g


def main() -> None:
    print("Generating sample data...")
    g = generate()
    print(f"Generated {len(g)} triples")

    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / "sample_data.ttl"
    g.serialize(destination=str(output_path), format="turtle")
    print(f"Saved to {output_path}")


if __name__ == "__main__":
    main()
