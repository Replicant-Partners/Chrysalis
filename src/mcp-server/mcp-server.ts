/**
 * MCP Server Implementation
 * 
 * Exposes Chrysalis capabilities as an MCP server that external clients
 * (Claude Desktop, VS Code extensions, etc.) can connect to.
 * 
 * @module mcp-server/mcp-server
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { NotImplementedError } from './chrysalis-tools';
import {
  // JSON-RPC types
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  JSON_RPC_ERROR_CODES,
  
  // MCP types
  MCP_PROTOCOL_VERSION,
  MCPServerCapabilities,
  MCPClientCapabilities,
  MCPServerInfo,
  MCPClientInfo,
  InitializeParams,
  InitializeResult,
  
  // Tool types
  MCPToolDefinition,
  ListToolsResult,
  CallToolParams,
  CallToolResult,
  
  // Resource types
  MCPResourceDefinition,
  MCPResourceTemplate,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceParams,
  ReadResourceResult,
  ResourceContent,
  SubscribeResourceParams,
  ResourceUpdatedParams,
  
  // Prompt types
  MCPPromptDefinition,
  ListPromptsResult,
  GetPromptParams,
  GetPromptResult,
  
  // Content types
  MCPContent,
  TextContent,
  
  // Logging types
  LogLevel,
  LogMessageParams,
  
  // Configuration types
  MCPServerConfig,
  TransportType,
  TransportConfig,
  
  // Handler types
  ToolHandler,
  ResourceHandler,
  PromptHandler,
  RegisteredTool,
  RegisteredResource,
  RegisteredPrompt,
  
  // Event types
  ServerEventType,
  ServerEvent
} from './types';

// ============================================================================
// MCP Server Class
// ============================================================================

/**
 * MCP Server for exposing Chrysalis capabilities.
 * 
 * Supports:
 * - JSON-RPC 2.0 protocol
 * - Tool registration and invocation
 * - Resource registration and serving
 * - Prompt registration and retrieval
 * - Logging and progress notifications
 * 
 * @example
 * ```typescript
 * const server = new MCPServer({
 *   name: 'chrysalis-mcp',
 *   version: '1.0.0',
 *   enableTools: true,
 *   enableResources: true,
 *   enablePrompts: true
 * });
 * 
 * // Register a tool
 * server.registerTool({
 *   name: 'memory-query',
 *   description: 'Query the memory system',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       query: { type: 'string', description: 'Search query' }
 *     },
 *     required: ['query']
 *   }
 * }, async (name, args) => {
 *   return { content: [{ type: 'text', text: 'Query results...' }] };
 * });
 * 
 * // Start the server
 * await server.start({ type: 'stdio' });
 * ```
 */
export class MCPServer extends EventEmitter {
  private config: MCPServerConfig;
  private initialized: boolean = false;
  private clientInfo?: MCPClientInfo;
  private clientCapabilities?: MCPClientCapabilities;
  
  // Registry maps
  private tools: Map<string, RegisteredTool> = new Map();
  private resources: Map<string, RegisteredResource> = new Map();
  private resourceTemplates: Map<string, MCPResourceTemplate> = new Map();
  private prompts: Map<string, RegisteredPrompt> = new Map();
  
  // Subscriptions
  private resourceSubscriptions: Map<string, Set<string>> = new Map();
  
  // Transport
  private transport?: MCPTransport;
  
  constructor(config: MCPServerConfig) {
    super();
    this.config = {
      enableTools: true,
      enableResources: true,
      enablePrompts: true,
      enableLogging: true,
      enableResourceSubscription: true,
      ...config
    };
  }
  
  // ============================================================================
  // Server Lifecycle
  // ============================================================================
  
  /**
   * Start the MCP server.
   */
  async start(transportConfig: TransportConfig): Promise<void> {
    this.transport = createTransport(transportConfig);
    
    this.transport.onMessage((message) => {
      this.handleMessage(message).catch(err => {
        this.log('error', `Error handling message: ${err.message}`);
      });
    });
    
    this.transport.onClose(() => {
      this.emitEvent('client-disconnected', {});
    });
    
    await this.transport.start();
    this.log('info', `MCP Server started with ${transportConfig.type} transport`);
  }
  
