/**
 * Working Memory - Recent Context Buffer
 * 
 * Short-term memory holding the most recent conversational context.
 * Implements a bounded buffer with automatic eviction of older entries.
 * 
 * Cognitive analogue: Baddeley's working memory model
 * 
 * @module memory/WorkingMemory
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item C-2
 * @see Baddeley, A.D. (2000). The episodic buffer: a new component of working memory?
 */

import { 
  MemoryEntry, 
  MemoryConfig, 
  DEFAULT_MEMORY_CONFIG,
  createMemoryEntry 
} from './types';
import { trace, getMetrics } from '../observability';

/**
 * Working Memory Configuration
 */
export interface WorkingMemoryConfig {
  maxSize: number;
  evictionPolicy: 'fifo' | 'lru';
}

const DEFAULT_WORKING_CONFIG: WorkingMemoryConfig = {
  maxSize: DEFAULT_MEMORY_CONFIG.workingMemorySize,
  evictionPolicy: 'fifo',
};

/**
 * Working Memory - Bounded recent context buffer
 * 
 * Holds the most recent interactions for immediate context.
 * Analogous to human working memory capacity limits.
 */
export class WorkingMemory {
  private buffer: MemoryEntry[] = [];
  private config: WorkingMemoryConfig;
  private accessCounts: Map<string, number> = new Map();

  constructor(config?: Partial<WorkingMemoryConfig>) {
    this.config = { ...DEFAULT_WORKING_CONFIG, ...config };
  }

  /**
   * Add entry to working memory
   * Evicts oldest entry if at capacity
   */
  add(content: string, metadata?: Record<string, unknown>): MemoryEntry {
    const entry = createMemoryEntry(content, 'working', metadata);
    
    // Evict if at capacity
    if (this.buffer.length >= this.config.maxSize) {
      this.evict();
    }
    
    this.buffer.push(entry);
    this.accessCounts.set(entry.id, 1);
    
    // Record metric
    getMetrics().memoryOperations.add(1, { 
      operation: 'add', 
      memory_type: 'working' 
    });
    
    return entry;
  }

  /**
   * Get all working memory entries
   */
  getAll(): MemoryEntry[] {
    return [...this.buffer];
  }

  /**
   * Get most recent N entries
   */
  getRecent(n: number): MemoryEntry[] {
    const start = Math.max(0, this.buffer.length - n);
    return this.buffer.slice(start).map(entry => {
      // Update access count for LRU
      const count = this.accessCounts.get(entry.id) ?? 0;
      this.accessCounts.set(entry.id, count + 1);
      return entry;
    });
  }

  /**
   * Get entry by ID
   */
  getById(id: string): MemoryEntry | null {
    const entry = this.buffer.find(e => e.id === id);
    if (entry) {
      const count = this.accessCounts.get(entry.id) ?? 0;
      this.accessCounts.set(entry.id, count + 1);
    }
    return entry ?? null;
  }

  /**
   * Clear all working memory
   */
  clear(): void {
    this.buffer = [];
    this.accessCounts.clear();
    
    getMetrics().memoryOperations.add(1, { 
      operation: 'clear', 
      memory_type: 'working' 
    });
  }

  /**
   * Get current size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Check if empty
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Format working memory for LLM context
   */
  toContextString(): string {
    if (this.isEmpty()) {
      return '';
    }

    const lines = ['=== Recent Context ==='];
    for (const entry of this.getRecent(5)) {
      lines.push(`- ${entry.content}`);
    }
    return lines.join('\n');
  }

  /**
   * Evict entry based on policy
   */
  private evict(): void {
    if (this.buffer.length === 0) return;

    if (this.config.evictionPolicy === 'lru') {
      // Find least recently used
      let minAccess = Infinity;
      let lruIndex = 0;
      
      for (let i = 0; i < this.buffer.length; i++) {
        const count = this.accessCounts.get(this.buffer[i].id) ?? 0;
        if (count < minAccess) {
          minAccess = count;
          lruIndex = i;
        }
      }
      
      const evicted = this.buffer.splice(lruIndex, 1)[0];
      this.accessCounts.delete(evicted.id);
    } else {
      // FIFO - remove oldest
      const evicted = this.buffer.shift();
      if (evicted) {
        this.accessCounts.delete(evicted.id);
      }
    }
  }
}