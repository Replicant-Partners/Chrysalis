from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

import yaml


def _load_yaml(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


@dataclass(frozen=True)
class SemanticConfig:
    config_dir: Path
    domains: Dict[str, Any]
    expertise_levels: Dict[str, Any]
    skills_frameworks: Dict[str, Any]
    skill_keywords: Dict[str, Any]
    search_templates: Dict[str, Any]
    llm_prompts: Dict[str, Any]
    kilocode_formats: Dict[str, Any]
    refinement: Dict[str, Any]

    @classmethod
    def load(cls, config_dir: Path) -> "SemanticConfig":
        config_dir = config_dir.expanduser().resolve()
        return cls(
            config_dir=config_dir,
            domains=_load_yaml(config_dir / "domains.yaml"),
            expertise_levels=_load_yaml(config_dir / "expertise-levels.yaml"),
            skills_frameworks=_load_yaml(config_dir / "skills-frameworks.yaml"),
            skill_keywords=_load_yaml(config_dir / "skill-keywords.yaml"),
            search_templates=_load_yaml(config_dir / "search-templates.yaml"),
            llm_prompts=_load_yaml(config_dir / "llm-prompts.yaml"),
            kilocode_formats=_load_yaml(config_dir / "kilocode-formats.yaml"),
            refinement=_load_yaml(config_dir / "refinement.yaml"),
        )


def get_template(cfg: SemanticConfig, section: str, key: str = "queries") -> Optional[list]:
    sec = cfg.search_templates.get(section)
    if not isinstance(sec, dict):
        return None
    val = sec.get(key)
    return val if isinstance(val, list) else None
