"""Data quality checks and ontology conformance validators."""

import logging
from dataclasses import dataclass, field

from rdflib import Graph, Namespace, RDF, RDFS

logger = logging.getLogger(__name__)

DP = Namespace("http://defenseprocurement.io/ontology#")
DATA = Namespace("http://defenseprocurement.io/data#")


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def summary(self) -> str:
        return f"{len(self.warnings)} warnings, {len(self.errors)} errors"


def validate_graph(graph: Graph) -> ValidationResult:
    """Run quality checks on an RDF graph before loading."""
    result = ValidationResult()

    # Count key entity types
    awards = list(graph.subjects(RDF.type, DP.ContractAward))
    contractors = list(graph.subjects(RDF.type, DP.Contractor))
    agencies = list(graph.subjects(RDF.type, DP.GovernmentAgency))

    if not awards:
        result.errors.append("No ContractAward individuals found")
    if not contractors:
        result.errors.append("No Contractor individuals found")
    if not agencies:
        result.warnings.append("No GovernmentAgency individuals found")

    # Check awards have required relationships
    orphan_awards = 0
    for award in awards:
        has_contractor = any(graph.objects(award, DP.awardedTo))
        if not has_contractor:
            orphan_awards += 1
    if orphan_awards > 0:
        result.warnings.append(f"{orphan_awards} awards have no contractor (awardedTo)")

    # Check for awards without capabilities
    no_cap_awards = 0
    for award in awards:
        has_cap = any(graph.objects(award, DP.requiresCapability))
        if not has_cap:
            no_cap_awards += 1
    if no_cap_awards > 0:
        pct = (no_cap_awards / len(awards)) * 100 if awards else 0
        result.warnings.append(
            f"{no_cap_awards}/{len(awards)} awards ({pct:.0f}%) have no capability classification"
        )

    # Check for contractors without labels
    unlabeled = 0
    for contractor in contractors:
        has_label = any(graph.objects(contractor, RDFS.label))
        if not has_label:
            unlabeled += 1
    if unlabeled > 0:
        result.warnings.append(f"{unlabeled} contractors have no label")

    logger.info(
        "Validation: %d awards, %d contractors, %d agencies — %s",
        len(awards), len(contractors), len(agencies), result.summary(),
    )
    return result
