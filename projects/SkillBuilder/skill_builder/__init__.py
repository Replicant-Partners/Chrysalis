"""
SkillBuilder: A pipeline for building agent "modes" from exemplar-driven research.

This package implements the semantic requirements:
- Durable artifacts > ephemeral chat
- Minimize information loss through layered outputs
- Defense-in-depth for prompt injection
- Two-stage web research swarm
- Multiple backend support (HTTP/MCP/Auto)

Public API:
    - FrontendSpec: Configuration dataclass for pipeline runs
    - run_pipeline: Main entry point for executing the pipeline
    - ModeTransformer: Converts generated modes to target formats
"""

from skill_builder.pipeline.models import FrontendSpec, Exemplar
from skill_builder.pipeline.runner import run_pipeline
from skill_builder.pipeline.transformer import ModeTransformer

__version__ = "0.1.0"
__all__ = ["FrontendSpec", "Exemplar", "run_pipeline", "ModeTransformer"]
