#!/usr/bin/env python3
"""
Stub transformer: converts generated-mode.md into a KiloCode-like layout.

Outputs:
- .kilocodemodes/<slug>.md
- .kilocode/rules-<slug>/instructions.md
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower())
    return slug.strip("-") or "mode"


def transform(source_md: Path, out_format: str) -> None:
    body = source_md.read_text(encoding="utf-8")
    slug = _slugify(source_md.stem)

    if out_format != "kilocode":
        raise SystemExit("Only kilocode output is supported in this stub.")

    modes_dir = source_md.parent / ".kilocodemodes"
    rules_dir = source_md.parent / f".kilocode/rules-{slug}"
    modes_dir.mkdir(parents=True, exist_ok=True)
    rules_dir.mkdir(parents=True, exist_ok=True)

    (modes_dir / f"{slug}.md").write_text(body, encoding="utf-8")
    (rules_dir / "instructions.md").write_text(body, encoding="utf-8")
    print(f"Wrote: {modes_dir / f'{slug}.md'}")
    print(f"Wrote: {rules_dir / 'instructions.md'}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_md", help="Path to generated-mode.md")
    parser.add_argument("-f", "--format", default="kilocode", help="Output format (kilocode)")
    args = parser.parse_args(argv)

    source = Path(args.source_md).expanduser().resolve()
    if not source.exists():
        raise SystemExit(f"Missing source markdown: {source}")
    transform(source, args.format)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
