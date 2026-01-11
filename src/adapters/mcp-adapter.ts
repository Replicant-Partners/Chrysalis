/**
 * MCP (Model Context Protocol) Adapter
 * 
 * Bidirectional translation between Anthropic's Model Context Protocol
 * and the Chrysalis canonical agent ontology.
 * 
 * MCP defines agents primarily as tool providers with:
 * - Server configurations (stdio, HTTP, SSE)
 * - Tool definitions with JSON Schema
 * - Resource providers for context
 * - Prompt templates
 * 
 * @see https://modelcontextprotocol.io/
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
  TranslationWarning
} from './base-adapter';

import {
  Quad,
  DataFactory,
  CHRYSALIS_NS,
  RDF_NS,
  XSD_NS
} from '../rdf/temporal-store';

// ============================================================================
// MCP Type Definitions
// ============================================================================

/**
 * MCP Server configuration
 */
export interface MCPServer {
  name: string;
  version?: string;
  description?: string;
  transport: MCPTransport;
  capabilities?: MCPCapabilities;
  tools?: MCPTool[];
  resources?: MCPResource[];
  prompts?: MCPPrompt[];
  // Extensions
  'x-chrysalis'?: Record<string, unknown>;
}

/**
 * Transport configuration for MCP server
 */
export interface MCPTransport {
  type: 'stdio' | 'http' | 'sse' | 'websocket';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

/**
 * Server capabilities declaration
 */
export interface MCPCapabilities {
  tools?: boolean | { listChanged?: boolean };
  resources?: boolean | { subscribe?: boolean; listChanged?: boolean };
  prompts?: boolean | { listChanged?: boolean };
  logging?: boolean;
  experimental?: Record<string, unknown>;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: MCPJsonSchema;
  // Extensions
  'x-protocol'?: string;
  'x-endpoint'?: string;
}

/**
 * JSON Schema subset used by MCP
 */
export interface MCPJsonSchema {
  type: string;
  properties?: Record<string, MCPJsonSchema>;
  required?: string[];
  items?: MCPJsonSchema;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  // Additional JSON Schema properties
  [key: string]: unknown;
}

/**
 * MCP Resource definition
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP Prompt template
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

/**
 * Prompt argument definition
 */
export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * MCP Client configuration (for agent-as-client scenarios)
 */
export interface MCPClient {
  name: string;
  version?: string;
  servers: MCPClientServerRef[];
}

/**
 * Reference to an MCP server from client config
 */
export interface MCPClientServerRef {
  name: string;
  transport: MCPTransport;
  capabilities?: string[];
}

// ============================================================================
// MCP Adapter Configuration
// ============================================================================

export interface MCPAdapterConfig extends AdapterConfig {
  /** Parse as server (default) or client configuration */
  mode?: 'server' | 'client';
  /** Default transport type if not specified */
  defaultTransport?: 'stdio' | 'http';
  /** Validate JSON schemas in tool definitions */
  validateSchemas?: boolean;
}

// ============================================================================
// MCP Namespaces
// ============================================================================

const MCP_NS = 'https://modelcontextprotocol.io/ns#';

// ============================================================================
// MCP Adapter Implementation
// ============================================================================

export class MCPAdapter extends BaseAdapter {
  readonly framework = 'mcp' as const;
  readonly name = 'Anthropic MCP Adapter';
  readonly version = '1.0.0';
  readonly extensionNamespace = MCP_NS;

  private mcpConfig: MCPAdapterConfig;

