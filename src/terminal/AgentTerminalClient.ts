/**
 * AgentTerminalClient
 * 
 * Agent-facing client for interacting with ChrysalisTerminal.
 * Provides simplified API for agents to:
 * - Send/receive messages in chat panes
 * - Create and update canvas widgets
 * - Access memory context from MemU
 * - Respond to user interactions
 * 
 * @module terminal/AgentTerminalClient
 */

import { ChrysalisTerminal } from './ChrysalisTerminal';
import {
  ChatMessage,
  CanvasNode,
  WidgetNode,
  TerminalEvent,
  TerminalEventType,
  TerminalEventHandler
} from './protocols';
import { MemUAdapter } from '../memory/MemUAdapter';
import { AgentLLMClient, AgentClientConfig } from '../services/llm/AgentLLMClient';
import { LLMHydrationService } from '../services/llm/LLMHydrationService';

/**
 * Agent terminal client configuration
 */
export interface AgentTerminalConfig {
  agentId: string;
  agentName: string;
  systemPrompt?: string;
  
  // Terminal connection
  terminal?: ChrysalisTerminal;
  syncServerUrl?: string;
  sessionId?: string;
  
  // Services
  llmService?: LLMHydrationService;
  memory?: MemUAdapter;
  
  // Behavior
  autoRespond?: boolean;
  respondToFrame?: 'left' | 'right' | 'both';
  includeMemoryContext?: boolean;
  maxHistoryMessages?: number;
}

/**
 * Message handler for agent responses
 */
export type AgentMessageHandler = (
  message: ChatMessage,
  context: {
    recentMessages: ChatMessage[];
    memoryContext: string;
    frame: 'left' | 'right';
  }
) => Promise<string | null>;

/**
 * AgentTerminalClient
 * 
 * Provides agents with access to the ChrysalisTerminal interface.
 */
export class AgentTerminalClient {
  private terminal: ChrysalisTerminal;
  private config: AgentTerminalConfig;
  private memory?: MemUAdapter;
  private llmClient?: AgentLLMClient;
  private messageHandler?: AgentMessageHandler;
  private unsubscribers: (() => void)[] = [];
  
  constructor(config: AgentTerminalConfig) {
    this.config = {
      autoRespond: false,
      respondToFrame: 'right',
      includeMemoryContext: true,
      maxHistoryMessages: 10,
      ...config
    };
    
    // Create or use provided terminal
    if (config.terminal) {
      this.terminal = config.terminal;
    } else {
      this.terminal = new ChrysalisTerminal({
        participantId: config.agentId,
        participantType: 'agent',
        participantName: config.agentName,
        sessionId: config.sessionId,
        syncServerUrl: config.syncServerUrl
      });
    }
    
    // Set up memory
    this.memory = config.memory ?? new MemUAdapter(config.agentId);
    
    // Set up LLM client
    if (config.llmService) {
      this.llmClient = new AgentLLMClient(config.llmService, {
        agentId: config.agentId,
        agentName: config.agentName,
        systemPrompt: config.systemPrompt
      } as AgentClientConfig);
    }
    
    // Set up auto-response if enabled
    if (this.config.autoRespond) {
      this.setupAutoRespond();
    }
  }
  
  // ============================================================================
  // Chat Operations
  // ============================================================================
  
  /**
   * Send a message to the left pane (agent pane)
   */
  sendMessage(content: string, options?: {
    replyToId?: string;
    metadata?: Record<string, unknown>;
  }): ChatMessage {
    return this.terminal.sendMessage('left', content, options);
  }
  
  /**
   * Send a message to a specific frame
   */
  sendToFrame(
    frame: 'left' | 'right',
    content: string,
    options?: {
      replyToId?: string;
      metadata?: Record<string, unknown>;
    }
  ): ChatMessage {
    return this.terminal.sendMessage(frame, content, options);
  }
  
  /**
   * Get recent messages from a frame
   */
  getMessages(frame: 'left' | 'right', limit?: number): ChatMessage[] {
    return this.terminal.getMessages(frame, limit ?? this.config.maxHistoryMessages);
  }
  
  /**
   * Get all messages from both frames
   */
  getAllMessages(limit?: number): { left: ChatMessage[]; right: ChatMessage[] } {
    return {
      left: this.getMessages('left', limit),
      right: this.getMessages('right', limit)
    };
  }
  
  /**
   * Set typing indicator
   */
  setTyping(isTyping: boolean): void {
    this.terminal.setTyping('left', isTyping);
  }
  
  /**
   * Set a custom message handler for auto-responses
   */
  setMessageHandler(handler: AgentMessageHandler): void {
    this.messageHandler = handler;
  }
  
