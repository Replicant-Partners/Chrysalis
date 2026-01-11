/**
 * Bridge Orchestrator Tests
 * 
 * Tests for the central orchestration layer including translation,
 * caching, persistence, discovery, and batch operations.
 */

import {
  BridgeOrchestrator,
  createBridgeOrchestrator,
  translate,
  storeAgent,
  getAgent
} from '../../src/bridge/orchestrator';
import { USAAdapter } from '../../src/adapters/usa-adapter';
import { LMOSAdapter } from '../../src/adapters/lmos-adapter';
import { NativeAgent, adapterRegistry } from '../../src/adapters/base-adapter';
import { TemporalRDFStore } from '../../src/rdf/temporal-store';

// ============================================================================
// Test Data
// ============================================================================

const sampleUSAAgent: Record<string, unknown> = {
  apiVersion: 'usa/v2',
  kind: 'Agent',
  metadata: {
    name: 'test-agent',
    version: '1.0.0',
    description: 'Test agent for orchestrator'
  },
  identity: {
    role: 'Test Role',
    goal: 'Test Goal'
  },
  capabilities: {
    tools: [{
      name: 'test_tool',
      description: 'A test tool'
    }]
  },
  execution: {
    llm: {
      provider: 'openai',
      model: 'gpt-4'
    }
  }
};

const sampleLMOSAgent: Record<string, unknown> = {
  '@context': 'https://www.w3.org/2022/wot/td/v1.1',
  '@type': 'Thing',
  id: 'did:web:test.com:agent:test',
  title: 'Test LMOS Agent',
  actions: {
    test_action: {
      title: 'Test Action'
    }
  },
  'lmos:llmConfig': {
    provider: 'anthropic',
    model: 'claude-3'
  }
};

// ============================================================================
// Test Suites
// ============================================================================

