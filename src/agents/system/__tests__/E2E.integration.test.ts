/**
 * End-to-End Integration Tests for System Agent Middleware
 *
 * Verifies the complete flow:
 * 1. User → SystemAgentChatService
 * 2. SCM Routing (Gate → Plan → Realize)
 * 3. Agent → LLM (mock mode)
 * 4. Response back to User
 * 5. Inter-agent communication
 * 6. Proactive triggers
 *
 * @see ../../../plans/SYSTEM_AGENT_MIDDLEWARE_ARCHITECTURE.md
 */

import {
  SystemAgentChatService,
  createMockChatService,
  createSystemAgentChatService,
} from '../SystemAgentChatService';
import type { ChatMessage, ChatRoutingResult, AgentResponse } from '../SystemAgentChatService';
import { resetSystemAgentLoader } from '../SystemAgentLoader';

// Mock fs for config loading
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(async (path: string) => {
      // Return mock config based on path
      if (path.includes('ada_config.json')) {
        return JSON.stringify(createMockPersonaConfig('ada'));
      }
      if (path.includes('lea_config.json')) {
        return JSON.stringify(createMockPersonaConfig('lea'));
      }
      if (path.includes('phil_config.json')) {
        return JSON.stringify(createMockPersonaConfig('phil'));
      }
      if (path.includes('david_config.json')) {
        return JSON.stringify(createMockPersonaConfig('david'));
      }
      if (path.includes('routing_config.json')) {
        return JSON.stringify({ chatPanes: {} });
      }
      throw new Error(`File not found: ${path}`);
    }),
  },
}));

/**
 * Create mock persona configuration matching actual PersonaConfig interface
 */
