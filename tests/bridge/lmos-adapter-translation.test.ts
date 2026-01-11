/**
 * LMOS Adapter Translation Tests
 * 
 * Tests for the decomposed toCanonical() translation methods in LMOSAdapter.
 * Verifies that each section of the LMOS/W3C WoT specification is correctly
 * translated to canonical RDF quads.
 * 
 * @module tests/bridge/lmos-adapter-translation
 */

import { LMOSAdapter } from '../../src/adapters/lmos-adapter';
import { NativeAgent, CanonicalAgent } from '../../src/adapters/base-adapter';

// Test constants
const CHRYSALIS_NS = 'https://chrysalis.dev/ontology/agent#';
const LMOS_NS = 'https://lmos.2060.io/lmos#';
const TD_NS = 'https://www.w3.org/2019/wot/td#';
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

describe('LMOSAdapter', () => {
  let adapter: LMOSAdapter;

  beforeEach(() => {
    adapter = new LMOSAdapter();
  });

  describe('toCanonical() - Type Declaration', () => {
    it('should add both Agent and Thing type declarations', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          '@type': 'Thing',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent'
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify Agent type
      const agentType = findByType(canonical.quads, 'Agent');
      expect(agentType).toBeDefined();

      // Verify Thing type (WoT)
      const thingType = findByType(canonical.quads, 'Thing', TD_NS);
      expect(thingType).toBeDefined();
    });
  });

  describe('toCanonical() - Metadata Translation', () => {
    it('should translate title to name', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'My LMOS Agent',
          description: 'A test LMOS agent',
          version: { instance: '2.0.0' }
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify name (from title)
      const nameQuad = findQuad(canonical.quads, 'name');
      expect(nameQuad).toBeDefined();
      expect(nameQuad.object.value).toBe('My LMOS Agent');

      // Verify description
      const descQuad = findQuad(canonical.quads, 'description');
      expect(descQuad).toBeDefined();
      expect(descQuad.object.value).toBe('A test LMOS agent');

      // Verify version
      const versionQuad = findQuad(canonical.quads, 'version');
      expect(versionQuad).toBeDefined();
      expect(versionQuad.object.value).toBe('2.0.0');
    });
  });

  describe('toCanonical() - Identity Translation', () => {
    it('should create DecentralizedIdentifier from DID', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:my-agent',
          title: 'Test Agent'
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify hasIdentity link
      const hasIdentityQuad = findQuad(canonical.quads, 'hasIdentity');
      expect(hasIdentityQuad).toBeDefined();

      // Verify DecentralizedIdentifier type
      const didType = findByType(canonical.quads, 'DecentralizedIdentifier');
      expect(didType).toBeDefined();

      // Verify identifier value
      const idValueQuad = findQuad(canonical.quads, 'identifierValue');
      expect(idValueQuad).toBeDefined();
      expect(idValueQuad.object.value).toBe('did:web:example.com:agent:my-agent');

      // Verify identifier scheme
      const schemeQuad = findQuad(canonical.quads, 'identifierScheme');
      expect(schemeQuad).toBeDefined();
      expect(schemeQuad.object.value).toBe('did:web');
    });

    it('should handle non-DID identifiers', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'https://example.com/agent/test',
          title: 'Test Agent'
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify identifier scheme is 'uri' for non-DID
      const schemeQuad = findQuad(canonical.quads, 'identifierScheme');
      expect(schemeQuad).toBeDefined();
      expect(schemeQuad.object.value).toBe('uri');
    });
  });

  describe('toCanonical() - Security Translation', () => {
    it('should extract public keys from security definitions', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent',
          securityDefinitions: {
            did_security: {
              scheme: 'did',
              pubKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIBIj...\n-----END PUBLIC KEY-----'
            }
          },
          security: ['did_security']
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify public key extracted
      const pubKeyQuad = findQuad(canonical.quads, 'publicKey');
      expect(pubKeyQuad).toBeDefined();
      expect(pubKeyQuad.object.value).toContain('BEGIN PUBLIC KEY');

      // Verify security definitions preserved as extension
      const secDefExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === 'securityDefinitions'
      );
      expect(secDefExt).toBeDefined();

      // Verify security reference preserved as extension
      const secExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === 'security'
      );
      expect(secExt).toBeDefined();
    });
  });

  describe('toCanonical() - Agent Class Translation', () => {
    it('should translate lmos:agentClass', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent',
          'lmos:agentClass': 'AssistantAgent'
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      const agentClassQuad = findQuad(canonical.quads, 'agentClass', LMOS_NS);
      expect(agentClassQuad).toBeDefined();
      expect(agentClassQuad.object.value).toBe('AssistantAgent');
    });
  });

  describe('toCanonical() - Actions Translation', () => {
    it('should translate WoT actions to Chrysalis tools', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent',
          actions: {
            generateText: {
              title: 'Generate Text',
              description: 'Generate text using LLM',
              input: {
                type: 'object',
                properties: {
                  prompt: { type: 'string' }
                },
                required: ['prompt']
              },
              output: {
                type: 'object',
                properties: {
                  text: { type: 'string' }
                }
              },
              forms: [
                { href: 'https://api.example.com/generate', contentType: 'application/json' }
              ]
            },
            searchWeb: {
              description: 'Search the web',
              forms: [{ href: 'https://api.example.com/search' }]
            }
          }
        },
        framework: 'lmos',
        version: '1.1'
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
      expect(names).toContain('generateText');
      expect(names).toContain('searchWeb');

      // Verify input schema (JSON serialized)
      const inputSchemas = findQuads(canonical.quads, 'inputSchema');
      expect(inputSchemas.length).toBe(1);
      const inputSchema = JSON.parse(inputSchemas[0].object.value);
      expect(inputSchema.properties.prompt).toBeDefined();

      // Verify output schema
      const outputSchemas = findQuads(canonical.quads, 'outputSchema');
      expect(outputSchemas.length).toBe(1);

      // Verify tool endpoints
      const endpoints = findQuads(canonical.quads, 'toolEndpoint');
      expect(endpoints.length).toBe(2);

      // Verify forms preserved as extensions
      const formsExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === 'action.generateText.forms'
      );
      expect(formsExt).toBeDefined();
    });
  });

  describe('toCanonical() - WoT Affordances Translation', () => {
    it('should preserve properties as extensions', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent',
          properties: {
            status: {
              type: 'string',
              observable: true,
              readOnly: true,
              enum: ['idle', 'processing', 'error']
            },
            memoryUsage: {
              type: 'number',
              unit: 'bytes'
            }
          }
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify properties preserved as extensions
      const statusExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === 'property.status'
      );
      expect(statusExt).toBeDefined();
      const statusParsed = JSON.parse(statusExt!.value);
      expect(statusParsed.observable).toBe(true);
      expect(statusParsed.enum).toContain('idle');

      const memoryExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === 'property.memoryUsage'
      );
      expect(memoryExt).toBeDefined();
    });

    it('should preserve events and links as extensions', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent',
          events: {
            statusChanged: {
              data: { type: 'string' }
            }
          },
          links: [
            { href: 'https://docs.example.com', rel: 'documentation' }
          ]
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify events preserved
      const eventsExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === 'events'
      );
      expect(eventsExt).toBeDefined();

      // Verify links preserved
      const linksExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === 'links'
      );
      expect(linksExt).toBeDefined();
    });
  });

  describe('toCanonical() - Forms Translation', () => {
    it('should translate top-level forms to protocol bindings', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent',
          forms: [
            { href: 'https://api.example.com/v1', contentType: 'application/json' },
            { href: 'wss://api.example.com/ws', subprotocol: 'websocket' }
          ]
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify HTTPBinding
      const httpBinding = findByType(canonical.quads, 'HTTPBinding');
      expect(httpBinding).toBeDefined();

      // Verify WebSocketBinding
      const wsBinding = findByType(canonical.quads, 'WebSocketBinding');
      expect(wsBinding).toBeDefined();

      // Verify endpoints
      const endpoints = findQuads(canonical.quads, 'endpointUrl');
      expect(endpoints.length).toBe(2);
      const urls = endpoints.map(q => q.object.value);
      expect(urls).toContain('https://api.example.com/v1');
      expect(urls).toContain('wss://api.example.com/ws');
    });
  });

  describe('toCanonical() - LLM Config Translation', () => {
    it('should translate lmos:llmConfig', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent',
          'lmos:llmConfig': {
            provider: 'openai',
            model: 'gpt-4-turbo',
            temperature: 0.7,
            maxTokens: 4096,
            systemPrompt: 'You are a helpful assistant.'
          }
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify LLMConfig type
      const llmType = findByType(canonical.quads, 'LLMConfig');
      expect(llmType).toBeDefined();

      // Verify provider
      const providerQuad = findQuad(canonical.quads, 'llmProvider');
      expect(providerQuad).toBeDefined();
      expect(providerQuad.object.value).toBe('openai');

      // Verify model
      const modelQuad = findQuad(canonical.quads, 'llmModel');
      expect(modelQuad).toBeDefined();
      expect(modelQuad.object.value).toBe('gpt-4-turbo');

      // Verify temperature
      const tempQuad = findQuad(canonical.quads, 'temperature');
      expect(tempQuad).toBeDefined();
      expect(parseFloat(tempQuad.object.value)).toBe(0.7);

      // Verify maxOutputTokens
      const maxTokensQuad = findQuad(canonical.quads, 'maxOutputTokens');
      expect(maxTokensQuad).toBeDefined();
      expect(parseInt(maxTokensQuad.object.value)).toBe(4096);

      // Verify systemPrompt
      const promptQuad = findQuad(canonical.quads, 'systemPrompt');
      expect(promptQuad).toBeDefined();
      expect(promptQuad.object.value).toBe('You are a helpful assistant.');
    });
  });

  describe('toCanonical() - Memory Config Translation', () => {
    it('should translate lmos:memory', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent',
          'lmos:memory': {
            type: 'semantic',
            contextWindow: 8192,
            vectorStore: {
              provider: 'pinecone',
              config: { index: 'agent-memory', namespace: 'prod' }
            }
          }
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify MemorySystem type
      const memorySystemType = findByType(canonical.quads, 'MemorySystem');
      expect(memorySystemType).toBeDefined();

      // Verify SemanticMemory type
      const semanticType = findByType(canonical.quads, 'SemanticMemory');
      expect(semanticType).toBeDefined();

      // Verify memoryEnabled
      const enabledQuad = findQuad(canonical.quads, 'memoryEnabled');
      expect(enabledQuad).toBeDefined();

      // Verify maxTokens (from contextWindow)
      const maxTokensQuad = findQuad(canonical.quads, 'maxTokens');
      expect(maxTokensQuad).toBeDefined();
      expect(parseInt(maxTokensQuad.object.value)).toBe(8192);

      // Verify storageBackend
      const storageQuad = findQuad(canonical.quads, 'storageBackend');
      expect(storageQuad).toBeDefined();
      expect(storageQuad.object.value).toBe('pinecone');

      // Verify vectorStore config as extension
      const configExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === 'vectorStoreConfig'
      );
      expect(configExt).toBeDefined();
      const configParsed = JSON.parse(configExt!.value);
      expect(configParsed.index).toBe('agent-memory');
    });

    it('should map memory types correctly', async () => {
      const memoryTypes = ['working', 'episodic', 'semantic', 'procedural', 'core'];
      const expectedClasses = ['WorkingMemory', 'EpisodicMemory', 'SemanticMemory', 'ProceduralMemory', 'CoreMemory'];

      for (let i = 0; i < memoryTypes.length; i++) {
        const native: NativeAgent = {
          data: {
            '@context': 'https://www.w3.org/2022/wot/td/v1.1',
            id: 'did:web:example.com:agent:test',
            title: 'Test Agent',
            'lmos:memory': { type: memoryTypes[i] }
          },
          framework: 'lmos',
          version: '1.1'
        };

        const canonical = await adapter.toCanonical(native);
        const memType = findByType(canonical.quads, expectedClasses[i]);
        expect(memType).toBeDefined();
      }
    });
  });

  describe('toCanonical() - Protocols Translation', () => {
    it('should translate lmos:protocols flags', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent',
          'lmos:protocols': {
            mcp: true,
            a2a: true,
            http: true,
            websocket: true
          }
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify all protocol bindings
      const mcpBinding = findByType(canonical.quads, 'MCPBinding');
      expect(mcpBinding).toBeDefined();

      const a2aBinding = findByType(canonical.quads, 'A2ABinding');
      expect(a2aBinding).toBeDefined();

      const httpBinding = findByType(canonical.quads, 'HTTPBinding');
      expect(httpBinding).toBeDefined();

      const wsBinding = findByType(canonical.quads, 'WebSocketBinding');
      expect(wsBinding).toBeDefined();
    });

    it('should only create bindings for enabled protocols', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent',
          'lmos:protocols': {
            mcp: true,
            a2a: false,
            http: true,
            websocket: false
          }
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify enabled protocols
      const mcpBinding = findByType(canonical.quads, 'MCPBinding');
      expect(mcpBinding).toBeDefined();

      const httpBinding = findByType(canonical.quads, 'HTTPBinding');
      expect(httpBinding).toBeDefined();

      // Verify disabled protocols not present
      const a2aBinding = findByType(canonical.quads, 'A2ABinding');
      expect(a2aBinding).toBeUndefined();

      const wsBinding = findByType(canonical.quads, 'WebSocketBinding');
      expect(wsBinding).toBeUndefined();
    });
  });

  describe('toCanonical() - Additional Metadata Translation', () => {
    it('should preserve JSON-LD context as extension', async () => {
      const native: NativeAgent = {
        data: {
          '@context': [
            'https://www.w3.org/2022/wot/td/v1.1',
            { 'lmos': 'https://lmos.2060.io/lmos#' }
          ],
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent'
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      const contextExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === '@context'
      );
      expect(contextExt).toBeDefined();
      const contextParsed = JSON.parse(contextExt!.value);
      expect(Array.isArray(contextParsed)).toBe(true);
    });

    it('should preserve timestamps and support info', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent',
          created: '2024-01-15T10:00:00Z',
          modified: '2024-06-20T14:30:00Z',
          base: 'https://api.example.com/',
          support: 'mailto:support@example.com'
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify all metadata preserved
      const createdExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === 'created'
      );
      expect(createdExt).toBeDefined();
      expect(createdExt!.value).toBe('2024-01-15T10:00:00Z');

      const modifiedExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === 'modified'
      );
      expect(modifiedExt).toBeDefined();

      const baseExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === 'base'
      );
      expect(baseExt).toBeDefined();

      const supportExt = canonical.extensions.find(
        e => e.namespace === 'lmos' && e.property === 'support'
      );
      expect(supportExt).toBeDefined();
    });
  });

  describe('toCanonical() - Field Tracking', () => {
    it('should track mapped and unmapped fields', async () => {
      const native: NativeAgent = {
        data: {
          '@context': 'https://www.w3.org/2022/wot/td/v1.1',
          id: 'did:web:example.com:agent:test',
          title: 'Test Agent',
          description: 'A test agent',
          'lmos:llmConfig': { provider: 'openai', model: 'gpt-4' },
          events: { statusChanged: { data: { type: 'string' } } }
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify mapped fields
      expect(canonical.metadata.mappedFields).toContain('title');
      expect(canonical.metadata.mappedFields).toContain('description');
      expect(canonical.metadata.mappedFields).toContain('id');
      expect(canonical.metadata.mappedFields).toContain('lmos:llmConfig');

      // Verify unmapped fields (extensions)
      expect(canonical.metadata.unmappedFields).toContain('@context');
      expect(canonical.metadata.unmappedFields).toContain('events');
    });
  });

  describe('toCanonical() - Integration Test', () => {
    it('should produce consistent results for complete LMOS agent', async () => {
      const native: NativeAgent = {
        data: {
          '@context': [
            'https://www.w3.org/2022/wot/td/v1.1',
            { 'lmos': 'https://lmos.2060.io/lmos#' }
          ],
          '@type': 'Thing',
          id: 'did:web:chrysalis.dev:agent:full-featured',
          title: 'Full Featured LMOS Agent',
          description: 'A comprehensive LMOS agent for testing',
          version: { instance: '1.5.0' },
          created: '2024-01-01T00:00:00Z',
          modified: '2024-06-15T12:00:00Z',
          base: 'https://api.chrysalis.dev/',
          support: 'https://support.chrysalis.dev',
          securityDefinitions: {
            bearer_sc: { scheme: 'bearer', in: 'header', name: 'Authorization' }
          },
          security: ['bearer_sc'],
          'lmos:agentClass': 'AssistantAgent',
          actions: {
            chat: {
              title: 'Chat with agent',
              input: { type: 'object', properties: { message: { type: 'string' } } },
              output: { type: 'object', properties: { response: { type: 'string' } } },
              forms: [{ href: '/chat', contentType: 'application/json' }]
            }
          },
          properties: {
            status: { type: 'string', observable: true }
          },
          events: {
            messageReceived: { data: { type: 'object' } }
          },
          forms: [
            { href: 'https://api.chrysalis.dev/v1', contentType: 'application/json' }
          ],
          'lmos:llmConfig': {
            provider: 'anthropic',
            model: 'claude-3-sonnet',
            temperature: 0.5,
            maxTokens: 4096
          },
          'lmos:memory': {
            type: 'semantic',
            contextWindow: 16000,
            vectorStore: { provider: 'qdrant' }
          },
          'lmos:protocols': {
            mcp: true,
            a2a: true,
            http: true
          }
        },
        framework: 'lmos',
        version: '1.1'
      };

      const canonical = await adapter.toCanonical(native);

      // Verify basic structure
      expect(canonical.uri).toContain('full-featured');
      expect(canonical.sourceFramework).toBe('lmos');
      expect(canonical.quads.length).toBeGreaterThan(25);
      expect(canonical.extensions.length).toBeGreaterThan(5);

      // Verify no lost fields for lossless translation
      expect(canonical.metadata.lostFields.length).toBe(0);

      // Verify translation time is recorded
      expect(canonical.metadata.translationTime).toBeGreaterThanOrEqual(0);
    });
  });
});
