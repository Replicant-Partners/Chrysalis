"""Factory helpers for creating AgentMemoryPort instances in KnowledgeBuilder."""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from typing import Optional

from memory_system.agent_adapter import AgentMemoryConfig, AgentMemoryFactory
from memory_system.fireproof.config import FireproofConfig
from memory_system.ports import AgentMemoryPort, FireproofMemoryAdapter

logger = logging.getLogger(__name__)


def builder_memory_enabled() -> bool:
    """Check if builder memory integration is enabled via environment flag."""
    return os.getenv("BUILDER_MEMORY_ENABLED", "false").lower() in {"1", "true", "yes", "on"}


def strict_memory_persistence_enabled() -> bool:
    """Check if failures should fail the HTTP request instead of logging warnings."""
    return os.getenv("STRICT_MEMORY_PERSISTENCE", "false").lower() in {"1", "true", "yes", "on"}


def _default_agent_id() -> str:
    return os.getenv("KNOWLEDGEBUILDER_AGENT_ID", "knowledgebuilder-service")


def builder_agent_id() -> str:
    return _default_agent_id()


def _build_agent_config(agent_id: str, agent_name: Optional[str] = None) -> AgentMemoryConfig:
    config = AgentMemoryConfig(
        agent_id=agent_id,
        agent_name=agent_name or agent_id,
        fireproof_enabled=True,
        fireproof_config=FireproofConfig.from_env(),
    )
    return config


def create_memory_port(
    *,
    agent_id: Optional[str] = None,
    agent_name: Optional[str] = None,
    factory: Optional[AgentMemoryFactory] = None,
) -> AgentMemoryPort:
    """Create a Fireproof-backed AgentMemoryPort for the given agent context."""

    config = _build_agent_config(agent_id or _default_agent_id(), agent_name)
    memory_factory = factory or AgentMemoryFactory()
    return FireproofMemoryAdapter(
        agent_id=config.agent_id,
        config=config,
        fireproof_config=config.fireproof_config,
        factory=memory_factory,
    )


async def store_knowledge_async(port: AgentMemoryPort, batch) -> None:
    await port.store_knowledge(batch)


async def record_metadata_async(port: AgentMemoryPort, metadata) -> None:
    await port.record_metadata(metadata)


def run_async_task(coro, *, warn_message: str) -> None:
    try:
        asyncio.run(coro)
    except Exception as exc:  # noqa: BLE001
        if strict_memory_persistence_enabled():
            raise
        logger.warning(warn_message, extra={"error": str(exc)})


def new_run_id() -> str:
    return os.getenv("KNOWLEDGEBUILDER_RUN_ID") or str(uuid.uuid4())


def builder_version() -> Optional[str]:
    try:
        from src import __version__
    except Exception:  # noqa: BLE001
        return None
    return __version__
