/**
 * ACP Server - Expose Chrysalis as an ACP agent
 *
 * Allows editors like VS Code, Zed, Emacs to connect to Chrysalis
 * using the Agent Client Protocol.
 *
 * Transport: ndjson (newline-delimited JSON) over stdio
 *
 * @module adapters/acp/server
 */

import { EventEmitter } from 'events';
import * as readline from 'readline';
import {
  ACPMessage,
  ACPRequest,
  ACPResponse,
  ACPNotification,
  ACPCapabilities,
  ACPAgentInfo,
  ACPError,
  ACPErrorCodes,
  SessionNotification,
  ACPToolCall,
  ACPToolDefinition,
  PromptRequest,
  PromptResponse,
  InitializeRequest,
  InitializeResponse,
  CancelRequest,
  WriteTextFileRequest,
  WriteTextFileResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  ACPConnectionState,
} from './types';

// =============================================================================
// ACP Server Configuration
// =============================================================================

export interface ACPServerConfig {
  agentInfo: ACPAgentInfo;
  capabilities?: Partial<ACPCapabilities>;

  // Handler for prompts from the client
  onPrompt: (
    content: string,
    sessionId: string,
    context?: unknown
  ) => Promise<string | AsyncIterable<string>>;

  // Handler for cancel requests
  onCancel?: (sessionId: string) => Promise<void>;

  // Permission request handler
  onPermissionRequest?: (permission: string, description?: string) => Promise<boolean>;

  // Streams (defaults to process.stdin/stdout)
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
}

// =============================================================================
// ACP Server
// =============================================================================

/**
 * ACP Server - Expose Chrysalis as an ACP-compatible agent
 *
 * Usage:
 * ```typescript
 * const server = new ACPServer({
 *   agentInfo: {
 *     name: 'Chrysalis',
 *     version: '1.0.0',
 *     description: 'Universal Protocol Translation System'
 *   },
 *   onPrompt: async (content, sessionId) => {
 *     // Process prompt and return response
 *     return await processWithLLM(content);
 *   }
 * });
 *
 * server.start();
 * ```
 */
export class ACPServer extends EventEmitter {
  private config: ACPServerConfig;
  private state: ACPConnectionState = 'disconnected';
  private readlineInterface?: readline.Interface;
  private stdin: NodeJS.ReadableStream;
  private stdout: NodeJS.WritableStream;
  private clientCapabilities?: ACPCapabilities;
  private sessions: Map<string, {
    id: string;
    startedAt: number;
    status: 'active' | 'cancelled' | 'completed';
    abortController?: AbortController;
  }> = new Map();
  private sessionIdCounter: number = 0;

  constructor(config: ACPServerConfig) {
    super();
    this.config = config;
    this.stdin = config.stdin ?? process.stdin;
    this.stdout = config.stdout ?? process.stdout;
  }

  // ===========================================================================
  // Server Lifecycle
  // ===========================================================================

  /**
   * Get current state
   */
  getState(): ACPConnectionState {
    return this.state;
  }

  /**
   * Start the ACP server
   */
  start(): void {
    if (this.state !== 'disconnected') {
      return;
    }

    this.state = 'connecting';

    // Setup line-by-line reading for ndjson
    this.readlineInterface = readline.createInterface({
      input: this.stdin,
      crlfDelay: Infinity,
    });

    this.readlineInterface.on('line', (line: string) => {
      this.handleMessage(line);
    });

    this.readlineInterface.on('close', () => {
      this.stop();
    });

    this.state = 'ready';
    this.emit('started');
  }

  /**
   * Stop the ACP server
   */
  stop(): void {
    if (this.state === 'disconnected') {
      return;
    }

    // Cancel all active sessions
    for (const session of this.sessions.values()) {
      if (session.status === 'active' && session.abortController) {
        session.abortController.abort();
      }
    }
    this.sessions.clear();

    // Close readline
    if (this.readlineInterface) {
      this.readlineInterface.close();
      this.readlineInterface = undefined;
    }

    this.state = 'disconnected';
    this.emit('stopped');
  }

  // ===========================================================================
  // Notification Sending
  // ===========================================================================

  /**
   * Send a session notification to the client
   */
  sendSessionNotification(
    sessionId: string,
    update: Partial<Omit<SessionNotification, 'type' | 'sessionId'>>
  ): void {
    const notification: SessionNotification = {
      type: 'SessionNotification',
      sessionId,
      ...update,
    };
    this.sendNotification('acp/sessionUpdate', notification);
  }

  /**
   * Send a tool call update
   */
  sendToolCallUpdate(sessionId: string, toolCall: ACPToolCall): void {
    this.sendSessionNotification(sessionId, {
      toolCalls: [toolCall],
    });
  }

