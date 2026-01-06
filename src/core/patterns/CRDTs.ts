/**
 * Pattern #10: CRDTs (Conflict-free Replicated Data Types)
 * 
 * Universal Pattern: Conflict-free replicated data structures
 * Natural Analogy: Biological systems that merge without conflict
 * Mathematical Property: Commutative, associative, idempotent operations
 * 
 * Application: Agent state merging, memory synchronization, skill aggregation
 */

/**
 * State-based CRDT (Convergent CRDT) - G-Counter (Grow-only Counter)
 */
export class GCounter {
  private values: Map<string, number>; // nodeId -> value
  private id: string;

  constructor(nodeId: string) {
    this.id = nodeId;
    this.values = new Map();
    this.values.set(nodeId, 0);
  }

  get value(): number {
    return Array.from(this.values.values()).reduce((sum, val) => sum + val, 0);
  }

  inc(): void {
    const current = this.values.get(this.id) || 0;
    this.values.set(this.id, current + 1);
  }

  merge(other: GCounter): void {
    const allKeys = new Set([...this.values.keys(), ...other.values.keys()]);
    for (const key of allKeys) {
      const thisValue = this.values.get(key) || 0;
      const otherValue = other.values.get(key) || 0;
      this.values.set(key, Math.max(thisValue, otherValue));
    }
  }

  serialize(): { id: string; values: [string, number][] } {
    return { id: this.id, values: Array.from(this.values.entries()) };
  }

  static deserialize(data: { id: string; values: [string, number][] }): GCounter {
    const counter = new GCounter(data.id);
    counter.values = new Map(data.values);
    return counter;
  }
}

/**
 * State-based CRDT - PN-Counter (Positive-Negative Counter)
 */
export class PNCounter {
  private incCounter: GCounter;
  private decCounter: GCounter;
  private id: string;

  constructor(nodeId: string) {
    this.id = nodeId;
    this.incCounter = new GCounter(nodeId);
    this.decCounter = new GCounter(nodeId);
  }

  get value(): number {
    return this.incCounter.value - this.decCounter.value;
  }

  inc(): void {
    this.incCounter.inc();
  }

  dec(): void {
    this.decCounter.inc();
  }

  merge(other: PNCounter): void {
    this.incCounter.merge(other.incCounter);
    this.decCounter.merge(other.decCounter);
  }

  serialize(): { id: string; inc: any; dec: any } {
    return { 
      id: this.id, 
      inc: this.incCounter.serialize(),
      dec: this.decCounter.serialize()
    };
  }

  static deserialize(data: { id: string; inc: any; dec: any }): PNCounter {
    const counter = new PNCounter(data.id);
    counter.incCounter = GCounter.deserialize(data.inc);
    counter.decCounter = GCounter.deserialize(data.dec);
    return counter;
  }
}

/**
 * State-based CRDT - G-Set (Grow-only Set)
 */
export class GSet<T> {
  private elements: Set<T>;

  constructor() {
    this.elements = new Set<T>();
  }

  add(element: T): void {
    this.elements.add(element);
  }

  has(element: T): boolean {
    return this.elements.has(element);
  }

  get values(): T[] {
    return Array.from(this.elements);
  }

  merge(other: GSet<T>): void {
    for (const element of other.elements) {
      this.elements.add(element);
    }
  }

  serialize(): { elements: T[] } {
    return { elements: Array.from(this.elements) };
  }

  static deserialize<T>(data: { elements: T[] }): GSet<T> {
    const set = new GSet<T>();
    for (const element of data.elements) {
      set.elements.add(element);
    }
    return set;
  }
}

/**
 * State-based CRDT - 2P-Set (Two-Phase Set)
 */
export class TwoPSet<T> {
  private addSet: GSet<T>;
  private removeSet: GSet<T>;

  constructor() {
    this.addSet = new GSet<T>();
    this.removeSet = new GSet<T>();
  }

  add(element: T): void {
    this.addSet.add(element);
  }

  remove(element: T): void {
    if (this.addSet.has(element)) {
      this.removeSet.add(element);
    }
  }

  has(element: T): boolean {
    return this.addSet.has(element) && !this.removeSet.has(element);
  }

  values(): T[] {
    return this.addSet.values.filter(e => this.removeSet.has(e) === false);
  }

  merge(other: TwoPSet<T>): void {
    this.addSet.merge(other.addSet);
    this.removeSet.merge(other.removeSet);
  }

  serialize(): { add: any; remove: any } {
    return {
      add: this.addSet.serialize(),
      remove: this.removeSet.serialize()
    };
  }