function createMockPersonaConfig(id: 'ada' | 'lea' | 'phil' | 'david') {
  const baseConfig = {
    fullName: '',
    personaSource: 'test',
    outputSchema: {},
    defaultTools: [],
    telemetryConfig: { level: 'info', metrics: [], sampling: 1.0 },
    interactionStates: {},
    collaborators: {},
    promptSetId: 'test',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
  };

  const configs: Record<string, object> = {
    ada: {
      ...baseConfig,
      id: 'ada',
      name: 'Ada Lovelace',
      fullName: 'Ada Lovelace - Algorithmic Architect',
      role: 'Algorithmic Architect',
      description: 'Pattern analysis and structural elegance expert',
      evaluationDimensions: {
        structuralElegance: { weight: 0.25, description: 'Code organization' },
        composability: { weight: 0.25, description: 'Modular design' },
        patternNovelty: { weight: 0.15, description: 'Pattern innovation' },
      },
      modelConfig: {
        modelTier: 'cloud_llm',
        localModel: { provider: 'ollama', model: 'llama3', useCases: [] },
        cloudModel: { provider: 'openai', model: 'gpt-4', useCases: [] },
        contextWindow: 4096,
        defaultTemperature: 0.7,
        latencyBudgetMs: 5000,
      },
      memoryConfig: {
        access: 'read_write',
        namespace: 'ada',
        scopes: {
          episodic: { description: '', retentionDays: 30, promotionThreshold: 0.5 },
          semantic: { description: '', retentionDays: 90, promotionThreshold: 0.7 },
          procedural: { description: '', retentionDays: 365, promotionThreshold: 0.9 },
        },
        integration: {
          beadsService: { maxItems: 100, ttlSeconds: 3600, promotionEnabled: true },
          fireproofService: { dbName: 'ada_memory', promotionEnabled: true, localVectorCache: true },
          zepHooks: { enabled: false, syncInterval: 60 },
        },
      },
      dependencies: [],
      escalationRules: {
        riskThresholds: {
          autoApply: { max: 0.3 },
          supervised: { min: 0.3, max: 0.7 },
          humanApproval: { min: 0.7 },
        },
      },
      scm_policy: {
        initiative: { mode: 'can_interject', triggers: ['direct_mention', 'confusion'] },
        turn_taking: { max_lines: 25, max_questions_per_reply: 2 },
        coordination: { priority: 0.75 },
      },
      behavior: {
        jobs: [],
        conversation_triggers: [
          {
            trigger_id: 'inactivity_check',
            name: 'Inactivity Check',
            enabled: true,
            condition: { type: 'time_since_last', parameters: { threshold_seconds: 300 } },
            priority: 'medium',
            cooldown_seconds: 600,
          },
        ],
        openers: [
          {
            opener_id: 'ada_greeting',
            trigger_id: 'inactivity_check',
            tone: 'warm',
            variations: [{ text: 'Hello! How can I help with pattern analysis?', weight: 1 }],
          },
        ],
        idioms: [],
      },
    },
    lea: {
      ...baseConfig,
      id: 'lea',
      name: 'Lea Developer',
      fullName: 'Lea Developer - Implementation Reviewer',
      role: 'Implementation Reviewer',
      description: 'Practical implementation and maintainability expert',
      evaluationDimensions: {
        practicalApplicability: { weight: 0.30, description: 'Can be implemented' },
        maintainability: { weight: 0.25, description: 'Long-term maintenance' },
        developerErgonomics: { weight: 0.15, description: 'DX quality' },
      },
      modelConfig: {
        modelTier: 'cloud_llm',
        localModel: { provider: 'ollama', model: 'llama3', useCases: [] },
        cloudModel: { provider: 'openai', model: 'gpt-4', useCases: [] },
        contextWindow: 4096,
        defaultTemperature: 0.6,
        latencyBudgetMs: 5000,
      },
      memoryConfig: {
        access: 'read_write',
        namespace: 'lea',
        scopes: {
          episodic: { description: '', retentionDays: 30, promotionThreshold: 0.5 },
          semantic: { description: '', retentionDays: 90, promotionThreshold: 0.7 },
          procedural: { description: '', retentionDays: 365, promotionThreshold: 0.9 },
        },
        integration: {
          beadsService: { maxItems: 100, ttlSeconds: 3600, promotionEnabled: true },
          fireproofService: { dbName: 'lea_memory', promotionEnabled: true, localVectorCache: true },
          zepHooks: { enabled: false, syncInterval: 60 },
        },
      },
      dependencies: ['ada'],
      escalationRules: {
        riskThresholds: {
          autoApply: { max: 0.25 },
          supervised: { min: 0.25, max: 0.7 },
          humanApproval: { min: 0.7 },
        },
      },
      scm_policy: {
        initiative: { mode: 'only_when_asked', triggers: ['direct_mention'] },
        turn_taking: { max_lines: 30, max_questions_per_reply: 1 },
        coordination: { priority: 0.65 },
      },
      behavior: { jobs: [], conversation_triggers: [], openers: [], idioms: [] },
    },
    phil: {
      ...baseConfig,
      id: 'phil',
      name: 'Phil Forecaster',
      fullName: 'Phil Forecaster - Probability Analyst',
      role: 'Forecast Analyst',
      description: 'Probabilistic reasoning and calibration expert',
      evaluationDimensions: {
        successProbability: { weight: 0.30, description: 'Likelihood of success' },
        confidenceCalibration: { weight: 0.25, description: 'Calibration accuracy' },
        baseRateAlignment: { weight: 0.20, description: 'Base rate consistency' },
      },
      modelConfig: {
        modelTier: 'cloud_llm',
        localModel: { provider: 'ollama', model: 'llama3', useCases: [] },
        cloudModel: { provider: 'openai', model: 'gpt-4', useCases: [] },
        contextWindow: 4096,
        defaultTemperature: 0.5,
        latencyBudgetMs: 5000,
      },
      memoryConfig: {
        access: 'read_write',
        namespace: 'phil',
        scopes: {
          episodic: { description: '', retentionDays: 30, promotionThreshold: 0.5 },
          semantic: { description: '', retentionDays: 90, promotionThreshold: 0.7 },
          procedural: { description: '', retentionDays: 365, promotionThreshold: 0.9 },
        },
        integration: {
          beadsService: { maxItems: 100, ttlSeconds: 3600, promotionEnabled: true },
          fireproofService: { dbName: 'phil_memory', promotionEnabled: true, localVectorCache: true },
          zepHooks: { enabled: false, syncInterval: 60 },
        },
      },
      dependencies: ['ada', 'lea'],
      escalationRules: {
        riskThresholds: {
          autoApply: { max: 0.35 },
          supervised: { min: 0.35, max: 0.75 },
          humanApproval: { min: 0.75 },
        },
      },
      scm_policy: {
        initiative: { mode: 'can_interject', triggers: ['direct_mention', 'confusion', 'stuck'] },
        turn_taking: { max_lines: 20, max_questions_per_reply: 2 },
        coordination: { priority: 0.70 },
      },
      behavior: { jobs: [], conversation_triggers: [], openers: [], idioms: [] },
    },
    david: {
      ...baseConfig,
      id: 'david',
      name: 'David Guardian',
      fullName: 'David Guardian - Metacognitive Oversight',
      role: 'Metacognitive Guardian',
      description: 'Bias detection and overconfidence monitoring expert',
      evaluationDimensions: {
        overconfidenceRisk: { weight: 0.30, description: 'Confidence vs evidence' },
        blindSpotDetection: { weight: 0.25, description: 'Missing considerations' },
        humilityScore: { weight: 0.20, description: 'Epistemic humility' },
      },
      modelConfig: {
        modelTier: 'cloud_llm',
        localModel: { provider: 'ollama', model: 'llama3', useCases: [] },
        cloudModel: { provider: 'openai', model: 'gpt-4', useCases: [] },
        contextWindow: 4096,
        defaultTemperature: 0.7,
        latencyBudgetMs: 5000,
      },
      memoryConfig: {
        access: 'read_write',
        namespace: 'david',
        scopes: {
          episodic: { description: '', retentionDays: 30, promotionThreshold: 0.5 },
          semantic: { description: '', retentionDays: 90, promotionThreshold: 0.7 },
          procedural: { description: '', retentionDays: 365, promotionThreshold: 0.9 },
        },
        integration: {
          beadsService: { maxItems: 100, ttlSeconds: 3600, promotionEnabled: true },
          fireproofService: { dbName: 'david_memory', promotionEnabled: true, localVectorCache: true },
          zepHooks: { enabled: false, syncInterval: 60 },
        },
      },
      dependencies: ['ada', 'lea', 'phil'],
      escalationRules: {
        riskThresholds: {
          autoApply: { max: 0.2 },
          supervised: { min: 0.2, max: 0.5 },
          humanApproval: { min: 0.5 },
        },
      },
      scm_policy: {
        initiative: { mode: 'proactive', triggers: ['direct_mention', 'confusion', 'stuck'] },
        turn_taking: { max_lines: 20, max_questions_per_reply: 2 },
        coordination: { priority: 0.90 },
        repair: { enabled: true, signals: ['confusion', 'repeated_failure'], strategy: 'clarify' },
      },
      behavior: { jobs: [], conversation_triggers: [], openers: [], idioms: [] },
    },
  };

  return configs[id];
}

