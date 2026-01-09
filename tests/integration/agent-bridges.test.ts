/**
 * Agent Bridges Integration Tests
 * 
 * Tests for:
 * - Agent bridge framework
 * - Serena, DirectLLM, ElizaOS bridges
 * - Agent registry
 * - Terminal connector
 * 
 * @module tests/integration/agent-bridges
 */

import {
  // Types
  IAgentBridge,
  AgentInfo,
  AgentMessage,
  AgentResponse,
  AgentContext,
  BridgeConfig,
  BridgeStatus,
  
  // Base
  BaseBridge,
  
  // Implementations
  SerenaBridge,
  SerenaConfig,
  createSerenaBridge,
  DirectLLMBridge,
  DirectLLMConfig,
  createDirectLLMBridge,
  LLMBridgeFactory,
  ElizaOSBridge,
  ElizaOSConfig,
  ElizaCharacter,
  createElizaOSBridge,
  ElizaOSFactory,
  EVALUATOR_MODES,
  
  // Registry
  AgentRegistry,
  createAgentRegistry,
  getAgentRegistry
} from '../../src/agents/bridges';

import {
  TerminalAgentConnector,
  createTerminalAgentConnector
} from '../../src/agents/TerminalAgentConnector';

import { ChrysalisTerminal } from '../../src/terminal/ChrysalisTerminal';
import { LLMHydrationService } from '../../src/services/llm/LLMHydrationService';
import { MemUAdapter } from '../../src/memory/MemUAdapter';

// ============================================================================
// Mock Implementations for Testing
// ============================================================================

/**
 * Mock Bridge for testing base functionality
 */
class MockBridge extends BaseBridge {
  private mockResponses: string[] = ['Mock response 1', 'Mock response 2'];
  private responseIndex = 0;
  
  constructor(config: BridgeConfig) {
    super(config);
  }
  
  get agentType() {
    return 'custom' as const;
  }
  
  get capabilities() {
    return ['chat' as const, 'multi_turn' as const];
  }
  
  get info(): AgentInfo {
    return {
      id: this.id,
      name: this.config.name,
      type: 'custom',
      description: 'Mock agent for testing',
      capabilities: this.capabilities,
      status: this.status,
      version: '1.0.0'
    };
  }
  
  async connect(): Promise<void> {
    this.setStatus('connected');
    this.emit({
      type: 'connected',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: {}
    });
  }
  
  async disconnect(): Promise<void> {
    this.setStatus('disconnected');
    this.emit({
      type: 'disconnected',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: {}
    });
  }
  
  async send(message: AgentMessage, context?: AgentContext): Promise<AgentResponse> {
    this.emit({
      type: 'message',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: { message }
    });
    
    const response = this.createResponse(
      this.mockResponses[this.responseIndex % this.mockResponses.length],
      'success'
    );
    this.responseIndex++;
    
    this.emit({
      type: 'response',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: { response }
    });
    
    return response;
  }
  
  setMockResponses(responses: string[]): void {
    this.mockResponses = responses;
    this.responseIndex = 0;
  }
}

// ============================================================================
// Type Tests
// ============================================================================

describe('Agent Bridge Types', () => {
  describe('AgentInfo', () => {
    it('should have required fields', () => {
      const info: AgentInfo = {
        id: 'test-agent',
        name: 'Test Agent',
        type: 'custom',
        description: 'A test agent',
        capabilities: ['chat'],
        status: 'disconnected'
      };
      
      expect(info.id).toBe('test-agent');
      expect(info.name).toBe('Test Agent');
      expect(info.type).toBe('custom');
      expect(info.capabilities).toContain('chat');
      expect(info.status).toBe('disconnected');
    });
  });
  
  describe('AgentMessage', () => {
    it('should create valid message', () => {
      const message: AgentMessage = {
        id: 'msg-1',
        content: 'Hello world',
        role: 'user',
        timestamp: Date.now()
      };
      
      expect(message.content).toBe('Hello world');
      expect(message.role).toBe('user');
    });
    
    it('should support attachments', () => {
      const message: AgentMessage = {
        id: 'msg-2',
        content: 'Check this code',
        role: 'user',
        timestamp: Date.now(),
        attachments: [
          {
            type: 'code',
            content: 'console.log("hello")',
            filename: 'test.js'
          }
        ]
      };
      
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments![0].type).toBe('code');
    });
  });
});

