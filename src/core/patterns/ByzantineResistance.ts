/**
 * Pattern #8: Threshold/Supermajority (Byzantine Resistance)
 * 
 * Universal Pattern: Collective decision thresholds
 * Natural Analogy: Immune system activation, quorum sensing
 * Mathematical Property: 2/3 Byzantine tolerance bound
 * 
 * Application: Verification thresholds, quorum operations, consensus
 */

/**
 * Byzantine-resistant aggregation functions
 * From DEEP_RESEARCH_SECURITY_ATTACKS.md, Defense mechanisms
 */

/**
 * Trimmed mean (removes outliers)
 * Resistant to up to trimPercent Byzantine nodes
 */
export function trimmedMean(values: number[], trimPercent: number = 0.2): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const trimCount = Math.floor(values.length * trimPercent);
  
  if (trimCount * 2 >= sorted.length) {
    // Would trim everything, just use median
    return median(values);
  }
  
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  return trimmed.reduce((sum, v) => sum + v, 0) / trimmed.length;
}

/**
 * Median (Byzantine-resistant to < 50% Byzantine)
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Check if supermajority reached (2/3 threshold)
 */
export function hasSupermajority(
  yesVotes: number,
  totalVotes: number,
  threshold: number = 2 / 3
): boolean {
  if (totalVotes === 0) return false;
  return (yesVotes / totalVotes) >= threshold;
}

/**
 * Count votes and check threshold
 */
export interface VoteResult {
  yes: number;
  no: number;
  total: number;
  supermajority: boolean;
  threshold: number;
}

export function countVotes(
  votes: boolean[],
  threshold: number = 2 / 3
): VoteResult {
  const yes = votes.filter(v => v === true).length;
  const no = votes.filter(v => v === false).length;
  const total = votes.length;
  
  return {
    yes,
    no,
    total,
    supermajority: hasSupermajority(yes, total, threshold),
    threshold
  };
}

/**
 * Quorum operations (require k-of-n agreement)
 */
export interface QuorumResult<T> {
  success: boolean;
  value?: T;
  quorum_reached: boolean;
  responses: number;
  required: number;
}

export async function quorumOperation<T>(
  operation: () => Promise<T>,
  instances: any[],
  quorumSize: number
): Promise<QuorumResult<T>> {
  const results = await Promise.allSettled(
    instances.map(inst => operation())
  );
  
  const successes = results.filter(r => r.status === 'fulfilled');
  
  if (successes.length >= quorumSize) {
    // Quorum reached, return first successful result
    const firstSuccess = successes[0] as PromiseFulfilledResult<T>;
    return {
      success: true,
      value: firstSuccess.value,
      quorum_reached: true,
      responses: successes.length,
      required: quorumSize
    };
  }
  
  return {
    success: false,
    quorum_reached: false,
    responses: successes.length,
    required: quorumSize
  };
}

/**
 * Byzantine agreement (requires > 2/3)
 * From DEEP_RESEARCH_MATHEMATICAL_FOUNDATIONS.md, Theorem 3
 */
export function byzantineAgreement<T>(
  values: T[],
  comparator: (a: T, b: T) => boolean = (a, b) => a === b
): T | null {
  if (values.length === 0) return null;
  
  // Count occurrences
  const counts = new Map<T, number>();
  for (const value of values) {
    let found = false;
    for (const [key, count] of counts) {
      if (comparator(key, value)) {
        counts.set(key, count + 1);
        found = true;
        break;
      }
    }
    if (!found) {
      counts.set(value, 1);
    }
  }
  
  // Find supermajority
  const threshold = (2 / 3) * values.length;
  for (const [value, count] of counts) {
    if (count >= threshold) {
      return value;
    }
  }
  
  return null;  // No supermajority
}

/**
 * Verify knowledge with threshold confidence
 * Pattern #8 applied to agent knowledge
 */
export interface KnowledgeVerification {
  verified: boolean;
  confidence: number;
  sources: number;
  threshold_met: boolean;
}

export function verifyKnowledge(
  knowledge: {
    confidence: number;
    sources: number;
    verification_count: number;
  },
  thresholds: {
    confidence: number;
    min_sources: number;
    min_verifications: number;
  } = {
    confidence: 0.7,
    min_sources: 2,
    min_verifications: 3
  }
): KnowledgeVerification {
  const verified = 
    knowledge.confidence >= thresholds.confidence &&
    knowledge.sources >= thresholds.min_sources &&
    knowledge.verification_count >= thresholds.min_verifications;
  
  return {
    verified,
    confidence: knowledge.confidence,
    sources: knowledge.sources,
    threshold_met: verified
  };
}

/**
 * Skill mastery threshold
 */
export function isSkillMastered(
  proficiency: number,
  masterThreshold: number = 0.9
): boolean {
  return proficiency >= masterThreshold;
}
