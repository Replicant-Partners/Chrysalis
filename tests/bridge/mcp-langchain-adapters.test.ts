/**
 * MCP and LangChain Adapter Tests
 *
 * Tests for MCP and LangChain adapters including forward/reverse translation,
 * validation, round-trip fidelity, and cross-adapter translation.
 */

import { MCPAdapter, createMCPAdapter, MCPServer } from '../../src/adapters/mcp-adapter';
import { LangChainAdapter, createLangChainAdapter, LangChainAgent } from '../../src/adapters/langchain-adapter';
import { NativeAgent, AgentFramework } from '../../src/adapters/base-adapter';
import { CHRYSALIS_NS } from '../../src/rdf/temporal-store';

// Helper to cast typed data to NativeAgent format
function toNativeAgent(data: MCPServer | LangChainAgent, framework: AgentFramework): NativeAgent {
  return {
    data: data as unknown as Record<string, unknown>,
    framework
  };
}

// Helper to extract typed data from NativeAgent
function fromNativeAgent<T>(native: NativeAgent): T {
  return native.data as unknown as T;
}

// ============================================================================
// Test Data
// ============================================================================

const sampleMCPServer: MCPServer = {
  name: 'filesystem-server',
  version: '1.0.0',
  description: 'MCP server for filesystem operations',
  transport: {
    type: 'stdio',
    command: 'node',
    args: ['./mcp-server.js'],
    env: {
      NODE_ENV: 'production'
    }
  },
  capabilities: {
    tools: true,
    resources: true,
    prompts: false,
    logging: true
  },
  tools: [
    {
      name: 'read_file',
      description: 'Read contents of a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' }
        },
        required: ['path']
      }
    },
    {
      name: 'write_file',
      description: 'Write contents to a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write' }
        },
        required: ['path', 'content']
      }
    }
  ],
  resources: [
    {
      uri: 'file:///workspace',
      name: 'workspace',
      description: 'Current workspace directory',
      mimeType: 'inode/directory'
    }
  ],
  prompts: [
    {
      name: 'code-review',
      description: 'Perform code review',
      arguments: [
        { name: 'file', description: 'File to review', required: true }
      ]
    }
  ]
};

const sampleLangChainAgent: LangChainAgent = {
  name: 'research-assistant',
  description: 'An AI research assistant powered by LangChain',
  version: '2.0.0',
  agentType: 'openai-functions',
  verbose: true,
  maxIterations: 15,
  earlyStoppingMethod: 'generate',
  llm: {
    type: 'openai',
    model: 'gpt-4-turbo',
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
    modelKwargs: {
      seed: 42
    }
  },
  tools: [
    {
      name: 'search_web',
      description: 'Search the web for information',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          maxResults: { type: 'number', description: 'Max results to return' }
        },
        required: ['query']
      },
      returnDirect: false
    },
    {
      name: 'calculate',
      description: 'Perform mathematical calculations',
      schema: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Math expression to evaluate' }
        },
        required: ['expression']
      }
    }
  ],
  memory: {
    type: 'buffer-window',
    k: 10,
    memoryKey: 'chat_history',
    returnMessages: true
  },
  prompt: {
    type: 'chat',
    systemMessage: 'You are a helpful research assistant.',
    inputVariables: ['input', 'chat_history']
  },
  outputParser: {
    type: 'structured',
    responseSchemas: [
      { name: 'answer', description: 'The answer to the question' },
      { name: 'sources', description: 'Sources used for the answer' }
    ]
  },
  tags: ['research', 'assistant', 'production']
};

// ============================================================================
// MCP Adapter Tests
// ============================================================================

