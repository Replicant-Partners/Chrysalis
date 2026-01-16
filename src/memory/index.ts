/**
 * Memory Module
 *
 * Chrysalis memory system with tiered memory architecture:
 * - Working: Short-term session context (bounded buffer)
 * - Episodic: Past experiences and events (vector store)
 * - Semantic: Facts and knowledge (vector store)
 * - Core: Persistent agent context (structured blocks)
 *
 * @module memory
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item C-2
 */

// ===========================================================================
// Decomposed Memory Classes (C-2 Implementation)
// ===========================================================================

// Unified Memory Facade
export { Memory, UnifiedMemoryConfig } from './Memory';

// Individual Memory Tiers
export { WorkingMemory, WorkingMemoryConfig } from './WorkingMemory';
export { CoreMemory, CoreMemoryConfig, CORE_MEMORY_BLOCKS } from './CoreMemory';
export { EpisodicMemory, EpisodicMemoryConfig, ContentSanitizer } from './EpisodicMemory';
export { SemanticMemory, SemanticMemoryConfig } from './SemanticMemory';

// Types from new type module
export {
  MemoryEntry,
  MemoryType as DecomposedMemoryType,
  RetrievalResult as DecomposedRetrievalResult,
  MemoryConfig as DecomposedMemoryConfig,
  DEFAULT_MEMORY_CONFIG as DEFAULT_DECOMPOSED_CONFIG,
  MemoryStore,
  EmbeddingProvider as DecomposedEmbeddingProvider,
  MemoryStats,
  CoreMemoryBlock,
  createMemoryEntry,
} from './types';

// ===========================================================================
// Legacy Memory System (for backward compatibility)
// ===========================================================================

// Core adapter - import for local use, then re-export
import { AgentMemoryAdapter } from './AgentMemoryAdapter';
export { AgentMemoryAdapter };

// Embedding providers
export {
  createEmbeddingProvider,
  OpenAIEmbeddingProvider,
  OllamaEmbeddingProvider,
  PythonEmbeddingBridge,
  type EmbeddingProvider
} from './EmbeddingBridge';

// Types
export type {
  // Core types
  MemoryType,
  MemorySource,
  MemoryTier,
  MemoryItem,

  // Pattern types
  MemoryFingerprint,
  MemorySignature,
  LogicalTime,
  GossipMetadata,
  ByzantineValidation,
  CRDTMetadata,
  MemoryCausality,
  ConvergenceMetadata,

  // Memory types (with aliases to avoid class/interface conflicts)
  BaseMemory,
  WorkingMemory as WorkingMemoryData,
  EpisodicMemory as EpisodicMemoryData,
  SemanticMemory as SemanticMemoryData,
  ProceduralMemory,
  Memory as MemoryData,

  // Results and state
  RetrievalResult,
  MemoryState,

  // Configuration
  MemoryConfig,

  // Events
  MemoryEventType,
  MemoryEvent,
  MemoryEventHandler
} from './types';

// Constants
export { DEFAULT_MEMORY_CONFIG } from './types';

// ===========================================================================
// External Memory Adapters
// ===========================================================================

// Letta Memory-First Platform
export {
  LettaMemoryAdapter,
  createLettaAdapter,
  initializeLettaAdapter,
  type LettaAdapterConfig,
  type LettaMemoryBlock,
  type LettaBlockLabel,
  type LettaAgent,
  type LettaMessage,
  type LettaSkill,
} from './adapters/LettaMemoryAdapter';

// Universal Memory Provider (Memory-Agnostic Abstraction)
export {
  UniversalMemoryClient,
  memoryProviderRegistry,
  createUniversalMemoryClient,
  setupMemoryProvider,
  type MemoryProviderType,
  type MemoryOperation,
  type UniversalMemoryEntry,
  type MemorySearchResult,
  type MemoryProviderCapabilities,
  type MemoryProvider,
  type UniversalMemoryConfig,
} from './UniversalMemoryProvider';

// Long-Term Memory Backends (Pluggable)
// 
// Architecture: Beads/Fireproof/Nomic = FIXED, Long-term = PLUGGABLE
// See: docs/research/AGENTIC_MEMORY_FRAMEWORKS_2026-01-16.md
export {
  // Types
  type LongTermBackendType,
  type LongTermMemoryEntry,
  type LongTermSearchResult,
  type LongTermBackendCapabilities,
  type LongTermMemoryBackend,
  type SearchOptions,
  // Backends
  ZepLongTermBackend,
  Mem0LongTermBackend,
  LettaLongTermBackend,
  // Registry & Factory
  longTermBackendRegistry,
  setupLongTermBackend,
  detectAvailableBackend,
} from './backends';

/**
 * Factory to create a memory adapter for an agent
 */
export function createMemoryAdapter(
  agentId: string,
  options?: {
    embeddingProvider?: 'openai' | 'ollama' | 'python-bridge';
    embeddingOptions?: Record<string, unknown>;
    memoryConfig?: Partial<import('./types').MemoryConfig>;
  }
): InstanceType<typeof AgentMemoryAdapter> {
  const { AgentMemoryAdapter: AdapterClass } = require('./AgentMemoryAdapter');
  const { createEmbeddingProvider } = require('./EmbeddingBridge');

  const embeddingProvider = options?.embeddingProvider
    ? createEmbeddingProvider(options.embeddingProvider, options.embeddingOptions)
    : undefined;

  return new AdapterClass(agentId, options?.memoryConfig, embeddingProvider);
}
