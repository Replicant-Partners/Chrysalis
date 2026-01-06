"""
Generate a schema.org/ESCO role map from ExistingModes/MergedJTG YAMLs using a local ESCO dump.

Inputs (expected local files you supply):
- ESCO occupations CSV: path provided via --esco-occupations-csv
  Expected columns (semicolon-delimited): conceptUri;preferredLabel;altLabels;broaderUri;iscoGroup;code
- ESCO ISCO mapping (optional): provide if a separate file is used.
- Mode YAMLs root: ExistingModes/MergedJTG

Outputs:
- config/role-map.yaml populated with slug -> {functional, domain, occupation, occupationCategory{codeValue,name,inCodeSet}}

Heuristics:
- Match by preferred/alt labels fuzzy to mode name/slug.
- ISCO code used as occupationCategory.codeValue; inCodeSet fixed to ESCO occupation URI set.
- Functional/domain are left as placeholders to be post-edited or augmented via LLM tagging.

Note: This script does no network I/O. You must place the ESCO CSV locally.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml


def load_modes(dir_path: str) -> List[Dict[str, Any]]:
    """Load all mode definitions from a directory."""
    modes = []
    root = Path(dir_path)
    
    if not root.exists():
        print(f"Warning: Directory {dir_path} does not exist")
        return modes
    
    for path in sorted(root.glob("**/*.y*ml")):
        try:
            with open(path, "r", encoding="utf-8") as f:
                mode = yaml.safe_load(f)
                if mode:
                    modes.append(mode)
        except Exception as e:
            print(f"Error loading {path}: {e}")
    
    return modes


def load_esco_occupations(csv_path: Path) -> List[Dict[str, str]]:
    rows = []
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for r in reader:
            rows.append(r)
    return rows


def normalize(s: str) -> str:
    return " ".join((s or "").lower().replace("-", " ").split())


def match_mode_to_esco(mode: Dict[str, str], esco_rows: List[Dict[str, str]]) -> Optional[Dict[str, str]]:
    target = normalize(mode["name"])
    slug_norm = normalize(mode["slug"])
    best = None
    best_score = 0
    for r in esco_rows:
        pref = normalize(r.get("preferredLabel", ""))
        alts = normalize(r.get("altLabels", "")).split("|") if r.get("altLabels") else []
        candidates = [pref] + alts
        for c in candidates:
            if not c:
                continue
            # simple overlap score
            score = jaccard_words(target, c)
            score = max(score, jaccard_words(slug_norm, c))
            if score > best_score:
                best_score = score
                best = r
    return best if best_score >= 0.25 else None


def jaccard_words(a: str, b: str) -> float:
    sa = set(a.split())
    sb = set(b.split())
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--modes-root", type=Path, default=Path("ExistingModes/MergedJTG"))
    ap.add_argument("--esco-occupations-csv", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=Path("config/role-map.yaml"))
    args = ap.parse_args()

    modes = load_modes(str(args.modes_root))

    # Load JTG modes
    jtg_modes = load_modes("ExistingModes/JTG")

    esco_rows = load_esco_occupations(args.esco_occupations_csv)

    role_map = {}
    for m in modes:
        match = match_mode_to_esco(m, esco_rows)
        if not match:
            continue
        code = match.get("code") or match.get("iscoGroup") or ""
        pref = match.get("preferredLabel", "")
        role_map[m["slug"]] = {
            "functional": "tbd",
            "domain": "tbd",
            "occupation": pref or m["name"],
            "occupationCategory": {
                "codeValue": code,
                "name": pref,
                "inCodeSet": "https://ec.europa.eu/esco/occupation",
            },
        }

    payload = {"roles": role_map}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(yaml.safe_dump(payload, sort_keys=True, allow_unicode=True), encoding="utf-8")
    print(f"Wrote {len(role_map)} mappings to {args.out}")


if __name__ == "__main__":
    main()
