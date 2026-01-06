#!/usr/bin/env python3
"""
Generate SemMilton.json:
- Load Milton's authorable persona profile (chrysalis.persona v0.1).
- Merge in Orchestrator + Architect + Socratic Mentor guidance as durable semantic memory items.
- Run SkillBuilder "skillforge" passes (offline bridge by default) to add skill items.

This is deliberately conservative: it only appends/extends; it does not delete or overwrite Milton's existing items.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace")


def read_json(p: Path) -> Dict[str, Any]:
    return json.loads(read_text(p))


def sha_id(*parts: str, n: int = 12) -> str:
    h = hashlib.sha384("\n".join(parts).encode("utf-8")).hexdigest()
    return h[:n]


def add_principles(profile: Dict[str, Any], principles: List[str], tag: str) -> None:
    style = profile.setdefault("personality", {}).setdefault("style", {})
    existing = style.get("principles") or []
    if not isinstance(existing, list):
        existing = []
    merged = existing[:]
    for p in principles:
        if p not in merged:
            merged.append(p)
    style["principles"] = merged

    items = profile.setdefault("semantic_memory", {}).setdefault("items", [])
    if isinstance(items, list):
        items.append(
            {
                "id": f"merged_principles_{tag}_{sha_id(tag, *principles)}",
                "type": "policy",
                "content": "Merged principles: " + "; ".join(principles),
                "tags": ["merge", tag, "principles"],
                "confidence": 0.8,
                "source": {"kind": "merge", "ref": tag},
            }
        )


def add_mode_blob(profile: Dict[str, Any], name: str, text: str, source_ref: str) -> None:
    items = profile.setdefault("semantic_memory", {}).setdefault("items", [])
    if not isinstance(items, list):
        return
    items.append(
        {
            "id": f"mode_blob_{sha_id(name, source_ref)}",
            "type": "procedure",
            "content": text.strip(),
            "tags": ["merge", "mode", name],
            "confidence": 0.75,
            "source": {"kind": "mode", "ref": source_ref},
        }
    )


def extract_snippet_from_yaml(yaml_text: str, key: str) -> Optional[str]:
    # crude extraction: find line starting with key: and capture indented block or scalar
    m = re.search(rf"(?m)^{re.escape(key)}:\\s*(.*)$", yaml_text)
    if not m:
        return None
    first = m.group(1).rstrip()
    # if scalar on same line, return it (strip quotes)
    if first and not first.startswith("|") and not first.startswith(">"):
        return first.strip().strip('"').strip("'")
    # otherwise capture following indented lines
    start = m.end()
    lines = yaml_text[start:].splitlines()
    block: List[str] = []
    for ln in lines:
        if re.match(r"^[^\\s].*:", ln):
            break
        if ln.startswith("  ") or ln.startswith("\t") or ln.startswith("    "):
            block.append(ln.strip())
        elif ln.strip() == "":
            block.append("")
        else:
            break
    text = "\n".join(block).strip()
    return text or None


def skillbuilder_skills(sem_mode_root: Path, occupation: str, offline: bool = True) -> List[Dict[str, Any]]:
    script = sem_mode_root / "scripts" / "chrysalis_emit_skills.py"
    cmd = ["python3", str(script), occupation]
    if offline:
        cmd.append("--offline")
    r = subprocess.run(cmd, cwd=str(sem_mode_root), capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout)
    payload = json.loads(r.stdout)
    skills = payload.get("skills") or []
    if not isinstance(skills, list):
        return []
    out: List[Dict[str, Any]] = []
    for s in skills:
        if not isinstance(s, dict):
            continue
        out.append(
            {
                "name": str(s.get("name") or ""),
                "description": str(s.get("description") or ""),
                "confidence": float(s.get("confidence") or 0.5),
                "source": str(s.get("source") or "skillbuilder"),
            }
        )
    return [x for x in out if x["name"]]


def add_skill_items(profile: Dict[str, Any], skills: List[Dict[str, Any]], tag: str) -> int:
    items = profile.setdefault("semantic_memory", {}).setdefault("items", [])
    if not isinstance(items, list):
        return 0
    existing_names = {i.get("content") for i in items if isinstance(i, dict) and isinstance(i.get("content"), str)}
    added = 0
    for s in skills:
        content = f"{s['name']}: {s.get('description','')}".strip()
        if content in existing_names:
            continue
        items.append(
            {
                "id": f"skill_{tag}_{sha_id(s['name'], s.get('description',''), s.get('source',''))}",
                "type": "skill",
                "content": content,
                "tags": ["skill", "skillbuilder", tag],
                "confidence": max(0.0, min(1.0, float(s.get("confidence", 0.5)))),
                "source": {"kind": "skillbuilder", "ref": tag},
            }
        )
        existing_names.add(content)
        added += 1
    return added


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--milton", required=True, help="Path to milton.persona.json")
    ap.add_argument("--skillbuilder-root", required=True, help="Path to SkillBuilder root")
    ap.add_argument("--out", required=True, help="Output path for SemMilton.json")
    ap.add_argument("--offline", action="store_true", help="Use offline SkillBuilder bridge (default)")
    args = ap.parse_args()

    milton_path = Path(args.milton).expanduser().resolve()
    sem_root = Path(args.skillbuilder_root).expanduser().resolve()
    out_path = Path(args.out).expanduser().resolve()

    profile = read_json(milton_path)

    # Merge mode guidance blobs from existing SkillBuilder assets.
    # Orchestrator: custom_modes.yaml contains an "Executive Orchestrator" roleDefinition.
    custom_modes = sem_root / "custom_modes.yaml"
    if custom_modes.exists():
        text = read_text(custom_modes)
        snippet = extract_snippet_from_yaml(text, "roleDefinition")  # first occurrence is orchestrator
        if snippet:
            add_mode_blob(profile, "orchestrator", snippet, str(custom_modes))

    # Architect: use standards-mode.yaml (merged System Architect perspective)
    standards_mode = sem_root / "ExistingModes" / "standards-mode.yaml"
    if standards_mode.exists():
        text = read_text(standards_mode)
        snippet = extract_snippet_from_yaml(text, "roleDefinition") or extract_snippet_from_yaml(text, "description")
        if snippet:
            add_mode_blob(profile, "architect", snippet, str(standards_mode))

    # Socratic mentor: coding-teacher.yaml includes Socratic guidance.
    coding_teacher = sem_root / "ExistingModes" / "coding-teacher.yaml"
    if coding_teacher.exists():
        text = read_text(coding_teacher)
        snippet = extract_snippet_from_yaml(text, "roleDefinition") or extract_snippet_from_yaml(text, "description")
        if snippet:
            add_mode_blob(profile, "socratic_mentor", snippet, str(coding_teacher))

    # Merge principles at the personality level (lightweight).
    add_principles(
        profile,
        [
            "Orchestrate workflows across modes; maintain global situational awareness",
            "Prefer explicit delegation boundaries and handoff artifacts",
        ],
        "orchestrator",
    )
    add_principles(
        profile,
        [
            "Think in architectural boundaries, trade-offs, and scaling constraints",
            "Prefer deterministic, auditable interfaces between services",
        ],
        "architect",
    )
    add_principles(
        profile,
        [
            "Use Socratic questioning to surface assumptions and build understanding",
            "Prefer questions and small experiments before prescriptions",
        ],
        "socratic_mentor",
    )

    # SkillBuilder passes: treat each role as an occupation seed.
    designation = str(profile.get("designation") or "Milton")
    occupations = [
        designation,
        "Executive Orchestrator",
        "System Architect",
        "Socratic Mentor",
        "Orchestrator + Architect + Socratic Mentor",
    ]

    total_added = 0
    for occ in occupations:
        skills = skillbuilder_skills(sem_root, occ, offline=True if args.offline else True)
        total_added += add_skill_items(profile, skills, tag=occ.lower().replace(" ", "_")[:32])

    meta = profile.setdefault("metadata", {})
    x = meta.setdefault("x_sem_milton", {})
    x["generated_by"] = "Chrysalis/scripts/sem_milton.py"
    x["skillbuilder_offline"] = True
    x["passes"] = occupations
    x["skills_added"] = total_added
    x["merged_modes"] = ["orchestrator", "architect", "socratic_mentor"]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

