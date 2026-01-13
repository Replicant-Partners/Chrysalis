/**
 * WebSocketService - Real-time communication for System Agents
 *
 * Provides bidirectional messaging between the client chat pane and
 * the system agent evaluation pipeline. Supports:
 * - Message routing to individual personas (@ada, @lea, @phil, @david)
 * - Full evaluation pipeline execution (@evaluate)
 * - Real-time streaming of persona responses
 * - Typing indicators and status updates
 *
 * @module agents/system/WebSocketService
 */

import type {
  SystemAgentPersonaId,
  AgentWSClientMessage,
  AgentWSServerMessage,
  InteractionState,
  AggregatedEvaluation,
  PersonaEvaluationResult,
} from './types';

import type { SystemAgentBinding } from './types';
import type { EvaluationContext } from './EvaluationCoordinator';

// =============================================================================
// Types
// =============================================================================

/**
 * WebSocket connection state
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error';

/**
 * Event handlers for WebSocket lifecycle
 */
export interface WebSocketEventHandlers {
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (error: Error) => void;
  onMessage?: (message: AgentWSServerMessage) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
}

/**
 * Configuration for WebSocket service
 */
export interface WebSocketServiceConfig {
  url: string;
  reconnectAttempts?: number;
  reconnectDelayMs?: number;
  pingIntervalMs?: number;
  messageTimeoutMs?: number;
}

/**
 * Pending message awaiting response
 */
interface PendingMessage {
  messageId: string;
  resolve: (response: AgentWSServerMessage) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Required<WebSocketServiceConfig> = {
  url: 'ws://localhost:8080/agents/ws',
  reconnectAttempts: 5,
  reconnectDelayMs: 1000,
  pingIntervalMs: 30000,
  messageTimeoutMs: 60000,
};

// =============================================================================
// WebSocketService Class
// =============================================================================

/**
 * WebSocket service for real-time system agent communication.
 *
 * Usage:
 * ```typescript
 * const ws = new WebSocketService({ url: 'ws://localhost:8080/agents/ws' });
 * ws.connect({
 *   onMessage: (msg) => console.log('Received:', msg),
 *   onConnectionStateChange: (state) => console.log('State:', state),
 * });
 *
 * // Send a chat message to Ada
 * const response = await ws.sendChat('ada', 'Analyze this pattern...');
 *
 * // Run full evaluation pipeline
 * const evaluation = await ws.runEvaluation('code-artifact', {
 *   evaluationId: 'eval-123',
 *   description: 'Review this code',
 *   artifactType: 'code',
 * });
 *
 * ws.disconnect();
 * ```
 */
export class WebSocketService {
  private config: Required<WebSocketServiceConfig>;
  private socket: WebSocket | null = null;
  private handlers: WebSocketEventHandlers = {};
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempt = 0;
  private pendingMessages: Map<string, PendingMessage> = new Map();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;

  constructor(config: WebSocketServiceConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Update connection state and notify handlers
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.handlers.onConnectionStateChange?.(state);
  }

  /**
   * Connect to WebSocket server
   */
  connect(handlers?: WebSocketEventHandlers): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.warn('WebSocket already connected');
      return;
    }

    this.handlers = handlers || {};
    this.setConnectionState('connecting');

    try {
      this.socket = new WebSocket(this.config.url);
      this.setupSocketHandlers();
    } catch (error) {
      this.setConnectionState('error');
      this.handlers.onError?.(error as Error);
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.setConnectionState('connected');
      this.reconnectAttempt = 0;
      this.startPingInterval();
      this.handlers.onOpen?.();
    };

    this.socket.onclose = (event) => {
      this.setConnectionState('disconnected');
      this.stopPingInterval();
      this.handlers.onClose?.(event.code, event.reason);

      // Attempt reconnection
      if (this.reconnectAttempt < this.config.reconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (event) => {
      this.setConnectionState('error');
      this.handlers.onError?.(new Error('WebSocket error'));
    };

    this.socket.onmessage = (event) => {
      try {
        const message: AgentWSServerMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: AgentWSServerMessage): void {
    // Check if this is a response to a pending message
    const pending = this.pendingMessages.get(message.messageId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingMessages.delete(message.messageId);
      
      if (message.type === 'error') {
        pending.reject(new Error(message.error || 'Unknown error'));
      } else {
        pending.resolve(message);
      }
      return;
    }

    // Otherwise, pass to general handler
    this.handlers.onMessage?.(message);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'status',
          messageId: this.generateMessageId(),
          sessionId: this.sessionId,
        });
      }
    }, this.config.pingIntervalMs);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempt++;
    const delay = this.config.reconnectDelayMs * Math.pow(2, this.reconnectAttempt - 1);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempt} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.connectionState !== 'connected') {
        this.connect(this.handlers);
      }
    }, delay);
  }

  /**
   * Send a message and wait for response
   */
  private sendAndWait(message: AgentWSClientMessage): Promise<AgentWSServerMessage> {
    return new Promise((resolve, reject) => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        this.pendingMessages.delete(message.messageId);
        reject(new Error(`Message timeout: ${message.messageId}`));
      }, this.config.messageTimeoutMs);

      this.pendingMessages.set(message.messageId, {
        messageId: message.messageId,
        resolve,
        reject,
        timeout,
      });

      this.send(message);
    });
  }

  /**
   * Send a message (fire and forget)
   */
  private send(message: AgentWSClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not open');
    }
  }

  /**
   * Send a chat message to a specific persona
   */
  async sendChat(
    targetPersona: SystemAgentPersonaId,
    content: string
  ): Promise<AgentWSServerMessage> {
    const message: AgentWSClientMessage = {
      type: 'chat',
      messageId: this.generateMessageId(),
      content,
      targetPersona,
      sessionId: this.sessionId,
    };

    return this.sendAndWait(message);
  }

  /**
   * Run full evaluation pipeline
   */
  async runEvaluation(
    content: string,
    context: Partial<EvaluationContext>
  ): Promise<AgentWSServerMessage> {
    const message: AgentWSClientMessage = {
      type: 'evaluate',
      messageId: this.generateMessageId(),
      content,
      targetPersona: 'evaluate',
      artifactType: context.artifactType,
      sessionId: this.sessionId,
    };

    return this.sendAndWait(message);
  }

  /**
   * Subscribe to status updates for a persona
   */
  subscribeToStatus(personaId?: SystemAgentPersonaId): void {
    const message: AgentWSClientMessage = {
      type: 'subscribe',
      messageId: this.generateMessageId(),
      targetPersona: personaId,
      sessionId: this.sessionId,
    };

    this.send(message);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.setConnectionState('disconnecting');
      this.stopPingInterval();
      
      // Reject all pending messages
      for (const pending of this.pendingMessages.values()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Connection closed'));
      }
      this.pendingMessages.clear();

      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
      this.setConnectionState('disconnected');
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new WebSocketService instance
 */
export function createWebSocketService(config?: Partial<WebSocketServiceConfig>): WebSocketService {
  return new WebSocketService({
    ...DEFAULT_CONFIG,
    ...config,
  });
}

// =============================================================================
// Mock Server for Testing
// =============================================================================

/**
 * Mock WebSocket server for testing (runs in-memory)
 * This can be used in tests or when the real server is unavailable.
 */
export class MockWebSocketServer {
  private handlers: Map<string, (message: AgentWSClientMessage) => AgentWSServerMessage> = new Map();
  private defaultPersonaResponses: Record<SystemAgentPersonaId, (content: string) => string> = {
    ada: (content) => `[Ada] Pattern analysis of: ${content.substring(0, 50)}...`,
    lea: (content) => `[Lea] Implementation review of: ${content.substring(0, 50)}...`,
    phil: (content) => `[Phil] Forecast for: ${content.substring(0, 50)}...`,
    david: (content) => `[David] Metacognitive check of: ${content.substring(0, 50)}...`,
  };

  constructor() {
    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers(): void {
    // Chat handler
    this.handlers.set('chat', (message) => ({
      type: 'response',
      messageId: message.messageId,
      personaId: message.targetPersona as SystemAgentPersonaId,
      content: this.defaultPersonaResponses[message.targetPersona as SystemAgentPersonaId]?.(message.content || '') || 'OK',
    }));

    // Evaluate handler
    this.handlers.set('evaluate', (message) => ({
      type: 'evaluation',
      messageId: message.messageId,
      evaluation: {
        aggregatedRiskScore: 0.35,
        aggregatedConfidence: 0.75,
        recommendations: ['Review complete', 'No critical issues found'],
        requiresHumanReview: false,
        evaluationId: message.messageId,
        totalLatencyMs: 1500,
      } as AggregatedEvaluation,
    }));

    // Status handler
    this.handlers.set('status', (message) => ({
      type: 'status',
      messageId: message.messageId,
      status: 'responsive' as InteractionState,
    }));
  }

  /**
   * Process a message and return mock response
   */
  processMessage(message: AgentWSClientMessage): AgentWSServerMessage {
    const handler = this.handlers.get(message.type);
    if (handler) {
      return handler(message);
    }
    
    return {
      type: 'error',
      messageId: message.messageId,
      error: `Unknown message type: ${message.type}`,
    };
  }
}

// =============================================================================
// Exports
// =============================================================================

export { DEFAULT_CONFIG as WS_DEFAULT_CONFIG };
