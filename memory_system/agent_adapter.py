"""
Agent Memory Adapter

Bridges the Uniform Semantic Agent (USA) specification to the memory system stack.
Provides factory methods to create FusionRetriever instances from AgentSpec
memory configurations, with proper lifecycle management.

Architecture:
    AgentSpec (YAML/JSON) -> AgentMemoryFactory -> FusionRetriever
                               |
                               v
                          AgentMemoryContext (lifecycle)
                               |
                               v
                    BeadsService + FireproofService + ZepHooks
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Dict, Optional, TYPE_CHECKING

from memory_system.beads import BeadsService
from memory_system.fusion import FusionRetriever
from memory_system.fireproof.config import FireproofConfig
from memory_system.hooks import ZepHooks

if TYPE_CHECKING:
    from memory_system.fireproof import FireproofService
    from shared.embedding.service import EmbeddingService
    from usa_implementation.core.types_v2 import (
        AgentSpec,
        MemorySystem,
        FireproofDurableConfig,
        StorageConfig,
    )

logger = logging.getLogger("central_logger")


@dataclass
class AgentMemoryServices:
    """Container for memory services created by the factory."""
    
    beads: BeadsService
    fireproof: Optional[FireproofService] = None
    zep_hooks: Optional[ZepHooks] = None
    embedder: Optional[EmbeddingService] = None
    fusion: Optional[FusionRetriever] = None
    
    async def close(self) -> None:
        """Clean up all services."""
        if self.fireproof:
            try:
                await self.fireproof.close()
            except Exception as exc:
                logger.warning(
                    "agent_adapter.close.fireproof_failed",
                    extra={"error": str(exc)}
                )


@dataclass
class AgentMemoryConfig:
    """
    Parsed memory configuration from AgentSpec.
    
    Normalizes the various configuration formats into a unified structure
    for the memory factory.
    """
    
    # Core settings
    agent_id: str
    agent_name: str
    
    # BeadsService settings
    bead_capacity: int = 50
    
    # Fireproof settings
    fireproof_enabled: bool = False
    fireproof_config: Optional[FireproofConfig] = None
    
    # Zep/embedding settings
    zep_enabled: bool = False
    zep_api_url: Optional[str] = None
    zep_api_key: Optional[str] = None
    embedding_model: Optional[str] = None
    embedding_provider: Optional[str] = None
    
    # Feature flags
    enable_kg: bool = False
    enable_vector_cache: bool = False
    
    @classmethod
    def from_agent_spec(cls, spec: AgentSpec) -> AgentMemoryConfig:
        """
        Create AgentMemoryConfig from an AgentSpec.
        
        Extracts memory configuration from the spec's capabilities.memory
        and storage sections.
        """
        agent_id = f"{spec.metadata.name}-{spec.metadata.version}"
        config = cls(
            agent_id=agent_id,
            agent_name=spec.metadata.name,
        )
        
        memory = spec.capabilities.memory
        if not memory:
            return config
        
        # Parse working memory config
        if memory.working:
            # Map max_tokens to bead capacity (rough heuristic)
            config.bead_capacity = min(memory.working.max_tokens // 100, 100)
        
        # Parse storage config
        if memory.storage:
            config._parse_storage_config(memory.storage)
        
        # Parse embeddings config
        if memory.embeddings:
            config.embedding_model = memory.embeddings.model
            config.embedding_provider = memory.embeddings.provider
        
        # Parse semantic/KG settings
        if memory.semantic and memory.semantic.knowledge_graph:
            config.enable_kg = True
        
        return config
    
    def _parse_storage_config(self, storage: StorageConfig) -> None:
        """Parse storage configuration for Fireproof and Zep settings."""
        # Parse Fireproof config
        if storage.fireproof and storage.fireproof.enabled:
            self.fireproof_enabled = True
            self.fireproof_config = self._convert_fireproof_config(storage.fireproof)
        
        # Check for vector DB (Zep integration)
        if storage.vector_db:
            provider = storage.vector_db.provider.lower()
            if provider == "zep":
                self.zep_enabled = True
                self.zep_api_url = storage.vector_db.config.get("api_url")
                self.zep_api_key = storage.vector_db.config.get("api_key")
    
    def _convert_fireproof_config(
        self, fp_config: FireproofDurableConfig
    ) -> FireproofConfig:
        """Convert USA FireproofDurableConfig to memory system FireproofConfig."""
        return FireproofConfig(
            db_name=fp_config.database_name or f"{self.agent_name}-memory",
            enabled=True,
            sync_enabled=fp_config.sync_enabled,
            sync_interval_s=fp_config.sync_interval_seconds,
            sync_gateway=fp_config.remote_url,
            promotion_enabled=True,
            promotion_threshold=fp_config.promotion_threshold / 10.0,  # Normalize to 0-1
            local_vector_cache=True,
            encryption_enabled=fp_config.encryption_enabled,
            **fp_config.config,
        )


class AgentMemoryFactory:
    """
    Factory for creating memory system instances from agent specifications.
    
    Supports three tiers:
    1. Short-term: BeadsService (always created)
    2. Hybrid/Durable: FireproofService (optional, local-first)
    3. Long-term: ZepHooks (optional, remote vector/KG)
    
    Usage:
        factory = AgentMemoryFactory()
        services = await factory.create_from_spec(agent_spec)
        
        # Use services.fusion for unified retrieval
        result = await services.fusion.retrieve_async("query")
        
        # Cleanup
        await services.close()
    
    Or use the context manager:
        async with factory.create_context(agent_spec) as services:
            result = await services.fusion.retrieve_async("query")
    """
    
    def __init__(
        self,
        default_embedding_service: Optional[EmbeddingService] = None,
        default_zep_hooks: Optional[ZepHooks] = None,
    ) -> None:
        """
        Initialize the factory.
        
        Args:
            default_embedding_service: Default embedder if not specified in config
            default_zep_hooks: Default Zep hooks if not specified in config
        """
        self._default_embedder = default_embedding_service
        self._default_zep = default_zep_hooks
    
    async def create_from_spec(
        self,
        spec: AgentSpec,
        override_config: Optional[AgentMemoryConfig] = None,
    ) -> AgentMemoryServices:
        """
        Create memory services from an AgentSpec.
        
        Args:
            spec: The agent specification
            override_config: Optional config to override spec settings
            
        Returns:
            AgentMemoryServices with initialized components
        """
        config = override_config or AgentMemoryConfig.from_agent_spec(spec)
        return await self.create_from_config(config)
    
    async def create_from_config(
        self,
        config: AgentMemoryConfig,
    ) -> AgentMemoryServices:
        """
        Create memory services from a parsed configuration.
        
        Args:
            config: Parsed AgentMemoryConfig
            
        Returns:
            AgentMemoryServices with initialized components
        """
        logger.info(
            "agent_adapter.create_from_config",
            extra={
                "agent_id": config.agent_id,
                "fireproof_enabled": config.fireproof_enabled,
                "zep_enabled": config.zep_enabled,
            }
        )
        
        # 1. Create BeadsService (always required)
        beads = BeadsService(max_items=config.bead_capacity)
        
        # 2. Create FireproofService (optional)
        fireproof: Optional[FireproofService] = None
        if config.fireproof_enabled and config.fireproof_config:
            fireproof = await self._create_fireproof_service(
                config.fireproof_config, beads
            )
        
        # 3. Get or create embedder
        embedder = self._default_embedder
        if not embedder and config.embedding_model:
            embedder = self._create_embedding_service(config)
        
        # 4. Get or create Zep hooks
        zep_hooks = self._default_zep
        if not zep_hooks and config.zep_enabled:
            zep_hooks = self._create_zep_hooks(config)
        
        # 5. Create FusionRetriever
        fusion = FusionRetriever(
            beads=beads,
            embedder=embedder,
            zep_hooks=zep_hooks,
            fireproof=fireproof,
        )
        
        return AgentMemoryServices(
            beads=beads,
            fireproof=fireproof,
            zep_hooks=zep_hooks,
            embedder=embedder,
            fusion=fusion,
        )
    
    async def _create_fireproof_service(
        self,
        config: FireproofConfig,
        beads: BeadsService,
    ) -> FireproofService:
        """
        Create and initialize FireproofService.
        
        Also sets up the promotion hook on BeadsService.
        """
        from memory_system.fireproof import FireproofService
        from memory_system.fireproof.hooks import create_promotion_hook
        
        # Validate config
        config.validate()
        
        # Create service
        fireproof = FireproofService(config)
        await fireproof.initialize()
        
        # Wire up promotion hook
        if config.promotion_enabled:
            promotion_hook = create_promotion_hook(fireproof, config)
            beads.promotion_hook = promotion_hook
            logger.debug(
                "agent_adapter.fireproof.promotion_hook_attached",
                extra={"threshold": config.promotion_threshold}
            )
        
        return fireproof
    
    def _create_embedding_service(
        self,
        config: AgentMemoryConfig,
    ) -> Optional[EmbeddingService]:
        """
        Create embedding service from config.
        
        Returns None if unable to create (missing dependencies).
        """
        try:
            from shared.embedding.service import EmbeddingService
            
            return EmbeddingService(
                model_name=config.embedding_model,
                provider=config.embedding_provider,
            )
        except Exception as exc:
            logger.warning(
                "agent_adapter.embedding_service_failed",
                extra={"error": str(exc)}
            )
            return None
    
    def _create_zep_hooks(
        self,
        config: AgentMemoryConfig,
    ) -> Optional[ZepHooks]:
        """
        Create Zep hooks from config.
        
        Returns None if unable to create (missing config/dependencies).
        """
        if not config.zep_api_url:
            return None
        
        try:
            return ZepHooks(
                endpoint=config.zep_api_url,
                api_key=config.zep_api_key,
            )
        except Exception as exc:
            logger.warning(
                "agent_adapter.zep_hooks_failed",
                extra={"error": str(exc)}
            )
            return None
    
    @asynccontextmanager
    async def create_context(
        self,
        spec: AgentSpec,
        override_config: Optional[AgentMemoryConfig] = None,
    ) -> AsyncIterator[AgentMemoryServices]:
        """
        Context manager for memory services with automatic cleanup.
        
        Usage:
            async with factory.create_context(spec) as services:
                await services.fusion.retrieve_async("query")
        """
        services = await self.create_from_spec(spec, override_config)
        try:
            yield services
        finally:
            await services.close()


class AgentMemoryContext:
    """
    Lifecycle manager for agent memory services.
    
    Provides explicit lifecycle control for long-running agents
    that need to manage memory resources across multiple interactions.
    
    Usage:
        context = AgentMemoryContext(agent_spec)
        await context.initialize()
        
        # Multiple interactions
        for query in queries:
            result = await context.fusion.retrieve_async(query)
        
        # Cleanup
        await context.shutdown()
    """
    
    def __init__(
        self,
        spec: AgentSpec,
        factory: Optional[AgentMemoryFactory] = None,
        config_override: Optional[AgentMemoryConfig] = None,
    ) -> None:
        """
        Initialize the context.
        
        Args:
            spec: Agent specification
            factory: Optional factory instance (creates default if not provided)
            config_override: Optional configuration override
        """
        self._spec = spec
        self._factory = factory or AgentMemoryFactory()
        self._config_override = config_override
        self._services: Optional[AgentMemoryServices] = None
        self._initialized = False
    
    @property
    def is_initialized(self) -> bool:
        """Check if context has been initialized."""
        return self._initialized
    
    @property
    def services(self) -> AgentMemoryServices:
        """Get the memory services (raises if not initialized)."""
        if not self._services:
            raise RuntimeError("AgentMemoryContext not initialized. Call initialize() first.")
        return self._services
    
    @property
    def fusion(self) -> FusionRetriever:
        """Convenience property for the FusionRetriever."""
        return self.services.fusion
    
    @property
    def beads(self) -> BeadsService:
        """Convenience property for BeadsService."""
        return self.services.beads
    
    @property
    def fireproof(self) -> Optional[FireproofService]:
        """Convenience property for FireproofService."""
        return self.services.fireproof
    
    async def initialize(self) -> AgentMemoryServices:
        """
        Initialize all memory services.
        
        Returns:
            The initialized AgentMemoryServices
            
        Raises:
            RuntimeError: If already initialized
        """
        if self._initialized:
            raise RuntimeError("AgentMemoryContext already initialized")
        
        logger.info(
            "agent_memory_context.initializing",
            extra={"agent": self._spec.metadata.name}
        )
        
        self._services = await self._factory.create_from_spec(
            self._spec, self._config_override
        )
        self._initialized = True
        
        logger.info(
            "agent_memory_context.initialized",
            extra={
                "agent": self._spec.metadata.name,
                "has_fireproof": self._services.fireproof is not None,
                "has_zep": self._services.zep_hooks is not None,
            }
        )
        
        return self._services
    
    async def shutdown(self) -> None:
        """
        Shutdown and cleanup all memory services.
        
        Safe to call multiple times.
        """
        if not self._initialized:
            return
        
        logger.info(
            "agent_memory_context.shutting_down",
            extra={"agent": self._spec.metadata.name}
        )
        
        if self._services:
            await self._services.close()
        
        self._services = None
        self._initialized = False
        
        logger.info("agent_memory_context.shutdown_complete")
    
    async def __aenter__(self) -> AgentMemoryContext:
        """Async context manager entry."""
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.shutdown()


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

async def create_agent_memory(
    spec: AgentSpec,
    embedder: Optional[EmbeddingService] = None,
    zep_hooks: Optional[ZepHooks] = None,
) -> FusionRetriever:
    """
    Convenience function to create a FusionRetriever for an agent.
    
    Args:
        spec: Agent specification
        embedder: Optional embedding service
        zep_hooks: Optional Zep hooks
        
    Returns:
        Configured FusionRetriever
        
    Note:
        Caller is responsible for cleanup. For automatic lifecycle
        management, use AgentMemoryContext instead.
    """
    factory = AgentMemoryFactory(
        default_embedding_service=embedder,
        default_zep_hooks=zep_hooks,
    )
    services = await factory.create_from_spec(spec)
    return services.fusion


async def create_minimal_memory(
    agent_id: str = "default-agent",
    bead_capacity: int = 50,
    enable_fireproof: bool = False,
) -> FusionRetriever:
    """
    Create a minimal FusionRetriever without agent spec.
    
    Useful for testing or simple use cases.
    
    Args:
        agent_id: Agent identifier
        bead_capacity: BeadsService capacity
        enable_fireproof: Whether to enable Fireproof (with test config)
        
    Returns:
        FusionRetriever with BeadsService only (or with Fireproof if enabled)
        
    Note:
        When enable_fireproof=True, this function automatically initializes
        the FireproofService. For cleanup, access the fireproof service
        from the returned retriever: `await retriever.fireproof.close()`
    """
    beads = BeadsService(max_items=bead_capacity)
    
    fireproof = None
    if enable_fireproof:
        from memory_system.fireproof import FireproofService
        from memory_system.fireproof.hooks import create_promotion_hook
        
        config = FireproofConfig.for_testing()
        fireproof = FireproofService(config)
        await fireproof.initialize()  # Must initialize before use
        
        if config.promotion_enabled:
            beads.promotion_hook = create_promotion_hook(fireproof, config)
    
    return FusionRetriever(
        beads=beads,
        fireproof=fireproof,
    )


def create_minimal_memory_sync(
    agent_id: str = "default-agent",
    bead_capacity: int = 50,
) -> FusionRetriever:
    """
    Create a minimal FusionRetriever synchronously (no Fireproof).
    
    This is a synchronous convenience function that creates a BeadsService-only
    FusionRetriever. For Fireproof support, use the async `create_minimal_memory()`.
    
    Args:
        agent_id: Agent identifier
        bead_capacity: BeadsService capacity
        
    Returns:
        FusionRetriever with BeadsService only
    """
    beads = BeadsService(max_items=bead_capacity)
    return FusionRetriever(beads=beads)


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    # Core classes
    "AgentMemoryFactory",
    "AgentMemoryContext",
    "AgentMemoryServices",
    "AgentMemoryConfig",
    
    # Convenience functions
    "create_agent_memory",
    "create_minimal_memory",
    "create_minimal_memory_sync",
]
