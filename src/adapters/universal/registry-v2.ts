/**
 * Universal Adapter Protocol Registry v2.0
 * 
 * CORRECTED and ENHANCED registry with verified specification URLs.
 * Last verified: January 2026
 * 
 * Each protocol entry includes:
 * - Verified specUrl pointing to actual JSON Schema or spec documentation
 * - fallbackSchema for offline/network-failure scenarios
 * - Version tracking for compatibility
 * - Protocol-specific semantic hints for LLM translation
 * 
 * @module adapters/universal/registry-v2
 * @version 2.0.0
 */

// ============================================================================
// Protocol Entry Type
// ============================================================================

export interface ProtocolEntryV2 {
  /** Human-readable protocol name */
  name: string;
  
  /** Primary specification URL (JSON Schema, OpenAPI, or documentation) */
  specUrl: string;
  
  /** Alternative spec URLs (fallbacks) */
  altSpecUrls?: string[];
  
  /** Human-readable documentation URL */
  docsUrl: string;
  
  /** GitHub repository URL (for raw schema access) */
  repoUrl?: string;
  
  /** Current specification version */
  specVersion: string;
  
  /** Last verified date (ISO format) */
  lastVerified: string;
  
  /** Trust level */
  trustLevel: 'internal' | 'verified' | 'experimental' | 'community';
  
  /** Cache TTL in seconds */
  cacheTtl: number;
  
  /** Protocol-specific semantic hints for LLM translation */
  semanticHints: SemanticHints;
  
  /** Minimal fallback schema for offline operation */
  fallbackSchema?: MinimalSchema;
}

export interface SemanticHints {
  /** Primary field for agent identity/name */
  identityField: string;
  
  /** Field containing agent capabilities/tools */
  capabilitiesField: string;
  
  /** Field for agent description/backstory */
  descriptionField: string;
  
  /** Field for communication/system prompt */
  promptField?: string;
  
  /** Extension/metadata field for unmappable data */
  extensionField: string;
  
  /** Key semantic mappings specific to this protocol */
  fieldMappings: Record<string, string[]>;
  
  /** Protocol-specific notes for the LLM */
  notes: string;
}

export interface MinimalSchema {
  /** JSON Schema type */
  type: 'object';
  
  /** Required fields */
  required: string[];
  
  /** Field descriptions */
  properties: Record<string, { type: string; description: string }>;
}

// ============================================================================
// Verified Protocol Registry
// ============================================================================

