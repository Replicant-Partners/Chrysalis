/**
 * Multi-Agent Arbiter
 *
 * Pattern 12: SHARED CONVERSATION MIDDLEWARE
 * Prevents pile-on by ranking candidates and enforcing turn budgets.
 *
 * @see ../../../Borrowed_Ideas/SYSTEM_AGENT_MIDDLEWARE_DESIGN.md
 *
 * Key responsibilities:
 * - Rank candidates by priority and confidence
 * - Apply diversity bonus for complementary agents
 * - Enforce per-turn winner limits
 * - Track metrics for observability
 */

import type { SCMGateResult } from './SharedConversationMiddleware';
import type { CoordinationTag } from './types';

// =============================================================================
// Types
// =============================================================================

export interface ArbiterCandidate {
  agentId: string;
  gate: SCMGateResult;
  complementTags?: CoordinationTag[];
}

export interface CandidateRanking {
  agentId: string;
  score: number;
  gateOutput: SCMGateResult;
  diversityBonus: number;
}

export interface ArbiterResult {
  winners: CandidateRanking[];
  losers: CandidateRanking[];
  pileOnPrevented: boolean;
  arbitrationReason: string;
}

export interface ArbiterConfig {
  strategy: 'priority_first' | 'priority_then_diversity' | 'round_robin';
  maxAgentsPerTurn: number;
  diversityWeight: number;
  globalTurnBudget: number;
}

export interface ArbiterMetrics {
  totalArbitrations: number;
  agentsSelected: Record<string, number>;
  pileOnPrevented: number;
  diversityBonusApplied: number;
  budgetEnforcements: number;
  lastArbitrationMs: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_ARBITER_CONFIG: ArbiterConfig = {
  strategy: 'priority_then_diversity',
  maxAgentsPerTurn: 2,
  diversityWeight: 0.15,
  globalTurnBudget: 5,
};

// =============================================================================
// AgentArbiter Implementation
// =============================================================================

export class AgentArbiter {
  private config: ArbiterConfig;
  private metrics: ArbiterMetrics;
  private turnHistory: Array<{ agentId: string; timestamp: number }> = [];
  private roundRobinIndex: number = 0;

  constructor(config?: Partial<ArbiterConfig>) {
    this.config = { ...DEFAULT_ARBITER_CONFIG, ...config };
    this.metrics = {
      totalArbitrations: 0,
      agentsSelected: {},
      pileOnPrevented: 0,
      diversityBonusApplied: 0,
      budgetEnforcements: 0,
      lastArbitrationMs: 0,
    };
  }

  /**
   * Calculate diversity bonus based on complement tags
   *
   * Agents with different complement tags get a bonus to encourage
   * diverse perspectives in multi-agent scenarios.
   */
  private calculateDiversityBonus(
    candidate: ArbiterCandidate,
    selectedTags: Set<CoordinationTag>
  ): number {
    if (!candidate.complementTags || candidate.complementTags.length === 0) {
      return 0;
    }

    // Bonus for tags not yet represented
    const newTags = candidate.complementTags.filter(t => !selectedTags.has(t));
    const bonus = (newTags.length / candidate.complementTags.length) * this.config.diversityWeight;

    return bonus;
  }

