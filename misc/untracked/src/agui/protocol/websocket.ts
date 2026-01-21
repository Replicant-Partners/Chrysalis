/**
 * AG-UI WebSocket Transport Implementation
 * 
 * WebSocket-based transport for real-time bidirectional communication
 * Supports automatic reconnection, heartbeat, and connection pooling
 * 
 * @module agui/protocol
 */

import type { 
  AGUIMessage, 
  TransportConfig, 
  TransportError, 
  AGUIEventType,
  MessageHandler 
} from './types';
import { serializeMessage, deserializeMessage } from './index';

export type WebSocketState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export interface WebSocketOptions {
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  maxMessageSize?: number;
  enableCompression?: boolean;
  protocols?: string[];
}

export interface WebSocketStats {
  connectedAt?: Date;
  lastMessageAt?: Date;
  messagesSent: number;
  messagesReceived: number;
  reconnectAttempts: number;
  averageLatency: number;
  connectionUptime: number; // ms
}

// =============================================================================
// WebSocket Transport Class
// =============================================================================

export class WebSocketTransport {
  private ws?: WebSocket;
  private stateValue: WebSocketState = 'disconnected';
  private messageHandlers = new Map<AGUIEventType, Set<MessageHandler>>();
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private stats: WebSocketStats = {
    messagesSent: 0,
    messagesReceived: 0,
    reconnectAttempts: 0,
    averageLatency: 0,
    connectionUptime: 0
  };
  private latencyMeasurements: number[] = [];
  private connectionStartTime?: Date;

  constructor(
    private urlValue: string,
    private options: WebSocketOptions = {}
  ) {
    this.urlValue = url;
    this.options = {
      reconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
      maxMessageSize: 1024 * 1024, // 1MB
      enableCompression: false,
      protocols: ['agui-v1'],
      ...options
    };
  }

  // =============================================================================
  // Connection Management
  // =============================================================================

  public async connect(): Promise<void> {
    if (this.stateValue === 'connected') {
      return;
    }

    this.setState('connecting');
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.urlValue, this.options.protocols?.join(','));
        
        this.ws.binaryType = 'arraybuffer';
        this.ws.onopen = this.handleOpen.bind(this);
        this.ws.onmessage = this.handleMessage.bind(this);
        this.ws.onclose = this.handleClose.bind(this);
        this.ws.onerror = this.handleError.bind(this);
        
        // Connection timeout
        const timeout = setTimeout(() => {
          if (this.stateValue === 'connecting') {
            this.handleError(new Error('Connection timeout'));
          }
        }, this.options.connectionTimeout);
        
