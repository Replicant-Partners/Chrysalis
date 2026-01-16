/**
 * Memory Backends Module
 *
 * Pluggable long-term memory backends for Chrysalis.
 *
 * Architecture:
 * - Beads/Fireproof/Nomic = FIXED (our value-add, same for all agents)
 * - Long-term backend = PLUGGABLE (Zep | Letta | Mem0 | Native)
 *
 * @module memory/backends
 */

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
} from './LongTermMemoryBackend';
