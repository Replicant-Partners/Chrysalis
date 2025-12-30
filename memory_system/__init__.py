"""
Chrysalis Memory System - Pattern-Based Agent Memory
Built on 7 Universal Patterns from distributed systems, cryptography, and nature

This is NOT a traditional memory system - it's memory engineered from
validated universal patterns:

- Pattern #1 (Hash): Cryptographic fingerprinting (SHA-384)
- Pattern #2 (Signature): Digital authentication (Ed25519)
- Pattern #4 (Gossip): O(log N) propagation across instances
- Pattern #5 (DAG): Causal relationships between memories
- Pattern #6 (Convergence): Fixed-point consolidation
- Pattern #8 (Threshold): Byzantine-resistant validation (>2/3)
- Pattern #9 (Time): Logical time ordering (Lamport + Vector clocks)
- Pattern #10 (CRDT): Conflict-free replicated data types

Integration:
- ✅ Chrysalis v3.0 Universal Patterns
- ✅ V2 Experience Synchronization (Streaming, Lumped, Check-in)
- ✅ Cryptographic identity and verification
- ✅ Byzantine resistance (tolerates up to 1/3 malicious nodes)
- ✅ Gossip-based memory propagation
- ✅ CRDT-based conflict-free merging

Usage:
    from memory_system import ChrysalisMemory, MemoryType
    
    # Create memory instance
    memory = ChrysalisMemory(
        instance_id="instance-001",
        agent_id="research-agent",
        instance_index=0,
        total_instances=10
    )
    
    # Create memory (automatically fingerprinted, signed, timestamped)
    episodic = memory.create_episodic_memory(
        content="User asked about quantum computing",
        memory_type=MemoryType.OBSERVATION,
        importance=0.8
    )
    
    # Gossip to peers (O(log N) propagation)
    await memory.gossip_memory_to_peers(episodic)
    
    # Merge with another instance (conflict-free)
    merged = memory.merge_with_instance(other_instance.state)
"""

# Main Chrysalis Memory API
from .chrysalis_memory import (
    ChrysalisMemory,
    create_chrysalis_memory,
)

# Core types
from .chrysalis_types import (
    # Enums
    MemoryType,
    MemorySource,
    
    # Pattern-based types
    MemoryFingerprint,
    MemorySignature,
    LogicalTime,
    GossipMetadata,
    ByzantineValidation,
    CRDTMetadata,
    MemoryCausality,
    ConvergenceMetadata,
    
    # Memory types
    CoreMemory,
    WorkingMemory,
    EpisodicMemory,
    SemanticMemory,
    MemoryState,
)

# Pattern implementations
from .identity import (
    MemoryIdentity,
    KeyPairManager,
    create_memory_id,
    sign_and_verify,
)

from .gossip import (
    MemoryGossipProtocol,
    GossipConfig,
    GossipPeer,
    GossipScheduler,
)

from .byzantine import (
    ByzantineMemoryValidator,
    ValidationVote,
    SupermajorityChecker,
)

from .crdt_merge import (
    MemoryCRDTMerger,
    GSet,
    ORSet,
    LWWRegister,
)

__version__ = "1.0.0"
__title__ = "Chrysalis Memory System"
__description__ = "Pattern-based agent memory built on universal distributed systems principles"

__all__ = [
    # Main API
    "ChrysalisMemory",
    "create_chrysalis_memory",
    
    # Enums
    "MemoryType",
    "MemorySource",
    
    # Pattern-based types
    "MemoryFingerprint",
    "MemorySignature",
    "LogicalTime",
    "GossipMetadata",
    "ByzantineValidation",
    "CRDTMetadata",
    "MemoryCausality",
    "ConvergenceMetadata",
    
    # Memory types
    "CoreMemory",
    "WorkingMemory",
    "EpisodicMemory",
    "SemanticMemory",
    "MemoryState",
    
    # Pattern implementations
    "MemoryIdentity",
    "KeyPairManager",
    "MemoryGossipProtocol",
    "GossipConfig",
    "GossipPeer",
    "GossipScheduler",
    "ByzantineMemoryValidator",
    "ValidationVote",
    "SupermajorityChecker",
    "MemoryCRDTMerger",
    "GSet",
    "ORSet",
    "LWWRegister",
    
    # Utilities
    "create_memory_id",
    "sign_and_verify",
]
