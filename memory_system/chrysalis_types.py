"""
Chrysalis Memory System - Core Types
Integrated with Universal Patterns #1, #2, #4, #5, #6, #8, #9, #10
"""

from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Any, Literal
from datetime import datetime
from enum import Enum


class MemoryType(Enum):
    """Memory type classification"""
    OBSERVATION = "observation"
    THOUGHT = "thought"
    ACTION = "action"
    RESULT = "result"
    CONVERSATION = "conversation"
    KNOWLEDGE = "knowledge"


class MemorySource(Enum):
    """Source of memory"""
    USER = "user"
    AGENT = "agent"
    TOOL = "tool"
    SYSTEM = "system"


# ==============================================================================
# Pattern #1: Hash - Cryptographic Fingerprinting
# ==============================================================================

@dataclass
class MemoryFingerprint:
    """
    Pattern #1: Cryptographic Hash for Memory Identity
    
    Each memory has unique SHA-384 fingerprint for:
    - Content addressing
    - Tamper detection
    - Deduplication
    """
    fingerprint: str  # SHA-384 hash (96 hex chars)
    algorithm: Literal['sha384'] = 'sha384'
    contentHash: str  # Hash of content only
    metadataHash: str  # Hash of metadata
    
    def __post_init__(self):
        """Validate hash format"""
        if len(self.fingerprint) != 96:
            raise ValueError(f"Invalid SHA-384 hash length: {len(self.fingerprint)}")


# ==============================================================================
# Pattern #2: Signatures - Digital Authentication
# ==============================================================================

@dataclass
class MemorySignature:
    """
    Pattern #2: Digital Signatures for Memory Authentication
    
    Each memory is signed by its source instance for:
    - Provable origin
    - Non-repudiation
    - Integrity verification
    """
    signature: bytes  # Ed25519 signature (64 bytes)
    publicKey: bytes  # Ed25519 public key (32 bytes)
    algorithm: Literal['ed25519'] = 'ed25519'
    signedBy: str  # Instance ID
    timestamp: float  # When signed
    
    def __post_init__(self):
        """Validate signature format"""
        if len(self.signature) != 64:
            raise ValueError(f"Invalid Ed25519 signature length: {len(self.signature)}")
        if len(self.publicKey) != 32:
            raise ValueError(f"Invalid Ed25519 public key length: {len(self.publicKey)}")


# ==============================================================================
# Pattern #9: Logical Time - Causal Ordering
# ==============================================================================

@dataclass
class LogicalTime:
    """
    Pattern #9: Lamport and Vector Clocks
    
    Provides happens-before ordering for memories:
    - Lamport clock: Total order
    - Vector clock: Causal dependencies
    - Wall clock: Human-readable timestamp
    """
    lamportTime: int  # Lamport timestamp
    vectorTime: List[int]  # Vector clock (one per instance)
    wallTime: float  # Wall clock timestamp
    instanceId: str  # Instance that created this time
    
    def happens_before(self, other: 'LogicalTime') -> bool:
        """Check if this memory happened before another (Pattern #9)"""
        # Lamport: self < other
        if self.lamportTime < other.lamportTime:
            return True
        if self.lamportTime > other.lamportTime:
            return False
        
        # Vector: self <= other (componentwise)
        return all(s <= o for s, o in zip(self.vectorTime, other.vectorTime))


# ==============================================================================
# Pattern #4: Gossip - Epidemic Propagation
# ==============================================================================

@dataclass
class GossipMetadata:
    """
    Pattern #4: Gossip Protocol Metadata
    
    Tracks memory propagation via epidemic protocols:
    - Origin instance
    - Instances that have seen this memory
    - Gossip round for O(log N) analysis
    """
    originInstance: str  # Where memory originated
    seenBy: Set[str] = field(default_factory=set)  # Instances with this memory
    fanout: int = 3  # Gossip fanout (typically 3)
    propagationRound: int = 0  # Which gossip round
    lastGossip: float = field(default_factory=lambda: datetime.now().timestamp())
    
    def mark_seen(self, instance_id: str):
        """Mark that an instance has seen this memory"""
        self.seenBy.add(instance_id)
    
    def coverage_percent(self, total_instances: int) -> float:
        """Calculate what percentage of instances have this memory"""
        return (len(self.seenBy) / total_instances) * 100 if total_instances > 0 else 0.0


