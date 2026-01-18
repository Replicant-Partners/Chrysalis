#!/usr/bin/env python3
import argparse
import json
import math
import pathlib
import re
from typing import Any, Dict, List, Optional, Tuple

ROOT = pathlib.Path(__file__).resolve().parents[2]
DEFAULT_RUNS = ROOT / "results" / "eval-suite" / "runs"
DEFAULT_SUMMARIES = ROOT / "results" / "eval-suite" / "summaries"
DEFAULT_RUBRIC = ROOT / "eval" / "scoring" / "rubric.json"


def load_json(path: pathlib.Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def safe_number(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def extract_json(text: str) -> Optional[dict]:
    text = text.strip()
    if not text:
        return None
    if text.startswith("{") and text.endswith("}"):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    # Try to extract first JSON object
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    snippet = match.group(0)
    try:
        return json.loads(snippet)
    except json.JSONDecodeError:
        return None


def score_latency(latency_ms: float, rubric: dict) -> int:
    thresholds = rubric["response_time_scoring_ms"]["thresholds"]
    scores = rubric["response_time_scoring_ms"]["scores"]
    for idx, threshold in enumerate(thresholds):
        if latency_ms <= threshold:
            return scores[idx]
    return scores[-1]


def compare_numbers(actual: float, expected: float, tol_abs: float, tol_pct: float) -> bool:
    if math.isclose(actual, expected, abs_tol=tol_abs):
        return True
    if expected != 0 and abs((actual - expected) / expected) * 100.0 <= tol_pct:
        return True
    return False


def score_mode1(response: dict, expected: dict, rubric: dict) -> Tuple[float, float, float, float, float]:
    tol_abs = rubric["accuracy_tolerance"]["numeric_abs"]
    tol_pct = rubric["accuracy_tolerance"]["numeric_pct"]
    metrics_expected = expected.get("metrics", {})
    metrics_actual = response.get("metrics", {})

    numeric_hits = 0
    numeric_total = 0
    for key, exp_value in metrics_expected.items():
        numeric_total += 1
        actual_value = safe_number(metrics_actual.get(key))
        if actual_value is None:
            continue
        if compare_numbers(actual_value, exp_value, tol_abs, tol_pct):
            numeric_hits += 1

    accuracy_score = 5 * (numeric_hits / numeric_total) if numeric_total else 0

    experiments = response.get("experiments", [])
    process_score = 5 if isinstance(experiments, list) and len(experiments) >= expected.get("required_experiments", 1) else 2

    logic_score = 5 if numeric_hits == numeric_total else 3 if numeric_hits > 0 else 1
    semantics_score = 4 if response.get("coach_actions") else 2
    metacog_score = 5 if response.get("self_check") else 0

    return logic_score, semantics_score, process_score, metacog_score, accuracy_score


def score_mode2(response: dict, expected: dict, rubric: dict) -> Tuple[float, float, float, float, float]:
    expected_registry = expected.get("registry_status", {})
    registry_checks = response.get("registry_checks", [])
    registry_map = {}
    if isinstance(registry_checks, list):
        for item in registry_checks:
            rid = item.get("registry_id")
            if rid:
                registry_map[rid] = item.get("status")

    hits = 0
    total = len(expected_registry)
    for rid, status in expected_registry.items():
        if str(registry_map.get(rid, "")).lower() == status:
            hits += 1

    dora_expected = expected.get("dora_classification", {})
    dora_actual = response.get("dora_classification", {})
    dora_hits = 0
    dora_total = len(dora_expected)
    for rid, status in dora_expected.items():
        if str(dora_actual.get(rid, "")).lower() == status:
            dora_hits += 1

    tol_abs = rubric["accuracy_tolerance"]["numeric_abs"]
    tol_pct = rubric["accuracy_tolerance"]["numeric_pct"]

    accuracy_hits = hits + dora_hits
    accuracy_total = total + dora_total

    expected_compliance = expected.get("compliance_score_pct")
    if expected_compliance is not None:
        accuracy_total += 1
        actual_compliance = safe_number(response.get("compliance_score_pct"))
        if actual_compliance is not None and compare_numbers(actual_compliance, expected_compliance, tol_abs, tol_pct):
            accuracy_hits += 1

    expected_quality = expected.get("process_quality_rating")
    if expected_quality:
        accuracy_total += 1
        actual_quality = str(response.get("process_quality_rating", "")).lower()
        if actual_quality == expected_quality:
            accuracy_hits += 1

    accuracy_score = 5 * (accuracy_hits / max(accuracy_total, 1))
    process_score = 5 if len(registry_map) >= total else 3
    semantics_score = 5 if len(registry_map) >= 4 else 2
    metacog_score = 5 if response.get("self_check") else 0
    logic_score = 4 if response.get("process_quality_rating") else 2

    return logic_score, semantics_score, process_score, metacog_score, accuracy_score


def score_mode3(response: dict, expected: dict, rubric: dict) -> Tuple[float, float, float, float, float]:
    why_chain = response.get("why_chain", [])
    why_len = len(why_chain) if isinstance(why_chain, list) else 0
    expected_len = expected.get("why_chain_length", 5)
    expected_registry_min = expected.get("adjacent_registry_min", 0)
    registries = response.get("adjacent_registry_targets", [])
    registry_count = len(registries) if isinstance(registries, list) else 0
    registry_ok = registry_count >= expected_registry_min

    accuracy_score = 5 if why_len == expected_len and registry_ok else 2
    process_score = 5 if why_len == expected_len and registry_ok else 2
    semantics_score = 4 if response.get("adjacent_registry_targets") else 2
    metacog_score = 5 if response.get("self_check") else 0
    logic_score = 4 if response.get("root_cause") else 2

    return logic_score, semantics_score, process_score, metacog_score, accuracy_score


def score_mode4(response: dict, expected: dict, rubric: dict) -> Tuple[float, float, float, float, float]:
    prompt_updates = response.get("prompt_updates", [])
    prompt_ids = set()
    if isinstance(prompt_updates, list):
        prompt_ids = {item.get("prompt_id") for item in prompt_updates if item.get("prompt_id")}

    required = set(expected.get("required_prompt_updates", []))
    process_updates = response.get("process_updates", [])
    process_updates_min = expected.get("process_updates_min", 0)
    process_updates_ok = isinstance(process_updates, list) and len(process_updates) >= process_updates_min

    diagram_required = expected.get("diagram_required", False)
    diagram_ok = bool(response.get("diagram_mermaid")) if diagram_required else True

    accuracy_score = 5 if required.issubset(prompt_ids) and process_updates_ok and diagram_ok else 2
    process_score = 5 if prompt_updates and process_updates_ok and diagram_ok else 2
    semantics_score = 4 if response.get("synthesis") else 2
    metacog_score = 5 if response.get("self_check") else 0
    logic_score = 4 if response.get("learning_metric") else 2

    return logic_score, semantics_score, process_score, metacog_score, accuracy_score


def score_combined(response: dict, expected: dict, rubric: dict) -> Tuple[float, float, float, float, float]:
    # Reuse Mode1 + Mode2 checks for combined
    mode1_resp = response.get("mode1", {})
    mode2_resp = response.get("mode2", {})
    mode1_expected = {"metrics": expected.get("mode1_metrics", {})}
    mode2_expected = {"registry_status": expected.get("mode2_registry_status", {})}

    l1, s1, p1, m1, a1 = score_mode1(mode1_resp, mode1_expected, rubric)
    l2, s2, p2, m2, a2 = score_mode2(mode2_resp, mode2_expected, rubric)

    logic = (l1 + l2) / 2
    semantics = (s1 + s2) / 2
    process = (p1 + p2) / 2
    metacog = (m1 + m2) / 2
    accuracy = (a1 + a2) / 2

    diagram_required = expected.get("diagram_required", False)
    if diagram_required and not response.get("diagram_mermaid"):
        process = min(process, 2)
        accuracy = min(accuracy, 2)

    return (
        logic,
        semantics,
        process,
        metacog,
        accuracy,
    )


def score_response(prompt_id: str, response: dict, expected: dict, rubric: dict) -> Dict[str, float]:
    if prompt_id == "mode1_manager":
        logic, semantics, process, metacog, accuracy = score_mode1(response, expected, rubric)
    elif prompt_id == "mode2_process_analyst":
        logic, semantics, process, metacog, accuracy = score_mode2(response, expected, rubric)
    elif prompt_id == "mode3_root_cause":
        logic, semantics, process, metacog, accuracy = score_mode3(response, expected, rubric)
    elif prompt_id == "mode4_complex_learner":
        logic, semantics, process, metacog, accuracy = score_mode4(response, expected, rubric)
    elif prompt_id == "mode_combined":
        logic, semantics, process, metacog, accuracy = score_combined(response, expected, rubric)
    else:
        logic = semantics = process = metacog = accuracy = 0

    return {
        "logic": round(logic, 2),
        "semantics": round(semantics, 2),
        "process_adherence": round(process, 2),
        "metacognition": round(metacog, 2),
        "accuracy": round(accuracy, 2)
    }


def summarize_scores(scores: List[Dict[str, float]]) -> Dict[str, float]:
    if not scores:
        return {}
    totals = {"logic": 0, "semantics": 0, "process_adherence": 0, "metacognition": 0, "accuracy": 0, "response_time": 0}
    for score in scores:
        for key in totals:
            totals[key] += score.get(key, 0)
    return {key: round(totals[key] / len(scores), 2) for key in totals}


def main() -> int:
    parser = argparse.ArgumentParser(description="Score Chrysalis eval suite results")
    parser.add_argument("--runs", default=str(DEFAULT_RUNS), help="Directory containing run result JSON files")
    parser.add_argument("--rubric", default=str(DEFAULT_RUBRIC))
    parser.add_argument("--output", default=str(DEFAULT_SUMMARIES / "summary.json"))
    args = parser.parse_args()

    runs_dir = pathlib.Path(args.runs)
    output_path = pathlib.Path(args.output)
    summary_dir = output_path.parent
    summary_dir.mkdir(parents=True, exist_ok=True)

    rubric = load_json(pathlib.Path(args.rubric))

    summary = {
        "runs": [],
        "overall": {}
    }

    all_task_scores: List[Dict[str, float]] = []

    for run_file in sorted(runs_dir.glob("*.json")):
        run_data = load_json(run_file)
        model_name = run_data.get("metadata", {}).get("model", run_file.stem)
        task_results = run_data.get("result", []) if run_data.get("taskType") == "batch" else []

        model_entry = {
            "model": model_name,
            "run_file": str(run_file),
            "tasks": []
        }

        for task_result in task_results:
            prompt_id = task_result.get("metadata", {}).get("promptId", "")
            expected = task_result.get("metadata", {}).get("expected", {})
            response_text = task_result.get("result", {}).get("response", "")
            response_json = extract_json(response_text)

            scores = score_response(prompt_id, response_json or {}, expected, rubric)

            latency_ms = task_result.get("result", {}).get("latencyMs")
            if latency_ms is None:
                latency_ms = task_result.get("telemetry", {}).get("durationMs", 0)
            scores["response_time"] = score_latency(float(latency_ms), rubric)

            all_task_scores.append(scores)

            model_entry["tasks"].append({
                "promptId": prompt_id,
                "latencyMs": latency_ms,
                "scores": scores,
                "responseParsed": response_json is not None
            })

        model_entry["summary"] = summarize_scores([t["scores"] for t in model_entry["tasks"]])
        summary["runs"].append(model_entry)

    summary["overall"] = summarize_scores(all_task_scores)

    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)
        handle.write("\n")

    # Also write a markdown summary
    md_path = output_path.with_suffix(".md")
    with md_path.open("w", encoding="utf-8") as handle:
        handle.write("# Evaluation Summary\n\n")
        handle.write("## Overall Scores\n\n")
        for key, value in summary["overall"].items():
            handle.write(f"- {key}: {value}\n")
        handle.write("\n## Per-Model Summary\n\n")
        for run in summary["runs"]:
            handle.write(f"- {run['model']}: {run['summary']}\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
