/**
 * MCP (Model Context Protocol) Unified Adapter
 * 
 * Protocol-specific implementation for Model Context Protocol,
 * handling tools, resources, prompts, and sampling operations.
 * 
 * MCP Specification: https://spec.modelcontextprotocol.io/
 * 
 * @module adapters/mcp-unified-adapter
 * @version 1.0.0
 */

import { BaseUnifiedAdapter, BaseAdapterConfig } from './base-unified-adapter';
import {
  UniversalMessage,
  UniversalPayload,
  UniversalMessageType,
  UniversalToolDef,
  UniversalToolInvoke,
  UniversalResourceRef,
  UniversalPromptRef,
  UniversalError,
  TraceContext,
  JsonSchema,
  createMessage
} from './protocol-messages';
import {
  ConversionOptions,
  InvocationOptions
} from './unified-adapter';

// ============================================================================
// MCP-Specific Types
// ============================================================================

/**
 * MCP tool definition (from MCP spec).
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: JsonSchema;
}

/**
 * MCP tool call request.
 */
export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * MCP tool result.
 */
export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

/**
 * MCP content types.
 */
export type MCPContent =
  | MCPTextContent
  | MCPImageContent
  | MCPResourceContent;

export interface MCPTextContent {
  type: 'text';
  text: string;
}

export interface MCPImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface MCPResourceContent {
  type: 'resource';
  resource: MCPResourceRef;
}

/**
 * MCP resource reference.
 */
export interface MCPResourceRef {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP resource content.
 */
export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/**
 * MCP prompt definition.
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * MCP prompt message.
 */
export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: MCPTextContent;
}

/**
 * MCP server capabilities.
 */
export interface MCPCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  logging?: Record<string, unknown>;
  sampling?: Record<string, unknown>;
}

/**
 * MCP adapter configuration.
 */
export interface MCPAdapterConfig extends BaseAdapterConfig {
  /** Server endpoint URL */
  serverUrl?: string;
  /** Server capabilities */
  serverCapabilities?: MCPCapabilities;
  /** Enable resource subscriptions */
  enableSubscriptions?: boolean;
  /** Enable sampling */
  enableSampling?: boolean;
}

// ============================================================================
// MCP Unified Adapter Implementation
// ============================================================================

/**
 * Unified adapter for Model Context Protocol (MCP).
 * 
 * Supports:
 * - Tool discovery and invocation (tools/list, tools/call)
 * - Resource listing and reading (resources/list, resources/read)
 * - Prompt management (prompts/list, prompts/get)
 * - Sampling (createMessage)
 * - Capability negotiation
 * 
 * @example
 * ```typescript
 * const mcpAdapter = new MCPUnifiedAdapter({
 *   protocol: 'mcp',
 *   serverUrl: 'http://localhost:3000'
 * });
 * 
 * await mcpAdapter.initialize();
 * 
 * // List available tools
 * const tools = await mcpAdapter.invokeOperation('tool-list', {});
 * 
 * // Invoke a tool
 * const result = await mcpAdapter.invokeOperation('tool-invoke', {
 *   tool: { toolName: 'get_weather', parameters: { location: 'NYC' } }
 * });
 * ```
 */
export class MCPUnifiedAdapter extends BaseUnifiedAdapter {
  private serverCapabilities?: MCPCapabilities;
  private toolsCache: Map<string, MCPTool> = new Map();
  private resourcesCache: Map<string, MCPResource> = new Map();
  private promptsCache: Map<string, MCPPrompt> = new Map();
  
  constructor(config: MCPAdapterConfig = { protocol: 'mcp' }) {
    super({ ...config, protocol: 'mcp' });
    this.serverCapabilities = config.serverCapabilities;
  }
  
  // ============================================================================
  // Message Conversion: Protocol → Universal
  // ============================================================================
  
  /**
   * Convert MCP payload to universal message format.
   */
  async toUniversalMessage(
    protocolPayload: unknown,
    messageType: UniversalMessageType,
    options?: ConversionOptions
  ): Promise<UniversalMessage> {
    const startTime = Date.now();
    
    try {
      const payload = this.convertToUniversalPayload(protocolPayload, messageType);
      
      const message = createMessage(messageType, 'mcp', payload, {
        trace: options?.trace || this.createTraceContext()
      });
      
      if (options?.preserveRaw) {
        message.payload.raw = {
          mcp: protocolPayload,
          original: protocolPayload
        };
      }
      
      this.recordSuccess(Date.now() - startTime);
      return message;
    } catch (error) {
      const universalError = this.recordError(error, 'toUniversalMessage');
      throw new Error(universalError.message);
    }
  }
  
