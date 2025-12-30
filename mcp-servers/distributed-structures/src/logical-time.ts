/**
 * Logical time operations for distributed systems
 * 
 * Implements Lamport clocks and Vector clocks for causal ordering
 */

// ============================================================================
// Lamport Clocks
// ============================================================================

export interface LamportClock {
  nodeId: string;
  timestamp: number;
}

/**
 * Create a new Lamport clock
 */
export function createLamportClock(nodeId: string): LamportClock {
  return {
    nodeId,
    timestamp: 0
  };
}

/**
 * Increment clock for local event
 */
export function lamportTick(clock: LamportClock): LamportClock {
  return {
    ...clock,
    timestamp: clock.timestamp + 1
  };
}

/**
 * Update clock when receiving message
 * 
 * Sets clock to max(local, received) + 1
 */
export function lamportUpdate(clock: LamportClock, receivedTimestamp: number): LamportClock {
  return {
    ...clock,
    timestamp: Math.max(clock.timestamp, receivedTimestamp) + 1
  };
}

/**
 * Compare two Lamport timestamps
 * 
 * Returns:
 * - negative if t1 < t2
 * - zero if t1 == t2
 * - positive if t1 > t2
 */
export function lamportCompare(t1: number, t2: number): number {
  return t1 - t2;
}

// ============================================================================
// Vector Clocks
// ============================================================================

export interface VectorClock {
  nodeId: string;
  vector: Map<string, number>;
}

export type ClockOrdering = 'before' | 'after' | 'concurrent';

/**
 * Create a new Vector clock
 */
export function createVectorClock(nodeId: string, allNodeIds: string[]): VectorClock {
  const vector = new Map<string, number>();
  
  for (const id of allNodeIds) {
    vector.set(id, 0);
  }
  
  return {
    nodeId,
    vector
  };
}

/**
 * Increment clock for local event
 */
export function vectorIncrement(clock: VectorClock): VectorClock {
  const newVector = new Map(clock.vector);
  const current = newVector.get(clock.nodeId) || 0;
  newVector.set(clock.nodeId, current + 1);
  
  return {
    ...clock,
    vector: newVector
  };
}

/**
 * Merge with received vector clock
 * 
 * Sets each entry to max(local, received)
 * Then increments own entry
 */
export function vectorMerge(local: VectorClock, received: VectorClock): VectorClock {
  const newVector = new Map(local.vector);
  
  // Merge: take max of each entry
  for (const [nodeId, timestamp] of received.vector.entries()) {
    const localTimestamp = newVector.get(nodeId) || 0;
    newVector.set(nodeId, Math.max(localTimestamp, timestamp));
  }
  
  // Increment own entry
  const ownTimestamp = newVector.get(local.nodeId) || 0;
  newVector.set(local.nodeId, ownTimestamp + 1);
  
  return {
    ...local,
    vector: newVector
  };
}

/**
 * Compare two vector clocks
 * 
 * Returns:
 * - 'before': vc1 happened before vc2 (vc1 < vc2)
 * - 'after': vc1 happened after vc2 (vc1 > vc2)
 * - 'concurrent': vc1 and vc2 are concurrent (vc1 || vc2)
 */
export function vectorCompare(vc1: VectorClock, vc2: VectorClock): ClockOrdering {
  let vc1Less = false;
  let vc1Greater = false;
  
  // Get all node IDs from both clocks
  const allNodes = new Set([...vc1.vector.keys(), ...vc2.vector.keys()]);
  
  for (const nodeId of allNodes) {
    const t1 = vc1.vector.get(nodeId) || 0;
    const t2 = vc2.vector.get(nodeId) || 0;
    
    if (t1 < t2) {
      vc1Less = true;
    } else if (t1 > t2) {
      vc1Greater = true;
    }
    
    // Early exit if we know they're concurrent
    if (vc1Less && vc1Greater) {
      return 'concurrent';
    }
  }
  
  if (vc1Less && !vc1Greater) {
    return 'before';
  }
  
  if (vc1Greater && !vc1Less) {
    return 'after';
  }
  
  // All entries equal (or both have inconsistencies)
  return 'concurrent';
}

/**
 * Check if vc1 happened before vc2
 * 
 * True if vc1[i] <= vc2[i] for all i, and at least one strict <
 */
export function vectorHappensBefore(vc1: VectorClock, vc2: VectorClock): boolean {
  return vectorCompare(vc1, vc2) === 'before';
}

/**
 * Serialize vector clock to JSON-friendly format
 */
export function serializeVectorClock(vc: VectorClock): any {
  return {
    nodeId: vc.nodeId,
    vector: Array.from(vc.vector.entries()).reduce((obj, [k, v]) => {
      obj[k] = v;
      return obj;
    }, {} as Record<string, number>)
  };
}

/**
 * Deserialize vector clock from JSON
 */
export function deserializeVectorClock(data: any): VectorClock {
  return {
    nodeId: data.nodeId,
    vector: new Map(Object.entries(data.vector).map(([k, v]) => [k, v as number]))
  };
}

// ============================================================================
// Consensus Timestamp (Byzantine-Resistant)
// ============================================================================

/**
 * Calculate consensus timestamp from multiple node timestamps
 * 
 * Uses median for Byzantine resistance:
 * - Tolerates up to f < n/3 Byzantine nodes
 * - Cannot be manipulated by minority
 */
export function consensusTimestamp(timestamps: number[]): number {
  if (timestamps.length === 0) {
    throw new Error('Cannot calculate consensus timestamp from empty array');
  }
  
  // Sort timestamps
  const sorted = [...timestamps].sort((a, b) => a - b);
  
  // Return median
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    // Even length: average of two middle elements
    return Math.floor((sorted[mid - 1] + sorted[mid]) / 2);
  } else {
    // Odd length: middle element
    return sorted[mid];
  }
}
