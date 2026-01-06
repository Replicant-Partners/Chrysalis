"""
Example: run judge-based evaluation with OpenAI or Ollama.
Backends (set JUDGE_BACKEND=ollama|openai):
  - OpenAI: requires OPENAI_API_KEY (and optional OPENAI_BASE_URL/JUDGE_MODEL)
  - Ollama: requires OLLAMA_BASE_URL (e.g., http://localhost:11434) and OLLAMA_MODEL

Control set defaults to inline samples; if data/judge_control.json exists, it will be used.
Default backend: OpenAI (fast path to make progress). Switch to Ollama by setting JUDGE_BACKEND=ollama.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import requests
from src.eval.judge import evaluate_dataset
from src.utils.telemetry import TelemetryRecorder

DEFAULT_OLLAMA_MODEL = "llama3.2:3b"


def openai_judge(prompt: str, model: str) -> str:
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("Install openai or provide a judge_fn.")

    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"), base_url=os.getenv("OPENAI_BASE_URL"))
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=5,
    )
    return resp.choices[0].message.content.strip()


def ollama_judge(prompt: str, model: str, base_url: str) -> str:
    # Prefer /api/chat; fall back to /api/generate for older Ollama versions.
    chat_payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "stream": False, "options": {"temperature": 0}}
    chat_url = f"{base_url}/api/chat"
    resp = requests.post(chat_url, json=chat_payload, timeout=30)
    if resp.status_code == 404:
        gen_payload = {"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0}}
        gen_url = f"{base_url}/api/generate"
        resp = requests.post(gen_url, json=gen_payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if "message" in data:
        return data.get("message", {}).get("content", "").strip()
    return data.get("response", "").strip()


def load_samples() -> list:
    control_path = Path("data/judge_control.json")
    if control_path.exists():
        return json.loads(control_path.read_text())
    return [
        {
            "question": "Who discovered radium?",
            "contexts": [
                "Marie Curie was a physicist and chemist who discovered polonium and radium.",
                "Radium is a chemical element with symbol Ra and atomic number 88.",
            ],
            "answer": "Marie Curie discovered radium.",
            "ground_truth": ["Marie Curie discovered radium"],
        },
        {
            "question": "What is LanceDB used for here?",
            "contexts": [
                "LanceDB stores entity embeddings for similarity search.",
                "SQLite stores metadata.",
            ],
            "answer": "It stores embeddings for similarity search.",
            "ground_truth": ["LanceDB stores entity embeddings for similarity search"],
        },
    ]


def select_judge() -> Callable[[str], str]:
    backend = os.getenv("JUDGE_BACKEND", "openai").lower()
    if backend == "ollama":
        model = os.getenv("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        return lambda prompt: ollama_judge(prompt, model=model, base_url=base_url)
    model = os.getenv("JUDGE_MODEL", "gpt-4o-mini")
    return lambda prompt: openai_judge(prompt, model=model)


def main():
    samples = load_samples()
    judge_fn = select_judge()
    scores = evaluate_dataset(samples, judge_fn=judge_fn)
    run_id = os.getenv("JUDGE_RUN_ID", f"judge-{datetime.now(timezone.utc).isoformat()}")
    TelemetryRecorder().record_eval(run_id=run_id, metrics=scores, meta={"backend": os.getenv("JUDGE_BACKEND", "openai")})
    for metric, score in scores.items():
        print(f"{metric}: {score:.3f}")


if __name__ == "__main__":
    main()