# ==============================================================================
# Pattern #8: Threshold - Byzantine Resistance
# ==============================================================================

@dataclass
class ByzantineValidation:
    """
    Pattern #8: Byzantine-Resistant Validation
    
    Validates memories using >2/3 threshold:
    - Requires supermajority agreement
    - Trimmed mean for confidence
    - Resistant to Byzantine nodes
    """
    verifiedBy: List[str] = field(default_factory=list)  # Instances that verified
    confidenceScores: List[float] = field(default_factory=list)  # Raw scores
    trimmedMean: float = 0.0  # Byzantine-resistant aggregate
    median: float = 0.0  # Another resistant measure
    threshold: bool = False  # Met >2/3 requirement?
    requiredVotes: int = 0  # How many votes needed
    
    def meets_threshold(self) -> bool:
        """Check if validation meets >2/3 Byzantine threshold"""
        return len(self.verifiedBy) >= self.requiredVotes
    
    def add_verification(self, instance_id: str, confidence: float):
        """Add a verification from an instance"""
        self.verifiedBy.append(instance_id)
        self.confidenceScores.append(confidence)
        self.threshold = self.meets_threshold()
    
    def calculate_trimmed_mean(self, trim_percent: float = 0.2) -> float:
        """
        Calculate Byzantine-resistant trimmed mean (Pattern #8)
        
        Remove top and bottom trim_percent to eliminate outliers/malicious values
        """
        if not self.confidenceScores:
            return 0.0
        
        sorted_scores = sorted(self.confidenceScores)
        n = len(sorted_scores)
        trim_count = int(n * trim_percent)
        
        if trim_count * 2 >= n:  # Can't trim more than half
            trim_count = 0
        
        trimmed = sorted_scores[trim_count:n-trim_count] if trim_count > 0 else sorted_scores
        self.trimmedMean = sum(trimmed) / len(trimmed) if trimmed else 0.0
        return self.trimmedMean
    
    def calculate_median(self) -> float:
        """Calculate median (Byzantine-resistant) (Pattern #8)"""
        if not self.confidenceScores:
            return 0.0
        
        sorted_scores = sorted(self.confidenceScores)
        n = len(sorted_scores)
        mid = n // 2
        
        if n % 2 == 0:
            self.median = (sorted_scores[mid-1] + sorted_scores[mid]) / 2
        else:
            self.median = sorted_scores[mid]
        
        return self.median


# ==============================================================================
# Pattern #10: CRDT - Conflict-Free Replicated Data Types
# ==============================================================================

@dataclass
class CRDTMetadata:
    """
    Pattern #10: CRDT Metadata for Conflict-Free Merging
    
    Memories use G-Set (Grow-only Set) semantics:
    - Add-only (no deletes)
    - Commutative merge
    - Eventual consistency
    """
    crdtType: Literal['g-set', 'or-set', 'lww-register'] = 'g-set'
    addedBy: Set[str] = field(default_factory=set)  # Instances that added
    firstAdded: float = field(default_factory=lambda: datetime.now().timestamp())
    lastModified: float = field(default_factory=lambda: datetime.now().timestamp())
    version: int = 1  # For tracking merge iterations
    
    def merge(self, other: 'CRDTMetadata') -> 'CRDTMetadata':
        """
        CRDT merge operation (Pattern #10)
        
        Properties:
        - Commutative: merge(A, B) = merge(B, A)
        - Associative: merge(merge(A,B), C) = merge(A, merge(B,C))
        - Idempotent: merge(A, A) = A
        """
        return CRDTMetadata(
            crdtType=self.crdtType,
            addedBy=self.addedBy.union(other.addedBy),  # Union (G-Set)
            firstAdded=min(self.firstAdded, other.firstAdded),
            lastModified=max(self.lastModified, other.lastModified),
            version=max(self.version, other.version) + 1,
        )


