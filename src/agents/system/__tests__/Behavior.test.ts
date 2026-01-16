/**
 * Behavior Configuration Tests
 *
 * Tests for Pattern 13: AGENT BEHAVIOR CONFIG
 * - TriggerEvaluator
 * - OpenerSelector
 * - IdiomRegistry
 */

import {
  TriggerEvaluator,
  createTriggerEvaluator,
  createSystemContext,
  type SystemContext,
} from '../TriggerEvaluator';
import {
  OpenerSelector,
  createOpenerSelector,
  createSelectionContext,
  getTimeOfDay,
} from '../OpenerSelector';
import {
  IdiomRegistry,
  createIdiomRegistry,
  createIdiomContext,
} from '../IdiomRegistry';
import type {
  ConversationTrigger,
  OpenerDefinition,
  IdiomDefinition,
} from '../types';

// =============================================================================
// TriggerEvaluator Tests
// =============================================================================

describe('TriggerEvaluator', () => {
  let evaluator: TriggerEvaluator;

  beforeEach(() => {
    evaluator = createTriggerEvaluator();
  });

  describe('Time Since Last Condition', () => {
    it('should trigger when threshold exceeded', () => {
      const triggers: ConversationTrigger[] = [{
        trigger_id: 'quiet_check',
        name: 'Check after quiet period',
        condition: {
          type: 'time_since_last',
          parameters: {
            threshold_seconds: 60,
            user_active: true,
          },
        },
        cooldown_seconds: 120,
        enabled: true,
        priority: 'medium',
      }];

      const context: SystemContext = {
        currentTimeMs: Date.now(),
        lastConversationTimeMs: Date.now() - 120000, // 2 minutes ago
        userActive: true,
        recentEvents: [],
        currentMetrics: {},
      };

      const results = evaluator.evaluateTriggers('ada', triggers, context);

      expect(results[0].shouldTrigger).toBe(true);
      expect(results[0].confidence).toBeGreaterThan(0.5);
    });

    it('should not trigger when user not active', () => {
      const triggers: ConversationTrigger[] = [{
        trigger_id: 'quiet_check',
        name: 'Check after quiet period',
        condition: {
          type: 'time_since_last',
          parameters: {
            threshold_seconds: 60,
            user_active: true,
          },
        },
        cooldown_seconds: 120,
        enabled: true,
        priority: 'medium',
      }];

      const context = createSystemContext({
        lastConversationTimeMs: Date.now() - 120000,
        userActive: false,
      });

      const results = evaluator.evaluateTriggers('ada', triggers, context);

      expect(results[0].shouldTrigger).toBe(false);
    });
  });

  describe('Event Condition', () => {
    it('should trigger when event count meets threshold', () => {
      const triggers: ConversationTrigger[] = [{
        trigger_id: 'photo_batch',
        name: 'Multiple photos uploaded',
        condition: {
          type: 'event',
          parameters: {
            event_name: 'photo_uploaded',
            count_threshold: 3,
            time_window_seconds: 300,
          },
        },
        cooldown_seconds: 600,
        enabled: true,
        priority: 'high',
      }];

      const now = Date.now();
      const context = createSystemContext({
        recentEvents: [
          { name: 'photo_uploaded', timestamp: now - 60000 },
          { name: 'photo_uploaded', timestamp: now - 30000 },
          { name: 'photo_uploaded', timestamp: now - 10000 },
        ],
      });

      const results = evaluator.evaluateTriggers('ada', triggers, context);

      expect(results[0].shouldTrigger).toBe(true);
    });
  });

  describe('Metric Condition', () => {
    it('should trigger when metric exceeds threshold', () => {
      const triggers: ConversationTrigger[] = [{
        trigger_id: 'error_rate_high',
        name: 'High error rate',
        condition: {
          type: 'metric',
          parameters: {
            metric_name: 'error_rate',
            operator: 'gte',
            threshold: 0.1,
          },
        },
        cooldown_seconds: 300,
        enabled: true,
        priority: 'high',
      }];

      const context = createSystemContext({
        currentMetrics: { error_rate: 0.15 },
      });

      const results = evaluator.evaluateTriggers('ada', triggers, context);

      expect(results[0].shouldTrigger).toBe(true);
    });
  });

  describe('Cooldown Management', () => {
    it('should respect cooldown after activation', () => {
      evaluator.recordActivation('ada', 'test_trigger', 60);

      const canTrigger = evaluator.checkCooldown('ada', 'test_trigger');

      expect(canTrigger).toBe(false);
    });

    it('should allow trigger after cooldown expires', async () => {
      evaluator.recordActivation('ada', 'test_trigger', 0); // 0 second cooldown

      // Wait a tiny bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const canTrigger = evaluator.checkCooldown('ada', 'test_trigger');

      expect(canTrigger).toBe(true);
    });

    it('should report remaining cooldown time', () => {
      evaluator.recordActivation('ada', 'test_trigger', 60);

      const remaining = evaluator.getCooldownRemaining('ada', 'test_trigger');

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60);
    });
  });
});

