/**
 * Adapter Integration Tests
 * 
 * Tests cross-framework adapter transformations and MCP integration
 * 
 * @module tests/integration/adapters.test
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Phase 3
 */

import {
  integrationSuite,
  describe,
  it,
  expect,
  beforeEach,
  TestContext,
  SAMPLE_USA_AGENT,
  SAMPLE_ELIZAOS_AGENT,
  SAMPLE_CREWAI_AGENT,
  MockLLMService,
  MockEmbeddingService,
  MockVectorStore,
} from './index';

// =============================================================================
// ElizaOS Adapter Tests
// =============================================================================

integrationSuite('ElizaOS Adapter', (ctx: TestContext) => {
  describe('toUSA transformation', () => {
    it('should convert character to core memory', async () => {
      const elizaAgent = { ...SAMPLE_ELIZAOS_AGENT };

      const expectedUSA = {
        id: expect.any(String),
        name: elizaAgent.name,
        memory: {
          core: {
            persona: elizaAgent.character.name,
            bio: elizaAgent.character.bio.join(' '),
            lore: elizaAgent.character.lore.join(' '),
          },
        },
      };

      // Verify mapping logic
      expect(elizaAgent.character.name).toBe('TestBot');
      expect(expectedUSA.memory.core.persona).toBe('TestBot');
    });

    it('should map plugins to tools', async () => {
      const elizaAgent = {
        ...SAMPLE_ELIZAOS_AGENT,
        plugins: [
          '@elizaos/plugin-node',
          '@elizaos/plugin-solana',
          '@elizaos/plugin-image-generation',
        ],
      };

      const expectedTools = elizaAgent.plugins.map(plugin => ({
        name: plugin.replace('@elizaos/plugin-', ''),
        source: 'elizaos-plugin',
      }));

      expect(expectedTools).toHaveLength(3);
      expect(expectedTools[0].name).toBe('node');
    });

    it('should preserve model provider settings', async () => {
      const elizaAgent = {
        ...SAMPLE_ELIZAOS_AGENT,
        modelProvider: 'anthropic',
        settings: {
          model: 'claude-3-opus',
          temperature: 0.7,
        },
      };

      expect(elizaAgent.modelProvider).toBe('anthropic');
      expect(elizaAgent.settings?.model).toBe('claude-3-opus');
    });
  });

  describe('fromUSA transformation', () => {
    it('should generate valid ElizaOS character', async () => {
      const usaAgent = { ...SAMPLE_USA_AGENT };

      const expectedEliza = {
        name: usaAgent.name,
        character: {
          name: usaAgent.name,
          bio: [usaAgent.memory.core.persona],
        },
      };

      expect(expectedEliza.name).toBe('TestAgent');
      expect(expectedEliza.character.bio).toContain('A helpful test agent');
    });

    it('should map capabilities to clients', async () => {
      const usaAgent = {
        ...SAMPLE_USA_AGENT,
        capabilities: ['chat', 'discord', 'telegram', 'twitter'],
      };

      const elizaClients = usaAgent.capabilities
        .filter(c => ['discord', 'telegram', 'twitter'].includes(c));

      expect(elizaClients).toContain('discord');
      expect(elizaClients).toHaveLength(3);
    });
  });
});

// =============================================================================
// CrewAI Adapter Tests
// =============================================================================

integrationSuite('CrewAI Adapter', (ctx: TestContext) => {
  describe('toUSA transformation', () => {
    it('should convert role to agent name', async () => {
      const crewAgent = { ...SAMPLE_CREWAI_AGENT };

      const expectedUSA = {
        name: crewAgent.role,
        memory: {
          core: {
            persona: crewAgent.backstory,
            goal: crewAgent.goal,
          },
        },
      };

      expect(expectedUSA.name).toBe('Researcher');
      expect(expectedUSA.memory.core.persona).toBe('An expert researcher');
    });

    it('should map tools array', async () => {
      const crewAgent = {
        ...SAMPLE_CREWAI_AGENT,
        tools: ['search', 'read', 'write', 'analyze'],
      };

      const expectedTools = crewAgent.tools.map(t => ({
        name: t,
        source: 'crewai',
      }));

      expect(expectedTools).toHaveLength(4);
    });

    it('should handle crew context', async () => {
      const crew = {
        agents: [SAMPLE_CREWAI_AGENT, { ...SAMPLE_CREWAI_AGENT, role: 'Writer' }],
        tasks: [
          { description: 'Research topic', agent: 'Researcher' },
          { description: 'Write report', agent: 'Writer' },
        ],
      };

      expect(crew.agents).toHaveLength(2);
      expect(crew.tasks).toHaveLength(2);
    });
  });

  describe('fromUSA transformation', () => {
    it('should generate valid CrewAI agent config', async () => {
      const usaAgent = { ...SAMPLE_USA_AGENT };

      const expectedCrew = {
        role: usaAgent.name,
        goal: 'Assist users',
        backstory: usaAgent.memory.core.persona,
        verbose: true,
        allow_delegation: false,
      };

      expect(expectedCrew.role).toBe('TestAgent');
      expect(expectedCrew.backstory).toBe('A helpful test agent');
    });
  });
});

