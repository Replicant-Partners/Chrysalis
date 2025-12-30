import { BruteForceVectorIndex, type VectorIndex } from './VectorIndex';

export type VectorIndexKind = 'hnsw' | 'lance' | 'qdrant' | 'brute';

export interface VectorIndexOptions {
  collection?: string;
  dim?: number;
  hnsw?: { maxElements?: number; efSearch?: number; m?: number };
  qdrant?: { url?: string; apiKey?: string; collection?: string };
}

/**
 * Create a vector index. Tries HNSW (hnswlib-node) by default,
 * falls back to brute force if dependency is missing.
 */
export async function createVectorIndex(kind: VectorIndexKind = 'hnsw', dim?: number, options?: VectorIndexOptions): Promise<VectorIndex> {
  if (kind === 'hnsw') {
    try {
      const { HNSWVectorIndex } = await import('./adapters/HNSWVectorIndex');
      return new HNSWVectorIndex(dim, options?.hnsw);
    } catch (err) {
      console.warn('[vector-index] hnswlib-node not available, falling back to brute force');
    }
  }

  if (kind === 'qdrant') {
    try {
      const { QdrantVectorIndex } = await import('./adapters/QdrantVectorIndex');
      return new QdrantVectorIndex({
        collection: options?.qdrant?.collection || options?.collection || 'memories',
        url: options?.qdrant?.url,
        apiKey: options?.qdrant?.apiKey,
        dim
      });
    } catch (err) {
      console.warn('[vector-index] qdrant client not available, falling back to brute force');
    }
  }

  if (kind === 'lance') {
    try {
      const { LanceDBVectorIndex } = await import('./adapters/LanceDBVectorIndex');
      return new LanceDBVectorIndex(dim, options?.collection);
    } catch (err) {
      console.warn('[vector-index] lancedb not available, falling back to brute force');
    }
  }

  return new BruteForceVectorIndex(dim);
}
