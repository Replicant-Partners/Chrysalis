/**
 * ACP Client - Connect to ACP-compatible agents
 *
 * Implements the client side of the Agent Client Protocol,
 * allowing Chrysalis to connect to any ACP-compatible agent
 * (Claude Code, OpenCode, Gemini, Codex, etc.)
 *
 * Transport: ndjson (newline-delimited JSON) over stdio
 *
 * @module adapters/acp/client
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as readline from 'readline';
import {
  ACPMessage,
  ACPRequest,
  ACPResponse,
  ACPNotification,
  ACPCapabilities,
  ACPConnectionConfig,
  ACPConnectionState,
  ACPAgentInfo,
  ACPNotificationType,
  ACPError,
  ACPErrorCodes,
  PromptRequest,
  PromptResponse,
  InitializeRequest,
  InitializeResponse,
  CancelRequest,
  SessionNotification,
  ACPToolCall,
  ACPContext,
  ACPAttachment,
} from './types';

// =============================================================================
// ACP Client
// =============================================================================

/**
 * ACP Client for connecting to ACP-compatible agents
 *
 * Usage:
 * ```typescript
 * const client = new ACPClient({
 *   command: './opencode',
 *   args: ['acp'],
 *   clientInfo: { name: 'Chrysalis', version: '1.0.0' }
 * });
 *
 * await client.connect();
 * const response = await client.prompt('Hello, world!');
 * await client.disconnect();
 * ```
 */
