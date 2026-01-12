/**
 * Memory System Types
 * 
 * TypeScript interfaces for Chrysalis memory system.
 * Mirrors Python types from memory_system/chrysalis_types.py
 * with addition of procedural memory tier for skills/procedures.
 * 
 * @module memory/types
 */

// Re-export MemoryItem from GossipTypes for convenience
export { MemoryItem } from '../core/patterns/GossipTypes';

/**
 * Memory type classification
 */
export type MemoryType = 
  | 'observation'
  | 'thought'
  | 'action'
  | 'result'
  | 'conversation'
  | 'knowledge'
  | 'skill'
  | 'procedure'
  | 'response'
  | 'event';

/**
 * Source of memory
 */
export type MemorySource = 
  | 'user'
  | 'agent'
  | 'tool'
  | 'unknown'
  | 'system';

/**
 * Memory tier in the hierarchy
 */
export type MemoryTier = 
  | 'working'    // Short-term, session context
  | 'episodic'   // Past experiences
  | 'semantic'   // Facts and knowledge
  | 'procedural'; // Skills and procedures

/**
 * Cryptographic fingerprint (Pattern #1)
 */
export interface MemoryFingerprint {
  fingerprint: string;     // SHA-384 hash (96 hex chars)
  algorithm: 'sha384';
  contentHash: string;     // Hash of content only
  metadataHash: string;    // Hash of metadata
}

/**
 * Digital signature (Pattern #2)
 */
export interface MemorySignature {
  signature: string;       // Base64-encoded Ed25519 signature
  publicKey: string;       // Base64-encoded Ed25519 public key
  algorithm: 'ed25519';
  signedBy: string;        // Instance ID
  timestamp: number;       // When signed
}

/**
 * Logical time ordering (Pattern #9)
 */
export interface LogicalTime {
  lamportTime: number;     // Lamport timestamp
  vectorTime: number[];    // Vector clock
  wallTime: number;        // Wall clock timestamp (ms)
  instanceId: string;      // Instance that created this time
}

/**
 * Gossip metadata (Pattern #4)
 */
export interface GossipMetadata {
  originInstance: string;
  seenBy: string[];        // Set of instance IDs
  fanout: number;
  propagationRound: number;
  lastGossip: number;
}

/**
 * Byzantine validation (Pattern #8)
 */
export interface ByzantineValidation {
  verifiedBy: string[];
  confidenceScores: number[];
  trimmedMean: number;
  median: number;
  threshold: boolean;
  requiredVotes: number;
}

/**
 * CRDT metadata (Pattern #10)
 */
export interface CRDTMetadata {
  crdtType: 'g-set' | 'or-set' | 'lww-register';
  addedBy: string[];
  firstAdded: number;
  lastModified: number;
  version: number;
}

/**
 * Memory causality DAG (Pattern #5)
 */
export interface MemoryCausality {
  parentMemories: string[];
  childMemories: string[];
  relatedMemories: string[];
}

/**
 * Convergence metadata (Pattern #6)
 */
export interface ConvergenceMetadata {
  sources: string[];
  iterations: number;
  converged: boolean;
  canonicalForm: string;
  similarityThreshold: number;
}

/**
 * Base memory entry interface
 */
export interface BaseMemory {
  memoryId: string;
  fingerprint: MemoryFingerprint;
  content: string;
  memoryType: MemoryType;
  source: MemorySource;
  tier: MemoryTier;
  importance: number;       // 0-1
  instanceId: string;
  logicalTime: LogicalTime;
  causality: MemoryCausality;
  signature?: MemorySignature;
  embedding?: number[];     // Vector embedding for similarity
  /** Optional summary (required for episodic, optional for others) */
  summary?: string;
}

/**
 * Working memory - short-term session context
 */
export interface WorkingMemory extends BaseMemory {
  tier: 'working';
  expiresAt?: number;       // When to auto-evict
}

/**
 * Episodic memory - past experiences
 */
