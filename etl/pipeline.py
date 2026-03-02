"""ETL Pipeline orchestrator: extract → classify → transform → load."""

import argparse
import json
import logging
import sys
from pathlib import Path
from urllib.parse import quote

import requests
from rdflib import Graph

from etl.capability_classifier import CapabilityClassifier
from etl.config import (
    FUSEKI_ENDPOINT,
    FUSEKI_ADMIN_PASSWORD,
    FUSEKI_UPLOAD_CHUNK_SIZE,
    DATA_NAMESPACE,
)
from etl.rdf_transformer import RDFTransformer
from etl.usaspending_client import USASpendingClient
from etl.validators import validate_graph

logger = logging.getLogger(__name__)

CHECKPOINT_DIR = Path(".cache/checkpoints")


class Pipeline:
    """Orchestrate the full ETL pipeline."""

    def __init__(
        self,
        fuseki_endpoint: str = FUSEKI_ENDPOINT,
        dry_run: bool = False,
    ):
        self.client = USASpendingClient()
        self.classifier = CapabilityClassifier()
        self.transformer = RDFTransformer()
        self.fuseki_endpoint = fuseki_endpoint
        self.dry_run = dry_run

    def _checkpoint_path(self, agency: str, fiscal_year: int, stage: str) -> Path:
        slug = agency.lower().replace(" ", "_")
        return CHECKPOINT_DIR / f"{slug}_fy{fiscal_year}_{stage}.json"

    def _save_checkpoint(self, path: Path, data: list) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, default=str), encoding="utf-8")
        logger.info("Checkpoint saved: %s (%d records)", path.name, len(data))

    def _load_checkpoint(self, path: Path) -> list | None:
        if path.exists():
            logger.info("Resuming from checkpoint: %s", path.name)
            return json.loads(path.read_text(encoding="utf-8"))
        return None

    def extract(
        self,
        agency: str,
        fiscal_year: int,
        max_records: int | None = None,
    ) -> list[dict]:
        """Extract award records from USASpending."""
        checkpoint = self._checkpoint_path(agency, fiscal_year, "extract")
        cached = self._load_checkpoint(checkpoint)
        if cached is not None:
            if max_records:
                return cached[:max_records]
            return cached

        logger.info("[EXTRACT] Fetching %s awards FY%d...", agency, fiscal_year)
        records = self.client.get_agency_awards(agency, fiscal_year, max_records)
        logger.info("[EXTRACT] %d records retrieved", len(records))

        self._save_checkpoint(checkpoint, records)
        return records

    def classify(self, records: list[dict]) -> list[list[str]]:
        """Classify capabilities for each record."""
        logger.info("[CLASSIFY] Classifying capabilities for %d records...", len(records))
        capabilities = self.classifier.classify_batch(records)
        det_count = sum(1 for c in capabilities if c)
        logger.info(
            "[CLASSIFY] %d classified, %d unclassified",
            det_count, len(capabilities) - det_count,
        )
        return capabilities

    def transform(
        self,
        records: list[dict],
        capabilities: list[list[str]],
    ) -> Graph:
        """Transform records + capabilities into RDF triples."""
        logger.info("[TRANSFORM] Generating RDF triples...")
        graph = self.transformer.transform_batch(records, capabilities)
        logger.info("[TRANSFORM] %d triples generated", len(graph))
        return graph

    def validate(self, graph: Graph) -> bool:
        """Validate the graph before loading."""
        logger.info("[VALIDATE] Running quality checks...")
        result = validate_graph(graph)
        for w in result.warnings:
            logger.warning("[VALIDATE] %s", w)
        for e in result.errors:
            logger.error("[VALIDATE] %s", e)
        logger.info("[VALIDATE] %s", result.summary())
        return result.is_valid

    def load(
        self,
        graph: Graph,
        agency: str,
        fiscal_year: int,
    ) -> None:
        """Upload RDF graph to Fuseki via Graph Store Protocol."""
        if self.dry_run:
            logger.info("[LOAD] Dry run — skipping upload")
            return

        slug = agency.lower().replace(" ", "_")
        named_graph = f"{DATA_NAMESPACE}{slug}/fy{fiscal_year}"
        gsp_url = f"{self.fuseki_endpoint}/data?graph={quote(named_graph, safe='')}"

        logger.info("[LOAD] Uploading to Fuseki graph: %s", named_graph)

        auth = ("admin", FUSEKI_ADMIN_PASSWORD)
        ttl_data = graph.serialize(format="turtle")
        if isinstance(ttl_data, str):
            ttl_bytes = ttl_data.encode("utf-8")
        else:
            ttl_bytes = ttl_data

        # Chunk upload for large graphs
        total_triples = len(graph)
        if total_triples <= FUSEKI_UPLOAD_CHUNK_SIZE:
            resp = requests.put(
                gsp_url,
                data=ttl_bytes,
                headers={"Content-Type": "text/turtle"},
                auth=auth,
                timeout=120,
            )
            resp.raise_for_status()
            logger.info("[LOAD] Uploaded %d triples", total_triples)
        else:
            # Split into chunks by serializing subgraphs
            triples = list(graph)
            for i in range(0, len(triples), FUSEKI_UPLOAD_CHUNK_SIZE):
                chunk = triples[i:i + FUSEKI_UPLOAD_CHUNK_SIZE]
                chunk_graph = Graph()
                for ns_prefix, ns_uri in graph.namespaces():
                    chunk_graph.bind(ns_prefix, ns_uri)
                for triple in chunk:
                    chunk_graph.add(triple)

                chunk_data = chunk_graph.serialize(format="turtle")
                if isinstance(chunk_data, str):
                    chunk_data = chunk_data.encode("utf-8")

                # First chunk uses PUT, subsequent use POST to append
                method = requests.put if i == 0 else requests.post
                resp = method(
                    gsp_url,
                    data=chunk_data,
                    headers={"Content-Type": "text/turtle"},
                    auth=auth,
                    timeout=120,
                )
                resp.raise_for_status()
                logger.info(
                    "[LOAD] Uploaded chunk %d-%d of %d triples",
                    i, min(i + FUSEKI_UPLOAD_CHUNK_SIZE, total_triples), total_triples,
                )

        logger.info("[LOAD] Done (graph: <%s>)", named_graph)

    def run(
        self,
        agency: str,
        fiscal_year: int,
        max_records: int | None = None,
    ) -> Graph:
        """Run the full pipeline: extract → classify → transform → validate → load."""
        logger.info("=" * 60)
        logger.info("Pipeline: %s FY%d (max_records=%s, dry_run=%s)",
                     agency, fiscal_year, max_records, self.dry_run)
        logger.info("=" * 60)

        records = self.extract(agency, fiscal_year, max_records)
        if not records:
            logger.warning("No records found — nothing to process")
            return Graph()

        capabilities = self.classify(records)
        graph = self.transform(records, capabilities)

        is_valid = self.validate(graph)
        if not is_valid:
            logger.error("Validation failed — aborting load")
            # Still save the output for debugging
            output_path = Path(f"output/{agency.lower().replace(' ', '_')}_fy{fiscal_year}.ttl")
            self.transformer.save(graph, output_path)
            return graph

        self.load(graph, agency, fiscal_year)

        # Save a local copy
        output_path = Path(f"output/{agency.lower().replace(' ', '_')}_fy{fiscal_year}.ttl")
        self.transformer.save(graph, output_path)

        logger.info("Pipeline complete: %d records → %d triples", len(records), len(graph))
        return graph


def main() -> None:
    parser = argparse.ArgumentParser(description="Defense Procurement ETL Pipeline")
    parser.add_argument("--agency", required=True, help="Agency name (e.g., 'Defense Advanced Research Projects Agency')")
    parser.add_argument("--fiscal-year", type=int, required=True, action="append",
                        help="Fiscal year(s) to process (can specify multiple)")
    parser.add_argument("--max-records", type=int, default=None, help="Max records to process")
    parser.add_argument("--dry-run", action="store_true", help="Run without uploading to Fuseki")
    parser.add_argument("--fuseki-endpoint", default=FUSEKI_ENDPOINT, help="Fuseki SPARQL endpoint")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose logging")

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    pipeline = Pipeline(
        fuseki_endpoint=args.fuseki_endpoint,
        dry_run=args.dry_run,
    )

    for fy in args.fiscal_year:
        pipeline.run(args.agency, fy, args.max_records)


if __name__ == "__main__":
    main()
