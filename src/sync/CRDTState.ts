// @ts-nocheck
/**
 * CRDT State Management - Conflict-Free Replicated Data Types
 * 
 * Provides conflict-free state management for distributed agent instances
 * using mathematically proven CRDT data structures.
 * 
 * Features:
 * - G-Set (Grow-only Set) for memories
 * - OR-Set (Observed-Remove Set) for metadata
 * - LWW-Register (Last-Writer-Wins) for attributes
 * - LWW-Map for key-value state
 * - Vector clocks for causality tracking
 * - Automatic conflict resolution
 * 
 * @module sync/CRDTState
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { ExperienceEvent, Skill } from '../core/UniformSemanticAgentV2';
import { logger } from '../observability';

// ============================================================================
// Types
// ============================================================================

/**
 * CRDT operation types.
 */
export type CRDTOperation = 
  | { type: 'add'; key: string; value: unknown; timestamp: number; writer: string }
  | { type: 'remove'; key: string; tags: Set<string>; timestamp: number; writer: string }
  | { type: 'set'; key: string; value: unknown; timestamp: number; writer: string };

/**
 * Vector clock for causality tracking.
 */
export interface VectorClock {
  [instanceId: string]: number;
}

/**
 * CRDT metadata attached to values.
 */
export interface CRDTMetadata {
  /** Unique operation ID */
  operationId: string;
  /** Lamport timestamp */
  lamportTime: number;
  /** Vector clock */
  vectorClock: VectorClock;
  /** Writer instance ID */
  writer: string;
  /** Wall clock timestamp */
  timestamp: number;
}

// ============================================================================
// G-Set (Grow-only Set)
// ============================================================================

/**
 * G-Set: Grow-only Set CRDT
 * 
 * Properties:
 * - Elements can only be added, never removed
 * - Merge = union of sets
 * - Commutative, associative, idempotent
 * 
 * Perfect for memories that are never deleted.
 */
export class GSet<T> {
  private elements: Set<T> = new Set();
  private metadata: Map<string, CRDTMetadata> = new Map();

  /**
   * Add element to set.
   */
  add(element: T, meta?: Partial<CRDTMetadata>): void {
    const key = this.getKey(element);
    if (!this.elements.has(element)) {
      this.elements.add(element);
      this.metadata.set(key, {
        operationId: meta?.operationId ?? uuidv4(),
        lamportTime: meta?.lamportTime ?? Date.now(),
        vectorClock: meta?.vectorClock ?? {},
        writer: meta?.writer ?? 'local',
        timestamp: meta?.timestamp ?? Date.now(),
      });
    }
  }

  /**
   * Check if element is in set.
   */
  has(element: T): boolean {
    return this.elements.has(element);
  }

  /**
   * Get all elements.
   */
  values(): Set<T> {
    return new Set(this.elements);
  }

  /**
   * Get element count.
   */
  get size(): number {
    return this.elements.size;
  }

  /**
   * Merge with another G-Set.
   * 
   * CRDT merge: union of sets
   * - merge(A, B) = merge(B, A)  [commutative]
   * - merge(merge(A,B), C) = merge(A, merge(B,C))  [associative]
   * - merge(A, A) = A  [idempotent]
   */
  merge(other: GSet<T>): GSet<T> {
    const result = new GSet<T>();
    
    // Add all from this
    for (const element of this.elements) {
      const key = this.getKey(element);
      result.elements.add(element);
      const meta = this.metadata.get(key);
      if (meta) result.metadata.set(key, { ...meta });
    }
    
    // Add all from other
    for (const element of other.elements) {
      const key = other.getKey(element);
      if (!result.elements.has(element)) {
        result.elements.add(element);
        const meta = other.metadata.get(key);
        if (meta) result.metadata.set(key, { ...meta });
      }
    }
    
    return result;
  }

  /**
   * Get key for element (for metadata tracking).
   */
  private getKey(element: T): string {
    if (typeof element === 'object' && element !== null) {
      return JSON.stringify(element);
    }
    return String(element);
  }

  /**
   * Iterate over elements.
   */
  [Symbol.iterator](): Iterator<T> {
    return this.elements[Symbol.iterator]();
  }
}

// ============================================================================
// OR-Set (Observed-Remove Set)
// ============================================================================

/**
 * OR-Set: Observed-Remove Set CRDT
 * 
 * Properties:
 * - Elements can be added and removed
 * - Each add creates a unique tag
 * - Remove only removes observed tags
 * - Concurrent add and remove: add wins
 */
export class ORSet<T> {
  private elements: Map<string, { value: T; tags: Set<string> }> = new Map();

