"""ETL pipeline configuration — environment variables with sensible defaults."""

import os
from pathlib import Path

# --- USASpending API ---
USASPENDING_BASE_URL = "https://api.usaspending.gov/api/v2/"
USASPENDING_CACHE_DIR = Path(os.getenv("USASPENDING_CACHE_DIR", ".cache/usaspending"))
USASPENDING_CACHE_TTL_HOURS = int(os.getenv("USASPENDING_CACHE_TTL_HOURS", "24"))
USASPENDING_MAX_PAGES = int(os.getenv("USASPENDING_MAX_PAGES", "50"))
USASPENDING_RATE_LIMIT = float(os.getenv("USASPENDING_RATE_LIMIT", "2.0"))
USASPENDING_PAGE_SIZE = 100  # API max

# --- Capability Classifier ---
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLASSIFIER_MODEL = os.getenv("CLASSIFIER_MODEL", "claude-sonnet-4-20250514")
CLASSIFIER_CACHE_DIR = Path(os.getenv("CLASSIFIER_CACHE_DIR", ".cache/classifications"))
CLASSIFIER_USE_LLM = os.getenv("CLASSIFIER_USE_LLM", "true").lower() == "true"

# --- Triple Store ---
FUSEKI_ENDPOINT = os.getenv("FUSEKI_ENDPOINT", "http://localhost:3030/procurement")
FUSEKI_ADMIN_PASSWORD = os.getenv("FUSEKI_ADMIN_PASSWORD", "admin")
FUSEKI_UPLOAD_CHUNK_SIZE = int(os.getenv("FUSEKI_UPLOAD_CHUNK_SIZE", "10000"))

# --- Namespaces ---
DP_NAMESPACE = "http://defenseprocurement.io/ontology#"
DATA_NAMESPACE = "http://defenseprocurement.io/data#"

# --- Default award fields ---
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
