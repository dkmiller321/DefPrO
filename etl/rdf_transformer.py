"""Transform raw USASpending JSON records into RDF triples conforming to the domain ontology."""

import logging
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from rdflib import Graph, Literal, Namespace, URIRef, RDF, RDFS, XSD

logger = logging.getLogger(__name__)

DP = Namespace("http://defenseprocurement.io/ontology#")
DATA = Namespace("http://defenseprocurement.io/data#")
OBO = Namespace("http://purl.obolibrary.org/obo/")
CCO = Namespace("http://www.ontologyrepository.com/CommonCoreOntologies/")

# --- Parent company normalization ---
# Large defense companies register multiple UEIs for divisions/subsidiaries.
# This map normalizes variant names to a single canonical name so they appear
# as one entity in the graph. The canonical name is the key.
PARENT_COMPANY_ALIASES: dict[str, list[str]] = {
    "LOCKHEED MARTIN CORPORATION": [
        "LOCKHEED MARTIN CORP",
        "LOCKHEED MARTIN CORP.",
        "LOCKHEED MARTIN ROTARY AND MISSION SYSTEMS",
        "LOCKHEED MARTIN AERONAUTICS COMPANY",
        "LOCKHEED MARTIN MISSILES AND FIRE CONTROL",
        "LOCKHEED MARTIN SPACE",
        "LOCKHEED MARTIN INFORMATION SYSTEMS & GLOBAL SOLUTIONS",
        "SIKORSKY AIRCRAFT CORPORATION",  # LM subsidiary
    ],
    "THE BOEING COMPANY": [
        "BOEING COMPANY, THE",
        "BOEING CO",
        "BOEING COMPANY",
        "BOEING DEFENSE, SPACE & SECURITY",
    ],
    "RTX CORPORATION": [
        "RAYTHEON COMPANY",
        "RAYTHEON TECHNOLOGIES CORPORATION",
        "RAYTHEON MISSILES & DEFENSE",
        "RAYTHEON INTELLIGENCE & SPACE",
        "RAYTHEON BBN TECHNOLOGIES CORP",
        "RAYTHEON BBN TECHNOLOGIES CORP.",
        "PRATT & WHITNEY",
        "PRATT AND WHITNEY",
        "COLLINS AEROSPACE",
    ],
    "NORTHROP GRUMMAN CORPORATION": [
        "NORTHROP GRUMMAN SYSTEMS CORPORATION",
        "NORTHROP GRUMMAN SYSTEMS CORP",
        "NORTHROP GRUMMAN MISSION SYSTEMS",
        "NORTHROP GRUMMAN DEFENSE SYSTEMS",
        "NORTHROP GRUMMAN INNOVATION SYSTEMS",
        "NORTHROP GRUMMAN INFORMATION SYSTEMS",
        "NORTHROP GRUMMAN SPACE SYSTEMS",
    ],
    "GENERAL DYNAMICS CORPORATION": [
        "GENERAL DYNAMICS INFORMATION TECHNOLOGY, INC.",
        "GENERAL DYNAMICS INFORMATION TECHNOLOGY INC.",
        "GENERAL DYNAMICS LAND SYSTEMS INC",
        "GENERAL DYNAMICS LAND SYSTEMS INC.",
        "GENERAL DYNAMICS LAND SYSTEMS, INC.",
        "GENERAL DYNAMICS MISSION SYSTEMS, INC.",
        "GENERAL DYNAMICS MISSION SYSTEMS, INC",
        "GENERAL DYNAMICS MISSION SYSTEMS",
        "GENERAL DYNAMICS ORDNANCE AND TACTICAL SYSTEMS, INC.",
        "GENERAL DYNAMICS ORDNANCE AND TACTICAL SYSTEMS",
        "GENERAL DYNAMICS BATH IRON WORKS",
        "GENERAL DYNAMICS-OTS, INC.",
        "ELECTRIC BOAT CORPORATION",
        "BATH IRON WORKS CORPORATION",
    ],
    "BAE SYSTEMS PLC": [
        "BAE SYSTEMS INFORMATION & ELECTRONIC SYSTEMS INTEGRATION INC",
        "BAE SYSTEMS INFORMATION AND ELECTRONIC SYSTEMS INTEGRATION INC",
        "BAE SYSTEMS TECHNOLOGY SOLUTIONS & SERVICES INC.",
        "BAE SYSTEMS LAND & ARMAMENTS L.P.",
        "BAE SYSTEMS LAND & ARMAMENTS",
    ],
    "L3HARRIS TECHNOLOGIES, INC.": [
        "L3HARRIS TECHNOLOGIES",
        "L3 TECHNOLOGIES, INC.",
        "L3HARRIS APPLIED DEFENSE SOLUTIONS",
        "HARRIS CORPORATION",
    ],
    "HUNTINGTON INGALLS INDUSTRIES, INC.": [
        "HUNTINGTON INGALLS INC",
        "HUNTINGTON INGALLS INCORPORATED",
        "HUNTINGTON INGALLS INDUSTRIES",
    ],
    "BOOZ ALLEN HAMILTON INC.": [
        "BOOZ ALLEN HAMILTON INC",
        "BOOZ ALLEN HAMILTON",
    ],
    "LEIDOS, INC.": [
        "LEIDOS INC",
        "LEIDOS INC.",
        "LEIDOS, INC",
        "LEIDOS INNOVATIONS CORPORATION",
    ],
    "GENERAL ATOMICS": [
        "GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC.",
        "GENERAL ATOMICS AERONAUTICAL SYSTEMS INC",
        "GENERAL ATOMICS ELECTROMAGNETICS",
    ],
}

