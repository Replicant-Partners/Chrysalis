/**
 * TypeScript bindings for Chrysalis OCaml CRDT Module
 *
 * Provides immutable CRDT implementations with formal correctness guarantees.
 * Uses js_of_ocaml for OCaml-to-JavaScript compilation.
 */

// ============================================================================
// Vector Clock
// ============================================================================

export type VectorClockComparison = 'before' | 'after' | 'concurrent' | 'equal';

export interface VectorClockData {
  [nodeId: string]: number;
}

export class VectorClock {
  private clocks: Map<string, number>;

  constructor(data?: VectorClockData) {
    this.clocks = new Map(Object.entries(data || {}));
  }

  static empty(): VectorClock {
    return new VectorClock();
  }

  static singleton(nodeId: string, timestamp: number = 0): VectorClock {
    return new VectorClock({ [nodeId]: timestamp });
  }

  get(nodeId: string): number {
    return this.clocks.get(nodeId) || 0;
  }

  increment(nodeId: string): VectorClock {
    const newClocks = new Map(this.clocks);
    newClocks.set(nodeId, this.get(nodeId) + 1);
    return new VectorClock(Object.fromEntries(newClocks));
  }

  merge(other: VectorClock): VectorClock {
    const allKeys = new Set([...this.clocks.keys(), ...other.clocks.keys()]);
    const merged: VectorClockData = {};

    for (const key of allKeys) {
      merged[key] = Math.max(this.get(key), other.get(key));
    }

    return new VectorClock(merged);
  }

  compare(other: VectorClock): VectorClockComparison {
    const allKeys = new Set([...this.clocks.keys(), ...other.clocks.keys()]);
    let hasLess = false;
    let hasGreater = false;

    for (const key of allKeys) {
      const t1 = this.get(key);
      const t2 = other.get(key);

      if (t1 < t2) hasLess = true;
      if (t1 > t2) hasGreater = true;
    }

    if (!hasLess && !hasGreater) return 'equal';
    if (hasLess && !hasGreater) return 'before';
    if (!hasLess && hasGreater) return 'after';
    return 'concurrent';
  }

  happenedBefore(other: VectorClock): boolean {
    return this.compare(other) === 'before';
  }

  happenedAfter(other: VectorClock): boolean {
    return this.compare(other) === 'after';
  }

  isConcurrent(other: VectorClock): boolean {
    return this.compare(other) === 'concurrent';
  }

  isEqual(other: VectorClock): boolean {
    return this.compare(other) === 'equal';
  }

  sum(): number {
    let total = 0;
    for (const v of this.clocks.values()) {
      total += v;
    }
    return total;
  }

  nodes(): string[] {
    return [...this.clocks.keys()];
  }

  toJSON(): VectorClockData {
    return Object.fromEntries(this.clocks);
  }

  toString(): string {
    const entries = [...this.clocks.entries()]
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    return `{${entries}}`;
  }
}

// ============================================================================
// G-Counter (Grow-only Counter)
// ============================================================================

export class GCounter {
  private counts: Map<string, number>;

  constructor(data?: Record<string, number>) {
    this.counts = new Map(Object.entries(data || {}));
  }

  static empty(): GCounter {
    return new GCounter();
  }

  increment(nodeId: string): GCounter {
    const newCounts = new Map(this.counts);
    newCounts.set(nodeId, (this.counts.get(nodeId) || 0) + 1);
    return new GCounter(Object.fromEntries(newCounts));
  }

  incrementBy(nodeId: string, amount: number): GCounter {
    if (amount < 0) return this;
    const newCounts = new Map(this.counts);
    newCounts.set(nodeId, (this.counts.get(nodeId) || 0) + amount);
    return new GCounter(Object.fromEntries(newCounts));
  }

  value(): number {
    let total = 0;
    for (const v of this.counts.values()) {
      total += v;
    }
    return total;
  }

  merge(other: GCounter): GCounter {
    const allKeys = new Set([...this.counts.keys(), ...other.counts.keys()]);
    const merged: Record<string, number> = {};

    for (const key of allKeys) {
      merged[key] = Math.max(
        this.counts.get(key) || 0,
        other.counts.get(key) || 0
      );
    }

    return new GCounter(merged);
  }

  toJSON(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }
}

// ============================================================================
// PN-Counter (Positive-Negative Counter)
// ============================================================================

export class PNCounter {
  private positive: GCounter;
  private negative: GCounter;

