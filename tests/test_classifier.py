"""Tests for the two-layer capability classifier."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from etl.capability_classifier import (
    CapabilityClassifier,
    classify_deterministic,
    _classify_by_keywords,
    _classify_by_naics,
    _classify_by_psc,
)
from etl.config import DP_NAMESPACE

DP = DP_NAMESPACE


class TestPSCMapping(unittest.TestCase):
    def test_r4_maps_to_ew_and_c4isr(self):
        result = _classify_by_psc("R425")
        self.assertIn(f"{DP}ElectronicWarfare", result)
        self.assertIn(f"{DP}C4ISR", result)

    def test_ac_maps_to_ew(self):
        result = _classify_by_psc("AC11")
        self.assertIn(f"{DP}ElectronicWarfare", result)

    def test_aa_maps_to_missile_and_hypersonic(self):
        result = _classify_by_psc("AA97")
        self.assertIn(f"{DP}MissileDefense", result)
        self.assertIn(f"{DP}Hypersonics", result)

    def test_aj_maps_to_autonomous(self):
        result = _classify_by_psc("AJ12")
        self.assertIn(f"{DP}AutonomousSystems", result)

    def test_d3_maps_to_cyber(self):
        result = _classify_by_psc("D399")
        self.assertIn(f"{DP}CyberSecurity", result)

    def test_unknown_psc_returns_empty(self):
        result = _classify_by_psc("ZZ99")
        self.assertEqual(result, [])

    def test_none_psc_returns_empty(self):
        result = _classify_by_psc(None)
        self.assertEqual(result, [])


class TestNAICSMapping(unittest.TestCase):
    def test_518210_maps_to_cyber_c4isr(self):
        result = _classify_by_naics("518210")
        self.assertIn(f"{DP}CyberSecurity", result)
        self.assertIn(f"{DP}C4ISR", result)

    def test_334511_maps_to_space_c4isr(self):
        result = _classify_by_naics("334511")
        self.assertIn(f"{DP}SpaceSystems", result)

    def test_336414_maps_to_missile_space_hyper(self):
        result = _classify_by_naics("336414")
        self.assertIn(f"{DP}MissileDefense", result)
        self.assertIn(f"{DP}SpaceSystems", result)
        self.assertIn(f"{DP}Hypersonics", result)

    def test_unknown_naics_returns_empty(self):
        result = _classify_by_naics("999999")
        self.assertEqual(result, [])


class TestKeywordPatterns(unittest.TestCase):
    def test_ew_keywords(self):
        result = _classify_by_keywords("Electronic warfare support system with SIGINT capability")
        self.assertIn(f"{DP}ElectronicWarfare", result)

    def test_ai_ml_keywords(self):
        result = _classify_by_keywords("Development of machine learning models for target recognition")
        self.assertIn(f"{DP}AIandML", result)

    def test_autonomous_keywords(self):
        result = _classify_by_keywords("Unmanned aerial system (UAS) development and testing")
        self.assertIn(f"{DP}AutonomousSystems", result)

    def test_cyber_keywords(self):
        result = _classify_by_keywords("Zero trust architecture implementation for network security")
        self.assertIn(f"{DP}CyberSecurity", result)

    def test_hypersonic_keywords(self):
        result = _classify_by_keywords("Hypersonic boost glide vehicle thermal protection")
        self.assertIn(f"{DP}Hypersonics", result)

    def test_directed_energy_keywords(self):
        result = _classify_by_keywords("High energy laser weapon system integration")
        self.assertIn(f"{DP}DirectedEnergy", result)

    def test_quantum_keywords(self):
        result = _classify_by_keywords("Post-quantum cryptography research and quantum sensing")
        self.assertIn(f"{DP}QuantumTechnology", result)

    def test_space_keywords(self):
        result = _classify_by_keywords("GPS satellite constellation modernization")
        self.assertIn(f"{DP}SpaceSystems", result)

    def test_missile_defense_keywords(self):
        result = _classify_by_keywords("THAAD interceptor system upgrade and integration")
        self.assertIn(f"{DP}MissileDefense", result)

    def test_logistics_keywords(self):
        result = _classify_by_keywords("Supply chain management and depot maintenance services")
        self.assertIn(f"{DP}Logistics", result)

    def test_training_keywords(self):
        result = _classify_by_keywords("Flight simulator development with virtual reality integration")
        self.assertIn(f"{DP}TrainingSimulation", result)

    def test_biotech_keywords(self):
        result = _classify_by_keywords("Biosurveillance system for CBRN threat detection")
        self.assertIn(f"{DP}Biotechnology", result)

    def test_multiple_capabilities(self):
        result = _classify_by_keywords(
            "AI/ML-powered autonomous drone system with cyber security features"
        )
        self.assertIn(f"{DP}AIandML", result)
        self.assertIn(f"{DP}AutonomousSystems", result)
        self.assertIn(f"{DP}CyberSecurity", result)

    def test_empty_description(self):
        result = _classify_by_keywords("")
        self.assertEqual(result, [])

    def test_none_description(self):
        result = _classify_by_keywords(None)
        self.assertEqual(result, [])


class TestDeterministicClassify(unittest.TestCase):
    def test_combines_all_layers(self):
        result = classify_deterministic(
            description="Electronic warfare system development",
            naics_code="518210",
            psc_code="R425",
        )
        self.assertIn(f"{DP}ElectronicWarfare", result)
        self.assertIn(f"{DP}CyberSecurity", result)
        self.assertIn(f"{DP}C4ISR", result)

    def test_deduplicates(self):
        result = classify_deterministic(
            description="Cyber security assessment",
            naics_code="518210",  # Also maps to CyberSecurity
            psc_code="D399",     # Also maps to CyberSecurity
        )
        count = result.count(f"{DP}CyberSecurity")
        self.assertEqual(count, 1, "CyberSecurity should appear only once")

    def test_all_none_returns_empty(self):
        result = classify_deterministic(None, None, None)
        self.assertEqual(result, [])


class TestCapabilityClassifier(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.classifier = CapabilityClassifier(
            api_key="",
            cache_dir=Path(self.tmp_dir),
            use_llm=False,
        )

    def test_deterministic_only(self):
        result = self.classifier.classify(
            description="Artificial intelligence for drone autonomy",
            naics_code="541512",
            psc_code="AJ12",
        )
        self.assertIn(f"{DP}AIandML", result)
        self.assertIn(f"{DP}AutonomousSystems", result)

    def test_batch_classification(self):
        records = [
            {"Description": "EW system", "NAICS Code": None, "PSC Code": "R425"},
            {"Description": "AI research", "NAICS Code": "541512", "PSC Code": None},
            {"Description": "Office supplies", "NAICS Code": "453210", "PSC Code": "7510"},
        ]
        results = self.classifier.classify_batch(records)
        self.assertEqual(len(results), 3)
        self.assertTrue(len(results[0]) > 0)  # EW should classify
        self.assertTrue(len(results[1]) > 0)  # AI should classify
        # Office supplies might not classify at all
        self.assertIsInstance(results[2], list)


class TestLLMClassifier(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()

    @patch("etl.capability_classifier.CapabilityClassifier._get_client")
    def test_llm_fallback_on_empty_deterministic(self, mock_get_client):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='{"capabilities": ["dp:AIandML"], "confidence": 0.9}')]
        mock_client.messages.create.return_value = mock_response
        mock_get_client.return_value = mock_client

        classifier = CapabilityClassifier(
            api_key="test-key",
            cache_dir=Path(self.tmp_dir),
            use_llm=True,
        )
        result = classifier.classify(
            description="Advanced neural network research for defense applications",
            naics_code="541715",  # Broad R&D code with no direct mapping
            psc_code="AZ11",     # Unknown PSC
        )
        self.assertIn(f"{DP}AIandML", result)

    def test_llm_cache_hit(self):
        classifier = CapabilityClassifier(
            api_key="test-key",
            cache_dir=Path(self.tmp_dir),
            use_llm=True,
        )
        # Pre-populate cache
        key = classifier._llm_cache_key("test desc", "541715", "AZ11")
        classifier._set_llm_cached(key, [f"{DP}AIandML"])

        cached = classifier._get_llm_cached(key)
        self.assertEqual(cached, [f"{DP}AIandML"])


if __name__ == "__main__":
    unittest.main()
