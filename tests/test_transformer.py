"""Tests for the RDF transformer — verifies correct triple generation."""

import unittest
from decimal import Decimal

from rdflib import Graph, Literal, Namespace, URIRef, RDF, RDFS, XSD

from etl.rdf_transformer import (
    RDFTransformer,
    _sanitize_uri,
    _slugify,
    _parse_date,
    _parse_decimal,
    _fiscal_year_from_date,
)

DP = Namespace("http://defenseprocurement.io/ontology#")
DATA = Namespace("http://defenseprocurement.io/data#")

SAMPLE_RECORD = {
    "Award ID": "W31P4Q-20-C-0001",
    "Recipient Name": "Northrop Grumman Systems Corp.",
    "Recipient UEI": "JB7MVJ3U79N1",
    "Award Amount": 15000000.00,
    "Total Obligated Amount": 12500000.00,
    "Description": "Electronic warfare system development and testing",
    "Start Date": "2024-01-15",
    "End Date": "2026-01-14",
    "Awarding Agency": "Department of Defense",
    "Awarding Sub Agency": "Defense Advanced Research Projects Agency",
    "Funding Agency": "Department of Defense",
    "NAICS Code": "541715",
    "NAICS Description": "R&D in Physical, Engineering, and Life Sciences",
    "PSC Code": "R425",
    "PSC Description": "Electronics R&D",
    "Place of Performance State Code": "VA",
    "Place of Performance Congressional District": "08",
    "Type of Contract Pricing": "Fixed Price",
    "Type of Set Aside": None,
    "Extent Competed": "Full and Open Competition",
    "Contract Award Type": "Definitive Contract",
}

# Contractors are keyed by normalized name slug, not UEI, so divisions merge.
SAMPLE_CONTRACTOR_URI = DATA["contractor_northrop_grumman_systems_corp"]


class TestURIHelpers(unittest.TestCase):
    def test_sanitize_uri_removes_spaces(self):
        self.assertEqual(_sanitize_uri("hello world"), "hello_world")

    def test_sanitize_uri_removes_special_chars(self):
        self.assertEqual(_sanitize_uri("W31P4Q-20-C-0001"), "W31P4Q-20-C-0001")

    def test_sanitize_uri_collapses_underscores(self):
        result = _sanitize_uri("hello   world!!!")
        self.assertNotIn("__", result)

    def test_slugify(self):
        self.assertEqual(_slugify("Department of Defense"), "department_of_defense")

    def test_slugify_special_chars(self):
        self.assertEqual(_slugify("Navy (USN)"), "navy_usn")


class TestDateParsing(unittest.TestCase):
    def test_iso_format(self):
        self.assertEqual(_parse_date("2024-01-15"), "2024-01-15")

    def test_iso_with_time(self):
        self.assertEqual(_parse_date("2024-01-15T10:30:00"), "2024-01-15")

    def test_slash_format(self):
        self.assertEqual(_parse_date("01/15/2024"), "2024-01-15")

    def test_none(self):
        self.assertIsNone(_parse_date(None))

    def test_empty(self):
        self.assertIsNone(_parse_date(""))

    def test_invalid(self):
        self.assertIsNone(_parse_date("not-a-date"))


class TestDecimalParsing(unittest.TestCase):
    def test_float(self):
        self.assertEqual(_parse_decimal(15000000.00), Decimal("15000000.00"))

    def test_string_with_commas(self):
        self.assertEqual(_parse_decimal("15,000,000.00"), Decimal("15000000.00"))

    def test_string_with_dollar(self):
        self.assertEqual(_parse_decimal("$1,500.00"), Decimal("1500.00"))

    def test_none(self):
        self.assertIsNone(_parse_decimal(None))

    def test_invalid(self):
        self.assertIsNone(_parse_decimal("not-a-number"))


class TestFiscalYear(unittest.TestCase):
    def test_fy_jan_is_same_year(self):
        self.assertEqual(_fiscal_year_from_date("2024-01-15"), "2024")

    def test_fy_oct_is_next_year(self):
        self.assertEqual(_fiscal_year_from_date("2023-10-01"), "2024")

    def test_fy_sept_is_same_year(self):
        self.assertEqual(_fiscal_year_from_date("2024-09-30"), "2024")

    def test_none(self):
        self.assertIsNone(_fiscal_year_from_date(None))


