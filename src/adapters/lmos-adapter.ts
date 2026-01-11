/**
 * Chrysalis Universal Agent Bridge - Eclipse LMOS Adapter
 * 
 * Bidirectional translation between Eclipse LMOS Protocol agent specification
 * and canonical RDF representation.
 * 
 * Eclipse LMOS uses W3C Web of Things Thing Description format with JSON-LD,
 * DIDs for identity, and follows the W3C WoT affordance model.
 * 
 * @module adapters/lmos-adapter
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
// LMOS Extension Namespace
// ============================================================================

const LMOS_NS = 'https://lmos.2060.io/lmos#';
const TD_NS = 'https://www.w3.org/2019/wot/td#';
const WOT_NS = 'https://www.w3.org/2019/wot/td#';
const JSONLD_NS = 'http://www.w3.org/ns/json-ld#';

const lmos = (localName: string): NamedNode => DataFactory.namedNode(LMOS_NS + localName);
const td = (localName: string): NamedNode => DataFactory.namedNode(TD_NS + localName);

// ============================================================================
// LMOS/WoT Schema Types
// ============================================================================

/**
 * LMOS Agent based on W3C Web of Things Thing Description
 * Reference: https://www.w3.org/TR/wot-thing-description11/
 */
type JsonLdContext = string | Record<string, unknown> | Array<string | Record<string, unknown>>;

interface LMOSAgent {
  '@context': JsonLdContext;
  '@type'?: string | string[];
  id: string;
  title: string;
  description?: string;
  version?: LMOSVersionInfo;
  created?: string;
  modified?: string;
  support?: string;
  base?: string;
  
  // Security
  securityDefinitions?: Record<string, LMOSSecurityScheme>;
  security?: string | string[];
  
  // Affordances
  properties?: Record<string, LMOSPropertyAffordance>;
  actions?: Record<string, LMOSActionAffordance>;
  events?: Record<string, LMOSEventAffordance>;
  
  // Links and Forms
  links?: LMOSLink[];
  forms?: LMOSForm[];
  
  // LMOS Extensions
  'lmos:agentClass'?: string;
  'lmos:capabilities'?: string[];
  'lmos:llmConfig'?: LMOSLLMConfig;
  'lmos:memory'?: LMOSMemoryConfig;
  'lmos:protocols'?: LMOSProtocolConfig;
}

interface LMOSVersionInfo {
  instance?: string;
  model?: string;
}

interface LMOSSecurityScheme {
  '@type'?: string;
  scheme: string;
  description?: string;
  proxy?: string;
  in?: string;
  name?: string;
  authorization?: string;
  token?: string;
  refresh?: string;
  scopes?: string[];
  flow?: string;
  identity?: string;
  format?: string;
  alg?: string;
  pubKeyPem?: string;
}

interface LMOSPropertyAffordance {
  '@type'?: string | string[];
  type?: string;
  title?: string;
  description?: string;
  observable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  forms?: LMOSForm[];
  unit?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

interface LMOSActionAffordance {
  '@type'?: string | string[];
  title?: string;
  description?: string;
  input?: LMOSDataSchema;
  output?: LMOSDataSchema;
  safe?: boolean;
  idempotent?: boolean;
  synchronous?: boolean;
  forms?: LMOSForm[];
}

interface LMOSEventAffordance {
  '@type'?: string | string[];
  title?: string;
  description?: string;
  subscription?: LMOSDataSchema;
  data?: LMOSDataSchema;
  dataResponse?: LMOSDataSchema;
  cancellation?: LMOSDataSchema;
  forms?: LMOSForm[];
}

interface LMOSDataSchema {
  '@type'?: string | string[];
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, LMOSDataSchema>;
  required?: string[];
  items?: LMOSDataSchema;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
  contentEncoding?: string;
  contentMediaType?: string;
}

interface LMOSLink {
  href: string;
  type?: string;
  rel?: string;
  anchor?: string;
  hreflang?: string | string[];
  sizes?: string;
}

interface LMOSForm {
  href: string;
  contentType?: string;
  contentCoding?: string;
  subprotocol?: string;
  security?: string | string[];
  scopes?: string | string[];
  response?: {
    contentType?: string;
  };
  op?: string | string[];
  'htv:methodName'?: string;
  'htv:headers'?: Array<{
    'htv:fieldName': string;
    'htv:fieldValue': string;
  }>;
}

// LMOS-specific extensions
interface LMOSLLMConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

interface LMOSMemoryConfig {
  type: string;
  vectorStore?: {
    provider: string;
    config?: Record<string, unknown>;
  };
  contextWindow?: number;
}

interface LMOSProtocolConfig {
  mcp?: boolean;
  a2a?: boolean;
  http?: boolean;
  websocket?: boolean;
}

// ============================================================================
// LMOS Translation Context
// ============================================================================

/**
 * Internal context object for LMOS→Canonical translation.
 * Accumulates quads, field mappings, and extensions during translation.
 *
 * @internal
 */
interface LMOSTranslationContext {
  /** The parsed LMOS agent specification */
  agent: LMOSAgent;
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
  /** Identity blank node (needed for security key references) */
  identityNode?: BlankNode;
}

// ============================================================================
// LMOS Adapter Implementation
// ============================================================================

/**
 * Adapter for Eclipse LMOS Protocol agent specification.
 *
 * Handles bidirectional translation between LMOS/W3C WoT Thing Description
 * JSON-LD format and the canonical RDF representation.
 *
 * The toCanonical() method is decomposed into focused private methods
 * following single-responsibility principle:
 * - translateMetadata(): Core metadata (title, description, version)
 * - translateIdentity(): DID-based identity
 * - translateSecurity(): Security definitions and keys
 * - translateAgentClass(): LMOS agent classification
 * - translateActions(): WoT actions → Chrysalis tools
 * - translateWotAffordances(): Properties, events, links
 * - translateForms(): Top-level forms → protocol bindings
 * - translateLLMConfig(): LMOS LLM configuration
 * - translateMemoryConfig(): LMOS memory configuration
 * - translateProtocols(): LMOS protocol flags
 * - translateAdditionalMetadata(): timestamps, base, support
 * - finalizeCanonical(): Build final CanonicalAgent structure
 */
export class LMOSAdapter extends BaseAdapter {
  readonly framework = 'lmos' as const;
  readonly name = 'Eclipse LMOS Adapter';
  readonly version = '1.0.0';
  readonly extensionNamespace = LMOS_NS;