  static deserialize<T>(data: { add: any; remove: any }): TwoPSet<T> {
    const set = new TwoPSet<T>();
    set.addSet = GSet.deserialize(data.add);
    set.removeSet = GSet.deserialize(data.remove);
    return set;
  }
}

/**
 * State-based CRDT - LWW-Element-Set (Last-Write-Wins Element Set)
 */
export class LWWElementSet<T> {
  private addSet: Map<T, number>; // element -> timestamp
  private removeSet: Map<T, number>; // element -> timestamp

  constructor() {
    this.addSet = new Map<T, number>();
    this.removeSet = new Map<T, number>();
  }

  add(element: T, timestamp: number = Date.now()): void {
    this.addSet.set(element, timestamp);
  }

  remove(element: T, timestamp: number = Date.now()): void {
    this.removeSet.set(element, timestamp);
  }

  has(element: T): boolean {
    const addTime = this.addSet.get(element);
    const removeTime = this.removeSet.get(element);
    
    if (addTime === undefined) return false;
    if (removeTime === undefined) return true;
    
    return addTime > removeTime;
  }

  values(): T[] {
    const result: T[] = [];
    for (const [element, addTime] of this.addSet.entries()) {
      if (this.has(element)) {
        result.push(element);
      }
    }
    return result;
  }

  merge(other: LWWElementSet<T>): void {
    for (const [element, timestamp] of other.addSet.entries()) {
      const existing = this.addSet.get(element);
      if (existing === undefined || timestamp > existing) {
        this.addSet.set(element, timestamp);
      }
    }
    
    for (const [element, timestamp] of other.removeSet.entries()) {
      const existing = this.removeSet.get(element);
      if (existing === undefined || timestamp > existing) {
        this.removeSet.set(element, timestamp);
      }
    }
  }

  serialize(): { add: [T, number][]; remove: [T, number][] } {
    return {
      add: Array.from(this.addSet.entries()),
      remove: Array.from(this.removeSet.entries())
    };
  }

  static deserialize<T>(data: { add: [T, number][]; remove: [T, number][] }): LWWElementSet<T> {
    const set = new LWWElementSet<T>();
    for (const [element, timestamp] of data.add) {
      set.addSet.set(element, timestamp);
    }
    for (const [element, timestamp] of data.remove) {
      set.removeSet.set(element, timestamp);
    }
    return set;
  }
}

/**
 * Operation-based CRDT - Add-Wins-Set
 */
export class AddWinsSet<T> {
  private elements: Set<T>;
  private lastOpTimestamps: Map<T, number>;

  constructor() {
    this.elements = new Set<T>();
    this.lastOpTimestamps = new Map<T, number>();
  }

  add(element: T, timestamp: number = Date.now()): void {
    const existingTimestamp = this.lastOpTimestamps.get(element);
    if (existingTimestamp === undefined || timestamp > existingTimestamp) {
      this.elements.add(element);
      this.lastOpTimestamps.set(element, timestamp);
    }
  }

  remove(element: T, timestamp: number = Date.now()): void {
    const existingTimestamp = this.lastOpTimestamps.get(element);
    if (existingTimestamp === undefined || timestamp > existingTimestamp) {
      this.elements.delete(element);
      this.lastOpTimestamps.set(element, timestamp);
    }
  }

  has(element: T): boolean {
    return this.elements.has(element);
  }

  values(): T[] {
    return Array.from(this.elements);
  }

  serialize(): { elements: [T, number][] } {
    return {
      elements: Array.from(this.lastOpTimestamps.entries())
    };
  }

  static deserialize<T>(data: { elements: [T, number][] }): AddWinsSet<T> {
    const set = new AddWinsSet<T>();
    for (const [element, timestamp] of data.elements) {
      set.lastOpTimestamps.set(element, timestamp);
      set.elements.add(element);
    }
    return set;
  }
}

/**
 * Typed interfaces for Agent State (replacing any types)
 * @see reports/COMPREHENSIVE_CODE_REVIEW.md CRIT-LOG-001
 */
export interface TypedMemory {
  id: string;
  content: string;
  type: 'episodic' | 'semantic' | 'working' | 'core';
  timestamp: string;
  source: 'user' | 'agent' | 'sync' | 'inference';
  embedding?: number[];
  metadata: Record<string, string>;
}

export interface TypedKnowledge {
  concept_id: string;
  value: string;
  confidence: number;
  sources: string[];
  verification_count: number;
  last_verified: string;
}

