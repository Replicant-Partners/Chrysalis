"""
Universal Agent Specification (UAS) Implementation

A framework-agnostic agent specification system that enables agents to be
defined once and deployed to multiple frameworks (CrewAI, Cline, AutoGPT, etc.)
"""

__version__ = "1.0.0"

from .core import (
    AgentSpec,
    Metadata,
    Identity,
    Capabilities,
    Protocols,
    Execution,
    Deployment
)

from .loader import (
    UniversalAgentLoader,
    load_agent,
    save_agent
)

__all__ = [
    'AgentSpec',
    'Metadata',
    'Identity',
    'Capabilities',
    'Protocols',
    'Execution',
    'Deployment',
    'UniversalAgentLoader',
    'load_agent',
    'save_agent'
]