  /**
   * Set up auto-response to user messages
   */
  private setupAutoRespond(): void {
    // Listen for messages in the right pane (user messages)
    const unsubRight = this.terminal.on('chat:message', async (event) => {
      const payload = event.payload as { frame: string; message: ChatMessage };
      
      if (payload.frame !== 'right') return;
      if (this.config.respondToFrame !== 'right' && this.config.respondToFrame !== 'both') return;
      
      // Don't respond to our own messages
      if (payload.message.senderType === 'agent') return;
      
      await this.handleIncomingMessage(payload.message, 'right');
    });
    this.unsubscribers.push(unsubRight);
    
    // Also listen for left pane if configured
    if (this.config.respondToFrame === 'left' || this.config.respondToFrame === 'both') {
      const unsubLeft = this.terminal.on('chat:message', async (event) => {
        const payload = event.payload as { frame: string; message: ChatMessage };
        
        if (payload.frame !== 'left') return;
        if (payload.message.senderType === 'agent') return;
        
        await this.handleIncomingMessage(payload.message, 'left');
      });
      this.unsubscribers.push(unsubLeft);
    }
  }
  
  /**
   * Handle incoming message and generate response
   */
  private async handleIncomingMessage(
    message: ChatMessage,
    frame: 'left' | 'right'
  ): Promise<void> {
    // Show typing indicator
    this.setTyping(true);
    
    try {
      // Get context
      const recentMessages = this.getMessages(frame, this.config.maxHistoryMessages);
      let memoryContext = '';
      
      if (this.config.includeMemoryContext && this.memory) {
        memoryContext = await this.memory.assembleContext(message.content);
      }
      
      let response: string | null = null;
      
      // Use custom handler if set
      if (this.messageHandler) {
        response = await this.messageHandler(message, {
          recentMessages,
          memoryContext,
          frame
        });
      } 
      // Otherwise use LLM client if available
      else if (this.llmClient) {
        // Add memory context to the message
        const contextualMessage = memoryContext 
          ? `[Context]\n${memoryContext}\n\n[User Message]\n${message.content}`
          : message.content;
        
        response = await this.llmClient.chat(contextualMessage);
        
        // Add to working memory
        if (this.memory) {
          await this.memory.addWorkingMemory(message.content, {
            memoryType: 'conversation',
            source: 'user'
          });
          if (response) {
            await this.memory.addWorkingMemory(response, {
              memoryType: 'conversation',
              source: 'agent'
            });
          }
        }
      }
      
      // Send response
      if (response) {
        this.sendMessage(response, { replyToId: message.id });
      }
    } finally {
      this.setTyping(false);
    }
  }
  
  // ============================================================================
  // Canvas/Widget Operations
  // ============================================================================
  
  /**
   * Create a widget on the canvas
   */
  createWidget(
    widgetType: string,
    props: Record<string, unknown>,
    position: { x: number; y: number },
    size?: { width: number; height: number }
  ): WidgetNode | null {
    const widget = this.terminal.addWidget(widgetType, props, position, size);
    
    if (widget && this.memory) {
      // Record widget creation in memory
      this.memory.addWorkingMemory(
        `Created ${widgetType} widget with props: ${JSON.stringify(props)}`,
        { memoryType: 'action', source: 'agent' }
      );
    }
    
    return widget;
  }
  
  /**
   * Create a markdown widget
   */
  createMarkdownWidget(
    content: string,
    position: { x: number; y: number }
  ): WidgetNode | null {
    return this.createWidget('markdown', { content }, position);
  }
  
  /**
   * Create a code widget
   */
  createCodeWidget(
    code: string,
    language: string,
    position: { x: number; y: number },
    options?: { filename?: string; editable?: boolean }
  ): WidgetNode | null {
    return this.createWidget('code', {
      code,
      language,
      ...options
    }, position);
  }
  
  /**
   * Create a chart widget
   */
  createChartWidget(
    chartType: 'line' | 'bar' | 'pie' | 'scatter',
    data: {
      labels?: string[];
      datasets: Array<{
        label: string;
        data: number[];
        color?: string;
      }>;
    },
    position: { x: number; y: number }
  ): WidgetNode | null {
    return this.createWidget('chart', { type: chartType, data }, position);
  }
  
  /**
   * Create a table widget
   */
  createTableWidget(
    columns: Array<{ key: string; label: string }>,
    data: Record<string, unknown>[],
    position: { x: number; y: number }
  ): WidgetNode | null {
    return this.createWidget('table', { columns, data }, position);
  }
  
  /**
   * Create a memory viewer widget
   */
  createMemoryViewerWidget(
    position: { x: number; y: number },
    options?: { memoryTier?: string; limit?: number }
  ): WidgetNode | null {
    return this.createWidget('memory-viewer', {
      agentId: this.config.agentId,
      ...options
    }, position);
  }
  
  /**
   * Update a widget's props
   */
  updateWidget(widgetId: string, props: Record<string, unknown>): boolean {
    const widgets = this.terminal.getWidgets();
    const widget = widgets.find(w => w.id === widgetId);
    
    if (!widget) return false;
    
    return this.terminal.updateNode(widgetId, {
      props: { ...widget.props, ...props }
    });
  }
  
