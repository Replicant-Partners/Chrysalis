"""
Memory System Integration Hooks for System Agents Layer.

This module provides the bridge between System Agents (Horizontal 2) and
the Memory System (Beads, Fireproof, Zep).

Architecture:
    Persona → memory_hooks → BeadsService → FireproofService → ZepHooks
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

# Type variable for generic operations
T = TypeVar("T")


class MemoryScope(Enum):
    """Memory scope classifications for persona data."""

    EPISODIC = "episodic"  # Short-term, event-based memory
    SEMANTIC = "semantic"  # Long-term, conceptual memory
    PROCEDURAL = "procedural"  # Process/workflow memory


class PromotionTrigger(Enum):
    """Triggers for memory promotion between tiers."""

    FREQUENCY_THRESHOLD = "frequency_threshold"
    CONFIDENCE_THRESHOLD = "confidence_threshold"
    PATTERN_MATCH = "pattern_match"
    MANUAL = "manual"
    CROSS_PERSONA = "cross_persona"


@dataclass
class MemoryConfig:
    """Configuration for persona memory integration."""

    persona_id: str
    namespace: str
    db_name: str
    max_items: int = 200
    ttl_seconds: int = 7200
    promotion_enabled: bool = True
    local_vector_cache: bool = True
    sync_interval: int = 120

    @classmethod
    def from_persona_config(cls, config_path: Path) -> "MemoryConfig":
        """Load memory config from persona configuration file."""
        with open(config_path) as f:
            config = json.load(f)

        memory_cfg = config.get("memoryConfig", {})
        integration = memory_cfg.get("integration", {})

        return cls(
            persona_id=config["id"],
            namespace=memory_cfg.get("namespace", config["id"]),
            db_name=integration.get("fireproofService", {}).get(
                "dbName", f"chrysalis_{config['id']}"
            ),
            max_items=integration.get("beadsService", {}).get("maxItems", 200),
            ttl_seconds=integration.get("beadsService", {}).get("ttlSeconds", 7200),
            promotion_enabled=integration.get("beadsService", {}).get(
                "promotionEnabled", True
            ),
            local_vector_cache=integration.get("fireproofService", {}).get(
                "localVectorCache", True
            ),
            sync_interval=integration.get("zepHooks", {}).get("syncInterval", 120),
        )


@dataclass
class MemoryEntry:
    """A single memory entry for storage."""

    entry_id: str
    persona_id: str
    scope: MemoryScope
    content: dict[str, Any]
    metadata: dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.5
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: datetime | None = None
    promoted: bool = False
    promotion_destination: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            "entry_id": self.entry_id,
            "persona_id": self.persona_id,
            "scope": self.scope.value,
            "content": self.content,
            "metadata": self.metadata,
            "confidence": self.confidence,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "promoted": self.promoted,
            "promotion_destination": self.promotion_destination,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MemoryEntry":
        """Create from dictionary."""
        return cls(
            entry_id=data["entry_id"],
            persona_id=data["persona_id"],
            scope=MemoryScope(data["scope"]),
            content=data["content"],
            metadata=data.get("metadata", {}),
            confidence=data.get("confidence", 0.5),
            created_at=datetime.fromisoformat(data["created_at"]),
            expires_at=(
                datetime.fromisoformat(data["expires_at"])
                if data.get("expires_at")
                else None
            ),
            promoted=data.get("promoted", False),
            promotion_destination=data.get("promotion_destination"),
        )


@dataclass
class PromotionRule:
    """Rule for promoting memory between tiers."""

    rule_id: str
    trigger: PromotionTrigger
    source_scope: MemoryScope
    destination: str
    condition: Callable[[MemoryEntry], bool]
    threshold: float = 0.8
    min_occurrences: int = 1


class BeadsServiceHook:
    """Hook for Beads Service integration (episodic memory)."""

    def __init__(self, config: MemoryConfig):
        self.config = config
        self._cache: dict[str, MemoryEntry] = {}
        self._promotion_queue: list[MemoryEntry] = []
        logger.info(f"BeadsServiceHook initialized for {config.persona_id}")

    def store_episode(
        self, content: dict[str, Any], metadata: dict[str, Any] | None = None
    ) -> MemoryEntry:
        """Store an episodic memory entry."""
        entry_id = self._generate_entry_id(content)

        entry = MemoryEntry(
            entry_id=entry_id,
            persona_id=self.config.persona_id,
            scope=MemoryScope.EPISODIC,
            content=content,
            metadata=metadata or {},
            expires_at=datetime.utcnow() + timedelta(seconds=self.config.ttl_seconds),
        )

        self._cache[entry_id] = entry

        # Check cache size
        if len(self._cache) > self.config.max_items:
            self._evict_oldest()

        logger.debug(f"Stored episode {entry_id} for {self.config.persona_id}")
        return entry

    def retrieve_recent(self, limit: int = 10) -> list[MemoryEntry]:
        """Retrieve recent episodic memories."""
        entries = sorted(
            self._cache.values(), key=lambda e: e.created_at, reverse=True
        )
        return entries[:limit]

    def flag_for_promotion(self, entry_id: str, confidence: float) -> bool:
        """Flag an entry for promotion if it meets threshold."""
        if entry_id not in self._cache:
            return False

        entry = self._cache[entry_id]
        entry.confidence = confidence

        if confidence >= 0.8 and self.config.promotion_enabled:
            self._promotion_queue.append(entry)
            logger.info(f"Entry {entry_id} flagged for promotion (confidence={confidence})")
            return True

        return False

    def get_promotion_queue(self) -> list[MemoryEntry]:
        """Get entries queued for promotion."""
        return self._promotion_queue.copy()

    def clear_promotion_queue(self) -> None:
        """Clear the promotion queue after processing."""
        self._promotion_queue.clear()

    def _generate_entry_id(self, content: dict[str, Any]) -> str:
        """Generate unique entry ID based on content hash."""
        content_str = json.dumps(content, sort_keys=True)
        hash_digest = hashlib.sha256(content_str.encode()).hexdigest()[:12]
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return f"{self.config.persona_id}_{timestamp}_{hash_digest}"

    def _evict_oldest(self) -> None:
        """Evict oldest entries when cache is full."""
        if not self._cache:
            return

        entries = sorted(self._cache.values(), key=lambda e: e.created_at)
        evict_count = len(self._cache) - self.config.max_items + 10  # Buffer

        for entry in entries[:evict_count]:
            del self._cache[entry.entry_id]
            logger.debug(f"Evicted entry {entry.entry_id}")


class FireproofServiceHook:
    """Hook for Fireproof Service integration (persistent storage)."""

    def __init__(self, config: MemoryConfig):
        self.config = config
        self._collections: dict[str, dict[str, Any]] = {}
        self._vector_cache: dict[str, list[float]] = {}
        logger.info(f"FireproofServiceHook initialized for {config.db_name}")

    def store_document(
        self, collection: str, doc_id: str, document: dict[str, Any]
    ) -> bool:
        """Store a document in a collection."""
        if collection not in self._collections:
            self._collections[collection] = {}

        document["_id"] = doc_id
        document["_stored_at"] = datetime.utcnow().isoformat()
        document["_persona"] = self.config.persona_id

        self._collections[collection][doc_id] = document
        logger.debug(f"Stored document {doc_id} in {collection}")
        return True

    def retrieve_document(self, collection: str, doc_id: str) -> dict[str, Any] | None:
        """Retrieve a document by ID."""
        if collection not in self._collections:
            return None
        return self._collections[collection].get(doc_id)

    def query_collection(
        self, collection: str, query: dict[str, Any], limit: int = 10
    ) -> list[dict[str, Any]]:
        """Query documents in a collection."""
        if collection not in self._collections:
            return []

        results = []
        for doc in self._collections[collection].values():
            if self._matches_query(doc, query):
                results.append(doc)
                if len(results) >= limit:
                    break

        return results

    def store_vector(self, entry_id: str, vector: list[float]) -> bool:
        """Store a vector embedding in local cache."""
        if not self.config.local_vector_cache:
            return False

        self._vector_cache[entry_id] = vector
        return True

    def search_vectors(
        self, query_vector: list[float], top_k: int = 5
    ) -> list[tuple[str, float]]:
        """Search for similar vectors (cosine similarity)."""
        if not self._vector_cache:
            return []

        results = []
        for entry_id, vector in self._vector_cache.items():
            similarity = self._cosine_similarity(query_vector, vector)
            results.append((entry_id, similarity))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def promote_to_semantic(
        self, entry: MemoryEntry, destination_collection: str
    ) -> bool:
        """Promote an episodic entry to semantic memory."""
        semantic_doc = {
            "original_entry_id": entry.entry_id,
            "content": entry.content,
            "metadata": entry.metadata,
            "confidence": entry.confidence,
            "promoted_at": datetime.utcnow().isoformat(),
            "source_persona": entry.persona_id,
        }

        return self.store_document(
            destination_collection, f"sem_{entry.entry_id}", semantic_doc
        )

    def _matches_query(self, doc: dict[str, Any], query: dict[str, Any]) -> bool:
        """Check if document matches query criteria."""
        for key, value in query.items():
            if key not in doc:
                return False
            if doc[key] != value:
                return False
        return True

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        if len(a) != len(b):
            return 0.0

        dot_product = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return dot_product / (norm_a * norm_b)


class ZepHook:
    """Hook for Zep integration (conversation memory)."""

    def __init__(self, config: MemoryConfig):
        self.config = config
        self._sessions: dict[str, list[dict[str, Any]]] = {}
        self._last_sync = datetime.utcnow()
        logger.info(f"ZepHook initialized for {config.persona_id}")

    def add_message(
        self, session_id: str, role: str, content: str, metadata: dict[str, Any] | None = None
    ) -> None:
        """Add a message to a session."""
        if session_id not in self._sessions:
            self._sessions[session_id] = []

        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {},
            "persona": self.config.persona_id,
        }

        self._sessions[session_id].append(message)

    def get_session_history(
        self, session_id: str, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """Get message history for a session."""
        if session_id not in self._sessions:
            return []

        messages = self._sessions[session_id]
        if limit:
            return messages[-limit:]
        return messages

    def get_session_summary(self, session_id: str) -> dict[str, Any]:
        """Get summary of a session."""
        messages = self._sessions.get(session_id, [])

        return {
            "session_id": session_id,
            "message_count": len(messages),
            "personas_involved": list(set(m["persona"] for m in messages)),
            "started_at": messages[0]["timestamp"] if messages else None,
            "last_message_at": messages[-1]["timestamp"] if messages else None,
        }

    def should_sync(self) -> bool:
        """Check if sync is needed based on interval."""
        elapsed = (datetime.utcnow() - self._last_sync).total_seconds()
        return elapsed >= self.config.sync_interval

    def mark_synced(self) -> None:
        """Mark the sync timestamp."""
        self._last_sync = datetime.utcnow()


class PersonaMemoryManager:
    """Unified memory manager for a persona."""

    def __init__(self, config: MemoryConfig):
        self.config = config
        self.beads = BeadsServiceHook(config)
        self.fireproof = FireproofServiceHook(config)
        self.zep = ZepHook(config)
        self._promotion_rules: list[PromotionRule] = []

        logger.info(f"PersonaMemoryManager initialized for {config.persona_id}")

    def add_promotion_rule(self, rule: PromotionRule) -> None:
        """Add a promotion rule."""
        self._promotion_rules.append(rule)

    def store_evaluation(
        self, evaluation: dict[str, Any], session_id: str | None = None
    ) -> MemoryEntry:
        """Store an evaluation result."""
        # Store in episodic memory (Beads)
        entry = self.beads.store_episode(
            content=evaluation,
            metadata={
                "type": "evaluation",
                "session_id": session_id,
            },
        )

        # Store in persistent storage (Fireproof)
        self.fireproof.store_document("evaluations", entry.entry_id, evaluation)

        # Add to conversation history (Zep) if session exists
        if session_id:
            self.zep.add_message(
                session_id=session_id,
                role="assistant",
                content=json.dumps(evaluation.get("summary", {})),
                metadata={"evaluation_id": entry.entry_id},
            )

        return entry

    def store_pattern(self, pattern: dict[str, Any]) -> str:
        """Store a discovered pattern."""
        pattern_id = f"pattern_{hashlib.sha256(json.dumps(pattern, sort_keys=True).encode()).hexdigest()[:8]}"

        self.fireproof.store_document("patterns", pattern_id, pattern)

        return pattern_id

    def process_promotions(self) -> list[str]:
        """Process pending promotions."""
        promoted = []
        queue = self.beads.get_promotion_queue()

        for entry in queue:
            for rule in self._promotion_rules:
                if rule.condition(entry) and entry.confidence >= rule.threshold:
                    success = self.fireproof.promote_to_semantic(
                        entry, rule.destination
                    )
                    if success:
                        entry.promoted = True
                        entry.promotion_destination = rule.destination
                        promoted.append(entry.entry_id)
                        logger.info(
                            f"Promoted {entry.entry_id} to {rule.destination}"
                        )
                    break

        self.beads.clear_promotion_queue()
        return promoted

    def get_relevant_context(
        self, query: str, limit: int = 5
    ) -> list[dict[str, Any]]:
        """Get relevant context for a query (simplified - would use embeddings in production)."""
        # Get recent episodic memories
        recent = self.beads.retrieve_recent(limit=limit)

        # Get from semantic memory
        semantic = self.fireproof.query_collection(
            "semantic_memory", {}, limit=limit
        )

        # Combine and return
        context = []
        for entry in recent:
            context.append(
                {
                    "source": "episodic",
                    "content": entry.content,
                    "confidence": entry.confidence,
                }
            )

        for doc in semantic:
            context.append({"source": "semantic", "content": doc})

        return context[:limit]


class SystemAgentsMemoryBridge:
    """Bridge connecting all persona memory managers."""

    def __init__(self, config_dir: Path | None = None):
        self.config_dir = config_dir or Path(__file__).parent
        self._managers: dict[str, PersonaMemoryManager] = {}
        self._shared_patterns: dict[str, dict[str, Any]] = {}

        # Initialize persona managers
        self._init_managers()

        logger.info("SystemAgentsMemoryBridge initialized")

    def _init_managers(self) -> None:
        """Initialize memory managers for all personas."""
        persona_configs = ["ada", "lea", "phil", "david"]

        for persona_id in persona_configs:
            config_path = self.config_dir / f"{persona_id}_config.json"
            if config_path.exists():
                config = MemoryConfig.from_persona_config(config_path)
                self._managers[persona_id] = PersonaMemoryManager(config)

                # Add default promotion rules
                self._add_default_promotion_rules(persona_id)

    def _add_default_promotion_rules(self, persona_id: str) -> None:
        """Add default promotion rules for a persona."""
        manager = self._managers.get(persona_id)
        if not manager:
            return

        # High confidence pattern promotion
        manager.add_promotion_rule(
            PromotionRule(
                rule_id=f"{persona_id}_high_confidence",
                trigger=PromotionTrigger.CONFIDENCE_THRESHOLD,
                source_scope=MemoryScope.EPISODIC,
                destination="long_term_patterns",
                condition=lambda e: e.confidence >= 0.85,
                threshold=0.85,
            )
        )

        # Cross-persona pattern promotion
        manager.add_promotion_rule(
            PromotionRule(
                rule_id=f"{persona_id}_cross_persona",
                trigger=PromotionTrigger.CROSS_PERSONA,
                source_scope=MemoryScope.EPISODIC,
                destination="shared_patterns",
                condition=lambda e: e.metadata.get("cross_persona_validated", False),
                threshold=0.75,
            )
        )

    def get_manager(self, persona_id: str) -> PersonaMemoryManager | None:
        """Get the memory manager for a persona."""
        return self._managers.get(persona_id)

    def store_cross_persona_pattern(
        self, pattern: dict[str, Any], discoverers: list[str]
    ) -> str:
        """Store a pattern discovered by multiple personas."""
        pattern_id = f"shared_{hashlib.sha256(json.dumps(pattern, sort_keys=True).encode()).hexdigest()[:8]}"

        self._shared_patterns[pattern_id] = {
            "pattern": pattern,
            "discoverers": discoverers,
            "discovered_at": datetime.utcnow().isoformat(),
            "frequency": 1,
        }

        # Store in each discoverer's memory
        for persona_id in discoverers:
            manager = self._managers.get(persona_id)
            if manager:
                manager.fireproof.store_document(
                    "shared_patterns", pattern_id, self._shared_patterns[pattern_id]
                )

        logger.info(f"Stored cross-persona pattern {pattern_id} from {discoverers}")
        return pattern_id

    def sync_all(self) -> dict[str, Any]:
        """Sync all persona memories and process promotions."""
        results = {"promotions": {}, "synced": []}

        for persona_id, manager in self._managers.items():
            # Process promotions
            promoted = manager.process_promotions()
            results["promotions"][persona_id] = promoted

            # Mark Zep as synced
            if manager.zep.should_sync():
                manager.zep.mark_synced()
                results["synced"].append(persona_id)

        return results

    def get_evaluation_context(
        self, artifact: str, artifact_type: str
    ) -> dict[str, list[dict[str, Any]]]:
        """Get relevant context from all personas for an evaluation."""
        context = {}

        for persona_id, manager in self._managers.items():
            context[persona_id] = manager.get_relevant_context(
                query=f"{artifact_type}: {artifact[:100]}", limit=3
            )

        return context


# Factory function for easy initialization
def create_memory_bridge(config_dir: Path | None = None) -> SystemAgentsMemoryBridge:
    """Create and initialize the memory bridge."""
    return SystemAgentsMemoryBridge(config_dir)


# Export public interface
__all__ = [
    "MemoryScope",
    "PromotionTrigger",
    "MemoryConfig",
    "MemoryEntry",
    "PromotionRule",
    "BeadsServiceHook",
    "FireproofServiceHook",
    "ZepHook",
    "PersonaMemoryManager",
    "SystemAgentsMemoryBridge",
    "create_memory_bridge",
]