  /**
   * Add element with unique tag.
   */
  add(element: T, tag?: string): string {
    const key = this.getKey(element);
    const actualTag = tag ?? uuidv4();
    
    if (!this.elements.has(key)) {
      this.elements.set(key, { value: element, tags: new Set() });
    }
    
    this.elements.get(key)!.tags.add(actualTag);
    return actualTag;
  }

  /**
   * Remove element (only observed tags).
   */
  remove(element: T, observedTags: Set<string>): void {
    const key = this.getKey(element);
    const entry = this.elements.get(key);
    
    if (entry) {
      for (const tag of observedTags) {
        entry.tags.delete(tag);
      }
      
      // If no tags left, remove element
      if (entry.tags.size === 0) {
        this.elements.delete(key);
      }
    }
  }

  /**
   * Check if element is in set.
   */
  has(element: T): boolean {
    const key = this.getKey(element);
    return this.elements.has(key);
  }

  /**
   * Get tags for element.
   */
  getTags(element: T): Set<string> {
    const key = this.getKey(element);
    return new Set(this.elements.get(key)?.tags ?? []);
  }

  /**
   * Get all elements.
   */
  values(): Set<T> {
    return new Set(Array.from(this.elements.values()).map(e => e.value));
  }

  /**
   * Get element count.
   */
  get size(): number {
    return this.elements.size;
  }

  /**
   * Merge with another OR-Set.
   */
  merge(other: ORSet<T>): ORSet<T> {
    const result = new ORSet<T>();
    
    // Merge tags from this
    for (const [key, entry] of this.elements) {
      result.elements.set(key, { value: entry.value, tags: new Set(entry.tags) });
    }
    
    // Merge tags from other
    for (const [key, entry] of other.elements) {
      if (result.elements.has(key)) {
        for (const tag of entry.tags) {
          result.elements.get(key)!.tags.add(tag);
        }
      } else {
        result.elements.set(key, { value: entry.value, tags: new Set(entry.tags) });
      }
    }
    
    return result;
  }

  private getKey(element: T): string {
    if (typeof element === 'object' && element !== null) {
      return JSON.stringify(element);
    }
    return String(element);
  }
}

// ============================================================================
// LWW-Register (Last-Writer-Wins Register)
// ============================================================================

/**
 * LWW-Register: Last-Writer-Wins Register CRDT
 * 
 * Properties:
 * - Single value with timestamp
 * - Merge keeps value with highest timestamp
 * - Tie-breaking by writer ID (deterministic)
 */
export class LWWRegister<T> {
  private _value: T | undefined;
  private _timestamp: number = 0;
  private _writer: string = '';

  constructor(value?: T, timestamp?: number, writer?: string) {
    this._value = value;
    this._timestamp = timestamp ?? 0;
    this._writer = writer ?? '';
  }

  /**
   * Set value with timestamp.
   */
  set(value: T, timestamp: number, writer: string): void {
    if (timestamp > this._timestamp || 
        (timestamp === this._timestamp && writer > this._writer)) {
      this._value = value;
      this._timestamp = timestamp;
      this._writer = writer;
    }
  }

  /**
   * Get current value.
   */
  get value(): T | undefined {
    return this._value;
  }

  /**
   * Get timestamp.
   */
  get timestamp(): number {
    return this._timestamp;
  }

  /**
   * Get writer.
   */
  get writer(): string {
    return this._writer;
  }

  /**
   * Merge with another LWW-Register.
   */
  merge(other: LWWRegister<T>): LWWRegister<T> {
    const result = new LWWRegister<T>();
    
    if (this._timestamp > other._timestamp) {
      result._value = this._value;
      result._timestamp = this._timestamp;
      result._writer = this._writer;
    } else if (other._timestamp > this._timestamp) {
      result._value = other._value;
      result._timestamp = other._timestamp;
      result._writer = other._writer;
    } else {
      // Tie: use writer ID for deterministic resolution
      if (this._writer >= other._writer) {
        result._value = this._value;
        result._timestamp = this._timestamp;
        result._writer = this._writer;
      } else {
        result._value = other._value;
        result._timestamp = other._timestamp;
        result._writer = other._writer;
      }
    }
    
    return result;
  }
}

// ============================================================================
// LWW-Map (Last-Writer-Wins Map)
// ============================================================================

/**
 * LWW-Map: Last-Writer-Wins Map CRDT
 * 
 * A map where each key is an LWW-Register.
 */
export class LWWMap<K extends string, V> {
  private registers: Map<K, LWWRegister<V>> = new Map();