  /**
   * Update a widget's state
   */
  updateWidgetState(widgetId: string, state: Record<string, unknown>): boolean {
    const widgets = this.terminal.getWidgets();
    const widget = widgets.find(w => w.id === widgetId);
    
    if (!widget) return false;
    
    return this.terminal.updateNode(widgetId, {
      state: { ...widget.state, ...state }
    });
  }
  
  /**
   * Delete a widget
   */
  deleteWidget(widgetId: string): boolean {
    return this.terminal.deleteNode(widgetId);
  }
  
  /**
   * Get all widgets
   */
  getWidgets(): WidgetNode[] {
    return this.terminal.getWidgets();
  }
  
  /**
   * Connect widgets with an edge
   */
  connectWidgets(
    fromWidgetId: string,
    toWidgetId: string,
    options?: { label?: string; color?: string }
  ): string {
    const edge = this.terminal.addEdge({
      fromNode: fromWidgetId,
      toNode: toWidgetId,
      ...options
    });
    return edge.id;
  }
  
  // ============================================================================
  // Memory Operations
  // ============================================================================
  
  /**
   * Get the memory adapter
   */
  getMemory(): MemUAdapter | undefined {
    return this.memory;
  }
  
  /**
   * Add to working memory
   */
  async addToMemory(
    content: string,
    options?: { memoryType?: string; importance?: number }
  ): Promise<void> {
    if (this.memory) {
      await this.memory.addWorkingMemory(content, {
        memoryType: options?.memoryType as any ?? 'observation',
        source: 'agent',
        importance: options?.importance
      });
    }
  }
  
  /**
   * Search memory
   */
  async searchMemory(
    query: string,
    options?: { tiers?: string[]; limit?: number }
  ): Promise<{ content: string; tier: string; score: number }[]> {
    if (!this.memory) return [];
    
    const results = await this.memory.search(query, {
      tiers: options?.tiers as any,
      limit: options?.limit
    });
    
    return results.memories.map((m, i) => ({
      content: m.content,
      tier: m.tier,
      score: results.scores[i]
    }));
  }
  
  /**
   * Learn a new skill
   */
  async learnSkill(
    skillName: string,
    description: string,
    steps: string[],
    options?: {
      preconditions?: string[];
      postconditions?: string[];
      parameters?: Record<string, unknown>;
    }
  ): Promise<void> {
    if (this.memory) {
      await this.memory.learnSkill(skillName, {
        description,
        steps,
        preconditions: options?.preconditions,
        postconditions: options?.postconditions,
        parameters: options?.parameters as any
      });
    }
  }
  
  /**
   * Get memory context for a query
   */
  async getMemoryContext(query: string): Promise<string> {
    if (!this.memory) return '';
    return this.memory.assembleContext(query);
  }
  
  // ============================================================================
  // Event Handling
  // ============================================================================
  
  /**
   * Subscribe to terminal events
   */
  on(eventType: TerminalEventType, handler: TerminalEventHandler): () => void {
    const unsub = this.terminal.on(eventType, handler);
    this.unsubscribers.push(unsub);
    return unsub;
  }
  
  /**
   * Subscribe to user messages
   */
  onUserMessage(
    handler: (message: ChatMessage, frame: 'left' | 'right') => void
  ): () => void {
    return this.terminal.on('chat:message', (event) => {
      const payload = event.payload as { frame: string; message: ChatMessage };
      if (payload.message.senderType === 'human' || payload.message.senderType === 'system') {
        handler(payload.message, payload.frame as 'left' | 'right');
      }
    });
  }
  
  /**
   * Subscribe to widget events
   */
  onWidgetEvent(
    handler: (widgetId: string, eventName: string, payload: unknown) => void
  ): () => void {
    return this.terminal.on('widget:event', (event) => {
      const payload = event.payload as { widgetId: string; eventName: string; data: unknown };
      handler(payload.widgetId, payload.eventName, payload.data);
    });
  }
  
  // ============================================================================
  // Connection
  // ============================================================================
  
  /**
   * Connect to sync server
   */
  connect(serverUrl?: string): void {
    this.terminal.connect(serverUrl);
  }
  
  /**
   * Disconnect from sync server
   */
  disconnect(): void {
    this.terminal.disconnect();
  }
  
  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.terminal.isConnected;
  }
  
  // ============================================================================
  // Session
  // ============================================================================
  
  /**
   * Get terminal session info
   */
  getSession() {
    return this.terminal.getSession();
  }
  
  /**
   * Get LLM client for direct access
   */
  getLLMClient(): AgentLLMClient | undefined {
    return this.llmClient;
  }
  
  /**
   * Destroy the client and clean up
   */
  destroy(): void {
    // Unsubscribe from all events
    this.unsubscribers.forEach(u => u());
    this.unsubscribers = [];
    
    // Disconnect terminal
    this.terminal.destroy();
  }
}

/**
 * Factory function to create an agent terminal client
 */
export function createAgentTerminalClient(
  config: AgentTerminalConfig
): AgentTerminalClient {
  return new AgentTerminalClient(config);
}