/**
 * Pattern #6: Convergence Functions
 * 
 * Universal Pattern: Mathematical functions that guarantee convergence to a fixed point
 * Natural Analogy: Biological systems converging to stable states, physical systems reaching equilibrium
 * Mathematical Property: Contractive mappings, fixed-point theorems
 * 
 * Application: Skill aggregation, belief alignment, state synchronization
 */

import { AgentState } from './CRDTs';

export interface ConvergenceFunction<T> {
  (current: T, incoming: T): T;
}

/**
 * Convergence Types for different data structures
 */
export enum ConvergenceType {
  MAX = 'max',
  MIN = 'min',
  AVERAGE = 'average',
  UNION = 'union',
  INTERSECTION = 'intersection',
  MERGE = 'merge',
  FIRST = 'first',
  LAST = 'last',
  WEIGHTED_AVERAGE = 'weighted_average',
  MAX_CONFIDENCE = 'max_confidence'
}

/**
 * A generic convergent function that guarantees convergence to a fixed point
 */
export class ConvergenceFunctionRegistry {
  private static functions: Map<ConvergenceType, ConvergenceFunction<any>> = new Map();

  static {
    // Initialize default convergence functions
    ConvergenceFunctionRegistry.functions.set(ConvergenceType.MAX, (current, incoming) => 
      typeof current === 'number' && typeof incoming === 'number' ? Math.max(current, incoming) : incoming
    );
    
    ConvergenceFunctionRegistry.functions.set(ConvergenceType.MIN, (current, incoming) => 
      typeof current === 'number' && typeof incoming === 'number' ? Math.min(current, incoming) : incoming
    );
    
    ConvergenceFunctionRegistry.functions.set(ConvergenceType.AVERAGE, (current, incoming) => {
      if (typeof current === 'number' && typeof incoming === 'number') {
        return (current + incoming) / 2;
      }
      return incoming;
    });
    
    ConvergenceFunctionRegistry.functions.set(ConvergenceType.UNION, (current, incoming) => {
      if (Array.isArray(current) && Array.isArray(incoming)) {
        return Array.from(new Set([...current, ...incoming]));
      }
      if (typeof current === 'object' && current !== null && typeof incoming === 'object' && incoming !== null) {
        return { ...current, ...incoming };
      }
      return incoming;
    });
    
    ConvergenceFunctionRegistry.functions.set(ConvergenceType.INTERSECTION, (current, incoming) => {
      if (Array.isArray(current) && Array.isArray(incoming)) {
        return current.filter(item => incoming.includes(item));
      }
      return incoming;
    });
    
    ConvergenceFunctionRegistry.functions.set(ConvergenceType.MERGE, (current, incoming) => {
      if (typeof current === 'object' && current !== null && typeof incoming === 'object' && incoming !== null) {
        return { ...current, ...incoming };
      }
      return incoming;
    });
    
    ConvergenceFunctionRegistry.functions.set(ConvergenceType.FIRST, (current, incoming) => current);
    ConvergenceFunctionRegistry.functions.set(ConvergenceType.LAST, (current, incoming) => incoming);
    
    ConvergenceFunctionRegistry.functions.set(ConvergenceType.WEIGHTED_AVERAGE, (current, incoming, weights = { current: 0.5, incoming: 0.5 }) => {
      if (typeof current === 'number' && typeof incoming === 'number') {
        return (current * weights.current + incoming * weights.incoming) / (weights.current + weights.incoming);
      }
      return incoming;
    });
    
    ConvergenceFunctionRegistry.functions.set(ConvergenceType.MAX_CONFIDENCE, (current, incoming) => {
      if (current.confidence !== undefined && incoming.confidence !== undefined) {
        return current.confidence > incoming.confidence ? current : incoming;
      }
      return incoming;
    });
  }

  /**
   * Register a custom convergence function
   */
  static register(type: ConvergenceType, func: ConvergenceFunction<any>): void {
    this.functions.set(type, func);
  }

  /**
   * Get a convergence function by type
   */
  static get(type: ConvergenceType): ConvergenceFunction<any> | undefined {
    return this.functions.get(type);
  }

  /**
   * Apply a convergence function
   */
  static apply<T>(type: ConvergenceType, current: T, incoming: T): T {
    const func = this.functions.get(type);
    if (func) {
      return func(current, incoming);
    }
    return incoming;
  }
}

/**
 * Convergent State Manager for ensuring convergence of agent states
 */
export class ConvergentStateManager {
  private state: AgentState;
  private convergenceMap: Map<string, ConvergenceType>;
  private readonly: boolean;

  constructor(initialState?: AgentState) {
    this.state = initialState || {
      memories: [],
      skills: {},
      knowledge: {},
      beliefs: {}
    };
    this.convergenceMap = new Map<string, ConvergenceType>();
    this.readonly = false;
  }

