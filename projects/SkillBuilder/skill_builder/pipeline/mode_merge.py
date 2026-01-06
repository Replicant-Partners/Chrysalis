"""
Batch mode merge utilities: neurosymbolic functional clustering + semantic merge + telemetry hooks.

Semantic requirements (updated):
- Cluster existing mode YAMLs using schema.org-aligned functional roles (no embeddings/TF-IDF)
- Cost hierarchy: deepening (same functional + domain) < cross-domain horizontal (same functional, new domain) < intra-domain footprint expansion (same domain, new functional)
- Merge with minimal skill loss: concatenate text fields, union groups/skills
- Emit telemetry with role assignments, cost-derived similarity, provider="schema-role" (no embedding events)
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Optional

import yaml

from skill_builder.pipeline.telemetry import TelemetryEvent, TelemetryWriter
from skill_builder.pipeline.sanitizer import sanitize_for_prompt
from skill_builder.pipeline.synthesis import _call_llm_api, _has_llm_api


@dataclass(frozen=True)
class ModeBatchMergeSpec:
    """Specification for batch mode merging."""

    mode_folder: Path
    target_mode_count: int
    role_map_path: Path = Path("config/role-map.yaml")
    enable_role_tagging: bool = True
    role_tagging_prompt: Optional[str] = None
    output_dir: Path = Path("ExistingModes/MergedJTG")
    telemetry_dir: Path = Path(".roo/runs")
    max_cluster_size: int = 10
    run_id: Optional[str] = None


def _stringify_skills(raw_skills: Any) -> list[str]:
    if raw_skills is None:
        return []
    skills_list: list[dict[str, Any]]
    if isinstance(raw_skills, dict):
        skills_list = [
            {"name": k, "description": v} if isinstance(v, str) else {"name": k, **(v or {})}
            for k, v in raw_skills.items()
        ]
    elif isinstance(raw_skills, list):
        skills_list = [s for s in raw_skills if isinstance(s, dict)]
    else:
        return []

    text_parts: list[str] = []
    for s in skills_list:
        name = str(s.get("name") or s.get("skill") or "").strip()
        desc = str(s.get("description", "")).strip()
        fragments = [p for p in (name, desc) if p]
        if fragments:
            text_parts.append(" - ".join(fragments))
    return text_parts


def _load_yaml_modes(folder: Path) -> list[dict[str, Any]]:
    modes: list[dict[str, Any]] = []
    for path in sorted(folder.glob("**/*")):
        if path.suffix.lower() not in {".yaml", ".yml"}:
            continue
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
        slug = raw.get("slug") or raw.get("name") or path.stem
        name = raw.get("name") or slug
        skills_text = _stringify_skills(raw.get("skills"))
        text_parts = [
            str(name),
            str(raw.get("description", "")),
            str(raw.get("roleDefinition", "")),
            str(raw.get("whenToUse", "")),
            str(raw.get("customInstructions", "")),
            "\n".join(skills_text) if skills_text else "",
        ]
        modes.append(
            {
                "slug": slug,
                "name": name,
                "data": raw,
                "path": path,
                "text": "\n\n".join(tp for tp in text_parts if tp).strip(),
            }
        )
    return modes


def _augment_modes_with_role_tags(
    modes: list[dict[str, Any]],
    enable: bool,
    prompt_override: Optional[str],
    telemetry: Optional[TelemetryWriter],
) -> None:
    if not enable or not modes:
        return
    if not _has_llm_api():
        if telemetry:
            telemetry.emit(TelemetryEvent(
                "batch_merge.role_tag.skip",
                data={"reason": "no-llm"},
            ))
        return
    for m in modes:
        slug = m.get("slug", "")
        desc = m.get("data", {}).get("description", "")
        augmented = _tag_schema_role(slug, desc, prompt_override, telemetry)
        if augmented:
            m["data"]["description"] = augmented
            # keep text field aligned for clustering inputs
            text_parts = [
                str(m["data"].get("name", slug)),
                augmented,
                str(m["data"].get("roleDefinition", "")),
                str(m["data"].get("whenToUse", "")),
                str(m["data"].get("customInstructions", "")),
            ]
            m["text"] = "\n\n".join(tp for tp in text_parts if tp).strip()
            if telemetry:
                telemetry.emit(TelemetryEvent(
                    "batch_merge.role_tag.ok",
                    data={"slug": slug},
                ))
        else:
            if telemetry:
                telemetry.emit(TelemetryEvent(
                    "batch_merge.role_tag.miss",
                    data={"slug": slug},
                ))


def _normalize_skill_key(skill: dict[str, Any]) -> str:
    name = str(skill.get("name") or skill.get("skill") or "").strip().lower()
    desc = str(skill.get("description", "")).strip().lower()
    return f"{name}::{desc}" if desc else name


def _dedupe_skills(skills: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for skill in skills:
        key = _normalize_skill_key(skill)
        if key in seen:
            continue
        seen.add(key)
        merged.append(skill)
    return merged


def _synthesize_cluster_with_llm(cluster_modes: list[dict[str, Any]], idx: int, telemetry: Optional[TelemetryWriter]) -> dict[str, Any]:
    """LLM-based merge: regenerate key fields using functional buckets and role tags."""

    if not _has_llm_api():
        return {}

    # Prepare concatenated snippets with provenance
    snippets = []
    for i, m in enumerate(cluster_modes, start=1):
        d = m["data"]
        parts = [
            f"name: {d.get('name','')} (slug: {d.get('slug', m['slug'])})",
            f"description: {d.get('description','')}",
            f"roleDefinition: {d.get('roleDefinition','')}",
            f"whenToUse: {d.get('whenToUse','')}",
            f"customInstructions: {d.get('customInstructions','')}",
        ]
        snippets.append(f"[M{i}]\n" + "\n".join(parts))

    prompt = f"""
