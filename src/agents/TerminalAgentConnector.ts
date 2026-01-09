/**
 * TerminalAgentConnector - Connects agent bridges to ChrysalisTerminal
 * 
 * This is the integration layer that:
 * - Connects agent bridges to the terminal's left chat pane
 * - Routes messages between users (right pane) and agents (left pane)
 * - Manages agent lifecycle within the terminal
 * - Provides memory context to agents
 * 
 * @module agents/TerminalAgentConnector
 */

import { ChrysalisTerminal } from '../terminal/ChrysalisTerminal';
import { ChatMessage } from '../terminal/protocols';
import { MemUAdapter } from '../memory/MemUAdapter';
import {
  IAgentBridge,
  AgentMessage,
  AgentContext,
  BridgeEventType
} from './bridges/types';
import { AgentRegistry, getAgentRegistry } from './bridges/AgentRegistry';

/**
 * Connector configuration
 */
export interface TerminalAgentConnectorConfig {
  terminal: ChrysalisTerminal;
  registry?: AgentRegistry;
  memory?: MemUAdapter;
  
  // Auto-response settings
  autoRespond?: boolean;
  responseFrame?: 'left' | 'right';
  includeMemoryContext?: boolean;
  maxHistoryMessages?: number;
}

/**
 * Connected agent state
 */
interface ConnectedAgentState {
  bridge: IAgentBridge;
  unsubscribers: (() => void)[];
  isResponding: boolean;
}

/**
 * TerminalAgentConnector - Connects agents to ChrysalisTerminal
 */
export class TerminalAgentConnector {
  private terminal: ChrysalisTerminal;
  private registry: AgentRegistry;
  private memory?: MemUAdapter;
  private config: Required<Omit<TerminalAgentConnectorConfig, 'terminal' | 'registry' | 'memory'>> & {
    terminal: ChrysalisTerminal;
    registry: AgentRegistry;
    memory?: MemUAdapter;
  };
  
  private connectedAgents: Map<string, ConnectedAgentState> = new Map();
  private terminalUnsubscribers: (() => void)[] = [];
  
  constructor(config: TerminalAgentConnectorConfig) {
    this.terminal = config.terminal;
    this.registry = config.registry ?? getAgentRegistry();
    this.memory = config.memory;
    
    this.config = {
      ...config,
      registry: this.registry,
      autoRespond: config.autoRespond ?? true,
      responseFrame: config.responseFrame ?? 'left',
      includeMemoryContext: config.includeMemoryContext ?? true,
      maxHistoryMessages: config.maxHistoryMessages ?? 10
    };
    
    // Set up terminal event listeners
    this.setupTerminalListeners();
  }
  
  // ============================================================================
  // Agent Connection
  // ============================================================================
  
  /**
   * Connect an agent bridge to the terminal
   */
  async connectAgent(bridgeId: string): Promise<void> {
    const bridge = this.registry.get(bridgeId);
    if (!bridge) {
      throw new Error(`Agent '${bridgeId}' not found in registry`);
    }
    
    if (this.connectedAgents.has(bridgeId)) {
      console.warn(`Agent '${bridgeId}' is already connected to terminal`);
      return;
    }
    
    // Ensure bridge is connected
    if (bridge.getStatus() !== 'connected') {
      await bridge.connect();
    }
    
    // Set up bridge event handlers
    const unsubscribers: (() => void)[] = [];
    
    // Forward agent responses to terminal
    unsubscribers.push(
      bridge.on('response', (event) => {
        const response = event.payload as { response: { content: string } };
        if (response.response?.content) {
          this.terminal.sendMessage(this.config.responseFrame, response.response.content, {
            metadata: {
              agentId: bridgeId,
              agentName: bridge.info.name
            }
          });
        }
      })
    );
    
    // Handle streaming responses
    if (bridge.stream) {
      unsubscribers.push(
        bridge.on('stream_chunk', (event) => {
          // For streaming, we could update a widget or show typing
          // For now, we'll just set typing indicator
          this.terminal.setTyping(this.config.responseFrame, true);
        })
      );
      
      unsubscribers.push(
        bridge.on('stream_end', () => {
          this.terminal.setTyping(this.config.responseFrame, false);
        })
      );
    }
    
    // Handle errors
    unsubscribers.push(
      bridge.on('error', (event) => {
        const error = event.payload as { error: Error };
        this.terminal.sendMessage(this.config.responseFrame, 
          `Error from ${bridge.info.name}: ${error.error?.message ?? 'Unknown error'}`, {
          metadata: {
            agentId: bridgeId,
            isError: true
          }
        });
      })
    );
    
    // Store connected state
    this.connectedAgents.set(bridgeId, {
      bridge,
      unsubscribers,
      isResponding: false
    });
    
    // Announce agent joining
    this.terminal.sendMessage(this.config.responseFrame, 
      `🤖 ${bridge.info.name} has joined the conversation.`, {
      metadata: {
        agentId: bridgeId,
        isSystem: true
      }
    });
  }
  