// ============================================================================
// Base Bridge Tests
// ============================================================================

describe('BaseBridge', () => {
  let bridge: MockBridge;
  
  beforeEach(() => {
    bridge = new MockBridge({
      id: 'mock-1',
      name: 'Mock Agent',
      type: 'custom',
      enabled: true
    });
  });
  
  afterEach(async () => {
    await bridge.destroy();
  });
  
  describe('initialization', () => {
    it('should initialize with disconnected status', () => {
      expect(bridge.getStatus()).toBe('disconnected');
    });
    
    it('should have correct id', () => {
      expect(bridge.id).toBe('mock-1');
    });
    
    it('should provide agent info', () => {
      const info = bridge.info;
      expect(info.id).toBe('mock-1');
      expect(info.name).toBe('Mock Agent');
      expect(info.type).toBe('custom');
    });
  });
  
  describe('connection', () => {
    it('should connect successfully', async () => {
      await bridge.connect();
      expect(bridge.getStatus()).toBe('connected');
    });
    
    it('should disconnect successfully', async () => {
      await bridge.connect();
      await bridge.disconnect();
      expect(bridge.getStatus()).toBe('disconnected');
    });
    
    it('should emit connected event', async () => {
      const handler = jest.fn();
      bridge.on('connected', handler);
      
      await bridge.connect();
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should emit disconnected event', async () => {
      const handler = jest.fn();
      bridge.on('disconnected', handler);
      
      await bridge.connect();
      await bridge.disconnect();
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('messaging', () => {
    beforeEach(async () => {
      await bridge.connect();
    });
    
    it('should send and receive messages', async () => {
      const message: AgentMessage = {
        id: 'test-msg',
        content: 'Hello agent',
        role: 'user',
        timestamp: Date.now()
      };
      
      const response = await bridge.send(message);
      
      expect(response.status).toBe('success');
      expect(response.content).toBe('Mock response 1');
    });
    
    it('should emit message event', async () => {
      const handler = jest.fn();
      bridge.on('message', handler);
      
      await bridge.send({
        id: 'test-msg',
        content: 'Hello',
        role: 'user',
        timestamp: Date.now()
      });
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should emit response event', async () => {
      const handler = jest.fn();
      bridge.on('response', handler);
      
      await bridge.send({
        id: 'test-msg',
        content: 'Hello',
        role: 'user',
        timestamp: Date.now()
      });
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('events', () => {
    it('should subscribe to events', () => {
      const handler = jest.fn();
      const unsubscribe = bridge.on('connected', handler);
      
      expect(typeof unsubscribe).toBe('function');
    });
    
    it('should unsubscribe from events', async () => {
      const handler = jest.fn();
      const unsubscribe = bridge.on('connected', handler);
      
      unsubscribe();
      await bridge.connect();
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('tools', () => {
    it('should register tools', () => {
      bridge.registerTool({
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input value' }
          }
        }
      });
      
      const tools = bridge.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
    });
    
    it('should unregister tools', () => {
      bridge.registerTool({
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} }
      });
      
      bridge.unregisterTool('test_tool');
      
      const tools = bridge.getTools();
      expect(tools).toHaveLength(0);
    });
  });
});

// ============================================================================
// DirectLLM Bridge Tests
// ============================================================================

describe('DirectLLMBridge', () => {
  describe('creation', () => {
    it('should create with config', () => {
      const bridge = createDirectLLMBridge({
        id: 'llm-1',
        name: 'GPT Agent',
        type: 'direct_llm',
        provider: 'openai',
        enabled: true
      });
      
      expect(bridge.id).toBe('llm-1');
      expect(bridge.info.type).toBe('direct_llm');
      expect(bridge.agentType).toBe('direct_llm');
    });
    
    it('should have chat capability', () => {
      const bridge = createDirectLLMBridge({
        id: 'llm-2',
        name: 'Claude Agent',
        type: 'direct_llm',
        provider: 'anthropic',
        enabled: true
      });
      
      expect(bridge.capabilities).toContain('chat');
      expect(bridge.capabilities).toContain('multi_turn');
      expect(bridge.capabilities).toContain('streaming');
    });
  });
  
  describe('LLMBridgeFactory', () => {
    it('should create Claude bridge', () => {
      const bridge = LLMBridgeFactory.claude({
        id: 'claude-1',
        name: 'Claude'
      });
      
      expect(bridge.info.metadata?.provider).toBe('anthropic');
    });
    
    it('should create GPT bridge', () => {
      const bridge = LLMBridgeFactory.gpt({
        id: 'gpt-1',
        name: 'GPT-4'
      });
      
      expect(bridge.info.metadata?.provider).toBe('openai');
    });
    
    it('should create Ollama bridge', () => {
      const bridge = LLMBridgeFactory.ollama({
        id: 'ollama-1',
        name: 'Llama 2'
      });
      
      expect(bridge.info.metadata?.provider).toBe('ollama');
    });
  });
});

// ============================================================================
// ElizaOS Bridge Tests
// ============================================================================

describe('ElizaOSBridge', () => {
  const testCharacter: ElizaCharacter = {
    name: 'Test Character',
    bio: ['A helpful test character'],
    knowledge: ['Testing', 'TypeScript'],
    topics: ['programming', 'testing'],
    adjectives: ['helpful', 'friendly'],
    style: {
      all: ['Be concise', 'Be helpful']
    }
  };
  
  describe('creation', () => {
    it('should create with character', () => {
      const bridge = createElizaOSBridge({
        id: 'eliza-1',
        name: 'Test Eliza',
        type: 'eliza',
        enabled: true,
        character: testCharacter
      });
      
      expect(bridge.id).toBe('eliza-1');
      expect(bridge.info.type).toBe('eliza');
      expect(bridge.agentType).toBe('eliza');
    });
    
    it('should store character', () => {
      const bridge = createElizaOSBridge({
        id: 'eliza-2',
        name: 'Test Eliza',
        type: 'eliza',
        enabled: true,
        character: testCharacter
      });
      
      const character = bridge.getCharacter();
      expect(character.name).toBe('Test Character');
      expect(character.knowledge).toContain('Testing');
    });
  });
  
  describe('evaluator modes', () => {
    it('should apply Tetlock mode', () => {
      const bridge = createElizaOSBridge({
        id: 'eliza-tetlock',
        name: 'Tetlock Agent',
        type: 'eliza',
        enabled: true,
        character: testCharacter,
        evaluatorMode: 'tetlock'
      });
      
      const mode = bridge.getEvaluatorMode();
      expect(mode?.name).toBe('tetlock');
    });
    
    it('should apply Shannon mode', () => {
      const bridge = createElizaOSBridge({
        id: 'eliza-shannon',
        name: 'Shannon Agent',
        type: 'eliza',
        enabled: true,
        character: testCharacter,
        evaluatorMode: 'shannon'
      });
      
      const mode = bridge.getEvaluatorMode();
      expect(mode?.name).toBe('shannon');
    });
    
    it('should switch modes', () => {
      const bridge = createElizaOSBridge({
        id: 'eliza-switch',
        name: 'Mode Switch Agent',
        type: 'eliza',
        enabled: true,
        character: testCharacter,
        evaluatorMode: 'tetlock'
      });
      
      bridge.setEvaluatorMode('kata');
      expect(bridge.getEvaluatorMode()?.name).toBe('kata');
      
      bridge.setEvaluatorMode(undefined);
      expect(bridge.getEvaluatorMode()).toBeUndefined();
    });
  });
  
  describe('ElizaOSFactory', () => {
    it('should create pure character', () => {
      const bridge = ElizaOSFactory.pure(testCharacter);
      expect(bridge.getEvaluatorMode()).toBeUndefined();
    });
    
    it('should create with Tetlock mode', () => {
      const bridge = ElizaOSFactory.withTetlockMode(testCharacter);
      expect(bridge.getEvaluatorMode()?.name).toBe('tetlock');
    });
    
    it('should create with Shannon mode', () => {
      const bridge = ElizaOSFactory.withShannonMode(testCharacter);
      expect(bridge.getEvaluatorMode()?.name).toBe('shannon');
    });
    
    it('should create with Kata mode', () => {
      const bridge = ElizaOSFactory.withKataMode(testCharacter);
      expect(bridge.getEvaluatorMode()?.name).toBe('kata');
    });
    
    it('should create with Calibration mode', () => {
      const bridge = ElizaOSFactory.withCalibrationMode(testCharacter);
      expect(bridge.getEvaluatorMode()?.name).toBe('calibration');
    });
  });
  
  describe('character capabilities', () => {
    it('should derive capabilities from knowledge', () => {
      const bridge = createElizaOSBridge({
        id: 'eliza-caps',
        name: 'Capability Agent',
        type: 'eliza',
        enabled: true,
        character: testCharacter
      });
      
      const caps = bridge.getCharacterCapabilities();
      expect(caps.some(c => c.name === 'testing')).toBe(true);
      expect(caps.some(c => c.name === 'typescript')).toBe(true);
    });
  });
});

// ============================================================================
// Serena Bridge Tests (structural only - actual Serena requires runtime)
// ============================================================================

describe('SerenaBridge', () => {
  describe('creation', () => {
    it('should create with config', () => {
      const bridge = createSerenaBridge({
        id: 'serena-1',
        name: 'Serena Agent',
        type: 'serena',
        projectPath: '/test/project',
        enabled: true
      });
      
      expect(bridge.id).toBe('serena-1');
      expect(bridge.info.type).toBe('serena');
      expect(bridge.agentType).toBe('serena');
    });
    
    it('should have code capabilities', () => {
      const bridge = createSerenaBridge({
        id: 'serena-2',
        name: 'Serena Agent',
        type: 'serena',
        projectPath: '/test/project',
        enabled: true
      });
      
      expect(bridge.capabilities).toContain('code');
      expect(bridge.capabilities).toContain('file_operations');
      expect(bridge.capabilities).toContain('shell');
      expect(bridge.capabilities).toContain('memory');
    });
    
    it('should store project path in metadata', () => {
      const bridge = createSerenaBridge({
        id: 'serena-3',
        name: 'Serena Agent',
        type: 'serena',
        projectPath: '/test/project',
        enabled: true
      });
      
      expect(bridge.info.metadata?.projectPath).toBe('/test/project');
    });
  });
  
  describe('tools', () => {
    it('should have registered tools', () => {
      const bridge = createSerenaBridge({
        id: 'serena-tools',
        name: 'Serena Agent',
        type: 'serena',
        projectPath: '/test/project',
        enabled: true
      });
      
      const tools = bridge.getTools();
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('find_symbol');
      expect(toolNames).toContain('search_for_pattern');
    });
    
    it('should have edit tools when not read-only', () => {
      const bridge = createSerenaBridge({
        id: 'serena-edit',
        name: 'Serena Agent',
        type: 'serena',
        projectPath: '/test/project',
        enabled: true,
        readOnly: false
      });
      
      const tools = bridge.getTools();
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('create_text_file');
      expect(toolNames).toContain('replace_lines');
    });
    
    it('should exclude edit tools when read-only', () => {
      const bridge = createSerenaBridge({
        id: 'serena-readonly',
        name: 'Serena Agent',
        type: 'serena',
        projectPath: '/test/project',
        enabled: true,
        readOnly: true
      });
      
      const tools = bridge.getTools();
      const toolNames = tools.map(t => t.name);
      expect(toolNames).not.toContain('create_text_file');
      expect(toolNames).not.toContain('replace_lines');
    });
  });
});

// ============================================================================
// Agent Registry Tests
// ============================================================================

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  
  beforeEach(() => {
    registry = createAgentRegistry();
  });
  
  afterEach(async () => {
    await registry.destroy();
  });
  
  describe('registration', () => {
    it('should register bridges', () => {
      const bridge = new MockBridge({
        id: 'reg-1',
        name: 'Test Agent',
        type: 'custom',
        enabled: true
      });
      
      registry.register(bridge);
      
      expect(registry.has('reg-1')).toBe(true);
      expect(registry.count).toBe(1);
    });
    
    it('should prevent duplicate registration', () => {
      const bridge = new MockBridge({
        id: 'reg-dup',
        name: 'Test Agent',
        type: 'custom',
        enabled: true
      });
      
      registry.register(bridge);
      
      expect(() => registry.register(bridge)).toThrow();
    });
    
    it('should unregister bridges', () => {
      const bridge = new MockBridge({
        id: 'reg-unreg',
        name: 'Test Agent',
        type: 'custom',
        enabled: true
      });
      
      registry.register(bridge);
      registry.unregister('reg-unreg');
      
      expect(registry.has('reg-unreg')).toBe(false);
      expect(registry.count).toBe(0);
    });
  });
  
  describe('lookup', () => {
    beforeEach(() => {
      registry.register(new MockBridge({
        id: 'lookup-1',
        name: 'Agent 1',
        type: 'custom',
        enabled: true
      }));
      registry.register(new MockBridge({
        id: 'lookup-2',
        name: 'Agent 2',
        type: 'custom',
        enabled: true
      }));
    });
    
    it('should get by id', () => {
      const bridge = registry.get('lookup-1');
      expect(bridge?.id).toBe('lookup-1');
    });
    
    it('should return undefined for unknown id', () => {
      const bridge = registry.get('unknown');
      expect(bridge).toBeUndefined();
    });
    
    it('should list all agents', () => {
      const agents = registry.list();
      expect(agents).toHaveLength(2);
    });
    
    it('should find by type', () => {
      const bridges = registry.findByType('custom');
      expect(bridges).toHaveLength(2);
    });
    
    it('should find by capability', () => {
      const bridges = registry.findByCapability('chat');
      expect(bridges).toHaveLength(2);
    });
  });
  
  describe('factory methods', () => {
    it('should register DirectLLM', () => {
      const bridge = registry.registerDirectLLM({
        id: 'factory-llm',
        name: 'LLM Agent',
        type: 'direct_llm',
        provider: 'openai',
        enabled: true
      });
      
      expect(registry.has('factory-llm')).toBe(true);
      expect(bridge.info.type).toBe('direct_llm');
    });
    
    it('should register ElizaOS', () => {
      const bridge = registry.registerElizaOS({
        id: 'factory-eliza',
        name: 'Eliza Agent',
        type: 'eliza',
        enabled: true,
        character: { name: 'Test' }
      });
      
      expect(registry.has('factory-eliza')).toBe(true);
      expect(bridge.info.type).toBe('eliza');
    });
    
    it('should register Serena', () => {
      const bridge = registry.registerSerena({
        id: 'factory-serena',
        name: 'Serena Agent',
        type: 'serena',
        projectPath: '/test',
        enabled: true
      });
      
      expect(registry.has('factory-serena')).toBe(true);
      expect(bridge.info.type).toBe('serena');
    });
  });
  
  describe('events', () => {
    it('should emit registered event', () => {
      const handler = jest.fn();
      registry.on('agent:registered', handler);
      
      registry.register(new MockBridge({
        id: 'evt-reg',
        name: 'Event Agent',
        type: 'custom',
        enabled: true
      }));
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should emit unregistered event', () => {
      const handler = jest.fn();
      registry.on('agent:unregistered', handler);
      
      registry.register(new MockBridge({
        id: 'evt-unreg',
        name: 'Event Agent',
        type: 'custom',
        enabled: true
      }));
      
      registry.unregister('evt-unreg');
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('connection management', () => {
    it('should connect individual bridge', async () => {
      const bridge = new MockBridge({
        id: 'conn-1',
        name: 'Connect Agent',
        type: 'custom',
        enabled: true
      });
      registry.register(bridge);
      
      await registry.connect('conn-1');
      
      expect(bridge.getStatus()).toBe('connected');
    });
    
    it('should connect all bridges', async () => {
      const bridge1 = new MockBridge({
        id: 'conn-all-1',
        name: 'Agent 1',
        type: 'custom',
        enabled: true
      });
      const bridge2 = new MockBridge({
        id: 'conn-all-2',
        name: 'Agent 2',
        type: 'custom',
        enabled: true
      });
      
      registry.register(bridge1);
      registry.register(bridge2);
      
      const result = await registry.connectAll();
      
      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });
    
    it('should disconnect all bridges', async () => {
      const bridge = new MockBridge({
        id: 'disconn-all',
        name: 'Agent',
        type: 'custom',
        enabled: true
      });
      registry.register(bridge);
      await bridge.connect();
      
      await registry.disconnectAll();
      
      expect(bridge.getStatus()).toBe('disconnected');
    });
  });
});

// ============================================================================
// Terminal Agent Connector Tests
// ============================================================================

describe('TerminalAgentConnector', () => {
  let terminal: ChrysalisTerminal;
  let registry: AgentRegistry;
  let connector: TerminalAgentConnector;
  
  beforeEach(() => {
    terminal = new ChrysalisTerminal({
      participantId: 'human-1',
      participantType: 'human',
      participantName: 'Test Human'
    });
    
    registry = createAgentRegistry();
    
    connector = createTerminalAgentConnector({
      terminal,
      registry,
      autoRespond: true
    });
  });
  
  afterEach(async () => {
    await connector.destroy();
    await registry.destroy();
    terminal.destroy();
  });
  
  describe('agent connection', () => {
    it('should connect agent to terminal', async () => {
      const bridge = new MockBridge({
        id: 'term-agent-1',
        name: 'Terminal Agent',
        type: 'custom',
        enabled: true
      });
      registry.register(bridge);
      
      await connector.connectAgent('term-agent-1');
      
      expect(connector.isAgentConnected('term-agent-1')).toBe(true);
    });
    
    it('should announce agent joining', async () => {
      const bridge = new MockBridge({
        id: 'term-announce',
        name: 'Announcing Agent',
        type: 'custom',
        enabled: true
      });
      registry.register(bridge);
      
      await connector.connectAgent('term-announce');
      
      const messages = terminal.getMessages('left');
      const joinMessage = messages.find(m => 
        m.content.includes('has joined')
      );
      expect(joinMessage).toBeDefined();
    });
    
    it('should disconnect agent from terminal', async () => {
      const bridge = new MockBridge({
        id: 'term-disc',
        name: 'Disconnect Agent',
        type: 'custom',
        enabled: true
      });
      registry.register(bridge);
      
      await connector.connectAgent('term-disc');
      await connector.disconnectAgent('term-disc');
      
      expect(connector.isAgentConnected('term-disc')).toBe(false);
    });
    
    it('should list connected agents', async () => {
      const bridge1 = new MockBridge({
        id: 'term-list-1',
        name: 'Agent 1',
        type: 'custom',
        enabled: true
      });
      const bridge2 = new MockBridge({
        id: 'term-list-2',
        name: 'Agent 2',
        type: 'custom',
        enabled: true
      });
      
      registry.register(bridge1);
      registry.register(bridge2);
      
      await connector.connectAgent('term-list-1');
      await connector.connectAgent('term-list-2');
      
      const connected = connector.getConnectedAgents();
      expect(connected).toHaveLength(2);
    });
  });
  
  describe('direct messaging', () => {
    it('should send message to specific agent', async () => {
      const bridge = new MockBridge({
        id: 'term-direct',
        name: 'Direct Agent',
        type: 'custom',
        enabled: true
      });
      bridge.setMockResponses(['Direct response']);
      registry.register(bridge);
      
      await connector.connectAgent('term-direct');
      await connector.sendToAgent('term-direct', 'Hello direct');
      
      // Check that response was sent to terminal
      const messages = terminal.getMessages('left');
      expect(messages.some(m => m.content.includes('Direct response'))).toBe(true);
    });
    
    it('should throw for unconnected agent', async () => {
      await expect(
        connector.sendToAgent('unknown-agent', 'Hello')
      ).rejects.toThrow();
    });
  });
});

// ============================================================================
// Evaluator Modes Tests
// ============================================================================

describe('Evaluator Modes', () => {
  it('should have Tetlock mode defined', () => {
    const mode = EVALUATOR_MODES.tetlock;
    expect(mode.name).toBe('tetlock');
    expect(mode.description).toContain('Superforecasting');
    expect(mode.analyticalLens).toContain('probabilistic');
  });
  
  it('should have Shannon mode defined', () => {
    const mode = EVALUATOR_MODES.shannon;
    expect(mode.name).toBe('shannon');
    expect(mode.description).toContain('Information theory');
    expect(mode.analyticalLens).toContain('entropy');
  });
  
  it('should have Kata mode defined', () => {
    const mode = EVALUATOR_MODES.kata;
    expect(mode.name).toBe('kata');
    expect(mode.description).toContain('skill building');
    expect(mode.analyticalLens).toContain('mastery');
  });
  
  it('should have Calibration mode defined', () => {
    const mode = EVALUATOR_MODES.calibration;
    expect(mode.name).toBe('calibration');
    expect(mode.description).toContain('Epistemic');
    expect(mode.analyticalLens).toContain('confidence');
  });
});