  constructor(config: AdapterConfig = {}) {
    super(config);
  }

  // ==========================================================================
  // Native → Canonical Translation (Public API)
  // ==========================================================================

  /**
   * Translate a native LMOS agent specification to canonical RDF representation.
   *
   * This method orchestrates the translation by delegating to focused private
   * methods for each logical section of the LMOS/WoT specification.
   *
   * @param native - The native LMOS agent to translate
   * @returns Promise resolving to the canonical RDF representation
   *
   * @example
   * ```typescript
   * const adapter = new LMOSAdapter();
   * const canonical = await adapter.toCanonical({
   *   data: lmosAgentSpec,
   *   framework: 'lmos',
   *   version: '1.1'
   * });
   * ```
   */
  async toCanonical(native: NativeAgent): Promise<CanonicalAgent> {
    // Initialize translation context
    const ctx = this.initTranslationContext(native);

    // Translate each section in logical order
    this.translateMetadata(ctx);
    this.translateIdentity(ctx);
    this.translateSecurity(ctx);
    this.translateAgentClass(ctx);
    this.translateActions(ctx);
    this.translateWotAffordances(ctx);
    this.translateForms(ctx);
    this.translateLLMConfig(ctx);
    this.translateMemoryConfig(ctx);
    this.translateProtocols(ctx);
    this.translateJsonLdContext(ctx);
    this.translateAdditionalMetadata(ctx);

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
   * type declarations (chrysalis:Agent and td:Thing).
   *
   * @param native - The native agent specification
   * @returns Initialized translation context
   *
   * @rdf-vocabulary
   * - rdf:type → chrysalis:Agent
   * - rdf:type → td:Thing (W3C WoT Thing Description)
   */
  private initTranslationContext(native: NativeAgent): LMOSTranslationContext {
    const agent = native.data as unknown as LMOSAgent;
    const agentId = this.extractAgentId(agent.id);
    const agentUri = this.generateAgentUri(agentId);
    
    const ctx: LMOSTranslationContext = {
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

    const agentNode = this.uri(agentUri);

    // Add base type declarations
    ctx.quads.push(this.quad(agentNode, rdf('type'), chrysalis('Agent')));
    ctx.quads.push(this.quad(agentNode, rdf('type'), td('Thing')));
    ctx.mappedFields.push('@type');

    return ctx;
  }

  /**
   * Translate LMOS core metadata to canonical RDF.
   *
   * Handles: title→name, description, version.instance.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:name (from title, required)
   * - chrysalis:description
   * - chrysalis:version (from version.instance)
   */
  private translateMetadata(ctx: LMOSTranslationContext): void {
    const { agent, agentUri, quads, mappedFields } = ctx;
    const agentNode = this.uri(agentUri);

    // Title → name (required)
    quads.push(this.quad(agentNode, chrysalis('name'), this.literal(agent.title)));
    mappedFields.push('title');

    // Description
    if (agent.description) {
      quads.push(this.quad(agentNode, chrysalis('description'), this.literal(agent.description)));
      mappedFields.push('description');
    }

    // Version
    if (agent.version?.instance) {
      quads.push(this.quad(agentNode, chrysalis('version'), this.literal(agent.version.instance)));
      mappedFields.push('version.instance');
    }
  }

  /**
   * Translate LMOS DID-based identity to canonical RDF.
   *
   * Creates a DecentralizedIdentifier blank node linked via chrysalis:hasIdentity.
   * Extracts DID scheme from the identifier format.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:hasIdentity → blank node
   * - chrysalis:DecentralizedIdentifier (type)
   * - chrysalis:identifierValue (full DID)
   * - chrysalis:identifierScheme (e.g., 'did:web')
   */
  private translateIdentity(ctx: LMOSTranslationContext): void {
    const { agent, agentUri, quads, mappedFields } = ctx;
    const agentNode = this.uri(agentUri);

    // Create identity blank node and store for security key references
    const identityNode = this.blank(this.generateBlankId('identity'));
    ctx.identityNode = identityNode;

    quads.push(this.quad(agentNode, chrysalis('hasIdentity'), identityNode));
    quads.push(this.quad(identityNode, rdf('type'), chrysalis('DecentralizedIdentifier')));
    quads.push(this.quad(identityNode, chrysalis('identifierValue'), this.literal(agent.id)));

    // Extract and add DID scheme
    const didScheme = this.extractDIDScheme(agent.id);
    quads.push(this.quad(identityNode, chrysalis('identifierScheme'), this.literal(didScheme)));
    mappedFields.push('id');
  }

  /**
   * Translate LMOS security definitions to canonical RDF.
   *
   * Security definitions are preserved as extensions for round-tripping.
   * Public keys are extracted and added to the identity node.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:publicKey (extracted from security schemes)
   */
  private translateSecurity(ctx: LMOSTranslationContext): void {
    const { agent, quads, mappedFields, unmappedFields, extensions, identityNode } = ctx;

    // Security definitions (extension)
    if (agent.securityDefinitions) {
      extensions.push(this.createExtension(
        'lmos', 'securityDefinitions', agent.securityDefinitions, 'securityDefinitions'
      ));
      unmappedFields.push('securityDefinitions');

      // Extract public keys for identity if present
      if (identityNode) {
        for (const [name, scheme] of Object.entries(agent.securityDefinitions)) {
          if (scheme.pubKeyPem) {
            quads.push(this.quad(identityNode, chrysalis('publicKey'), this.literal(scheme.pubKeyPem)));
            mappedFields.push(`securityDefinitions.${name}.pubKeyPem`);
          }
        }
      }
    }

    // Security reference (extension)
    if (agent.security) {
      extensions.push(this.createExtension('lmos', 'security', agent.security, 'security'));
      unmappedFields.push('security');
    }
  }

  /**
   * Translate LMOS agent class to canonical RDF.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - lmos:agentClass
   */
  private translateAgentClass(ctx: LMOSTranslationContext): void {
    const { agent, agentUri, quads, mappedFields } = ctx;

    if (agent['lmos:agentClass']) {
      quads.push(this.quad(
        this.uri(agentUri), lmos('agentClass'), this.literal(agent['lmos:agentClass'])
      ));
      mappedFields.push('lmos:agentClass');
    }
  }

  /**
   * Translate WoT actions to Chrysalis tools.
   *
   * Each action becomes a Tool blank node linked via chrysalis:hasCapability.
   * Input/output schemas are JSON-serialized. Forms are preserved as extensions.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:hasCapability → blank node
   * - chrysalis:Tool (type)
   * - chrysalis:toolName
   * - chrysalis:toolDescription
   * - chrysalis:inputSchema (JSON)
   * - chrysalis:outputSchema (JSON)
   * - chrysalis:toolEndpoint (primary form href)
   */
  private translateActions(ctx: LMOSTranslationContext): void {
    const { agent, agentUri, quads, mappedFields, extensions } = ctx;

    if (!agent.actions) {
      return;
    }

    const agentNode = this.uri(agentUri);

    for (const [actionName, action] of Object.entries(agent.actions)) {
      const toolNode = this.blank(this.generateBlankId('tool'));

      // Link tool to agent
      quads.push(this.quad(agentNode, chrysalis('hasCapability'), toolNode));
      quads.push(this.quad(toolNode, rdf('type'), chrysalis('Tool')));
      quads.push(this.quad(toolNode, chrysalis('toolName'), this.literal(actionName)));

      // Description (prefer title, fallback to description)
      const description = action.title || action.description;
      if (description) {
        quads.push(this.quad(toolNode, chrysalis('toolDescription'), this.literal(description)));
      }

      // Input/output schemas
      if (action.input) {
        quads.push(this.quad(toolNode, chrysalis('inputSchema'), this.literal(JSON.stringify(action.input))));
      }
      if (action.output) {
        quads.push(this.quad(toolNode, chrysalis('outputSchema'), this.literal(JSON.stringify(action.output))));
      }

      // Forms → endpoint (primary form)
      if (action.forms?.length) {
        const primaryForm = action.forms[0];
        quads.push(this.quad(toolNode, chrysalis('toolEndpoint'), this.uri(primaryForm.href)));

        // Store all forms as extension for round-tripping
        extensions.push(this.createExtension(
          'lmos', `action.${actionName}.forms`, action.forms, `actions.${actionName}.forms`
        ));
      }
    }

    mappedFields.push('actions');
  }

  /**
   * Translate WoT affordances (properties, events, links) to extensions.
   *
   * These affordances don't have direct Chrysalis equivalents, so they're
   * preserved as extensions for lossless round-tripping.
   *
   * @param ctx - Translation context to mutate
   */
  private translateWotAffordances(ctx: LMOSTranslationContext): void {
    const { agent, unmappedFields, extensions } = ctx;

    // Properties (extension)
    if (agent.properties) {
      for (const [propName, prop] of Object.entries(agent.properties)) {
        extensions.push(this.createExtension(
          'lmos', `property.${propName}`, prop, `properties.${propName}`
        ));
      }
      unmappedFields.push('properties');
    }

    // Events (extension)
    if (agent.events) {
      extensions.push(this.createExtension('lmos', 'events', agent.events, 'events'));
      unmappedFields.push('events');
    }

    // Links (extension)
    if (agent.links?.length) {
      extensions.push(this.createExtension('lmos', 'links', agent.links, 'links'));
      unmappedFields.push('links');
    }
  }

  /**
   * Translate top-level WoT forms to protocol bindings.
   *
   * Forms define how to interact with the Thing. Each form becomes a
   * protocol binding node based on the href scheme or subprotocol.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:supportsProtocol → binding node
   * - Protocol types: HTTPBinding, WebSocketBinding
   * - chrysalis:endpointUrl
   * - chrysalis:protocolConfig (JSON)
   */
  private translateForms(ctx: LMOSTranslationContext): void {
    const { agent, agentUri, quads, mappedFields } = ctx;

    if (!agent.forms?.length) {
      return;
    }

    const agentNode = this.uri(agentUri);

    for (const form of agent.forms) {
      const bindingNode = this.blank(this.generateBlankId('binding'));
      const protocolType = this.determineProtocolType(form);

      quads.push(this.quad(agentNode, chrysalis('supportsProtocol'), bindingNode));
      quads.push(this.quad(bindingNode, rdf('type'), chrysalis(protocolType)));
      quads.push(this.quad(bindingNode, chrysalis('endpointUrl'), this.uri(form.href)));

      if (form.contentType) {
        quads.push(this.quad(
          bindingNode, chrysalis('protocolConfig'),
          this.literal(JSON.stringify({ contentType: form.contentType }))
        ));
      }
    }

    mappedFields.push('forms');
  }

  /**
   * Translate LMOS LLM configuration to canonical RDF.
   *
   * Creates an LLMConfig node with provider, model, temperature, maxTokens, systemPrompt.
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
   * - chrysalis:systemPrompt
   */
  private translateLLMConfig(ctx: LMOSTranslationContext): void {
    const { agent, agentUri, quads, mappedFields } = ctx;

    if (!agent['lmos:llmConfig']) {
      return;
    }

    const llmConfig = agent['lmos:llmConfig'];
    const agentNode = this.uri(agentUri);
    const llmNode = this.blank(this.generateBlankId('llm'));

    quads.push(this.quad(agentNode, chrysalis('hasExecutionConfig'), llmNode));
    quads.push(this.quad(llmNode, rdf('type'), chrysalis('LLMConfig')));

    // Required properties
    quads.push(this.quad(llmNode, chrysalis('llmProvider'), this.literal(llmConfig.provider)));
    quads.push(this.quad(llmNode, chrysalis('llmModel'), this.literal(llmConfig.model)));

    // Optional properties
    if (llmConfig.temperature !== undefined) {
      quads.push(this.quad(
        llmNode, chrysalis('temperature'), this.literal(llmConfig.temperature, `${XSD_NS}float`)
      ));
    }

    if (llmConfig.maxTokens !== undefined) {
      quads.push(this.quad(
        llmNode, chrysalis('maxOutputTokens'), this.literal(llmConfig.maxTokens, `${XSD_NS}integer`)
      ));
    }

    if (llmConfig.systemPrompt) {
      quads.push(this.quad(llmNode, chrysalis('systemPrompt'), this.literal(llmConfig.systemPrompt)));
    }

    mappedFields.push('lmos:llmConfig');
  }

  /**
   * Translate LMOS memory configuration to canonical RDF.
   *
   * Creates a MemorySystem node with type-specific secondary type.
   * Vector store config is preserved as extension.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:hasMemorySystem → blank node
   * - chrysalis:MemorySystem (type)
   * - Memory types: WorkingMemory, EpisodicMemory, SemanticMemory, ProceduralMemory, CoreMemory
   * - chrysalis:memoryEnabled
   * - chrysalis:maxTokens (contextWindow)
   * - chrysalis:storageBackend (vectorStore provider)
   */
  private translateMemoryConfig(ctx: LMOSTranslationContext): void {
    const { agent, agentUri, quads, mappedFields, extensions } = ctx;

    if (!agent['lmos:memory']) {
      return;
    }

    const memConfig = agent['lmos:memory'];
    const agentNode = this.uri(agentUri);
    const memoryNode = this.blank(this.generateBlankId('memory'));

    quads.push(this.quad(agentNode, chrysalis('hasMemorySystem'), memoryNode));
    quads.push(this.quad(memoryNode, rdf('type'), chrysalis('MemorySystem')));

    // Map memory type to specific class
    const memoryType = this.mapMemoryType(memConfig.type);
    quads.push(this.quad(memoryNode, rdf('type'), chrysalis(memoryType)));
    quads.push(this.quad(memoryNode, chrysalis('memoryEnabled'), this.literal(true)));

    // Context window → maxTokens
    if (memConfig.contextWindow) {
      quads.push(this.quad(
        memoryNode, chrysalis('maxTokens'), this.literal(memConfig.contextWindow, `${XSD_NS}integer`)
      ));
    }

    // Vector store
    if (memConfig.vectorStore) {
      quads.push(this.quad(
        memoryNode, chrysalis('storageBackend'), this.literal(memConfig.vectorStore.provider)
      ));

      // Config as extension
      extensions.push(this.createExtension(
        'lmos', 'vectorStoreConfig', memConfig.vectorStore.config || {}, 'lmos:memory.vectorStore.config'
      ));
    }

    mappedFields.push('lmos:memory');
  }

  /**
   * Map LMOS memory type string to canonical memory class name.
   *
   * @param type - The memory type string from LMOS config
   * @returns The canonical memory class name
   */
  private mapMemoryType(type: string): string {
    const memoryTypeMap: Record<string, string> = {
      'working': 'WorkingMemory',
      'episodic': 'EpisodicMemory',
      'semantic': 'SemanticMemory',
      'procedural': 'ProceduralMemory',
      'core': 'CoreMemory'
    };
    return memoryTypeMap[type] || 'MemorySystem';
  }

  /**
   * Translate LMOS protocol flags to protocol binding nodes.
   *
   * Each enabled protocol creates a binding node with the appropriate type.
   *
   * @param ctx - Translation context to mutate
   *
   * @rdf-vocabulary
   * - chrysalis:supportsProtocol → binding nodes
   * - Protocol types: MCPBinding, A2ABinding, HTTPBinding, WebSocketBinding
   */
  private translateProtocols(ctx: LMOSTranslationContext): void {
    const { agent, agentUri, quads, mappedFields } = ctx;

    if (!agent['lmos:protocols']) {
      return;
    }

    const protocols = agent['lmos:protocols'];
    const agentNode = this.uri(agentUri);

    // Create binding nodes for each enabled protocol
    const protocolConfigs: Array<{ flag: boolean | undefined; type: string; idPrefix: string }> = [
      { flag: protocols.mcp, type: 'MCPBinding', idPrefix: 'mcp' },
      { flag: protocols.a2a, type: 'A2ABinding', idPrefix: 'a2a' },
      { flag: protocols.http, type: 'HTTPBinding', idPrefix: 'http' },
      { flag: protocols.websocket, type: 'WebSocketBinding', idPrefix: 'ws' }
    ];

    for (const { flag, type, idPrefix } of protocolConfigs) {
      if (flag) {
        const bindingNode = this.blank(this.generateBlankId(idPrefix));
        quads.push(this.quad(agentNode, chrysalis('supportsProtocol'), bindingNode));
        quads.push(this.quad(bindingNode, rdf('type'), chrysalis(type)));
      }
    }

    mappedFields.push('lmos:protocols');
  }

  /**
   * Translate JSON-LD @context to extension for round-tripping.
   *
   * @param ctx - Translation context to mutate
   */
  private translateJsonLdContext(ctx: LMOSTranslationContext): void {
    const { agent, unmappedFields, extensions } = ctx;

    if (agent['@context']) {
      extensions.push(this.createExtension('lmos', '@context', agent['@context'], '@context'));
      unmappedFields.push('@context');
    }
  }

  /**
   * Translate additional LMOS metadata to extensions.
   *
   * Handles: created, modified, base, support.
   *
   * @param ctx - Translation context to mutate
   */
  private translateAdditionalMetadata(ctx: LMOSTranslationContext): void {
    const { agent, unmappedFields, extensions } = ctx;

    // Timestamp fields
    if (agent.created) {
      extensions.push(this.createExtension('lmos', 'created', agent.created, 'created'));
      unmappedFields.push('created');
    }

    if (agent.modified) {
      extensions.push(this.createExtension('lmos', 'modified', agent.modified, 'modified'));
      unmappedFields.push('modified');
    }

    // Base URL and support
    if (agent.base) {
      extensions.push(this.createExtension('lmos', 'base', agent.base, 'base'));
      unmappedFields.push('base');
    }

    if (agent.support) {
      extensions.push(this.createExtension('lmos', 'support', agent.support, 'support'));
      unmappedFields.push('support');
    }
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
  private finalizeCanonical(ctx: LMOSTranslationContext): CanonicalAgent {
    const canonical: CanonicalAgent = {
      uri: ctx.agentUri,
      quads: ctx.quads,
      sourceFramework: 'lmos',
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
  // Canonical → Native Translation
  // ==========================================================================

  async fromCanonical(canonical: CanonicalAgent): Promise<NativeAgent> {
    const quads = canonical.quads;
    const agentUri = canonical.uri;

    const agent: LMOSAgent = {
      '@context': [
        'https://www.w3.org/2022/wot/td/v1.1',
        { 'lmos': 'https://lmos.2060.io/lmos#' }
      ],
      '@type': 'Thing',
      id: '',
      title: ''
    };

    // ========================================================================
    // Extract Core Metadata
    // ========================================================================

    agent.title = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}name`) || 'Unnamed Agent';
    
    const description = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}description`);
    if (description) agent.description = description;

    const version = this.extractLiteral(quads, agentUri, `${CHRYSALIS_NS}version`);
    if (version) {
      agent.version = { instance: version };
    }

    // ========================================================================
    // Extract Identity (DID)
    // ========================================================================

    const identityUri = this.extractUri(quads, agentUri, `${CHRYSALIS_NS}hasIdentity`);
    if (identityUri) {
      const identifierValue = this.extractLiteral(quads, identityUri, `${CHRYSALIS_NS}identifierValue`);
      if (identifierValue) {
        agent.id = identifierValue;
      }

      const publicKey = this.extractLiteral(quads, identityUri, `${CHRYSALIS_NS}publicKey`);
      if (publicKey) {
        agent.securityDefinitions = {
          did_sec: {
            scheme: 'did',
            pubKeyPem: publicKey
          }
        };
        agent.security = ['did_sec'];
      }
    }

    // Fallback: generate DID from URI
    if (!agent.id) {
      const agentName = agent.title.toLowerCase().replace(/\s+/g, '-');
      agent.id = `did:web:chrysalis.dev:agent:${agentName}`;
    }

    // ========================================================================
    // Extract LMOS Agent Class
    // ========================================================================

    const agentClass = this.extractLiteral(quads, agentUri, `${LMOS_NS}agentClass`);
    if (agentClass) {
      agent['lmos:agentClass'] = agentClass;
    }

    // ========================================================================
    // Extract Tools → Actions
    // ========================================================================

    const capabilityUris = this.extractUris(quads, agentUri, `${CHRYSALIS_NS}hasCapability`);
    const actions: Record<string, LMOSActionAffordance> = {};

    for (const capUri of capabilityUris) {
      const isToolType = quads.some(q =>
        q.subject.value === capUri &&
        q.predicate.value === `${RDF_NS}type` &&
        q.object.value === `${CHRYSALIS_NS}Tool`
      );

      if (isToolType) {
        const toolName = this.extractLiteral(quads, capUri, `${CHRYSALIS_NS}toolName`);
        if (toolName) {
          const action: LMOSActionAffordance = {};

          const toolDesc = this.extractLiteral(quads, capUri, `${CHRYSALIS_NS}toolDescription`);
          if (toolDesc) {
            action.title = toolDesc;
            action.description = toolDesc;
          }

          const inputSchema = this.extractLiteral(quads, capUri, `${CHRYSALIS_NS}inputSchema`);
          if (inputSchema) {
            try {
              action.input = JSON.parse(inputSchema);
            } catch {
              // Ignore parse errors
            }
          }

          const outputSchema = this.extractLiteral(quads, capUri, `${CHRYSALIS_NS}outputSchema`);
          if (outputSchema) {
            try {
              action.output = JSON.parse(outputSchema);
            } catch {
              // Ignore parse errors
            }
          }

          const endpoint = this.extractUri(quads, capUri, `${CHRYSALIS_NS}toolEndpoint`);
          if (endpoint) {
            action.forms = [{ href: endpoint }];
          }

          // Restore forms from extensions
          const formsExt = canonical.extensions.find(e =>
            e.namespace === 'lmos' && e.property === `action.${toolName}.forms`
          );
          if (formsExt) {
            try {
              action.forms = JSON.parse(formsExt.value);
            } catch {
              // Ignore
            }
          }

          actions[toolName] = action;
        }
      }
    }

    if (Object.keys(actions).length > 0) {
      agent.actions = actions;
    }

    // ========================================================================
    // Extract Protocol Bindings → Forms
    // ========================================================================

    const protocolUris = this.extractUris(quads, agentUri, `${CHRYSALIS_NS}supportsProtocol`);
    const forms: LMOSForm[] = [];
    const protocols: LMOSProtocolConfig = {};

    for (const protoUri of protocolUris) {
      const typeUri = this.extractUri(quads, protoUri, `${RDF_NS}type`);
      const endpoint = this.extractUri(quads, protoUri, `${CHRYSALIS_NS}endpointUrl`);

      switch (typeUri) {
        case `${CHRYSALIS_NS}HTTPBinding`:
          protocols.http = true;
          if (endpoint) {
            forms.push({
              href: endpoint,
              contentType: 'application/json',
              op: ['readproperty', 'writeproperty', 'invokeaction']
            });
          }
          break;
        case `${CHRYSALIS_NS}WebSocketBinding`:
          protocols.websocket = true;
          if (endpoint) {
            forms.push({
              href: endpoint,
              subprotocol: 'websocket'
            });
          }
          break;
        case `${CHRYSALIS_NS}MCPBinding`:
          protocols.mcp = true;
          break;
        case `${CHRYSALIS_NS}A2ABinding`:
          protocols.a2a = true;
          break;
      }
    }

    if (forms.length > 0) {
      agent.forms = forms;
    }

    if (Object.keys(protocols).length > 0) {
      agent['lmos:protocols'] = protocols;
    }

    // ========================================================================
    // Extract LLM Configuration
    // ========================================================================

    const llmUri = this.extractUri(quads, agentUri, `${CHRYSALIS_NS}hasExecutionConfig`);
    if (llmUri) {
      const provider = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}llmProvider`);
      const model = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}llmModel`);

      if (provider && model) {
        agent['lmos:llmConfig'] = {
          provider,
          model
        };

        const temp = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}temperature`);
        if (temp) agent['lmos:llmConfig'].temperature = parseFloat(temp);

        const maxTokens = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}maxOutputTokens`);
        if (maxTokens) agent['lmos:llmConfig'].maxTokens = parseInt(maxTokens);

        const systemPrompt = this.extractLiteral(quads, llmUri, `${CHRYSALIS_NS}systemPrompt`);
        if (systemPrompt) agent['lmos:llmConfig'].systemPrompt = systemPrompt;
      }
    }

