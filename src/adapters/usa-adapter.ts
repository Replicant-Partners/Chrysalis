/**
 * Chrysalis Universal Agent Bridge - USA Specification Adapter
 * 
 * Bidirectional translation between Chrysalis Uniform Semantic Agent (USA)
 * specification format and canonical RDF representation.
 * 
 * Supports USA v2.0 specification with hierarchical memory architecture,
 * MCP protocol bindings, and cognitive memory patterns.
 * 
 * @module adapters/usa-adapter
 * @version 1.0.0
 */

import {
  BaseAdapter,
  NativeAgent,
  CanonicalAgent,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  FieldMapping,
  ExtensionProperty,
  TranslationWarning,
  AdapterConfig
} from './base-adapter';

import type { Quad, NamedNode, BlankNode } from '../rdf/temporal-store';
import { DataFactory, CHRYSALIS_NS, RDF_NS, XSD_NS, chrysalis, rdf } from '../rdf/temporal-store';

// ============================================================================
// USA Extension Namespace
// ============================================================================

const USA_NS = 'https://chrysalis.dev/usa#';
const usa = (localName: string): NamedNode => DataFactory.namedNode(USA_NS + localName);

// ============================================================================
// USA Schema Types
// ============================================================================

/**
 * USA v2.0 Agent Specification
 */
interface USAAgent {
  apiVersion: string;
  kind: 'Agent';
  metadata: USAMetadata;
  identity: USAIdentity;
  capabilities: USACapabilities;
  protocols?: USAProtocols;
  execution: USAExecution;
  deployment?: USADeployment;
}

interface USAMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  tags?: string[];
}

interface USAIdentity {
  role: string;
  goal: string;
  backstory?: string;
  personality_traits?: Record<string, string | number | boolean>;
  constraints?: string[];
}

interface USACapabilities {
  tools?: USATool[];
  reasoning?: USAReasoning;
  memory?: USAMemory;
}

interface USATool {
  name: string;
  protocol?: string;
  config?: Record<string, unknown>;
  description?: string;
}

interface USAReasoning {
  strategy: string;
  max_iterations?: number;
  allow_backtracking?: boolean;
}

interface USAMemory {
  architecture: string;
  working?: USAWorkingMemory;
  episodic?: USAEpisodicMemory;
  semantic?: USASemanticMemory;
  procedural?: USAProceduralMemory;
  core?: USACoreMemory;
  embeddings?: USAEmbeddings;
  storage?: USAStorage;
  operations?: USAMemoryOperations;
}

interface USAWorkingMemory {
  enabled: boolean;
  max_tokens?: number;
  buffer_type?: string;
}

interface USAEpisodicMemory {
  enabled: boolean;
  storage?: string;
  retention_days?: number | null;
  temporal_indexing?: boolean;
  metadata_fields?: string[];
}

interface USASemanticMemory {
  enabled: boolean;
  storage?: string;
  rag?: {
    enabled: boolean;
    top_k?: number;
    min_relevance?: number;
    reranking?: boolean;
  };
  knowledge_graph?: boolean;
}

interface USAProceduralMemory {
  enabled: boolean;
  storage?: string;
  format?: string;
  versioning?: boolean;
}

interface USACoreMemory {
  enabled: boolean;
  self_editing?: boolean;
  blocks?: Array<{
    name: string;
    content: string;
    editable?: boolean;
  }>;
}

interface USAEmbeddings {
  model: string;
  dimensions?: number;
  batch_size?: number;
  provider?: string;
}

interface USAStorage {
  primary?: string;
  vector_db?: {
    provider: string;
    collection?: string;
    config?: Record<string, unknown>;
  };
  graph_db?: {
    provider: string;
    database?: string;
    config?: Record<string, unknown>;
  };
  cache?: string;
  backup?: string;
}

interface USAMemoryOperations {
  retrieval?: {
    strategy?: string;
    hybrid_search?: boolean;
    reranking?: boolean;
    max_results?: number;
  };
  consolidation?: {
    strategy?: string;
    frequency?: string;
    async_processing?: boolean;
  };
  forgetting?: {
    enabled?: boolean;
    strategy?: string;
    threshold?: number;
    parameters?: Record<string, number>;
  };
}

interface USAProtocols {
  mcp?: {
    enabled: boolean;
    role?: string;
    servers?: Array<{
      name: string;
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }>;
  };
  a2a?: {
    enabled: boolean;
  };
  agent_protocol?: {
    enabled: boolean;
    endpoint?: string;
  };
}

interface USAExecution {
  llm: {
    provider: string;
    model: string;
    temperature?: number;
    max_tokens?: number;
    parameters?: Record<string, unknown>;
  };
  runtime?: {
    timeout?: number;
    max_iterations?: number;
    retry_policy?: {
      max_attempts?: number;
      backoff?: string;
      initial_delay?: number;
    };
    error_handling?: string;
  };
}

interface USADeployment {
  context?: string;
  environment?: Record<string, unknown>;
  scaling?: {
    min_instances?: number;
    max_instances?: number;
    target_cpu?: number;
  };
}

// ============================================================================
// USA Translation Context
// ============================================================================

/**
 * Internal context object for USA→Canonical translation.
 * Accumulates quads, field mappings, and extensions during translation.
 *
 * @internal
 */
interface USATranslationContext {
  /** The parsed USA agent specification */
  agent: USAAgent;
  /** Generated canonical URI for this agent */
  agentUri: string;
  /** Accumulated RDF quads */
  quads: Quad[];
  /** Fields successfully mapped to canonical predicates */
  mappedFields: string[];
  /** Fields preserved as extensions (no canonical predicate) */
  unmappedFields: string[];
  /** Fields that could not be preserved (data loss) */
  lostFields: string[];
  /** Extension properties for lossless round-tripping */
  extensions: ExtensionProperty[];
  /** Translation warnings (non-fatal issues) */
  warnings: TranslationWarning[];
  /** Translation start timestamp for metrics */
  startTime: number;
}

// ============================================================================
// USA Adapter Implementation
// ============================================================================

/**
 * Adapter for Chrysalis Uniform Semantic Agent (USA) specification.
 *
 * Handles bidirectional translation between USA v2.0 YAML/JSON format
 * and the canonical RDF representation used by the bridge.
 *
 * The toCanonical() method is decomposed into focused private methods
 * following single-responsibility principle:
 * - translateMetadata(): Agent metadata (name, version, description, tags)
 * - translateIdentity(): Agent identity (role, goal, backstory, traits)
 * - translateTools(): Tool capabilities
 * - translateReasoning(): Reasoning strategy configuration
 * - translateMemorySystem(): Hierarchical memory architecture
 * - translateProtocols(): Protocol bindings (MCP, A2A, Agent Protocol)
 * - translateExecution(): LLM and runtime configuration
 * - translateDeployment(): Deployment settings
 * - finalizeCanonical(): Build final CanonicalAgent structure
 */
