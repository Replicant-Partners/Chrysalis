"""
Chrysalis Memory System - Main Integration
Combines all universal patterns into unified memory interface

This is the production-ready Chrysalis-native memory system
"""

from typing import List, Dict, Optional, Set
from datetime import datetime
from dataclasses import asdict

from .chrysalis_types import (
    MemoryType,
    MemorySource,
    WorkingMemory,
    EpisodicMemory,
    SemanticMemory,
    CoreMemory,
    MemoryState,
    LogicalTime,
    MemoryCausality,
    GossipMetadata,
    ByzantineValidation,
    CRDTMetadata,
)
from .identity import MemoryIdentity, KeyPairManager
from .gossip import MemoryGossipProtocol, GossipConfig, GossipPeer
from .byzantine import ByzantineMemoryValidator, ValidationVote
from .crdt_merge import MemoryCRDTMerger


class ChrysalisMemory:
    """
    Chrysalis Memory System - Pattern-Based Agent Memory
    
    Integrates 7 universal patterns:
    - Pattern #1 (Hash): Cryptographic fingerprinting
    - Pattern #2 (Signature): Digital authentication
    - Pattern #4 (Gossip): O(log N) propagation
    - Pattern #5 (DAG): Causal relationships
    - Pattern #6 (Convergence): Fixed-point consolidation
    - Pattern #8 (Threshold): Byzantine resistance
    - Pattern #9 (Time): Logical time ordering
    - Pattern #10 (CRDT): Conflict-free merging
    
    This is NOT a traditional memory system - it's memory built on
    universal patterns from distributed systems, cryptography, and nature.
    """
    
    def __init__(
        self,
        instance_id: str,
        agent_id: str,
        instance_index: int = 0,
        total_instances: int = 1,
        private_key: Optional[bytes] = None,
        gossip_config: Optional[GossipConfig] = None
    ):
        """
        Initialize Chrysalis Memory
        
        Args:
            instance_id: Unique instance identifier
            agent_id: Agent identifier
            instance_index: Index in vector clock
            total_instances: Total instances for Byzantine calculations
            private_key: Ed25519 private key (generates if None)
            gossip_config: Gossip protocol configuration
        """
        self.instance_id = instance_id
        self.agent_id = agent_id
        self.instance_index = instance_index
        self.total_instances = total_instances
        
        # Generate or use provided keypair (Pattern #2)
        if private_key is None:
            self.private_key, self.public_key = KeyPairManager.generate_keypair()
        else:
            self.private_key = private_key
            self.public_key = KeyPairManager.public_key_from_private(private_key)
        
        # Initialize memory state
        self.state = MemoryState(
            instanceId=instance_id,
            agentId=agent_id,
            vectorClock=[0] * total_instances
        )
        
        # Initialize gossip protocol (Pattern #4)
        self.gossip = MemoryGossipProtocol(
            instance_id,
            gossip_config or GossipConfig()
        )
        
        # Initialize validator (Pattern #8)
        self.validator = ByzantineMemoryValidator()
    
    # ==========================================================================
    # Core Memory Creation (Pattern #1 + #2 + #9)
    # ==========================================================================
    
    def create_working_memory(
        self,
        content: str,
        memory_type: MemoryType = MemoryType.OBSERVATION,
        source: MemorySource = MemorySource.AGENT,
        importance: float = 0.5,
        parent_memories: List[str] = None
    ) -> WorkingMemory:
        """
        Create working memory with:
        - Pattern #1: Fingerprint (SHA-384)
        - Pattern #2: Signature (Ed25519)
        - Pattern #9: Logical time (Lamport + Vector)
        - Pattern #5: Causality (DAG)
        """
        # Generate fingerprint (Pattern #1)
        timestamp = datetime.now().timestamp()
        fingerprint = MemoryIdentity.generate_fingerprint(
            content,
            memory_type.value,
            timestamp,
            {'source': source.value, 'importance': importance}
        )
        
        # Create logical time (Pattern #9)
        lamport_time = self.state.tick_lamport()
        vector_time = self.state.tick_vector(self.instance_index)
        
        logical_time = LogicalTime(
            lamportTime=lamport_time,
            vectorTime=vector_time,
            wallTime=timestamp,
            instanceId=self.instance_id
        )
        
        # Create causality (Pattern #5)
        causality = MemoryCausality(
            parentMemories=parent_memories or []
        )
        
        # Sign memory (Pattern #2)
        signature = MemoryIdentity.sign_memory(
            fingerprint.fingerprint,
            self.private_key,
            self.instance_id
        )
        
        # Create memory
        memory = WorkingMemory(
            memoryId=fingerprint.fingerprint,
            fingerprint=fingerprint,
            content=content,
            memoryType=memory_type,
            source=source,
            logicalTime=logical_time,
            causality=causality,
            importance=importance,
            instanceId=self.instance_id,
            signature=signature
        )
        
        # Add to working memory
        self.state.workingMemories.append(memory)
        
        return memory
    
    def create_episodic_memory(
        self,
        content: str,
        summary: str = None,
        memory_type: MemoryType = MemoryType.OBSERVATION,
        source: MemorySource = MemorySource.AGENT,
        importance: float = 0.5,
        parent_memories: List[str] = None
    ) -> EpisodicMemory:
        """
        Create episodic memory with:
        - Pattern #1 + #2: Identity
        - Pattern #9: Logical time
        - Pattern #4: Gossip metadata
        - Pattern #8: Byzantine validation
        - Pattern #10: CRDT metadata
        """
        # Generate fingerprint
        timestamp = datetime.now().timestamp()
        fingerprint = MemoryIdentity.generate_fingerprint(
            content,
            memory_type.value,
            timestamp
        )
        
        # Create logical time
        lamport_time = self.state.tick_lamport()
        vector_time = self.state.tick_vector(self.instance_index)
        
        logical_time = LogicalTime(
            lamportTime=lamport_time,
            vectorTime=vector_time,
            wallTime=timestamp,
            instanceId=self.instance_id
        )
        
        # Create causality
        causality = MemoryCausality(
            parentMemories=parent_memories or []
        )
        
        # Sign memory
        signature = MemoryIdentity.sign_memory(
            fingerprint.fingerprint,
            self.private_key,
            self.instance_id
        )
        
        # Create gossip metadata (Pattern #4)
        gossip_meta = GossipMetadata(
            originInstance=self.instance_id,
            seenBy={self.instance_id},
            fanout=self.gossip.config.fanout
        )
        
        # Create CRDT metadata (Pattern #10)
        crdt_meta = CRDTMetadata(
            crdtType='g-set',
            addedBy={self.instance_id}
        )
        
        # Create Byzantine validation (Pattern #8)
        validation = ByzantineValidation(
            verifiedBy=[self.instance_id],
            confidenceScores=[1.0],  # We trust ourselves
            requiredVotes=self.validator.calculate_threshold(self.total_instances)
        )
        
        # Create memory
        memory = EpisodicMemory(
            memoryId=fingerprint.fingerprint,
            fingerprint=fingerprint,
            content=content,
            summary=summary or content[:100],
            crdt=crdt_meta,
            gossip=gossip_meta,
            validation=validation,
            logicalTime=logical_time,
            causality=causality,
            signature=signature,
            memoryType=memory_type,
            source=source,
            importance=importance,
            instanceId=self.instance_id
        )
        
        # Add to episodic memory
        self.state.episodicMemories.append(memory)
        
        return memory
    
    # ==========================================================================
    # Gossip Operations (Pattern #4)
    # ==========================================================================
    
    async def gossip_memory_to_peers(
        self,
        memory: EpisodicMemory,
        fanout: int = None
    ) -> Dict[str, bool]:
        """
        Pattern #4: Gossip memory to random peers
        
        Memory spreads exponentially:
        - Round 1: fanout instances
        - Round 2: fanout^2 instances
        - Round k: fanout^k instances
        
        Reaches all N instances in O(log N) rounds!
        """
        return await self.gossip.gossip_memory(memory, fanout)
    
    def add_gossip_peer(self, peer: GossipPeer):
        """Add peer for gossip protocol"""
        self.gossip.add_peer(peer)
    
    def estimate_propagation_time(self) -> float:
        """Estimate time to propagate to all instances"""
        return self.gossip.estimate_propagation_time(self.total_instances)
    
    # ==========================================================================
    # Byzantine Validation (Pattern #8)
    # ==========================================================================
    
    def validate_memory_byzantine(
        self,
        memory: EpisodicMemory,
        votes: List[ValidationVote]
    ) -> ByzantineValidation:
        """
        Pattern #8: Validate memory with Byzantine resistance
        
        Requires >2/3 honest instances
        Uses trimmed mean to resist Byzantine outliers
        """
        return self.validator.validate_memory(
            memory,
            votes,
            self.total_instances
        )
    
    # ==========================================================================
    # CRDT Merge (Pattern #10)
    # ==========================================================================
    
    def merge_with_instance(
        self,
        other_state: MemoryState
    ) -> MemoryState:
        """
        Pattern #10: Conflict-free merge with another instance
        
        Properties:
        - Commutative: merge(A, B) = merge(B, A)
        - Associative: merge(merge(A,B), C) = merge(A, merge(B,C))
        - Idempotent: merge(A, A) = A
        
        No coordination needed!
        Order doesn't matter!
        Eventual consistency guaranteed!
        """
        merged_state = MemoryCRDTMerger.merge_memory_states(
            self.state,
            other_state
        )
        
        # Update our state
        self.state = merged_state
        
        return merged_state
    
    # ==========================================================================
    # Retrieval & Search
    # ==========================================================================
    
    def get_working_memories(
        self,
        memory_type: Optional[MemoryType] = None,
        min_importance: float = 0.0
    ) -> List[WorkingMemory]:
        """Get working memories with optional filters"""
        memories = self.state.workingMemories
        
        if memory_type:
            memories = [m for m in memories if m.memoryType == memory_type]
        
        if min_importance > 0.0:
            memories = [m for m in memories if m.importance >= min_importance]
        
        return memories
    
    def get_episodic_memories(
        self,
        memory_type: Optional[MemoryType] = None,
        min_importance: float = 0.0,
        verified_only: bool = False
    ) -> List[EpisodicMemory]:
        """Get episodic memories with optional filters"""
        memories = self.state.episodicMemories
        
        if memory_type:
            memories = [m for m in memories if m.memoryType == memory_type]
        
        if min_importance > 0.0:
            memories = [m for m in memories if m.importance >= min_importance]
        
        if verified_only:
            memories = [m for m in memories if m.validation.threshold]
        
        return memories
    
    def search_by_content(
        self,
        query: str,
        memory_types: List[str] = None
    ) -> List[EpisodicMemory]:
        """Simple content search (case-insensitive)"""
        query_lower = query.lower()
        results = []
        
        for memory in self.state.episodicMemories:
            if query_lower in memory.content.lower() and (not memory_types or memory.memoryType.value in memory_types):
                results.append(memory)
        
        return results
    
    # ==========================================================================
    # Statistics & Monitoring
    # ==========================================================================
    
    def get_stats(self) -> Dict:
        """Get memory statistics"""
        return {
            'instance_id': self.instance_id,
            'agent_id': self.agent_id,
            'working_memories': len(self.state.workingMemories),
            'episodic_memories': len(self.state.episodicMemories),
            'semantic_memories': len(self.state.semanticMemories),
            'total_memories': self.state.totalMemories,
            'lamport_clock': self.state.lamportClock,
            'vector_clock': self.state.vectorClock,
            'last_sync': self.state.lastSync,
            'gossip_peers': len(self.gossip.peers),
            'gossip_round': self.gossip.current_round,
        }
    
    def get_coverage_percent(
        self,
        memory: EpisodicMemory
    ) -> float:
        """Get what percentage of instances have this memory"""
        return self.gossip.calculate_coverage(memory, self.total_instances)
    
    # ==========================================================================
    # Serialization
    # ==========================================================================
    
    def to_dict(self) -> Dict:
        """Export memory state to dict"""
        return {
            'instance_id': self.instance_id,
            'agent_id': self.agent_id,
            'state': asdict(self.state),
            'stats': self.get_stats(),
        }


