/**
 * ChrysalisTerminal
 * 
 * Core terminal class implementing the three-frame interface:
 * - Left ChatPane: Agent conversation
 * - Center JSONCanvas: Interactive widget container
 * - Right ChatPane: User/human conversation
 * 
 * Uses YJS CRDT for real-time synchronization between
 * humans and agents using the same data structures.
 * 
 * @module terminal/ChrysalisTerminal
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import {
  TerminalSession,
  TerminalConfig,
  TerminalEvent,
  TerminalEventType,
  TerminalEventHandler,
  Participant,
  ParticipantId,
  ParticipantType,
  FramePosition,
  ChatPaneState,
  ChatMessage,
  CanvasState,
  CanvasNode,
  CanvasEdge,
  WidgetNode,
  AwarenessState,
  DEFAULT_TERMINAL_CONFIG
} from './protocols';
import { WidgetRegistry, defaultWidgetRegistry } from './protocols/widgets';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * ChrysalisTerminal - Protocol harness for human/agent interaction
 */
export class ChrysalisTerminal {
  private doc: Y.Doc;
  private wsProvider?: WebsocketProvider;
  private config: TerminalConfig;
  private eventHandlers: Map<TerminalEventType, TerminalEventHandler[]> = new Map();
  private widgetRegistry: WidgetRegistry;
  
  // YJS shared types
  private ySession: Y.Map<unknown>;
  private yLeftPane: Y.Map<unknown>;
  private yRightPane: Y.Map<unknown>;
  private yCanvas: Y.Map<unknown>;
  private yParticipants: Y.Map<unknown>;
  private yAwareness: Y.Map<unknown>;
  
  // Local state
  private sessionId: string;
  private participantId: ParticipantId;
  
  constructor(config: Partial<TerminalConfig> & {
    participantId: ParticipantId;
    participantType: ParticipantType;
    participantName: string;
  }) {
    this.config = {
      ...DEFAULT_TERMINAL_CONFIG,
      ...config,
      widgetRegistry: config.widgetRegistry ?? defaultWidgetRegistry
    } as TerminalConfig;
    
    this.widgetRegistry = this.config.widgetRegistry;
    this.participantId = config.participantId;
    this.sessionId = config.sessionId ?? generateId();
    
    // Initialize YJS document
    this.doc = new Y.Doc();
    
    // Initialize shared types
    this.ySession = this.doc.getMap('session');
    this.yLeftPane = this.doc.getMap('leftPane');
    this.yRightPane = this.doc.getMap('rightPane');
    this.yCanvas = this.doc.getMap('canvas');
    this.yParticipants = this.doc.getMap('participants');
    this.yAwareness = this.doc.getMap('awareness');
    
    // Set up observers
    this.setupObservers();
    
    // Initialize session state
    this.initializeSession();
  }
  
  /**
   * Initialize session state
   */
  private initializeSession(): void {
    this.doc.transact(() => {
      // Session metadata
      if (!this.ySession.has('id')) {
        this.ySession.set('id', this.sessionId);
        this.ySession.set('name', this.config.sessionName ?? 'Chrysalis Terminal');
        this.ySession.set('createdAt', Date.now());
      }
      this.ySession.set('lastActivity', Date.now());
      
      // Left pane
      if (!this.yLeftPane.has('id')) {
        this.yLeftPane.set('id', 'left-' + this.sessionId);
        this.yLeftPane.set('position', 'left');
        this.yLeftPane.set('title', this.config.leftPane.title);
        this.yLeftPane.set('messages', new Y.Array());
        this.yLeftPane.set('participants', new Y.Array());
        this.yLeftPane.set('isTyping', new Y.Array());
        this.yLeftPane.set('scrollPosition', 0);
      }
      
      // Right pane
      if (!this.yRightPane.has('id')) {
        this.yRightPane.set('id', 'right-' + this.sessionId);
        this.yRightPane.set('position', 'right');
        this.yRightPane.set('title', this.config.rightPane.title);
        this.yRightPane.set('messages', new Y.Array());
        this.yRightPane.set('participants', new Y.Array());
        this.yRightPane.set('isTyping', new Y.Array());
        this.yRightPane.set('scrollPosition', 0);
      }
      
      // Canvas
      if (!this.yCanvas.has('id')) {
        this.yCanvas.set('id', 'canvas-' + this.sessionId);
        this.yCanvas.set('nodes', new Y.Array());
        this.yCanvas.set('edges', new Y.Array());
        this.yCanvas.set('viewport', { x: 0, y: 0, zoom: 1 });
        this.yCanvas.set('selectedNodes', new Y.Array());
        this.yCanvas.set('selectedEdges', new Y.Array());
      }
      
      // Add self as participant
      const participant: Participant = {
        id: this.participantId,
        type: this.config.participantType,
        name: this.config.participantName,
        role: 'collaborator',
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        metadata: {}
      };
      this.yParticipants.set(this.participantId, participant);
    });
    
    // Emit session created event
    this.emit({
      type: 'session:created',
      sessionId: this.sessionId,
      participantId: this.participantId,
      timestamp: Date.now(),
      payload: { sessionId: this.sessionId }
    });
  }
  
