"""
AutoGen Adapter

Bidirectional conversion between Uniform Semantic Agent (USA) and Microsoft AutoGen format.

AutoGen is a framework for building multi-agent conversational AI systems with:
- Conversable agents with customizable behaviors
- Group chat orchestration
- Code execution capabilities
- Human-in-the-loop patterns

References:
- https://github.com/microsoft/autogen
- https://microsoft.github.io/autogen/
"""

from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class AutoGenLLMConfig:
    """AutoGen LLM configuration."""
    model: str = "gpt-4"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 4096
    timeout: int = 600
    cache_seed: Optional[int] = None


@dataclass
class AutoGenCodeExecutionConfig:
    """AutoGen code execution configuration."""
    work_dir: str = "workspace"
    use_docker: bool = False
    timeout: int = 60
    last_n_messages: int = 3


@dataclass
class AutoGenAgent:
    """AutoGen agent specification."""
    name: str
    system_message: str
    llm_config: Optional[AutoGenLLMConfig] = None
    code_execution_config: Optional[AutoGenCodeExecutionConfig] = None
    human_input_mode: str = "NEVER"  # NEVER, TERMINATE, ALWAYS
    max_consecutive_auto_reply: int = 10
    is_termination_msg: Optional[str] = None
    function_map: Dict[str, Any] = field(default_factory=dict)
    description: str = ""


@dataclass
class AutoGenGroupChat:
    """AutoGen group chat configuration."""
    agents: List[str]  # Agent names
    messages: List[Dict[str, Any]] = field(default_factory=list)
    max_round: int = 10
    admin_name: str = "Admin"
    speaker_selection_method: str = "auto"  # auto, round_robin, random, manual