describe('BridgeOrchestrator', () => {
  let orchestrator: BridgeOrchestrator;
  let store: TemporalRDFStore;

  beforeEach(() => {
    store = new TemporalRDFStore();
    orchestrator = createBridgeOrchestrator({
      store,
      enableCache: true,
      autoPersist: false
    });

    // Register adapters
    orchestrator.registerAdapter(new USAAdapter());
    orchestrator.registerAdapter(new LMOSAdapter());
  });

  afterEach(async () => {
    await store.clear();
    orchestrator.clearCache();
    adapterRegistry.clear();
  });

  describe('constructor', () => {
    it('should create orchestrator with default config', () => {
      const defaultOrchestrator = new BridgeOrchestrator();
      expect(defaultOrchestrator).toBeInstanceOf(BridgeOrchestrator);
    });

    it('should accept custom configuration', () => {
      const customOrchestrator = createBridgeOrchestrator({
        enableCache: false,
        minFidelityScore: 0.9,
        autoPersist: true
      });
      expect(customOrchestrator).toBeInstanceOf(BridgeOrchestrator);
    });
  });

  describe('adapter management', () => {
    it('should register adapters', () => {
      const newOrchestrator = new BridgeOrchestrator();
      newOrchestrator.registerAdapter(new USAAdapter());
      
      expect(newOrchestrator.hasAdapter('usa')).toBe(true);
    });

    it('should unregister adapters', () => {
      expect(orchestrator.hasAdapter('usa')).toBe(true);
      
      const result = orchestrator.unregisterAdapter('usa');
      
      expect(result).toBe(true);
      expect(orchestrator.hasAdapter('usa')).toBe(false);
    });

    it('should list registered frameworks', () => {
      const frameworks = orchestrator.getRegisteredFrameworks();
      
      expect(frameworks).toContain('usa');
      expect(frameworks).toContain('lmos');
    });

    it('should get adapter for framework', () => {
      const adapter = orchestrator.getAdapter('usa');
      
      expect(adapter).toBeInstanceOf(USAAdapter);
    });

    it('should return undefined for unregistered framework', () => {
      const adapter = orchestrator.getAdapter('openai');
      
      expect(adapter).toBeUndefined();
    });
  });

  describe('translate', () => {
    it('should translate USA to LMOS', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      const result = await orchestrator.translate({
        agent: native,
        targetFramework: 'lmos'
      });

      expect(result.success).toBe(true);
      expect(result.sourceFramework).toBe('usa');
      expect(result.targetFramework).toBe('lmos');
      expect(result.result).toBeDefined();
      expect(result.result!.framework).toBe('lmos');
    });

    it('should translate LMOS to USA', async () => {
      const native: NativeAgent = {
        data: sampleLMOSAgent,
        framework: 'lmos'
      };

      const result = await orchestrator.translate({
        agent: native,
        targetFramework: 'usa'
      });

      expect(result.success).toBe(true);
      expect(result.result!.framework).toBe('usa');
    });

    it('should return fidelity score', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      const result = await orchestrator.translate({
        agent: native,
        targetFramework: 'lmos'
      });

      expect(result.fidelityScore).toBeGreaterThan(0);
      expect(result.fidelityScore).toBeLessThanOrEqual(1);
    });

    it('should return canonical representation', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      const result = await orchestrator.translate({
        agent: native,
        targetFramework: 'lmos'
      });

      expect(result.canonical).toBeDefined();
      expect(result.canonical!.quads.length).toBeGreaterThan(0);
    });

    it('should fail for unregistered source framework', async () => {
      const native: NativeAgent = {
        data: {},
        framework: 'unknown' as any
      };

      const result = await orchestrator.translate({
        agent: native,
        targetFramework: 'usa'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should fail for unregistered target framework', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      const result = await orchestrator.translate({
        agent: native,
        targetFramework: 'unknown' as any
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should persist when requested', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      const result = await orchestrator.translate({
        agent: native,
        targetFramework: 'lmos',
        persist: true
      });

      expect(result.success).toBe(true);
      expect(result.snapshotUri).toBeDefined();

      // Verify it was stored
      const stored = await store.getSnapshot('test-agent');
      expect(stored).not.toBeNull();
    });

    it('should validate when configured', async () => {
      const invalidAgent: NativeAgent = {
        data: { kind: 'Agent' }, // Missing required fields
        framework: 'usa'
      };

      const result = await orchestrator.translate({
        agent: invalidAgent,
        targetFramework: 'lmos',
        validate: true
      });

      expect(result.success).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('caching', () => {
    it('should cache translations', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      // First translation
      const result1 = await orchestrator.translate({
        agent: native,
        targetFramework: 'lmos'
      });

      // Second translation (should hit cache)
      const result2 = await orchestrator.translate({
        agent: native,
        targetFramework: 'lmos',
        useCache: true
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
    });

    it('should skip cache when useCache is false', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      // First translation
      await orchestrator.translate({
        agent: native,
        targetFramework: 'lmos'
      });

      // Second translation with cache disabled
      const result = await orchestrator.translate({
        agent: native,
        targetFramework: 'lmos',
        useCache: false
      });

      expect(result.fromCache).toBeFalsy();
    });

    it('should clear cache', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      await orchestrator.translate({
        agent: native,
        targetFramework: 'lmos'
      });

      const stats1 = orchestrator.getCacheStats();
      expect(stats1.size).toBeGreaterThan(0);

      orchestrator.clearCache();

      const stats2 = orchestrator.getCacheStats();
      expect(stats2.size).toBe(0);
    });

    it('should return cache stats', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      await orchestrator.translate({
        agent: native,
        targetFramework: 'lmos'
      });

      const stats = orchestrator.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries.length).toBe(1);
    });
  });

  describe('toCanonical and fromCanonical', () => {
    it('should convert to canonical', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      const canonical = await orchestrator.toCanonical(native);

      expect(canonical).not.toBeNull();
      expect(canonical!.quads.length).toBeGreaterThan(0);
    });

    it('should return null for unregistered framework', async () => {
      const native: NativeAgent = {
        data: {},
        framework: 'unknown' as any
      };

      const canonical = await orchestrator.toCanonical(native);

      expect(canonical).toBeNull();
    });

    it('should convert from canonical', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      const canonical = await orchestrator.toCanonical(native);
      const lmos = await orchestrator.fromCanonical(canonical!, 'lmos');

      expect(lmos).not.toBeNull();
      expect(lmos!.framework).toBe('lmos');
    });
  });

  describe('batchTranslate', () => {
    it('should translate multiple agents', async () => {
      const agents: NativeAgent[] = [
        { data: sampleUSAAgent, framework: 'usa' },
        { data: { ...sampleUSAAgent, metadata: { ...sampleUSAAgent.metadata as object, name: 'agent-2' } }, framework: 'usa' },
        { data: { ...sampleUSAAgent, metadata: { ...sampleUSAAgent.metadata as object, name: 'agent-3' } }, framework: 'usa' }
      ];

      const result = await orchestrator.batchTranslate({
        agents,
        targetFramework: 'lmos'
      });

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results.length).toBe(3);
    });

    it('should continue on error when configured', async () => {
      const agents: NativeAgent[] = [
        { data: sampleUSAAgent, framework: 'usa' },
        { data: { kind: 'Agent' }, framework: 'usa' }, // Invalid
        { data: { ...sampleUSAAgent, metadata: { ...sampleUSAAgent.metadata as object, name: 'agent-3' } }, framework: 'usa' }
      ];

      const result = await orchestrator.batchTranslate({
        agents,
        targetFramework: 'lmos',
        continueOnError: true
      });

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('should stop on error when not configured to continue', async () => {
      const agents: NativeAgent[] = [
        { data: { kind: 'Agent' }, framework: 'usa' }, // Invalid first
        { data: sampleUSAAgent, framework: 'usa' }
      ];

      const result = await orchestrator.batchTranslate({
        agents,
        targetFramework: 'lmos',
        continueOnError: false
      });

      expect(result.results.length).toBe(1); // Stopped after first
      expect(result.failed).toBe(1);
    });

    it('should support parallel execution', async () => {
      const agents: NativeAgent[] = [
        { data: sampleUSAAgent, framework: 'usa' },
        { data: { ...sampleUSAAgent, metadata: { ...sampleUSAAgent.metadata as object, name: 'agent-2' } }, framework: 'usa' }
      ];

      const result = await orchestrator.batchTranslate({
        agents,
        targetFramework: 'lmos',
        parallel: true
      });

      expect(result.succeeded).toBe(2);
    });
  });

  describe('roundTripTest', () => {
    it('should perform round-trip test', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      const result = await orchestrator.roundTripTest(native);

      expect(result.success).toBe(true);
      expect(result.fidelityScore).toBeGreaterThan(0);
      expect(result.original).toBe(native);
      expect(result.canonical).toBeDefined();
      expect(result.reconstructed).toBeDefined();
    });

    it('should throw for unregistered framework', async () => {
      const native: NativeAgent = {
        data: {},
        framework: 'unknown' as any
      };

      await expect(orchestrator.roundTripTest(native)).rejects.toThrow();
    });
  });

  describe('persistence', () => {
    it('should store agent', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      const snapshot = await orchestrator.storeAgent(native);

      expect(snapshot.agentId).toBe('test-agent');
      expect(snapshot.version).toBe(1);
    });

    it('should retrieve agent as canonical', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      await orchestrator.storeAgent(native);
      const retrieved = await orchestrator.getAgent('test-agent');

      expect(retrieved).not.toBeNull();
      expect('quads' in retrieved!).toBe(true);
    });

    it('should retrieve agent in target framework', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      await orchestrator.storeAgent(native);
      const retrieved = await orchestrator.getAgent('test-agent', 'lmos');

      expect(retrieved).not.toBeNull();
      expect('data' in retrieved!).toBe(true);
      expect((retrieved as NativeAgent).framework).toBe('lmos');
    });

    it('should return null for non-existent agent', async () => {
      const retrieved = await orchestrator.getAgent('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should get agent history', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      await orchestrator.storeAgent(native);
      await orchestrator.storeAgent(native);

      const history = await orchestrator.getAgentHistory('test-agent');

      expect(history.length).toBe(2);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
    });

    it('should delete agent', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      await orchestrator.storeAgent(native);
      const deleted = await orchestrator.deleteAgent('test-agent');

      expect(deleted).toBe(true);
      
      const retrieved = await orchestrator.getAgent('test-agent');
      expect(retrieved).toBeNull();
    });
  });

  describe('discovery', () => {
    beforeEach(async () => {
      // Store multiple agents
      await orchestrator.storeAgent({
        data: { ...sampleUSAAgent, metadata: { name: 'search-agent', description: 'Search' } },
        framework: 'usa'
      });
      await orchestrator.storeAgent({
        data: { ...sampleUSAAgent, metadata: { name: 'file-agent', description: 'File operations' } },
        framework: 'usa'
      });
    });

    it('should discover agents', async () => {
      const agents = await orchestrator.discoverAgents({});
      expect(agents.length).toBe(2);
    });

    it('should discover by name', async () => {
      const agents = await orchestrator.discoverAgents({ nameContains: 'search' });
      expect(agents.length).toBe(1);
      expect(agents[0].name).toContain('search');
    });

    it('should list agents with pagination', async () => {
      const all = await orchestrator.listAgents();
      expect(all.length).toBe(2);

      const limited = await orchestrator.listAgents({ limit: 1 });
      expect(limited.length).toBe(1);
    });
  });

  describe('validation', () => {
    it('should validate native agent', () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      const result = orchestrator.validateNative(native);

      expect(result.valid).toBe(true);
    });

    it('should return error for unregistered framework', () => {
      const native: NativeAgent = {
        data: {},
        framework: 'unknown' as any
      };

      const result = orchestrator.validateNative(native);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'NO_ADAPTER')).toBe(true);
    });
  });

  describe('compatibility', () => {
    it('should track compatibility matrix', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      await orchestrator.translate({
        agent: native,
        targetFramework: 'lmos'
      });

      const matrix = orchestrator.getCompatibilityMatrix();
      expect(matrix.length).toBeGreaterThan(0);
    });

    it('should get specific compatibility', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      await orchestrator.translate({
        agent: native,
        targetFramework: 'lmos'
      });

      const compat = orchestrator.getCompatibility('usa', 'lmos');
      expect(compat).not.toBeNull();
      expect(compat!.sourceFramework).toBe('usa');
      expect(compat!.targetFramework).toBe('lmos');
      expect(compat!.avgFidelityScore).toBeGreaterThan(0);
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      const health = await orchestrator.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.adaptersRegistered).toBe(2);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should report status', async () => {
      // Note: BridgeOrchestrator may use global adapter registry,
      // so new instances may still see adapters
      const newOrchestrator = new BridgeOrchestrator();
      const health = await newOrchestrator.getHealth();

      // Just verify it returns a valid health object
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('adaptersRegistered');
    });
  });

  describe('administrative', () => {
    it('should clear all data', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      await orchestrator.storeAgent(native);
      await orchestrator.translate({ agent: native, targetFramework: 'lmos' });

      await orchestrator.clearAll();

      const cacheStats = orchestrator.getCacheStats();
      expect(cacheStats.size).toBe(0);

      const agents = await orchestrator.listAgents();
      expect(agents.length).toBe(0);
    });

    it('should export agent as JSON', async () => {
      const native: NativeAgent = {
        data: sampleUSAAgent,
        framework: 'usa'
      };

      await orchestrator.storeAgent(native);
      const exported = await orchestrator.exportAgent('test-agent', 'usa', 'json');

      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(parsed.metadata.name).toBe('test-agent');
    });
  });
});

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe('Convenience Functions', () => {
  let store: TemporalRDFStore;

  beforeEach(() => {
    store = new TemporalRDFStore();
    // Note: convenience functions use the default bridge instance
    // For testing, we need to ensure adapters are registered
  });

  afterEach(async () => {
    await store.clear();
  });

  // Note: These tests would need the default bridge to be configured
  // In a real test environment, you'd want to mock or configure this
  
  it('should have convenience functions exported', () => {
    // Simple existence test to satisfy Jest's requirement for at least one test
    expect(typeof translate).toBe('function');
    expect(typeof storeAgent).toBe('function');
    expect(typeof getAgent).toBe('function');
  });
});