  /**
   * Disconnect an agent from the terminal
   */
  async disconnectAgent(bridgeId: string): Promise<void> {
    const state = this.connectedAgents.get(bridgeId);
    if (!state) {
      return;
    }
    
    // Clean up event handlers
    state.unsubscribers.forEach(u => u());
    
    // Announce agent leaving
    this.terminal.sendMessage(this.config.responseFrame,
      `👋 ${state.bridge.info.name} has left the conversation.`, {
      metadata: {
        agentId: bridgeId,
        isSystem: true
      }
    });
    
    this.connectedAgents.delete(bridgeId);
  }
  
  /**
   * Get connected agents
   */
  getConnectedAgents(): IAgentBridge[] {
    return Array.from(this.connectedAgents.values()).map(s => s.bridge);
  }
  
  /**
   * Check if an agent is connected
   */
  isAgentConnected(bridgeId: string): boolean {
    return this.connectedAgents.has(bridgeId);
  }
  
  // ============================================================================
  // Message Handling
  // ============================================================================
  
  /**
   * Set up terminal event listeners
   */
  private setupTerminalListeners(): void {
    // Listen for user messages (from right pane)
    const unsubMessage = this.terminal.on('chat:message', async (event) => {
      const payload = event.payload as { frame: string; message: ChatMessage };
      
      // Only respond to user messages from right pane
      if (payload.frame !== 'right') return;
      if (payload.message.senderType === 'agent') return;
      
      // Auto-respond if enabled
      if (this.config.autoRespond) {
        await this.routeMessageToAgents(payload.message);
      }
    });
    this.terminalUnsubscribers.push(unsubMessage);
  }
  
  /**
   * Route a message to all connected agents
   */
  private async routeMessageToAgents(message: ChatMessage): Promise<void> {
    // Get memory context if enabled
    let memoryContext = '';
    if (this.config.includeMemoryContext && this.memory) {
      memoryContext = await this.memory.assembleContext(message.content);
    }
    
    // Get conversation history
    const history = this.terminal.getMessages('right', this.config.maxHistoryMessages);
    
    // Build agent context
    const context: AgentContext = {
      messages: history.map(m => ({
        id: m.id,
        content: m.content,
        role: m.senderType === 'human' ? 'user' : 'assistant',
        timestamp: m.timestamp
      } as AgentMessage)),
      memoryContext,
      terminalState: {
        sessionId: this.terminal.getSession().id,
        widgets: this.terminal.getWidgets(),
        participants: this.terminal.getParticipants()
      }
    };
    
    // Convert to agent message
    const agentMessage: AgentMessage = {
      id: message.id,
      content: message.content,
      role: 'user',
      timestamp: message.timestamp,
      metadata: message.metadata
    };
    
    // Send to all connected agents
    for (const [bridgeId, state] of this.connectedAgents) {
      if (state.isResponding) {
        continue; // Skip if already responding
      }
      
      state.isResponding = true;
      this.terminal.setTyping(this.config.responseFrame, true);
      
      try {
        // Use streaming if available
        if (state.bridge.stream) {
          let fullResponse = '';
          for await (const chunk of state.bridge.stream(agentMessage, context)) {
            fullResponse = chunk.content;
          }
          // Response is sent via event handler
        } else {
          await state.bridge.send(agentMessage, context);
          // Response is sent via event handler
        }
      } catch (error) {
        console.error(`Error sending to ${bridgeId}:`, error);
      } finally {
        state.isResponding = false;
        this.terminal.setTyping(this.config.responseFrame, false);
      }
    }
  }
  
