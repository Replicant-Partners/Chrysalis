"""
Chrysalis bridge script: emit KnowledgeBuilder-derived semantic claims as JSON.

Why this exists:
- Chrysalis needs a stable adapter surface while KnowledgeBuilder continues evolving.
- Deterministic convergence happens in Chrysalis; KnowledgeBuilder is a claim generator.
- Supports an --offline mode for local/dev runs without external APIs.

Output (stdout): JSON object with keys:
  - entity_id
  - entity_name
  - entity_type
  - collected_at
  - claims: [{ key, value, confidence, source, uri?, collectedAt? }]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_key(prefix: str, key: str) -> str:
    k = key.strip().lower().replace(" ", "_")
    k = "".join(ch for ch in k if ch.isalnum() or ch in {"_", ".", ":"})
    return f"{prefix}.{k}" if prefix else k


def offline_claims(identifier: str, entity_type: Optional[str]) -> Dict[str, Any]:
    # Minimal deterministic claims suitable for wiring integration.
    entity_type_out = entity_type or "schema:Thing"
    entity_id = f"{entity_type_out.split(':')[-1].lower()}:{identifier.lower().replace(' ', '_')}"
    collected_at = now_iso()
    claims = [
        {
            "key": normalize_key(entity_id, "name"),
            "value": identifier,
            "confidence": 0.9,
            "source": "offline",
            "collectedAt": collected_at,
        },
        {
            "key": normalize_key(entity_id, "type"),
            "value": entity_type_out,
            "confidence": 0.9,
            "source": "offline",
            "collectedAt": collected_at,
        },
    ]
    return {
        "entity_id": entity_id,
        "entity_name": identifier,
        "entity_type": entity_type_out,
        "collected_at": collected_at,
        "claims": claims,
    }


def pipeline_claims(identifier: str, entity_type: Optional[str]) -> Dict[str, Any]:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()

    from src.pipeline.simple_pipeline import SimplePipeline  # noqa: E402

    pipeline = SimplePipeline()
    result = pipeline.collect_and_store(identifier, entity_type)

    entity = result.get("entity", {}) or {}
    attributes = result.get("attributes", {}) or {}
    resolved = result.get("resolved", {}) or {}
    entity_id = entity.get("id") or f"thing:{identifier.lower().replace(' ', '_')}"

    collected_at = now_iso()
    base_conf = float(entity.get("quality_score") or 0.5)
    trust = float(entity.get("trust_score") or 0.5)
    conf = max(0.0, min(1.0, (base_conf + trust) / 2.0))

    claims: List[Dict[str, Any]] = []
    claims.append(
        {
            "key": normalize_key(entity_id, "name"),
            "value": entity.get("name") or identifier,
            "confidence": max(conf, 0.7),
            "source": "knowledgebuilder.pipeline",
            "collectedAt": collected_at,
        }
    )
    claims.append(
        {
            "key": normalize_key(entity_id, "schema_type"),
            "value": resolved.get("schema_type") or entity.get("type") or "schema:Thing",
            "confidence": max(conf, 0.6),
            "source": "knowledgebuilder.schema_resolver",
            "uri": resolved.get("schema_uri"),
            "collectedAt": collected_at,
        }
    )

    for k, v in attributes.items():
        if v is None:
            continue
        if isinstance(v, (dict, list)):
            vv = json.dumps(v, ensure_ascii=False)
        else:
            vv = str(v)
        if not vv.strip():
            continue
        claims.append(
            {
                "key": normalize_key(entity_id, k),
                "value": vv,
                "confidence": conf,
                "source": "knowledgebuilder.brave_search",
                "collectedAt": collected_at,
            }
        )

    return {
        "entity_id": entity_id,
        "entity_name": entity.get("name") or identifier,
        "entity_type": entity.get("type") or resolved.get("schema_type") or "schema:Thing",
        "collected_at": collected_at,
        "claims": claims,
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("identifier")
    p.add_argument("--entity-type", default=None)
    p.add_argument("--offline", action="store_true", help="Do not call external APIs; emit deterministic stub claims.")
    args = p.parse_args()

    if args.offline or os.getenv("CHRYSALIS_OFFLINE", "").lower() == "true":
        out = offline_claims(args.identifier, args.entity_type)
    else:
        out = pipeline_claims(args.identifier, args.entity_type)

    sys.stdout.write(json.dumps(out, ensure_ascii=False))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

