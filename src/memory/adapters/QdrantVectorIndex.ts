import type { VectorIndex, VectorMatch } from '../VectorIndex';

/**
 * Qdrant adapter (cloud/self-hosted).
 * Uses @qdrant/js-client-rest (optional dependency).
 */
export class QdrantVectorIndex implements VectorIndex {
  private client: any;
  private collection: string;
  private dim?: number;

  constructor(opts?: { url?: string; apiKey?: string; collection?: string; dim?: number }) {
    this.collection = opts?.collection || 'memories';
    this.dim = opts?.dim;
    this.client = null;
  }

  private async ensureClient(): Promise<void> {
    if (this.client) return;
    const { QdrantClient } = await import('@qdrant/js-client-rest');
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || undefined,
      apiKey: process.env.QDRANT_API_KEY || undefined,
      ...{}
    });
    await this.ensureCollection();
  }

  private async ensureCollection(): Promise<void> {
    try {
      await this.client.getCollection(this.collection);
    } catch {
      if (!this.dim) {
        throw new Error('Qdrant collection missing and dimension unknown');
      }
      await this.client.createCollection(this.collection, {
        vectors: { size: this.dim, distance: 'Cosine' }
      });
    }
  }

  async upsert(id: string, vector: number[]): Promise<void> {
    if (!this.dim) this.dim = vector.length;
    await this.ensureClient();
    await this.client.upsert(this.collection, {
      points: [{ id, vector }]
    });
  }

  async findSimilar(vector: number[], topK: number, minScore: number): Promise<VectorMatch[]> {
    await this.ensureClient();
    const res = await this.client.search(this.collection, {
      vector,
      limit: topK,
      score_threshold: minScore
    });
    return res.map((r: any) => ({ id: String(r.id), score: r.score }));
  }

  size(): number {
    // Qdrant count is async; return 0 to keep interface simple
    return 0;
  }
}
