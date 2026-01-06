import { BruteForceVectorIndex, type VectorIndex } from './VectorIndex';

export type VectorIndexKind = 'hnsw' | 'lance' | 'brute';

export interface VectorIndexOptions {
  collection?: string;
  dim?: number;
  hnsw?: { maxElements?: number; efSearch?: number; m?: number };
  lance?: { path?: string; collection?: string };
}

export interface VectorIndexConfig {
  kind: VectorIndexKind;
  options?: VectorIndexOptions;
}

/**
 * Create a vector index. Tries HNSW (hnswlib-node) by default,
 * falls back to brute force if dependency is missing.
 * 
 * Supported backends:
 * - hnsw: In-memory HNSW index (hnswlib-node)
 * - lance: LanceDB embedded vector database (recommended for persistence)
 * - brute: Brute-force fallback (no dependencies)
 * 
 * Note: Qdrant has been deprecated in favor of LanceDB/ArangoDB.
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

  if (kind === 'lance') {
    try {
      const { LanceDBVectorIndex } = await import('./adapters/LanceDBVectorIndex');
      return new LanceDBVectorIndex(dim, options?.collection || options?.lance?.collection);
    } catch (err) {
      console.warn('[vector-index] lancedb not available, falling back to brute force');
    }
  }

  return new BruteForceVectorIndex(dim);
}

/**
 * Build index config from environment variables.
 */
export function vectorIndexFromEnv(): VectorIndexConfig {
  const envKind = (process.env.VECTOR_INDEX_TYPE || '').toLowerCase();
  const kind: VectorIndexKind =
    envKind === 'hnsw' || envKind === 'lance' || envKind === 'brute'
      ? (envKind as VectorIndexKind)
      : 'hnsw';

  const options: VectorIndexOptions = {
    dim: process.env.VECTOR_DIM ? parseInt(process.env.VECTOR_DIM, 10) : undefined,
    collection: process.env.VECTOR_COLLECTION,
    hnsw: {
      maxElements: process.env.HNSW_MAX_ELEMENTS ? parseInt(process.env.HNSW_MAX_ELEMENTS, 10) : undefined,
      efSearch: process.env.HNSW_EF_SEARCH ? parseInt(process.env.HNSW_EF_SEARCH, 10) : undefined,
      m: process.env.HNSW_M ? parseInt(process.env.HNSW_M, 10) : undefined
    },
    lance: {
      path: process.env.LANCEDB_PATH,
      collection: process.env.LANCEDB_COLLECTION
    }
  };

  return { kind, options };
}