  /**
   * Set value for key.
   */
  set(key: K, value: V, timestamp: number, writer: string): void {
    if (!this.registers.has(key)) {
      this.registers.set(key, new LWWRegister<V>());
    }
    this.registers.get(key)!.set(value, timestamp, writer);
  }

  /**
   * Get value for key.
   */
  get(key: K): V | undefined {
    return this.registers.get(key)?.value;
  }

  /**
   * Check if key exists.
   */
  has(key: K): boolean {
    return this.registers.has(key) && this.registers.get(key)!.value !== undefined;
  }

  /**
   * Get all keys.
   */
  keys(): K[] {
    return Array.from(this.registers.keys());
  }

  /**
   * Get all entries.
   */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    for (const [key, register] of this.registers) {
      if (register.value !== undefined) {
        result.push([key, register.value]);
      }
    }
    return result;
  }

  /**
   * Merge with another LWW-Map.
   */
  merge(other: LWWMap<K, V>): LWWMap<K, V> {
    const result = new LWWMap<K, V>();
    
    // Merge all keys from this
    for (const [key, register] of this.registers) {
      result.registers.set(key, new LWWRegister(register.value, register.timestamp, register.writer));
    }
    
    // Merge all keys from other
    for (const [key, register] of other.registers) {
      if (result.registers.has(key)) {
        result.registers.set(key, result.registers.get(key)!.merge(register));
      } else {
        result.registers.set(key, new LWWRegister(register.value, register.timestamp, register.writer));
      }
    }
    
    return result;
  }
}

// ============================================================================
// Vector Clock
// ============================================================================

/**
 * Vector clock operations for causality tracking.
 */
export class VectorClockOps {
  /**
   * Increment clock for instance.
   */
  static increment(clock: VectorClock, instanceId: string): VectorClock {
    return {
      ...clock,
      [instanceId]: (clock[instanceId] ?? 0) + 1,
    };
  }

  /**
   * Merge two vector clocks (element-wise max).
   */
  static merge(clock1: VectorClock, clock2: VectorClock): VectorClock {
    const result: VectorClock = { ...clock1 };
    
    for (const [instanceId, time] of Object.entries(clock2)) {
      result[instanceId] = Math.max(result[instanceId] ?? 0, time);
    }
    
    return result;
  }

  /**
   * Compare two vector clocks.
   * Returns:
   * - 'before' if clock1 happened before clock2
   * - 'after' if clock1 happened after clock2
   * - 'concurrent' if neither happened before the other
   * - 'equal' if clocks are identical
   */
  static compare(clock1: VectorClock, clock2: VectorClock): 'before' | 'after' | 'concurrent' | 'equal' {
    let before = false;
    let after = false;
    
    const allKeys = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);
    
    for (const key of allKeys) {
      const t1 = clock1[key] ?? 0;
      const t2 = clock2[key] ?? 0;
      
      if (t1 < t2) before = true;
      if (t1 > t2) after = true;
    }
    
    if (before && after) return 'concurrent';
    if (before) return 'before';
    if (after) return 'after';
    return 'equal';
  }

  /**
   * Check if clock1 happened before clock2.
   */
  static happenedBefore(clock1: VectorClock, clock2: VectorClock): boolean {
    return this.compare(clock1, clock2) === 'before';
  }
}

// ============================================================================
// CRDT State Manager
// ============================================================================

/**
 * CRDT State Manager for agent state.
 * 
 * Manages distributed state using CRDT data structures for
 * conflict-free synchronization.
 */
export class CRDTStateManager extends EventEmitter {
  private instanceId: string;
  private lamportClock: number = 0;
  private vectorClock: VectorClock = {};
  
  // CRDT collections
  private memories: GSet<string> = new GSet();
  private skills: LWWMap<string, Skill> = new LWWMap();
  private knowledge: GSet<string> = new GSet();
  private metadata: LWWMap<string, unknown> = new LWWMap();
  private tags: ORSet<string> = new ORSet();
  
  private log = logger('crdt-state');

  constructor(instanceId: string) {
    super();
    this.instanceId = instanceId;
    this.vectorClock[instanceId] = 0;
    this.log.info('CRDTStateManager initialized', { instanceId });
  }

  // ==========================================================================
  // Clock Operations
  // ==========================================================================

  /**
   * Increment local clock.
   */
  tick(): number {
    this.lamportClock++;
    this.vectorClock = VectorClockOps.increment(this.vectorClock, this.instanceId);
    return this.lamportClock;
  }

