#!/usr/bin/env python3
"""
SkillBuilder "skillforge" for arbitrary personas.

Goal:
- Take an authorable Chrysalis persona profile (chrysalis.persona v0.1).
- Merge in one or more Chrysalis agent role markdown files as durable semantic memory items.
- Run SkillBuilder subprocess bridge to append skill items (offline mode by default).

This is append-only: it does not delete or overwrite existing semantic items.

To run LLM deepening passes (Anthropic Opus), set `ANTHROPIC_API_KEY` and pass:
  --deepening-passes N --deepening-model claude-opus-4-5
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional


def _env(name: str, default: str = "") -> str:
    import os

    return str(os.getenv(name, default) or default)


def _call_anthropic_json(*, model: str, system: str, user: str, max_tokens: int, temperature: float) -> Dict[str, Any]:
    """
    Minimal Anthropic Messages API call returning parsed JSON.
    Expects the model to return a single JSON object.
    """
    import requests

    api_key = _env("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError("missing_env:ANTHROPIC_API_KEY")
    base = (_env("ANTHROPIC_BASE_URL", "https://api.anthropic.com") or "").rstrip("/")
    url = base + "/v1/messages"
    headers = {
        "content-type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": _env("ANTHROPIC_VERSION", "2023-06-01") or "2023-06-01",
    }
    payload: Dict[str, Any] = {
        "model": model,
        "max_tokens": int(max_tokens),
        "temperature": float(temperature),
        "system": system,
        "messages": [{"role": "user", "content": user}],
        # Use tool-calling to force structured JSON output (avoids fragile string JSON parsing).
        "tools": [
            {
                "name": "return_json",
                "description": "Return a single JSON object result for the request.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "type": {"type": "string"},
                                    "content": {"type": "string"},
                                    "tags": {"type": "array", "items": {"type": "string"}},
                                    "confidence": {"type": "number"},
                                },
                                "required": ["type", "content"],
                                "additionalProperties": True,
                            },
                        }
                    },
                    "required": ["items"],
                    "additionalProperties": True,
                },
            }
        ],
        "tool_choice": {"type": "tool", "name": "return_json"},
    }
    def _post(req_payload: Dict[str, Any]) -> Dict[str, Any]:
        rr = requests.post(
            url,
            headers=headers,
            json=req_payload,
            timeout=float(_env("LLM_HTTP_TIMEOUT_SECONDS", "60") or "60"),
        )
        rr.raise_for_status()
        return rr.json()

    def _extract_text(resp: Dict[str, Any]) -> str:
        parts = resp.get("content") or []
        t = ""
        for part in parts:
            if isinstance(part, dict) and part.get("type") == "text":
                t += str(part.get("text") or "")
        return t.strip()

    def _try_parse(t: str) -> Optional[Dict[str, Any]]:
        try:
            obj = json.loads(t)
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass
        start = t.find("{")
        end = t.rfind("}")
        if start >= 0 and end > start:
            try:
                obj = json.loads(t[start : end + 1])
                if isinstance(obj, dict):
                    return obj
            except Exception:
                return None
        return None

    data = _post(payload)

    # Preferred: tool_use content with structured dict payload.
    for part in data.get("content") or []:
        if isinstance(part, dict) and part.get("type") == "tool_use" and part.get("name") == "return_json":
            tool_input = part.get("input")
            if isinstance(tool_input, dict) and (tool_input.get("items") is not None or len(tool_input) > 0):
                return tool_input

    # Fallback: some models/configs may still return plain text.
    text = _extract_text(data)
    obj = _try_parse(text)
    if obj is not None:
        return obj

    # If the model chose the tool but supplied empty input, retry once without tools to coax text JSON.
    if any(isinstance(p, dict) and p.get("type") == "tool_use" for p in (data.get("content") or [])):
        no_tools_payload = {
            "model": model,
            "max_tokens": int(max_tokens),
            "temperature": float(temperature),
            "system": system + "\n\nReturn ONLY a single valid JSON object. Do not call any tools.",
            "messages": [{"role": "user", "content": user}],
        }
        data_nt = _post(no_tools_payload)
        text_nt = _extract_text(data_nt)
        obj_nt = _try_parse(text_nt)
        if obj_nt is not None:
            return obj_nt

    # Retry once with an explicit JSON repair request (models sometimes emit near-JSON).
    repair_payload: Dict[str, Any] = {
        "model": model,
        "max_tokens": int(min(1024, max_tokens)),
        "temperature": 0,
        "system": "You are a JSON repair function. Return ONLY a single valid JSON object, with no markdown, no commentary.",
        "messages": [
            {
                "role": "user",
                "content": "Repair the following into a single valid JSON object. Preserve keys/values as best-effort.\n\n---\n"
                + text
                + "\n---",
            }
        ],
    }
    data2 = _post(repair_payload)
    text2 = _extract_text(data2)
    obj2 = _try_parse(text2)
    if obj2 is not None:
        return obj2
    raise RuntimeError("anthropic_returned_non_json")


def _call_openai_json(*, model: str, system: str, user: str, max_tokens: int, temperature: float) -> Dict[str, Any]:
    """
    Minimal OpenAI Chat Completions call returning parsed JSON.
    Expects the model to return a single JSON object.
    """
    import requests

    api_key = _env("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("missing_env:OPENAI_API_KEY")
    base = (_env("OPENAI_BASE_URL", "https://api.openai.com/v1") or "").rstrip("/")
    url = base + "/chat/completions"
    headers = {"content-type": "application/json", "authorization": f"Bearer {api_key}"}
    payload: Dict[str, Any] = {
        "model": model,
        "temperature": float(temperature),
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }
    # Newer OpenAI models (e.g. GPT-5.*) reject `max_tokens` in favor of `max_completion_tokens`.
    if model.startswith("gpt-5"):
        payload["max_completion_tokens"] = int(max_tokens)
        payload["response_format"] = {"type": "json_object"}
    else:
        payload["max_tokens"] = int(max_tokens)
        payload["response_format"] = {"type": "json_object"}
    r = requests.post(url, headers=headers, json=payload, timeout=float(_env("LLM_HTTP_TIMEOUT_SECONDS", "60") or "60"))
    r.raise_for_status()
    data = r.json()
    choices = data.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        raise RuntimeError("openai_no_choices")
    msg = choices[0].get("message") or {}
    text = str(msg.get("content") or "").strip()
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        obj = json.loads(text[start : end + 1])
        if isinstance(obj, dict):
            return obj
    raise RuntimeError("openai_returned_non_json")


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace")


def read_json(p: Path) -> Dict[str, Any]:
    return json.loads(read_text(p))


def sha_id(*parts: str, n: int = 12) -> str:
    h = hashlib.sha384("\n".join(parts).encode("utf-8")).hexdigest()
    return h[:n]


def _strip_frontmatter(md: str) -> str:
    if md.lstrip().startswith("---"):
        # remove first frontmatter block
        m = re.search(r"(?s)^---\\s*\\n.*?\\n---\\s*\\n", md)
        if m:
            return md[m.end() :]
    return md


def add_principles(profile: Dict[str, Any], principles: List[str], tag: str) -> None:
    style = profile.setdefault("personality", {}).setdefault("style", {})
    existing = style.get("principles") or []
    if not isinstance(existing, list):
        existing = []
    merged = existing[:]
    for p in principles:
        if p and p not in merged:
            merged.append(p)
    style["principles"] = merged

    items = profile.setdefault("semantic_memory", {}).setdefault("items", [])
    if isinstance(items, list) and principles:
        items.append(
            {
                "id": f"merged_principles_{tag}_{sha_id(tag, *principles)}",
                "type": "policy",
                "content": "Merged principles: " + "; ".join([p for p in principles if p]),
                "tags": ["merge", tag, "principles"],
                "confidence": 0.8,
                "source": {"kind": "merge", "ref": tag},
            }
        )


def _extract_section(md: str, heading: str) -> Optional[str]:
    """
    Extract a markdown section by heading name (e.g. "Behavioral Mindset").
    """
    md = _strip_frontmatter(md)
    # heading may appear as ## or ### etc
    pat = rf"(?im)^#+\\s*{re.escape(heading)}\\s*$"
    m = re.search(pat, md)
    if not m:
        return None
    rest = md[m.end() :]
    # stop at next heading at same or higher level
    stop = re.search(r"(?im)^#\\s+|^##\\s+|^###\\s+|^####\\s+", rest)
    chunk = rest[: stop.start()] if stop else rest
    chunk = chunk.strip()
    return chunk or None


def add_mode_blob(profile: Dict[str, Any], name: str, text: str, source_ref: str) -> None:
    items = profile.setdefault("semantic_memory", {}).setdefault("items", [])
    if not isinstance(items, list):
        return
    content = text.strip()
    if not content:
        return
    items.append(
        {
            "id": f"mode_blob_{sha_id(name, source_ref)}",
            "type": "procedure",
            "content": content,
            "tags": ["merge", "mode", name],
            "confidence": 0.75,
            "source": {"kind": "mode", "ref": source_ref},
        }
    )


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
    existing = {i.get("content") for i in items if isinstance(i, dict) and isinstance(i.get("content"), str)}
    added = 0
    for s in skills:
        content = f"{s['name']}: {s.get('description','')}".strip()
        if not content or content in existing:
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
        existing.add(content)
        added += 1
    return added


def add_semantic_items(profile: Dict[str, Any], items: List[Dict[str, Any]], tag: str) -> int:
    """
    Append semantic_memory items with de-dupe by content.
    """
    arr = profile.setdefault("semantic_memory", {}).setdefault("items", [])
    if not isinstance(arr, list):
        return 0
    existing = {i.get("content") for i in arr if isinstance(i, dict) and isinstance(i.get("content"), str)}
    added = 0
    for it in items:
        if not isinstance(it, dict):
            continue
        t = str(it.get("type") or "knowledge").strip().lower()
        content = str(it.get("content") or "").strip()
        if not content or content in existing:
            continue
        tags = it.get("tags") if isinstance(it.get("tags"), list) else []
        conf = float(it.get("confidence") or 0.6)
        arr.append(
            {
                "id": f"llm_{t}_{tag}_{sha_id(content)}",
                "type": t if t in ("knowledge", "skill", "concept", "procedure", "policy", "note") else "knowledge",
                "content": content,
                "tags": ["llm", "skillbuilder_deepen", tag] + [str(x) for x in tags if str(x)],
                "confidence": max(0.0, min(1.0, conf)),
                "source": {"kind": "llm", "ref": tag},
            }
        )
        existing.add(content)
        added += 1
    return added


_DEEPEN_SYSTEM = """You are SkillBuilder Skillforge (Deepening Pass).
Goal: deepen an agent profile by proposing additional durable semantic memory items.

