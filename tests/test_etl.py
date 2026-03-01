"""Tests for USASpending API client — pagination, caching, retry, filters."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from etl.usaspending_client import AwardFilters, USASpendingClient


def make_response(results: list, has_next: bool = False, page: int = 1) -> dict:
    return {
        "results": results,
        "page_metadata": {
            "page": page,
            "hasNext": has_next,
            "total": len(results),
        },
    }


def make_award(award_id: str, name: str, amount: float) -> dict:
    return {
        "Award ID": award_id,
        "Recipient Name": name,
        "Award Amount": amount,
        "Description": "Test contract",
        "NAICS Code": "541715",
        "PSC Code": "R425",
    }


class TestAwardFilters(unittest.TestCase):
    def test_default_filters_include_contract_types(self):
        f = AwardFilters()
        d = f.to_dict()
        self.assertEqual(d["award_type_codes"], ["A", "B", "C", "D"])

    def test_agency_filter(self):
        f = AwardFilters(agencies=[{"type": "awarding", "tier": "toptier", "name": "DARPA"}])
        d = f.to_dict()
        self.assertEqual(d["agencies"][0]["name"], "DARPA")

    def test_time_period_filter(self):
        f = AwardFilters(time_period=[{"start_date": "2023-10-01", "end_date": "2024-09-30"}])
        d = f.to_dict()
        self.assertEqual(d["time_period"][0]["start_date"], "2023-10-01")

    def test_naics_filter(self):
        f = AwardFilters(naics_codes=["541715"])
        d = f.to_dict()
        self.assertEqual(d["naics_codes"], [{"naics_code": "541715"}])

    def test_combined_filters(self):
        f = AwardFilters(
            agencies=[{"type": "awarding", "tier": "toptier", "name": "Navy"}],
            time_period=[{"start_date": "2023-10-01", "end_date": "2024-09-30"}],
            naics_codes=["541715", "518210"],
        )
        d = f.to_dict()
        self.assertIn("agencies", d)
        self.assertIn("time_period", d)
        self.assertEqual(len(d["naics_codes"]), 2)


class TestUSASpendingClient(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.client = USASpendingClient(
            base_url="https://api.usaspending.gov/api/v2/",
            cache_dir=Path(self.tmp_dir),
            cache_ttl_hours=24,
            max_pages=5,
            rate_limit=100.0,  # Fast for tests
        )

    @patch.object(USASpendingClient, "_request")
    def test_search_awards_single_page(self, mock_req):
        awards = [make_award(f"AWD-{i}", f"Corp {i}", 1000 * i) for i in range(3)]
        mock_req.return_value = make_response(awards, has_next=False)

        result = self.client.search_awards(AwardFilters())
        self.assertEqual(len(result["results"]), 3)

    @patch.object(USASpendingClient, "_request")
    def test_search_awards_passes_fields(self, mock_req):
        mock_req.return_value = make_response([])
        custom_fields = ["Award ID", "Recipient Name"]
        self.client.search_awards(AwardFilters(), fields=custom_fields)

        call_payload = mock_req.call_args[0][1]
        self.assertEqual(call_payload["fields"], custom_fields)

    @patch.object(USASpendingClient, "search_awards")
    def test_auto_pagination(self, mock_search):
        page1 = make_response(
            [make_award(f"AWD-{i}", f"Corp {i}", 1000) for i in range(100)],
            has_next=True, page=1,
        )
        page2 = make_response(
            [make_award(f"AWD-{i}", f"Corp {i}", 1000) for i in range(100, 150)],
            has_next=False, page=2,
        )
        mock_search.side_effect = [page1, page2]

        results = self.client.search_awards_all(AwardFilters())
        self.assertEqual(len(results), 150)
        self.assertEqual(mock_search.call_count, 2)

    @patch.object(USASpendingClient, "search_awards")
    def test_max_records_limit(self, mock_search):
        page1 = make_response(
            [make_award(f"AWD-{i}", f"Corp {i}", 1000) for i in range(100)],
            has_next=True, page=1,
        )
        mock_search.return_value = page1

        results = self.client.search_awards_all(AwardFilters(), max_records=50)
        self.assertEqual(len(results), 50)

    @patch.object(USASpendingClient, "search_awards")
    def test_stops_on_empty_results(self, mock_search):
        mock_search.return_value = make_response([], has_next=False)
        results = self.client.search_awards_all(AwardFilters())
        self.assertEqual(len(results), 0)


class TestCaching(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.client = USASpendingClient(
            cache_dir=Path(self.tmp_dir),
            rate_limit=100.0,
        )

    def test_cache_write_and_read(self):
        key = self.client._cache_key("test", {"a": 1})
        data = {"results": [{"id": 1}]}
        self.client._set_cached(key, data)
        cached = self.client._get_cached(key)
        self.assertEqual(cached, data)

    def test_cache_miss_returns_none(self):
        cached = self.client._get_cached("nonexistent")
        self.assertIsNone(cached)

    def test_cache_key_deterministic(self):
        k1 = self.client._cache_key("ep", {"a": 1, "b": 2})
        k2 = self.client._cache_key("ep", {"b": 2, "a": 1})
        self.assertEqual(k1, k2)


class TestRetry(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.client = USASpendingClient(
            cache_dir=Path(self.tmp_dir),
            rate_limit=100.0,
        )

    @patch("etl.usaspending_client.time.sleep")
    def test_retries_on_500(self, mock_sleep):
        mock_resp_500 = MagicMock()
        mock_resp_500.status_code = 500
        mock_resp_500.raise_for_status = MagicMock(side_effect=Exception("500"))

        mock_resp_200 = MagicMock()
        mock_resp_200.status_code = 200
        mock_resp_200.json.return_value = {"results": []}

        self.client.session.post = MagicMock(side_effect=[mock_resp_500, mock_resp_200])
        result = self.client._request("test/", {}, retries=3, use_cache=False)
        self.assertEqual(result, {"results": []})
        self.assertEqual(self.client.session.post.call_count, 2)


class TestGetAgencyAwards(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.client = USASpendingClient(
            cache_dir=Path(self.tmp_dir),
            rate_limit=100.0,
        )

    @patch.object(USASpendingClient, "search_awards_all")
    def test_constructs_correct_filters(self, mock_search):
        mock_search.return_value = []
        self.client.get_agency_awards("Defense Advanced Research Projects Agency", 2024)

        call_filters = mock_search.call_args[0][0]
        self.assertEqual(call_filters.agencies[0]["name"], "Defense Advanced Research Projects Agency")
        self.assertEqual(call_filters.time_period[0]["start_date"], "2023-10-01")
        self.assertEqual(call_filters.time_period[0]["end_date"], "2024-09-30")


if __name__ == "__main__":
    unittest.main()
