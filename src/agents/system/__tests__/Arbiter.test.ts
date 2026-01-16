/**
 * Agent Arbiter Tests
 *
 * Tests for Pattern 12: SHARED CONVERSATION MIDDLEWARE
 * Multi-agent arbitration to prevent pile-on
 */

import {
  AgentArbiter,
  createArbiter,
  createCandidate,
  type ArbiterCandidate,
} from '../AgentArbiter';
import type { SCMGateResult } from '../SharedConversationMiddleware';

describe('AgentArbiter', () => {
  let arbiter: AgentArbiter;

  beforeEach(() => {
    arbiter = new AgentArbiter();
  });

  describe('Candidate Ranking', () => {
    it('should rank candidates by priority * confidence', () => {
      const candidates: ArbiterCandidate[] = [
        createCandidate('ada', { shouldSpeak: true, confidence: 0.8, priority: 0.5, reasons: [] }),
        createCandidate('lea', { shouldSpeak: true, confidence: 0.6, priority: 0.9, reasons: [] }),
        createCandidate('phil', { shouldSpeak: true, confidence: 0.9, priority: 0.7, reasons: [] }),
      ];

      const ranked = arbiter.rankCandidates(candidates);

      // lea: 0.6 * 0.9 = 0.54, phil: 0.9 * 0.7 = 0.63, ada: 0.8 * 0.5 = 0.4
      expect(ranked[0].agentId).toBe('phil');
      expect(ranked[1].agentId).toBe('lea');
      expect(ranked[2].agentId).toBe('ada');
    });

    it('should filter out candidates who should not speak', () => {
      const candidates: ArbiterCandidate[] = [
        createCandidate('ada', { shouldSpeak: true, confidence: 0.8, priority: 0.5, reasons: [] }),
        createCandidate('lea', { shouldSpeak: false, confidence: 0.6, priority: 0.9, reasons: [] }),
      ];

      const ranked = arbiter.rankCandidates(candidates);

      expect(ranked.length).toBe(1);
      expect(ranked[0].agentId).toBe('ada');
    });

    it('should apply diversity bonus for different complement tags', () => {
      arbiter = createArbiter({
        strategy: 'priority_then_diversity',
        diversityWeight: 0.3,
      });

      const candidates: ArbiterCandidate[] = [
        createCandidate('ada', { shouldSpeak: true, confidence: 0.7, priority: 0.7, reasons: [] }, ['planning']),
        createCandidate('lea', { shouldSpeak: true, confidence: 0.7, priority: 0.7, reasons: [] }, ['creative']),
      ];

      const ranked = arbiter.rankCandidates(candidates);

      // Second candidate should get diversity bonus since 'creative' is different from 'planning'
      expect(ranked[1].diversityBonus).toBeGreaterThan(0);
    });
  });

  describe('Winner Selection', () => {
    it('should limit winners to maxAgentsPerTurn', () => {
      arbiter = createArbiter({ maxAgentsPerTurn: 2 });

      const candidates: ArbiterCandidate[] = [
        createCandidate('ada', { shouldSpeak: true, confidence: 0.9, priority: 0.9, reasons: [] }),
        createCandidate('lea', { shouldSpeak: true, confidence: 0.8, priority: 0.8, reasons: [] }),
        createCandidate('phil', { shouldSpeak: true, confidence: 0.7, priority: 0.7, reasons: [] }),
        createCandidate('david', { shouldSpeak: true, confidence: 0.6, priority: 0.6, reasons: [] }),
      ];

      const result = arbiter.selectWinners(candidates);

      expect(result.winners.length).toBe(2);
      expect(result.losers.length).toBe(2);
      expect(result.pileOnPrevented).toBe(true);
    });

    it('should return empty winners when no eligible candidates', () => {
      const candidates: ArbiterCandidate[] = [
        createCandidate('ada', { shouldSpeak: false, confidence: 0.9, priority: 0.9, reasons: [] }),
        createCandidate('lea', { shouldSpeak: false, confidence: 0.8, priority: 0.8, reasons: [] }),
      ];

      const result = arbiter.selectWinners(candidates);

      expect(result.winners.length).toBe(0);
      expect(result.arbitrationReason).toBe('no_eligible_candidates');
    });

    it('should track pile-on prevention in metrics', () => {
      arbiter = createArbiter({ maxAgentsPerTurn: 1 });

      const candidates: ArbiterCandidate[] = [
        createCandidate('ada', { shouldSpeak: true, confidence: 0.9, priority: 0.9, reasons: [] }),
        createCandidate('lea', { shouldSpeak: true, confidence: 0.8, priority: 0.8, reasons: [] }),
      ];

      arbiter.selectWinners(candidates);
      const metrics = arbiter.getMetrics();

      expect(metrics.pileOnPrevented).toBe(1);
      expect(metrics.totalArbitrations).toBe(1);
    });
  });

  describe('Turn Budget', () => {
    it('should respect global turn budget', () => {
      arbiter = createArbiter({ globalTurnBudget: 2 });

      // Record turns
      arbiter.recordTurn('ada');
      arbiter.recordTurn('lea');

      const candidates: ArbiterCandidate[] = [
        createCandidate('phil', { shouldSpeak: true, confidence: 0.9, priority: 0.9, reasons: [] }),
      ];

      const result = arbiter.selectWinners(candidates);

      expect(result.winners.length).toBe(0);
      expect(result.arbitrationReason).toBe('global_turn_budget_exceeded');
    });

    it('should track agent selection counts', () => {
      const candidates: ArbiterCandidate[] = [
        createCandidate('ada', { shouldSpeak: true, confidence: 0.9, priority: 0.9, reasons: [] }),
      ];

      arbiter.selectWinners(candidates);
      arbiter.selectWinners(candidates);
      arbiter.selectWinners(candidates);

      const metrics = arbiter.getMetrics();

      expect(metrics.agentsSelected['ada']).toBe(3);
    });
  });

  describe('Metrics', () => {
    it('should track total arbitrations', () => {
      const candidates: ArbiterCandidate[] = [
        createCandidate('ada', { shouldSpeak: true, confidence: 0.9, priority: 0.9, reasons: [] }),
      ];

      arbiter.selectWinners(candidates);
      arbiter.selectWinners(candidates);

      const metrics = arbiter.getMetrics();

      expect(metrics.totalArbitrations).toBe(2);
    });

    it('should track arbitration latency', () => {
      const candidates: ArbiterCandidate[] = [
        createCandidate('ada', { shouldSpeak: true, confidence: 0.9, priority: 0.9, reasons: [] }),
      ];

      arbiter.selectWinners(candidates);

      const metrics = arbiter.getMetrics();

      expect(metrics.lastArbitrationMs).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics', () => {
      const candidates: ArbiterCandidate[] = [
        createCandidate('ada', { shouldSpeak: true, confidence: 0.9, priority: 0.9, reasons: [] }),
      ];

      arbiter.selectWinners(candidates);
      arbiter.resetMetrics();

      const metrics = arbiter.getMetrics();

      expect(metrics.totalArbitrations).toBe(0);
      expect(metrics.pileOnPrevented).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should allow config updates at runtime', () => {
      arbiter.updateConfig({ maxAgentsPerTurn: 3 });

      const config = arbiter.getConfig();

      expect(config.maxAgentsPerTurn).toBe(3);
    });

    it('should support round-robin strategy', () => {
      arbiter = createArbiter({ strategy: 'round_robin' });

      const candidates: ArbiterCandidate[] = [
        createCandidate('ada', { shouldSpeak: true, confidence: 0.5, priority: 0.5, reasons: [] }),
        createCandidate('lea', { shouldSpeak: true, confidence: 0.5, priority: 0.5, reasons: [] }),
      ];

      // First call
      const result1 = arbiter.selectWinners(candidates);
      // Second call should rotate
      const result2 = arbiter.selectWinners(candidates);

      // With round-robin, order should change
      expect(result1.winners[0].agentId).not.toBe(result2.winners[0].agentId);
    });
  });
});

describe('Factory Functions', () => {
  it('createArbiter should create instance with custom config', () => {
    const arbiter = createArbiter({
      maxAgentsPerTurn: 3,
      diversityWeight: 0.2,
    });

    const config = arbiter.getConfig();

    expect(config.maxAgentsPerTurn).toBe(3);
    expect(config.diversityWeight).toBe(0.2);
  });

  it('createCandidate should create candidate with complement tags', () => {
    const gate: SCMGateResult = {
      shouldSpeak: true,
      confidence: 0.8,
      priority: 0.7,
      reasons: ['test'],
    };

    const candidate = createCandidate('ada', gate, ['planning', 'coach']);

    expect(candidate.agentId).toBe('ada');
    expect(candidate.gate).toBe(gate);
    expect(candidate.complementTags).toEqual(['planning', 'coach']);
  });
});