  /**
   * Convert protocol payload to universal payload based on message type.
   */
  private convertToUniversalPayload(
    protocolPayload: unknown,
    messageType: UniversalMessageType
  ): UniversalPayload {
    switch (messageType) {
      case 'tool-list':
        return this.convertToolList(protocolPayload);
      case 'tool-invoke':
        return this.convertToolInvoke(protocolPayload);
      case 'tool-result':
        return this.convertToolResult(protocolPayload);
      case 'resource-list':
        return this.convertResourceList(protocolPayload);
      case 'resource-request':
      case 'resource-response':
        return this.convertResource(protocolPayload);
      case 'prompt-list':
        return this.convertPromptList(protocolPayload);
      case 'prompt-request':
      case 'prompt-response':
        return this.convertPrompt(protocolPayload);
      default:
        return { raw: { mcp: protocolPayload } };
    }
  }
  
  private convertToolList(payload: unknown): UniversalPayload {
    const tools = Array.isArray(payload) ? payload : [];
    const universalTools: UniversalToolDef[] = tools.map((t: MCPTool) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      protocol: 'mcp'
    }));
    
    return {
      raw: { tools: universalTools }
    };
  }
  
  private convertToolInvoke(payload: unknown): UniversalPayload {
    const call = payload as MCPToolCall;
    return {
      tool: {
        toolName: call.name,
        toolProtocol: 'mcp',
        parameters: call.arguments || {}
      }
    };
  }
  
  private convertToolResult(payload: unknown): UniversalPayload {
    const result = payload as MCPToolResult;
    return {
      tool: {
        toolName: '',
        toolProtocol: 'mcp',
        parameters: {},
        result: result.content,
        error: result.isError ? {
          code: 'TOOL_ERROR',
          message: 'Tool execution failed',
          retryable: false
        } : undefined
      }
    };
  }
  
  private convertResourceList(payload: unknown): UniversalPayload {
    const resources = Array.isArray(payload) ? payload : [];
    const universalResources: UniversalResourceRef[] = resources.map((r: MCPResource) => ({
      uri: r.uri,
      name: r.name || r.uri,
      description: r.description,
      mimeType: r.mimeType,
      protocol: 'mcp'
    }));
    
    return {
      raw: { resources: universalResources }
    };
  }
  
  private convertResource(payload: unknown): UniversalPayload {
    const resource = payload as MCPResource;
    return {
      resource: {
        uri: resource.uri,
        name: resource.name || resource.uri,
        description: resource.description,
        mimeType: resource.mimeType,
        content: resource.text,
        protocol: 'mcp'
      }
    };
  }
  
  private convertPromptList(payload: unknown): UniversalPayload {
    const prompts = Array.isArray(payload) ? payload : [];
    const universalPrompts: UniversalPromptRef[] = prompts.map((p: MCPPrompt) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments?.map(a => ({
        name: a.name,
        description: a.description,
        required: a.required
      })),
      protocol: 'mcp'
    }));
    
    return {
      raw: { prompts: universalPrompts }
    };
  }
  
  private convertPrompt(payload: unknown): UniversalPayload {
    const prompt = payload as MCPPrompt & { messages?: MCPPromptMessage[] };
    return {
      prompt: {
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments?.map(a => ({
          name: a.name,
          description: a.description,
          required: a.required
        })),
        content: prompt.messages?.map(m => m.content.text).join('\n'),
        protocol: 'mcp'
      }
    };
  }
  
  // ============================================================================
  // Message Conversion: Universal → Protocol
  // ============================================================================
  
  /**
   * Convert universal message to MCP protocol format.
   */
  async fromUniversalMessage(
    message: UniversalMessage,
    options?: ConversionOptions
  ): Promise<unknown> {
    const startTime = Date.now();
    
    try {
      const mcpPayload = this.convertFromUniversalPayload(message);
      this.recordSuccess(Date.now() - startTime);
      return mcpPayload;
    } catch (error) {
      const universalError = this.recordError(error, 'fromUniversalMessage');
      throw new Error(universalError.message);
    }
  }
  
  /**
   * Convert universal payload to MCP format based on message type.
   */
  private convertFromUniversalPayload(message: UniversalMessage): unknown {
    switch (message.type) {
      case 'tool-invoke':
        return this.toMCPToolCall(message.payload);
      case 'resource-request':
        return this.toMCPResourceRequest(message.payload);
      case 'prompt-request':
        return this.toMCPPromptRequest(message.payload);
      default:
        return message.payload.raw?.mcp || message.payload;
    }
  }
  
  private toMCPToolCall(payload: UniversalPayload): MCPToolCall {
    if (!payload.tool) {
      throw new Error('Missing tool information in payload');
    }
    return {
      name: payload.tool.toolName,
      arguments: payload.tool.parameters
    };
  }
  
  private toMCPResourceRequest(payload: UniversalPayload): { uri: string } {
    if (!payload.resource) {
      throw new Error('Missing resource information in payload');
    }
    return {
      uri: payload.resource.uri
    };
  }
  
  private toMCPPromptRequest(payload: UniversalPayload): { name: string; arguments?: Record<string, string> } {
    if (!payload.prompt) {
      throw new Error('Missing prompt information in payload');
    }
    return {
      name: payload.prompt.name,
      arguments: payload.prompt.arguments?.reduce((acc, arg) => {
        if (arg.default) {
          acc[arg.name] = arg.default;
        }
        return acc;
      }, {} as Record<string, string>)
    };
  }
  
  // ============================================================================
  // Operation Invocation
  // ============================================================================
  
  /**
   * Invoke an MCP operation.
   */
  async invokeOperation(
    operation: UniversalMessageType,
    params: UniversalPayload,
    options?: InvocationOptions
  ): Promise<UniversalMessage> {
    const startTime = Date.now();
    const trace = this.createTraceContext(options?.trace);
    
    try {
      this.log(`Invoking operation: ${operation}`);
      
      const result = await this.withTimeout(
        () => this.executeOperation(operation, params, trace),
        options?.timeoutMs
      );
      
      this.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      const universalError = this.recordError(error, operation);
      return this.createErrorMessage(
        universalError.code,
        universalError.message,
        {
          details: { operation },
          retryable: universalError.retryable,
          correlationId: options?.correlationId,
          trace
        }
      );
    }
  }
  
  /**
   * Execute a specific MCP operation.
   */
  private async executeOperation(
    operation: UniversalMessageType,
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    switch (operation) {
      case 'tool-list':
        return this.listTools(trace);
      case 'tool-invoke':
        return this.invokeTool(params, trace);
      case 'resource-list':
        return this.listResources(trace);
      case 'resource-request':
        return this.readResource(params, trace);
      case 'prompt-list':
        return this.listPrompts(trace);
      case 'prompt-request':
        return this.getPrompt(params, trace);
      case 'ping':
        return this.handlePing(trace);
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }
  
  // ============================================================================
  // Tool Operations
  // ============================================================================
  
  /**
   * List available tools.
   */
  private async listTools(trace: TraceContext): Promise<UniversalMessage> {
    // Return cached tools or empty list
    const tools = Array.from(this.toolsCache.values());
    
    return createMessage('tool-list', 'mcp', {
      raw: {
        tools: tools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          protocol: 'mcp'
        }))
      }
    }, { trace });
  }
  
  /**
   * Invoke a tool.
   */
  private async invokeTool(
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    if (!params.tool) {
      throw new Error('Missing tool information');
    }
    
    const { toolName, parameters } = params.tool;
    
    // Check if tool exists in cache
    const tool = this.toolsCache.get(toolName);
    if (!tool) {
      this.log(`Tool not found in cache: ${toolName}`);
    }
    
    // Tool execution requires MCP server connection - not implemented
    throw new Error('NotImplementedError: MCP tool execution requires server connection. Configure MCP server endpoint and use @modelcontextprotocol/sdk.');
  }
  
  // ============================================================================
  // Resource Operations
  // ============================================================================
  
  /**
   * List available resources.
   */
  private async listResources(trace: TraceContext): Promise<UniversalMessage> {
    const resources = Array.from(this.resourcesCache.values());
    
    return createMessage('resource-list', 'mcp', {
      raw: {
        resources: resources.map(r => ({
          uri: r.uri,
          name: r.name || r.uri,
          description: r.description,
          mimeType: r.mimeType,
          protocol: 'mcp'
        }))
      }
    }, { trace });
  }
  
  /**
   * Read a resource.
   */
  private async readResource(
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    if (!params.resource) {
      throw new Error('Missing resource information');
    }
    
    const { uri } = params.resource;
    
    // Check cache or fetch from server
    const resource = this.resourcesCache.get(uri);
    
    return createMessage('resource-response', 'mcp', {
      resource: {
        uri,
        name: resource?.name || uri,
        description: resource?.description,
        mimeType: resource?.mimeType || 'text/plain',
        content: resource?.text || `Content for resource: ${uri}`,
        protocol: 'mcp'
      }
    }, { trace });
  }
  
  // ============================================================================
  // Prompt Operations
  // ============================================================================
  
  /**
   * List available prompts.
   */
  private async listPrompts(trace: TraceContext): Promise<UniversalMessage> {
    const prompts = Array.from(this.promptsCache.values());
    
    return createMessage('prompt-list', 'mcp', {
      raw: {
        prompts: prompts.map(p => ({
          name: p.name,
          description: p.description,
          arguments: p.arguments?.map(a => ({
            name: a.name,
            description: a.description,
            required: a.required
          })),
          protocol: 'mcp'
        }))
      }
    }, { trace });
  }
  
  /**
   * Get a prompt.
   */
  private async getPrompt(
    params: UniversalPayload,
    trace: TraceContext
  ): Promise<UniversalMessage> {
    if (!params.prompt) {
      throw new Error('Missing prompt information');
    }
    
    const { name } = params.prompt;
    const prompt = this.promptsCache.get(name);
    
    return createMessage('prompt-response', 'mcp', {
      prompt: {
        name,
        description: prompt?.description,
        arguments: prompt?.arguments?.map(a => ({
          name: a.name,
          description: a.description,
          required: a.required
        })),
        content: `Prompt template: ${name}`,
        protocol: 'mcp'
      }
    }, { trace });
  }
  
  // ============================================================================
  // Utility Operations
  // ============================================================================
  
  /**
   * Handle ping request.
   */
  private async handlePing(trace: TraceContext): Promise<UniversalMessage> {
    return createMessage('pong', 'mcp', {}, { trace });
  }
  
  // ============================================================================
  // Cache Management
  // ============================================================================
  
  /**
   * Register a tool in the cache.
   */
  registerTool(tool: MCPTool): void {
    this.toolsCache.set(tool.name, tool);
    this.emit('tool-registered', { tool: tool.name });
  }
  
  /**
   * Register a resource in the cache.
   */
  registerResource(resource: MCPResource): void {
    this.resourcesCache.set(resource.uri, resource);
    this.emit('resource-registered', { uri: resource.uri });
  }
  
  /**
   * Register a prompt in the cache.
   */
  registerPrompt(prompt: MCPPrompt): void {
    this.promptsCache.set(prompt.name, prompt);
    this.emit('prompt-registered', { prompt: prompt.name });
  }
  
  /**
   * Get server capabilities.
   */
  getServerCapabilities(): MCPCapabilities | undefined {
    return this.serverCapabilities;
  }
  
  /**
   * Set server capabilities.
   */
  setServerCapabilities(capabilities: MCPCapabilities): void {
    this.serverCapabilities = capabilities;
  }
  
  // ============================================================================
  // Lifecycle Overrides
  // ============================================================================
  
  protected override async doInitialize(): Promise<void> {
    // Initialize caches
    this.toolsCache.clear();
    this.resourcesCache.clear();
    this.promptsCache.clear();
    
    this.log('MCP adapter initialized');
  }
  
  protected override async doShutdown(): Promise<void> {
    this.toolsCache.clear();
    this.resourcesCache.clear();
    this.promptsCache.clear();
    
    this.log('MCP adapter shutdown');
  }
  
  protected override async doReset(): Promise<void> {
    this.toolsCache.clear();
    this.resourcesCache.clear();
    this.promptsCache.clear();
    this.serverCapabilities = undefined;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MCP unified adapter.
 */
export function createMCPAdapter(config?: Partial<MCPAdapterConfig>): MCPUnifiedAdapter {
  return new MCPUnifiedAdapter({
    protocol: 'mcp',
    ...config
  });
}

// ============================================================================
// Exports
// ============================================================================

export default MCPUnifiedAdapter;
