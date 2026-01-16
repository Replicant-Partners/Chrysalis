"""
AgentBuilder - Fluent builder for UniformSemanticAgentV2 configurations.

Provides a chainable API to construct complete agent definitions with validation.

Example:
    agent = (
        AgentBuilder()
        .with_identity(name="Ada", designation="Research Assistant")
        .add_traits("analytical", "curious", "thorough")
        .add_values("accuracy", "transparency")
        .add_capabilities(["code review", "documentation"])
        .with_llm("anthropic", "claude-3-5-sonnet-20241022")
        .build()
    )
"""

from __future__ import annotations

import copy
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Self
from uuid import uuid4

from .errors import AgentBuilderError
from .types import (
    SCHEMA_VERSION,
    Belief,
    ConflictResolution,
    Concept,
    Episode,
    MemoryType,
    Skill,
    SkillAggregation,
    SyncProtocol,
    ToolDefinition,
    validate_agent,
)


@dataclass
class BuilderState:
    """Internal state for the builder."""

    identity: dict[str, Any] = field(default_factory=dict)
    personality: dict[str, Any] = field(
        default_factory=lambda: {
            "core_traits": [],
            "values": [],
            "quirks": [],
        }
    )
    communication: dict[str, Any] = field(
        default_factory=lambda: {"style": {"all": []}}
    )
    capabilities: dict[str, Any] = field(
        default_factory=lambda: {
            "primary": [],
            "secondary": [],
            "domains": [],
            "tools": [],
            "learned_skills": [],
        }
    )
    knowledge: dict[str, Any] = field(
        default_factory=lambda: {
            "facts": [],
            "topics": [],
            "expertise": [],
            "accumulated_knowledge": [],
        }
    )
    memory: dict[str, Any] = field(
        default_factory=lambda: {
            "type": "vector",
            "provider": "local",
            "settings": {},
            "collections": {"episodic": [], "semantic": []},
        }
    )
    beliefs: dict[str, Any] = field(
        default_factory=lambda: {
            "who": [],
            "what": [],
            "why": [],
            "how": [],
            "where": [],
            "when": [],
            "huh": [],
        }
    )
    instances: dict[str, Any] = field(
        default_factory=lambda: {"active": [], "terminated": []}
    )
    experience_sync: dict[str, Any] = field(
        default_factory=lambda: {
            "enabled": False,
            "default_protocol": "streaming",
            "merge_strategy": {
                "conflict_resolution": "latest_wins",
                "memory_deduplication": True,
                "skill_aggregation": "max",
                "knowledge_verification_threshold": 0.7,
            },
        }
    )
    protocols: dict[str, Any] = field(default_factory=dict)
    execution: dict[str, Any] = field(
        default_factory=lambda: {
            "llm": {
                "provider": "anthropic",
                "model": "claude-3-5-sonnet-20241022",
                "temperature": 0.7,
                "max_tokens": 4096,
            },
            "runtime": {
                "timeout": 300,
                "max_iterations": 20,
                "error_handling": "graceful_degradation",
            },
        }
    )
    deployment: dict[str, Any] = field(
        default_factory=lambda: {"preferred_contexts": []}
    )
    metadata: dict[str, Any] = field(default_factory=lambda: {"tags": []})
    training: dict[str, Any] = field(default_factory=dict)


def _create_default_state() -> BuilderState:
    """Create a new default builder state."""
    return BuilderState()


def _initialize_from_template(
    state: BuilderState, template: dict[str, Any]
) -> None:
    """Initialize state from a template agent."""
    if "identity" in template:
        state.identity = copy.deepcopy(template["identity"])
    if "personality" in template:
        state.personality = copy.deepcopy(template["personality"])
    if "communication" in template:
        state.communication = copy.deepcopy(template["communication"])
    if "capabilities" in template:
        state.capabilities = copy.deepcopy(template["capabilities"])
    if "knowledge" in template:
        state.knowledge = copy.deepcopy(template["knowledge"])
    if "memory" in template:
        state.memory = copy.deepcopy(template["memory"])
    if "beliefs" in template:
        state.beliefs = copy.deepcopy(template["beliefs"])
    if "instances" in template:
        state.instances = copy.deepcopy(template["instances"])
    if "experience_sync" in template:
        state.experience_sync = copy.deepcopy(template["experience_sync"])
    if "protocols" in template:
        state.protocols = copy.deepcopy(template["protocols"])
    if "execution" in template:
        state.execution = copy.deepcopy(template["execution"])
    if "deployment" in template:
        state.deployment = copy.deepcopy(template["deployment"])
    if "metadata" in template:
        state.metadata = copy.deepcopy(template["metadata"])
    if "training" in template:
        state.training = copy.deepcopy(template["training"])


