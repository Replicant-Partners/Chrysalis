"""
USA Adapters - Bidirectional Agent Format Conversion

This module provides adapters for converting between Uniform Semantic Agent (USA)
format and various agent frameworks:

Supported Frameworks:
- CrewAI: Multi-agent orchestration
- OpenAI Assistants: Function-calling agents
- Cline/Roo Code: IDE-integrated agents
- LangGraph: Graph-based agent workflows
- ElizaOS: Persona-based agents
- LMOS: Language Model Operating System
- AutoGen: Microsoft multi-agent framework
- Replicant: Character-based agents

Usage:
    from usa_adapters import (
        # Core adapters
        usa_to_crewai,
        usa_to_openai_assistant,
        usa_to_langgraph_scaffold,
        usa_to_elizaos_persona,
        
        # Reverse adapters
        crewai_agent_to_usa,
        eliza_persona_to_usa,
        replicant_to_usa,
        
        # LMOS adapters
        usa_to_lmos,
        lmos_to_usa,
        
        # AutoGen adapters
        usa_to_autogen,
        autogen_to_usa,
        usa_to_autogen_assistant,
        usa_to_autogen_user_proxy,
        usa_to_autogen_group_chat,
        
        # Utilities
        detect_agent_format,
        convert_to_usa,
    )
"""

# Core adapters
from .adapters import (
    usa_to_crewai,
    usa_to_openai_assistant,
    usa_to_cline_agent_plan,
    usa_to_langgraph_scaffold,
    usa_to_elizaos_persona,
    usa_to_generic_summary,
    eliza_persona_to_usa,
    crewai_agent_to_usa,
    replicant_to_usa,
    detect_agent_format,
    convert_to_usa,
)

# LMOS adapters
from .lmos_adapter import (
    usa_to_lmos,
    lmos_to_usa,
    detect_lmos_format,
)

# AutoGen adapters
from .autogen_adapter import (
    usa_to_autogen,
    autogen_to_usa,
    detect_autogen_format,
    usa_to_autogen_assistant,
    usa_to_autogen_user_proxy,
    usa_to_autogen_group_chat,
)

__all__ = [
    # Core adapters
    "usa_to_crewai",
    "usa_to_openai_assistant",
    "usa_to_cline_agent_plan",
    "usa_to_langgraph_scaffold",
    "usa_to_elizaos_persona",
    "usa_to_generic_summary",
    "eliza_persona_to_usa",
    "crewai_agent_to_usa",
    "replicant_to_usa",
    "detect_agent_format",
    "convert_to_usa",
    # LMOS adapters
    "usa_to_lmos",
    "lmos_to_usa",
    "detect_lmos_format",
    # AutoGen adapters
    "usa_to_autogen",
    "autogen_to_usa",
    "detect_autogen_format",
    "usa_to_autogen_assistant",
    "usa_to_autogen_user_proxy",
    "usa_to_autogen_group_chat",
]

__version__ = "2.0.0"