// =============================================================================
// OpenerSelector Tests
// =============================================================================

describe('OpenerSelector', () => {
  let selector: OpenerSelector;

  beforeEach(() => {
    selector = createOpenerSelector();
  });

  describe('Opener Loading', () => {
    it('should load openers by trigger ID', () => {
      const openers: OpenerDefinition[] = [{
        opener_id: 'greeting_opener',
        trigger_id: 'morning_check',
        variations: [
          { text: 'Good morning!', weight: 1.0 },
        ],
        tone: 'warm',
      }];

      selector.loadOpeners(openers);

      const triggerIds = selector.getLoadedTriggerIds();
      expect(triggerIds).toContain('morning_check');
    });
  });

  describe('Opener Selection', () => {
    it('should select opener for matching trigger', () => {
      const openers: OpenerDefinition[] = [{
        opener_id: 'quiet_opener',
        trigger_id: 'quiet_check',
        variations: [
          { text: 'It has been quiet. Want to explore?', weight: 1.0 },
          { text: 'Ready to dive in?', weight: 0.5 },
        ],
        follow_up_prompt: 'What would you like to do?',
        tone: 'curious',
      }];

      selector.loadOpeners(openers);
      const context = createSelectionContext();

      const selection = selector.selectOpener('quiet_check', context);

      expect(selection).not.toBeNull();
      expect(selection?.triggerId).toBe('quiet_check');
      expect(selection?.tone).toBe('curious');
      expect(selection?.followUpPrompt).toBe('What would you like to do?');
    });

    it('should filter by time_of_day condition', () => {
      const openers: OpenerDefinition[] = [{
        opener_id: 'time_opener',
        trigger_id: 'check_in',
        variations: [
          { text: 'Good morning!', weight: 1.0, conditions: { time_of_day: 'morning' } },
          { text: 'Good afternoon!', weight: 1.0, conditions: { time_of_day: 'afternoon' } },
        ],
        tone: 'warm',
      }];

      selector.loadOpeners(openers);

      const morningContext = createSelectionContext({ timeOfDay: 'morning' });
      const morningSelection = selector.selectOpener('check_in', morningContext);

      expect(morningSelection?.selectedText).toBe('Good morning!');

      const afternoonContext = createSelectionContext({ timeOfDay: 'afternoon' });
      const afternoonSelection = selector.selectOpener('check_in', afternoonContext);

      expect(afternoonSelection?.selectedText).toBe('Good afternoon!');
    });

    it('should return null for unknown trigger', () => {
      const selection = selector.selectOpener('unknown_trigger', createSelectionContext());

      expect(selection).toBeNull();
    });
  });

  describe('Time of Day Helper', () => {
    it('should return morning for early hours', () => {
      expect(getTimeOfDay(8)).toBe('morning');
      expect(getTimeOfDay(11)).toBe('morning');
    });

    it('should return afternoon for midday hours', () => {
      expect(getTimeOfDay(14)).toBe('afternoon');
      expect(getTimeOfDay(17)).toBe('afternoon');
    });

    it('should return evening for late hours', () => {
      expect(getTimeOfDay(20)).toBe('evening');
      expect(getTimeOfDay(2)).toBe('evening');
    });
  });
});

// =============================================================================
// IdiomRegistry Tests
// =============================================================================