    // ========================================================================
    // Extract Memory Configuration
    // ========================================================================

    const memoryUri = this.extractUri(quads, agentUri, `${CHRYSALIS_NS}hasMemorySystem`);
    if (memoryUri) {
      const typeUris = this.extractUris(quads, memoryUri, `${RDF_NS}type`);
      
      // Find specific memory type
      const memoryTypeMap: Record<string, string> = {
        [`${CHRYSALIS_NS}WorkingMemory`]: 'working',
        [`${CHRYSALIS_NS}EpisodicMemory`]: 'episodic',
        [`${CHRYSALIS_NS}SemanticMemory`]: 'semantic',
        [`${CHRYSALIS_NS}ProceduralMemory`]: 'procedural',
        [`${CHRYSALIS_NS}CoreMemory`]: 'core'
      };

      let memType = 'working';
      for (const tu of typeUris) {
        if (memoryTypeMap[tu]) {
          memType = memoryTypeMap[tu];
          break;
        }
      }

      agent['lmos:memory'] = { type: memType };

      const maxTokens = this.extractLiteral(quads, memoryUri, `${CHRYSALIS_NS}maxTokens`);
      if (maxTokens) agent['lmos:memory'].contextWindow = parseInt(maxTokens);

      const storageBackend = this.extractLiteral(quads, memoryUri, `${CHRYSALIS_NS}storageBackend`);
      if (storageBackend) {
        agent['lmos:memory'].vectorStore = { provider: storageBackend };
      }

      // Restore vector store config from extensions
      const vsExt = canonical.extensions.find(e =>
        e.namespace === 'lmos' && e.property === 'vectorStoreConfig'
      );
      if (vsExt && agent['lmos:memory'].vectorStore) {
        try {
          agent['lmos:memory'].vectorStore.config = JSON.parse(vsExt.value);
        } catch {
          // Ignore
        }
      }
    }

