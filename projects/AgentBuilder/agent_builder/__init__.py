"""
AgentBuilder - Fluent builder for UniformSemanticAgentV2 configurations.

This module provides a Python fluent API for constructing agent configurations
with validation and type safety.

Example:
    from agent_builder import AgentBuilder, quick_agent

    # Using the fluent builder
    agent = (
        AgentBuilder()
        .with_identity(name="Ada", designation="Research Assistant")
        .add_traits("analytical", "curious", "thorough")
        .add_capabilities(["code review", "documentation"])
        .with_llm("anthropic", "claude-3-5-sonnet-20241022")
        .enable_mcp(servers=[...])
        .build()
    )

    # Or using quick_agent for simple cases
    agent = quick_agent("Ada", traits=["helpful"], capabilities=["research"])
"""

from .builder import (
    AgentBuilder,
    BuilderState,
    create_agent_builder,
    quick_agent,
)
from .errors import AgentBuilderError
from .types import (
    # Constants
    SCHEMA_VERSION,
    # Type aliases
    AgentImplementationType,
    AuthType,
    BeliefPrivacy,
    ConflictResolution,
    ExperienceTransportType,
    HealthStatus,
    InstanceStatus,
    InteractionType,
    MemoryType,
    ProtocolRole,
    SkillAggregation,
    SyncProtocol,
    ToolProtocol,
    # Dataclasses
    AccumulatedExample,
    AccumulatedKnowledge,
    AgentCard,
    AgentCardSkill,
    AgentProtocol,
    A2AProtocol,
    AuthConfig,
    Belief,
    BeliefRevision,
    CheckInConfig,
    Concept,
    EmotionalRange,
    Episode,
    EvolutionMetadata,
    ExecutionConfig,
    ExperienceSyncConfig,
    ExperienceTransportConfig,
    InstanceHealth,
    InstanceMetadata,
    InstanceStatistics,
    Interaction,
    LLMConfig,
    LongTermMemory,
    LumpedConfig,
    MCPProtocol,
    MCPServer,
    MergeStrategy,
    Protocols,
    RetryPolicy,
    RuntimeConfig,
    ShortTermMemory,
    Skill,
    SkillLearningEvent,
    SkillSynergy,
    SkillUsage,
    StreamingConfig,
    ToolDefinition,
    ToolUsageStats,
    ValidationResult,
    VoiceConfig,
    # TypedDicts
    BeliefsDict,
    CapabilitiesDict,
    CommunicationDict,
    DeploymentDict,
    IdentityDict,
    InstancesDict,
    KnowledgeDict,
    MemoryCollectionsDict,
    MemoryDict,
    MetadataDict,
    PersonalityDict,
    TrainingDict,
    UniformSemanticAgentV2Dict,
    # Functions
    validate_agent,
)

__all__ = [
    # Main builder
    "AgentBuilder",
    "BuilderState",
    "create_agent_builder",
    "quick_agent",
    # Errors
    "AgentBuilderError",
    # Constants
    "SCHEMA_VERSION",
    # Type aliases
    "AgentImplementationType",
    "AuthType",
    "BeliefPrivacy",
    "ConflictResolution",
    "ExperienceTransportType",
    "HealthStatus",
    "InstanceStatus",
    "InteractionType",
    "MemoryType",
    "ProtocolRole",
    "SkillAggregation",
    "SyncProtocol",
    "ToolProtocol",
    # Dataclasses
    "AccumulatedExample",
    "AccumulatedKnowledge",
    "AgentCard",
    "AgentCardSkill",
    "AgentProtocol",
    "A2AProtocol",
    "AuthConfig",
    "Belief",
    "BeliefRevision",
    "CheckInConfig",
    "Concept",
    "EmotionalRange",
    "Episode",
    "EvolutionMetadata",
    "ExecutionConfig",
    "ExperienceSyncConfig",
    "ExperienceTransportConfig",
    "InstanceHealth",
    "InstanceMetadata",
    "InstanceStatistics",
    "Interaction",
    "LLMConfig",
    "LongTermMemory",
    "LumpedConfig",
    "MCPProtocol",
    "MCPServer",
    "MergeStrategy",
    "Protocols",
    "RetryPolicy",
    "RuntimeConfig",
    "ShortTermMemory",
    "Skill",
    "SkillLearningEvent",
    "SkillSynergy",
    "SkillUsage",
    "StreamingConfig",
    "ToolDefinition",
    "ToolUsageStats",
    "ValidationResult",
    "VoiceConfig",
    # TypedDicts
    "BeliefsDict",
    "CapabilitiesDict",
    "CommunicationDict",
    "DeploymentDict",
    "IdentityDict",
    "InstancesDict",
    "KnowledgeDict",
    "MemoryCollectionsDict",
    "MemoryDict",
    "MetadataDict",
    "PersonalityDict",
    "TrainingDict",
    "UniformSemanticAgentV2Dict",
    # Functions
    "validate_agent",
]