describe('MCPAdapter', () => {
  let adapter: MCPAdapter;

  beforeEach(() => {
    adapter = new MCPAdapter();
  });

  describe('constructor', () => {
    it('should create adapter with default config', () => {
      expect(adapter.framework).toBe('mcp');
      expect(adapter.name).toBe('Anthropic MCP Adapter');
      expect(adapter.version).toBe('1.0.0');
    });

    it('should accept custom config', () => {
      const customAdapter = createMCPAdapter({
        mode: 'client',
        defaultTransport: 'http'
      });
      expect(customAdapter).toBeInstanceOf(MCPAdapter);
    });
  });

  describe('validateNative', () => {
    it('should validate correct MCP server', () => {
      const native = toNativeAgent(sampleMCPServer, 'mcp');

      const result = adapter.validateNative(native);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject server without name', () => {
      const invalidServer = { ...sampleMCPServer };
      delete (invalidServer as Record<string, unknown>).name;

      const native = toNativeAgent(invalidServer, 'mcp');

      const result = adapter.validateNative(native);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_NAME')).toBe(true);
    });

    it('should reject server without transport', () => {
      const invalidServer = { ...sampleMCPServer };
      delete (invalidServer as Record<string, unknown>).transport;

      const native = toNativeAgent(invalidServer, 'mcp');

      const result = adapter.validateNative(native);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_TRANSPORT')).toBe(true);
    });

    it('should reject invalid transport type', () => {
      const invalidServer: MCPServer = {
        ...sampleMCPServer,
        transport: {
          type: 'invalid' as MCPServer['transport']['type'],
        }
      };

      const native = toNativeAgent(invalidServer, 'mcp');

      const result = adapter.validateNative(native);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_TRANSPORT')).toBe(true);
    });

    it('should require URL for http transport', () => {
      const httpServer: MCPServer = {
        ...sampleMCPServer,
        transport: {
          type: 'http'
        }
      };

      const native = toNativeAgent(httpServer, 'mcp');

      const result = adapter.validateNative(native);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_URL')).toBe(true);
    });

    it('should warn about tools without names', () => {
      const serverWithBadTool: MCPServer = {
        ...sampleMCPServer,
        tools: [{ name: '', inputSchema: { type: 'object' } }]
      };

      const native = toNativeAgent(serverWithBadTool, 'mcp');

      const result = adapter.validateNative(native);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'TOOL_MISSING_NAME')).toBe(true);
    });
  });

  describe('toCanonical', () => {
    it('should convert MCP server to canonical form', async () => {
      const native = toNativeAgent(sampleMCPServer, 'mcp');

      const canonical = await adapter.toCanonical(native);

      expect(canonical.uri).toContain('filesystem-server');
      expect(canonical.sourceFramework).toBe('mcp');
      expect(canonical.quads.length).toBeGreaterThan(0);
    });

    it('should include Agent type triple', async () => {
      const native = toNativeAgent(sampleMCPServer, 'mcp');

      const canonical = await adapter.toCanonical(native);

      const typeTriple = canonical.quads.find(q =>
        q.predicate.value.includes('type') &&
        q.object.value === `${CHRYSALIS_NS}Agent`
      );
      expect(typeTriple).toBeDefined();
    });

    it('should include name property', async () => {
      const native = toNativeAgent(sampleMCPServer, 'mcp');

      const canonical = await adapter.toCanonical(native);

      const nameTriple = canonical.quads.find(q =>
        q.predicate.value === `${CHRYSALIS_NS}name`
      );
      expect(nameTriple).toBeDefined();
      expect(nameTriple!.object.value).toBe('filesystem-server');
    });

    it('should convert tools', async () => {
      const native = toNativeAgent(sampleMCPServer, 'mcp');

      const canonical = await adapter.toCanonical(native);

      const toolTriples = canonical.quads.filter(q =>
        q.predicate.value === `${CHRYSALIS_NS}hasTool`
      );
      expect(toolTriples.length).toBe(2);
    });

    it('should preserve tool schemas in extensions', async () => {
      const native = toNativeAgent(sampleMCPServer, 'mcp');

      const canonical = await adapter.toCanonical(native);

      const schemaExt = canonical.extensions.find(e =>
        e.property.includes('inputSchema')
      );
      expect(schemaExt).toBeDefined();
      // Extension should have the value preserved as JSON
      expect(schemaExt!.value).toBeDefined();
    });

    it('should convert resources', async () => {
      const native = toNativeAgent(sampleMCPServer, 'mcp');

      const canonical = await adapter.toCanonical(native);

      const resourceTriples = canonical.quads.filter(q =>
        q.predicate.value.includes('hasResource')
      );
      expect(resourceTriples.length).toBe(1);
    });

    it('should calculate fidelity score', async () => {
      const native = toNativeAgent(sampleMCPServer, 'mcp');

      const canonical = await adapter.toCanonical(native);

      expect(canonical.metadata.fidelityScore).toBeGreaterThan(0);
      expect(canonical.metadata.fidelityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('fromCanonical', () => {
    it('should convert canonical back to MCP format', async () => {
      const native = toNativeAgent(sampleMCPServer, 'mcp');

      const canonical = await adapter.toCanonical(native);
      const reconstructed = await adapter.fromCanonical(canonical);

      expect(reconstructed.framework).toBe('mcp');
      const data = fromNativeAgent<MCPServer>(reconstructed);
      expect(data.name).toBe('filesystem-server');
    });

    it('should restore transport configuration', async () => {
      const native = toNativeAgent(sampleMCPServer, 'mcp');

      const canonical = await adapter.toCanonical(native);
      const reconstructed = await adapter.fromCanonical(canonical);

      const data = fromNativeAgent<MCPServer>(reconstructed);
      expect(data.transport.type).toBe('stdio');
      expect(data.transport.command).toBe('node');
    });

    it('should restore tools', async () => {
      const native = toNativeAgent(sampleMCPServer, 'mcp');

      const canonical = await adapter.toCanonical(native);
      const reconstructed = await adapter.fromCanonical(canonical);

      const data = fromNativeAgent<MCPServer>(reconstructed);
      expect(data.tools).toBeDefined();
      expect(data.tools!.length).toBe(2);
    });
  });

  describe('roundTrip', () => {
    it('should perform round-trip translation', async () => {
      const native = toNativeAgent(sampleMCPServer, 'mcp');

      const result = await adapter.roundTrip(native);

      expect(result.original).toBe(native);
      expect(result.canonical).toBeDefined();
      expect(result.reconstructed).toBeDefined();
      expect(result.fidelityScore).toBeDefined();
    });
  });
});

// ============================================================================
// LangChain Adapter Tests
// ============================================================================

describe('LangChainAdapter', () => {
  let adapter: LangChainAdapter;

  beforeEach(() => {
    adapter = new LangChainAdapter();
  });

  describe('constructor', () => {
    it('should create adapter with default config', () => {
      expect(adapter.framework).toBe('langchain');
      expect(adapter.name).toBe('LangChain Agent Adapter');
      expect(adapter.version).toBe('1.0.0');
    });

    it('should accept custom config', () => {
      const customAdapter = createLangChainAdapter({
        defaultAgentType: 'openai-tools',
        includeCallbacks: true
      });
      expect(customAdapter).toBeInstanceOf(LangChainAdapter);
    });
  });

  describe('validateNative', () => {
    it('should validate correct LangChain agent', () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const result = adapter.validateNative(native);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject agent without name', () => {
      const invalidAgent = { ...sampleLangChainAgent };
      delete (invalidAgent as Record<string, unknown>).name;

      const native = toNativeAgent(invalidAgent, 'langchain');

      const result = adapter.validateNative(native);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_NAME')).toBe(true);
    });

    it('should reject agent without agentType', () => {
      const invalidAgent = { ...sampleLangChainAgent };
      delete (invalidAgent as Record<string, unknown>).agentType;

      const native = toNativeAgent(invalidAgent, 'langchain');

      const result = adapter.validateNative(native);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_AGENT_TYPE')).toBe(true);
    });

    it('should reject agent without LLM config', () => {
      const invalidAgent = { ...sampleLangChainAgent };
      delete (invalidAgent as Record<string, unknown>).llm;

      const native = toNativeAgent(invalidAgent, 'langchain');

      const result = adapter.validateNative(native);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_LLM')).toBe(true);
    });

    it('should warn about unknown agent type', () => {
      const agentWithUnknownType: LangChainAgent = {
        ...sampleLangChainAgent,
        agentType: 'unknown-type' as LangChainAgent['agentType']
      };

      const native = toNativeAgent(agentWithUnknownType, 'langchain');

      const result = adapter.validateNative(native);
      expect(result.warnings.some(w => w.code === 'UNKNOWN_AGENT_TYPE')).toBe(true);
    });

    it('should warn about tools without descriptions', () => {
      const agentWithBadTool: LangChainAgent = {
        ...sampleLangChainAgent,
        tools: [{ name: 'test_tool', description: '' }]
      };

      const native = toNativeAgent(agentWithBadTool, 'langchain');

      const result = adapter.validateNative(native);
      expect(result.warnings.some(w => w.code === 'TOOL_MISSING_DESCRIPTION')).toBe(true);
    });

    it('should warn about missing memory', () => {
      const agentNoMemory: LangChainAgent = {
        ...sampleLangChainAgent,
        memory: undefined
      };

      const native = toNativeAgent(agentNoMemory, 'langchain');

      const result = adapter.validateNative(native);
      expect(result.warnings.some(w => w.code === 'NO_MEMORY')).toBe(true);
    });
  });

  describe('toCanonical', () => {
    it('should convert LangChain agent to canonical form', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);

      expect(canonical.uri).toContain('research-assistant');
      expect(canonical.sourceFramework).toBe('langchain');
      expect(canonical.quads.length).toBeGreaterThan(0);
    });

    it('should include Agent type triple', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);

      const typeTriple = canonical.quads.find(q =>
        q.predicate.value.includes('type') &&
        q.object.value === `${CHRYSALIS_NS}Agent`
      );
      expect(typeTriple).toBeDefined();
    });

    it('should include agent type property', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);

      const agentTypeTriple = canonical.quads.find(q =>
        q.predicate.value.includes('agentType')
      );
      expect(agentTypeTriple).toBeDefined();
      expect(agentTypeTriple!.object.value).toBe('openai-functions');
    });

    it('should convert LLM configuration', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);

      const providerTriple = canonical.quads.find(q =>
        q.predicate.value === `${CHRYSALIS_NS}llmProvider`
      );
      expect(providerTriple).toBeDefined();
      expect(providerTriple!.object.value).toBe('openai');

      const modelTriple = canonical.quads.find(q =>
        q.predicate.value === `${CHRYSALIS_NS}llmModel`
      );
      expect(modelTriple).toBeDefined();
      expect(modelTriple!.object.value).toBe('gpt-4-turbo');
    });

    it('should convert tools', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);

      const toolTriples = canonical.quads.filter(q =>
        q.predicate.value === `${CHRYSALIS_NS}hasTool`
      );
      expect(toolTriples.length).toBe(2);
    });

    it('should convert memory configuration', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);

      const memoryTriple = canonical.quads.find(q =>
        q.predicate.value === `${CHRYSALIS_NS}hasMemory`
      );
      expect(memoryTriple).toBeDefined();
    });

    it('should preserve tags', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);

      const tagTriples = canonical.quads.filter(q =>
        q.predicate.value === `${CHRYSALIS_NS}tag`
      );
      expect(tagTriples.length).toBe(3);
    });

    it('should preserve complex configs as extensions', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);

      // Memory config should be preserved (using 'property' not 'key')
      const memoryExt = canonical.extensions.find(e => e.property === 'memory.full');
      expect(memoryExt).toBeDefined();

      // Prompt config should be preserved
      const promptExt = canonical.extensions.find(e => e.property === 'prompt.full');
      expect(promptExt).toBeDefined();
    });
  });

  describe('fromCanonical', () => {
    it('should convert canonical back to LangChain format', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);
      const reconstructed = await adapter.fromCanonical(canonical);

      expect(reconstructed.framework).toBe('langchain');
      const data = fromNativeAgent<LangChainAgent>(reconstructed);
      expect(data.name).toBe('research-assistant');
      expect(data.agentType).toBe('openai-functions');
    });

    it('should restore LLM configuration', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);
      const reconstructed = await adapter.fromCanonical(canonical);

      const data = fromNativeAgent<LangChainAgent>(reconstructed);
      expect(data.llm.type).toBe('openai');
      expect(data.llm.model).toBe('gpt-4-turbo');
      expect(data.llm.temperature).toBe(0.7);
    });

    it('should restore tools', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);
      const reconstructed = await adapter.fromCanonical(canonical);

      const data = fromNativeAgent<LangChainAgent>(reconstructed);
      expect(data.tools).toBeDefined();
      expect(data.tools!.length).toBe(2);
    });

    it('should restore memory configuration from extensions', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);
      const reconstructed = await adapter.fromCanonical(canonical);

      const data = fromNativeAgent<LangChainAgent>(reconstructed);
      expect(data.memory).toBeDefined();
      expect(data.memory!.type).toBe('buffer-window');
      expect(data.memory!.k).toBe(10);
    });

    it('should restore tags', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const canonical = await adapter.toCanonical(native);
      const reconstructed = await adapter.fromCanonical(canonical);

      const data = fromNativeAgent<LangChainAgent>(reconstructed);
      expect(data.tags).toBeDefined();
      expect(data.tags!.length).toBe(3);
    });
  });

  describe('roundTrip', () => {
    it('should perform round-trip translation', async () => {
      const native = toNativeAgent(sampleLangChainAgent, 'langchain');

      const result = await adapter.roundTrip(native);

      expect(result.original).toBe(native);
      expect(result.canonical).toBeDefined();
      expect(result.reconstructed).toBeDefined();
      expect(result.fidelityScore).toBeDefined();
    });
  });
});

