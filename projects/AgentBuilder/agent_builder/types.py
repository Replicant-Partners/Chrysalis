"""
Type definitions for SemanticAgent and AgentBuilder.

Provides dataclasses and TypedDict definitions for agent configuration.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, TypedDict
from uuid import uuid4


SCHEMA_VERSION = "2.0.0"

# Type aliases
AgentImplementationType = Literal["mcp", "multi_agent", "orchestrated"]
SyncProtocol = Literal["streaming", "lumped", "check_in"]
ExperienceTransportType = Literal["https", "websocket", "mcp"]
InstanceStatus = Literal["running", "idle", "syncing", "terminated"]
ConflictResolution = Literal["latest_wins", "weighted_merge", "manual_review"]
SkillAggregation = Literal["max", "average", "weighted"]
MemoryType = Literal["vector", "graph", "hybrid"]
ProtocolRole = Literal["client", "server", "both"]
AuthType = Literal["oauth2", "jwt", "apikey"]
InteractionType = Literal["conversation", "tool_use", "decision", "collaboration"]
ToolProtocol = Literal["mcp", "native", "api"]
HealthStatus = Literal["healthy", "degraded", "unhealthy"]
BeliefPrivacy = Literal["PUBLIC", "PRIVATE"]


@dataclass
class Interaction:
    """A single interaction within an episode."""
    interaction_id: str
    timestamp: str
    type: InteractionType
    participants: list[str]
    content: str
    result: str
    effectiveness: float


@dataclass
class Episode:
    """Specific experience instance."""
    episode_id: str
    timestamp: str
    source_instance: str
    duration: int  # milliseconds
    context: dict[str, Any]
    interactions: list[Interaction]
    outcome: str
    lessons_learned: list[str]
    skills_practiced: list[str]
    effectiveness_rating: float  # 0.0 - 1.0
    ooda: dict[str, Any] | None = None


@dataclass
class Concept:
    """Semantic knowledge unit."""
    concept_id: str
    name: str
    definition: str
    related_concepts: list[str]
    confidence: float
    sources: list[str]
    usage_count: int
    last_used: str


@dataclass
class BeliefRevision:
    """Revision history entry for a belief."""
    timestamp: str
    previous_conviction: float
    reason: str
    source_instance: str


@dataclass
class Belief:
    """Enhanced belief with evolution tracking."""
    content: str
    conviction: float
    privacy: BeliefPrivacy
    source: str
    tags: list[str] | None = None
    revision_history: list[BeliefRevision] | None = None


@dataclass
class ToolUsageStats:
    """Usage statistics for a tool."""
    total_invocations: int
    success_rate: float
    average_latency_ms: float
    last_used: str
    preferred_contexts: list[str]


@dataclass
class ToolDefinition:
    """Enhanced tool with usage stats."""
    name: str
    protocol: ToolProtocol
    config: dict[str, Any]
    usage_stats: ToolUsageStats | None = None


@dataclass
class SkillLearningEvent:
    """Learning curve event for a skill."""
    timestamp: str
    proficiency: float
    event: str


@dataclass
class SkillUsage:
    """Usage statistics for a skill."""
    total_invocations: int
    success_rate: float
    contexts: list[str]
    last_used: str


@dataclass
class SkillSynergy:
    """Synergy between skills."""
    skill_id: str
    synergy_strength: float


@dataclass
class Skill:
    """Enhanced skill with learning tracking."""
    skill_id: str
    name: str
    category: str
    proficiency: float  # 0.0 - 1.0
    acquired: str
    source_instances: list[str]
    learning_curve: list[SkillLearningEvent]
    usage: SkillUsage
    prerequisites: list[str]
    enables: list[str]
    synergies: list[SkillSynergy]


@dataclass
class InstanceHealth:
    """Health status for an instance."""
    status: HealthStatus
    last_heartbeat: str
    error_rate: float
    sync_lag: int  # milliseconds


@dataclass
class InstanceStatistics:
    """Statistics for an instance."""
    total_syncs: int
    memories_contributed: int
    skills_learned: int
    knowledge_acquired: int
    conversations_handled: int


@dataclass
class ExperienceTransportConfig:
    """Transport configuration for experience sync."""
    type: ExperienceTransportType
    https: dict[str, Any] | None = None
    websocket: dict[str, Any] | None = None
    mcp: dict[str, Any] | None = None


@dataclass
class InstanceMetadata:
    """Metadata for an agent instance."""
    instance_id: str
    type: AgentImplementationType
    framework: str
    deployment_context: str
    created: str
    last_sync: str
    status: InstanceStatus
    sync_protocol: SyncProtocol
    endpoint: str
    health: InstanceHealth
    statistics: InstanceStatistics
    transport: ExperienceTransportConfig | None = None


@dataclass
class MergeStrategy:
    """Merge strategy for experience sync."""
    conflict_resolution: ConflictResolution = "latest_wins"
    memory_deduplication: bool = True
    skill_aggregation: SkillAggregation = "max"
    knowledge_verification_threshold: float = 0.7


@dataclass
class StreamingConfig:
    """Streaming sync configuration."""
    enabled: bool
    interval_ms: int
    batch_size: int
    priority_threshold: float


@dataclass
class LumpedConfig:
    """Lumped sync configuration."""
    enabled: bool
    batch_interval: str  # e.g., "1h", "6h", "24h"
    max_batch_size: int
    compression: bool


@dataclass
class CheckInConfig:
    """Check-in sync configuration."""
    enabled: bool
    schedule: str  # cron expression
    include_full_state: bool


@dataclass
class ExperienceSyncConfig:
    """Experience sync configuration."""
    enabled: bool = False
    default_protocol: SyncProtocol = "streaming"
    transport: ExperienceTransportConfig | None = None
    streaming: StreamingConfig | None = None
    lumped: LumpedConfig | None = None
    check_in: CheckInConfig | None = None
    merge_strategy: MergeStrategy = field(default_factory=MergeStrategy)


@dataclass
class MCPServer:
    """MCP server configuration."""
    name: str
    command: str
    args: list[str]
    env: dict[str, str]


@dataclass
class AgentCardSkill:
    """Skill entry in agent card."""
    name: str
    description: str


@dataclass
class AgentCard:
    """Agent card for A2A protocol."""
    name: str
    version: str
    protocol_version: str
    capabilities: list[str]
    skills: list[AgentCardSkill]
    endpoint: str


@dataclass
class AuthConfig:
    """Authentication configuration."""
    type: AuthType
    config: dict[str, Any]


@dataclass
class MCPProtocol:
    """MCP protocol configuration."""
    enabled: bool
    role: ProtocolRole
    servers: list[MCPServer]
    tools: list[str]


@dataclass
class A2AProtocol:
    """A2A protocol configuration."""
    enabled: bool
    role: ProtocolRole
    endpoint: str
    agent_card: AgentCard
    authentication: AuthConfig
    peers: list[str]


@dataclass
class AgentProtocol:
    """Agent Protocol configuration."""
    enabled: bool
    endpoint: str
    capabilities: list[str]
    task_types: list[str]


@dataclass
class Protocols:
    """Protocol configurations."""
    mcp: MCPProtocol | None = None
    a2a: A2AProtocol | None = None
    agent_protocol: AgentProtocol | None = None


@dataclass
class RetryPolicy:
    """Retry policy configuration."""
    max_attempts: int
    backoff: str
    initial_delay: int


@dataclass
class LLMConfig:
    """LLM configuration."""
    provider: str = "anthropic"
    model: str = "claude-3-5-sonnet-20241022"
    temperature: float = 0.7
    max_tokens: int = 4096
    parameters: dict[str, Any] | None = None


@dataclass
class RuntimeConfig:
    """Runtime configuration."""
    timeout: int = 300
    max_iterations: int = 20
    retry_policy: RetryPolicy | None = None
    error_handling: str = "graceful_degradation"


@dataclass
class ExecutionConfig:
    """Execution configuration."""
    llm: LLMConfig = field(default_factory=LLMConfig)
    runtime: RuntimeConfig = field(default_factory=RuntimeConfig)


@dataclass
class EvolutionMetadata:
    """Evolution tracking metadata."""
    total_deployments: int
    total_syncs: int
    total_skills_learned: int
    total_knowledge_acquired: int
    total_conversations: int
    last_evolution: str
    evolution_rate: float


@dataclass
class EmotionalRange:
    """Emotional range configuration."""
    triggers: list[str]
    expressions: list[str]
    voice: dict[str, float] | None = None


@dataclass
class VoiceConfig:
    """Voice configuration."""
    model: str | None = None
    speaker: str | None = None
    characteristics: list[str] | None = None
    speed: float | None = None
    pitch: float | None = None


@dataclass
class ShortTermMemory:
    """Short-term memory configuration."""
    retention: str
    max_size: int


@dataclass
class LongTermMemory:
    """Long-term memory configuration."""
    storage: Literal["vector", "graph"]
    embedding_model: str


@dataclass
class AccumulatedKnowledge:
    """Knowledge accumulated from instances."""
    knowledge_id: str
    content: str
    confidence: float
    source_instance: str
    acquired: str
    verification_count: int


@dataclass
class AccumulatedExample:
    """Example accumulated from execution."""
    example_id: str
    input: str
    output: str
    context: dict[str, Any]
    source_instance: str
    timestamp: str
    effectiveness_rating: float


# Type definitions for the full agent structure
class IdentityDict(TypedDict, total=False):
    id: str
    name: str
    designation: str
    bio: str | list[str]
    fingerprint: str
    created: str
    version: str


class PersonalityDict(TypedDict, total=False):
    core_traits: list[str]
    values: list[str]
    quirks: list[str]
    fears: list[str]
    aspirations: list[str]
    emotional_ranges: dict[str, dict[str, Any]]


class CommunicationDict(TypedDict, total=False):
    style: dict[str, list[str]]
    signature_phrases: list[str]
    voice: dict[str, Any]


class CapabilitiesDict(TypedDict, total=False):
    primary: list[str]
    secondary: list[str]
    domains: list[str]
    tools: list[dict[str, Any]]
    learned_skills: list[dict[str, Any]]


class KnowledgeDict(TypedDict, total=False):
    facts: list[str]
    topics: list[str]
    expertise: list[str]
    sources: list[Any]
    lore: list[str]
    accumulated_knowledge: list[dict[str, Any]]


class MemoryCollectionsDict(TypedDict, total=False):
    short_term: dict[str, Any]
    long_term: dict[str, Any]
    episodic: list[dict[str, Any]]
    semantic: list[dict[str, Any]]


class MemoryDict(TypedDict, total=False):
    type: MemoryType
    provider: str
    settings: dict[str, Any]
    collections: MemoryCollectionsDict


class BeliefsDict(TypedDict, total=False):
    who: list[dict[str, Any]]
    what: list[dict[str, Any]]
    why: list[dict[str, Any]]
    how: list[dict[str, Any]]
    where: list[dict[str, Any]]
    when: list[dict[str, Any]]
    huh: list[dict[str, Any]]


class InstancesDict(TypedDict, total=False):
    active: list[dict[str, Any]]
    terminated: list[dict[str, Any]]


class DeploymentDict(TypedDict, total=False):
    preferred_contexts: list[str]
    scaling: Any
    environment: dict[str, Any]


class MetadataDict(TypedDict, total=False):
    version: str
    schema_version: str
    created: str
    updated: str
    author: str
    tags: list[str]
    source_framework: str
    evolution: dict[str, Any]


class TrainingDict(TypedDict, total=False):
    conversations: list[Any]
    demonstrations: list[Any]
    feedback: list[Any]
    accumulated_examples: list[dict[str, Any]]


class SemanticAgentDict(TypedDict, total=False):
    """Full agent configuration dictionary."""
    schema_version: str
    identity: IdentityDict
    personality: PersonalityDict
    communication: CommunicationDict
    capabilities: CapabilitiesDict
    knowledge: KnowledgeDict
    memory: MemoryDict
    beliefs: BeliefsDict
    instances: InstancesDict
    experience_sync: dict[str, Any]
    protocols: dict[str, Any]
    execution: dict[str, Any]
    deployment: DeploymentDict
    metadata: MetadataDict
    training: TrainingDict


@dataclass
class ValidationResult:
    """Validation result."""
    valid: bool
    errors: list[str]
    warnings: list[str]


def validate_agent(agent: dict[str, Any]) -> ValidationResult:
    """Validate a SemanticAgent dictionary."""
    errors: list[str] = []
    warnings: list[str] = []

    # Required fields
    if not agent.get("schema_version"):
        errors.append("Missing schema_version")
    elif agent.get("schema_version") != SCHEMA_VERSION:
        warnings.append(
            f"Schema version {agent.get('schema_version')} != {SCHEMA_VERSION}"
        )

    if not agent.get("identity"):
        errors.append("Missing identity")
    if not agent.get("instances"):
        errors.append("Missing instances")
    if not agent.get("experience_sync"):
        errors.append("Missing experience_sync")
    if not agent.get("protocols"):
        errors.append("Missing protocols")

    # Validate instances
    instances = agent.get("instances", {})
    if instances and "active" not in instances:
        errors.append("instances.active is required")

    # Validate protocols - at least one must be enabled
    protocols = agent.get("protocols", {})
    if protocols:
        has_protocol = (
            protocols.get("mcp", {}).get("enabled")
            or protocols.get("a2a", {}).get("enabled")
            or protocols.get("agent_protocol", {}).get("enabled")
        )
        if not has_protocol:
            warnings.append("No protocols enabled - agent may not be functional")

    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )
