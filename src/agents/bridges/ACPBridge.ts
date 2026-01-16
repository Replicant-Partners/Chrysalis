/**
 * ACPBridge - Agent bridge for ACP-compatible agents
 *
 * Adapts ACP (Agent Client Protocol) agents to work with ChrysalisTerminal.
 * Supports connecting to external ACP agents like Claude Code, OpenCode,
 * Gemini, Codex, and any other ACP-compatible agent.
 *
 * Based on the ElizaOSBridge pattern, connects through the Go LLM Gateway.
 *
 * @module agents/bridges/ACPBridge
 */

import { BaseBridge } from './BaseBridge';
import {
  BridgeConfig,
  AgentInfo,
  AgentMessage,
  AgentResponse,
  AgentContext,
  AgentCapability,
  AgentType,
} from './types';
import { GatewayLLMClient } from '../../services/gateway/GatewayLLMClient';
import { AgentLLMClient } from '../../services/llm/AgentLLMClient';
import {
  ACPClient,
  ACPMultiClient,
  ACPAgentFactory,
  createACPClient,
  ACPAgentInfo,
  ACPCapabilities,
  SessionNotification,
  ACPConnectionState,
} from '../../adapters/acp';

// =============================================================================
// ACP Bridge Configuration
// =============================================================================

/**
 * Known ACP agent types
 */
export type ACPAgentType =
  | 'opencode'
  | 'codex'
  | 'gemini'
  | 'claude-code'
  | 'qwen-code'
  | 'mistral-vibe'
  | 'auggie'
  | 'custom';

/**
 * ACP Bridge configuration
 */
export interface ACPBridgeConfig extends BridgeConfig {
  type: 'acp';

  // ACP agent specification
  acpAgent: ACPAgentType;

  // Command to spawn the ACP agent (if custom)
  command?: string;
  args?: string[];

  // Or path to a known agent binary
  agentPath?: string;

  // LLM settings (Go Gateway is the single source of truth)
  gatewayClient?: GatewayLLMClient;

  // Fallback model if ACP agent is unavailable
  fallbackModel?: string;

  // Enable hybrid mode (use both ACP agent and LLM)
  hybridMode?: boolean;

  // Timeout settings
  connectTimeout?: number;
  requestTimeout?: number;
}

/**
 * Default ACP configuration
 */
const DEFAULT_ACP_CONFIG: Partial<ACPBridgeConfig> = {
  connectTimeout: 30000,
  requestTimeout: 60000,
  timeout: 60000,
  hybridMode: false,
};

// =============================================================================
// ACP Bridge Implementation
// =============================================================================

/**
 * ACPBridge - Connects ACP-compatible agents to ChrysalisTerminal
 *
 * Supports two modes:
 * 1. Direct ACP mode: Connect to an ACP agent (Claude Code, OpenCode, etc.)
 * 2. Hybrid mode: Use ACP agent enhanced with Chrysalis LLM capabilities
 */
export class ACPBridge extends BaseBridge {
  private acpConfig: ACPBridgeConfig;
  private acpClient?: ACPClient;
  private gateway?: GatewayLLMClient;
  private llmClient?: AgentLLMClient;
  private acpAgentInfo?: ACPAgentInfo;
  private acpCapabilities?: ACPCapabilities;
  private conversationHistory: AgentMessage[] = [];
  private currentSessionId?: string;

  constructor(config: ACPBridgeConfig) {
    super({
      ...DEFAULT_ACP_CONFIG,
      ...config,
    });

    this.acpConfig = {
      ...DEFAULT_ACP_CONFIG,
      ...config,
    } as ACPBridgeConfig;

    this.gateway = config.gatewayClient;
  }

  // ==========================================================================
  // Identity
  // ==========================================================================

  get agentType(): AgentType {
    // ACP is a custom bridge type
    return 'custom';
  }

  get capabilities(): AgentCapability[] {
    const caps: AgentCapability[] = ['chat', 'multi_turn'];

    if (this.acpCapabilities?.files?.read || this.acpCapabilities?.files?.write) {
      caps.push('file_operations');
    }

    if (this.acpCapabilities?.terminal?.create) {
      caps.push('shell');
    }

    if (this.acpConfig.hybridMode && this.llmClient) {
      caps.push('streaming');
    }

    return caps;
  }

  get info(): AgentInfo {
    return {
      id: this.id,
      name: this.config.name,
      type: 'custom',
      description: this.buildDescription(),
      capabilities: this.capabilities,
      status: this.status,
      version: this.acpAgentInfo?.version ?? '1.0.0',
      metadata: {
        acpAgentType: this.acpConfig.acpAgent,
        acpAgentName: this.acpAgentInfo?.name,
        acpCapabilities: this.acpCapabilities,
        hybridMode: this.acpConfig.hybridMode,
        models: this.acpAgentInfo?.models,
      },
    };
  }

