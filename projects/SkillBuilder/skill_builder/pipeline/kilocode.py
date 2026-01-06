"""
Kilocode integration manager for SkillBuilder.

Handles:
- Loading existing modes from Kilocode config
- Synchronizing modes between CLI and VS Code extension
- Managing global and local mode storage
"""

from __future__ import annotations

import os
import difflib
from pathlib import Path
from typing import Any, Optional

import yaml


class KilocodeManager:
    """Manages integration with Kilocode configuration and storage."""

    def __init__(self, config_path: Optional[Path] = None):
        self.cli_global_config_path = Path.home() / ".kilocode" / "modes.yaml"
        self.vscode_global_config_path = self._find_vscode_config()
        self.local_config_path = config_path

    def _find_vscode_config(self) -> Path:
        """Find VS Code Kilocode config path across different installation types."""
        candidates = [
            # Flatpak
            Path.home() / ".var" / "app" / "com.visualstudio.code" / "config" / "Code" / "User" / "globalStorage" / "kilocode.kilo-code" / "settings" / "custom_modes.yaml",
            # Native Linux
            Path.home() / ".config" / "Code" / "User" / "globalStorage" / "kilocode.kilo-code" / "settings" / "custom_modes.yaml",
            # macOS
            Path.home() / "Library" / "Application Support" / "Code" / "User" / "globalStorage" / "kilocode.kilo-code" / "settings" / "custom_modes.yaml",
            # Windows (via WSL or native)
            Path(os.environ.get("APPDATA", "")) / "Code" / "User" / "globalStorage" / "kilocode.kilo-code" / "settings" / "custom_modes.yaml" if os.environ.get("APPDATA") else Path.home(),
        ]
        for path in candidates:
            if path.exists():
                return path
        # Default to native Linux path even if it doesn't exist yet
        return Path.home() / ".config" / "Code" / "User" / "globalStorage" / "kilocode.kilo-code" / "settings" / "custom_modes.yaml"

    def list_available_modes(self) -> list[dict[str, Any]]:
        """List all available modes from Kilocode configurations."""
        return self._get_all_modes()

    def load_modes(self, mode_names: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
        """Load specific modes from Kilocode configuration.
        
        Returns:
            Tuple of (matched_modes, unmatched_names)
        """
        all_modes = self._get_all_modes()
        matched = []
        unmatched = []
        
        for name in mode_names:
            name_lower = name.lower()
            found = False
            # Pass 0: exact case-insensitive match on name or slug
            for mode in all_modes:
                m_name = mode.get("name", "")
                m_slug = mode.get("slug", "")
                if name_lower == m_name.lower() or name_lower == m_slug.lower():
                    if mode not in matched:
                        matched.append(mode)
                    found = True
                    break
            # Pass 1: direct contains/substring match
            if not found:
                for mode in all_modes:
                    m_name = mode.get("name", "").lower()
                    m_slug = mode.get("slug", "").lower()
                    if name_lower in m_name or name_lower in m_slug or m_name in name_lower:
                        if mode not in matched:
                            matched.append(mode)
                        found = True
                        break
            # Pass 2: fuzzy match on name/slug
            if not found:
                best = self._fuzzy_match(name_lower, all_modes)
                if best:
                    matched.append(best)
                    found = True
                    print(f"[Kilocode] Fuzzy matched '{name}' -> '{best.get('name', best.get('slug', 'unknown'))}'")
            if not found:
                unmatched.append(name)
        
        return matched, unmatched

    def _fuzzy_match(self, query: str, modes: list[dict[str, Any]], cutoff: float = 0.72) -> Optional[dict[str, Any]]:
        """Return the closest mode by fuzzy similarity on name/slug."""
        candidates = []
        for mode in modes:
            label = mode.get("name", mode.get("slug", ""))
            if not label:
                continue
            score = difflib.SequenceMatcher(a=query.lower(), b=label.lower()).ratio()
            candidates.append((score, mode))
        if not candidates:
            return None
        candidates.sort(key=lambda x: x[0], reverse=True)
        top_score, top_mode = candidates[0]
        if top_score >= cutoff:
            return top_mode
        return None

    def sync_mode(self, mode_entry: dict[str, Any]) -> tuple[bool, bool]:
        """Synchronize a mode entry with both CLI and VS Code global configurations.
        
        Returns:
            Tuple of (cli_synced, vscode_synced) indicating success for each target.
        """
        print(f"[Kilocode] Syncing mode: {mode_entry.get('slug', 'unknown')}")
        
        # Sync CLI
        cli_ok = self._sync_to_path(mode_entry, self.cli_global_config_path)
        if cli_ok:
            print(f"[Kilocode] ✅ Synced to CLI: {self.cli_global_config_path}")
        else:
            print(f"[Kilocode] ⚠️  CLI sync skipped (path not found): {self.cli_global_config_path}")
        
        # Sync VS Code
        vscode_ok = self._sync_to_path(mode_entry, self.vscode_global_config_path)
        if vscode_ok:
            print(f"[Kilocode] ✅ Synced to VS Code: {self.vscode_global_config_path}")
        else:
            print(f"[Kilocode] ⚠️  VS Code sync skipped (path not found): {self.vscode_global_config_path}")
        
        return (cli_ok, vscode_ok)

    def _sync_to_path(self, mode_entry: dict[str, Any], path: Path) -> bool:
        """Synchronize a mode entry to a specific YAML path.
        
        Returns:
            True if sync succeeded, False if skipped (path not found).
        """
        # Create parent directories if they don't exist
        if not path.parent.exists():
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                print(f"[Kilocode] Could not create directory {path.parent}: {e}")
                return False

        data = self._read_yaml(path)
        existing_modes = data.get("customModes", [])
        
        updated = False
        for i, existing in enumerate(existing_modes):
            if existing.get("slug") == mode_entry["slug"]:
                existing_modes[i] = mode_entry
                updated = True
                break
        
        if not updated:
            existing_modes.append(mode_entry)

        try:
            with open(path, "w") as f:
                yaml.dump({"customModes": existing_modes}, f, default_flow_style=False, sort_keys=False)
            return True
        except Exception as e:
            print(f"[Kilocode] Error writing to {path}: {e}")
            return False

    def _get_all_modes(self, global_only: bool = False) -> list[dict[str, Any]]:
        """Retrieve all modes from available configurations."""
        modes = []
        
        # Load CLI global
        if self.cli_global_config_path.exists():
            modes.extend(self._read_yaml(self.cli_global_config_path).get("customModes", []))
            
        # Load VS Code global
        if self.vscode_global_config_path.exists():
            modes.extend(self._read_yaml(self.vscode_global_config_path).get("customModes", []))
            
        # Load local if provided and not global_only
        if not global_only and self.local_config_path and self.local_config_path.exists():
            modes.extend(self._read_yaml(self.local_config_path).get("customModes", []))
            
        return modes

    def _read_yaml(self, path: Path) -> dict[str, Any]:
        """Safely read a YAML file."""
        try:
            with open(path, "r") as f:
                return yaml.safe_load(f) or {}
        except Exception:
            return {}
