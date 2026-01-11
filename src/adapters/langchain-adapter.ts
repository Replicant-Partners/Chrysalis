/**
 * LangChain Agent Adapter
 * 
 * Bidirectional translation between LangChain agent configurations
 * and the Chrysalis canonical agent ontology.
 * 
 * LangChain agents are characterized by:
 * - Agent type (zero-shot, conversational, structured-chat, openai-functions, etc.)
 * - Tools (functions with schemas)
 * - LLM configurations
 * - Memory systems (buffer, summary, conversation, vector store)
 * - Prompt templates
 * - Output parsers
 * 
 * @see https://js.langchain.com/docs/modules/agents/
 */

import {
  BaseAdapter,
  AdapterConfig,
  NativeAgent,
  CanonicalAgent,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  FieldMapping,
  ExtensionProperty,
  TranslationMetadata,
  AgentFramework
} from './base-adapter';

import {
  Quad,
  DataFactory,
  CHRYSALIS_NS,
  RDF_NS,
  XSD_NS
} from '../rdf/temporal-store';



// ============================================================================
// LangChain Type Definitions
// ============================================================================

/**
 * LangChain agent configuration
 */
export interface LangChainAgent {
  name: string;
  description?: string;
  version?: string;
  
  // Agent type and behavior
  agentType: LangChainAgentType;
  verbose?: boolean;
  maxIterations?: number;
  earlyStoppingMethod?: 'force' | 'generate';
  returnIntermediateSteps?: boolean;
  
  // LLM configuration
  llm: LangChainLLMConfig;
  
  // Tools available to the agent
  tools?: LangChainTool[];
  
  // Memory configuration
  memory?: LangChainMemoryConfig;
  
  // Prompt configuration
  prompt?: LangChainPromptConfig;
  
  // Output parsing
  outputParser?: LangChainOutputParser;
  
  // Callbacks and handlers
  callbacks?: LangChainCallback[];
  
  // Tags and metadata
  tags?: string[];
  metadata?: Record<string, unknown>;
  
  // Extensions for Chrysalis
  'x-chrysalis'?: Record<string, unknown>;
}

/**
 * Supported LangChain agent types
 */
export type LangChainAgentType = 
  | 'zero-shot-react-description'
  | 'react-docstore'
  | 'self-ask-with-search'
  | 'conversational-react-description'
  | 'chat-zero-shot-react-description'
  | 'chat-conversational-react-description'
  | 'structured-chat-zero-shot-react-description'
  | 'openai-functions'
  | 'openai-tools'
  | 'xml'
  | 'plan-and-execute'
  | 'custom';

/**
 * LLM configuration for LangChain
 */
export interface LangChainLLMConfig {
  type: string; // 'openai', 'anthropic', 'bedrock', 'azure-openai', etc.
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  streaming?: boolean;
  timeout?: number;
  apiKey?: string; // Usually from environment
  baseUrl?: string;
  // Model-specific options
  modelKwargs?: Record<string, unknown>;
}

/**
 * Tool definition for LangChain
 */
export interface LangChainTool {
  name: string;
  description: string;
  // Function schema (Zod-like or JSON Schema)
  schema?: LangChainToolSchema;
  // For structured tools
  func?: string; // Function name reference
  // Return behavior
  returnDirect?: boolean;
  // Verbose output
  verbose?: boolean;
  // Tags
  tags?: string[];
  // Custom metadata
  metadata?: Record<string, unknown>;
}

/**
 * Tool schema (JSON Schema format)
 */
export interface LangChainToolSchema {
  type: 'object';
  properties: Record<string, LangChainSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Schema property definition
 */
export interface LangChainSchemaProperty {
  type: string;
  description?: string;
  enum?: unknown[];
  items?: LangChainSchemaProperty;
  properties?: Record<string, LangChainSchemaProperty>;
  required?: string[];
  default?: unknown;
}

/**
 * Memory configuration
 */
export interface LangChainMemoryConfig {
  type: LangChainMemoryType;
  // Common options
  returnMessages?: boolean;
  inputKey?: string;
  outputKey?: string;
  humanPrefix?: string;
  aiPrefix?: string;
  memoryKey?: string;
  
  // Buffer memory specific
  k?: number; // For BufferWindowMemory
  
  // Summary memory specific
  llm?: LangChainLLMConfig; // For summarization
  maxTokenLimit?: number;
  