# Build reverse lookup: alias (uppercased) -> canonical name
_ALIAS_TO_CANONICAL: dict[str, str] = {}
for canonical, aliases in PARENT_COMPANY_ALIASES.items():
    for alias in aliases:
        _ALIAS_TO_CANONICAL[alias.upper()] = canonical
    # Also map the canonical name to itself for consistent lookup
    _ALIAS_TO_CANONICAL[canonical.upper()] = canonical


def _normalize_contractor_name(name: str) -> str:
    """Normalize a contractor name to its canonical parent company name."""
    return _ALIAS_TO_CANONICAL.get(name.upper().strip(), name.strip())


def _sanitize_uri(value: str) -> str:
    """Sanitize a string for use in a URI — replace invalid chars."""
    s = re.sub(r"[^a-zA-Z0-9_\-.]", "_", value.strip())
    s = re.sub(r"_+", "_", s)
    return s.strip("_")


def _slugify(value: str) -> str:
    """Create a URL-friendly slug from a string."""
    s = value.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def _parse_date(date_str: str | None) -> str | None:
    """Parse various date formats into xsd:date (YYYY-MM-DD)."""
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Try ISO format directly
    try:
        dt = datetime.fromisoformat(date_str.strip().replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        logger.warning("Could not parse date: %s", date_str)
        return None


def _parse_decimal(value: Any) -> Decimal | None:
    """Parse a value to Decimal, handling various formats."""
    if value is None:
        return None
    try:
        if isinstance(value, str):
            value = value.replace(",", "").replace("$", "").strip()
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _fiscal_year_from_date(date_str: str | None) -> str | None:
    """Derive fiscal year from a date. FY starts Oct 1."""
    parsed = _parse_date(date_str)
    if not parsed:
        return None
    try:
        dt = datetime.strptime(parsed, "%Y-%m-%d")
        fy = dt.year + 1 if dt.month >= 10 else dt.year
        return str(fy)
    except ValueError:
        return None


class RDFTransformer:
    """Transform raw USASpending records into ontology-conformant RDF triples."""

    def __init__(self):
        self._seen_contractors: set[str] = set()
        self._seen_agencies: set[str] = set()
        self._seen_locations: set[str] = set()
        self._seen_naics: set[str] = set()
        self._seen_psc: set[str] = set()

    def _init_graph(self) -> Graph:
        g = Graph()
        g.bind("dp", DP)
        g.bind("data", DATA)
        g.bind("obo", OBO)
        g.bind("cco", CCO)
        return g

    def _add_contractor(self, g: Graph, record: dict) -> URIRef | None:
        """Add or reference a contractor individual.

        Normalizes known parent company names so that divisions like
        'NORTHROP GRUMMAN SYSTEMS CORPORATION' and 'NORTHROP GRUMMAN
        MISSION SYSTEMS' resolve to a single 'NORTHROP GRUMMAN CORPORATION'
        entity in the graph.
        """
        raw_name = record.get("Recipient Name")
        if not raw_name:
            return None

        # Normalize to canonical parent company name
        name = _normalize_contractor_name(raw_name)

        # Deduplicate by normalized name slug (not UEI) so divisions merge
        key = _slugify(name)
        uri = DATA[f"contractor_{key}"]

        uei = record.get("Recipient UEI")

        if key not in self._seen_contractors:
            self._seen_contractors.add(key)
            g.add((uri, RDF.type, DP.Contractor))
            g.add((uri, RDFS.label, Literal(name)))
            if uei:
                g.add((uri, DP.ueiNumber, Literal(uei)))

        return uri

    def _add_agency(self, g: Graph, record: dict) -> URIRef | None:
        """Add or reference a government agency."""
        agency_name = record.get("Awarding Agency")
        if not agency_name:
            return None

        key = _slugify(agency_name)
        uri = DATA[f"agency_{key}"]

        if key not in self._seen_agencies:
            self._seen_agencies.add(key)
            g.add((uri, RDF.type, DP.GovernmentAgency))
            g.add((uri, RDFS.label, Literal(agency_name)))

            # Add sub-agency if different
            sub_agency = record.get("Awarding Sub Agency")
            if sub_agency and sub_agency != agency_name:
                sub_key = _slugify(sub_agency)
                sub_uri = DATA[f"agency_{sub_key}"]
                if sub_key not in self._seen_agencies:
                    self._seen_agencies.add(sub_key)
                    g.add((sub_uri, RDF.type, DP.GovernmentAgency))
                    g.add((sub_uri, RDFS.label, Literal(sub_agency)))
                    g.add((sub_uri, DP.parentAgency, uri))

        return uri

    def _add_location(self, g: Graph, record: dict) -> URIRef | None:
        """Add or reference a place of performance."""
        state = record.get("Place of Performance State Code")
        district = record.get("Place of Performance Congressional District")
        if not state:
            return None

        district_str = str(district) if district else "00"
        key = f"{state}_{district_str}"
        uri = DATA[f"location_{key}"]

        if key not in self._seen_locations:
            self._seen_locations.add(key)
            g.add((uri, RDF.type, DP.PlaceOfPerformance))
            g.add((uri, DP.stateCode, Literal(state)))
            if district:
                g.add((uri, DP.congressionalDistrict, Literal(district_str)))
            g.add((uri, RDFS.label, Literal(f"{state}-{district_str}")))

        return uri

    def _add_naics(self, g: Graph, record: dict) -> URIRef | None:
        """Add or reference a NAICS code individual."""
        code = record.get("NAICS Code")
        if not code:
            return None
        code = str(code).strip()
        uri = DATA[f"naics_{code}"]

        if code not in self._seen_naics:
            self._seen_naics.add(code)
            g.add((uri, RDF.type, DP.NAICSCode))
            g.add((uri, DP.naicsCode, Literal(code)))
            desc = record.get("NAICS Description")
            if desc:
                g.add((uri, DP.naicsDescription, Literal(desc)))
            g.add((uri, RDFS.label, Literal(f"NAICS {code}")))

        return uri

    def _add_psc(self, g: Graph, record: dict) -> URIRef | None:
        """Add or reference a PSC code individual."""
        code = record.get("PSC Code")
        if not code:
            return None
        code = str(code).strip()
        uri = DATA[f"psc_{_sanitize_uri(code)}"]

        if code not in self._seen_psc:
            self._seen_psc.add(code)
            g.add((uri, RDF.type, DP.PSCCode))
            g.add((uri, DP.pscCode, Literal(code)))
            desc = record.get("PSC Description")
            if desc:
                g.add((uri, DP.pscDescription, Literal(desc)))
            g.add((uri, RDFS.label, Literal(f"PSC {code}")))

        return uri

    def transform_award(
        self,
        raw_record: dict,
        capabilities: list[str] | None = None,
    ) -> Graph:
        """Transform a single award record into an RDF graph."""
        g = self._init_graph()

        award_id = raw_record.get("Award ID")
        if not award_id:
            logger.warning("Record missing Award ID, skipping")
            return g

        award_uri = DATA[f"award_{_sanitize_uri(str(award_id))}"]
        g.add((award_uri, RDF.type, DP.ContractAward))
        g.add((award_uri, RDFS.label, Literal(f"Award {award_id}")))
        g.add((award_uri, DP.contractNumber, Literal(str(award_id))))

        # Contractor
        contractor_uri = self._add_contractor(g, raw_record)
        if contractor_uri:
            g.add((award_uri, DP.awardedTo, contractor_uri))

        # Agency
        agency_uri = self._add_agency(g, raw_record)
        if agency_uri:
            g.add((award_uri, DP.awardedBy, agency_uri))

        # Location
        location_uri = self._add_location(g, raw_record)
        if location_uri:
            g.add((award_uri, DP.performedAt, location_uri))

        # NAICS
        naics_uri = self._add_naics(g, raw_record)
        if naics_uri:
            g.add((award_uri, DP.classifiedAs, naics_uri))

        # PSC
        psc_uri = self._add_psc(g, raw_record)
        if psc_uri:
            g.add((award_uri, DP.hasPSCCode, psc_uri))

        # Data properties
        amount = _parse_decimal(raw_record.get("Total Obligated Amount") or raw_record.get("Award Amount"))
        if amount is not None:
            g.add((award_uri, DP.obligatedAmount, Literal(amount, datatype=XSD.decimal)))

        total_value = _parse_decimal(raw_record.get("Award Amount"))
        if total_value is not None:
            g.add((award_uri, DP.totalAwardValue, Literal(total_value, datatype=XSD.decimal)))

        start_date = _parse_date(raw_record.get("Start Date"))
        if start_date:
            g.add((award_uri, DP.awardDate, Literal(start_date, datatype=XSD.date)))

        end_date = _parse_date(raw_record.get("End Date"))
        if end_date:
            g.add((award_uri, DP.completionDate, Literal(end_date, datatype=XSD.date)))

        desc = raw_record.get("Description")
        if desc:
            g.add((award_uri, DP.description, Literal(desc)))

        comp_type = raw_record.get("Extent Competed")
        if comp_type:
            g.add((award_uri, DP.competitionType, Literal(comp_type)))

        set_aside = raw_record.get("Type of Set Aside")
        if set_aside:
            g.add((award_uri, DP.setAsideType, Literal(set_aside)))

        # Fiscal year — derive from start date
        fy = _fiscal_year_from_date(raw_record.get("Start Date"))
        if fy:
            g.add((award_uri, DP.fiscalYear, Literal(fy, datatype=XSD.gYear)))

        # Capabilities
        if capabilities:
            for cap_uri_str in capabilities:
                cap_uri = URIRef(cap_uri_str)
                g.add((award_uri, DP.requiresCapability, cap_uri))
                # Also assert the contractor has this capability
                if contractor_uri:
                    g.add((contractor_uri, DP.hasCapability, cap_uri))

        return g

    def transform_batch(
        self,
        records: list[dict],
        capabilities: list[list[str]] | None = None,
    ) -> Graph:
        """Transform a batch of records into a single RDF graph."""
        combined = self._init_graph()

        for i, record in enumerate(records):
            caps = capabilities[i] if capabilities and i < len(capabilities) else None
            award_graph = self.transform_award(record, caps)
            for triple in award_graph:
                combined.add(triple)

            if (i + 1) % 100 == 0:
                logger.info("Transformed %d/%d records (%d triples)",
                            i + 1, len(records), len(combined))

        logger.info("Transformation complete: %d records → %d triples",
                     len(records), len(combined))
        return combined

    @staticmethod
    def serialize(graph: Graph, format: str = "turtle") -> str:
        return graph.serialize(format=format)

    @staticmethod
    def save(graph: Graph, filepath: str | Path, format: str = "turtle") -> None:
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        graph.serialize(destination=str(path), format=format)
        logger.info("Saved %d triples to %s", len(graph), path)
