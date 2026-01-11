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

import {
  Quad,
  Subject,
  NamedNode,
  BlankNode,
  DataFactory,
  CHRYSALIS_NS,
  RDF_NS,
  XSD_NS,
  chrysalis,
  rdf,
  xsd
} from '../rdf/temporal-store';

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
// USA Adapter Implementation
// ============================================================================

/**
 * Adapter for Chrysalis Uniform Semantic Agent (USA) specification.
 * 
 * Handles bidirectional translation between USA v2.0 YAML/JSON format
 * and the canonical RDF representation used by the bridge.
 */
export class USAAdapter extends BaseAdapter {
  readonly framework = 'usa' as const;
  readonly name = 'Chrysalis USA Adapter';
  readonly version = '1.0.0';
  readonly extensionNamespace = USA_NS;

  constructor(config: AdapterConfig = {}) {
    super(config);
  }

  // ==========================================================================
  // Native → Canonical Translation
  // ==========================================================================

  async toCanonical(native: NativeAgent): Promise<CanonicalAgent> {
    const startTime = Date.now();
    const warnings: TranslationWarning[] = [];
    const mappedFields: string[] = [];
    const unmappedFields: string[] = [];
    const lostFields: string[] = [];
    const extensions: ExtensionProperty[] = [];

    const agent = native.data as unknown as USAAgent;
    const agentId = agent.metadata.name;
    const agentUri = this.generateAgentUri(agentId);
    const quads: Quad[] = [];

    // Agent type declaration
    quads.push(this.quad(
      this.uri(agentUri),
      rdf('type'),
      chrysalis('Agent')
    ));
    mappedFields.push('kind');

    // ========================================================================
    // Metadata Section
    // ========================================================================

    // Name
    quads.push(this.quad(
      this.uri(agentUri),
      chrysalis('name'),
      this.literal(agent.metadata.name)
    ));
    mappedFields.push('metadata.name');

    // Version
    if (agent.metadata.version) {
      quads.push(this.quad(
        this.uri(agentUri),
        chrysalis('version'),
        this.literal(agent.metadata.version)
      ));
      mappedFields.push('metadata.version');
    }

    // Description
    if (agent.metadata.description) {
      quads.push(this.quad(
        this.uri(agentUri),
        chrysalis('description'),
        this.literal(agent.metadata.description)
      ));
      mappedFields.push('metadata.description');
    }

    // Author
    if (agent.metadata.author) {
      quads.push(this.quad(
        this.uri(agentUri),
        chrysalis('author'),
        this.literal(agent.metadata.author)
      ));
      mappedFields.push('metadata.author');
    }

    // Tags
    if (agent.metadata.tags?.length) {
      quads.push(this.quad(
        this.uri(agentUri),
        chrysalis('tags'),
        this.literal(JSON.stringify(agent.metadata.tags))
      ));
      mappedFields.push('metadata.tags');
    }

    // API Version (USA-specific extension)
    if (agent.apiVersion) {
      extensions.push(this.createExtension(
        'usa',
        'apiVersion',
        agent.apiVersion,
        'apiVersion'
      ));
      unmappedFields.push('apiVersion');
    }

    // ========================================================================
    // Identity Section
    // ========================================================================

    const identityNode = this.blank(this.generateBlankId('identity'));
    
    quads.push(this.quad(
      this.uri(agentUri),
      chrysalis('hasIdentity'),
      identityNode
    ));

    quads.push(this.quad(
      identityNode,
      rdf('type'),
      chrysalis('AgentIdentity')
    ));

    // Generate fingerprint-based identity
    const fingerprint = this.generateFingerprint(agent);
    quads.push(this.quad(
      identityNode,
      chrysalis('identifierValue'),
      this.literal(fingerprint)
    ));
    quads.push(this.quad(
      identityNode,
      chrysalis('identifierScheme'),
      this.literal('sha384')
    ));

    // USA-specific identity fields
    if (agent.identity.role) {
      quads.push(this.quad(
        identityNode,
        usa('role'),
        this.literal(agent.identity.role)
      ));
      mappedFields.push('identity.role');
    }

    if (agent.identity.goal) {
      quads.push(this.quad(
        identityNode,
        usa('goal'),
        this.literal(agent.identity.goal)
      ));
      mappedFields.push('identity.goal');
    }

    if (agent.identity.backstory) {
      quads.push(this.quad(
        identityNode,
        usa('backstory'),
        this.literal(agent.identity.backstory)
      ));
      mappedFields.push('identity.backstory');
    }

    // Personality traits (extension)
    if (agent.identity.personality_traits) {
      extensions.push(this.createExtension(
        'usa',
        'personalityTraits',
        agent.identity.personality_traits,
        'identity.personality_traits'
      ));
      unmappedFields.push('identity.personality_traits');
    }

    // Constraints (extension)
    if (agent.identity.constraints?.length) {
      extensions.push(this.createExtension(
        'usa',
        'constraints',
        agent.identity.constraints,
        'identity.constraints'
      ));
      unmappedFields.push('identity.constraints');
    }

    // ========================================================================
    // Capabilities Section - Tools
    // ========================================================================

    if (agent.capabilities.tools?.length) {
      for (const tool of agent.capabilities.tools) {
        const toolNode = this.blank(this.generateBlankId('tool'));
        
        quads.push(this.quad(
          this.uri(agentUri),
          chrysalis('hasCapability'),
          toolNode
        ));

        quads.push(this.quad(
          toolNode,
          rdf('type'),
          chrysalis('Tool')
        ));

        quads.push(this.quad(
          toolNode,
          chrysalis('toolName'),
          this.literal(tool.name)
        ));

        if (tool.description) {
          quads.push(this.quad(
            toolNode,
            chrysalis('toolDescription'),
            this.literal(tool.description)
          ));
        }

        if (tool.protocol) {
          quads.push(this.quad(
            toolNode,
            chrysalis('protocolVersion'),
            this.literal(tool.protocol)
          ));
        }

        if (tool.config) {
          extensions.push(this.createExtension(
            'usa',
            `tool.${tool.name}.config`,
            tool.config,
            `capabilities.tools.${tool.name}.config`
          ));
        }
      }
      mappedFields.push('capabilities.tools');
    }

    // ========================================================================
    // Capabilities Section - Reasoning
    // ========================================================================

    if (agent.capabilities.reasoning) {
      const reasoningStrategy = agent.capabilities.reasoning.strategy;
      let strategyUri: NamedNode;

      switch (reasoningStrategy) {
        case 'chain_of_thought':
          strategyUri = chrysalis('ChainOfThought');
          break;
        case 'react':
          strategyUri = chrysalis('ReAct');
          break;
        case 'reflexion':
          strategyUri = chrysalis('Reflexion');
          break;
        case 'tree_of_thoughts':
          strategyUri = chrysalis('TreeOfThoughts');
          break;
        default:
          strategyUri = chrysalis('ChainOfThought');
          warnings.push({
            severity: 'warning',
            code: 'UNKNOWN_STRATEGY',
            message: `Unknown reasoning strategy: ${reasoningStrategy}, defaulting to ChainOfThought`,
            sourcePath: 'capabilities.reasoning.strategy'
          });
      }

      quads.push(this.quad(
        this.uri(agentUri),
        chrysalis('usesReasoningStrategy'),
        strategyUri
      ));
      mappedFields.push('capabilities.reasoning.strategy');

      // Extension for additional reasoning config
      if (agent.capabilities.reasoning.max_iterations || 
          agent.capabilities.reasoning.allow_backtracking !== undefined) {
        extensions.push(this.createExtension(
          'usa',
          'reasoningConfig',
          agent.capabilities.reasoning,
          'capabilities.reasoning'
        ));
        unmappedFields.push('capabilities.reasoning.max_iterations');
        unmappedFields.push('capabilities.reasoning.allow_backtracking');
      }
    }

    // ========================================================================
    // Capabilities Section - Memory
    // ========================================================================

    if (agent.capabilities.memory) {
      const mem = agent.capabilities.memory;
      const memoryNode = this.blank(this.generateBlankId('memory'));

      quads.push(this.quad(
        this.uri(agentUri),
        chrysalis('hasMemorySystem'),
        memoryNode
      ));

      quads.push(this.quad(
        memoryNode,
        rdf('type'),
        chrysalis('MemorySystem')
      ));

      // Memory architecture (USA extension)
      quads.push(this.quad(
        memoryNode,
        usa('memoryArchitecture'),
        this.literal(mem.architecture)
      ));
      mappedFields.push('capabilities.memory.architecture');

      // Working Memory
      if (mem.working?.enabled) {
        const workingNode = this.blank(this.generateBlankId('working'));
        
        quads.push(this.quad(
          memoryNode,
          chrysalis('hasMemoryComponent'),
          workingNode
        ));

        quads.push(this.quad(
          workingNode,
          rdf('type'),
          chrysalis('WorkingMemory')
        ));

        quads.push(this.quad(
          workingNode,
          chrysalis('memoryEnabled'),
          this.literal(true)
        ));

        if (mem.working.max_tokens) {
          quads.push(this.quad(
            workingNode,
            chrysalis('maxTokens'),
            this.literal(mem.working.max_tokens, `${XSD_NS}integer`)
          ));
        }

        mappedFields.push('capabilities.memory.working');
      }

      // Episodic Memory
      if (mem.episodic?.enabled) {
        const episodicNode = this.blank(this.generateBlankId('episodic'));
        
        quads.push(this.quad(
          memoryNode,
          chrysalis('hasMemoryComponent'),
          episodicNode
        ));

        quads.push(this.quad(
          episodicNode,
          rdf('type'),
          chrysalis('EpisodicMemory')
        ));

        quads.push(this.quad(
          episodicNode,
          chrysalis('memoryEnabled'),
          this.literal(true)
        ));

        if (mem.episodic.storage) {
          quads.push(this.quad(
            episodicNode,
            chrysalis('storageBackend'),
            this.literal(mem.episodic.storage)
          ));
        }

        mappedFields.push('capabilities.memory.episodic');
      }

      // Semantic Memory
      if (mem.semantic?.enabled) {
        const semanticNode = this.blank(this.generateBlankId('semantic'));
        
        quads.push(this.quad(
          memoryNode,
          chrysalis('hasMemoryComponent'),
          semanticNode
        ));

        quads.push(this.quad(
          semanticNode,
          rdf('type'),
          chrysalis('SemanticMemory')
        ));

        quads.push(this.quad(
          semanticNode,
          chrysalis('memoryEnabled'),
          this.literal(true)
        ));

        if (mem.semantic.storage) {
          quads.push(this.quad(
            semanticNode,
            chrysalis('storageBackend'),
            this.literal(mem.semantic.storage)
          ));
        }

        // RAG config as extension
        if (mem.semantic.rag) {
          extensions.push(this.createExtension(
            'usa',
            'ragConfig',
            mem.semantic.rag,
            'capabilities.memory.semantic.rag'
          ));
        }

        mappedFields.push('capabilities.memory.semantic');
      }

      // Procedural Memory
      if (mem.procedural?.enabled) {
        const proceduralNode = this.blank(this.generateBlankId('procedural'));
        
        quads.push(this.quad(
          memoryNode,
          chrysalis('hasMemoryComponent'),
          proceduralNode
        ));

        quads.push(this.quad(
          proceduralNode,
          rdf('type'),
          chrysalis('ProceduralMemory')
        ));

        quads.push(this.quad(
          proceduralNode,
          chrysalis('memoryEnabled'),
          this.literal(true)
        ));

        mappedFields.push('capabilities.memory.procedural');
      }

      // Core Memory
      if (mem.core?.enabled) {
        const coreNode = this.blank(this.generateBlankId('core'));
        
        quads.push(this.quad(
          memoryNode,
          chrysalis('hasMemoryComponent'),
          coreNode
        ));

        quads.push(this.quad(
          coreNode,
          rdf('type'),
          chrysalis('CoreMemory')
        ));

        quads.push(this.quad(
          coreNode,
          chrysalis('memoryEnabled'),
          this.literal(true)
        ));

        // Core memory blocks as extension
        if (mem.core.blocks) {
          extensions.push(this.createExtension(
            'usa',
            'coreMemoryBlocks',
            mem.core.blocks,
            'capabilities.memory.core.blocks'
          ));
        }

        mappedFields.push('capabilities.memory.core');
      }

      // Embeddings config (extension)
      if (mem.embeddings) {
        extensions.push(this.createExtension(
          'usa',
          'embeddingsConfig',
          mem.embeddings,
          'capabilities.memory.embeddings'
        ));
        unmappedFields.push('capabilities.memory.embeddings');
      }

      // Storage config (extension)
      if (mem.storage) {
        extensions.push(this.createExtension(
          'usa',
          'storageConfig',
          mem.storage,
          'capabilities.memory.storage'
        ));
        unmappedFields.push('capabilities.memory.storage');
      }

      // Operations config (extension)
      if (mem.operations) {
        extensions.push(this.createExtension(
          'usa',
          'memoryOperations',
          mem.operations,
          'capabilities.memory.operations'
        ));
        unmappedFields.push('capabilities.memory.operations');
      }
    }

    // ========================================================================
    // Protocols Section
    // ========================================================================

    if (agent.protocols) {
      // MCP Protocol
      if (agent.protocols.mcp?.enabled) {
        const mcpNode = this.blank(this.generateBlankId('mcp'));
        
        quads.push(this.quad(
          this.uri(agentUri),
          chrysalis('supportsProtocol'),
          mcpNode
        ));

        quads.push(this.quad(
          mcpNode,
          rdf('type'),
          chrysalis('MCPBinding')
        ));

        if (agent.protocols.mcp.role) {
          quads.push(this.quad(
            mcpNode,
            chrysalis('protocolConfig'),
            this.literal(JSON.stringify({ role: agent.protocols.mcp.role }))
          ));
        }

        // MCP servers (extension)
        if (agent.protocols.mcp.servers) {
          extensions.push(this.createExtension(
            'usa',
            'mcpServers',
            agent.protocols.mcp.servers,
            'protocols.mcp.servers'
          ));
        }

        mappedFields.push('protocols.mcp');
      }

      // A2A Protocol
      if (agent.protocols.a2a?.enabled) {
        const a2aNode = this.blank(this.generateBlankId('a2a'));
        
        quads.push(this.quad(
          this.uri(agentUri),
          chrysalis('supportsProtocol'),
          a2aNode
        ));

        quads.push(this.quad(
          a2aNode,
          rdf('type'),
          chrysalis('A2ABinding')
        ));

        mappedFields.push('protocols.a2a');
      }

      // Agent Protocol
      if (agent.protocols.agent_protocol?.enabled) {
        const apNode = this.blank(this.generateBlankId('ap'));
        
        quads.push(this.quad(
          this.uri(agentUri),
          chrysalis('supportsProtocol'),
          apNode
        ));

        quads.push(this.quad(
          apNode,
          rdf('type'),
          chrysalis('AgentProtocolBinding')
        ));

        if (agent.protocols.agent_protocol.endpoint) {
          quads.push(this.quad(
            apNode,
            chrysalis('endpointUrl'),
            this.literal(agent.protocols.agent_protocol.endpoint)
          ));
        }

        mappedFields.push('protocols.agent_protocol');
      }
    }

    // ========================================================================
    // Execution Section - LLM Config
    // ========================================================================

    if (agent.execution?.llm) {
      const llmNode = this.blank(this.generateBlankId('llm'));
      
      quads.push(this.quad(
        this.uri(agentUri),
        chrysalis('hasExecutionConfig'),
        llmNode
      ));

      quads.push(this.quad(
        llmNode,
        rdf('type'),
        chrysalis('LLMConfig')
      ));

      quads.push(this.quad(
        llmNode,
        chrysalis('llmProvider'),
        this.literal(agent.execution.llm.provider)
      ));
      mappedFields.push('execution.llm.provider');

      quads.push(this.quad(
        llmNode,
        chrysalis('llmModel'),
        this.literal(agent.execution.llm.model)
      ));
      mappedFields.push('execution.llm.model');

      if (agent.execution.llm.temperature !== undefined) {
        quads.push(this.quad(
          llmNode,
          chrysalis('temperature'),
          this.literal(agent.execution.llm.temperature, `${XSD_NS}float`)
        ));
        mappedFields.push('execution.llm.temperature');
      }

      if (agent.execution.llm.max_tokens !== undefined) {
        quads.push(this.quad(
          llmNode,
          chrysalis('maxOutputTokens'),
          this.literal(agent.execution.llm.max_tokens, `${XSD_NS}integer`)
        ));
        mappedFields.push('execution.llm.max_tokens');
      }

      // Additional LLM parameters (extension)
      if (agent.execution.llm.parameters) {
        extensions.push(this.createExtension(
          'usa',
          'llmParameters',
          agent.execution.llm.parameters,
          'execution.llm.parameters'
        ));
        unmappedFields.push('execution.llm.parameters');
      }
    }

    // Runtime config (extension)
    if (agent.execution?.runtime) {
      extensions.push(this.createExtension(
        'usa',
        'runtimeConfig',
        agent.execution.runtime,
        'execution.runtime'
      ));
      unmappedFields.push('execution.runtime');
    }

    // ========================================================================
    // Deployment Section (extension)
    // ========================================================================

    if (agent.deployment) {
      extensions.push(this.createExtension(
        'usa',
        'deploymentConfig',
        agent.deployment,
        'deployment'
      ));

      // Deployment context as specific property
      if (agent.deployment.context) {
        quads.push(this.quad(
          this.uri(agentUri),
          usa('deploymentContext'),
          this.literal(agent.deployment.context)
        ));
        mappedFields.push('deployment.context');
      }

      unmappedFields.push('deployment');
    }

    // ========================================================================
    // Build Canonical Agent
    // ========================================================================

    const canonical: CanonicalAgent = {
      uri: agentUri,
      quads,
      sourceFramework: 'usa',
      extensions,
      metadata: this.createMetadata(startTime, mappedFields, unmappedFields, lostFields, warnings)
    };

    // Add provenance if configured
    this.addProvenanceTriples(canonical.quads, agentUri, canonical);

    return canonical;
  }

