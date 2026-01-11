/**
 * Service Integration Tests
 * 
 * Tests for the Bridge Service Integration layer:
 * - AdapterDiscoveryService
 * - BridgeEventBus
 * - BridgePersistenceService
 * - IntegratedBridgeService
 */

import {
  AdapterDiscoveryService,
  BridgeEventBus,
  BridgePersistenceService,
  IntegratedBridgeService,
  createIntegratedBridgeService,
  BridgeEvent,
  AgentTranslatedPayload,
  AgentIngestedPayload,
  AgentStoredPayload,
  StoredAgent,
  AgentVersion,
  TranslationRecord,
} from '../../src/bridge/service-integration';
import { BridgeOrchestrator } from '../../src/bridge/orchestrator';
import { NativeAgent, AgentFramework } from '../../src/adapters/base-adapter';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockUSAAgent = (): NativeAgent => ({
  framework: 'usa',
  data: {
    metadata: {
      name: 'Test USA Agent',
      version: '1.0.0',
      usa_version: '2.0',
      uuid: 'test-uuid-123',
    },
    persona: {
      role: 'assistant',
      description: 'A test assistant agent',
    },
    capabilities: {
      tools: [
        { name: 'search', description: 'Search capability' },
      ],
    },
  },
});

const createMockLMOSAgent = (): NativeAgent => ({
  framework: 'lmos',
  data: {
    name: 'Test LMOS Agent',
    description: 'A test LMOS agent',
    version: '1.0.0',
    providedCapabilities: [
      {
        name: 'analyze',
        description: 'Analysis capability',
        version: '1.0.0',
      },
    ],
    requiredCapabilities: [],
  },
});

// ============================================================================
// AdapterDiscoveryService Tests
// ============================================================================

