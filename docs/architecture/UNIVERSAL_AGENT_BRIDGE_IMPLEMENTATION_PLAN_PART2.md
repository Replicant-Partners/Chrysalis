# Chrysalis Universal Agent Bridge: Implementation Plan (Part 2)

**Continuation of UNIVERSAL_AGENT_BRIDGE_IMPLEMENTATION_PLAN.md**

---

## 6. Chrysalis Agent Type Adapters (Continued)

### 6.2 MCP Tool Provider Adapter

```typescript
// src/bridge/adapters/mcp/MCPAdapter.ts

import { BaseAgentAdapter, AgentFramework } from '../BaseAgentAdapter';
import { Quad, DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

/**
 * MCP (Model Context Protocol) tool provider configuration.
 * Represents how MCP tools are configured in Cline/Roo environments.
 */
export interface MCPToolConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  alwaysAllow?: string[];
}

export class MCPAdapter extends BaseAgentAdapter<MCPToolConfig> {
  readonly adapterId = 'mcp-adapter-v1';
  readonly adapterName = 'Anthropic MCP Tool Provider Adapter';
  readonly framework = AgentFramework.MCP;
  readonly supportedVersions = ['1.0'];

  private readonly mcpNs = 'https://anthropic.com/mcp#';

  protected mapToTriples(native: MCPToolConfig, baseUri: string): Quad[] {
    const triples: Quad[] = [];
    const agentUri = baseUri;

    // Create agent node
    triples.push(this.createAgentNode(agentUri));
    
    // MCP configs represent tool providers, not full agents
    // We model each server as a tool capability
    triples.push(this.createLiteralProperty(
      agentUri, 
      'name', 
      'MCP Tool Provider Collection'
    ));

    // Add MCP protocol support
    const mcpProtocolUri = `${agentUri}/protocol/mcp`;
    triples.push(this.createObjectProperty(agentUri, 'supportsProtocol', mcpProtocolUri));
    triples.push(quad(
      namedNode(mcpProtocolUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.chrysalisNs}MCPProtocol`)
    ));

    // Map each MCP server to a tool
    for (const [serverName, config] of Object.entries(native.mcpServers)) {
      if (config.disabled) continue;

      const toolUri = `${agentUri}/tool/${serverName}`;
      
      triples.push(this.createObjectProperty(agentUri, 'hasCapability', toolUri));
      triples.push(quad(
        namedNode(toolUri),
        namedNode(`${this.rdfNs}type`),
        namedNode(`${this.chrysalisNs}Tool`)
      ));
      triples.push(this.createLiteralProperty(toolUri, 'toolName', serverName));

      // MCP-specific properties
      triples.push(quad(
        namedNode(toolUri),
        namedNode(`${this.mcpNs}serverCommand`),
        literal(config.command)
      ));

      if (config.args?.length) {
        triples.push(quad(
          namedNode(toolUri),
          namedNode(`${this.mcpNs}serverArgs`),
          literal(JSON.stringify(config.args))
        ));
      }

      if (config.env) {
        triples.push(quad(
          namedNode(toolUri),
          namedNode(`${this.mcpNs}serverEnv`),
          literal(JSON.stringify(config.env))
        ));
      }

      if (config.alwaysAllow?.length) {
        triples.push(quad(
          namedNode(toolUri),
          namedNode(`${this.mcpNs}alwaysAllow`),
          literal(JSON.stringify(config.alwaysAllow))
        ));
      }
    }

    return triples;
  }

  protected mapFromTriples(triples: Quad[]): MCPToolConfig {
    const subjects = this.buildSubjectMap(triples);
    
    // Find agent subject
    const agentUri = this.findAgentSubject(subjects);
    if (!agentUri) {
      return { mcpServers: {} };
    }

    const agentProps = subjects.get(agentUri)!;
    const mcpServers: Record<string, MCPServerConfig> = {};

    // Find all tools and reconstruct MCP servers
    const capabilityUris = agentProps.get(`${this.chrysalisNs}hasCapability`) || [];
    
    for (const uri of capabilityUris) {
      const capProps = subjects.get(uri);
      if (!capProps) continue;

      const types = capProps.get(`${this.rdfNs}type`) || [];
      if (!types.includes(`${this.chrysalisNs}Tool`)) continue;

      const serverName = this.getFirst(capProps, `${this.chrysalisNs}toolName`);
      const command = this.getFirst(capProps, `${this.mcpNs}serverCommand`);
      
      if (!serverName || !command) continue;

      const config: MCPServerConfig = { command };

      const argsJson = this.getFirst(capProps, `${this.mcpNs}serverArgs`);
      if (argsJson) {
        try { config.args = JSON.parse(argsJson); } catch {}
      }

      const envJson = this.getFirst(capProps, `${this.mcpNs}serverEnv`);
      if (envJson) {
        try { config.env = JSON.parse(envJson); } catch {}
      }

      const allowJson = this.getFirst(capProps, `${this.mcpNs}alwaysAllow`);
      if (allowJson) {
        try { config.alwaysAllow = JSON.parse(allowJson); } catch {}
      }

      mcpServers[serverName] = config;
    }

    return { mcpServers };
  }

  protected extractAgentId(native: MCPToolConfig): string {
    // Generate ID from server names
    const names = Object.keys(native.mcpServers).sort();
    const hash = this.simpleHash(names.join('-'));
    return `mcp-provider-${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }

  protected getNativeValidationSchema(): object {
    return {
      type: 'object',
      required: ['mcpServers'],
      properties: {
        mcpServers: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            required: ['command'],
            properties: {
              command: { type: 'string' },
              args: { type: 'array', items: { type: 'string' } },
              env: { type: 'object' },
              disabled: { type: 'boolean' },
              alwaysAllow: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    };
  }

  getCapabilities(): AdapterCapability[] {
    return [
      { name: 'mcp-servers', description: 'MCP server tool providers', bidirectional: true },
      { name: 'tool-permissions', description: 'Always-allow tool permissions', bidirectional: true }
    ];
  }

  supportsFeature(feature: string): boolean {
    return ['mcp-servers', 'tool-permissions'].includes(feature);
  }

  // Helper methods
  private buildSubjectMap(triples: Quad[]): Map<string, Map<string, string[]>> {
    const subjects = new Map<string, Map<string, string[]>>();
    for (const t of triples) {
      const s = t.subject.value;
      const p = t.predicate.value;
      const o = t.object.termType === 'Literal' ? t.object.value : t.object.value;
      if (!subjects.has(s)) subjects.set(s, new Map());
      const props = subjects.get(s)!;
      if (!props.has(p)) props.set(p, []);
      props.get(p)!.push(o);
    }
    return subjects;
  }

  private findAgentSubject(subjects: Map<string, Map<string, string[]>>): string | null {
    for (const [s, props] of subjects) {
      const types = props.get(`${this.rdfNs}type`) || [];
      if (types.includes(`${this.chrysalisNs}Agent`)) {
        return s;
      }
    }
    return null;
  }

  private getFirst(props: Map<string, string[]>, key: string): string | undefined {
    return props.get(key)?.[0];
  }
}
```

### 6.3 LangChain Agent Adapter

```typescript
// src/bridge/adapters/langchain/LangChainAdapter.ts

import { BaseAgentAdapter, AgentFramework } from '../BaseAgentAdapter';
import { Quad, DataFactory } from 'n3';

const { namedNode, literal, quad } = DataFactory;

/**
 * LangChain agent configuration representation.
 * Captures the essential elements of a LangChain agent for serialization.
 */
export interface LangChainAgentConfig {
  name: string;
  description?: string;
  agentType: 'zero-shot-react' | 'conversational' | 'openai-functions' | 'openai-tools' | 'structured-chat' | 'custom';
  llm: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  tools: LangChainTool[];
  memory?: {
    type: 'buffer' | 'buffer-window' | 'summary' | 'conversation-kg' | 'entity';
    config?: Record<string, unknown>;
  };
  systemMessage?: string;
  humanMessagePrefix?: string;
  aiMessagePrefix?: string;
  callbacks?: string[];
}

export interface LangChainTool {
  name: string;
  description: string;
  inputSchema?: object;
  outputSchema?: object;
  func?: string; // Serialized function reference
}

export class LangChainAdapter extends BaseAgentAdapter<LangChainAgentConfig> {
  readonly adapterId = 'langchain-adapter-v1';
  readonly adapterName = 'LangChain Agent Adapter';
  readonly framework = AgentFramework.LANGCHAIN;
  readonly supportedVersions = ['0.1', '0.2'];

  private readonly langchainNs = 'https://langchain.com/ontology#';

  protected mapToTriples(native: LangChainAgentConfig, baseUri: string): Quad[] {
    const triples: Quad[] = [];
    const agentUri = baseUri;

    // Core agent
    triples.push(this.createAgentNode(agentUri));
    triples.push(this.createLiteralProperty(agentUri, 'name', native.name));
    
    if (native.description) {
      triples.push(this.createLiteralProperty(agentUri, 'description', native.description));
    }

    // Agent type (LangChain-specific)
    triples.push(quad(
      namedNode(agentUri),
      namedNode(`${this.langchainNs}agentType`),
      literal(native.agentType)
    ));

    // LLM configuration
    const llmUri = `${agentUri}/execution/llm`;
    triples.push(this.createObjectProperty(agentUri, 'hasExecutionConfig', llmUri));
    triples.push(quad(
      namedNode(llmUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.chrysalisNs}LLMConfig`)
    ));
    triples.push(this.createLiteralProperty(llmUri, 'llmProvider', native.llm.provider));
    triples.push(this.createLiteralProperty(llmUri, 'llmModel', native.llm.model));
    
    if (native.llm.temperature !== undefined) {
      triples.push(this.createLiteralProperty(llmUri, 'temperature', native.llm.temperature));
    }
    if (native.llm.maxTokens !== undefined) {
      triples.push(this.createLiteralProperty(llmUri, 'maxTokens', native.llm.maxTokens));
    }

    // Tools
    for (const tool of native.tools) {
      const toolTriples = this.mapLangChainTool(agentUri, tool);
      triples.push(...toolTriples);
    }

    // Memory (maps to Chrysalis memory system)
    if (native.memory) {
      const memoryTriples = this.mapLangChainMemory(agentUri, native.memory);
      triples.push(...memoryTriples);
    }

    // System message (LangChain-specific)
    if (native.systemMessage) {
      triples.push(quad(
        namedNode(agentUri),
        namedNode(`${this.langchainNs}systemMessage`),
        literal(native.systemMessage)
      ));
    }

    return triples;
  }

  private mapLangChainTool(agentUri: string, tool: LangChainTool): Quad[] {
    const triples: Quad[] = [];
    const toolUri = `${agentUri}/tool/${encodeURIComponent(tool.name)}`;

    triples.push(this.createObjectProperty(agentUri, 'hasCapability', toolUri));
    triples.push(quad(
      namedNode(toolUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.chrysalisNs}Tool`)
    ));
    triples.push(this.createLiteralProperty(toolUri, 'toolName', tool.name));
    triples.push(this.createLiteralProperty(toolUri, 'toolDescription', tool.description));

    if (tool.inputSchema) {
      triples.push(this.createLiteralProperty(toolUri, 'inputSchema', JSON.stringify(tool.inputSchema)));
    }
    if (tool.outputSchema) {
      triples.push(this.createLiteralProperty(toolUri, 'outputSchema', JSON.stringify(tool.outputSchema)));
    }
    if (tool.func) {
      triples.push(quad(
        namedNode(toolUri),
        namedNode(`${this.langchainNs}funcReference`),
        literal(tool.func)
      ));
    }

    return triples;
  }

  private mapLangChainMemory(
    agentUri: string, 
    memory: LangChainAgentConfig['memory']
  ): Quad[] {
    const triples: Quad[] = [];
    if (!memory) return triples;

    const memoryUri = `${agentUri}/memory`;
    triples.push(this.createObjectProperty(agentUri, 'hasMemorySystem', memoryUri));
    triples.push(quad(
      namedNode(memoryUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.chrysalisNs}MemorySystem`)
    ));

    // Map LangChain memory types to canonical types
    const memoryTypeMapping: Record<string, string> = {
      'buffer': 'WorkingMemory',
      'buffer-window': 'WorkingMemory',
      'summary': 'EpisodicMemory',
      'conversation-kg': 'SemanticMemory',
      'entity': 'SemanticMemory'
    };

    const canonicalType = memoryTypeMapping[memory.type] || 'WorkingMemory';
    const componentUri = `${memoryUri}/${memory.type}`;
    
    triples.push(quad(
      namedNode(memoryUri),
      namedNode(`${this.chrysalisNs}hasComponent`),
      namedNode(componentUri)
    ));
    triples.push(quad(
      namedNode(componentUri),
      namedNode(`${this.rdfNs}type`),
      namedNode(`${this.chrysalisNs}${canonicalType}`)
    ));

    // Preserve LangChain-specific memory type
    triples.push(quad(
      namedNode(componentUri),
      namedNode(`${this.langchainNs}memoryType`),
      literal(memory.type)
    ));

    if (memory.config) {
      triples.push(quad(
        namedNode(componentUri),
        namedNode(`${this.langchainNs}memoryConfig`),
        literal(JSON.stringify(memory.config))
      ));
    }

    return triples;
  }

  protected mapFromTriples(triples: Quad[]): LangChainAgentConfig {
    const subjects = this.buildSubjectMap(triples);
    const agentUri = this.findAgentSubject(subjects);
    
    if (!agentUri) {
      throw new Error('No Agent found in triples');
    }

    const agentProps = subjects.get(agentUri)!;

    return {
      name: this.getFirst(agentProps, `${this.chrysalisNs}name`) || 'Unknown Agent',
      description: this.getFirst(agentProps, `${this.chrysalisNs}description`),
      agentType: (this.getFirst(agentProps, `${this.langchainNs}agentType`) || 'zero-shot-react') as LangChainAgentConfig['agentType'],
      llm: this.reconstructLLMConfig(subjects, agentProps),
      tools: this.reconstructTools(subjects, agentProps),
      memory: this.reconstructMemory(subjects, agentProps),
      systemMessage: this.getFirst(agentProps, `${this.langchainNs}systemMessage`)
    };
  }

  private reconstructLLMConfig(
    subjects: Map<string, Map<string, string[]>>,
    agentProps: Map<string, string[]>
  ): LangChainAgentConfig['llm'] {
    const execUris = agentProps.get(`${this.chrysalisNs}hasExecutionConfig`) || [];
    
    for (const uri of execUris) {
      const execProps = subjects.get(uri);
      if (!execProps) continue;

      const types = execProps.get(`${this.rdfNs}type`) || [];
      if (types.includes(`${this.chrysalisNs}LLMConfig`)) {
        return {
          provider: this.getFirst(execProps, `${this.chrysalisNs}llmProvider`) || 'openai',
          model: this.getFirst(execProps, `${this.chrysalisNs}llmModel`) || 'gpt-4',
          temperature: parseFloat(this.getFirst(execProps, `${this.chrysalisNs}temperature`) || '0.7'),
          maxTokens: parseInt(this.getFirst(execProps, `${this.chrysalisNs}maxTokens`) || '4096', 10)
        };
      }
    }

    return { provider: 'openai', model: 'gpt-4' };
  }

  private reconstructTools(
    subjects: Map<string, Map<string, string[]>>,
    agentProps: Map<string, string[]>
  ): LangChainTool[] {
    const tools: LangChainTool[] = [];
    const capabilityUris = agentProps.get(`${this.chrysalisNs}hasCapability`) || [];

    for (const uri of capabilityUris) {
      const capProps = subjects.get(uri);
      if (!capProps) continue;

      const types = capProps.get(`${this.rdfNs}type`) || [];
      if (!types.includes(`${this.chrysalisNs}Tool`)) continue;

      const name = this.getFirst(capProps, `${this.chrysalisNs}toolName`);
      const description = this.getFirst(capProps, `${this.chrysalisNs}toolDescription`);

      if (!name || !description) continue;

      const tool: LangChainTool = { name, description };

      const inputSchema = this.getFirst(capProps, `${this.chrysalisNs}inputSchema`);
      if (inputSchema) {
        try { tool.inputSchema = JSON.parse(inputSchema); } catch {}
      }

      const func = this.getFirst(capProps, `${this.langchainNs}funcReference`);
      if (func) {
        tool.func = func;
      }

      tools.push(tool);
    }

    return tools;
  }

  private reconstructMemory(
    subjects: Map<string, Map<string, string[]>>,
    agentProps: Map<string, string[]>
  ): LangChainAgentConfig['memory'] | undefined {
    const memoryUris = agentProps.get(`${this.chrysalisNs}hasMemorySystem`) || [];

    for (const uri of memoryUris) {
      const memProps = subjects.get(uri);
      if (!memProps) continue;

      const componentUris = memProps.get(`${this.chrysalisNs}hasComponent`) || [];
      for (const compUri of componentUris) {
        const compProps = subjects.get(compUri);
        if (!compProps) continue;

        const memType = this.getFirst(compProps, `${this.langchainNs}memoryType`);
        if (memType) {
          const configJson = this.getFirst(compProps, `${this.langchainNs}memoryConfig`);
          return {
            type: memType as LangChainAgentConfig['memory']['type'],
            config: configJson ? JSON.parse(configJson) : undefined
          };
        }
      }
    }

    return undefined;
  }

  protected extractAgentId(native: LangChainAgentConfig): string {
    return native.name.toLowerCase().replace(/\s+/g, '-');
  }

  protected getNativeValidationSchema(): object {
    return {
      type: 'object',
      required: ['name', 'agentType', 'llm', 'tools'],
      properties: {
        name: { type: 'string' },
        agentType: { 
          type: 'string',
          enum: ['zero-shot-react', 'conversational', 'openai-functions', 'openai-tools', 'structured-chat', 'custom']
        },
        llm: {
          type: 'object',
          required: ['provider', 'model'],
          properties: {
            provider: { type: 'string' },
            model: { type: 'string' }
          }
        },
        tools: { type: 'array' }
      }
    };
  }

  getCapabilities(): AdapterCapability[] {
    return [
      { name: 'agent-metadata', description: 'Agent name and description', bidirectional: true },
      { name: 'tools', description: 'LangChain tool definitions', bidirectional: true },
      { name: 'llm-config', description: 'Language model configuration', bidirectional: true },
      { name: 'memory', description: 'LangChain memory types', bidirectional: true },
      { name: 'system-prompt', description: 'System message configuration', bidirectional: true }
    ];
  }

  supportsFeature(feature: string): boolean {
    return ['tools', 'llm-config', 'memory', 'system-prompt'].includes(feature);
  }

  // Inherited helper methods from BaseAgentAdapter would be used here
  private buildSubjectMap(triples: Quad[]): Map<string, Map<string, string[]>> {
    // Same implementation as MCPAdapter
    const subjects = new Map<string, Map<string, string[]>>();
    for (const t of triples) {
      const s = t.subject.value;
      const p = t.predicate.value;
      const o = t.object.termType === 'Literal' ? t.object.value : t.object.value;
      if (!subjects.has(s)) subjects.set(s, new Map());
      const props = subjects.get(s)!;
      if (!props.has(p)) props.set(p, []);
      props.get(p)!.push(o);
    }
    return subjects;
  }

  private findAgentSubject(subjects: Map<string, Map<string, string[]>>): string | null {
    for (const [s, props] of subjects) {
      const types = props.get(`${this.rdfNs}type`) || [];
      if (types.includes(`${this.chrysalisNs}Agent`)) return s;
    }
    return null;
  }

  private getFirst(props: Map<string, string[]>, key: string): string | undefined {
    return props.get(key)?.[0];
  }
}
```

---

## 7. Bridge Orchestration Layer

### 7.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BRIDGE ORCHESTRATION LAYER                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    BridgeOrchestrator                               │     │
│  │  - Manages adapter lifecycle                                        │     │
│  │  - Routes translation requests                                      │     │
│  │  - Handles multi-hop translations                                   │     │
│  │  - Manages transaction boundaries                                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│           ┌────────────────────────┼────────────────────────┐               │
│           │                        │                        │               │
│           ▼                        ▼                        ▼               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ AdapterRegistry │    │  CacheManager   │    │ DiscoveryService│         │
│  │                 │    │                 │    │                 │         │
│  │ - Register      │    │ - RDF cache     │    │ - Find agents   │         │
│  │ - Lookup        │    │ - Native cache  │    │ - By capability │         │
│  │ - Validate      │    │ - Invalidation  │    │ - By protocol   │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    TransactionManager                               │     │
│  │  - ACID-like semantics for multi-adapter translations              │     │
│  │  - Rollback on failure                                             │     │
│  │  - Versioned snapshots for consistency                             │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Core Orchestrator Implementation

```typescript
// src/bridge/orchestration/BridgeOrchestrator.ts