def usa_to_autogen(spec: Any) -> Dict[str, Any]:
    """
    Convert a Uniform Semantic Agent (USA) to AutoGen agent format.
    
    Args:
        spec: USA specification (dict or object)
    
    Returns:
        AutoGen agent configuration dict
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
    
    name = identity.get("name") or metadata.get("name") or "usa_agent"
    # AutoGen names must be valid Python identifiers
    name = name.replace(" ", "_").replace("-", "_")
    
    # Build system message from identity and personality
    personality = data.get("personality", {}) or {}
    communication = data.get("communication", {}) or {}
    beliefs = data.get("beliefs", {}) or {}
    
    system_message_parts = []
    
    # Role and goal
    role = identity.get("role") or identity.get("designation") or ""
    goal = identity.get("goal") or ""
    backstory = identity.get("backstory") or identity.get("bio") or ""
    
    if role:
        system_message_parts.append(f"You are {name}, a {role}.")
    else:
        system_message_parts.append(f"You are {name}.")
    
    if goal:
        system_message_parts.append(f"Your primary goal is: {goal}")
    
    if backstory:
        if isinstance(backstory, list):
            backstory = " ".join(backstory)
        system_message_parts.append(f"\nBackground: {backstory}")
    
    # Personality traits
    core_traits = personality.get("core_traits", [])
    if core_traits:
        system_message_parts.append(f"\nYour core traits: {', '.join(core_traits)}")
    
    values = personality.get("values", [])
    if values:
        system_message_parts.append(f"Your values: {', '.join(values)}")
    
    # Communication style
    style = communication.get("style", {})
    if isinstance(style, dict):
        all_style = style.get("all", [])
        if all_style:
            system_message_parts.append("\nCommunication guidelines:")
            for s in all_style:
                system_message_parts.append(f"- {s}")
    
    # Beliefs as guidelines
    who_beliefs = beliefs.get("who", [])
    what_beliefs = beliefs.get("what", [])
    
    if who_beliefs or what_beliefs:
        system_message_parts.append("\nCore beliefs:")
        for belief in who_beliefs[:3]:
            if isinstance(belief, dict):
                system_message_parts.append(f"- {belief.get('content', '')}")
        for belief in what_beliefs[:3]:
            if isinstance(belief, dict):
                system_message_parts.append(f"- {belief.get('content', '')}")
    
    system_message = "\n".join(system_message_parts)
    
    # Extract execution configuration
    execution = data.get("execution", {}) or {}
    llm_config = execution.get("llm", {}) or {}
    runtime_config = execution.get("runtime", {}) or {}
    
    # Map provider to model format
    provider = llm_config.get("provider", "openai")
    model = llm_config.get("model", "gpt-4")
    
    # AutoGen uses OpenAI-style model names
    if provider == "anthropic":
        # Map Claude models to OpenAI equivalents for config
        model_mapping = {
            "claude-3-5-sonnet": "gpt-4",
            "claude-3-opus": "gpt-4",
            "claude-3-sonnet": "gpt-4",
            "claude-3-haiku": "gpt-3.5-turbo"
        }
        for claude_model, openai_model in model_mapping.items():
            if claude_model in model:
                model = openai_model
                break
    
    autogen_llm_config = {
        "model": model,
        "temperature": llm_config.get("temperature", 0.7),
        "max_tokens": llm_config.get("max_tokens", 4096),
        "timeout": runtime_config.get("timeout", 600),
        "cache_seed": None  # Disable caching by default
    }
    
    # Extract capabilities for function map
    capabilities = data.get("capabilities", {}) or {}
    tools = capabilities.get("tools", []) or []
    
    function_map = {}
    functions = []
    
    for tool in tools:
        if isinstance(tool, dict):
            tool_name = tool.get("name", "unknown")
            tool_desc = tool.get("description", f"Execute {tool_name}")
            tool_schema = tool.get("config", {}) or tool.get("schema", {})
            
            # Build function definition for AutoGen
            func_def = {
                "name": tool_name.replace("-", "_").replace(" ", "_"),
                "description": tool_desc,
                "parameters": {
                    "type": "object",
                    "properties": tool_schema.get("properties", {}),
                    "required": tool_schema.get("required", [])
                }
            }
            functions.append(func_def)
            
            # Placeholder for function map (actual implementation needed)
            function_map[func_def["name"]] = None
    
    # Determine human input mode
    human_input_mode = "NEVER"
    if data.get("deployment", {}).get("context") == "interactive":
        human_input_mode = "TERMINATE"
    
    # Check for code execution capability
    code_execution_config = None
    primary_caps = capabilities.get("primary", [])
    if any("code" in cap.lower() for cap in primary_caps):
        code_execution_config = {
            "work_dir": "workspace",
            "use_docker": False,
            "timeout": 60,
            "last_n_messages": 3
        }
    
    # Build AutoGen agent config
    autogen_config = {
        "name": name,
        "system_message": system_message,
        "llm_config": {
            "config_list": [autogen_llm_config],
            "functions": functions if functions else None
        },
        "code_execution_config": code_execution_config,
        "human_input_mode": human_input_mode,
        "max_consecutive_auto_reply": runtime_config.get("max_iterations", 10),
        "is_termination_msg": None,
        "function_map": function_map if function_map else None,
        "description": identity.get("designation") or f"USA agent: {name}",
        "metadata": {
            "source": "usa",
            "usa_version": data.get("schema_version", "2.0.0"),
            "imported_at": datetime.now().isoformat(),
            "original_identity": identity,
            "tags": metadata.get("tags", [])
        }
    }
    
    return autogen_config


def usa_to_autogen_assistant(spec: Any) -> Dict[str, Any]:
    """
    Convert USA to AutoGen AssistantAgent configuration.
    
    AssistantAgent is the primary agent type for task completion.
    """
    base_config = usa_to_autogen(spec)
    
    return {
        "agent_type": "AssistantAgent",
        **base_config
    }


def usa_to_autogen_user_proxy(spec: Any, human_input_mode: str = "TERMINATE") -> Dict[str, Any]:
    """
    Convert USA to AutoGen UserProxyAgent configuration.
    
    UserProxyAgent represents human users or automated proxies.
    """
    base_config = usa_to_autogen(spec)
    
    # UserProxyAgent typically has code execution enabled
    if base_config.get("code_execution_config") is None:
        base_config["code_execution_config"] = {
            "work_dir": "workspace",
            "use_docker": False,
            "timeout": 60,
            "last_n_messages": "auto"
        }
    
    base_config["human_input_mode"] = human_input_mode
    
    return {
        "agent_type": "UserProxyAgent",
        **base_config
    }


def usa_to_autogen_group_chat(
    agents: List[Any],
    max_round: int = 10,
    speaker_selection: str = "auto"
) -> Dict[str, Any]:
    """
    Convert multiple USA agents to AutoGen GroupChat configuration.
    
    Args:
        agents: List of USA agent specifications
        max_round: Maximum conversation rounds
        speaker_selection: Speaker selection method
    
    Returns:
        GroupChat configuration dict
    """
    autogen_agents = []
    agent_names = []
    
    for agent in agents:
        autogen_agent = usa_to_autogen(agent)
        autogen_agents.append(autogen_agent)
        agent_names.append(autogen_agent["name"])
    
    return {
        "group_chat": {
            "agents": agent_names,
            "max_round": max_round,
            "admin_name": "Admin",
            "speaker_selection_method": speaker_selection
        },
        "agents": autogen_agents
    }


def autogen_to_usa(autogen_agent: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert an AutoGen agent to Uniform Semantic Agent (USA) format.
    
    Args:
        autogen_agent: AutoGen agent configuration dict
    
    Returns:
        USA specification dict
    """
    autogen_agent = autogen_agent or {}
    
    # Extract basic info
    name = autogen_agent.get("name", "autogen_agent")
    # Convert back to human-readable name
    display_name = name.replace("_", " ").title()
    
    system_message = autogen_agent.get("system_message", "")
    description = autogen_agent.get("description", "")
    
    # Parse system message for personality hints
    core_traits = []
    values = []
    
    system_lower = system_message.lower()
    trait_keywords = {
        "analytical": ["analytical", "analyze", "logical"],
        "helpful": ["helpful", "assist", "help"],
        "creative": ["creative", "innovative", "imaginative"],
        "precise": ["precise", "accurate", "exact"],
        "friendly": ["friendly", "warm", "approachable"]
    }
    
    for trait, keywords in trait_keywords.items():
        if any(kw in system_lower for kw in keywords):
            core_traits.append(trait)
    
    # Extract LLM config
    llm_config = autogen_agent.get("llm_config", {}) or {}
    config_list = llm_config.get("config_list", [{}])
    first_config = config_list[0] if config_list else {}
    
    model = first_config.get("model", "gpt-4")
    temperature = first_config.get("temperature", 0.7)
    max_tokens = first_config.get("max_tokens", 4096)
    
    # Determine provider from model
    provider = "openai"
    if "claude" in model.lower():
        provider = "anthropic"
    elif "gemini" in model.lower():
        provider = "google"
    
    # Extract functions as tools
    functions = llm_config.get("functions", []) or []
    tools = []
    
    for func in functions:
        if isinstance(func, dict):
            tool = {
                "name": func.get("name", "unknown"),
                "protocol": "native",
                "config": func.get("parameters", {}),
                "description": func.get("description", "")
            }
            tools.append(tool)
    
    # Check for code execution
    code_exec = autogen_agent.get("code_execution_config")
    if code_exec:
        tools.append({
            "name": "code_execution",
            "protocol": "native",
            "config": code_exec,
            "description": "Execute code in workspace"
        })
    
    # Build USA spec
    usa_spec = {
        "schema_version": "2.0.0",
        "identity": {
            "id": name,
            "name": display_name,
            "designation": description or "AutoGen Agent",
            "bio": system_message,
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
                "all": ["Be clear and concise", "Follow instructions precisely"]
            }
        },
        "capabilities": {
            "primary": [t.get("name", "") for t in tools[:3]],
            "secondary": [t.get("name", "") for t in tools[3:]],
            "domains": [],
            "tools": tools
        },
        "knowledge": {
            "facts": [],
            "topics": [],
            "expertise": []
        },
        "memory": {
            "type": "vector",
            "provider": "local",
            "settings": {}
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
        "protocols": {
            "mcp": {"enabled": False, "role": "client", "servers": [], "tools": []},
            "a2a": {"enabled": False}
        },
        "execution": {
            "llm": {
                "provider": provider,
                "model": model,
                "temperature": temperature,
                "max_tokens": max_tokens
            },
            "runtime": {
                "timeout": first_config.get("timeout", 600),
                "max_iterations": autogen_agent.get("max_consecutive_auto_reply", 10),
                "error_handling": "graceful_degradation"
            }
        },
        "metadata": {
            "version": "1.0.0",
            "schema_version": "2.0.0",
            "created": datetime.now().isoformat(),
            "updated": datetime.now().isoformat(),
            "source_framework": "autogen",
            "tags": ["autogen", "imported"],
            "autogen_config": {
                "human_input_mode": autogen_agent.get("human_input_mode", "NEVER"),
                "agent_type": autogen_agent.get("agent_type", "AssistantAgent")
            }
        }
    }
    
    return usa_spec