  /**
   * Set up YJS observers for change events
   */
  private setupObservers(): void {
    // Observe left pane messages
    const leftMessages = this.yLeftPane.get('messages') as Y.Array<unknown>;
    leftMessages?.observe((event) => {
      if (event.changes.added.size > 0) {
        event.changes.added.forEach((item) => {
          const content = item.content as Y.ContentAny;
          if (content && 'arr' in content) {
            (content.arr as unknown[]).forEach((msg) => {
              this.emit({
                type: 'chat:message',
                sessionId: this.sessionId,
                participantId: (msg as ChatMessage).senderId,
                timestamp: Date.now(),
                payload: { frame: 'left', message: msg }
              });
            });
          }
        });
      }
    });
    
    // Observe right pane messages
    const rightMessages = this.yRightPane.get('messages') as Y.Array<unknown>;
    rightMessages?.observe((event) => {
      if (event.changes.added.size > 0) {
        event.changes.added.forEach((item) => {
          const content = item.content as Y.ContentAny;
          if (content && 'arr' in content) {
            (content.arr as unknown[]).forEach((msg) => {
              this.emit({
                type: 'chat:message',
                sessionId: this.sessionId,
                participantId: (msg as ChatMessage).senderId,
                timestamp: Date.now(),
                payload: { frame: 'right', message: msg }
              });
            });
          }
        });
      }
    });
    
    // Observe canvas nodes
    const canvasNodes = this.yCanvas.get('nodes') as Y.Array<unknown>;
    canvasNodes?.observe((event) => {
      event.changes.added.forEach((item) => {
        const content = item.content as Y.ContentAny;
        if (content && 'arr' in content) {
          (content.arr as unknown[]).forEach((node) => {
            this.emit({
              type: 'canvas:node:added',
              sessionId: this.sessionId,
              participantId: this.participantId,
              timestamp: Date.now(),
              payload: { node }
            });
          });
        }
      });
      
      event.changes.deleted.forEach((item) => {
        const content = item.content as Y.ContentAny;
        if (content && 'arr' in content) {
          (content.arr as unknown[]).forEach((node) => {
            this.emit({
              type: 'canvas:node:deleted',
              sessionId: this.sessionId,
              participantId: this.participantId,
              timestamp: Date.now(),
              payload: { node }
            });
          });
        }
      });
    });
  }
  
  // ============================================================================
  // Connection
  // ============================================================================
  
  /**
   * Connect to sync server
   */
  connect(serverUrl?: string): void {
    const url = serverUrl ?? this.config.syncServerUrl;
    if (!url) {
      console.warn('No sync server URL configured');
      return;
    }
    
    this.wsProvider = new WebsocketProvider(url, this.sessionId, this.doc);
    
    this.wsProvider.on('status', (event: { status: string }) => {
      if (event.status === 'connected') {
        this.emit({
          type: 'sync:connected',
          sessionId: this.sessionId,
          participantId: this.participantId,
          timestamp: Date.now(),
          payload: { serverUrl: url }
        });
      } else if (event.status === 'disconnected') {
        this.emit({
          type: 'sync:disconnected',
          sessionId: this.sessionId,
          participantId: this.participantId,
          timestamp: Date.now(),
          payload: {}
        });
      }
    });
  }
  
