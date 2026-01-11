"""
LMOS (Language Model Operating System) Adapter

Bidirectional conversion between Uniform Semantic Agent (USA) and LMOS agent format.

LMOS is an open-source platform for building and deploying AI agents with:
- Agent channels for communication
- Skill-based architecture
- Memory and context management
- Multi-agent orchestration

References:
- https://github.com/lmos-ai/lmos
- https://lmos.ai/docs
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class LMOSSkill:
    """LMOS skill definition."""
    name: str
    description: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    required_capabilities: List[str] = field(default_factory=list)
    version: str = "1.0.0"


@dataclass
class LMOSChannel:
    """LMOS communication channel."""
    channel_id: str
    channel_type: str  # 'text', 'voice', 'api', 'websocket'
    config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LMOSMemoryConfig:
    """LMOS memory configuration."""
    type: str = "vector"  # 'vector', 'graph', 'hybrid'
    provider: str = "local"
    embedding_model: str = "text-embedding-3-small"
    max_context_tokens: int = 8192
    persistence: bool = True


@dataclass
class LMOSAgent:
    """LMOS agent specification."""
    agent_id: str
    name: str
    description: str
    system_prompt: str
    skills: List[LMOSSkill] = field(default_factory=list)
    channels: List[LMOSChannel] = field(default_factory=list)
    memory: Optional[LMOSMemoryConfig] = None
    model: str = "gpt-4o"
    temperature: float = 0.7
    max_tokens: int = 4096
    metadata: Dict[str, Any] = field(default_factory=dict)


def usa_to_lmos(spec: Any) -> Dict[str, Any]:
    """
    Convert a Uniform Semantic Agent (USA) to LMOS agent format.
    
    Args:
        spec: USA specification (dict or object)
    
    Returns:
        LMOS agent configuration dict
    """
    # Convert to dict if needed
    if hasattr(spec, "to_dict"):
        data = spec.to_dict()
    elif hasattr(spec, "__dict__"):
        data = {k: v for k, v in spec.__dict__.items() if not k.startswith("_")}
    else:
        data = dict(spec) if spec else {}
    
    # Extract identity
    identity = data.get("identity", {}) or {}
    metadata = data.get("metadata", {}) or {}
    
    name = identity.get("name") or metadata.get("name") or "usa-agent"
    agent_id = identity.get("id") or f"usa-{name.lower().replace(' ', '-')}"
    
    # Build system prompt from identity and personality
    personality = data.get("personality", {}) or {}
    communication = data.get("communication", {}) or {}
    
    system_prompt_parts = []
    
    # Role and goal
    role = identity.get("role") or identity.get("designation") or ""
    goal = identity.get("goal") or ""
    backstory = identity.get("backstory") or identity.get("bio") or ""
    
    if role:
        system_prompt_parts.append(f"You are {name}, a {role}.")
    else:
        system_prompt_parts.append(f"You are {name}.")
    
    if goal:
        system_prompt_parts.append(f"Your goal is: {goal}")
    
    if backstory:
        if isinstance(backstory, list):
            backstory = " ".join(backstory)
        system_prompt_parts.append(backstory)
    
    # Personality traits
    core_traits = personality.get("core_traits", [])
    if core_traits:
        system_prompt_parts.append(f"Your core traits are: {', '.join(core_traits)}.")
    
    values = personality.get("values", [])
    if values:
        system_prompt_parts.append(f"You value: {', '.join(values)}.")
    
    # Communication style
    style = communication.get("style", {})
    if isinstance(style, dict):
        all_style = style.get("all", [])
        if all_style:
            system_prompt_parts.append("Communication guidelines: " + "; ".join(all_style))
    
    system_prompt = "\n\n".join(system_prompt_parts)
    
    # Extract skills from capabilities
    capabilities = data.get("capabilities", {}) or {}
    tools = capabilities.get("tools", []) or []
    learned_skills = capabilities.get("learned_skills", []) or []
    
    skills = []
    
    # Convert tools to skills
    for tool in tools:
        if isinstance(tool, dict):
            skill = {
                "name": tool.get("name", "unknown"),
                "description": tool.get("description", ""),
                "parameters": tool.get("config", {}) or tool.get("schema", {}),
                "required_capabilities": [],
                "version": "1.0.0"
            }
            skills.append(skill)
    
    # Convert learned skills
    for ls in learned_skills:
        if isinstance(ls, dict):
            skill = {
                "name": ls.get("name", "unknown"),
                "description": f"Learned skill in {ls.get('category', 'general')}",
                "parameters": {},
                "required_capabilities": ls.get("prerequisites", []),
                "version": "1.0.0"
            }
            skills.append(skill)
    
    # Extract memory configuration
    memory_config = data.get("memory", {}) or {}
    memory = {
        "type": memory_config.get("type", "vector"),
        "provider": memory_config.get("provider", "local"),
        "embedding_model": "text-embedding-3-small",
        "max_context_tokens": memory_config.get("settings", {}).get("max_tokens", 8192),
        "persistence": True
    }
    
    # Extract execution configuration
    execution = data.get("execution", {}) or {}
    llm_config = execution.get("llm", {}) or {}
    
    model = llm_config.get("model", "gpt-4o")
    temperature = llm_config.get("temperature", 0.7)
    max_tokens = llm_config.get("max_tokens", 4096)
    
    # Build channels from protocols
    protocols = data.get("protocols", {}) or {}
    channels = []
    
    if protocols.get("mcp", {}).get("enabled"):
        channels.append({
            "channel_id": "mcp-channel",
            "channel_type": "api",
            "config": {
                "protocol": "mcp",
                "role": protocols["mcp"].get("role", "client")
            }
        })
    
    if protocols.get("a2a", {}).get("enabled"):
        channels.append({
            "channel_id": "a2a-channel",
            "channel_type": "api",
            "config": {
                "protocol": "a2a",
                "endpoint": protocols["a2a"].get("endpoint", "")
            }
        })
    
    # Default text channel
    channels.append({
        "channel_id": "text-channel",
        "channel_type": "text",
        "config": {}
    })
    
    # Build LMOS agent config
    lmos_config = {
        "agent_id": agent_id,
        "name": name,
        "description": identity.get("designation") or f"USA agent: {name}",
        "system_prompt": system_prompt,
        "skills": skills,
        "channels": channels,
        "memory": memory,
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "metadata": {
            "source": "usa",
            "usa_version": data.get("schema_version", "2.0.0"),
            "imported_at": datetime.now().isoformat(),
            "original_identity": identity,
            "tags": metadata.get("tags", [])
        }
    }
    
    return lmos_config


def lmos_to_usa(lmos_agent: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert an LMOS agent to Uniform Semantic Agent (USA) format.
    
    Args:
        lmos_agent: LMOS agent configuration dict
    
    Returns:
        USA specification dict
    """
    lmos_agent = lmos_agent or {}
    
    # Extract basic info
    agent_id = lmos_agent.get("agent_id", "lmos-agent")
    name = lmos_agent.get("name", "LMOS Agent")
    description = lmos_agent.get("description", "")
    system_prompt = lmos_agent.get("system_prompt", "")
    
    # Parse system prompt for personality hints
    core_traits = []
    values = []
    
    if "analytical" in system_prompt.lower():
        core_traits.append("analytical")
    if "helpful" in system_prompt.lower():
        core_traits.append("helpful")
    if "creative" in system_prompt.lower():
        core_traits.append("creative")
    
    # Extract skills as tools
    skills = lmos_agent.get("skills", []) or []
    tools = []
    
    for skill in skills:
        if isinstance(skill, dict):
            tool = {
                "name": skill.get("name", "unknown"),
                "protocol": "native",
                "config": skill.get("parameters", {}),
                "description": skill.get("description", "")
            }
            tools.append(tool)
    
    # Extract memory config
    memory_config = lmos_agent.get("memory", {}) or {}
    
    # Extract model config
    model = lmos_agent.get("model", "gpt-4o")
    temperature = lmos_agent.get("temperature", 0.7)
    max_tokens = lmos_agent.get("max_tokens", 4096)
    
    # Determine provider from model name
    provider = "openai"
    if "claude" in model.lower():
        provider = "anthropic"
    elif "gemini" in model.lower():
        provider = "google"
    elif "llama" in model.lower() or "mistral" in model.lower():
        provider = "local"
    
    # Build protocols from channels
    channels = lmos_agent.get("channels", []) or []
    protocols = {
        "mcp": {"enabled": False, "role": "client", "servers": [], "tools": []},
        "a2a": {"enabled": False}
    }
    
    for channel in channels:
        if isinstance(channel, dict):
            config = channel.get("config", {}) or {}
            if config.get("protocol") == "mcp":
                protocols["mcp"]["enabled"] = True
                protocols["mcp"]["role"] = config.get("role", "client")
            elif config.get("protocol") == "a2a":
                protocols["a2a"]["enabled"] = True
                protocols["a2a"]["endpoint"] = config.get("endpoint", "")
    
    # Build USA spec
    usa_spec = {
        "schema_version": "2.0.0",
        "identity": {
            "id": agent_id,
            "name": name,
            "designation": description,
            "bio": system_prompt,
            "fingerprint": "",
            "created": datetime.now().isoformat(),
            "version": "1.0.0"
        },
        "personality": {
            "core_traits": core_traits or ["adaptive", "helpful"],
            "values": values or ["accuracy", "efficiency"],
            "quirks": []
        },
        "communication": {
            "style": {
                "all": ["Be clear and concise", "Provide helpful responses"]
            }
        },
        "capabilities": {
            "primary": [s.get("name", "") for s in skills[:3] if isinstance(s, dict)],
            "secondary": [s.get("name", "") for s in skills[3:] if isinstance(s, dict)],
            "domains": [],
            "tools": tools
        },
        "knowledge": {
            "facts": [],
            "topics": [],
            "expertise": []
        },
        "memory": {
            "type": memory_config.get("type", "vector"),
            "provider": memory_config.get("provider", "local"),
            "settings": {
                "max_tokens": memory_config.get("max_context_tokens", 8192)
            }
        },
        "beliefs": {
            "who": [],
            "what": [],
            "why": [],
            "how": []
        },
        "instances": {
            "active": [],
            "terminated": []
        },
        "experience_sync": {
            "enabled": False,
            "default_protocol": "streaming",
            "merge_strategy": {
                "conflict_resolution": "latest_wins",
                "memory_deduplication": True,
                "skill_aggregation": "max",
                "knowledge_verification_threshold": 0.7
            }
        },
        "protocols": protocols,
        "execution": {
            "llm": {
                "provider": provider,
                "model": model,
                "temperature": temperature,
                "max_tokens": max_tokens
            },
            "runtime": {
                "timeout": 300,
                "max_iterations": 20,
                "error_handling": "graceful_degradation"
            }
        },
        "metadata": {
            "version": "1.0.0",
            "schema_version": "2.0.0",
            "created": datetime.now().isoformat(),
            "updated": datetime.now().isoformat(),
            "source_framework": "lmos",
            "tags": ["lmos", "imported"]
        }
    }
    
    return usa_spec