    // ========================================================================
    // Restore Extensions
    // ========================================================================

    // Restore @context
    const contextExt = canonical.extensions.find(e =>
      e.namespace === 'lmos' && e.property === '@context'
    );
    if (contextExt) {
      try {
        agent['@context'] = JSON.parse(contextExt.value);
      } catch {
        // Keep default
      }
    }

    // Restore security definitions
    const secDefExt = canonical.extensions.find(e =>
      e.namespace === 'lmos' && e.property === 'securityDefinitions'
    );
    if (secDefExt) {
      try {
        agent.securityDefinitions = JSON.parse(secDefExt.value);
      } catch {
        // Ignore
      }
    }

    // Restore security
    const secExt = canonical.extensions.find(e =>
      e.namespace === 'lmos' && e.property === 'security'
    );
    if (secExt) {
      try {
        agent.security = JSON.parse(secExt.value);
      } catch {
        agent.security = secExt.value;
      }
    }

    // Restore properties
    const propExtensions = canonical.extensions.filter(e =>
      e.namespace === 'lmos' && e.property.startsWith('property.')
    );
    if (propExtensions.length > 0) {
      agent.properties = {};
      for (const ext of propExtensions) {
        const propName = ext.property.replace('property.', '');
        try {
          agent.properties[propName] = JSON.parse(ext.value);
        } catch {
          // Ignore
        }
      }
    }