Constraints:
- Output must be valid JSON only.
- Do not invent secrets, tokens, or private data.
- Prefer operationally useful, testable skills/procedures/checklists over vague advice.
- Keep items specific and non-redundant with existing content.
- Target: creativity/coaching and tech-guidance competence for the seed persona, plus merged role strengths.

Return JSON schema:
{
  "items": [
    {"type":"skill|procedure|policy|knowledge|note","content":"...", "tags":["..."], "confidence":0.0}
  ]
}
""".strip()


def deepen_with_llm(
    *,
    profile: Dict[str, Any],
    merged_role_texts: List[str],
    model: str,
    passes: int,
    max_items_per_pass: int,
    temperature: float,
    max_tokens: int,
) -> int:
    """
    LLM-based deepening: propose additional semantic items, append-only.
    """
    provider = _env("SEM_AGENT_DEEPENING_PROVIDER", "anthropic").strip().lower()
    total_added = 0
    debug = (_env("SEM_AGENT_DEBUG", "") or "").strip().lower() in ("1", "true", "yes", "on")
    for i in range(max(0, int(passes))):
        # Keep prompt bounded: include only recent items and role guidance.
        existing_items = profile.get("semantic_memory", {}).get("items", [])
        if not isinstance(existing_items, list):
            existing_items = []
        tail = [it for it in existing_items[-30:] if isinstance(it, dict)]
        persona = {
            "id": profile.get("id"),
            "name": profile.get("name"),
            "designation": profile.get("designation"),
            "bio": profile.get("bio"),
            "principles": ((profile.get("personality") or {}).get("style") or {}).get("principles"),
            "capabilities": profile.get("capabilities"),
        }
        def _clip(s: Any, n: int) -> str:
            t = str(s or "")
            return t if len(t) <= n else (t[:n] + "…")

        merged_compact = [_clip(t, 3000) for t in (merged_role_texts[:2] if isinstance(merged_role_texts, list) else [])]
        persona_compact = dict(persona)
        if isinstance((persona_compact.get("bio") or {}), dict):
            persona_compact["bio"] = dict(persona_compact["bio"])
            if "summary" in persona_compact["bio"]:
                persona_compact["bio"]["summary"] = _clip(persona_compact["bio"]["summary"], 1200)

        user = json.dumps(
            {
                "persona": persona_compact,
                "merged_roles": merged_compact,
                "existing_items_tail": tail[:20],
                "request": {
                    "max_items": int(max_items_per_pass),
                    "focus": [
                        "technical troubleshooting and user guidance",
                        "root-cause analysis routines",
                        "devops/ops architecture and observability checklists",
                        "coaching moves that increase user engagement and discovery",
                        "creativity stimulation tactics without taking over",
                    ],
                },
            },
            ensure_ascii=False,
        )
        if provider == "openai":
            obj = _call_openai_json(model=model, system=_DEEPEN_SYSTEM, user=user, max_tokens=max_tokens, temperature=temperature)
        else:
            obj = _call_anthropic_json(model=model, system=_DEEPEN_SYSTEM, user=user, max_tokens=max_tokens, temperature=temperature)
        items = obj.get("items") if isinstance(obj, dict) else None
        if not isinstance(items, list):
            if debug:
                print(f"[sem_agent] deepen pass {i+1}/{passes}: no `items` list in response (keys={list(obj.keys()) if isinstance(obj, dict) else type(obj).__name__})")
            continue
        # Trim to max_items_per_pass
        items = items[: max(0, int(max_items_per_pass))]
        added = add_semantic_items(profile, items, tag=f"opus_pass_{i+1}")
        if debug:
            nonempty = sum(1 for it in items if isinstance(it, dict) and str(it.get("content") or "").strip())
            print(f"[sem_agent] deepen pass {i+1}/{passes}: got_items={len(items)} nonempty={nonempty} added={added}")
        total_added += added
    return total_added


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--persona", required=True, help="Input chrysalis.persona v0.1 JSON")
    ap.add_argument("--skillbuilder-root", required=True, help="Path to SkillBuilder root")
    ap.add_argument("--merge-agent-md", action="append", default=[], help="Chrysalis Agents/*.md to merge as mode blobs (repeatable)")
    ap.add_argument("--merge-agent-json", action="append", default=[], help="Chrysalis Agents/*.json (or similar) to merge as mode blobs (repeatable)")
    ap.add_argument("--merge-role-text", action="append", default=[], help="Ad-hoc role model text to merge as a mode blob (repeatable)")
    ap.add_argument("--out", required=True, help="Output path for Sem*.json")
    ap.add_argument("--offline", action="store_true", help="Use offline SkillBuilder bridge (default)")
    ap.add_argument("--max-passes", type=int, default=8, help="Upper bound on SkillBuilder occupation passes")
    ap.add_argument("--deepening-provider", default="anthropic", help="Deepening provider: anthropic|openai (default: anthropic)")
    ap.add_argument("--deepening-model", default="claude-opus-4-5", help="Model name for deepening passes (default: claude-opus-4-5)")
    ap.add_argument("--deepening-passes", type=int, default=0, help="Number of LLM deepening passes to run (default: 0)")
    ap.add_argument("--deepening-max-items", type=int, default=12, help="Max semantic items per deepening pass")
    ap.add_argument("--deepening-temperature", type=float, default=0.3, help="Deepening temperature")
    ap.add_argument("--deepening-max-tokens", type=int, default=1400, help="Deepening max tokens")
    args = ap.parse_args()

    persona_path = Path(args.persona).expanduser().resolve()
    sem_root = Path(args.skillbuilder_root).expanduser().resolve()
    out_path = Path(args.out).expanduser().resolve()

    profile = read_json(persona_path)

    merged_names: List[str] = []
    merged_role_texts: List[str] = []
    for md_path_s in args.merge_agent_md or []:
        md_path = Path(md_path_s).expanduser().resolve()
        if not md_path.exists():
            continue
        md = read_text(md_path)
        name = md_path.stem
        merged_names.append(name)
        merged_role_texts.append(_strip_frontmatter(md))

        # Store full role text as a procedure blob (durable context).
        add_mode_blob(profile, name, _strip_frontmatter(md), str(md_path))

        # Also lift "Behavioral Mindset" as principles (high signal).
        mindset = _extract_section(md, "Behavioral Mindset")
        if mindset:
            add_principles(profile, [mindset.replace("\n", " ").strip()], tag=name)

    for js_path_s in args.merge_agent_json or []:
        js_path = Path(js_path_s).expanduser().resolve()
        if not js_path.exists():
            continue
        try:
            payload = read_json(js_path)
        except Exception:
            continue
        # Store JSON as a compact blob; prefer name/role/description + key fields if present.
        name = str(payload.get("name") or js_path.stem)
        merged_names.append(js_path.stem)
        blob = json.dumps(payload, ensure_ascii=False, indent=2)
        merged_role_texts.append(blob)
        add_mode_blob(profile, js_path.stem, blob, str(js_path))

        # If the JSON contains a communication_style/philosophy section, lift core_beliefs into principles.
        beliefs: List[str] = []
        ph = payload.get("philosophy") if isinstance(payload, dict) else None
        if isinstance(ph, dict):
            beliefs.extend([str(x) for x in (ph.get("core_beliefs") or []) if str(x)])
        if beliefs:
            add_principles(profile, beliefs[:6], tag=js_path.stem)

    for idx, txt in enumerate(args.merge_role_text or []):
        t = str(txt or "").strip()
        if not t:
            continue
        tag = f"role_text_{idx+1}"
        merged_names.append(tag)
        merged_role_texts.append(t)
        add_mode_blob(profile, tag, t, "adhoc")

    designation = str(profile.get("designation") or profile.get("name") or "Agent").strip()
    occupations: List[str] = [designation]
    for n in merged_names:
        occupations.append(n.replace("-", " ").title())
    if merged_names:
        occupations.append(" + ".join([n.replace("-", " ").title() for n in merged_names] + [designation]))

    # De-dup and cap passes.
    seen = set()
    uniq: List[str] = []
    for o in occupations:
        if o in seen:
            continue
        seen.add(o)
        uniq.append(o)
    occupations = uniq[: max(1, int(args.max_passes))]

    total_added = 0
    for occ in occupations:
        skills = skillbuilder_skills(sem_root, occ, offline=True if args.offline else True)
        tag = occ.lower().replace(" ", "_")[:32]
        total_added += add_skill_items(profile, skills, tag=tag)

    llm_added = 0
    if int(args.deepening_passes or 0) > 0:
        # Allow provider override via env (useful for CI); CLI wins.
        import os

        os.environ["SEM_AGENT_DEEPENING_PROVIDER"] = str(args.deepening_provider or "anthropic").strip().lower()
        llm_added = deepen_with_llm(
            profile=profile,
            merged_role_texts=merged_role_texts,
            model=str(args.deepening_model),
            passes=int(args.deepening_passes),
            max_items_per_pass=int(args.deepening_max_items),
            temperature=float(args.deepening_temperature),
            max_tokens=int(args.deepening_max_tokens),
        )

    meta = profile.setdefault("metadata", {})
    x = meta.setdefault("x_skillbuilder_merge", {})
    x["generated_by"] = "Chrysalis/scripts/sem_agent.py"
    x["skillbuilder_offline"] = True
    x["passes"] = occupations
    x["skills_added"] = total_added
    x["llm_deepening_model"] = str(args.deepening_model)
    x["llm_deepening_provider"] = str(args.deepening_provider)
    x["llm_deepening_passes"] = int(args.deepening_passes or 0)
    x["llm_items_added"] = int(llm_added or 0)
    x["merged_agents"] = merged_names
    x["base_persona"] = str(persona_path)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
