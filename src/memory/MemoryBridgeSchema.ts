/**
 * Memory Bridge Schema
 * 
 * Defines the canonical contract between TypeScript and Python memory systems.
 * This schema ensures interoperability and type safety across language boundaries.
 * 
 * @module MemoryBridgeSchema
 * @version 1.0.0
 * @status Implemented
 * 
 * Related Python implementation: memory_system/chrysalis_types.py
 * Related TypeScript types: src/memory/types.ts
 */

// =============================================================================
// CORE IDENTITY TYPES
// =============================================================================

/**
 * Agent identity that is consistent across TypeScript and Python.
 * Maps to Python: AgentIdentity in memory_system/identity.py
 */
export interface BridgeAgentIdentity {
  /** Unique agent identifier (UUID v4) */
  agentId: string;
  
  /** Human-readable agent name */
  name: string;
  
  /** Semantic role descriptor */
  role: string;
  
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  
  /** Public key for verification (hex-encoded) */
  publicKey?: string;
  
  /** Capability tokens the agent holds */
  capabilities: string[];
  
  /** Metadata for extensibility */
  metadata: Record<string, unknown>;
}

// =============================================================================
// MEMORY LAYER TYPES
// =============================================================================

/**
 * Memory layer enumeration - must match Python MemoryLayer enum
 */
export enum BridgeMemoryLayer {
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
  PROCEDURAL = 'procedural',
  WORKING = 'working',
  ARCHIVAL = 'archival'
}

/**
 * Memory entry that can be serialized/deserialized between systems.
 * Maps to Python: MemoryEntry in memory_system/chrysalis_types.py
 */
export interface BridgeMemoryEntry {
  /** Unique memory identifier (UUID v4) */
  id: string;
  
  /** Agent that owns this memory */
  agentId: string;
  
  /** Memory layer classification */
  layer: BridgeMemoryLayer;
  
  /** Content of the memory */
  content: string;
  
  /** Embedding vector (float32 array serialized as number[]) */
  embedding?: number[];
  
  /** Embedding model used */
  embeddingModel?: string;
  
  /** Embedding dimension */
  embeddingDimension?: number;
  
  /** Timestamp when memory was created (ISO 8601) */
  timestamp: string;
  
  /** Last access timestamp (ISO 8601) */
  lastAccessed?: string;
  
  /** Access count for decay calculations */
  accessCount: number;
  
  /** Importance score (0.0 - 1.0) */
  importance: number;
  
  /** Decay rate for memory fading */
  decayRate: number;
  
  /** Current activation level (0.0 - 1.0) */
  activation: number;
  
  /** Related memory IDs */
  associations: string[];
  
  /** Semantic tags */
  tags: string[];
  
  /** Source of this memory */
  source?: BridgeMemorySource;
  
  /** Cryptographic hash for integrity verification */
  contentHash?: string;
  
  /** CRDT vector clock for conflict resolution */
  vectorClock?: Record<string, number>;
  
  /** Extensible metadata */
  metadata: Record<string, unknown>;
}

/**
 * Memory source tracking
 */
export interface BridgeMemorySource {
  /** Source type */
  type: 'user_input' | 'llm_response' | 'observation' | 'inference' | 'external';
  
  /** Source identifier (e.g., user ID, model name) */
  sourceId?: string;
  
  /** Confidence in the source (0.0 - 1.0) */
  confidence: number;
  
  /** Verification status */
  verified: boolean;
}

// =============================================================================
// CRDT OPERATIONS
// =============================================================================

/**
 * CRDT operation types for distributed merge
 */
export enum BridgeCRDTOperation {
  SET = 'set',
  DELETE = 'delete',
  INCREMENT = 'increment',
  MERGE = 'merge'
}

/**
 * CRDT delta for synchronization between nodes
 * Maps to Python: CRDTDelta in memory_system/crdt_merge.py
 */
export interface BridgeCRDTDelta {
  /** Operation type */
  operation: BridgeCRDTOperation;
  
  /** Key being modified */
  key: string;
  
  /** Value being set/merged */
  value: unknown;
  
  /** Vector clock at time of operation */
  vectorClock: Record<string, number>;
  
  /** Timestamp of operation (ISO 8601) */
  timestamp: string;
  
  /** Node that originated the operation */
  nodeId: string;
}

