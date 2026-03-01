"""Test ontology consistency — validates defense-procurement.ttl loads correctly
and all classes, properties, and axioms are present."""

import unittest
from pathlib import Path

from rdflib import Graph, Namespace, URIRef, Literal, RDF, RDFS, OWL, XSD

DP = Namespace("http://defenseprocurement.io/ontology#")
OBO = Namespace("http://purl.obolibrary.org/obo/")
CCO = Namespace("http://www.ontologyrepository.com/CommonCoreOntologies/")
DATA = Namespace("http://defenseprocurement.io/data#")

ONTOLOGY_PATH = Path(__file__).parent.parent / "ontology" / "defense-procurement.ttl"
CAPABILITY_TAXONOMY_PATH = Path(__file__).parent.parent / "ontology" / "capability-taxonomy.ttl"
NAICS_MAPPING_PATH = Path(__file__).parent.parent / "ontology" / "naics-psc-mapping.ttl"


class TestOntologyLoads(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = Graph()
        cls.g.parse(str(ONTOLOGY_PATH), format="turtle")

    def test_loads_without_error(self):
        self.assertGreater(len(self.g), 0)

    def test_has_ontology_declaration(self):
        onto_uri = URIRef("http://defenseprocurement.io/ontology")
        self.assertIn((onto_uri, RDF.type, OWL.Ontology), self.g)


class TestCoreClasses(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = Graph()
        cls.g.parse(str(ONTOLOGY_PATH), format="turtle")

    def test_contractor_classes_exist(self):
        for cls_name in ["Contractor", "PrimeContractor", "Subcontractor", "SmallBusiness"]:
            uri = DP[cls_name]
            self.assertIn((uri, RDF.type, OWL.Class), self.g, f"Missing class: dp:{cls_name}")

    def test_government_agency_classes_exist(self):
        for cls_name in ["GovernmentAgency", "ContractingOffice", "ProgramOffice"]:
            uri = DP[cls_name]
            self.assertIn((uri, RDF.type, OWL.Class), self.g, f"Missing class: dp:{cls_name}")

    def test_capability_classes_exist(self):
        capabilities = [
            "TechnicalCapability", "ElectronicWarfare", "C4ISR",
            "AutonomousSystems", "CyberSecurity", "SpaceSystems",
            "AIandML", "MissileDefense", "Logistics",
            "TrainingSimulation", "Hypersonics", "DirectedEnergy",
            "QuantumTechnology", "Biotechnology",
        ]
        for cls_name in capabilities:
            uri = DP[cls_name]
            self.assertIn((uri, RDF.type, OWL.Class), self.g, f"Missing class: dp:{cls_name}")

    def test_process_classes_exist(self):
        for cls_name in ["ContractAward", "ContractModification", "CompetitionProcess"]:
            uri = DP[cls_name]
            self.assertIn((uri, RDF.type, OWL.Class), self.g, f"Missing class: dp:{cls_name}")

    def test_information_classes_exist(self):
        for cls_name in ["ContractDocument", "SBIRAward", "CapabilityStatement"]:
            uri = DP[cls_name]
            self.assertIn((uri, RDF.type, OWL.Class), self.g, f"Missing class: dp:{cls_name}")

    def test_classification_classes_exist(self):
        for cls_name in ["NAICSCode", "PSCCode", "SetAsideType", "CompetitionType"]:
            uri = DP[cls_name]
            self.assertIn((uri, RDF.type, OWL.Class), self.g, f"Missing class: dp:{cls_name}")

    def test_place_of_performance_exists(self):
        self.assertIn((DP.PlaceOfPerformance, RDF.type, OWL.Class), self.g)

    def test_program_exists(self):
        self.assertIn((DP.Program, RDF.type, OWL.Class), self.g)


class TestSubclassHierarchy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = Graph()
        cls.g.parse(str(ONTOLOGY_PATH), format="turtle")

    def test_contractor_subclass_of_organization(self):
        self.assertIn((DP.Contractor, RDFS.subClassOf, CCO.Organization), self.g)

    def test_prime_subclass_of_contractor(self):
        self.assertIn((DP.PrimeContractor, RDFS.subClassOf, DP.Contractor), self.g)

    def test_sub_subclass_of_contractor(self):
        self.assertIn((DP.Subcontractor, RDFS.subClassOf, DP.Contractor), self.g)

    def test_government_agency_subclass_of_organization(self):
        self.assertIn((DP.GovernmentAgency, RDFS.subClassOf, CCO.Organization), self.g)

    def test_capability_subclass_of_disposition(self):
        self.assertIn((DP.TechnicalCapability, RDFS.subClassOf, OBO.BFO_0000016), self.g)

    def test_all_capabilities_subclass_of_technical_capability(self):
        caps = [
            "ElectronicWarfare", "C4ISR", "AutonomousSystems", "CyberSecurity",
            "SpaceSystems", "AIandML", "MissileDefense", "Logistics",
            "TrainingSimulation", "Hypersonics", "DirectedEnergy",
            "QuantumTechnology", "Biotechnology",
        ]
        for cap in caps:
            self.assertIn(
                (DP[cap], RDFS.subClassOf, DP.TechnicalCapability), self.g,
                f"dp:{cap} not subclass of dp:TechnicalCapability"
            )

    def test_contract_award_subclass_of_process(self):
        self.assertIn((DP.ContractAward, RDFS.subClassOf, OBO.BFO_0000015), self.g)

    def test_place_of_performance_subclass_of_site(self):
        self.assertIn((DP.PlaceOfPerformance, RDFS.subClassOf, OBO.BFO_0000029), self.g)


class TestObjectProperties(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = Graph()
        cls.g.parse(str(ONTOLOGY_PATH), format="turtle")

    def _assert_property(self, prop, domain, range_):
        self.assertIn((prop, RDF.type, OWL.ObjectProperty), self.g, f"Missing property: {prop}")
        self.assertIn((prop, RDFS.domain, domain), self.g, f"Wrong domain for {prop}")
        self.assertIn((prop, RDFS.range, range_), self.g, f"Wrong range for {prop}")

    def test_awarded_to(self):
        self._assert_property(DP.awardedTo, DP.ContractAward, DP.Contractor)

    def test_awarded_by(self):
        self._assert_property(DP.awardedBy, DP.ContractAward, DP.GovernmentAgency)

    def test_has_subcontractor(self):
        self._assert_property(DP.hasSubcontractor, DP.PrimeContractor, DP.Subcontractor)

    def test_performed_at(self):
        self._assert_property(DP.performedAt, DP.ContractAward, DP.PlaceOfPerformance)

    def test_has_capability(self):
        self._assert_property(DP.hasCapability, DP.Contractor, DP.TechnicalCapability)

    def test_requires_capability(self):
        self._assert_property(DP.requiresCapability, DP.ContractAward, DP.TechnicalCapability)

    def test_demonstrates_capability(self):
        self._assert_property(DP.demonstratesCapability, DP.SBIRAward, DP.TechnicalCapability)

    def test_classified_as(self):
        self._assert_property(DP.classifiedAs, DP.ContractAward, DP.NAICSCode)

    def test_has_psc_code(self):
        self._assert_property(DP.hasPSCCode, DP.ContractAward, DP.PSCCode)

    def test_modifies(self):
        self._assert_property(DP.modifies, DP.ContractModification, DP.ContractAward)

    def test_funded_under(self):
        self._assert_property(DP.fundedUnder, DP.ContractAward, DP.Program)

    def test_parent_agency(self):
        self._assert_property(DP.parentAgency, DP.GovernmentAgency, DP.GovernmentAgency)

    def test_has_subcontractor_inverse(self):
        self.assertIn((DP.hasSubcontractor, OWL.inverseOf, DP.subcontractorOf), self.g)

    def test_in_supply_chain_transitive(self):
        self.assertIn((DP.inSupplyChainOf, RDF.type, OWL.TransitiveProperty), self.g)

    def test_teams_with_symmetric(self):
        self.assertIn((DP.teamsWithOn, RDF.type, OWL.SymmetricProperty), self.g)


class TestDataProperties(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = Graph()
        cls.g.parse(str(ONTOLOGY_PATH), format="turtle")

    def _assert_data_property(self, prop, domain, range_):
        self.assertIn((prop, RDF.type, OWL.DatatypeProperty), self.g, f"Missing: {prop}")
        self.assertIn((prop, RDFS.domain, domain), self.g, f"Wrong domain: {prop}")
        self.assertIn((prop, RDFS.range, range_), self.g, f"Wrong range: {prop}")

    def test_contract_number(self):
        self._assert_data_property(DP.contractNumber, DP.ContractAward, XSD.string)

    def test_cage_code(self):
        self._assert_data_property(DP.cageCode, DP.Contractor, XSD.string)

    def test_uei_number(self):
        self._assert_data_property(DP.ueiNumber, DP.Contractor, XSD.string)

    def test_is_small_business(self):
        self._assert_data_property(DP.isSmallBusiness, DP.Contractor, XSD.boolean)

    def test_obligated_amount(self):
        self._assert_data_property(DP.obligatedAmount, DP.ContractAward, XSD.decimal)

    def test_award_date(self):
        self._assert_data_property(DP.awardDate, DP.ContractAward, XSD.date)

    def test_fiscal_year(self):
        self._assert_data_property(DP.fiscalYear, DP.ContractAward, XSD.gYear)

    def test_state_code(self):
        self._assert_data_property(DP.stateCode, DP.PlaceOfPerformance, XSD.string)


class TestSampleIndividuals(unittest.TestCase):
    """Test that sample individuals can be created and typed correctly."""

    def test_create_sample_contractor(self):
        g = Graph()
        g.parse(str(ONTOLOGY_PATH), format="turtle")

        contractor = DATA["contractor_test123"]
        g.add((contractor, RDF.type, DP.Contractor))
        g.add((contractor, RDFS.label, Literal("Test Corp")))
        g.add((contractor, DP.ueiNumber, Literal("TEST123456")))
        g.add((contractor, DP.isSmallBusiness, Literal(True)))
        g.add((contractor, DP.cageCode, Literal("1A2B3")))

        self.assertIn((contractor, RDF.type, DP.Contractor), g)
        self.assertIn((contractor, DP.ueiNumber, Literal("TEST123456")), g)

    def test_create_sample_award(self):
        g = Graph()
        g.parse(str(ONTOLOGY_PATH), format="turtle")

        award = DATA["award_W31P4Q20C0001"]
        contractor = DATA["contractor_test123"]
        agency = DATA["agency_darpa"]

        g.add((award, RDF.type, DP.ContractAward))
        g.add((award, DP.awardedTo, contractor))
        g.add((award, DP.awardedBy, agency))
        g.add((award, DP.obligatedAmount, Literal(1500000, datatype=XSD.decimal)))
        g.add((award, DP.awardDate, Literal("2024-01-15", datatype=XSD.date)))
        g.add((award, DP.fiscalYear, Literal("2024", datatype=XSD.gYear)))

        self.assertIn((award, RDF.type, DP.ContractAward), g)
        self.assertIn((award, DP.awardedTo, contractor), g)

    def test_create_sample_capability(self):
        g = Graph()
        g.parse(str(ONTOLOGY_PATH), format="turtle")

        contractor = DATA["contractor_test123"]
        g.add((contractor, RDF.type, DP.Contractor))
        g.add((contractor, DP.hasCapability, DP.AIandML))
        g.add((contractor, DP.hasCapability, DP.CyberSecurity))

        caps = list(g.objects(contractor, DP.hasCapability))
        self.assertIn(DP.AIandML, caps)
        self.assertIn(DP.CyberSecurity, caps)

    def test_create_sample_place_of_performance(self):
        g = Graph()
        g.parse(str(ONTOLOGY_PATH), format="turtle")

        loc = DATA["location_VA_08"]
        g.add((loc, RDF.type, DP.PlaceOfPerformance))
        g.add((loc, DP.stateCode, Literal("VA")))
        g.add((loc, DP.congressionalDistrict, Literal("08")))

        self.assertIn((loc, RDF.type, DP.PlaceOfPerformance), g)


class TestCapabilityTaxonomy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = Graph()
        cls.g.parse(str(ONTOLOGY_PATH), format="turtle")
        cls.g.parse(str(CAPABILITY_TAXONOMY_PATH), format="turtle")

    def test_subcapabilities_loaded(self):
        subcaps = ["SIGINT", "ElectronicAttack", "ElectronicProtection",
                    "CommandAndControl", "ISR", "Communications",
                    "UnmannedAerialSystems", "UnmannedGroundSystems",
                    "UnmannedMaritimeSystems", "Robotics",
                    "ComputerVision", "NaturalLanguageProcessing", "PredictiveAnalytics"]
        for sc in subcaps:
            self.assertIn((DP[sc], RDF.type, OWL.Class), self.g, f"Missing: dp:{sc}")

    def test_sigint_subclass_of_ew(self):
        self.assertIn((DP.SIGINT, RDFS.subClassOf, DP.ElectronicWarfare), self.g)

    def test_uas_subclass_of_autonomous(self):
        self.assertIn((DP.UnmannedAerialSystems, RDFS.subClassOf, DP.AutonomousSystems), self.g)


class TestNAICSMapping(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = Graph()
        cls.g.parse(str(ONTOLOGY_PATH), format="turtle")
        cls.g.parse(str(NAICS_MAPPING_PATH), format="turtle")

    def test_psc_individuals_exist(self):
        pscs = ["psc_R4", "psc_AC", "psc_AA", "psc_AJ", "psc_D3", "psc_AG", "psc_U0"]
        for psc in pscs:
            self.assertIn((DATA[psc], RDF.type, DP.PSCCode), self.g, f"Missing: data:{psc}")

    def test_naics_individuals_exist(self):
        naics_codes = ["naics_541715", "naics_518210", "naics_334511",
                       "naics_336414", "naics_541512"]
        for nc in naics_codes:
            self.assertIn((DATA[nc], RDF.type, DP.NAICSCode), self.g, f"Missing: data:{nc}")


if __name__ == "__main__":
    unittest.main()
