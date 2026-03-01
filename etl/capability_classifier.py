"""Two-layer capability classifier: deterministic rules + Claude API fallback."""

import hashlib
import json
import logging
import re
import time
from pathlib import Path
from typing import Any

from etl.config import (
    ANTHROPIC_API_KEY,
    CLASSIFIER_CACHE_DIR,
    CLASSIFIER_MODEL,
    CLASSIFIER_USE_LLM,
    DP_NAMESPACE,
)

logger = logging.getLogger(__name__)

DP = DP_NAMESPACE

# =============================================================================
# LAYER 1: Deterministic Rules
# =============================================================================

# PSC code prefix → capability URIs
PSC_MAPPING: dict[str, list[str]] = {
    "R4": [f"{DP}ElectronicWarfare", f"{DP}C4ISR"],
    "AC": [f"{DP}ElectronicWarfare"],
    "AA": [f"{DP}MissileDefense", f"{DP}Hypersonics"],
    "AB": [f"{DP}MissileDefense"],
    "AJ": [f"{DP}AutonomousSystems"],
    "AK": [f"{DP}AutonomousSystems"],
    "AG": [f"{DP}SpaceSystems"],
    "D3": [f"{DP}CyberSecurity", f"{DP}C4ISR"],
    "D3-": [f"{DP}CyberSecurity"],
    "U0": [f"{DP}TrainingSimulation"],
    "U0-": [f"{DP}TrainingSimulation"],
    "B5": [f"{DP}SpaceSystems"],
    "70": [f"{DP}C4ISR"],
    "58": [f"{DP}C4ISR", f"{DP}ElectronicWarfare"],
}

# NAICS code → capability URIs
NAICS_MAPPING: dict[str, list[str]] = {
    "518210": [f"{DP}CyberSecurity", f"{DP}C4ISR"],
    "334511": [f"{DP}SpaceSystems", f"{DP}C4ISR"],
    "336414": [f"{DP}MissileDefense", f"{DP}SpaceSystems", f"{DP}Hypersonics"],
    "541512": [f"{DP}CyberSecurity", f"{DP}AIandML", f"{DP}C4ISR"],
    "541519": [f"{DP}AIandML", f"{DP}CyberSecurity"],
    "336411": [f"{DP}AutonomousSystems"],
    "334290": [f"{DP}C4ISR", f"{DP}ElectronicWarfare"],
    "334220": [f"{DP}C4ISR"],
    "336419": [f"{DP}SpaceSystems"],
    "611430": [f"{DP}TrainingSimulation"],
    "541380": [f"{DP}TrainingSimulation"],
    "562910": [f"{DP}Biotechnology"],
    "325414": [f"{DP}Biotechnology"],
    "488190": [f"{DP}Logistics"],
    "493110": [f"{DP}Logistics"],
}

# Keyword patterns → capability URI (compiled regex, case-insensitive)
KEYWORD_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"electronic.warfare|EW\b|jamming|SIGINT|electronic.attack|electronic.protect|ELINT", re.I),
     f"{DP}ElectronicWarfare"),
    (re.compile(r"artificial.intelligence|machine.learning|neural.net|deep.learn|AI/ML|AI\b.{0,5}ML|computer.vision|natural.language.process", re.I),
     f"{DP}AIandML"),
    (re.compile(r"autonomous|UAS\b|UAV\b|unmanned|drone|robotic|UGV\b|UUV\b|USV\b", re.I),
     f"{DP}AutonomousSystems"),
    (re.compile(r"cyber|information.assurance|zero.trust|penetration.test|network.secur|intrusion.detect|SIEM|endpoint.protect", re.I),
     f"{DP}CyberSecurity"),
    (re.compile(r"hypersonic|scramjet|boost.glide|mach.\d|thermal.protection.system", re.I),
     f"{DP}Hypersonics"),
    (re.compile(r"directed.energy|laser.weapon|high.energy.laser|HEL\b|high.power.microwave|HPM\b", re.I),
     f"{DP}DirectedEnergy"),
    (re.compile(r"quantum.comput|quantum.sens|quantum.commun|post.quantum|QKD|qubit", re.I),
     f"{DP}QuantumTechnology"),
    (re.compile(r"command.and.control|C2\b|C4ISR|ISR\b|intelligence.surveillance|battle.manage|tactical.data|JADC2", re.I),
     f"{DP}C4ISR"),
    (re.compile(r"satellite|space.vehicle|orbit|space.domain|GPS|GNSS|space.launch|constellation", re.I),
     f"{DP}SpaceSystems"),
    (re.compile(r"missile.defense|interceptor|ballistic.missile|THAAD|Patriot|Aegis|ICBM|BMDS", re.I),
     f"{DP}MissileDefense"),
    (re.compile(r"logistics|supply.chain|sustainment|depot.maintenance|warehousing|transportation.manage", re.I),
     f"{DP}Logistics"),
    (re.compile(r"training.simul|simulator|virtual.reality|augmented.reality|LVC\b|live.virtual.constructive|war.?game", re.I),
     f"{DP}TrainingSimulation"),
    (re.compile(r"synthetic.biology|biodefense|biosurveillance|bio.?manufactur|CBRN|chemical.biological", re.I),
     f"{DP}Biotechnology"),
]

