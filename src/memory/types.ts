export type MemoryItemType = 'skill' | 'knowledge_claim';

export interface MemoryItem {
  id: string;
  type: MemoryItemType;
  embedding: number[];
  payload: Record<string, any>;
  createdAt: string;
}