export class USAAdapter extends BaseAdapter {
  public readonly framework = 'usa' as const;
  public readonly name = 'Chrysalis USA Adapter';
  public readonly version = '1.0.0';
  public readonly extensionNamespace = USA_NS;

  constructor(config: AdapterConfig = {}) {
    super(config);
  }

  // ==========================================================================
  // Native → Canonical Translation (Public API)
  // ==========================================================================

  /**
   * Translate a native USA agent specification to canonical RDF representation.
   *
   * This method orchestrates the translation by delegating to focused private
   * methods for each logical section of the USA specification.
   *
   * @param native - The native USA agent to translate
   * @returns Promise resolving to the canonical RDF representation
   *
   * @example
   * ```typescript
   * const adapter = new USAAdapter();
   * const canonical = await adapter.toCanonical({
   *   data: usaAgentSpec,
   *   framework: 'usa',
   *   version: 'usa/v2'
   * });
   * ```
   */
  public async toCanonical(native: NativeAgent): Promise<CanonicalAgent> {
    // Initialize translation context
    const ctx = this.initTranslationContext(native);

    // Translate each section in logical order
    this.translateMetadata(ctx);
    this.translateIdentity(ctx);
    this.translateTools(ctx);
    this.translateReasoning(ctx);
    this.translateMemorySystem(ctx);
    this.translateProtocols(ctx);
    this.translateExecution(ctx);
    this.translateDeployment(ctx);

    // Build and return final canonical agent
    return this.finalizeCanonical(ctx);
  }

  // ==========================================================================
  // Private Translation Methods
  // ==========================================================================

  /**
   * Initialize the translation context with agent data and empty accumulators.
   *
   * Creates the agent URI, sets up tracking arrays, and adds the base
   * rdf:type declaration for the agent.
   *
   * @param native - The native agent specification
   * @returns Initialized translation context
   *
   * @rdf-vocabulary
   * - rdf:type → chrysalis:Agent
   */
  private initTranslationContext(native: NativeAgent): USATranslationContext {
    const agent = native.data as unknown as USAAgent;
    const agentId = agent.metadata.name;
    const agentUri = this.generateAgentUri(agentId);
    
    const ctx: USATranslationContext = {
      agent,
      agentUri,
      quads: [],
      mappedFields: [],
      unmappedFields: [],
      lostFields: [],
      extensions: [],
      warnings: [],
      startTime: Date.now()
    };

    // Add base type declaration
    ctx.quads.push(this.quad(
      this.uri(agentUri),
      rdf('type'),
      chrysalis('Agent')
    ));
    ctx.mappedFields.push('kind');

    return ctx;
  }

  /**
   * Translate USA metadata section to canonical RDF.
   *
   * Handles: name, version, description, author, tags, apiVersion.
   * The apiVersion is stored as an extension since it's USA-specific.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:name (required)
   * - chrysalis:version
   * - chrysalis:description
   * - chrysalis:author
   * - chrysalis:tags (JSON-serialized array)
   */
  private translateMetadata(ctx: USATranslationContext): void {
    const { agent, agentUri, quads, mappedFields, unmappedFields, extensions } = ctx;
    const agentNode = this.uri(agentUri);

    // Name (required)
    quads.push(this.quad(agentNode, chrysalis('name'), this.literal(agent.metadata.name)));
    mappedFields.push('metadata.name');

    // Version
    if (agent.metadata.version) {
      quads.push(this.quad(agentNode, chrysalis('version'), this.literal(agent.metadata.version)));
      mappedFields.push('metadata.version');
    }

    // Description
    if (agent.metadata.description) {
      quads.push(this.quad(agentNode, chrysalis('description'), this.literal(agent.metadata.description)));
      mappedFields.push('metadata.description');
    }

    // Author
    if (agent.metadata.author) {
      quads.push(this.quad(agentNode, chrysalis('author'), this.literal(agent.metadata.author)));
      mappedFields.push('metadata.author');
    }

    // Tags (JSON-serialized)
    if (agent.metadata.tags?.length) {
      quads.push(this.quad(agentNode, chrysalis('tags'), this.literal(JSON.stringify(agent.metadata.tags))));
      mappedFields.push('metadata.tags');
    }

    // API Version (USA-specific extension for lossless round-tripping)
    if (agent.apiVersion) {
      extensions.push(this.createExtension('usa', 'apiVersion', agent.apiVersion, 'apiVersion'));
      unmappedFields.push('apiVersion');
    }
  }

  /**
   * Translate USA identity section to canonical RDF.
   *
   * Creates an AgentIdentity blank node linked via chrysalis:hasIdentity.
   * Generates a SHA-384 fingerprint for identity verification.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:hasIdentity → blank node
   * - chrysalis:AgentIdentity (type)
   * - chrysalis:identifierValue (fingerprint)
   * - chrysalis:identifierScheme ('sha384')
   * - usa:role
   * - usa:goal
   * - usa:backstory
   */
  private translateIdentity(ctx: USATranslationContext): void {
    const { agent, agentUri, quads, mappedFields, unmappedFields, extensions } = ctx;
    const agentNode = this.uri(agentUri);

    // Create identity blank node
    const identityNode = this.blank(this.generateBlankId('identity'));
    
    quads.push(this.quad(agentNode, chrysalis('hasIdentity'), identityNode));
    quads.push(this.quad(identityNode, rdf('type'), chrysalis('AgentIdentity')));

    // Generate and add fingerprint-based identity
    const fingerprint = this.generateFingerprint(agent);
    quads.push(this.quad(identityNode, chrysalis('identifierValue'), this.literal(fingerprint)));
    quads.push(this.quad(identityNode, chrysalis('identifierScheme'), this.literal('sha384')));

    // Role (USA-specific predicate)
    if (agent.identity.role) {
      quads.push(this.quad(identityNode, usa('role'), this.literal(agent.identity.role)));
      mappedFields.push('identity.role');
    }

    // Goal (USA-specific predicate)
    if (agent.identity.goal) {
      quads.push(this.quad(identityNode, usa('goal'), this.literal(agent.identity.goal)));
      mappedFields.push('identity.goal');
    }

    // Backstory (USA-specific predicate)
    if (agent.identity.backstory) {
      quads.push(this.quad(identityNode, usa('backstory'), this.literal(agent.identity.backstory)));
      mappedFields.push('identity.backstory');
    }

    // Personality traits (complex object → extension)
    if (agent.identity.personality_traits) {
      extensions.push(this.createExtension(
        'usa', 'personalityTraits', agent.identity.personality_traits, 'identity.personality_traits'
      ));
      unmappedFields.push('identity.personality_traits');
    }

    // Constraints (array → extension)
    if (agent.identity.constraints?.length) {
      extensions.push(this.createExtension(
        'usa', 'constraints', agent.identity.constraints, 'identity.constraints'
      ));
      unmappedFields.push('identity.constraints');
    }
  }

