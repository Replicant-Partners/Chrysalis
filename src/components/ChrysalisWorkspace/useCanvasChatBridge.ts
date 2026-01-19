/**
 * useCanvasChatBridge Hook
 *
 * React hook for integrating the CanvasChatBridge with ChrysalisWorkspace.
 * Provides event handlers and state synchronization between canvas and chat.
 *
 * @module components/ChrysalisWorkspace/useCanvasChatBridge
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import {
  CanvasChatBridge,
  getCanvasChatBridge,
  CanvasAgentSelectedEvent,
  ChatPaneFocusEvent,
} from '../../agents/bridges/CanvasChatBridge';
import { AgentBinding, ChatPanePosition, ChatMessage } from './types';
import type { AgentState } from '../../terminal/protocols';

// =============================================================================
// Types
// =============================================================================

export interface UseCanvasChatBridgeOptions {
  primaryAgent: AgentBinding;
  secondaryAgent?: AgentBinding;
  onPaneFocusRequest?: (pane: ChatPanePosition) => void;
  onAgentActivated?: (agentId: string) => void;
  onAgentDeactivated?: (agentId: string) => void;
}

export interface UseCanvasChatBridgeReturn {
  // Event handlers for canvas
  handleCanvasAgentSelected: (agentId: string) => void;
  handleCanvasAgentStateChanged: (agentId: string, state: AgentState) => void;

  // Event handlers for chat
  handleChatMessageSent: (message: ChatMessage, pane: ChatPanePosition) => void;
  handleChatMessageReceived: (message: ChatMessage, pane: ChatPanePosition) => void;
  handleChatTypingChanged: (agentId: string, pane: ChatPanePosition, isTyping: boolean) => void;
  handleChatPaneFocused: (pane: ChatPanePosition) => void;

  // State queries
  selectedCanvasAgent: string | null;
  focusedPane: ChatPanePosition | null;
  isAgentTyping: (agentId: string) => boolean;
  getAgentState: (agentId: string) => AgentState;

  // Bridge instance (for advanced use)
  bridge: CanvasChatBridge;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for canvas-chat bridge integration
 */
export function useCanvasChatBridge(
  options: UseCanvasChatBridgeOptions
): UseCanvasChatBridgeReturn {
  const {
    primaryAgent,
    secondaryAgent,
    onPaneFocusRequest,
    onAgentActivated,
    onAgentDeactivated,
  } = options;

  // Get bridge instance
  const bridgeRef = useRef<CanvasChatBridge>(getCanvasChatBridge());
  const bridge = bridgeRef.current;

  // Local state mirrors
  const [selectedCanvasAgent, setSelectedCanvasAgent] = useState<string | null>(null);
  const [focusedPane, setFocusedPane] = useState<ChatPanePosition | null>(null);

  // Setup agent-pane mappings
  useEffect(() => {
    bridge.setupWorkspaceBindings(primaryAgent, secondaryAgent);

    return () => {
      // Don't reset on unmount - might be temporary
    };
  }, [bridge, primaryAgent, secondaryAgent]);

  // Subscribe to bridge events
  useEffect(() => {
    const handleAgentSelected = (event: CanvasAgentSelectedEvent) => {
      setSelectedCanvasAgent(event.agentId);
    };

    const handlePaneFocused = (event: ChatPaneFocusEvent) => {
      setFocusedPane(event.pane);
      onPaneFocusRequest?.(event.pane);
    };

    const handleActivated = (event: { agentId: string }) => {
      onAgentActivated?.(event.agentId);
    };

    const handleDeactivated = (event: { agentId: string }) => {
      onAgentDeactivated?.(event.agentId);
    };

    bridge.on('canvas:agent:selected', handleAgentSelected);
    bridge.on('chat:pane:focused', handlePaneFocused);
    bridge.on('agent:activated', handleActivated);
    bridge.on('agent:deactivated', handleDeactivated);

    return () => {
      bridge.off('canvas:agent:selected', handleAgentSelected);
      bridge.off('chat:pane:focused', handlePaneFocused);
      bridge.off('agent:activated', handleActivated);
      bridge.off('agent:deactivated', handleDeactivated);
    };
  }, [bridge, onPaneFocusRequest, onAgentActivated, onAgentDeactivated]);

  // ===========================================================================
  // Canvas Event Handlers
  // ===========================================================================

  const handleCanvasAgentSelected = useCallback((agentId: string) => {
    bridge.onCanvasAgentSelected(agentId);
  }, [bridge]);

  const handleCanvasAgentStateChanged = useCallback((agentId: string, state: AgentState) => {
    bridge.onCanvasAgentStateChanged(agentId, state);
  }, [bridge]);

  // ===========================================================================
  // Chat Event Handlers
  // ===========================================================================

  const handleChatMessageSent = useCallback((message: ChatMessage, pane: ChatPanePosition) => {
    const agentId = bridge.getAgentForPane(pane);
    if (agentId) {
      bridge.onChatMessageSent(message, pane, agentId);
    }
  }, [bridge]);

  const handleChatMessageReceived = useCallback((message: ChatMessage, pane: ChatPanePosition) => {
    const agentId = bridge.getAgentForPane(pane);
    if (agentId) {
      bridge.onChatMessageReceived(message, pane, agentId);
    }
  }, [bridge]);

  const handleChatTypingChanged = useCallback((agentId: string, pane: ChatPanePosition, isTyping: boolean) => {
    bridge.onChatTypingChanged(agentId, pane, isTyping);
  }, [bridge]);

  const handleChatPaneFocused = useCallback((pane: ChatPanePosition) => {
    const agentId = bridge.getAgentForPane(pane);
    if (agentId) {
      bridge.onChatPaneFocused(pane, agentId);
    }
  }, [bridge]);

  // ===========================================================================
  // State Query Callbacks
  // ===========================================================================

  const isAgentTyping = useCallback((agentId: string) => {
    return bridge.isAgentTyping(agentId);
  }, [bridge]);

  const getAgentState = useCallback((agentId: string) => {
    return bridge.getAgentState(agentId);
  }, [bridge]);

  return {
    // Canvas handlers
    handleCanvasAgentSelected,
    handleCanvasAgentStateChanged,

    // Chat handlers
    handleChatMessageSent,
    handleChatMessageReceived,
    handleChatTypingChanged,
    handleChatPaneFocused,

    // State
    selectedCanvasAgent,
    focusedPane,
    isAgentTyping,
    getAgentState,

    // Bridge instance
    bridge,
  };
}

export default useCanvasChatBridge;
