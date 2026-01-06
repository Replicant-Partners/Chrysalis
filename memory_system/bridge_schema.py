"""
Memory Bridge Schema - Python Implementation

Defines the canonical contract between TypeScript and Python memory systems.
This schema ensures interoperability and type safety across language boundaries.

Version: 1.0.0
Status: Implemented

Related TypeScript implementation: src/memory/MemoryBridgeSchema.ts
Related Python types: memory_system/chrysalis_types.py
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
import json
import hashlib


# =============================================================================
# SCHEMA VERSION
# =============================================================================

BRIDGE_SCHEMA_VERSION = "1.0.0"


# =============================================================================
# CORE IDENTITY TYPES
# =============================================================================

@dataclass
class BridgeAgentIdentity:
    """
    Agent identity that is consistent across TypeScript and Python.
    Maps to TypeScript: BridgeAgentIdentity in src/memory/MemoryBridgeSchema.ts
    """
    agent_id: str
    name: str
    role: str
    created_at: str  # ISO 8601
    capabilities: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    public_key: Optional[str] = None

    def to_typescript_format(self) -> Dict[str, Any]:
        """Convert to TypeScript-compatible camelCase format"""
        return {
            "agentId": self.agent_id,
            "name": self.name,
            "role": self.role,
            "createdAt": self.created_at,
            "publicKey": self.public_key,
            "capabilities": self.capabilities,
            "metadata": self.metadata,
        }

    @classmethod
    def from_typescript_format(cls, data: Dict[str, Any]) -> BridgeAgentIdentity:
        """Create from TypeScript camelCase format"""
        return cls(
            agent_id=data["agentId"],
            name=data["name"],
            role=data["role"],
            created_at=data["createdAt"],
            public_key=data.get("publicKey"),
            capabilities=data.get("capabilities", []),
            metadata=data.get("metadata", {}),
        )


# =============================================================================
# MEMORY LAYER TYPES
# =============================================================================

class BridgeMemoryLayer(str, Enum):
    """Memory layer enumeration - must match TypeScript BridgeMemoryLayer"""
    EPISODIC = "episodic"
    SEMANTIC = "semantic"
    PROCEDURAL = "procedural"
    WORKING = "working"
    ARCHIVAL = "archival"


@dataclass
class BridgeMemorySource:
    """Memory source tracking"""
    type: str  # 'user_input' | 'llm_response' | 'observation' | 'inference' | 'external'
    confidence: float
    verified: bool
    source_id: Optional[str] = None

    def to_typescript_format(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "sourceId": self.source_id,
            "confidence": self.confidence,
            "verified": self.verified,
        }

    @classmethod
    def from_typescript_format(cls, data: Dict[str, Any]) -> BridgeMemorySource:
        return cls(
            type=data["type"],
            source_id=data.get("sourceId"),
            confidence=data["confidence"],
            verified=data["verified"],
        )


@dataclass
class BridgeMemoryEntry:
    """
    Memory entry that can be serialized/deserialized between systems.
    Maps to TypeScript: BridgeMemoryEntry in src/memory/MemoryBridgeSchema.ts
    """
    id: str
    agent_id: str
    layer: BridgeMemoryLayer
    content: str
    timestamp: str  # ISO 8601
    access_count: int
    importance: float
    decay_rate: float
    activation: float
    associations: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None
    embedding_model: Optional[str] = None
    embedding_dimension: Optional[int] = None
    last_accessed: Optional[str] = None
    source: Optional[BridgeMemorySource] = None
    content_hash: Optional[str] = None
    vector_clock: Optional[Dict[str, int]] = None

    def __post_init__(self):
        # Convert string layer to enum if needed
        if isinstance(self.layer, str):
            self.layer = BridgeMemoryLayer(self.layer)
        
        # Compute content hash if not provided
        if self.content_hash is None:
            self.content_hash = hashlib.sha256(self.content.encode()).hexdigest()

    def to_typescript_format(self) -> Dict[str, Any]:
        """Convert to TypeScript-compatible camelCase format"""
        result = {
            "id": self.id,
            "agentId": self.agent_id,
            "layer": self.layer.value,
            "content": self.content,
            "timestamp": self.timestamp,
            "accessCount": self.access_count,
            "importance": self.importance,
            "decayRate": self.decay_rate,
            "activation": self.activation,
            "associations": self.associations,
            "tags": self.tags,
            "metadata": self.metadata,
        }
        
        if self.embedding is not None:
            result["embedding"] = self.embedding
        if self.embedding_model is not None:
            result["embeddingModel"] = self.embedding_model
        if self.embedding_dimension is not None:
            result["embeddingDimension"] = self.embedding_dimension
        if self.last_accessed is not None:
            result["lastAccessed"] = self.last_accessed
        if self.source is not None:
            result["source"] = self.source.to_typescript_format()
        if self.content_hash is not None:
            result["contentHash"] = self.content_hash
        if self.vector_clock is not None:
            result["vectorClock"] = self.vector_clock
            
        return result

    @classmethod
    def from_typescript_format(cls, data: Dict[str, Any]) -> BridgeMemoryEntry:
        """Create from TypeScript camelCase format"""
        source = None
        if data.get("source"):
            source = BridgeMemorySource.from_typescript_format(data["source"])
            
        return cls(
            id=data["id"],
            agent_id=data["agentId"],
            layer=BridgeMemoryLayer(data["layer"]),
            content=data["content"],
            timestamp=data["timestamp"],
            access_count=data["accessCount"],
            importance=data["importance"],
            decay_rate=data["decayRate"],
            activation=data["activation"],
            associations=data.get("associations", []),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
            embedding=data.get("embedding"),
            embedding_model=data.get("embeddingModel"),
            embedding_dimension=data.get("embeddingDimension"),
            last_accessed=data.get("lastAccessed"),
            source=source,
            content_hash=data.get("contentHash"),
            vector_clock=data.get("vectorClock"),
        )


# =============================================================================
# CRDT OPERATIONS
# =============================================================================

class BridgeCRDTOperation(str, Enum):
    """CRDT operation types for distributed merge"""
    SET = "set"
    DELETE = "delete"
    INCREMENT = "increment"
    MERGE = "merge"


class BridgeConflictStrategy(str, Enum):
    """Conflict resolution strategy"""
    LAST_WRITER_WINS = "lww"
    MERGE = "merge"
    UNION = "union"
    CUSTOM = "custom"
    SEMANTIC = "semantic"


@dataclass
class BridgeCRDTDelta:
    """
    CRDT delta for synchronization between nodes.
    Maps to TypeScript: BridgeCRDTDelta in src/memory/MemoryBridgeSchema.ts
    """
    operation: BridgeCRDTOperation
    key: str
    value: Any
    vector_clock: Dict[str, int]
    timestamp: str  # ISO 8601
    node_id: str

    def to_typescript_format(self) -> Dict[str, Any]:
        return {
            "operation": self.operation.value,
            "key": self.key,
            "value": self.value,
            "vectorClock": self.vector_clock,
            "timestamp": self.timestamp,
            "nodeId": self.node_id,
        }

    @classmethod
    def from_typescript_format(cls, data: Dict[str, Any]) -> BridgeCRDTDelta:
        return cls(
            operation=BridgeCRDTOperation(data["operation"]),
            key=data["key"],
            value=data["value"],
            vector_clock=data["vectorClock"],
            timestamp=data["timestamp"],
            node_id=data["nodeId"],
        )


# =============================================================================
# GOSSIP PROTOCOL
# =============================================================================

@dataclass
class BridgeMemorySyncPayload:
    """Memory synchronization payload"""
    kind: str = "memory_sync"
    memories: List[BridgeMemoryEntry] = field(default_factory=list)
    deltas: List[BridgeCRDTDelta] = field(default_factory=list)


@dataclass
class BridgeAgentAnnouncePayload:
    """Agent announcement payload"""
    kind: str = "agent_announce"
    agent: Optional[BridgeAgentIdentity] = None
    status: str = "online"  # 'online' | 'offline' | 'busy'


@dataclass
class BridgeKnowledgeQueryPayload:
    """Knowledge query payload"""
    kind: str = "knowledge_query"
    query: str = ""
    query_embedding: Optional[List[float]] = None
    filters: Optional[Dict[str, Any]] = None


@dataclass
class BridgeKnowledgeResponsePayload:
    """Knowledge response payload"""
    kind: str = "knowledge_response"
    query_id: str = ""
    results: List[BridgeMemoryEntry] = field(default_factory=list)
    confidence: float = 0.0


@dataclass
class BridgeHeartbeatPayload:
    """Heartbeat payload"""
    kind: str = "heartbeat"
    load: float = 0.0
    memory_count: int = 0


BridgeGossipPayload = Union[
    BridgeMemorySyncPayload,
    BridgeAgentAnnouncePayload,
    BridgeKnowledgeQueryPayload,
    BridgeKnowledgeResponsePayload,
    BridgeHeartbeatPayload,
]


@dataclass
class BridgeGossipMessage:
    """
    Gossip message format for cross-system communication.
    Maps to TypeScript: BridgeGossipMessage in src/memory/MemoryBridgeSchema.ts
    """
    type: str  # 'sync' | 'announce' | 'query' | 'response' | 'heartbeat'
    sender_id: str
    payload: Dict[str, Any]  # Simplified payload for serialization
    vector_clock: Dict[str, int]
    timestamp: str  # ISO 8601
    signature: str
    ttl: int
    target_id: Optional[str] = None

    def to_typescript_format(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "senderId": self.sender_id,
            "targetId": self.target_id,
            "payload": self.payload,
            "vectorClock": self.vector_clock,
            "timestamp": self.timestamp,
            "signature": self.signature,
            "ttl": self.ttl,
        }

    @classmethod
    def from_typescript_format(cls, data: Dict[str, Any]) -> BridgeGossipMessage:
        return cls(
            type=data["type"],
            sender_id=data["senderId"],
            target_id=data.get("targetId"),
            payload=data["payload"],
            vector_clock=data["vectorClock"],
            timestamp=data["timestamp"],
            signature=data["signature"],
            ttl=data["ttl"],
        )


# =============================================================================
# QUERY INTERFACE
# =============================================================================

@dataclass
class BridgeQueryFilters:
    """Unified query filters across systems"""
    layers: Optional[List[BridgeMemoryLayer]] = None
    agent_ids: Optional[List[str]] = None
    min_importance: Optional[float] = None
    max_age: Optional[int] = None
    required_tags: Optional[List[str]] = None
    any_tags: Optional[List[str]] = None
    exclude_tags: Optional[List[str]] = None
    min_activation: Optional[float] = None
    text_query: Optional[str] = None
    embedding: Optional[List[float]] = None
    similarity_threshold: Optional[float] = None
    limit: Optional[int] = None
    offset: Optional[int] = None

    def to_typescript_format(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {}
        if self.layers is not None:
            result["layers"] = [l.value for l in self.layers]
        if self.agent_ids is not None:
            result["agentIds"] = self.agent_ids
        if self.min_importance is not None:
            result["minImportance"] = self.min_importance
        if self.max_age is not None:
            result["maxAge"] = self.max_age
        if self.required_tags is not None:
            result["requiredTags"] = self.required_tags
        if self.any_tags is not None:
            result["anyTags"] = self.any_tags
        if self.exclude_tags is not None:
            result["excludeTags"] = self.exclude_tags
        if self.min_activation is not None:
            result["minActivation"] = self.min_activation
        if self.text_query is not None:
            result["textQuery"] = self.text_query
        if self.embedding is not None:
            result["embedding"] = self.embedding
        if self.similarity_threshold is not None:
            result["similarityThreshold"] = self.similarity_threshold
        if self.limit is not None:
            result["limit"] = self.limit
        if self.offset is not None:
            result["offset"] = self.offset
        return result


@dataclass
class BridgeQueryResult:
    """Query result with scoring information"""
    memory: BridgeMemoryEntry
    score: float
    score_breakdown: Dict[str, float] = field(default_factory=dict)
    highlights: Optional[List[str]] = None

    def to_typescript_format(self) -> Dict[str, Any]:
        return {
            "memory": self.memory.to_typescript_format(),
            "score": self.score,
            "scoreBreakdown": self.score_breakdown,
            "highlights": self.highlights,
        }


# =============================================================================
# SERIALIZATION HELPERS
# =============================================================================

def validate_bridge_memory_entry(data: Any) -> bool:
    """Validate a memory entry conforms to the bridge schema"""
    if not isinstance(data, dict):
        return False
    
    required_fields = [
        "id", "agent_id", "layer", "content", "timestamp",
        "access_count", "importance", "decay_rate", "activation",
        "associations", "tags", "metadata"
    ]
    
    # Check for snake_case fields (Python format)
    if all(f in data for f in required_fields):
        return True
    
    # Check for camelCase fields (TypeScript format)
    ts_required = [
        "id", "agentId", "layer", "content", "timestamp",
        "accessCount", "importance", "decayRate", "activation",
        "associations", "tags", "metadata"
    ]
    return all(f in data for f in ts_required)


def serialize_bridge_memory_entry(entry: BridgeMemoryEntry) -> str:
    """Serialize a memory entry for cross-system transfer"""
    data = entry.to_typescript_format()
    data["_schemaVersion"] = BRIDGE_SCHEMA_VERSION
    data["_type"] = "BridgeMemoryEntry"
    return json.dumps(data)


def deserialize_bridge_memory_entry(json_str: str) -> Optional[BridgeMemoryEntry]:
    """Deserialize a memory entry from cross-system transfer"""
    try:
        data = json.loads(json_str)
        schema_version = data.pop("_schemaVersion", None)
        data.pop("_type", None)
        
        if schema_version != BRIDGE_SCHEMA_VERSION:
            print(f"Warning: Schema version mismatch: expected {BRIDGE_SCHEMA_VERSION}, got {schema_version}")
        
        if validate_bridge_memory_entry(data):
            return BridgeMemoryEntry.from_typescript_format(data)
        return None
    except Exception:
        return None


# =============================================================================
# CONVERSION UTILITIES
# =============================================================================

def to_typescript_format(entry: BridgeMemoryEntry) -> Dict[str, Any]:
    """Convert Python memory entry to TypeScript-compatible format"""
    return entry.to_typescript_format()


def from_typescript_format(data: Dict[str, Any]) -> Optional[BridgeMemoryEntry]:
    """Convert TypeScript format to Python memory entry"""
    try:
        return BridgeMemoryEntry.from_typescript_format(data)
    except Exception:
        return None


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================

def create_memory_entry(
    agent_id: str,
    content: str,
    layer: BridgeMemoryLayer = BridgeMemoryLayer.EPISODIC,
    importance: float = 0.5,
    tags: Optional[List[str]] = None,
    embedding: Optional[List[float]] = None,
) -> BridgeMemoryEntry:
    """
    Factory function to create a new memory entry with sensible defaults.
    """
    import uuid
    
    return BridgeMemoryEntry(
        id=str(uuid.uuid4()),
        agent_id=agent_id,
        layer=layer,
        content=content,
        timestamp=datetime.utcnow().isoformat() + "Z",
        access_count=0,
        importance=importance,
        decay_rate=0.1,
        activation=1.0,
        associations=[],
        tags=tags or [],
        metadata={},
        embedding=embedding,
    )


def create_gossip_message(
    type_: str,
    sender_id: str,
    payload: Dict[str, Any],
    vector_clock: Dict[str, int],
    signature: str = "",
    ttl: int = 3,
    target_id: Optional[str] = None,
) -> BridgeGossipMessage:
    """Factory function to create a gossip message"""
    return BridgeGossipMessage(
        type=type_,
        sender_id=sender_id,
        target_id=target_id,
        payload=payload,
        vector_clock=vector_clock,
        timestamp=datetime.utcnow().isoformat() + "Z",
        signature=signature,
        ttl=ttl,
    )


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    # Version
    "BRIDGE_SCHEMA_VERSION",
    
    # Identity
    "BridgeAgentIdentity",
    
    # Memory
    "BridgeMemoryLayer",
    "BridgeMemorySource",
    "BridgeMemoryEntry",
    
    # CRDT
    "BridgeCRDTOperation",
    "BridgeConflictStrategy",
    "BridgeCRDTDelta",
    
    # Gossip
    "BridgeGossipMessage",
    "BridgeMemorySyncPayload",
    "BridgeAgentAnnouncePayload",
    "BridgeKnowledgeQueryPayload",
    "BridgeKnowledgeResponsePayload",
    "BridgeHeartbeatPayload",
    
    # Query
    "BridgeQueryFilters",
    "BridgeQueryResult",
    
    # Serialization
    "validate_bridge_memory_entry",
    "serialize_bridge_memory_entry",
    "deserialize_bridge_memory_entry",
    
    # Conversion
    "to_typescript_format",
    "from_typescript_format",
    
    # Factory
    "create_memory_entry",
    "create_gossip_message",
]
