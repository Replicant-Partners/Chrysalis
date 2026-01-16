import { MemoryItem } from './types';
import { VectorIndex, VectorMatch } from './VectorIndex';

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export interface VectorDBClient {
  insert(item: MemoryItem): Promise<void>;
  search(embedding: number[], k?: number): Promise<MemoryItem[]>;
  getMemory(): MemoryItem[];
}

export class UnifiedMemoryClient {
  private dbClient: VectorDBClient;

  constructor(dbClient?: VectorDBClient) {
    if (!dbClient) {
      throw new NotImplementedError(
        'UnifiedMemoryClient requires a real vector database client. ' +
        'Pass a VectorDBClient implementation (e.g., LanceDBVectorIndex adapter) to the constructor.'
      );
    }
    this.dbClient = dbClient;
  }

  async insert(item: MemoryItem): Promise<void> {
    return this.dbClient.insert(item);
  }

  async search(embedding: number[], k: number = 10): Promise<MemoryItem[]> {
    return this.dbClient.search(embedding, k);
  }

  getMemory(): MemoryItem[] {
    return this.dbClient.getMemory();
  }
}
