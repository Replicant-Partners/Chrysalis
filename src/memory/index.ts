/**
 * Memory Module
 * 
 * Chrysalis memory system with tiered memory architecture:
 * - Working: Short-term session context
 * - Episodic: Past experiences and events
 * - Semantic: Facts and knowledge
 * - Procedural: Skills and learned procedures
 * 
 * @module memory
 */

// Core adapter - import for local use, then re-export
import { MemUAdapter } from './MemUAdapter';
export { MemUAdapter };

// Embedding providers
export {
  createEmbeddingProvider,
  OpenAIEmbeddingProvider,
  OllamaEmbeddingProvider,
  MockEmbeddingProvider,
  PythonEmbeddingBridge,
  type EmbeddingProvider
} from './EmbeddingBridge';

// Types
export type {
  // Core types
  MemoryType,
  MemorySource,
  MemoryTier,
  
  // Pattern types
  MemoryFingerprint,
  MemorySignature,
  LogicalTime,
  GossipMetadata,
  ByzantineValidation,
  CRDTMetadata,
  MemoryCausality,
  ConvergenceMetadata,
  
  // Memory types
  BaseMemory,
  WorkingMemory,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  Memory,
  
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

/**
 * Factory to create a memory adapter for an agent
 */
export function createMemoryAdapter(
  agentId: string,
  options?: {
    embeddingProvider?: 'openai' | 'ollama' | 'mock' | 'python-bridge';
    embeddingOptions?: Record<string, unknown>;
    memoryConfig?: Partial<import('./types').MemoryConfig>;
  }
): InstanceType<typeof MemUAdapter> {
  const { MemUAdapter: MemUAdapterClass } = require('./MemUAdapter');
  const { createEmbeddingProvider } = require('./EmbeddingBridge');
  
  const embeddingProvider = options?.embeddingProvider 
    ? createEmbeddingProvider(options.embeddingProvider, options.embeddingOptions)
    : undefined;
  
  return new MemUAdapterClass(agentId, options?.memoryConfig, embeddingProvider);
}