def detect_lmos_format(data: Dict[str, Any]) -> bool:
    """
    Detect if data is in LMOS agent format.
    
    Args:
        data: Agent specification dict
    
    Returns:
        True if LMOS format, False otherwise
    """
    if not isinstance(data, dict):
        return False
    
    # LMOS-specific fields
    lmos_indicators = [
        "agent_id" in data,
        "system_prompt" in data,
        "skills" in data and isinstance(data.get("skills"), list),
        "channels" in data and isinstance(data.get("channels"), list)
    ]
    
    # Need at least 2 indicators
    return sum(lmos_indicators) >= 2


# Example usage and testing
if __name__ == "__main__":
    print("=== LMOS Adapter Demo ===\n")
    
    # Create a sample USA agent
    usa_agent = {
        "schema_version": "2.0.0",
        "identity": {
            "id": "test-agent",
            "name": "Test Agent",
            "designation": "AI Assistant",
            "bio": "A helpful AI assistant for testing",
            "fingerprint": "abc123",
            "created": "2026-01-01T00:00:00Z",
            "version": "1.0.0"
        },
        "personality": {
            "core_traits": ["analytical", "helpful", "creative"],
            "values": ["accuracy", "efficiency"],
            "quirks": ["uses metaphors"]
        },
        "communication": {
            "style": {
                "all": ["Be concise", "Use examples"]
            }
        },
        "capabilities": {
            "primary": ["code_generation", "analysis"],
            "secondary": ["documentation"],
            "domains": ["software"],
            "tools": [
                {"name": "python", "protocol": "native", "config": {}},
                {"name": "search", "protocol": "mcp", "config": {}}
            ]
        },
        "memory": {
            "type": "vector",
            "provider": "local",
            "settings": {}
        },
        "protocols": {
            "mcp": {"enabled": True, "role": "client", "servers": [], "tools": []}
        },
        "execution": {
            "llm": {
                "provider": "anthropic",
                "model": "claude-3-5-sonnet",
                "temperature": 0.7,
                "max_tokens": 4096
            },
            "runtime": {
                "timeout": 300,
                "max_iterations": 20,
                "error_handling": "graceful_degradation"
            }
        },
        "metadata": {
            "version": "1.0.0",
            "schema_version": "2.0.0",
            "created": "2026-01-01T00:00:00Z",
            "updated": "2026-01-01T00:00:00Z"
        }
    }
    
    # Convert to LMOS
    lmos_agent = usa_to_lmos(usa_agent)
    print("USA -> LMOS:")
    print(f"  Agent ID: {lmos_agent['agent_id']}")
    print(f"  Name: {lmos_agent['name']}")
    print(f"  Skills: {len(lmos_agent['skills'])}")
    print(f"  Channels: {len(lmos_agent['channels'])}")
    print(f"  Model: {lmos_agent['model']}")
    print()
    
    # Convert back to USA
    usa_roundtrip = lmos_to_usa(lmos_agent)
    print("LMOS -> USA:")
    print(f"  ID: {usa_roundtrip['identity']['id']}")
    print(f"  Name: {usa_roundtrip['identity']['name']}")
    print(f"  Tools: {len(usa_roundtrip['capabilities']['tools'])}")
    print()
    
    # Test detection
    print(f"Is LMOS format: {detect_lmos_format(lmos_agent)}")
    print(f"Is USA format: {not detect_lmos_format(usa_agent)}")
