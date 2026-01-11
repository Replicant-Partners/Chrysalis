/**
 * Vector Database Persistence Module
 * 
 * Provides persistent vector storage with multiple backend support:
 * - LanceDB (embedded, recommended)
 * - SQLite with vector extension
 * - File-based JSON persistence
 * - In-memory with optional snapshots
 * 
 * @module memory/persistence
 * @version 1.0.0
 */

export * from './VectorPersistence';
export * from './PersistentVectorStore';
export * from './backends/LanceDBBackend';
export * from './backends/SQLiteBackend';
export * from './backends/FileBackend';
export * from './backends/MemoryBackend';
