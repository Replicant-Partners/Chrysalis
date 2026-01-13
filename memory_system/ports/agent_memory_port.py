"""Protocol definitions for builder-to-memory integration."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Protocol, Sequence


@dataclass
class KnowledgeArtifact:
    """Normalized knowledge output from KnowledgeBuilder."""

    agent_id: str
    entity_id: str
    entity_type: str
    name: str
    text: str
    attributes: Dict[str, object] = field(default_factory=dict)
    embedding: Sequence[float] = field(default_factory=list)
    completeness_score: float = 0.0
    quality_score: float = 0.0
    trust_score: float = 0.0
    source_metadata: Dict[str, object] = field(default_factory=dict)


@dataclass
class KnowledgeArtifactBatch:
    agent_id: str
    artifacts: List[KnowledgeArtifact]
    run_id: Optional[str] = None
    builder_version: Optional[str] = None


@dataclass
class SkillArtifact:
    """SkillBuilder output normalized for persistence."""

    agent_id: str
    skill_id: str
    occupation: str
    yaml_block: str
    embedding: Sequence[float]
    semantic_map: Optional[Dict[str, object]] = None
    evidence: Dict[str, object] = field(default_factory=dict)
    metrics: Dict[str, float] = field(default_factory=dict)
    source_metadata: Dict[str, object] = field(default_factory=dict)


@dataclass
class SkillArtifactBatch:
    agent_id: str
    skills: List[SkillArtifact]
    run_id: Optional[str] = None
    builder_version: Optional[str] = None


@dataclass
class ArtifactQuery:
    agent_id: str
    types: Optional[List[str]] = None
    source_builders: Optional[List[str]] = None
    limit: int = 50


@dataclass
class PromptMetadataInput:
    agent_id: str
    session_id: str
    prompt_hash: str
    model: str
    provider: str
    tokens_in: int
    tokens_out: int
    retrieval_sources: List[Dict[str, object]] = field(default_factory=list)
    error: Optional[str] = None
    score: Optional[float] = None


class AgentMemoryPort(Protocol):
    """Port abstraction used by builders to persist artifacts into memory."""

    async def store_knowledge(self, batch: KnowledgeArtifactBatch) -> None:
        ...

    async def store_skills(self, batch: SkillArtifactBatch) -> None:
        ...

    async def fetch_artifacts(self, query: ArtifactQuery) -> List[Dict[str, object]]:
        ...

    async def record_metadata(self, metadata: PromptMetadataInput) -> None:
        ...

    async def close(self) -> None:
        ...