  /**
   * Update clock from received message.
   */
  updateClock(remoteLamport: number, remoteVector: VectorClock): void {
    this.lamportClock = Math.max(this.lamportClock, remoteLamport) + 1;
    this.vectorClock = VectorClockOps.merge(this.vectorClock, remoteVector);
    this.vectorClock = VectorClockOps.increment(this.vectorClock, this.instanceId);
  }

  /**
   * Get current clocks.
   */
  getClocks(): { lamport: number; vector: VectorClock } {
    return {
      lamport: this.lamportClock,
      vector: { ...this.vectorClock },
    };
  }

  // ==========================================================================
  // Memory Operations
  // ==========================================================================

  /**
   * Add memory (G-Set semantics).
   */
  addMemory(memoryId: string): void {
    this.tick();
    this.memories.add(memoryId, {
      lamportTime: this.lamportClock,
      vectorClock: { ...this.vectorClock },
      writer: this.instanceId,
      timestamp: Date.now(),
    });
    this.emit('memory:added', { memoryId });
  }

  /**
   * Check if memory exists.
   */
  hasMemory(memoryId: string): boolean {
    return this.memories.has(memoryId);
  }

  /**
   * Get all memory IDs.
   */
  getMemoryIds(): Set<string> {
    return this.memories.values();
  }

  // ==========================================================================
  // Skill Operations
  // ==========================================================================

  /**
   * Update skill (LWW semantics).
   */
  updateSkill(skillId: string, skill: Skill): void {
    this.tick();
    this.skills.set(skillId, skill, this.lamportClock, this.instanceId);
    this.emit('skill:updated', { skillId, skill });
  }