    // Restore events
    const eventsExt = canonical.extensions.find(e =>
      e.namespace === 'lmos' && e.property === 'events'
    );
    if (eventsExt) {
      try {
        agent.events = JSON.parse(eventsExt.value);
      } catch {
        // Ignore
      }
    }

    // Restore links
    const linksExt = canonical.extensions.find(e =>
      e.namespace === 'lmos' && e.property === 'links'
    );
    if (linksExt) {
      try {
        agent.links = JSON.parse(linksExt.value);
      } catch {
        // Ignore
      }
    }

    // Restore timestamps
    const createdExt = canonical.extensions.find(e =>
      e.namespace === 'lmos' && e.property === 'created'
    );
    if (createdExt) agent.created = createdExt.value;

    const modifiedExt = canonical.extensions.find(e =>
      e.namespace === 'lmos' && e.property === 'modified'
    );
    if (modifiedExt) agent.modified = modifiedExt.value;

    const baseExt = canonical.extensions.find(e =>
      e.namespace === 'lmos' && e.property === 'base'
    );
    if (baseExt) agent.base = baseExt.value;

    const supportExt = canonical.extensions.find(e =>
      e.namespace === 'lmos' && e.property === 'support'
    );
    if (supportExt) agent.support = supportExt.value;

    return {
      data: agent as unknown as Record<string, unknown>,
      framework: 'lmos',
      version: '1.1',
      source: canonical.uri
    };
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  validateNative(native: NativeAgent): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const agent = native.data as unknown as LMOSAgent;