  /**
   * Build agent description
   */
  private buildDescription(): string {
    const parts: string[] = [];

    if (this.acpAgentInfo) {
      parts.push(`${this.acpAgentInfo.name} (ACP Agent)`);
      if (this.acpAgentInfo.description) {
        parts.push('-', this.acpAgentInfo.description);
      }
    } else {
      parts.push(`ACP Agent: ${this.acpConfig.acpAgent}`);
    }

    if (this.acpConfig.hybridMode) {
      parts.push('[Hybrid Mode]');
    }

    return parts.join(' ');
  }

  // ==========================================================================
  // Connection
  // ==========================================================================

  /**
   * Connect to the ACP agent
   */
  async connect(): Promise<void> {
    if (this.status === 'connected') {
      return;
    }

    this.setStatus('connecting');

    try {
      // Create ACP client based on agent type
      this.acpClient = this.createACPClient();

      // Setup event handlers
      this.setupACPEventHandlers();

      // Connect to ACP agent
      await this.acpClient.connect();

      // Store agent info and capabilities
      this.acpAgentInfo = this.acpClient.getAgentInfo();
      this.acpCapabilities = this.acpClient.getCapabilities();

      // Setup hybrid mode if enabled
      if (this.acpConfig.hybridMode) {
        await this.setupHybridMode();
      }

      this.setStatus('connected');
      this.emit({
        type: 'connected',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: {
          acpAgent: this.acpConfig.acpAgent,
          agentInfo: this.acpAgentInfo,
          capabilities: this.acpCapabilities,
        },
      });
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  /**
   * Disconnect from the ACP agent
   */
  async disconnect(): Promise<void> {
    if (this.status === 'disconnected') {
      return;
    }

    // Disconnect ACP client
    if (this.acpClient) {
      await this.acpClient.disconnect();
      this.acpClient = undefined;
    }

    // Clear LLM client
    this.llmClient = undefined;

    this.setStatus('disconnected');
    this.emit({
      type: 'disconnected',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: {},
    });
  }

  // ==========================================================================
  // ACP Client Setup
  // ==========================================================================

  private createACPClient(): ACPClient {
    const agent = this.acpConfig.acpAgent;
    const path = this.acpConfig.agentPath;

    switch (agent) {
      case 'opencode':
        return ACPAgentFactory.opencode(path);

      case 'codex':
        return ACPAgentFactory.codex(path);

      case 'gemini':
        return ACPAgentFactory.gemini(path);

      case 'claude-code':
        // Claude Code uses a different command structure
        return createACPClient(
          path ?? 'claude',
          ['code', 'acp'],
          { name: 'Chrysalis', version: '1.0.0' }
        );

      case 'qwen-code':
        return createACPClient(
          path ?? './qwen-code',
          ['acp'],
          { name: 'Chrysalis', version: '1.0.0' }
        );

      case 'mistral-vibe':
        return createACPClient(
          path ?? './mistral',
          ['acp'],
          { name: 'Chrysalis', version: '1.0.0' }
        );

      case 'auggie':
        return createACPClient(
          path ?? './auggie',
          ['acp'],
          { name: 'Chrysalis', version: '1.0.0' }
        );

      case 'custom':
        if (!this.acpConfig.command) {
          throw new Error('Custom ACP agent requires a command');
        }
        return createACPClient(
          this.acpConfig.command,
          this.acpConfig.args ?? ['acp'],
          { name: 'Chrysalis', version: '1.0.0' }
        );

      default:
        throw new Error(`Unknown ACP agent type: ${agent}`);
    }
  }

  private setupACPEventHandlers(): void {
    if (!this.acpClient) return;

    // Handle session updates (streaming)
    this.acpClient.on('sessionUpdate', (notification: SessionNotification) => {
      this.emit({
        type: 'stream_chunk',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: {
          sessionId: notification.sessionId,
          content: notification.content,
          status: notification.status,
          progress: notification.progress,
        },
      });

      // Handle tool calls
      if (notification.toolCalls) {
        for (const toolCall of notification.toolCalls) {
          this.emit({
            type: 'tool_call',
            bridgeId: this.id,
            timestamp: Date.now(),
            payload: toolCall,
          });
        }
      }

      // Handle completion
      if (notification.status === 'done') {
        this.emit({
          type: 'stream_end',
          bridgeId: this.id,
          timestamp: Date.now(),
          payload: { sessionId: notification.sessionId },
        });
      }
    });

    // Handle errors
    this.acpClient.on('error', (error: Error) => {
      this.emit({
        type: 'error',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { error: error.message },
      });
    });

    // Handle agent requests (file operations, terminal, etc.)
    this.acpClient.on('agentRequest', (request: unknown) => {
      // TODO: Implement handlers for agent requests
      // This allows the ACP agent to request file access, terminal, etc.
      this.log?.info('ACP Agent Request', { request });
    });
  }

  private async setupHybridMode(): Promise<void> {
    // Create or use provided gateway client
    if (!this.gateway) {
      this.gateway = new GatewayLLMClient();
    }

    // Create agent client for hybrid enhancements
    this.llmClient = new AgentLLMClient(this.gateway, {
      agentId: this.id,
      agentName: `${this.config.name} (Hybrid)`,
      systemPrompt: this.buildHybridSystemPrompt(),
      model: this.acpConfig.fallbackModel,
    });
  }

  private buildHybridSystemPrompt(): string {
    return `You are a hybrid assistant combining:
1. An ACP agent (${this.acpAgentInfo?.name ?? this.acpConfig.acpAgent}) for code-related tasks
2. Chrysalis LLM capabilities for enhanced reasoning and memory

When handling requests:
- Delegate code-related tasks to the ACP agent
- Use your reasoning capabilities for analysis and planning
- Combine insights from both sources

ACP Agent Capabilities:
${JSON.stringify(this.acpCapabilities, null, 2)}
`;
  }

  // ==========================================================================
  // Messaging
  // ==========================================================================

  /**
   * Send a message to the ACP agent
   */
  async send(message: AgentMessage, context?: AgentContext): Promise<AgentResponse> {
    if (!this.acpClient || this.status !== 'connected') {
      // Fallback to LLM if hybrid mode is enabled and ACP is unavailable
      if (this.acpConfig.hybridMode && this.llmClient) {
        return this.sendViaLLM(message, context);
      }
      return this.createErrorResponse('Not connected to ACP agent');
    }

    this.emit({
      type: 'message',
      bridgeId: this.id,
      timestamp: Date.now(),
      payload: { message },
    });

    try {
      // Format message with context
      let fullMessage = message.content;

      // Add memory context if available
      if (context?.memoryContext) {
        fullMessage = `[Context]\n${context.memoryContext}\n\n[User Message]\n${fullMessage}`;
      }

      // Send to ACP agent
      const acpResponse = await this.withTimeout(
        this.acpClient.prompt(fullMessage, {
          sessionId: this.currentSessionId,
        }),
        this.config.timeout
      );

      this.currentSessionId = acpResponse.sessionId;

      // Store in conversation history
      this.conversationHistory.push(message);
      const responseMessage: AgentMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content: acpResponse.content ?? '',
        role: 'assistant',
        timestamp: Date.now(),
      };
      this.conversationHistory.push(responseMessage);

      // Create response
      const response = this.createResponse(
        acpResponse.content ?? '',
        acpResponse.status === 'error' ? 'error' : 'success',
        {
          sessionId: acpResponse.sessionId,
          acpAgent: this.acpConfig.acpAgent,
        }
      );

      this.emit({
        type: 'response',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { response },
      });

      return response;
    } catch (error) {
      // Fallback to LLM if hybrid mode is enabled
      if (this.acpConfig.hybridMode && this.llmClient) {
        this.log.warn('ACP agent failed, falling back to LLM', {
          error: error instanceof Error ? error.message : String(error),
          bridgeId: this.id,
          sessionId: this.currentSessionId,
        });
        return this.sendViaLLM(message, context);
      }

      const errorResponse = this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error))
      );

      this.emit({
        type: 'error',
        bridgeId: this.id,
        timestamp: Date.now(),
        payload: { error },
      });

      return errorResponse;
    }
  }

  /**
   * Fallback to LLM for hybrid mode
   */
  private async sendViaLLM(
    message: AgentMessage,
    context?: AgentContext
  ): Promise<AgentResponse> {
    if (!this.llmClient) {
      return this.createErrorResponse('LLM client not available');
    }

    let fullMessage = message.content;

    if (context?.memoryContext) {
      fullMessage = `[Context]\n${context.memoryContext}\n\n[User Message]\n${fullMessage}`;
    }

    const completion = await this.llmClient.chat(fullMessage);

    return this.createResponse(completion.content, 'success', {
      source: 'llm-fallback',
      model: completion.model,
    });
  }

  /**
   * Stream responses from the ACP agent
   */
  async *stream(
    message: AgentMessage,
    context?: AgentContext
  ): AsyncIterable<AgentResponse> {
    if (!this.acpClient || this.status !== 'connected') {
      yield this.createErrorResponse('Not connected to ACP agent');
      return;
    }

    // Format message
    let fullMessage = message.content;
    if (context?.memoryContext) {
      fullMessage = `[Context]\n${context.memoryContext}\n\n[User Message]\n${fullMessage}`;
    }

    try {
      // Use the streaming prompt API
      for await (const notification of this.acpClient.promptStream(fullMessage, {
        sessionId: this.currentSessionId,
      })) {
        this.currentSessionId = notification.sessionId;

        if (notification.content) {
          yield this.createResponse(notification.content, 'partial', {
            sessionId: notification.sessionId,
            status: notification.status,
          });
        }

        if (notification.status === 'done' || notification.status === 'error') {
          break;
        }
      }
    } catch (error) {
      yield this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // ==========================================================================
  // ACP-Specific Operations
  // ==========================================================================

  /**
   * Get the current ACP session ID
   */
  getSessionId(): string | undefined {
    return this.currentSessionId;
  }

  /**
   * Get the ACP agent's capabilities
   */
  getACPCapabilities(): ACPCapabilities | undefined {
    return this.acpCapabilities;
  }

  /**
   * Check if a capability is supported
   */
  hasCapability(capability: keyof ACPCapabilities): boolean {
    if (!this.acpCapabilities) return false;
    return !!this.acpCapabilities[capability];
  }

  /**
   * Cancel the current ACP session
   */
  async cancelSession(): Promise<boolean> {
    if (!this.acpClient || !this.currentSessionId) {
      return false;
    }
    return this.acpClient.cancel(this.currentSessionId);
  }

  // ==========================================================================
  // Conversation Management
  // ==========================================================================

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    this.currentSessionId = undefined;
    if (this.llmClient) {
      this.llmClient.clearHistory();
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): AgentMessage[] {
    return [...this.conversationHistory];
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  async destroy(): Promise<void> {
    await super.destroy();
    this.conversationHistory = [];
    this.acpClient = undefined;
    this.llmClient = undefined;
    this.currentSessionId = undefined;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an ACP bridge instance
 */
export function createACPBridge(config: ACPBridgeConfig): ACPBridge {
  return new ACPBridge(config);
}

/**
 * Factory for creating ACP bridges for known agents
 */
export const ACPBridgeFactory = {
  /**
   * Create a bridge to OpenCode
   */
  opencode(options?: Partial<ACPBridgeConfig>): ACPBridge {
    return createACPBridge({
      id: 'acp-opencode',
      name: 'OpenCode',
      type: 'acp',
      enabled: true,
      acpAgent: 'opencode',
      ...options,
    });
  },

  /**
   * Create a bridge to Codex
   */
  codex(options?: Partial<ACPBridgeConfig>): ACPBridge {
    return createACPBridge({
      id: 'acp-codex',
      name: 'Codex',
      type: 'acp',
      enabled: true,
      acpAgent: 'codex',
      ...options,
    });
  },

  /**
   * Create a bridge to Gemini
   */
  gemini(options?: Partial<ACPBridgeConfig>): ACPBridge {
    return createACPBridge({
      id: 'acp-gemini',
      name: 'Gemini',
      type: 'acp',
      enabled: true,
      acpAgent: 'gemini',
      ...options,
    });
  },

  /**
   * Create a bridge to Claude Code
   */
  claudeCode(options?: Partial<ACPBridgeConfig>): ACPBridge {
    return createACPBridge({
      id: 'acp-claude-code',
      name: 'Claude Code',
      type: 'acp',
      enabled: true,
      acpAgent: 'claude-code',
      ...options,
    });
  },

  /**
   * Create a bridge to Qwen Code
   */
  qwenCode(options?: Partial<ACPBridgeConfig>): ACPBridge {
    return createACPBridge({
      id: 'acp-qwen-code',
      name: 'Qwen Code',
      type: 'acp',
      enabled: true,
      acpAgent: 'qwen-code',
      ...options,
    });
  },

  /**
   * Create a bridge to a custom ACP agent
   */
  custom(
    command: string,
    args: string[] = ['acp'],
    options?: Partial<ACPBridgeConfig>
  ): ACPBridge {
    return createACPBridge({
      id: `acp-custom-${command}`,
      name: `Custom ACP (${command})`,
      type: 'acp',
      enabled: true,
      acpAgent: 'custom',
      command,
      args,
      ...options,
    });
  },

  /**
   * Create a hybrid bridge (ACP + LLM fallback)
   */
  hybrid(
    acpAgent: ACPAgentType,
    gatewayClient: GatewayLLMClient,
    options?: Partial<ACPBridgeConfig>
  ): ACPBridge {
    return createACPBridge({
      id: `acp-hybrid-${acpAgent}`,
      name: `${acpAgent} (Hybrid)`,
      type: 'acp',
      enabled: true,
      acpAgent,
      gatewayClient,
      hybridMode: true,
      ...options,
    });
  },
};