import { IAgentAdapter, AgentFramework, TransformResult, TransformReport } from '../adapters/IAgentAdapter';
import { ITripleStoreAPI, AgentSnapshot, TranslationActivity } from '../store/TripleStoreAPI';
import { AdapterRegistry } from './AdapterRegistry';
import { CacheManager } from './CacheManager';
import { Quad } from 'n3';

export interface TranslationRequest {
  agentId?: string;
  sourceFormat: AgentFramework;
  targetFormat: AgentFramework;
  sourceData: unknown;
  options?: TranslationOptions;
}

export interface TranslationOptions {
  /**
   * Whether to persist the canonical RDF to the store.
   */
  persist?: boolean;

  /**
   * Whether to use cached translations if available.
   */
  useCache?: boolean;

  /**
   * Maximum allowed fidelity loss (0.0-1.0).
   */
  maxFidelityLoss?: number;

  /**
   * Required fields that must be preserved.
   */
  requiredFields?: string[];

  /**
   * Custom adapter options.
   */
  adapterOptions?: Record<string, unknown>;
}

export interface TranslationResponse<TTarget> {
  success: boolean;
  result?: TTarget;
  agentId: string;
  version?: number;
  sourceReport: TransformReport;
  targetReport?: TransformReport;
  totalFidelity: number;
  warnings: string[];
  errors: string[];
}

