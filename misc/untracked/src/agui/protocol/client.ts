/**
 * AG-UI Client Implementation
 * 
 * Client-side implementation for connecting UI components to AG-UI backend services
 * Supports multiple transport mechanisms and automatic reconnection
 * 
 * @module agui/protocol
 */

import type { AGUIMessage, UserMessage, AssistantMessage, SystemMessage } from './index';
import { serializeMessage, deserializeMessage } from './index';

// =============================================================================
// Transport Implementations
// =============================================================================

export interface Transport {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(message: AGUIMessage): Promise<void>;
    onMessage(handler: (message: AGUIMessage) => void): void;
    isConnected(): boolean;
    getStatus(): 'connecting' | 'connected' | 'disconnected' | 'error';
}

export class WebSocketTransport implements Transport {
    private ws?: WebSocket;
    private messageHandler?: (message: AGUIMessage) => void;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000; // ms
    private status: Transport['getStatus'] = 'disconnected';

    constructor(
        private url: string,
        private options: {
            reconnect?: boolean;
            maxReconnectAttempts?: number;
            reconnectDelay?: number;
        } = {}
    ) {
        this.url = url;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.reconnectDelay = options.reconnectDelay || 1000;
    }

    async connect(): Promise<void> {
        if (this.status === 'connected') return;

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    this.status = 'connected';
                    console.log('[AG-UI Client] Connected to AG-UI server');
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    if (this.messageHandler) {
                        try {
                            const message = deserializeMessage(event.data);
                            this.messageHandler(message);
                        } catch (error) {
                            console.error('[AG-UI Client] Failed to deserialize message:', error);
                        }
                    }
                };

                this.ws.onclose = () => {
                    this.status = 'disconnected';
                    console.log('[AG-UI Client] Disconnected from AG-UI server');

                    // Auto-reconnect if enabled
                    if (this.shouldReconnect()) {
                        setTimeout(() => {
                            this.connect().catch(error => {
                                console.error('[AG-UI Client] Reconnection failed:', error);
                            });
                        }, this.reconnectDelay);
                    }
                };

                this.ws.onerror = (error) => {
                    this.status = 'error';
                    console.error('[AG-UI Client] WebSocket error:', error);
                    reject(error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    async disconnect(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = undefined;
        }
        this.status = 'disconnected';
    }

    async send(message: AGUIMessage): Promise<void> {
        if (!this.ws || this.status !== 'connected') {
            throw new Error('WebSocket not connected');
        }

        this.ws.send(serializeMessage(message));
    }

    onMessage(handler: (message: AGUIMessage) => void): void {
        this.messageHandler = handler;
    }

    isConnected(): boolean {
        return this.status === 'connected';
    }

    getStatus(): Transport['getStatus'] {
        return this.status;
    }

    private shouldReconnect(): boolean {
        return this.reconnectAttempts < this.maxReconnectAttempts;
    }
}

export class HttpTransport implements Transport {
    private baseUrl: string;
    private messageHandler?: (message: AGUIMessage) => void;
    private status: Transport['getStatus'] = 'disconnected';

    constructor(private baseUrl: string) { }

    async connect(): Promise<void> {
        // HTTP transport would use polling or SSE for real-time updates
        // For now, basic implementation
        this.status = 'connected';
        console.log('[AG-UI Client] HTTP transport connected');
    }

    async disconnect(): Promise<void> {
        this.status = 'disconnected';
        console.log('[AG-UI Client] HTTP transport disconnected');
    }

    async send(message: AGUIMessage): Promise<void> {
        if (this.status !== 'connected') {
            throw new Error('HTTP transport not connected');
        }

        try {
            const response = await fetch(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-AG-UI-Session': message.sessionId,
                },
                body: serializeMessage(message),
            });

            if (!response.ok) {
                throw new Error(`HTTP request failed: ${response.statusText}`);
            }
        } catch (error) {
            console.error('[AG-UI Client] HTTP request failed:', error);
            throw error;
        }
    }

    onMessage(handler: (message: AGUIMessage) => void): void {
        this.messageHandler = handler;
    }

    isConnected(): boolean {
        return this.status === 'connected';
    }

    getStatus(): Transport['getStatus'] {
        return this.status;
    }
}

export class ServerSentEventsTransport implements Transport {
    private eventSource?: EventSource;
    private messageHandler?: (message: AGUIMessage) => void;
    private status: Transport['getStatus'] = 'disconnected';

    constructor(private url: string) { }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.eventSource = new EventSource(this.url);

