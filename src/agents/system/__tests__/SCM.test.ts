/**
 * Shared Conversational Middleware Tests
 *
 * Tests for Pattern 12: SHARED CONVERSATION MIDDLEWARE
 * - Gate function (shouldSpeak)
 * - Plan function (planIntent)
 * - Realize function (realizeStyle)
 * - Turn tracking
 */

import {
  SharedConversationMiddleware,
  createSCM,
  createSCMContext,
  type SCMContext,
  type SCMIntentType,
} from '../SharedConversationMiddleware';
import { DEFAULT_SCM_POLICY } from '../types';

describe('SharedConversationMiddleware', () => {
  let scm: SharedConversationMiddleware;

  beforeEach(() => {
    scm = new SharedConversationMiddleware();
  });

  describe('Gate Function (shouldSpeak)', () => {
    it('should return shouldSpeak=false when cooldown is active', () => {
      const context: SCMContext = {
        agentId: 'ada',
        lastSpokeAtMs: Date.now() - 1000, // 1 second ago
        // Default cooldown is 5000ms
      };

      const result = scm.shouldSpeak(context);

      expect(result.shouldSpeak).toBe(false);
      expect(result.reasons.some(r => r.includes('cooldown_active'))).toBe(true);
    });

    it('should return shouldSpeak=true when cooldown has expired', () => {
      const context: SCMContext = {
        agentId: 'ada',
        addressedToMe: true,
        lastSpokeAtMs: Date.now() - 10000, // 10 seconds ago
      };

      const result = scm.shouldSpeak(context);

      expect(result.shouldSpeak).toBe(true);
    });

    it('should return shouldSpeak=false when turn budget is exhausted', () => {
      const context: SCMContext = {
        agentId: 'ada',
        addressedToMe: true,
        messagesInLast10Min: 15, // Exceeds default max of 10
      };

      const result = scm.shouldSpeak(context);

      expect(result.shouldSpeak).toBe(false);
      expect(result.reasons.some(r => r.includes('turn_budget_exhausted'))).toBe(true);
    });

    it('should return shouldSpeak=false for only_when_asked mode if not addressed', () => {
      const conservativeSCM = createSCM({
        initiative: {
          ...DEFAULT_SCM_POLICY.initiative,
          mode: 'only_when_asked',
        },
      });

      const context: SCMContext = {
        agentId: 'ada',
        addressedToMe: false,
      };

      const result = conservativeSCM.shouldSpeak(context);

      expect(result.shouldSpeak).toBe(false);
      expect(result.reasons.some(r => r.includes('only_when_asked'))).toBe(true);
    });

    it('should increase priority when repair signals are present', () => {
      const contextWithRepair: SCMContext = {
        agentId: 'ada',
        addressedToMe: true,
        riskSignals: ['confusion'],
      };

      const contextWithoutRepair: SCMContext = {
        agentId: 'ada',
        addressedToMe: true,
        riskSignals: [],
      };

      const withRepair = scm.shouldSpeak(contextWithRepair);
      const withoutRepair = scm.shouldSpeak(contextWithoutRepair);

      expect(withRepair.priority).toBeGreaterThan(withoutRepair.priority ?? 0);
    });

    it('should set intent type to clarify on confusion signal', () => {
      const context: SCMContext = {
        agentId: 'ada',
        addressedToMe: true,
        riskSignals: ['confusion'],
      };

      const result = scm.shouldSpeak(context);

      expect(result.intentType).toBe('clarify');
    });
  });

  describe('Plan Function (planIntent)', () => {
    it('should return moves for answer intent', () => {
      const result = scm.planIntent('answer');

      expect(result.intentType).toBe('answer');
      expect(result.moves).toContain('provide_answer');
      expect(result.successCriterion).toBe('user_acknowledges');
    });

    it('should return moves for coach intent with permission asking', () => {
      const result = scm.planIntent('coach');

      expect(result.moves).toContain('ask_permission');
      expect(result.moves).toContain('offer_options');
    });

    it('should add technique selection for brainstorm intent', () => {
      const result = scm.planIntent('brainstorm');

      expect(result.moves).toContain('select_technique');
    });
  });

  describe('Realize Function (realizeStyle)', () => {
    it('should truncate text that exceeds max_lines', () => {
      const longText = Array(20).fill('This is a line.').join('\n');

      const result = scm.realizeStyle(longText, 'neutral');

      expect(result.truncated).toBe(true);
      expect(result.text.split('\n').length).toBeLessThanOrEqual(10);
    });

    it('should apply autonomy prefix when requested', () => {
      const text = 'try this approach';

      const result = scm.realizeStyle(text, 'neutral', { applyAutonomyPrefix: true });

      // Should have a prefix added
      expect(result.text.length).toBeGreaterThan(text.length);
    });

    it('should limit questions per reply', () => {
      const multiQuestion = 'What do you think? Should we proceed? Is this clear?';

      const result = scm.realizeStyle(multiQuestion, 'neutral');

      const questionCount = (result.text.match(/\?/g) || []).length;
      expect(questionCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Turn Tracking', () => {
    it('should track messages in time window', () => {
      const agentId = 'ada';

      // Record some turns
      scm.recordTurn(agentId);
      scm.recordTurn(agentId);
      scm.recordTurn(agentId);

      const count = scm.getMessagesInWindow(agentId);

      expect(count).toBe(3);
    });

    it('should return last spoke time', () => {
      const agentId = 'ada';
      const beforeRecord = Date.now();

      scm.recordTurn(agentId);

      const lastSpoke = scm.getLastSpokeAt(agentId);

      expect(lastSpoke).toBeDefined();
      expect(lastSpoke).toBeGreaterThanOrEqual(beforeRecord);
    });
  });

  describe('Policy Management', () => {
    it('should allow policy updates at runtime', () => {
      const originalPolicy = scm.getPolicy();

      scm.updatePolicy({
        initiative: {
          ...originalPolicy.initiative,
          cooldown_ms: 1000,
        },
      });

      const updatedPolicy = scm.getPolicy();

      expect(updatedPolicy.initiative.cooldown_ms).toBe(1000);
    });

    it('should select creativity technique', () => {
      const technique = scm.selectCreativityTechnique();

      expect(['SCAMPER', 'SixHats', 'analogies', 'constraints', 'random_word', 'bad_ideas_first', 'perspective_rotation', 'morphological_analysis']).toContain(technique);
    });
  });
});

describe('Factory Functions', () => {
  it('createSCM should create instance with custom policy', () => {
    const scm = createSCM({
      initiative: {
        mode: 'proactive',
        triggers: ['direct_mention'],
        cooldown_ms: 1000,
        max_msgs_per_10min: 5,
      },
    });

    const policy = scm.getPolicy();

    expect(policy.initiative.mode).toBe('proactive');
    expect(policy.initiative.cooldown_ms).toBe(1000);
  });

  it('createSCMContext should create context with defaults', () => {
    const context = createSCMContext('ada');

    expect(context.agentId).toBe('ada');
  });

  it('createSCMContext should merge options', () => {
    const context = createSCMContext('ada', {
      addressedToMe: true,
      riskSignals: ['confusion'],
    });

    expect(context.agentId).toBe('ada');
    expect(context.addressedToMe).toBe(true);
    expect(context.riskSignals).toContain('confusion');
  });
});
