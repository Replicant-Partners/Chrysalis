/**
 * CanvasChatBridge
 *
 * Wires events between the AgentCanvas and ChatPane components.
 * Handles:
 * - Canvas agent selection → Chat pane focus
 * - Chat activity → Canvas agent state updates
 * - Agent state synchronization across views
 *
 * @module agents/bridges/CanvasChatBridge
 */

import { EventEmitter } from 'events';
import type { AgentBinding, ChatPanePosition, ChatMessage } from '../../components/ChrysalisWorkspace/types';
import type { AgentState } from '../../terminal/protocols';

// =============================================================================
// Types
// =============================================================================

/**
 * Bridge event types
 */
export type BridgeEventType =
  | 'canvas:agent:selected'
  | 'canvas:agent:state-changed'
  | 'chat:message:sent'
  | 'chat:message:received'
  | 'chat:typing:started'
  | 'chat:typing:stopped'
  | 'chat:pane:focused'
  | 'agent:activated'
  | 'agent:deactivated';

/**
 * Canvas agent selection event
 */
export interface CanvasAgentSelectedEvent {
  agentId: string;
  previousAgentId?: string;
}

/**
 * Canvas agent state change event
 */
export interface CanvasAgentStateEvent {
  agentId: string;
  previousState: AgentState;
  newState: AgentState;
}

/**
 * Chat message event
 */
export interface ChatMessageEvent {
  message: ChatMessage;
  pane: ChatPanePosition;
  agentId: string;
}

/**
 * Chat typing event
 */
export interface ChatTypingEvent {
  agentId: string;
  pane: ChatPanePosition;
  isTyping: boolean;
}

/**
 * Chat pane focus event
 */
export interface ChatPaneFocusEvent {
  pane: ChatPanePosition;
  agentId: string;
}

/**
 * Bridge configuration
 */
export interface CanvasChatBridgeConfig {
  // Auto-focus chat pane when canvas agent is selected
  autoFocusOnSelect: boolean;

  // Update canvas agent state when chat activity occurs
  syncStateOnActivity: boolean;

  // Show typing indicator on canvas
  showTypingOnCanvas: boolean;

  // Agent-to-pane mappings
  agentPaneMappings: Map<string, ChatPanePosition>;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: CanvasChatBridgeConfig = {
  autoFocusOnSelect: true,
  syncStateOnActivity: true,
  showTypingOnCanvas: true,
  agentPaneMappings: new Map(),
};

// =============================================================================
// Bridge Class
// =============================================================================

/**
 * CanvasChatBridge - coordinates canvas and chat components
 */
export class CanvasChatBridge extends EventEmitter {
  private config: CanvasChatBridgeConfig;
  private agentStates: Map<string, AgentState> = new Map();
  private typingAgents: Set<string> = new Set();
  private focusedPane: ChatPanePosition | null = null;
  private selectedCanvasAgent: string | null = null;

