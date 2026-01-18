#!/usr/bin/env python3
import argparse
import json
import os
import pathlib
from typing import Any, Dict


def resolve_task(task: Dict[str, Any]) -> None:
    if task.get("type") == "batch":
        for subtask in task.get("tasks", []):
            resolve_task(subtask)
        return
    if task.get("type") != "evaluate":
        return
    model = task.get("model", {})
    if "apiKey" in model and model["apiKey"]:
        return
    env_name = model.get("apiKeyEnv")
    if not env_name:
        return
    api_key = os.getenv(env_name, "").strip()
    if api_key:
        model["apiKey"] = api_key


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve apiKey fields from apiKeyEnv in task JSON")
    parser.add_argument("input", help="Input task JSON")
    parser.add_argument("output", help="Output task JSON")
    args = parser.parse_args()

    input_path = pathlib.Path(args.input)
    output_path = pathlib.Path(args.output)

    with input_path.open("r", encoding="utf-8") as handle:
        task = json.load(handle)

    resolve_task(task)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(task, handle, indent=2)
        handle.write("\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
