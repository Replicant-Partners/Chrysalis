import { v4 as uuidv4 } from 'uuid';
import {
  ChatMessage,
  ChatPaneState,
  AgentCanvasState,
  AgentCanvasMetadata,
  CanvasAgent,
  AgentLayout,
  AgentPosition,
  AgentState,
  TerminalEvent,
  TerminalEventType,
  TerminalEventHandler,
  TerminalConfig,
  DEFAULT_TERMINAL_CONFIG,
  TerminalSession
} from './protocols';

/**
  * Lean ChrysalisTerminal: in-memory chat + agent canvas for the Agent Team view.
  * This replaces the previous YJS/widget-based terminal.
  */
export class ChrysalisTerminal {
  private leftPane: ChatPaneState;
  private rightPane: ChatPaneState;
  private canvas: AgentCanvasState;
  private listeners: Map<TerminalEventType | 'chat:message' | 'widget:event', Set<TerminalEventHandler>> = new Map();
  isConnected = false;

  constructor(config: Partial<TerminalConfig> = {}) {
    const cfg = { ...DEFAULT_TERMINAL_CONFIG, ...config };
    this.leftPane = { id: 'left', title: cfg.leftPane?.title || 'Agents', messages: [], participants: [], isTyping: [] };
    this.rightPane = { id: 'right', title: cfg.rightPane?.title || 'You', messages: [], participants: [], isTyping: [] };
    const now = Date.now();
    const metadata: AgentCanvasMetadata = {
      id: uuidv4(),
      name: 'Agent Canvas',
      createdAt: now,
      updatedAt: now,
      createdBy: 'system'
    };
    this.canvas = { id: metadata.id, metadata, agents: [], layouts: {} };
  }

  on(eventType: TerminalEventType | 'chat:message' | 'widget:event', handler: TerminalEventHandler): () => void {
    if (!this.listeners.has(eventType)) this.listeners.set(eventType, new Set());
    this.listeners.get(eventType)!.add(handler);
    return () => this.listeners.get(eventType)?.delete(handler);
  }

  private emit(event: TerminalEvent) {
    this.listeners.get(event.type)?.forEach(h => h(event));
  }

  sendMessage(frame: 'left' | 'right', content: string, options?: Partial<ChatMessage>): ChatMessage {
    const pane = frame === 'left' ? this.leftPane : this.rightPane;
    const msg: ChatMessage = {
      id: uuidv4(),
      senderId: options?.senderId || 'user',
      senderType: options?.senderType || 'human',
      senderName: options?.senderName || 'User',
      content,
      timestamp: Date.now(),
      metadata: options?.metadata,
      attachments: options?.attachments
    };
    pane.messages.push(msg);
    this.emit({ type: 'chat:message', timestamp: msg.timestamp, payload: { frame, message: msg } });
    return msg;
  }

  getMessages(frame: 'left' | 'right', limit?: number): ChatMessage[] {
    const pane = frame === 'left' ? this.leftPane : this.rightPane;
    return limit ? pane.messages.slice(-limit) : [...pane.messages];
  }

  setTyping(frame: 'left' | 'right', isTyping: boolean, participantId = 'user'): void {
    const pane = frame === 'left' ? this.leftPane : this.rightPane;
    const idx = pane.isTyping.indexOf(participantId);
    if (isTyping && idx === -1) pane.isTyping.push(participantId);
    if (!isTyping && idx >= 0) pane.isTyping.splice(idx, 1);
  }

  // Agent canvas operations (minimal)
  addAgent(agent: CanvasAgent): void {
    this.canvas.agents.push(agent);
    this.canvas.layouts[agent.id] = {
      agentId: agent.id,
      position: agent.position,
      collapsed: false,
      pinned: false,
      selected: false,
      updatedAt: Date.now()
    };
    this.canvas.selectedAgentId = agent.id;
  }

  updateAgent(agentId: string, updates: Partial<CanvasAgent>): void {
    const agent = this.canvas.agents.find(a => a.id === agentId);
    if (!agent) return;
    Object.assign(agent, updates);
  }

  moveAgent(agentId: string, position: Partial<AgentPosition>): void {
    const layout = this.canvas.layouts[agentId];
    if (!layout) return;
    layout.position = { ...layout.position, ...position };
    layout.updatedAt = Date.now();
  }

  setAgentState(agentId: string, state: AgentState): void {
    this.updateAgent(agentId, { state });
  }

  getCanvas(): AgentCanvasState {
    return this.canvas;
  }

  getWidgets() {
    return [];
  }

  addWidget(): null {
    return null;
  }

  updateNode(): boolean {
    return false;
  }

  deleteNode(): boolean {
    return false;
  }

  addEdge(): null {
    return null;
  }

  connect(): void {
    this.isConnected = true;
  }

  disconnect(): void {
    this.isConnected = false;
  }

  getSession(): TerminalSession {
    return {
      id: this.canvas.id,
      name: this.canvas.metadata.name,
      left: this.leftPane,
      right: this.rightPane,
      canvas: this.canvas
    };
  }

  destroy(): void {
    this.listeners.clear();
  }
}
