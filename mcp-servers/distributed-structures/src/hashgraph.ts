/**
 * Hashgraph-specific operations
 * 
 * Implements virtual voting algorithm components:
 * - Round calculation
 * - Witness identification
 * - "Sees" relationships
 * - "Strongly sees" (>2/3 witnesses)
 * 
 * Based on Hedera Hashgraph whitepapers
 */

import { Graph } from 'graphlib';

export interface HashgraphEvent {
  id: string;
  nodeId: string;
  timestamp: number;
  selfParent?: string;  // Previous event from same node
  otherParent?: string; // Event from another node
  round?: number;
  witness?: boolean;
  famous?: boolean;
}

/**
 * Check if event A "sees" event B
 * 
 * A sees B if:
 * - A == B, OR
 * - There exists a path from B to A through parent edges, AND
 * - The path includes an other-parent edge (crosses nodes)
 */
export function sees(
  graph: Graph,
  events: Map<string, HashgraphEvent>,
  aId: string,
  bId: string
): boolean {
  if (aId === bId) {
    return true;
  }
  
  const eventA = events.get(aId);
  const eventB = events.get(bId);
  
  if (!eventA || !eventB) {
    return false;
  }
  
  // BFS to find path from B to A
  const visited = new Set<string>();
  const queue: Array<{ id: string; crossedNodes: boolean }> = [
    { id: bId, crossedNodes: false }
  ];
  
  while (queue.length > 0) {
    const { id, crossedNodes } = queue.shift()!;
    
    if (visited.has(id)) continue;
    visited.add(id);
    
    // Check if we reached A
    if (id === aId && crossedNodes) {
      return true;
    }
    
    const event = events.get(id);
    if (!event) continue;
    
    // Follow parent edges (going forward in time to descendants)
    const successors = graph.successors(id) || [];
    for (const succId of successors) {
      const succ = events.get(succId);
      if (!succ) continue;
      
      // Check if this edge crosses nodes (other-parent edge)
      const isOtherParent = succ.otherParent === id;
      
      queue.push({
        id: succId,
        crossedNodes: crossedNodes || isOtherParent
      });
    }
  }
  
  return false;
}

/**
 * Calculate round number for an event
 * 
 * Algorithm:
 * 1. If event has no parents, round = 0
 * 2. Otherwise, round = max(parent rounds)
 * 3. If event "strongly sees" >2/3 of previous round's witnesses, round++
 */
export function calculateRound(
  graph: Graph,
  events: Map<string, HashgraphEvent>,
  eventId: string,
  allNodeIds: string[]
): number {
  const event = events.get(eventId);
  if (!event) {
    throw new Error(`Event ${eventId} not found`);
  }
  
  // Base case: no parents = round 0
  if (!event.selfParent && !event.otherParent) {
    return 0;
  }
  
  // Get parent rounds
  const parentRounds: number[] = [];
  
  if (event.selfParent) {
    const selfParent = events.get(event.selfParent);
    if (selfParent && selfParent.round !== undefined) {
      parentRounds.push(selfParent.round);
    }
  }
  
  if (event.otherParent) {
    const otherParent = events.get(event.otherParent);
    if (otherParent && otherParent.round !== undefined) {
      parentRounds.push(otherParent.round);
    }
  }
  
  if (parentRounds.length === 0) {
    return 0;
  }
  
  const maxParentRound = Math.max(...parentRounds);
  
  // Check if strongly sees >2/3 of previous round witnesses
  const prevRoundWitnesses = findWitnesses(events, maxParentRound);
  const stronglySeen = prevRoundWitnesses.filter(wId => 
    stronglySees(graph, events, eventId, wId, allNodeIds)
  );
  
  const threshold = Math.ceil(allNodeIds.length * 2 / 3);
  
  if (stronglySeen.length >= threshold) {
    return maxParentRound + 1;
  } else {
    return maxParentRound;
  }
}

/**
 * Find witness events for a given round
 * 
 * A witness is the first event created by a node in a round
 */
export function findWitnesses(
  events: Map<string, HashgraphEvent>,
  round: number
): string[] {
  const witnessMap = new Map<string, string>(); // nodeId -> earliest event in round
  
  for (const [eventId, event] of events.entries()) {
    if (event.round === round) {
      const existing = witnessMap.get(event.nodeId);
      
      if (!existing) {
        witnessMap.set(event.nodeId, eventId);
      } else {
        // Keep the earlier one (lower timestamp)
        const existingEvent = events.get(existing)!;
        if (event.timestamp < existingEvent.timestamp) {
          witnessMap.set(event.nodeId, eventId);
        }
      }
    }
  }
  
  return Array.from(witnessMap.values());
}