describe('IdiomRegistry', () => {
  let registry: IdiomRegistry;

  beforeEach(() => {
    registry = createIdiomRegistry();
  });

  describe('Idiom Loading', () => {
    it('should load idioms for an agent', () => {
      const idioms: IdiomDefinition[] = [{
        idiom_id: 'magic_canvas',
        category: 'metaphor',
        phrases: [
          { text: 'Want to ride the magic canvas?', weight: 1.0, context: ['exploration'] },
        ],
        frequency: 'high',
        triggers: ['photo_exploration'],
      }];

      registry.loadIdioms('rosie', idioms);

      const loaded = registry.getIdiomsForAgent('rosie');
      expect(loaded.length).toBe(1);
    });
  });

  describe('Idiom Selection', () => {
    it('should select idiom when context matches trigger', () => {
      const idioms: IdiomDefinition[] = [{
        idiom_id: 'quiet_worry',
        category: 'complaint',
        phrases: [
          { text: 'It worries me when it is quiet.', weight: 1.0, context: ['check_in'] },
        ],
        frequency: 'high',
        triggers: ['check_in'],
      }];

      registry.loadIdioms('rosie', idioms);

      const context = createIdiomContext('rosie', {
        conversationContext: ['check_in'],
      });

      const selection = registry.selectIdiom(context);

      expect(selection).not.toBeNull();
      expect(selection?.idiomId).toBe('quiet_worry');
    });

    it('should respect seasonal restrictions', () => {
      const idioms: IdiomDefinition[] = [{
        idiom_id: 'holiday_greeting',
        category: 'catchphrase',
        phrases: [
          { text: 'Happy holidays!', weight: 1.0, context: [] },
        ],
        frequency: 'high',
        seasonal: { months: [12] }, // December only
        triggers: ['greeting'],
      }];

      registry.loadIdioms('rosie', idioms);

      const juneContext = createIdiomContext('rosie', {
        currentMonth: 6,
        conversationContext: ['greeting'],
      });

      const decemberContext = createIdiomContext('rosie', {
        currentMonth: 12,
        conversationContext: ['greeting'],
      });

      const juneSelection = registry.selectIdiom(juneContext);
      const decemberSelection = registry.selectIdiom(decemberContext);

      expect(juneSelection).toBeNull();
      expect(decemberSelection).not.toBeNull();
    });

    it('should return null when no idioms match context', () => {
      const idioms: IdiomDefinition[] = [{
        idiom_id: 'test',
        category: 'metaphor',
        phrases: [{ text: 'test', weight: 1.0, context: [] }],
        frequency: 'high',
        triggers: ['specific_trigger'],
      }];

      registry.loadIdioms('rosie', idioms);

      const context = createIdiomContext('rosie', {
        conversationContext: ['different_trigger'],
      });

      const selection = registry.selectIdiom(context);

      expect(selection).toBeNull();
    });
  });

  describe('Idiom Injection', () => {
    it('should inject idiom as suffix', () => {
      const idioms: IdiomDefinition[] = [{
        idiom_id: 'canvas',
        category: 'metaphor',
        phrases: [
          { text: 'Shall we explore?', weight: 1.0, context: [] },
        ],
        frequency: 'high',
        triggers: ['exploration'],
      }];

      registry.loadIdioms('rosie', idioms);

      const context = createIdiomContext('rosie', {
        conversationContext: ['exploration'],
      });

      const result = registry.injectIdiom('Here are some photos.', context, 'suffix');

      expect(result.text).toContain('Here are some photos.');
      expect(result.text).toContain('Shall we explore?');
      expect(result.idiomApplied).toBeDefined();
    });

    it('should not inject when no idiom matches', () => {
      const context = createIdiomContext('rosie', {
        conversationContext: ['unmatched'],
      });

      const result = registry.injectIdiom('Original text', context);

      expect(result.text).toBe('Original text');
      expect(result.idiomApplied).toBeUndefined();
    });
  });

  describe('Usage Tracking', () => {
    it('should track idiom usage', () => {
      const idioms: IdiomDefinition[] = [{
        idiom_id: 'test_idiom',
        category: 'catchphrase',
        phrases: [{ text: 'Test phrase', weight: 1.0, context: [] }],
        frequency: 'high',
        triggers: ['test'],
      }];

      registry.loadIdioms('rosie', idioms);

      const context = createIdiomContext('rosie', {
        conversationContext: ['test'],
      });

      registry.selectIdiom(context);

      const stats = registry.getUsageStats('test_idiom');

      expect(stats).toBeDefined();
      expect(stats?.usageCount).toBe(1);
    });
  });
});