def detect_autogen_format(data: Dict[str, Any]) -> bool:
    """
    Detect if data is in AutoGen agent format.
    
    Args:
        data: Agent specification dict
    
    Returns:
        True if AutoGen format, False otherwise
    """
    if not isinstance(data, dict):
        return False
    
    # AutoGen-specific fields
    autogen_indicators = [
        "system_message" in data,
        "llm_config" in data,
        "human_input_mode" in data,
        "max_consecutive_auto_reply" in data,
        "code_execution_config" in data
    ]
    
    # Need at least 2 indicators
    return sum(autogen_indicators) >= 2


# Example usage and testing
if __name__ == "__main__":
    print("=== AutoGen Adapter Demo ===\n")
    
    # Create a sample USA agent
    usa_agent = {
        "schema_version": "2.0.0",
        "identity": {
            "id": "test-agent",
            "name": "Code Assistant",
            "designation": "Software Development Assistant",
            "bio": "An AI assistant specialized in software development and code review.",
            "fingerprint": "abc123",
            "created": "2026-01-01T00:00:00Z",
            "version": "1.0.0"
        },
        "personality": {
            "core_traits": ["analytical", "precise", "helpful"],
            "values": ["code quality", "best practices"],
            "quirks": ["explains with examples"]
        },
        "communication": {
            "style": {
                "all": ["Be concise", "Include code examples", "Explain reasoning"]
            }
        },
        "capabilities": {
            "primary": ["code_generation", "code_review", "debugging"],
            "secondary": ["documentation", "testing"],
            "domains": ["software", "python", "typescript"],
            "tools": [
                {"name": "python_executor", "protocol": "native", "config": {}},
                {"name": "file_reader", "protocol": "native", "config": {}}
            ]
        },
        "memory": {
            "type": "vector",
            "provider": "local",
            "settings": {}
        },
        "protocols": {
            "mcp": {"enabled": False}
        },
        "execution": {
            "llm": {
                "provider": "openai",
                "model": "gpt-4",
                "temperature": 0.3,
                "max_tokens": 4096
            },
            "runtime": {
                "timeout": 300,
                "max_iterations": 15,
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
    
    # Convert to AutoGen
    autogen_agent = usa_to_autogen(usa_agent)
    print("USA -> AutoGen:")
    print(f"  Name: {autogen_agent['name']}")
    print(f"  Human Input Mode: {autogen_agent['human_input_mode']}")
    print(f"  Max Auto Reply: {autogen_agent['max_consecutive_auto_reply']}")
    print(f"  Has Code Execution: {autogen_agent['code_execution_config'] is not None}")
    print(f"  System Message Length: {len(autogen_agent['system_message'])} chars")
    print()
    
    # Convert to AssistantAgent
    assistant = usa_to_autogen_assistant(usa_agent)
    print(f"AssistantAgent type: {assistant['agent_type']}")
    print()
    
    # Convert back to USA
    usa_roundtrip = autogen_to_usa(autogen_agent)
    print("AutoGen -> USA:")
    print(f"  ID: {usa_roundtrip['identity']['id']}")
    print(f"  Name: {usa_roundtrip['identity']['name']}")
    print(f"  Tools: {len(usa_roundtrip['capabilities']['tools'])}")
    print()
    
    # Test detection
    print(f"Is AutoGen format: {detect_autogen_format(autogen_agent)}")
    print(f"Is USA format: {not detect_autogen_format(usa_agent)}")
    
    # Group chat example
    print("\n=== Group Chat Demo ===")
    agents = [usa_agent, usa_agent]  # Two agents for demo
    group_config = usa_to_autogen_group_chat(agents, max_round=5)
    print(f"Group Chat Agents: {group_config['group_chat']['agents']}")
    print(f"Max Rounds: {group_config['group_chat']['max_round']}")