/**
 * Check if event A "strongly sees" event B
 * 
 * A strongly sees B if:
 * - A sees B, AND
 * - >2/3 of witnesses in B's round can see B through A
 * 
 * This is used to determine round boundaries
 */
export function stronglySees(
  graph: Graph,
  events: Map<string, HashgraphEvent>,
  aId: string,
  bId: string,
  allNodeIds: string[]
): boolean {
  const eventB = events.get(bId);
  if (!eventB || eventB.round === undefined) {
    return false;
  }
  
  // A must see B
  if (!sees(graph, events, aId, bId)) {
    return false;
  }
  
  // Find witnesses in B's round
  const witnesses = findWitnesses(events, eventB.round);
  
  // Count how many witnesses can see B through A
  let canSeeCount = 0;
  
  for (const witnessId of witnesses) {
    // Witness must see B
    if (sees(graph, events, witnessId, bId)) {
      // AND witness must see A (path B -> A -> witness)
      if (sees(graph, events, witnessId, aId)) {
        canSeeCount++;
      }
    }
  }
  
  const threshold = Math.ceil(allNodeIds.length * 2 / 3);
  return canSeeCount >= threshold;
}

/**
 * Assign rounds to all events in topological order
 * 
 * This processes events in order and assigns round numbers
 */
export function assignRounds(
  graph: Graph,
  events: Map<string, HashgraphEvent>,
  allNodeIds: string[]
): void {
  // Get topological sort
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  function visit(node: string): void {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      throw new Error('Graph contains cycle');
    }
    
    visiting.add(node);
    
    const successors = graph.successors(node) || [];
    for (const successor of successors) {
      visit(successor);
    }
    
    visiting.delete(node);
    visited.add(node);
    sorted.unshift(node);
  }
  
  for (const eventId of events.keys()) {
    if (!visited.has(eventId)) {
      visit(eventId);
    }
  }
  
  // Assign rounds in topological order
  for (const eventId of sorted) {
    const event = events.get(eventId)!;
    event.round = calculateRound(graph, events, eventId, allNodeIds);
    event.witness = isWitness(events, eventId);
  }
}

/**
 * Check if an event is a witness
 * 
 * An event is a witness if it's the first event by its node in its round
 */
export function isWitness(
  events: Map<string, HashgraphEvent>,
  eventId: string
): boolean {
  const event = events.get(eventId);
  if (!event || event.round === undefined) {
    return false;
  }
  
  // Check if there's an earlier event from same node in same round
  for (const [otherId, other] of events.entries()) {
    if (otherId === eventId) continue;
    
    if (other.nodeId === event.nodeId && 
        other.round === event.round && 
        other.timestamp < event.timestamp) {
      return false;
    }
  }
  
  return true;
}

/**
 * Create hashgraph event
 */
export function createEvent(
  nodeId: string,
  timestamp: number,
  selfParent?: string,
  otherParent?: string,
  payload?: any
): HashgraphEvent {
  const id = `${nodeId}-${timestamp}`;
  
  return {
    id,
    nodeId,
    timestamp,
    selfParent,
    otherParent,
    round: undefined,
    witness: undefined
  };
}

/**
 * Add event to hashgraph
 */
export function addEvent(
  graph: Graph,
  events: Map<string, HashgraphEvent>,
  event: HashgraphEvent
): void {
  // Add node to graph
  graph.setNode(event.id, event);
  events.set(event.id, event);
  
  // Add parent edges
  if (event.selfParent) {
    graph.setEdge(event.selfParent, event.id);
  }
  
  if (event.otherParent) {
    graph.setEdge(event.otherParent, event.id);
  }
}

/**
 * Get consensus timestamp for an event
 * 
 * Uses median of timestamps from witnesses that can see the event
 */
export function getConsensusTimestamp(
  graph: Graph,
  events: Map<string, HashgraphEvent>,
  eventId: string
): number {
  const event = events.get(eventId);
  if (!event || event.round === undefined) {
    throw new Error('Event not found or round not assigned');
  }
  
  // Find all witnesses that can see this event
  const timestamps: number[] = [];
  
  for (const [witnessId, witness] of events.entries()) {
    if (witness.witness && sees(graph, events, witnessId, eventId)) {
      timestamps.push(witness.timestamp);
    }
  }
  
  if (timestamps.length === 0) {
    return event.timestamp;
  }
  
  // Return median
  timestamps.sort((a, b) => a - b);
  const mid = Math.floor(timestamps.length / 2);
  
  if (timestamps.length % 2 === 0) {
    return Math.floor((timestamps[mid - 1] + timestamps[mid]) / 2);
  } else {
    return timestamps[mid];
  }
}
