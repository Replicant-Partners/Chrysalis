"""Factory helpers for SkillBuilder memory integration."""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from typing import Optional

from memory_system.agent_adapter import AgentMemoryConfig, AgentMemoryFactory
from memory_system.fireproof.config import FireproofConfig
from memory_system.ports import AgentMemoryPort, SkillArtifactBatch, FireproofMemoryAdapter

logger = logging.getLogger(__name__)


def builder_memory_enabled() -> bool:
    return os.getenv("BUILDER_MEMORY_ENABLED", "false").lower() in {"1", "true", "yes", "on"}


def strict_memory_persistence_enabled() -> bool:
    return os.getenv("STRICT_MEMORY_PERSISTENCE", "false").lower() in {"1", "true", "yes", "on"}


def builder_agent_id() -> str:
    return os.getenv("SKILLBUILDER_AGENT_ID", "skillbuilder-service")


def builder_version() -> Optional[str]:
    try:
        from projects.SkillBuilder import __version__  # type: ignore
    except Exception:  # noqa: BLE001
        return None
    return __version__


def new_run_id() -> str:
    return os.getenv("SKILLBUILDER_RUN_ID") or str(uuid.uuid4())


def _build_agent_config(agent_id: str, agent_name: Optional[str] = None) -> AgentMemoryConfig:
    return AgentMemoryConfig(
        agent_id=agent_id,
        agent_name=agent_name or agent_id,
        fireproof_enabled=True,
        fireproof_config=FireproofConfig.from_env(),
    )


def create_memory_port(
    *,
    agent_id: Optional[str] = None,
    agent_name: Optional[str] = None,
    factory: Optional[AgentMemoryFactory] = None,
) -> AgentMemoryPort:
    config = _build_agent_config(agent_id or builder_agent_id(), agent_name)
    memory_factory = factory or AgentMemoryFactory()
    return FireproofMemoryAdapter(
        agent_id=config.agent_id,
        config=config,
        fireproof_config=config.fireproof_config,
        factory=memory_factory,
    )


async def store_skills_async(port: AgentMemoryPort, batch: SkillArtifactBatch) -> None:
    await port.store_skills(batch)


def run_async_task(coro, *, warn_message: str) -> None:
    try:
        asyncio.run(coro)
    except Exception as exc:  # noqa: BLE001
        if strict_memory_persistence_enabled():
            raise
        logger.warning(warn_message, extra={"error": str(exc)})