  constructor(positive?: GCounter, negative?: GCounter) {
    this.positive = positive || GCounter.empty();
    this.negative = negative || GCounter.empty();
  }

  static empty(): PNCounter {
    return new PNCounter();
  }

  increment(nodeId: string): PNCounter {
    return new PNCounter(this.positive.increment(nodeId), this.negative);
  }

  decrement(nodeId: string): PNCounter {
    return new PNCounter(this.positive, this.negative.increment(nodeId));
  }

  value(): number {
    return this.positive.value() - this.negative.value();
  }

  merge(other: PNCounter): PNCounter {
    return new PNCounter(
      this.positive.merge(other.positive),
      this.negative.merge(other.negative)
    );
  }

  toJSON(): { positive: Record<string, number>; negative: Record<string, number> } {
    return {
      positive: this.positive.toJSON(),
      negative: this.negative.toJSON(),
    };
  }
}

// ============================================================================
// G-Set (Grow-only Set)
// ============================================================================

export class GSet<T> {
  private elements: Set<T>;

  constructor(elements?: Iterable<T>) {
    this.elements = new Set(elements);
  }

  static empty<T>(): GSet<T> {
    return new GSet<T>();
  }

  add(element: T): GSet<T> {
    const newElements = new Set(this.elements);
    newElements.add(element);
    return new GSet(newElements);
  }

  contains(element: T): boolean {
    return this.elements.has(element);
  }

  values(): T[] {
    return [...this.elements];
  }

  size(): number {
    return this.elements.size;
  }

  merge(other: GSet<T>): GSet<T> {
    return new GSet([...this.elements, ...other.elements]);
  }

  toJSON(): T[] {
    return this.values();
  }
}

// ============================================================================
// Two-Phase Set
// ============================================================================

export class TwoPhaseSet<T> {
  private added: GSet<T>;
  private removed: GSet<T>;

  constructor(added?: GSet<T>, removed?: GSet<T>) {
    this.added = added || GSet.empty();
    this.removed = removed || GSet.empty();
  }

  static empty<T>(): TwoPhaseSet<T> {
    return new TwoPhaseSet<T>();
  }

  add(element: T): TwoPhaseSet<T> {
    return new TwoPhaseSet(this.added.add(element), this.removed);
  }

  remove(element: T): TwoPhaseSet<T> {
    return new TwoPhaseSet(this.added, this.removed.add(element));
  }

  contains(element: T): boolean {
    return this.added.contains(element) && !this.removed.contains(element);
  }

  values(): T[] {
    return this.added.values().filter((e) => !this.removed.contains(e));
  }

  merge(other: TwoPhaseSet<T>): TwoPhaseSet<T> {
    return new TwoPhaseSet(
      this.added.merge(other.added),
      this.removed.merge(other.removed)
    );
  }

  toJSON(): { added: T[]; removed: T[] } {
    return {
      added: this.added.toJSON(),
      removed: this.removed.toJSON(),
    };
  }
}

// ============================================================================
// LWW-Register (Last-Writer-Wins Register)
// ============================================================================

export class LWWRegister<T> {
  private _value: T | null;
  private timestamp: number;
  private nodeId: string;

  constructor(value: T | null = null, timestamp: number = 0, nodeId: string = '') {
    this._value = value;
    this.timestamp = timestamp;
    this.nodeId = nodeId;
  }

  static empty<T>(): LWWRegister<T> {
    return new LWWRegister<T>();
  }

  set(value: T, timestamp: number, nodeId: string): LWWRegister<T> {
    if (
      timestamp > this.timestamp ||
      (timestamp === this.timestamp && nodeId > this.nodeId)
    ) {
      return new LWWRegister(value, timestamp, nodeId);
    }
    return this;
  }

  get(): T | null {
    return this._value;
  }

  merge(other: LWWRegister<T>): LWWRegister<T> {
    if (other.timestamp > this.timestamp) {
      return other;
    }
    if (this.timestamp > other.timestamp) {
      return this;
    }
    // Same timestamp: use node ID as tiebreaker
    return this.nodeId >= other.nodeId ? this : other;
  }

  toJSON(): { value: T | null; timestamp: number; nodeId: string } {
    return {
      value: this._value,
      timestamp: this.timestamp,
      nodeId: this.nodeId,
    };
  }
}

// ============================================================================
// LWW-Element-Set
// ============================================================================