export class ACPClient extends EventEmitter {
  private config: ACPConnectionConfig;
  private state: ACPConnectionState = 'disconnected';
  private process?: ChildProcess;
  private readlineInterface?: readline.Interface;
  private messageId: number = 0;
  private pendingRequests: Map<string | number, {
    resolve: (response: ACPResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private agentInfo?: ACPAgentInfo;
  private negotiatedCapabilities?: ACPCapabilities;
  private currentSessionId?: string;

  constructor(config: ACPConnectionConfig) {
    super();
    this.config = {
      connectTimeout: 30000,
      requestTimeout: 60000,
      ...config,
    };
  }

  // ===========================================================================
  // Connection Lifecycle
  // ===========================================================================

  /**
   * Get current connection state
   */
  getState(): ACPConnectionState {
    return this.state;
  }

  /**
   * Get connected agent info
   */
  getAgentInfo(): ACPAgentInfo | undefined {
    return this.agentInfo;
  }

  /**
   * Get negotiated capabilities
   */
  getCapabilities(): ACPCapabilities | undefined {
    return this.negotiatedCapabilities;
  }

  /**
   * Connect to the ACP agent
   */
  async connect(): Promise<void> {
    if (this.state === 'ready') {
      return;
    }

    this.setState('connecting');

    try {
      // Spawn the agent process
      if (this.config.command) {
        await this.spawnAgentProcess();
      } else if (this.config.stdin && this.config.stdout) {
        this.setupStreams(this.config.stdin, this.config.stdout);
      } else {
        throw new Error('Either command or stdin/stdout must be provided');
      }

      // Initialize the connection
      this.setState('initializing');
      await this.initialize();

      this.setState('ready');
      this.emit('connected', this.agentInfo);
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  /**
   * Disconnect from the ACP agent
   */
  async disconnect(): Promise<void> {
    if (this.state === 'disconnected') {
      return;
    }

    // Cancel pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
      this.pendingRequests.delete(id);
    }

    // Close readline
    if (this.readlineInterface) {
      this.readlineInterface.close();
      this.readlineInterface = undefined;
    }

    // Kill process
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = undefined;
    }

    this.setState('disconnected');
    this.emit('disconnected');
  }

  // ===========================================================================
  // Core Messaging
  // ===========================================================================

  /**
   * Send a prompt to the agent
   */
  async prompt(
    content: string,
    options?: {
      sessionId?: string;
      attachments?: ACPAttachment[];
      context?: ACPContext;
    }
  ): Promise<PromptResponse> {
    const request: PromptRequest = {
      type: 'Prompt',
      sessionId: options?.sessionId ?? this.currentSessionId,
      content,
      attachments: options?.attachments,
      context: options?.context,
    };

    const response = await this.sendRequest('acp/prompt', request);

    if (response.result) {
      const promptResponse = response.result as PromptResponse;
      this.currentSessionId = promptResponse.sessionId;
      return promptResponse;
    }

    throw this.createError(response.error);
  }

  /**
   * Stream a prompt response
   */
  async *promptStream(
    content: string,
    options?: {
      sessionId?: string;
      attachments?: ACPAttachment[];
      context?: ACPContext;
    }
  ): AsyncGenerator<SessionNotification, void, unknown> {
    // Send the prompt
    const response = await this.prompt(content, options);
    const sessionId = response.sessionId;

    // Create a promise that resolves when streaming is complete
    let done = false;
    const notifications: SessionNotification[] = [];

    const notificationHandler = (notification: ACPNotificationType) => {
      if (
        notification.type === 'SessionNotification' &&
        notification.sessionId === sessionId
      ) {
        notifications.push(notification);
        if (notification.status === 'done' || notification.status === 'error') {
          done = true;
        }
      }
    };

    this.on('notification', notificationHandler);

    try {
      // Yield notifications as they arrive
      while (!done) {
        while (notifications.length > 0) {
          yield notifications.shift()!;
        }
        // Small delay to allow notifications to accumulate
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      this.off('notification', notificationHandler);
    }
  }

  /**
   * Cancel an ongoing operation
   */
  async cancel(sessionId?: string): Promise<boolean> {
    const request: CancelRequest = {
      type: 'Cancel',
      sessionId: sessionId ?? this.currentSessionId ?? '',
    };

    const response = await this.sendRequest('acp/cancel', request);
    return !response.error;
  }

  // ===========================================================================
  // File Operations
  // ===========================================================================

  /**
   * Check if file operations are supported
   */
  hasFileCapability(): boolean {
    return !!(this.negotiatedCapabilities?.files?.read ||
              this.negotiatedCapabilities?.files?.write);
  }

  // ===========================================================================
  // Terminal Operations
  // ===========================================================================

  /**
   * Check if terminal operations are supported
   */
  hasTerminalCapability(): boolean {
    return !!this.negotiatedCapabilities?.terminal?.create;
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  private setState(state: ACPConnectionState): void {
    const previous = this.state;
    this.state = state;
    if (previous !== state) {
      this.emit('stateChange', { previous, current: state });
    }
  }

  private async spawnAgentProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to spawn agent within ${this.config.connectTimeout}ms`));
      }, this.config.connectTimeout);

      try {
        this.process = spawn(
          this.config.command!,
          this.config.args ?? [],
          {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
          }
        );

        this.process.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        this.process.on('exit', (code, signal) => {
          if (this.state !== 'disconnected') {
            this.emit('error', new Error(`Agent process exited: code=${code}, signal=${signal}`));
            this.setState('error');
          }
        });

        // Capture stderr for debugging
        if (this.process.stderr) {
          this.process.stderr.on('data', (data: Buffer) => {
            this.emit('stderr', data.toString());
          });
        }

        // Setup streams
        if (this.process.stdin && this.process.stdout) {
          this.setupStreams(this.process.stdin, this.process.stdout);
          clearTimeout(timeout);
          resolve();
        } else {
          clearTimeout(timeout);
          reject(new Error('Failed to get stdin/stdout from agent process'));
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private setupStreams(
    stdin: NodeJS.WritableStream,
    stdout: NodeJS.ReadableStream
  ): void {
    // Setup line-by-line reading for ndjson
    this.readlineInterface = readline.createInterface({
      input: stdout,
      crlfDelay: Infinity,
    });

    this.readlineInterface.on('line', (line: string) => {
      this.handleMessage(line);
    });

    this.readlineInterface.on('close', () => {
      if (this.state !== 'disconnected') {
        this.emit('error', new Error('Agent stdout closed unexpectedly'));
        this.setState('error');
      }
    });

    // Store stdin for sending
    (this as { _stdin?: NodeJS.WritableStream })._stdin = stdin;
  }

  private handleMessage(line: string): void {
    if (!line.trim()) return;

    try {
      const message: ACPMessage = JSON.parse(line);

      // Handle response to pending request
      if (message.id !== undefined && !message.method) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);
          pending.resolve(message as ACPResponse);
        }
        return;
      }

      // Handle notification
      if (message.method && message.id === undefined) {
        this.handleNotification(message as ACPNotification);
        return;
      }

      // Handle request from agent (agent → client)
      if (message.method && message.id !== undefined) {
        this.handleAgentRequest(message as ACPRequest);
        return;
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to parse message: ${line}`));
    }
  }

  private handleNotification(notification: ACPNotification): void {
    // Parse notification type
    const params = notification.params as ACPNotificationType;
    if (params) {
      this.emit('notification', params);

      // Also emit specific events for common notifications
      if (params.type === 'SessionNotification') {
        this.emit('sessionUpdate', params);
      }

      // Call config callback if provided
      if (this.config.onNotification) {
        this.config.onNotification(params);
      }
    }
  }

  private handleAgentRequest(request: ACPRequest): void {
    // Agent is making a request to the client (file operations, terminal, etc.)
    this.emit('agentRequest', request);

    // For now, respond with "not implemented"
    // In a full implementation, this would be handled by the client
    this.sendResponse(request.id, undefined, {
      code: ACPErrorCodes.CAPABILITY_NOT_SUPPORTED,
      message: 'Capability not yet implemented in Chrysalis',
    });
  }

