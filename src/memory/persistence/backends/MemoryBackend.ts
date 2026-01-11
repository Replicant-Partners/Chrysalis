/**
 * In-Memory Vector Backend with Optional Persistence
 * 
 * Fast in-memory storage with optional snapshot persistence.
 * Suitable for development and small-scale deployments.
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import {
  VectorPersistenceBackend,
  VectorRecord,
  VectorSearchResult,
  VectorSearchOptions,
  BatchResult,
  StorageStats,
  PersistenceConfig,
} from '../VectorPersistence';

/**
 * In-memory vector storage with optional file persistence
 */
export class MemoryBackend implements VectorPersistenceBackend {
  readonly name = 'memory';
  
  private records: Map<string, VectorRecord> = new Map();
  private namespaces: Set<string> = new Set();
  private dimension?: number;
  private config: PersistenceConfig;
  private ready = false;
  private autoSaveTimer?: NodeJS.Timeout;
  private dirty = false;

  constructor(config: PersistenceConfig) {
    this.config = config;
    this.dimension = config.dimension;
  }

  async initialize(): Promise<void> {
    // Load from file if path specified and exists
    if (this.config.path) {
      const snapshotPath = this.getSnapshotPath();
      if (existsSync(snapshotPath)) {
        await this.loadSnapshot(snapshotPath);
      }
      
      // Set up auto-save
      if (this.config.autoSaveInterval && this.config.autoSaveInterval > 0) {
        this.autoSaveTimer = setInterval(() => {
          if (this.dirty) {
            this.saveSnapshot(snapshotPath).catch(console.error);
          }
        }, this.config.autoSaveInterval);
      }
    }
    
    this.ready = true;
  }

  async close(): Promise<void> {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    // Final save
    if (this.config.path && this.dirty) {
      await this.saveSnapshot(this.getSnapshotPath());
    }
    
    this.ready = false;
  }

  isReady(): boolean {
    return this.ready;
  }

  // CRUD Operations

