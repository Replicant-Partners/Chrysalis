/**
 * Threshold and voting operations for Byzantine agreement
 * 
 * Implements vote counting, supermajority detection, and Byzantine-resistant consensus
 */

export interface Vote {
  nodeId: string;
  value: any;
  signature?: string;  // Optional cryptographic signature
}

export interface VoteCount {
  [value: string]: number;
}

/**
 * Count votes by value
 */
export function countVotes(votes: Vote[]): VoteCount {
  const counts: VoteCount = {};
  
  for (const vote of votes) {
    const key = JSON.stringify(vote.value);
    counts[key] = (counts[key] || 0) + 1;
  }
  
  return counts;
}

/**
 * Get the value with the most votes
 */
export function majorityValue(votes: Vote[]): any | null {
  if (votes.length === 0) {
    return null;
  }
  
  const counts = countVotes(votes);
  
  let maxCount = 0;
  let maxValue: string | null = null;
  
  for (const [value, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxValue = value;
    }
  }
  
  return maxValue ? JSON.parse(maxValue) : null;
}

/**
 * Check if a value has reached supermajority (>threshold of total)
 * 
 * For Byzantine agreement, threshold is typically 2/3 (0.667)
 * This tolerates f < n/3 Byzantine nodes
 */
export function hasSupermajority(
  votes: Vote[],
  value: any,
  threshold: number = 2/3
): boolean {
  if (votes.length === 0) {
    return false;
  }
  
  if (threshold <= 0 || threshold > 1) {
    throw new Error('Threshold must be between 0 and 1');
  }
  
  const valueKey = JSON.stringify(value);
  const counts = countVotes(votes);
  const count = counts[valueKey] || 0;
  
  return count / votes.length > threshold;
}

/**
 * Check if any value has reached supermajority
 */
export function hasAnySupermajority(votes: Vote[], threshold: number = 2/3): boolean {
  if (votes.length === 0) {
    return false;
  }
  
  const counts = countVotes(votes);
  const requiredVotes = Math.ceil(votes.length * threshold);
  
  for (const count of Object.values(counts)) {
    if (count >= requiredVotes) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the value with supermajority, or null if none
 */
export function supermajorityValue(votes: Vote[], threshold: number = 2/3): any | null {
  if (votes.length === 0) {
    return null;
  }
  
  const counts = countVotes(votes);
  const requiredVotes = Math.ceil(votes.length * threshold);
  
  for (const [value, count] of Object.entries(counts)) {
    if (count >= requiredVotes) {
      return JSON.parse(value);
    }
  }
  
  return null;
}

/**
 * Byzantine agreement: determine consensus value
 * 
 * Returns the value with >2/3 agreement, or null if no consensus
 * 
 * Byzantine tolerance: Can handle f < n/3 malicious nodes
 * - n nodes total
 * - f Byzantine nodes
 * - Need >2f + 1 honest nodes for 2/3 majority
 */
export function byzantineAgreement(votes: Vote[], totalNodes: number): any | null {
  if (totalNodes < 1) {
    throw new Error('Total nodes must be positive');
  }
  
  if (votes.length === 0) {
    return null;
  }
  
  // Require 2/3 of total nodes (not just votes)
  const counts = countVotes(votes);
  const requiredVotes = Math.ceil(totalNodes * 2 / 3);
  
  for (const [value, count] of Object.entries(counts)) {
    if (count >= requiredVotes) {
      return JSON.parse(value);
    }
  }
  
  return null;
}

/**
 * Calculate Byzantine fault tolerance threshold
 * 
 * Given n nodes, returns f (max Byzantine nodes) where f < n/3
 */
export function byzantineThreshold(totalNodes: number): number {
  if (totalNodes < 1) {
    throw new Error('Total nodes must be positive');
  }
  
  // f < n/3, so f = floor((n-1)/3)
  return Math.floor((totalNodes - 1) / 3);
}

/**
 * Check if number of votes is sufficient for Byzantine agreement
 * 
 * Need at least 2f + 1 votes (where f is max Byzantine nodes)
 */
export function sufficientVotes(voteCount: number, totalNodes: number): boolean {
  const f = byzantineThreshold(totalNodes);
  return voteCount >= 2 * f + 1;
}

/**
 * Detect conflicting votes from same node (Byzantine behavior)
 */
export function detectConflicts(votes: Vote[]): Map<string, any[]> {
  const votesByNode = new Map<string, any[]>();
  
  for (const vote of votes) {
    if (!votesByNode.has(vote.nodeId)) {
      votesByNode.set(vote.nodeId, []);
    }
    votesByNode.get(vote.nodeId)!.push(vote.value);
  }
  
  // Find nodes with conflicting votes
  const conflicts = new Map<string, any[]>();
  
  for (const [nodeId, values] of votesByNode.entries()) {
    if (values.length > 1) {
      // Check if values are different
      const uniqueValues = new Set(values.map(v => JSON.stringify(v)));
      if (uniqueValues.size > 1) {
        conflicts.set(nodeId, values);
      }
    }
  }
  
  return conflicts;
}

/**
 * Filter out conflicting votes (keep only first vote per node)
 */
export function filterConflicts(votes: Vote[]): Vote[] {
  const seenNodes = new Set<string>();
  const filtered: Vote[] = [];
  
  for (const vote of votes) {
    if (!seenNodes.has(vote.nodeId)) {
      filtered.push(vote);
      seenNodes.add(vote.nodeId);
    }
  }
  
  return filtered;
}
