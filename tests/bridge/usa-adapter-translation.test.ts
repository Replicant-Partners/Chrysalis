/**
 * USA Adapter Translation Tests
 * 
 * Tests for the decomposed toCanonical() translation methods in USAAdapter.
 * Verifies that each section of the USA specification is correctly translated
 * to canonical RDF quads.
 * 
 * @module tests/bridge/usa-adapter-translation
 */

import { USAAdapter } from '../../src/adapters/usa-adapter';
import { NativeAgent, CanonicalAgent } from '../../src/adapters/base-adapter';

// Test constants
const CHRYSALIS_NS = 'https://chrysalis.dev/ontology/agent#';
const USA_NS = 'https://chrysalis.dev/usa#';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';

// Helper to find quad by predicate
function findQuad(quads: any[], predicateLocalName: string, namespace = CHRYSALIS_NS) {
  return quads.find(q => q.predicate.value === `${namespace}${predicateLocalName}`);
}

// Helper to find all quads by predicate
function findQuads(quads: any[], predicateLocalName: string, namespace = CHRYSALIS_NS) {
  return quads.filter(q => q.predicate.value === `${namespace}${predicateLocalName}`);
}

// Helper to find quad by type
function findByType(quads: any[], typeLocalName: string, namespace = CHRYSALIS_NS) {
  return quads.find(q => 
    q.predicate.value === `${RDF_NS}type` && 
    q.object.value === `${namespace}${typeLocalName}`
  );
}