        // Store timeout reference for cleanup
        (this.ws as any)._timeout = timeout;
        
      } catch (error) {
        this.setState('error');
        reject(new TransportError(
          `Failed to create WebSocket: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'WEBSOCKET_CREATE_ERROR',
          { url: this.urlValue, error }
        ));
      }
    });
  }

  public async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    this.clearHeartbeatTimer();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = undefined;
    }
    
    this.setState('disconnected');
    this.stats.connectionUptime = 0;
  }

  public async send(message: AGUIMessage): Promise<void> {
    if (this.stateValue !== 'connected') {
      throw new TransportError(
        'WebSocket not connected',
        'WEBSOCKET_NOT_CONNECTED',
        { state: this.stateValue }
      );
    }

    try {
      const serialized = serializeMessage(message);
      
      // Check message size
      if (this.options.maxMessageSize && serialized.length > this.options.maxMessageSize) {
        throw new TransportError(
          `Message size exceeds limit: ${serialized.length} > ${this.options.maxMessageSize}`,
          'WEBSOCKET_MESSAGE_TOO_LARGE'
        );
      }

      // Measure latency for sent messages
      const startTime = Date.now();
      
      this.ws!.send(serialized);
      
      this.stats.messagesSent++;
      this.stats.lastMessageAt = new Date();
      
      // Store timestamp for latency calculation when response comes back
      (message as any)._sentTime = startTime;
      
    } catch (error) {
      throw new TransportError(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WEBSOCKET_SEND_ERROR',
        { message, error }
      );
    }
  }

  public onMessage(eventType: AGUIEventType, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, new Set());
    }
    this.messageHandlers.get(eventType)!.add(handler);
    
    return () => {
      this.messageHandlers.get(eventType)?.delete(handler);
    };
  }

  public getState(): WebSocketState {
    return this.stateValue;
  }

  public getStats(): WebSocketStats {
    return { ...this.stats };
  }

  public getUrl(): string {
    return this.urlValue;
  }

  // =============================================================================
  // Event Handlers
  // =============================================================================

  private handleOpen(event: Event): void {
    this.clearReconnectTimer();
    this.setState('connected');
    this.connectionStartTime = new Date();
    this.stats.connectedAt = this.connectionStartTime;
    this.stats.reconnectAttempts = 0;
    
    console.log(`[AG-UI WebSocket] Connected to ${this.urlValue}`);
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Send connection established message
    this.sendSystemMessage('session.started', {
      message: 'WebSocket connection established',
      transport: 'websocket',
      url: this.urlValue
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = deserializeMessage(event.data as string);
      
      // Calculate latency if this is a response to a sent message
      if ((message as any)._sentTime) {
        const latency = Date.now() - (message as any)._sentTime;
        this.latencyMeasurements.push(latency);
        
        // Keep only last 10 measurements for average
        if (this.latencyMeasurements.length > 10) {
          this.latencyMeasurements.shift();
        }
        
        this.stats.averageLatency = 
          this.latencyMeasurements.reduce((sum, val) => sum + val, 0) / 
          this.latencyMeasurements.length;
      }
      
      delete (message as any)._sentTime;
      }
      
      this.stats.messagesReceived++;
      this.stats.lastMessageAt = new Date();
      
      // Route message to appropriate handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error('[AG-UI WebSocket] Error in message handler:', error);
          }
        });
      }
      
    } catch (error) {
      console.error('[AG-UI WebSocket] Failed to handle message:', error);
      this.sendSystemMessage('error.occurred', {
        error: `Message handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: { data: event.data }
      });
    }
  }

  private handleClose(event: CloseEvent): void {
    this.clearHeartbeatTimer();
    this.setState('disconnected');
    
    if (this.connectionStartTime) {
      this.stats.connectionUptime = Date.now() - this.connectionStartTime.getTime();
    }
    
    console.log(`[AG-UI WebSocket] Disconnected from ${this.urlValue}, code: ${event.code}, reason: ${event.reason}`);
    
    // Send disconnection notification
    this.sendSystemMessage('session.ended', {
      message: 'WebSocket connection closed',
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });
    
    // Auto-reconnect if enabled and not a normal closure
    if (this.options.reconnect && event.code !== 1000) {
      this.attemptReconnect();
    }
  }

  private handleError(event: Event): void {
    this.setState('error');
    this.clearHeartbeatTimer();
    
    console.error('[AG-UI WebSocket] WebSocket error:', event);
    
    this.sendSystemMessage('error.occurred', {
      error: 'WebSocket connection error',
      event
    });
    
    // Attempt reconnection if enabled
    if (this.options.reconnect) {
      this.attemptReconnect();
    }
  }

  // =============================================================================
  // Reconnection Logic
  // =============================================================================

  private attemptReconnect(): void {
    if (this.stats.reconnectAttempts >= (this.options.maxReconnectAttempts || 5)) {
      console.error('[AG-UI WebSocket] Max reconnection attempts reached');
      this.setState('error');
      return;
    }

    this.stats.reconnectAttempts++;
    this.setState('reconnecting');
    
    const delay = this.options.reconnectDelay! * Math.pow(2, this.stats.reconnectAttempts - 1);
    
    console.log(`[AG-UI WebSocket] Attempting reconnection ${this.stats.reconnectAttempts}/${this.options.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('[AG-UI WebSocket] Reconnection failed:', error);
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  // =============================================================================
  // Heartbeat Management
  // =============================================================================

  private startHeartbeat(): void {
    if (!this.options.heartbeatInterval) return;
    
    this.heartbeatTimer = setInterval(() => {
      if (this.stateValue === 'connected' && this.ws) {
        try {
          // Send ping message
          this.sendSystemMessage('agent.connected', {
            heartbeat: true,
            timestamp: new Date().toISOString(),
            stats: this.getStats()
          });
        } catch (error) {
          console.error('[AG-UI WebSocket] Heartbeat failed:', error);
        }
      }
    }, this.options.heartbeatInterval);
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  private setState(newState: WebSocketState): void {
    const oldState = this.stateValue;
    this.stateValue = newState;
    
    if (oldState !== newState) {
      console.log(`[AG-UI WebSocket] State change: ${oldState} -> ${newState}`);
      
      // Send activity notification
      this.sendSystemMessage('activity', {
        activity: `state.${newState}`,
        previousState: oldState,
        newState
      });
    }
  }

  private sendSystemMessage(type: AGUIEventType, data: unknown): void {
    try {
      const message = {
        id: crypto.randomUUID(),
        sessionId: 'system',
        role: 'system' as const,
        type,
        timestamp: new Date().toISOString(),
        data
      };
      
      if (this.stateValue === 'connected' && this.ws) {
        this.ws.send(serializeMessage(message));
      }
    } catch (error) {
      console.error('[AG-UI WebSocket] Failed to send system message:', error);
    }
  }

  // =============================================================================
  // Static Factory Method
  // =============================================================================

  public static create(config: TransportConfig & { type: 'websocket' }): WebSocketTransport {
    if (config.type !== 'websocket') {
      throw new TransportError(
        'Invalid transport type for WebSocket transport',
        'INVALID_TRANSPORT_TYPE'
      );
    }
    
    return new WebSocketTransport(config.url, config.options as WebSocketOptions);
  }
}