  /**
   * Translate USA tools capabilities to canonical RDF.
   *
   * Each tool becomes a Tool blank node linked via chrysalis:hasCapability.
   * Tool configs are preserved as extensions for lossless round-tripping.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:hasCapability → blank node
   * - chrysalis:Tool (type)
   * - chrysalis:toolName
   * - chrysalis:toolDescription
   * - chrysalis:protocolVersion
   */
  private translateTools(ctx: USATranslationContext): void {
    const { agent, agentUri, quads, mappedFields, extensions } = ctx;
    
    if (!agent.capabilities.tools?.length) {
      return;
    }

    const agentNode = this.uri(agentUri);

    for (const tool of agent.capabilities.tools) {
      const toolNode = this.blank(this.generateBlankId('tool'));
      
      // Link tool to agent
      quads.push(this.quad(agentNode, chrysalis('hasCapability'), toolNode));
      quads.push(this.quad(toolNode, rdf('type'), chrysalis('Tool')));

      // Tool name (required)
      quads.push(this.quad(toolNode, chrysalis('toolName'), this.literal(tool.name)));

      // Optional tool properties
      if (tool.description) {
        quads.push(this.quad(toolNode, chrysalis('toolDescription'), this.literal(tool.description)));
      }

      if (tool.protocol) {
        quads.push(this.quad(toolNode, chrysalis('protocolVersion'), this.literal(tool.protocol)));
      }

      // Tool config (complex object → extension)
      if (tool.config) {
        extensions.push(this.createExtension(
          'usa', `tool.${tool.name}.config`, tool.config, `capabilities.tools.${tool.name}.config`
        ));
      }
    }

    mappedFields.push('capabilities.tools');
  }

  /**
   * Translate USA reasoning strategy to canonical RDF.
   *
   * Maps strategy strings to canonical reasoning strategy URIs.
   * Additional reasoning config is preserved as an extension.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:usesReasoningStrategy → one of:
   *   - chrysalis:ChainOfThought
   *   - chrysalis:ReAct
   *   - chrysalis:Reflexion
   *   - chrysalis:TreeOfThoughts
   */
  private translateReasoning(ctx: USATranslationContext): void {
    const { agent, agentUri, quads, mappedFields, unmappedFields, extensions, warnings } = ctx;
    
    if (!agent.capabilities.reasoning) {
      return;
    }

    const agentNode = this.uri(agentUri);
    const reasoningStrategy = agent.capabilities.reasoning.strategy;
    
    // Map strategy string to canonical URI
    const strategyUri = this.mapReasoningStrategy(reasoningStrategy, warnings);

    quads.push(this.quad(agentNode, chrysalis('usesReasoningStrategy'), strategyUri));
    mappedFields.push('capabilities.reasoning.strategy');

    // Preserve additional reasoning config as extension
    if (agent.capabilities.reasoning.max_iterations !== undefined ||
        agent.capabilities.reasoning.allow_backtracking !== undefined) {
      extensions.push(this.createExtension(
        'usa', 'reasoningConfig', agent.capabilities.reasoning, 'capabilities.reasoning'
      ));
      unmappedFields.push('capabilities.reasoning.max_iterations');
      unmappedFields.push('capabilities.reasoning.allow_backtracking');
    }
  }

  /**
   * Map a reasoning strategy string to its canonical RDF URI.
   *
   * @param strategy - The strategy string from USA spec
   * @param warnings - Warnings array to append to if unknown strategy
   * @returns The canonical NamedNode for the strategy
   */
  private mapReasoningStrategy(strategy: string, warnings: TranslationWarning[]): NamedNode {
    const strategyMap: Record<string, NamedNode> = {
      'chain_of_thought': chrysalis('ChainOfThought'),
      'react': chrysalis('ReAct'),
      'reflexion': chrysalis('Reflexion'),
      'tree_of_thoughts': chrysalis('TreeOfThoughts')
    };

    const mapped = strategyMap[strategy];
    if (mapped) {
      return mapped;
    }

    // Unknown strategy - warn and default
    warnings.push({
      severity: 'warning',
      code: 'UNKNOWN_STRATEGY',
      message: `Unknown reasoning strategy: ${strategy}, defaulting to ChainOfThought`,
      sourcePath: 'capabilities.reasoning.strategy'
    });
    return chrysalis('ChainOfThought');
  }

  /**
   * Translate USA memory system to canonical RDF.
   *
   * Creates a MemorySystem blank node with component nodes for each
   * memory type (working, episodic, semantic, procedural, core).
   * Complex configs (embeddings, storage, operations) are preserved as extensions.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:hasMemorySystem → blank node
   * - chrysalis:MemorySystem (type)
   * - usa:memoryArchitecture
   * - chrysalis:hasMemoryComponent → component nodes
   * - Memory types: WorkingMemory, EpisodicMemory, SemanticMemory, ProceduralMemory, CoreMemory
   */
  private translateMemorySystem(ctx: USATranslationContext): void {
    const { agent, agentUri, quads, mappedFields, unmappedFields, extensions } = ctx;
    
    if (!agent.capabilities.memory) {
      return;
    }

    const mem = agent.capabilities.memory;
    const agentNode = this.uri(agentUri);

    // Create memory system node
    const memoryNode = this.blank(this.generateBlankId('memory'));
    quads.push(this.quad(agentNode, chrysalis('hasMemorySystem'), memoryNode));
    quads.push(this.quad(memoryNode, rdf('type'), chrysalis('MemorySystem')));

    // Memory architecture (USA-specific)
    quads.push(this.quad(memoryNode, usa('memoryArchitecture'), this.literal(mem.architecture)));
    mappedFields.push('capabilities.memory.architecture');

    // Translate each memory component
    this.translateWorkingMemory(memoryNode, mem, ctx);
    this.translateEpisodicMemory(memoryNode, mem, ctx);
    this.translateSemanticMemory(memoryNode, mem, ctx);
    this.translateProceduralMemory(memoryNode, mem, ctx);
    this.translateCoreMemory(memoryNode, mem, ctx);

    // Complex configs as extensions
    if (mem.embeddings) {
      extensions.push(this.createExtension('usa', 'embeddingsConfig', mem.embeddings, 'capabilities.memory.embeddings'));
      unmappedFields.push('capabilities.memory.embeddings');
    }

    if (mem.storage) {
      extensions.push(this.createExtension('usa', 'storageConfig', mem.storage, 'capabilities.memory.storage'));
      unmappedFields.push('capabilities.memory.storage');
    }

    if (mem.operations) {
      extensions.push(this.createExtension('usa', 'memoryOperations', mem.operations, 'capabilities.memory.operations'));
      unmappedFields.push('capabilities.memory.operations');
    }
  }