describe('USAAdapter', () => {
  let adapter: USAAdapter;

  beforeEach(() => {
    adapter = new USAAdapter();
  });

  describe('toCanonical() - Metadata Translation', () => {
    it('should translate required metadata fields', async () => {
      const native: NativeAgent = {
        data: {
          apiVersion: 'usa/v2',
          kind: 'Agent',
          metadata: {
            name: 'test-agent',
            version: '1.0.0',
            description: 'A test agent',
            author: 'Test Author',
            tags: ['test', 'example']
          },
          identity: { role: 'assistant', goal: 'help users' },
          capabilities: {},
          execution: { llm: { provider: 'openai', model: 'gpt-4' } }
        },
        framework: 'usa',
        version: 'usa/v2'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify name
      const nameQuad = findQuad(canonical.quads, 'name');
      expect(nameQuad).toBeDefined();
      expect(nameQuad.object.value).toBe('test-agent');

      // Verify version
      const versionQuad = findQuad(canonical.quads, 'version');
      expect(versionQuad).toBeDefined();
      expect(versionQuad.object.value).toBe('1.0.0');

      // Verify description
      const descQuad = findQuad(canonical.quads, 'description');
      expect(descQuad).toBeDefined();
      expect(descQuad.object.value).toBe('A test agent');

      // Verify author
      const authorQuad = findQuad(canonical.quads, 'author');
      expect(authorQuad).toBeDefined();
      expect(authorQuad.object.value).toBe('Test Author');

      // Verify tags (JSON serialized)
      const tagsQuad = findQuad(canonical.quads, 'tags');
      expect(tagsQuad).toBeDefined();
      expect(JSON.parse(tagsQuad.object.value)).toEqual(['test', 'example']);
    });

    it('should preserve apiVersion as extension', async () => {
      const native: NativeAgent = {
        data: {
          apiVersion: 'usa/v2',
          kind: 'Agent',
          metadata: { name: 'test-agent', version: '1.0.0' },
          identity: { role: 'assistant', goal: 'help users' },
          capabilities: {},
          execution: { llm: { provider: 'openai', model: 'gpt-4' } }
        },
        framework: 'usa',
        version: 'usa/v2'
      };

      const canonical = await adapter.toCanonical(native);

      const apiVersionExt = canonical.extensions.find(
        e => e.namespace === 'usa' && e.property === 'apiVersion'
      );
      expect(apiVersionExt).toBeDefined();
      expect(apiVersionExt?.value).toBe('usa/v2');
    });
  });

  describe('toCanonical() - Identity Translation', () => {
    it('should create identity blank node with role and goal', async () => {
      const native: NativeAgent = {
        data: {
          apiVersion: 'usa/v2',
          kind: 'Agent',
          metadata: { name: 'test-agent', version: '1.0.0' },
          identity: {
            role: 'code reviewer',
            goal: 'improve code quality',
            backstory: 'Expert developer with 10 years experience'
          },
          capabilities: {},
          execution: { llm: { provider: 'openai', model: 'gpt-4' } }
        },
        framework: 'usa',
        version: 'usa/v2'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify hasIdentity link
      const hasIdentityQuad = findQuad(canonical.quads, 'hasIdentity');
      expect(hasIdentityQuad).toBeDefined();

      // Verify AgentIdentity type
      const identityTypeQuad = findByType(canonical.quads, 'AgentIdentity');
      expect(identityTypeQuad).toBeDefined();

      // Verify role (USA namespace)
      const roleQuad = findQuad(canonical.quads, 'role', USA_NS);
      expect(roleQuad).toBeDefined();
      expect(roleQuad.object.value).toBe('code reviewer');

      // Verify goal (USA namespace)
      const goalQuad = findQuad(canonical.quads, 'goal', USA_NS);
      expect(goalQuad).toBeDefined();
      expect(goalQuad.object.value).toBe('improve code quality');

      // Verify backstory (USA namespace)
      const backstoryQuad = findQuad(canonical.quads, 'backstory', USA_NS);
      expect(backstoryQuad).toBeDefined();
      expect(backstoryQuad.object.value).toBe('Expert developer with 10 years experience');
    });

    it('should preserve personality_traits as extension', async () => {
      const native: NativeAgent = {
        data: {
          apiVersion: 'usa/v2',
          kind: 'Agent',
          metadata: { name: 'test-agent', version: '1.0.0' },
          identity: {
            role: 'assistant',
            goal: 'help users',
            personality_traits: {
              curiosity: 0.8,
              patience: 0.9,
              directness: 'high'
            }
          },
          capabilities: {},
          execution: { llm: { provider: 'openai', model: 'gpt-4' } }
        },
        framework: 'usa',
        version: 'usa/v2'
      };

      const canonical = await adapter.toCanonical(native);

      const traitsExt = canonical.extensions.find(
        e => e.namespace === 'usa' && e.property === 'personalityTraits'
      );
      expect(traitsExt).toBeDefined();
      const parsed = JSON.parse(traitsExt!.value);
      expect(parsed.curiosity).toBe(0.8);
      expect(parsed.directness).toBe('high');
    });
  });

  describe('toCanonical() - Tools Translation', () => {
    it('should translate tools to capability nodes', async () => {
      const native: NativeAgent = {
        data: {
          apiVersion: 'usa/v2',
          kind: 'Agent',
          metadata: { name: 'test-agent', version: '1.0.0' },
          identity: { role: 'assistant', goal: 'help users' },
          capabilities: {
            tools: [
              { name: 'web_search', description: 'Search the web', protocol: 'mcp' },
              { name: 'code_exec', description: 'Execute code', config: { timeout: 30 } }
            ]
          },
          execution: { llm: { provider: 'openai', model: 'gpt-4' } }
        },
        framework: 'usa',
        version: 'usa/v2'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify Tool types
      const toolTypes = canonical.quads.filter(q => 
        q.predicate.value === `${RDF_NS}type` && 
        q.object.value === `${CHRYSALIS_NS}Tool`
      );
      expect(toolTypes.length).toBe(2);

      // Verify tool names
      const toolNames = findQuads(canonical.quads, 'toolName');
      expect(toolNames.length).toBe(2);
      const names = toolNames.map(q => q.object.value);
      expect(names).toContain('web_search');
      expect(names).toContain('code_exec');

      // Verify tool descriptions
      const toolDescs = findQuads(canonical.quads, 'toolDescription');
      expect(toolDescs.length).toBe(2);

      // Verify tool config preserved as extension
      const configExt = canonical.extensions.find(
        e => e.namespace === 'usa' && e.property === 'tool.code_exec.config'
      );
      expect(configExt).toBeDefined();
      expect(JSON.parse(configExt!.value).timeout).toBe(30);
    });
  });

  describe('toCanonical() - Reasoning Translation', () => {
    it('should map reasoning strategies to canonical URIs', async () => {
      const testCases = [
        { strategy: 'chain_of_thought', expected: 'ChainOfThought' },
        { strategy: 'react', expected: 'ReAct' },
        { strategy: 'reflexion', expected: 'Reflexion' },
        { strategy: 'tree_of_thoughts', expected: 'TreeOfThoughts' }
      ];

      for (const { strategy, expected } of testCases) {
        const native: NativeAgent = {
          data: {
            apiVersion: 'usa/v2',
            kind: 'Agent',
            metadata: { name: 'test-agent', version: '1.0.0' },
            identity: { role: 'assistant', goal: 'help users' },
            capabilities: {
              reasoning: { strategy, max_iterations: 10 }
            },
            execution: { llm: { provider: 'openai', model: 'gpt-4' } }
          },
          framework: 'usa',
          version: 'usa/v2'
        };

        const canonical = await adapter.toCanonical(native);

        const strategyQuad = findQuad(canonical.quads, 'usesReasoningStrategy');
        expect(strategyQuad).toBeDefined();
        expect(strategyQuad.object.value).toBe(`${CHRYSALIS_NS}${expected}`);
      }
    });

    it('should warn on unknown strategy and default to ChainOfThought', async () => {
      const native: NativeAgent = {
        data: {
          apiVersion: 'usa/v2',
          kind: 'Agent',
          metadata: { name: 'test-agent', version: '1.0.0' },
          identity: { role: 'assistant', goal: 'help users' },
          capabilities: {
            reasoning: { strategy: 'unknown_strategy' }
          },
          execution: { llm: { provider: 'openai', model: 'gpt-4' } }
        },
        framework: 'usa',
        version: 'usa/v2'
      };

      const canonical = await adapter.toCanonical(native);

      // Should default to ChainOfThought
      const strategyQuad = findQuad(canonical.quads, 'usesReasoningStrategy');
      expect(strategyQuad.object.value).toBe(`${CHRYSALIS_NS}ChainOfThought`);

      // Should have warning
      expect(canonical.metadata.warnings.length).toBeGreaterThan(0);
      const warning = canonical.metadata.warnings.find(w => w.code === 'UNKNOWN_STRATEGY');
      expect(warning).toBeDefined();
    });
  });

  describe('toCanonical() - Memory System Translation', () => {
    it('should translate hierarchical memory architecture', async () => {
      const native: NativeAgent = {
        data: {
          apiVersion: 'usa/v2',
          kind: 'Agent',
          metadata: { name: 'test-agent', version: '1.0.0' },
          identity: { role: 'assistant', goal: 'help users' },
          capabilities: {
            memory: {
              architecture: 'hierarchical',
              working: { enabled: true, max_tokens: 4096 },
              episodic: { enabled: true, storage: 'postgresql' },
              semantic: { enabled: true, storage: 'pinecone', rag: { enabled: true, top_k: 5 } },
              procedural: { enabled: true },
              core: { enabled: true, blocks: [{ name: 'persona', content: 'test', editable: true }] }
            }
          },
          execution: { llm: { provider: 'openai', model: 'gpt-4' } }
        },
        framework: 'usa',
        version: 'usa/v2'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify MemorySystem
      const memorySystemType = findByType(canonical.quads, 'MemorySystem');
      expect(memorySystemType).toBeDefined();

      // Verify architecture
      const archQuad = findQuad(canonical.quads, 'memoryArchitecture', USA_NS);
      expect(archQuad).toBeDefined();
      expect(archQuad.object.value).toBe('hierarchical');

      // Verify memory component types
      const workingType = findByType(canonical.quads, 'WorkingMemory');
      expect(workingType).toBeDefined();

      const episodicType = findByType(canonical.quads, 'EpisodicMemory');
      expect(episodicType).toBeDefined();

      const semanticType = findByType(canonical.quads, 'SemanticMemory');
      expect(semanticType).toBeDefined();

      const proceduralType = findByType(canonical.quads, 'ProceduralMemory');
      expect(proceduralType).toBeDefined();

      const coreType = findByType(canonical.quads, 'CoreMemory');
      expect(coreType).toBeDefined();

      // Verify RAG config as extension
      const ragExt = canonical.extensions.find(
        e => e.namespace === 'usa' && e.property === 'ragConfig'
      );
      expect(ragExt).toBeDefined();
      expect(JSON.parse(ragExt!.value).top_k).toBe(5);

      // Verify core memory blocks as extension
      const blocksExt = canonical.extensions.find(
        e => e.namespace === 'usa' && e.property === 'coreMemoryBlocks'
      );
      expect(blocksExt).toBeDefined();
    });
  });

  describe('toCanonical() - Protocols Translation', () => {
    it('should translate protocol bindings', async () => {
      const native: NativeAgent = {
        data: {
          apiVersion: 'usa/v2',
          kind: 'Agent',
          metadata: { name: 'test-agent', version: '1.0.0' },
          identity: { role: 'assistant', goal: 'help users' },
          capabilities: {},
          protocols: {
            mcp: { enabled: true, role: 'client', servers: [{ name: 'test', command: 'npx', args: ['test'] }] },
            a2a: { enabled: true },
            agent_protocol: { enabled: true, endpoint: 'https://api.example.com/v1' }
          },
          execution: { llm: { provider: 'openai', model: 'gpt-4' } }
        },
        framework: 'usa',
        version: 'usa/v2'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify MCPBinding
      const mcpType = findByType(canonical.quads, 'MCPBinding');
      expect(mcpType).toBeDefined();

      // Verify A2ABinding
      const a2aType = findByType(canonical.quads, 'A2ABinding');
      expect(a2aType).toBeDefined();

      // Verify AgentProtocolBinding
      const apType = findByType(canonical.quads, 'AgentProtocolBinding');
      expect(apType).toBeDefined();

      // Verify endpoint URL
      const endpointQuad = findQuad(canonical.quads, 'endpointUrl');
      expect(endpointQuad).toBeDefined();
      expect(endpointQuad.object.value).toBe('https://api.example.com/v1');

      // Verify MCP servers as extension
      const serversExt = canonical.extensions.find(
        e => e.namespace === 'usa' && e.property === 'mcpServers'
      );
      expect(serversExt).toBeDefined();
    });
  });

  describe('toCanonical() - Execution Translation', () => {
    it('should translate LLM configuration', async () => {
      const native: NativeAgent = {
        data: {
          apiVersion: 'usa/v2',
          kind: 'Agent',
          metadata: { name: 'test-agent', version: '1.0.0' },
          identity: { role: 'assistant', goal: 'help users' },
          capabilities: {},
          execution: {
            llm: {
              provider: 'anthropic',
              model: 'claude-3-opus',
              temperature: 0.7,
              max_tokens: 4096,
              parameters: { top_p: 0.9 }
            },
            runtime: {
              timeout: 60,
              max_iterations: 10,
              error_handling: 'retry'
            }
          }
        },
        framework: 'usa',
        version: 'usa/v2'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify LLMConfig type
      const llmType = findByType(canonical.quads, 'LLMConfig');
      expect(llmType).toBeDefined();

      // Verify provider
      const providerQuad = findQuad(canonical.quads, 'llmProvider');
      expect(providerQuad).toBeDefined();
      expect(providerQuad.object.value).toBe('anthropic');

      // Verify model
      const modelQuad = findQuad(canonical.quads, 'llmModel');
      expect(modelQuad).toBeDefined();
      expect(modelQuad.object.value).toBe('claude-3-opus');

      // Verify temperature (typed)
      const tempQuad = findQuad(canonical.quads, 'temperature');
      expect(tempQuad).toBeDefined();
      expect(parseFloat(tempQuad.object.value)).toBe(0.7);

      // Verify max_tokens (typed)
      const maxTokensQuad = findQuad(canonical.quads, 'maxOutputTokens');
      expect(maxTokensQuad).toBeDefined();
      expect(parseInt(maxTokensQuad.object.value)).toBe(4096);

      // Verify LLM parameters as extension
      const paramsExt = canonical.extensions.find(
        e => e.namespace === 'usa' && e.property === 'llmParameters'
      );
      expect(paramsExt).toBeDefined();
      expect(JSON.parse(paramsExt!.value).top_p).toBe(0.9);

      // Verify runtime config as extension
      const runtimeExt = canonical.extensions.find(
        e => e.namespace === 'usa' && e.property === 'runtimeConfig'
      );
      expect(runtimeExt).toBeDefined();
      expect(JSON.parse(runtimeExt!.value).timeout).toBe(60);
    });
  });

  describe('toCanonical() - Deployment Translation', () => {
    it('should translate deployment configuration', async () => {
      const native: NativeAgent = {
        data: {
          apiVersion: 'usa/v2',
          kind: 'Agent',
          metadata: { name: 'test-agent', version: '1.0.0' },
          identity: { role: 'assistant', goal: 'help users' },
          capabilities: {},
          execution: { llm: { provider: 'openai', model: 'gpt-4' } },
          deployment: {
            context: 'production',
            environment: { NODE_ENV: 'production' },
            scaling: { min_instances: 1, max_instances: 10 }
          }
        },
        framework: 'usa',
        version: 'usa/v2'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify deployment context
      const contextQuad = findQuad(canonical.quads, 'deploymentContext', USA_NS);
      expect(contextQuad).toBeDefined();
      expect(contextQuad.object.value).toBe('production');

      // Verify deployment config as extension
      const deploymentExt = canonical.extensions.find(
        e => e.namespace === 'usa' && e.property === 'deploymentConfig'
      );
      expect(deploymentExt).toBeDefined();
      const parsed = JSON.parse(deploymentExt!.value);
      expect(parsed.scaling.max_instances).toBe(10);
    });
  });

  describe('toCanonical() - Field Tracking', () => {
    it('should track mapped, unmapped, and extension fields', async () => {
      const native: NativeAgent = {
        data: {
          apiVersion: 'usa/v2',
          kind: 'Agent',
          metadata: { name: 'test-agent', version: '1.0.0' },
          identity: {
            role: 'assistant',
            goal: 'help users',
            personality_traits: { curiosity: 0.8 }
          },
          capabilities: {
            reasoning: { strategy: 'react', max_iterations: 10 }
          },
          execution: { llm: { provider: 'openai', model: 'gpt-4' } }
        },
        framework: 'usa',
        version: 'usa/v2'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify mapped fields
      expect(canonical.metadata.mappedFields).toContain('metadata.name');
      expect(canonical.metadata.mappedFields).toContain('identity.role');
      expect(canonical.metadata.mappedFields).toContain('capabilities.reasoning.strategy');

      // Verify unmapped fields (extensions)
      expect(canonical.metadata.unmappedFields).toContain('apiVersion');
      expect(canonical.metadata.unmappedFields).toContain('identity.personality_traits');
    });
  });

  describe('toCanonical() - Integration Test', () => {
    it('should produce consistent results for complete agent', async () => {
      const native: NativeAgent = {
        data: {
          apiVersion: 'usa/v2',
          kind: 'Agent',
          metadata: {
            name: 'full-featured-agent',
            version: '2.0.0',
            description: 'A fully featured test agent',
            author: 'Test Suite',
            tags: ['test', 'complete']
          },
          identity: {
            role: 'AI Assistant',
            goal: 'Provide comprehensive assistance',
            backstory: 'Created for testing purposes',
            personality_traits: { helpfulness: 0.95, precision: 0.9 },
            constraints: ['Be truthful', 'Respect privacy']
          },
          capabilities: {
            tools: [
              { name: 'search', description: 'Web search', protocol: 'mcp' },
              { name: 'calculate', description: 'Math operations' }
            ],
            reasoning: { strategy: 'react', max_iterations: 20, allow_backtracking: true },
            memory: {
              architecture: 'hierarchical',
              working: { enabled: true, max_tokens: 8192 },
              semantic: { enabled: true, rag: { enabled: true, top_k: 10 } }
            }
          },
          protocols: {
            mcp: { enabled: true, role: 'client' },
            a2a: { enabled: true }
          },
          execution: {
            llm: { provider: 'anthropic', model: 'claude-3-sonnet', temperature: 0.5 },
            runtime: { timeout: 120 }
          },
          deployment: { context: 'staging' }
        },
        framework: 'usa',
        version: 'usa/v2'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify basic structure
      expect(canonical.uri).toContain('full-featured-agent');
      expect(canonical.sourceFramework).toBe('usa');
      expect(canonical.quads.length).toBeGreaterThan(30);
      expect(canonical.extensions.length).toBeGreaterThan(5);

      // Verify no lost fields for lossless translation
      expect(canonical.metadata.lostFields.length).toBe(0);

      // Verify translation time is recorded
      expect(canonical.metadata.translationTime).toBeGreaterThanOrEqual(0);
    });
  });
});