  // ==========================================================================
  // Canonical → Native Translation
  // ==========================================================================

  async fromCanonical(canonical: CanonicalAgent): Promise<NativeAgent> {
    const quads = canonical.quads;
    const agentUri = canonical.uri;

    const agent: USAAgent = {
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

    // ========================================================================
    // Extract Metadata
    // ========================================================================

    agent.metadata.name = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}name`) || 'unknown';
    agent.metadata.version = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}version`) || '1.0.0';
    
    const description = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}description`);
    if (description) agent.metadata.description = description;

    const author = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}author`);
    if (author) agent.metadata.author = author;

    const tagsJson = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}tags`);
    if (tagsJson) {
      try {
        agent.metadata.tags = JSON.parse(tagsJson);
      } catch {
        // Ignore parse errors
      }
    }

    // ========================================================================
    // Extract Identity
    // ========================================================================

    const identityUri = this.extractUri(quads, agentUri, `${CHRYSALIS_NS}hasIdentity`);
    if (identityUri) {
      agent.identity.role = this.extractLiteral(quads, identityUri, `${USA_NS}role`) || '';
      agent.identity.goal = this.extractLiteral(quads, identityUri, `${USA_NS}goal`) || '';
      
      const backstory = this.extractLiteral(quads, identityUri, `${USA_NS}backstory`);
      if (backstory) agent.identity.backstory = backstory;
    }

    // Restore identity extensions
    const personalityTraitsExt = canonical.extensions.find(e => 
      e.namespace === 'usa' && e.property === 'personalityTraits'
    );
    if (personalityTraitsExt) {
      try {
        agent.identity.personality_traits = JSON.parse(personalityTraitsExt.value);
      } catch {
        // Ignore
      }
    }

    const constraintsExt = canonical.extensions.find(e =>
      e.namespace === 'usa' && e.property === 'constraints'
    );
    if (constraintsExt) {
      try {
        agent.identity.constraints = JSON.parse(constraintsExt.value);
      } catch {
        // Ignore
      }
    }

    // ========================================================================
    // Extract Tools
    // ========================================================================

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
          if (desc) tool.description = desc;

          const protocol = this.extractLiteral(quads, toolUri, `${CHRYSALIS_NS}protocolVersion`);
          if (protocol) tool.protocol = protocol;

          // Restore tool config from extensions
          const configExt = canonical.extensions.find(e =>
            e.namespace === 'usa' && e.property === `tool.${name}.config`
          );
          if (configExt) {
            try {
              tool.config = JSON.parse(configExt.value);
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

    // ========================================================================
    // Extract Reasoning Strategy
    // ========================================================================

    const strategyUri = this.extractUri(quads, agentUri, `${CHRYSALIS_NS}usesReasoningStrategy`);
    if (strategyUri) {
      const strategyMap: Record<string, string> = {
        [`${CHRYSALIS_NS}ChainOfThought`]: 'chain_of_thought',
        [`${CHRYSALIS_NS}ReAct`]: 'react',
        [`${CHRYSALIS_NS}Reflexion`]: 'reflexion',
        [`${CHRYSALIS_NS}TreeOfThoughts`]: 'tree_of_thoughts'
      };

      const strategy = strategyMap[strategyUri] || 'chain_of_thought';
      
      agent.capabilities.reasoning = {
        strategy
      };

      // Restore reasoning config from extensions
      const reasoningExt = canonical.extensions.find(e =>
        e.namespace === 'usa' && e.property === 'reasoningConfig'
      );
      if (reasoningExt) {
        try {
          const config = JSON.parse(reasoningExt.value);
          if (config.max_iterations) agent.capabilities.reasoning.max_iterations = config.max_iterations;
          if (config.allow_backtracking !== undefined) {
            agent.capabilities.reasoning.allow_backtracking = config.allow_backtracking;
          }
        } catch {
          // Ignore
        }
      }
    }

    // ========================================================================
    // Extract Memory System
    // ========================================================================

    const memoryUri = this.extractUri(quads, agentUri, `${CHRYSALIS_NS}hasMemorySystem`);
    if (memoryUri) {
      const architecture = this.extractLiteral(quads, memoryUri, `${USA_NS}memoryArchitecture`) || 'hierarchical';
      
      agent.capabilities.memory = {
        architecture
      };

      // Extract memory components
      const componentUris = this.extractUris(quads, memoryUri, `${CHRYSALIS_NS}hasMemoryComponent`);
      
      for (const compUri of componentUris) {
        const typeUri = this.extractUri(quads, compUri, `${RDF_NS}type`);
        const enabled = this.extractLiteral(quads, compUri, `${CHRYSALIS_NS}memoryEnabled`) === 'true';
        const maxTokens = this.extractLiteral(quads, compUri, `${CHRYSALIS_NS}maxTokens`);
        const storage = this.extractLiteral(quads, compUri, `${CHRYSALIS_NS}storageBackend`);

        switch (typeUri) {
          case `${CHRYSALIS_NS}WorkingMemory`:
            agent.capabilities.memory.working = { enabled };
            if (maxTokens) agent.capabilities.memory.working.max_tokens = parseInt(maxTokens);
            break;
          case `${CHRYSALIS_NS}EpisodicMemory`:
            agent.capabilities.memory.episodic = { enabled };
            if (storage) agent.capabilities.memory.episodic.storage = storage;
            break;
          case `${CHRYSALIS_NS}SemanticMemory`:
            agent.capabilities.memory.semantic = { enabled };
            if (storage) agent.capabilities.memory.semantic.storage = storage;
            break;
          case `${CHRYSALIS_NS}ProceduralMemory`:
            agent.capabilities.memory.procedural = { enabled };
            if (storage) agent.capabilities.memory.procedural.storage = storage;
            break;
          case `${CHRYSALIS_NS}CoreMemory`:
            agent.capabilities.memory.core = { enabled };
            break;
        }
      }

      // Restore memory extensions
      const restoreMemoryExtension = (prop: string, handler: (parsed: unknown) => void) => {
        const ext = canonical.extensions.find(e =>
          e.namespace === 'usa' && e.property === prop
        );
        if (ext) {
          try {
            handler(JSON.parse(ext.value));
          } catch {
            // Ignore parse errors
          }
        }
      };

      // Restore RAG config for semantic memory
      restoreMemoryExtension('ragConfig', (parsed) => {
        if (agent.capabilities.memory?.semantic) {
          agent.capabilities.memory.semantic.rag = parsed as USASemanticMemory['rag'];
        }
      });

      // Restore core memory blocks
      restoreMemoryExtension('coreMemoryBlocks', (parsed) => {
        if (agent.capabilities.memory?.core) {
          agent.capabilities.memory.core.blocks = parsed as USACoreMemory['blocks'];
        }
      });

      // Restore embeddings config
      restoreMemoryExtension('embeddingsConfig', (parsed) => {
        if (agent.capabilities.memory) {
          agent.capabilities.memory.embeddings = parsed as USAEmbeddings;
        }
      });

      // Restore storage config
      restoreMemoryExtension('storageConfig', (parsed) => {
        if (agent.capabilities.memory) {
          agent.capabilities.memory.storage = parsed as USAStorage;
        }
      });

      // Restore memory operations
      restoreMemoryExtension('memoryOperations', (parsed) => {
        if (agent.capabilities.memory) {
          agent.capabilities.memory.operations = parsed as USAMemoryOperations;
        }
      });
    }

    // ========================================================================
    // Extract Protocols
    // ========================================================================

    const protocolUris = this.extractUris(quads, agentUri, `${CHRYSALIS_NS}supportsProtocol`);
    
    for (const protoUri of protocolUris) {
      const typeUri = this.extractUri(quads, protoUri, `${RDF_NS}type`);
      
      switch (typeUri) {
        case `${CHRYSALIS_NS}MCPBinding`:
          if (!agent.protocols) agent.protocols = {};
          agent.protocols.mcp = { enabled: true };
          
          const mcpConfig = this.extractLiteral(quads, protoUri, `${CHRYSALIS_NS}protocolConfig`);
          if (mcpConfig) {
            try {
              const config = JSON.parse(mcpConfig);
              if (config.role) agent.protocols.mcp.role = config.role;
            } catch {
              // Ignore
            }
          }

          // Restore MCP servers from extensions
          const serversExt = canonical.extensions.find(e =>
            e.namespace === 'usa' && e.property === 'mcpServers'
          );
          if (serversExt) {
            try {
              agent.protocols.mcp.servers = JSON.parse(serversExt.value);
            } catch {
              // Ignore
            }
          }
          break;

        case `${CHRYSALIS_NS}A2ABinding`:
          if (!agent.protocols) agent.protocols = {};
          agent.protocols.a2a = { enabled: true };
          break;

        case `${CHRYSALIS_NS}AgentProtocolBinding`:
          if (!agent.protocols) agent.protocols = {};
          agent.protocols.agent_protocol = { enabled: true };
          
          const endpoint = this.extractLiteral(quads, protoUri, `${CHRYSALIS_NS}endpointUrl`);
          if (endpoint) agent.protocols.agent_protocol.endpoint = endpoint;
          break;
      }
    }

    // ========================================================================
    // Extract LLM Configuration
    // ========================================================================

    const llmUri = this.extractUri(quads, agentUri, `${CHRYSALIS_NS}hasExecutionConfig`);
    if (llmUri) {
      agent.execution.llm.provider = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}llmProvider`) || '';
      agent.execution.llm.model = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}llmModel`) || '';
      
      const temp = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}temperature`);
      if (temp) agent.execution.llm.temperature = parseFloat(temp);

      const maxTokens = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}maxOutputTokens`);
      if (maxTokens) agent.execution.llm.max_tokens = parseInt(maxTokens);

      // Restore LLM parameters from extensions
      const paramsExt = canonical.extensions.find(e =>
        e.namespace === 'usa' && e.property === 'llmParameters'
      );
      if (paramsExt) {
        try {
          agent.execution.llm.parameters = JSON.parse(paramsExt.value);
        } catch {
          // Ignore
        }
      }
    }

    // Restore runtime config from extensions
    const runtimeExt = canonical.extensions.find(e =>
      e.namespace === 'usa' && e.property === 'runtimeConfig'
    );
    if (runtimeExt) {
      try {
        agent.execution.runtime = JSON.parse(runtimeExt.value);
      } catch {
        // Ignore
      }
    }

    // ========================================================================
    // Restore Deployment from Extensions
    // ========================================================================

    const deploymentExt = canonical.extensions.find(e =>
      e.namespace === 'usa' && e.property === 'deploymentConfig'
    );
    if (deploymentExt) {
      try {
        agent.deployment = JSON.parse(deploymentExt.value);
      } catch {
        // Ignore
      }
    }

    // Restore API version from extensions
    const apiVersionExt = canonical.extensions.find(e =>
      e.namespace === 'usa' && e.property === 'apiVersion'
    );
    if (apiVersionExt) {
      agent.apiVersion = apiVersionExt.value;
    }

    return {
      data: agent as unknown as Record<string, unknown>,
      framework: 'usa',
      version: agent.apiVersion,
      source: canonical.uri
    };
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  validateNative(native: NativeAgent): ValidationResult {
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

  getFieldMappings(): FieldMapping[] {
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