  /**
   * Set the convergence type for a specific field
   */
  setConvergence(field: string, type: ConvergenceType): void {
    if (this.readonly) {
      throw new Error('Cannot modify convergence map on readonly state manager');
    }
    this.convergenceMap.set(field, type);
  }

  /**
   * Update the state with a new partial state using convergence functions
   */
  updateState(partialState: Partial<AgentState>): void {
    if (this.readonly) {
      throw new Error('Cannot update readonly state manager');
    }

    // Update memories using union convergence
    if (partialState.memories) {
      const convergenceType = this.convergenceMap.get('memories') || ConvergenceType.UNION;
      const func = ConvergenceFunctionRegistry.get(convergenceType);
      
      if (func) {
        this.state.memories = func(this.state.memories, partialState.memories);
      } else {
        this.state.memories = [...this.state.memories, ...partialState.memories];
      }
    }

    // Update skills using max convergence (higher skill level wins)
    if (partialState.skills) {
      const convergenceType = this.convergenceMap.get('skills') || ConvergenceType.MAX;
      const func = ConvergenceFunctionRegistry.get(convergenceType);
      
      if (func) {
        const newSkills = func(this.state.skills, partialState.skills);
        this.state.skills = { ...this.state.skills, ...newSkills };
      } else {
        // Default behavior: use max convergence for skills
        for (const [key, value] of Object.entries(partialState.skills)) {
          if (this.state.skills[key] === undefined || value > this.state.skills[key]) {
            this.state.skills[key] = value;
          }
        }
      }
    }

    // Update knowledge using merge convergence
    if (partialState.knowledge) {
      const convergenceType = this.convergenceMap.get('knowledge') || ConvergenceType.MERGE;
      const func = ConvergenceFunctionRegistry.get(convergenceType);
      
      if (func) {
        this.state.knowledge = func(this.state.knowledge, partialState.knowledge);
      } else {
        this.state.knowledge = { ...this.state.knowledge, ...partialState.knowledge };
      }
    }

    // Update beliefs using max confidence convergence
    if (partialState.beliefs) {
      const convergenceType = this.convergenceMap.get('beliefs') || ConvergenceType.MAX_CONFIDENCE;
      const func = ConvergenceFunctionRegistry.get(convergenceType);
      
      if (func) {
        this.state.beliefs = func(this.state.beliefs, partialState.beliefs);
      } else {
        this.state.beliefs = { ...this.state.beliefs, ...partialState.beliefs };
      }
    }
  }

  /**
   * Get the current state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get a specific field from the state
   */
  getField<T>(field: keyof AgentState): T {
    return this.state[field] as T;
  }

  /**
   * Make this state manager readonly
   */
  makeReadonly(): void {
    this.readonly = true;
  }

  /**
   * Reset the convergence map
   */
  resetConvergenceMap(): void {
    if (this.readonly) {
      throw new Error('Cannot modify convergence map on readonly state manager');
    }
    this.convergenceMap.clear();
  }
}

/**
 * Convergent Set for maintaining consistent distributed sets
 */
export class ConvergentSet<T> {
  private elements: Set<T>;
  private convergenceFunction: ConvergenceFunction<Set<T>>;

  constructor(
    convergenceFunction?: ConvergenceFunction<Set<T>>,
    initialElements?: T[]
  ) {
    this.elements = new Set(initialElements);
    this.convergenceFunction = convergenceFunction || ConvergenceFunctionRegistry.get(ConvergenceType.UNION) as ConvergenceFunction<Set<T>>;
  }

  add(element: T): void {
    this.elements.add(element);
  }

  remove(element: T): void {
    this.elements.delete(element);
  }

  has(element: T): boolean {
    return this.elements.has(element);
  }

  merge(otherSet: Set<T>): void {
    this.elements = this.convergenceFunction(this.elements, otherSet);
  }

  getElements(): T[] {
    return Array.from(this.elements);
  }

  size(): number {
    return this.elements.size;
  }

  isEmpty(): boolean {
    return this.elements.size === 0;
  }

  clear(): void {
    this.elements.clear();
  }

  serialize(): { elements: T[] } {
    return { elements: Array.from(this.elements) };
  }

  static deserialize<T>(data: { elements: T[] }): ConvergentSet<T> {
    return new ConvergentSet<T>(undefined, data.elements);
  }
}

/**
 * Convergent Map for maintaining consistent distributed maps
 */
export class ConvergentMap<K, V> {
  private map: Map<K, V>;
  private convergenceFunction: ConvergenceFunction<Map<K, V>>;

  constructor(
    convergenceFunction?: ConvergenceFunction<Map<K, V>>,
    initialEntries?: [K, V][]
  ) {
    this.map = new Map(initialEntries);
    this.convergenceFunction = convergenceFunction || ConvergenceFunctionRegistry.get(ConvergenceType.MERGE) as ConvergenceFunction<Map<K, V>>;
  }