export interface TypedBelief {
  content: string;
  conviction: number;
  privacy: 'PUBLIC' | 'PRIVATE';
  source: string;
  timestamp: string;
}

/**
 * Conflict record for audit trail
 */
export interface KnowledgeConflict {
  key: string;
  kept: TypedKnowledge;
  discarded: TypedKnowledge;
  reason: 'confidence_priority' | 'recency_priority' | 'source_count_priority';
  timestamp: string;
}

/**
 * CRDT for Agent State Merging with semantic conflict resolution
 * @see reports/COMPREHENSIVE_CODE_REVIEW.md CRIT-LOG-002
 */
export interface AgentState {
  memories: TypedMemory[];
  skills: { [key: string]: number };
  knowledge: { [key: string]: TypedKnowledge };
  beliefs: { [key: string]: TypedBelief };
}

export class AgentStateCRDT {
  private id: string;
  private state: AgentState;
  private version: number;
  private timestamp: number;
  private conflicts: KnowledgeConflict[] = [];

  constructor(agentId: string) {
    this.id = agentId;
    this.state = {
      memories: [],
      skills: {},
      knowledge: {},
      beliefs: {}
    };
    this.version = 0;
    this.timestamp = Date.now();
  }

  update(newState: Partial<AgentState>): void {
    this.state = {
      memories: [...this.state.memories, ...(newState.memories || [])],
      skills: { ...this.state.skills, ...(newState.skills || {}) },
      knowledge: { ...this.state.knowledge, ...(newState.knowledge || {}) },
      beliefs: { ...this.state.beliefs, ...(newState.beliefs || {}) }
    };
    this.version++;
    this.timestamp = Date.now();
  }

  get stateData(): AgentState {
    return { ...this.state };
  }
  
  /**
   * Get conflicts recorded during merges
   */
  getConflicts(): KnowledgeConflict[] {
    return [...this.conflicts];
  }
  
  /**
   * Clear conflict history
   */
  clearConflicts(): void {
    this.conflicts = [];
  }

  merge(other: AgentStateCRDT): void {
    // Merge memories (avoid duplicates based on ID)
    this.mergeMemories(other);
    
    // Merge skills using max values (proficiency can only increase)
    this.mergeSkills(other);
    
    // Merge knowledge with semantic conflict resolution
    this.mergeKnowledge(other);
    
    // Merge beliefs with conviction-based resolution
    this.mergeBeliefs(other);

    // Update version and timestamp
    this.version = Math.max(this.version, other.version) + 1;
    this.timestamp = Math.max(this.timestamp, other.timestamp);
  }
  
  /**
   * Merge memories with deduplication
   */
  private mergeMemories(other: AgentStateCRDT): void {
    const memoryMap = new Map<string, TypedMemory>();
    
    for (const memory of this.state.memories) {
      memoryMap.set(memory.id, memory);
    }
    
    for (const memory of other.state.memories) {
      const existing = memoryMap.get(memory.id);
      if (!existing) {
        // New memory - add it
        memoryMap.set(memory.id, memory);
      } else {
        // Duplicate - keep the one with more recent timestamp
        if (memory.timestamp > existing.timestamp) {
          memoryMap.set(memory.id, memory);
        }
      }
    }
    
    this.state.memories = Array.from(memoryMap.values());
  }
  
  /**
   * Merge skills using max proficiency (skills only improve)
   */
  private mergeSkills(other: AgentStateCRDT): void {
    for (const [skill, value] of Object.entries(other.state.skills)) {
      const currentValue = this.state.skills[skill];
      if (currentValue === undefined || value > currentValue) {
        this.state.skills[skill] = value;
      }
    }
  }
  
  /**
   * Merge knowledge with semantic conflict resolution
   * Instead of last-write-wins, uses confidence + source count + recency
   *
   * @see reports/COMPREHENSIVE_CODE_REVIEW.md CRIT-LOG-002
   */
  private mergeKnowledge(other: AgentStateCRDT): void {
    for (const [key, otherKnowledge] of Object.entries(other.state.knowledge)) {
      const thisKnowledge = this.state.knowledge[key];
      
      if (!thisKnowledge) {
        // New knowledge - accept it
        this.state.knowledge[key] = otherKnowledge;
      } else if (this.areKnowledgeCompatible(thisKnowledge, otherKnowledge)) {
        // Compatible (same value) - boost confidence, merge sources
        this.state.knowledge[key] = {
          ...thisKnowledge,
          confidence: Math.min(1.0, thisKnowledge.confidence + 0.1),
          sources: [...new Set([...thisKnowledge.sources, ...otherKnowledge.sources])],
          verification_count: thisKnowledge.verification_count + otherKnowledge.verification_count,
          last_verified: thisKnowledge.last_verified > otherKnowledge.last_verified
            ? thisKnowledge.last_verified
            : otherKnowledge.last_verified
        };
      } else {
        // Conflict - resolve using multi-factor scoring
        const resolution = this.resolveKnowledgeConflict(thisKnowledge, otherKnowledge);
        
        // Record the conflict for audit
        this.conflicts.push({
          key,
          kept: resolution.winner,
          discarded: resolution.loser,
          reason: resolution.reason,
          timestamp: new Date().toISOString()
        });
        
        this.state.knowledge[key] = resolution.winner;
      }
    }
  }
  
