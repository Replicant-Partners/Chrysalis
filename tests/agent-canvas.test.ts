/**
 * Agent Canvas Integration Tests
 * 
 * Tests for:
 * - Agent format detection
 * - Agent import pipeline
 * - Canvas manager operations
 * - Lifecycle management (wake/sleep)
 * - Chat integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import all the modules we're testing
import {
  detectAgentFormat,
  convertToUSA,
  elizaPersonaToUSA,
  crewaiAgentToUSA,
  replicantToUSA,
  AgentImportPipeline,
  ImportResult,
} from '../src/terminal/protocols/agent-import-pipeline';

import {
  AgentCanvasManager,
  createAgentCanvasManager,
  resetDefaultAgentCanvasManager,
  AgentLayout,
} from '../src/terminal/protocols/agent-canvas-manager';

import {
  AgentLifecycleManager,
  createAgentLifecycleManager,
  ActiveAgentRuntime,
} from '../src/terminal/protocols/agent-lifecycle-manager';

import {
  CanvasAgent,
  AgentState,
  AgentSourceFormat,
  createCanvasAgent,
  isCanvasAgent,
  AGENT_CANVAS_CONSTANTS,
} from '../src/terminal/protocols/agent-canvas';

import {
  AgentChatIntegration,
  createAgentChatIntegration,
  ChatSession,
  ChatMessage,
} from '../src/services/AgentChatIntegration';

// =============================================================================
// Test Data
// =============================================================================

const sampleUSASpec = {
  apiVersion: 'usa/v2',
  kind: 'Agent',
  metadata: {
    name: 'Test Agent',
    version: '1.0.0',
    description: 'A test agent',
  },
  identity: {
    role: 'Test Role',
    goal: 'Test goal',
    backstory: 'Test backstory',
  },
  capabilities: {
    tools: [{ name: 'test_tool', protocol: 'native' }],
    skills: [{ name: 'test_skill' }],
  },
  protocols: {
    mcp: { enabled: false },
  },
};

const sampleElizaPersona = {
  name: 'Eliza Test',
  bio: ['A test Eliza persona', 'With multiple bio lines'],
  system: 'You are a test assistant',
  plugins: ['plugin1', 'plugin2'],
  topics: ['testing', 'development'],
  adjectives: ['helpful', 'friendly'],
  style: {
    all: ['Be concise'],
    chat: ['Use emojis'],
  },
};

const sampleCrewAIAgent = {
  agent: {
    role: 'Test Crew Agent',
    backstory: 'A test CrewAI agent backstory',
    goal: 'Complete test tasks',
    tools: ['tool1', 'tool2'],
    allow_delegation: true,
    verbose: true,
  },
};

const sampleReplicant = {
  name: 'Test Replicant',
  designation: 'Test Designation',
  bio: 'A test replicant biography',
  personality: {
    core_traits: ['analytical', 'creative'],
    quirks: ['quirk1'],
    values: ['value1'],
    fears: ['fear1'],
    aspirations: ['aspiration1'],
  },
  capabilities: {
    primary: ['cap1'],
    secondary: ['cap2'],
    tools: ['tool1'],
  },
  beliefs: {
    who: [{ content: 'belief about who', conviction: 0.8 }],
    what: [{ content: 'belief about what', conviction: 0.7 }],
  },
  emotional_ranges: {
    happy: { triggers: ['success'], expressions: ['smile'] },
  },
};

// =============================================================================
// Format Detection Tests
// =============================================================================

describe('Agent Format Detection', () => {
  it('should detect uSA format by apiVersion', () => {
    expect(detectAgentFormat(sampleUSASpec)).toBe('usa');
  });

  it('should detect uSA format by kind and identity', () => {
    const spec = { kind: 'Agent', identity: { role: 'test' } };
    expect(detectAgentFormat(spec)).toBe('usa');
  });

  it('should detect Eliza format by plugins and topics', () => {
    expect(detectAgentFormat(sampleElizaPersona)).toBe('eliza');
  });

  it('should detect CrewAI format by agent wrapper', () => {
    expect(detectAgentFormat(sampleCrewAIAgent)).toBe('crewai');
  });

  it('should detect CrewAI format by role/backstory/goal', () => {
    const spec = { role: 'test', backstory: 'test', goal: 'test' };
    expect(detectAgentFormat(spec)).toBe('crewai');
  });

  it('should detect Replicant format by designation and personality', () => {
    expect(detectAgentFormat(sampleReplicant)).toBe('replicant');
  });

  it('should detect Replicant format by beliefs', () => {
    const spec = { beliefs: { who: [], what: [] } };
    expect(detectAgentFormat(spec)).toBe('replicant');
  });

  it('should return unknown for unrecognized format', () => {
    expect(detectAgentFormat({ foo: 'bar' })).toBe('unknown');
  });

  it('should return unknown for non-object input', () => {
    expect(detectAgentFormat(null as any)).toBe('unknown');
    expect(detectAgentFormat('string' as any)).toBe('unknown');
  });
});

// =============================================================================
// Format Conversion Tests
// =============================================================================

describe('Agent Format Conversion', () => {
  describe('ElizaOS to uSA', () => {
    it('should convert basic Eliza persona', () => {
      const result = elizaPersonaToUSA(sampleElizaPersona);
      
      expect(result.apiVersion).toBe('usa/v2');
      expect(result.kind).toBe('Agent');
      expect(result.metadata.name).toBe('Eliza Test');
      expect(result.identity.backstory).toContain('You are a test assistant');
      expect(result.capabilities.tools).toHaveLength(2);
    });

    it('should preserve topics in tags', () => {
      const result = elizaPersonaToUSA(sampleElizaPersona);
      expect(result.metadata.tags).toContain('eliza');
      expect(result.metadata.tags).toContain('testing');
    });
  });

  describe('CrewAI to uSA', () => {
    it('should convert CrewAI agent', () => {
      const result = crewaiAgentToUSA(sampleCrewAIAgent);
      
      expect(result.apiVersion).toBe('usa/v2');
      expect(result.metadata.name).toBe('Test Crew Agent');
      expect(result.identity.role).toBe('Test Crew Agent');
      expect(result.identity.goal).toBe('Complete test tasks');
      expect(result.capabilities.tools).toHaveLength(2);
    });

    it('should handle direct agent format', () => {
      const direct = { role: 'Direct', backstory: 'Direct backstory', goal: 'Direct goal' };
      const result = crewaiAgentToUSA(direct);
      
      expect(result.metadata.name).toBe('Direct');
    });
  });

  describe('Replicant to uSA', () => {
    it('should convert Replicant to uSA', () => {
      const result = replicantToUSA(sampleReplicant);
      
      expect(result.apiVersion).toBe('usa/v2');
      expect(result.metadata.name).toBe('Test Replicant');
      expect(result.metadata.description).toBe('Test Designation');
      expect(result.identity.role).toBe('Test Designation');
    });

    it('should preserve personality traits', () => {
      const result = replicantToUSA(sampleReplicant);
      const traits = result.identity.personality_traits as any;
      
      expect(traits.core_traits).toContain('analytical');
      expect(traits.core_traits).toContain('creative');
    });

    it('should convert beliefs to semantic memory', () => {
      const result = replicantToUSA(sampleReplicant);
      const memory = result.capabilities.memory as any;
      
      expect(memory.semantic.initial_knowledge).toHaveLength(2);
      expect(memory.semantic.initial_knowledge[0].content).toBe('belief about who');
    });

    it('should convert emotional ranges to procedural memory', () => {
      const result = replicantToUSA(sampleReplicant);
      const memory = result.capabilities.memory as any;
      
      expect(memory.procedural.initial_procedures).toHaveLength(1);
      expect(memory.procedural.initial_procedures[0].name).toBe('express_happy');
    });
  });

  describe('Universal Converter', () => {
    it('should auto-detect and convert uSA', () => {
      const result = convertToUSA(sampleUSASpec);
      expect(result).toEqual(sampleUSASpec);
    });

    it('should auto-detect and convert Eliza', () => {
      const result = convertToUSA(sampleElizaPersona);
      expect(result.apiVersion).toBe('usa/v2');
      expect(result.metadata.name).toBe('Eliza Test');
    });

    it('should auto-detect and convert CrewAI', () => {
      const result = convertToUSA(sampleCrewAIAgent);
      expect(result.apiVersion).toBe('usa/v2');
    });

    it('should auto-detect and convert Replicant', () => {
      const result = convertToUSA(sampleReplicant);
      expect(result.apiVersion).toBe('usa/v2');
      expect(result.metadata.name).toBe('Test Replicant');
    });

    it('should throw for unknown format', () => {
      expect(() => convertToUSA({ unknown: 'format' })).toThrow();
    });
  });
});

// =============================================================================
// Import Pipeline Tests
// =============================================================================

describe('Agent Import Pipeline', () => {
  let pipeline: AgentImportPipeline;

  beforeEach(() => {
    pipeline = new AgentImportPipeline();
  });

  it('should import from JSON text', async () => {
    const result = await pipeline.importFromText(JSON.stringify(sampleUSASpec));
    
    expect(result.status).toBe('success');
    expect(result.sourceFormat).toBe('usa');
    expect(result.agent).toBeDefined();
    expect(result.agent?.name).toBe('Test Agent');
  });

  it('should detect format during import', async () => {
    const result = await pipeline.importFromText(JSON.stringify(sampleElizaPersona));
    
    expect(result.sourceFormat).toBe('eliza');
    expect(result.agent?.name).toBe('Eliza Test');
  });

  it('should return error for invalid JSON', async () => {
    const result = await pipeline.importFromText('not valid json');
    
    expect(result.status).toBe('error');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('PARSE_ERROR');
  });

  it('should return unsupported for unknown format', async () => {
    const result = await pipeline.importFromText(JSON.stringify({ foo: 'bar' }));
    
    expect(result.status).toBe('unsupported');
    expect(result.sourceFormat).toBe('unknown');
  });

  it('should auto-fill missing required fields', async () => {
    const minimal = { apiVersion: 'usa/v2', kind: 'Agent' };
    const result = await pipeline.importFromText(JSON.stringify(minimal));
    
    // Should partially succeed with auto-fill
    expect(result.agent).toBeDefined();
    expect(result.agent?.spec.metadata.name).toBeDefined();
  });

  it('should track import metadata', async () => {
    const result = await pipeline.importFromText(JSON.stringify(sampleUSASpec));
    
    expect(result.metadata.sourceType).toBe('text');
    expect(result.metadata.detectedFormat).toBe('usa');
    expect(result.metadata.importTimestamp).toBeDefined();
    expect(result.metadata.conversionDuration).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// Canvas Manager Tests
// =============================================================================

describe('Agent Canvas Manager', () => {
  let manager: AgentCanvasManager;

  beforeEach(() => {
    resetDefaultAgentCanvasManager();
    manager = createAgentCanvasManager({ canvasId: 'test-canvas' });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Agent CRUD', () => {
    it('should add an agent', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      const id = manager.addAgent(agent);
      
      expect(id).toBe(agent.id);
      expect(manager.getAgentCount()).toBe(1);
      expect(manager.getAgent(id)).toBeDefined();
    });

    it('should remove an agent', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      const id = manager.addAgent(agent);
      
      const removed = manager.removeAgent(id);
      
      expect(removed).toBe(true);
      expect(manager.getAgentCount()).toBe(0);
      expect(manager.getAgent(id)).toBeUndefined();
    });

    it('should update an agent', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      const id = manager.addAgent(agent);
      
      const updated = manager.updateAgent(id, { name: 'Updated Name' });
      
      expect(updated).toBe(true);
      expect(manager.getAgent(id)?.name).toBe('Updated Name');
    });

    it('should update agent state', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      const id = manager.addAgent(agent);
      
      manager.updateAgentState(id, 'awake');
      
      expect(manager.getAgent(id)?.state).toBe('awake');
    });

    it('should enforce max agents limit', () => {
      const config = manager.getConfig ? { maxAgents: 2 } : {};
      const limitedManager = createAgentCanvasManager({ ...config, maxAgents: 2 });
      
      limitedManager.addAgent(createCanvasAgent(sampleUSASpec, 'usa'));
      limitedManager.addAgent(createCanvasAgent(sampleUSASpec, 'usa'));
      
      expect(() => {
        limitedManager.addAgent(createCanvasAgent(sampleUSASpec, 'usa'));
      }).toThrow();
      
      limitedManager.destroy();
    });
  });

  describe('Layout Management', () => {
    it('should create layout when adding agent', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      const id = manager.addAgent(agent);
      
      const layout = manager.getLayout(id);
      
      expect(layout).toBeDefined();
      expect(layout?.position).toBeDefined();
      expect(layout?.position.x).toBeGreaterThanOrEqual(0);
    });

    it('should move an agent', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      const id = manager.addAgent(agent);
      
      manager.moveAgent(id, { x: 100, y: 200 });
      
      const layout = manager.getLayout(id);
      expect(layout?.position.x).toBe(100);
      expect(layout?.position.y).toBe(200);
    });

    it('should resize an agent', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      const id = manager.addAgent(agent);
      
      manager.resizeAgent(id, 400, 300);
      
      const layout = manager.getLayout(id);
      expect(layout?.position.width).toBe(400);
      expect(layout?.position.height).toBe(300);
    });

    it('should toggle collapsed state', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      const id = manager.addAgent(agent);
      
      const initialCollapsed = manager.getLayout(id)?.collapsed;
      manager.toggleCollapsed(id);
      
      expect(manager.getLayout(id)?.collapsed).toBe(!initialCollapsed);
    });
  });

  describe('Selection', () => {
    it('should select an agent', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      const id = manager.addAgent(agent);
      
      manager.selectAgent(id);
      
      const layout = manager.getLayout(id);
      expect(layout?.selected).toBe(true);
    });

    it('should support multi-select', () => {
      const agent1 = createCanvasAgent(sampleUSASpec, 'usa');
      const agent2 = createCanvasAgent(sampleUSASpec, 'usa');
      const id1 = manager.addAgent(agent1);
      const id2 = manager.addAgent(agent2);
      
      manager.selectAgent(id1);
      manager.selectAgent(id2, true); // Multi-select
      
      const selected = manager.getSelectedAgents();
      expect(selected).toHaveLength(2);
    });

    it('should clear selection', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      const id = manager.addAgent(agent);
      
      manager.selectAgent(id);
      manager.clearSelection();
      
      const selected = manager.getSelectedAgents();
      expect(selected).toHaveLength(0);
    });
  });

  describe('Viewport', () => {
    it('should update viewport', () => {
      manager.setViewport({ x: 100, y: 200, zoom: 1.5 });
      
      const viewport = manager.getViewport();
      expect(viewport.x).toBe(100);
      expect(viewport.y).toBe(200);
      expect(viewport.zoom).toBe(1.5);
    });

    it('should zoom to fit', () => {
      const agent1 = createCanvasAgent(sampleUSASpec, 'usa');
      const agent2 = createCanvasAgent(sampleUSASpec, 'usa');
      manager.addAgent(agent1, { x: 0, y: 0 });
      manager.addAgent(agent2, { x: 500, y: 500 });
      
      manager.zoomToFit();
      
      // Viewport should have adjusted
      const viewport = manager.getViewport();
      expect(viewport).toBeDefined();
    });
  });

  describe('Undo/Redo', () => {
    it('should support undo', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      const id = manager.addAgent(agent);
      
      expect(manager.canUndo()).toBe(true);
      
      manager.undo();
      
      // Agent should be removed
      expect(manager.getAgent(id)).toBeUndefined();
    });

    it('should support redo', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      const id = manager.addAgent(agent);
      
      manager.undo();
      expect(manager.canRedo()).toBe(true);
      
      manager.redo();
      
      expect(manager.getAgent(id)).toBeDefined();
    });
  });
});

// =============================================================================
// Lifecycle Manager Tests
// =============================================================================

describe('Agent Lifecycle Manager', () => {
  let canvasManager: AgentCanvasManager;
  let lifecycleManager: AgentLifecycleManager;

  beforeEach(() => {
    canvasManager = createAgentCanvasManager({ canvasId: 'test-lifecycle' });
    lifecycleManager = createAgentLifecycleManager(canvasManager);
  });

  afterEach(async () => {
    await lifecycleManager.destroy();
    canvasManager.destroy();
  });

  describe('Wake Process', () => {
    it('should wake a dormant agent', async () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent);
      
      const runtime = await lifecycleManager.wake(agent.id);
      
      expect(runtime).toBeDefined();
      expect(runtime.agentId).toBe(agent.id);
      expect(lifecycleManager.isAwake(agent.id)).toBe(true);
    });

    it('should update agent state during wake', async () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent);
      
      await lifecycleManager.wake(agent.id);
      
      const updatedAgent = canvasManager.getAgent(agent.id);
      expect(updatedAgent?.state).toBe('awake');
    });

    it('should track wake time', async () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent);
      
      const before = Date.now();
      const runtime = await lifecycleManager.wake(agent.id);
      const after = Date.now();
      
      expect(runtime.wakeTime).toBeGreaterThanOrEqual(before);
      expect(runtime.wakeTime).toBeLessThanOrEqual(after);
    });

    it('should return existing runtime if already awake', async () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent);
      
      const runtime1 = await lifecycleManager.wake(agent.id);
      const runtime2 = await lifecycleManager.wake(agent.id);
      
      expect(runtime1.agentId).toBe(runtime2.agentId);
    });

    it('should throw if agent not found', async () => {
      await expect(lifecycleManager.wake('non-existent')).rejects.toThrow();
    });
  });

  describe('Sleep Process', () => {
    it('should sleep an awake agent', async () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent);
      
      await lifecycleManager.wake(agent.id);
      await lifecycleManager.sleep(agent.id);
      
      expect(lifecycleManager.isAwake(agent.id)).toBe(false);
      expect(canvasManager.getAgent(agent.id)?.state).toBe('dormant');
    });

    it('should not throw if already dormant', async () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent);
      
      await expect(lifecycleManager.sleep(agent.id)).resolves.not.toThrow();
    });
  });

  describe('Runtime Operations', () => {
    it('should track awake count', async () => {
      const agent1 = createCanvasAgent(sampleUSASpec, 'usa');
      const agent2 = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent1);
      canvasManager.addAgent(agent2);
      
      expect(lifecycleManager.getAwakeCount()).toBe(0);
      
      await lifecycleManager.wake(agent1.id);
      expect(lifecycleManager.getAwakeCount()).toBe(1);
      
      await lifecycleManager.wake(agent2.id);
      expect(lifecycleManager.getAwakeCount()).toBe(2);
    });

    it('should get all runtimes', async () => {
      const agent1 = createCanvasAgent(sampleUSASpec, 'usa');
      const agent2 = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent1);
      canvasManager.addAgent(agent2);
      
      await lifecycleManager.wake(agent1.id);
      await lifecycleManager.wake(agent2.id);
      
      const runtimes = lifecycleManager.getAllRuntimes();
      expect(runtimes).toHaveLength(2);
    });
  });
});

// =============================================================================
// Chat Integration Tests
// =============================================================================

describe('Agent Chat Integration', () => {
  let canvasManager: AgentCanvasManager;
  let lifecycleManager: AgentLifecycleManager;
  let chatIntegration: AgentChatIntegration;

  beforeEach(() => {
    canvasManager = createAgentCanvasManager({ canvasId: 'test-chat' });
    lifecycleManager = createAgentLifecycleManager(canvasManager);
    chatIntegration = createAgentChatIntegration(lifecycleManager, canvasManager);
  });

  afterEach(async () => {
    chatIntegration.destroy();
    await lifecycleManager.destroy();
    canvasManager.destroy();
  });

  describe('Session Management', () => {
    it('should create a session', () => {
      const session = chatIntegration.createSession('Test Chat');
      
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.name).toBe('Test Chat');
      expect(session.participants).toHaveLength(1); // User
    });

    it('should get session by ID', () => {
      const created = chatIntegration.createSession('Test');
      const retrieved = chatIntegration.getSession(created.id);
      
      expect(retrieved).toEqual(created);
    });

    it('should get all sessions', () => {
      chatIntegration.createSession('Session 1');
      chatIntegration.createSession('Session 2');
      
      const sessions = chatIntegration.getAllSessions();
      expect(sessions).toHaveLength(2);
    });

    it('should delete session', () => {
      const session = chatIntegration.createSession('To Delete');
      chatIntegration.deleteSession(session.id);
      
      expect(chatIntegration.getSession(session.id)).toBeUndefined();
    });
  });

  describe('Agent Participation', () => {
    it('should add agent to session', async () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent);
      await lifecycleManager.wake(agent.id);
      
      const session = chatIntegration.createSession();
      const joined = chatIntegration.joinSession(agent.id, session.id);
      
      expect(joined).toBe(true);
      expect(session.participants).toHaveLength(2);
    });

    it('should not add sleeping agent', () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent);
      // Not waking the agent
      
      const session = chatIntegration.createSession();
      const joined = chatIntegration.joinSession(agent.id, session.id);
      
      expect(joined).toBe(false);
    });

    it('should remove agent from session', async () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent);
      await lifecycleManager.wake(agent.id);
      
      const session = chatIntegration.createSession();
      chatIntegration.joinSession(agent.id, session.id);
      chatIntegration.leaveSession(agent.id, session.id);
      
      expect(session.participants).toHaveLength(1); // Just user
    });

    it('should get session agents', async () => {
      const agent1 = createCanvasAgent(sampleUSASpec, 'usa');
      const agent2 = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent1);
      canvasManager.addAgent(agent2);
      await lifecycleManager.wake(agent1.id);
      await lifecycleManager.wake(agent2.id);
      
      const session = chatIntegration.createSession();
      chatIntegration.joinSession(agent1.id, session.id);
      chatIntegration.joinSession(agent2.id, session.id);
      
      const agents = chatIntegration.getSessionAgents(session.id);
      expect(agents).toHaveLength(2);
    });
  });

  describe('Messaging', () => {
    it('should add system message', () => {
      const session = chatIntegration.createSession();
      chatIntegration.addSystemMessage(session.id, 'System message');
      
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].senderType).toBe('system');
      expect(session.messages[0].content).toBe('System message');
    });

    it('should extract mentions', async () => {
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent);
      await lifecycleManager.wake(agent.id);
      
      const session = chatIntegration.createSession();
      chatIntegration.joinSession(agent.id, session.id);
      
      const mentions = chatIntegration.extractMentions(
        `Hey @${agent.name}, how are you?`,
        session.id
      );
      
      expect(mentions).toContain(agent.id);
    });
  });

  describe('Events', () => {
    it('should emit session:created event', () => {
      const listener = vi.fn();
      chatIntegration.on('session:created', listener);
      
      chatIntegration.createSession('Test');
      
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].type).toBe('session:created');
    });

    it('should emit session:joined event', async () => {
      const listener = vi.fn();
      chatIntegration.on('session:joined', listener);
      
      const agent = createCanvasAgent(sampleUSASpec, 'usa');
      canvasManager.addAgent(agent);
      await lifecycleManager.wake(agent.id);
      
      const session = chatIntegration.createSession();
      chatIntegration.joinSession(agent.id, session.id);
      
      expect(listener).toHaveBeenCalled();
    });

    it('should support wildcard listener', () => {
      const listener = vi.fn();
      chatIntegration.on('*', listener);
      
      chatIntegration.createSession('Test');
      
      expect(listener).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = chatIntegration.on('session:created', listener);
      
      unsubscribe();
      chatIntegration.createSession('Test');
      
      expect(listener).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// CanvasAgent Type Tests
// =============================================================================

describe('CanvasAgent Types', () => {
  it('should create canvas agent with correct properties', () => {
    const agent = createCanvasAgent(sampleUSASpec, 'usa');
    
    expect(agent.id).toBeDefined();
    expect(agent.name).toBe('Test Agent');
    expect(agent.state).toBe('dormant');
    expect(agent.sourceFormat).toBe('usa');
    expect(agent.spec).toEqual(sampleUSASpec);
    expect(agent.createdAt).toBeDefined();
    expect(agent.updatedAt).toBeDefined();
  });

  it('should validate canvas agent with type guard', () => {
    const agent = createCanvasAgent(sampleUSASpec, 'usa');
    
    expect(isCanvasAgent(agent)).toBe(true);
    expect(isCanvasAgent({ foo: 'bar' })).toBe(false);
    expect(isCanvasAgent(null)).toBe(false);
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('Agent Canvas Constants', () => {
  it('should have reasonable defaults', () => {
    expect(AGENT_CANVAS_CONSTANTS.MAX_AGENTS_PER_CANVAS).toBeGreaterThan(0);
    expect(AGENT_CANVAS_CONSTANTS.MAX_AGENT_SPEC_SIZE).toBeGreaterThan(0);
    expect(AGENT_CANVAS_CONSTANTS.DEFAULT_AGENT_NODE_WIDTH).toBeGreaterThan(0);
    expect(AGENT_CANVAS_CONSTANTS.DEFAULT_AGENT_NODE_HEIGHT).toBeGreaterThan(0);
  });
});