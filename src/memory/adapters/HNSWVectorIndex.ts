import type { VectorIndex, VectorMatch } from '../VectorIndex';

/**
 * HNSW adapter using hnswlib-node (optional dep).
 * If hnswlib-node is not installed, constructor will throw.
 */
export class HNSWVectorIndex implements VectorIndex {
  private index: any;
  private space: any;
  private dim?: number;
  private labelToId: Map<number, string>;
  private idToLabel: Map<string, number>;
  private maxElements: number;
  private efSearch: number;
  private m: number;

  constructor(dim?: number, opts?: { maxElements?: number; efSearch?: number; m?: number }) {
    // Lazy init; index constructed on first upsert when dim known
    this.dim = dim;
    this.labelToId = new Map();
    this.idToLabel = new Map();
    this.maxElements = opts?.maxElements ?? 10000;
    this.efSearch = opts?.efSearch ?? 64;
    this.m = opts?.m ?? 16;
  }

  private async ensureIndex(dim: number): Promise<void> {
    if (this.index) return;
    const hnsw = await import('hnswlib-node');
    this.space = new (hnsw as any).Space('cosine');
    this.index = new (hnsw as any).Hnswlib(this.space, dim);
    this.index.initIndex(this.maxElements, this.m);
    this.index.setEf(this.efSearch);
    this.dim = dim;
  }

  async upsert(id: string, vector: number[]): Promise<void> {
    await this.ensureIndex(vector.length);
    const label = this.idToLabel.get(id) ?? this.idToLabel.size;
    this.index.addPoint(vector, label);
    this.idToLabel.set(id, label);
    this.labelToId.set(label, id);
  }

  async findSimilar(vector: number[], topK: number, minScore: number): Promise<VectorMatch[]> {
    if (!this.index) return [];
    const res = this.index.searchKnn(vector, topK);
    const labels: number[] = Array.from(res.neighbors || res.labels || []);
    const distances: number[] = Array.from(res.distances || res.distance || []);
    const matches: VectorMatch[] = [];
    for (let i = 0; i < labels.length; i++) {
      const id = this.labelToId.get(labels[i]);
      if (!id) continue;
      // hnswlib returns distance; for cosine space, distance ~ (1 - cosine)
      const score = distances[i] !== undefined ? 1 - distances[i] : 0;
      if (score >= minScore) {
        matches.push({ id, score });
      }
    }
    return matches;
  }

  size(): number {
    return this.idToLabel.size;
  }
}