# ==============================================================================
# Pattern #5: DAG - Directed Acyclic Graph
# ==============================================================================

@dataclass
class MemoryCausality:
    """
    Pattern #5: DAG Structure for Memory Relationships
    
    Tracks causal dependencies between memories:
    - Parent memories (happens-before)
    - Child memories (caused by this)
    - Related memories (associated)
    """
    parentMemories: List[str] = field(default_factory=list)  # Memory IDs
    childMemories: List[str] = field(default_factory=list)  # Memory IDs
    relatedMemories: List[str] = field(default_factory=list)  # Associated
    
    def add_parent(self, memory_id: str):
        """Add a parent memory (happens-before relationship)"""
        if memory_id not in self.parentMemories:
            self.parentMemories.append(memory_id)
    
    def add_child(self, memory_id: str):
        """Add a child memory (caused-by relationship)"""
        if memory_id not in self.childMemories:
            self.childMemories.append(memory_id)


# ==============================================================================
# Pattern #6: Convergence - Fixed Point Merging
# ==============================================================================

@dataclass
class ConvergenceMetadata:
    """
    Pattern #6: Convergence Tracking for Memory Consolidation
    
    Tracks convergence to canonical form:
    - Source memories that merged
    - Iteration count
    - Convergence status
    """
    sources: List[str] = field(default_factory=list)  # Source memory IDs
    iterations: int = 0  # Merge iterations
    converged: bool = False  # Fixed point reached?
    canonicalForm: str = ""  # Converged representation
    similarityThreshold: float = 0.9  # For clustering
    
    def mark_converged(self, canonical: str):
        """Mark that convergence has been reached"""
        self.converged = True
        self.canonicalForm = canonical


# ==============================================================================
# Core Memory Types
# ==============================================================================

@dataclass
class CoreMemory:
    """
    Core Memory: Persistent identity blocks (Pattern #1 + #2)
    
    Immutable context that defines agent identity and session
    """
    # Identity (Pattern #1 + #2)
    fingerprint: MemoryFingerprint
    signature: MemorySignature
    
    # Content blocks
    blocks: Dict[str, str] = field(default_factory=dict)  # e.g., persona, human, context
    
    # Metadata
    createdAt: float = field(default_factory=lambda: datetime.now().timestamp())
    instanceId: str = ""


@dataclass
class WorkingMemory:
    """
    Working Memory: Short-term session memory (Pattern #9)
    
    Temporary memories with logical time ordering
    """
    # Identity (Pattern #1)
    memoryId: str  # SHA-384 fingerprint
    fingerprint: MemoryFingerprint
    
    # Content
    content: str
    memoryType: MemoryType
    source: MemorySource
    
    # Temporal ordering (Pattern #9)
    logicalTime: LogicalTime
    
    # Causality (Pattern #5)
    causality: MemoryCausality
    
    # Metadata
    importance: float = 0.5  # 0-1
    instanceId: str = ""
    
    # Verification (Pattern #2)
    signature: Optional[MemorySignature] = None