export interface EpisodicMemory extends BaseMemory {
  tier: 'episodic';
  summary: string;
  crdt: CRDTMetadata;
  gossip: GossipMetadata;
  validation: ByzantineValidation;
}

/**
 * Semantic memory - facts and knowledge
 */
export interface SemanticMemory extends BaseMemory {
  tier: 'semantic';
  fact: string;
  alternatePhrasings: string[];
  evidence: string[];       // Memory IDs supporting this fact
  convergence: ConvergenceMetadata;
  validation: ByzantineValidation;
  verificationCount: number;
  confidence: number;
}

/**
 * Procedural memory - learned skills and procedures
 * Memory type definitions
 */
export interface ProceduralMemory extends BaseMemory {
  tier: 'procedural';
  skillName: string;
  description: string;
  steps: string[];          // Ordered procedure steps
  preconditions: string[];  // Required conditions
  postconditions: string[]; // Expected outcomes
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
    default?: unknown;
  }>;
  examples: Array<{
    input: Record<string, unknown>;
    output: string;
    context?: string;
  }>;
  successRate: number;      // 0-1, based on execution history
  executionCount: number;
  lastExecuted?: number;
  validation: ByzantineValidation;
}

/**
 * Union type for any memory
 */
export type Memory = WorkingMemory | EpisodicMemory | SemanticMemory | ProceduralMemory;

/**
 * Memory retrieval result
 */
export interface RetrievalResult {
  memories: Memory[];
  scores: number[];         // Similarity scores
  metadata: {
    query: string;
    tier?: MemoryTier;
    totalSearched: number;
    searchTimeMs: number;
  };
}

/**
 * Memory state container
 */
export interface MemoryState {
  instanceId: string;
  agentId: string;
  workingMemories: WorkingMemory[];
  episodicMemories: EpisodicMemory[];
  semanticMemories: SemanticMemory[];
  proceduralMemories: ProceduralMemory[];
  lamportClock: number;
  vectorClock: number[];
  createdAt: number;
  lastSync: number;
  totalMemories: number;
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  // Embeddings
  embeddingProvider: 'openai' | 'ollama' | 'local';
  embeddingModel: string;
  embeddingDimensions: number;
  
  // Storage
  persistPath: string;
  
  // Working memory
  workingMemorySize: number;
  workingMemoryTTL: number;   // Time to live in ms
  
  // Retrieval
  defaultRetrievalLimit: number;
  similarityThreshold: number;
  
  // Tiers
  enabledTiers: MemoryTier[];
  
  // Sync
  gossipEnabled: boolean;
  gossipFanout: number;
  
  // Byzantine
  byzantineEnabled: boolean;
  byzantineThreshold: number;
}

/**
 * Default memory configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  embeddingProvider: 'ollama',
  embeddingModel: 'nomic-embed-text',
  embeddingDimensions: 768,
  persistPath: './data/memory',
  workingMemorySize: 20,
  workingMemoryTTL: 3600000, // 1 hour
  defaultRetrievalLimit: 10,
  similarityThreshold: 0.7,
  enabledTiers: ['working', 'episodic', 'semantic', 'procedural'],
  gossipEnabled: false,
  gossipFanout: 3,
  byzantineEnabled: false,
  byzantineThreshold: 0.67
};

/**
 * Memory event types for subscriptions
 */
export type MemoryEventType = 
  | 'memory:added'
  | 'memory:updated'
  | 'memory:deleted'
  | 'memory:promoted'  // Working -> Episodic
  | 'memory:consolidated'  // Multiple -> Semantic
  | 'memory:synced'
  | 'skill:learned'
  | 'skill:executed';

/**
 * Memory event
 */
export interface MemoryEvent {
  type: MemoryEventType;
  memory: Memory;
  previousTier?: MemoryTier;
  timestamp: number;
  instanceId: string;
}

/**
 * Memory event handler
 */
export type MemoryEventHandler = (event: MemoryEvent) => void | Promise<void>;
