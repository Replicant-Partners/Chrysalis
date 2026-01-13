/**
 * Core Memory - Persistent Agent Context
 * 
 * Long-term structured memory blocks that persist across sessions.
 * Stores agent identity, user facts, and fundamental knowledge.
 * 
 * Cognitive analogue: Autobiographical memory / self-concept
 * 
 * @module memory/CoreMemory
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item C-2
 * @see Conway, M.A. (2005). Memory and the self. Journal of Memory and Language
 */

import { CoreMemoryBlock } from './types';
import { getMetrics } from '../observability';

/**
 * Core Memory Configuration
 */
export interface CoreMemoryConfig {
  maxBlockSize: number;  // Max characters per block
  allowedBlocks: string[];  // Whitelist of allowed block names
}

const DEFAULT_CORE_CONFIG: CoreMemoryConfig = {
  maxBlockSize: 10000,
  allowedBlocks: ['persona', 'user_facts', 'system_prompt', 'knowledge_base'],
};

/**
 * Standard core memory block names
 */
export const CORE_MEMORY_BLOCKS = {
  PERSONA: 'persona',
  USER_FACTS: 'user_facts',
  SYSTEM_PROMPT: 'system_prompt',
  KNOWLEDGE_BASE: 'knowledge_base',
} as const;

/**
 * Core Memory - Persistent structured blocks
 * 
 * Stores fundamental agent context that persists across sessions.
 * Think of it as the agent's "sense of self" and learned user preferences.
 */
export class CoreMemory {
  private blocks: Map<string, CoreMemoryBlock> = new Map();
  private config: CoreMemoryConfig;

  constructor(config?: Partial<CoreMemoryConfig>) {
    this.config = { ...DEFAULT_CORE_CONFIG, ...config };
  }

  /**
   * Set a core memory block
   */
  set(key: string, value: string): boolean {
    // Validate block name if whitelist is enforced
    if (this.config.allowedBlocks.length > 0 && 
        !this.config.allowedBlocks.includes(key)) {
      console.warn(`[CoreMemory] Block '${key}' not in allowed list`);
      return false;
    }

    // Validate size
    if (value.length > this.config.maxBlockSize) {
      console.warn(`[CoreMemory] Block '${key}' exceeds max size ${this.config.maxBlockSize}`);
      return false;
    }

    const existing = this.blocks.get(key);
    const now = new Date();

    const block: CoreMemoryBlock = {
      key,
      value,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now,
    };

    this.blocks.set(key, block);

    getMetrics().memoryOperations.add(1, {
      operation: 'set',
      memory_type: 'core',
    });

    return true;
  }

  /**
   * Get a core memory block value
   */
  get(key: string): string | null {
    const block = this.blocks.get(key);
    return block?.value ?? null;
  }

  /**
   * Get full block with metadata
   */
  getBlock(key: string): CoreMemoryBlock | null {
    return this.blocks.get(key) ?? null;
  }

  /**
   * Get all blocks
   */
  getAll(): Map<string, CoreMemoryBlock> {
    return new Map(this.blocks);
  }

  /**
   * Get all values as plain object
   */
  toObject(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, block] of this.blocks) {
      result[key] = block.value;
    }
    return result;
  }

  /**
   * Update existing block (must exist)
   */
  update(key: string, value: string): boolean {
    if (!this.blocks.has(key)) {
      return false;
    }
    return this.set(key, value);
  }

  /**
   * Append to existing block
   */
  append(key: string, value: string, separator: string = '\n'): boolean {
    const existing = this.get(key);
    if (existing === null) {
      return this.set(key, value);
    }
    return this.set(key, existing + separator + value);
  }

  /**
   * Delete a block
   */
  delete(key: string): boolean {
    const deleted = this.blocks.delete(key);
    
    if (deleted) {
      getMetrics().memoryOperations.add(1, {
        operation: 'delete',
        memory_type: 'core',
      });
    }
    
    return deleted;
  }

  /**
   * Check if block exists
   */
  has(key: string): boolean {
    return this.blocks.has(key);
  }

  /**
   * Get number of blocks
   */
  size(): number {
    return this.blocks.size;
  }

  /**
   * Clear all blocks
   */
  clear(): void {
    this.blocks.clear();
    
    getMetrics().memoryOperations.add(1, {
      operation: 'clear',
      memory_type: 'core',
    });
  }

  /**
   * Format core memory for LLM context
   */
  toContextString(): string {
    if (this.blocks.size === 0) {
      return '';
    }

    const lines = ['=== Core Memory ==='];
    for (const [key, block] of this.blocks) {
      lines.push(`${key}: ${block.value}`);
    }
    return lines.join('\n');
  }

  /**
   * Load from JSON
   */
  loadFromJSON(data: Record<string, string>): void {
    for (const [key, value] of Object.entries(data)) {
      this.set(key, value);
    }
  }

  /**
   * Export to JSON
   */
  toJSON(): Record<string, string> {
    return this.toObject();
  }
}