  /**
   * Disconnect from sync server
   */
  disconnect(): void {
    this.wsProvider?.disconnect();
    this.wsProvider = undefined;
  }
  
  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.wsProvider?.wsconnected ?? false;
  }
  
  // ============================================================================
  // Chat Operations
  // ============================================================================
  
  /**
   * Send a message to a chat pane
   */
  sendMessage(
    frame: 'left' | 'right',
    content: string,
    options?: {
      replyToId?: string;
      attachments?: ChatMessage['attachments'];
      metadata?: Record<string, unknown>;
    }
  ): ChatMessage {
    const pane = frame === 'left' ? this.yLeftPane : this.yRightPane;
    const messages = pane.get('messages') as Y.Array<unknown>;
    
    const message: ChatMessage = {
      id: generateId(),
      senderId: this.participantId,
      senderType: this.config.participantType,
      senderName: this.config.participantName,
      content,
      timestamp: Date.now(),
      replyToId: options?.replyToId,
      attachments: options?.attachments,
      metadata: options?.metadata ?? {}
    };
    
    this.doc.transact(() => {
      messages.push([message]);
      pane.set('lastActivity', Date.now());
      this.ySession.set('lastActivity', Date.now());
    });
    
    return message;
  }
  
  /**
   * Get messages from a chat pane
   */
  getMessages(frame: 'left' | 'right', limit?: number): ChatMessage[] {
    const pane = frame === 'left' ? this.yLeftPane : this.yRightPane;
    const messages = pane.get('messages') as Y.Array<ChatMessage>;
    
    const all = messages.toArray();
    return limit ? all.slice(-limit) : all;
  }
  
  /**
   * Set typing indicator
   */
  setTyping(frame: 'left' | 'right', isTyping: boolean): void {
    const pane = frame === 'left' ? this.yLeftPane : this.yRightPane;
    const typingArray = pane.get('isTyping') as Y.Array<string>;
    
    this.doc.transact(() => {
      const index = typingArray.toArray().indexOf(this.participantId);
      
      if (isTyping && index === -1) {
        typingArray.push([this.participantId]);
      } else if (!isTyping && index >= 0) {
        typingArray.delete(index, 1);
      }
    });
    
    this.emit({
      type: 'chat:typing',
      sessionId: this.sessionId,
      participantId: this.participantId,
      timestamp: Date.now(),
      payload: { frame, isTyping }
    });
  }
  
  /**
   * Get chat pane state
   */
  getChatPaneState(frame: 'left' | 'right'): ChatPaneState {
    const pane = frame === 'left' ? this.yLeftPane : this.yRightPane;
    
    return {
      id: pane.get('id') as string,
      position: frame,
      title: pane.get('title') as string,
      messages: (pane.get('messages') as Y.Array<ChatMessage>).toArray(),
      participants: (pane.get('participants') as Y.Array<string>).toArray(),
      isTyping: (pane.get('isTyping') as Y.Array<string>).toArray(),
      scrollPosition: pane.get('scrollPosition') as number,
      metadata: {}
    };
  }
  
  // ============================================================================
  // Canvas Operations
  // ============================================================================
  
  /**
   * Add a node to the canvas
   */
  addNode<T extends CanvasNode>(node: Omit<T, 'id'> & { id?: string }): T {
    const nodes = this.yCanvas.get('nodes') as Y.Array<CanvasNode>;
    
    const fullNode: T = {
      ...node,
      id: node.id ?? generateId()
    } as T;
    
    this.doc.transact(() => {
      nodes.push([fullNode]);
      this.ySession.set('lastActivity', Date.now());
    });
    
    return fullNode;
  }
  
  /**
   * Add a widget node
   */
  addWidget(
    widgetType: string,
    props: Record<string, unknown>,
    position: { x: number; y: number },
    size?: { width: number; height: number }
  ): WidgetNode | null {
    const definition = this.widgetRegistry.get(widgetType);
    if (!definition) {
      console.error(`Unknown widget type: ${widgetType}`);
      return null;
    }
    
    // Validate props
    const validation = this.widgetRegistry.validateProps(widgetType, props);
    if (!validation.valid) {
      console.error(`Invalid widget props: ${validation.errors.join(', ')}`);
      return null;
    }
    
    const widget: WidgetNode = {
      id: generateId(),
      type: 'widget',
      x: position.x,
      y: position.y,
      width: size?.width ?? definition.defaultWidth,
      height: size?.height ?? definition.defaultHeight,
      widgetType,
      widgetVersion: definition.version,
      props,
      state: {},
      createdBy: this.participantId
    };
    
    return this.addNode(widget);
  }
  
  /**
   * Update a node
   */
  updateNode(nodeId: string, updates: Partial<CanvasNode>): boolean {
    const nodes = this.yCanvas.get('nodes') as Y.Array<CanvasNode>;
    const nodeArray = nodes.toArray();
    const index = nodeArray.findIndex(n => n.id === nodeId);
    
    if (index < 0) return false;
    
    this.doc.transact(() => {
      const current = nodeArray[index];
      const updated = { ...current, ...updates };
      nodes.delete(index, 1);
      nodes.insert(index, [updated]);
      this.ySession.set('lastActivity', Date.now());
    });
    
    this.emit({
      type: 'canvas:node:updated',
      sessionId: this.sessionId,
      participantId: this.participantId,
      timestamp: Date.now(),
      payload: { nodeId, updates }
    });
    
    return true;
  }
  
  /**
   * Delete a node
   */
  deleteNode(nodeId: string): boolean {
    const nodes = this.yCanvas.get('nodes') as Y.Array<CanvasNode>;
    const edges = this.yCanvas.get('edges') as Y.Array<CanvasEdge>;
    
    const nodeArray = nodes.toArray();
    const index = nodeArray.findIndex(n => n.id === nodeId);
    
    if (index < 0) return false;
    
    this.doc.transact(() => {
      // Delete node
      nodes.delete(index, 1);
      
      // Delete connected edges
      const edgeArray = edges.toArray();
      for (let i = edgeArray.length - 1; i >= 0; i--) {
        if (edgeArray[i].fromNode === nodeId || edgeArray[i].toNode === nodeId) {
          edges.delete(i, 1);
        }
      }
      
      this.ySession.set('lastActivity', Date.now());
    });
    
    return true;
  }
  
  /**
   * Add an edge
   */
  addEdge(edge: Omit<CanvasEdge, 'id'> & { id?: string }): CanvasEdge {
    const edges = this.yCanvas.get('edges') as Y.Array<CanvasEdge>;
    
    const fullEdge: CanvasEdge = {
      ...edge,
      id: edge.id ?? generateId()
    };
    
    this.doc.transact(() => {
      edges.push([fullEdge]);
    });
    
    this.emit({
      type: 'canvas:edge:added',
      sessionId: this.sessionId,
      participantId: this.participantId,
      timestamp: Date.now(),
      payload: { edge: fullEdge }
    });
    
    return fullEdge;
  }
  
  /**
   * Delete an edge
   */
  deleteEdge(edgeId: string): boolean {
    const edges = this.yCanvas.get('edges') as Y.Array<CanvasEdge>;
    const edgeArray = edges.toArray();
    const index = edgeArray.findIndex(e => e.id === edgeId);
    
    if (index < 0) return false;
    
    this.doc.transact(() => {
      edges.delete(index, 1);
    });
    
    this.emit({
      type: 'canvas:edge:deleted',
      sessionId: this.sessionId,
      participantId: this.participantId,
      timestamp: Date.now(),
      payload: { edgeId }
    });
    
    return true;
  }
  
  /**
   * Get canvas state
   */
  getCanvasState(): CanvasState {
    return {
      id: this.yCanvas.get('id') as string,
      nodes: (this.yCanvas.get('nodes') as Y.Array<CanvasNode>).toArray(),
      edges: (this.yCanvas.get('edges') as Y.Array<CanvasEdge>).toArray(),
      viewport: this.yCanvas.get('viewport') as CanvasState['viewport'],
      selectedNodes: (this.yCanvas.get('selectedNodes') as Y.Array<string>).toArray(),
      selectedEdges: (this.yCanvas.get('selectedEdges') as Y.Array<string>).toArray(),
      metadata: {}
    };
  }
  
  /**
   * Get nodes by type
   */
  getNodesByType<T extends CanvasNode>(type: T['type']): T[] {
    const nodes = this.yCanvas.get('nodes') as Y.Array<CanvasNode>;
    return nodes.toArray().filter(n => n.type === type) as T[];
  }
  
  /**
   * Get widgets
   */
  getWidgets(): WidgetNode[] {
    return this.getNodesByType<WidgetNode>('widget');
  }
  
  /**
   * Set canvas viewport
   */
  setViewport(viewport: CanvasState['viewport']): void {
    this.doc.transact(() => {
      this.yCanvas.set('viewport', viewport);
    });
    
    this.emit({
      type: 'canvas:viewport:changed',
      sessionId: this.sessionId,
      participantId: this.participantId,
      timestamp: Date.now(),
      payload: { viewport }
    });
  }
  
  // ============================================================================
  // Participant Management
  // ============================================================================
  
  /**
   * Get all participants
   */
  getParticipants(): Participant[] {
    const participants: Participant[] = [];
    this.yParticipants.forEach((value) => {
      participants.push(value as Participant);
    });
    return participants;
  }
  
  /**
   * Update participant awareness
   */
  updateAwareness(state: Partial<AwarenessState>): void {
    const current = this.yAwareness.get(this.participantId) as AwarenessState | undefined;
    
    const updated: AwarenessState = {
      participantId: this.participantId,
      status: 'active',
      lastActivity: Date.now(),
      ...current,
      ...state
    };
    
    this.doc.transact(() => {
      this.yAwareness.set(this.participantId, updated);
      
      // Update participant lastSeen
      const participant = this.yParticipants.get(this.participantId) as Participant;
      if (participant) {
        participant.lastSeen = Date.now();
        this.yParticipants.set(this.participantId, participant);
      }
    });
  }
  
  /**
   * Get awareness states
   */
  getAwarenessStates(): AwarenessState[] {
    const states: AwarenessState[] = [];
    this.yAwareness.forEach((value) => {
      states.push(value as AwarenessState);
    });
    return states;
  }
  
  // ============================================================================
  // Events
  // ============================================================================
  
  /**
   * Emit an event
   */
  private emit(event: TerminalEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Event handler error for ${event.type}:`, error);
        }
      }
    }
  }
  
  /**
   * Subscribe to events
   */
  on(eventType: TerminalEventType, handler: TerminalEventHandler): () => void {
    const handlers = this.eventHandlers.get(eventType) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
    
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }
  
  /**
   * Subscribe to all events
   */
  onAny(handler: TerminalEventHandler): () => void {
    const unsubscribers: (() => void)[] = [];
    const eventTypes: TerminalEventType[] = [
      'session:created', 'session:joined', 'session:left', 'session:closed',
      'chat:message', 'chat:typing', 'chat:reaction', 'chat:edit', 'chat:delete',
      'canvas:node:added', 'canvas:node:updated', 'canvas:node:deleted',
      'canvas:node:moved', 'canvas:edge:added', 'canvas:edge:deleted',
      'canvas:viewport:changed', 'canvas:selection:changed',
      'widget:created', 'widget:action', 'widget:event', 'widget:destroyed',
      'sync:connected', 'sync:disconnected', 'sync:conflict', 'sync:resolved'
    ];
    
    for (const type of eventTypes) {
      unsubscribers.push(this.on(type, handler));
    }
    
    return () => unsubscribers.forEach(u => u());
  }
  
  // ============================================================================
  // Session Management
  // ============================================================================
  
  /**
   * Get session state
   */
  getSession(): TerminalSession {
    return {
      id: this.sessionId,
      name: this.ySession.get('name') as string,
      createdAt: this.ySession.get('createdAt') as number,
      lastActivity: this.ySession.get('lastActivity') as number,
      participants: this.getParticipants(),
      frames: {
        left: this.getChatPaneState('left'),
        center: this.getCanvasState(),
        right: this.getChatPaneState('right')
      },
      metadata: {}
    };
  }
  
  /**
   * Export session to JSON
   */
  toJSON(): string {
    return JSON.stringify(this.getSession(), null, 2);
  }
  
  /**
   * Export to JSON Canvas format
   */
  toJSONCanvas(): string {
    const state = this.getCanvasState();
    return JSON.stringify({
      nodes: state.nodes,
      edges: state.edges
    }, null, 2);
  }
  
  /**
   * Destroy terminal
   */
  destroy(): void {
    this.disconnect();
    this.doc.destroy();
    
    this.emit({
      type: 'session:closed',
      sessionId: this.sessionId,
      participantId: this.participantId,
      timestamp: Date.now(),
      payload: {}
    });
  }
}