interface LWWElement<T> {
  value: T;
  addTime: number;
  removeTime: number | null;
}

export class LWWElementSet<T> {
  private elements: Map<string, LWWElement<T>>;

  constructor(elements?: Map<string, LWWElement<T>>) {
    this.elements = elements || new Map();
  }

  static empty<T>(): LWWElementSet<T> {
    return new LWWElementSet<T>();
  }

  private keyFor(value: T): string {
    return JSON.stringify(value);
  }

  add(value: T, timestamp: number): LWWElementSet<T> {
    const key = this.keyFor(value);
    const existing = this.elements.get(key);

    const newElements = new Map(this.elements);
    if (existing) {
      if (timestamp > existing.addTime) {
        newElements.set(key, { ...existing, addTime: timestamp });
      }
    } else {
      newElements.set(key, { value, addTime: timestamp, removeTime: null });
    }

    return new LWWElementSet(newElements);
  }

  remove(value: T, timestamp: number): LWWElementSet<T> {
    const key = this.keyFor(value);
    const existing = this.elements.get(key);

    const newElements = new Map(this.elements);
    if (existing) {
      const newRemoveTime = existing.removeTime
        ? Math.max(existing.removeTime, timestamp)
        : timestamp;
      newElements.set(key, { ...existing, removeTime: newRemoveTime });
    } else {
      newElements.set(key, { value, addTime: 0, removeTime: timestamp });
    }

    return new LWWElementSet(newElements);
  }

  contains(value: T): boolean {
    const key = this.keyFor(value);
    const element = this.elements.get(key);
    if (!element) return false;
    if (element.removeTime === null) return true;
    return element.addTime > element.removeTime;
  }

  values(): T[] {
    const result: T[] = [];
    for (const element of this.elements.values()) {
      if (element.removeTime === null || element.addTime > element.removeTime) {
        result.push(element.value);
      }
    }
    return result;
  }

  merge(other: LWWElementSet<T>): LWWElementSet<T> {
    const allKeys = new Set([
      ...this.elements.keys(),
      ...other.elements.keys(),
    ]);
    const merged = new Map<string, LWWElement<T>>();

    for (const key of allKeys) {
      const e1 = this.elements.get(key);
      const e2 = other.elements.get(key);

      if (e1 && e2) {
        merged.set(key, {
          value: e1.value,
          addTime: Math.max(e1.addTime, e2.addTime),
          removeTime:
            e1.removeTime !== null && e2.removeTime !== null
              ? Math.max(e1.removeTime, e2.removeTime)
              : e1.removeTime ?? e2.removeTime,
        });
      } else {
        merged.set(key, (e1 || e2)!);
      }
    }

    return new LWWElementSet(merged);
  }
}

// ============================================================================
// OR-Set (Observed-Remove Set)
// ============================================================================

interface ORElement<T> {
  value: T;
  tag: string;
}

export class ORSet<T> {
  private elements: Map<string, ORElement<T>>;
  private tombstones: Set<string>;

  constructor(elements?: Map<string, ORElement<T>>, tombstones?: Set<string>) {
    this.elements = elements || new Map();
    this.tombstones = tombstones || new Set();
  }

  static empty<T>(): ORSet<T> {
    return new ORSet<T>();
  }

  private generateTag(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  add(value: T): ORSet<T> {
    const tag = this.generateTag();
    const newElements = new Map(this.elements);
    newElements.set(tag, { value, tag });
    return new ORSet(newElements, this.tombstones);
  }

  addWithTag(value: T, tag: string): ORSet<T> {
    const newElements = new Map(this.elements);
    newElements.set(tag, { value, tag });
    return new ORSet(newElements, this.tombstones);
  }

  remove(value: T): ORSet<T> {
    const newTombstones = new Set(this.tombstones);
    const newElements = new Map(this.elements);

    for (const [tag, element] of this.elements) {
      if (JSON.stringify(element.value) === JSON.stringify(value)) {
        newTombstones.add(tag);
        newElements.delete(tag);
      }
    }

    return new ORSet(newElements, newTombstones);
  }

  contains(value: T): boolean {
    for (const element of this.elements.values()) {
      if (
        JSON.stringify(element.value) === JSON.stringify(value) &&
        !this.tombstones.has(element.tag)
      ) {
        return true;
      }
    }
    return false;
  }

  values(): T[] {
    const seen = new Set<string>();
    const result: T[] = [];

    for (const element of this.elements.values()) {
      if (!this.tombstones.has(element.tag)) {
        const key = JSON.stringify(element.value);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(element.value);
        }
      }
    }

    return result;
  }