    // Required: @context
    if (!agent['@context']) {
      errors.push({
        code: 'MISSING_CONTEXT',
        message: '@context is required for JSON-LD documents',
        path: '@context',
        expected: 'W3C WoT TD context'
      });
    }

    // Required: id
    if (!agent.id) {
      errors.push({
        code: 'MISSING_ID',
        message: 'id is required (should be a DID)',
        path: 'id',
        expected: 'did:web:* or similar DID'
      });
    } else if (!agent.id.startsWith('did:')) {
      warnings.push({
        code: 'NON_DID_ID',
        message: 'id should be a Decentralized Identifier (DID)',
        path: 'id'
      });
    }

    // Required: title
    if (!agent.title) {
      errors.push({
        code: 'MISSING_TITLE',
        message: 'title is required',
        path: 'title'
      });
    }

    // Validate security
    if (agent.security && !agent.securityDefinitions) {
      warnings.push({
        code: 'SECURITY_WITHOUT_DEFINITIONS',
        message: 'security references securityDefinitions but none are defined',
        path: 'security'
      });
    }

    // Validate actions have forms
    if (agent.actions) {
      for (const [name, action] of Object.entries(agent.actions)) {
        if (!action.forms || action.forms.length === 0) {
          warnings.push({
            code: 'ACTION_WITHOUT_FORMS',
            message: `Action "${name}" has no forms (endpoints) defined`,
            path: `actions.${name}.forms`
          });
        }
      }
    }

