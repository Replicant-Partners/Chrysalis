/**
 * SCMRouting Integration Tests
 *
 * Tests the complete SCM pipeline:
 * 1. Agent registration with behavior configs
 * 2. Gate evaluation using SCM policies
 * 3. Multi-agent arbitration
 * 4. Trigger-based proactive openers
 *
 * @see ../SCMRouting.ts
 * @see ../../../../Borrowed_Ideas/SYSTEM_AGENT_MIDDLEWARE_DESIGN.md
 */

// Jest globals are auto-available
import { SCMRouter, createSCMRouter, createRoutingContext } from '../SCMRouting';
import type { SystemAgentBinding, PersonaConfig, SCMPolicy, SystemAgentPersonaId } from '../types';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a minimal mock PersonaConfig for testing.
 * Uses type assertions since we only need partial data for tests.
 */
function createMockPersonaConfig(
  id: SystemAgentPersonaId,
  overrides: Record<string, unknown> = {}
): PersonaConfig {
  const base = {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    role: 'Test Agent',
    description: `Test agent ${id}`,
    thinkingStyle: 'analytical',
    coreBeliefs: ['testing'],
    evaluationDimensions: {},
    outputSchema: {},
    modelConfig: {
      modelTier: 'local_slm',
      contextWindow: 4096,
      defaultTemperature: 0.3,
      latencyBudgetMs: 2000,
      localModel: 'test-model',
      cloudModel: 'test-cloud',
    },
    defaultTools: [],
    memoryConfig: {
      access: 'read_write',
      namespace: id,
      scopes: [],
      integration: {},
    },
    telemetryConfig: {
      level: 'basic',
      metrics: [],
      sampling: 1.0,
    },
    interactionStates: {
      responsive: { description: 'Active' },
      proactive: { description: 'Initiating' },
      disengaged: { description: 'Idle' },
    },
    escalationRules: {
      riskThresholds: {
        autoApply: { max: 0.3 },
        supervised: { min: 0.3, max: 0.7 },
        humanApproval: { min: 0.7 },
      },
      criticalBypassThreshold: 0.9,
      conflictResolution: 'human_arbiter',
    },
    promptSetId: `${id}_prompts`,
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
  return base as unknown as PersonaConfig;
}

/**
 * Creates a mock SystemAgentBinding for testing.
 */
function createMockAgent(
  id: SystemAgentPersonaId,
  scmPolicy?: Record<string, unknown>,
  behavior?: PersonaConfig['behavior']
): SystemAgentBinding {
  const binding = {
    personaId: id,
    agentId: `agent-${id}`,
    config: createMockPersonaConfig(id, {
      scm_policy: scmPolicy,
      behavior,
    }),
  };
  return binding as SystemAgentBinding;
}

// =============================================================================
// Integration Tests
// =============================================================================

describe('SCMRouter Integration', () => {
  let router: SCMRouter;

  beforeEach(() => {
    router = createSCMRouter({
      maxAgentsPerTurn: 2,
      diversityWeight: 0.15,
      enableBehavior: true,
    });
  });

  describe('Agent Registration', () => {
    it('should register agents with SCM policies', () => {
      const ada = createMockAgent('ada', {
        initiative: {
          mode: 'can_interject',
          cooldown_ms: 30000,
          max_messages_10min: 5,
        },
        turn_taking: {
          priority: 0.75,
        },
      });

      const lea = createMockAgent('lea', {
        initiative: {
          mode: 'wait_for_mention',
          cooldown_ms: 20000,
          max_messages_10min: 8,
        },
        turn_taking: {
          priority: 0.65,
        },
      });

      router.registerAgent(ada);
      router.registerAgent(lea);

      // Metrics should be initialized
      const metrics = router.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Gate Evaluation', () => {
    it('should evaluate gates based on SCM policies', () => {
      const agents = [
        createMockAgent('ada', {
          initiative: { mode: 'can_interject' },
          turn_taking: { priority: 0.8 },
        }),
        createMockAgent('lea', {
          initiative: { mode: 'wait_for_mention' },
          turn_taking: { priority: 0.6 },
        }),
      ];

      for (const agent of agents) {
        router.registerAgent(agent);
      }

      const context = createRoutingContext({
        latestTurnId: 'turn-1',
        participantIds: ['user', 'ada', 'lea'],
        addressedToMe: false,
      });

      const result = router.route(agents, context);

      expect(result.gateResults).toBeDefined();
      expect(result.gateResults['ada']).toBeDefined();
      expect(result.gateResults['lea']).toBeDefined();
    });

    it('should prioritize addressed mentions', () => {
      const ada = createMockAgent('ada', {
        initiative: { mode: 'wait_for_mention' },
        turn_taking: { priority: 0.5 },
      });

      router.registerAgent(ada);

      const context = createRoutingContext({
        addressedToMe: true,
        agentId: 'ada',
      });

      const result = router.route([ada], context);

      // When addressed, agent should speak
      expect(result.gateResults['ada'].shouldSpeak).toBe(true);
    });
  });

  describe('Multi-Agent Arbitration', () => {
    it('should select winners based on priority and confidence', () => {
      const agents = [
        createMockAgent('david', {
          initiative: { mode: 'proactive_when_triggered' },
          turn_taking: { priority: 0.9 },
          coordination: { complement_tags: ['oversight'] },
        }),
        createMockAgent('ada', {
          initiative: { mode: 'can_interject' },
          turn_taking: { priority: 0.75 },
          coordination: { complement_tags: ['structural'] },
        }),
        createMockAgent('lea', {
          initiative: { mode: 'wait_for_mention' },
          turn_taking: { priority: 0.65 },
          coordination: { complement_tags: ['implementation'] },
        }),
        createMockAgent('phil', {
          initiative: { mode: 'can_interject' },
          turn_taking: { priority: 0.7 },
          coordination: { complement_tags: ['forecasting'] },
        }),
      ];

      for (const agent of agents) {
        router.registerAgent(agent);
      }

      const context = createRoutingContext({
        maxWinners: 2,
      });

      const result = router.route(agents, context);

      // Should have at most 2 winners
      expect(result.winners.length).toBeLessThanOrEqual(2);

      // Higher priority agents should be preferred
      if (result.winners.length > 0) {
        const winnerIds = result.winners.map((w) => w.agentId);
        // David (0.9) or Ada (0.75) should likely win
        expect(
          winnerIds.includes('david') || winnerIds.includes('ada')
        ).toBe(true);
      }
    });

    it('should apply diversity scoring with complement tags', () => {
      const agents = [
        createMockAgent('ada', {
          initiative: { mode: 'proactive', triggers: ['direct_mention'], cooldown_ms: 1000, max_msgs_per_10min: 100 },
          coordination: { complement_tags: ['planning'], priority: 0.7, yield_to: [] },
        }),
        createMockAgent('lea', {
          initiative: { mode: 'proactive', triggers: ['direct_mention'], cooldown_ms: 1000, max_msgs_per_10min: 100 },
          coordination: { complement_tags: ['planning'], priority: 0.7, yield_to: [] },
        }),
        createMockAgent('phil', {
          initiative: { mode: 'proactive', triggers: ['direct_mention'], cooldown_ms: 1000, max_msgs_per_10min: 100 },
          coordination: { complement_tags: ['coach'], priority: 0.65, yield_to: [] },
        }),
      ];

      for (const agent of agents) {
        router.registerAgent(agent);
      }

      // Create router with high diversity weight
      const diverseRouter = createSCMRouter({
        maxAgentsPerTurn: 2,
        diversityWeight: 0.3,
      });

      for (const agent of agents) {
        diverseRouter.registerAgent(agent);
      }

      // Use proactive mode and addressed context so gate returns shouldSpeak=true
      const context = createRoutingContext({ maxWinners: 2, addressedToMe: true });
      const result = diverseRouter.route(agents, context);

      // With diversity scoring, agent3 (different tag) should have a chance
      // even with lower priority
      expect(result.winners.length).toBeGreaterThan(0);
    });

    it('should prevent pile-on with max_agents_per_turn', () => {
      const agentIds: SystemAgentPersonaId[] = ['ada', 'lea', 'phil', 'david'];
      const agents = agentIds.map((id) =>
        createMockAgent(id, {
          initiative: { mode: 'proactive', triggers: ['direct_mention'], cooldown_ms: 1000, max_msgs_per_10min: 100 },
          coordination: { priority: 0.8, complement_tags: ['planning'], yield_to: [] },
        })
      );

      const limitedRouter = createSCMRouter({
        maxAgentsPerTurn: 1,
      });

      for (const agent of agents) {
        limitedRouter.registerAgent(agent);
      }

      // Addressed context so gate returns shouldSpeak=true for all
      const context = createRoutingContext({ addressedToMe: true });
      const result = limitedRouter.route(agents, context);

      expect(result.winners.length).toBeLessThanOrEqual(1);
      // pileOnPrevented is true when eligible agents exceed max
      expect(result.winners.length).toBe(1);
    });
  });

  describe('Turn Tracking', () => {
    it('should track turns and update metrics', () => {
      const ada = createMockAgent('ada', {
        turn_taking: { priority: 0.8 },
      });

      router.registerAgent(ada);

      const context = createRoutingContext({});

      // First route
      router.route([ada], context);
      let metrics = router.getMetrics();
      const initialArbitrations = metrics.totalArbitrations;

      // Second route
      router.route([ada], context);
      metrics = router.getMetrics();

      // Arbitrations should increase
      expect(metrics.totalArbitrations).toBeGreaterThan(initialArbitrations);
    });

    it('should track agent-specific turn counts', () => {
      const agents = [
        createMockAgent('ada', { turn_taking: { priority: 0.9 } }),
        createMockAgent('lea', { turn_taking: { priority: 0.5 } }),
      ];

      for (const agent of agents) {
        router.registerAgent(agent);
      }

      // Route multiple times
      for (let i = 0; i < 5; i++) {
        router.route(agents, createRoutingContext({}));
      }

      const metrics = router.getMetrics();

      // Ada (higher priority) should have more wins
      expect(metrics.agentsSelected['ada'] || 0).toBeGreaterThanOrEqual(
        metrics.agentsSelected['lea'] || 0
      );
    });
  });

  describe('Behavior Integration', () => {
    it('should load behavior configs from agents', () => {
      const ada = createMockAgent(
        'ada',
        {
          initiative: { mode: 'can_interject' },
        },
        {
          jobs: [
            {
              job_id: 'test_job',
              description: 'Test job',
              schedule: { type: 'interval', value: '1h' },
              priority: 'medium',
              timeout_seconds: 300,
              enabled: true,
            },
          ],
          conversation_triggers: [
            {
              trigger_id: 'test_trigger',
              condition: { type: 'event', event_name: 'test_event' },
              enabled: true,
            },
          ],
          openers: [
            {
              opener_id: 'test_opener',
              trigger_refs: ['test_trigger'],
              variations: [{ text: 'Hello!', weight: 1.0 }],
            },
          ],
          idioms: [
            {
              idiom_id: 'test_idiom',
              category: 'greeting',
              variations: [{ text: 'Greetings!', weight: 1.0 }],
            },
          ],
        }
      );

      router.registerAgent(ada);

      const behaviorLoader = router.getBehaviorLoader();
      const config = behaviorLoader.getBehaviorConfig('ada');

      expect(config).toBeDefined();
      expect(config?.jobs.length).toBe(1);
      expect(config?.conversation_triggers.length).toBe(1);
      expect(config?.openers.length).toBe(1);
      expect(config?.idioms.length).toBe(1);
    });
  });

  describe('Complete Flow Simulation', () => {
    it('should handle a complete evaluation round', () => {
      // Create the four system agents with realistic configs
      const agents = [
        createMockAgent(
          'ada',
          {
            initiative: {
              mode: 'can_interject',
              cooldown_ms: 30000,
              proactive_triggers: ['architecture_change'],
              max_messages_10min: 5,
            },
            turn_taking: { priority: 0.75 },
            coordination: {
              complement_tags: ['structural', 'algorithmic'],
              max_agents_per_turn: 2,
            },
          },
          {
            conversation_triggers: [
              {
                trigger_id: 'architecture_change',
                condition: { type: 'event', event_name: 'architecture_change' },
                enabled: true,
              },
            ],
            openers: [
              {
                opener_id: 'pattern_review',
                trigger_refs: ['architecture_change'],
                variations: [
                  {
                    text: 'I notice a structural change that warrants analysis.',
                    weight: 1.0,
                  },
                ],
              },
            ],
            idioms: [],
            jobs: [],
          }
        ),
        createMockAgent(
          'lea',
          {
            initiative: { mode: 'wait_for_mention', cooldown_ms: 20000 },
            turn_taking: { priority: 0.65 },
            coordination: { complement_tags: ['implementation', 'documentation'] },
          },
          { jobs: [], conversation_triggers: [], openers: [], idioms: [] }
        ),
        createMockAgent(
          'phil',
          {
            initiative: {
              mode: 'can_interject',
              cooldown_ms: 45000,
              proactive_triggers: ['outcome_observed'],
            },
            turn_taking: { priority: 0.7 },
            coordination: { complement_tags: ['forecasting', 'calibration'] },
          },
          { jobs: [], conversation_triggers: [], openers: [], idioms: [] }
        ),
        createMockAgent(
          'david',
          {
            initiative: {
              mode: 'proactive_when_triggered',
              cooldown_ms: 60000,
              proactive_triggers: ['high_confidence', 'unanimous_agreement'],
            },
            coordination: { complement_tags: ['critic', 'coach'], priority: 0.9, yield_to: [] },
          },
          { jobs: [], conversation_triggers: [], openers: [], idioms: [] }
        ),
      ];

      for (const agent of agents) {
        router.registerAgent(agent);
      }

      // Simulate an evaluation round
      const context = createRoutingContext({
        latestTurnId: 'turn-eval-1',
        participantIds: ['user', 'ada', 'lea', 'phil', 'david'],
        threadState: 'planning',
        maxWinners: 2,
      });

      const result = router.route(agents, context);

      // Verify structure
      expect(result.winners).toBeDefined();
      expect(result.losers).toBeDefined();
      expect(result.gateResults).toBeDefined();
      expect(result.metrics).toBeDefined();

      // At most 2 winners
      expect(result.winners.length).toBeLessThanOrEqual(2);

      // All agents should have gate results
      expect(Object.keys(result.gateResults).length).toBe(4);

      // Report
      console.log('=== Evaluation Round Results ===');
      console.log('Winners:', result.winners.map((w) => w.agentId));
      console.log('Losers:', result.losers.map((l) => l.agentId));
      console.log('Pile-on prevented:', result.pileOnPrevented);
      console.log('Reason:', result.arbitrationReason);
    });
  });
});

describe('createRoutingContext', () => {
  it('should create context with defaults', () => {
    const context = createRoutingContext();
    expect(context.agentId).toBe('system');
  });

  it('should merge provided options', () => {
    const context = createRoutingContext({
      latestTurnId: 'turn-123',
      participantIds: ['a', 'b'],
      addressedToMe: true,
    });

    expect(context.latestTurnId).toBe('turn-123');
    expect(context.participantIds).toEqual(['a', 'b']);
    expect(context.addressedToMe).toBe(true);
  });
});
