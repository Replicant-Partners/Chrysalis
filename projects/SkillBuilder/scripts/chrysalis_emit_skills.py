"""
Chrysalis bridge script: emit SkillBuilder-derived skill/workflow/task artifacts as JSON.

Supports --offline mode for local/dev runs without external APIs.
This is intentionally minimal: it provides a stable adapter surface while the
full SkillBuilder pipeline continues to evolve.

Output (stdout): JSON object with keys:
  - occupation
  - generated_at
  - skills: [{ name, description, confidence, source }]
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def offline_skills(occupation: str) -> Dict[str, Any]:
    generated_at = now_iso()
    skills: List[Dict[str, Any]] = [
        {
            "name": f"{occupation}: core workflow analysis",
            "description": "Break the role into workflows, tasks, and skill primitives.",
            "confidence": 0.75,
            "source": "offline",
        },
        {
            "name": f"{occupation}: task decomposition",
            "description": "Decompose tasks into steps with verification criteria and safety constraints.",
            "confidence": 0.7,
            "source": "offline",
        },
    ]
    return {"occupation": occupation, "generated_at": generated_at, "skills": skills}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("occupation")
    p.add_argument("--offline", action="store_true")
    args = p.parse_args()

    if args.offline or os.getenv("CHRYSALIS_OFFLINE", "").lower() == "true":
        out = offline_skills(args.occupation)
    else:
        # Future: invoke `python -m semantic_mode run spec.yaml` and parse artifacts.
        out = offline_skills(args.occupation)

    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