  merge(other: ORSet<T>): ORSet<T> {
    const mergedElements = new Map([
      ...this.elements,
      ...other.elements,
    ]);
    const mergedTombstones = new Set([
      ...this.tombstones,
      ...other.tombstones,
    ]);

    // Remove tombstoned elements
    for (const tag of mergedTombstones) {
      mergedElements.delete(tag);
    }

    return new ORSet(mergedElements, mergedTombstones);
  }
}

// ============================================================================
// MV-Register (Multi-Value Register)
// ============================================================================

export class MVRegister<T> {
  private values: Array<{ value: T; clock: VectorClock }>;

  constructor(values?: Array<{ value: T; clock: VectorClock }>) {
    this.values = values || [];
  }

  static empty<T>(): MVRegister<T> {
    return new MVRegister<T>();
  }

  set(value: T, clock: VectorClock): MVRegister<T> {
    // Remove values dominated by the new value
    const notDominated = this.values.filter(
      (v) => !v.clock.happenedBefore(clock)
    );

    // Check if new value is dominated by existing
    const dominatedByExisting = notDominated.some((v) =>
      clock.happenedBefore(v.clock)
    );

    if (dominatedByExisting) {
      return new MVRegister(notDominated);
    }

    return new MVRegister([...notDominated, { value, clock }]);
  }

  get(): T[] {
    return this.values.map((v) => v.value);
  }

  hasConflict(): boolean {
    return this.values.length > 1;
  }

