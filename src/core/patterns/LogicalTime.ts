/**
 * Pattern #9: Logical Time (Causal Ordering)
 * 
 * Universal Pattern: Causality in spacetime
 * Natural Analogy: Light cones, happens-before
 * Mathematical Property: Partial order, transitivity
 * 
 * Application: Experience ordering, causal consistency, event sequencing
 */

/**
 * Lamport Clock (simple logical time)
 */
export class LamportClock {
  private counter: number = 0;
  
  constructor(private nodeId: string) {}
  
  /**
   * Tick clock (local event)
   */
  tick(): number {
    this.counter++;
    return this.counter;
  }
  
  /**
   * Update clock (receive event)
   */
  update(receivedTime: number): number {
    this.counter = Math.max(this.counter, receivedTime) + 1;
    return this.counter;
  }
  
  /**
   * Get current time
   */
  getValue(): number {
    return this.counter;
  }
}

/**
 * Vector Clock (captures full causality)
 */
export class VectorClock {
  private clock: number[];
  private nodeIndex: number;
  
  constructor(
    private nodeId: string,
    private numNodes: number,
    private nodeMapping: Map<string, number>
  ) {
    this.clock = new Array(numNodes).fill(0);
    this.nodeIndex = nodeMapping.get(nodeId) || 0;
  }
  
  /**
   * Increment own counter
   */
  tick(): number[] {
    this.clock[this.nodeIndex]++;
    return [...this.clock];
  }
  
  /**
   * Merge with received clock
   */
  merge(receivedClock: number[]): number[] {
    this.clock = this.clock.map((v, i) => 
      Math.max(v, receivedClock[i] || 0)
    );
    this.clock[this.nodeIndex]++;
    return [...this.clock];
  }
  
  /**
   * Compare two vector clocks
   */
  static compare(
    vc1: number[],
    vc2: number[]
  ): 'before' | 'after' | 'concurrent' | 'equal' {
    const len = Math.max(vc1.length, vc2.length);
    let lessOrEqual = true;
    let greaterOrEqual = true;
    
    for (let i = 0; i < len; i++) {
      const v1 = vc1[i] || 0;
      const v2 = vc2[i] || 0;
      
      if (v1 > v2) lessOrEqual = false;
      if (v1 < v2) greaterOrEqual = false;
    }
    
    if (lessOrEqual && greaterOrEqual) return 'equal';
    if (lessOrEqual) return 'before';
    if (greaterOrEqual) return 'after';
    return 'concurrent';
  }
  
  /**
   * Check if concurrent
   */
  static areConcurrent(vc1: number[], vc2: number[]): boolean {
    return this.compare(vc1, vc2) === 'concurrent';
  }
  
  getValue(): number[] {
    return [...this.clock];
  }
}

/**
 * Consensus timestamp (Byzantine-resistant)
 * From DEEP_RESEARCH_MATHEMATICAL_FOUNDATIONS.md, Section 4.2
 */
export function consensusTimestamp(timestamps: number[]): number {
  // Use median (resistant to 1/3 Byzantine nodes)
  const sorted = [...timestamps].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Happens-before relationship
 */
export function happensBefore(
  event1: { lamportTime: number; vectorTime?: number[] },
  event2: { lamportTime: number; vectorTime?: number[] }
): boolean {
  // Lamport clock provides partial order
  if (event1.lamportTime >= event2.lamportTime) {
    return false;
  }
  
  // Vector clock provides precise causality
  if (event1.vectorTime && event2.vectorTime) {
    const comparison = VectorClock.compare(event1.vectorTime, event2.vectorTime);
    return comparison === 'before';
  }
  
  // Fall back to Lamport
  return event1.lamportTime < event2.lamportTime;
}

/**
 * Total ordering (for deterministic merge)
 */
export function totalOrder<T extends { lamportTime: number; id: string }>(
  events: T[]
): T[] {
  return events.sort((a, b) => {
    // Primary: Lamport time
    if (a.lamportTime !== b.lamportTime) {
      return a.lamportTime - b.lamportTime;
    }
    // Secondary: ID (lexicographic)
    return a.id.localeCompare(b.id);
  });
}