You are a merge/synthesis model. Merge mode definitions without losing information.

Inputs (with provenance IDs):
{chr(10).join(snippets)}

Requirements:
- Use functional buckets and schema.org role tags present in the inputs; when merging, keep role signals explicit.
- Regenerate the following fields by synthesizing ALL input content: description, roleDefinition, whenToUse, customInstructions.
- Do NOT drop unique details; if conflicts, keep both and note them.
- Preserve groups (union) and skills (union with dedup by name+description).
- If generation fails or yields empty fields, the caller will fall back to lossless concatenation; do not truncate.
- Return JSON with keys: description, roleDefinition, whenToUse, customInstructions.
"""

    prompt = sanitize_for_prompt(prompt, max_length=None)

    start = None
    try:
        import time
        start = time.perf_counter()
        result_text = _call_llm_api(prompt, max_tokens=2000)
        duration_ms = (time.perf_counter() - start) * 1000 if start else None
        if telemetry:
            telemetry.emit(TelemetryEvent(
                "batch_merge.llm.request",
                data={
                    "cluster": idx,
                    "duration_ms": duration_ms,
                    "prompt_chars": len(prompt),
                    "max_tokens": 2000,
                    "token_cost": None,  # placeholder until provider returns tokens
                },
            ))
    except Exception as e:
        result_text = ""
        duration_ms = None
        if telemetry:
            telemetry.emit(TelemetryEvent(
                "batch_merge.llm.error",
                data={"cluster": idx, "error": str(e)},
            ))

    if not result_text:
        if telemetry:
            telemetry.emit(TelemetryEvent(
                "batch_merge.llm.empty",
                data={"cluster": idx, "duration_ms": duration_ms},
            ))
        return None

    try:
        cleaned = result_text.strip()
        if cleaned.startswith("```"):
            parts = cleaned.split("```")
            if len(parts) >= 2:
                cleaned = parts[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
        payload = json.loads(cleaned)
    except Exception as e:
        if telemetry:
            telemetry.emit(TelemetryEvent(
                "batch_merge.llm.parse_error",
                data={"cluster": idx, "error": str(e)},
            ))
        return None

    if telemetry:
        telemetry.emit(TelemetryEvent(
            "batch_merge.llm.ok",
            data={
                "cluster": idx,
                "duration_ms": duration_ms,
                "prompt_chars": len(prompt),
                "response_chars": len(result_text),
                "token_cost": None,  # placeholder until provider returns tokens
                "has_description": bool(payload.get("description")),
                "has_roleDefinition": bool(payload.get("roleDefinition")),
                "has_whenToUse": bool(payload.get("whenToUse")),
                "has_customInstructions": bool(payload.get("customInstructions")),
            },
        ))

    return payload if isinstance(payload, dict) else None


def _merge_cluster_modes(cluster_modes: list[dict[str, Any]], cluster_idx: int, telemetry: Optional[TelemetryWriter]) -> dict[str, Any]:
    representative = cluster_modes[0]["data"]

    # Skills/groups/flags union (lossless)
    groups: set[str] = set()
    all_skills: list[dict[str, Any]] = []
    source_files: list[str] = []
    auto_governance = False
    execution_policy = False

    for m in cluster_modes:
        data = m["data"]
        groups.update(data.get("groups", []) or [])
        skills = data.get("skills", []) or []
        if isinstance(skills, dict):
            skills = [
                {"name": k, "description": v} if isinstance(v, str) else {"name": k, **(v or {})}
                for k, v in skills.items()
            ]
        for s in skills:
            if isinstance(s, dict):
                all_skills.append(s)
        source_files.append(str(m["path"]))
        auto_governance = auto_governance or bool(data.get("autoGovernance"))
        execution_policy = execution_policy or bool(data.get("executionPolicy"))

    merged_skills = _dedupe_skills(all_skills)

    slug = representative.get("slug") or representative.get("name") or cluster_modes[0]["slug"]
    name = representative.get("name") or slug

    llm_fields: dict[str, Any] | None = None
    if _has_llm_api():
        llm_fields = _synthesize_cluster_with_llm(cluster_modes, cluster_idx, telemetry)

    def fallback(field: str) -> str:
        if llm_fields and llm_fields.get(field):
            return str(llm_fields[field])
        parts = [m["data"].get(field, "") for m in cluster_modes if m["data"].get(field)]
        if parts:
            return "\n\n---\n\n".join(map(str, parts))
        return representative.get(field, "")

    merged: dict[str, Any] = {
        "slug": slug,
        "name": name,
        "description": fallback("description"),
        "roleDefinition": fallback("roleDefinition"),
        "whenToUse": fallback("whenToUse"),
        "customInstructions": fallback("customInstructions"),
        "groups": sorted(groups),
        "skills": merged_skills,
        "sourceFiles": source_files,
    }

    if auto_governance:
        merged["autoGovernance"] = True
    if execution_policy:
        merged["executionPolicy"] = True

    return merged


def _tag_schema_role(slug: str, description: str, prompt_override: Optional[str], telemetry: Optional[TelemetryWriter]) -> Optional[str]:
    """Call LLM to append schema.org Occupation tagging to a description.

    Returns augmented description or None on failure.
    """
    if not _has_llm_api():
        return None

    prompt = prompt_override or (
        "You are an expert job classification specialist working with schema.org structured data. "
        "Analyze the provided job role from a Roo Code mode YAML file and map it to standardized schema.org Occupation format. "
        "The mode file contains role definitions with fields like name, description, systemPrompt, tools, and model preferences. "
        "Extract the core job responsibilities, required skills, experience levels, and qualifications. "
        "Then create a standardized Occupation entry with proper schema.org types, including alternative similar roles for career matching. "
        "Focus on the semantic meaning of the role rather than just keywords, and ensure the output maintains the structured format expected by HR systems and job boards that use schema.org for job postings and role classifications."
    )

    merged_prompt = sanitize_for_prompt(
        f"slug: {slug}\n\nDescription:\n{description}\n\n---\n{prompt}",
        max_length=None,
    )

    try:
        import time
        start = time.perf_counter()
        result_text = _call_llm_api(merged_prompt, max_tokens=600)
        duration_ms = (time.perf_counter() - start) * 1000
        if telemetry:
            telemetry.emit(TelemetryEvent(
                "batch_merge.role_tag.request",
                data={"slug": slug, "duration_ms": duration_ms, "chars": len(merged_prompt)},
            ))
    except Exception as e:
        if telemetry:
            telemetry.emit(TelemetryEvent(
                "batch_merge.role_tag.error",
                data={"slug": slug, "error": str(e)},
            ))
        return None

    if not result_text:
        if telemetry:
            telemetry.emit(TelemetryEvent(
                "batch_merge.role_tag.empty",
                data={"slug": slug},
            ))
        return None

    cleaned = result_text.strip()
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        if len(parts) >= 2:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]

    augmented = f"{description}\n\n[Schema.org Occupation]\n{cleaned.strip()}" if description else cleaned.strip()

    return augmented if augmented.strip() else None


def _load_role_map(path: Path) -> dict[str, dict[str, str]]:
    """Load schema.org-aligned role map: slug -> {functional, domain, occupation}.

    Missing or unreadable files return an empty map; callers must handle defaults.
    """
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    roles = raw.get("roles") or raw
    if not isinstance(roles, dict):
        return {}
    return {
        str(k): {
            "functional": str(v.get("functional", "unknown")),
            "domain": str(v.get("domain", "unknown")),
            "occupation": str(v.get("occupation", "")),
        }
        for k, v in roles.items()
        if isinstance(v, dict)
    }


def _role_fields(slug: str, role_map: dict[str, dict[str, str]]) -> tuple[str, str]:
    entry = role_map.get(slug) or {}
    return entry.get("functional", "unknown"), entry.get("domain", "unknown")


def _role_cost(a_slug: str, b_slug: str, role_map: dict[str, dict[str, str]]) -> float:
    a_func, a_dom = _role_fields(a_slug, role_map)
    b_func, b_dom = _role_fields(b_slug, role_map)

    if a_func == b_func and a_dom == b_dom:
        return 1.0  # deepening (easiest)
    if a_func == b_func and a_dom != b_dom:
        return 3.0  # cross-domain horizontal (3x easier than intra-domain expansion)
    if a_func != b_func and a_dom == b_dom:
        return 9.0  # intra-domain footprint expansion (hardest)
    return 9.0  # default worst-case when both differ


def _cost_to_similarity(cost: float) -> float:
    # Bounded [0,1]; monotone decreasing with cost
    return 1.0 / (1.0 + cost)


def _cluster_modes_role_based(
    modes: list[dict[str, Any]],
    target_clusters: int,
    max_cluster_size: int,
    role_map: dict[str, dict[str, str]],
    telemetry: Optional[TelemetryWriter],
) -> tuple[list[int], list[list[float]], str, str, Optional[str]]:
    n = len(modes)
    if n == 0:
        return [], [], "schema-role", "functional-cost-v1", None

    # Precompute cost and similarity matrices
    costs: list[list[float]] = [[0.0 for _ in range(n)] for _ in range(n)]
    similarity: list[list[float]] = [[1.0 for _ in range(n)] for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            c = _role_cost(modes[i]["slug"], modes[j]["slug"], role_map)
            costs[i][j] = costs[j][i] = c
            sim = _cost_to_similarity(c)
            similarity[i][j] = similarity[j][i] = sim

    k = min(max(1, target_clusters), n)
    labels: list[int] = [-1] * n

    # Initialize cluster centers deterministically (first k modes)
    centers = list(range(k))
    for idx, center in enumerate(centers):
        labels[center] = idx

    def cluster_size(label: int) -> int:
        return sum(1 for l in labels if l == label)

    def assign(idx: int) -> int:
        best_label = None
        best_cost = None
        for center_idx, center in enumerate(centers):
            label = labels[center]
            if cluster_size(label) >= max_cluster_size:
                continue
            c = costs[idx][center]
            if best_cost is None or c < best_cost:
                best_cost = c
                best_label = label
        if best_label is not None:
            return best_label
        # All clusters full: place into smallest cluster
        unique_labels = sorted(set(labels))
        smallest = min(unique_labels, key=lambda lbl: cluster_size(lbl))
        return smallest

    for idx in range(n):
        if labels[idx] != -1:
            continue
        labels[idx] = assign(idx)

    provider = "schema-role"
    model_used = "functional-cost-v1"
    fallback_reason = None

    if telemetry:
        telemetry.emit(TelemetryEvent(
            "batch_merge.role_map",
            data={
                "provider": provider,
                "model": model_used,
                "roles_loaded": len(role_map),
                "defaulted": len([m for m in modes if m["slug"] not in role_map]),
            },
        ))

    return labels, similarity, provider, model_used, fallback_reason


def _average_similarity(matrix: list[list[float]]) -> float:
    if not matrix:
        return 0.0
    n = len(matrix)
    if n <= 1:
        return 1.0
    vals: list[float] = []
    for i in range(n):
        for j in range(i + 1, n):
            vals.append(matrix[i][j])
    return float(sum(vals) / len(vals)) if vals else 0.0


def _hash_outputs(outputs: list[dict[str, Any]]) -> str:
    serialized = json.dumps(outputs, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def _slug_to_filename(slug: Optional[str], idx: int) -> str:
    if slug:
        safe = slug.strip().replace(" ", "-")
        if safe:
            return f"{safe}.yaml"
    return f"merged-{idx}.yaml"


def run_batch_mode_merge(spec: ModeBatchMergeSpec) -> dict[str, Any]:
    run_id = spec.run_id or str(uuid.uuid4())
    modes = _load_yaml_modes(spec.mode_folder)
    role_map = _load_role_map(spec.role_map_path)
    _augment_modes_with_role_tags(modes, spec.enable_role_tagging, spec.role_tagging_prompt, None)
    spec.output_dir.mkdir(parents=True, exist_ok=True)

    telemetry_path = spec.telemetry_dir / run_id / "batch_merge.jsonl"
    telemetry_path.parent.mkdir(parents=True, exist_ok=True)

    with TelemetryWriter(telemetry_path) as tel:
        tel.emit(TelemetryEvent(
            "batch_merge.start",
            data={
            "run_id": run_id,
            "total_inputs": len(modes),
            "target_count": spec.target_mode_count,
            "cluster_model": "schema-role",
            "mode_folder": str(spec.mode_folder),
        },
    ))

        labels, similarity, provider, model_used, fallback_reason = _cluster_modes_role_based(
            modes,
            target_clusters=spec.target_mode_count,
            max_cluster_size=spec.max_cluster_size,
            role_map=role_map,
            telemetry=tel,
        )

        clusters: dict[int, list[int]] = {}
        for idx, lbl in enumerate(labels):
            clusters.setdefault(lbl, []).append(idx)

        # Emit ML hooks: assignments + top similarity pairs for each mode
        for idx, lbl in enumerate(labels):
            scores = [
                {"mode": modes[j]["slug"], "score": float(similarity[idx][j])}
                for j in range(len(modes))
                if j != idx
            ]
            scores.sort(key=lambda x: x["score"], reverse=True)
            tel.emit(TelemetryEvent(
                "batch_merge.assignment",
                data={
                    "run_id": run_id,
                    "mode": modes[idx]["slug"],
                    "cluster": int(lbl),
                    "top_similar": scores[:5],
                },
            ))

        merged_outputs: list[dict[str, Any]] = []
        per_cluster_sizes: list[int] = []
        per_cluster_skill_counts: list[dict[str, int]] = []

        for cluster_idx, member_indices in sorted(clusters.items(), key=lambda kv: kv[0]):
            cluster_modes = [modes[i] for i in member_indices]
            merged = _merge_cluster_modes(cluster_modes, cluster_idx, tel)
            merged_outputs.append(merged)
            per_cluster_sizes.append(len(cluster_modes))
            per_cluster_skill_counts.append(
                {
                    "cluster": int(cluster_idx),
                    "input_skills": sum(len(m["data"].get("skills", []) or []) for m in cluster_modes),
                    "unique_skills": len(merged.get("skills", [])),
                }
            )

            tel.emit(TelemetryEvent(
                "batch_merge.cluster",
                data={
                    "run_id": run_id,
                    "cluster": int(cluster_idx),
                    "size": len(cluster_modes),
                    "avg_similarity": _average_similarity([[similarity[i][j] for j in member_indices] for i in member_indices]),
                    "skills": per_cluster_skill_counts[-1],
                    "has_description": bool(merged.get("description")),
                    "has_roleDefinition": bool(merged.get("roleDefinition")),
                    "has_whenToUse": bool(merged.get("whenToUse")),
                    "has_customInstructions": bool(merged.get("customInstructions")),
                },
            ))

        outputs_hash = _hash_outputs(merged_outputs)

        # Write outputs
        written_files: list[str] = []
        for idx, merged in enumerate(merged_outputs, start=1):
            fname = _slug_to_filename(merged.get("slug"), idx)
            out_path = spec.output_dir / fname
            with open(out_path, "w", encoding="utf-8") as f:
                yaml.safe_dump(merged, f, sort_keys=False, allow_unicode=True)
            written_files.append(str(out_path))
            tel.emit(TelemetryEvent(
                "batch_merge.write",
                data={
                    "run_id": run_id,
                    "file": str(out_path),
                    "slug": merged.get("slug"),
                    "name": merged.get("name"),
                    "has_description": bool(merged.get("description")),
                    "has_roleDefinition": bool(merged.get("roleDefinition")),
                    "has_whenToUse": bool(merged.get("whenToUse")),
                    "has_customInstructions": bool(merged.get("customInstructions")),
                    "skills_count": len(merged.get("skills") or []),
                },
            ))

        tel.emit(TelemetryEvent(
            "batch_merge.done",
            data={
                "run_id": run_id,
                "target_count": spec.target_mode_count,
                "actual_clusters": len(merged_outputs),
                "per_cluster_size": per_cluster_sizes,
                "avg_similarity": _average_similarity(similarity),
                "skill_merge_counts": per_cluster_skill_counts,
                "outputs_hash": outputs_hash,
                "written_files": written_files,
                "embedding_provider": provider,
                "embedding_model": model_used,
                "embedding_fallback_reason": fallback_reason,
            },
        ))

    return {
        "run_id": run_id,
        "total_inputs": len(modes),
        "cluster_count": len(merged_outputs),
        "written_files": written_files,
        "outputs_hash": outputs_hash,
        "telemetry_path": str(telemetry_path),
    }