  // Vector store memory specific
  vectorStore?: LangChainVectorStoreConfig;
  searchKwargs?: Record<string, unknown>;
  
  // Entity memory specific
  entityStore?: string;
  
  // Conversation knowledge graph
  kg?: LangChainKGConfig;
}

/**
 * Memory types supported by LangChain
 */
export type LangChainMemoryType =
  | 'buffer'
  | 'buffer-window'
  | 'summary'
  | 'summary-buffer'
  | 'conversation-token-buffer'
  | 'vector-store'
  | 'entity'
  | 'conversation-knowledge-graph'
  | 'combined';

/**
 * Vector store configuration
 */
export interface LangChainVectorStoreConfig {
  type: string; // 'chroma', 'pinecone', 'weaviate', 'faiss', etc.
  collectionName?: string;
  embeddingModel?: string;
  connectionString?: string;
  // Store-specific options
  options?: Record<string, unknown>;
}

/**
 * Knowledge graph configuration
 */
export interface LangChainKGConfig {
  type: string;
  options?: Record<string, unknown>;
}

/**
 * Prompt configuration
 */
export interface LangChainPromptConfig {
  type: 'chat' | 'few-shot' | 'few-shot-chat' | 'string';
  template?: string;
  inputVariables?: string[];
  partialVariables?: Record<string, string>;
  // For chat prompts
  systemMessage?: string;
  humanMessageTemplate?: string;
  aiMessageTemplate?: string;
  // For few-shot
  examples?: LangChainExample[];
  exampleSelector?: LangChainExampleSelector;
  examplePrompt?: LangChainPromptConfig;
  prefix?: string;
  suffix?: string;
}

/**
 * Example for few-shot prompts
 */
export interface LangChainExample {
  input: string;
  output: string;
  [key: string]: string;
}

/**
 * Example selector configuration
 */
export interface LangChainExampleSelector {
  type: 'length' | 'similarity' | 'maximal-marginal-relevance';
  k?: number;
  maxLength?: number;
  vectorStore?: LangChainVectorStoreConfig;
}

/**
 * Output parser configuration
 */
export interface LangChainOutputParser {
  type: string; // 'json', 'list', 'datetime', 'enum', 'pydantic', 'structured', etc.
  schema?: Record<string, unknown>;
  // For structured output
  responseSchemas?: LangChainResponseSchema[];
}

/**
 * Response schema for structured output
 */
export interface LangChainResponseSchema {
  name: string;
  description: string;
  type?: string;
}

/**
 * Callback configuration
 */
export interface LangChainCallback {
  type: string; // 'stdout', 'langsmith', 'wandb', 'custom', etc.
  options?: Record<string, unknown>;
}

// ============================================================================
// LangChain Adapter Configuration
// ============================================================================

export interface LangChainAdapterConfig extends AdapterConfig {
  /** Default agent type if not specified */
  defaultAgentType?: LangChainAgentType;
  /** Include verbose logging config in canonical */
  includeCallbacks?: boolean;
  /** Validate tool schemas */
  validateSchemas?: boolean;
}

// ============================================================================
// LangChain Namespaces
// ============================================================================

const LANGCHAIN_NS = 'https://langchain.com/ns#';

// ============================================================================
// LangChain Adapter Implementation
// ============================================================================

export class LangChainAdapter extends BaseAdapter {
  readonly framework = 'langchain';
  readonly name = 'LangChain Agent Adapter';
  readonly version = '1.0.0';
  readonly extensionNamespace = LANGCHAIN_NS;

  private lcConfig: LangChainAdapterConfig;

  constructor(config: LangChainAdapterConfig = {}) {
    super(config);
    this.lcConfig = {
      defaultAgentType: 'zero-shot-react-description',
      includeCallbacks: false,
      validateSchemas: true,
      ...config
    };
  }

  // --------------------------------------------------------------------------
  // Field Mappings
  // --------------------------------------------------------------------------

