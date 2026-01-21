/**
 * Message Bus Proof of Concept for AG-UI Implementation
 * 
 * This demonstrates the event-driven architecture needed to replace
 * the current tight React coupling in AgentCanvas.tsx
 */

// =============================================================================
// AG-UI Message Types (following AG-UI specification)
// =============================================================================

export interface BaseMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool' | 'developer' | 'activity';
    timestamp: string;
    sessionId: string;
}

export interface UserMessage extends BaseMessage {
    role: 'user';
    content: string;
    intent: 'select_agent' | 'move_agent' | 'change_state' | 'add_agent';
    targetId?: string;
    payload?: Record<string, any>;
}

export interface AssistantMessage extends BaseMessage {
    role: 'assistant';
    content: string;
    type: 'response' | 'state_update' | 'error';
    agentId?: string;
    state?: any;
}

export interface SystemMessage extends BaseMessage {
    role: 'system';
    type: 'agent_added' | 'agent_removed' | 'state_changed' | 'connection_status';
    payload: Record<string, any>;
}

export type AGUIMessage = UserMessage | AssistantMessage | SystemMessage;

// =============================================================================
// Message Bus Interface
// =============================================================================

export interface MessageBus {
    // Publishing
    publish(message: AGUIMessage): void;

    // Subscribing
    subscribe(role: AGUIMessage['role'], handler: (message: AGUIMessage) => void): () => void;
    subscribeToIntent(intent: UserMessage['intent'], handler: (message: UserMessage) => void): () => void;
    subscribeToAgent(agentId: string, handler: (message: AGUIMessage) => void): () => void;

    // Lifecycle
    start(): void;
    stop(): void;
    getStatus(): 'running' | 'stopped' | 'error';
}

// =============================================================================
// Transport Layer Interface
// =============================================================================

export interface Transport {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(message: AGUIMessage): Promise<void>;
    onMessage(handler: (message: AGUIMessage) => void): void;
    isConnected(): boolean;
}

// =============================================================================
// In-Memory Message Bus Implementation (for PoC)
// =============================================================================

export class InMemoryMessageBus implements MessageBus {
    private subscribers = new Map<string, Set<(message: AGUIMessage) => void>>();
    private intentSubscribers = new Map<string, Set<(message: UserMessage) => void>>();
    private agentSubscribers = new Map<string, Set<(message: AGUIMessage) => void>>();
    private status: 'running' | 'stopped' | 'error' = 'stopped';
    private transport?: Transport;

    constructor(transport?: Transport) {
        this.transport = transport;
    }

    publish(message: AGUIMessage): void {
        console.log(`[MessageBus] Publishing:`, message);

        // Notify role subscribers
        const roleSubs = this.subscribers.get(message.role);
        if (roleSubs) {
            roleSubs.forEach(handler => {
                try {
                    handler(message);
                } catch (error) {
                    console.error(`[MessageBus] Error in role subscriber:`, error);
                }
            });
        }

        // Notify intent subscribers (for user messages)
        if (message.role === 'user') {
            const intentSubs = this.intentSubscribers.get(message.intent);
            if (intentSubs) {
                intentSubs.forEach(handler => {
                    try {
                        handler(message as UserMessage);
                    } catch (error) {
                        console.error(`[MessageBus] Error in intent subscriber:`, error);
                    }
                });
            }
        }

        // Notify agent-specific subscribers
        const agentId = (message as any).agentId || (message as any).targetId;
        if (agentId) {
            const agentSubs = this.agentSubscribers.get(agentId);
            if (agentSubs) {
                agentSubs.forEach(handler => {
                    try {
                        handler(message);
                    } catch (error) {
                        console.error(`[MessageBus] Error in agent subscriber:`, error);
                    }
                });
            }
        }

        // Send via transport if available
        if (this.transport && this.transport.isConnected()) {
            this.transport.send(message).catch(error => {
                console.error(`[MessageBus] Transport error:`, error);
            });
        }
    }

    subscribe(role: AGUIMessage['role'], handler: (message: AGUIMessage) => void): () => void {
        if (!this.subscribers.has(role)) {
            this.subscribers.set(role, new Set());
        }
        this.subscribers.get(role)!.add(handler);

        return () => {
            this.subscribers.get(role)?.delete(handler);
        };
    }