class AgentBuilder:
    """
    Fluent builder for UniformSemanticAgentV2 configurations.

    Provides a chainable API to construct complete agent definitions.
    All methods return self for chaining.

    Example:
        agent = (
            AgentBuilder()
            .with_name("Ada")
            .with_designation("Research Assistant")
            .add_traits("analytical", "curious")
            .with_llm("anthropic", "claude-3-5-sonnet-20241022")
            .enable_mcp(servers=[...])
            .build()
        )
    """

    def __init__(self, template: dict[str, Any] | None = None) -> None:
        """
        Initialize a new AgentBuilder.

        Args:
            template: Optional template agent dict to initialize from.
        """
        self.state = _create_default_state()
        if template:
            _initialize_from_template(self.state, template)

    # ─────────────────────────────────────────────────────────────────
    # Identity methods
    # ─────────────────────────────────────────────────────────────────

    def with_identity(
        self,
        name: str,
        *,
        id: str | None = None,
        designation: str = "",
        bio: str | list[str] = "",
        fingerprint: str = "",
        version: str = "1.0.0",
    ) -> Self:
        """
        Set the agent's identity.

        Args:
            name: Agent name (required).
            id: Unique identifier (auto-generated if not provided).
            designation: Role or title.
            bio: Biography text or list of bio lines.
            fingerprint: Unique fingerprint.
            version: Agent version.

        Returns:
            Self for chaining.

        Raises:
            AgentBuilderError: If name is empty.
        """
        if not name or not name.strip():
            raise AgentBuilderError("Agent name is required", "identity.name")

        self.state.identity = {
            "id": id or str(uuid4()),
            "name": name,
            "designation": designation,
            "bio": bio,
            "fingerprint": fingerprint,
            "created": datetime.now(timezone.utc).isoformat(),
            "version": version,
        }
        return self

    def with_name(self, name: str) -> Self:
        """Set the agent's name."""
        self.state.identity["name"] = name
        if not self.state.identity.get("id"):
            self.state.identity["id"] = str(uuid4())
        return self

    def with_designation(self, designation: str) -> Self:
        """Set the agent's designation/role."""
        self.state.identity["designation"] = designation
        return self

    def with_bio(self, bio: str | list[str]) -> Self:
        """Set the agent's biography."""
        self.state.identity["bio"] = bio
        return self

    # ─────────────────────────────────────────────────────────────────
    # Personality methods
    # ─────────────────────────────────────────────────────────────────

    def with_personality(
        self,
        *,
        core_traits: list[str] | None = None,
        values: list[str] | None = None,
        quirks: list[str] | None = None,
        fears: list[str] | None = None,
        aspirations: list[str] | None = None,
        emotional_ranges: dict[str, dict[str, Any]] | None = None,
    ) -> Self:
        """Set the agent's personality configuration."""
        self.state.personality = {
            "core_traits": core_traits or [],
            "values": values or [],
            "quirks": quirks or [],
        }
        if fears:
            self.state.personality["fears"] = fears
        if aspirations:
            self.state.personality["aspirations"] = aspirations
        if emotional_ranges:
            self.state.personality["emotional_ranges"] = emotional_ranges
        return self

    def add_traits(self, *traits: str) -> Self:
        """Add core personality traits."""
        self.state.personality.setdefault("core_traits", [])
        self.state.personality["core_traits"].extend(traits)
        return self

    def add_values(self, *values: str) -> Self:
        """Add personality values."""
        self.state.personality.setdefault("values", [])
        self.state.personality["values"].extend(values)
        return self

    def add_quirks(self, *quirks: str) -> Self:
        """Add personality quirks."""
        self.state.personality.setdefault("quirks", [])
        self.state.personality["quirks"].extend(quirks)
        return self

    # ─────────────────────────────────────────────────────────────────
    # Communication methods
    # ─────────────────────────────────────────────────────────────────

    def with_communication(
        self,
        *,
        style: dict[str, list[str]] | None = None,
        signature_phrases: list[str] | None = None,
        voice: dict[str, Any] | None = None,
    ) -> Self:
        """Set the agent's communication configuration."""
        self.state.communication = {"style": style or {"all": []}}
        if signature_phrases:
            self.state.communication["signature_phrases"] = signature_phrases
        if voice:
            self.state.communication["voice"] = voice
        return self

    def add_style_rules(self, context: str, *rules: str) -> Self:
        """Add style rules for a specific context."""
        if "style" not in self.state.communication:
            self.state.communication["style"] = {"all": []}
        if context not in self.state.communication["style"]:
            self.state.communication["style"][context] = []
        self.state.communication["style"][context].extend(rules)
        return self

    def add_signature_phrases(self, *phrases: str) -> Self:
        """Add signature phrases."""
        self.state.communication.setdefault("signature_phrases", [])
        self.state.communication["signature_phrases"].extend(phrases)
        return self

    # ─────────────────────────────────────────────────────────────────
    # Capabilities methods
    # ─────────────────────────────────────────────────────────────────

    def add_capability(self, capability: str, *, primary: bool = True) -> Self:
        """Add a single capability."""
        key = "primary" if primary else "secondary"
        self.state.capabilities.setdefault(key, [])
        self.state.capabilities[key].append(capability)
        return self

    def add_capabilities(
        self, capabilities: list[str], *, primary: bool = True
    ) -> Self:
        """Add multiple capabilities."""
        for cap in capabilities:
            self.add_capability(cap, primary=primary)
        return self

    def add_domain(self, domain: str) -> Self:
        """Add a domain of expertise."""
        self.state.capabilities.setdefault("domains", [])
        self.state.capabilities["domains"].append(domain)
        return self

    def add_tool(self, tool: ToolDefinition | dict[str, Any]) -> Self:
        """Add a tool definition."""
        self.state.capabilities.setdefault("tools", [])
        tool_dict = asdict(tool) if isinstance(tool, ToolDefinition) else tool
        self.state.capabilities["tools"].append(tool_dict)
        return self

    def add_skill(self, skill: Skill | dict[str, Any]) -> Self:
        """Add a learned skill."""
        self.state.capabilities.setdefault("learned_skills", [])
        skill_dict = asdict(skill) if isinstance(skill, Skill) else skill
        self.state.capabilities["learned_skills"].append(skill_dict)
        return self

    # ─────────────────────────────────────────────────────────────────
    # Knowledge methods
    # ─────────────────────────────────────────────────────────────────

    def add_facts(self, *facts: str) -> Self:
        """Add knowledge facts."""
        self.state.knowledge.setdefault("facts", [])
        self.state.knowledge["facts"].extend(facts)
        return self

    def add_topics(self, *topics: str) -> Self:
        """Add knowledge topics."""
        self.state.knowledge.setdefault("topics", [])
        self.state.knowledge["topics"].extend(topics)
        return self

    def add_expertise(self, *areas: str) -> Self:
        """Add areas of expertise."""
        self.state.knowledge.setdefault("expertise", [])
        self.state.knowledge["expertise"].extend(areas)
        return self

    # ─────────────────────────────────────────────────────────────────
    # Memory methods
    # ─────────────────────────────────────────────────────────────────

    def with_memory(
        self,
        *,
        type: MemoryType = "vector",
        provider: str = "local",
        settings: dict[str, Any] | None = None,
    ) -> Self:
        """Configure memory settings."""
        self.state.memory = {
            "type": type,
            "provider": provider,
            "settings": settings or {},
            "collections": self.state.memory.get(
                "collections", {"episodic": [], "semantic": []}
            ),
        }
        return self

    def add_episode(self, episode: Episode | dict[str, Any]) -> Self:
        """Add an episodic memory."""
        if "collections" not in self.state.memory:
            self.state.memory["collections"] = {"episodic": [], "semantic": []}
        if "episodic" not in self.state.memory["collections"]:
            self.state.memory["collections"]["episodic"] = []

        episode_dict = asdict(episode) if isinstance(episode, Episode) else episode
        self.state.memory["collections"]["episodic"].append(episode_dict)
        return self

    def add_concept(self, concept: Concept | dict[str, Any]) -> Self:
        """Add a semantic concept."""
        if "collections" not in self.state.memory:
            self.state.memory["collections"] = {"episodic": [], "semantic": []}
        if "semantic" not in self.state.memory["collections"]:
            self.state.memory["collections"]["semantic"] = []

        concept_dict = asdict(concept) if isinstance(concept, Concept) else concept
        self.state.memory["collections"]["semantic"].append(concept_dict)
        return self

    # ─────────────────────────────────────────────────────────────────
    # Beliefs methods
    # ─────────────────────────────────────────────────────────────────

    def add_belief(
        self,
        category: str,
        belief: Belief | dict[str, Any],
    ) -> Self:
        """
        Add a belief to a category.

        Args:
            category: One of 'who', 'what', 'why', 'how', 'where', 'when', 'huh'.
            belief: The belief to add.
        """
        if category not in self.state.beliefs:
            self.state.beliefs[category] = []

        belief_dict = asdict(belief) if isinstance(belief, Belief) else belief
        self.state.beliefs[category].append(belief_dict)
        return self

    def add_beliefs(
        self,
        category: str,
        beliefs: list[Belief | dict[str, Any]],
    ) -> Self:
        """Add multiple beliefs to a category."""
        for belief in beliefs:
            self.add_belief(category, belief)
        return self

    # ─────────────────────────────────────────────────────────────────
    # Sync methods
    # ─────────────────────────────────────────────────────────────────

    def enable_sync(
        self,
        protocol: SyncProtocol = "streaming",
        *,
        conflict_resolution: ConflictResolution = "latest_wins",
        memory_deduplication: bool = True,
        skill_aggregation: SkillAggregation = "max",
        knowledge_verification_threshold: float = 0.7,
    ) -> Self:
        """Enable experience synchronization."""
        self.state.experience_sync = {
            "enabled": True,
            "default_protocol": protocol,
            "merge_strategy": {
                "conflict_resolution": conflict_resolution,
                "memory_deduplication": memory_deduplication,
                "skill_aggregation": skill_aggregation,
                "knowledge_verification_threshold": knowledge_verification_threshold,
            },
        }
        return self

    def disable_sync(self) -> Self:
        """Disable experience synchronization."""
        self.state.experience_sync["enabled"] = False
        return self

    def with_streaming_sync(
        self,
        *,
        interval_ms: int,
        batch_size: int,
        priority_threshold: float,
    ) -> Self:
        """Configure streaming sync."""
        self.state.experience_sync["streaming"] = {
            "enabled": True,
            "interval_ms": interval_ms,
            "batch_size": batch_size,
            "priority_threshold": priority_threshold,
        }
        return self

    def with_lumped_sync(
        self,
        *,
        batch_interval: str,
        max_batch_size: int,
        compression: bool = True,
    ) -> Self:
        """Configure lumped sync."""
        self.state.experience_sync["lumped"] = {
            "enabled": True,
            "batch_interval": batch_interval,
            "max_batch_size": max_batch_size,
            "compression": compression,
        }
        return self

    def with_check_in_sync(
        self,
        *,
        schedule: str,
        include_full_state: bool = False,
    ) -> Self:
        """Configure check-in sync."""
        self.state.experience_sync["check_in"] = {
            "enabled": True,
            "schedule": schedule,
            "include_full_state": include_full_state,
        }
        return self

    # ─────────────────────────────────────────────────────────────────
    # Protocol methods
    # ─────────────────────────────────────────────────────────────────

    def enable_mcp(
        self,
        *,
        role: str = "client",
        servers: list[dict[str, Any]] | None = None,
        tools: list[str] | None = None,
    ) -> Self:
        """Enable MCP protocol."""
        self.state.protocols["mcp"] = {
            "enabled": True,
            "role": role,
            "servers": servers or [],
            "tools": tools or [],
        }
        return self

    def enable_a2a(
        self,
        *,
        role: str = "client",
        endpoint: str,
        agent_card: dict[str, Any],
        authentication: dict[str, Any],
        peers: list[str] | None = None,
    ) -> Self:
        """Enable A2A protocol."""
        self.state.protocols["a2a"] = {
            "enabled": True,
            "role": role,
            "endpoint": endpoint,
            "agent_card": agent_card,
            "authentication": authentication,
            "peers": peers or [],
        }
        return self

    def enable_agent_protocol(
        self,
        *,
        endpoint: str,
        capabilities: list[str] | None = None,
        task_types: list[str] | None = None,
    ) -> Self:
        """Enable Agent Protocol."""
        self.state.protocols["agent_protocol"] = {
            "enabled": True,
            "endpoint": endpoint,
            "capabilities": capabilities or [],
            "task_types": task_types or [],
        }
        return self

    # ─────────────────────────────────────────────────────────────────
    # Execution methods
    # ─────────────────────────────────────────────────────────────────

    def with_execution(
        self,
        *,
        llm: dict[str, Any] | None = None,
        runtime: dict[str, Any] | None = None,
    ) -> Self:
        """Configure execution settings."""
        if llm:
            self.state.execution["llm"] = {
                "provider": llm.get("provider", "anthropic"),
                "model": llm.get("model", "claude-3-5-sonnet-20241022"),
                "temperature": llm.get("temperature", 0.7),
                "max_tokens": llm.get("max_tokens", 4096),
            }
            if "parameters" in llm:
                self.state.execution["llm"]["parameters"] = llm["parameters"]

        if runtime:
            self.state.execution["runtime"] = {
                "timeout": runtime.get("timeout", 300),
                "max_iterations": runtime.get("max_iterations", 20),
                "error_handling": runtime.get(
                    "error_handling", "graceful_degradation"
                ),
            }
            if "retry_policy" in runtime:
                self.state.execution["runtime"]["retry_policy"] = runtime[
                    "retry_policy"
                ]

        return self

    def with_llm(
        self,
        provider: str,
        model: str,
        *,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> Self:
        """Configure LLM settings."""
        self.state.execution["llm"] = {
            "provider": provider,
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        return self

    # ─────────────────────────────────────────────────────────────────
    # Deployment methods
    # ─────────────────────────────────────────────────────────────────

    def with_deployment(
        self,
        *,
        preferred_contexts: list[str] | None = None,
        scaling: Any = None,
        environment: dict[str, Any] | None = None,
    ) -> Self:
        """Configure deployment settings."""
        self.state.deployment = {
            "preferred_contexts": preferred_contexts or [],
        }
        if scaling:
            self.state.deployment["scaling"] = scaling
        if environment:
            self.state.deployment["environment"] = environment
        return self

    def add_deployment_context(self, context: str) -> Self:
        """Add a preferred deployment context."""
        self.state.deployment.setdefault("preferred_contexts", [])
        self.state.deployment["preferred_contexts"].append(context)
        return self

    # ─────────────────────────────────────────────────────────────────
    # Metadata methods
    # ─────────────────────────────────────────────────────────────────

    def with_metadata(
        self,
        *,
        version: str | None = None,
        author: str | None = None,
        tags: list[str] | None = None,
        source_framework: str | None = None,
    ) -> Self:
        """Configure metadata."""
        if version:
            self.state.metadata["version"] = version
        if author:
            self.state.metadata["author"] = author
        if tags:
            self.state.metadata["tags"] = tags
        if source_framework:
            self.state.metadata["source_framework"] = source_framework
        return self

    def add_tags(self, *tags: str) -> Self:
        """Add metadata tags."""
        self.state.metadata.setdefault("tags", [])
        self.state.metadata["tags"].extend(tags)
        return self

    def with_author(self, author: str) -> Self:
        """Set the author."""
        self.state.metadata["author"] = author
        return self

    # ─────────────────────────────────────────────────────────────────
    # Build methods
    # ─────────────────────────────────────────────────────────────────

    def _validate(self) -> None:
        """Validate the current state."""
        if not self.state.identity.get("name"):
            raise AgentBuilderError(
                "Agent name is required. Call with_identity() or with_name() first.",
                "identity.name",
            )

        if not self.state.identity.get("id"):
            self.state.identity["id"] = str(uuid4())

        if not self.state.identity.get("created"):
            self.state.identity["created"] = datetime.now(timezone.utc).isoformat()

        has_protocol = (
            self.state.protocols.get("mcp", {}).get("enabled")
            or self.state.protocols.get("a2a", {}).get("enabled")
            or self.state.protocols.get("agent_protocol", {}).get("enabled")
        )

        if not has_protocol:
            import warnings

            warnings.warn(
                "AgentBuilder: No protocols enabled. Agent may not be functional."
            )

    def build(self) -> dict[str, Any]:
        """
        Build and return the complete agent configuration.

        Returns:
            UniformSemanticAgentV2 configuration dictionary.

        Raises:
            AgentBuilderError: If validation fails.
        """
        self._validate()

        now = datetime.now(timezone.utc).isoformat()

        agent: dict[str, Any] = {
            "schema_version": SCHEMA_VERSION,
            "identity": {
                "id": self.state.identity.get("id", str(uuid4())),
                "name": self.state.identity["name"],
                "designation": self.state.identity.get("designation", ""),
                "bio": self.state.identity.get("bio", ""),
                "fingerprint": self.state.identity.get("fingerprint", ""),
                "created": self.state.identity.get("created", now),
                "version": self.state.identity.get("version", "1.0.0"),
            },
            "personality": {
                "core_traits": self.state.personality.get("core_traits", []),
                "values": self.state.personality.get("values", []),
                "quirks": self.state.personality.get("quirks", []),
            },
            "communication": {
                "style": self.state.communication.get("style", {"all": []}),
            },
            "capabilities": {
                "primary": self.state.capabilities.get("primary", []),
                "secondary": self.state.capabilities.get("secondary", []),
                "domains": self.state.capabilities.get("domains", []),
            },
            "knowledge": {
                "facts": self.state.knowledge.get("facts", []),
                "topics": self.state.knowledge.get("topics", []),
                "expertise": self.state.knowledge.get("expertise", []),
            },
            "memory": {
                "type": self.state.memory.get("type", "vector"),
                "provider": self.state.memory.get("provider", "local"),
                "settings": self.state.memory.get("settings", {}),
                "collections": self.state.memory.get("collections"),
            },
            "beliefs": {
                "who": self.state.beliefs.get("who", []),
                "what": self.state.beliefs.get("what", []),
                "why": self.state.beliefs.get("why", []),
                "how": self.state.beliefs.get("how", []),
            },
            "instances": {
                "active": self.state.instances.get("active", []),
                "terminated": self.state.instances.get("terminated", []),
            },
            "experience_sync": {
                "enabled": self.state.experience_sync.get("enabled", False),
                "default_protocol": self.state.experience_sync.get(
                    "default_protocol", "streaming"
                ),
                "merge_strategy": {
                    "conflict_resolution": self.state.experience_sync.get(
                        "merge_strategy", {}
                    ).get("conflict_resolution", "latest_wins"),
                    "memory_deduplication": self.state.experience_sync.get(
                        "merge_strategy", {}
                    ).get("memory_deduplication", True),
                    "skill_aggregation": self.state.experience_sync.get(
                        "merge_strategy", {}
                    ).get("skill_aggregation", "max"),
                    "knowledge_verification_threshold": self.state.experience_sync.get(
                        "merge_strategy", {}
                    ).get("knowledge_verification_threshold", 0.7),
                },
            },
            "protocols": {
                "mcp": self.state.protocols.get("mcp"),
                "a2a": self.state.protocols.get("a2a"),
                "agent_protocol": self.state.protocols.get("agent_protocol"),
            },
            "execution": {
                "llm": {
                    "provider": self.state.execution.get("llm", {}).get(
                        "provider", "anthropic"
                    ),
                    "model": self.state.execution.get("llm", {}).get(
                        "model", "claude-3-5-sonnet-20241022"
                    ),
                    "temperature": self.state.execution.get("llm", {}).get(
                        "temperature", 0.7
                    ),
                    "max_tokens": self.state.execution.get("llm", {}).get(
                        "max_tokens", 4096
                    ),
                },
                "runtime": {
                    "timeout": self.state.execution.get("runtime", {}).get(
                        "timeout", 300
                    ),
                    "max_iterations": self.state.execution.get("runtime", {}).get(
                        "max_iterations", 20
                    ),
                    "error_handling": self.state.execution.get("runtime", {}).get(
                        "error_handling", "graceful_degradation"
                    ),
                },
            },
            "deployment": {
                "preferred_contexts": self.state.deployment.get(
                    "preferred_contexts", []
                ),
            },
            "metadata": {
                "version": self.state.metadata.get("version", "1.0.0"),
                "schema_version": SCHEMA_VERSION,
                "created": self.state.metadata.get("created", now),
                "updated": now,
            },
        }

        # Add optional fields if present
        if "fears" in self.state.personality:
            agent["personality"]["fears"] = self.state.personality["fears"]
        if "aspirations" in self.state.personality:
            agent["personality"]["aspirations"] = self.state.personality["aspirations"]
        if "emotional_ranges" in self.state.personality:
            agent["personality"]["emotional_ranges"] = self.state.personality[
                "emotional_ranges"
            ]

        if "signature_phrases" in self.state.communication:
            agent["communication"]["signature_phrases"] = self.state.communication[
                "signature_phrases"
            ]
        if "voice" in self.state.communication:
            agent["communication"]["voice"] = self.state.communication["voice"]

        if self.state.capabilities.get("tools"):
            agent["capabilities"]["tools"] = self.state.capabilities["tools"]
        if self.state.capabilities.get("learned_skills"):
            agent["capabilities"]["learned_skills"] = self.state.capabilities[
                "learned_skills"
            ]

        if self.state.knowledge.get("sources"):
            agent["knowledge"]["sources"] = self.state.knowledge["sources"]
        if self.state.knowledge.get("lore"):
            agent["knowledge"]["lore"] = self.state.knowledge["lore"]
        if self.state.knowledge.get("accumulated_knowledge"):
            agent["knowledge"]["accumulated_knowledge"] = self.state.knowledge[
                "accumulated_knowledge"
            ]

        for key in ["where", "when", "huh"]:
            if self.state.beliefs.get(key):
                agent["beliefs"][key] = self.state.beliefs[key]

        if self.state.experience_sync.get("streaming"):
            agent["experience_sync"]["streaming"] = self.state.experience_sync[
                "streaming"
            ]
        if self.state.experience_sync.get("lumped"):
            agent["experience_sync"]["lumped"] = self.state.experience_sync["lumped"]
        if self.state.experience_sync.get("check_in"):
            agent["experience_sync"]["check_in"] = self.state.experience_sync[
                "check_in"
            ]

        if self.state.execution.get("llm", {}).get("parameters"):
            agent["execution"]["llm"]["parameters"] = self.state.execution["llm"][
                "parameters"
            ]
        if self.state.execution.get("runtime", {}).get("retry_policy"):
            agent["execution"]["runtime"]["retry_policy"] = self.state.execution[
                "runtime"
            ]["retry_policy"]

        if self.state.deployment.get("scaling"):
            agent["deployment"]["scaling"] = self.state.deployment["scaling"]
        if self.state.deployment.get("environment"):
            agent["deployment"]["environment"] = self.state.deployment["environment"]

        if self.state.metadata.get("author"):
            agent["metadata"]["author"] = self.state.metadata["author"]
        if self.state.metadata.get("tags"):
            agent["metadata"]["tags"] = self.state.metadata["tags"]
        if self.state.metadata.get("source_framework"):
            agent["metadata"]["source_framework"] = self.state.metadata[
                "source_framework"
            ]
        if self.state.metadata.get("evolution"):
            agent["metadata"]["evolution"] = self.state.metadata["evolution"]

        if self.state.training:
            agent["training"] = self.state.training

        # Final validation
        validation = validate_agent(agent)
        if not validation.valid:
            raise AgentBuilderError(
                f"Agent validation failed: {', '.join(validation.errors)}",
                "validation",
            )

        return agent

    def build_json(self, indent: int = 2) -> str:
        """Build and return as JSON string."""
        return json.dumps(self.build(), indent=indent)

    def clone(self) -> AgentBuilder:
        """Create a deep copy of this builder."""
        cloned = AgentBuilder()
        cloned.state = BuilderState(
            identity=copy.deepcopy(self.state.identity),
            personality=copy.deepcopy(self.state.personality),
            communication=copy.deepcopy(self.state.communication),
            capabilities=copy.deepcopy(self.state.capabilities),
            knowledge=copy.deepcopy(self.state.knowledge),
            memory=copy.deepcopy(self.state.memory),
            beliefs=copy.deepcopy(self.state.beliefs),
            instances=copy.deepcopy(self.state.instances),
            experience_sync=copy.deepcopy(self.state.experience_sync),
            protocols=copy.deepcopy(self.state.protocols),
            execution=copy.deepcopy(self.state.execution),
            deployment=copy.deepcopy(self.state.deployment),
            metadata=copy.deepcopy(self.state.metadata),
            training=copy.deepcopy(self.state.training),
        )
        return cloned


# ─────────────────────────────────────────────────────────────────────────
# Factory functions
# ─────────────────────────────────────────────────────────────────────────


def create_agent_builder(
    template: dict[str, Any] | None = None,
) -> AgentBuilder:
    """
    Create a new AgentBuilder instance.

    Factory function for convenient builder creation.

    Args:
        template: Optional template agent.

    Returns:
        New AgentBuilder instance.

    Example:
        agent = create_agent_builder().with_identity(name="Ada").build()
    """
    return AgentBuilder(template)


def quick_agent(
    name: str,
    *,
    designation: str = "",
    bio: str = "",
    traits: list[str] | None = None,
    capabilities: list[str] | None = None,
    llm_provider: str = "anthropic",
    llm_model: str = "claude-3-5-sonnet-20241022",
) -> dict[str, Any]:
    """
    Quick agent creation with minimal configuration.

    Args:
        name: Agent name.
        designation: Role or title.
        bio: Biography.
        traits: Personality traits.
        capabilities: Primary capabilities.
        llm_provider: LLM provider name.
        llm_model: LLM model name.

    Returns:
        Constructed agent dictionary.

    Example:
        agent = quick_agent(
            "Ada",
            designation="Research Assistant",
            traits=["analytical", "curious"]
        )
    """
    builder = AgentBuilder()
    builder.with_identity(name=name, designation=designation, bio=bio)

    if traits:
        builder.add_traits(*traits)

    if capabilities:
        builder.add_capabilities(capabilities)

    builder.with_llm(llm_provider, llm_model)

    return builder.build()