  /**
   * Stop the MCP server.
   */
  async stop(): Promise<void> {
    if (this.transport) {
      await this.transport.stop();
      this.transport = undefined;
    }
    
    this.initialized = false;
    this.clientInfo = undefined;
    this.clientCapabilities = undefined;
    
    this.emitEvent('shutdown', {});
    this.log('info', 'MCP Server stopped');
  }
  
  // ============================================================================
  // Tool Registration
  // ============================================================================
  
  /**
   * Register a tool.
   */
  registerTool(
    definition: MCPToolDefinition,
    handler: ToolHandler
  ): void {
    this.tools.set(definition.name, { definition, handler });
    this.log('debug', `Registered tool: ${definition.name}`);
    
    // Notify clients if capability is enabled
    if (this.initialized && this.config.enableTools) {
      this.sendNotification('notifications/tools/list_changed', {});
    }
  }
  
  /**
   * Unregister a tool.
   */
  unregisterTool(name: string): boolean {
    const removed = this.tools.delete(name);
    
    if (removed && this.initialized && this.config.enableTools) {
      this.sendNotification('notifications/tools/list_changed', {});
    }
    
    return removed;
  }
  
  /**
   * Get registered tools.
   */
  getTools(): MCPToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }
  
  // ============================================================================
  // Resource Registration
  // ============================================================================
  
  /**
   * Register a resource.
   */
  registerResource(
    definition: MCPResourceDefinition,
    handler: ResourceHandler
  ): void {
    this.resources.set(definition.uri, { definition, handler });
    this.log('debug', `Registered resource: ${definition.uri}`);
    
    if (this.initialized && this.config.enableResources) {
      this.sendNotification('notifications/resources/list_changed', {});
    }
  }
  
  /**
   * Unregister a resource.
   */
  unregisterResource(uri: string): boolean {
    const removed = this.resources.delete(uri);
    
    if (removed && this.initialized && this.config.enableResources) {
      this.sendNotification('notifications/resources/list_changed', {});
    }
    
    return removed;
  }
  
  /**
   * Register a resource template.
   */
  registerResourceTemplate(template: MCPResourceTemplate): void {
    this.resourceTemplates.set(template.uriTemplate, template);
    this.log('debug', `Registered resource template: ${template.uriTemplate}`);
  }
  
  /**
   * Get registered resources.
   */
  getResources(): MCPResourceDefinition[] {
    return Array.from(this.resources.values()).map(r => r.definition);
  }
  
  /**
   * Notify subscribers of resource update.
   */
  notifyResourceUpdated(uri: string): void {
    const subscribers = this.resourceSubscriptions.get(uri);
    if (subscribers && subscribers.size > 0) {
      this.sendNotification('notifications/resources/updated', { uri } as ResourceUpdatedParams);
    }
  }
  
  // ============================================================================
  // Prompt Registration
  // ============================================================================
  
  /**
   * Register a prompt.
   */
  registerPrompt(
    definition: MCPPromptDefinition,
    handler: PromptHandler
  ): void {
    this.prompts.set(definition.name, { definition, handler });
    this.log('debug', `Registered prompt: ${definition.name}`);
    
    if (this.initialized && this.config.enablePrompts) {
      this.sendNotification('notifications/prompts/list_changed', {});
    }
  }
  
  /**
   * Unregister a prompt.
   */
  unregisterPrompt(name: string): boolean {
    const removed = this.prompts.delete(name);
    
    if (removed && this.initialized && this.config.enablePrompts) {
      this.sendNotification('notifications/prompts/list_changed', {});
    }
    
    return removed;
  }
  
  /**
   * Get registered prompts.
   */
  getPrompts(): MCPPromptDefinition[] {
    return Array.from(this.prompts.values()).map(p => p.definition);
  }
  
  // ============================================================================
  // Message Handling
  // ============================================================================
  
  /**
   * Handle incoming message.
   */
  private async handleMessage(raw: string): Promise<void> {
    let request: JsonRpcRequest;
    
    try {
      request = JSON.parse(raw);
    } catch (e) {
      await this.sendError(null, JSON_RPC_ERROR_CODES.PARSE_ERROR, 'Parse error');
      return;
    }
    
    if (request.jsonrpc !== '2.0') {
      await this.sendError(request.id ?? null, JSON_RPC_ERROR_CODES.INVALID_REQUEST, 'Invalid JSON-RPC version');
      return;
    }
    
    // Handle notifications (no id)
    if (request.id === undefined) {
      await this.handleNotification(request as JsonRpcNotification);
      return;
    }
    
    // Handle requests
    try {
      const result = await this.handleRequest(request);
      await this.sendResponse(request.id, result);
    } catch (error) {
      const err = error as Error & { code?: number };
      await this.sendError(
        request.id,
        err.code || JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        err.message
      );
    }
  }
  
  /**
   * Handle JSON-RPC request.
   */
  private async handleRequest(request: JsonRpcRequest): Promise<unknown> {
    const { method, params } = request;
    
    // Check if initialized (except for initialize method)
    if (!this.initialized && method !== 'initialize') {
      throw this.createError(JSON_RPC_ERROR_CODES.INVALID_REQUEST, 'Server not initialized');
    }
    
    switch (method) {
      // Lifecycle methods
      case 'initialize':
        return this.handleInitialize(params as InitializeParams);
      
      case 'ping':
        return {};
      
      // Tool methods
      case 'tools/list':
        return this.handleListTools();
      
      case 'tools/call':
        return this.handleCallTool(params as CallToolParams);
      
      // Resource methods
      case 'resources/list':
        return this.handleListResources();
      
      case 'resources/templates/list':
        return this.handleListResourceTemplates();
      
      case 'resources/read':
        return this.handleReadResource(params as ReadResourceParams);
      
      case 'resources/subscribe':
        return this.handleSubscribeResource(params as SubscribeResourceParams);
      
      case 'resources/unsubscribe':
        return this.handleUnsubscribeResource(params as SubscribeResourceParams);
      
      // Prompt methods
      case 'prompts/list':
        return this.handleListPrompts();
      
      case 'prompts/get':
        return this.handleGetPrompt(params as GetPromptParams);
      
      // Logging methods
      case 'logging/setLevel':
        return this.handleSetLogLevel(params as { level: LogLevel });
      
      default:
        throw this.createError(JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  }
  
  /**
   * Handle JSON-RPC notification.
   */
  private async handleNotification(notification: JsonRpcNotification): Promise<void> {
    const { method, params } = notification;
    
    switch (method) {
      case 'notifications/initialized':
        this.emitEvent('initialized', {});
        break;
      
      case 'notifications/cancelled':
        // Handle cancellation
        break;
      
      case 'notifications/roots/list_changed':
        // Handle roots change
        break;
      
      default:
        this.log('debug', `Unknown notification: ${method}`);
    }
  }
  
  // ============================================================================
  // Request Handlers
  // ============================================================================
  
  /**
   * Handle initialize request.
   */
  private handleInitialize(params: InitializeParams): InitializeResult {
    this.clientInfo = params.clientInfo;
    this.clientCapabilities = params.capabilities;
    this.initialized = true;
    
    const capabilities: MCPServerCapabilities = {};
    
    if (this.config.enableTools) {
      capabilities.tools = { listChanged: true };
    }
    
    if (this.config.enableResources) {
      capabilities.resources = {
        subscribe: this.config.enableResourceSubscription,
        listChanged: true
      };
    }
    
    if (this.config.enablePrompts) {
      capabilities.prompts = { listChanged: true };
    }
    
    if (this.config.enableLogging) {
      capabilities.logging = {};
    }
    
    if (this.config.customCapabilities) {
      capabilities.experimental = this.config.customCapabilities;
    }
    
    this.emitEvent('client-connected', { clientInfo: this.clientInfo });
    
    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities,
      serverInfo: {
        name: this.config.name,
        version: this.config.version
      },
      instructions: this.config.instructions
    };
  }
  
  /**
   * Handle tools/list request.
   */
  private handleListTools(): ListToolsResult {
    if (!this.config.enableTools) {
      throw this.createError(JSON_RPC_ERROR_CODES.CAPABILITY_NOT_SUPPORTED, 'Tools not enabled');
    }
    
    return {
      tools: this.getTools()
    };
  }
  
  /**
   * Handle tools/call request.
   */
  private async handleCallTool(params: CallToolParams): Promise<CallToolResult> {
    if (!this.config.enableTools) {
      throw this.createError(JSON_RPC_ERROR_CODES.CAPABILITY_NOT_SUPPORTED, 'Tools not enabled');
    }
    
    const tool = this.tools.get(params.name);
    if (!tool) {
      throw this.createError(JSON_RPC_ERROR_CODES.TOOL_NOT_FOUND, `Tool not found: ${params.name}`);
    }
    
    this.emitEvent('tool-called', { tool: params.name, arguments: params.arguments });
    
    try {
      const result = await tool.handler(params.name, params.arguments || {});
      return result;
    } catch (error) {
      const err = error as Error;
      return {
        content: [{
          type: 'text',
          text: `Error: ${err.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * Handle resources/list request.
   */
  private handleListResources(): ListResourcesResult {
    if (!this.config.enableResources) {
      throw this.createError(JSON_RPC_ERROR_CODES.CAPABILITY_NOT_SUPPORTED, 'Resources not enabled');
    }
    
    return {
      resources: this.getResources()
    };
  }
  
  /**
   * Handle resources/templates/list request.
   */
  private handleListResourceTemplates(): ListResourceTemplatesResult {
    if (!this.config.enableResources) {
      throw this.createError(JSON_RPC_ERROR_CODES.CAPABILITY_NOT_SUPPORTED, 'Resources not enabled');
    }
    
    return {
      resourceTemplates: Array.from(this.resourceTemplates.values())
    };
  }
  
  /**
   * Handle resources/read request.
   */
  private async handleReadResource(params: ReadResourceParams): Promise<ReadResourceResult> {
    if (!this.config.enableResources) {
      throw this.createError(JSON_RPC_ERROR_CODES.CAPABILITY_NOT_SUPPORTED, 'Resources not enabled');
    }
    
    const resource = this.resources.get(params.uri);
    if (!resource) {
      throw this.createError(JSON_RPC_ERROR_CODES.RESOURCE_NOT_FOUND, `Resource not found: ${params.uri}`);
    }
    
    this.emitEvent('resource-read', { uri: params.uri });
    
    const contents = await resource.handler(params.uri);
    return { contents };
  }
  
  /**
   * Handle resources/subscribe request.
   */
  private handleSubscribeResource(params: SubscribeResourceParams): object {
    if (!this.config.enableResourceSubscription) {
      throw this.createError(JSON_RPC_ERROR_CODES.CAPABILITY_NOT_SUPPORTED, 'Resource subscription not enabled');
    }
    
    let subscribers = this.resourceSubscriptions.get(params.uri);
    if (!subscribers) {
      subscribers = new Set();
      this.resourceSubscriptions.set(params.uri, subscribers);
    }
    
    subscribers.add(this.clientInfo?.name || 'unknown');
    
    return {};
  }
  
  /**
   * Handle resources/unsubscribe request.
   */
  private handleUnsubscribeResource(params: SubscribeResourceParams): object {
    const subscribers = this.resourceSubscriptions.get(params.uri);
    if (subscribers) {
      subscribers.delete(this.clientInfo?.name || 'unknown');
    }
    
    return {};
  }
  
  /**
   * Handle prompts/list request.
   */
  private handleListPrompts(): ListPromptsResult {
    if (!this.config.enablePrompts) {
      throw this.createError(JSON_RPC_ERROR_CODES.CAPABILITY_NOT_SUPPORTED, 'Prompts not enabled');
    }
    
    return {
      prompts: this.getPrompts()
    };
  }
  
  /**
   * Handle prompts/get request.
   */
  private async handleGetPrompt(params: GetPromptParams): Promise<GetPromptResult> {
    if (!this.config.enablePrompts) {
      throw this.createError(JSON_RPC_ERROR_CODES.CAPABILITY_NOT_SUPPORTED, 'Prompts not enabled');
    }
    
    const prompt = this.prompts.get(params.name);
    if (!prompt) {
      throw this.createError(JSON_RPC_ERROR_CODES.PROMPT_NOT_FOUND, `Prompt not found: ${params.name}`);
    }
    
    this.emitEvent('prompt-requested', { prompt: params.name, arguments: params.arguments });
    
    return prompt.handler(params.name, params.arguments || {});
  }
  
  /**
   * Handle logging/setLevel request.
   */
  private handleSetLogLevel(params: { level: LogLevel }): object {
    // Store log level (implementation-specific)
    this.log('info', `Log level set to: ${params.level}`);
    return {};
  }
  
  // ============================================================================
  // Response Helpers
  // ============================================================================
  
  /**
   * Send JSON-RPC response.
   */
  private async sendResponse(id: JsonRpcId, result: unknown): Promise<void> {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      result
    };
    
    await this.send(response);
  }
  
  /**
   * Send JSON-RPC error.
   */
  private async sendError(id: JsonRpcId, code: number, message: string, data?: unknown): Promise<void> {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message, data }
    };
    
    await this.send(response);
  }
  
  /**
   * Send JSON-RPC notification.
   */
  private async sendNotification(method: string, params?: unknown): Promise<void> {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params
    };
    
    await this.send(notification);
  }
  
  /**
   * Send message through transport.
   */
  private async send(message: JsonRpcResponse | JsonRpcNotification): Promise<void> {
    if (!this.transport) {
      this.log('error', 'No transport available');
      return;
    }
    
    await this.transport.send(JSON.stringify(message));
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  /**
   * Create an error with code.
   */
  private createError(code: number, message: string): Error & { code: number } {
    const error = new Error(message) as Error & { code: number };
    error.code = code;
    return error;
  }
  
  /**
   * Log a message.
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    if (this.config.enableLogging && this.initialized) {
      this.sendNotification('notifications/message', {
        level,
        logger: this.config.name,
        data: data || message
      } as LogMessageParams);
    }
    
    // Also emit locally
    this.emit('log', { level, message, data });
  }
  
  /**
   * Emit server event.
   */
  private emitEvent(type: ServerEventType, data: unknown): void {
    const event: ServerEvent = {
      type,
      timestamp: new Date().toISOString(),
      data
    };
    
    this.emit('event', event);
    this.emit(type, data);
  }
  
  // ============================================================================
  // State Queries
  // ============================================================================
  
  /**
   * Check if server is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get client info.
   */
  getClientInfo(): MCPClientInfo | undefined {
    return this.clientInfo;
  }
  
  /**
   * Get client capabilities.
   */
  getClientCapabilities(): MCPClientCapabilities | undefined {
    return this.clientCapabilities;
  }
  
  /**
   * Get server info.
   */
  getServerInfo(): MCPServerInfo {
    return {
      name: this.config.name,
      version: this.config.version
    };
  }
}

// ============================================================================
// Transport Interface and Implementations
// ============================================================================

/**
 * MCP Transport interface.
 */
interface MCPTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: string): Promise<void>;
  onMessage(handler: (message: string) => void): void;
  onClose(handler: () => void): void;
}

/**
 * Create a transport based on configuration.
 */
function createTransport(config: TransportConfig): MCPTransport {
  switch (config.type) {
    case 'stdio':
      return new StdioTransport();
    case 'sse':
      return new SSETransport(config);
    default:
      throw new Error(`Unsupported transport type: ${config.type}`);
  }
}

/**
 * Standard I/O transport.
 */
class StdioTransport implements MCPTransport {
  private messageHandler?: (message: string) => void;
  private closeHandler?: () => void;
  private buffer: string = '';
  
  async start(): Promise<void> {
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (chunk: string) => {
      this.buffer += chunk;
      this.processBuffer();
    });
    
    process.stdin.on('end', () => {
      this.closeHandler?.();
    });
  }
  
  async stop(): Promise<void> {
    process.stdin.removeAllListeners();
  }
  
  async send(message: string): Promise<void> {
    // MCP uses newline-delimited JSON
    process.stdout.write(message + '\n');
  }
  
  onMessage(handler: (message: string) => void): void {
    this.messageHandler = handler;
  }
  
  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }
  
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        this.messageHandler?.(line);
      }
    }
  }
}

/**
 * Server-Sent Events transport (HTTP-based).
 */
class SSETransport implements MCPTransport {
  private config: TransportConfig;
  private messageHandler?: (message: string) => void;
  private closeHandler?: () => void;
  
  constructor(config: TransportConfig) {
    this.config = config;
  }
  
  async start(): Promise<void> {
    throw new NotImplementedError('SSEServerTransport.start: SSE server implementation');
  }
  
  async stop(): Promise<void> {
    // Stop the HTTP server
  }
  
  async send(_message: string): Promise<void> {
    throw new NotImplementedError('SSE streaming');
  }
  
  onMessage(handler: (message: string) => void): void {
    this.messageHandler = handler;
  }
  
  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new MCP server.
 */
export function createMCPServer(config: MCPServerConfig): MCPServer {
  return new MCPServer(config);
}

// ============================================================================
// Exports
// ============================================================================

export default MCPServer;