  getFieldMappings(): FieldMapping[] {
    return [
      // Core identity
      {
        sourcePath: 'name',
        predicate: `${CHRYSALIS_NS}name`,
        datatype: 'string',
        required: true
      },
      {
        sourcePath: 'description',
        predicate: `${CHRYSALIS_NS}description`,
        datatype: 'string',
        required: false
      },
      {
        sourcePath: 'version',
        predicate: `${CHRYSALIS_NS}version`,
        datatype: 'string',
        required: false
      },

      // Agent configuration
      {
        sourcePath: 'agentType',
        predicate: `${LANGCHAIN_NS}agentType`,
        datatype: 'string',
        required: true
      },
      {
        sourcePath: 'maxIterations',
        predicate: `${LANGCHAIN_NS}maxIterations`,
        datatype: 'integer',
        required: false
      },

      // LLM configuration
      {
        sourcePath: 'llm.type',
        predicate: `${CHRYSALIS_NS}llmProvider`,
        datatype: 'string',
        required: true
      },
      {
        sourcePath: 'llm.model',
        predicate: `${CHRYSALIS_NS}llmModel`,
        datatype: 'string',
        required: true
      },
      {
        sourcePath: 'llm.temperature',
        predicate: `${CHRYSALIS_NS}llmTemperature`,
        datatype: 'integer',
        required: false
      },
      {
        sourcePath: 'llm.maxTokens',
        predicate: `${CHRYSALIS_NS}llmMaxTokens`,
        datatype: 'integer',
        required: false
      },

      // Memory type
      {
        sourcePath: 'memory.type',
        predicate: `${CHRYSALIS_NS}memoryType`,
        datatype: 'string',
        required: false
      }
    ];
  }

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------

  validateNative(agent: NativeAgent): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const data = agent.data as unknown as LangChainAgent;

    // Required: name
    if (!data.name) {
      errors.push({
        code: 'MISSING_NAME',
        message: 'LangChain agent must have a name',
        path: 'name',
      });
    }

    // Required: agentType
    if (!data.agentType) {
      errors.push({
        code: 'MISSING_AGENT_TYPE',
        message: 'LangChain agent must have an agentType',
        path: 'agentType',
      });
    } else {
      const validTypes: LangChainAgentType[] = [
        'zero-shot-react-description',
        'react-docstore',
        'self-ask-with-search',
        'conversational-react-description',
        'chat-zero-shot-react-description',
        'chat-conversational-react-description',
        'structured-chat-zero-shot-react-description',
        'openai-functions',
        'openai-tools',
        'xml',
        'plan-and-execute',
        'custom'
      ];
      if (!validTypes.includes(data.agentType)) {
        warnings.push({
          code: 'UNKNOWN_AGENT_TYPE',
          message: `Unknown agent type: ${data.agentType}`,
          path: 'agentType',
        });
      }
    }

    // Required: llm
    if (!data.llm) {
      errors.push({
        code: 'MISSING_LLM',
        message: 'LangChain agent must have LLM configuration',
        path: 'llm',
      });
    } else {
      if (!data.llm.type) {
        errors.push({
          code: 'MISSING_LLM_TYPE',
          message: 'LLM configuration must have a type',
          path: 'llm.type',
        });
      }
      if (!data.llm.model) {
        errors.push({
          code: 'MISSING_LLM_MODEL',
          message: 'LLM configuration must have a model',
          path: 'llm.model',
        });
      }
    }

    // Validate tools if present
    if (data.tools) {
      data.tools.forEach((tool, idx) => {
        if (!tool.name) {
          errors.push({
            code: 'TOOL_MISSING_NAME',
            message: `Tool at index ${idx} must have a name`,
            path: `tools[${idx}].name`,
          });
        }
        if (!tool.description) {
          warnings.push({
            code: 'TOOL_MISSING_DESCRIPTION',
            message: `Tool '${tool.name}' has no description`,
            path: `tools[${idx}].description`,
          });
        }
      });
    } else {
      warnings.push({
        code: 'NO_TOOLS',
        message: 'Agent has no tools configured',
        path: 'tools',
      });
    }