  /**
   * Translate working memory component to RDF.
   *
   * @param memoryNode - Parent memory system node
   * @param mem - USA memory configuration
   * @param ctx - Translation context
   */
  private translateWorkingMemory(memoryNode: BlankNode, mem: USAMemory, ctx: USATranslationContext): void {
    if (!mem.working?.enabled) {
      return;
    }

    const workingNode = this.blank(this.generateBlankId('working'));
    
    ctx.quads.push(this.quad(memoryNode, chrysalis('hasMemoryComponent'), workingNode));
    ctx.quads.push(this.quad(workingNode, rdf('type'), chrysalis('WorkingMemory')));
    ctx.quads.push(this.quad(workingNode, chrysalis('memoryEnabled'), this.literal(true)));

    if (mem.working.max_tokens) {
      ctx.quads.push(this.quad(
        workingNode, chrysalis('maxTokens'), this.literal(mem.working.max_tokens, `${XSD_NS}integer`)
      ));
    }

    ctx.mappedFields.push('capabilities.memory.working');
  }

  /**
   * Translate episodic memory component to RDF.
   *
   * @param memoryNode - Parent memory system node
   * @param mem - USA memory configuration
   * @param ctx - Translation context
   */
  private translateEpisodicMemory(memoryNode: BlankNode, mem: USAMemory, ctx: USATranslationContext): void {
    if (!mem.episodic?.enabled) {
      return;
    }

    const episodicNode = this.blank(this.generateBlankId('episodic'));
    
    ctx.quads.push(this.quad(memoryNode, chrysalis('hasMemoryComponent'), episodicNode));
    ctx.quads.push(this.quad(episodicNode, rdf('type'), chrysalis('EpisodicMemory')));
    ctx.quads.push(this.quad(episodicNode, chrysalis('memoryEnabled'), this.literal(true)));

    if (mem.episodic.storage) {
      ctx.quads.push(this.quad(episodicNode, chrysalis('storageBackend'), this.literal(mem.episodic.storage)));
    }

    ctx.mappedFields.push('capabilities.memory.episodic');
  }

  /**
   * Translate semantic memory component to RDF.
   * RAG config is preserved as an extension.
   *
   * @param memoryNode - Parent memory system node
   * @param mem - USA memory configuration
   * @param ctx - Translation context
   */
  private translateSemanticMemory(memoryNode: BlankNode, mem: USAMemory, ctx: USATranslationContext): void {
    if (!mem.semantic?.enabled) {
      return;
    }

    const semanticNode = this.blank(this.generateBlankId('semantic'));
    
    ctx.quads.push(this.quad(memoryNode, chrysalis('hasMemoryComponent'), semanticNode));
    ctx.quads.push(this.quad(semanticNode, rdf('type'), chrysalis('SemanticMemory')));
    ctx.quads.push(this.quad(semanticNode, chrysalis('memoryEnabled'), this.literal(true)));

    if (mem.semantic.storage) {
      ctx.quads.push(this.quad(semanticNode, chrysalis('storageBackend'), this.literal(mem.semantic.storage)));
    }

    // RAG config as extension
    if (mem.semantic.rag) {
      ctx.extensions.push(this.createExtension(
        'usa', 'ragConfig', mem.semantic.rag, 'capabilities.memory.semantic.rag'
      ));
    }

    ctx.mappedFields.push('capabilities.memory.semantic');
  }

  /**
   * Translate procedural memory component to RDF.
   *
   * @param memoryNode - Parent memory system node
   * @param mem - USA memory configuration
   * @param ctx - Translation context
   */
  private translateProceduralMemory(memoryNode: BlankNode, mem: USAMemory, ctx: USATranslationContext): void {
    if (!mem.procedural?.enabled) {
      return;
    }

    const proceduralNode = this.blank(this.generateBlankId('procedural'));
    
    ctx.quads.push(this.quad(memoryNode, chrysalis('hasMemoryComponent'), proceduralNode));
    ctx.quads.push(this.quad(proceduralNode, rdf('type'), chrysalis('ProceduralMemory')));
    ctx.quads.push(this.quad(proceduralNode, chrysalis('memoryEnabled'), this.literal(true)));

    ctx.mappedFields.push('capabilities.memory.procedural');
  }

  /**
   * Translate core memory component to RDF.
   * Core memory blocks are preserved as an extension.
   *
   * @param memoryNode - Parent memory system node
   * @param mem - USA memory configuration
   * @param ctx - Translation context
   */
  private translateCoreMemory(memoryNode: BlankNode, mem: USAMemory, ctx: USATranslationContext): void {
    if (!mem.core?.enabled) {
      return;
    }

    const coreNode = this.blank(this.generateBlankId('core'));
    
    ctx.quads.push(this.quad(memoryNode, chrysalis('hasMemoryComponent'), coreNode));
    ctx.quads.push(this.quad(coreNode, rdf('type'), chrysalis('CoreMemory')));
    ctx.quads.push(this.quad(coreNode, chrysalis('memoryEnabled'), this.literal(true)));

    // Core memory blocks as extension
    if (mem.core.blocks) {
      ctx.extensions.push(this.createExtension(
        'usa', 'coreMemoryBlocks', mem.core.blocks, 'capabilities.memory.core.blocks'
      ));
    }

    ctx.mappedFields.push('capabilities.memory.core');
  }

  /**
   * Translate USA protocol bindings to canonical RDF.
   *
   * Handles MCP, A2A, and Agent Protocol bindings.
   * MCP servers configuration is preserved as an extension.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:supportsProtocol → binding nodes
   * - chrysalis:MCPBinding, A2ABinding, AgentProtocolBinding (types)
   * - chrysalis:protocolConfig (JSON)
   * - chrysalis:endpointUrl
   */
  private translateProtocols(ctx: USATranslationContext): void {
    const { agent, agentUri, quads, mappedFields } = ctx;
    
    if (!agent.protocols) {
      return;
    }

    const agentNode = this.uri(agentUri);

    // MCP Protocol
    if (agent.protocols.mcp?.enabled) {
      this.translateMCPProtocol(agentNode, agent.protocols.mcp, ctx);
      mappedFields.push('protocols.mcp');
    }

    // A2A Protocol
    if (agent.protocols.a2a?.enabled) {
      const a2aNode = this.blank(this.generateBlankId('a2a'));
      quads.push(this.quad(agentNode, chrysalis('supportsProtocol'), a2aNode));
      quads.push(this.quad(a2aNode, rdf('type'), chrysalis('A2ABinding')));
      mappedFields.push('protocols.a2a');
    }

    // Agent Protocol
    if (agent.protocols.agent_protocol?.enabled) {
      this.translateAgentProtocol(agentNode, agent.protocols.agent_protocol, ctx);
      mappedFields.push('protocols.agent_protocol');
    }
  }