/**
 * Conflict resolution strategy
 */
export enum BridgeConflictStrategy {
  /** Last-writer-wins based on timestamp */
  LAST_WRITER_WINS = 'lww',
  
  /** Merge values if possible */
  MERGE = 'merge',
  
  /** Keep both values (for sets) */
  UNION = 'union',
  
  /** Custom resolution function */
  CUSTOM = 'custom',
  
  /** Semantic merge using embeddings */
  SEMANTIC = 'semantic'
}

// =============================================================================
// GOSSIP PROTOCOL
// =============================================================================

/**
 * Gossip message format for cross-system communication
 * Maps to Python: GossipMessage in memory_system/gossip.py
 */
export interface BridgeGossipMessage {
  /** Message type */
  type: 'sync' | 'announce' | 'query' | 'response' | 'heartbeat';
  
  /** Sending node ID */
  senderId: string;
  
  /** Target node ID (optional for broadcast) */
  targetId?: string;
  
  /** Message payload */
  payload: BridgeGossipPayload;
  
  /** Vector clock for causal ordering */
  vectorClock: Record<string, number>;
  
  /** Message timestamp (ISO 8601) */
  timestamp: string;
  
  /** Cryptographic signature */
  signature: string;
  
  /** Time-to-live (hop count) */
  ttl: number;
}

/**
 * Gossip payload types
 */
export type BridgeGossipPayload =
  | BridgeMemorySyncPayload
  | BridgeAgentAnnouncePayload
  | BridgeKnowledgeQueryPayload
  | BridgeKnowledgeResponsePayload
  | BridgeHeartbeatPayload;

export interface BridgeMemorySyncPayload {
  kind: 'memory_sync';
  memories: BridgeMemoryEntry[];
  deltas: BridgeCRDTDelta[];
}

export interface BridgeAgentAnnouncePayload {
  kind: 'agent_announce';
  agent: BridgeAgentIdentity;
  status: 'online' | 'offline' | 'busy';
}

export interface BridgeKnowledgeQueryPayload {
  kind: 'knowledge_query';
  query: string;
  queryEmbedding?: number[];
  filters?: BridgeQueryFilters;
}

export interface BridgeKnowledgeResponsePayload {
  kind: 'knowledge_response';
  queryId: string;
  results: BridgeMemoryEntry[];
  confidence: number;
}

export interface BridgeHeartbeatPayload {
  kind: 'heartbeat';
  load: number;
  memoryCount: number;
}

// =============================================================================
// QUERY INTERFACE
// =============================================================================

/**
 * Unified query filters across systems
 */
export interface BridgeQueryFilters {
  /** Filter by memory layers */
  layers?: BridgeMemoryLayer[];
  
  /** Filter by agent IDs */
  agentIds?: string[];
  
  /** Minimum importance threshold */
  minImportance?: number;
  
  /** Maximum age in seconds */
  maxAge?: number;
  
  /** Required tags (AND) */
  requiredTags?: string[];
  
  /** Any tags (OR) */
  anyTags?: string[];
  
  /** Excluded tags */
  excludeTags?: string[];
  
  /** Minimum activation level */
  minActivation?: number;
  
  /** Text search query */
  textQuery?: string;
  
  /** Embedding for semantic search */
  embedding?: number[];
  
  /** Similarity threshold for semantic search */
  similarityThreshold?: number;
  
  /** Maximum results to return */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
}

/**
 * Query result with scoring information
 */
export interface BridgeQueryResult {
  /** Matched memory entry */
  memory: BridgeMemoryEntry;
  
  /** Relevance score (0.0 - 1.0) */
  score: number;
  
  /** How the score was computed */
  scoreBreakdown: {
    semantic?: number;
    recency?: number;
    importance?: number;
    activation?: number;
  };
  
  /** Highlighted snippets if text search was used */
  highlights?: string[];
}

// =============================================================================
// SERIALIZATION HELPERS
// =============================================================================

/**
 * JSON schema version for compatibility checking
 */
export const BRIDGE_SCHEMA_VERSION = '1.0.0';

/**
 * Validate a memory entry conforms to the bridge schema
 */