    // Warn if no memory
    if (!data.memory) {
      warnings.push({
        code: 'NO_MEMORY',
        message: 'Agent has no memory configuration',
        path: 'memory',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // --------------------------------------------------------------------------
  // Forward Translation (LangChain → Canonical)
  // --------------------------------------------------------------------------

  async toCanonical(native: NativeAgent): Promise<CanonicalAgent> {
    const validation = this.validateNative(native);
    if (!validation.valid && this.config.strict) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const data = native.data as unknown as LangChainAgent;
    const agentUri = this.generateAgentUri(data.name);
    const quads: Quad[] = [];
    const extensions: ExtensionProperty[] = [];

    // Type declarations
    quads.push(DataFactory.quad(
      DataFactory.namedNode(agentUri),
      DataFactory.namedNode(`${RDF_NS}type`),
      DataFactory.namedNode(`${CHRYSALIS_NS}Agent`)
    ));

    quads.push(DataFactory.quad(
      DataFactory.namedNode(agentUri),
      DataFactory.namedNode(`${RDF_NS}type`),
      DataFactory.namedNode(`${LANGCHAIN_NS}Agent`)
    ));

    // Core properties
    quads.push(DataFactory.quad(
      DataFactory.namedNode(agentUri),
      DataFactory.namedNode(`${CHRYSALIS_NS}name`),
      DataFactory.literal(data.name)
    ));

    if (data.description) {
      quads.push(DataFactory.quad(
        DataFactory.namedNode(agentUri),
        DataFactory.namedNode(`${CHRYSALIS_NS}description`),
        DataFactory.literal(data.description)
      ));
    }

    if (data.version) {
      quads.push(DataFactory.quad(
        DataFactory.namedNode(agentUri),
        DataFactory.namedNode(`${CHRYSALIS_NS}version`),
        DataFactory.literal(data.version)
      ));
    }

    // Agent type
    quads.push(DataFactory.quad(
      DataFactory.namedNode(agentUri),
      DataFactory.namedNode(`${LANGCHAIN_NS}agentType`),
      DataFactory.literal(data.agentType)
    ));

    // Agent behavior settings
    if (data.maxIterations !== undefined) {
      quads.push(DataFactory.quad(
        DataFactory.namedNode(agentUri),
        DataFactory.namedNode(`${LANGCHAIN_NS}maxIterations`),
        DataFactory.literal(String(data.maxIterations), DataFactory.namedNode(`${XSD_NS}integer`))
      ));
    }

    if (data.verbose !== undefined) {
      quads.push(DataFactory.quad(
        DataFactory.namedNode(agentUri),
        DataFactory.namedNode(`${LANGCHAIN_NS}verbose`),
        DataFactory.literal(String(data.verbose), DataFactory.namedNode(`${XSD_NS}boolean`))
      ));
    }

    if (data.earlyStoppingMethod) {
      quads.push(DataFactory.quad(
        DataFactory.namedNode(agentUri),
        DataFactory.namedNode(`${LANGCHAIN_NS}earlyStoppingMethod`),
        DataFactory.literal(data.earlyStoppingMethod)
      ));
    }

    // LLM Configuration
    const llmUri = `${agentUri}/llm`;
    quads.push(DataFactory.quad(
      DataFactory.namedNode(agentUri),
      DataFactory.namedNode(`${CHRYSALIS_NS}hasLLMConfig`),
      DataFactory.namedNode(llmUri)
    ));

    quads.push(DataFactory.quad(
      DataFactory.namedNode(llmUri),
      DataFactory.namedNode(`${RDF_NS}type`),
      DataFactory.namedNode(`${CHRYSALIS_NS}LLMConfig`)
    ));

    quads.push(DataFactory.quad(
      DataFactory.namedNode(llmUri),
      DataFactory.namedNode(`${CHRYSALIS_NS}llmProvider`),
      DataFactory.literal(data.llm.type)
    ));

    quads.push(DataFactory.quad(
      DataFactory.namedNode(llmUri),
      DataFactory.namedNode(`${CHRYSALIS_NS}llmModel`),
      DataFactory.literal(data.llm.model)
    ));

    if (data.llm.temperature !== undefined) {
      quads.push(DataFactory.quad(
        DataFactory.namedNode(llmUri),
        DataFactory.namedNode(`${CHRYSALIS_NS}llmTemperature`),
        DataFactory.literal(String(data.llm.temperature), DataFactory.namedNode(`${XSD_NS}decimal`))
      ));
    }

    if (data.llm.maxTokens !== undefined) {
      quads.push(DataFactory.quad(
        DataFactory.namedNode(llmUri),
        DataFactory.namedNode(`${CHRYSALIS_NS}llmMaxTokens`),
        DataFactory.literal(String(data.llm.maxTokens), DataFactory.namedNode(`${XSD_NS}integer`))
      ));
    }

    if (data.llm.streaming !== undefined) {
      quads.push(DataFactory.quad(
        DataFactory.namedNode(llmUri),
        DataFactory.namedNode(`${LANGCHAIN_NS}streaming`),
        DataFactory.literal(String(data.llm.streaming), DataFactory.namedNode(`${XSD_NS}boolean`))
      ));
    }

    // Store additional LLM options as extension
    if (data.llm.modelKwargs) {
      extensions.push({
        namespace: 'langchain',
        property: 'llm.modelKwargs',
        value: JSON.stringify(data.llm.modelKwargs),
        sourcePath: 'llm.modelKwargs'
      });
    }

    // Tools
    if (data.tools) {
      for (const tool of data.tools) {
        const toolUri = `${agentUri}/tool/${this.slugify(tool.name)}`;

        quads.push(DataFactory.quad(
          DataFactory.namedNode(agentUri),
          DataFactory.namedNode(`${CHRYSALIS_NS}hasTool`),
          DataFactory.namedNode(toolUri)
        ));

        quads.push(DataFactory.quad(
          DataFactory.namedNode(toolUri),
          DataFactory.namedNode(`${RDF_NS}type`),
          DataFactory.namedNode(`${CHRYSALIS_NS}Tool`)
        ));

        quads.push(DataFactory.quad(
          DataFactory.namedNode(toolUri),
          DataFactory.namedNode(`${CHRYSALIS_NS}toolName`),
          DataFactory.literal(tool.name)
        ));

        if (tool.description) {
          quads.push(DataFactory.quad(
            DataFactory.namedNode(toolUri),
            DataFactory.namedNode(`${CHRYSALIS_NS}description`),
            DataFactory.literal(tool.description)
          ));
        }

        quads.push(DataFactory.quad(
          DataFactory.namedNode(toolUri),
          DataFactory.namedNode(`${CHRYSALIS_NS}toolProtocol`),
          DataFactory.literal('langchain')
        ));

        if (tool.returnDirect !== undefined) {
          quads.push(DataFactory.quad(
            DataFactory.namedNode(toolUri),
            DataFactory.namedNode(`${LANGCHAIN_NS}returnDirect`),
            DataFactory.literal(String(tool.returnDirect), DataFactory.namedNode(`${XSD_NS}boolean`))
          ));
        }

        // Store schema as extension
        if (tool.schema) {
          extensions.push({
            namespace: 'langchain',
            property: `tool.${tool.name}.schema`,
            value: JSON.stringify(tool.schema),
            sourcePath: 'source'
          });
        }

        // Store metadata
        if (tool.metadata) {
          extensions.push({
            namespace: 'langchain',
            property: `tool.${tool.name}.metadata`,
            value: JSON.stringify(tool.metadata),
            sourcePath: 'source'
          });
        }
      }
    }

    // Memory configuration
    if (data.memory) {
      const memoryUri = `${agentUri}/memory`;

      quads.push(DataFactory.quad(
        DataFactory.namedNode(agentUri),
        DataFactory.namedNode(`${CHRYSALIS_NS}hasMemory`),
        DataFactory.namedNode(memoryUri)
      ));

      quads.push(DataFactory.quad(
        DataFactory.namedNode(memoryUri),
        DataFactory.namedNode(`${RDF_NS}type`),
        DataFactory.namedNode(`${CHRYSALIS_NS}MemoryConfig`)
      ));

      quads.push(DataFactory.quad(
        DataFactory.namedNode(memoryUri),
        DataFactory.namedNode(`${CHRYSALIS_NS}memoryType`),
        DataFactory.literal(data.memory.type)
      ));

      // Map LangChain memory type to Chrysalis memory architecture
      const architectureMap: Record<LangChainMemoryType, string> = {
        'buffer': 'simple',
        'buffer-window': 'simple',
        'summary': 'summary',
        'summary-buffer': 'summary',
        'conversation-token-buffer': 'hierarchical',
        'vector-store': 'semantic',
        'entity': 'episodic',
        'conversation-knowledge-graph': 'hierarchical',
        'combined': 'hierarchical'
      };

      quads.push(DataFactory.quad(
        DataFactory.namedNode(memoryUri),
        DataFactory.namedNode(`${CHRYSALIS_NS}memoryArchitecture`),
        DataFactory.literal(architectureMap[data.memory.type] || 'simple')
      ));

      if (data.memory.k !== undefined) {
        quads.push(DataFactory.quad(
          DataFactory.namedNode(memoryUri),
          DataFactory.namedNode(`${LANGCHAIN_NS}bufferSize`),
          DataFactory.literal(String(data.memory.k), DataFactory.namedNode(`${XSD_NS}integer`))
        ));
      }

      if (data.memory.memoryKey) {
        quads.push(DataFactory.quad(
          DataFactory.namedNode(memoryUri),
          DataFactory.namedNode(`${LANGCHAIN_NS}memoryKey`),
          DataFactory.literal(data.memory.memoryKey)
        ));
      }

      // Store vector store config as extension
      if (data.memory.vectorStore) {
        extensions.push({
          namespace: 'langchain',
          property: 'memory.vectorStore',
          value: JSON.stringify(data.memory.vectorStore),
          sourcePath: 'source'
        });
      }

      // Store full memory config for lossless round-trip
      extensions.push({
        namespace: 'langchain',
        property: 'memory.full',
        value: JSON.stringify(data.memory),
        sourcePath: 'source'
      });
    }

    // Prompt configuration
    if (data.prompt) {
      const promptUri = `${agentUri}/prompt`;

      quads.push(DataFactory.quad(
        DataFactory.namedNode(agentUri),
        DataFactory.namedNode(`${LANGCHAIN_NS}hasPrompt`),
        DataFactory.namedNode(promptUri)
      ));

      quads.push(DataFactory.quad(
        DataFactory.namedNode(promptUri),
        DataFactory.namedNode(`${RDF_NS}type`),
        DataFactory.namedNode(`${LANGCHAIN_NS}PromptConfig`)
      ));

      quads.push(DataFactory.quad(
        DataFactory.namedNode(promptUri),
        DataFactory.namedNode(`${LANGCHAIN_NS}promptType`),
        DataFactory.literal(data.prompt.type)
      ));

      if (data.prompt.systemMessage) {
        quads.push(DataFactory.quad(
          DataFactory.namedNode(promptUri),
          DataFactory.namedNode(`${LANGCHAIN_NS}systemMessage`),
          DataFactory.literal(data.prompt.systemMessage)
        ));
      }

      // Store full prompt config
      extensions.push({
        namespace: 'langchain',
        property: 'prompt.full',
        value: JSON.stringify(data.prompt),
        sourcePath: 'source'
      });
    }

    // Output parser
    if (data.outputParser) {
      extensions.push({
        namespace: 'langchain',
        property: 'outputParser',
        value: JSON.stringify(data.outputParser),
        sourcePath: 'source'
      });
    }

    // Callbacks
    if (data.callbacks && this.lcConfig.includeCallbacks) {
      extensions.push({
        namespace: 'langchain',
        property: 'callbacks',
        value: JSON.stringify(data.callbacks),
        sourcePath: 'source'
      });
    }

    // Tags
    if (data.tags) {
      for (const tag of data.tags) {
        quads.push(DataFactory.quad(
          DataFactory.namedNode(agentUri),
          DataFactory.namedNode(`${CHRYSALIS_NS}tag`),
          DataFactory.literal(tag)
        ));
      }
    }

    // Metadata
    if (data.metadata) {
      extensions.push({
        namespace: 'langchain',
        property: 'metadata',
        value: JSON.stringify(data.metadata),
        sourcePath: 'source'
      });
    }

    // Chrysalis extensions
    if (data['x-chrysalis']) {
      extensions.push({
        namespace: 'chrysalis',
        property: 'extensions',
        value: JSON.stringify(data['x-chrysalis']),
        sourcePath: 'source'
      });
    }

    // Build mapped and unmapped field lists
    const mappedFields: string[] = [];
    const unmappedFields: string[] = [];
    const lostFields: string[] = [];

    // Core fields that were mapped
    if (data.name) mappedFields.push('name');
    if (data.description) mappedFields.push('description');
    if (data.version) mappedFields.push('version');
    if (data.agentType) mappedFields.push('agentType');
    if (data.llm) {
      mappedFields.push('llm.type', 'llm.model');
      if (data.llm.temperature !== undefined) mappedFields.push('llm.temperature');
      if (data.llm.maxTokens !== undefined) mappedFields.push('llm.maxTokens');
    }
    if (data.tools) mappedFields.push('tools');
    if (data.memory) mappedFields.push('memory');

    // Calculate fidelity using base class method
    const fidelityScore = this.calculateFidelity(
      mappedFields,
      unmappedFields,
      lostFields,
      mappedFields.length + unmappedFields.length + lostFields.length
    );

    // Build metadata using the correct interface structure
    const metadata = this.createMetadata(
      fidelityScore,
      mappedFields,
      unmappedFields,
      lostFields,
      validation.warnings.map(w => ({
        severity: 'warning' as const,
        code: w.code,
        message: w.message,
        sourcePath: w.path
      }))
    );

    return {
      uri: agentUri,
      sourceFramework: 'langchain' as AgentFramework,
      quads,
      extensions,
      metadata
    };
  }

  // --------------------------------------------------------------------------
  // Reverse Translation (Canonical → LangChain)
  // --------------------------------------------------------------------------

  async fromCanonical(canonical: CanonicalAgent): Promise<NativeAgent> {
    const agent: LangChainAgent = {
      name: '',
      agentType: this.lcConfig.defaultAgentType || 'zero-shot-react-description',
      llm: {
        type: 'openai',
        model: 'gpt-4'
      }
    };

    // Extract core properties
    for (const quad of canonical.quads) {
      const subject = quad.subject.value;
      const predicate = quad.predicate.value;
      const object = quad.object.value;

      if (subject === canonical.uri) {
        if (predicate === `${CHRYSALIS_NS}name`) {
          agent.name = object;
        } else if (predicate === `${CHRYSALIS_NS}description`) {
          agent.description = object;
        } else if (predicate === `${CHRYSALIS_NS}version`) {
          agent.version = object;
        } else if (predicate === `${LANGCHAIN_NS}agentType`) {
          agent.agentType = object as LangChainAgentType;
        } else if (predicate === `${LANGCHAIN_NS}maxIterations`) {
          agent.maxIterations = parseInt(object, 10);
        } else if (predicate === `${LANGCHAIN_NS}verbose`) {
          agent.verbose = object === 'true';
        } else if (predicate === `${LANGCHAIN_NS}earlyStoppingMethod`) {
          agent.earlyStoppingMethod = object as 'force' | 'generate';
        } else if (predicate === `${CHRYSALIS_NS}tag`) {
          if (!agent.tags) agent.tags = [];
          agent.tags.push(object);
        }
      }
    }

    // Extract LLM configuration
    const llmTriple = canonical.quads.find(q =>
      q.subject.value === canonical.uri &&
      q.predicate.value === `${CHRYSALIS_NS}hasLLMConfig`
    );

    if (llmTriple) {
      const llmUri = llmTriple.object.value;

      for (const quad of canonical.quads) {
        if (quad.subject.value === llmUri) {
          const predicate = quad.predicate.value;
          const value = quad.object.value;

          if (predicate === `${CHRYSALIS_NS}llmProvider`) {
            agent.llm.type = value;
          } else if (predicate === `${CHRYSALIS_NS}llmModel`) {
            agent.llm.model = value;
          } else if (predicate === `${CHRYSALIS_NS}llmTemperature`) {
            agent.llm.temperature = parseFloat(value);
          } else if (predicate === `${CHRYSALIS_NS}llmMaxTokens`) {
            agent.llm.maxTokens = parseInt(value, 10);
          } else if (predicate === `${LANGCHAIN_NS}streaming`) {
            agent.llm.streaming = value === 'true';
          }
        }
      }
    }

    // Restore LLM modelKwargs from extensions
    const modelKwargsExt = canonical.extensions.find(e => e.property === 'llm.modelKwargs');
    if (modelKwargsExt) {
      agent.llm.modelKwargs = JSON.parse(modelKwargsExt.value) as Record<string, unknown>;
    }

    // Extract tools
    const toolTriples = canonical.quads.filter(q =>
      q.subject.value === canonical.uri &&
      q.predicate.value === `${CHRYSALIS_NS}hasTool`
    );

    if (toolTriples.length > 0) {
      agent.tools = [];

      for (const toolTriple of toolTriples) {
        const toolUri = toolTriple.object.value;
        const tool: LangChainTool = {
          name: '',
          description: ''
        };

        for (const quad of canonical.quads) {
          if (quad.subject.value === toolUri) {
            const predicate = quad.predicate.value;
            const value = quad.object.value;

            if (predicate === `${CHRYSALIS_NS}toolName`) {
              tool.name = value;
            } else if (predicate === `${CHRYSALIS_NS}description`) {
              tool.description = value;
            } else if (predicate === `${LANGCHAIN_NS}returnDirect`) {
              tool.returnDirect = value === 'true';
            }
          }
        }

        // Restore schema from extensions
        const schemaExt = canonical.extensions.find(e => e.property === `tool.${tool.name}.schema`);
        if (schemaExt) {
          tool.schema = JSON.parse(schemaExt.value) as LangChainToolSchema;
        }

        // Restore metadata from extensions
        const metaExt = canonical.extensions.find(e => e.property === `tool.${tool.name}.metadata`);
        if (metaExt) {
          tool.metadata = JSON.parse(metaExt.value) as Record<string, unknown>;
        }

        if (tool.name) {
          agent.tools.push(tool);
        }
      }
    }

    // Extract memory configuration
    const memoryTriple = canonical.quads.find(q =>
      q.subject.value === canonical.uri &&
      q.predicate.value === `${CHRYSALIS_NS}hasMemory`
    );

    if (memoryTriple) {
      // Try to restore full memory config from extensions first
      const fullMemoryExt = canonical.extensions.find(e => e.property === 'memory.full');
      if (fullMemoryExt) {
        agent.memory = JSON.parse(fullMemoryExt.value) as LangChainMemoryConfig;
      } else {
        // Reconstruct from quads
        const memoryUri = memoryTriple.object.value;
        const memory: LangChainMemoryConfig = {
          type: 'buffer'
        };

        for (const quad of canonical.quads) {
          if (quad.subject.value === memoryUri) {
            const predicate = quad.predicate.value;
            const value = quad.object.value;

            if (predicate === `${CHRYSALIS_NS}memoryType`) {
              memory.type = value as LangChainMemoryType;
            } else if (predicate === `${LANGCHAIN_NS}bufferSize`) {
              memory.k = parseInt(value, 10);
            } else if (predicate === `${LANGCHAIN_NS}memoryKey`) {
              memory.memoryKey = value;
            }
          }
        }

        // Restore vector store from extensions
        const vectorStoreExt = canonical.extensions.find(e => e.property === 'memory.vectorStore');
        if (vectorStoreExt) {
          memory.vectorStore = JSON.parse(vectorStoreExt.value) as LangChainVectorStoreConfig;
        }

        agent.memory = memory;
      }
    }

    // Restore prompt configuration
    const fullPromptExt = canonical.extensions.find(e => e.property === 'prompt.full');
    if (fullPromptExt) {
      agent.prompt = JSON.parse(fullPromptExt.value) as LangChainPromptConfig;
    } else {
      // Try to reconstruct from quads
      const promptTriple = canonical.quads.find(q =>
        q.subject.value === canonical.uri &&
        q.predicate.value === `${LANGCHAIN_NS}hasPrompt`
      );

      if (promptTriple) {
        const promptUri = promptTriple.object.value;
        const prompt: LangChainPromptConfig = {
          type: 'chat'
        };

        for (const quad of canonical.quads) {
          if (quad.subject.value === promptUri) {
            const predicate = quad.predicate.value;
            const value = quad.object.value;

            if (predicate === `${LANGCHAIN_NS}promptType`) {
              prompt.type = value as LangChainPromptConfig['type'];
            } else if (predicate === `${LANGCHAIN_NS}systemMessage`) {
              prompt.systemMessage = value;
            }
          }
        }

        agent.prompt = prompt;
      }
    }

    // Restore output parser from extensions
    const outputParserExt = canonical.extensions.find(e => e.property === 'outputParser');
    if (outputParserExt) {
      agent.outputParser = JSON.parse(outputParserExt.value) as LangChainOutputParser;
    }

    // Restore callbacks from extensions
    const callbacksExt = canonical.extensions.find(e => e.property === 'callbacks');
    if (callbacksExt) {
      agent.callbacks = JSON.parse(callbacksExt.value) as LangChainCallback[];
    }

    // Restore metadata from extensions
    const metadataExt = canonical.extensions.find(e => 
      e.namespace === 'langchain' && e.property === 'metadata'
    );
    if (metadataExt) {
      agent.metadata = JSON.parse(metadataExt.value) as Record<string, unknown>;
    }

    // Restore Chrysalis extensions
    const chrysalisExt = canonical.extensions.find(e =>
      e.namespace === 'chrysalis' && e.property === 'extensions'
    );
    if (chrysalisExt) {
      agent['x-chrysalis'] = JSON.parse(chrysalisExt.value) as Record<string, unknown>;
    }

    return {
      data: agent as unknown as Record<string, unknown>,
      framework: 'langchain' as AgentFramework
    };
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  protected override generateAgentUri(name: string): string {
    const slug = this.slugify(name);
    return `${CHRYSALIS_NS}agent/langchain/${slug}`;
  }

  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLangChainAdapter(config?: LangChainAdapterConfig): LangChainAdapter {
  return new LangChainAdapter(config);
}
