#!/usr/bin/env python3
"""
Offline scavenger for Chrysalis.

Scans sibling GitClones projects for reusable components that match Chrysalis
objectives (MCP patterns, distributed sync, memory, observability, embeddings).
Outputs a Markdown report with inventory and code/concept snippets.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, Iterable, List, Sequence

ROOT = Path(__file__).parent
GITCLONES = Path.home() / "Documents" / "GitClones"
REPORT_PATH = ROOT / "reports" / "scavenger_report.md"

SKIP_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".next",
    ".turbo",
    ".cache",
    ".venv",
    "__pycache__",
    "node_modules",
    "build",
    "dist",
    "target",
    "coverage_html",
}

ALLOWED_EXT = {
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".cjs",
    ".py",
    ".go",
    ".rs",
    ".md",
    ".yml",
    ".yaml",
}

KEYWORDS = [
    "mcp",
    "grpc",
    "gossip",
    "crdt",
    "vector",
    "embedding",
    "memory",
    "sync",
    "merkle",
    "observability",
]

MAX_FILE_BYTES = 200_000
MAX_SNIPPETS_PER_REPO = 6

REPOS: Sequence[Dict[str, str]] = [
    {
        "name": "SkyPony",
        "focus": "Agent orchestration, approval loops, contextual prompting",
        "note": "Harvest approval/rollback patterns and terminal orchestration ideas.",
    },
    {
        "name": "SkyPrompt",
        "focus": "Semantic intent compiler and Wave terminal integration",
        "note": "Reuse semantic planner steps and Wave bridge patterns.",
    },
    {
        "name": "SkyManager",
        "focus": "MCP server manager and registry",
        "note": "Apply MCP pooling/registry concepts to Chrysalis adapters.",
    },
    {
        "name": "SemanticLadder",
        "focus": "RAG and vector search configs",
        "note": "Compare default embeddings/index tuning against Chrysalis memory.",
    },
    {
        "name": "KiloCodeSky",
        "focus": "Agentic coding platform with guardrails",
        "note": "Lift guardrail and rollback patterns for sync/merge safety.",
    },
    {
        "name": "Skyhook",
        "focus": "Terminal/CLI safety patterns",
        "note": "Borrow CLI safety/UX defaults for Chrysalis tooling.",
    },
    {
        "name": "PonyWaveTerm",
        "focus": "Wave terminal UI",
        "note": "Reference SSE/UI event handling for observability surfaces.",
    },
    {
        "name": "SkyWaveTerm",
        "focus": "Wave terminal UI fork",
        "note": "Check alternate UI blocks for dashboards.",
    },
    {
        "name": "code-mode-mcp",
        "focus": "MCP servers for coding actions",
        "note": "Use MCP tool patterns for Chrysalis fabric.",
    },
    {
        "name": "contextstream-mcp",
        "focus": "Context streaming MCP server",
        "note": "Inspect streaming patterns for sync pathways.",
    },
    {
        "name": "design_patterns_mcp",
        "focus": "Reference MCP tool patterns",
        "note": "Map design patterns into Chrysalis MCP layer.",
    },
]


def read_license(repo: Path) -> str:
    """Return first non-empty license line or 'Unknown'."""
    for name in ("LICENSE", "LICENSE.txt", "LICENSE.md"):
        lic = repo / name
        if lic.exists():
            try:
                with lic.open("r", errors="ignore") as handle:
                    for line in handle:
                        stripped = line.strip()
                        if stripped:
                            return stripped
            except Exception:
                pass
    return "Unknown"


def lang_for_suffix(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in {".ts", ".tsx"}:
        return "typescript"
    if ext == ".py":
        return "python"
    if ext == ".go":
        return "go"
    if ext in {".md", ".markdown"}:
        return "markdown"
    if ext in {".yml", ".yaml"}:
        return "yaml"
    if ext in {".js", ".mjs", ".cjs"}:
        return "javascript"
    if ext == ".rs":
        return "rust"
    return ""


def iter_files(repo: Path) -> Iterable[Path]:
    for dirpath, dirnames, filenames in os.walk(repo):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for filename in filenames:
            path = Path(dirpath) / filename
            if path.suffix.lower() not in ALLOWED_EXT:
                continue
            if path.stat().st_size > MAX_FILE_BYTES:
                continue
            yield path


def collect_snippets(repo: Path) -> List[Dict[str, str]]:
    snippets: List[Dict[str, str]] = []
    remaining = MAX_SNIPPETS_PER_REPO
    lower_keywords = [kw.lower() for kw in KEYWORDS]

    for path in iter_files(repo):
        if remaining <= 0:
            break
        try:
            text = path.read_text(errors="ignore")
        except Exception:
            continue

        lines = text.splitlines()
        for idx, line in enumerate(lines):
            line_lower = line.lower()
            matched_kw = None
            for kw in lower_keywords:
                if kw in line_lower:
                    matched_kw = kw
                    break
            if matched_kw is None:
                continue

            start = max(0, idx - 2)
            end = min(len(lines), idx + 3)
            snippet_body = "\n".join(lines[start:end])
            snippets.append(
                {
                    "path": str(path.relative_to(repo)),
                    "line": str(idx + 1),
                    "keyword": matched_kw,
                    "snippet": snippet_body,
                    "lang": lang_for_suffix(path),
                }
            )
            remaining -= 1
            if remaining <= 0:
                break
    return snippets


def render_inventory_table(rows: Sequence[Dict[str, str]]) -> str:
    header = "| Repo | Focus | License | Notes |"
    sep = "| --- | --- | --- | --- |"
    body = "\n".join(
        f"| {row['name']} | {row['focus']} | {row.get('license','Unknown')} | {row.get('note','')} |"
        for row in rows
    )
    return "\n".join([header, sep, body])


def ensure_report_dir() -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)


def main() -> None:
    inventory: List[Dict[str, str]] = []
    snippets_by_repo: Dict[str, List[Dict[str, str]]] = {}

    for repo_meta in REPOS:
        repo_path = GITCLONES / repo_meta["name"]
        if not repo_path.exists():
            continue

        license_line = read_license(repo_path)
        repo_meta = {**repo_meta, "license": license_line}
        inventory.append(repo_meta)

        snippets = collect_snippets(repo_path)
        if snippets:
            snippets_by_repo[repo_meta["name"]] = snippets

    ensure_report_dir()

    report_sections: List[str] = []
    report_sections.append("# Cross-Repo Scavenger Report (Chrysalis)")
    report_sections.append(f"Scope: {GITCLONES}")
    report_sections.append(
        "Focus keywords: MCP, gRPC, gossip, CRDT, vector, embedding, memory, sync, Merkle, observability.\n"
        "Skipped heavy directories (node_modules, dist, build, coverage) and capped snippet size."
    )

    if inventory:
        report_sections.append("\n## Inventory\n")
        report_sections.append(render_inventory_table(inventory))
    else:
        report_sections.append("\n_No sibling repositories found to scan._")

    report_sections.append("\n## Snippets and Concepts\n")
    if not snippets_by_repo:
        report_sections.append("No snippets found. Consider adjusting KEYWORDS or repos in scavenge_repos.py.")
    else:
        for repo_name, snippets in snippets_by_repo.items():
            report_sections.append(f"### {repo_name}\n")
            for entry in snippets:
                lang = entry["lang"]
                fence = lang if lang else ""
                report_sections.append(
                    f"- `{entry['path']}:{entry['line']}` (keyword: {entry['keyword']})\n"
                    f"```{fence}\n{entry['snippet']}\n```"
                )

    REPORT_PATH.write_text("\n".join(report_sections))
    print(f"Wrote report to {REPORT_PATH}")


if __name__ == "__main__":
    main()
