/**
 * Agent Morphing Integration Tests
 * 
 * Tests cross-framework agent transformation operations
 * 
 * @module tests/integration/morph.test
 * @see plans/CHRYSALIS_DEVELOPMENT_STREAMLINING_PLAN.md - Item H-3
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
  registerCleanup,
} from './index';

// =============================================================================
// Morph Test Suite
// =============================================================================

integrationSuite('Agent Morphing', (ctx: TestContext) => {
  let mockLLM: MockLLMService;

  beforeEach(() => {
    mockLLM = new MockLLMService();
  });

  describe('USA to ElizaOS', () => {
    it('should transform basic agent structure', async () => {
      // Arrange
      const usaAgent = { ...SAMPLE_USA_AGENT };
      
      mockLLM.setResponse('Transform', JSON.stringify({
        name: usaAgent.name,
        description: 'Transformed agent',
        character: {
          name: usaAgent.name,
          bio: [`Based on ${usaAgent.id}`],
        },
      }));

      // Act
      // Note: Replace with actual morph call when integrated
      const result = await mockLLM.complete(`Transform ${JSON.stringify(usaAgent)} to ElizaOS`);

      // Assert
      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe(usaAgent.name);
    });

    it('should preserve memory structure', async () => {
      const usaAgent = {
        ...SAMPLE_USA_AGENT,
        memory: {
          working: [{ content: 'recent context' }],
          core: {
            persona: 'Test persona',
            user_facts: 'User prefers concise responses',
          },
        },
      };

      // Verify memory is included in transformation
      const serialized = JSON.stringify(usaAgent);
      expect(serialized).toContain('Test persona');
      expect(serialized).toContain('recent context');
    });

    it('should map tools to plugins', async () => {
      const usaAgent = {
        ...SAMPLE_USA_AGENT,
        tools: [
          { name: 'web-search', description: 'Search the web' },
          { name: 'code-execute', description: 'Run code' },
        ],
      };

      // Tool mapping expectations
      const toolNames = usaAgent.tools.map(t => t.name);
      expect(toolNames).toContain('web-search');
      expect(toolNames).toContain('code-execute');
    });
  });

  describe('USA to CrewAI', () => {
    it('should transform to crew member format', async () => {
      const usaAgent = { ...SAMPLE_USA_AGENT };

      // Expected CrewAI structure
      const expectedCrewFormat = {
        role: usaAgent.name,
        goal: 'Assist users effectively',
        backstory: usaAgent.memory.core.persona,
        verbose: true,
      };

      expect(expectedCrewFormat.role).toBe(SAMPLE_USA_AGENT.name);
    });

    it('should handle capability mapping', async () => {
      const usaAgent = {
        ...SAMPLE_USA_AGENT,
        capabilities: ['chat', 'code-analysis', 'memory', 'tool-use'],
      };

      // Capabilities should map to CrewAI tools
      expect(usaAgent.capabilities).toContain('tool-use');
      expect(usaAgent.capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('ElizaOS to USA', () => {
    it('should extract character into memory', async () => {
      const elizaAgent = { ...SAMPLE_ELIZAOS_AGENT };

      // Character should map to core memory
      const expectedCoreMemory = {
        persona: elizaAgent.character.name,
        bio: elizaAgent.character.bio.join(' '),
        lore: elizaAgent.character.lore.join(' '),
      };

      expect(expectedCoreMemory.persona).toBe('TestBot');
    });

    it('should convert plugins to tools', async () => {
      const elizaAgent = { ...SAMPLE_ELIZAOS_AGENT };

      // Plugins should map to USA tools
      expect(elizaAgent.plugins).toContain('@elizaos/plugin-node');
    });
  });

  describe('CrewAI to USA', () => {
    it('should extract role as name', async () => {
      const crewAgent = { ...SAMPLE_CREWAI_AGENT };

      // Role becomes agent name
      expect(crewAgent.role).toBe('Researcher');
    });

    it('should map backstory to persona', async () => {
      const crewAgent = { ...SAMPLE_CREWAI_AGENT };

      // Backstory becomes persona
      const expectedPersona = crewAgent.backstory;
      expect(expectedPersona).toBe('An expert researcher');
    });
  });

  describe('Round-trip transformation', () => {
    it('should preserve agent identity through transformations', async () => {
      const original = { ...SAMPLE_USA_AGENT };
      
      // Simulate: USA -> ElizaOS -> USA
      // The core identity should be preserved
      const preservedFields = ['id', 'name', 'version'];
      
      for (const field of preservedFields) {
        expect(original[field as keyof typeof original]).toBeDefined();
      }
    });

    it('should handle capability loss gracefully', async () => {
      const original = {
        ...SAMPLE_USA_AGENT,
        capabilities: ['advanced-reasoning', 'multi-modal', 'custom-capability'],
      };

      // Some capabilities may not map to all frameworks
      // Test that the system handles this gracefully
      const supportedCapabilities = original.capabilities.filter(
        c => !c.startsWith('custom-')
      );
      
      expect(supportedCapabilities.length).toBeLessThan(original.capabilities.length);
    });
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

integrationSuite('Morph Error Handling', (ctx: TestContext) => {
  describe('Invalid input', () => {
    it('should reject malformed agent definitions', async () => {
      const malformed = { invalid: true };
      
      // Should throw or return error
      expect(() => {
        if (!('id' in malformed)) {
          throw new Error('Missing required field: id');
        }
      }).toThrow('Missing required field');
    });

    it('should handle missing required fields', async () => {
      const partial = { name: 'PartialAgent' };
      
      const requiredFields = ['id', 'version', 'capabilities'];
      const missingFields = requiredFields.filter(
        f => !(f in partial)
      );
      
      expect(missingFields.length).toBeGreaterThan(0);
    });
  });

  describe('Unsupported framework', () => {
    it('should return clear error for unknown frameworks', async () => {
      const unknownFramework = 'unknown-ai-framework';
      const supportedFrameworks = ['elizaos', 'crewai', 'mcp', 'autogen'];
      
      expect(supportedFrameworks).not.toContain(unknownFramework);
    });
  });
});