  async insert(record: Omit<VectorRecord, 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date().toISOString();
    const fullRecord: VectorRecord = {
      ...record,
      createdAt: now,
      updatedAt: now,
    };

    if (!this.dimension) {
      this.dimension = record.vector.length;
    } else if (record.vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimension}, got ${record.vector.length}`);
    }

    this.records.set(record.id, fullRecord);
    if (record.namespace) {
      this.namespaces.add(record.namespace);
    }
    
    this.dirty = true;
    return record.id;
  }

  async insertBatch(records: Array<Omit<VectorRecord, 'createdAt' | 'updatedAt'>>): Promise<BatchResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const record of records) {
      try {
        await this.insert(record);
        success++;
      } catch (err) {
        failed++;
        errors.push({ id: record.id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return { success, failed, errors: errors.length > 0 ? errors : undefined };
  }

  async update(id: string, updates: Partial<Omit<VectorRecord, 'id' | 'createdAt'>>): Promise<boolean> {
    const existing = this.records.get(id);
    if (!existing) return false;

    const updated: VectorRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    if (updates.vector && updates.vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimension}, got ${updates.vector.length}`);
    }

    this.records.set(id, updated);
    this.dirty = true;
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.records.delete(id);
    if (deleted) this.dirty = true;
    return deleted;
  }

  async deleteBatch(ids: string[]): Promise<BatchResult> {
    let success = 0;
    let failed = 0;

    for (const id of ids) {
      if (this.records.delete(id)) {
        success++;
      } else {
        failed++;
      }
    }

    if (success > 0) this.dirty = true;
    return { success, failed };
  }

  async get(id: string): Promise<VectorRecord | null> {
    return this.records.get(id) || null;
  }

  async getBatch(ids: string[]): Promise<VectorRecord[]> {
    const results: VectorRecord[] = [];
    for (const id of ids) {
      const record = this.records.get(id);
      if (record) results.push(record);
    }
    return results;
  }

  async exists(id: string): Promise<boolean> {
    return this.records.has(id);
  }

  // Search Operations

  async search(vector: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
    const {
      topK = 10,
      minScore = 0,
      namespace,
      filter,
      includeVectors = false,
      includeMetadata = true,
    } = options;

    const results: VectorSearchResult[] = [];

    for (const record of this.records.values()) {
      // Filter by namespace
      if (namespace && record.namespace !== namespace) continue;

      // Filter by metadata
      if (filter && !this.matchesFilter(record.metadata, filter)) continue;

      // Calculate similarity
      const score = this.cosineSimilarity(vector, record.vector);
      if (score < minScore) continue;

      results.push({
        id: record.id,
        score,
        vector: includeVectors ? record.vector : undefined,
        metadata: includeMetadata ? record.metadata : undefined,
        content: record.content,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  async searchByMetadata(filter: Record<string, unknown>, options: VectorSearchOptions = {}): Promise<VectorRecord[]> {
    const { namespace } = options;
    const results: VectorRecord[] = [];

    for (const record of this.records.values()) {
      if (namespace && record.namespace !== namespace) continue;
      if (this.matchesFilter(record.metadata, filter)) {
        results.push(record);
      }
    }

    return results;
  }

  // Namespace Operations

  async listNamespaces(): Promise<string[]> {
    return Array.from(this.namespaces);
  }

  async deleteNamespace(namespace: string): Promise<number> {
    let deleted = 0;
    for (const [id, record] of this.records) {
      if (record.namespace === namespace) {
        this.records.delete(id);
        deleted++;
      }
    }
    this.namespaces.delete(namespace);
    if (deleted > 0) this.dirty = true;
    return deleted;
  }

  // Maintenance Operations

  async getStats(): Promise<StorageStats> {
    // Estimate size
    let sizeBytes = 0;
    for (const record of this.records.values()) {
      sizeBytes += record.vector.length * 8; // 64-bit floats
      sizeBytes += JSON.stringify(record.metadata || {}).length;
      sizeBytes += (record.content || '').length;
    }

    return {
      totalRecords: this.records.size,
      totalNamespaces: this.namespaces.size,
      dimensionality: this.dimension || 0,
      sizeBytes,
      lastModified: this.dirty ? new Date().toISOString() : undefined,
    };
  }

  async optimize(): Promise<void> {
    // Rebuild namespace set
    this.namespaces.clear();
    for (const record of this.records.values()) {
      if (record.namespace) {
        this.namespaces.add(record.namespace);
      }
    }
  }

  async backup(path: string): Promise<void> {
    await this.saveSnapshot(path);
  }

  async restore(path: string): Promise<void> {
    await this.loadSnapshot(path);
  }

  // Private Methods

  private getSnapshotPath(): string {
    return join(this.config.path || './data', `${this.config.collection || 'vectors'}.json`);
  }

  private async saveSnapshot(path: string): Promise<void> {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const data = {
      version: '1.0.0',
      dimension: this.dimension,
      namespaces: Array.from(this.namespaces),
      records: Array.from(this.records.values()),
      savedAt: new Date().toISOString(),
    };

    const content = this.config.compression
      ? JSON.stringify(data)
      : JSON.stringify(data, null, 2);

    await writeFile(path, content, 'utf-8');
    this.dirty = false;
  }

  private async loadSnapshot(path: string): Promise<void> {
    const content = await readFile(path, 'utf-8');
    const data = JSON.parse(content);

    this.dimension = data.dimension;
    this.namespaces = new Set(data.namespaces || []);
    this.records.clear();

    for (const record of data.records || []) {
      this.records.set(record.id, record);
    }

    this.dirty = false;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private matchesFilter(metadata: Record<string, unknown> | undefined, filter: Record<string, unknown>): boolean {
    if (!metadata) return Object.keys(filter).length === 0;

    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) return false;
    }

    return true;
  }
}