// ============================================================================
// Cross-Adapter Translation Tests
// ============================================================================

describe('Cross-Adapter Translation (MCP ↔ LangChain)', () => {
  let mcpAdapter: MCPAdapter;
  let langchainAdapter: LangChainAdapter;

  beforeEach(() => {
    mcpAdapter = new MCPAdapter();
    langchainAdapter = new LangChainAdapter();
  });

  it('should translate MCP to LangChain via canonical', async () => {
    const native = toNativeAgent(sampleMCPServer, 'mcp');

    // MCP → Canonical
    const canonical = await mcpAdapter.toCanonical(native);
    
    // Canonical → LangChain
    const langchainAgent = await langchainAdapter.fromCanonical(canonical);

    expect(langchainAgent.framework).toBe('langchain');
    const data = fromNativeAgent<LangChainAgent>(langchainAgent);
    expect(data.name).toBe('filesystem-server');
  });

  it('should translate LangChain to MCP via canonical', async () => {
    const native = toNativeAgent(sampleLangChainAgent, 'langchain');

    // LangChain → Canonical
    const canonical = await langchainAdapter.toCanonical(native);
    
    // Canonical → MCP
    const mcpServer = await mcpAdapter.fromCanonical(canonical);

    expect(mcpServer.framework).toBe('mcp');
    const data = fromNativeAgent<MCPServer>(mcpServer);
    expect(data.name).toBe('research-assistant');
  });

  it('should preserve tool information across frameworks', async () => {
    const native = toNativeAgent(sampleMCPServer, 'mcp');

    const canonical = await mcpAdapter.toCanonical(native);
    const langchainAgent = await langchainAdapter.fromCanonical(canonical);

    const data = fromNativeAgent<LangChainAgent>(langchainAgent);
    expect(data.tools).toBeDefined();
    expect(data.tools!.length).toBe(2);
    expect(data.tools!.some(t => t.name === 'read_file')).toBe(true);
  });

  it('should preserve LLM config from LangChain to MCP', async () => {
    const native = toNativeAgent(sampleLangChainAgent, 'langchain');

    const canonical = await langchainAdapter.toCanonical(native);
    
    // Verify canonical has LLM info
    const providerTriple = canonical.quads.find(q =>
      q.predicate.value === `${CHRYSALIS_NS}llmProvider`
    );
    expect(providerTriple).toBeDefined();
    expect(providerTriple!.object.value).toBe('openai');
  });
});