# Capability taxonomy for LLM prompt
CAPABILITY_DEFINITIONS = {
    "ElectronicWarfare": "Electronic warfare, SIGINT, jamming, EW systems, electromagnetic spectrum operations",
    "C4ISR": "Command, Control, Communications, Computers, ISR; battle management, tactical data links, JADC2",
    "AutonomousSystems": "Unmanned aerial/ground/maritime systems, drones, UAV/UAS, robotics, autonomy",
    "CyberSecurity": "Cybersecurity, information assurance, zero trust, network security, penetration testing",
    "SpaceSystems": "Satellites, space launch, GPS, constellation systems, space domain awareness",
    "AIandML": "Artificial intelligence, machine learning, deep learning, neural networks, computer vision, NLP",
    "MissileDefense": "Missile defense, interceptors, BMD, THAAD, Patriot, Aegis",
    "Logistics": "Supply chain, sustainment, depot maintenance, transportation, warehousing",
    "TrainingSimulation": "Training systems, simulators, VR/AR training, LVC, wargaming",
    "Hypersonics": "Hypersonic weapons, scramjets, boost-glide vehicles, thermal protection",
    "DirectedEnergy": "High-energy lasers, high-power microwaves, directed energy weapons",
    "QuantumTechnology": "Quantum computing, quantum sensing, quantum communications, post-quantum crypto",
    "Biotechnology": "Synthetic biology, biodefense, biosurveillance, bio-manufacturing, CBRN",
}


def _classify_by_psc(psc_code: str | None) -> list[str]:
    if not psc_code:
        return []
    psc = psc_code.strip().upper()
    # Try exact match first, then prefix matches (2-char, then first char)
    for length in [len(psc), 3, 2]:
        prefix = psc[:length]
        if prefix in PSC_MAPPING:
            return list(PSC_MAPPING[prefix])
    return []


def _classify_by_naics(naics_code: str | None) -> list[str]:
    if not naics_code:
        return []
    code = naics_code.strip()
    return list(NAICS_MAPPING.get(code, []))


def _classify_by_keywords(description: str | None) -> list[str]:
    if not description:
        return []
    caps: list[str] = []
    for pattern, cap_uri in KEYWORD_PATTERNS:
        if pattern.search(description):
            if cap_uri not in caps:
                caps.append(cap_uri)
    return caps


def classify_deterministic(
    description: str | None,
    naics_code: str | None,
    psc_code: str | None,
) -> list[str]:
    """Layer 1: Deterministic classification using PSC, NAICS, and keyword rules."""
    results: list[str] = []
    results.extend(_classify_by_psc(psc_code))
    results.extend(_classify_by_naics(naics_code))
    results.extend(_classify_by_keywords(description))
    # Deduplicate while preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for r in results:
        if r not in seen:
            seen.add(r)
            deduped.append(r)
    return deduped


