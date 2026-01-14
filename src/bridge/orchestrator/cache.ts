/**
 * Chrysalis Universal Agent Bridge - Cache Management
 *
 * Cache management for translation results.
 *
 * @module bridge/orchestrator/cache
 */

import { EventEmitter } from 'events';
import { AgentFramework, CanonicalAgent, NativeAgent } from '../../adapters/base-adapter';

/**
 * Cache entry
 */
export interface CacheEntry {
  canonical: CanonicalAgent;
  translations: Map<AgentFramework, NativeAgent>;
  timestamp: Date;
  hits: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  cacheTTLMs: number;
  maxCacheEntries: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number;
  hits: number;
  entries: string[];
}

/**
 * Manages translation caching for the Bridge Orchestrator
 */
export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private emitter?: EventEmitter;

  constructor(config: CacheConfig, emitter?: EventEmitter) {
    this.config = config;
    this.emitter = emitter;
  }

  /**
   * Generate a cache key from agent content
   */
  generateCacheKey(agent: NativeAgent): string {
    const content = JSON.stringify(agent.data);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `${agent.framework}:${Math.abs(hash).toString(16)}`;
  }

  /**
   * Check if a cache entry is still valid
   */
  isCacheValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp.getTime();
    return age < this.config.cacheTTLMs;
  }

  /**
   * Get a cached entry by key
   */
  get(key: string): CacheEntry | undefined {
    return this.cache.get(key);
  }

  /**
   * Check if cache has an entry for key
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get the current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Update cache with a new translation result
   */
  updateCache(
    key: string,
    canonical: CanonicalAgent,
    targetFramework: AgentFramework,
    result: NativeAgent
  ): void {
    let entry = this.cache.get(key);

    if (!entry) {
      if (this.cache.size >= this.config.maxCacheEntries) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }

      entry = {
        canonical,
        translations: new Map(),
        timestamp: new Date(),
        hits: 0
      };
      this.cache.set(key, entry);
    }

    entry.translations.set(targetFramework, result);
    entry.timestamp = new Date();
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp.getTime() > this.config.cacheTTLMs) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0 && this.emitter) {
      this.emitter.emit('cacheCleanup', { removed: keysToDelete.length });
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    let totalHits = 0;
    const entries: string[] = [];

    for (const [key, entry] of this.cache) {
      totalHits += entry.hits;
      entries.push(key);
    }

    return {
      size: this.cache.size,
      hits: totalHits,
      entries
    };
  }
}