  /**
   * Check if two knowledge items have the same value (compatible)
   */
  private areKnowledgeCompatible(a: TypedKnowledge, b: TypedKnowledge): boolean {
    return a.value === b.value;
  }
  
  /**
   * Resolve knowledge conflict using multi-factor scoring:
   * 1. Confidence (40% weight)
   * 2. Source count (30% weight)
   * 3. Recency (30% weight)
   */
  private resolveKnowledgeConflict(
    a: TypedKnowledge,
    b: TypedKnowledge
  ): { winner: TypedKnowledge; loser: TypedKnowledge; reason: KnowledgeConflict['reason'] } {
    const scoreA = this.calculateKnowledgeScore(a);
    const scoreB = this.calculateKnowledgeScore(b);
    
    // Determine primary reason for decision
    let reason: KnowledgeConflict['reason'] = 'confidence_priority';
    if (a.sources.length !== b.sources.length) {
      if ((a.sources.length > b.sources.length) === (scoreA > scoreB)) {
        reason = 'source_count_priority';
      }
    }
    if (a.last_verified !== b.last_verified) {
      const aRecent = new Date(a.last_verified).getTime();
      const bRecent = new Date(b.last_verified).getTime();
      if ((aRecent > bRecent) === (scoreA > scoreB)) {
        reason = 'recency_priority';
      }
    }
    
    if (scoreA >= scoreB) {
      return { winner: a, loser: b, reason };
    } else {
      return { winner: b, loser: a, reason };
    }
  }
  
  /**
   * Calculate knowledge quality score
   */
  private calculateKnowledgeScore(k: TypedKnowledge): number {
    const confidenceScore = k.confidence * 0.4;
    const sourceScore = Math.min(k.sources.length / 5, 1) * 0.3; // Cap at 5 sources
    
    // Recency score: decay over 30 days
    const ageMs = Date.now() - new Date(k.last_verified).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - (ageDays / 30)) * 0.3;
    
    return confidenceScore + sourceScore + recencyScore;
  }
  
  /**
   * Merge beliefs with conviction-based resolution
   */
  private mergeBeliefs(other: AgentStateCRDT): void {
    for (const [key, otherBelief] of Object.entries(other.state.beliefs)) {
      const thisBelief = this.state.beliefs[key];
      
      if (!thisBelief) {
        // New belief - accept it
        this.state.beliefs[key] = otherBelief;
      } else if (thisBelief.content === otherBelief.content) {
        // Same belief - reinforce conviction
        this.state.beliefs[key] = {
          ...thisBelief,
          conviction: Math.min(1.0, thisBelief.conviction + 0.05),
          timestamp: thisBelief.timestamp > otherBelief.timestamp
            ? thisBelief.timestamp
            : otherBelief.timestamp
        };
      } else {
        // Different beliefs - higher conviction wins
        if (otherBelief.conviction > thisBelief.conviction) {
          this.state.beliefs[key] = otherBelief;
        }
        // If equal conviction, keep existing (stability)
      }
    }
  }

  serialize(): {
    id: string;
    state: AgentState;
    version: number;
    timestamp: number;
    conflicts: KnowledgeConflict[];
  } {
    return {
      id: this.id,
      state: this.state,
      version: this.version,
      timestamp: this.timestamp,
      conflicts: this.conflicts
    };
  }

  static deserialize(data: {
    id: string;
    state: AgentState;
    version: number;
    timestamp: number;
    conflicts?: KnowledgeConflict[];
  }): AgentStateCRDT {
    const crdt = new AgentStateCRDT(data.id);
    crdt.state = data.state;
    crdt.version = data.version;
    crdt.timestamp = data.timestamp;
    crdt.conflicts = data.conflicts || [];
    return crdt;
  }
}