  private async sendRequest(method: string, params: unknown): Promise<ACPResponse> {
    if (this.state !== 'ready' && this.state !== 'initializing') {
      throw new Error(`Cannot send request in state: ${this.state}`);
    }

    const id = ++this.messageId;
    const request: ACPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, this.config.requestTimeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.sendMessage(request);
    });
  }

  private sendResponse(
    id: string | number,
    result?: unknown,
    error?: ACPError
  ): void {
    const response: ACPResponse = {
      jsonrpc: '2.0',
      id,
      result,
      error,
    };
    this.sendMessage(response);
  }

  private sendMessage(message: ACPMessage): void {
    const stdin = (this as { _stdin?: NodeJS.WritableStream })._stdin;
    if (!stdin) {
      throw new Error('Not connected');
    }

    const json = JSON.stringify(message);
    stdin.write(json + '\n');
  }

  private async initialize(): Promise<void> {
    const request: InitializeRequest = {
      type: 'Initialize',
      clientInfo: this.config.clientInfo,
      capabilities: this.config.capabilities ?? {
        mcp: { http: true, sse: true },
        prompt: { audio: false, image: true, embeddedContext: true },
        session: { load: true, save: true },
        files: { read: true, write: true },
        terminal: { create: true, output: true, waitForExit: true, kill: true, release: true },
        permissions: { request: true },
      },
    };

    const response = await this.sendRequest('acp/initialize', request);

    if (response.error) {
      throw this.createError(response.error);
    }

    const result = response.result as InitializeResponse;
    this.agentInfo = result.agentInfo;
    this.negotiatedCapabilities = result.capabilities;

    this.emit('initialized', {
      agentInfo: this.agentInfo,
      capabilities: this.negotiatedCapabilities,
    });
  }

  private createError(error?: ACPError): Error {
    if (!error) {
      return new Error('Unknown ACP error');
    }
    const err = new Error(`ACP Error ${error.code}: ${error.message}`);
    (err as Error & { code: number }).code = error.code;
    return err;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an ACP client from a command
 */
export function createACPClient(
  command: string,
  args: string[] = [],
  clientInfo: { name: string; version: string } = { name: 'Chrysalis', version: '1.0.0' }
): ACPClient {
  return new ACPClient({
    command,
    args,
    clientInfo,
  });
}

/**
 * Create an ACP client for known agents
 */
export const ACPAgentFactory = {
  /**
   * Connect to OpenCode agent
   */
  opencode(path: string = './opencode'): ACPClient {
    return createACPClient(path, ['acp']);
  },

  /**
   * Connect to Codex agent
   */
  codex(path: string = './codex'): ACPClient {
    return createACPClient(path, ['acp']);
  },

  /**
   * Connect to Gemini agent
   */
  gemini(path: string = './gemini'): ACPClient {
    return createACPClient(path, ['acp']);
  },

  /**
   * Connect to a generic ACP agent
   */
  generic(command: string, args: string[] = ['acp']): ACPClient {
    return createACPClient(command, args);
  },
};

// =============================================================================
// Multi-Agent Client
// =============================================================================

/**
 * Manages connections to multiple ACP agents
 */
export class ACPMultiClient extends EventEmitter {
  private clients: Map<string, ACPClient> = new Map();

  /**
   * Add an agent client
   */
  addAgent(id: string, client: ACPClient): void {
    this.clients.set(id, client);
    
    // Forward events
    client.on('notification', (notification) => {
      this.emit('notification', { agentId: id, notification });
    });
    
    client.on('error', (error) => {
      this.emit('error', { agentId: id, error });
    });
  }

  /**
   * Remove an agent client
   */
  async removeAgent(id: string): Promise<void> {
    const client = this.clients.get(id);
    if (client) {
      await client.disconnect();
      this.clients.delete(id);
    }
  }

  /**
   * Get an agent client
   */
  getAgent(id: string): ACPClient | undefined {
    return this.clients.get(id);
  }

  /**
   * List all agents
   */
  listAgents(): Array<{ id: string; info?: ACPAgentInfo; state: ACPConnectionState }> {
    const agents: Array<{ id: string; info?: ACPAgentInfo; state: ACPConnectionState }> = [];
    for (const [id, client] of this.clients) {
      agents.push({
        id,
        info: client.getAgentInfo(),
        state: client.getState(),
      });
    }
    return agents;
  }

  /**
   * Connect all agents
   */
  async connectAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const client of this.clients.values()) {
      promises.push(client.connect());
    }
    await Promise.all(promises);
  }

  /**
   * Disconnect all agents
   */
  async disconnectAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const client of this.clients.values()) {
      promises.push(client.disconnect());
    }
    await Promise.all(promises);
  }

  /**
   * Prompt a specific agent
   */
  async promptAgent(agentId: string, content: string): Promise<PromptResponse> {
    const client = this.clients.get(agentId);
    if (!client) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    return client.prompt(content);
  }

  /**
   * Broadcast a prompt to all agents
   */
  async promptAll(content: string): Promise<Map<string, PromptResponse | Error>> {
    const results = new Map<string, PromptResponse | Error>();
    
    const promises = Array.from(this.clients.entries()).map(async ([id, client]) => {
      try {
        const response = await client.prompt(content);
        results.set(id, response);
      } catch (error) {
        results.set(id, error instanceof Error ? error : new Error(String(error)));
      }
    });
    
    await Promise.all(promises);
    return results;
  }
}