// ============================================================================
// HTTP Transport MCP Tests
// ============================================================================

describe('MCPAdapter HTTP Transport', () => {
  let adapter: MCPAdapter;

  beforeEach(() => {
    adapter = new MCPAdapter();
  });

  it('should handle HTTP transport configuration', async () => {
    const httpServer: MCPServer = {
      name: 'api-server',
      transport: {
        type: 'http',
        url: 'https://api.example.com/mcp',
        headers: {
          'Authorization': 'Bearer token123'
        }
      },
      tools: [
        {
          name: 'api_call',
          description: 'Make API call',
          inputSchema: { type: 'object' }
        }
      ]
    };

    const native = toNativeAgent(httpServer, 'mcp');

    const canonical = await adapter.toCanonical(native);
    const reconstructed = await adapter.fromCanonical(canonical);

    const data = fromNativeAgent<MCPServer>(reconstructed);
    expect(data.transport.type).toBe('http');
    expect(data.transport.url).toBe('https://api.example.com/mcp');
    expect(data.transport.headers).toBeDefined();
  });
});

// ============================================================================
// LangChain Memory Types Tests
// ============================================================================

describe('LangChainAdapter Memory Types', () => {
  let adapter: LangChainAdapter;

  beforeEach(() => {
    adapter = new LangChainAdapter();
  });

  it('should handle vector-store memory', async () => {
    const vectorAgent: LangChainAgent = {
      ...sampleLangChainAgent,
      memory: {
        type: 'vector-store',
        vectorStore: {
          type: 'chroma',
          collectionName: 'agent_memory',
          embeddingModel: 'text-embedding-3-small'
        }
      }
    };

    const native = toNativeAgent(vectorAgent, 'langchain');

    const canonical = await adapter.toCanonical(native);
    const reconstructed = await adapter.fromCanonical(canonical);

    const data = fromNativeAgent<LangChainAgent>(reconstructed);
    expect(data.memory!.type).toBe('vector-store');
    expect(data.memory!.vectorStore).toBeDefined();
    expect(data.memory!.vectorStore!.type).toBe('chroma');
  });

  it('should handle summary memory', async () => {
    const summaryAgent: LangChainAgent = {
      ...sampleLangChainAgent,
      memory: {
        type: 'summary',
        maxTokenLimit: 2000,
        llm: {
          type: 'openai',
          model: 'gpt-3.5-turbo'
        }
      }
    };

    const native = toNativeAgent(summaryAgent, 'langchain');

    const canonical = await adapter.toCanonical(native);
    const reconstructed = await adapter.fromCanonical(canonical);

    const data = fromNativeAgent<LangChainAgent>(reconstructed);
    expect(data.memory!.type).toBe('summary');
  });
});
