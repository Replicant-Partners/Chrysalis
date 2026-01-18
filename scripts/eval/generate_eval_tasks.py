#!/usr/bin/env python3
import argparse
import json
import os
import pathlib
import re
import subprocess
import sys
from typing import Dict, List, Optional

ROOT = pathlib.Path(__file__).resolve().parents[2]

DEFAULT_PROMPT_MANIFEST = ROOT / "eval" / "prompts" / "prompt_manifest.json"
DEFAULT_BENCHMARKS = ROOT / "eval" / "benchmarks" / "benchmarks.json"
LOCAL_TASKS_DIR = ROOT / "eval" / "tasks" / "local"
BENCH_TASKS_DIR = ROOT / "eval" / "tasks" / "benchmarks"
HEALTH_TASKS_DIR = ROOT / "eval" / "tasks" / "health"
RESPONSES_DIR = pathlib.Path("results") / "eval-suite" / "responses"

EXCLUDE_NAME_TOKENS = [
    "embed", "embedding", "bge-", "nomic-embed", "mxbai-embed",  # Embedding models
    "r1", "-r1:", "o1", "qwq", "deepthink", "thinking"  # Reasoning models (too slow on CPU)
]


def run_ollama_list() -> str:
    proc = subprocess.run(
        ["ollama", "list"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return proc.stdout


def parse_size_to_gb(size_str: str) -> Optional[float]:
    match = re.search(r"([0-9.]+)\s*(GB|MB)", size_str.strip(), re.IGNORECASE)
    if not match:
        return None
    value = float(match.group(1))
    unit = match.group(2).upper()
    if unit == "GB":
        return value
    if unit == "MB":
        return value / 1024.0
    return None


def parse_ollama_list(output: str) -> tuple[List[Dict[str, object]], List[Dict[str, object]]]:
    lines = [line for line in output.splitlines() if line.strip()]
    if not lines:
        return []
    models: List[Dict[str, object]] = []
    excluded: List[Dict[str, object]] = []
    for line in lines[1:]:
        parts = re.split(r"\s{2,}", line.strip())
        if len(parts) < 3:
            continue
        name, _model_id, size = parts[0], parts[1], parts[2]
        size_gb = parse_size_to_gb(size)
        if size_gb is None:
            continue
        lower = name.lower()
        if any(token in lower for token in EXCLUDE_NAME_TOKENS):
            excluded.append({"name": name, "size_gb": size_gb, "reason": "excluded_token"})
            continue
        models.append({"name": name, "size_gb": size_gb})
    return models, excluded


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", text)
    slug = slug.strip("-").lower()
    return slug


def load_json(path: pathlib.Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_prompt_text(prompt_path: pathlib.Path) -> str:
    with prompt_path.open("r", encoding="utf-8") as handle:
        return handle.read().strip() + "\n"


def ensure_dirs() -> None:
    LOCAL_TASKS_DIR.mkdir(parents=True, exist_ok=True)
    BENCH_TASKS_DIR.mkdir(parents=True, exist_ok=True)
    HEALTH_TASKS_DIR.mkdir(parents=True, exist_ok=True)
    RESPONSES_DIR.mkdir(parents=True, exist_ok=True)


def build_evaluate_task(
    model_provider: str,
    model_name: str,
    prompt: dict,
    prompt_text: str,
    model_meta: dict,
) -> dict:
    model_block = {
        "provider": model_provider,
        "name": model_name,
    }
    if model_meta.get("endpoint"):
        model_block["endpoint"] = model_meta["endpoint"]
    api_key_env = model_meta.get("apiKeyEnv")
    if api_key_env:
        model_block["apiKeyEnv"] = api_key_env

    model_slug = slugify(model_meta.get("id") or model_name)
    prompt_id = prompt["id"]
    output_path = str((RESPONSES_DIR / model_slug / f"{prompt_id}.md").as_posix())

    return {
        "type": "evaluate",
        "name": f"{prompt['title']} ({model_meta.get('displayName', model_name)})",
        "prompt": prompt_text,
        "model": model_block,
        "parameters": {
            "temperature": 0.2,
            "maxTokens": 1600,
            "topP": 0.9
        },
        "options": {
            "outputPath": output_path,
            "includeMetadata": True,
            "timeoutMs": 90000
        },
        "metadata": {
            "mode": prompt["mode"],
            "promptId": prompt_id,
            "rubricId": prompt.get("rubricId"),
            "expected": prompt.get("expected"),
            "modelDisplayName": model_meta.get("displayName", model_name),
            "modelSizeGB": model_meta.get("size_gb")
        }
    }


def write_task_file(path: pathlib.Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def build_batch_task(model_meta: dict, prompts: List[dict], prompt_texts: Dict[str, str]) -> dict:
    model_provider = model_meta["provider"]
    model_name = model_meta["name"]
    tasks = []
    for prompt in prompts:
        prompt_text = prompt_texts[prompt["id"]]
        tasks.append(build_evaluate_task(model_provider, model_name, prompt, prompt_text, model_meta))
    return {
        "type": "batch",
        "name": f"Kata evaluation suite ({model_meta.get('displayName', model_name)})",
        "stopOnError": False,
        "metadata": {
            "suite": "kata_eval_v1",
            "model": model_meta.get("displayName", model_name)
        },
        "tasks": tasks
    }


def build_health_task(model_meta: dict) -> dict:
    prompt_text = (
        "HEALTH CHECK\n"
        "Respond with a single JSON object: {\"ok\": true, \"model\": \"<model_name>\"}.\n"
        "No extra text.\n"
    )
    model_block = {
        "provider": model_meta["provider"],
        "name": model_meta["name"]
    }
    if model_meta.get("endpoint"):
        model_block["endpoint"] = model_meta["endpoint"]

    return {
        "type": "evaluate",
        "name": f"Health check ({model_meta.get('displayName', model_meta['name'])})",
        "prompt": prompt_text,
        "model": model_block,
        "parameters": {
            "temperature": 0.0,
            "maxTokens": 128,
            "topP": 1.0
        },
        "options": {
            "outputPath": str((RESPONSES_DIR / "health" / "health-check.md").as_posix()),
            "includeMetadata": True,
            "timeoutMs": 90000
        },
        "metadata": {
            "mode": "health",
            "promptId": "health_check",
            "rubricId": "kata_v1"
        }
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate evaluation tasks for Chrysalis eval suite")
    parser.add_argument("--ollama-list-file", help="Path to a saved `ollama list` output")
    parser.add_argument("--min-gb", type=float, default=1.0)
    parser.add_argument("--max-gb", type=float, default=8.0)
    parser.add_argument("--prompt-manifest", default=str(DEFAULT_PROMPT_MANIFEST))
    parser.add_argument("--benchmarks", default=str(DEFAULT_BENCHMARKS))
    args = parser.parse_args()

    ensure_dirs()

    prompt_manifest = load_json(pathlib.Path(args.prompt_manifest))
    prompts = prompt_manifest["prompts"]
    prompt_texts = {}
    for prompt in prompts:
        prompt_path = ROOT / prompt["file"]
        prompt_texts[prompt["id"]] = load_prompt_text(prompt_path)

    if args.ollama_list_file:
        ollama_output = pathlib.Path(args.ollama_list_file).read_text(encoding="utf-8")
    else:
        try:
            ollama_output = run_ollama_list()
        except Exception as exc:
            print(f"Failed to run `ollama list`: {exc}", file=sys.stderr)
            return 1

    models, excluded = parse_ollama_list(ollama_output)
    local_models = [
        m for m in models
        if m["size_gb"] >= args.min_gb and m["size_gb"] <= args.max_gb
    ]

    print(
        "Parsed ollama models:",
        json.dumps(
            {
                "total": len(models) + len(excluded),
                "eligible": len(models),
                "excluded": len(excluded),
                "min_gb": args.min_gb,
                "max_gb": args.max_gb
            },
            indent=2
        )
    )
    if excluded:
        print("Excluded models (reasoning/embedding):")
        for item in excluded:
            print(f"- {item['name']} ({item['size_gb']:.2f} GB) [{item['reason']}]")
    if not local_models:
        print("No local models selected after filtering.")

    for model in local_models:
        model_meta = {
            "provider": "ollama",
            "name": model["name"],
            "displayName": model["name"],
            "id": model["name"],
            "size_gb": round(float(model["size_gb"]), 2)
        }
        batch = build_batch_task(model_meta, prompts, prompt_texts)
        filename = f"{slugify(model_meta['name'])}.json"
        write_task_file(LOCAL_TASKS_DIR / filename, batch)

    bench_manifest = load_json(pathlib.Path(args.benchmarks))
    for bench_model in bench_manifest.get("models", []):
        model_meta = {
            "provider": bench_model["provider"],
            "name": bench_model["name"],
            "displayName": bench_model.get("displayName", bench_model["name"]),
            "id": bench_model["id"],
            "endpoint": bench_model.get("endpoint"),
            "apiKeyEnv": bench_model.get("apiKeyEnv"),
            "providerNotes": bench_model.get("providerNotes")
        }
        batch = build_batch_task(model_meta, prompts, prompt_texts)
        filename = f"{slugify(model_meta['id'])}.json"
        write_task_file(BENCH_TASKS_DIR / filename, batch)

    if local_models:
        smallest = sorted(local_models, key=lambda m: m["size_gb"])[0]
        health_model_meta = {
            "provider": "ollama",
            "name": smallest["name"],
            "displayName": smallest["name"],
            "id": smallest["name"],
            "size_gb": round(float(smallest["size_gb"]), 2)
        }
        health_task = build_health_task(health_model_meta)
        write_task_file(HEALTH_TASKS_DIR / "health-check.json", health_task)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