export const PROTOCOL_REGISTRY_V2: Record<string, ProtocolEntryV2> = {
  // =========================================================================
  // CHRYSALIS NATIVE FORMAT (Internal)
  // =========================================================================
  usa: {
    name: 'Uniform Semantic Agent (Chrysalis)',
    specUrl: 'internal://chrysalis/usa/v2.0',
    docsUrl: 'https://github.com/Replicant-Partners/Chrysalis/blob/main/docs/specs/USA_V2_SPEC.md',
    specVersion: '2.0.0',
    lastVerified: '2026-01-12',
    trustLevel: 'internal',
    cacheTtl: Infinity,
    semanticHints: {
      identityField: 'metadata.name',
      capabilitiesField: 'capabilities.tools',
      descriptionField: 'identity.backstory',
      promptField: 'identity.role',
      extensionField: '_extensions',
      fieldMappings: {
        'name': ['metadata.name', 'identity.name'],
        'tools': ['capabilities.tools'],
        'memory': ['capabilities.memory'],
        'description': ['identity.backstory', 'metadata.description'],
        'instructions': ['identity.role', 'identity.goal']
      },
      notes: 'Chrysalis native format. Hierarchical structure with metadata, identity, capabilities, protocols, execution, deployment sections.'
    },
    fallbackSchema: {
      type: 'object',
      required: ['apiVersion', 'kind', 'metadata', 'identity', 'capabilities'],
      properties: {
        apiVersion: { type: 'string', description: 'API version (usa/v2)' },
        kind: { type: 'string', description: 'Resource kind (Agent)' },
        metadata: { type: 'object', description: 'Agent metadata with name, version, tags' },
        identity: { type: 'object', description: 'Agent identity with role, goal, backstory' },
        capabilities: { type: 'object', description: 'Tools, skills, reasoning, memory' },
        protocols: { type: 'object', description: 'MCP, A2A, ANP protocol configs' },
        execution: { type: 'object', description: 'LLM and runtime configuration' },
        deployment: { type: 'object', description: 'Deployment context and environment' }
      }
    }
  },

  // =========================================================================
  // ANTHROPIC MODEL CONTEXT PROTOCOL (MCP)
  // =========================================================================
  mcp: {
    name: 'Model Context Protocol',
    specUrl: 'https://modelcontextprotocol.io/specification/2025-11-25/schema',
    altSpecUrls: [
      'https://modelcontextprotocol.io/specification/2025-06-18/schema',
      'https://raw.githubusercontent.com/modelcontextprotocol/specification/main/schema/schema.json'
    ],
    docsUrl: 'https://spec.modelcontextprotocol.io/',
    repoUrl: 'https://github.com/modelcontextprotocol/specification',
    specVersion: '2025-11-25',
    lastVerified: '2026-01-12',
    trustLevel: 'verified',
    cacheTtl: 86400, // 24 hours
    semanticHints: {
      identityField: 'name',
      capabilitiesField: 'tools',
      descriptionField: 'description',
      promptField: 'instructions',
      extensionField: '_meta',
      fieldMappings: {
        'tools': ['tools', 'capabilities'],
        'resources': ['resources'],
        'prompts': ['prompts'],
        'name': ['name', 'serverInfo.name'],
        'version': ['version', 'serverInfo.version']
      },
      notes: 'MCP uses JSON-RPC 2.0. Key types: Tool (with inputSchema), Resource (with uri), Prompt. Server declares capabilities during initialize handshake. Tools have name, description, inputSchema (JSON Schema). Latest spec (2025-11-25) adds async Tasks, Elicitation, Structured Tool Output.'
    },
    fallbackSchema: {
      type: 'object',
      required: ['protocolVersion'],
      properties: {
        protocolVersion: { type: 'string', description: 'MCP protocol version' },
        capabilities: { type: 'object', description: 'Server capabilities (tools, resources, prompts)' },
        serverInfo: { type: 'object', description: 'Server name and version' },
        tools: { type: 'array', description: 'Available tools with name, description, inputSchema' },
        resources: { type: 'array', description: 'Available resources with uri, name, mimeType' },
        prompts: { type: 'array', description: 'Available prompts with name, arguments' }
      }
    }
  },

  // =========================================================================
  // GOOGLE AGENT-TO-AGENT PROTOCOL (A2A)
  // =========================================================================
  a2a: {
    name: 'Agent-to-Agent Protocol',
    specUrl: 'https://google.github.io/A2A/specification/',
    altSpecUrls: [
      'https://a2a-protocol.org/latest/specification/',
      'https://a2a.plus/docs/json-specification'
    ],
    docsUrl: 'https://google.github.io/A2A/',
    repoUrl: 'https://github.com/google/A2A',
    specVersion: '1.0.0',
    lastVerified: '2026-01-12',
    trustLevel: 'verified',
    cacheTtl: 86400,
    semanticHints: {
      identityField: 'agentCard.name',
      capabilitiesField: 'agentCard.skills',
      descriptionField: 'agentCard.description',
      extensionField: 'metadata',
      fieldMappings: {
        'name': ['agentCard.name', 'name'],
        'description': ['agentCard.description', 'description'],
        'skills': ['agentCard.skills', 'capabilities'],
        'tools': ['agentCard.skills[].name'],
        'endpoint': ['agentCard.url', 'url'],
        'version': ['agentCard.version']
      },
      notes: 'A2A uses AgentCard for agent metadata including skills, capabilities, security. Tasks represent stateful work units. Messages have parts (TextPart, FilePart, DataPart). Artifacts are task outputs. Uses JSON-RPC for communication.'
    },
    fallbackSchema: {
      type: 'object',
      required: ['name', 'url'],
      properties: {
        name: { type: 'string', description: 'Agent name' },
        description: { type: 'string', description: 'Agent description' },
        url: { type: 'string', description: 'Agent endpoint URL' },
        version: { type: 'string', description: 'Agent version' },
        skills: { type: 'array', description: 'Agent skills with id, name, description' },
        capabilities: { type: 'object', description: 'Protocol capabilities (streaming, pushNotifications)' },
        defaultInputModes: { type: 'array', description: 'Supported input types (text, file, data)' },
        defaultOutputModes: { type: 'array', description: 'Supported output types' }
      }
    }
  },

  // =========================================================================
  // AGENT NETWORK PROTOCOL (ANP)
  // =========================================================================
  anp: {
    name: 'Agent Network Protocol',
    specUrl: 'https://agentnetworkprotocol.com/en/specs/07-anp-agent-description-protocol-specification/',
    altSpecUrls: [
      'https://agent-network-protocol.com/specs/agent-description.html',
      'https://github.com/agent-network-protocol/AgentNetworkProtocol/blob/main/07-anp-agent-description-protocol-specification.md'
    ],
    docsUrl: 'https://agentnetworkprotocol.com/en/specs/',
    repoUrl: 'https://github.com/agent-network-protocol/AgentNetworkProtocol',
    specVersion: '0.9.0',
    lastVerified: '2026-01-12',
    trustLevel: 'experimental',
    cacheTtl: 43200, // 12 hours
    semanticHints: {
      identityField: 'name',
      capabilitiesField: 'interfaces',
      descriptionField: 'description',
      extensionField: 'metadata',
      fieldMappings: {
        'name': ['name'],
        'description': ['description'],
        'did': ['did', '@id'],
        'interfaces': ['interfaces'],
        'products': ['products'],
        'version': ['version.version']
      },
      notes: 'ANP uses DID (Decentralized Identifiers) for agent identity. AgentDescription is the core type with interfaces (NaturalLanguageInterface, StructuredInterface). Uses JSON-LD with schema.org vocabulary. Includes cryptographic proof for verification.'
    },
    fallbackSchema: {
      type: 'object',
      required: ['@type', 'did', 'name'],
      properties: {
        '@context': { type: 'object', description: 'JSON-LD context' },
        '@type': { type: 'string', description: 'Type (ad:AgentDescription)' },
        '@id': { type: 'string', description: 'Agent URI' },
        did: { type: 'string', description: 'Decentralized Identifier' },
        name: { type: 'string', description: 'Agent name' },
        description: { type: 'string', description: 'Agent description' },
        interfaces: { type: 'array', description: 'Communication interfaces' },
        proof: { type: 'object', description: 'Cryptographic proof' }
      }
    }
  },

  // =========================================================================
  // ECLIPSE LMOS
  // =========================================================================
  lmos: {
    name: 'Eclipse LMOS',
    specUrl: 'https://eclipse.dev/lmos/docs/multi_agent_system/agent_description/',
    altSpecUrls: [
      'https://eclipse.dev/lmos/docs/arc/adl/',
      'https://eclipse.dev/lmos/docs/arc/dsl/defining_agents/'
    ],
    docsUrl: 'https://eclipse.dev/lmos/',
    repoUrl: 'https://github.com/eclipse-lmos/arc',
    specVersion: '1.0.0',
    lastVerified: '2026-01-12',
    trustLevel: 'verified',
    cacheTtl: 86400,
    semanticHints: {
      identityField: 'title',
      capabilitiesField: 'actions',
      descriptionField: 'description',
      extensionField: 'lmos:metadata',
      fieldMappings: {
        'name': ['title', 'id'],
        'description': ['description'],
        'actions': ['actions'],
        'tools': ['actions'],
        'metadata': ['lmos:metadata'],
        'security': ['securityDefinitions', 'security']
      },
      notes: 'LMOS uses W3C Web of Things Thing Description (TD) format with LMOS extensions. Agent Description includes actions (tools), metadata (vendor, model, compliance). Has Agent Definition Language (ADL) for declarative agent definition.'
    },
    fallbackSchema: {
      type: 'object',
      required: ['@type', 'id', 'title'],
      properties: {
        '@context': { type: 'array', description: 'JSON-LD context with WoT TD and LMOS' },
        '@type': { type: 'string', description: 'Type (lmos:Agent)' },
        id: { type: 'string', description: 'Agent URN' },
        title: { type: 'string', description: 'Agent name/title' },
        actions: { type: 'object', description: 'Available actions (tools)' },
        'lmos:metadata': { type: 'object', description: 'LMOS-specific metadata' },
        securityDefinitions: { type: 'object', description: 'Security schemes' }
      }
    }
  },

  // =========================================================================
  // LANGCHAIN
  // =========================================================================
  langchain: {
    name: 'LangChain Agent',
    specUrl: 'https://python.langchain.com/docs/concepts/agents/',
    altSpecUrls: [
      'https://api.python.langchain.com/en/latest/agents/langchain.agents.agent.AgentExecutor.html'
    ],
    docsUrl: 'https://python.langchain.com/docs/',
    repoUrl: 'https://github.com/langchain-ai/langchain',
    specVersion: '0.3.0',
    lastVerified: '2026-01-12',
    trustLevel: 'verified',
    cacheTtl: 86400,
    semanticHints: {
      identityField: 'name',
      capabilitiesField: 'tools',
      descriptionField: 'description',
      promptField: 'prompt',
      extensionField: 'metadata',
      fieldMappings: {
        'name': ['name', 'agent_name'],
        'tools': ['tools'],
        'llm': ['llm', 'model'],
        'memory': ['memory', 'chat_history'],
        'prompt': ['prompt', 'system_message'],
        'verbose': ['verbose']
      },
      notes: 'LangChain agents use LCEL (LangChain Expression Language). Key components: LLM/ChatModel, Tools (with name, description, args_schema), Memory (ConversationBufferMemory, etc), Prompt templates. AgentExecutor wraps agent logic.'
    },
    fallbackSchema: {
      type: 'object',
      required: ['tools'],
      properties: {
        name: { type: 'string', description: 'Agent name' },
        llm: { type: 'object', description: 'Language model configuration' },
        tools: { type: 'array', description: 'Available tools' },
        memory: { type: 'object', description: 'Memory configuration' },
        prompt: { type: 'string', description: 'System prompt template' },
        verbose: { type: 'boolean', description: 'Enable verbose logging' }
      }
    }
  },

  // =========================================================================
  // CREWAI
  // =========================================================================
  crewai: {
    name: 'CrewAI Agent',
    specUrl: 'https://docs.crewai.com/core-concepts/agents',
    altSpecUrls: [
      'https://github.com/joaomdmoura/crewAI/blob/main/src/crewai/agent.py'
    ],
    docsUrl: 'https://docs.crewai.com/',
    repoUrl: 'https://github.com/joaomdmoura/crewAI',
    specVersion: '0.95.0',
    lastVerified: '2026-01-12',
    trustLevel: 'verified',
    cacheTtl: 86400,
    semanticHints: {
      identityField: 'role',
      capabilitiesField: 'tools',
      descriptionField: 'backstory',
      promptField: 'goal',
      extensionField: 'config',
      fieldMappings: {
        'name': ['role', 'name'],
        'role': ['role'],
        'goal': ['goal'],
        'backstory': ['backstory'],
        'tools': ['tools'],
        'memory': ['memory'],
        'verbose': ['verbose'],
        'llm': ['llm']
      },
      notes: 'CrewAI uses role, goal, backstory triplet for agent identity. Agents belong to Crews and execute Tasks. Memory can be short_term, long_term, entity. Tools are LangChain-compatible. Supports delegation between agents.'
    },
    fallbackSchema: {
      type: 'object',
      required: ['role', 'goal', 'backstory'],
      properties: {
        role: { type: 'string', description: 'Agent role (primary identifier)' },
        goal: { type: 'string', description: 'Agent goal/objective' },
        backstory: { type: 'string', description: 'Agent backstory/context' },
        tools: { type: 'array', description: 'Available tools' },
        memory: { type: 'boolean', description: 'Enable memory' },
        verbose: { type: 'boolean', description: 'Enable verbose mode' },
        llm: { type: 'object', description: 'LLM configuration' }
      }
    }
  },

  // =========================================================================
  // OPENAI ASSISTANTS
  // =========================================================================
  openai: {
    name: 'OpenAI Assistants API',
    specUrl: 'https://platform.openai.com/docs/api-reference/assistants',
    altSpecUrls: [
      'https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml'
    ],
    docsUrl: 'https://platform.openai.com/docs/assistants/overview',
    repoUrl: 'https://github.com/openai/openai-openapi',
    specVersion: '2.0.0',
    lastVerified: '2026-01-12',
    trustLevel: 'verified',
    cacheTtl: 86400,
    semanticHints: {
      identityField: 'name',
      capabilitiesField: 'tools',
      descriptionField: 'description',
      promptField: 'instructions',
      extensionField: 'metadata',
      fieldMappings: {
        'name': ['name'],
        'description': ['description'],
        'instructions': ['instructions'],
        'tools': ['tools'],
        'model': ['model'],
        'file_ids': ['file_ids', 'tool_resources.file_search.vector_store_ids'],
        'metadata': ['metadata']
      },
      notes: 'OpenAI Assistants use tools array with type (code_interpreter, file_search, function). Functions have name, description, parameters (JSON Schema). Tool resources include vector_stores and code_interpreter files. Response format can be text or json_schema.'
    },
    fallbackSchema: {
      type: 'object',
      required: ['model'],
      properties: {
        id: { type: 'string', description: 'Assistant ID' },
        name: { type: 'string', description: 'Assistant name' },
        description: { type: 'string', description: 'Assistant description' },
        model: { type: 'string', description: 'Model ID (gpt-4o, etc)' },
        instructions: { type: 'string', description: 'System instructions' },
        tools: { type: 'array', description: 'Enabled tools' },
        tool_resources: { type: 'object', description: 'Resources for tools' },
        metadata: { type: 'object', description: 'Custom metadata' }
      }
    }
  },

  // =========================================================================
  // MICROSOFT AUTOGEN / AGENT FRAMEWORK
  // =========================================================================
  autogen: {
    name: 'Microsoft AutoGen',
    specUrl: 'https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/framework/component-config.html',
    altSpecUrls: [
      'https://microsoft.github.io/autogen/0.2/docs/topics/llm_configuration/'
    ],
    docsUrl: 'https://microsoft.github.io/autogen/',
    repoUrl: 'https://github.com/microsoft/autogen',
    specVersion: '0.4.0',
    lastVerified: '2026-01-12',
    trustLevel: 'verified',
    cacheTtl: 86400,
    semanticHints: {
      identityField: 'name',
      capabilitiesField: 'tools',
      descriptionField: 'system_message',
      promptField: 'system_message',
      extensionField: 'extra_config',
      fieldMappings: {
        'name': ['name'],
        'system_message': ['system_message'],
        'tools': ['tools', 'function_map'],
        'llm_config': ['llm_config'],
        'code_execution_config': ['code_execution_config'],
        'human_input_mode': ['human_input_mode']
      },
      notes: 'AutoGen 0.4 (Agent Framework) uses AgentChat API. Key agent types: AssistantAgent, UserProxyAgent, GroupChatManager. Components have provider/config pattern. LLM config includes model, api_key, base_url. Supports code execution and tool registration.'
    },
    fallbackSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Agent name' },
        system_message: { type: 'string', description: 'System message/persona' },
        llm_config: { type: 'object', description: 'LLM configuration' },
        tools: { type: 'array', description: 'Registered tools/functions' },
        code_execution_config: { type: 'object', description: 'Code execution settings' },
        human_input_mode: { type: 'string', description: 'Human input mode (NEVER, TERMINATE, ALWAYS)' }
      }
    }
  },

  // =========================================================================
  // IBM AGENT COMMUNICATION PROTOCOL (ACP)
  // =========================================================================
  acp: {
    name: 'IBM Agent Communication Protocol',
    specUrl: 'https://github.com/i-am-bee/acp/blob/main/spec/agent-communication-protocol.md',
    docsUrl: 'https://github.com/i-am-bee/acp',
    repoUrl: 'https://github.com/i-am-bee/acp',
    specVersion: '1.0.0',
    lastVerified: '2026-01-12',
    trustLevel: 'verified',
    cacheTtl: 86400,
    semanticHints: {
      identityField: 'name',
      capabilitiesField: 'capabilities',
      descriptionField: 'description',
      extensionField: 'metadata',
      fieldMappings: {
        'name': ['name'],
        'description': ['description'],
        'capabilities': ['capabilities'],
        'runs': ['runs'],
        'messages': ['messages']
      },
      notes: 'ACP (IBM Bee Agent Communication Protocol) focuses on agent-to-agent communication. Similar to A2A with runs (tasks) and messages. Designed for enterprise multi-agent systems.'
    },
    fallbackSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Agent name' },
        description: { type: 'string', description: 'Agent description' },
        capabilities: { type: 'object', description: 'Agent capabilities' }
      }
    }
  },

  // =========================================================================
  // ELIZAOS
  // =========================================================================
  elizaos: {
    name: 'ElizaOS',
    specUrl: 'https://elizaos.ai/docs/core/characterfile',
    docsUrl: 'https://elizaos.ai/docs',
    repoUrl: 'https://github.com/elizaos/eliza',
    specVersion: '0.1.0',
    lastVerified: '2026-01-12',
    trustLevel: 'community',
    cacheTtl: 43200,
    semanticHints: {
      identityField: 'name',
      capabilitiesField: 'plugins',
      descriptionField: 'system',
      promptField: 'system',
      extensionField: 'settings',
      fieldMappings: {
        'name': ['name', 'username'],
        'system': ['system'],
        'bio': ['bio'],
        'plugins': ['plugins'],
        'topics': ['topics'],
        'adjectives': ['adjectives'],
        'beliefs': ['beliefs'],
        'voice': ['voice']
      },
      notes: 'ElizaOS uses character files with personality-focused fields: bio (array), topics, adjectives, beliefs. Plugins provide capabilities. Voice config for TTS. Originally AI16z Eliza framework.'
    },
    fallbackSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Character name' },
        username: { type: 'string', description: 'Username handle' },
        system: { type: 'string', description: 'System prompt' },
        bio: { type: 'array', description: 'Bio statements' },
        plugins: { type: 'array', description: 'Enabled plugins' },
        topics: { type: 'array', description: 'Knowledge topics' },
        adjectives: { type: 'array', description: 'Personality adjectives' }
      }
    }
  }
};

