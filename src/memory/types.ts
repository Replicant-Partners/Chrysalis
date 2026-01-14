/**
 * Memory System Type Definitions
 * 
 * @module memory/types
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item C-2
 */

// =============================================================================
// Core Memory Types
// =============================================================================

/**
 * Memory entry representing a single piece of stored information
 */
export interface MemoryEntry {
  id: string;
  content: string;
  memoryType: MemoryType;
  timestamp: Date;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

/**
 * Supported memory types following cognitive architecture
 */
export type MemoryType = 
  | 'working' 
  | 'episodic' 
  | 'semantic' 
  | 'core' 
  | 'procedural'
  | 'observation'
  | 'response'
  | 'event'
  | 'skill'
  | 'knowledge_claim';

/**
 * Memory tier levels for hierarchical storage
 */
export type MemoryTier = 'working' | 'short-term' | 'long-term' | 'core' | 'episodic' | 'semantic' | 'procedural';

/**
 * Memory source classification
 */
export type MemorySource = 'user' | 'agent' | 'system' | 'external' | 'derived' | 'unknown';

/**
 * Memory event types for observability
 */
export type MemoryEventType = 
  | 'memory:added'
  | 'memory:updated'
  | 'memory:deleted'
  | 'memory:retrieved'
  | 'memory:merged'
  | 'memory:promoted'
  | 'memory:pruned';

// =============================================================================
// Base Memory Interface
// =============================================================================

/**
 * Base memory interface - all memory types extend this
 */
export interface Memory {
  id: string;
  memoryId?: string;  // Alias for id used in some contexts
  content: string;
  embedding?: number[];
  timestamp: number;
  source: MemorySource;
  type?: MemoryType;
  tier?: MemoryTier;
  payload?: Record<string, unknown>;
  fingerprint?: MemoryFingerprint;
  logicalTime?: LogicalTime;
  causality?: MemoryCausality;
  metadata?: Record<string, unknown>;
}

/**
 * Memory item (alias for compatibility)
 */
export type MemoryItem = Memory;

// =============================================================================
// Tiered Memory Types
// =============================================================================

/**
 * Working memory - short-term, recently accessed items
 */
export interface WorkingMemory extends Memory {
  tier: 'working';
  accessCount?: number;
  lastAccess?: number;
  priority?: number;
  importance?: number;
  ttl?: number;
  expiresAt?: number;
}

/**
 * Episodic memory - autobiographical events and experiences
 */
export interface EpisodicMemory extends Memory {
  tier: 'episodic';
  eventType?: string;
  summary?: string;
  participants?: string[];
  location?: string;
  emotionalValence?: number;
  importance?: number;
  crdt?: CRDTMetadata;
  gossip?: GossipMetadata;
  validation?: ByzantineValidation;
}

/**
 * Semantic memory - factual knowledge and concepts
 */
export interface SemanticMemory extends Memory {
  tier: 'semantic';
  concept?: string;
  fact?: string;
  relations?: Array<{ predicate: string; object: string }>;
  confidence?: number;
  verificationCount?: number;
  crdt?: CRDTMetadata;
  gossip?: GossipMetadata;
  validation?: ByzantineValidation;
  convergence?: ConvergenceMetadata;
}

/**
 * Procedural memory - skills and how-to knowledge
 */
export interface ProceduralMemory extends Memory {
  tier: 'procedural';
  skillName?: string;
  description?: string;
  steps?: string[];
  examples?: string[] | Array<{ input: Record<string, unknown>; output: string; context: string }>;
  successRate?: number;
  executionCount?: number;
  crdt?: CRDTMetadata;
  gossip?: GossipMetadata;
  validation?: ByzantineValidation;
  convergence?: ConvergenceMetadata;
}

/**
 * Base memory (alias for compatibility)
 */
export type BaseMemory = Memory;

/**
 * Memory signature for verification
 */
export interface MemorySignature {
  algorithm: string;
  signature: string;
  signedAt: number;
  signedBy: string;
}

// =============================================================================
// Distributed Memory Metadata
// =============================================================================

/**
 * Cryptographic fingerprint for memory identity
 */
export interface MemoryFingerprint {
  hash: string;
  algorithm: 'sha256' | 'sha384' | 'sha512';
  signature?: string;
  signedBy?: string;
  fingerprint?: string;
  contentHash?: string;
  metadataHash?: string;
  createdAt?: number;
}

/**
 * Logical time for causal ordering
 */
export interface LogicalTime {
  lamport: number;
  vector?: Record<string, number>;
  hlc?: { physical: number; logical: number; nodeId: string };
}

/**
 * Causality tracking for memory relationships
 */
export interface MemoryCausality {
  causes: string[];
  effects: string[];
  concurrent: string[];
}

/**
 * CRDT metadata for conflict-free merging
 */
export interface CRDTMetadata {
  type?: 'lww' | 'orset' | 'gset' | 'counter';
  crdtType?: string;
  version?: number | LogicalTime;
  timestamp?: number;
  nodeId?: string;
  tombstone?: boolean;
  addedBy?: string[];
  firstAdded?: number;
  lastModified?: number;
}

/**
 * Gossip protocol metadata
 */
export interface GossipMetadata {
  originNode?: string;
  originInstance?: string;
  hops?: number;
  fanout?: number;
  propagationRound?: number;
  seenBy?: string[];
  firstSeen?: number;
  lastGossip?: number;
}

/**
 * Byzantine validation results
 */
export interface ByzantineValidation {
  validated?: boolean;
  votes?: number;
  threshold?: number | boolean;
  voters?: string[];
  consensusReached?: boolean;
  verifiedBy?: string[];
  confidenceScores?: number[];
  trimmedMean?: number;
  median?: number;
  requiredVotes?: number;
}

/**
 * Convergence metadata for skill aggregation
 */
export interface ConvergenceMetadata {
  iterations?: number;
  converged?: boolean;
  delta?: number;
  method?: 'max' | 'average' | 'weighted' | 'median';
  sources?: string[];
  canonicalForm?: string;
  similarityThreshold?: number;
}

// =============================================================================
// Memory State and Events
// =============================================================================

/**
 * Complete memory state for an agent instance
 */
export interface MemoryState {
  instanceId: string;
  agentId: string;
  workingMemories: WorkingMemory[];
  episodicMemories: EpisodicMemory[];
  semanticMemories: SemanticMemory[];
  proceduralMemories: ProceduralMemory[];
  lamportClock: number;
  vectorClock: Array<{ nodeId: string; time: number }>;
  createdAt: number;
  lastSync: number;
  totalMemories: number;
}

/**
 * Memory event for observability
 */
export interface MemoryEvent {
  type: MemoryEventType;
  memoryId: string;
  tier: MemoryTier;
  timestamp: number;
  instanceId: string;
  memory?: Memory;
  data?: Record<string, unknown>;
}

/**
 * Memory event handler function type
 */
export type MemoryEventHandler = (event: MemoryEvent) => void | Promise<void>;

/**
 * Result from memory retrieval operations
 */
export interface RetrievalResult {
  entries: MemoryEntry[];
  scores: number[];
  metadata: Record<string, unknown>;
}

/**
 * Configuration for memory subsystems
 */
export interface MemoryConfig {
  // Embeddings
  embeddingModel: string;
  embeddingDimensions: number;
  