export class BridgeOrchestrator {
  constructor(
    private readonly registry: AdapterRegistry,
    private readonly store: ITripleStoreAPI,
    private readonly cache: CacheManager
  ) {}

  /**
   * Translate an agent from one framework format to another.
   */
  async translate<TSource, TTarget>(
    request: TranslationRequest
  ): Promise<TranslationResponse<TTarget>> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    // 1. Get source adapter
    const sourceAdapter = this.registry.getAdapter(request.sourceFormat);
    if (!sourceAdapter) {
      return this.errorResponse(`No adapter found for source format: ${request.sourceFormat}`);
    }

    // 2. Get target adapter
    const targetAdapter = this.registry.getAdapter(request.targetFormat);
    if (!targetAdapter) {
      return this.errorResponse(`No adapter found for target format: ${request.targetFormat}`);
    }

    // 3. Check cache
    if (request.options?.useCache && request.agentId) {
      const cached = await this.cache.getTranslation<TTarget>(
        request.agentId,
        request.sourceFormat,
        request.targetFormat
      );
      if (cached) {
        return cached;
      }
    }

    // 4. Transform source to canonical RDF
    let toCanonicalResult: TransformResult;
    try {
      toCanonicalResult = await sourceAdapter.toCanonical(
        request.sourceData,
        request.options?.adapterOptions
      );
    } catch (error) {
      return this.errorResponse(`Source transformation failed: ${error}`);
    }

    if (!toCanonicalResult.report.success) {
      return {
        success: false,
        agentId: toCanonicalResult.agentId || 'unknown',
        sourceReport: toCanonicalResult.report,
        totalFidelity: 0,
        warnings: toCanonicalResult.report.warnings.map(w => w.message),
        errors: toCanonicalResult.report.errors.map(e => e.message)
      };
    }

    const agentId = request.agentId || toCanonicalResult.agentId;
    
    // Check fidelity threshold
    if (request.options?.maxFidelityLoss !== undefined) {
      const allowedFidelity = 1 - request.options.maxFidelityLoss;
      if (toCanonicalResult.report.fidelityScore < allowedFidelity) {
        return this.errorResponse(
          `Fidelity score ${toCanonicalResult.report.fidelityScore.toFixed(2)} ` +
          `below threshold ${allowedFidelity.toFixed(2)}`
        );
      }
    }

    // 5. Optionally persist to store
    let version: number | undefined;
    if (request.options?.persist) {
      const snapshot = await this.store.createAgentSnapshot(
        agentId,
        toCanonicalResult.triples,
        {
          timestamp: new Date(),
          sourceFormat: request.sourceFormat,
          translationFidelity: toCanonicalResult.report.fidelityScore
        }
      );
      version = snapshot.version;
    }

    // 6. Transform canonical RDF to target format
    let fromCanonicalResult;
    try {
      fromCanonicalResult = await targetAdapter.fromCanonical(
        toCanonicalResult.triples,
        request.options?.adapterOptions
      );
    } catch (error) {
      return this.errorResponse(`Target transformation failed: ${error}`);
    }

    // 7. Calculate total fidelity (product of both transformations)
    const totalFidelity = 
      toCanonicalResult.report.fidelityScore * 
      fromCanonicalResult.report.fidelityScore;

