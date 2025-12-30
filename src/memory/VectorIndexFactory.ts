import { BruteForceVectorIndex, type VectorIndex } from './VectorIndex';

export type VectorIndexKind = 'hnsw' | 'lance' | 'brute';

/**
 * Create a vector index. Tries HNSW (hnswlib-node) by default,
 * falls back to brute force if dependency is missing.
 */
export async function createVectorIndex(kind: VectorIndexKind = 'hnsw', dim?: number): Promise<VectorIndex> {
  if (kind === 'hnsw') {
    try {
      const { HNSWVectorIndex } = await import('./adapters/HNSWVectorIndex');
      return new HNSWVectorIndex(dim);
    } catch (err) {
      console.warn('[vector-index] hnswlib-node not available, falling back to brute force');
    }
  }

  if (kind === 'lance') {
    try {
      const { LanceDBVectorIndex } = await import('./adapters/LanceDBVectorIndex');
      return new LanceDBVectorIndex(dim);
    } catch (err) {
      console.warn('[vector-index] lancedb not available, falling back to brute force');
    }
  }

  return new BruteForceVectorIndex(dim);
}
