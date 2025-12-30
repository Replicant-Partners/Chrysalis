# Lightweight uSA -> runtime adapter scaffolds
#
# These helpers map a Uniform Semantic Agent (uSA) document into
# starter configs for common runtimes (CrewAI, OpenAI Assistants, VS Code
# agents, LangGraph, ElizaOS). They are heuristic and intended as seeds
# for downstream refinement.
from .adapters import (
    usa_to_crewai,
    usa_to_openai_assistant,
    usa_to_cline_agent_plan,
    usa_to_langgraph_scaffold,
    usa_to_elizaos_persona,
    usa_to_generic_summary,
    eliza_persona_to_usa,
    crewai_agent_to_usa,
)

__all__ = [
    "usa_to_crewai",
    "usa_to_openai_assistant",
    "usa_to_cline_agent_plan",
    "usa_to_langgraph_scaffold",
    "usa_to_elizaos_persona",
    "usa_to_generic_summary",
    "eliza_persona_to_usa",
    "crewai_agent_to_usa",
]