    // 8. Record translation activity
    await this.store.recordTranslation({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      agentId,
      sourceFormat: request.sourceFormat,
      targetFormat: request.targetFormat,
      fidelityScore: totalFidelity,
      lostFields: [
        ...toCanonicalResult.report.unmappedFields.map(f => f.field),
        ...fromCanonicalResult.report.unmappedFields.map(f => f.field)
      ],
      duration: Date.now() - startTime
    });

    // 9. Cache the result
    const response: TranslationResponse<TTarget> = {
      success: true,
      result: fromCanonicalResult.native as TTarget,
      agentId,
      version,
      sourceReport: toCanonicalResult.report,
      targetReport: fromCanonicalResult.report,
      totalFidelity,
      warnings: [
        ...toCanonicalResult.report.warnings.map(w => `[Source] ${w.message}`),
        ...fromCanonicalResult.report.warnings.map(w => `[Target] ${w.message}`)
      ],
      errors: []
    };

    if (request.options?.useCache) {
      await this.cache.setTranslation(
        agentId,
        request.sourceFormat,
        request.targetFormat,
        response
      );
    }

    return response;
  }

  /**
   * Translate using the canonical store as source.
   */
  async translateFromStore<TTarget>(
    agentId: string,
    targetFormat: AgentFramework,
    version?: number,
    options?: TranslationOptions
  ): Promise<TranslationResponse<TTarget>> {
    // 1. Retrieve from store
    const snapshot = await this.store.getAgentSnapshot(agentId, version);
    if (!snapshot) {
      return this.errorResponse(`Agent not found: ${agentId}`);
    }

    // 2. Get target adapter
    const targetAdapter = this.registry.getAdapter(targetFormat);
    if (!targetAdapter) {
      return this.errorResponse(`No adapter found for target format: ${targetFormat}`);
    }

    // 3. Transform to target
    const result = await targetAdapter.fromCanonical(snapshot.triples, options?.adapterOptions);

    return {
      success: result.report.success,
      result: result.native as TTarget,
      agentId,
      version: snapshot.version,
      sourceReport: {
        success: true,
        fidelityScore: 1.0,
        mappedFields: [],
        unmappedFields: [],
        lossyMappings: [],
        warnings: [],
        errors: [],
        durationMs: 0
      },
      targetReport: result.report,
      totalFidelity: result.report.fidelityScore,
      warnings: result.report.warnings.map(w => w.message),
      errors: result.report.errors.map(e => e.message)
    };
  }

  /**
   * Multi-hop translation through intermediate canonical form.
   */
  async translateChain<TTarget>(
    sourceData: unknown,
    chain: AgentFramework[],
    options?: TranslationOptions
  ): Promise<TranslationResponse<TTarget>> {
    if (chain.length < 2) {
      return this.errorResponse('Chain must have at least source and target formats');
    }

    let currentData = sourceData;
    let currentFormat = chain[0];
    let cumulativeFidelity = 1.0;
    const allWarnings: string[] = [];
    const allErrors: string[] = [];
    let agentId = '';

    for (let i = 1; i < chain.length; i++) {
      const targetFormat = chain[i];
      const isLast = i === chain.length - 1;

      const response = await this.translate({
        sourceFormat: currentFormat,
        targetFormat,
        sourceData: currentData,
        options: {
          ...options,
          persist: isLast ? options?.persist : false
        }
      });

      if (!response.success) {
        return {
          ...response,
          warnings: allWarnings,
          errors: [...allErrors, ...response.errors]
        } as TranslationResponse<TTarget>;
      }

      currentData = response.result;
      currentFormat = targetFormat;
      cumulativeFidelity *= response.totalFidelity;
      allWarnings.push(...response.warnings);
      agentId = response.agentId;
    }

    return {
      success: true,
      result: currentData as TTarget,
      agentId,
      totalFidelity: cumulativeFidelity,
      sourceReport: { success: true, fidelityScore: 1, mappedFields: [], unmappedFields: [], lossyMappings: [], warnings: [], errors: [], durationMs: 0 },
      warnings: allWarnings,
      errors: allErrors
    };
  }

  private errorResponse<T>(message: string): TranslationResponse<T> {
    return {
      success: false,
      agentId: 'unknown',
      sourceReport: {
        success: false,
        fidelityScore: 0,
        mappedFields: [],
        unmappedFields: [],
        lossyMappings: [],
        warnings: [],
        errors: [{ code: 'ORCHESTRATION_ERROR', message, fatal: true }],
        durationMs: 0
      },
      totalFidelity: 0,
      warnings: [],
      errors: [message]
    };
  }
}
```

### 7.3 Adapter Registry

```typescript
// src/bridge/orchestration/AdapterRegistry.ts

import { IAgentAdapter, AgentFramework, AdapterCapability } from '../adapters/IAgentAdapter';

export interface AdapterRegistration {
  adapter: IAgentAdapter<unknown>;
  priority: number;
  enabled: boolean;
  metadata: {
    registeredAt: Date;
    lastUsed?: Date;
    translationCount: number;
    averageFidelity: number;
  };
}

export class AdapterRegistry {
  private readonly adapters = new Map<AgentFramework, AdapterRegistration>();
  private readonly adaptersByCapability = new Map<string, Set<AgentFramework>>();

  /**
   * Register an adapter for a framework.
   */
  register<T>(
    adapter: IAgentAdapter<T>,
    options: { priority?: number; enabled?: boolean } = {}
  ): void {
    const registration: AdapterRegistration = {
      adapter: adapter as IAgentAdapter<unknown>,
      priority: options.priority ?? 100,
      enabled: options.enabled ?? true,
      metadata: {
        registeredAt: new Date(),
        translationCount: 0,
        averageFidelity: 1.0
      }
    };

    this.adapters.set(adapter.framework, registration);

    // Index by capabilities
    for (const capability of adapter.getCapabilities()) {
      if (!this.adaptersByCapability.has(capability.name)) {
        this.adaptersByCapability.set(capability.name, new Set());
      }
      this.adaptersByCapability.get(capability.name)!.add(adapter.framework);
    }
  }

  /**
   * Get adapter for a framework.
   */
  getAdapter<T>(framework: AgentFramework): IAgentAdapter<T> | null {
    const registration = this.adapters.get(framework);
    if (!registration || !registration.enabled) {
      return null;
    }
    return registration.adapter as IAgentAdapter<T>;
  }

  /**
   * Get all registered frameworks.
   */
  getRegisteredFrameworks(): AgentFramework[] {
    return Array.from(this.adapters.keys()).filter(
      f => this.adapters.get(f)?.enabled
    );
  }

  /**
   * Find frameworks that support a capability.
   */
  findByCapability(capability: string): AgentFramework[] {
    return Array.from(this.adaptersByCapability.get(capability) || []).filter(
      f => this.adapters.get(f)?.enabled
    );
  }

  /**
   * Check if a direct translation path exists.
   */
  canTranslate(source: AgentFramework, target: AgentFramework): boolean {
    return this.adapters.has(source) && this.adapters.has(target);
  }

  /**
   * Get registration metadata for monitoring.
   */
  getRegistrationInfo(framework: AgentFramework): AdapterRegistration | null {
    return this.adapters.get(framework) || null;
  }

  /**
   * Update usage statistics.
   */
  recordUsage(framework: AgentFramework, fidelityScore: number): void {
    const registration = this.adapters.get(framework);
    if (registration) {
      const prevCount = registration.metadata.translationCount;
      const prevAvg = registration.metadata.averageFidelity;
      
      registration.metadata.translationCount++;
      registration.metadata.averageFidelity = 
        (prevAvg * prevCount + fidelityScore) / (prevCount + 1);
      registration.metadata.lastUsed = new Date();
    }
  }

