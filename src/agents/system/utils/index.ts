/**
 * Shared Utilities for System Agent Middleware
 *
 * Extracted common patterns to reduce code duplication.
 * See plans/SYSTEM_AGENT_MIDDLEWARE_ARCHITECTURE.md Section 7.
 *
 * @module utils
 */

// =============================================================================
// Weighted Random Selection
// =============================================================================

/**
 * Weighted random selection from an array of items with weights.
 *
 * Used by:
 * - IdiomRegistry.selectIdiom()
 * - OpenerSelector.selectOpener()
 *
 * @param items - Array of items with weight property
 * @returns Selected item or null if empty
 */
export function weightedRandomSelect<T extends { weight: number }>(
  items: T[]
): T | null {
  if (items.length === 0) return null;

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return items[0];

  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }

  return items[items.length - 1];
}

// =============================================================================
// Interfaces
// =============================================================================

/**
 * Interface for components that can be cleared/reset
 */
export interface Clearable {
  clear(): void;
}

/**
 * Interface for components that provide metrics
 */
export interface MetricsProvider<T> {
  getMetrics(): T;
  resetMetrics(): void;
}

/**
 * Interface for components with configurable policies
 */
export interface Configurable<T> {
  updateConfig(config: Partial<T>): void;
  getConfig(): T;
}

// =============================================================================
// Usage Tracking
// =============================================================================

/**
 * Cooldown state for usage tracking
 */
export interface CooldownState {
  id: string;
  lastUsedMs: number;
  cooldownMs: number;
  usageCount: number;
}

/**
 * Usage tracker for managing cooldowns and rate limiting.
 *
 * Used by:
 * - TriggerEvaluator (trigger cooldowns)
 * - IdiomRegistry (frequency throttling)
 * - SharedConversationMiddleware (turn budgets)
 */
export class UsageTracker implements Clearable {
  private states: Map<string, CooldownState> = new Map();

  /**
   * Record usage of an item
   */
  recordUsage(id: string, cooldownMs: number = 0): void {
    const existing = this.states.get(id);
    this.states.set(id, {
      id,
      lastUsedMs: Date.now(),
      cooldownMs,
      usageCount: (existing?.usageCount ?? 0) + 1,
    });
  }

  /**
   * Check if an item is available (not in cooldown)
   */
  isAvailable(id: string): boolean {
    const state = this.states.get(id);
    if (!state) return true;

    const elapsed = Date.now() - state.lastUsedMs;
    return elapsed >= state.cooldownMs;
  }

  /**
   * Get remaining cooldown in milliseconds
   */
  getCooldownRemaining(id: string): number {
    const state = this.states.get(id);
    if (!state) return 0;

    const elapsed = Date.now() - state.lastUsedMs;
    return Math.max(0, state.cooldownMs - elapsed);
  }

  /**
   * Get usage count for an item
   */
  getUsageCount(id: string): number {
    return this.states.get(id)?.usageCount ?? 0;
  }

  /**
   * Get usage count within a time window
   */
  getUsageCountInWindow(id: string, windowMs: number): number {
    const state = this.states.get(id);
    if (!state) return 0;

    const elapsed = Date.now() - state.lastUsedMs;
    if (elapsed > windowMs) return 0;

    // Note: This is a simplified version that only tracks the last usage
    // For accurate window counting, use SlidingWindowTracker
    return 1;
  }

  /**
   * Clear all states
   */
  clear(): void {
    this.states.clear();
  }
}

// =============================================================================
// Sliding Window Tracker
// =============================================================================

/**
 * Tracks events within a sliding time window.
 *
 * Used for:
 * - Turn budget enforcement (max messages per 10 min)
 * - Rate limiting
 */
export class SlidingWindowTracker implements Clearable {
  private history: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxEntries: number;

  constructor(options: { windowMs: number; maxEntries?: number }) {
    this.windowMs = options.windowMs;
    this.maxEntries = options.maxEntries ?? 100;
  }

  /**
   * Record an event
   */
  record(id: string): void {
    const now = Date.now();
    const events = this.history.get(id) || [];

    // Clean old entries
    const cutoff = now - this.windowMs;
    const recent = events.filter(t => t > cutoff);
    recent.push(now);

    // Limit history size
    if (recent.length > this.maxEntries) {
      recent.splice(0, recent.length - this.maxEntries);
    }

    this.history.set(id, recent);
  }

  /**
   * Get count of events in window
   */
  getCount(id: string): number {
    const now = Date.now();
    const events = this.history.get(id) || [];
    const cutoff = now - this.windowMs;
    return events.filter(t => t > cutoff).length;
  }

  /**
   * Get the most recent event timestamp
   */
  getLatest(id: string): number | undefined {
    const events = this.history.get(id);
    if (!events || events.length === 0) return undefined;
    return events[events.length - 1];
  }

  /**
   * Check if count exceeds a limit
   */
  isOverLimit(id: string, limit: number): boolean {
    return this.getCount(id) >= limit;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history.clear();
  }
}

// =============================================================================
// TTL Cache
// =============================================================================

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Simple cache with TTL expiration.
 *
 * Used for:
 * - SCM policy caching
 * - Configuration caching
 */
export class TTLCache<K, V> implements Clearable {
  private cache: Map<K, CacheEntry<V>> = new Map();
  private ttlMs: number;
  private maxSize: number;

  constructor(options: { ttlMs: number; maxSize?: number }) {
    this.ttlMs = options.ttlMs;
    this.maxSize = options.maxSize ?? 1000;
  }

  /**
   * Get a value from cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(key: K, value: V, ttlMs?: number): void {
    // Enforce max size
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a key
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldestKey: K | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < oldestTime) {
        oldestTime = entry.expiresAt;
        oldestKey = key;
      }
    }

    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }
}

// =============================================================================
// Time Utilities
// =============================================================================

/**
 * Get time of day category
 */
export function getTimeOfDay(hour?: number): 'morning' | 'afternoon' | 'evening' {
  const h = hour ?? new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

/**
 * Get current month (1-12)
 */
export function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

/**
 * Format milliseconds as human-readable duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

// =============================================================================
// Priority Helpers
// =============================================================================

/**
 * Priority levels with numeric values
 */
export const PRIORITY_VALUES = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

export type PriorityLevel = keyof typeof PRIORITY_VALUES;

/**
 * Compare items by priority (high first)
 */
export function comparePriority(
  a: { priority: PriorityLevel },
  b: { priority: PriorityLevel }
): number {
  return PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority];
}

// =============================================================================
// ID Generation
// =============================================================================

/**
 * Generate a simple unique ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

// =============================================================================
// Deep Merge
// =============================================================================

/**
 * Deep merge two objects
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue as Partial<typeof targetValue>);
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}
