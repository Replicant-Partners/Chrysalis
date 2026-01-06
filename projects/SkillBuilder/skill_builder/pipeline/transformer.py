"""
Mode transformer for converting generated modes to target formats.

Semantic Requirements (from docs/architecture/overview.md):
- Transform generated-mode.md into target formats:
  - KiloCode (.kilocodemodes + .kilocode/rules-<slug>/...)
  - Cursor (.cursorrules)
  - RooCode

Design Pattern: Strategy + Builder + Bridge
- OutputFormat enum selects transformation strategy
- ModeTransformer orchestrates the transformation
- KilocodeManager handles global synchronization
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Any, Optional

import yaml

from skill_builder.pipeline.kilocode import KilocodeManager


class OutputFormat(Enum):
    """Target output formats for mode transformation."""
    KILOCODE = auto()
    CURSOR = auto()
    ROOCODE = auto()
    
    @classmethod
    def from_string(cls, value: str) -> OutputFormat:
        mapping = {
            "kilocode": cls.KILOCODE,
            "cursor": cls.CURSOR,
            "roocode": cls.ROOCODE,
        }
        return mapping.get(value.lower(), cls.KILOCODE)


@dataclass(frozen=True)
class ParsedMode:
    """Parsed mode definition from generated-mode.md.
    
    Intermediate representation extracted from markdown.
    """
    name: str
    slug: str
    purpose: str
    role_definition: str
    capabilities: tuple[str, ...] = field(default_factory=tuple)
    when_to_use: tuple[str, ...] = field(default_factory=tuple)
    custom_instructions: str = ""
    file_patterns: tuple[str, ...] = field(default_factory=tuple)
    references: tuple[str, ...] = field(default_factory=tuple)


class ModeParser:
    """Parses generated-mode.md into structured ParsedMode.
    
    Extracts structured data from markdown sections.
    """
    
    def parse(self, markdown: str) -> ParsedMode:
        """Parse markdown into ParsedMode."""
        lines = markdown.split("\n")
        
        # Extract name from title
        name = self._extract_title(lines)
        slug = self._slugify(name)
        
        # Extract sections
        sections = self._extract_sections(lines)
        
        return ParsedMode(
            name=name,
            slug=slug,
            purpose=sections.get("overview", ""),
            role_definition=sections.get("role definition", ""),
            capabilities=self._parse_list(sections.get("core capabilities", "")),
            when_to_use=self._parse_list(sections.get("when to use", "")),
            custom_instructions=sections.get("custom instructions", ""),
            file_patterns=self._parse_list(sections.get("file patterns", "")),
            references=self._parse_list(sections.get("references", "")),
        )
    
    def _extract_title(self, lines: list[str]) -> str:
        """Extract mode name from first heading."""
        return next(
            (line[2:].strip() for line in lines if line.startswith("# ")),
            "Unknown Mode",
        )
    
    def _extract_sections(self, lines: list[str]) -> dict[str, str]:
        """Extract sections by heading."""
        sections: dict[str, str] = {}
        current_section = ""
        current_content: list[str] = []
        
        for line in lines:
            if line.startswith("## "):
                if current_section:
                    sections[current_section.lower()] = "\n".join(current_content).strip()
                current_section = line[3:].strip()
                current_content = []
            else:
                current_content.append(line)
        
        if current_section:
            sections[current_section.lower()] = "\n".join(current_content).strip()
        
        return sections
    
    def _parse_list(self, content: str) -> tuple[str, ...]:
        """Parse markdown list into tuple of items."""
        items = []
        for line in content.split("\n"):
            line = line.strip()
            if line.startswith("- "):
                items.append(line[2:].strip())
            elif line.startswith("* "):
                items.append(line[2:].strip())
        return tuple(items)
    
    def _slugify(self, name: str) -> str:
        """Convert name to slug."""
        slug = name.lower()
        slug = re.sub(r"[^a-z0-9]+", "-", slug)
        return slug.strip("-")


class ModeTransformer:
    """Transforms generated modes to target formats.
    
    Primary entry point for mode transformation.
    """
    
    def __init__(self, format: OutputFormat = OutputFormat.KILOCODE):
        self.format = format
        self.parser = ModeParser()
        self.kilocode = KilocodeManager()
    
    def transform(self, input_path: Path, output_dir: Path) -> list[Path]:
        """Transform generated-mode.md to target format.
        
        Returns list of written file paths.
        """
        # Parse input
        with open(input_path, "r", encoding="utf-8") as f:
            markdown = f.read()
        
        mode = self.parser.parse(markdown)
        
        # Transform to target format
        if self.format == OutputFormat.KILOCODE:
            return self._write_kilocode(mode, output_dir)
        elif self.format == OutputFormat.CURSOR:
            return self._write_cursor(mode, output_dir)
        elif self.format == OutputFormat.ROOCODE:
            return self._write_roocode(mode, output_dir)
        
        return []
    
    def _write_kilocode(self, mode: ParsedMode, output_dir: Path) -> list[Path]:
        """Write KiloCode mode files.
        
        Outputs:
        - .kilocodemodes (mode definition YAML)
        - .kilocode/rules-<slug>/rules.md (detailed rules)
        """
        written: list[Path] = []
        
        # Create .kilocodemodes entry
        modes_file = output_dir / ".kilocodemodes"
        mode_entry = self._build_kilocode_mode_entry(mode)
        
        # Read existing or create new
        existing_modes: list[dict[str, Any]] = []
        if modes_file.exists():
            with open(modes_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
                existing_modes = data.get("customModes", [])
        
        # Update or add mode
        updated = False
        for i, existing in enumerate(existing_modes):
            if existing.get("slug") == mode.slug:
                existing_modes[i] = mode_entry
                updated = True
                break
        
        if not updated:
            existing_modes.append(mode_entry)
        
        # Write .kilocodemodes
        output_dir.mkdir(parents=True, exist_ok=True)
        with open(modes_file, "w", encoding="utf-8") as f:
            yaml.dump({"customModes": existing_modes}, f, default_flow_style=False, sort_keys=False)
        written.append(modes_file)
        
        # Create rules directory and files
        rules_dir = output_dir / ".kilocode" / f"rules-{mode.slug}"
        rules_dir.mkdir(parents=True, exist_ok=True)
        
        # Write rules.md
        rules_file = rules_dir / "rules.md"
        rules_content = self._build_kilocode_rules(mode)
        with open(rules_file, "w", encoding="utf-8") as f:
            f.write(rules_content)
        written.append(rules_file)

        # Semantic Requirement: Synchronize with global Kilocode config
        self.kilocode.sync_mode(mode_entry)
        
        return written
    
    def _build_kilocode_mode_entry(self, mode: ParsedMode) -> dict[str, Any]:
        """Build KiloCode mode entry for .kilocodemodes."""
        return {
            "slug": mode.slug,
            "name": mode.name,
            "roleDefinition": mode.role_definition,
            "whenToUse": " ".join(mode.when_to_use) if mode.when_to_use else f"Use this mode for {mode.purpose}",
            "description": mode.purpose[:100],
            "groups": [],
            "customInstructions": mode.custom_instructions,
            "source": "semantic-mode",
        }
    
    def _build_kilocode_rules(self, mode: ParsedMode) -> str:
        """Build rules.md content for KiloCode."""
        lines = [
            f"# Rules for {mode.name}",
            "",
            "## Role",
            "",
            mode.role_definition,
            "",
            "## Capabilities",
            "",
        ]

        lines.extend(f"- {cap}" for cap in mode.capabilities)
        lines.extend([
            "",
            "## Guidelines",
            "",
            mode.custom_instructions,
            "",
            "## References",
            "",
        ])

        lines.extend(f"- {ref}" for ref in mode.references)
        return "\n".join(lines)
    
    def _write_cursor(self, mode: ParsedMode, output_dir: Path) -> list[Path]:
        """Write Cursor rules file.
        
        Outputs:
        - .cursorrules
        """
        written: list[Path] = []
        
        output_dir.mkdir(parents=True, exist_ok=True)
        cursor_file = output_dir / ".cursorrules"
        
        content = self._build_cursor_rules(mode)
        
        with open(cursor_file, "w", encoding="utf-8") as f:
            f.write(content)
        written.append(cursor_file)
        
        return written
    
    def _build_cursor_rules(self, mode: ParsedMode) -> str:
        """Build .cursorrules content."""
        lines = [
            "# Cursor Rules",
            "",
            f"## {mode.name}",
            "",
            mode.role_definition,
            "",
            "## Core Principles",
            "",
        ]
        
        for cap in mode.capabilities:
            # Strip markdown formatting for Cursor
            clean_cap = re.sub(r"\*\*([^*]+)\*\*", r"\1", cap)
            lines.append(f"- {clean_cap}")
        
        lines.extend([
            "",
            "## Instructions",
            "",
            mode.custom_instructions,
            "",
            "---",
            f"Generated by SkillBuilder for: {mode.purpose}",
        ])
        
        return "\n".join(lines)
    
    def _write_roocode(self, mode: ParsedMode, output_dir: Path) -> list[Path]:
        """Write RooCode mode file.
        
        RooCode format is similar to KiloCode but may have different structure.
        """
        # For now, RooCode uses similar format to KiloCode
        # Can be customized as RooCode spec evolves
        return self._write_kilocode(mode, output_dir)


# =============================================================================
# CLI-style Interface
# =============================================================================

def transform_mode(
    input_path: str | Path,
    output_dir: str | Path | None = None,
    format: str = "kilocode",
) -> list[Path]:
    """Transform a generated-mode.md file to target format.
    
    Convenience function for CLI usage.
    
    Args:
        input_path: Path to generated-mode.md
        output_dir: Output directory (defaults to current directory)
        format: Target format (kilocode, cursor, roocode)
    
    Returns:
        List of written file paths
    """
    input_path = Path(input_path)
    output_dir = Path(output_dir) if output_dir else Path(".")
    
    transformer = ModeTransformer(format=OutputFormat.from_string(format))
    return transformer.transform(input_path, output_dir)