  // ===========================================================================
  // Request Handlers
  // ===========================================================================

  private handleMessage(line: string): void {
    if (!line.trim()) return;

    try {
      const message: ACPMessage = JSON.parse(line);

      // Handle request from client
      if (message.method && message.id !== undefined) {
        this.handleRequest(message as ACPRequest);
        return;
      }

      // Handle notification from client
      if (message.method && message.id === undefined) {
        this.handleNotification(message as ACPNotification);
        return;
      }

      // Handle response (shouldn't happen for server, but log it)
      if (message.id !== undefined && !message.method) {
        this.emit('response', message as ACPResponse);
        return;
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to parse message: ${line}`));
    }
  }

  private async handleRequest(request: ACPRequest): Promise<void> {
    try {
      let result: unknown;

      switch (request.method) {
        case 'acp/initialize':
          result = await this.handleInitialize(request.params as InitializeRequest);
          break;

        case 'acp/prompt':
          result = await this.handlePrompt(request.params as PromptRequest);
          break;

        case 'acp/cancel':
          result = await this.handleCancel(request.params as CancelRequest);
          break;

        default:
          this.sendError(request.id, {
            code: ACPErrorCodes.METHOD_NOT_FOUND,
            message: `Unknown method: ${request.method}`,
          });
          return;
      }

      this.sendResponse(request.id, result);
    } catch (error) {
      this.sendError(request.id, {
        code: ACPErrorCodes.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleNotification(_notification: ACPNotification): void {
    // Handle notifications from client (if any)
    this.emit('clientNotification', _notification);
  }

  // ===========================================================================
  // Specific Request Handlers
  // ===========================================================================

  private async handleInitialize(
    request: InitializeRequest
  ): Promise<InitializeResponse> {
    this.clientCapabilities = request.capabilities;

    // Determine negotiated capabilities
    const serverCaps = this.config.capabilities ?? {};
    const clientCaps = request.capabilities;

    const negotiatedCapabilities: ACPCapabilities = {
      mcp: {
        http: serverCaps.mcp?.http && clientCaps.mcp?.http,
        sse: serverCaps.mcp?.sse && clientCaps.mcp?.sse,
      },
      prompt: {
        audio: serverCaps.prompt?.audio && clientCaps.prompt?.audio,
        image: serverCaps.prompt?.image && clientCaps.prompt?.image,
        embeddedContext: serverCaps.prompt?.embeddedContext && clientCaps.prompt?.embeddedContext,
      },
      session: {
        load: serverCaps.session?.load && clientCaps.session?.load,
        save: serverCaps.session?.save && clientCaps.session?.save,
      },
      files: {
        read: serverCaps.files?.read && clientCaps.files?.read,
        write: serverCaps.files?.write && clientCaps.files?.write,
      },
      terminal: {
        create: serverCaps.terminal?.create && clientCaps.terminal?.create,
        output: serverCaps.terminal?.output && clientCaps.terminal?.output,
        waitForExit: serverCaps.terminal?.waitForExit && clientCaps.terminal?.waitForExit,
        kill: serverCaps.terminal?.kill && clientCaps.terminal?.kill,
        release: serverCaps.terminal?.release && clientCaps.terminal?.release,
      },
      permissions: {
        request: serverCaps.permissions?.request && clientCaps.permissions?.request,
      },
    };

    this.emit('initialized', {
      clientInfo: request.clientInfo,
      capabilities: negotiatedCapabilities,
    });

    return {
      agentInfo: this.config.agentInfo,
      capabilities: negotiatedCapabilities,
    };
  }

  private async handlePrompt(request: PromptRequest): Promise<PromptResponse> {
    // Create or reuse session
    const sessionId = request.sessionId ?? this.createSession();
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    // Mark session as active
    session.status = 'active';
    session.abortController = new AbortController();

    this.emit('prompt', { sessionId, content: request.content, context: request.context });

    try {
      // Send initial notification
      this.sendSessionNotification(sessionId, { status: 'thinking' });

      // Call the prompt handler
      const result = await this.config.onPrompt(
        request.content,
        sessionId,
        request.context
      );

      // Handle streaming vs non-streaming response
      if (typeof result === 'string') {
        // Non-streaming response
        this.sendSessionNotification(sessionId, {
          content: result,
          status: 'done',
        });

        session.status = 'completed';

        return {
          sessionId,
          content: result,
          status: 'complete',
        };
      } else {
        // Streaming response
        this.sendSessionNotification(sessionId, { status: 'working' });

        let fullContent = '';
        for await (const chunk of result) {
          if (session.abortController?.signal.aborted) {
            throw new Error('Cancelled');
          }

          fullContent += chunk;
          this.sendSessionNotification(sessionId, {
            content: chunk,
            status: 'working',
          });
        }

        this.sendSessionNotification(sessionId, { status: 'done' });
        session.status = 'completed';

        return {
          sessionId,
          content: fullContent,
          status: 'complete',
        };
      }
    } catch (error) {
      session.status = session.abortController?.signal.aborted ? 'cancelled' : 'completed';

      this.sendSessionNotification(sessionId, {
        status: 'error',
        content: error instanceof Error ? error.message : String(error),
      });

      return {
        sessionId,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleCancel(request: CancelRequest): Promise<{ success: boolean }> {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      return { success: false };
    }

    if (session.abortController) {
      session.abortController.abort();
    }
    session.status = 'cancelled';

    if (this.config.onCancel) {
      await this.config.onCancel(request.sessionId);
    }

    return { success: true };
  }

  // ===========================================================================
  // Outbound Requests (Agent → Client)
  // ===========================================================================

  private requestId: number = 0;
  private pendingRequests: Map<number, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();

  /**
   * Request to write a file (agent → client)
   */
  async writeFile(path: string, content: string): Promise<WriteTextFileResponse> {
    const request: WriteTextFileRequest = {
      type: 'WriteTextFileRequest',
      path,
      content,
    };
    return this.sendAgentRequest('acp/writeFile', request) as Promise<WriteTextFileResponse>;
  }

  /**
   * Request to read a file (agent → client)
   */
  async readFile(path: string): Promise<ReadTextFileResponse> {
    const request: ReadTextFileRequest = {
      type: 'ReadTextFileRequest',
      path,
    };
    return this.sendAgentRequest('acp/readFile', request) as Promise<ReadTextFileResponse>;
  }

  /**
   * Request to create a terminal (agent → client)
   */
  async createTerminal(options?: {
    cwd?: string;
    env?: Record<string, string>;
    command?: string;
    args?: string[];
  }): Promise<CreateTerminalResponse> {
    const request: CreateTerminalRequest = {
      type: 'CreateTerminalRequest',
      ...options,
    };
    return this.sendAgentRequest('acp/createTerminal', request) as Promise<CreateTerminalResponse>;
  }

  /**
   * Request permission from the user (agent → client)
   */
  async requestPermission(
    permission: string,
    description?: string
  ): Promise<RequestPermissionResponse> {
    const request: RequestPermissionRequest = {
      type: 'RequestPermissionRequest',
      permission,
      description,
    };
    return this.sendAgentRequest('acp/requestPermission', request) as Promise<RequestPermissionResponse>;
  }

  private async sendAgentRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;

      this.pendingRequests.set(id, { resolve, reject });

      const request: ACPRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.sendMessage(request);

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timed out: ${method}`));
        }
      }, 60000);
    });
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  private createSession(): string {
    const sessionId = `session-${++this.sessionIdCounter}-${Date.now()}`;
    this.sessions.set(sessionId, {
      id: sessionId,
      startedAt: Date.now(),
      status: 'active',
    });
    return sessionId;
  }

  /**
   * Get all sessions
   */
  getSessions(): Array<{
    id: string;
    startedAt: number;
    status: string;
  }> {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      startedAt: s.startedAt,
      status: s.status,
    }));
  }

  // ===========================================================================
  // Message Sending
  // ===========================================================================

  private sendResponse(id: string | number, result: unknown): void {
    const response: ACPResponse = {
      jsonrpc: '2.0',
      id,
      result,
    };
    this.sendMessage(response);
  }

  private sendError(id: string | number, error: ACPError): void {
    const response: ACPResponse = {
      jsonrpc: '2.0',
      id,
      error,
    };
    this.sendMessage(response);
  }

  private sendNotification(method: string, params: unknown): void {
    const notification: ACPNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.sendMessage(notification);
  }

  private sendMessage(message: ACPMessage): void {
    const json = JSON.stringify(message);
    this.stdout.write(json + '\n');
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an ACP server with default Chrysalis configuration
 */
export function createACPServer(
  onPrompt: ACPServerConfig['onPrompt'],
  options?: Partial<ACPServerConfig>
): ACPServer {
  return new ACPServer({
    agentInfo: {
      name: 'Chrysalis',
      version: '1.0.0',
      description: 'Universal Protocol Translation System',
      vendor: 'Chrysalis Project',
      models: ['gpt-4', 'claude-3', 'ollama/*'],
      modes: ['chat', 'code', 'research'],
    },
    capabilities: {
      mcp: { http: true, sse: true },
      prompt: { audio: false, image: true, embeddedContext: true },
      session: { load: true, save: true },
      files: { read: true, write: true },
      terminal: { create: true, output: true, waitForExit: true, kill: true, release: true },
      permissions: { request: true },
    },
    onPrompt,
    ...options,
  });
}
