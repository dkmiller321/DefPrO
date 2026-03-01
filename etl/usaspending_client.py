"""USASpending.gov API client with pagination, rate limiting, caching, and retry."""

import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import requests

from etl.config import (
    DEFAULT_AWARD_FIELDS,
    USASPENDING_BASE_URL,
    USASPENDING_CACHE_DIR,
    USASPENDING_CACHE_TTL_HOURS,
    USASPENDING_MAX_PAGES,
    USASPENDING_PAGE_SIZE,
    USASPENDING_RATE_LIMIT,
)

logger = logging.getLogger(__name__)


@dataclass
class AwardFilters:
    """Filters for USASpending award search."""
    agencies: list[dict[str, str]] = field(default_factory=list)
    time_period: list[dict[str, str]] = field(default_factory=list)
    award_type_codes: list[str] = field(default_factory=list)
    naics_codes: list[str] = field(default_factory=list)
    psc_codes: list[str] = field(default_factory=list)
    recipient_search_text: list[str] = field(default_factory=list)
    award_amounts: list[dict[str, int]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        filters: dict[str, Any] = {}
        if self.agencies:
            filters["agencies"] = self.agencies
        if self.time_period:
            filters["time_period"] = self.time_period
        if self.award_type_codes:
            filters["award_type_codes"] = self.award_type_codes
        else:
            # Default to contracts only
            filters["award_type_codes"] = ["A", "B", "C", "D"]
        if self.naics_codes:
            filters["naics_codes"] = [{"naics_code": c} for c in self.naics_codes]
        if self.psc_codes:
            filters["psc_codes"] = [{"psc_code": c} for c in self.psc_codes]
        if self.recipient_search_text:
            filters["recipient_search_text"] = self.recipient_search_text
        if self.award_amounts:
            filters["award_amounts"] = self.award_amounts
        return filters


class USASpendingClient:
    """Client for the USASpending.gov API v2."""

    def __init__(
        self,
        base_url: str = USASPENDING_BASE_URL,
        cache_dir: Path = USASPENDING_CACHE_DIR,
        cache_ttl_hours: int = USASPENDING_CACHE_TTL_HOURS,
        max_pages: int = USASPENDING_MAX_PAGES,
        rate_limit: float = USASPENDING_RATE_LIMIT,
    ):
        self.base_url = base_url.rstrip("/")
        self.cache_dir = Path(cache_dir)
        self.cache_ttl_hours = cache_ttl_hours
        self.max_pages = max_pages
        self.min_request_interval = 1.0 / rate_limit
        self._last_request_time = 0.0
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json",
        })

    def _rate_limit(self) -> None:
        elapsed = time.time() - self._last_request_time
        if elapsed < self.min_request_interval:
            time.sleep(self.min_request_interval - elapsed)
        self._last_request_time = time.time()

    def _cache_key(self, endpoint: str, payload: dict) -> str:
        content = json.dumps({"endpoint": endpoint, "payload": payload}, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()

    def _get_cached(self, cache_key: str) -> dict | None:
        cache_file = self.cache_dir / f"{cache_key}.json"
        if not cache_file.exists():
            return None
        age_hours = (time.time() - cache_file.stat().st_mtime) / 3600
        if age_hours > self.cache_ttl_hours:
            cache_file.unlink()
            return None
        try:
            return json.loads(cache_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    def _set_cached(self, cache_key: str, data: dict) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file = self.cache_dir / f"{cache_key}.json"
        cache_file.write_text(json.dumps(data), encoding="utf-8")

    def _request(
        self,
        endpoint: str,
        payload: dict,
        retries: int = 3,
        use_cache: bool = True,
    ) -> dict:
        cache_key = self._cache_key(endpoint, payload)
        if use_cache:
            cached = self._get_cached(cache_key)
            if cached is not None:
                logger.debug("Cache hit for %s", endpoint)
                return cached

        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        last_error: Exception | None = None

        for attempt in range(retries):
            self._rate_limit()
            try:
                resp = self.session.post(url, json=payload, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    if use_cache:
                        self._set_cached(cache_key, data)
                    return data
                if resp.status_code >= 500:
                    last_error = requests.HTTPError(
                        f"Server error {resp.status_code}", response=resp
                    )
                    wait = (2 ** attempt) + 1
                    logger.warning(
                        "Server error %d on %s, retry %d/%d in %ds",
                        resp.status_code, endpoint, attempt + 1, retries, wait,
                    )
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
            except requests.ConnectionError as e:
                last_error = e
                wait = (2 ** attempt) + 1
                logger.warning(
                    "Connection error on %s, retry %d/%d in %ds",
                    endpoint, attempt + 1, retries, wait,
                )
                time.sleep(wait)

        raise last_error or RuntimeError(f"Request to {endpoint} failed after {retries} retries")

    def search_awards(
        self,
        filters: AwardFilters | dict,
        fields: list[str] | None = None,
        limit: int = USASPENDING_PAGE_SIZE,
        page: int = 1,
    ) -> dict:
        """Search awards with given filters. Returns a single page of results."""
        if isinstance(filters, AwardFilters):
            filter_dict = filters.to_dict()
        else:
            filter_dict = filters

        payload = {
            "filters": filter_dict,
            "fields": fields or DEFAULT_AWARD_FIELDS,
            "limit": min(limit, USASPENDING_PAGE_SIZE),
            "page": page,
            "order": "desc",
            "sort": "Award Amount",
        }
        return self._request("search/spending_by_award/", payload)

    def search_awards_all(
        self,
        filters: AwardFilters | dict,
        fields: list[str] | None = None,
        max_records: int | None = None,
    ) -> list[dict]:
        """Auto-paginate through all award results."""
        all_results: list[dict] = []
        page = 1

        while page <= self.max_pages:
            logger.info("Fetching page %d...", page)
            resp = self.search_awards(filters, fields, limit=USASPENDING_PAGE_SIZE, page=page)
            results = resp.get("results", [])
            if not results:
                break

            all_results.extend(results)

            if max_records and len(all_results) >= max_records:
                all_results = all_results[:max_records]
                break

            has_next = resp.get("page_metadata", {}).get("hasNext", False)
            if not has_next:
                break

            page += 1

        logger.info("Retrieved %d total records", len(all_results))
        return all_results

    def get_award_detail(self, award_id: str) -> dict:
        """Get detailed information for a single award."""
        # The award detail endpoint is a GET, but we use POST with generated_unique_award_id
        url = f"{self.base_url}/awards/{award_id}/"
        self._rate_limit()
        resp = self.session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def get_recipient(self, recipient_id: str) -> dict:
        """Get recipient/contractor details by UEI or recipient hash."""
        url = f"{self.base_url}/recipient/{recipient_id}/"
        self._rate_limit()
        resp = self.session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def get_agency_awards(
        self,
        agency_name: str,
        fiscal_year: int,
        max_records: int | None = None,
    ) -> list[dict]:
        """Get all contract awards for a specific agency and fiscal year.

        Automatically tries subtier first (for agencies like DARPA, MDA),
        then falls back to toptier (for agencies like Department of the Navy).
        """
        fy_start = f"{fiscal_year - 1}-10-01"
        fy_end = f"{fiscal_year}-09-30"

        # Try subtier first (most specific — DARPA, MDA, etc.)
        for tier in ("subtier", "toptier"):
            filters = AwardFilters(
                agencies=[{
                    "type": "awarding",
                    "tier": tier,
                    "name": agency_name,
                }],
                time_period=[{
                    "start_date": fy_start,
                    "end_date": fy_end,
                }],
            )
            results = self.search_awards_all(filters, max_records=max_records)
            if results:
                logger.info("Found %d results using tier=%s", len(results), tier)
                return results

        logger.warning("No results found for '%s' at any tier", agency_name)
        return []