// ============================================================================
// Registry Helper Functions
// ============================================================================

/**
 * Get all registered protocol IDs
 */
export function getRegisteredProtocols(): string[] {
  return Object.keys(PROTOCOL_REGISTRY_V2);
}

/**
 * Get protocol entry by ID
 */
export function getProtocol(id: string): ProtocolEntryV2 | undefined {
  return PROTOCOL_REGISTRY_V2[id];
}

/**
 * Get protocols by trust level
 */
export function getProtocolsByTrustLevel(level: ProtocolEntryV2['trustLevel']): string[] {
  return Object.entries(PROTOCOL_REGISTRY_V2)
    .filter(([_, entry]) => entry.trustLevel === level)
    .map(([id, _]) => id);
}

/**
 * Check if a protocol is registered
 */
export function isProtocolRegistered(id: string): boolean {
  return id in PROTOCOL_REGISTRY_V2;
}

/**
 * Get semantic hints for a protocol
 */
export function getSemanticHints(protocol: string): SemanticHints | undefined {
  return PROTOCOL_REGISTRY_V2[protocol]?.semanticHints;
}

/**
 * Get the best spec URL to fetch (primary or fallback)
 */
export function getSpecUrls(protocol: string): string[] {
  const entry = PROTOCOL_REGISTRY_V2[protocol];
  if (!entry) return [];
  return [entry.specUrl, ...(entry.altSpecUrls || [])];
}

export default PROTOCOL_REGISTRY_V2;