                this.eventSource.onopen = () => {
                    this.status = 'connected';
                    console.log('[AG-UI Client] SSE connected');
                    resolve();
                };

                this.eventSource.onmessage = (event) => {
                    if (this.messageHandler) {
                        try {
                            const message = deserializeMessage(event.data);
                            this.messageHandler(message);
                        } catch (error) {
                            console.error('[AG-UI Client] Failed to deserialize SSE message:', error);
                        }
                    }
                };

                this.eventSource.onerror = (error) => {
                    this.status = 'error';
                    console.error('[AG-UI Client] SSE error:', error);
                    reject(error);
                };

                this.eventSource.onclose = () => {
                    this.status = 'disconnected';
                    console.log('[AG-UI Client] SSE disconnected');
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    async disconnect(): Promise<void> {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
        }
        this.status = 'disconnected';
    }

    async send(message: AGUIMessage): Promise<void> {
        // SSE is receive-only, would need separate HTTP endpoint for sending
        console.warn('[AG-UI Client] SSE transport is receive-only');
    }

    onMessage(handler: (message: AGUIMessage) => void): void {
        this.messageHandler = handler;
    }

    isConnected(): boolean {
        return this.status === 'connected';
    }

    getStatus(): Transport['getStatus'] {
        return this.status;
    }
}

// =============================================================================
// AG-UI Client Class
// =============================================================================

export interface AGUIClientConfig {
    transport: 'websocket' | 'http' | 'sse';
    url: string;
    sessionId?: string;
    autoReconnect?: boolean;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
}

export class AGUIClient {
    private transport: Transport;
    private sessionId: string;
    private messageHandlers = new Map<string, Set<(message: AGUIMessage) => void>>();

    constructor(private config: AGUIClientConfig) {
        this.sessionId = config.sessionId || crypto.randomUUID();

        // Initialize transport
        switch (config.transport) {
            case 'websocket':
                this.transport = new WebSocketTransport(config.url, {
                    reconnect: config.autoReconnect,
                    maxReconnectAttempts: config.maxReconnectAttempts,
                    reconnectDelay: config.reconnectDelay,
                });
                break;
            case 'http':
                this.transport = new HttpTransport(config.url);
                break;
            case 'sse':
                this.transport = new ServerSentEventsTransport(config.url);
                break;
            default:
                throw new Error(`Unsupported transport type: ${config.transport}`);
        }
    }

    async connect(): Promise<void> {
        await this.transport.connect();
        this.transport.onMessage(this.handleIncomingMessage);
    }

    async disconnect(): Promise<void> {
        await this.transport.disconnect();
    }

    async send(message: AGUIMessage): Promise<void> {
        const messageWithSession = {
            ...message,
            sessionId: this.sessionId,
        };
        await this.transport.send(messageWithSession);
    }

    // Message handling
    onMessage(role: AGUIMessage['role'], handler: (message: AGUIMessage) => void): () => void {
        if (!this.messageHandlers.has(role)) {
            this.messageHandlers.set(role, new Set());
        }
        this.messageHandlers.get(role)!.add(handler);

        return () => {
            this.messageHandlers.get(role)?.delete(handler);
        };
    }

    onUserMessage(handler: (message: UserMessage) => void): () => void {
        return this.onMessage('user', handler);
    }

    onAssistantMessage(handler: (message: AssistantMessage) => void): () => void {
        return this.onMessage('assistant', handler);
    }

    onSystemMessage(handler: (message: SystemMessage) => void): () => void {
        return this.onMessage('system', handler);
    }

    onToolMessage(handler: (message: any) => void): () => void {
        return this.onMessage('tool', handler);
    }

    onActivityMessage(handler: (message: any) => void): () => void {
        return this.onMessage('activity', handler);
    }

    onAnyMessage(handler: (message: AGUIMessage) => void): () => void {
        return this.onMessage('any', handler);
    }

    private handleIncomingMessage(message: AGUIMessage): void {
        console.log(`[AG-UI Client] Received:`, message);

        // Route to specific handlers
        const handlers = this.messageHandlers.get(message.role);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(message);
                } catch (error) {
                    console.error(`[AG-UI Client] Error in message handler:`, error);
                }
            });
        }

        // Also call general handler if registered
        const generalHandlers = this.messageHandlers.get('any');
        if (generalHandlers) {
            generalHandlers.forEach(handler => {
                try {
                    handler(message);
                } catch (error) {
                    console.error(`[AG-UI Client] Error in general handler:`, error);
                }
            });
        }
    }

    isConnected(): boolean {
        return this.transport.isConnected();
    }

    getStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
        return this.transport.getStatus();
    }
}