  set(key: K, value: V): void {
    this.map.set(key, value);
  }

  get(key: K): V | undefined {
    return this.map.get(key);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  merge(otherMap: Map<K, V>): void {
    this.map = this.convergenceFunction(this.map, otherMap);
  }

  getKeys(): K[] {
    return Array.from(this.map.keys());
  }

  getValues(): V[] {
    return Array.from(this.map.values());
  }

  getEntries(): [K, V][] {
    return Array.from(this.map.entries());
  }

  size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  serialize(): { entries: [K, V][] } {
    return { entries: Array.from(this.map.entries()) };
  }

  static deserialize<K, V>(data: { entries: [K, V][] }): ConvergentMap<K, V> {
    return new ConvergentMap<K, V>(undefined, data.entries);
  }
}

/**
 * Belief Convergence Manager for handling distributed belief states
 */
export interface Belief {
  content: any;
  confidence: number;
  source: string;
  timestamp: number;
}

export class BeliefConvergenceManager {
  private beliefs: Map<string, Belief>;
  private convergenceThreshold: number;

  constructor(convergenceThreshold: number = 0.7) {
    this.beliefs = new Map();
    this.convergenceThreshold = convergenceThreshold;
  }

  /**
   * Add or update a belief
   */
  addBelief(id: string, content: any, confidence: number, source: string): void {
    const existingBelief = this.beliefs.get(id);
    
    if (existingBelief) {
      // Use convergence function to merge beliefs based on confidence
      if (confidence > existingBelief.confidence) {
        this.beliefs.set(id, {
          content,
          confidence,
          source,
          timestamp: Date.now()
        });
      }
    } else {
      this.beliefs.set(id, {
        content,
        confidence,
        source,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get a belief by ID
   */
  getBelief(id: string): Belief | undefined {
    return this.beliefs.get(id);
  }

  /**
   * Merge beliefs from another agent
   */
  mergeBeliefs(otherBeliefs: Map<string, Belief>): void {
    for (const [id, belief] of otherBeliefs.entries()) {
      const existing = this.beliefs.get(id);
      
      if (existing) {
        // Use max confidence convergence
        if (belief.confidence > existing.confidence) {
          this.beliefs.set(id, belief);
        }
      } else {
        this.beliefs.set(id, belief);
      }
    }
  }

  /**
   * Get beliefs above a certain confidence threshold
   */
  getConvergedBeliefs(): Belief[] {
    return Array.from(this.beliefs.values())
      .filter(belief => belief.confidence >= this.convergenceThreshold);
  }

  /**
   * Get all beliefs
   */
  getAllBeliefs(): Belief[] {
    return Array.from(this.beliefs.values());
  }

  /**
   * Get belief count
   */
  getBeliefCount(): number {
    return this.beliefs.size;
  }
}

/**
 * Skill Convergence Manager for handling distributed skill aggregation
 */
export interface Skill {
  name: string;
  level: number;
  experience: number;
  timestamp: number;
}

export class SkillConvergenceManager {
  private skills: Map<string, Skill>;
  private convergenceFunction: ConvergenceFunction<Skill>;

  constructor() {
    this.skills = new Map();
    // Default convergence: higher skill level wins
    this.convergenceFunction = (current, incoming) => {
      return incoming.level > current.level ? incoming : current;
    };
  }

  /**
   * Add or update a skill
   */
  addSkill(name: string, level: number, experience: number): void {
    const existingSkill = this.skills.get(name);
    
    if (existingSkill) {
      const newSkill: Skill = {
        name,
        level,
        experience,
        timestamp: Date.now()
      };
      
      const convergedSkill = this.convergenceFunction(existingSkill, newSkill);
      this.skills.set(name, convergedSkill);
    } else {
      this.skills.set(name, {
        name,
        level,
        experience,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get a skill by name
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Get all skills
   */
  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill level by name
   */
  getSkillLevel(name: string): number {
    const skill = this.skills.get(name);
    return skill ? skill.level : 0;
  }

  /**
   * Merge skills from another agent
   */
  mergeSkills(otherSkills: Map<string, Skill>): void {
    for (const [name, skill] of otherSkills.entries()) {
      const existing = this.skills.get(name);
      
      if (existing) {
        const convergedSkill = this.convergenceFunction(existing, skill);
        this.skills.set(name, convergedSkill);
      } else {
        this.skills.set(name, skill);
      }
    }
  }

  /**
   * Get skills above a certain level
   */
  getCompetentSkills(minLevel: number): Skill[] {
    return Array.from(this.skills.values())
      .filter(skill => skill.level >= minLevel);
  }
}