    subscribeToIntent(intent: UserMessage['intent'], handler: (message: UserMessage) => void): () => void {
        if (!this.intentSubscribers.has(intent)) {
            this.intentSubscribers.set(intent, new Set());
        }
        this.intentSubscribers.get(intent)!.add(handler);

        return () => {
            this.intentSubscribers.get(intent)?.delete(handler);
        };
    }

    subscribeToAgent(agentId: string, handler: (message: AGUIMessage) => void): () => void {
        if (!this.agentSubscribers.has(agentId)) {
            this.agentSubscribers.set(agentId, new Set());
        }
        this.agentSubscribers.get(agentId)!.add(handler);

        return () => {
            this.agentSubscribers.get(agentId)?.delete(handler);
        };
    }

    start(): void {
        this.status = 'running';
        console.log('[MessageBus] Started');
    }

    stop(): void {
        this.status = 'stopped';
        console.log('[MessageBus] Stopped');
    }

    getStatus(): 'running' | 'stopped' | 'error' {
        return this.status;
    }
}

// =============================================================================
// WebSocket Transport Implementation (for real-time communication)
// =============================================================================

export class WebSocketTransport implements Transport {
    private ws?: WebSocket;
    private messageHandler?: (message: AGUIMessage) => void;
    private connected = false;

    constructor(private url: string) { }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    this.connected = true;
                    console.log('[WebSocket] Connected');
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    if (this.messageHandler) {
                        try {
                            const message = JSON.parse(event.data) as AGUIMessage;
                            this.messageHandler(message);
                        } catch (error) {
                            console.error('[WebSocket] Invalid message format:', error);
                        }
                    }
                };

                this.ws.onclose = () => {
                    this.connected = false;
                    console.log('[WebSocket] Disconnected');
                };

                this.ws.onerror = (error) => {
                    this.connected = false;
                    console.error('[WebSocket] Error:', error);
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
        this.connected = false;
    }

    async send(message: AGUIMessage): Promise<void> {
        if (!this.ws || !this.connected) {
            throw new Error('WebSocket not connected');
        }

        this.ws.send(JSON.stringify(message));
    }

    onMessage(handler: (message: AGUIMessage) => void): void {
        this.messageHandler = handler;
    }

    isConnected(): boolean {
        return this.connected;
    }
}

// =============================================================================
// Usage Example (replacing AgentCanvas coupling)
// =============================================================================

export function createAGUIExample() {
    const messageBus = new InMemoryMessageBus();
    messageBus.start();

    // UI Component subscribes to agent state changes
    const unsubscribeState = messageBus.subscribe('system', (message) => {
        if (message.type === 'state_changed') {
            console.log(`[UI] Agent ${message.payload.agentId} state changed to ${message.payload.newState}`);
            // Update UI state instead of using direct callbacks
        }
    });

    // UI Component publishes user actions
    const publishAgentSelection = (agentId: string) => {
        const message: UserMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            timestamp: new Date().toISOString(),
            sessionId: 'demo-session',
            content: `Select agent ${agentId}`,
            intent: 'select_agent',
            targetId: agentId
        };
        messageBus.publish(message);
    };

    // Backend service subscribes to user intents
    const unsubscribeIntent = messageBus.subscribeToIntent('select_agent', (message) => {
        console.log(`[Backend] Processing agent selection: ${message.targetId}`);
        // Handle business logic
        const response: AssistantMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            timestamp: new Date().toISOString(),
            sessionId: message.sessionId,
            content: `Agent ${message.targetId} selected`,
            type: 'response',
            agentId: message.targetId
        };
        messageBus.publish(response);
    });

    return {
        messageBus,
        publishAgentSelection,
        cleanup: () => {
            unsubscribeState();
            unsubscribeIntent();
            messageBus.stop();
        }
    };
}

// =============================================================================
// Validation: This PoC demonstrates:
// =============================================================================

/*
1. ✅ Event-driven communication replaces direct React callbacks
2. ✅ AG-UI message structure with proper roles and intents  
3. ✅ Decoupled UI components can subscribe to relevant messages
4. ✅ Backend services can handle user intents without direct coupling
5. ✅ Transport layer abstraction enables real-time communication
6. ✅ Message routing by role, intent, and agent ID
7. ✅ Error handling and lifecycle management

This validates that a message bus architecture can solve the tight coupling
problem identified in AgentCanvas.tsx and provide the foundation for AG-UI.
*/