  constructor(config: MCPAdapterConfig = {}) {
    super(config);
    this.mcpConfig = {
      mode: 'server',
      defaultTransport: 'stdio',
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
        sourcePath: 'version',
        predicate: `${CHRYSALIS_NS}version`,
        datatype: 'string',
        required: false
      },
      {
        sourcePath: 'description',
        predicate: `${CHRYSALIS_NS}description`,
        datatype: 'string',
        required: false
      },

      // Transport configuration
      {
        sourcePath: 'transport.type',
        predicate: `${MCP_NS}transportType`,
        datatype: 'string',
        required: true
      },
      {
        sourcePath: 'transport.command',
        predicate: `${MCP_NS}command`,
        datatype: 'string',
        required: false
      },
      {
        sourcePath: 'transport.url',
        predicate: `${MCP_NS}url`,
        datatype: 'uri',
        required: false
      },

      // Capabilities
      {
        sourcePath: 'capabilities.tools',
        predicate: `${CHRYSALIS_NS}hasToolCapability`,
        datatype: 'boolean',
        required: false
      },
      {
        sourcePath: 'capabilities.resources',
        predicate: `${MCP_NS}hasResourceCapability`,
        datatype: 'boolean',
        required: false
      },
      {
        sourcePath: 'capabilities.prompts',
        predicate: `${MCP_NS}hasPromptCapability`,
        datatype: 'boolean',
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
    const data = agent.data as unknown as MCPServer | MCPClient;

    // Check required name field
    if (!data.name) {
      errors.push({
        code: 'MISSING_NAME',
        message: 'MCP server/client must have a name',
        path: 'name'
      });
    }

    // Validate based on mode
    if (this.mcpConfig.mode === 'server') {
      const server = data as MCPServer;
      
      // Transport is required for servers
      if (!server.transport) {
        errors.push({
          code: 'MISSING_TRANSPORT',
          message: 'MCP server must have transport configuration',
          path: 'transport'
        });
      } else {
        // Validate transport type
        const validTransports = ['stdio', 'http', 'sse', 'websocket'];
        if (!validTransports.includes(server.transport.type)) {
          errors.push({
            code: 'INVALID_TRANSPORT',
            message: `Invalid transport type: ${server.transport.type}`,
            path: 'transport.type'
          });
        }

        // stdio requires command
        if (server.transport.type === 'stdio' && !server.transport.command) {
          warnings.push({
            code: 'MISSING_COMMAND',
            message: 'stdio transport should have a command specified',
            path: 'transport.command'
          });
        }

        // http/sse/websocket requires url
        if (['http', 'sse', 'websocket'].includes(server.transport.type) && !server.transport.url) {
          errors.push({
            code: 'MISSING_URL',
            message: `${server.transport.type} transport requires URL`,
            path: 'transport.url'
          });
        }
      }

      // Validate tools if present
      if (server.tools) {
        server.tools.forEach((tool, idx) => {
          if (!tool.name) {
            errors.push({
              code: 'TOOL_MISSING_NAME',
              message: `Tool at index ${idx} must have a name`,
              path: `tools[${idx}].name`
            });
          }
          if (!tool.inputSchema) {
            warnings.push({
              code: 'TOOL_MISSING_SCHEMA',
              message: `Tool '${tool.name}' has no input schema`,
              path: `tools[${idx}].inputSchema`
            });
          }
        });
      }

      // Warn if no capabilities declared
      if (!server.capabilities) {
        warnings.push({
          code: 'NO_CAPABILITIES',
          message: 'Server has no capabilities declared',
          path: 'capabilities'
        });
      }

    } else {
      // Client mode validation
      const client = data as MCPClient;
      
      if (!client.servers || client.servers.length === 0) {
        warnings.push({
          code: 'NO_SERVERS',
          message: 'MCP client has no server references',
          path: 'servers'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // --------------------------------------------------------------------------
  // Forward Translation (MCP → Canonical)
  // --------------------------------------------------------------------------

  async toCanonical(native: NativeAgent): Promise<CanonicalAgent> {
    const startTime = Date.now();
    const validation = this.validateNative(native);
    if (!validation.valid && this.config.strict) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const data = native.data as unknown as MCPServer;
    const agentUri = this.generateMCPAgentUri(data.name);
    const quads: Quad[] = [];
    const extensions: ExtensionProperty[] = [];
    const mappedFields: string[] = [];
    const unmappedFields: string[] = [];
    const lostFields: string[] = [];

    // Type declaration
    quads.push(DataFactory.quad(
      DataFactory.namedNode(agentUri),
      DataFactory.namedNode(`${RDF_NS}type`),
      DataFactory.namedNode(`${CHRYSALIS_NS}Agent`)
    ));

    // Mark as MCP agent type
    quads.push(DataFactory.quad(
      DataFactory.namedNode(agentUri),
      DataFactory.namedNode(`${RDF_NS}type`),
      DataFactory.namedNode(`${MCP_NS}Server`)
    ));

    // Core properties
    quads.push(DataFactory.quad(
      DataFactory.namedNode(agentUri),
      DataFactory.namedNode(`${CHRYSALIS_NS}name`),
      DataFactory.literal(data.name)
    ));
    mappedFields.push('name');

    if (data.version) {
      quads.push(DataFactory.quad(
        DataFactory.namedNode(agentUri),
        DataFactory.namedNode(`${CHRYSALIS_NS}version`),
        DataFactory.literal(data.version)
      ));
      mappedFields.push('version');
    }

    if (data.description) {
      quads.push(DataFactory.quad(
        DataFactory.namedNode(agentUri),
        DataFactory.namedNode(`${CHRYSALIS_NS}description`),
        DataFactory.literal(data.description)
      ));
      mappedFields.push('description');
    }

    // Transport configuration as nested node
    if (data.transport) {
      const transportUri = `${agentUri}/transport`;
      
      quads.push(DataFactory.quad(
        DataFactory.namedNode(agentUri),
        DataFactory.namedNode(`${MCP_NS}transport`),
        DataFactory.namedNode(transportUri)
      ));

      quads.push(DataFactory.quad(
        DataFactory.namedNode(transportUri),
        DataFactory.namedNode(`${MCP_NS}transportType`),
        DataFactory.literal(data.transport.type)
      ));
      mappedFields.push('transport.type');

      if (data.transport.command) {
        quads.push(DataFactory.quad(
          DataFactory.namedNode(transportUri),
          DataFactory.namedNode(`${MCP_NS}command`),
          DataFactory.literal(data.transport.command)
        ));
        mappedFields.push('transport.command');
      }

      if (data.transport.args) {
        quads.push(DataFactory.quad(
          DataFactory.namedNode(transportUri),
          DataFactory.namedNode(`${MCP_NS}args`),
          DataFactory.literal(JSON.stringify(data.transport.args))
        ));
        mappedFields.push('transport.args');
      }

      if (data.transport.url) {
        quads.push(DataFactory.quad(
          DataFactory.namedNode(transportUri),
          DataFactory.namedNode(`${MCP_NS}url`),
          DataFactory.namedNode(data.transport.url)
        ));
        mappedFields.push('transport.url');
      }

      if (data.transport.env) {
        // Store env as extension (sensitive data)
        extensions.push({
          namespace: 'mcp',
          property: 'transport.env',
          value: JSON.stringify(data.transport.env),
          sourcePath: 'transport.env'
        });
        unmappedFields.push('transport.env');
      }

      if (data.transport.headers) {
        extensions.push({
          namespace: 'mcp',
          property: 'transport.headers',
          value: JSON.stringify(data.transport.headers),
          sourcePath: 'transport.headers'
        });
        unmappedFields.push('transport.headers');
      }
    }

    // Convert tools to canonical tool format
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

        // Protocol is MCP by default
        quads.push(DataFactory.quad(
          DataFactory.namedNode(toolUri),
          DataFactory.namedNode(`${CHRYSALIS_NS}toolProtocol`),
          DataFactory.literal(tool['x-protocol'] || 'mcp')
        ));

        // Store full schema as extension
        if (tool.inputSchema) {
          extensions.push({
            namespace: 'mcp',
            property: `tool.${tool.name}.inputSchema`,
            value: JSON.stringify(tool.inputSchema),
            sourcePath: `tools.${tool.name}.inputSchema`
          });
        }
        mappedFields.push(`tools.${tool.name}`);
      }
    }

    // Convert resources
    if (data.resources) {
      for (const resource of data.resources) {
        const resourceUri = `${agentUri}/resource/${this.slugify(resource.name)}`;
        
        quads.push(DataFactory.quad(
          DataFactory.namedNode(agentUri),
          DataFactory.namedNode(`${MCP_NS}hasResource`),
          DataFactory.namedNode(resourceUri)
        ));

        quads.push(DataFactory.quad(
          DataFactory.namedNode(resourceUri),
          DataFactory.namedNode(`${RDF_NS}type`),
          DataFactory.namedNode(`${MCP_NS}Resource`)
        ));

        quads.push(DataFactory.quad(
          DataFactory.namedNode(resourceUri),
          DataFactory.namedNode(`${MCP_NS}resourceUri`),
          DataFactory.namedNode(resource.uri)
        ));

        quads.push(DataFactory.quad(
          DataFactory.namedNode(resourceUri),
          DataFactory.namedNode(`${CHRYSALIS_NS}name`),
          DataFactory.literal(resource.name)
        ));

        if (resource.description) {
          quads.push(DataFactory.quad(
            DataFactory.namedNode(resourceUri),
            DataFactory.namedNode(`${CHRYSALIS_NS}description`),
            DataFactory.literal(resource.description)
          ));
        }

        if (resource.mimeType) {
          quads.push(DataFactory.quad(
            DataFactory.namedNode(resourceUri),
            DataFactory.namedNode(`${MCP_NS}mimeType`),
            DataFactory.literal(resource.mimeType)
          ));
        }
        mappedFields.push(`resources.${resource.name}`);
      }
    }

    // Convert prompts
    if (data.prompts) {
      for (const prompt of data.prompts) {
        const promptUri = `${agentUri}/prompt/${this.slugify(prompt.name)}`;
        
        quads.push(DataFactory.quad(
          DataFactory.namedNode(agentUri),
          DataFactory.namedNode(`${MCP_NS}hasPrompt`),
          DataFactory.namedNode(promptUri)
        ));

        quads.push(DataFactory.quad(
          DataFactory.namedNode(promptUri),
          DataFactory.namedNode(`${RDF_NS}type`),
          DataFactory.namedNode(`${MCP_NS}Prompt`)
        ));

        quads.push(DataFactory.quad(
          DataFactory.namedNode(promptUri),
          DataFactory.namedNode(`${CHRYSALIS_NS}name`),
          DataFactory.literal(prompt.name)
        ));

        if (prompt.description) {
          quads.push(DataFactory.quad(
            DataFactory.namedNode(promptUri),
            DataFactory.namedNode(`${CHRYSALIS_NS}description`),
            DataFactory.literal(prompt.description)
          ));
        }

        // Store arguments as extension
        if (prompt.arguments) {
          extensions.push({
            namespace: 'mcp',
            property: `prompt.${prompt.name}.arguments`,
            value: JSON.stringify(prompt.arguments),
            sourcePath: `prompts.${prompt.name}.arguments`
          });
        }
        mappedFields.push(`prompts.${prompt.name}`);
      }
    }

    // Capabilities as protocol support
    if (data.capabilities) {
      const capsUri = `${agentUri}/capabilities`;
      
      quads.push(DataFactory.quad(
        DataFactory.namedNode(agentUri),
        DataFactory.namedNode(`${CHRYSALIS_NS}hasCapabilities`),
        DataFactory.namedNode(capsUri)
      ));

      if (data.capabilities.tools) {
        quads.push(DataFactory.quad(
          DataFactory.namedNode(capsUri),
          DataFactory.namedNode(`${CHRYSALIS_NS}supportsTools`),
          DataFactory.literal('true', DataFactory.namedNode(`${XSD_NS}boolean`))
        ));
        mappedFields.push('capabilities.tools');
      }

      if (data.capabilities.resources) {
        quads.push(DataFactory.quad(
          DataFactory.namedNode(capsUri),
          DataFactory.namedNode(`${MCP_NS}supportsResources`),
          DataFactory.literal('true', DataFactory.namedNode(`${XSD_NS}boolean`))
        ));
        mappedFields.push('capabilities.resources');
      }

      if (data.capabilities.prompts) {
        quads.push(DataFactory.quad(
          DataFactory.namedNode(capsUri),
          DataFactory.namedNode(`${MCP_NS}supportsPrompts`),
          DataFactory.literal('true', DataFactory.namedNode(`${XSD_NS}boolean`))
        ));
        mappedFields.push('capabilities.prompts');
      }

      if (data.capabilities.logging) {
        quads.push(DataFactory.quad(
          DataFactory.namedNode(capsUri),
          DataFactory.namedNode(`${MCP_NS}supportsLogging`),
          DataFactory.literal('true', DataFactory.namedNode(`${XSD_NS}boolean`))
        ));
        mappedFields.push('capabilities.logging');
      }

      // Store experimental capabilities as extension
      if (data.capabilities.experimental) {
        extensions.push({
          namespace: 'mcp',
          property: 'capabilities.experimental',
          value: JSON.stringify(data.capabilities.experimental),
          sourcePath: 'capabilities.experimental'
        });
        unmappedFields.push('capabilities.experimental');
      }
    }

    // Store x-chrysalis extensions
    if (data['x-chrysalis']) {
      extensions.push({
        namespace: 'chrysalis',
        property: 'extensions',
        value: JSON.stringify(data['x-chrysalis']),
        sourcePath: 'x-chrysalis'
      });
      unmappedFields.push('x-chrysalis');
    }

    // Convert validation warnings to translation warnings
    const translationWarnings: TranslationWarning[] = validation.warnings.map(w => ({
      severity: 'warning' as const,
      code: w.code,
      message: w.message,
      sourcePath: w.path
    }));

    const metadata: TranslationMetadata = this.createMetadata(
      startTime,
      mappedFields,
      unmappedFields,
      lostFields,
      translationWarnings
    );

    return {
      uri: agentUri,
      sourceFramework: 'mcp',
      quads,
      extensions,
      metadata
    };
  }

  // --------------------------------------------------------------------------
  // Reverse Translation (Canonical → MCP)
  // --------------------------------------------------------------------------

  async fromCanonical(canonical: CanonicalAgent): Promise<NativeAgent> {
    const server: MCPServer = {
      name: '',
      transport: {
        type: this.mcpConfig.defaultTransport || 'stdio'
      }
    };

    // Extract core properties from quads
    for (const quad of canonical.quads) {
      const subject = quad.subject.value;
      const predicate = quad.predicate.value;
      const object = quad.object.value;

      // Only process main agent node properties directly
      if (subject === canonical.uri) {
        if (predicate === `${CHRYSALIS_NS}name`) {
          server.name = object;
        } else if (predicate === `${CHRYSALIS_NS}version`) {
          server.version = object;
        } else if (predicate === `${CHRYSALIS_NS}description`) {
          server.description = object;
        }
      }
    }

    // Extract transport configuration
    const transportTriple = canonical.quads.find(q => 
      q.subject.value === canonical.uri &&
      q.predicate.value === `${MCP_NS}transport`
    );

    if (transportTriple) {
      const transportUri = transportTriple.object.value;
      
      for (const quad of canonical.quads) {
        if (quad.subject.value === transportUri) {
          const predicate = quad.predicate.value;
          const value = quad.object.value;

          if (predicate === `${MCP_NS}transportType`) {
            server.transport.type = value as MCPTransport['type'];
          } else if (predicate === `${MCP_NS}command`) {
            server.transport.command = value;
          } else if (predicate === `${MCP_NS}url`) {
            server.transport.url = value;
          } else if (predicate === `${MCP_NS}args`) {
            try {
              server.transport.args = JSON.parse(value);
            } catch {
              server.transport.args = [value];
            }
          }
        }
      }
    }

    // Restore transport env and headers from extensions
    const envExt = canonical.extensions.find(e => e.property === 'transport.env');
    if (envExt) {
      try {
        server.transport.env = JSON.parse(envExt.value) as Record<string, string>;
      } catch {
        // If JSON parse fails, skip
      }
    }

    const headersExt = canonical.extensions.find(e => e.property === 'transport.headers');
    if (headersExt) {
      try {
        server.transport.headers = JSON.parse(headersExt.value) as Record<string, string>;
      } catch {
        // If JSON parse fails, skip
      }
    }

    // Extract tools
    const toolTriples = canonical.quads.filter(q =>
      q.subject.value === canonical.uri &&
      q.predicate.value === `${CHRYSALIS_NS}hasTool`
    );

    if (toolTriples.length > 0) {
      server.tools = [];
      
      for (const toolTriple of toolTriples) {
        const toolUri = toolTriple.object.value;
        const tool: MCPTool = {
          name: '',
          inputSchema: { type: 'object' }
        };

        for (const quad of canonical.quads) {
          if (quad.subject.value === toolUri) {
            const predicate = quad.predicate.value;
            const value = quad.object.value;

            if (predicate === `${CHRYSALIS_NS}toolName`) {
              tool.name = value;
            } else if (predicate === `${CHRYSALIS_NS}description`) {
              tool.description = value;
            } else if (predicate === `${CHRYSALIS_NS}toolProtocol`) {
              tool['x-protocol'] = value;
            }
          }
        }

        // Restore input schema from extensions
        const schemaExt = canonical.extensions.find(e => e.property === `tool.${tool.name}.inputSchema`);
        if (schemaExt) {
          try {
            tool.inputSchema = JSON.parse(schemaExt.value) as MCPJsonSchema;
          } catch {
            // If parse fails, use default
          }
        }

        if (tool.name) {
          server.tools.push(tool);
        }
      }
    }

    // Extract resources
    const resourceTriples = canonical.quads.filter(q =>
      q.subject.value === canonical.uri &&
      q.predicate.value === `${MCP_NS}hasResource`
    );

    if (resourceTriples.length > 0) {
      server.resources = [];
      
      for (const resTriple of resourceTriples) {
        const resUri = resTriple.object.value;
        const resource: MCPResource = {
          uri: '',
          name: ''
        };

        for (const quad of canonical.quads) {
          if (quad.subject.value === resUri) {
            const predicate = quad.predicate.value;
            const value = quad.object.value;

            if (predicate === `${MCP_NS}resourceUri`) {
              resource.uri = value;
            } else if (predicate === `${CHRYSALIS_NS}name`) {
              resource.name = value;
            } else if (predicate === `${CHRYSALIS_NS}description`) {
              resource.description = value;
            } else if (predicate === `${MCP_NS}mimeType`) {
              resource.mimeType = value;
            }
          }
        }

        if (resource.uri && resource.name) {
          server.resources.push(resource);
        }
      }
    }

    // Extract prompts
    const promptTriples = canonical.quads.filter(q =>
      q.subject.value === canonical.uri &&
      q.predicate.value === `${MCP_NS}hasPrompt`
    );

    if (promptTriples.length > 0) {
      server.prompts = [];
      
      for (const promptTriple of promptTriples) {
        const promptUri = promptTriple.object.value;
        const prompt: MCPPrompt = { name: '' };

        for (const quad of canonical.quads) {
          if (quad.subject.value === promptUri) {
            const predicate = quad.predicate.value;
            const value = quad.object.value;

            if (predicate === `${CHRYSALIS_NS}name`) {
              prompt.name = value;
            } else if (predicate === `${CHRYSALIS_NS}description`) {
              prompt.description = value;
            }
          }
        }

        // Restore arguments from extensions
        const argsExt = canonical.extensions.find(e => e.property === `prompt.${prompt.name}.arguments`);
        if (argsExt) {
          try {
            prompt.arguments = JSON.parse(argsExt.value) as MCPPromptArgument[];
          } catch {
            // If parse fails, skip
          }
        }

        if (prompt.name) {
          server.prompts.push(prompt);
        }
      }
    }

    // Extract capabilities
    const capsTriple = canonical.quads.find(q =>
      q.subject.value === canonical.uri &&
      q.predicate.value === `${CHRYSALIS_NS}hasCapabilities`
    );

    if (capsTriple) {
      const capsUri = capsTriple.object.value;
      server.capabilities = {};

      for (const quad of canonical.quads) {
        if (quad.subject.value === capsUri) {
          const predicate = quad.predicate.value;
          const value = quad.object.value === 'true';

          if (predicate === `${CHRYSALIS_NS}supportsTools`) {
            server.capabilities.tools = value;
          } else if (predicate === `${MCP_NS}supportsResources`) {
            server.capabilities.resources = value;
          } else if (predicate === `${MCP_NS}supportsPrompts`) {
            server.capabilities.prompts = value;
          } else if (predicate === `${MCP_NS}supportsLogging`) {
            server.capabilities.logging = value;
          }
        }
      }

      // Restore experimental from extensions
      const expExt = canonical.extensions.find(e => e.property === 'capabilities.experimental');
      if (expExt) {
        try {
          server.capabilities.experimental = JSON.parse(expExt.value) as Record<string, unknown>;
        } catch {
          // If parse fails, skip
        }
      }
    }

    // Restore x-chrysalis extensions
    const chrysalisExt = canonical.extensions.find(e => 
      e.namespace === 'chrysalis' && e.property === 'extensions'
    );
    if (chrysalisExt) {
      try {
        server['x-chrysalis'] = JSON.parse(chrysalisExt.value) as Record<string, unknown>;
      } catch {
        // If parse fails, skip
      }
    }

    return {
      data: server as unknown as Record<string, unknown>,
      framework: 'mcp'
    };
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private generateMCPAgentUri(name: string): string {
    const slug = this.slugify(name);
    return `https://chrysalis.dev/agent/mcp/${slug}`;
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

export function createMCPAdapter(config?: MCPAdapterConfig): MCPAdapter {
  return new MCPAdapter(config);
}
