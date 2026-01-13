"""Fireproof-backed implementation of AgentMemoryPort."""

from __future__ import annotations

import json
from typing import Dict, List, Optional

from memory_system.agent_adapter import AgentMemoryConfig, AgentMemoryFactory, AgentMemoryServices
from memory_system.fireproof import FireproofService, FireproofConfig
from memory_system.fireproof.schemas import DurableBead, LocalMemory, PromptMetadata, EmbeddingRef

from .agent_memory_port import (
    AgentMemoryPort,
    KnowledgeArtifactBatch,
    SkillArtifactBatch,
    ArtifactQuery,
    PromptMetadataInput,
)


class FireproofMemoryAdapter(AgentMemoryPort):
    """Adapter that persists builder artifacts into Fireproof."""

    def __init__(
        self,
        agent_id: str,
        config: Optional[AgentMemoryConfig] = None,
        fireproof_config: Optional[FireproofConfig] = None,
        factory: Optional[AgentMemoryFactory] = None,
    ) -> None:
        self._agent_id = agent_id
        self._factory = factory or AgentMemoryFactory()
        self._config = config or AgentMemoryConfig(
            agent_id=agent_id,
            agent_name=agent_id,
            fireproof_enabled=True,
        )
        if fireproof_config:
            self._config.fireproof_config = fireproof_config
            self._config.fireproof_enabled = True
        self._services: Optional[AgentMemoryServices] = None

    async def _ensure_services(self) -> AgentMemoryServices:
        if self._services:
            return self._services
        self._services = await self._factory.create_from_config(self._config)
        return self._services

    async def _fireproof(self) -> FireproofService:
        services = await self._ensure_services()
        if not services.fireproof:
            raise RuntimeError("Fireproof is not enabled for this adapter")
        return services.fireproof

    async def store_knowledge(self, batch: KnowledgeArtifactBatch) -> None:
        if not batch.artifacts:
            return
        fp = await self._fireproof()
        for artifact in batch.artifacts:
            doc = LocalMemory(
                content=artifact.text,
                memory_type="semantic",
                confidence=artifact.trust_score,
                tags=[artifact.entity_type, artifact.agent_id],
                source_instance=batch.run_id or "knowledge_builder",
                metadata={
                    "agent_id": artifact.agent_id,
                    "entity_id": artifact.entity_id,
                    "attributes": artifact.attributes,
                    "quality_score": artifact.quality_score,
                    "completeness": artifact.completeness_score,
                    "builder_version": batch.builder_version,
                },
            )
            if artifact.embedding:
                ref = EmbeddingRef.create(
                    text=artifact.text,
                    model=artifact.source_metadata.get("embedding_model", "unknown"),
                    dimensions=len(artifact.embedding),
                    vector=list(artifact.embedding),
                )
                doc.embedding_ref = await fp.put_embedding_ref(ref)
            await fp.put(doc.to_dict())

    async def store_skills(self, batch: SkillArtifactBatch) -> None:
        if not batch.skills:
            return
        fp = await self._fireproof()
        for skill in batch.skills:
            doc = DurableBead(
                content=skill.yaml_block,
                role="assistant",
                importance=skill.metrics.get("importance", 0.8),
                metadata={
                    "agent_id": skill.agent_id,
                    "skill_id": skill.skill_id,
                    "occupation": skill.occupation,
                    "semantic_map": skill.semantic_map,
                    "evidence": skill.evidence,
                    "builder_version": batch.builder_version,
                },
            )
            if skill.embedding:
                ref = EmbeddingRef.create(
                    text=skill.yaml_block,
                    model=skill.source_metadata.get("embedding_model", "unknown"),
                    dimensions=len(skill.embedding),
                    vector=list(skill.embedding),
                )
                doc.metadata["embedding_ref"] = await fp.put_embedding_ref(ref)
            await fp.put(doc.to_dict())

    async def fetch_artifacts(self, query: ArtifactQuery) -> List[Dict[str, object]]:
        fp = await self._fireproof()
        doc_type = None
        if query.types:
            # Simplistic mapping
            if "skill" in query.types and "knowledge" not in query.types:
                doc_type = "bead"
            elif "knowledge" in query.types and "skill" not in query.types:
                doc_type = "memory"
        index = "type" if doc_type else "agent_id"
        options: Dict[str, object] = {"limit": query.limit, "descending": True}
        if doc_type:
            options["key"] = doc_type
            options["filter"] = {"metadata.agent_id": query.agent_id}
        else:
            options["key"] = query.agent_id
        docs = await fp.query(index, options)
        return docs

    async def record_metadata(self, metadata: PromptMetadataInput) -> None:
        fp = await self._fireproof()
        doc = PromptMetadata(
            session_id=metadata.session_id,
            prompt_hash=metadata.prompt_hash,
            model=metadata.model,
            provider=metadata.provider,
            tokens_in=metadata.tokens_in,
            tokens_out=metadata.tokens_out,
            retrieval_sources=metadata.retrieval_sources,
            score=metadata.score,
            error=metadata.error,
        )
        await fp.put(doc.to_dict())

    async def close(self) -> None:
        if self._services:
            await self._services.close()
            self._services = None
