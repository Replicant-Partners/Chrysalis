import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict

from skill_builder.pipeline.models import FrontendSpec, SearchHit, SearchResult
from skill_builder.pipeline.sanitizer import sanitize_for_prompt
from skill_builder.pipeline.telemetry import TelemetryWriter, emit_structured


def run_go_search_swarm(spec: FrontendSpec, telemetry: TelemetryWriter | None = None, run_id: str | None = None) -> Dict[str, Any]:
    """Bridge to the Go-based search swarm."""

    import time

    emit_structured(
        "search.go.start",
        data={
            "run_id": run_id,
            "mode": spec.mode_name,
            "providers": spec.get_available_providers(),
            "max_results_per_query": spec.search_max_results_per_query,
        },
        telemetry=telemetry,
    )

    start = time.perf_counter()

    # Use new API key helper methods
    api_keys = spec.get_api_keys()

    if not spec.has_any_api_key():
        print("WARNING: No search API keys found, search results will be empty")
        print("Set TAVILY_API_KEY and/or BRAVE_API_KEY environment variables to enable search")

    # Prepare search spec for Go
    search_spec = {
        "mode_name": spec.mode_name,
        "purpose": spec.purpose,
        "skills": spec.skills,
        "exemplars": [
            {
                "name": e.name,
                "url": e.url,
                "is_author": e.is_author,
                "salts": e.salts
            } for e in spec.exemplars
        ],
        "query_templates": list(spec.query_templates),
        "stage2_query_templates": list(spec.web_swarm_stage2_query_templates),
        "search_max_results_per_query": spec.search_max_results_per_query,
        "tavily_api_key": api_keys["tavily"],
        "brave_api_key": api_keys["brave"],
    }

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(search_spec, f)
        spec_path = f.name

    try:
        # Execute Go binary
        go_bin = Path("bin/search-swarm")
        if not go_bin.exists():
            raise FileNotFoundError(f"Go binary not found at {go_bin}. Run 'go build' first.")

        cmd = [str(go_bin), "-spec", spec_path]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )

        if not result.stdout:
            raise ValueError("Go binary returned empty output")

        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Failed to parse JSON from Go binary: {e}\nRaw stdout: {result.stdout}")

        # Semantic Requirement: Sanitize all untrusted web content
        all_hits = data.get("all_hits", [])
        if all_hits is None:
            all_hits = []
        else:
            for i, hit in enumerate(all_hits):
                snippet = hit.get("snippet", "")
                if snippet is None:
                    snippet = ""
                sanitized = sanitize_for_prompt(snippet)
                hit["snippet"] = sanitized

        # Handle other null values
        domain_anchors = data.get("domain_anchors", [])
        if domain_anchors is None:
            domain_anchors = []

        # Update the data with processed values
        data["all_hits"] = all_hits
        data["domain_anchors"] = domain_anchors

        emit_structured(
            "search.go.done",
            data={
                "run_id": run_id,
                "duration_ms": (time.perf_counter() - start) * 1000,
                "stdout_chars": len(result.stdout or ""),
                "stderr_chars": len(result.stderr or ""),
                "hits": len(all_hits),
                "anchors": len(domain_anchors),
            },
            telemetry=telemetry,
        )

        # Log summary of search results
        if not all_hits and not spec.has_any_api_key():
            print("No search results due to missing API keys")

        return data
    except subprocess.CalledProcessError as e:
        emit_structured(
            "search.go.error",
            data={
                "run_id": run_id,
                "duration_ms": (time.perf_counter() - start) * 1000,
                "exit_code": e.returncode,
                "stderr_chars": len(e.stderr or ""),
                "stdout_chars": len(e.stdout or ""),
                "error": "go_process_failed",
            },
            telemetry=telemetry,
        )
        raise RuntimeError(f"Go binary failed with exit code {e.returncode}\nstderr: {e.stderr}\nstdout: {e.stdout}")
    except Exception as e:
        emit_structured(
            "search.go.error",
            data={
                "run_id": run_id,
                "duration_ms": (time.perf_counter() - start) * 1000,
                "error": str(e),
            },
            telemetry=telemetry,
        )
        raise RuntimeError(f"Exception in run_go_search_swarm: {e}")
    finally:
        Path(spec_path).unlink(missing_ok=True)


def run_synthesis(artifacts_data: Dict[str, Any], spec: FrontendSpec, telemetry: TelemetryWriter | None = None, run_id: str | None = None) -> Dict[str, Any]:
    """Run semantic synthesis using pure Python implementation."""
    from skill_builder.pipeline.synthesis import run_synthesis as _run_synthesis

    # Prepare spec for synthesis
    spec_data = {
        "mode_name": spec.mode_name,
        "purpose": spec.purpose,
        "skills": list(spec.skills),
        "exemplars": [
            {
                "name": e.name,
                "url": e.url,
                "is_author": e.is_author
            } for e in spec.exemplars
        ]
    }

    return _run_synthesis(artifacts_data, spec_data, telemetry=telemetry, run_id=run_id)


# Keep the old function name as an alias for backwards compatibility

def run_clojure_synthesis(artifacts_data: Dict[str, Any], spec: FrontendSpec, telemetry: TelemetryWriter | None = None, run_id: str | None = None) -> Dict[str, Any]:
    """Alias for run_synthesis (formerly used Clojure, now uses Python)."""
    return run_synthesis(artifacts_data, spec, telemetry=telemetry, run_id=run_id)