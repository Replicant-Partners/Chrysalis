/**
 * VoyeurBusClient - Browser-based SSE client for observability events
 * 
 * Connects to the VoyeurWebServer via Server-Sent Events (EventSource API)
 * to receive real-time observability events from the backend.
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Event buffering with configurable max size
 * - Connection state management
 * - Error handling and logging
 * 
 * @module ui/utils/VoyeurBusClient
 */

/**
 * Event types from backend VoyeurEvents.ts
 */
export type VoyeurEventKind =
  | 'ingest.start'
  | 'ingest.complete'
  | 'embed.request'
  | 'embed.fallback'
  | 'match.candidate'
  | 'match.none'
  | 'merge.applied'
  | 'merge.deferred'
  | 'error'
  | string; // Allow custom event kinds

/**
 * Event structure matching backend VoyeurEvent interface
 */
export interface VoyeurEvent {
  kind: VoyeurEventKind;
  timestamp: string;
  memoryHash?: string;
  similarity?: number;
  threshold?: number;
  sourceInstance?: string;
  latencyMs?: number;
  decision?: string;
  details?: Record<string, unknown>;
}

/**
 * Connection states
 */
export type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Configuration options for VoyeurBusClient
 */
export interface VoyeurBusClientOptions {
  /** SSE server URL (default: http://localhost:8787) */
  serverUrl?: string;
  /** SSE stream path (default: /voyeur-stream) */
  streamPath?: string;
  /** Maximum events to buffer (default: 500) */
  maxBufferSize?: number;
  /** Enable automatic reconnection (default: true) */
  autoReconnect?: boolean;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectDelayMs?: number;
  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelayMs?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Event listener callback type
 */
export type VoyeurEventListener = (event: VoyeurEvent) => void;

/**
 * Connection state change callback type
 */
export type ConnectionStateListener = (state: ConnectionState) => void;

/**
 * VoyeurBusClient - SSE client for observability events
 */
export class VoyeurBusClient {
  private serverUrl: string;
  private streamPath: string;
  private maxBufferSize: number;
  private autoReconnect: boolean;
  private reconnectDelayMs: number;
  private maxReconnectDelayMs: number;
  private debug: boolean;

  private eventSource: EventSource | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private eventBuffer: VoyeurEvent[] = [];
  private eventListeners: Set<VoyeurEventListener> = new Set();
  private stateListeners: Set<ConnectionStateListener> = new Set();
  
  private reconnectAttempts = 0;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private isManualDisconnect = false;

  constructor(options: VoyeurBusClientOptions = {}) {
    this.serverUrl = options.serverUrl || 'http://localhost:8787';
    this.streamPath = options.streamPath || '/voyeur-stream';
    this.maxBufferSize = options.maxBufferSize || 500;
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectDelayMs = options.reconnectDelayMs || 1000;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs || 30000;
    this.debug = options.debug ?? false;
  }

  /**
   * Connect to the SSE stream
   */
  connect(): void {
    if (this.eventSource) {
      this.log('Already connected or connecting');
      return;
    }

    this.isManualDisconnect = false;
    this.setConnectionState('connecting');
    
    try {
      const url = `${this.serverUrl}${this.streamPath}`;
      this.log(`Connecting to ${url}`);
      
      this.eventSource = new EventSource(url);

      // Handle connection opened
      this.eventSource.onopen = () => {
        this.log('Connection established');
        this.reconnectAttempts = 0;
        this.setConnectionState('connected');
      };

      // Handle messages
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as VoyeurEvent;
          this.handleEvent(data);
        } catch (error) {
          this.log('Failed to parse event data:', error);
        }
      };

      // Handle errors
      this.eventSource.onerror = () => {
        this.log('Connection error');
        this.handleConnectionError();
      };

    } catch (error) {
      this.log('Failed to create EventSource:', error);
      this.setConnectionState('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the SSE stream
   */
  disconnect(): void {
    this.isManualDisconnect = true;
    this.clearReconnectTimeout();
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.setConnectionState('disconnected');
    this.log('Disconnected');
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get buffered events
   */
  getEvents(): VoyeurEvent[] {
    return [...this.eventBuffer];
  }

  /**
   * Clear event buffer
   */
  clearEvents(): void {
    this.eventBuffer = [];
    this.log('Event buffer cleared');
  }

  /**
   * Add event listener
   */
  addEventListener(listener: VoyeurEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: VoyeurEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Add connection state listener
   */
  addStateListener(listener: ConnectionStateListener): void {
    this.stateListeners.add(listener);
  }

  /**
   * Remove connection state listener
   */
  removeStateListener(listener: ConnectionStateListener): void {
    this.stateListeners.delete(listener);
  }

  /**
   * Handle incoming event
   */
  private handleEvent(event: VoyeurEvent): void {
    // Add to buffer
    this.eventBuffer.push(event);
    
    // Trim buffer if needed
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift();
    }

    // Notify listeners
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.log('Error in event listener:', error);
      }
    });
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.isManualDisconnect) {
      this.setConnectionState('disconnected');
      return;
    }

    this.setConnectionState('error');
    this.scheduleReconnect();
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (!this.autoReconnect || this.isManualDisconnect) {
      return;
    }

    this.clearReconnectTimeout();

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelayMs
    );

    this.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.setConnectionState('reconnecting');

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Clear reconnect timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  /**
   * Update connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) {
      return;
    }

    this.connectionState = state;
    this.log(`Connection state: ${state}`);

    this.stateListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        this.log('Error in state listener:', error);
      }
    });
  }

  /**
   * Debug logging
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[VoyeurBusClient] ${message}`, ...args);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect();
    this.eventListeners.clear();
    this.stateListeners.clear();
    this.eventBuffer = [];
  }
}

export default VoyeurBusClient;