# ==============================================================================
# Convenience Functions
# ==============================================================================

def create_chrysalis_memory(
    instance_id: str,
    agent_id: str,
    num_instances: int = 1,
    fanout: int = 3
) -> ChrysalisMemory:
    """
    Convenience: Create Chrysalis Memory with defaults
    """
    return ChrysalisMemory(
        instance_id=instance_id,
        agent_id=agent_id,
        instance_index=0,
        total_instances=num_instances,
        gossip_config=GossipConfig(fanout=fanout)
    )


# ==============================================================================
# Example Usage
# ==============================================================================

if __name__ == "__main__":
    print("=== Chrysalis Memory System Demo ===\n")
    
    # Create memory system
    print("1. Creating Chrysalis Memory instance...")
    memory = create_chrysalis_memory(
        instance_id="instance-001",
        agent_id="research-agent",
        num_instances=10,
        fanout=3
    )
    print(f"   Instance: {memory.instance_id}")
    print(f"   Agent: {memory.agent_id}\n")
    
    # Create working memory
    print("2. Creating working memory (Pattern #1 + #2 + #9)...")
    working = memory.create_working_memory(
        content="User asked about quantum computing",
        memory_type=MemoryType.OBSERVATION,
        source=MemorySource.USER,
        importance=0.8
    )
    print(f"   Memory ID: {working.memoryId[:32]}...")
    print(f"   Lamport time: {working.logicalTime.lamportTime}")
    print(f"   Signed: ✓\n")
    
    # Create episodic memory
    print("3. Creating episodic memory (Patterns #1-#10)...")
    episodic = memory.create_episodic_memory(
        content="Quantum computers use qubits for superposition",
        summary="Qubits enable quantum superposition",
        memory_type=MemoryType.KNOWLEDGE,
        importance=0.9
    )
    print(f"   Memory ID: {episodic.memoryId[:32]}...")
    print(f"   CRDT type: {episodic.crdt.crdtType}")
    print(f"   Gossip fanout: {episodic.gossip.fanout}")
    print(f"   Byzantine threshold: {episodic.validation.requiredVotes}/{memory.total_instances}\n")
    
    # Calculate propagation
    print("4. Gossip propagation analysis (Pattern #4)...")
    prop_time = memory.estimate_propagation_time()
    print(f"   Total instances: {memory.total_instances}")
    print(f"   Fanout: {memory.gossip.config.fanout}")
    print(f"   Estimated propagation time: {prop_time:.2f}s")
    print(f"   O(log_{memory.gossip.config.fanout} {memory.total_instances}) rounds\n")
    
    # Show stats
    print("5. Memory statistics:")
    stats = memory.get_stats()
    for key, value in stats.items():
        print(f"   {key}: {value}")
    
    print("\n=== Chrysalis Memory: All Patterns Integrated ===")