  /**
   * Send a message directly to a specific agent
   */
  async sendToAgent(
    bridgeId: string,
    content: string,
    options?: {
      includeMemory?: boolean;
      includeHistory?: boolean;
    }
  ): Promise<void> {
    const state = this.connectedAgents.get(bridgeId);
    if (!state) {
      throw new Error(`Agent '${bridgeId}' is not connected`);
    }
    
    // Build context
    let memoryContext = '';
    if (options?.includeMemory && this.memory) {
      memoryContext = await this.memory.assembleContext(content);
    }
    
    let messages: AgentMessage[] = [];
    if (options?.includeHistory) {
      const history = this.terminal.getMessages('right', this.config.maxHistoryMessages);
      messages = history.map(m => ({
        id: m.id,
        content: m.content,
        role: m.senderType === 'human' ? 'user' : 'assistant',
        timestamp: m.timestamp
      } as AgentMessage));
    }
    
    const context: AgentContext = {
      messages,
      memoryContext
    };
    
    const agentMessage: AgentMessage = {
      id: `direct-${Date.now()}`,
      content,
      role: 'user',
      timestamp: Date.now()
    };
    
    state.isResponding = true;
    this.terminal.setTyping(this.config.responseFrame, true);
    
    try {
      await state.bridge.send(agentMessage, context);
    } finally {
      state.isResponding = false;
      this.terminal.setTyping(this.config.responseFrame, false);
    }
  }
  
  // ============================================================================
  // Agent Tools in Terminal
  // ============================================================================
  
  /**
   * Execute a tool on a connected agent
   */
  async executeAgentTool(
    bridgeId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const state = this.connectedAgents.get(bridgeId);
    if (!state) {
      throw new Error(`Agent '${bridgeId}' is not connected`);
    }
    
    // Check if bridge supports tools
    if (!state.bridge.getTools) {
      throw new Error(`Agent '${bridgeId}' does not support tools`);
    }
    
    const tools = state.bridge.getTools();
    const tool = tools.find(t => t.name === toolName);
    
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found on agent '${bridgeId}'`);
    }
    
    if (!tool.handler) {
      // Send as a tool command message
      const commandMessage: AgentMessage = {
        id: `tool-${Date.now()}`,
        content: `/${toolName} ${JSON.stringify(args)}`,
        role: 'user',
        timestamp: Date.now()
      };
      
      const response = await state.bridge.send(commandMessage);
      return response.content;
    }
    
    return await tool.handler(args);
  }
  
  // ============================================================================
  // Lifecycle
  // ============================================================================
  
  /**
   * Disconnect all agents and clean up
   */
  async destroy(): Promise<void> {
    // Disconnect all agents
    for (const bridgeId of this.connectedAgents.keys()) {
      await this.disconnectAgent(bridgeId);
    }
    
    // Clean up terminal listeners
    this.terminalUnsubscribers.forEach(u => u());
    this.terminalUnsubscribers = [];
  }
}

/**
 * Create a terminal agent connector
 */
export function createTerminalAgentConnector(
  config: TerminalAgentConnectorConfig
): TerminalAgentConnector {
  return new TerminalAgentConnector(config);
}