class TestTransformAward(unittest.TestCase):
    def setUp(self):
        self.transformer = RDFTransformer()

    def test_basic_transform(self):
        g = self.transformer.transform_award(SAMPLE_RECORD)
        self.assertGreater(len(g), 0)

    def test_award_type_asserted(self):
        g = self.transformer.transform_award(SAMPLE_RECORD)
        award_uri = DATA["award_W31P4Q-20-C-0001"]
        self.assertIn((award_uri, RDF.type, DP.ContractAward), g)

    def test_contractor_created(self):
        g = self.transformer.transform_award(SAMPLE_RECORD)
        contractor_uri = SAMPLE_CONTRACTOR_URI
        self.assertIn((contractor_uri, RDF.type, DP.Contractor), g)
        self.assertIn((contractor_uri, DP.ueiNumber, Literal("JB7MVJ3U79N1")), g)

    def test_award_linked_to_contractor(self):
        g = self.transformer.transform_award(SAMPLE_RECORD)
        award_uri = DATA["award_W31P4Q-20-C-0001"]
        contractor_uri = SAMPLE_CONTRACTOR_URI
        self.assertIn((award_uri, DP.awardedTo, contractor_uri), g)

    def test_agency_created(self):
        g = self.transformer.transform_award(SAMPLE_RECORD)
        agency_uri = DATA["agency_department_of_defense"]
        self.assertIn((agency_uri, RDF.type, DP.GovernmentAgency), g)

    def test_sub_agency_created_with_parent(self):
        g = self.transformer.transform_award(SAMPLE_RECORD)
        sub_uri = DATA["agency_defense_advanced_research_projects_agency"]
        parent_uri = DATA["agency_department_of_defense"]
        self.assertIn((sub_uri, RDF.type, DP.GovernmentAgency), g)
        self.assertIn((sub_uri, DP.parentAgency, parent_uri), g)

    def test_location_created(self):
        g = self.transformer.transform_award(SAMPLE_RECORD)
        loc_uri = DATA["location_VA_08"]
        self.assertIn((loc_uri, RDF.type, DP.PlaceOfPerformance), g)
        self.assertIn((loc_uri, DP.stateCode, Literal("VA")), g)

    def test_amounts_as_decimal(self):
        g = self.transformer.transform_award(SAMPLE_RECORD)
        award_uri = DATA["award_W31P4Q-20-C-0001"]
        obligated = Literal(Decimal("12500000.0"), datatype=XSD.decimal)
        self.assertIn((award_uri, DP.obligatedAmount, obligated), g)

    def test_dates_as_xsd_date(self):
        g = self.transformer.transform_award(SAMPLE_RECORD)
        award_uri = DATA["award_W31P4Q-20-C-0001"]
        self.assertIn((award_uri, DP.awardDate, Literal("2024-01-15", datatype=XSD.date)), g)
        self.assertIn((award_uri, DP.completionDate, Literal("2026-01-14", datatype=XSD.date)), g)

    def test_fiscal_year_derived(self):
        g = self.transformer.transform_award(SAMPLE_RECORD)
        award_uri = DATA["award_W31P4Q-20-C-0001"]
        self.assertIn((award_uri, DP.fiscalYear, Literal("2024", datatype=XSD.gYear)), g)

    def test_naics_created(self):
        g = self.transformer.transform_award(SAMPLE_RECORD)
        naics_uri = DATA["naics_541715"]
        self.assertIn((naics_uri, RDF.type, DP.NAICSCode), g)

    def test_psc_created(self):
        g = self.transformer.transform_award(SAMPLE_RECORD)
        psc_uri = DATA["psc_R425"]
        self.assertIn((psc_uri, RDF.type, DP.PSCCode), g)

    def test_capabilities_linked(self):
        caps = [
            "http://defenseprocurement.io/ontology#ElectronicWarfare",
            "http://defenseprocurement.io/ontology#C4ISR",
        ]
        g = self.transformer.transform_award(SAMPLE_RECORD, capabilities=caps)
        award_uri = DATA["award_W31P4Q-20-C-0001"]
        self.assertIn((award_uri, DP.requiresCapability, DP.ElectronicWarfare), g)
        self.assertIn((award_uri, DP.requiresCapability, DP.C4ISR), g)

    def test_contractor_gets_capabilities(self):
        caps = ["http://defenseprocurement.io/ontology#ElectronicWarfare"]
        g = self.transformer.transform_award(SAMPLE_RECORD, capabilities=caps)
        contractor_uri = SAMPLE_CONTRACTOR_URI
        self.assertIn((contractor_uri, DP.hasCapability, DP.ElectronicWarfare), g)

    def test_missing_award_id_returns_empty(self):
        record = {k: v for k, v in SAMPLE_RECORD.items() if k != "Award ID"}
        g = self.transformer.transform_award(record)
        self.assertEqual(len(g), 0)

    def test_null_fields_skipped(self):
        record = {
            "Award ID": "TEST-001",
            "Recipient Name": "Test Corp",
            "Recipient UEI": None,
            "Award Amount": None,
            "Description": None,
            "Start Date": None,
            "End Date": None,
            "Awarding Agency": None,
            "NAICS Code": None,
            "PSC Code": None,
            "Place of Performance State Code": None,
        }
        g = self.transformer.transform_award(record)
        # Should still create the award and contractor, just with fewer triples
        award_uri = DATA["award_TEST-001"]
        self.assertIn((award_uri, RDF.type, DP.ContractAward), g)


class TestTransformBatch(unittest.TestCase):
    def test_batch_transform(self):
        records = [
            {**SAMPLE_RECORD, "Award ID": f"AWD-{i}", "Recipient UEI": f"UEI{i:04d}"}
            for i in range(5)
        ]
        caps = [["http://defenseprocurement.io/ontology#AIandML"]] * 5
        transformer = RDFTransformer()
        g = transformer.transform_batch(records, caps)
        self.assertGreater(len(g), 50)

    def test_deduplication(self):
        """Same contractor in multiple records should not duplicate."""
        records = [
            {**SAMPLE_RECORD, "Award ID": "AWD-1"},
            {**SAMPLE_RECORD, "Award ID": "AWD-2"},
        ]
        transformer = RDFTransformer()
        g = transformer.transform_batch(records)
        # Count how many times the contractor type triple appears
        contractor_uri = SAMPLE_CONTRACTOR_URI
        type_triples = list(g.triples((contractor_uri, RDF.type, DP.Contractor)))
        self.assertEqual(len(type_triples), 1, "Contractor should appear only once")


class TestSerialize(unittest.TestCase):
    def test_serialize_turtle(self):
        transformer = RDFTransformer()
        g = transformer.transform_award(SAMPLE_RECORD)
        ttl = transformer.serialize(g, format="turtle")
        self.assertIn("ContractAward", ttl)

    def test_serialize_ntriples(self):
        transformer = RDFTransformer()
        g = transformer.transform_award(SAMPLE_RECORD)
        nt = transformer.serialize(g, format="nt")
        self.assertIn("defenseprocurement.io", nt)


if __name__ == "__main__":
    unittest.main()