class CapabilityClassifier:
    """Two-layer capability classifier: deterministic rules + optional Claude API."""

    def __init__(
        self,
        api_key: str = ANTHROPIC_API_KEY,
        model: str = CLASSIFIER_MODEL,
        cache_dir: Path = CLASSIFIER_CACHE_DIR,
        use_llm: bool = CLASSIFIER_USE_LLM,
    ):
        self.api_key = api_key
        self.model = model
        self.cache_dir = Path(cache_dir)
        self.use_llm = use_llm and bool(api_key)
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            try:
                import anthropic
                self._client = anthropic.Anthropic(api_key=self.api_key)
            except ImportError:
                logger.warning("anthropic package not installed, LLM classification disabled")
                self.use_llm = False
                return None
        return self._client

    def _llm_cache_key(self, description: str, naics: str, psc: str) -> str:
        content = f"{description}|{naics}|{psc}"
        return hashlib.sha256(content.encode()).hexdigest()

    def _get_llm_cached(self, key: str) -> list[str] | None:
        cache_file = self.cache_dir / f"{key}.json"
        if cache_file.exists():
            try:
                data = json.loads(cache_file.read_text(encoding="utf-8"))
                return data.get("capabilities", [])
            except (json.JSONDecodeError, OSError):
                return None
        return None

    def _set_llm_cached(self, key: str, capabilities: list[str]) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file = self.cache_dir / f"{key}.json"
        cache_file.write_text(
            json.dumps({"capabilities": capabilities}),
            encoding="utf-8",
        )

    def _classify_llm(
        self,
        description: str,
        naics_code: str | None,
        psc_code: str | None,
    ) -> list[str]:
        """Layer 2: Use Claude API to classify ambiguous contracts."""
        if not self.use_llm:
            return []

        cache_key = self._llm_cache_key(description or "", naics_code or "", psc_code or "")
        cached = self._get_llm_cached(cache_key)
        if cached is not None:
            return cached

        client = self._get_client()
        if client is None:
            return []

        cap_list = "\n".join(
            f"- dp:{name}: {defn}" for name, defn in CAPABILITY_DEFINITIONS.items()
        )

        system_prompt = f"""You are a defense procurement classification expert. Given a contract description, NAICS code, and PSC code, classify the contract into one or more technical capability areas.

Available capability categories:
{cap_list}

Respond ONLY with valid JSON in this exact format:
{{"capabilities": ["dp:CapabilityName1", "dp:CapabilityName2"], "confidence": 0.85}}

Rules:
- Only use capability names from the list above
- Prefix each with "dp:"
- Return 1-3 most relevant capabilities
- Set confidence between 0 and 1
- If the description is too vague to classify, return {{"capabilities": [], "confidence": 0.0}}"""

        user_msg = f"""Contract description: {description or 'N/A'}
NAICS code: {naics_code or 'N/A'}
PSC code: {psc_code or 'N/A'}"""

        try:
            response = client.messages.create(
                model=self.model,
                max_tokens=256,
                system=system_prompt,
                messages=[{"role": "user", "content": user_msg}],
            )
            text = response.content[0].text.strip()
            data = json.loads(text)
            caps = [
                f"{DP}{c.replace('dp:', '')}" for c in data.get("capabilities", [])
            ]
            self._set_llm_cached(cache_key, caps)
            return caps
        except Exception as e:
            logger.error("LLM classification failed: %s", e)
            return []

    def classify(
        self,
        description: str | None = None,
        naics_code: str | None = None,
        psc_code: str | None = None,
    ) -> list[str]:
        """Classify a contract into capability URIs. Uses deterministic rules first,
        falls back to Claude API for ambiguous cases."""
        results = classify_deterministic(description, naics_code, psc_code)
        if not results and description:
            llm_results = self._classify_llm(description, naics_code, psc_code)
            results.extend(llm_results)
        return results

    def classify_batch(
        self,
        records: list[dict],
        description_key: str = "Description",
        naics_key: str = "NAICS Code",
        psc_key: str = "PSC Code",
    ) -> list[list[str]]:
        """Classify a batch of records. Returns a list of capability lists."""
        results: list[list[str]] = []
        deterministic_count = 0
        llm_count = 0

        for i, record in enumerate(records):
            desc = record.get(description_key)
            naics = record.get(naics_key)
            psc = record.get(psc_key)

            det_results = classify_deterministic(desc, naics, psc)
            if det_results:
                results.append(det_results)
                deterministic_count += 1
            else:
                llm_results = self._classify_llm(desc or "", naics, psc)
                results.append(llm_results)
                llm_count += 1

            if (i + 1) % 100 == 0:
                logger.info("Classified %d/%d records", i + 1, len(records))

        logger.info(
            "Classification complete: %d deterministic, %d LLM",
            deterministic_count, llm_count,
        )
        return results
