"""
Rust Memory Integration for System Agents

Bridges the Python memory_hooks.py with the high-performance Rust CRDT core.
Provides system agents with autonomous memory management capabilities.

Architecture:
    SystemAgent → rust_memory_integration → chrysalis_memory (Rust) → SQLite
    
This module replaces the pure-Python memory hooks with Rust-backed storage
while maintaining backward compatibility with existing agent configurations.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional, List, Dict

logger = logging.getLogger(__name__)

# Import Rust core with fallback
try:
    from memory_system import (
        GSet,
        ORSet,
        LWWRegister,
        MemoryDocument,
        MemoryStorage,
        AgentMemory,
        AgentMemoryConfig,
        RUST_AVAILABLE,
        _BACKEND,
    )
    
    RUST_MEMORY_AVAILABLE = RUST_AVAILABLE
except ImportError:
    RUST_MEMORY_AVAILABLE = False
    _BACKEND = "fallback"
    logger.warning("Rust memory system not available, using fallback")

# Import existing hooks for fallback
from memory_hooks import (
    MemoryScope,
    MemoryConfig,
    MemoryEntry,
    PersonaMemoryManager,
    BeadsServiceHook,
    FireproofServiceHook,
    ZepHook,
)


@dataclass
class RustMemoryConfig:
    """Configuration for Rust-backed agent memory."""
    
    agent_id: str
    agent_name: str
    db_path: Optional[str] = None
    
    # CRDT settings
    crdt_merge_enabled: bool = True
    
    # Sync settings
    sync_enabled: bool = True
    sync_gateway: str = "ws://localhost:4444"
    sync_interval_s: int = 60
    
    # Memory tiers
    episodic_ttl_hours: int = 24
    semantic_ttl_days: int = 90
    procedural_ttl_days: int = 180
    
    # Promotion
    promotion_enabled: bool = True
    promotion_threshold: float = 0.7
    
    @classmethod
    def from_persona_config(cls, config_path: Path) -> "RustMemoryConfig":
        """Load from existing persona config JSON."""
        with open(config_path) as f:
            config = json.load(f)
        
        memory_cfg = config.get("memoryConfig", {})
        integration = memory_cfg.get("integration", {})
        fireproof = integration.get("fireproofService", {})
        beads = integration.get("beadsService", {})
        zep = integration.get("zepHooks", {})
        
        return cls(
            agent_id=config["id"],
            agent_name=config.get("name", config["id"]),
            db_path=os.getenv("FIREPROOF_DB_PATH") or f"./data/{config['id']}_memory.db",
            crdt_merge_enabled=fireproof.get("promotionEnabled", True),
            sync_enabled=zep.get("enabled", True),
            sync_gateway=os.getenv("FIREPROOF_SYNC_GATEWAY", "ws://localhost:4444"),
            sync_interval_s=zep.get("syncInterval", 60),
            promotion_enabled=beads.get("promotionEnabled", True),
            promotion_threshold=memory_cfg.get("scopes", {}).get("episodic", {}).get("promotionThreshold", 0.7),
        )


class RustBackedMemoryManager:
    """
    High-performance memory manager backed by Rust CRDT core.
    
    Features:
    - Lock-free concurrent writes (CRDT semantics)
    - Automatic merge on conflict
    - Local-first with optional sync
    - SQLite persistence with WAL mode
    
    Example:
        >>> config = RustMemoryConfig.from_persona_config(Path("ada_config.json"))
        >>> manager = RustBackedMemoryManager(config)
        >>> await manager.initialize()
        >>>
        >>> # Store a memory (CRDT merge automatic)
        >>> mem_id = await manager.store_memory(
        ...     content="Ada discovered a structural pattern",
        ...     memory_type="episodic",
        ...     importance=0.8,
        ...     tags=["pattern", "structural"]
        ... )
        >>>
        >>> # Recall relevant memories
        >>> memories = await manager.recall("structural patterns", k=5)
    """
    
    def __init__(self, config: RustMemoryConfig):
        self.config = config
        self._initialized = False
        
        if RUST_MEMORY_AVAILABLE:
            # Use Rust core
            self._storage: Optional[MemoryStorage] = None
            self._agent_memory: Optional[AgentMemory] = None
            self._backend = "rust"
        else:
            # Fallback to pure Python
            self._fallback_manager: Optional[PersonaMemoryManager] = None
            self._backend = "python"
        
        logger.info(f"RustBackedMemoryManager created for {config.agent_id} (backend={self._backend})")
    
    async def initialize(self) -> None:
        """Initialize the memory backend."""
        if self._initialized:
            return
        
        if self._backend == "rust":
            # Ensure data directory exists
            db_path = Path(self.config.db_path)
            db_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Initialize Rust storage
            self._storage = MemoryStorage(
                str(db_path),
                self.config.agent_id
            )
            
            # Initialize high-level AgentMemory if available
            try:
                agent_config = AgentMemoryConfig(
                    agent_id=self.config.agent_id,
                    agent_name=self.config.agent_name,
                    db_path=str(db_path),
                    sync_enabled=self.config.sync_enabled,
                    sync_gateway=self.config.sync_gateway,
                    sync_interval_s=self.config.sync_interval_s,
                    promotion_enabled=self.config.promotion_enabled,
                    promotion_threshold=self.config.promotion_threshold,
                )
                self._agent_memory = AgentMemory(self.config.agent_id, agent_config)
                await self._agent_memory.start()
            except Exception as e:
                logger.warning(f"AgentMemory high-level API unavailable: {e}, using raw storage")
                self._agent_memory = None
        else:
            # Python fallback
            py_config = MemoryConfig(
                persona_id=self.config.agent_id,
                namespace=self.config.agent_id,
                db_name=f"chrysalis_{self.config.agent_id}",
                promotion_enabled=self.config.promotion_enabled,
            )
            self._fallback_manager = PersonaMemoryManager(py_config)
        
        self._initialized = True
        logger.info(f"Memory initialized for {self.config.agent_id}")
    
    async def shutdown(self) -> None:
        """Shutdown the memory backend gracefully."""
        if not self._initialized:
            return
        
        if self._backend == "rust" and self._agent_memory:
            await self._agent_memory.stop()
        
        self._initialized = False
        logger.info(f"Memory shutdown for {self.config.agent_id}")
    
    async def __aenter__(self) -> "RustBackedMemoryManager":
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.shutdown()
    
    # --- Core Memory Operations ---
    
    async def store_memory(
        self,
        content: str,
        memory_type: str = "episodic",
        importance: float = 0.5,
        confidence: float = 0.8,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Store a memory with CRDT merge semantics.
        
        If a memory with the same ID exists, they will be merged:
        - Tags: G-Set (accumulate all tags)
        - Importance/Confidence: Max wins
        - Content: Latest timestamp wins
        
        Args:
            content: The memory content
            memory_type: episodic, semantic, or procedural
            importance: 0.0-1.0 importance score
            confidence: 0.0-1.0 confidence score
            tags: Optional classification tags
            metadata: Optional additional metadata
            
        Returns:
            Memory ID
        """
        if not self._initialized:
            await self.initialize()
        
        if self._backend == "rust":
            if self._agent_memory:
                return await self._agent_memory.learn(
                    content=content,
                    importance=importance,
                    confidence=confidence,
                    memory_type=memory_type,
                    tags=tags,
                )
            else:
                # Direct storage API
                mem = MemoryDocument(
                    content=content,
                    memory_type=memory_type,
                    source_instance=self.config.agent_id,
                )
                mem.set_importance(importance, self.config.agent_id)
                mem.set_confidence(confidence, self.config.agent_id)
                
                if tags:
                    for tag in tags:
                        mem.add_tag(tag)
                
                return self._storage.put(mem)
        else:
            # Python fallback
            entry = self._fallback_manager.beads.store_episode(
                content={"text": content, "metadata": metadata or {}},
                metadata={"type": memory_type, "tags": tags or []},
            )
            entry.confidence = confidence
            
            if importance >= self.config.promotion_threshold:
                self._fallback_manager.beads.flag_for_promotion(entry.entry_id, confidence)
            
            return entry.entry_id
    
    async def recall(
        self,
        query: str,
        k: int = 5,
        memory_type: Optional[str] = None,
        min_importance: Optional[float] = None,
        tags: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Recall relevant memories.
        
        Args:
            query: Search query
            k: Number of results
            memory_type: Filter by type
            min_importance: Minimum importance threshold
            tags: Filter by tags
            
        Returns:
            List of memory dictionaries
        """
        if not self._initialized:
            await self.initialize()
        
        if self._backend == "rust":
            if self._agent_memory:
                memories = await self._agent_memory.recall(
                    query=query,
                    k=k,
                    memory_type=memory_type,
                    min_importance=min_importance,
                    tags=tags,
                )
                return [self._memory_to_dict(m) for m in memories]
            else:
                # Direct storage query
                if memory_type:
                    memories = self._storage.query_by_type(memory_type)
                elif min_importance:
                    memories = self._storage.query_by_importance(min_importance)
                elif tags:
                    memories = []
                    for tag in tags:
                        memories.extend(self._storage.query_by_tag(tag))
                else:
                    memories = self._storage.recent(k)
                
                return [self._memory_to_dict(m) for m in memories[:k]]
        else:
            # Python fallback
            context = self._fallback_manager.get_relevant_context(query, limit=k)
            return context
    
    async def get_memory(self, memory_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific memory by ID."""
        if not self._initialized:
            await self.initialize()
        
        if self._backend == "rust":
            if self._agent_memory:
                mem = await self._agent_memory.get(memory_id)
            else:
                mem = self._storage.get(memory_id)
            
            return self._memory_to_dict(mem) if mem else None
        else:
            entry = self._fallback_manager.fireproof.retrieve_document("memories", memory_id)
            return entry
    
    async def update_memory(
        self,
        memory_id: str,
        importance: Optional[float] = None,
        confidence: Optional[float] = None,
        tags_add: Optional[List[str]] = None,
        tags_remove: Optional[List[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Update a memory (CRDT merge semantics).
        
        Note: Due to CRDT semantics, importance and confidence can only increase.
        """
        if not self._initialized:
            await self.initialize()
        
        if self._backend == "rust":
            if self._agent_memory:
                mem = await self._agent_memory.update(
                    memory_id,
                    importance=importance,
                    confidence=confidence,
                    tags_add=tags_add,
                    tags_remove=tags_remove,
                )
                return self._memory_to_dict(mem) if mem else None
            else:
                mem = self._storage.get(memory_id)
                if not mem:
                    return None
                
                if importance is not None:
                    mem.set_importance(importance, self.config.agent_id)
                if confidence is not None:
                    mem.set_confidence(confidence, self.config.agent_id)
                if tags_add:
                    for tag in tags_add:
                        mem.add_tag(tag)
                if tags_remove:
                    for tag in tags_remove:
                        mem.remove_tag(tag)
                
                self._storage.put(mem)
                return self._memory_to_dict(mem)
        else:
            return None  # Fallback doesn't support updates
    
    async def record_access(self, memory_id: str) -> bool:
        """Record that a memory was accessed (for importance tracking)."""
        if not self._initialized:
            await self.initialize()
        
        if self._backend == "rust" and self._agent_memory:
            return await self._agent_memory.record_access(memory_id)
        
        return False
    
    # --- Evaluation-Specific Operations ---
    
    async def store_evaluation(
        self,
        artifact: str,
        scores: Dict[str, float],
        recommendations: List[str],
        session_id: Optional[str] = None,
    ) -> str:
        """Store an evaluation result."""
        content = json.dumps({
            "artifact": artifact[:500],  # Truncate for storage
            "scores": scores,
            "recommendations": recommendations,
            "session_id": session_id,
            "evaluated_at": datetime.utcnow().isoformat(),
        })
        
        # Calculate overall confidence from scores
        avg_score = sum(scores.values()) / len(scores) if scores else 0.5
        confidence = min(1.0, avg_score / 10)  # Normalize 0-10 to 0-1
        
        return await self.store_memory(
            content=content,
            memory_type="episodic",
            importance=0.7,  # Evaluations are moderately important
            confidence=confidence,
            tags=["evaluation", f"session:{session_id}"] if session_id else ["evaluation"],
        )
    
    async def store_pattern(
        self,
        pattern_description: str,
        pattern_type: str,
        examples: List[str],
        confidence: float = 0.8,
    ) -> str:
        """Store a discovered pattern."""
        content = json.dumps({
            "description": pattern_description,
            "type": pattern_type,
            "examples": examples,
            "discovered_at": datetime.utcnow().isoformat(),
        })
        
        return await self.store_memory(
            content=content,
            memory_type="semantic",  # Patterns are semantic knowledge
            importance=0.8,  # Patterns are important
            confidence=confidence,
            tags=["pattern", f"pattern_type:{pattern_type}"],
        )
    
    async def recall_patterns(
        self,
        pattern_type: Optional[str] = None,
        k: int = 10,
    ) -> List[Dict[str, Any]]:
        """Recall discovered patterns."""
        tags = ["pattern"]
        if pattern_type:
            tags.append(f"pattern_type:{pattern_type}")
        
        return await self.recall(
            query="pattern",
            k=k,
            memory_type="semantic",
            tags=tags,
        )
    
    # --- Statistics ---
    
    def get_stats(self) -> Dict[str, Any]:
        """Get memory statistics."""
        if self._backend == "rust" and self._storage:
            return {
                "backend": self._backend,
                "agent_id": self.config.agent_id,
                "total_memories": self._storage.count(),
                "sync_enabled": self.config.sync_enabled,
                "promotion_enabled": self.config.promotion_enabled,
            }
        else:
            return {
                "backend": self._backend,
                "agent_id": self.config.agent_id,
                "total_memories": -1,  # Unknown in fallback
            }
    
    # --- Internal ---
    
    def _memory_to_dict(self, mem: Any) -> Dict[str, Any]:
        """Convert a MemoryDocument to dictionary."""
        if mem is None:
            return {}
        
        if hasattr(mem, 'id'):
            # Rust MemoryDocument
            return {
                "id": mem.id,
                "content": mem.content,
                "memory_type": mem.memory_type,
                "importance": mem.get_importance(),
                "confidence": mem.get_confidence(),
                "tags": mem.get_tags(),
                "source_instance": mem.source_instance,
                "created_at": mem.created_at,
                "updated_at": mem.updated_at,
                "version": mem.version,
            }
        else:
            # Already a dict (fallback)
            return mem


class SystemAgentMemoryBridge:
    """
    Bridge for all system agents to access Rust-backed memory.
    
    This replaces the pure-Python SystemAgentsMemoryBridge with
    high-performance Rust-backed storage.
    """
    
    def __init__(self, config_dir: Optional[Path] = None):
        self.config_dir = config_dir or Path(__file__).parent
        self._managers: Dict[str, RustBackedMemoryManager] = {}
        self._initialized = False
        
        logger.info("SystemAgentMemoryBridge initialized")
    
    async def initialize(self) -> None:
        """Initialize all agent memory managers."""
        if self._initialized:
            return
        
        agent_configs = ["ada", "lea", "phil", "david", "Milton"]
        
        for agent_id in agent_configs:
            config_path = self.config_dir / f"{agent_id}_config.json"
            if config_path.exists():
                try:
                    config = RustMemoryConfig.from_persona_config(config_path)
                    manager = RustBackedMemoryManager(config)
                    await manager.initialize()
                    self._managers[agent_id.lower()] = manager
                    logger.info(f"Initialized memory for agent: {agent_id}")
                except Exception as e:
                    logger.error(f"Failed to initialize memory for {agent_id}: {e}")
        
        self._initialized = True
    
    async def shutdown(self) -> None:
        """Shutdown all managers."""
        for manager in self._managers.values():
            await manager.shutdown()
        self._managers.clear()
        self._initialized = False
    
    def get_manager(self, agent_id: str) -> Optional[RustBackedMemoryManager]:
        """Get the memory manager for an agent."""
        return self._managers.get(agent_id.lower())
    
    async def store_cross_agent_pattern(
        self,
        pattern: Dict[str, Any],
        discoverers: List[str],
    ) -> str:
        """Store a pattern discovered by multiple agents."""
        import hashlib
        pattern_id = f"shared_{hashlib.sha256(json.dumps(pattern, sort_keys=True).encode()).hexdigest()[:8]}"
        
        # Store in each discoverer's memory
        for agent_id in discoverers:
            manager = self.get_manager(agent_id)
            if manager:
                await manager.store_memory(
                    content=json.dumps({
                        "pattern_id": pattern_id,
                        "pattern": pattern,
                        "discoverers": discoverers,
                    }),
                    memory_type="semantic",
                    importance=0.9,
                    confidence=0.85,
                    tags=["shared_pattern", f"pattern:{pattern_id}"],
                )
        
        return pattern_id
    
    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all agents."""
        return {
            agent_id: manager.get_stats()
            for agent_id, manager in self._managers.items()
        }


# Factory function
async def create_rust_memory_bridge(
    config_dir: Optional[Path] = None
) -> SystemAgentMemoryBridge:
    """Create and initialize the Rust-backed memory bridge."""
    bridge = SystemAgentMemoryBridge(config_dir)
    await bridge.initialize()
    return bridge


# Exports
__all__ = [
    "RustMemoryConfig",
    "RustBackedMemoryManager", 
    "SystemAgentMemoryBridge",
    "create_rust_memory_bridge",
    "RUST_MEMORY_AVAILABLE",
]