  /**
   * Translate MCP protocol binding to RDF.
   *
   * @param agentNode - The agent URI node
   * @param mcp - MCP protocol configuration
   * @param ctx - Translation context
   */
  private translateMCPProtocol(
    agentNode: NamedNode,
    mcp: NonNullable<USAProtocols['mcp']>,
    ctx: USATranslationContext
  ): void {
    const mcpNode = this.blank(this.generateBlankId('mcp'));
    
    ctx.quads.push(this.quad(agentNode, chrysalis('supportsProtocol'), mcpNode));
    ctx.quads.push(this.quad(mcpNode, rdf('type'), chrysalis('MCPBinding')));

    if (mcp.role) {
      ctx.quads.push(this.quad(
        mcpNode, chrysalis('protocolConfig'), this.literal(JSON.stringify({ role: mcp.role }))
      ));
    }

    // MCP servers as extension
    if (mcp.servers) {
      ctx.extensions.push(this.createExtension('usa', 'mcpServers', mcp.servers, 'protocols.mcp.servers'));
    }
  }

  /**
   * Translate Agent Protocol binding to RDF.
   *
   * @param agentNode - The agent URI node
   * @param ap - Agent Protocol configuration
   * @param ctx - Translation context
   */
  private translateAgentProtocol(
    agentNode: NamedNode,
    ap: NonNullable<USAProtocols['agent_protocol']>,
    ctx: USATranslationContext
  ): void {
    const apNode = this.blank(this.generateBlankId('ap'));
    
    ctx.quads.push(this.quad(agentNode, chrysalis('supportsProtocol'), apNode));
    ctx.quads.push(this.quad(apNode, rdf('type'), chrysalis('AgentProtocolBinding')));

    if (ap.endpoint) {
      ctx.quads.push(this.quad(apNode, chrysalis('endpointUrl'), this.literal(ap.endpoint)));
    }
  }

  /**
   * Translate USA execution configuration to canonical RDF.
   *
   * Creates an LLMConfig node with provider, model, temperature, max_tokens.
   * Additional LLM parameters and runtime config are preserved as extensions.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:hasExecutionConfig → blank node
   * - chrysalis:LLMConfig (type)
   * - chrysalis:llmProvider
   * - chrysalis:llmModel
   * - chrysalis:temperature (xsd:float)
   * - chrysalis:maxOutputTokens (xsd:integer)
   */
  private translateExecution(ctx: USATranslationContext): void {
    const { agent, agentUri, quads, mappedFields, unmappedFields, extensions } = ctx;
    const agentNode = this.uri(agentUri);

    // LLM Configuration
    if (agent.execution?.llm) {
      const llmNode = this.blank(this.generateBlankId('llm'));
      
      quads.push(this.quad(agentNode, chrysalis('hasExecutionConfig'), llmNode));
      quads.push(this.quad(llmNode, rdf('type'), chrysalis('LLMConfig')));

      // Required LLM properties
      quads.push(this.quad(llmNode, chrysalis('llmProvider'), this.literal(agent.execution.llm.provider)));
      mappedFields.push('execution.llm.provider');

      quads.push(this.quad(llmNode, chrysalis('llmModel'), this.literal(agent.execution.llm.model)));
      mappedFields.push('execution.llm.model');

      // Optional LLM properties
      if (agent.execution.llm.temperature !== undefined) {
        quads.push(this.quad(
          llmNode, chrysalis('temperature'), this.literal(agent.execution.llm.temperature, `${XSD_NS}float`)
        ));
        mappedFields.push('execution.llm.temperature');
      }

      if (agent.execution.llm.max_tokens !== undefined) {
        quads.push(this.quad(
          llmNode, chrysalis('maxOutputTokens'), this.literal(agent.execution.llm.max_tokens, `${XSD_NS}integer`)
        ));
        mappedFields.push('execution.llm.max_tokens');
      }

      // Additional LLM parameters as extension
      if (agent.execution.llm.parameters) {
        extensions.push(this.createExtension(
          'usa', 'llmParameters', agent.execution.llm.parameters, 'execution.llm.parameters'
        ));
        unmappedFields.push('execution.llm.parameters');
      }
    }

    // Runtime config as extension
    if (agent.execution?.runtime) {
      extensions.push(this.createExtension(
        'usa', 'runtimeConfig', agent.execution.runtime, 'execution.runtime'
      ));
      unmappedFields.push('execution.runtime');
    }
  }

  /**
   * Translate USA deployment configuration to canonical RDF.
   *
   * Deployment context gets its own USA-namespace predicate.
   * Full deployment config is preserved as an extension.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - usa:deploymentContext
   */
  private translateDeployment(ctx: USATranslationContext): void {
    const { agent, agentUri, quads, mappedFields, unmappedFields, extensions } = ctx;
    
    if (!agent.deployment) {
      return;
    }

    const agentNode = this.uri(agentUri);

    // Full deployment config as extension
    extensions.push(this.createExtension('usa', 'deploymentConfig', agent.deployment, 'deployment'));

    // Deployment context as specific property
    if (agent.deployment.context) {
      quads.push(this.quad(agentNode, usa('deploymentContext'), this.literal(agent.deployment.context)));
      mappedFields.push('deployment.context');
    }

    unmappedFields.push('deployment');
  }

  /**
   * Finalize and build the canonical agent from translation context.
   *
   * Creates the CanonicalAgent structure with all accumulated quads,
   * extensions, and metadata. Adds provenance triples if configured.
   *
   * @param ctx - Completed translation context
   * @returns The finalized CanonicalAgent
   */
  private finalizeCanonical(ctx: USATranslationContext): CanonicalAgent {
    const canonical: CanonicalAgent = {
      uri: ctx.agentUri,
      quads: ctx.quads,
      sourceFramework: 'usa',
      extensions: ctx.extensions,
      metadata: this.createMetadata(
        ctx.startTime,
        ctx.mappedFields,
        ctx.unmappedFields,
        ctx.lostFields,
        ctx.warnings
      )
    };

    // Add provenance triples if configured
    this.addProvenanceTriples(canonical.quads, ctx.agentUri, canonical);

    return canonical;
  }

  // ==========================================================================
  // Canonical → Native Translation (Public API)
  // ==========================================================================

  /**
   * Translate canonical RDF representation back to native USA format.
   *
   * This method orchestrates the reverse translation by delegating to focused
   * private extraction methods for each logical section of the USA specification.
   *
   * @param canonical - The canonical RDF representation
   * @returns Promise resolving to the native USA agent specification
   */
  public async fromCanonical(canonical: CanonicalAgent): Promise<NativeAgent> {
    const agent = this.initEmptyUSAAgent();

    // Extract each section using focused helper methods
    this.extractMetadataFromCanonical(canonical, agent);
    this.extractIdentityFromCanonical(canonical, agent);
    this.extractToolsFromCanonical(canonical, agent);
    this.extractReasoningFromCanonical(canonical, agent);
    this.extractMemorySystemFromCanonical(canonical, agent);
    this.extractProtocolsFromCanonical(canonical, agent);
    this.extractExecutionFromCanonical(canonical, agent);
    this.extractDeploymentFromCanonical(canonical, agent);

    return {
      data: agent as unknown as Record<string, unknown>,
      framework: 'usa',
      version: agent.apiVersion,
      source: canonical.uri
    };
  }