  merge(other: MVRegister<T>): MVRegister<T> {
    const allValues = [...this.values, ...other.values];

    // Keep only values not dominated by any other
    const notDominated = allValues.filter(
      (v1) =>
        !allValues.some(
          (v2) =>
            v1 !== v2 &&
            v1.clock.happenedBefore(v2.clock)
        )
    );

    // Remove duplicates
    const seen = new Set<string>();
    const unique = notDominated.filter((v) => {
      const key = JSON.stringify(v.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return new MVRegister(unique);
  }
}

// ============================================================================
// Experience Types (matching OCaml module)
// ============================================================================

export interface Skill {
  name: string;
  proficiency: number;
  usageCount: number;
  lastUsed: number;
}

export interface Episode {
  id: string;
  content: string;
  context: string;
  outcome: string;
  timestamp: number;
  importance: number;
  tags: string[];
}

export interface Belief {
  id: string;
  content: string;
  conviction: number;
  evidenceFor: number;
  evidenceAgainst: number;
  lastUpdated: number;
  source: string;
}

// ============================================================================
// Skill Accumulator
// ============================================================================

export class SkillAccumulator {
  private skills: Map<string, Skill>;

  constructor(skills?: Map<string, Skill>) {
    this.skills = skills || new Map();
  }

  static empty(): SkillAccumulator {
    return new SkillAccumulator();
  }

  updateSkill(name: string, proficiency: number, timestamp: number): SkillAccumulator {
    const current = this.skills.get(name);
    const newSkills = new Map(this.skills);

    if (current && timestamp > current.lastUsed) {
      newSkills.set(name, {
        name,
        proficiency: Math.max(current.proficiency, proficiency),
        usageCount: current.usageCount + 1,
        lastUsed: timestamp,
      });
    } else if (!current) {
      newSkills.set(name, {
        name,
        proficiency,
        usageCount: 1,
        lastUsed: timestamp,
      });
    }

    return new SkillAccumulator(newSkills);
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAllSkills(): Skill[] {
    return [...this.skills.values()];
  }

  merge(other: SkillAccumulator): SkillAccumulator {
    const allKeys = new Set([...this.skills.keys(), ...other.skills.keys()]);
    const merged = new Map<string, Skill>();

    for (const name of allKeys) {
      const s1 = this.skills.get(name);
      const s2 = other.skills.get(name);

      if (s1 && s2) {
        merged.set(name, {
          name,
          proficiency: Math.max(s1.proficiency, s2.proficiency),
          usageCount: s1.usageCount + s2.usageCount,
          lastUsed: Math.max(s1.lastUsed, s2.lastUsed),
        });
      } else {
        merged.set(name, (s1 || s2)!);
      }
    }

    return new SkillAccumulator(merged);
  }
}

// ============================================================================
// Episode Memory
// ============================================================================

export class EpisodeMemory {
  private episodes: Episode[];
  private maxEpisodes: number;

  constructor(episodes?: Episode[], maxEpisodes: number = 1000) {
    this.episodes = episodes || [];
    this.maxEpisodes = maxEpisodes;
  }

  static empty(maxEpisodes: number = 1000): EpisodeMemory {
    return new EpisodeMemory([], maxEpisodes);
  }

  add(episode: Episode): EpisodeMemory {
    if (this.episodes.some((e) => e.id === episode.id)) {
      return this;
    }

    let newEpisodes = [...this.episodes, episode];

    // Prune if over limit, keeping most important
    if (newEpisodes.length > this.maxEpisodes) {
      newEpisodes.sort((a, b) => b.importance - a.importance);
      newEpisodes = newEpisodes.slice(0, this.maxEpisodes);
    }

    return new EpisodeMemory(newEpisodes, this.maxEpisodes);
  }

  queryByTag(tag: string): Episode[] {
    return this.episodes.filter((e) => e.tags.includes(tag));
  }

  queryByTime(startTime: number, endTime: number): Episode[] {
    return this.episodes.filter(
      (e) => e.timestamp >= startTime && e.timestamp <= endTime
    );
  }

  recent(n: number): Episode[] {
    return [...this.episodes]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, n);
  }

  important(n: number): Episode[] {
    return [...this.episodes]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, n);
  }

  size(): number {
    return this.episodes.length;
  }

  merge(other: EpisodeMemory): EpisodeMemory {
    const allEpisodes = [...this.episodes, ...other.episodes];
    const unique = new Map<string, Episode>();

    for (const ep of allEpisodes) {
      unique.set(ep.id, ep);
    }

    let episodes = [...unique.values()];
    const maxEps = Math.max(this.maxEpisodes, other.maxEpisodes);

    if (episodes.length > maxEps) {
      episodes.sort((a, b) => b.importance - a.importance);
      episodes = episodes.slice(0, maxEps);
    }

    return new EpisodeMemory(episodes, maxEps);
  }
}

// ============================================================================
// Agent State (unified CRDT state)
// ============================================================================

export class AgentState {
  readonly agentId: string;
  readonly skills: SkillAccumulator;
  readonly episodes: EpisodeMemory;
  readonly vectorClock: VectorClock;
  readonly lastSync: number;

  constructor(
    agentId: string,
    skills?: SkillAccumulator,
    episodes?: EpisodeMemory,
    vectorClock?: VectorClock,
    lastSync: number = 0
  ) {
    this.agentId = agentId;
    this.skills = skills || SkillAccumulator.empty();
    this.episodes = episodes || EpisodeMemory.empty();
    this.vectorClock = vectorClock || VectorClock.singleton(agentId);
    this.lastSync = lastSync;
  }

  static create(agentId: string): AgentState {
    return new AgentState(agentId);
  }

  tick(): AgentState {
    return new AgentState(
      this.agentId,
      this.skills,
      this.episodes,
      this.vectorClock.increment(this.agentId),
      this.lastSync
    );
  }

  updateSkill(name: string, proficiency: number, timestamp: number): AgentState {
    return new AgentState(
      this.agentId,
      this.skills.updateSkill(name, proficiency, timestamp),
      this.episodes,
      this.vectorClock.increment(this.agentId),
      this.lastSync
    );
  }

  addEpisode(episode: Episode): AgentState {
    return new AgentState(
      this.agentId,
      this.skills,
      this.episodes.add(episode),
      this.vectorClock.increment(this.agentId),
      this.lastSync
    );
  }

  merge(other: AgentState): AgentState {
    if (this.agentId !== other.agentId) {
      throw new Error('Cannot merge states from different agents');
    }

    return new AgentState(
      this.agentId,
      this.skills.merge(other.skills),
      this.episodes.merge(other.episodes),
      this.vectorClock.merge(other.vectorClock),
      Math.max(this.lastSync, other.lastSync)
    );
  }

  hasDiverged(other: AgentState): boolean {
    return this.vectorClock.isConcurrent(other.vectorClock);
  }
}

export default {
  VectorClock,
  GCounter,
  PNCounter,
  GSet,
  TwoPhaseSet,
  LWWRegister,
  LWWElementSet,
  ORSet,
  MVRegister,
  SkillAccumulator,
  EpisodeMemory,
  AgentState,
};