  constructor(config?: Partial<CanvasChatBridgeConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Canvas → Chat Events
  // ===========================================================================

  /**
   * Handle agent selection on canvas
   */
  onCanvasAgentSelected(agentId: string): void {
    const previousAgentId = this.selectedCanvasAgent;
    this.selectedCanvasAgent = agentId;

    this.emit('canvas:agent:selected', {
      agentId,
      previousAgentId,
    } as CanvasAgentSelectedEvent);

    // Auto-focus corresponding chat pane
    if (this.config.autoFocusOnSelect) {
      const pane = this.config.agentPaneMappings.get(agentId);
      if (pane) {
        this.focusChatPane(pane, agentId);
      }
    }
  }

  /**
   * Handle agent state change on canvas
   */
  onCanvasAgentStateChanged(agentId: string, newState: AgentState): void {
    const previousState = this.agentStates.get(agentId) || 'dormant';
    this.agentStates.set(agentId, newState);

    this.emit('canvas:agent:state-changed', {
      agentId,
      previousState,
      newState,
    } as CanvasAgentStateEvent);

    // Emit activation/deactivation events
    if (newState === 'awake' && previousState !== 'awake') {
      this.emit('agent:activated', { agentId });
    } else if (newState !== 'awake' && previousState === 'awake') {
      this.emit('agent:deactivated', { agentId });
    }
  }

  // ===========================================================================
  // Chat → Canvas Events
  // ===========================================================================

  /**
   * Handle message sent in chat pane
   */
  onChatMessageSent(message: ChatMessage, pane: ChatPanePosition, agentId: string): void {
    this.emit('chat:message:sent', {
      message,
      pane,
      agentId,
    } as ChatMessageEvent);

    // Update canvas state to show agent is processing
    if (this.config.syncStateOnActivity) {
      const currentState = this.agentStates.get(agentId);
      if (currentState !== 'awake') {
        this.onCanvasAgentStateChanged(agentId, 'awake');
      }
    }
  }

  /**
   * Handle message received in chat pane
   */
  onChatMessageReceived(message: ChatMessage, pane: ChatPanePosition, agentId: string): void {
    this.emit('chat:message:received', {
      message,
      pane,
      agentId,
    } as ChatMessageEvent);
  }

  /**
   * Handle typing state change
   */
  onChatTypingChanged(agentId: string, pane: ChatPanePosition, isTyping: boolean): void {
    if (isTyping) {
      this.typingAgents.add(agentId);
    } else {
      this.typingAgents.delete(agentId);
    }

    this.emit(isTyping ? 'chat:typing:started' : 'chat:typing:stopped', {
      agentId,
      pane,
      isTyping,
    } as ChatTypingEvent);
  }

  /**
   * Handle chat pane focus
   */
  onChatPaneFocused(pane: ChatPanePosition, agentId: string): void {
    this.focusedPane = pane;

    this.emit('chat:pane:focused', {
      pane,
      agentId,
    } as ChatPaneFocusEvent);
  }

  // ===========================================================================
  // Mapping Management
  // ===========================================================================

  /**
   * Map an agent to a chat pane
   */
  mapAgentToPane(agentId: string, pane: ChatPanePosition): void {
    this.config.agentPaneMappings.set(agentId, pane);
  }

  /**
   * Get the pane for an agent
   */
  getPaneForAgent(agentId: string): ChatPanePosition | undefined {
    return this.config.agentPaneMappings.get(agentId);
  }

  /**
   * Get the agent for a pane
   */
  getAgentForPane(pane: ChatPanePosition): string | undefined {
    for (const [agentId, mappedPane] of this.config.agentPaneMappings) {
      if (mappedPane === pane) {
        return agentId;
      }
    }
    return undefined;
  }

  /**
   * Set up bindings for a workspace
   */
  setupWorkspaceBindings(primaryAgent: AgentBinding, secondaryAgent?: AgentBinding): void {
    this.mapAgentToPane(primaryAgent.agentId, 'left');
    if (secondaryAgent) {
      this.mapAgentToPane(secondaryAgent.agentId, 'right');
    }
  }

  // ===========================================================================
  // State Queries
  // ===========================================================================

  /**
   * Get current agent state
   */
  getAgentState(agentId: string): AgentState {
    return this.agentStates.get(agentId) || 'dormant';
  }

  /**
   * Check if agent is typing
   */
  isAgentTyping(agentId: string): boolean {
    return this.typingAgents.has(agentId);
  }

  /**
   * Get focused pane
   */
  getFocusedPane(): ChatPanePosition | null {
    return this.focusedPane;
  }

  /**
   * Get selected canvas agent
   */
  getSelectedCanvasAgent(): string | null {
    return this.selectedCanvasAgent;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Focus a chat pane
   */
  private focusChatPane(pane: ChatPanePosition, agentId: string): void {
    this.focusedPane = pane;
    this.emit('chat:pane:focused', { pane, agentId } as ChatPaneFocusEvent);
  }

  /**
   * Reset bridge state
   */
  reset(): void {
    this.agentStates.clear();
    this.typingAgents.clear();
    this.focusedPane = null;
    this.selectedCanvasAgent = null;
    this.config.agentPaneMappings.clear();
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let bridgeInstance: CanvasChatBridge | null = null;

/**
 * Get the singleton bridge instance
 */
export function getCanvasChatBridge(config?: Partial<CanvasChatBridgeConfig>): CanvasChatBridge {
  if (!bridgeInstance) {
    bridgeInstance = new CanvasChatBridge(config);
  }
  return bridgeInstance;
}

/**
 * Reset the singleton bridge (useful for testing)
 */
export function resetCanvasChatBridge(): void {
  if (bridgeInstance) {
    bridgeInstance.reset();
    bridgeInstance = null;
  }
}

export default CanvasChatBridge;