  // ==========================================================================
  // Private Extraction Methods for fromCanonical
  // ==========================================================================

  /**
   * Initialize an empty USA agent with required structure.
   */
  private initEmptyUSAAgent(): USAAgent {
    return {
      apiVersion: 'usa/v2',
      kind: 'Agent',
      metadata: {
        name: '',
        version: '1.0.0'
      },
      identity: {
        role: '',
        goal: ''
      },
      capabilities: {},
      execution: {
        llm: {
          provider: '',
          model: ''
        }
      }
    };
  }

  /**
   * Extract metadata section from canonical RDF.
   *
   * @param canonical - The canonical representation
   * @param agent - The agent to populate
   */
  private extractMetadataFromCanonical(canonical: CanonicalAgent, agent: USAAgent): void {
    const { quads, uri: agentUri, extensions } = canonical;

    agent.metadata.name = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}name`) || 'unknown';
    agent.metadata.version = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}version`) || '1.0.0';
    
    const description = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}description`);
    if (description) {
      agent.metadata.description = description;
    }

    const author = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}author`);
    if (author) {
      agent.metadata.author = author;
    }

    const tagsJson = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}tags`);
    if (tagsJson) {
      try {
        const parsedTags = JSON.parse(tagsJson) as unknown;
        if (Array.isArray(parsedTags)) {
          agent.metadata.tags = parsedTags as string[];
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Restore API version from extensions
    const apiVersionExt = extensions.find(e =>
      e.namespace === 'usa' && e.property === 'apiVersion'
    );
    if (apiVersionExt) {
      agent.apiVersion = apiVersionExt.value;
    }
  }

  /**
   * Extract identity section from canonical RDF.
   *
   * @param canonical - The canonical representation
   * @param agent - The agent to populate
   */
  private extractIdentityFromCanonical(canonical: CanonicalAgent, agent: USAAgent): void {
    const { quads, uri: agentUri, extensions } = canonical;

    const identityUri = this.extractUri(quads, agentUri, `${CHRYSALIS_NS}hasIdentity`);
    if (identityUri) {
      agent.identity.role = this.extractLiteral(quads, identityUri, `${USA_NS}role`) || '';
      agent.identity.goal = this.extractLiteral(quads, identityUri, `${USA_NS}goal`) || '';
      
      const backstory = this.extractLiteral(quads, identityUri, `${USA_NS}backstory`);
      if (backstory) {
        agent.identity.backstory = backstory;
      }
    }

    // Restore personality traits from extensions
    this.restoreExtensionToAgent(extensions, 'personalityTraits', (value) => {
      agent.identity.personality_traits = value as Record<string, string | number | boolean>;
    });

    // Restore constraints from extensions
    this.restoreExtensionToAgent(extensions, 'constraints', (value) => {
      agent.identity.constraints = value as string[];
    });
  }

  /**
   * Extract tools section from canonical RDF.
   *
   * @param canonical - The canonical representation
   * @param agent - The agent to populate
   */
  private extractToolsFromCanonical(canonical: CanonicalAgent, agent: USAAgent): void {
    const { quads, uri: agentUri, extensions } = canonical;

    const toolUris = this.extractUris(quads, agentUri, `${CHRYSALIS_NS}hasCapability`);
    const tools: USATool[] = [];

    for (const toolUri of toolUris) {
      const isToolType = quads.some(q => 
        q.subject.value === toolUri &&
        q.predicate.value === `${RDF_NS}type` &&
        q.object.value === `${CHRYSALIS_NS}Tool`
      );

      if (isToolType) {
        const name = this.extractLiteral(quads, toolUri, `${CHRYSALIS_NS}toolName`);
        if (name) {
          const tool: USATool = { name };
          
          const desc = this.extractLiteral(quads, toolUri, `${CHRYSALIS_NS}toolDescription`);
          if (desc) {
            tool.description = desc;
          }

          const protocol = this.extractLiteral(quads, toolUri, `${CHRYSALIS_NS}protocolVersion`);
          if (protocol) {
            tool.protocol = protocol;
          }

          const configExt = extensions.find(e =>
            e.namespace === 'usa' && e.property === `tool.${name}.config`
          );
          if (configExt) {
            try {
              const parsedConfig = JSON.parse(configExt.value) as unknown;
              if (parsedConfig && typeof parsedConfig === 'object') {
                tool.config = parsedConfig as Record<string, unknown>;
              }
            } catch {
              // Ignore
            }
          }

          tools.push(tool);
        }
      }
    }

    if (tools.length > 0) {
      agent.capabilities.tools = tools;
    }
  }

  /**
   * Extract reasoning strategy from canonical RDF.
   *
   * @param canonical - The canonical representation
   * @param agent - The agent to populate
   */
  private extractReasoningFromCanonical(canonical: CanonicalAgent, agent: USAAgent): void {
    const { quads, uri: agentUri, extensions } = canonical;

    const strategyUri = this.extractUri(quads, agentUri, `${CHRYSALIS_NS}usesReasoningStrategy`);
    if (strategyUri) {
      const strategyMap: Record<string, string> = {
        [`${CHRYSALIS_NS}ChainOfThought`]: 'chain_of_thought',
        [`${CHRYSALIS_NS}ReAct`]: 'react',
        [`${CHRYSALIS_NS}Reflexion`]: 'reflexion',
        [`${CHRYSALIS_NS}TreeOfThoughts`]: 'tree_of_thoughts'
      };

      const strategy = strategyMap[strategyUri] || 'chain_of_thought';
      
      agent.capabilities.reasoning = { strategy };

      // Restore reasoning config from extensions
      this.restoreExtensionToAgent(extensions, 'reasoningConfig', (config) => {
        const reasoningConfig = config as { max_iterations?: number; allow_backtracking?: boolean };
        if (reasoningConfig.max_iterations && agent.capabilities.reasoning) {
          agent.capabilities.reasoning.max_iterations = reasoningConfig.max_iterations;
        }
        if (reasoningConfig.allow_backtracking !== undefined && agent.capabilities.reasoning) {
          agent.capabilities.reasoning.allow_backtracking = reasoningConfig.allow_backtracking;
        }
      });
    }
  }

  /**
   * Extract memory system from canonical RDF.
   *
   * @param canonical - The canonical representation
   * @param agent - The agent to populate
   */
  private extractMemorySystemFromCanonical(canonical: CanonicalAgent, agent: USAAgent): void {
    const { quads, uri: agentUri, extensions } = canonical;

    const memoryUri = this.extractUri(quads, agentUri, `${CHRYSALIS_NS}hasMemorySystem`);
    if (!memoryUri) {
      return;
    }

    const architecture = this.extractLiteral(quads, memoryUri, `${USA_NS}memoryArchitecture`) || 'hierarchical';
    agent.capabilities.memory = { architecture };

    // Extract memory components
    this.extractMemoryComponents(quads, memoryUri, agent);

    // Restore memory extensions
    this.restoreMemoryExtensions(extensions, agent);
  }

  /**
   * Extract individual memory components from RDF.
   */
  private extractMemoryComponents(quads: Quad[], memoryUri: string, agent: USAAgent): void {
    const componentUris = this.extractUris(quads, memoryUri, `${CHRYSALIS_NS}hasMemoryComponent`);
    
    for (const compUri of componentUris) {
      const typeUri = this.extractUri(quads, compUri, `${RDF_NS}type`);
      const enabled = this.extractLiteral(quads, compUri, `${CHRYSALIS_NS}memoryEnabled`) === 'true';
      const maxTokens = this.extractLiteral(quads, compUri, `${CHRYSALIS_NS}maxTokens`);
      const storage = this.extractLiteral(quads, compUri, `${CHRYSALIS_NS}storageBackend`);

      if (!agent.capabilities.memory) {
        continue;
      }

      switch (typeUri) {
        case `${CHRYSALIS_NS}WorkingMemory`:
          agent.capabilities.memory.working = { enabled };
          if (maxTokens) {
            agent.capabilities.memory.working.max_tokens = parseInt(maxTokens);
          }
          break;
        case `${CHRYSALIS_NS}EpisodicMemory`:
          agent.capabilities.memory.episodic = { enabled };
          if (storage) {
            agent.capabilities.memory.episodic.storage = storage;
          }
          break;
        case `${CHRYSALIS_NS}SemanticMemory`:
          agent.capabilities.memory.semantic = { enabled };
          if (storage) {
            agent.capabilities.memory.semantic.storage = storage;
          }
          break;
        case `${CHRYSALIS_NS}ProceduralMemory`:
          agent.capabilities.memory.procedural = { enabled };
          if (storage) {
            agent.capabilities.memory.procedural.storage = storage;
          }
          break;
        case `${CHRYSALIS_NS}CoreMemory`:
          agent.capabilities.memory.core = { enabled };
          break;
      }
    }
  }

  /**
   * Restore memory-related extensions to agent.
   */
  private restoreMemoryExtensions(extensions: ExtensionProperty[], agent: USAAgent): void {
    if (!agent.capabilities.memory) {
      return;
    }

    // Restore RAG config for semantic memory
    this.restoreExtensionToAgent(extensions, 'ragConfig', (parsed) => {
      if (agent.capabilities.memory?.semantic) {
        agent.capabilities.memory.semantic.rag = parsed as USASemanticMemory['rag'];
      }
    });

    // Restore core memory blocks
    this.restoreExtensionToAgent(extensions, 'coreMemoryBlocks', (parsed) => {
      if (agent.capabilities.memory?.core) {
        agent.capabilities.memory.core.blocks = parsed as USACoreMemory['blocks'];
      }
    });

    // Restore embeddings config
    this.restoreExtensionToAgent(extensions, 'embeddingsConfig', (parsed) => {
      if (agent.capabilities.memory) {
        agent.capabilities.memory.embeddings = parsed as USAEmbeddings;
      }
    });

    // Restore storage config
    this.restoreExtensionToAgent(extensions, 'storageConfig', (parsed) => {
      if (agent.capabilities.memory) {
        agent.capabilities.memory.storage = parsed as USAStorage;
      }
    });

    // Restore memory operations
    this.restoreExtensionToAgent(extensions, 'memoryOperations', (parsed) => {
      if (agent.capabilities.memory) {
        agent.capabilities.memory.operations = parsed as USAMemoryOperations;
      }
    });
  }

  /**
   * Extract protocols from canonical RDF.
   *
   * @param canonical - The canonical representation
   * @param agent - The agent to populate
   */
  private extractProtocolsFromCanonical(canonical: CanonicalAgent, agent: USAAgent): void {
    const { quads, uri: agentUri, extensions } = canonical;

    const protocolUris = this.extractUris(quads, agentUri, `${CHRYSALIS_NS}supportsProtocol`);
    
    for (const protoUri of protocolUris) {
      const typeUri = this.extractUri(quads, protoUri, `${RDF_NS}type`);
      
      switch (typeUri) {
        case `${CHRYSALIS_NS}MCPBinding`:
          this.extractMCPProtocol(quads, protoUri, extensions, agent);
          break;
        case `${CHRYSALIS_NS}A2ABinding`:
          if (!agent.protocols) {
            agent.protocols = {};
          }
          agent.protocols.a2a = { enabled: true };
          break;
        case `${CHRYSALIS_NS}AgentProtocolBinding`:
          this.extractAgentProtocolBinding(quads, protoUri, agent);
          break;
      }
    }
  }

  /**
   * Extract MCP protocol configuration.
   */
  private extractMCPProtocol(
    quads: Quad[],
    protoUri: string,
    extensions: ExtensionProperty[],
    agent: USAAgent
  ): void {
    if (!agent.protocols) {
      agent.protocols = {};
    }
    agent.protocols.mcp = { enabled: true };
    
    const mcpConfig = this.extractLiteral(quads, protoUri, `${CHRYSALIS_NS}protocolConfig`);
    if (mcpConfig) {
      try {
        const config = JSON.parse(mcpConfig) as { role?: string };
        if (config.role) {
          agent.protocols.mcp.role = config.role;
        }
      } catch {
        // Ignore
      }
    }

    // Restore MCP servers from extensions
    this.restoreExtensionToAgent(extensions, 'mcpServers', (servers) => {
      if (agent.protocols?.mcp) {
        agent.protocols.mcp.servers = servers as USAProtocols['mcp'] extends { servers?: infer S } ? S : never;
      }
    });
  }

  /**
   * Extract Agent Protocol binding.
   */
  private extractAgentProtocolBinding(quads: Quad[], protoUri: string, agent: USAAgent): void {
    if (!agent.protocols) {
      agent.protocols = {};
    }
    agent.protocols.agent_protocol = { enabled: true };
    
    const endpoint = this.extractLiteral(quads, protoUri, `${CHRYSALIS_NS}endpointUrl`);
    if (endpoint) {
      agent.protocols.agent_protocol.endpoint = endpoint;
    }
  }

  /**
   * Extract execution configuration from canonical RDF.
   *
   * @param canonical - The canonical representation
   * @param agent - The agent to populate
   */
  private extractExecutionFromCanonical(canonical: CanonicalAgent, agent: USAAgent): void {
    const { quads, uri: agentUri, extensions } = canonical;

    const llmUri = this.extractUri(quads, agentUri, `${CHRYSALIS_NS}hasExecutionConfig`);
    if (llmUri) {
      agent.execution.llm.provider = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}llmProvider`) || '';
      agent.execution.llm.model = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}llmModel`) || '';
      
      const temp = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}temperature`);
      if (temp) {
        agent.execution.llm.temperature = parseFloat(temp);
      }

      const maxTokens = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}maxOutputTokens`);
      if (maxTokens) {
        agent.execution.llm.max_tokens = parseInt(maxTokens);
      }

      // Restore LLM parameters from extensions
      this.restoreExtensionToAgent(extensions, 'llmParameters', (params) => {
        agent.execution.llm.parameters = params as Record<string, unknown>;
      });
    }

    // Restore runtime config from extensions
    this.restoreExtensionToAgent(extensions, 'runtimeConfig', (runtime) => {
      agent.execution.runtime = runtime as USAExecution['runtime'];
    });
  }

  /**
   * Extract deployment configuration from canonical RDF.
   *
   * @param canonical - The canonical representation
   * @param agent - The agent to populate
   */
  private extractDeploymentFromCanonical(canonical: CanonicalAgent, agent: USAAgent): void {
    const { extensions } = canonical;

    // Restore deployment from extensions
    this.restoreExtensionToAgent(extensions, 'deploymentConfig', (deployment) => {
      agent.deployment = deployment as USADeployment;
    });
  }

  /**
   * Helper to restore an extension value to the agent.
   * 
   * @param extensions - Extension properties array
   * @param property - The property name to find
   * @param handler - Callback to handle the parsed value
   */
  private restoreExtensionToAgent(
    extensions: ExtensionProperty[],
    property: string,
    handler: (value: unknown) => void
  ): void {
    const ext = extensions.find(e => e.namespace === 'usa' && e.property === property);
    if (ext) {
      try {
        handler(JSON.parse(ext.value));
      } catch {
        // Ignore parse errors
      }
    }
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  public validateNative(native: NativeAgent): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const agent = native.data as unknown as USAAgent;

    // Required: apiVersion
    if (!agent.apiVersion) {
      errors.push({
        code: 'MISSING_API_VERSION',
        message: 'apiVersion is required',
        path: 'apiVersion',
        expected: 'usa/v2 or similar',
        actual: 'undefined'
      });
    }

    // Required: kind
    if (agent.kind !== 'Agent') {
      errors.push({
        code: 'INVALID_KIND',
        message: 'kind must be "Agent"',
        path: 'kind',
        expected: 'Agent',
        actual: String(agent.kind)
      });
    }

    // Required: metadata.name
    if (!agent.metadata?.name) {
      errors.push({
        code: 'MISSING_NAME',
        message: 'metadata.name is required',
        path: 'metadata.name'
      });
    }

    // Required: identity.role
    if (!agent.identity?.role) {
      errors.push({
        code: 'MISSING_ROLE',
        message: 'identity.role is required',
        path: 'identity.role'
      });
    }

    // Required: identity.goal
    if (!agent.identity?.goal) {
      errors.push({
        code: 'MISSING_GOAL',
        message: 'identity.goal is required',
        path: 'identity.goal'
      });
    }

    // Required: execution.llm
    if (!agent.execution?.llm) {
      errors.push({
        code: 'MISSING_LLM',
        message: 'execution.llm configuration is required',
        path: 'execution.llm'
      });
    } else {
      if (!agent.execution.llm.provider) {
        errors.push({
          code: 'MISSING_LLM_PROVIDER',
          message: 'execution.llm.provider is required',
          path: 'execution.llm.provider'
        });
      }
      if (!agent.execution.llm.model) {
        errors.push({
          code: 'MISSING_LLM_MODEL',
          message: 'execution.llm.model is required',
          path: 'execution.llm.model'
        });
      }
    }

    // Warnings for recommended fields
    if (!agent.metadata?.version) {
      warnings.push({
        code: 'MISSING_VERSION',
        message: 'metadata.version is recommended',
        path: 'metadata.version'
      });
    }

    if (!agent.metadata?.description) {
      warnings.push({
        code: 'MISSING_DESCRIPTION',
        message: 'metadata.description is recommended',
        path: 'metadata.description'
      });
    }

    if (!agent.capabilities?.memory) {
      warnings.push({
        code: 'NO_MEMORY_CONFIG',
        message: 'No memory configuration defined',
        path: 'capabilities.memory'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // Field Mappings
  // ==========================================================================

  public getFieldMappings(): FieldMapping[] {
    return [
      // Metadata mappings
      { sourcePath: 'metadata.name', predicate: `${CHRYSALIS_NS}name`, datatype: 'string', required: true },
      { sourcePath: 'metadata.version', predicate: `${CHRYSALIS_NS}version`, datatype: 'string', required: false },
      { sourcePath: 'metadata.description', predicate: `${CHRYSALIS_NS}description`, datatype: 'string', required: false },
      { sourcePath: 'metadata.author', predicate: `${CHRYSALIS_NS}author`, datatype: 'string', required: false },
      { sourcePath: 'metadata.tags', predicate: `${CHRYSALIS_NS}tags`, datatype: 'json', required: false },
      
      // Identity mappings
      { sourcePath: 'identity.role', predicate: `${USA_NS}role`, datatype: 'string', required: true },
      { sourcePath: 'identity.goal', predicate: `${USA_NS}goal`, datatype: 'string', required: true },
      { sourcePath: 'identity.backstory', predicate: `${USA_NS}backstory`, datatype: 'string', required: false },
      
      // LLM mappings
      { sourcePath: 'execution.llm.provider', predicate: `${CHRYSALIS_NS}llmProvider`, datatype: 'string', required: true },
      { sourcePath: 'execution.llm.model', predicate: `${CHRYSALIS_NS}llmModel`, datatype: 'string', required: true },
      { sourcePath: 'execution.llm.temperature', predicate: `${CHRYSALIS_NS}temperature`, datatype: 'float', required: false },
      { sourcePath: 'execution.llm.max_tokens', predicate: `${CHRYSALIS_NS}maxOutputTokens`, datatype: 'integer', required: false },
      
      // Memory mappings
      { sourcePath: 'capabilities.memory.architecture', predicate: `${USA_NS}memoryArchitecture`, datatype: 'string', required: false },
      
      // Protocol mappings
      { sourcePath: 'protocols.agent_protocol.endpoint', predicate: `${CHRYSALIS_NS}endpointUrl`, datatype: 'string', required: false },
    ];
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Generate a SHA-384 based fingerprint for the agent
   */
  private generateFingerprint(agent: USAAgent): string {
    // Simple hash generation (in production, use proper crypto)
    const content = JSON.stringify({
      name: agent.metadata.name,
      role: agent.identity.role,
      goal: agent.identity.goal
    });
    
    // Simple string hash for demo purposes
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `sha384:${Math.abs(hash).toString(16).padStart(16, '0')}`;
  }
}

// ============================================================================
// Factory Export
// ============================================================================

export function createUSAAdapter(config?: AdapterConfig): USAAdapter {
  return new USAAdapter(config);
}