  /**
   * Get skill.
   */
  getSkill(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Get all skills.
   */
  getAllSkills(): Map<string, Skill> {
    const result = new Map<string, Skill>();
    for (const [key, value] of this.skills.entries()) {
      result.set(key, value);
    }
    return result;
  }

  // ==========================================================================
  // Knowledge Operations
  // ==========================================================================

  /**
   * Add knowledge (G-Set semantics).
   */
  addKnowledge(knowledgeId: string): void {
    this.tick();
    this.knowledge.add(knowledgeId, {
      lamportTime: this.lamportClock,
      vectorClock: { ...this.vectorClock },
      writer: this.instanceId,
      timestamp: Date.now(),
    });
    this.emit('knowledge:added', { knowledgeId });
  }

  /**
   * Get all knowledge IDs.
   */
  getKnowledgeIds(): Set<string> {
    return this.knowledge.values();
  }

  // ==========================================================================
  // Tag Operations
  // ==========================================================================

  /**
   * Add tag (OR-Set semantics).
   */
  addTag(tag: string): string {
    this.tick();
    const tagId = this.tags.add(tag);
    this.emit('tag:added', { tag, tagId });
    return tagId;
  }

  /**
   * Remove tag.
   */
  removeTag(tag: string, observedTags: Set<string>): void {
    this.tick();
    this.tags.remove(tag, observedTags);
    this.emit('tag:removed', { tag });
  }

  /**
   * Get all tags.
   */
  getTags(): Set<string> {
    return this.tags.values();
  }

  // ==========================================================================
  // Metadata Operations
  // ==========================================================================

  /**
   * Set metadata value.
   */
  setMetadata(key: string, value: unknown): void {
    this.tick();
    this.metadata.set(key, value, this.lamportClock, this.instanceId);
    this.emit('metadata:updated', { key, value });
  }

  /**
   * Get metadata value.
   */
  getMetadata(key: string): unknown {
    return this.metadata.get(key);
  }

  // ==========================================================================
  // Merge Operations
  // ==========================================================================

  /**
   * Merge with another state manager.
   */
  merge(other: CRDTStateManager): CRDTStateManager {
    const result = new CRDTStateManager(this.instanceId);
    
    // Merge clocks
    result.lamportClock = Math.max(this.lamportClock, other.lamportClock);
    result.vectorClock = VectorClockOps.merge(this.vectorClock, other.vectorClock);
    
    // Merge collections
    result.memories = this.memories.merge(other.memories);
    result.skills = this.skills.merge(other.skills);
    result.knowledge = this.knowledge.merge(other.knowledge);
    result.metadata = this.metadata.merge(other.metadata);
    result.tags = this.tags.merge(other.tags);
    
    this.log.info('State merged', {
      memories: result.memories.size,
      skills: result.skills.keys().length,
      knowledge: result.knowledge.size,
    });
    
    return result;
  }

  /**
   * Apply remote state (merge into this).
   */
  applyRemoteState(remote: CRDTStateManager): void {
    const merged = this.merge(remote);
    
    // Update local state
    this.lamportClock = merged.lamportClock;
    this.vectorClock = merged.vectorClock;
    this.memories = merged.memories;
    this.skills = merged.skills;
    this.knowledge = merged.knowledge;
    this.metadata = merged.metadata;
    this.tags = merged.tags;
    
    this.emit('state:merged', { remote: remote.instanceId });
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Serialize state for transmission.
   */
  serialize(): CRDTStateSnapshot {
    return {
      instanceId: this.instanceId,
      lamportClock: this.lamportClock,
      vectorClock: { ...this.vectorClock },
      memories: Array.from(this.memories.values()),
      skills: this.skills.entries(),
      knowledge: Array.from(this.knowledge.values()),
      metadata: this.metadata.entries(),
      tags: Array.from(this.tags.values()),
      timestamp: Date.now(),
    };
  }

  /**
   * Deserialize state from snapshot.
   */
  static deserialize(snapshot: CRDTStateSnapshot): CRDTStateManager {
    const manager = new CRDTStateManager(snapshot.instanceId);
    
    manager.lamportClock = snapshot.lamportClock;
    manager.vectorClock = { ...snapshot.vectorClock };
    
    for (const memoryId of snapshot.memories) {
      manager.memories.add(memoryId);
    }
    
    for (const [skillId, skill] of snapshot.skills) {
      manager.skills.set(skillId, skill, snapshot.lamportClock, snapshot.instanceId);
    }
    
    for (const knowledgeId of snapshot.knowledge) {
      manager.knowledge.add(knowledgeId);
    }
    
    for (const [key, value] of snapshot.metadata) {
      manager.metadata.set(key, value, snapshot.lamportClock, snapshot.instanceId);
    }
    
    for (const tag of snapshot.tags) {
      manager.tags.add(tag);
    }
    
    return manager;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get state statistics.
   */
  getStats(): CRDTStateStats {
    return {
      instanceId: this.instanceId,
      lamportClock: this.lamportClock,
      memoryCount: this.memories.size,
      skillCount: this.skills.keys().length,
      knowledgeCount: this.knowledge.size,
      tagCount: this.tags.size,
      metadataKeys: this.metadata.keys().length,
    };
  }
}

// ============================================================================
// Types for Serialization
// ============================================================================

export interface CRDTStateSnapshot {
  instanceId: string;
  lamportClock: number;
  vectorClock: VectorClock;
  memories: string[];
  skills: [string, Skill][];
  knowledge: string[];
  metadata: [string, unknown][];
  tags: string[];
  timestamp: number;
}

export interface CRDTStateStats {
  instanceId: string;
  lamportClock: number;
  memoryCount: number;
  skillCount: number;
  knowledgeCount: number;
  tagCount: number;
  metadataKeys: number;
}

// ============================================================================
// CRDT Property Verifier
// ============================================================================

/**
 * Verify CRDT properties for testing.
 */
export class CRDTPropertyVerifier {
  /**
   * Verify G-Set properties.
   */
  static verifyGSetProperties<T>(): boolean {
    const a = new GSet<string>();
    a.add('1');
    a.add('2');
    
    const b = new GSet<string>();
    b.add('2');
    b.add('3');
    
    const c = new GSet<string>();
    c.add('3');
    c.add('4');
    
    // Commutative: merge(A, B) = merge(B, A)
    const ab = a.merge(b);
    const ba = b.merge(a);
    const commutative = this.setsEqual(ab.values(), ba.values());
    
    // Associative: merge(merge(A,B), C) = merge(A, merge(B,C))
    const ab_c = a.merge(b).merge(c);
    const a_bc = a.merge(b.merge(c));
    const associative = this.setsEqual(ab_c.values(), a_bc.values());
    
    // Idempotent: merge(A, A) = A
    const aa = a.merge(a);
    const idempotent = this.setsEqual(aa.values(), a.values());
    
    return commutative && associative && idempotent;
  }

  /**
   * Verify LWW-Register properties.
   */
  static verifyLWWRegisterProperties(): boolean {
    const a = new LWWRegister<string>('a', 1, 'writer1');
    const b = new LWWRegister<string>('b', 2, 'writer2');
    const c = new LWWRegister<string>('c', 3, 'writer3');
    
    // Commutative
    const ab = a.merge(b);
    const ba = b.merge(a);
    const commutative = ab.value === ba.value;
    
    // Associative
    const ab_c = a.merge(b).merge(c);
    const a_bc = a.merge(b.merge(c));
    const associative = ab_c.value === a_bc.value;
    
    // Idempotent
    const aa = a.merge(a);
    const idempotent = aa.value === a.value;
    
    return commutative && associative && idempotent;
  }

  private static setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  CRDTStateManager as default,
};