    // Recommend LLM config for LMOS agents
    if (!agent['lmos:llmConfig']) {
      warnings.push({
        code: 'NO_LLM_CONFIG',
        message: 'lmos:llmConfig is recommended for AI agents',
        path: 'lmos:llmConfig'
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
      // Core WoT TD mappings
      { sourcePath: 'title', predicate: `${CHRYSALIS_NS}name`, datatype: 'string', required: true },
      { sourcePath: 'description', predicate: `${CHRYSALIS_NS}description`, datatype: 'string', required: false },
      { sourcePath: 'version.instance', predicate: `${CHRYSALIS_NS}version`, datatype: 'string', required: false },
      { sourcePath: 'id', predicate: `${CHRYSALIS_NS}identifierValue`, datatype: 'string', required: true },
      
      // LMOS extension mappings
      { sourcePath: 'lmos:agentClass', predicate: `${LMOS_NS}agentClass`, datatype: 'string', required: false },
      { sourcePath: 'lmos:llmConfig.provider', predicate: `${CHRYSALIS_NS}llmProvider`, datatype: 'string', required: false },
      { sourcePath: 'lmos:llmConfig.model', predicate: `${CHRYSALIS_NS}llmModel`, datatype: 'string', required: false },
      { sourcePath: 'lmos:llmConfig.temperature', predicate: `${CHRYSALIS_NS}temperature`, datatype: 'float', required: false },
      { sourcePath: 'lmos:llmConfig.maxTokens', predicate: `${CHRYSALIS_NS}maxOutputTokens`, datatype: 'integer', required: false },
      { sourcePath: 'lmos:llmConfig.systemPrompt', predicate: `${CHRYSALIS_NS}systemPrompt`, datatype: 'string', required: false },
    ];
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Extract agent ID from DID or URI
   */
  private extractAgentId(id: string): string {
    // Handle DIDs: did:web:example.com:agent:myagent
    if (id.startsWith('did:')) {
      const parts = id.split(':');
      return parts[parts.length - 1];
    }
    
    // Handle URIs: https://example.com/agent/myagent
    if (id.startsWith('http')) {
      const parts = id.split('/');
      return parts[parts.length - 1];
    }

    return id;
  }

  /**
   * Extract DID scheme from identifier
   */
  private extractDIDScheme(id: string): string {
    if (id.startsWith('did:')) {
      const match = id.match(/^did:([^:]+):/);
      return match ? `did:${match[1]}` : 'did:web';
    }
    return 'uri';
  }

  /**
   * Determine protocol binding type from form
   */
  private determineProtocolType(form: LMOSForm): string {
    const href = form.href.toLowerCase();
    
    if (form.subprotocol === 'websocket' || href.startsWith('wss://') || href.startsWith('ws://')) {
      return 'WebSocketBinding';
    }
    
    if (href.startsWith('https://') || href.startsWith('http://')) {
      return 'HTTPBinding';
    }

    // Default to HTTP
    return 'HTTPBinding';
  }
}

// ============================================================================
// Factory Export
// ============================================================================

export function createLMOSAdapter(config?: AdapterConfig): LMOSAdapter {
  return new LMOSAdapter(config);
}
