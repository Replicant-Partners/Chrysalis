#!/usr/bin/env python3
"""
SkillBuilder frontend (offline-friendly scaffold).

Reads a YAML spec describing the identity/purpose/skills, runs a lightweight
semantic pipeline, and emits the standard artifacts:
- semantic-map.md
- citations.md
- skills.md
- mode-reference.md
- generated-mode.md
- telemetry.jsonl

This implementation is intentionally offline-safe: it builds placeholder search
results so operators can iterate on structure while networked search/LLM pieces
are added later.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from semantic_mode import default_config_dir
from semantic_mode.config_loader import SemanticConfig
from semantic_mode.models import Exemplar, IdentitySpec
from semantic_mode.output import write_artifacts
from semantic_mode.pipeline.research import run_pipeline


@dataclass(frozen=True)
class SpecPaths:
    path: Path
    out_dir: Path


def _load_spec(path: Path) -> Dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit("Spec must be a YAML mapping.")
    return data


def _parse_spec(raw: Dict[str, Any], spec_path: Path) -> IdentitySpec:
    mode_name = str(raw.get("mode_name") or raw.get("identity") or "").strip()
    if not mode_name:
        raise SystemExit("Spec requires `mode_name` or `identity`.")
    purpose = str(raw.get("purpose") or "").strip()
    if not purpose:
        raise SystemExit("Spec requires `purpose`.")
    skills = [str(s).strip() for s in raw.get("skills") or [] if str(s).strip()]
    use_cases = [str(u).strip() for u in raw.get("use_cases") or [] if str(u).strip()]

    exemplars_raw = raw.get("exemplars") or []
    exemplars: List[Exemplar] = []
    if isinstance(exemplars_raw, list):
        for item in exemplars_raw:
            if isinstance(item, str):
                exemplars.append(Exemplar(name=item))
            elif isinstance(item, dict):
                name = str(item.get("name") or "").strip()
                if name:
                    exemplars.append(
                        Exemplar(
                            name=name,
                            url=str(item.get("url") or "").strip() or None,
                            is_author=bool(item.get("is_author") or item.get("author")),
                        )
                    )

    out_dir_raw = raw.get("out_dir") or "reports/autogen"
    out_dir = Path(out_dir_raw)
    if not out_dir.is_absolute():
        out_dir = (REPO_ROOT / out_dir).resolve()

    return IdentitySpec(
        raw=mode_name,
        purpose=purpose,
        skills=skills or [mode_name],
        use_cases=use_cases or ["research and synthesize semantic map", "generate KiloCode-ready mode"],
        exemplars=exemplars or [Exemplar(name=mode_name)],
        out_dir=out_dir,
        mode_name=mode_name,
    )


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("spec", help="Path to YAML spec.")
    parser.add_argument("--config-dir", default=None, help="Override config directory (defaults to bundled config/).")
    args = parser.parse_args(argv)

    spec_path = Path(args.spec).expanduser().resolve()
    if not spec_path.exists():
        raise SystemExit(f"Spec not found: {spec_path}")

    raw_spec = _load_spec(spec_path)
    spec = _parse_spec(raw_spec, spec_path)

    cfg_dir = Path(args.config_dir).expanduser() if args.config_dir else default_config_dir()
    config = SemanticConfig.load(cfg_dir)

    artifacts = run_pipeline(spec, config)
    write_artifacts(spec, artifacts)

    print(f"Wrote artifacts to: {spec.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