@dataclass
class EpisodicMemory:
    """
    Episodic Memory: Long-term experiences (Pattern #4 + #10)
    
    Persistent memories with gossip sync and CRDT merging
    """
    # Identity (Pattern #1)
    memoryId: str  # SHA-384 fingerprint
    fingerprint: MemoryFingerprint
    
    # Content
    content: str
    summary: str
    embedding: Optional[List[float]] = None  # Vector for similarity
    
    # CRDT (Pattern #10)
    crdt: CRDTMetadata = field(default_factory=CRDTMetadata)
    
    # Gossip (Pattern #4)
    gossip: GossipMetadata = field(default_factory=GossipMetadata)
    
    # Byzantine validation (Pattern #8)
    validation: ByzantineValidation = field(default_factory=ByzantineValidation)
    
    # Temporal (Pattern #9)
    logicalTime: LogicalTime = field(default_factory=lambda: LogicalTime(0, [], 0.0, ""))
    
    # Causality (Pattern #5)
    causality: MemoryCausality = field(default_factory=MemoryCausality)
    
    # Signature (Pattern #2)
    signature: MemorySignature = field(default_factory=lambda: MemorySignature(b'', b'', 'ed25519', '', 0.0))
    
    # Metadata
    memoryType: MemoryType = MemoryType.OBSERVATION
    source: MemorySource = MemorySource.AGENT
    importance: float = 0.5
    instanceId: str = ""


@dataclass
class SemanticMemory:
    """
    Semantic Memory: Knowledge with convergent aggregation (Pattern #6 + #8)
    
    Facts and knowledge with Byzantine-resistant validation
    """
    # Identity (Pattern #1)
    knowledgeId: str  # SHA-384 of canonical form
    fingerprint: MemoryFingerprint
    
    # Content
    fact: str
    alternatePhrasings: List[str] = field(default_factory=list)
    evidence: List[str] = field(default_factory=list)  # Supporting memory IDs
    
    # Convergence (Pattern #6)
    convergence: ConvergenceMetadata = field(default_factory=ConvergenceMetadata)
    
    # Byzantine validation (Pattern #8)
    validation: ByzantineValidation = field(default_factory=ByzantineValidation)
    
    # CRDT (Pattern #10)
    crdt: CRDTMetadata = field(default_factory=CRDTMetadata)
    
    # Temporal (Pattern #9)
    logicalTime: LogicalTime = field(default_factory=lambda: LogicalTime(0, [], 0.0, ""))
    
    # Signature (Pattern #2)
    signature: MemorySignature = field(default_factory=lambda: MemorySignature(b'', b'', 'ed25519', '', 0.0))
    
    # Metadata
    verificationCount: int = 0
    confidence: float = 0.0
    instanceId: str = ""


# ==============================================================================
# Memory Container
# ==============================================================================

@dataclass
class MemoryState:
    """
    Complete memory state for an agent instance
    
    Integrates all memory types with pattern-based operations
    """
    # Instance identity
    instanceId: str
    agentId: str
    
    # Memory stores
    coreMemory: Optional[CoreMemory] = None
    workingMemories: List[WorkingMemory] = field(default_factory=list)
    episodicMemories: List[EpisodicMemory] = field(default_factory=list)
    semanticMemories: List[SemanticMemory] = field(default_factory=list)
    
    # Clocks (Pattern #9)
    lamportClock: int = 0
    vectorClock: List[int] = field(default_factory=list)
    
    # Metadata
    createdAt: float = field(default_factory=lambda: datetime.now().timestamp())
    lastSync: float = 0.0
    totalMemories: int = 0
    
    def tick_lamport(self) -> int:
        """Increment Lamport clock (Pattern #9)"""
        self.lamportClock += 1
        return self.lamportClock
    
    def tick_vector(self, instance_index: int) -> List[int]:
        """Increment vector clock (Pattern #9)"""
        if instance_index >= len(self.vectorClock):
            # Extend vector clock if needed
            self.vectorClock.extend([0] * (instance_index - len(self.vectorClock) + 1))
        self.vectorClock[instance_index] += 1
        return self.vectorClock.copy()
    
    def merge_vector_clocks(self, other_vector: List[int]) -> List[int]:
        """Merge vector clocks (element-wise max) (Pattern #9)"""
        max_len = max(len(self.vectorClock), len(other_vector))
        # Extend both to same length
        self_extended = self.vectorClock + [0] * (max_len - len(self.vectorClock))
        other_extended = other_vector + [0] * (max_len - len(other_vector))
        # Element-wise max
        merged = [max(s, o) for s, o in zip(self_extended, other_extended)]
        self.vectorClock = merged
        return merged
