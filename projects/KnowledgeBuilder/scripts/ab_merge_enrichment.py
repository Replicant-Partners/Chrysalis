import argparse
import json
import os
from typing import Any, Dict

from src.pipeline.router import SearchOrchestrator


def run_once(identifier: str, entity_type: str, max_cost: float, baseline_only: bool) -> Dict[str, Any]:
    orchestrator = SearchOrchestrator(max_cost=max_cost)
    res = orchestrator.collect(identifier, entity_type, compare_without_enrichment=True)
    # Baseline: Brave-only result
    baseline_attrs = res.get("baseline", {}).get("attributes", {})
    enriched_attrs = res.get("attributes", {})
    merge_stats = res.get("merge_stats", {})
    telemetry = res.get("telemetry", {})
    return {
        "baseline_attrs_count": len(baseline_attrs),
        "enriched_attrs_count": len(enriched_attrs),
        "merge_stats": merge_stats,
        "telemetry": telemetry,
        "enrichment_used": res.get("enrichment_used"),
        "enrichment_info": res.get("enrichment_info"),
        "cost_spent": res.get("cost_spent"),
        "budget_remaining": res.get("budget_remaining"),
        "baseline": res.get("baseline") if baseline_only else {},
    }


def main():
    parser = argparse.ArgumentParser(description="A/B runner for enrichment + semantic merge.")
    parser.add_argument("identifier", help="Entity name")
    parser.add_argument("--type", default=None, help="Entity type (e.g., Person)")
    parser.add_argument("--max_cost", type=float, default=0.25, help="Budget for orchestration")
    parser.add_argument("--out", default="./data/ab_merge_enrichment.json", help="Output JSON path")
    parser.add_argument("--baseline_only", action="store_true", help="Include baseline attributes payload")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    res = run_once(args.identifier, args.type, args.max_cost, args.baseline_only)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2)
    print(f"Wrote A/B result to {args.out}")


if __name__ == "__main__":
    main()