describe('AdapterDiscoveryService', () => {
  let orchestrator: BridgeOrchestrator;
  let discoveryService: AdapterDiscoveryService;

  beforeEach(() => {
    orchestrator = new BridgeOrchestrator();
    discoveryService = new AdapterDiscoveryService(orchestrator, {
      healthCheckInterval: 100000, // Long interval to avoid interference
    });
  });

  afterEach(() => {
    discoveryService.stop();
  });

  describe('initialization', () => {
    it('should start and refresh adapters', () => {
      discoveryService.start();
      
      const adapters = discoveryService.listAdapters();
      expect(adapters.length).toBeGreaterThan(0);
    });

    it('should track supported frameworks', () => {
      discoveryService.start();
      
      const adapters = discoveryService.listAdapters();
      const frameworks = adapters.map(a => a.framework);
      
      expect(frameworks).toContain('usa');
      expect(frameworks).toContain('lmos');
    });

    it('should stop cleanly', () => {
      discoveryService.start();
      discoveryService.stop();
      
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('discovery', () => {
    beforeEach(() => {
      discoveryService.start();
    });

    it('should discover all adapters without query', () => {
      const adapters = discoveryService.discover();
      expect(adapters.length).toBeGreaterThan(0);
    });

    it('should filter by framework', () => {
      const adapters = discoveryService.discover({ framework: 'usa' });
      
      expect(adapters.length).toBe(1);
      expect(adapters[0].framework).toBe('usa');
    });

    it('should filter by health status', () => {
      const adapters = discoveryService.discover({ healthStatus: 'healthy' });
      
      expect(adapters.every(a => a.healthStatus === 'healthy')).toBe(true);
    });

    it('should return empty for non-existent framework', () => {
      const adapters = discoveryService.discover({ framework: 'nonexistent' as AgentFramework });
      expect(adapters.length).toBe(0);
    });
  });

  describe('getAdapter', () => {
    beforeEach(() => {
      discoveryService.start();
    });

    it('should get adapter by framework', () => {
      const adapter = discoveryService.getAdapter('usa');
      
      expect(adapter).toBeDefined();
      expect(adapter?.framework).toBe('usa');
      expect(adapter?.name).toBeDefined();
      expect(adapter?.version).toBeDefined();
    });

    it('should return undefined for non-existent framework', () => {
      const adapter = discoveryService.getAdapter('nonexistent' as AgentFramework);
      expect(adapter).toBeUndefined();
    });
  });

  describe('adapter count', () => {
    it('should return correct count', () => {
      discoveryService.start();
      
      const count = discoveryService.getAdapterCount();
      const adapters = discoveryService.listAdapters();
      
      expect(count).toBe(adapters.length);
    });
  });
});

// ============================================================================
// BridgeEventBus Tests
// ============================================================================

describe('BridgeEventBus', () => {
  let eventBus: BridgeEventBus;

  beforeEach(() => {
    eventBus = new BridgeEventBus({ maxHistorySize: 100 });
  });

  describe('publish', () => {
    it('should publish events with generated ID', () => {
      const event = eventBus.publish<AgentTranslatedPayload>(
        'AgentTranslated',
        'translation',
        {
          timestamp: new Date().toISOString(),
          sourceFramework: 'usa',
          targetFramework: 'lmos',
          agentUri: 'urn:test:agent',
          fidelityScore: 0.95,
          warnings: 0,
        }
      );

      expect(event.eventId).toBeDefined();
      expect(event.eventId).toContain('bridge_evt_');
      expect(event.type).toBe('AgentTranslated');
      expect(event.primitive).toBe('translation');
    });

    it('should store events in history', () => {
      eventBus.publish('AgentIngested', 'agent', {
        timestamp: new Date().toISOString(),
        sourceFramework: 'usa',
        agentUri: 'urn:test:agent',
        agentId: 'test-id',
        name: 'Test',
        fidelityScore: 1.0,
      } as AgentIngestedPayload);

      const history = eventBus.getHistory();
      expect(history.length).toBe(1);
    });

    it('should limit history size', () => {
      const smallBus = new BridgeEventBus({ maxHistorySize: 5 });

      for (let i = 0; i < 10; i++) {
        smallBus.publish('AgentIngested', 'agent', {
          timestamp: new Date().toISOString(),
          sourceFramework: 'usa',
          agentUri: `urn:test:agent:${i}`,
          agentId: `id-${i}`,
          name: `Agent ${i}`,
          fidelityScore: 1.0,
        } as AgentIngestedPayload);
      }

      expect(smallBus.getHistory().length).toBe(5);
    });
  });

  describe('subscribe', () => {
    it('should receive events on subscription', (done) => {
      eventBus.subscribe<AgentTranslatedPayload>('AgentTranslated', (event) => {
        expect(event.type).toBe('AgentTranslated');
        expect(event.payload.sourceFramework).toBe('usa');
        done();
      });

      eventBus.publish<AgentTranslatedPayload>('AgentTranslated', 'translation', {
        timestamp: new Date().toISOString(),
        sourceFramework: 'usa',
        targetFramework: 'lmos',
        agentUri: 'urn:test:agent',
        fidelityScore: 0.95,
        warnings: 0,
      });
    });

    it('should receive all events with wildcard subscription', (done) => {
      let eventCount = 0;

      eventBus.subscribe('*', () => {
        eventCount++;
        if (eventCount === 2) {
          done();
        }
      });

      eventBus.publish('AgentIngested', 'agent', { timestamp: new Date().toISOString() } as any);
      eventBus.publish('AgentTranslated', 'translation', { timestamp: new Date().toISOString() } as any);
    });

    it('should return subscription ID', () => {
      const subId = eventBus.subscribe('AgentIngested', () => {});
      
      expect(subId).toBeDefined();
      expect(subId).toContain('sub_');
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe successfully', () => {
      const subId = eventBus.subscribe('AgentIngested', () => {});
      
      const result = eventBus.unsubscribe(subId);
      expect(result).toBe(true);
    });

    it('should return false for non-existent subscription', () => {
      const result = eventBus.unsubscribe('non-existent');
      expect(result).toBe(false);
    });

    it('should not receive events after unsubscribe', (done) => {
      let received = false;

      const subId = eventBus.subscribe('AgentIngested', () => {
        received = true;
      });

      eventBus.unsubscribe(subId);
      eventBus.publish('AgentIngested', 'agent', { timestamp: new Date().toISOString() } as any);

      setTimeout(() => {
        expect(received).toBe(false);
        done();
      }, 50);
    });
  });

  describe('getHistory', () => {
    beforeEach(() => {
      eventBus.publish('AgentIngested', 'agent', { timestamp: new Date().toISOString() } as any);
      eventBus.publish('AgentTranslated', 'translation', { timestamp: new Date().toISOString() } as any);
      eventBus.publish('AgentStored', 'agent', { timestamp: new Date().toISOString() } as any);
    });

    it('should return all events without filter', () => {
      const history = eventBus.getHistory();
      expect(history.length).toBe(3);
    });

    it('should filter by event type', () => {
      const history = eventBus.getHistory({ type: 'AgentIngested' });
      expect(history.length).toBe(1);
      expect(history[0].type).toBe('AgentIngested');
    });

    it('should filter by primitive', () => {
      const history = eventBus.getHistory({ primitive: 'agent' });
      expect(history.length).toBe(2);
    });

    it('should limit results', () => {
      const history = eventBus.getHistory({ limit: 2 });
      expect(history.length).toBe(2);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      eventBus.publish('AgentIngested', 'agent', { timestamp: new Date().toISOString() } as any);
      eventBus.publish('AgentTranslated', 'translation', { timestamp: new Date().toISOString() } as any);

      eventBus.clearHistory();

      expect(eventBus.getHistory().length).toBe(0);
    });
  });

  describe('subscription management', () => {
    it('should track subscription count', () => {
      eventBus.subscribe('AgentIngested', () => {});
      eventBus.subscribe('AgentTranslated', () => {});

      expect(eventBus.getSubscriptionCount()).toBe(2);
    });

    it('should list subscriptions', () => {
      eventBus.subscribe('AgentIngested', () => {});
      eventBus.subscribe('AgentTranslated', () => {});

      const subs = eventBus.listSubscriptions();
      expect(subs.length).toBe(2);
      expect(subs[0].eventType).toBeDefined();
      expect(subs[0].createdAt).toBeDefined();
    });
  });
});

// ============================================================================
// BridgePersistenceService Tests
// ============================================================================

describe('BridgePersistenceService', () => {
  let orchestrator: BridgeOrchestrator;
  let eventBus: BridgeEventBus;
  let persistence: BridgePersistenceService;

  beforeEach(() => {
    orchestrator = new BridgeOrchestrator();
    eventBus = new BridgeEventBus();
    persistence = new BridgePersistenceService(orchestrator, eventBus);
  });

  afterEach(() => {
    persistence.clear();
  });

  describe('storeAgent', () => {
    it('should store agent and return stored record', () => {
      const agent = { id: 'test-agent', name: 'Test Agent' };
      const uri = 'urn:chrysalis:agent:test';

      const stored = persistence.storeAgent(uri, agent);

      expect(stored.uri).toBe(uri);
      expect(stored.agentId).toBe(agent.id);
      expect(stored.name).toBe(agent.name);
      expect(stored.versionId).toBeDefined();
    });

    it('should emit AgentStored event', (done) => {
      eventBus.subscribe<AgentStoredPayload>('AgentStored', (event) => {
        expect(event.payload.agentUri).toBe('urn:chrysalis:agent:test');
        done();
      });

      const agent = { id: 'test-agent', name: 'Test Agent' };
      persistence.storeAgent('urn:chrysalis:agent:test', agent);
    });

    it('should create version history', () => {
      const agent = { id: 'test-agent', name: 'Test Agent' };
      const uri = 'urn:chrysalis:agent:test';

      persistence.storeAgent(uri, agent);
      const versions = persistence.getVersionHistory(uri);

      expect(versions.length).toBe(1);
      expect(versions[0].changeType).toBe('create');
    });

    it('should update existing agent', () => {
      const agent = { id: 'test-agent', name: 'Test Agent' };
      const uri = 'urn:chrysalis:agent:test';

      persistence.storeAgent(uri, agent);
      persistence.storeAgent(uri, { id: 'test-agent', name: 'Updated Agent' });

      const stored = persistence.getAgent(uri);
      expect(stored?.name).toBe('Updated Agent');

      const versions = persistence.getVersionHistory(uri);
      expect(versions.length).toBe(2);
      expect(versions[1].changeType).toBe('update');
    });

    it('should close previous version on update', () => {
      const agent = { id: 'test-agent', name: 'Test Agent' };
      const uri = 'urn:chrysalis:agent:test';

      persistence.storeAgent(uri, agent);
      persistence.storeAgent(uri, { ...agent, name: 'Updated' });

      const versions = persistence.getVersionHistory(uri);
      expect(versions[0].validTo).toBeDefined();
      expect(versions[1].validTo).toBeUndefined();
    });
  });

  describe('getAgent', () => {
    it('should retrieve stored agent', () => {
      const agent = { id: 'test-agent', name: 'Test Agent' };
      const uri = 'urn:chrysalis:agent:test';

      persistence.storeAgent(uri, agent);
      const retrieved = persistence.getAgent(uri);

      expect(retrieved).toBeDefined();
      expect(retrieved?.agentId).toBe(agent.id);
    });

    it('should return undefined for non-existent agent', () => {
      const retrieved = persistence.getAgent('urn:nonexistent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAgentAtTime', () => {
    it('should retrieve agent version at specific time', async () => {
      const agent = { id: 'test-agent', name: 'Test Agent' };
      const uri = 'urn:chrysalis:agent:test';

      persistence.storeAgent(uri, agent);
      const timeAfterCreate = new Date().toISOString();

      await new Promise(resolve => setTimeout(resolve, 10));
      persistence.storeAgent(uri, { ...agent, name: 'Updated' });

      const version = persistence.getAgentAtTime(uri, timeAfterCreate);
      expect(version).toBeDefined();
      expect(version?.changeType).toBe('create');
    });

    it('should return undefined for time before agent existed', () => {
      const pastTime = new Date(Date.now() - 1000000).toISOString();
      const agent = { id: 'test-agent', name: 'Test Agent' };
      const uri = 'urn:chrysalis:agent:test';

      persistence.storeAgent(uri, agent);
      const version = persistence.getAgentAtTime(uri, pastTime);

      expect(version).toBeUndefined();
    });
  });

  describe('queryAgents', () => {
    beforeEach(() => {
      persistence.storeAgent('urn:agent:1', { id: 'agent-1', name: 'Test Agent' }, {
        framework: 'usa',
        fidelityScore: 0.9,
      });
      persistence.storeAgent('urn:agent:2', { id: 'agent-2', name: 'LMOS Agent' }, {
        framework: 'lmos',
        fidelityScore: 0.8,
      });
      persistence.storeAgent('urn:agent:3', { id: 'agent-3', name: 'Test Agent' }, {
        framework: 'usa',
        fidelityScore: 0.95,
      });
    });

    it('should return all agents without query', () => {
      const agents = persistence.queryAgents();
      expect(agents.length).toBe(3);
    });

    it('should filter by framework', () => {
      const agents = persistence.queryAgents({ framework: 'usa' });
      expect(agents.length).toBe(2);
    });

    it('should filter by name', () => {
      const agents = persistence.queryAgents({ name: 'LMOS' });
      expect(agents.length).toBe(1);
      expect(agents[0].name).toContain('LMOS');
    });

    it('should filter by minimum fidelity', () => {
      const agents = persistence.queryAgents({ minFidelity: 0.85 });
      expect(agents.length).toBe(2);
    });

    it('should apply pagination', () => {
      const agents = persistence.queryAgents({ limit: 2, offset: 1 });
      expect(agents.length).toBe(2);
    });
  });

  describe('translations', () => {
    it('should store and retrieve translation record', () => {
      const record: TranslationRecord = {
        id: 'trans-1',
        sourceFramework: 'usa' as AgentFramework,
        targetFramework: 'lmos' as AgentFramework,
        fidelityScore: 0.95,
        timestamp: new Date().toISOString(),
        canonicalUri: 'urn:agent:1',
        sourceUri: 'urn:source:1',
        targetUri: 'urn:target:1',
        warnings: [],
        durationMs: 100,
      };

      persistence.storeTranslation(record);
      const retrieved = persistence.getTranslation('trans-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.sourceFramework).toBe('usa');
    });

    it('should query translations', () => {
      persistence.storeTranslation({
        id: 'trans-1',
        sourceFramework: 'usa',
        targetFramework: 'lmos',
        fidelityScore: 0.95,
        timestamp: new Date().toISOString(),
        canonicalUri: 'urn:agent:1',
        sourceUri: 'urn:source:1',
        targetUri: 'urn:target:1',
        warnings: [],
        durationMs: 100,
      });
      persistence.storeTranslation({
        id: 'trans-2',
        sourceFramework: 'lmos',
        targetFramework: 'usa',
        fidelityScore: 0.85,
        timestamp: new Date().toISOString(),
        canonicalUri: 'urn:agent:2',
        sourceUri: 'urn:source:2',
        targetUri: 'urn:target:2',
        warnings: [],
        durationMs: 150,
      });

      const fromUSA = persistence.queryTranslations({ sourceFramework: 'usa' });
      expect(fromUSA.length).toBe(1);

      const highFidelity = persistence.queryTranslations({ minFidelity: 0.9 });
      expect(highFidelity.length).toBe(1);
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent and return true', () => {
      const agent = { id: 'test-agent', name: 'Test Agent' };
      const uri = 'urn:chrysalis:agent:test';

      persistence.storeAgent(uri, agent);
      const result = persistence.deleteAgent(uri);

      expect(result).toBe(true);
      expect(persistence.getAgent(uri)).toBeUndefined();
    });

    it('should return false for non-existent agent', () => {
      const result = persistence.deleteAgent('urn:nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      persistence.storeAgent('urn:agent:1', { id: 'agent-1', name: 'Agent 1' }, {
        framework: 'usa',
        fidelityScore: 0.9,
      });
      persistence.storeAgent('urn:agent:2', { id: 'agent-2', name: 'Agent 2' }, {
        framework: 'lmos',
        fidelityScore: 0.8,
      });
      persistence.storeTranslation({
        id: 'trans-1',
        sourceFramework: 'usa',
        targetFramework: 'lmos',
        fidelityScore: 0.85,
        timestamp: new Date().toISOString(),
        canonicalUri: 'urn:agent:1',
        sourceUri: 'urn:source:1',
        targetUri: 'urn:target:1',
        warnings: [],
        durationMs: 100,
      });

      const stats = persistence.getStats();

      expect(stats.totalAgents).toBe(2);
      expect(stats.totalVersions).toBe(2);
      expect(stats.totalTranslations).toBe(1);
      expect(stats.avgFidelity).toBe(0.85);
      expect(stats.byFramework.usa).toBe(1);
      expect(stats.byFramework.lmos).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      persistence.storeAgent('urn:agent:1', { id: 'agent-1', name: 'Agent 1' });
      persistence.storeTranslation({
        id: 'trans-1',
        sourceFramework: 'usa',
        targetFramework: 'lmos',
        fidelityScore: 0.85,
        timestamp: new Date().toISOString(),
        canonicalUri: 'urn:agent:1',
        sourceUri: 'urn:source:1',
        targetUri: 'urn:target:1',
        warnings: [],
        durationMs: 100,
      });

      persistence.clear();

      const stats = persistence.getStats();
      expect(stats.totalAgents).toBe(0);
      expect(stats.totalTranslations).toBe(0);
    });
  });
});

// ============================================================================
// IntegratedBridgeService Tests
// ============================================================================

describe('IntegratedBridgeService', () => {
  let service: IntegratedBridgeService;

  beforeEach(() => {
    service = createIntegratedBridgeService({
      healthCheckInterval: 100000,
      maxEventHistory: 100,
      enableEventLogging: true,
    });
  });

  afterEach(() => {
    service.stop();
  });

  describe('initialization', () => {
    it('should create with all components', () => {
      expect(service.orchestrator).toBeDefined();
      expect(service.discovery).toBeDefined();
      expect(service.events).toBeDefined();
      expect(service.persistence).toBeDefined();
    });

    it('should start and stop cleanly', () => {
      service.start();
      service.stop();
      expect(true).toBe(true); // No errors
    });
  });

  describe('ingestAgent', () => {
    beforeEach(() => {
      service.start();
    });

    it('should ingest USA agent', async () => {
      const native = createMockUSAAgent();

      const result = await service.ingestAgent(native);

      expect(result.canonical).toBeDefined();
      expect(result.stored).toBeDefined();
      expect(result.event).toBeDefined();
      expect(result.event.type).toBe('AgentIngested');
    });

    it('should ingest LMOS agent', async () => {
      const native = createMockLMOSAgent();

      const result = await service.ingestAgent(native);

      expect(result.canonical).toBeDefined();
      expect(result.stored.framework).toBe('lmos');
    });

    it('should store agent in persistence', async () => {
      const native = createMockUSAAgent();

      const { stored } = await service.ingestAgent(native);
      const retrieved = service.persistence.getAgent(stored.uri);

      expect(retrieved).toBeDefined();
      expect(retrieved?.agentId).toBe(stored.agentId);
    });

    it('should emit event', async () => {
      const native = createMockUSAAgent();

      const eventPromise = new Promise<BridgeEvent>((resolve) => {
        service.events.subscribe('AgentIngested', resolve);
      });

      await service.ingestAgent(native);
      const event = await eventPromise;

      expect(event.type).toBe('AgentIngested');
    });
  });

  describe('translateAgent', () => {
    beforeEach(() => {
      service.start();
    });

    it('should translate USA to LMOS', async () => {
      const native = createMockUSAAgent();

      const { result, stored, event } = await service.translateAgent(native, 'lmos');

      expect(result.result).toBeDefined();
      expect(result.targetFramework).toBe('lmos');
      expect(stored).toBeDefined();
      expect(event.type).toBe('AgentTranslated');
    });

    it('should translate LMOS to USA', async () => {
      const native = createMockLMOSAgent();

      const { result } = await service.translateAgent(native, 'usa');

      expect(result.result).toBeDefined();
      expect(result.targetFramework).toBe('usa');
    });

    it('should store translation record', async () => {
      const native = createMockUSAAgent();

      await service.translateAgent(native, 'lmos');
      const translations = service.persistence.queryTranslations({ sourceFramework: 'usa' });

      expect(translations.length).toBeGreaterThan(0);
    });

    it('should include fidelity score', async () => {
      const native = createMockUSAAgent();

      const { result, event } = await service.translateAgent(native, 'lmos');

      expect(result.fidelityScore).toBeGreaterThan(0);
      expect((event.payload as AgentTranslatedPayload).fidelityScore).toBe(result.fidelityScore);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      service.start();
    });

    it('should return comprehensive statistics', async () => {
      await service.ingestAgent(createMockUSAAgent());
      await service.translateAgent(createMockLMOSAgent(), 'usa');

      const stats = service.getStats();

      expect(stats.discovery.adapterCount).toBeGreaterThan(0);
      expect(stats.events.totalEvents).toBeGreaterThan(0);
      expect(stats.persistence.totalAgents).toBeGreaterThan(0);
    });

    it('should track adapter health', () => {
      const stats = service.getStats();

      expect(stats.discovery.healthyAdapters).toBeLessThanOrEqual(stats.discovery.adapterCount);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all services are up', () => {
      service.start();

      const health = service.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.orchestrator).toBe(true);
      expect(health.details.discovery).toBe(true);
      expect(health.details.events).toBe(true);
      expect(health.details.persistence).toBe(true);
    });

    it('should include component details', () => {
      service.start();

      const health = service.healthCheck();

      expect(health.details).toBeDefined();
      expect(typeof health.details.orchestrator).toBe('boolean');
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('Factory Functions', () => {
  describe('createIntegratedBridgeService', () => {
    it('should create service with default config', () => {
      const service = createIntegratedBridgeService();

      expect(service).toBeDefined();
      expect(service.orchestrator).toBeDefined();
      
      service.stop();
    });

    it('should create service with custom config', () => {
      const service = createIntegratedBridgeService({
        healthCheckInterval: 5000,
        maxEventHistory: 50,
        enableEventLogging: false,
      });

      expect(service).toBeDefined();
      
      service.stop();
    });
  });
});
