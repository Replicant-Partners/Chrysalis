import type { VectorIndex, VectorMatch } from '../VectorIndex';

/**
 * LanceDB adapter (optional).
 * Requires `lancedb` package; falls back to error if not installed.
 * This is a thin placeholder ready for LanceDB integration.
 */
export class LanceDBVectorIndex implements VectorIndex {
  private db: any;
  private table: any;
  private dim?: number;

  constructor(dim?: number) {
    this.dim = dim;
  }

  private async ensureTable(): Promise<void> {
    if (this.table) return;
    const lance = await import('lancedb');
    this.db = await (lance as any).connect(process.env.LANCEDB_PATH || '.lancedb');
    this.table = await this.db.openTable('memories').catch(async () => {
      return this.db.createTable('memories', [{ id: '', vector: new Array(this.dim || 0) }]);
    });
  }

  async upsert(id: string, vector: number[]): Promise<void> {
    if (!this.dim) this.dim = vector.length;
    await this.ensureTable();
    await this.table.add([{ id, vector }]);
  }

  async findSimilar(vector: number[], topK: number, minScore: number): Promise<VectorMatch[]> {
    if (!this.table) return [];
    const results = await this.table.search(vector).limit(topK).execute();
    const matches: VectorMatch[] = [];
    for (const row of results) {
      const score = row._distance !== undefined ? 1 - row._distance : row.score || 0;
      if (score >= minScore) {
        matches.push({ id: row.id, score });
      }
    }
    return matches;
  }

  size(): number {
    return 0; // LanceDB handles sizing internally
  }
}