  /**
   * Enable/disable an adapter.
   */
  setEnabled(framework: AgentFramework, enabled: boolean): boolean {
    const registration = this.adapters.get(framework);
    if (registration) {
      registration.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Unregister an adapter.
   */
  unregister(framework: AgentFramework): boolean {
    const registration = this.adapters.get(framework);
    if (!registration) return false;

    // Remove from capability index
    for (const capability of registration.adapter.getCapabilities()) {
      this.adaptersByCapability.get(capability.name)?.delete(framework);
    }

    return this.adapters.delete(framework);
  }
}
```

### 7.4 Cache Manager

```typescript
// src/bridge/orchestration/CacheManager.ts

import { TranslationResponse } from './BridgeOrchestrator';
import { AgentFramework } from '../adapters/IAgentAdapter';

interface CacheEntry<T> {
  value: T;
  timestamp: Date;
  ttl: number;
  hits: number;
}

export class CacheManager {
  private readonly translationCache = new Map<string, CacheEntry<unknown>>();
  private readonly rdfCache = new Map<string, CacheEntry<unknown>>();
  
  constructor(
    private readonly options: {
      defaultTTL: number;
      maxEntries: number;
      cleanupInterval: number;
    } = {
      defaultTTL: 3600000, // 1 hour
      maxEntries: 1000,
      cleanupInterval: 300000 // 5 minutes
    }
  ) {
    // Start cleanup interval
    setInterval(() => this.cleanup(), options.cleanupInterval);
  }

  /**
   * Get cached translation result.
   */
  async getTranslation<T>(
    agentId: string,
    sourceFormat: AgentFramework,
    targetFormat: AgentFramework
  ): Promise<TranslationResponse<T> | null> {
    const key = this.translationKey(agentId, sourceFormat, targetFormat);
    const entry = this.translationCache.get(key);
    
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.translationCache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.value as TranslationResponse<T>;
  }

  /**
   * Cache a translation result.
   */
  async setTranslation<T>(
    agentId: string,
    sourceFormat: AgentFramework,
    targetFormat: AgentFramework,
    result: TranslationResponse<T>,
    ttl?: number
  ): Promise<void> {
    const key = this.translationKey(agentId, sourceFormat, targetFormat);
    
    // Evict if at capacity
    if (this.translationCache.size >= this.options.maxEntries) {
      this.evictLRU(this.translationCache);
    }

    this.translationCache.set(key, {
      value: result,
      timestamp: new Date(),
      ttl: ttl ?? this.options.defaultTTL,
      hits: 0
    });
  }

  /**
   * Invalidate cache for an agent.
   */
  async invalidate(agentId: string): Promise<number> {
    let count = 0;
    
    for (const key of this.translationCache.keys()) {
      if (key.startsWith(agentId)) {
        this.translationCache.delete(key);
        count++;
      }
    }

    for (const key of this.rdfCache.keys()) {
      if (key.startsWith(agentId)) {
        this.rdfCache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    return {
      translationEntries: this.translationCache.size,
      rdfEntries: this.rdfCache.size,
      totalHits: this.sumHits(this.translationCache) + this.sumHits(this.rdfCache),
      oldestEntry: this.findOldestTimestamp()
    };
  }

  private translationKey(
    agentId: string,
    source: AgentFramework,
    target: AgentFramework
  ): string {
    return `${agentId}:${source}:${target}`;
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp.getTime() > entry.ttl;
  }

  private evictLRU(cache: Map<string, CacheEntry<unknown>>): void {
    let lruKey: string | null = null;
    let lruHits = Infinity;

    for (const [key, entry] of cache) {
      if (entry.hits < lruHits) {
        lruHits = entry.hits;
        lruKey = key;
      }
    }

    if (lruKey) {
      cache.delete(lruKey);
    }
  }

  private cleanup(): void {
    for (const [key, entry] of this.translationCache) {
      if (this.isExpired(entry)) {
        this.translationCache.delete(key);
      }
    }
    for (const [key, entry] of this.rdfCache) {
      if (this.isExpired(entry)) {
        this.rdfCache.delete(key);
      }
    }
  }

  private sumHits(cache: Map<string, CacheEntry<unknown>>): number {
    let total = 0;
    for (const entry of cache.values()) {
      total += entry.hits;
    }
    return total;
  }

  private findOldestTimestamp(): Date | null {
    let oldest: Date | null = null;
    
    for (const entry of this.translationCache.values()) {
      if (!oldest || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
    }
    for (const entry of this.rdfCache.values()) {
      if (!oldest || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
    }

    return oldest;
  }
}

export interface CacheStats {
  translationEntries: number;
  rdfEntries: number;
  totalHits: number;
  oldestEntry: Date | null;
}
```

### 7.5 Unified API

```typescript
// src/bridge/api/BridgeAPI.ts

import { BridgeOrchestrator, TranslationRequest, TranslationResponse } from '../orchestration/BridgeOrchestrator';
import { AdapterRegistry } from '../orchestration/AdapterRegistry';
import { ITripleStoreAPI, AgentSummary, DiscoveryCriteria } from '../store/TripleStoreAPI';
import { AgentFramework } from '../adapters/IAgentAdapter';

/**
 * Unified API for the Chrysalis Universal Agent Bridge.
 * Exposes all bridge functionality through a single interface.
 */
export class BridgeAPI {
  constructor(
    private readonly orchestrator: BridgeOrchestrator,
    private readonly registry: AdapterRegistry,
    private readonly store: ITripleStoreAPI
  ) {}

  // --- Translation Operations ---

  /**
   * Translate an agent between frameworks.
   */
  async translate<TSource, TTarget>(
    request: TranslationRequest
  ): Promise<TranslationResponse<TTarget>> {
    return this.orchestrator.translate<TSource, TTarget>(request);
  }

  /**
   * Translate an agent from the canonical store.
   */
  async translateFromStore<T>(
    agentId: string,
    targetFormat: AgentFramework,
    version?: number
  ): Promise<TranslationResponse<T>> {
    return this.orchestrator.translateFromStore<T>(agentId, targetFormat, version);
  }

  /**
   * Import an agent into the canonical store.
   */
  async importAgent(
    sourceFormat: AgentFramework,
    sourceData: unknown
  ): Promise<{ agentId: string; version: number; fidelity: number }> {
    const result = await this.orchestrator.translate({
      sourceFormat,
      targetFormat: sourceFormat, // Same format, just persist
      sourceData,
      options: { persist: true }
    });

    if (!result.success) {
      throw new Error(`Import failed: ${result.errors.join(', ')}`);
    }

    return {
      agentId: result.agentId,
      version: result.version!,
      fidelity: result.totalFidelity
    };
  }

  /**
   * Export an agent to a specific framework format.
   */
  async exportAgent<T>(
    agentId: string,
    targetFormat: AgentFramework,
    version?: number
  ): Promise<T> {
    const result = await this.orchestrator.translateFromStore<T>(
      agentId,
      targetFormat,
      version
    );

    if (!result.success || !result.result) {
      throw new Error(`Export failed: ${result.errors.join(', ')}`);
    }

    return result.result;
  }

  // --- Discovery Operations ---

  /**
   * Search for agents matching criteria.
   */
  async discoverAgents(criteria: DiscoveryCriteria): Promise<AgentSummary[]> {
    return this.store.discoverAgents(criteria);
  }

  /**
   * List all agents in the store.
   */
  async listAgents(options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'name' | 'lastUpdated';
  }): Promise<AgentSummary[]> {
    return this.store.listAgents({
      limit: options?.limit ?? 100,
      offset: options?.offset ?? 0
    });
  }

  /**
   * Get agent details including version history.
   */
  async getAgent(agentId: string): Promise<AgentDetails | null> {
    const snapshot = await this.store.getAgentSnapshot(agentId);
    if (!snapshot) return null;

    const history = await this.store.getAgentHistory(agentId);
    const translations = await this.store.getTranslationHistory(agentId);

    return {
      agentId,
      currentVersion: snapshot.version,
      lastUpdated: snapshot.timestamp,
      versionHistory: history,
      translationHistory: translations.slice(0, 10),
      availableFormats: this.registry.getRegisteredFrameworks()
    };
  }

  // --- Registry Operations ---

  /**
   * Get available adapters and their capabilities.
   */
  async getAdapters(): Promise<AdapterInfo[]> {
    const frameworks = this.registry.getRegisteredFrameworks();
    return frameworks.map(framework => {
      const adapter = this.registry.getAdapter(framework)!;
      const info = this.registry.getRegistrationInfo(framework)!;
      
      return {
        framework,
        adapterId: adapter.adapterId,
        adapterName: adapter.adapterName,
        supportedVersions: adapter.supportedVersions,
        capabilities: adapter.getCapabilities(),
        enabled: info.enabled,
        stats: {
          translationCount: info.metadata.translationCount,
          averageFidelity: info.metadata.averageFidelity,
          lastUsed: info.metadata.lastUsed
        }
      };
    });
  }

  /**
   * Check if a translation path is supported.
   */
  async canTranslate(
    sourceFormat: AgentFramework,
    targetFormat: AgentFramework
  ): Promise<boolean> {
    return this.registry.canTranslate(sourceFormat, targetFormat);
  }

  // --- Administrative Operations ---

  /**
   * Get bridge statistics.
   */
  async getStats(): Promise<BridgeStats> {
    const storeStats = await this.store.getStats();
    const adapters = await this.getAdapters();

    return {
      store: storeStats,
      adapters: {
        total: adapters.length,
        enabled: adapters.filter(a => a.enabled).length,
        totalTranslations: adapters.reduce((sum, a) => sum + a.stats.translationCount, 0)
      }
    };
  }

  /**
   * Compact the triple store.
   */
  async compact(): Promise<void> {
    await this.store.compact();
  }
}

// --- Supporting Types ---

export interface AgentDetails {
  agentId: string;
  currentVersion: number;
  lastUpdated: Date;
  versionHistory: { version: number; timestamp: Date; sourceFormat: string }[];
  translationHistory: { sourceFormat: string; targetFormat: string; fidelity: number; timestamp: Date }[];
  availableFormats: AgentFramework[];
}

export interface AdapterInfo {
  framework: AgentFramework;
  adapterId: string;
  adapterName: string;
  supportedVersions: string[];
  capabilities: { name: string; description: string; bidirectional: boolean }[];
  enabled: boolean;
  stats: {
    translationCount: number;
    averageFidelity: number;
    lastUsed?: Date;
  };
}

export interface BridgeStats {
  store: {
    totalAgents: number;
    totalSnapshots: number;
    totalTriples: number;
    storeSizeBytes: number;
  };
  adapters: {
    total: number;
    enabled: number;
    totalTranslations: number;
  };
}
```

---

## 8. Semantic Validation and Fidelity Testing Framework

### 8.1 Round-Trip Testing Framework

```typescript
// src/bridge/testing/RoundTripTester.ts

import { IAgentAdapter, AgentFramework, RoundTripValidationResult, SemanticDiff } from '../adapters/IAgentAdapter';
import { AdapterRegistry } from '../orchestration/AdapterRegistry';
import { Quad } from 'n3';

export interface RoundTripTestCase<T> {
  name: string;
  framework: AgentFramework;
  input: T;
  expectedFidelity: number;
  allowedLostFields?: string[];
}

export interface RoundTripTestResult {
  testCase: string;
  passed: boolean;
  actualFidelity: number;
  expectedFidelity: number;
  diff?: SemanticDiff;
  duration: number;
  error?: string;
}

export class RoundTripTester {
  constructor(private readonly registry: AdapterRegistry) {}

  /**
   * Run a single round-trip test.
   */
  async runTest<T>(testCase: RoundTripTestCase<T>): Promise<RoundTripTestResult> {
    const startTime = Date.now();
    
    const adapter = this.registry.getAdapter<T>(testCase.framework);
    if (!adapter) {
      return {
        testCase: testCase.name,
        passed: false,
        actualFidelity: 0,
        expectedFidelity: testCase.expectedFidelity,
        duration: Date.now() - startTime,
        error: `No adapter found for framework: ${testCase.framework}`
      };
    }

    try {
      const result = await adapter.validateRoundTrip(testCase.input);
      
      const passed = result.equivalent || 
        (result.forwardReport.fidelityScore >= testCase.expectedFidelity &&
         result.reverseReport.fidelityScore >= testCase.expectedFidelity);

      return {
        testCase: testCase.name,
        passed,
        actualFidelity: result.forwardReport.fidelityScore * result.reverseReport.fidelityScore,
        expectedFidelity: testCase.expectedFidelity,
        diff: result.diff,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        testCase: testCase.name,
        passed: false,
        actualFidelity: 0,
        expectedFidelity: testCase.expectedFidelity,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Run all tests in a suite.
   */
  async runSuite<T>(testCases: RoundTripTestCase<T>[]): Promise<TestSuiteResult> {
    const results: RoundTripTestResult[] = [];

    for (const testCase of testCases) {
      const result = await this.runTest(testCase);
      results.push(result);
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const avgFidelity = results.reduce((sum, r) => sum + r.actualFidelity, 0) / results.length;

    return {
      totalTests: results.length,
      passed,
      failed,
      averageFidelity: avgFidelity,
      results
    };
  }

  /**
   * Run cross-framework round-trip test.
   */
  async runCrossFrameworkTest<TSource, TTarget>(
    source: { framework: AgentFramework; data: TSource },
    target: AgentFramework,
    expectedMinFidelity: number
  ): Promise<CrossFrameworkTestResult> {
    const startTime = Date.now();

    const sourceAdapter = this.registry.getAdapter<TSource>(source.framework);
    const targetAdapter = this.registry.getAdapter<TTarget>(target);

    if (!sourceAdapter || !targetAdapter) {
      return {
        passed: false,
        sourceFramework: source.framework,
        targetFramework: target,
        forwardFidelity: 0,
        reverseFidelity: 0,
        totalFidelity: 0,
        expectedMinFidelity,
        duration: Date.now() - startTime,
        error: 'Missing adapter(s)'
      };
    }

    try {
      // Source → Canonical
      const toCanonical = await sourceAdapter.toCanonical(source.data);
      
      // Canonical → Target
      const toTarget = await targetAdapter.fromCanonical(toCanonical.triples);
      
      // Target → Canonical
      const backToCanonical = await targetAdapter.toCanonical(toTarget.native);
      
      // Canonical → Source
      const backToSource = await sourceAdapter.fromCanonical(backToCanonical.triples);

      const forwardFidelity = toCanonical.report.fidelityScore * toTarget.report.fidelityScore;
      const reverseFidelity = backToCanonical.report.fidelityScore * backToSource.report.fidelityScore;
      const totalFidelity = forwardFidelity * reverseFidelity;

      return {
        passed: totalFidelity >= expectedMinFidelity,
        sourceFramework: source.framework,
        targetFramework: target,
        forwardFidelity,
        reverseFidelity,
        totalFidelity,
        expectedMinFidelity,
        duration: Date.now() - startTime,
        transformationChain: [
          { step: 'Source→Canonical', fidelity: toCanonical.report.fidelityScore },
          { step: 'Canonical→Target', fidelity: toTarget.report.fidelityScore },
          { step: 'Target→Canonical', fidelity: backToCanonical.report.fidelityScore },
          { step: 'Canonical→Source', fidelity: backToSource.report.fidelityScore }
        ]
      };
    } catch (error) {
      return {
        passed: false,
        sourceFramework: source.framework,
        targetFramework: target,
        forwardFidelity: 0,
        reverseFidelity: 0,
        totalFidelity: 0,
        expectedMinFidelity,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export interface TestSuiteResult {
  totalTests: number;
  passed: number;
  failed: number;
  averageFidelity: number;
  results: RoundTripTestResult[];
}

export interface CrossFrameworkTestResult {
  passed: boolean;
  sourceFramework: AgentFramework;
  targetFramework: AgentFramework;
  forwardFidelity: number;
  reverseFidelity: number;
  totalFidelity: number;
  expectedMinFidelity: number;
  duration: number;
  transformationChain?: { step: string; fidelity: number }[];
  error?: string;
}
```

### 8.2 Semantic Diff Tooling

```typescript
// src/bridge/testing/SemanticDiff.ts

import { Quad, DataFactory } from 'n3';

const { namedNode } = DataFactory;

export interface DiffReport {
  /**
   * Triples present in left but not in right.
   */
  leftOnly: Quad[];

  /**
   * Triples present in right but not in left.
   */
  rightOnly: Quad[];

  /**
   * Triples present in both.
   */
  common: Quad[];

  /**
   * Overall similarity score (0.0-1.0).
   */
  similarity: number;

  /**
   * Breakdown by predicate.
   */
  predicateAnalysis: PredicateDiff[];
}

export interface PredicateDiff {
  predicate: string;
  leftCount: number;
  rightCount: number;
  commonCount: number;
  similarity: number;
}

export class SemanticDiffTool {
  /**
   * Compare two sets of RDF triples.
   */
  diff(left: Quad[], right: Quad[]): DiffReport {
    const leftSet = new Set(left.map(q => this.quadKey(q)));
    const rightSet = new Set(right.map(q => this.quadKey(q)));

    const leftOnly: Quad[] = [];
    const rightOnly: Quad[] = [];
    const common: Quad[] = [];

    // Find left-only and common
    for (const q of left) {
      const key = this.quadKey(q);
      if (rightSet.has(key)) {
        common.push(q);
      } else {
        leftOnly.push(q);
      }
    }

    // Find right-only
    for (const q of right) {
      const key = this.quadKey(q);
      if (!leftSet.has(key)) {
        rightOnly.push(q);
      }
    }

    // Calculate similarity
    const totalUnique = leftOnly.length + rightOnly.length + common.length;
    const similarity = totalUnique > 0 ? common.length / totalUnique : 1.0;

    // Predicate analysis
    const predicateAnalysis = this.analyzeByPredicate(left, right);

    return {
      leftOnly,
      rightOnly,
      common,
      similarity,
      predicateAnalysis
    };
  }

  /**
   * Generate human-readable diff report.
   */
  formatReport(diff: DiffReport): string {
    const lines: string[] = [];
    
    lines.push('=== SEMANTIC DIFF REPORT ===');
    lines.push(`Overall Similarity: ${(diff.similarity * 100).toFixed(1)}%`);
    lines.push('');
    
    lines.push(`Common triples: ${diff.common.length}`);
    lines.push(`Left-only triples: ${diff.leftOnly.length}`);
    lines.push(`Right-only triples: ${diff.rightOnly.length}`);
    lines.push('');

    if (diff.leftOnly.length > 0) {
      lines.push('--- LEFT ONLY ---');
      for (const q of diff.leftOnly.slice(0, 10)) {
        lines.push(`  - ${this.formatQuad(q)}`);
      }
      if (diff.leftOnly.length > 10) {
        lines.push(`  ... and ${diff.leftOnly.length - 10} more`);
      }
      lines.push('');
    }

    if (diff.rightOnly.length > 0) {
      lines.push('+++ RIGHT ONLY +++');
      for (const q of diff.rightOnly.slice(0, 10)) {
        lines.push(`  + ${this.formatQuad(q)}`);
      }
      if (diff.rightOnly.length > 10) {
        lines.push(`  ... and ${diff.rightOnly.length - 10} more`);
      }
      lines.push('');
    }

    lines.push('--- PREDICATE ANALYSIS ---');
    for (const p of diff.predicateAnalysis.slice(0, 20)) {
      const shortPred = this.shortenUri(p.predicate);
      lines.push(`  ${shortPred}: L=${p.leftCount} R=${p.rightCount} C=${p.commonCount} (${(p.similarity * 100).toFixed(0)}%)`);
    }

    return lines.join('\n');
  }

  /**
   * Calculate information loss metric.
   */
  calculateInformationLoss(original: Quad[], reconstructed: Quad[]): InformationLossMetrics {
    const diff = this.diff(original, reconstructed);

    // Unique predicates in original
    const originalPredicates = new Set(original.map(q => q.predicate.value));
    const reconstructedPredicates = new Set(reconstructed.map(q => q.predicate.value));
    
    const lostPredicates = [...originalPredicates].filter(p => !reconstructedPredicates.has(p));
    const addedPredicates = [...reconstructedPredicates].filter(p => !originalPredicates.has(p));

    return {
      tripleRetention: diff.common.length / original.length,
      tripleLoss: diff.leftOnly.length / original.length,
      predicateRetention: (originalPredicates.size - lostPredicates.length) / originalPredicates.size,
      lostPredicates,
      addedPredicates,
      overallFidelity: diff.similarity
    };
  }

  private quadKey(q: Quad): string {
    return `${q.subject.value}|${q.predicate.value}|${q.object.value}`;
  }

  private formatQuad(q: Quad): string {
    const s = this.shortenUri(q.subject.value);
    const p = this.shortenUri(q.predicate.value);
    const o = q.object.termType === 'Literal' 
      ? `"${q.object.value.substring(0, 50)}${q.object.value.length > 50 ? '...' : ''}"`
      : this.shortenUri(q.object.value);
    return `<${s}> <${p}> ${o}`;
  }

  private shortenUri(uri: string): string {
    const prefixes: Record<string, string> = {
      'https://chrysalis.dev/ontology/agent#': 'chrysalis:',
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'rdf:',
      'http://www.w3.org/2000/01/rdf-schema#': 'rdfs:',
      'https://lmos.2060.io/lmos#': 'lmos:',
      'https://chrysalis.dev/usa#': 'usa:'
    };

    for (const [prefix, short] of Object.entries(prefixes)) {
      if (uri.startsWith(prefix)) {
        return short + uri.substring(prefix.length);
      }
    }

    // Return last segment
    const lastSlash = uri.lastIndexOf('/');
    const lastHash = uri.lastIndexOf('#');
    const pos = Math.max(lastSlash, lastHash);
    return pos > 0 ? uri.substring(pos + 1) : uri;
  }

  private analyzeByPredicate(left: Quad[], right: Quad[]): PredicateDiff[] {
    const predicates = new Set<string>();
    const leftByPred = new Map<string, Quad[]>();
    const rightByPred = new Map<string, Quad[]>();

    for (const q of left) {
      const p = q.predicate.value;
      predicates.add(p);
      if (!leftByPred.has(p)) leftByPred.set(p, []);
      leftByPred.get(p)!.push(q);
    }

    for (const q of right) {
      const p = q.predicate.value;
      predicates.add(p);
      if (!rightByPred.has(p)) rightByPred.set(p, []);
      rightByPred.get(p)!.push(q);
    }

    return Array.from(predicates).map(predicate => {
      const leftQuads = leftByPred.get(predicate) || [];
      const rightQuads = rightByPred.get(predicate) || [];
      
      const leftKeys = new Set(leftQuads.map(q => this.quadKey(q)));
      const rightKeys = new Set(rightQuads.map(q => this.quadKey(q)));
      
      let commonCount = 0;
      for (const k of leftKeys) {
        if (rightKeys.has(k)) commonCount++;
      }

      const total = leftQuads.length + rightQuads.length - commonCount;
      const similarity = total > 0 ? commonCount / total : 1.0;

      return {
        predicate,
        leftCount: leftQuads.length,
        rightCount: rightQuads.length,
        commonCount,
        similarity
      };
    }).sort((a, b) => a.similarity - b.similarity);
  }
}

export interface InformationLossMetrics {
  tripleRetention: number;
  tripleLoss: number;
  predicateRetention: number;
  lostPredicates: string[];
  addedPredicates: string[];
  overallFidelity: number;
}
```

### 8.3 CI Integration

```typescript
// src/bridge/testing/CIRunner.ts

import { RoundTripTester, TestSuiteResult, CrossFrameworkTestResult } from './RoundTripTester';
import { AdapterRegistry } from '../orchestration/AdapterRegistry';
import { AgentFramework } from '../adapters/IAgentAdapter';

export interface CITestConfig {
  minFidelityThreshold: number;
  maxTestDuration: number;
  frameworks: AgentFramework[];
  crossFrameworkPairs: [AgentFramework, AgentFramework][];
  testDataPath: string;
}

export interface CIResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  summary: string;
  details: {
    roundTripResults: TestSuiteResult[];
    crossFrameworkResults: CrossFrameworkTestResult[];
    fidelityViolations: FidelityViolation[];
  };
}

export interface FidelityViolation {
  testName: string;
  framework: AgentFramework;
  actualFidelity: number;
  threshold: number;
}

export class CIRunner {
  private readonly tester: RoundTripTester;

  constructor(registry: AdapterRegistry) {
    this.tester = new RoundTripTester(registry);
  }

  /**
   * Run full CI test suite.
   */
  async runCI(config: CITestConfig): Promise<CIResult> {
    const startTime = Date.now();
    const roundTripResults: TestSuiteResult[] = [];
    const crossFrameworkResults: CrossFrameworkTestResult[] = [];
    const fidelityViolations: FidelityViolation[] = [];

    // Load test data
    const testData = await this.loadTestData(config.testDataPath);

    // Run round-trip tests for each framework
    for (const framework of config.frameworks) {
      const frameworkTests = testData.filter(t => t.framework === framework);
      if (frameworkTests.length > 0) {
        const result = await this.tester.runSuite(frameworkTests);
        roundTripResults.push(result);

        // Check for fidelity violations
        for (const r of result.results) {
          if (r.actualFidelity < config.minFidelityThreshold) {
            fidelityViolations.push({
              testName: r.testCase,
              framework,
              actualFidelity: r.actualFidelity,
              threshold: config.minFidelityThreshold
            });
          }
        }
      }
    }

    // Run cross-framework tests
    for (const [source, target] of config.crossFrameworkPairs) {
      const sourceTests = testData.filter(t => t.framework === source);
      for (const test of sourceTests.slice(0, 3)) { // Limit to 3 per pair
        const result = await this.tester.runCrossFrameworkTest(
          { framework: source, data: test.input },
          target,
          config.minFidelityThreshold
        );
        crossFrameworkResults.push(result);

        if (!result.passed) {
          fidelityViolations.push({
            testName: `${source}→${target}`,
            framework: source,
            actualFidelity: result.totalFidelity,
            threshold: config.minFidelityThreshold
          });
        }
      }
    }

    // Calculate totals
    const totalPassed = roundTripResults.reduce((sum, r) => sum + r.passed, 0) +
      crossFrameworkResults.filter(r => r.passed).length;
    const totalFailed = roundTripResults.reduce((sum, r) => sum + r.failed, 0) +
      crossFrameworkResults.filter(r => !r.passed).length;

    const duration = Date.now() - startTime;
    const passed = fidelityViolations.length === 0 && totalFailed === 0;

    return {
      passed,
      totalTests: totalPassed + totalFailed,
      passedTests: totalPassed,
      failedTests: totalFailed,
      duration,
      summary: this.generateSummary(passed, totalPassed, totalFailed, fidelityViolations),
      details: {
        roundTripResults,
        crossFrameworkResults,
        fidelityViolations
      }
    };
  }

  /**
   * Generate JUnit-style XML report for CI integration.
   */
  generateJUnitReport(result: CIResult): string {
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<testsuite name="ChrysalisBridgeTests" tests="${result.totalTests}" failures="${result.failedTests}" time="${result.duration / 1000}">`);

    for (const suite of result.details.roundTripResults) {
      for (const test of suite.results) {
        lines.push(`  <testcase name="${this.escapeXml(test.testCase)}" time="${test.duration / 1000}">`);
        if (!test.passed) {
          lines.push(`    <failure message="Fidelity ${test.actualFidelity.toFixed(2)} below threshold ${test.expectedFidelity.toFixed(2)}">${test.error || ''}</failure>`);
        }
        lines.push('  </testcase>');
      }
    }

    for (const test of result.details.crossFrameworkResults) {
      const name = `CrossFramework_${test.sourceFramework}_to_${test.targetFramework}`;
      lines.push(`  <testcase name="${name}" time="${test.duration / 1000}">`);
      if (!test.passed) {
        lines.push(`    <failure message="Cross-framework fidelity ${test.totalFidelity.toFixed(2)} below threshold">${test.error || ''}</failure>`);
      }
      lines.push('  </testcase>');
    }

    lines.push('</testsuite>');
    return lines.join('\n');
  }

  private async loadTestData(path: string): Promise<any[]> {
    // In practice, load from file system
    // This is a placeholder returning empty array
    return [];
  }

  private generateSummary(
    passed: boolean,
    totalPassed: number,
    totalFailed: number,
    violations: FidelityViolation[]
  ): string {
    const lines: string[] = [];
    lines.push(passed ? '✅ CI PASSED' : '❌ CI FAILED');
    lines.push(`Tests: ${totalPassed} passed, ${totalFailed} failed`);
    
    if (violations.length > 0) {
      lines.push(`\nFidelity Violations (${violations.length}):`);
      for (const v of violations.slice(0, 5)) {
        lines.push(`  - ${v.testName}: ${(v.actualFidelity * 100).toFixed(1)}% < ${(v.threshold * 100).toFixed(1)}%`);
      }
    }

    return lines.join('\n');
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
```

---

## 9. Operational Tooling

### 9.1 Administrative CLI

```typescript
// src/bridge/cli/bridge-admin.ts

import { Command } from 'commander';
import { BridgeAPI } from '../api/BridgeAPI';
import { AgentFramework } from '../adapters/IAgentAdapter';

export function createBridgeCLI(api: BridgeAPI): Command {
  const program = new Command();

  program
    .name('bridge-admin')
    .description('Chrysalis Universal Agent Bridge Administration')
    .version('1.0.0');

  // --- Agent Commands ---
  const agents = program.command('agents').description('Agent management');

  agents
    .command('list')
    .description('List all agents')
    .option('-l, --limit <n>', 'Limit results', '20')
    .option('-o, --offset <n>', 'Offset', '0')
    .action(async (options) => {
      const agents = await api.listAgents({
        limit: parseInt(options.limit),
        offset: parseInt(options.offset)
      });
      console.table(agents.map(a => ({
        ID: a.agentId,
        Name: a.name,
        Version: a.latestVersion,
        Capabilities: a.capabilities.join(', '),
        Updated: a.lastUpdated.toISOString()
      })));
    });

  agents
    .command('get <agentId>')
    .description('Get agent details')
    .action(async (agentId) => {
      const details = await api.getAgent(agentId);
      if (!details) {
        console.error(`Agent not found: ${agentId}`);
        process.exit(1);
      }
      console.log(JSON.stringify(details, null, 2));
    });

  agents
    .command('import <format> <file>')
    .description('Import agent from file')
    .action(async (format, file) => {
      const fs = await import('fs/promises');
      const data = JSON.parse(await fs.readFile(file, 'utf-8'));
      const result = await api.importAgent(format as AgentFramework, data);
      console.log(`Imported agent: ${result.agentId} (version ${result.version})`);
      console.log(`Fidelity: ${(result.fidelity * 100).toFixed(1)}%`);
    });

  agents
    .command('export <agentId> <format>')
    .description('Export agent to format')
    .option('-v, --version <n>', 'Specific version')
    .option('-o, --output <file>', 'Output file')
    .action(async (agentId, format, options) => {
      const result = await api.exportAgent(
        agentId,
        format as AgentFramework,
        options.version ? parseInt(options.version) : undefined
      );
      const output = JSON.stringify(result, null, 2);
      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, output);
        console.log(`Exported to ${options.output}`);
      } else {
        console.log(output);
      }
    });

  // --- Adapter Commands ---
  const adapters = program.command('adapters').description('Adapter management');

  adapters
    .command('list')
    .description('List registered adapters')
    .action(async () => {
      const adapterList = await api.getAdapters();
      console.table(adapterList.map(a => ({
        Framework: a.framework,
        Name: a.adapterName,
        Enabled: a.enabled ? '✓' : '✗',
        Versions: a.supportedVersions.join(', '),
        Translations: a.stats.translationCount,
        'Avg Fidelity': `${(a.stats.averageFidelity * 100).toFixed(1)}%`
      })));
    });

  adapters
    .command('capabilities <framework>')
    .description('Show adapter capabilities')
    .action(async (framework) => {
      const adapterList = await api.getAdapters();
      const adapter = adapterList.find(a => a.framework === framework);
      if (!adapter) {
        console.error(`Adapter not found: ${framework}`);
        process.exit(1);
      }
      console.table(adapter.capabilities);
    });

  // --- Translation Commands ---
  const translate = program.command('translate').description('Translation operations');

  translate
    .command('check <source> <target>')
    .description('Check if translation path exists')
    .action(async (source, target) => {
      const canTranslate = await api.canTranslate(
        source as AgentFramework,
        target as AgentFramework
      );
      console.log(canTranslate ? '✓ Translation supported' : '✗ Translation not supported');
    });

  // --- Stats Commands ---
  program
    .command('stats')
    .description('Show bridge statistics')
    .action(async () => {
      const stats = await api.getStats();
      console.log('\n=== BRIDGE STATISTICS ===\n');
      console.log('Store:');
      console.log(`  Agents: ${stats.store.totalAgents}`);
      console.log(`  Snapshots: ${stats.store.totalSnapshots}`);
      console.log(`  Triples: ${stats.store.totalTriples}`);
      console.log(`  Size: ${(stats.store.storeSizeBytes / 1024 / 1024).toFixed(2)} MB`);
      console.log('\nAdapters:');
      console.log(`  Total: ${stats.adapters.total}`);
      console.log(`  Enabled: ${stats.adapters.enabled}`);
      console.log(`  Total Translations: ${stats.adapters.totalTranslations}`);
    });

  // --- Maintenance Commands ---
  program
    .command('compact')
    .description('Compact the triple store')
    .action(async () => {
      console.log('Compacting store...');
      await api.compact();
      console.log('Done.');
    });

  return program;
}
```

### 9.2 Monitoring Dashboard Metrics

```typescript
// src/bridge/monitoring/metrics.ts

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export class BridgeMetrics {
  private readonly registry: Registry;

  // Counters
  readonly translationsTotal: Counter;
  readonly translationErrors: Counter;
  readonly cacheHits: Counter;
  readonly cacheMisses: Counter;

  // Histograms
  readonly translationDuration: Histogram;
  readonly fidelityScore: Histogram;

  // Gauges
  readonly storeAgentCount: Gauge;
  readonly storeTripleCount: Gauge;
  readonly adapterCount: Gauge;
  readonly cacheSize: Gauge;

  constructor() {