export function validateBridgeMemoryEntry(entry: unknown): entry is BridgeMemoryEntry {
  if (!entry || typeof entry !== 'object') return false;
  
  const e = entry as Record<string, unknown>;
  
  return (
    typeof e.id === 'string' &&
    typeof e.agentId === 'string' &&
    typeof e.layer === 'string' &&
    Object.values(BridgeMemoryLayer).includes(e.layer as BridgeMemoryLayer) &&
    typeof e.content === 'string' &&
    typeof e.timestamp === 'string' &&
    typeof e.accessCount === 'number' &&
    typeof e.importance === 'number' &&
    typeof e.decayRate === 'number' &&
    typeof e.activation === 'number' &&
    Array.isArray(e.associations) &&
    Array.isArray(e.tags) &&
    typeof e.metadata === 'object'
  );
}

/**
 * Serialize a memory entry for cross-system transfer
 */
export function serializeBridgeMemoryEntry(entry: BridgeMemoryEntry): string {
  return JSON.stringify({
    _schemaVersion: BRIDGE_SCHEMA_VERSION,
    _type: 'BridgeMemoryEntry',
    ...entry
  });
}

/**
 * Deserialize a memory entry from cross-system transfer
 */
export function deserializeBridgeMemoryEntry(json: string): BridgeMemoryEntry | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed._schemaVersion !== BRIDGE_SCHEMA_VERSION) {
      console.warn(`Schema version mismatch: expected ${BRIDGE_SCHEMA_VERSION}, got ${parsed._schemaVersion}`);
    }
    delete parsed._schemaVersion;
    delete parsed._type;
    
    if (validateBridgeMemoryEntry(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// PYTHON INTEROP UTILITIES
// =============================================================================

/**
 * Convert TypeScript memory entry to Python-compatible format
 */
export function toPythonFormat(entry: BridgeMemoryEntry): Record<string, unknown> {
  return {
    id: entry.id,
    agent_id: entry.agentId,
    layer: entry.layer,
    content: entry.content,
    embedding: entry.embedding,
    embedding_model: entry.embeddingModel,
    embedding_dimension: entry.embeddingDimension,
    timestamp: entry.timestamp,
    last_accessed: entry.lastAccessed,
    access_count: entry.accessCount,
    importance: entry.importance,
    decay_rate: entry.decayRate,
    activation: entry.activation,
    associations: entry.associations,
    tags: entry.tags,
    source: entry.source ? {
      type: entry.source.type,
      source_id: entry.source.sourceId,
      confidence: entry.source.confidence,
      verified: entry.source.verified
    } : null,
    content_hash: entry.contentHash,
    vector_clock: entry.vectorClock,
    metadata: entry.metadata
  };
}

/**
 * Convert Python format to TypeScript memory entry
 */
export function fromPythonFormat(data: Record<string, unknown>): BridgeMemoryEntry | null {
  try {
    const entry: BridgeMemoryEntry = {
      id: data.id as string,
      agentId: data.agent_id as string,
      layer: data.layer as BridgeMemoryLayer,
      content: data.content as string,
      embedding: data.embedding as number[] | undefined,
      embeddingModel: data.embedding_model as string | undefined,
      embeddingDimension: data.embedding_dimension as number | undefined,
      timestamp: data.timestamp as string,
      lastAccessed: data.last_accessed as string | undefined,
      accessCount: data.access_count as number,
      importance: data.importance as number,
      decayRate: data.decay_rate as number,
      activation: data.activation as number,
      associations: data.associations as string[],
      tags: data.tags as string[],
      source: data.source ? {
        type: (data.source as Record<string, unknown>).type as BridgeMemorySource['type'],
        sourceId: (data.source as Record<string, unknown>).source_id as string | undefined,
        confidence: (data.source as Record<string, unknown>).confidence as number,
        verified: (data.source as Record<string, unknown>).verified as boolean
      } : undefined,
      contentHash: data.content_hash as string | undefined,
      vectorClock: data.vector_clock as Record<string, number> | undefined,
      metadata: data.metadata as Record<string, unknown>
    };
    
    if (validateBridgeMemoryEntry(entry)) {
      return entry;
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export default {
  BRIDGE_SCHEMA_VERSION,
  BridgeMemoryLayer,
  BridgeCRDTOperation,
  BridgeConflictStrategy,
  validateBridgeMemoryEntry,
  serializeBridgeMemoryEntry,
  deserializeBridgeMemoryEntry,
  toPythonFormat,
  fromPythonFormat
};