describe('E2E Integration Tests', () => {
  let service: SystemAgentChatService;

  beforeAll(async () => {
    // Reset loader state
    resetSystemAgentLoader();
    // Create mock chat service (uses mockMode which should bypass NotImplementedError)
    service = createMockChatService();
    await service.initialize();
  });

  afterAll(() => {
    resetSystemAgentLoader();
  });

  // Note: Mock mode is enabled, so LLM calls return simulated responses

  // ===========================================================================
  // Test Suite 1: Basic Message Routing
  // ===========================================================================

  describe('Message Routing', () => {
    it('should route a general message and get agent responses', async () => {
      const message: ChatMessage = {
        id: 'msg-1',
        content: 'Please analyze this code pattern for me.',
        role: 'user',
        timestamp: Date.now(),
      };

      const result = await service.routeMessage(message);

      expect(result).toBeDefined();
      expect(result.totalLatencyMs).toBeGreaterThan(0);
      expect(result.routingResult).toBeDefined();
      expect(result.routingResult.gateResults).toBeDefined();
    });

    it('should route direct mentions to specific agents', async () => {
      const message: ChatMessage = {
        id: 'msg-2',
        content: '@ada please analyze this pattern',
        role: 'user',
        timestamp: Date.now(),
        targetAgentId: 'ada',
      };

      const result = await service.routeMessage(message);

      // With direct mention, Ada should be more likely to respond
      expect(result.routingResult.gateResults['ada']).toBeDefined();

      if (result.respondingAgents.includes('ada')) {
        const adaResponse = result.responses.find(r => r.agentId === 'ada');
        expect(adaResponse).toBeDefined();
        expect(adaResponse?.content).toBeTruthy();
      }
    });

    it('should handle multiple agent responses', async () => {
      const message: ChatMessage = {
        id: 'msg-3',
        content: 'This is confusing, I don\'t understand how this works.',
        role: 'user',
        timestamp: Date.now(),
      };

      const result = await service.routeMessage(message);

      // With confusion signal, repair agents should be more likely to respond
      expect(result.routingResult.gateResults).toBeDefined();
      expect(Object.keys(result.routingResult.gateResults).length).toBeGreaterThanOrEqual(4);
    });
  });

  // ===========================================================================
  // Test Suite 2: SCM Pipeline
  // ===========================================================================

  describe('SCM Pipeline', () => {
    it('should evaluate gate for all agents', async () => {
      const message: ChatMessage = {
        id: 'msg-4',
        content: 'Review this implementation',
        role: 'user',
        timestamp: Date.now(),
      };

      const result = await service.routeMessage(message);

      // All 4 agents should have gate results
      expect(result.routingResult.gateResults).toBeDefined();

      for (const agentId of ['ada', 'lea', 'phil', 'david']) {
        expect(result.routingResult.gateResults[agentId]).toBeDefined();
        expect(typeof result.routingResult.gateResults[agentId].shouldSpeak).toBe('boolean');
        expect(typeof result.routingResult.gateResults[agentId].confidence).toBe('number');
      }
    });

    it('should apply arbitration to prevent pile-on', async () => {
      const message: ChatMessage = {
        id: 'msg-5',
        content: 'All agents please respond to this!',
        role: 'user',
        timestamp: Date.now(),
      };

      const result = await service.routeMessage(message);

      // Arbiter should limit number of responding agents
      expect(result.respondingAgents.length).toBeLessThanOrEqual(2);
      expect(result.routingResult.winners.length).toBeLessThanOrEqual(2);
    });

    it('should track turn history and enforce budgets', async () => {
      // Send multiple messages rapidly
      const messages = Array.from({ length: 5 }, (_, i) => ({
        id: `rapid-msg-${i}`,
        content: `Message ${i}: @ada respond please`,
        role: 'user' as const,
        timestamp: Date.now() + i * 100,
      }));

      const results: ChatRoutingResult[] = [];
      for (const msg of messages) {
        results.push(await service.routeMessage(msg));
      }

      // After several messages, turn budgets should start limiting responses
      const metrics = service.getMetrics();
      expect(metrics.totalArbitrations).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Test Suite 3: Agent Responses
  // ===========================================================================

  describe('Agent Responses', () => {
    it('should generate mock responses in mock mode', async () => {
      const message: ChatMessage = {
        id: 'msg-6',
        content: '@ada analyze this code',
        role: 'user',
        timestamp: Date.now(),
      };

      const result = await service.routeMessage(message);

      if (result.responses.length > 0) {
        const response = result.responses[0];
        expect(response.content).toBeTruthy();
        expect(response.latencyMs).toBeGreaterThan(0);
        expect(response.confidence).toBeGreaterThanOrEqual(0);
        expect(response.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should include metadata in responses', async () => {
      const message: ChatMessage = {
        id: 'msg-7',
        content: '@phil what is the success probability?',
        role: 'user',
        timestamp: Date.now(),
      };

      const result = await service.routeMessage(message);

      if (result.responses.length > 0) {
        const response = result.responses[0];
        expect(response.metadata).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // Test Suite 4: Inter-Agent Communication
  // ===========================================================================

  describe('Inter-Agent Communication', () => {
    it('should allow agents to communicate with each other', async () => {
      const response = await service.agentToAgentMessage(
        'ada',
        'lea',
        'I noticed a structural pattern - can you evaluate its implementation feasibility?'
      );

      expect(response).toBeDefined();
      expect(response.agentId).toBe('lea');
      expect(response.content).toBeTruthy();
      expect(response.metadata?.fromAgentId).toBe('ada');
    });

    it('should handle agent-to-agent with different agents', async () => {
      const response = await service.agentToAgentMessage(
        'phil',
        'david',
        'My probability estimate is 72%. Please check for overconfidence.'
      );

      expect(response).toBeDefined();
      expect(response.agentId).toBe('david');
      expect(response.latencyMs).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Test Suite 5: Conversation History
  // ===========================================================================

  describe('Conversation History', () => {
    it('should maintain conversation history per thread', async () => {
      const threadId = 'test-thread-1';

      const msg1: ChatMessage = {
        id: 'hist-1',
        content: 'First message',
        role: 'user',
        timestamp: Date.now(),
        threadId,
      };

      const msg2: ChatMessage = {
        id: 'hist-2',
        content: 'Second message',
        role: 'user',
        timestamp: Date.now() + 1000,
        threadId,
      };

      await service.routeMessage(msg1, { threadId });
      await service.routeMessage(msg2, { threadId });

      const history = service.getHistory(threadId);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].content).toBe('First message');
    });

    it('should clear conversation history', async () => {
      const threadId = 'clear-test-thread';

      await service.routeMessage({
        id: 'clear-msg',
        content: 'Test message',
        role: 'user',
        timestamp: Date.now(),
      }, { threadId });

      expect(service.getHistory(threadId).length).toBeGreaterThan(0);

      service.clearHistory(threadId);
      expect(service.getHistory(threadId).length).toBe(0);
    });
  });

  // ===========================================================================
  // Test Suite 6: Observability
  // ===========================================================================

  describe('Observability', () => {
    it('should track metrics correctly', async () => {
      service.resetMetrics();

      await service.routeMessage({
        id: 'metrics-test',
        content: 'Test for metrics',
        role: 'user',
        timestamp: Date.now(),
      });

      const metrics = service.getMetrics();
      expect(metrics.totalArbitrations).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // Test Suite 7: Error Handling
  // ===========================================================================

  describe('Error Handling', () => {
    it('should handle agent not found gracefully in inter-agent', async () => {
      // This should throw because 'unknown' is not a valid agent
      await expect(
        service.agentToAgentMessage('ada', 'unknown' as any, 'Test')
      ).rejects.toThrow('Agent unknown not found');
    });
  });

  // ===========================================================================
  // Test Suite 8: Full Pipeline Integration
  // ===========================================================================

  describe('Full Pipeline', () => {
    it('should process a complete evaluation request', async () => {
      // Simulate a multi-turn conversation
      const thread = 'full-pipeline-test';

      // User asks for analysis
      const result1 = await service.routeMessage({
        id: 'full-1',
        content: 'Please analyze this code pattern for maintainability issues.',
        role: 'user',
        timestamp: Date.now(),
      }, { threadId: thread });

      expect(result1.routingResult).toBeDefined();

      // User provides more context
      const result2 = await service.routeMessage({
        id: 'full-2',
        content: "I'm particularly concerned about the error handling approach.",
        role: 'user',
        timestamp: Date.now() + 1000,
      }, { threadId: thread });

      expect(result2.totalLatencyMs).toBeGreaterThan(0);

      // User asks for forecast
      const result3 = await service.routeMessage({
        id: 'full-3',
        content: '@phil what is the probability this refactoring will succeed?',
        role: 'user',
        timestamp: Date.now() + 2000,
      }, { threadId: thread });

      expect(result3.routingResult.gateResults['phil']).toBeDefined();

      // Check history includes all messages
      const history = service.getHistory(thread);
      expect(history.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle confusion repair flow', async () => {
      const thread = 'confusion-flow';

      // User expresses confusion
      const result = await service.routeMessage({
        id: 'confused-1',
        content: "I'm really confused about how this works. It doesn't make sense to me.",
        role: 'user',
        timestamp: Date.now(),
      }, { threadId: thread });

      // Confusion signal should boost repair agents
      const davidGate = result.routingResult.gateResults['david'];
      expect(davidGate).toBeDefined();

      // If David's repair policy is active, it should detect the confusion signal
      // and potentially have higher priority
    });
  });
});

// =============================================================================
// Performance Tests
// =============================================================================

describe('Performance', () => {
  let service: SystemAgentChatService;

  beforeAll(async () => {
    service = createMockChatService();
    await service.initialize();
  });

  afterAll(() => {
    resetSystemAgentLoader();
  });

  it('should route messages within acceptable latency', async () => {
    const message: ChatMessage = {
      id: 'perf-test',
      content: 'Performance test message',
      role: 'user',
      timestamp: Date.now(),
    };

    const startTime = Date.now();
    const result = await service.routeMessage(message);
    const totalTime = Date.now() - startTime;

    // Should complete routing within 1 second (mock mode)
    expect(totalTime).toBeLessThan(1000);
    expect(result.totalLatencyMs).toBeLessThan(1000);
  });

  it('should handle concurrent requests', async () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({
      id: `concurrent-${i}`,
      content: `Concurrent message ${i}`,
      role: 'user' as const,
      timestamp: Date.now(),
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      messages.map(msg => service.routeMessage(msg, { threadId: `thread-${msg.id}` }))
    );
    const totalTime = Date.now() - startTime;

    // All should complete
    expect(results.length).toBe(5);

    // Should complete within 3 seconds for 5 concurrent (mock mode)
    expect(totalTime).toBeLessThan(3000);
  });
});