  // Storage
  vectorStoreType: 'chroma' | 'lance' | 'faiss';
  storagePath: string;
  
  // Working memory
  workingMemorySize: number;
  workingMemoryTTL?: number;
  
  // Retrieval
  defaultRetrievalLimit: number;
  similarityThreshold: number;
  
  // API
  apiKey?: string;
}

/**
 * Default memory configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  embeddingModel: 'openai/text-embedding-3-small',
  embeddingDimensions: 1536,
  vectorStoreType: 'chroma',
  storagePath: './memory_data',
  workingMemorySize: 10,
  workingMemoryTTL: 3600000,
  defaultRetrievalLimit: 5,
  similarityThreshold: 0.7,
};

/**
 * Memory storage protocol/interface
 */
export interface MemoryStore {
  store(entry: MemoryEntry): Promise<void>;
  retrieve(query: string, limit?: number): Promise<RetrievalResult>;
  getById(entryId: string): Promise<MemoryEntry | null>;
  listRecent(limit?: number): Promise<MemoryEntry[]>;
  delete(entryId: string): Promise<boolean>;
  count(): Promise<number>;
}

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  isReady(): boolean;
  initialize(): Promise<void>;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  workingMemorySize: number;
  coreMemoryBlocks: number;
  episodicCount: number;
  semanticCount: number;
  totalEntries: number;
  config: Partial<MemoryConfig>;
}

/**
 * Core memory block for persistent agent context
 */
export interface CoreMemoryBlock {
  key: string;
  value: string;
  updatedAt: Date;
  createdAt: Date;
}

/**
 * Create a new memory entry
 */
export function createMemoryEntry(
  content: string,
  memoryType: MemoryType,
  metadata?: Record<string, unknown>
): MemoryEntry {
  return {
    id: crypto.randomUUID(),
    content,
    memoryType,
    timestamp: new Date(),
    metadata: metadata ?? {},
  };
}