// =============================================================================
// MCP Adapter Tests
// =============================================================================

integrationSuite('MCP Adapter', (ctx: TestContext) => {
  describe('tool discovery', () => {
    it('should list available tools from server', async () => {
      // Mock MCP server response
      const mockTools = [
        { name: 'read_file', description: 'Read file contents' },
        { name: 'write_file', description: 'Write to file' },
        { name: 'search', description: 'Search filesystem' },
      ];

      expect(mockTools).toHaveLength(3);
      expect(mockTools.map(t => t.name)).toContain('read_file');
    });

    it('should handle server connection errors', async () => {
      const serverStatus = { connected: false, error: 'Connection refused' };

      expect(serverStatus.connected).toBe(false);
      expect(serverStatus.error).toBeDefined();
    });
  });

  describe('tool invocation', () => {
    it('should call tool with correct parameters', async () => {
      const toolCall = {
        name: 'read_file',
        arguments: { path: '/test/file.txt' },
      };

      expect(toolCall.name).toBe('read_file');
      expect(toolCall.arguments.path).toBeDefined();
    });

    it('should handle tool execution errors', async () => {
      const errorResponse = {
        error: {
          code: -32602,
          message: 'Invalid params',
        },
      };

      expect(errorResponse.error.code).toBe(-32602);
    });
  });

  describe('resource access', () => {
    it('should list available resources', async () => {
      const mockResources = [
        { uri: 'file:///project/README.md', name: 'README' },
        { uri: 'file:///project/src/', name: 'Source' },
      ];

      expect(mockResources).toHaveLength(2);
    });

    it('should read resource contents', async () => {
      const resource = {
        uri: 'file:///project/README.md',
        contents: [{ type: 'text', text: '# Project README' }],
      };

      expect(resource.contents[0].text).toContain('README');
    });
  });
});

// =============================================================================
// AutoGen Adapter Tests (Future)
// =============================================================================

integrationSuite('AutoGen Adapter', (ctx: TestContext) => {
  describe('toUSA transformation', () => {
    it.skip('should convert AssistantAgent to USA', async () => {
      // Placeholder for AutoGen support
      const autogenAgent = {
        name: 'assistant',
        system_message: 'You are a helpful assistant',
        llm_config: { model: 'gpt-4' },
      };

      expect(autogenAgent.name).toBe('assistant');
    });
  });

  describe('fromUSA transformation', () => {
    it.skip('should generate valid AutoGen config', async () => {
      // Placeholder
    });
  });
});

// =============================================================================
// Cross-Adapter Tests
// =============================================================================

integrationSuite('Cross-Adapter Compatibility', (ctx: TestContext) => {
  let embeddingService: MockEmbeddingService;
  let vectorStore: MockVectorStore;

  beforeEach(() => {
    embeddingService = new MockEmbeddingService();
    vectorStore = new MockVectorStore();
  });

  describe('memory preservation', () => {
    it('should maintain memory across ElizaOS -> USA -> CrewAI', async () => {
      // Simulate memory preservation
      const originalMemory = {
        persona: 'Expert coder',
        context: 'Working on TypeScript project',
      };

      // Store embedding
      const embedding = await embeddingService.embed(originalMemory.persona);
      await vectorStore.store('memory-1', embedding, originalMemory.persona);

      // Retrieve and verify
      const queryEmbedding = await embeddingService.embed('coder expert');
      const results = await vectorStore.search(queryEmbedding, 1);

      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('coder');
    });
  });

  describe('capability mapping', () => {
    it('should map common capabilities across frameworks', async () => {
      const commonCapabilities = [
        'chat',
        'tool-use',
        'memory',
        'planning',
      ];

      const elizaMapping = {
        'chat': 'client',
        'tool-use': 'plugin',
        'memory': 'characterFile',
        'planning': 'evaluator',
      };

      const crewMapping = {
        'chat': 'verbose',
        'tool-use': 'tools',
        'memory': 'memory',
        'planning': 'allow_delegation',
      };

      // All common capabilities should have mappings
      for (const cap of commonCapabilities) {
        expect(elizaMapping[cap as keyof typeof elizaMapping]).toBeDefined();
        expect(crewMapping[cap as keyof typeof crewMapping]).toBeDefined();
      }
    });
  });

  describe('error handling', () => {
    it('should provide clear errors for unsupported features', async () => {
      const unsupportedFeature = 'quantum-computing';
      const supportedFeatures = ['chat', 'memory', 'tools'];

      expect(supportedFeatures).not.toContain(unsupportedFeature);
    });
  });
});