  /**
   * Rank candidates by score (priority * confidence) with optional diversity bonus
   */
  rankCandidates(candidates: ArbiterCandidate[]): CandidateRanking[] {
    // Filter to only candidates who should speak
    const eligible = candidates.filter(c => c.gate.shouldSpeak);

    if (eligible.length === 0) {
      return [];
    }

    // Calculate initial scores
    const rankings: CandidateRanking[] = eligible.map(candidate => ({
      agentId: candidate.agentId,
      score: (candidate.gate.priority ?? 0.5) * candidate.gate.confidence,
      gateOutput: candidate.gate,
      diversityBonus: 0,
    }));

    // Apply diversity bonus for priority_then_diversity strategy
    if (this.config.strategy === 'priority_then_diversity') {
      const selectedTags = new Set<CoordinationTag>();

      // Sort by initial score
      rankings.sort((a, b) => b.score - a.score);

      // Apply diversity bonus iteratively
      for (const ranking of rankings) {
        const candidate = candidates.find(c => c.agentId === ranking.agentId);
        if (candidate) {
          ranking.diversityBonus = this.calculateDiversityBonus(candidate, selectedTags);
          ranking.score += ranking.diversityBonus;

          if (ranking.diversityBonus > 0) {
            this.metrics.diversityBonusApplied++;
          }

          // Add this candidate's tags to selected set
          candidate.complementTags?.forEach(t => selectedTags.add(t));
        }
      }
    }

    // Final sort by score
    rankings.sort((a, b) => b.score - a.score);

    // Round-robin override
    if (this.config.strategy === 'round_robin' && rankings.length > 0) {
      const rotated = [
        ...rankings.slice(this.roundRobinIndex % rankings.length),
        ...rankings.slice(0, this.roundRobinIndex % rankings.length),
      ];
      this.roundRobinIndex++;
      return rotated;
    }

    return rankings;
  }

  /**
   * Select winners from ranked candidates
   *
   * Enforces:
   * - maxAgentsPerTurn limit
   * - globalTurnBudget for total messages
   */
  selectWinners(candidates: ArbiterCandidate[]): ArbiterResult {
    const startTime = Date.now();
    this.metrics.totalArbitrations++;

    const ranked = this.rankCandidates(candidates);

    if (ranked.length === 0) {
      return {
        winners: [],
        losers: [],
        pileOnPrevented: false,
        arbitrationReason: 'no_eligible_candidates',
      };
    }

    // Check global turn budget
    const recentTurns = this.getRecentTurns(60000); // Last minute
    if (recentTurns >= this.config.globalTurnBudget) {
      this.metrics.budgetEnforcements++;
      return {
        winners: [],
        losers: ranked,
        pileOnPrevented: true,
        arbitrationReason: 'global_turn_budget_exceeded',
      };
    }

    // Select up to maxAgentsPerTurn winners
    const winnersCount = Math.min(this.config.maxAgentsPerTurn, ranked.length);
    const winners = ranked.slice(0, winnersCount);
    const losers = ranked.slice(winnersCount);

    // Track pile-on prevention
    const pileOnPrevented = losers.length > 0;
    if (pileOnPrevented) {
      this.metrics.pileOnPrevented++;
    }

    // Update selection metrics
    for (const winner of winners) {
      this.metrics.agentsSelected[winner.agentId] =
        (this.metrics.agentsSelected[winner.agentId] || 0) + 1;
    }

    this.metrics.lastArbitrationMs = Date.now() - startTime;

    return {
      winners,
      losers,
      pileOnPrevented,
      arbitrationReason: pileOnPrevented
        ? `selected_top_${winnersCount}_of_${ranked.length}`
        : 'all_eligible_selected',
    };
  }

  /**
   * Record that an agent responded
   */
  recordTurn(agentId: string): void {
    this.turnHistory.push({
      agentId,
      timestamp: Date.now(),
    });

    // Keep only last 100 turns to prevent memory growth
    if (this.turnHistory.length > 100) {
      this.turnHistory = this.turnHistory.slice(-100);
    }
  }

  /**
   * Get number of turns in the time window
   */
  private getRecentTurns(windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    return this.turnHistory.filter(t => t.timestamp > cutoff).length;
  }

  /**
   * Get arbitration metrics for observability
   */
  getMetrics(): ArbiterMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalArbitrations: 0,
      agentsSelected: {},
      pileOnPrevented: 0,
      diversityBonusApplied: 0,
      budgetEnforcements: 0,
      lastArbitrationMs: 0,
    };
    this.turnHistory = [];
    this.roundRobinIndex = 0;
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<ArbiterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ArbiterConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an AgentArbiter instance with custom config
 */
export function createArbiter(config?: Partial<ArbiterConfig>): AgentArbiter {
  return new AgentArbiter(config);
}

/**
 * Create an arbiter candidate from gate result
 */
export function createCandidate(
  agentId: string,
  gate: SCMGateResult,
  complementTags?: CoordinationTag[]
): ArbiterCandidate {
  return {
    agentId,
    gate,
    complementTags,
  };
}
