/**
 * Vector index abstraction with a simple brute-force default.
 * 
 * Designed so we can swap in HNSW/LanceDB without changing callers.
 */

export interface VectorMatch {
  id: string;
  score: number;
  vector?: number[];
}

export interface VectorIndex {
  upsert(id: string, vector: number[]): Promise<void>;
  findSimilar(vector: number[], topK: number, minScore: number): Promise<VectorMatch[]>;
  size(): number;
}

/**
 * Brute-force cosine index. Keeps everything in memory.
 * Acts as a compatibility layer until HNSW/LanceDB is plugged in.
 */
export class BruteForceVectorIndex implements VectorIndex {
  private dim?: number;
  private readonly store: Map<string, number[]>;

  constructor(dim?: number) {
    this.dim = dim;
    this.store = new Map();
  }

  async upsert(id: string, vector: number[]): Promise<void> {
    if (!this.dim) {
      this.dim = vector.length;
    }
    if (vector.length !== this.dim) {
      throw new Error(`Vector dimension mismatch: expected ${this.dim}, got ${vector.length}`);
    }
    this.store.set(id, vector);
  }

  async findSimilar(vector: number[], topK: number, minScore: number): Promise<VectorMatch[]> {
    const matches: VectorMatch[] = [];
    for (const [id, stored] of this.store) {
      const score = this.cosine(vector, stored);
      if (score >= minScore) {
        matches.push({ id, score, vector: stored });
      }
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, topK);
  }

  size(): number {
    return this.store.size;
  }

  private cosine(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Cosine input mismatch: ${a.length} vs ${b.length}`);
    }
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }
}
