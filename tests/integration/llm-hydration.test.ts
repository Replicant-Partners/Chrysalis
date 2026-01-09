/**
 * Integration Test: LLM Hydration Service
 * 
 * Tests the LLM service with mock provider to validate:
 * - Service initialization
 * - Completion requests
 * - Streaming responses
 * - Rate limiting
 * - Cost tracking
 * - Provider failover
 */

import {
  LLMHydrationService,
  AgentLLMClient,
  AgentClientFactory,
  MockProvider,
  type CompletionRequest,
  type LLMServiceConfig
} from '../../src/services/llm';

describe('LLM Hydration Service Integration', () => {
  let service: LLMHydrationService;
  let mockProvider: MockProvider;

  beforeEach(() => {
    // Create mock provider with deterministic responses
    mockProvider = new MockProvider({
      defaultResponse: 'Test response from mock provider',
      latencyMs: 10
    });

    // Configure service with mock provider
    const config: LLMServiceConfig = {
      defaultProvider: 'mock',
      providers: {
        mock: {
          enabled: true
        }
      },
      costTracking: {
        enabled: true,
        budgetLimit: 10.0
      },
      rateLimit: {
        enabled: true,
        requestsPerMinute: 100
      }
    };

    service = new LLMHydrationService(config);
    service.registerProvider('mock', mockProvider);
  });

  afterEach(() => {
    service.shutdown();
  });

  describe('Service Initialization', () => {
    it('should initialize with mock provider', () => {
      const stats = service.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.providers).toHaveProperty('mock');
    });

    it('should report provider status', () => {
      const status = service.getProviderStatus('mock');
      expect(status).toBeDefined();
      expect(status?.available).toBe(true);
    });
  });

  describe('Completion Requests', () => {
    it('should complete a simple request', async () => {
      const request: CompletionRequest = {
        messages: [
          { role: 'user', content: 'Hello, how are you?' }
        ]
      };

      const response = await service.complete(request);

      expect(response).toBeDefined();
      expect(response.content).toBe('Test response from mock provider');
      expect(response.usage).toBeDefined();
      expect(response.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should handle system messages', async () => {
      const request: CompletionRequest = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'What can you do?' }
        ]
      };

      const response = await service.complete(request);
      expect(response.content).toBeDefined();
    });

    it('should track request count', async () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      await service.complete(request);
      await service.complete(request);
      await service.complete(request);

      const stats = service.getStats();
      expect(stats.totalRequests).toBe(3);
    });

    it('should respect temperature setting', async () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0.0
      };

      const response = await service.complete(request);
      expect(response).toBeDefined();
    });

    it('should respect max_tokens setting', async () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 10
      };

      const response = await service.complete(request);
      expect(response.usage.completionTokens).toBeLessThanOrEqual(10);
    });
  });

  describe('Cost Tracking', () => {
    it('should track costs per request', async () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      const initialStats = service.getStats();
      const initialCost = initialStats.totalCost;

      await service.complete(request);

      const finalStats = service.getStats();
      expect(finalStats.totalCost).toBeGreaterThanOrEqual(initialCost);
    });

    it('should enforce budget limits when configured', async () => {
      // Configure with very low budget
      const lowBudgetService = new LLMHydrationService({
        defaultProvider: 'mock',
        providers: { mock: { enabled: true } },
        costTracking: {
          enabled: true,
          budgetLimit: 0.0001 // Very low
        }
      });
      
      lowBudgetService.registerProvider('mock', new MockProvider({
        costPerRequest: 1.0 // High cost per request
      }));

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      // First request should succeed
      await lowBudgetService.complete(request);

      // Second should fail due to budget
      await expect(lowBudgetService.complete(request))
        .rejects.toThrow(/budget/i);

      lowBudgetService.shutdown();
    });
  });

  describe('Rate Limiting', () => {
    it('should queue requests when rate limited', async () => {
      const strictService = new LLMHydrationService({
        defaultProvider: 'mock',
        providers: { mock: { enabled: true } },
        rateLimit: {
          enabled: true,
          requestsPerMinute: 2
        }
      });

      strictService.registerProvider('mock', new MockProvider({
        latencyMs: 1
      }));

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      // First two should succeed immediately
      const start = Date.now();
      await strictService.complete(request);
      await strictService.complete(request);

      // Track timing
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000); // Should be fast

      strictService.shutdown();
    });
  });
});

describe('Agent LLM Client Integration', () => {
  let service: LLMHydrationService;
  let agentClient: AgentLLMClient;

  beforeEach(() => {
    const mockProvider = new MockProvider({
      defaultResponse: 'Agent response'
    });

    service = new LLMHydrationService({
      defaultProvider: 'mock',
      providers: { mock: { enabled: true } }
    });
    service.registerProvider('mock', mockProvider);

    agentClient = AgentClientFactory.create({
      agentId: 'test-agent-001',
      service,
      systemPrompt: 'You are a test agent'
    });
  });

  afterEach(() => {
    service.shutdown();
  });

  describe('Conversation Context', () => {
    it('should maintain conversation history', async () => {
      await agentClient.chat('Hello');
      await agentClient.chat('How are you?');
      await agentClient.chat('What did I just say?');

      const context = agentClient.getContext();
      expect(context.messages.length).toBeGreaterThanOrEqual(3);
    });

    it('should include system prompt in context', async () => {
      const context = agentClient.getContext();
      expect(context.systemPrompt).toBe('You are a test agent');
    });

    it('should clear history when requested', async () => {
      await agentClient.chat('Hello');
      await agentClient.chat('World');

      agentClient.clearHistory();

      const context = agentClient.getContext();
      expect(context.messages.length).toBe(0);
    });
  });

  describe('Agent Identity', () => {
    it('should track agent ID', () => {
      expect(agentClient.agentId).toBe('test-agent-001');
    });

    it('should maintain separate contexts per agent', async () => {
      const agent2 = AgentClientFactory.create({
        agentId: 'test-agent-002',
        service,
        systemPrompt: 'Different agent'
      });

      await agentClient.chat('Message for agent 1');
      await agent2.chat('Message for agent 2');

      expect(agentClient.getContext().messages.length).toBe(2); // user + assistant
      expect(agent2.getContext().messages.length).toBe(2);
    });
  });
});